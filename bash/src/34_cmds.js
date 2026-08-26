/* ============================================================
   Встроенные команды и утилиты
   ============================================================ */
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function flags(args){
  const f = {}, rest = [];
  let stop = false;
  args.forEach(a=>{
    if(!stop && a === "--"){ stop = true; return; }
    if(!stop && a.length > 1 && a[0] === "-" && !/^-\d+$/.test(a)){
      if(a[1] === "-"){ const [k,v] = a.slice(2).split("="); f[k] = v === undefined ? true : v; return; }
      a.slice(1).split("").forEach(ch=>f[ch] = true);
      return;
    }
    rest.push(a);
  });
  return {f, rest};
}
function resolveIn(sh, io, args){
  if(args.length) return args.map(a=>{
    const p = normPath(a, sh.cwd);
    if(!exists(sh,p)) return {name:a, err:"Нет такого файла или каталога"};
    if(isDir(sh,p)) return {name:a, err:"Это каталог"};
    return {name:a, text:readFile(sh,p)};
  });
  return [{name:"-", text: io.in.rest()}];
}
function eachInput(sh, io, args, fn){
  let code = 0;
  const many = args.length > 1;
  resolveIn(sh, io, args).forEach(f=>{
    if(f.err){ io.err.write(f.name + ": " + f.err + "\n"); code = 1; return; }
    fn(f.text, f.name, many);
  });
  return code;
}

const BUILTIN = {
 ":"(){ return 0; },
 "true"(){ return 0; },
 "false"(){ return 1; },
 pwd(sh, a, io){ io.out.write(sh.cwd + "\n"); return 0; },
 cd(sh, a, io){
   let t = a[0];
   if(!t) t = sh.env.HOME;
   else if(t === "-"){ t = sh.prevDir; io.out.write(t + "\n"); }
   const p = normPath(t, sh.cwd);
   if(!exists(sh,p)){ io.err.write("cd: " + a[0] + ": Нет такого файла или каталога\n"); return 1; }
   if(!isDir(sh,p)){ io.err.write("cd: " + a[0] + ": Это не каталог\n"); return 1; }
   sh.prevDir = sh.cwd; sh.cwd = p; sh.env.PWD = p; return 0;
 },
 echo(sh, a, io){
   let nl = true, esc = false, i = 0;
   while(a[i] === "-n" || a[i] === "-e" || a[i] === "-E"){ if(a[i]==="-n") nl = false; if(a[i]==="-e") esc = true; if(a[i]==="-E") esc = false; i++; }
   let s = a.slice(i).join(" ");
   if(esc) s = s.replace(/\\n/g,"\n").replace(/\\t/g,"\t").replace(/\\\\/g,"\\");
   io.out.write(s + (nl ? "\n" : ""));
   return 0;
 },
 printf(sh, a, io){
   const fmt = (a[0] || "").replace(/\\n/g,"\n").replace(/\\t/g,"\t");
   let rest = a.slice(1);
   const specs = (fmt.match(/%[-0-9.]*[sdif%]/g) || []).filter(x=>x !== "%%");
   const once = out => {
     let i = 0;
     io.out.write(fmt.replace(/%[-0-9.]*[sdif%]/g, m=>{
       if(m === "%%") return "%";
       const v = out[i++];
       const w = m.match(/%(-?)(\d*)/);
       let s = m.endsWith("d") || m.endsWith("i") ? String(parseInt(v||"0",10)||0) : (v === undefined ? "" : v);
       if(w[2]){ const n = +w[2]; s = w[1] === "-" ? s.padEnd(n) : s.padStart(n); }
       return s;
     }));
   };
   if(!specs.length){ once([]); return 0; }
   if(!rest.length){ once([]); return 0; }
   while(rest.length){ once(rest.splice(0, specs.length)); }
   return 0;
 },
 export(sh, a, io){
   a.forEach(x=>{
     const i = x.indexOf("=");
     if(i < 0){ const v = getVar(sh,x); sh.env[x] = v === undefined ? "" : v; delete sh.vars[x]; }
     else { sh.env[x.slice(0,i)] = x.slice(i+1); delete sh.vars[x.slice(0,i)]; }
   });
   return 0;
 },
 unset(sh, a){ a.forEach(x=>{ delete sh.vars[x]; delete sh.env[x]; delete sh.funcs[x]; }); return 0; },
 set(sh, a, io){
   if(!a.length){
     Object.keys(sh.env).sort().forEach(k=>io.out.write(k + "=" + sh.env[k] + "\n"));
     Object.keys(sh.vars).sort().forEach(k=>io.out.write(k + "=" + sh.vars[k] + "\n"));
     return 0;
   }
   for(let i = 0; i < a.length; i++){
     const x = a[i];
     if(x === "-o" || x === "+o"){ const n = a[++i]; if(n === "pipefail") sh.opts.pipefail = x === "-o"; if(n === "errexit") sh.opts.e = x === "-o"; if(n === "nounset") sh.opts.u = x === "-o"; continue; }
     if(x[0] === "-" || x[0] === "+"){
       const on = x[0] === "-";
       const letters = x.slice(1).split("");
       for(const c of letters){
         if(c === "e") sh.opts.e = on;
         else if(c === "u") sh.opts.u = on;
         else if(c === "x") sh.opts.x = on;
         else if(c === "o"){
           const n = a[++i];
           if(n === "pipefail") sh.opts.pipefail = on;
           else if(n === "errexit") sh.opts.e = on;
           else if(n === "nounset") sh.opts.u = on;
         }
       }
       continue;
     }
     sh.args = a.slice(i); break;
   }
   return 0;
 },
 shift(sh, a){ const n = a[0] ? parseInt(a[0],10) : 1; sh.args = sh.args.slice(n); return 0; },
 read(sh, a, io){
   const {f, rest} = flags(a);
   const names = rest.length ? rest : ["REPLY"];
   const line = io.in.line();
   if(line === null){ names.forEach(n=>setVar(sh,n,"")); return 1; }
   const parts = line.trim() === "" ? [] : line.trim().split(/\s+/);
   names.forEach((n,i)=>{
     if(i === names.length - 1 && names.length > 1) setVar(sh, n, parts.slice(i).join(" "));
     else setVar(sh, n, parts[i] === undefined ? "" : parts[i]);
   });
   if(names.length === 1) setVar(sh, names[0], f.r ? line : line.replace(/\\(.)/g,"$1"));
   return 0;
 },
 exit(sh, a){ throw new ExitSignal(a[0] ? parseInt(a[0],10) : sh.status); },
 "return"(sh, a){ throw new ReturnSignal(a[0] ? parseInt(a[0],10) : sh.status); },
 local(sh, a, io){ return BUILTIN.export === undefined ? 0 : (a.forEach(x=>{ const i = x.indexOf("="); if(i > 0) setVar(sh, x.slice(0,i), x.slice(i+1)); }), 0); },
 declare(sh, a, io){ return BUILTIN.local(sh, a.filter(x=>x[0] !== "-"), io); },
 eval(sh, a, io){ const r = runProgram(sh, a.join(" ")); io.out.write(r.out); io.err.write(r.err); return r.code; },
 source(sh, a, io){
   const p = normPath(a[0] || "", sh.cwd);
   if(!isFile(sh,p)){ io.err.write("source: " + a[0] + ": нет такого файла\n"); return 1; }
   const saved = sh.args; sh.args = a.slice(1);
   const r = runProgram(sh, readFile(sh,p));
   sh.args = saved;
   io.out.write(r.out); io.err.write(r.err); return r.code;
 },
 type(sh, a, io){
   let c = 0;
   a.forEach(x=>{
     if(sh.funcs[x]) io.out.write(x + " — функция\n");
     else if(BUILTIN[x]) io.out.write(x + " — встроенная команда оболочки\n");
     else if(CMD[x]) io.out.write(x + " — /usr/bin/" + x + "\n");
     else { io.err.write("bash: type: " + x + ": не найдено\n"); c = 1; }
   });
   return c;
 },
 let(sh, a){ let last = 0; a.forEach(x=>{ const i = x.indexOf("="); if(i > 0) setVar(sh, x.slice(0,i), String(last = arith(sh, x.slice(i+1)))); else last = arith(sh, x); }); return last === 0 ? 1 : 0; },
 alias(){ return 0; }, unalias(){ return 0; },
 history(sh, a, io){ sh.log.slice(-20).forEach((l,i)=>io.out.write(String(i+1).padStart(4) + "  " + (l.cmd||l) + "\n")); return 0; },
 help(sh, a, io){ return CMD.man(sh, a, io); }
};
BUILTIN["."] = BUILTIN.source;

/* ---------------- test ---------------- */
function testEval(sh, a){
  if(!a.length) return 1;
  if(a.length === 1) return a[0] === "" ? 1 : 0;
  if(a[0] === "!") return testEval(sh, a.slice(1)) === 0 ? 1 : 0;
  const orI = a.indexOf("-o"); if(orI > 0) return (testEval(sh,a.slice(0,orI)) === 0 || testEval(sh,a.slice(orI+1)) === 0) ? 0 : 1;
  const andI = a.indexOf("-a"); if(andI > 0) return (testEval(sh,a.slice(0,andI)) === 0 && testEval(sh,a.slice(andI+1)) === 0) ? 0 : 1;
  if(a.length === 2){
    if(!/^-(e|f|d|s|r|w|x|z|n)$/.test(a[0])) throw new ShErr("[: " + a[0] + ": ожидался унарный оператор");
    const p = normPath(a[1], sh.cwd);
    switch(a[0]){
      case "-e": return exists(sh,p) ? 0 : 1;
      case "-f": return isFile(sh,p) ? 0 : 1;
      case "-d": return isDir(sh,p) ? 0 : 1;
      case "-s": return isFile(sh,p) && readFile(sh,p).length > 0 ? 0 : 1;
      case "-r": return exists(sh,p) ? 0 : 1;
      case "-w": return exists(sh,p) && sh.fs[p].m[0] >= "6" ? 0 : 1;
      case "-x": return exists(sh,p) && "1357".includes(sh.fs[p].m[0]) ? 0 : 1;
      case "-z": return a[1] === "" ? 0 : 1;
      case "-n": return a[1] !== "" ? 0 : 1;
    }
    return 1;
  }
  if(a.length >= 3){
    const [x, op, y] = a;
    const ni = v => { const n = parseInt(v,10); return Number.isNaN(n) ? 0 : n; };
    switch(op){
      case "=": case "==": return x === y ? 0 : 1;
      case "!=": return x !== y ? 0 : 1;
      case "=~": return new RegExp(y).test(x) ? 0 : 1;
      case "-eq": return ni(x) === ni(y) ? 0 : 1;
      case "-ne": return ni(x) !== ni(y) ? 0 : 1;
      case "-lt": return ni(x) <  ni(y) ? 0 : 1;
      case "-le": return ni(x) <= ni(y) ? 0 : 1;
      case "-gt": return ni(x) >  ni(y) ? 0 : 1;
      case "-ge": return ni(x) >= ni(y) ? 0 : 1;
    }
  }
  return 1;
}
BUILTIN.test = (sh, a) => testEval(sh, a);
BUILTIN["["] = (sh, a, io) => {
  if(a[a.length-1] !== "]"){ io.err.write("bash: [: нет закрывающей ]\n"); return 2; }
  return testEval(sh, a.slice(0,-1));
};
BUILTIN["[["] = (sh, a, io) => {
  if(a[a.length-1] !== "]]"){ io.err.write("bash: [[: нет закрывающей ]]\n"); return 2; }
  const b = a.slice(0,-1);
  if(b.length === 3 && (b[1] === "==" || b[1] === "=")) return patToRe(b[2], true).test(b[0]) ? 0 : 1;
  if(b.length === 3 && b[1] === "!=") return patToRe(b[2], true).test(b[0]) ? 1 : 0;
  return testEval(sh, b);
};
