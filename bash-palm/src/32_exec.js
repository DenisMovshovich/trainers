/* ============================================================
   Раскрытия и выполнение
   ============================================================ */
const MAXSTEPS = 20000;
function tick(sh){ if(++sh.steps > MAXSTEPS) throw new ShErr("слишком долгое выполнение — похоже на бесконечный цикл"); }

/* ---------- heredoc: вырезаем тела до разбора ---------- */
function extractHeredocs(src){
  const ls = src.split("\n");
  const out = [];
  for(let i = 0; i < ls.length; i++){
    let line = ls[i];
    const m = line.match(/(?<!<)<<(?!<)-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    if(!m){ out.push(line); continue; }
    const quoted = !!m[1], delim = m[2];
    const body = [];
    let j = i + 1;
    while(j < ls.length && ls[j].trim() !== delim){ body.push(ls[j]); j++; }
    i = j;
    const text = body.length ? body.join("\n") + "\n" : "";
    const lit = quoted
      ? "'" + text.replace(/'/g, "'\\''") + "'"
      : '"' + text.replace(/([\\"])/g, "\\$1") + '"';
    out.push(line.replace(m[0], "<<< " + lit));
  }
  return out.join("\n");
}

/* ---------- раскрытие фигурных скобок ---------- */
function braceExpand(s, q){
  const i = s.indexOf("{");
  if(i < 0 || q[i] !== "n") return [{s, q}];
  let d = 0, j = i, close = -1, commas = [];
  for(; j < s.length; j++){
    if(q[j] !== "n") continue;
    if(s[j] === "{") d++;
    else if(s[j] === "}"){ d--; if(d === 0){ close = j; break; } }
    else if(s[j] === "," && d === 1) commas.push(j);
  }
  if(close < 0) return [{s, q}];
  const inner = s.slice(i+1, close), innerQ = q.slice(i+1, close);
  const pre = {s: s.slice(0,i), q: q.slice(0,i)}, post = {s: s.slice(close+1), q: q.slice(close+1)};
  let parts = [];
  const range = inner.match(/^(-?\d+)\.\.(-?\d+)$/);
  if(range && !commas.length){
    let a = +range[1], b = +range[2];
    const step = a <= b ? 1 : -1;
    for(let v = a; step > 0 ? v <= b : v >= b; v += step) parts.push({s:String(v), q:"n".repeat(String(v).length)});
  } else if(commas.length){
    let prev = 0;
    const cuts = commas.map(c=>c-(i+1)).concat([inner.length]);
    cuts.forEach(c=>{ parts.push({s: inner.slice(prev,c), q: innerQ.slice(prev,c)}); prev = c + 1; });
  } else return [{s, q}];
  const out = [];
  parts.forEach(pt=>{
    braceExpand(post.s, post.q).forEach(ps=>{
      out.push({s: pre.s + pt.s + ps.s, q: pre.q + pt.q + ps.q});
    });
  });
  return out;
}

/* ---------- арифметика ---------- */
function arith(sh, expr){
  const val = n => { const v = getVar(sh, n); const x = parseInt(v, 10); return Number.isNaN(x) ? 0 : x; };
  let s = expr.replace(/\$([A-Za-z_]\w*)/g, (_,n)=>val(n))
              .replace(/\b([A-Za-z_]\w*)\b/g, (_,n)=>val(n));
  let i = 0;
  const skip = ()=>{ while(s[i] === " ") i++; };
  function expr0(){ let v = expr1(); skip();
    while(s.startsWith("&&",i) || s.startsWith("||",i)){ const op = s.substr(i,2); i += 2; const r = expr1();
      v = op === "&&" ? ((v && r) ? 1 : 0) : ((v || r) ? 1 : 0); skip(); } return v; }
  function expr1(){ let v = expr2(); skip();
    while(/^(==|!=|<=|>=|<|>)/.test(s.slice(i))){ const op = s.slice(i).match(/^(==|!=|<=|>=|<|>)/)[1]; i += op.length;
      const r = expr2(); v = ({"==":v===r,"!=":v!==r,"<=":v<=r,">=":v>=r,"<":v<r,">":v>r})[op] ? 1 : 0; skip(); } return v; }
  function expr2(){ let v = expr3(); skip();
    while(s[i] === "+" || s[i] === "-"){ const op = s[i++]; const r = expr3(); v = op === "+" ? v + r : v - r; skip(); } return v; }
  function expr3(){ let v = expr4(); skip();
    while(s[i] === "*" || s[i] === "/" || s[i] === "%"){ const op = s[i++]; const r = expr4();
      if((op === "/" || op === "%") && r === 0) throw new ShErr("деление на ноль");
      v = op === "*" ? v*r : op === "/" ? Math.trunc(v/r) : v % r; skip(); } return v; }
  function expr4(){ skip();
    if(s[i] === "-"){ i++; return -expr4(); }
    if(s[i] === "+"){ i++; return expr4(); }
    if(s[i] === "!"){ i++; return expr4() ? 0 : 1; }
    if(s[i] === "("){ i++; const v = expr0(); skip(); if(s[i] === ")") i++; return v; }
    const m = s.slice(i).match(/^\d+/);
    if(m){ i += m[0].length; return parseInt(m[0], 10); }
    throw new ShErr("не понял арифметику: " + expr);
  }
  const r = expr0();
  return r;
}

/* ---------- переменные ---------- */
function getVar(sh, name){
  if(name === "?") return String(sh.status);
  if(name === "#") return String(sh.args.length);
  if(name === "0") return sh.name;
  if(name === "@" || name === "*") return sh.args.join(" ");
  if(name === "$") return "4242";
  if(/^\d+$/.test(name)) return sh.args[+name - 1] !== undefined ? sh.args[+name - 1] : "";
  if(Object.prototype.hasOwnProperty.call(sh.vars, name)) return sh.vars[name];
  if(Object.prototype.hasOwnProperty.call(sh.env, name)) return sh.env[name];
  return undefined;
}
function setVar(sh, name, val){
  if(Object.prototype.hasOwnProperty.call(sh.env, name)) sh.env[name] = val;
  else sh.vars[name] = val;
}
function patToRe(p, anchor){
  let r = "";
  for(let i = 0; i < p.length; i++){
    const c = p[i];
    if(c === "*") r += "[\\s\\S]*";
    else if(c === "?") r += "[\\s\\S]";
    else if(c === "["){ const e = p.indexOf("]", i+1); if(e < 0){ r += "\\["; continue; }
      let cls = p.slice(i+1, e); if(cls[0] === "!") cls = "^" + cls.slice(1); r += "[" + cls + "]"; i = e; }
    else r += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return anchor ? new RegExp("^" + r + "$") : new RegExp(r);
}

/* ---------- главное раскрытие ---------- */
function expandOne(sh, s, q, opts){
  opts = opts || {};
  let rs = "", rq = "";
  const push = (txt, mark) => { rs += txt; rq += mark.repeat(txt.length); };

  for(let i = 0; i < s.length; i++){
    const c = s[i], qc = q[i];
    if(qc === "s"){ push(c, "s"); continue; }
    if(c === "~" && qc === "n" && i === 0 && (s[1] === undefined || s[1] === "/")){ push(sh.env.HOME, "s"); continue; }
    if(c !== "$"){ push(c, qc); continue; }

    /* $((...)) */
    if(s.startsWith("$((", i)){
      const e = matchClose(s, i+1, "(", ")");
      const v = String(arith(sh, s.slice(i+3, e-2)));
      push(v, qc === "d" ? "Q" : "E"); i = e - 1; continue;
    }
    /* $(...) */
    if(s[i+1] === "("){
      const e = matchClose(s, i+1, "(", ")");
      const inner = s.slice(i+2, e-1);
      const sub = runCapture(sh, inner);
      push(sub.replace(/\n+$/, ""), qc === "d" ? "Q" : "E");
      i = e - 1; continue;
    }
    /* ${...} */
    if(s[i+1] === "{"){
      const e = matchClose(s, i+1, "{", "}");
      const body = s.slice(i+2, e-1);
      push(paramExp(sh, body), qc === "d" ? "Q" : "E");
      i = e - 1; continue;
    }
    /* $NAME или $1 или $? */
    const m = s.slice(i+1).match(/^([A-Za-z_]\w*|\d+|[?#@*$])/);
    if(!m){ push("$", qc); continue; }
    const name = m[1];
    if(name === "@"){
      push(sh.args.join("\u0000"), qc === "d" ? "Q" : "E");
      i += 1; continue;
    }
    let v = getVar(sh, name);
    if(v === undefined){
      if(sh.opts.u) throw new ShErr(name + ": переменная не задана");
      v = "";
    }
    push(v, qc === "d" ? "Q" : "E");
    i += name.length;
  }
  return {s: rs, q: rq};
}
function matchClose(s, i, open, close){
  let d = 0;
  for(let j = i; j < s.length; j++){
    if(s[j] === open) d++;
    else if(s[j] === close){ d--; if(d === 0) return j + 1; }
  }
  throw new ShErr("не закрыто: " + open);
}
function paramExp(sh, body){
  let m;
  if((m = body.match(/^#([A-Za-z_]\w*|[@*])$/))){
    if(m[1] === "@" || m[1] === "*") return String(sh.args.length);
    return String((getVar(sh, m[1]) || "").length);
  }
  if((m = body.match(/^([A-Za-z_]\w*|\d+|[?#@*])(:?[-=?+])([\s\S]*)$/))){
    const cur = getVar(sh, m[1]);
    const unset = cur === undefined || (m[2][0] === ":" && cur === "");
    const word = expandToString(sh, m[3]);
    const op = m[2].replace(":", "");
    if(op === "-") return unset ? word : cur;
    if(op === "=") { if(unset){ setVar(sh, m[1], word); return word; } return cur; }
    if(op === "+") return unset ? "" : word;
    if(op === "?") { if(unset) throw new ShErr(m[1] + ": " + (word || "переменная не задана")); return cur; }
  }
  if((m = body.match(/^([A-Za-z_]\w*)(##|#|%%|%)([\s\S]*)$/))){
    let v = getVar(sh, m[1]) || "";
    const pat = expandToString(sh, m[3]);
    const greedy = m[2].length === 2;
    if(m[2][0] === "#"){
      for(let n = greedy ? v.length : 0; greedy ? n >= 0 : n <= v.length; greedy ? n-- : n++)
        if(patToRe(pat, true).test(v.slice(0, n))) return v.slice(n);
      return v;
    } else {
      for(let n = greedy ? 0 : v.length; greedy ? n <= v.length : n >= 0; greedy ? n++ : n--)
        if(patToRe(pat, true).test(v.slice(n))) return v.slice(0, n);
      return v;
    }
  }
  if((m = body.match(/^([A-Za-z_]\w*)\/(\/?)([^\/]*)\/?([\s\S]*)$/))){
    const v = getVar(sh, m[1]) || "";
    const re = patToRe(expandToString(sh, m[3]), false);
    const rep = expandToString(sh, m[4]);
    return m[2] === "/" ? v.replace(new RegExp(re.source, "g"), rep) : v.replace(re, rep);
  }
  const v = getVar(sh, body);
  if(v === undefined && sh.opts.u) throw new ShErr(body + ": переменная не задана");
  return v === undefined ? "" : v;
}
function expandToString(sh, raw){
  const r = expandOne(sh, raw, "n".repeat(raw.length), {});
  return r.s;
}

function globExpand(sh, s, q){
  let hasGlob = false;
  for(let i = 0; i < s.length; i++) if("*?[".includes(s[i]) && (q[i] === "n" || q[i] === "E")) { hasGlob = true; break; }
  if(!hasGlob) return null;
  const abs = s[0] === "/";
  const parts = s.split("/");
  let bases = [abs ? "" : ""];
  let cur = abs ? [""] : [""];
  let results = abs ? [""] : [""];
  const startDir = abs ? "/" : sh.cwd;
  let acc = [abs ? "/" : sh.cwd];
  const segs = parts.filter((x,i)=>!(i === 0 && x === ""));
  segs.forEach(seg=>{
    const next = [];
    acc.forEach(dir=>{
      if(!isDir(sh, dir)) return;
      if(!"*?[".split("").some(ch=>seg.includes(ch))){
        const p = normPath(dir + "/" + seg, sh.cwd);
        if(exists(sh, p)) next.push(p);
        return;
      }
      const re = patToRe(seg, true);
      children(sh, dir).forEach(n=>{
        if(n.startsWith(".") && !seg.startsWith(".")) return;
        if(re.test(n)) next.push(normPath(dir + "/" + n, sh.cwd));
      });
    });
    acc = next;
  });
  if(!acc.length) return null;
  const prefix = abs ? "" : (sh.cwd === "/" ? "/" : sh.cwd + "/");
  return acc.map(p => abs ? p : p.slice(prefix.length)).sort((a,b)=>a.localeCompare(b));
}

function expandWord(sh, tok, opts){
  opts = opts || {};
  const out = [];
  braceExpand(tok.s, tok.q).forEach(b=>{
    const e = expandOne(sh, b.s, b.q, opts);
    let fields;
    if(opts.noSplit) fields = [e];
    else {
      fields = [];
      let cs = "", cq = "", any = false;
      for(let i = 0; i < e.s.length; i++){
        if(e.s[i] === "\u0000"){ fields.push({s:cs,q:cq}); cs=""; cq=""; continue; }
        const isSplit = e.q[i] === "E" && /[ \t\n]/.test(e.s[i]);
        if(isSplit){ if(cs !== ""){ fields.push({s:cs,q:cq}); cs=""; cq=""; } any = true; continue; }
        cs += e.s[i]; cq += e.q[i];
      }
      if(cs !== "") fields.push({s:cs, q:cq});
      if(!fields.length && !any && !(e.s === "" && !tok.qq)) fields = [{s:"", q:""}];
    }
    fields.forEach(f=>{
      if(!opts.noGlob){
        const g = globExpand(sh, f.s, f.q);
        if(g){ g.forEach(x=>out.push(x)); return; }
      }
      out.push(f.s);
    });
  });
  return out.filter((x,i)=> x !== "" || out.length === 1 || true);
}
