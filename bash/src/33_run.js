/* ============================================================
   Выполнение дерева
   ============================================================ */
function mkSink(){ const a = []; return {a, write(s){ if(s) a.push(s); }, text(){ return a.join(""); }}; }
function mkIn(text){ return {text: text || "", pos: 0,
  line(){ if(this.pos >= this.text.length) return null;
    const i = this.text.indexOf("\n", this.pos);
    if(i < 0){ const r = this.text.slice(this.pos); this.pos = this.text.length; return r; }
    const r = this.text.slice(this.pos, i); this.pos = i + 1; return r; },
  rest(){ const r = this.text.slice(this.pos); this.pos = this.text.length; return r; } }; }

class ExitSignal { constructor(code){ this.code = code; } }
class ReturnSignal { constructor(code){ this.code = code; } }

function runProgram(sh, src){
  const out = mkSink(), err = mkSink();
  out.tty = true; err.tty = true;
  let code = 0;
  try{
    const ast = parse(extractHeredocs(src));
    code = runNode(sh, ast, {in: mkIn(""), out, err});
  }catch(e){
    if(e instanceof ExitSignal){ code = e.code; sh.exited = true; }
    else if(e instanceof ReturnSignal){ code = e.code; }
    else if(e instanceof ShErr){ err.write("bash: " + e.message + "\n"); code = 2; }
    else { err.write("bash: внутренняя ошибка: " + e.message + "\n"); code = 2; }
  }
  sh.status = code;
  return {out: out.text(), err: err.text(), code};
}
function runCapture(sh, src){
  const out = mkSink(), err = mkSink();
  const saved = sh.status;
  try{ runNode(sh, parse(extractHeredocs(src)), {in: mkIn(""), out, err}); }
  catch(e){ if(e instanceof ExitSignal || e instanceof ReturnSignal){} else if(e instanceof ShErr) err.write(e.message); else throw e; }
  return out.text();
}

function runNode(sh, n, io){
  tick(sh);
  if(!n) return 0;
  switch(n.k){
    case "list": {
      let c = 0;
      for(const it of n.items){
        c = runNode(sh, it, io);
        sh.status = c;
        if(sh.opts.e && c !== 0 && !it.__inCond) throw new ExitSignal(c);
      }
      return c;
    }
    case "andor": {
      const l = runNode(sh, n.left, io);
      sh.status = l;
      if(n.op === "&&") return l === 0 ? (sh.status = runNode(sh, n.right, io)) : l;
      return l !== 0 ? (sh.status = runNode(sh, n.right, io)) : l;
    }
    case "pipe": {
      let cur = io.in;
      let code = 0, codes = [];
      for(let i = 0; i < n.cmds.length; i++){
        const isLast = i === n.cmds.length - 1;
        const o = isLast ? io.out : mkSink();
        /* каждое звено выполняется в подоболочке: присваивания и cd не видны снаружи */
        const savedVars = Object.assign({}, sh.vars);
        const savedEnv = Object.assign({}, sh.env);
        const savedCwd = sh.cwd;
        code = runNode(sh, n.cmds[i], {in: cur, out: o, err: io.err});
        sh.vars = savedVars; sh.env = savedEnv; sh.cwd = savedCwd;
        codes.push(code);
        if(!isLast) cur = mkIn(o.text());
      }
      let r = codes[codes.length-1];
      if(sh.opts.pipefail){ const f = codes.filter(c=>c!==0); if(f.length) r = f[f.length-1]; }
      return n.neg ? (r === 0 ? 1 : 0) : r;
    }
    case "if": return withRedirs(sh, n, io, io2=>{
      if(runCond(sh, n.cond, io2) === 0) return runNode(sh, n.then, io2);
      for(const e of n.elifs) if(runCond(sh, e.cond, io2) === 0) return runNode(sh, e.body, io2);
      return n.else ? runNode(sh, n.else, io2) : 0;
    });
    case "while": return withRedirs(sh, n, io, io2=>{
      let c = 0, guard = 0;
      for(;;){
        tick(sh);
        if(++guard > 5000) throw new ShErr("цикл не завершается");
        const t = runCond(sh, n.cond, io2);
        const ok = n.until ? t !== 0 : t === 0;
        if(!ok) break;
        c = runNode(sh, n.body, io2);
      }
      return c;
    });
    case "for": return withRedirs(sh, n, io, io2=>{
      const items = n.items === null
        ? sh.args.slice()
        : n.items.reduce((a,w)=>a.concat(expandWord(sh, w)), []);
      let c = 0;
      for(const v of items){ tick(sh); setVar(sh, n.name, v); c = runNode(sh, n.body, io2); }
      return c;
    });
    case "case": {
      const subj = expandWord(sh, n.subj, {noSplit:true, noGlob:true})[0] || "";
      for(const cl of n.clauses){
        for(const pt of cl.pats){
          const pat = expandWord(sh, pt, {noSplit:true, noGlob:true})[0] || "";
          if(pat === "*" || patToRe(pat, true).test(subj)) return runNode(sh, cl.body, io);
        }
      }
      return 0;
    }
    case "func": sh.funcs[n.name] = n.body; return 0;
    case "group": case "subshell": return withRedirs(sh, n, io, io2 => runNode(sh, n.body, io2));
    case "cmd": return withRedirs(sh, n, io, io2 => runSimple(sh, n, io2));
  }
  return 0;
}
function runCond(sh, node, io){
  const mark = x => { if(x && x.items) x.items.forEach(i=>{ i.__inCond = true; if(i.items) mark(i); }); };
  mark(node);
  return runNode(sh, node, {in: io.in, out: io.out, err: io.err});
}

function withRedirs(sh, n, io, fn){
  if(!n.redirs || !n.redirs.length) return fn(io);
  let out = io.out, err = io.err, inp = io.in;
  const writes = [];
  for(const r of n.redirs){
    if(r.op === "2>&1"){ err = out; continue; }
    if(r.op === ">&2"){ out = err; continue; }
    const t = expandWord(sh, r.target, {noSplit:true});
    const target = t[0] !== undefined ? t[0] : "";
    if(r.op === "<"){
      const p = normPath(target, sh.cwd);
      if(!isFile(sh, p)){ io.err.write("bash: " + target + ": Нет такого файла\n"); return 1; }
      inp = mkIn(readFile(sh, p)); continue;
    }
    if(r.op === "<<<"){ inp = mkIn(target.endsWith("\n") ? target : target + "\n"); continue; }
    const sink = mkSink();
    const p = normPath(target, sh.cwd);
    if(r.op === ">" || r.op === ">>"){ out = sink; writes.push({p, sink, append: r.op === ">>"}); }
    else if(r.op === "2>" || r.op === "2>>"){ err = sink; writes.push({p, sink, append: r.op === "2>>"}); }
    else if(r.op === "&>"){ out = sink; err = sink; writes.push({p, sink, append:false}); }
  }
  const code = fn({in: inp, out, err});
  for(const w of writes){
    if(w.p === "/dev/null") continue;
    const prev = w.append && isFile(sh, w.p) ? readFile(sh, w.p) : "";
    if(!writeFile(sh, w.p, prev + w.sink.text()))
      io.err.write("bash: " + w.p + ": Не удалось записать\n");
  }
  return code;
}

function runSimple(sh, n, io){
  const assigns = n.assigns.map(a=>{
    const i = a.s.indexOf("=");
    const name = a.s.slice(0, i);
    const val = expandWord(sh, {s: a.s.slice(i+1), q: a.q.slice(i+1)}, {noSplit:true, noGlob:true})[0];
    return {name, val: val === undefined ? "" : val};
  });
  if(!n.words.length){ assigns.forEach(a=>setVar(sh, a.name, a.val)); return 0; }

  const head = n.words[0];
  const headName = expandWord(sh, head, {noSplit:true, noGlob:true})[0] || "";
  const noGlob = headName === "[[" || headName === "test" || headName === "[";
  let argv = [];
  n.words.forEach((w,idx)=>{
    if(idx === 0){ argv.push(headName); return; }
    expandWord(sh, w, {noGlob: headName === "[["}).forEach(x=>argv.push(x));
  });
  const cmd = argv[0], args = argv.slice(1);

  const restore = [];
  assigns.forEach(a=>{ restore.push([a.name, getVar(sh, a.name)]); setVar(sh, a.name, a.val); });
  const undo = ()=> restore.forEach(([k,v])=>{ if(v === undefined){ delete sh.vars[k]; } else setVar(sh, k, v); });

  try{
    if(sh.opts.x) io.err.write("+ " + argv.join(" ") + "\n");
    if(sh.funcs[cmd]){
      const savedArgs = sh.args, savedName = sh.name;
      sh.args = args; sh.name = cmd;
      let code = 0;
      try{ code = runNode(sh, sh.funcs[cmd], io); }
      catch(e){ if(e instanceof ReturnSignal) code = e.code; else throw e; }
      sh.args = savedArgs; sh.name = savedName;
      return code;
    }
    if(BUILTIN[cmd]) return BUILTIN[cmd](sh, args, io);
    if(CMD[cmd]) return CMD[cmd](sh, args, io);
    if(cmd.includes("/")){
      const p = normPath(cmd, sh.cwd);
      if(!exists(sh, p)){ io.err.write("bash: " + cmd + ": Нет такого файла или каталога\n"); return 127; }
      if(isDir(sh, p)){ io.err.write("bash: " + cmd + ": Это каталог\n"); return 126; }
      if(!"1357".includes(sh.fs[p].m[0])){
        io.err.write("bash: " + cmd + ": Отказано в доступе\n"); return 126;
      }
      if(sh.depth > 20){ io.err.write("bash: слишком глубокая вложенность вызовов\n"); return 1; }
      const savedArgs = sh.args, savedName = sh.name, savedCwd = sh.cwd;
      sh.args = args; sh.name = cmd; sh.depth++;
      const r = runProgram(sh, readFile(sh, p));
      sh.depth--; sh.args = savedArgs; sh.name = savedName; sh.cwd = savedCwd;
      io.out.write(r.out); io.err.write(r.err);
      return r.code;
    }
    io.err.write("bash: " + cmd + ": команда не найдена\n");
    return 127;
  } finally {
    if(n.words.length) undo();
  }
}
