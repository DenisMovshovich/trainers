/* ============================================================
   Интерпретатор. Все вычислители — генераторы: это позволяет
   честно приостанавливать выполнение на await.
   ============================================================ */
function mkRuntime(){
  const R = {
    out: [],                 /* строки вывода */
    pending: "",             /* незавершённая строка от Console.Write */
    types: Object.create(null),
    scheduler: [],           /* отложенные продолжения: {due, resume} */
    now: 0,
    steps: 0,
    trace: []                /* журнал для визуализации */
  };
  R.print = s => { R.out.push(s); if(R.out.length > 500) cserr("слишком много вывода — похоже на бесконечный цикл"); };
  R.tick = () => { if(++R.steps > 400000) cserr("выполнение не завершилось: похоже на бесконечный цикл"); };
  return R;
}
const csThrow = (R, type, msg) => {
  const o = VObj({name:type, members:[], bases:[]});
  o.f.Message = VStr(msg);
  throw new CsThrow(o);
};

/* ── задачи ────────────────────────────────────────────── */
function newTask(R){
  return {t:"task", id:++__oid, done:false, value:VNull(), error:null, waiters:[]};
}
function completeTask(R, task, value, error){
  if(task.done) return;
  task.done = true; task.value = value || VNull(); task.error = error || null;
  const ws = task.waiters.slice(); task.waiters.length = 0;
  for(const w of ws) R.scheduler.push({due: R.now, resume: w});
}

/* ── доступ к членам ───────────────────────────────────── */
function findMember(cls, name){
  let c = cls;
  while(c){
    const m = (c.members || []).find(x => (x.k === "method" || x.k === "prop") && x.name === name);
    if(m) return {m, cls:c};
    c = c.baseCls;
  }
  return null;
}
function findCtor(cls, n){
  const cs = (cls.members || []).filter(m => m.k === "ctor");
  return cs.find(c => c.ps.length === n) || cs[0] || null;
}
function isA(cls, name){
  let c = cls;
  while(c){ if(c.name === name) return true;
    if((c.ifaces || []).includes(name)) return true;
    c = c.baseCls; }
  return false;
}

/* ── вычисление выражений ──────────────────────────────── */
function* ev(R, e, env){
  R.tick();
  switch(e.k){
    case "lit": return e.t === "null" ? VNull() : {t:e.t, v:e.v};
    case "interp": {
      let s = "";
      for(const part of e.parts){
        if(part.lit !== undefined) s += part.lit;
        else s += toStr(R, yield* ev(R, part.e, env));
      }
      return VStr(s);
    }
    case "id": {
      if(env.has(e.name)) return env.get(e.name);
      /* внутри метода поле можно писать без this. — ищем в текущем объекте */
      if(env.has("this")){
        const self = env.get("this");
        if(self && (self.t === "obj" || self.t === "struct")){
          if(self.f[e.name] !== undefined) return self.f[e.name];
          const fm = findMember(self.cls, e.name);
          if(fm) return yield* evMember(R, {k:"member", o:{k:"this"}, name:e.name, line:e.line}, env);
        }
      }
      if(R.types[e.name]) return {t:"typeref", cls:R.types[e.name], name:e.name};
      if(["Console","Math","Task","String","Int32","int","string","Convert","Guid","DateTime","Enumerable"].includes(e.name))
        return {t:"typeref", cls:null, name:e.name};
      cserr("переменная «" + e.name + "» не объявлена", e.line);
    }
    case "this": return env.get("this");
    case "base": { const self = env.get("this"); return {t:"baseref", self}; }
    case "typeof": return VStr(e.type.name);
    case "nameof": return VStr(e.e.name || "");
    case "un": {
      const v = yield* ev(R, e.e, env);
      if(e.op === "!") return VBool(!truthy(v));
      if(e.op === "-") return v.t === "int" ? VInt(-v.v) : VDbl(-v.v);
      if(e.op === "+") return v;
      if(e.op === "~") return VInt(~v.v);
      break;
    }
    case "pre": case "post": {
      const old = yield* ev(R, e.e, env);
      const nv = old.t === "int" ? VInt(old.v + (e.op === "++" ? 1 : -1))
                                 : VDbl(old.v + (e.op === "++" ? 1 : -1));
      yield* store(R, e.e, env, nv);
      return e.k === "pre" ? nv : old;
    }
    case "cast": {
      const v = yield* ev(R, e.e, env);
      const n = e.type.name;
      if(n === "int" || n === "long") return VInt(Math.trunc(v.v));
      if(n === "double" || n === "float" || n === "decimal") return VDbl(Number(v.v));
      if(n === "string") return VStr(toStr(R, v));
      if(n === "bool") return VBool(v.v);
      if(v.t === "obj" && !isA(v.cls, n)) csThrow(R, "InvalidCastException", "нельзя привести " + v.cls.name + " к " + n);
      return v;
    }
    case "is": {
      const v = yield* ev(R, e.e, env);
      const r = typeMatches(v, e.type.name);
      if(r && e.alias) env.def(e.alias, v);
      return VBool(r);
    }
    case "as": {
      const v = yield* ev(R, e.e, env);
      return typeMatches(v, e.type.name) ? v : VNull();
    }
    case "cond": {
      const c = yield* ev(R, e.c, env);
      return truthy(c) ? yield* ev(R, e.a, env) : yield* ev(R, e.b, env);
    }
    case "bin": return yield* evBin(R, e, env);
    case "assign": return yield* evAssign(R, e, env);
    case "lambda": return VFn(e.ps, e.body || e.expr, env, !e.body, env.has("this") ? env.get("this") : null);
    case "await": {
      const v = yield* ev(R, e.e, env);
      if(v.t !== "task") return v;
      if(!v.done) yield {wait: v};
      if(v.error) throw new CsThrow(v.error);
      return v.value;
    }
    case "new": return yield* evNew(R, e, env);
    case "newarr": {
      const items = [];
      for(const it of e.items) items.push(cp(yield* ev(R, it, env)));
      return VArr(items, e.type ? e.type.name : null);
    }
    case "index": {
      const o = yield* ev(R, e.o, env);
      const i = yield* ev(R, e.i, env);
      if(o.t === "null") csThrow(R, "NullReferenceException", "обращение по индексу к null");
      if(o.t === "dict"){
        const k = keyOf(i);
        if(!o.map.has(k)) csThrow(R, "KeyNotFoundException", "ключ «" + k + "» отсутствует в словаре");
        return o.map.get(k);
      }
      if(o.t === "string"){
        if(i.v < 0 || i.v >= o.v.length) csThrow(R, "IndexOutOfRangeException", "индекс " + i.v + " вне строки длиной " + o.v.length);
        return VChar(o.v[i.v]);
      }
      const arr = o.items;
      if(!arr) cserr("по индексу можно обращаться к массиву, списку, словарю или строке");
      if(i.v < 0 || i.v >= arr.length)
        csThrow(R, o.t === "list" ? "ArgumentOutOfRangeException" : "IndexOutOfRangeException",
                "индекс " + i.v + " вне диапазона (длина " + arr.length + ")");
      return arr[i.v];
    }
    case "member": return yield* evMember(R, e, env);
    case "call": return yield* evCall(R, e, env);
  }
  cserr("не умею вычислять узел " + e.k, e.line);
}

const truthy = v => v.t === "bool" ? v.v : v.t === "null" ? false : !!v.v;
const keyOf = v => v.t === "string" || v.t === "char" ? "s:" + v.v : "n:" + v.v;
function typeMatches(v, n){
  if(v.t === "null") return false;
  if(n === "object") return true;
  if(v.t === "int" && (n === "int" || n === "long")) return true;
  if(v.t === "double" && (n === "double" || n === "float" || n === "decimal")) return true;
  if(v.t === "string" && n === "string") return true;
  if(v.t === "bool" && n === "bool") return true;
  if(v.t === "char" && n === "char") return true;
  if((v.t === "obj" || v.t === "struct") && v.cls) return isA(v.cls, n);
  if(v.t === "list" && (n === "List" || n === "IEnumerable" || n === "ICollection" || n === "IList")) return true;
  if(v.t === "array" && (n === "Array" || n === "IEnumerable")) return true;
  return false;
}
function toStr(R, v){
  if(v.t === "obj" || v.t === "struct"){
    const f = findMember(v.cls, "ToString");
    if(f && f.m.body){
      const g = callMethod(R, v, f.m, f.cls, []);
      let r = g.next();
      while(!r.done) r = g.next();     /* ToString синхронен */
      return r.value.v;
    }
    return v.cls ? v.cls.name : "object";
  }
  return fmt(v);
}

/* ── операторы ─────────────────────────────────────────── */
function* evBin(R, e, env){
  if(e.op === "&&"){ const l = yield* ev(R, e.l, env); if(!truthy(l)) return VBool(false); return VBool(truthy(yield* ev(R, e.r, env))); }
  if(e.op === "||"){ const l = yield* ev(R, e.l, env); if(truthy(l)) return VBool(true);  return VBool(truthy(yield* ev(R, e.r, env))); }
  if(e.op === "??"){ const l = yield* ev(R, e.l, env); return l.t === "null" ? yield* ev(R, e.r, env) : l; }
  const a = yield* ev(R, e.l, env), b = yield* ev(R, e.r, env);
  return applyBin(R, e.op, a, b, e.line);
}
function applyBin(R, op, a, b, line){
  switch(op){
    case "+":
      if(a.t === "string" || b.t === "string") return VStr(toStr(R, a) + toStr(R, b));
      return arith(R, a, b, (x, y) => x + y, line);
    case "-": return arith(R, a, b, (x, y) => x - y, line);
    case "*": return arith(R, a, b, (x, y) => x * y, line);
    case "/":
      if(isNum(a) && isNum(b) && b.v === 0 && a.t === "int" && b.t === "int")
        csThrow(R, "DivideByZeroException", "деление на ноль");
      /* целочисленное деление отбрасывает дробную часть — источник классической ошибки */
      if(a.t === "int" && b.t === "int") return VInt(Math.trunc(a.v / b.v));
      return VDbl(a.v / b.v);
    case "%":
      if(b.v === 0 && a.t === "int") csThrow(R, "DivideByZeroException", "деление на ноль");
      return arith(R, a, b, (x, y) => x % y, line);
    case "<<": return VInt(a.v << b.v);
    case ">>": return VInt(a.v >> b.v);
    case "<": return VBool(cmpv(a, b) < 0);
    case ">": return VBool(cmpv(a, b) > 0);
    case "<=": return VBool(cmpv(a, b) <= 0);
    case ">=": return VBool(cmpv(a, b) >= 0);
    case "==": return VBool(eqv(a, b));
    case "!=": return VBool(!eqv(a, b));
  }
  cserr("неизвестный оператор " + op, line);
}
function arith(R, a, b, f, line){
  if(!isNum(a) || !isNum(b)){
    if(a.t === "null" || b.t === "null") csThrow(R, "NullReferenceException", "арифметика над null");
    cserr("нельзя применить арифметику к " + a.t + " и " + b.t, line);
  }
  const r = f(a.v, b.v);
  return (a.t === "int" && b.t === "int") ? VInt(r) : VDbl(r);
}
const cmpv = (a, b) => {
  if(a.t === "string" && b.t === "string") return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
};
/* == сравнивает СОДЕРЖИМОЕ для значимых типов и строк, а для классов — ССЫЛКИ */
function eqv(a, b){
  if(a.t === "null" || b.t === "null") return a.t === "null" && b.t === "null";
  if(a.t === "string" || b.t === "string" || a.t === "char" || b.t === "char") return String(a.v) === String(b.v);
  if(isNum(a) && isNum(b)) return a.v === b.v;
  if(a.t === "bool" && b.t === "bool") return a.v === b.v;
  if(a.t === "struct" && b.t === "struct"){
    if(a.cls !== b.cls) return false;
    for(const k in a.f) if(!eqv(a.f[k], b.f[k])) return false;
    return true;
  }
  return a.id !== undefined && a.id === b.id;
}

/* ── присваивание ──────────────────────────────────────── */
function* evAssign(R, e, env){
  if(e.op === "??="){
    const cur = yield* ev(R, e.target, env);
    if(cur.t !== "null") return cur;
    const v = cp(yield* ev(R, e.value, env));
    yield* store(R, e.target, env, v); return v;
  }
  let v = cp(yield* ev(R, e.value, env));
  if(e.op !== "="){
    const cur = yield* ev(R, e.target, env);
    v = applyBin(R, e.op[0], cur, v, e.line);
  }
  yield* store(R, e.target, env, v);
  return v;
}
function* store(R, target, env, v){
  if(target.k === "id"){
    if(env.set(target.name, v)) return;
    /* внутри метода присваивание без this. должно попасть в поле объекта */
    if(env.has("this")){
      const self = env.get("this");
      if(self && (self.t === "obj" || self.t === "struct") &&
         (self.f[target.name] !== undefined || findMember(self.cls, target.name))){
        yield* setMember(R, self, target.name, v);
        return;
      }
    }
    env.def(target.name, v);
    return;
  }
  if(target.k === "member"){
    const o = yield* ev(R, target.o, env);
    if(o.t === "null") csThrow(R, "NullReferenceException", "запись в поле объекта null");
    if(o.t === "obj" || o.t === "struct"){ yield* setMember(R, o, target.name, v); return; }
    cserr("нельзя присвоить поле у " + o.t);
  }
  if(target.k === "index"){
    const o = yield* ev(R, target.o, env);
    const i = yield* ev(R, target.i, env);
    if(o.t === "dict"){ o.map.set(keyOf(i), v); return; }
    if(o.items){
      if(i.v < 0 || i.v >= o.items.length) csThrow(R, "IndexOutOfRangeException", "индекс " + i.v + " вне диапазона");
      o.items[i.v] = v; return;
    }
    cserr("нельзя присвоить по индексу");
  }
  cserr("нельзя присвоить это выражение");
}

/* ── создание объектов ─────────────────────────────────── */
function* evNew(R, e, env){
  const n = e.type.name;
  if(n === "List"){
    const v = VList([], e.type.args ? e.type.args[0].name : null);
    if(e.args.length && e.args[0].e){
      const src = yield* ev(R, e.args[0].e, env);
      for(const x of yield* iterate(R, src)) v.items.push(cp(x));
    }
    if(e.init) for(const it of e.init) v.items.push(cp(yield* ev(R, it.value, env)));
    return v;
  }
  if(n === "Dictionary"){
    const v = VDict();
    if(e.init) for(const it of e.init){
      if(it.kind === "kv") v.map.set(keyOf(yield* ev(R, it.key, env)), cp(yield* ev(R, it.value, env)));
    }
    return v;
  }
  if(n === "StringBuilder"){ const v = VObj({name:"StringBuilder", members:[], bases:[]}); v.f.__sb = VStr(""); return v; }
  if(["Exception","InvalidOperationException","ArgumentException","ArgumentNullException",
      "NullReferenceException","FormatException","NotSupportedException","IndexOutOfRangeException",
      "ArgumentOutOfRangeException","KeyNotFoundException","DivideByZeroException","TimeoutException",
      "InvalidCastException","ApplicationException"].includes(n) || /Exception$/.test(n) && !R.types[n]){
    const o = VObj({name:n, members:[], bases:["Exception"]});
    o.f.Message = e.args.length ? VStr(toStr(R, yield* ev(R, e.args[0].e, env))) : VStr("Возникло исключение типа «" + n + "».");
    return o;
  }
  const cls = R.types[n];
  if(!cls) cserr("неизвестный тип «" + n + "»", e.line);
  const inst = cls.kind === "struct" ? VStruct(cls) : VObj(cls);
  yield* initFields(R, inst, cls);
  const args = [];
  for(const a of e.args) args.push(cp(yield* ev(R, a.e, env)));
  const ctor = findCtor(cls, args.length);
  if(ctor) yield* runCtor(R, inst, cls, ctor, args);
  if(e.init) for(const it of e.init){
    if(it.kind === "prop") yield* setMember(R, inst, it.name, cp(yield* ev(R, it.value, env)));
    else if(it.kind === "item" && inst.items) inst.items.push(cp(yield* ev(R, it.value, env)));
  }
  return inst;
}
/* запись в поле или свойство конкретного объекта */
function* setMember(R, o, name, v){
  const f = findMember(o.cls, name);
  if(f && f.m.k === "prop" && f.m.setter && f.m.setter !== "auto"){
    const en = new Env(f.cls.env); en.def("this", o); en.def("value", v);
    yield* execBlock(R, f.m.setter, en);
    return;
  }
  o.f[name] = v;
}
function* initFields(R, inst, cls){
  const chain = [];
  let c = cls; while(c){ chain.unshift(c); c = c.baseCls; }
  for(const k of chain){
    for(const m of k.members || []){
      if(m.k === "field") for(const v of m.vars)
        inst.f[v.name] = v.init ? cp(yield* ev(R, v.init, new Env(k.env))) : defaultOf(m.type);
      if(m.k === "prop" && m.auto)
        inst.f[m.name] = m.init ? cp(yield* ev(R, m.init, new Env(k.env))) : defaultOf(m.type);
    }
  }
}
function defaultOf(t){
  const n = t ? t.name : "object";
  if(["int","long","short","byte"].includes(n)) return VInt(0);
  if(["double","float","decimal"].includes(n)) return VDbl(0);
  if(n === "bool") return VBool(false);
  if(n === "char") return VChar("\0");
  return VNull();
}
function* runCtor(R, inst, cls, ctor, args){
  const en = new Env(cls.env);
  en.def("this", inst);
  ctor.ps.forEach((p, i) => en.def(p.name, args[i] !== undefined ? args[i] : (p.def ? VNull() : VNull())));
  if(ctor.chain && ctor.chain.which === "base" && cls.baseCls){
    const bargs = [];
    for(const a of ctor.chain.args) bargs.push(cp(yield* ev(R, a.e, en)));
    const bc = findCtor(cls.baseCls, bargs.length);
    if(bc) yield* runCtor(R, inst, cls.baseCls, bc, bargs);
  } else if(ctor.chain && ctor.chain.which === "base" && ctor.chain.args.length){
    /* : base(message) у своего класса-исключения — базы как типа нет, но Message нужен */
    const m = cp(yield* ev(R, ctor.chain.args[0].e, en));
    inst.f.Message = VStr(toStr(R, m));
  }
  try{ yield* execBlock(R, ctor.body, en); }
  catch(x){ if(!(x instanceof Ret)) throw x; }
}

/* ── обращение к члену ─────────────────────────────────── */
function* evMember(R, e, env){
  const o = yield* ev(R, e.o, env);
  if(o.t === "null"){
    if(e.name === "HasValue") return VBool(false);
    if(e.name === "Value") csThrow(R, "InvalidOperationException", "у Nullable нет значения");
    if(e.safe) return VNull();
    csThrow(R, "NullReferenceException", "обращение к члену «" + e.name + "» у null");
  }
  /* Nullable<T>: значимый тип, у которого есть значение */
  if(["int","double","bool","char"].includes(o.t)){
    if(e.name === "HasValue") return VBool(true);
    if(e.name === "Value") return o;
  }
  if(o.t === "typeref") return {t:"static", owner:o, name:e.name};
  if(o.t === "baseref") return {t:"basemethod", self:o.self, name:e.name};
  if(o.t === "string"){
    if(e.name === "Length") return VInt(o.v.length);
    return {t:"bound", recv:o, name:e.name};
  }
  if(o.t === "list" || o.t === "array"){
    if(e.name === "Key" && o.key !== undefined) return o.key;
    if(e.name === "Count" || e.name === "Length"){
      /* list.Count — свойство, list.Count() — метод LINQ; пишутся одинаково */
      const v = VInt(o.items.length); v.bound = {t:"bound", recv:o, name:e.name}; return v;
    }
    return {t:"bound", recv:o, name:e.name};
  }
  if(o.t === "dict"){
    if(e.name === "Count") return VInt(o.map.size);
    if(e.name === "Keys") return VList([...o.map.keys()].map(k => k.startsWith("s:") ? VStr(k.slice(2)) : VInt(Number(k.slice(2)))));
    if(e.name === "Values") return VList([...o.map.values()]);
    return {t:"bound", recv:o, name:e.name};
  }
  if(o.t === "seq") return {t:"bound", recv:o, name:e.name};
  if(o.t === "task"){
    if(e.name === "Result"){ if(!o.done) yield {wait:o}; return o.value; }
    if(e.name === "IsCompleted") return VBool(o.done);
    return {t:"bound", recv:o, name:e.name};
  }
  if(o.t === "obj" || o.t === "struct"){
    /* Поиск начинается от ОБЪЯВЛЕННОГО типа переменной: метод, скрытый через new,
       виден только через переменную своего типа. */
    let from = o.cls;
    if(e.o.k === "id"){
      const tn = env.getType(e.o.name);
      const dt = tn ? R.types[tn] : null;
      const dm = dt && dt.kind !== "interface" ? findMember(dt, e.name) : null;
      if(dm && (dm.m.k !== "method" || dm.m.body)) from = dt;
    }
    const f = findMember(from, e.name);
    if(f && f.m.k === "prop"){
      if(f.m.auto || !f.m.getter || f.m.getter === "auto") return o.f[e.name] !== undefined ? o.f[e.name] : VNull();
      const en = new Env(f.cls.env); en.def("this", o);
      try{ yield* execBlock(R, f.m.getter, en); }
      catch(x){ if(x instanceof Ret) return x.v; throw x; }
      return VNull();
    }
    if(f && f.m.k === "method") return {t:"bound", recv:o, name:e.name, m:f.m, cls:f.cls};
    if(o.f[e.name] !== undefined) return o.f[e.name];
    if(e.name === "Message") return o.f.Message || VStr("");
    return {t:"bound", recv:o, name:e.name};
  }
  return {t:"bound", recv:o, name:e.name};
}

/* ── перебор последовательностей ───────────────────────── */
function* iterate(R, v){
  if(v.t === "list" || v.t === "array") return v.items.slice();
  if(v.t === "string") return [...v.v].map(c => VChar(c));
  if(v.t === "dict") return [...v.map.entries()].map(([k, val]) => {
    const o = VObj({name:"KeyValuePair", members:[], bases:[]});
    o.f.Key = k.startsWith("s:") ? VStr(k.slice(2)) : VInt(Number(k.slice(2)));
    o.f.Value = val; return o;
  });
  if(v.t === "seq") return yield* v.pull(R);          /* ЛЕНИВО: источник читается сейчас */
  if(v.t === "null") csThrow(R, "NullReferenceException", "перебор null");
  cserr("по этому значению нельзя пройтись в foreach");
}
/* Ленивая последовательность LINQ: хранит не результат, а способ его получить.
   Поэтому изменение исходной коллекции после построения запроса меняет итог. */
function VSeq(pull){ return {t:"seq", pull, id:++__oid}; }
function seqFrom(srcVal, transform){
  return VSeq(function*(R){
    const base = yield* iterate(R, srcVal);
    return yield* transform(R, base);
  });
}

/* ── вызовы ────────────────────────────────────────────── */
function* evCall(R, e, env){
  let f = yield* ev(R, e.f, env);
  if(f.bound) f = f.bound;
  const args = [];
  for(const a of e.args){
    /* out int n — переменная объявляется прямо в вызове, вычислять её нечего */
    if(a.mod === "out" && a.decl){
      if(!env.has(a.decl)) env.def(a.decl, VNull());
      args.push({mod:a.mod, node:a.e, val: VNull()});
      continue;
    }
    args.push({mod:a.mod, node:a.e, val: cp(yield* ev(R, a.e, env))});
  }

  if(f.t === "static") return yield* staticCall(R, f.owner.name, f.name, args, env, e);
  if(f.t === "basemethod"){
    const self = f.self;
    const base = self.cls.baseCls;
    const found = base ? findMember(base, f.name) : null;
    if(!found) cserr("в базовом классе нет метода «" + f.name + "»", e.line);
    return yield* callMethod(R, self, found.m, found.cls, args.map(a => a.val), true);
  }
  if(f.t === "fn"){
    const back = [];
    const r = yield* callFn(R, f, args.map(a => a.val), back);
    yield* writeBack(R, args, back, env);
    return r;
  }
  if(f.t === "bound") return yield* instanceCall(R, f, args, env, e);
  if(f.t === "typeref"){                       /* конструктор без new не поддерживаем */
    cserr("неизвестный вызов «" + f.name + "»", e.line);
  }
  cserr("это выражение нельзя вызвать", e.line);
}
function* callFn(R, f, argv, back){
  const en = new Env(f.env);
  const pname = p => typeof p === "string" ? p : p.name;
  f.ps.forEach((p, i) => en.def(pname(p), argv[i] !== undefined ? argv[i] : VNull()));
  if(f.self && !en.has("this")) en.def("this", f.self);
  const fill = () => { if(back) f.ps.forEach((p, i) => { back[i] = en.get(pname(p)); }); };
  if(f.isExpr){ const r = yield* ev(R, f.body, en); fill(); return r; }
  /* async-функция выполняется синхронно до первого await и возвращает задачу */
  if(f.isAsync) return yield* runAsyncBody(R, f.body, en);
  try{ yield* execBlock(R, f.body, en); }
  catch(x){ if(x instanceof Ret){ fill(); return x.v; } throw x; }
  fill();
  return VNull();
}
function* callMethod(R, self, m, cls, argv, noVirtual, back){
  /* виртуальная диспетчеризация: ищем переопределение от фактического типа.
     Для base.Method() её нужно отключить, иначе вызов вернётся в переопределение. */
  if(!noVirtual && self && self.cls && (m.mods.includes("virtual") || m.mods.includes("abstract") || m.mods.includes("override"))){
    const dyn = findMember(self.cls, m.name);
    /* new скрывает метод, а не переопределяет: переключаемся только на override */
    if(dyn && dyn.m.body && (dyn.m === m || dyn.m.mods.includes("override"))) { m = dyn.m; cls = dyn.cls; }
  }
  if(!m.body) cserr("метод «" + m.name + "» не имеет тела");
  const en = new Env(cls.env);
  if(self) en.def("this", self);
  m.ps.forEach((p, i) => en.def(p.name, argv[i] !== undefined ? argv[i] : (p.def ? VNull() : defaultOf(p.type))));
  const isAsync = m.mods && m.mods.includes("async");
  if(isAsync) return yield* runAsyncBody(R, m.body, en);
  const fill = () => { if(back) m.ps.forEach((p, i) => { back[i] = en.get(p.name); }); };
  try{ yield* execBlock(R, m.body, en); }
  catch(x){ if(x instanceof Ret){ fill(); return x.v; } throw x; }
  fill();
  return VNull();
}

/* ref и out: значения параметров возвращаются в переменные вызывающего */
function* writeBack(R, args, back, env){
  for(let i = 0; i < args.length; i++){
    const a = args[i];
    if((a.mod === "ref" || a.mod === "out") && a.node && back[i] !== undefined)
      yield* store(R, a.node, env, back[i]);
  }
}
/* async-метод: выполняется синхронно до первого await, затем возвращает задачу */
function* runAsyncBody(R, body, en){
  const task = newTask(R);
  const gen = (function*(){
    try{ yield* execBlock(R, body, en); return VNull(); }
    catch(x){ if(x instanceof Ret) return x.v; throw x; }
  })();
  yield {spawn: {gen, task}};
  return task;
}

/* ── статические вызовы ────────────────────────────────── */
function* staticCall(R, owner, name, args, env, e){
  const A = args.map(a => a.val);
  if(owner === "Console"){
    if(name === "WriteLine"){ R.print(R.pending + (A.length ? toStr(R, A[0]) : "")); R.pending = ""; return VNull(); }
    if(name === "Write"){ R.pending += A.length ? toStr(R, A[0]) : ""; return VNull(); }
  }
  if(owner === "Math"){
    const f = {Abs:Math.abs, Max:Math.max, Min:Math.min, Floor:Math.floor, Ceiling:Math.ceil,
               Sqrt:Math.sqrt, Pow:Math.pow, Truncate:Math.trunc}[name];
    if(name === "Round"){
      const d = A[1] ? A[1].v : 0, p = Math.pow(10, d);
      /* банковское округление: 2.5 → 2, 3.5 → 4 */
      const x = A[0].v * p, fl = Math.floor(x), diff = x - fl;
      let r; if(diff > 0.5) r = fl + 1; else if(diff < 0.5) r = fl; else r = (fl % 2 === 0) ? fl : fl + 1;
      return d ? VDbl(r / p) : VDbl(r / p);
    }
    if(f){ const r = f.apply(null, A.map(x => x.v));
      return (name === "Abs" || name === "Max" || name === "Min") && A.every(x => x.t === "int") ? VInt(r) : VDbl(r); }
  }
  if(owner === "Task"){
    if(name === "Delay"){
      const t = newTask(R);
      R.scheduler.push({due: R.now + (A[0] ? A[0].v : 0), resume: () => completeTask(R, t, VNull())});
      return t;
    }
    if(name === "FromResult"){ const t = newTask(R); completeTask(R, t, A[0]); return t; }
    if(name === "CompletedTask"){ const t = newTask(R); completeTask(R, t, VNull()); return t; }
    if(name === "WhenAll"){
      const ts = [];
      for(const a of A) for(const x of (a.items || [a])) if(x.t === "task") ts.push(x);
      const all = newTask(R);
      const check = () => { if(ts.every(x => x.done)) completeTask(R, all, VNull()); };
      ts.forEach(x => x.done ? null : x.waiters.push(check));
      check();
      return all;
    }
    if(name === "Run"){
      const fn = A[0];
      if(fn && fn.t === "fn"){
        const t = newTask(R);
        const gen = (function*(){ return yield* callFn(R, fn, []); })();
        yield {spawn:{gen, task:t}};
        return t;
      }
    }
  }
  if(owner === "String" || owner === "string"){
    if(name === "IsNullOrEmpty") return VBool(A[0].t === "null" || A[0].v === "");
    if(name === "IsNullOrWhiteSpace") return VBool(A[0].t === "null" || String(A[0].v).trim() === "");
    if(name === "Join"){
      const sep = toStr(R, A[0]);
      const items = yield* iterate(R, A[1]);
      return VStr(items.map(x => toStr(R, x)).join(sep));
    }
    if(name === "Format"){
      let s = A[0].v;
      for(let i = 1; i < A.length; i++) s = s.split("{" + (i - 1) + "}").join(toStr(R, A[i]));
      return VStr(s);
    }
    if(name === "Concat") return VStr(A.map(x => toStr(R, x)).join(""));
  }
  if(owner === "int" || owner === "Int32"){
    if(name === "Parse"){
      const n = Number(String(A[0].v).trim());
      if(!Number.isFinite(n) || String(A[0].v).trim() === "") csThrow(R, "FormatException", "строка «" + A[0].v + "» не является числом");
      return VInt(n);
    }
    if(name === "TryParse"){
      const raw = String(A[0].v).trim();
      const n = Number(raw);
      const ok = raw !== "" && Number.isFinite(n);
      const outArg = args[1];
      if(outArg) yield* store(R, outArg.node, env, ok ? VInt(n) : VInt(0));
      return VBool(ok);
    }
    if(name === "MaxValue") return VInt(2147483647);
  }
  if(owner === "Convert"){
    if(name === "ToInt32") return VInt(Number(A[0].v));
    if(name === "ToString") return VStr(toStr(R, A[0]));
    if(name === "ToDouble") return VDbl(Number(A[0].v));
  }
  if(owner === "Guid" && name === "NewGuid"){ const o = VObj({name:"Guid", members:[], bases:[]}); o.f.__g = VStr("guid-" + (++__oid)); return o; }
  if(owner === "Enumerable"){
    if(name === "Range"){ const s = A[0].v, c = A[1].v, out = []; for(let i = 0; i < c; i++) out.push(VInt(s + i)); return VList(out, "int"); }
    if(name === "Empty") return VList([]);
  }
  /* статический метод пользовательского типа */
  const cls = R.types[owner];
  if(cls){
    const f = findMember(cls, name);
    if(f && f.m.k === "method") return yield* callMethod(R, null, f.m, f.cls, A);
    if(f && f.m.k === "prop") return cls.statics && cls.statics[name] || VNull();
  }
  cserr("нет метода " + owner + "." + name, e && e.line);
}

/* ── вызовы у экземпляров: строки, коллекции, LINQ ─────── */
function* instanceCall(R, f, args, env, e){
  const o = f.recv, n = f.name, A = args.map(a => a.val);
  if(f.m){
    const back = [];
    const r = yield* callMethod(R, o, f.m, f.cls, A, false, back);
    yield* writeBack(R, args, back, env);
    return r;
  }

  if(o.t === "string"){
    const s = o.v;
    switch(n){
      case "ToUpper": return VStr(s.toUpperCase());
      case "ToLower": return VStr(s.toLowerCase());
      case "Trim": return VStr(s.trim());
      case "Substring": return VStr(A[1] !== undefined ? s.substr(A[0].v, A[1].v) : s.substring(A[0].v));
      case "Contains": return VBool(s.includes(toStr(R, A[0])));
      case "StartsWith": return VBool(s.startsWith(toStr(R, A[0])));
      case "EndsWith": return VBool(s.endsWith(toStr(R, A[0])));
      case "IndexOf": return VInt(s.indexOf(toStr(R, A[0])));
      case "Replace": return VStr(s.split(toStr(R, A[0])).join(toStr(R, A[1])));
      case "Split": { const sep = A.length ? toStr(R, A[0]) : " "; return VArr(s.split(sep).map(VStr), "string"); }
      case "ToString": return o;
      case "Equals": return VBool(s === toStr(R, A[0]));
      case "PadLeft": return VStr(s.padStart(A[0].v, A[1] ? A[1].v : " "));
      case "PadRight": return VStr(s.padEnd(A[0].v, A[1] ? A[1].v : " "));
    }
  }
  if(o.t === "list" || o.t === "array"){
    switch(n){
      case "Add": if(o.t === "array") cserr("у массива фиксированная длина — Add недоступен"); o.items.push(cp(A[0])); return VNull();
      case "AddRange": for(const x of yield* iterate(R, A[0])) o.items.push(cp(x)); return VNull();
      case "Remove": { const i = o.items.findIndex(x => eqv(x, A[0])); if(i >= 0) o.items.splice(i, 1); return VBool(i >= 0); }
      case "RemoveAll": {
        const before = o.items.length, keep = [];
        for(const x of o.items) if(!truthy(yield* callFn(R, A[0], [x]))) keep.push(x);
        o.items.length = 0; o.items.push(...keep);
        return VInt(before - o.items.length);
      }
      case "RemoveAt": o.items.splice(A[0].v, 1); return VNull();
      case "Insert": o.items.splice(A[0].v, 0, cp(A[1])); return VNull();
      case "Clear": o.items.length = 0; return VNull();
      case "Contains": return VBool(o.items.some(x => eqv(x, A[0])));
      case "IndexOf": return VInt(o.items.findIndex(x => eqv(x, A[0])));
      case "Sort": o.items.sort((a, b) => cmpv(a, b)); return VNull();
      case "Reverse": o.items.reverse(); return VNull();
      case "ToString": return VStr(fmt(o));
    }
  }
  if(o.t === "dict"){
    switch(n){
      case "Add": {
        const k = keyOf(A[0]);
        if(o.map.has(k)) csThrow(R, "ArgumentException", "ключ «" + toStr(R, A[0]) + "» уже есть в словаре");
        o.map.set(k, cp(A[1])); return VNull();
      }
      case "ContainsKey": return VBool(o.map.has(keyOf(A[0])));
      case "Remove": return VBool(o.map.delete(keyOf(A[0])));
      case "Clear": o.map.clear(); return VNull();
      case "TryGetValue": {
        const k = keyOf(A[0]), has = o.map.has(k);
        if(args[1]) yield* store(R, args[1].node, env, has ? o.map.get(k) : VNull());
        return VBool(has);
      }
    }
  }
  if(o.t === "obj" && o.f.__sb !== undefined){
    if(n === "Append"){ o.f.__sb = VStr(o.f.__sb.v + toStr(R, A[0])); return o; }
    if(n === "AppendLine"){ o.f.__sb = VStr(o.f.__sb.v + toStr(R, A[0] || VStr("")) + "\n"); return o; }
    if(n === "ToString") return o.f.__sb;
  }
  if(o.t === "task"){
    if(n === "ConfigureAwait") return o;
    if(n === "GetAwaiter") return o;
    if(n === "Wait"){ if(!o.done) yield {wait:o}; return VNull(); }
  }
  if(o.t === "obj" || o.t === "struct"){
    if(n === "ToString") return VStr(toStr(R, o));
    if(n === "Equals") return VBool(eqv(o, A[0]));
    if(n === "GetType") return VStr(o.cls ? o.cls.name : "object");
  }

  /* ── LINQ ── */
  if(["Where","Select","OrderBy","OrderByDescending","Take","Skip","Distinct","SelectMany","Reverse","GroupBy"].includes(n)){
    const src = o, fn = A[0];
    if(n === "Where")   return seqFrom(src, function*(R2, base){ const out = []; for(const x of base) if(truthy(yield* callFn(R2, fn, [x]))) out.push(x); return out; });
    if(n === "Select")  return seqFrom(src, function*(R2, base){ const out = []; for(const x of base) out.push(yield* callFn(R2, fn, [x])); return out; });
    if(n === "SelectMany") return seqFrom(src, function*(R2, base){ const out = []; for(const x of base){ const s = yield* callFn(R2, fn, [x]); for(const y of yield* iterate(R2, s)) out.push(y); } return out; });
    if(n === "OrderBy" || n === "OrderByDescending")
      return seqFrom(src, function*(R2, base){
        const keyed = [];
        for(const x of base) keyed.push({x, k: yield* callFn(R2, fn, [x])});
        keyed.sort((a, b) => cmpv(a.k, b.k) * (n === "OrderBy" ? 1 : -1));
        return keyed.map(z => z.x);
      });
    if(n === "Take") return seqFrom(src, function*(R2, base){ return base.slice(0, A[0].v); });
    if(n === "Skip") return seqFrom(src, function*(R2, base){ return base.slice(A[0].v); });
    if(n === "Reverse") return seqFrom(src, function*(R2, base){ return base.slice().reverse(); });
    if(n === "Distinct") return seqFrom(src, function*(R2, base){
      const out = []; for(const x of base) if(!out.some(y => eqv(x, y))) out.push(x); return out; });
    if(n === "GroupBy") return seqFrom(src, function*(R2, base){
      const groups = [];
      for(const x of base){
        const k = yield* callFn(R2, fn, [x]);
        let g = groups.find(z => eqv(z.key, k));
        if(!g){ g = VList([]); g.key = k; groups.push(g); }
        g.items.push(x);
      }
      return groups; });
  }
  if(n === "ToDictionary"){
    const items = yield* iterate(R, o);
    const d = VDict();
    for(const x of items){
      const k = yield* callFn(R, A[0], [x]);
      const v = A[1] ? yield* callFn(R, A[1], [x]) : x;
      d.map.set(keyOf(k), v);
    }
    return d;
  }
  if(["ToList","ToArray","Count","Any","All","First","FirstOrDefault","Last","LastOrDefault",
      "Sum","Max","Min","Average","Contains","Single","SingleOrDefault","ElementAt"].includes(n)){
    const items = yield* iterate(R, o);
    const fn = A[0] && A[0].t === "fn" ? A[0] : null;
    let sel = items;
    if(fn && ["Count","Any","All","First","FirstOrDefault","Last","LastOrDefault","Single","SingleOrDefault"].includes(n)){
      sel = [];
      for(const x of items) if(truthy(yield* callFn(R, fn, [x]))) sel.push(x);
      if(n === "All"){ return VBool(sel.length === items.length); }
    }
    switch(n){
      case "ToList": return VList(items.slice());
      case "ToArray": return VArr(items.slice());
      case "Count": return VInt(sel.length);
      case "Any": return VBool(sel.length > 0);
      case "Contains": return VBool(items.some(x => eqv(x, A[0])));
      case "ElementAt": return items[A[0].v] || VNull();
      case "First": if(!sel.length) csThrow(R, "InvalidOperationException", "последовательность не содержит элементов"); return sel[0];
      case "Last": if(!sel.length) csThrow(R, "InvalidOperationException", "последовательность не содержит элементов"); return sel[sel.length - 1];
      case "FirstOrDefault": return sel.length ? sel[0] : VNull();
      case "LastOrDefault": return sel.length ? sel[sel.length - 1] : VNull();
      case "Single":
        if(!sel.length) csThrow(R, "InvalidOperationException", "последовательность не содержит элементов");
        if(sel.length > 1) csThrow(R, "InvalidOperationException", "последовательность содержит больше одного элемента");
        return sel[0];
      case "SingleOrDefault":
        if(sel.length > 1) csThrow(R, "InvalidOperationException", "последовательность содержит больше одного элемента");
        return sel.length === 1 ? sel[0] : VNull();
      case "Sum": case "Max": case "Min": case "Average": {
        let vals = items;
        if(fn){ vals = []; for(const x of items) vals.push(yield* callFn(R, fn, [x])); }
        if(!vals.length) return n === "Sum" ? VInt(0) : (csThrow(R, "InvalidOperationException", "последовательность пуста"), VNull());
        const nums = vals.map(x => x.v);
        const allInt = vals.every(x => x.t === "int");
        if(n === "Sum"){ const s = nums.reduce((a, b) => a + b, 0); return allInt ? VInt(s) : VDbl(s); }
        if(n === "Max"){ const m = Math.max.apply(null, nums); return allInt ? VInt(m) : VDbl(m); }
        if(n === "Min"){ const m = Math.min.apply(null, nums); return allInt ? VInt(m) : VDbl(m); }
        return VDbl(nums.reduce((a, b) => a + b, 0) / nums.length);
      }
    }
  }
  if(n === "Dispose"){ return VNull(); }
  cserr("нет метода «" + n + "» у " + (o.cls ? o.cls.name : o.t), e && e.line);
}
