/* ============================================================
   Операторы, регистрация типов, планировщик
   ============================================================ */
function* execBlock(R, b, env){
  const en = new Env(env);
  for(const s of (b.body || [])) yield* exec(R, s, en);
}
function* exec(R, s, env){
  R.tick();
  switch(s.k){
    case "block": return yield* execBlock(R, s, env);
    case "empty": return;
    case "decl":
      for(const v of s.vars){
        const val = v.init ? cp(yield* ev(R, v.init, env)) : defaultOf(s.type);
        env.def(v.name, val);
        if(s.type && s.type.name !== "var" && R.types[s.type.name]) env.defType(v.name, s.type.name);
      }
      return;
    case "exprstmt": yield* ev(R, s.e, env); return;
    case "localfn": {
      env.def(s.name, VFn(s.ps, s.body, env, false, env.has("this") ? env.get("this") : null, ));
      const f = env.get(s.name); f.isAsync = (s.mods || []).includes("async");
      return;
    }
    case "if":
      if(truthy(yield* ev(R, s.c, env))) yield* exec(R, s.a, new Env(env));
      else if(s.b) yield* exec(R, s.b, new Env(env));
      return;
    case "while":
      while(truthy(yield* ev(R, s.c, env))){
        R.tick();
        try{ yield* exec(R, s.body, new Env(env)); }
        catch(x){ if(x === BRK) break; if(x === CNT) continue; throw x; }
      }
      return;
    case "do":
      for(;;){
        R.tick();
        try{ yield* exec(R, s.body, new Env(env)); }
        catch(x){ if(x === BRK) break; if(x !== CNT) throw x; }
        if(!truthy(yield* ev(R, s.c, env))) break;
      }
      return;
    case "for": {
      const en = new Env(env);
      if(s.init) yield* exec(R, s.init, en);
      for(;;){
        R.tick();
        if(s.c && !truthy(yield* ev(R, s.c, en))) break;
        try{ yield* exec(R, s.body, new Env(en)); }
        catch(x){ if(x === BRK) break; if(x !== CNT) throw x; }
        if(s.step) yield* ev(R, s.step, en);
      }
      return;
    }
    case "foreach": {
      const src = yield* ev(R, s.src, env);
      const items = yield* iterate(R, src);
      /* Перечислитель следит за изменениями источника: List и Dictionary
         бросают исключение, если коллекцию изменили во время перебора. */
      const watch = src.t === "list" ? src : null;
      const wdict = src.t === "dict" ? src : null;
      const n0 = watch ? watch.items.length : wdict ? wdict.map.size : 0;
      for(const it of items){
        R.tick();
        const en = new Env(env);
        en.def(s.name, cp(it));
        try{ yield* exec(R, s.body, en); }
        catch(x){ if(x === BRK) break; if(x === CNT) continue; throw x; }
        const n1 = watch ? watch.items.length : wdict ? wdict.map.size : n0;
        if(n1 !== n0)
          csThrow(R, "InvalidOperationException",
            "коллекция была изменена во время перебора");
      }
      return;
    }
    case "switch": {
      const v = yield* ev(R, s.e, env);
      let hit = -1;
      for(let i = 0; i < s.cases.length && hit < 0; i++){
        for(const cv of s.cases[i].vals) if(eqv(v, yield* ev(R, cv, env))){ hit = i; break; }
      }
      if(hit < 0) hit = s.cases.findIndex(c => c.isDef);
      if(hit < 0) return;
      const en = new Env(env);
      try{ for(let i = hit; i < s.cases.length; i++) for(const st of s.cases[i].body) yield* exec(R, st, en); }
      catch(x){ if(x !== BRK) throw x; }
      return;
    }
    case "return": throw new Ret(s.e ? cp(yield* ev(R, s.e, env)) : VNull());
    case "break": throw BRK;
    case "continue": throw CNT;
    case "throw": {
      const v = s.e ? yield* ev(R, s.e, env) : VNull();
      throw new CsThrow(v);
    }
    case "try": {
      let pending = null;
      try{ yield* execBlock(R, s.body, env); }
      catch(x){
        if(x instanceof CsThrow){
          const c = pickCatch(s.catches, x.val);
          if(c){
            const en = new Env(env);
            if(c.name) en.def(c.name, x.val);
            try{ yield* execBlock(R, c.body, en); }
            catch(y){ pending = y; }
          } else pending = x;
        } else pending = x;
      }
      /* finally выполняется всегда: и после успеха, и после исключения, и при return */
      if(s.fin) yield* execBlock(R, s.fin, env);
      if(pending) throw pending;
      return;
    }
    case "using": {
      const en = new Env(env);
      yield* exec(R, s.decl, en);
      const names = s.decl.k === "decl" ? s.decl.vars.map(v => v.name) : [];
      let pending = null;
      try{ yield* exec(R, s.body, en); }
      catch(x){ pending = x; }
      /* Dispose в обратном порядке объявления — и обязательно, даже при исключении */
      for(let i = names.length - 1; i >= 0; i--){
        const o = en.get(names[i]);
        if(o && (o.t === "obj" || o.t === "struct")){
          const f = findMember(o.cls, "Dispose");
          if(f && f.m.body) yield* callMethod(R, o, f.m, f.cls, []);
        }
      }
      if(pending) throw pending;
      return;
    }
  }
  cserr("не умею выполнять " + s.k, s.line);
}
function pickCatch(catches, val){
  for(const c of catches){
    if(!c.type) return c;
    const n = c.type.name;
    if(n === "Exception") return c;
    if(val.t === "obj" && val.cls && (val.cls.name === n || (val.cls.bases || []).includes(n) || isA(val.cls, n))) return c;
  }
  return null;
}

/* ── регистрация типов ─────────────────────────────────── */
function registerTypes(R, decls, rootEnv){
  for(const d of decls){
    if(d.k === "enum"){
      R.types[d.name] = {name:d.name, kind:"enum", members:[], vals:d.vals, env:rootEnv};
      continue;
    }
    R.types[d.name] = {name:d.name, kind:d.kind, members:d.members, bases:d.bases || [],
                       mods:d.mods || [], env:rootEnv, ifaces:[]};
  }
  for(const d of decls){
    if(d.k === "enum") continue;
    const c = R.types[d.name];
    for(const b of (d.bases || [])){
      const bt = R.types[b];
      if(bt && bt.kind === "interface") c.ifaces.push(b);
      else if(bt) c.baseCls = bt;
      else c.ifaces.push(b);
    }
    /* интерфейсы наследуют интерфейсы */
    if(c.baseCls) c.ifaces = c.ifaces.concat(c.baseCls.ifaces || []);
  }
}

/* ── планировщик ───────────────────────────────────────── */
function drive(R, gen, task){
  const step = (input) => {
    let r;
    try{ r = gen.next(input); }
    catch(x){
      if(x instanceof Ret){ if(task) completeTask(R, task, x.v); return; }
      if(x instanceof CsThrow){ if(task){ completeTask(R, task, null, x.val); return; } throw x; }
      throw x;
    }
    if(r.done){ if(task) completeTask(R, task, r.value); return; }
    const y = r.value;
    if(y && y.wait){
      const t = y.wait;
      if(t.done){ step(undefined); return; }
      t.waiters.push(() => step(undefined));
      return;
    }
    if(y && y.spawn){
      drive(R, y.spawn.gen, y.spawn.task);
      step(undefined);
      return;
    }
    step(undefined);
  };
  step(undefined);
}
function pump(R){
  let guard = 0;
  while(R.scheduler.length && guard++ < 100000){
    R.scheduler.sort((a, b) => a.due - b.due);
    const job = R.scheduler.shift();
    R.now = Math.max(R.now, job.due);
    job.resume();
  }
}

/* ── точка входа ───────────────────────────────────────── */
/* Console.Write без завершающего WriteLine оставляет строку в буфере */
function flushPending(R){ if(R.pending){ R.out.push(R.pending); R.pending = ""; } }

function runCs(src){
  const R = mkRuntime();
  let ast;
  try{ ast = parse(src); }
  catch(x){ return {out:[], error: x.message, line: x.line, phase:"разбор"}; }
  const rootEnv = new Env(null);
  try{
    registerTypes(R, ast.types, rootEnv);
    const mainGen = (function*(){
      for(const s of ast.top) yield* exec(R, s, rootEnv);
      /* если есть класс с Main и нет операторов верхнего уровня — вызвать Main */
      if(!ast.top.length){
        for(const n in R.types){
          const f = findMember(R.types[n], "Main");
          if(f && f.m.body){ yield* callMethod(R, null, f.m, f.cls, []); break; }
        }
      }
      return VNull();
    })();
    drive(R, mainGen, null);
    pump(R);
    flushPending(R);
  }catch(x){
    flushPending(R);
    if(x instanceof CsThrow){
      const name = x.val.cls ? x.val.cls.name : "Exception";
      const msg = x.val.f && x.val.f.Message ? x.val.f.Message.v : "";
      return {out:R.out, error:"Необработанное исключение " + name + ": " + msg, phase:"выполнение", thrown:name};
    }
    if(x instanceof Ret) return {out:R.out};
    if(x instanceof CsErr) return {out:R.out, error:x.message, line:x.line, phase:"выполнение"};
    return {out:R.out, error:String(x && x.message || x), phase:"выполнение"};
  }
  return {out:R.out, env:rootEnv, R};
}
