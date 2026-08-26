/* ============================================================
   Парсер: рекурсивный спуск
   ============================================================ */
function parse(src){
  const ts = lex(src); let p = 0;
  const peek = (o) => ts[p + (o || 0)];
  const at = (k, v) => ts[p].k === k && (v === undefined || ts[p].v === v);
  const isKw = v => at("kw", v);
  const isOp = v => at("op", v);
  const ln = () => ts[p].line;
  const next = () => ts[p++];
  function eat(k, v){
    if(!at(k, v)) cserr("ожидалось «" + (v || k) + "», получено «" + (ts[p].v || ts[p].k) + "»", ln());
    return ts[p++];
  }
  const opt = (k, v) => at(k, v) ? (p++, true) : false;
  /* «>>» лексится одним токеном, а в List<int>> закрывает два уровня.
     Расщепляем НА МЕСТЕ в два «>»: операция идемпотентна, поэтому переживает
     откат позиции в предпросмотре (looksDecl и подобных). */
  function eatGt(){
    if(isOp(">")){ p++; return; }
    if(isOp(">>")){
      const L = ts[p].line;
      ts.splice(p, 1, {k:"op", v:">", line:L}, {k:"op", v:">", line:L});
      p++; return;
    }
    cserr("ожидалось «>»", ln());
  }

  const MODS = new Set(["public","private","protected","internal","static","readonly","const",
                        "abstract","virtual","override","sealed","partial","async","new","extern"]);
  const PRIM = new Set(["int","long","double","decimal","float","bool","string","char","object","void","var","dynamic"]);

  /* ── типы ─────────────────────────────────────────────── */
  function isTypeStart(){
    if(at("kw") && PRIM.has(peek().v)) return true;
    return at("id");
  }
  function parseType(){
    let name;
    if(at("kw") && PRIM.has(peek().v)) name = next().v;
    else name = eat("id").v;
    let args = null;
    if(isOp("<") && looksGeneric()){ p++; args = [parseType()]; while(opt("op", ",")) args.push(parseType()); eatGt(); }
    let t = {k:"type", name, args};
    for(;;){
      if(isOp("?")){ p++; t = {k:"type", name:"Nullable", args:[t]}; continue; }
      if(isOp("[") && peek(1).k === "op" && peek(1).v === "]"){ p += 2; t = {k:"type", name:"Array", args:[t]}; continue; }
      break;
    }
    return t;
  }
  /* различаем List<int> и a < b */
  function looksGeneric(){
    let i = p + 1, depth = 1;
    while(i < ts.length && depth > 0){
      const t = ts[i];
      if(t.k === "op" && t.v === "<") depth++;
      else if(t.k === "op" && t.v === ">") depth--;
      else if(t.k === "op" && t.v === ">>") depth -= 2;
      else if(t.k === "op" && (t.v === "(" || t.v === ")" || t.v === ";" || t.v === "{")) return false;
      else if(t.k === "eof") return false;
      else if(!(t.k === "id" || (t.k === "kw" && PRIM.has(t.v)) || (t.k === "op" && (t.v === "," || t.v === "[" || t.v === "]" || t.v === "?")))) return false;
      i++;
    }
    return depth <= 0;   /* >> закрывает два уровня сразу */
  }
  /* объявление ли это переменной: Тип имя (= | ; | , | in) */
  function looksDecl(){
    const save = p;
    try{
      if(!isTypeStart()) { p = save; return false; }
      parseType();
      const ok = at("id") && (peek(1).k === "op" && [";", "=", ",", ")"].includes(peek(1).v) || (peek(1).k === "kw" && peek(1).v === "in"));
      p = save; return ok;
    }catch(e){ p = save; return false; }
  }

  /* ── выражения ────────────────────────────────────────── */
  function expr(){ return assign(); }
  function assign(){
    const left = ternary();
    if(at("op") && ["=","+=","-=","*=","/=","%=","??="].includes(peek().v)){
      const op = next().v, right = assign();
      return {k:"assign", op, target:left, value:right, line:ln()};
    }
    return left;
  }
  function ternary(){
    const c = coalesce();
    if(isOp("?")){ p++; const a = assign(); eat("op", ":"); const b = assign(); return {k:"cond", c, a, b}; }
    return c;
  }
  function coalesce(){
    let l = orExpr();
    while(isOp("??")){ p++; l = {k:"bin", op:"??", l, r:orExpr()}; }
    return l;
  }
  function orExpr(){ let l = andExpr(); while(isOp("||")){ p++; l = {k:"bin", op:"||", l, r:andExpr()}; } return l; }
  function andExpr(){ let l = eqExpr(); while(isOp("&&")){ p++; l = {k:"bin", op:"&&", l, r:eqExpr()}; } return l; }
  function eqExpr(){
    let l = relExpr();
    while(at("op") && ["==","!="].includes(peek().v)){ const op = next().v; l = {k:"bin", op, l, r:relExpr()}; }
    return l;
  }
  function relExpr(){
    let l = shiftExpr();
    for(;;){
      if(at("op") && ["<",">","<=",">="].includes(peek().v)){ const op = next().v; l = {k:"bin", op, l, r:shiftExpr()}; continue; }
      if(isKw("is")){ p++; const t = parseType(); let alias = null; if(at("id")) alias = next().v; l = {k:"is", e:l, type:t, alias}; continue; }
      if(isKw("as")){ p++; l = {k:"as", e:l, type:parseType()}; continue; }
      break;
    }
    return l;
  }
  function shiftExpr(){
    let l = addExpr();
    while(at("op") && ["<<",">>"].includes(peek().v)){ const op = next().v; l = {k:"bin", op, l, r:addExpr()}; }
    return l;
  }
  function addExpr(){
    let l = mulExpr();
    while(at("op") && ["+","-"].includes(peek().v)){ const op = next().v; l = {k:"bin", op, l, r:mulExpr(), line:ln()}; }
    return l;
  }
  function mulExpr(){
    let l = unary();
    while(at("op") && ["*","/","%"].includes(peek().v)){ const op = next().v; l = {k:"bin", op, l, r:unary(), line:ln()}; }
    return l;
  }
  function unary(){
    if(at("op") && ["!","-","+","~"].includes(peek().v)){ const op = next().v; return {k:"un", op, e:unary()}; }
    if(at("op") && ["++","--"].includes(peek().v)){ const op = next().v; return {k:"pre", op, e:unary()}; }
    if(isKw("await")){ p++; return {k:"await", e:unary(), line:ln()}; }
    if(isKw("new")) return postfix(newExpr());   /* new P(7).A — постфикс обязателен */
    /* приведение типа: (int)x */
    if(isOp("(") && peek(1).k !== "eof"){
      const save = p;
      try{
        p++; const t = parseType();
        if(isOp(")") && (peek(1).k === "id" || peek(1).k === "num" || (peek(1).k === "op" && peek(1).v === "("))){
          p++; return {k:"cast", type:t, e:unary()};
        }
      }catch(e){}
      p = save;
    }
    return postfix();
  }
  function newExpr(){
    eat("kw", "new");
    /* new[] { ... } или new T[...] */
    if(isOp("[")){ p++; eat("op", "]"); return {k:"newarr", type:null, items:arrInit()}; }
    const t = parseType();
    if(t.name === "Array"){
      if(isOp("{")) return {k:"newarr", type:t.args[0], items:arrInit()};
      return {k:"newarr", type:t.args[0], items:[]};
    }
    let args = [];
    if(isOp("(")){ args = argList(); }
    let init = null;
    if(isOp("{")) init = objInit();
    return {k:"new", type:t, args, init, line:ln()};
  }
  function arrInit(){
    eat("op", "{"); const out = [];
    while(!isOp("}")){ out.push(expr()); if(!opt("op", ",")) break; }
    eat("op", "}"); return out;
  }
  function objInit(){
    eat("op", "{"); const out = [];
    while(!isOp("}")){
      if(at("id") && peek(1).k === "op" && peek(1).v === "="){
        const name = next().v; p++; out.push({kind:"prop", name, value:expr()});
      } else if(isOp("{")){
        eat("op","{"); const kk = expr(); eat("op", ","); const vv = expr(); eat("op","}");
        out.push({kind:"kv", key:kk, value:vv});
      } else out.push({kind:"item", value:expr()});
      if(!opt("op", ",")) break;
    }
    eat("op", "}"); return out;
  }
  function argList(){
    eat("op", "("); const out = [];
    while(!isOp(")")){
      let mod = null;
      if(isKw("ref") || isKw("out")){ mod = next().v; }
      if(mod === "out" && isTypeStart() && looksDecl()){ parseType(); const nm = eat("id").v; out.push({mod, decl:nm, e:{k:"id", name:nm}}); }
      else out.push({mod, e:expr()});
      if(!opt("op", ",")) break;
    }
    eat("op", ")"); return out;
  }
  function postfix(seed){
    let e = seed !== undefined ? seed : primary();
    for(;;){
      if(isOp(".")){ p++; const name = (at("kw") ? next().v : eat("id").v); e = {k:"member", o:e, name, line:ln()}; continue; }
      if(isOp("?.")){ p++; const name = (at("kw") ? next().v : eat("id").v); e = {k:"member", o:e, name, safe:true, line:ln()}; continue; }
      if(isOp("(")){ e = {k:"call", f:e, args:argList(), line:ln()}; continue; }
      if(isOp("[")){ p++; const idx = expr(); eat("op", "]"); e = {k:"index", o:e, i:idx, line:ln()}; continue; }
      if(at("op") && ["++","--"].includes(peek().v)){ const op = next().v; e = {k:"post", op, e}; continue; }
      break;
    }
    return e;
  }
  function lambdaAhead(){
    if(at("id") && peek(1).k === "op" && peek(1).v === "=>") return 1;
    if(isOp("(")){
      let i = p + 1, d = 1;
      while(i < ts.length && d > 0){ const t = ts[i]; if(t.k==="op"&&t.v==="(")d++; else if(t.k==="op"&&t.v===")")d--; else if(t.k==="eof") return 0; i++; }
      if(ts[i] && ts[i].k === "op" && ts[i].v === "=>") return 2;
    }
    return 0;
  }
  function primary(){
    const L = ln();
    const la = lambdaAhead();
    if(la === 1){ const a = next().v; eat("op", "=>"); return lambdaBody([a]); }
    if(la === 2){
      eat("op", "("); const ps = [];
      while(!isOp(")")){ if(isTypeStart() && peek(1).k === "id") parseType(); ps.push(eat("id").v); if(!opt("op", ",")) break; }
      eat("op", ")"); eat("op", "=>"); return lambdaBody(ps);
    }
    if(at("num")){ const n = next().v; return {k:"lit", t:n.real ? "double" : "int", v:n.v}; }
    if(at("str")) return {k:"lit", t:"string", v:next().v};
    if(at("char")) return {k:"lit", t:"char", v:next().v};
    if(at("interp")){
      const parts = next().v;
      return {k:"interp", parts: parts.map(x => x.lit !== undefined ? {lit:x.lit} : {e: parse_sub(x.expr)})};
    }
    if(isKw("true")){ p++; return {k:"lit", t:"bool", v:true}; }
    if(isKw("false")){ p++; return {k:"lit", t:"bool", v:false}; }
    if(isKw("null")){ p++; return {k:"lit", t:"null", v:null}; }
    if(isKw("this")){ p++; return {k:"this"}; }
    /* value, get, set — контекстные ключевые слова: в выражении это обычные имена */
    if(at("kw") && ["value","get","set","from","select","where"].includes(peek().v))
      return {k:"id", name:next().v, line:L};
    if(isKw("base")){ p++; return {k:"base"}; }
    if(isKw("typeof")){ p++; eat("op","("); const t = parseType(); eat("op",")"); return {k:"typeof", type:t}; }
    if(isKw("nameof")){ p++; eat("op","("); const e = expr(); eat("op",")"); return {k:"nameof", e}; }
    if(isOp("(")){ p++; const e = expr(); eat("op", ")"); return e; }
    if(at("kw") && PRIM.has(peek().v)) return {k:"id", name:next().v, line:L};
    if(at("id")) return {k:"id", name:next().v, line:L};
    cserr("не понимаю выражение около «" + (peek().v || peek().k) + "»", L);
  }
  function lambdaBody(ps){
    if(isOp("{")) return {k:"lambda", ps, body:block()};
    return {k:"lambda", ps, expr:expr()};
  }
  function parse_sub(code){
    const saveTs = ts, saveP = p;
    try{ return parseExprString(code); } finally{ /* восстановление не нужно: отдельный вызов */ }
  }

  /* ── операторы ────────────────────────────────────────── */
  function block(){
    eat("op", "{"); const out = [];
    while(!isOp("}") && !at("eof")) out.push(stmt());
    eat("op", "}"); return {k:"block", body:out};
  }
  function stmt(){
    const L = ln();
    if(isOp("{")) return block();
    if(isOp(";")){ p++; return {k:"empty"}; }
    if(isKw("if")){
      p++; eat("op","("); const c = expr(); eat("op",")");
      const a = stmt(); let b = null;
      if(isKw("else")){ p++; b = stmt(); }
      return {k:"if", c, a, b, line:L};
    }
    if(isKw("while")){ p++; eat("op","("); const c = expr(); eat("op",")"); return {k:"while", c, body:stmt(), line:L}; }
    if(isKw("do")){ p++; const body = stmt(); eat("kw","while"); eat("op","("); const c = expr(); eat("op",")"); eat("op",";"); return {k:"do", c, body, line:L}; }
    if(isKw("for")){
      p++; eat("op","(");
      let init = null;
      if(!isOp(";")) init = looksDecl() ? localDecl(true) : {k:"exprstmt", e:expr()};
      eat("op",";");
      const c = isOp(";") ? null : expr(); eat("op",";");
      const step = isOp(")") ? null : expr(); eat("op",")");
      return {k:"for", init, c, step, body:stmt(), line:L};
    }
    if(isKw("foreach")){
      p++; eat("op","("); parseType(); const name = eat("id").v; eat("kw","in");
      const src = expr(); eat("op",")");
      return {k:"foreach", name, src, body:stmt(), line:L};
    }
    if(isKw("return")){ p++; const e = isOp(";") ? null : expr(); eat("op",";"); return {k:"return", e, line:L}; }
    if(isKw("break")){ p++; eat("op",";"); return {k:"break", line:L}; }
    if(isKw("continue")){ p++; eat("op",";"); return {k:"continue", line:L}; }
    if(isKw("throw")){ p++; const e = isOp(";") ? null : expr(); eat("op",";"); return {k:"throw", e, line:L}; }
    if(isKw("try")){
      p++; const body = block(); const catches = []; let fin = null;
      while(isKw("catch")){
        p++; let type = null, name = null;
        if(isOp("(")){ p++; type = parseType(); if(at("id")) name = next().v; eat("op",")"); }
        catches.push({type, name, body:block()});
      }
      if(isKw("finally")){ p++; fin = block(); }
      return {k:"try", body, catches, fin, line:L};
    }
    if(isKw("using") && peek(1).k === "op" && peek(1).v === "("){
      p++; eat("op","(");
      const d = looksDecl() ? localDecl(true) : {k:"exprstmt", e:expr()};
      eat("op",")");
      return {k:"using", decl:d, body:stmt(), line:L};
    }
    if(isKw("switch")){
      p++; eat("op","("); const e = expr(); eat("op",")"); eat("op","{");
      const cases = [];
      while(!isOp("}")){
        let vals = [], isDef = false;
        for(;;){
          if(isKw("case")){ p++; vals.push(expr()); eat("op",":"); }
          else if(isKw("default")){ p++; eat("op",":"); isDef = true; }
          else break;
        }
        const body = [];
        while(!isKw("case") && !isKw("default") && !isOp("}")) body.push(stmt());
        cases.push({vals, isDef, body});
      }
      eat("op","}");
      return {k:"switch", e, cases, line:L};
    }
    if(looksLocalFn()){
      const mods = modifiers();
      const type = parseType(); const name = eat("id").v;
      const ps = paramList();
      const body = isOp("=>") ? (p++, (()=>{ const e = expr(); eat("op",";"); return {k:"block", body:[{k:"return", e}]}; })()) : block();
      return {k:"localfn", mods:[...mods], type, name, ps, body, line:L};
    }
    if(looksDecl()){ const d = localDecl(false); return d; }
    const e = expr(); eat("op",";"); return {k:"exprstmt", e, line:L};
  }
  function looksLocalFn(){
    const save = p;
    try{
      modifiers();
      if(!isTypeStart()){ p = save; return false; }
      parseType();
      const ok = at("id") && peek(1).k === "op" && peek(1).v === "(";
      p = save; return ok;
    }catch(e){ p = save; return false; }
  }
  function localDecl(noSemi){
    const L = ln();
    const type = parseType();
    const vars = [];
    for(;;){
      const name = eat("id").v;
      let init = null;
      if(isOp("=")){ p++; init = isOp("{") ? {k:"newarr", type, items:arrInit()} : expr(); }
      vars.push({name, init});
      if(!opt("op", ",")) break;
    }
    if(!noSemi) eat("op",";");
    return {k:"decl", type, vars, line:L};
  }

  /* ── типы верхнего уровня ─────────────────────────────── */
  function modifiers(){
    const m = new Set();
    while(at("kw") && MODS.has(peek().v)) m.add(next().v);
    return m;
  }
  function typeDecl(mods){
    const kind = next().v;                    /* class | struct | interface | enum | record */
    const name = eat("id").v;
    if(isOp("<")){ p++; parseType(); while(opt("op",",")) parseType(); eat("op",">"); }
    let bases = [];
    if(isOp(":")){ p++; bases.push(parseType().name); while(opt("op",",")) bases.push(parseType().name); }
    if(kind === "enum"){
      eat("op","{"); const vals = []; let n = 0;
      while(!isOp("}")){
        const nm = eat("id").v;
        if(isOp("=")){ p++; n = expr().v; }
        vals.push({name:nm, value:n++});
        if(!opt("op",",")) break;
      }
      eat("op","}");
      return {k:"enum", name, vals};
    }
    eat("op","{");
    const members = [];
    while(!isOp("}") && !at("eof")) members.push(member(name));
    eat("op","}");
    return {k:"type", kind, name, bases, mods:[...mods], members};
  }
  function member(owner){
    const mods = modifiers();
    if(at("kw") && ["class","struct","interface","enum","record"].includes(peek().v)) return typeDecl(mods);
    /* конструктор */
    if(at("id") && peek().v === owner && peek(1).k === "op" && peek(1).v === "("){
      p++; const ps = paramList();
      let chain = null;
      if(isOp(":")){ p++; const which = next().v; chain = {which, args:argList()}; }
      const body = isOp(";") ? (p++, {k:"block", body:[]}) : block();
      return {k:"ctor", mods:[...mods], ps, chain, body};
    }
    const type = parseType();
    const name = (at("kw") ? next().v : eat("id").v);
    /* метод */
    if(isOp("(")){
      const ps = paramList();
      if(isOp("=>")){ p++; const e = expr(); eat("op",";"); return {k:"method", mods:[...mods], type, name, ps, body:{k:"block", body:[{k:"return", e}]}}; }
      const body = isOp(";") ? (p++, null) : block();
      return {k:"method", mods:[...mods], type, name, ps, body};
    }
    /* свойство */
    if(isOp("{")){
      p++;
      let getter = null, setter = null, auto = true;
      while(!isOp("}")){
        const am = modifiers();
        const which = next().v;                 /* get | set */
        if(isOp(";")){ p++; }
        else if(isOp("=>")){ p++; const e = expr(); eat("op",";"); auto = false;
          if(which === "get") getter = {k:"block", body:[{k:"return", e}]}; else setter = {k:"block", body:[{k:"exprstmt", e}]}; }
        else { auto = false; const b = block(); if(which === "get") getter = b; else setter = b; }
        if(which === "get" && !getter && auto) getter = "auto";
        if(which === "set" && !setter && auto) setter = "auto";
      }
      eat("op","}");
      let init = null;
      if(isOp("=")){ p++; init = expr(); eat("op",";"); }
      return {k:"prop", mods:[...mods], type, name, getter, setter, auto, init};
    }
    if(isOp("=>")){ p++; const e = expr(); eat("op",";"); return {k:"prop", mods:[...mods], type, name, getter:{k:"block", body:[{k:"return", e}]}, setter:null, auto:false}; }
    /* поле */
    const vars = [];
    for(;;){
      let init = null;
      if(isOp("=")){ p++; init = isOp("{") ? {k:"newarr", type, items:arrInit()} : expr(); }
      vars.push({name: vars.length ? eat("id").v : name, init});
      if(!opt("op",",")) break;
      const nm = eat("id").v;
      let ini = null;
      if(isOp("=")){ p++; ini = expr(); }
      vars.push({name:nm, init:ini});
      if(!opt("op",",")) break;
    }
    eat("op",";");
    return {k:"field", mods:[...mods], type, vars};
  }
  function paramList(){
    eat("op","("); const ps = [];
    while(!isOp(")")){
      let mod = null;
      while(at("kw") && ["ref","out","params","this","in"].includes(peek().v)) mod = next().v;
      const t = parseType(); const nm = eat("id").v;
      let def = null;
      if(isOp("=")){ p++; def = expr(); }
      ps.push({mod, type:t, name:nm, def});
      if(!opt("op",",")) break;
    }
    eat("op",")"); return ps;
  }

  /* ── корень ───────────────────────────────────────────── */
  const types = [], top = [];
  while(!at("eof")){
    if(isKw("using") && !(peek(1).k === "op" && peek(1).v === "(")){
      p++; while(!isOp(";") && !at("eof")) p++; eat("op",";"); continue;
    }
    if(isKw("namespace")){
      p++; parseType();
      if(isOp(";")){ p++; continue; }
      eat("op","{");
      while(!isOp("}") && !at("eof")){ const m = modifiers(); types.push(typeDecl(m)); }
      eat("op","}"); continue;
    }
    const save = p;
    const mods = modifiers();
    if(at("kw") && ["class","struct","interface","enum","record"].includes(peek().v)){ types.push(typeDecl(mods)); continue; }
    p = save;
    top.push(stmt());
  }
  return {types, top};
}
function parseExprString(code){
  const r = parse(code + ";");
  const s = r.top[0];
  return s.k === "exprstmt" ? s.e : s;
}
