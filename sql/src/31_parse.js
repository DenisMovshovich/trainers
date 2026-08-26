/* ============================================================
   Лексер и парсер SQL
   ============================================================ */
class SqlErr extends Error {}

const KW = new Set(["select","from","where","group","by","having","order","limit","offset","join","inner","left",
"right","full","outer","cross","on","using","as","and","or","not","null","is","in","between","like","ilike","exists",
"case","when","then","else","end","distinct","all","any","some","union","except","intersect","with","recursive",
"insert","into","values","update","set","delete","returning","create","table","drop","primary","key","foreign",
"references","unique","check","default","constraint","begin","commit","rollback","explain","analyze","true","false",
"asc","desc","nulls","first","last","over","partition","conflict","do","nothing","cast","if","exists","alter","add","filter","excluded",
"column","integer","text","numeric","date","boolean","serial","varchar","timestamp","interval","filter","within","cascade"]);

function lex(src){
  const t = [];
  let i = 0;
  const isD = c => c >= "0" && c <= "9";
  const isI = c => /[A-Za-zА-Яа-яЁё_0-9$]/.test(c);
  while(i < src.length){
    const c = src[i];
    if(/\s/.test(c)){ i++; continue; }
    if(c === "-" && src[i+1] === "-"){ while(i < src.length && src[i] !== "\n") i++; continue; }
    if(c === "/" && src[i+1] === "*"){ const e = src.indexOf("*/", i+2); i = e < 0 ? src.length : e + 2; continue; }
    if(c === "'"){
      let s = "", j = i + 1;
      while(j < src.length){
        if(src[j] === "'" && src[j+1] === "'"){ s += "'"; j += 2; continue; }
        if(src[j] === "'"){ break; }
        s += src[j++];
      }
      if(j >= src.length) throw new SqlErr("незакрытая строковая константа");
      t.push({t:"str", v:s}); i = j + 1; continue;
    }
    if(c === '"'){
      const e = src.indexOf('"', i+1);
      if(e < 0) throw new SqlErr("незакрытый идентификатор в кавычках");
      t.push({t:"id", v:src.slice(i+1, e), quoted:true}); i = e + 1; continue;
    }
    if(isD(c) || (c === "." && isD(src[i+1]))){
      let j = i;
      while(j < src.length && (isD(src[j]) || src[j] === ".")) j++;
      t.push({t:"num", v:parseFloat(src.slice(i, j))}); i = j; continue;
    }
    if(isI(c) && !isD(c)){
      let j = i;
      while(j < src.length && isI(src[j])) j++;
      const w = src.slice(i, j);
      t.push({t: KW.has(w.toLowerCase()) ? "kw" : "id", v:w, low:w.toLowerCase()});
      i = j; continue;
    }
    const three = ["<=>"];
    const two = ["<>","!=","<=",">=","||","::"];
    const found = two.find(o=>src.startsWith(o, i));
    if(found){ t.push({t:"op", v:found}); i += 2; continue; }
    if("=<>+-*/%(),.;[]".includes(c)){ t.push({t:"op", v:c}); i++; continue; }
    throw new SqlErr("непонятный символ: " + c);
  }
  t.push({t:"eof", v:""});
  return t;
}

function parse(src){
  const ts = lex(src);
  let p = 0;
  const peek = (n) => ts[p + (n||0)];
  const at = v => { const x = ts[p]; return (x.t === "kw" && x.low === v) || (x.t === "op" && x.v === v); };
  const atAny = (...vs) => vs.some(at);
  const take = v => { if(!at(v)) throw new SqlErr("ожидалось «" + v + "», встретилось «" + (ts[p].v || "конец") + "»"); return ts[p++]; };
  const opt = v => { if(at(v)){ p++; return true; } return false; };
  const isId = () => ts[p].t === "id" || (ts[p].t === "kw" && !RESERVED_STOP.has(ts[p].low));
  const takeId = () => { if(!isId()) throw new SqlErr("ожидалось имя, встретилось «" + (ts[p].v||"конец") + "»"); return ts[p++].v; };
  const RESERVED_STOP = new Set(["from","where","group","having","order","limit","offset","join","inner","left","right",
    "full","cross","on","using","and","or","not","select","union","except","intersect","when","then","else","end","as",
    "set","values","into","returning","with","desc","asc","is","in","between","like","ilike","distinct","over","partition","by"]);

  /* ---------- выражения ---------- */
  function expr(){ return orExpr(); }
  function orExpr(){ let l = andExpr(); while(at("or")){ p++; l = {k:"bin", op:"or", l, r: andExpr()}; } return l; }
  function andExpr(){ let l = notExpr(); while(at("and")){ p++; l = {k:"bin", op:"and", l, r: notExpr()}; } return l; }
  function notExpr(){ if(at("not")){ p++; return {k:"un", op:"not", e: notExpr()}; } return cmpExpr(); }
  function cmpExpr(){
    let l = addExpr();
    for(;;){
      if(ts[p].t === "op" && ["=","<>","!=","<",">","<=",">="].includes(ts[p].v)){
        const op = ts[p++].v;
        if(atAny("any","some","all")){
          const kind = ts[p++].low; take("("); const sub = selectStmt(); take(")");
          l = {k:"anyall", op, kind, e:l, sub}; continue;
        }
        l = {k:"bin", op: op === "!=" ? "<>" : op, l, r: addExpr()}; continue;
      }
      if(at("is")){
        p++; const not = opt("not");
        if(at("null")){ p++; l = {k:"is", e:l, not, what:"null"}; continue; }
        if(at("true")){ p++; l = {k:"is", e:l, not, what:"true"}; continue; }
        if(at("false")){ p++; l = {k:"is", e:l, not, what:"false"}; continue; }
        if(at("distinct")){ p++; take("from"); l = {k:"isdistinct", e:l, not, r: addExpr()}; continue; }
        throw new SqlErr("после IS ожидалось NULL, TRUE, FALSE или DISTINCT FROM");
      }
      let not = false;
      if(at("not") && (peek(1).t === "kw" && ["in","between","like","ilike"].includes(peek(1).low))){ p++; not = true; }
      if(at("between")){ p++; const lo = addExpr(); take("and"); const hi = addExpr(); l = {k:"between", e:l, not, lo, hi}; continue; }
      if(at("in")){
        p++; take("(");
        if(at("select")){ const sub = selectStmt(); take(")"); l = {k:"in", e:l, not, sub}; }
        else { const list = [expr()]; while(opt(",")) list.push(expr()); take(")"); l = {k:"in", e:l, not, list}; }
        continue;
      }
      if(atAny("like","ilike")){ const ci = ts[p].low === "ilike"; p++; l = {k:"like", e:l, not, ci, pat: addExpr()}; continue; }
      break;
    }
    return l;
  }
  function addExpr(){
    let l = mulExpr();
    while(ts[p].t === "op" && ["+","-","||"].includes(ts[p].v)){ const op = ts[p++].v; l = {k:"bin", op, l, r: mulExpr()}; }
    return l;
  }
  function mulExpr(){
    let l = unary();
    while(ts[p].t === "op" && ["*","/","%"].includes(ts[p].v)){ const op = ts[p++].v; l = {k:"bin", op, l, r: unary()}; }
    return l;
  }
  function unary(){
    if(ts[p].t === "op" && (ts[p].v === "-" || ts[p].v === "+")){ const op = ts[p++].v; return {k:"un", op, e: unary()}; }
    return postfix();
  }
  function postfix(){
    let e = primary();
    while(ts[p].t === "op" && ts[p].v === "::"){ p++; e = {k:"cast", e, type: takeId().toLowerCase()}; }
    return e;
  }
  function windowSpec(){
    take("("); const w = {partition:null, order:null};
    if(at("partition")){ p++; take("by"); w.partition = [expr()]; while(opt(",")) w.partition.push(expr()); }
    if(at("order")){ p++; take("by"); w.order = orderList(); }
    take(")");
    return w;
  }
  function primary(){
    const x = ts[p];
    if(x.t === "num"){ p++; return {k:"num", v:x.v}; }
    if(x.t === "str"){ p++; return {k:"str", v:x.v}; }
    if(at("null")){ p++; return {k:"null"}; }
    if(at("true")){ p++; return {k:"bool", v:true}; }
    if(at("false")){ p++; return {k:"bool", v:false}; }
    if(at("exists")){ p++; take("("); const sub = selectStmt(); take(")"); return {k:"exists", sub}; }
    if(at("case")){
      p++;
      const node = {k:"case", operand:null, whens:[], else:null};
      if(!at("when")) node.operand = expr();
      while(at("when")){ p++; const w = expr(); take("then"); node.whens.push({when:w, then: expr()}); }
      if(at("else")){ p++; node.else = expr(); }
      take("end");
      return node;
    }
    if(at("cast")){ p++; take("("); const e = expr(); take("as"); const ty = takeId().toLowerCase(); take(")"); return {k:"cast", e, type:ty}; }
    if(at("(")){
      p++;
      if(at("select") || at("with")){ const sub = selectStmt(); take(")"); return {k:"sub", sub}; }
      const e = expr(); take(")"); return e;
    }
    if(ts[p].t === "op" && ts[p].v === "*"){ p++; return {k:"star", table:null}; }
    if(isId() || ts[p].t === "id"){
      const name = ts[p++].v;
      if(at("(")){
        p++;
        const fn = {k:"func", name: name.toLowerCase(), args:[], distinct:false, over:null};
        if(at("distinct")){ p++; fn.distinct = true; }
        if(!at(")")){
          if(ts[p].t === "op" && ts[p].v === "*"){ p++; fn.args.push({k:"star", table:null}); }
          else { fn.args.push(expr()); while(opt(",")) fn.args.push(expr()); }
        }
        take(")");
        if(at("filter")){ p++; take("("); take("where"); fn.filter = expr(); take(")"); }
        if(at("over")){ p++; fn.over = windowSpec(); }
        return fn;
      }
      if(ts[p].t === "op" && ts[p].v === "."){
        p++;
        if(ts[p].t === "op" && ts[p].v === "*"){ p++; return {k:"star", table:name}; }
        return {k:"col", table:name, name: takeId()};
      }
      return {k:"col", table:null, name};
    }
    throw new SqlErr("не понял выражение у «" + (x.v || "конец") + "»");
  }

  /* ---------- части запроса ---------- */
  function orderList(){
    const out = [];
    do{
      const e = expr();
      let dir = "asc", nulls = null;
      if(at("asc")){ p++; } else if(at("desc")){ p++; dir = "desc"; }
      if(at("nulls")){ p++; nulls = at("first") ? "first" : "last"; p++; }
      out.push({e, dir, nulls});
    } while(opt(","));
    return out;
  }
  function tableRef(){
    let node;
    if(at("(")){ p++; const sub = selectStmt(); take(")"); node = {k:"subq", sub, alias:null}; }
    else node = {k:"table", name: takeId(), alias:null};
    if(at("as")){ p++; node.alias = takeId(); }
    else if(isId() && !atAny("on","using","where","group","order","limit","join","inner","left","right","full","cross","having","union","except","intersect","offset","set","returning")) node.alias = takeId();
    return node;
  }
  function fromClause(){
    let left = tableRef();
    for(;;){
      let type = null;
      if(at("cross")){ p++; take("join"); type = "cross"; }
      else if(at("inner")){ p++; take("join"); type = "inner"; }
      else if(atAny("left","right","full")){ type = ts[p++].low; opt("outer"); take("join"); }
      else if(at("join")){ p++; type = "inner"; }
      else if(at(",")){ p++; type = "cross"; }
      else break;
      const right = tableRef();
      let on = null, using = null;
      if(at("on")){ p++; on = expr(); }
      else if(at("using")){ p++; take("("); using = [takeId()]; while(opt(",")) using.push(takeId()); take(")"); }
      left = {k:"join", type, left, right, on, using};
    }
    return left;
  }
  function selectCore(){
    take("select");
    const node = {k:"core", distinct:false, items:[], from:null, where:null, group:null, having:null};
    if(at("distinct")){ p++; node.distinct = true; }
    else if(at("all")) p++;
    do{
      if(ts[p].t === "op" && ts[p].v === "*"){ p++; node.items.push({expr:{k:"star", table:null}, alias:null}); continue; }
      const e = expr();
      let alias = null;
      if(at("as")){ p++; alias = takeId(); }
      else if(isId() && ts[p].t !== "kw") alias = takeId();
      else if(ts[p].t === "id") alias = takeId();
      node.items.push({expr:e, alias});
    } while(opt(","));
    if(at("from")){ p++; node.from = fromClause(); }
    if(at("where")){ p++; node.where = expr(); }
    if(at("group")){ p++; take("by"); node.group = [expr()]; while(opt(",")) node.group.push(expr()); }
    if(at("having")){ p++; node.having = expr(); }
    return node;
  }
  function selectStmt(){
    const node = {k:"select", ctes:[], cores:[], ops:[], order:null, limit:null, offset:null};
    if(at("with")){
      p++; const rec = opt("recursive");
      do{
        const name = takeId();
        let cols = null;
        if(at("(")){ p++; cols = [takeId()]; while(opt(",")) cols.push(takeId()); take(")"); }
        take("as"); take("("); const sub = selectStmt(); take(")");
        node.ctes.push({name, cols, sub, recursive: rec});
      } while(opt(","));
    }
    node.cores.push(selectCore());
    while(atAny("union","except","intersect")){
      const op = ts[p++].low;
      const all = opt("all");
      node.ops.push({op, all});
      node.cores.push(selectCore());
    }
    if(at("order")){ p++; take("by"); node.order = orderList(); }
    if(at("limit")){ p++; node.limit = at("all") ? (p++, null) : expr(); }
    if(at("offset")){ p++; node.offset = expr(); }
    if(at("limit") && node.limit === null){ p++; node.limit = expr(); }
    return node;
  }

  /* ---------- операторы ---------- */
  function typeName(){
    let t = takeId().toLowerCase();
    if(at("(")){ p++; while(!at(")")) p++; take(")"); }
    return t;
  }
  function statement(){
    if(at("explain")){ p++; opt("analyze"); return {k:"explain", stmt: statement()}; }
    if(atAny("begin","commit","rollback")){ const w = ts[p++].low; opt("transaction"); opt("work"); return {k:"tx", op:w}; }
    if(at("select") || at("with")) return selectStmt();
    if(at("insert")){
      p++; take("into");
      const table = takeId();
      let cols = null;
      if(at("(")){ p++; cols = [takeId()]; while(opt(",")) cols.push(takeId()); take(")"); }
      const node = {k:"insert", table, cols, rows:[], sub:null, conflict:null, returning:null};
      if(at("values")){
        p++;
        do{ take("("); const r = [expr()]; while(opt(",")) r.push(expr()); take(")"); node.rows.push(r); } while(opt(","));
      } else node.sub = selectStmt();
      if(at("on")){
        p++; take("conflict");
        let target = null;
        if(at("(")){ p++; target = [takeId()]; while(opt(",")) target.push(takeId()); take(")"); }
        take("do");
        if(at("nothing")){ p++; node.conflict = {action:"nothing", target}; }
        else { take("update"); take("set"); const sets = []; do{ const c = takeId(); take("="); sets.push({col:c, e: expr()}); } while(opt(","));
               node.conflict = {action:"update", target, sets}; }
      }
      if(at("returning")){ p++; node.returning = returningList(); }
      return node;
    }
    if(at("update")){
      p++; const table = takeId();
      let alias = null;
      if(at("as")){ p++; alias = takeId(); }
      take("set");
      const sets = [];
      do{ const c = takeId(); take("="); sets.push({col:c, e: expr()}); } while(opt(","));
      const node = {k:"update", table, alias, sets, where:null, returning:null};
      if(at("where")){ p++; node.where = expr(); }
      if(at("returning")){ p++; node.returning = returningList(); }
      return node;
    }
    if(at("delete")){
      p++; take("from"); const table = takeId();
      const node = {k:"delete", table, where:null, returning:null};
      if(at("where")){ p++; node.where = expr(); }
      if(at("returning")){ p++; node.returning = returningList(); }
      return node;
    }
    if(at("create")){
      p++; take("table");
      let ifn = false;
      if(at("if")){ p++; take("not"); take("exists"); ifn = true; }
      const name = takeId();
      take("(");
      const cols = [], cons = {pk:[], unique:[], notnull:[], fk:[], check:[], def:{}};
      do{
        if(atAny("primary","unique","foreign","check","constraint")){
          if(at("constraint")){ p++; takeId(); }
          if(at("primary")){ p++; take("key"); take("("); cons.pk = [takeId()]; while(opt(",")) cons.pk.push(takeId()); take(")"); }
          else if(at("unique")){ p++; take("("); const u = [takeId()]; while(opt(",")) u.push(takeId()); take(")"); cons.unique.push(u); }
          else if(at("foreign")){ p++; take("key"); take("("); const c = takeId(); take(")"); take("references");
            const rt = takeId(); let rc = "id"; if(at("(")){ p++; rc = takeId(); take(")"); } cons.fk.push([c, rt, rc]); }
          else if(at("check")){ p++; take("("); let d = 1, txt = ""; while(d > 0){ if(at("(")) d++; if(at(")")){ d--; if(!d){ p++; break; } } txt += (ts[p].t==="str"?"'"+ts[p].v+"'":ts[p].v) + " "; p++; } cons.check.push(txt.trim()); }
          continue;
        }
        const cn = takeId();
        const ct = typeName();
        cols.push([cn, ct === "serial" ? "integer" : ct]);
        if(ct === "serial") cons.pkAuto = cn;
        for(;;){
          if(at("primary")){ p++; take("key"); cons.pk.push(cn); continue; }
          if(at("not")){ p++; take("null"); cons.notnull.push(cn); continue; }
          if(at("null")){ p++; continue; }
          if(at("unique")){ p++; cons.unique.push([cn]); continue; }
          if(at("default")){ p++; cons.def[cn] = expr(); continue; }
          if(at("references")){ p++; const rt = takeId(); let rc = "id"; if(at("(")){ p++; rc = takeId(); take(")"); } cons.fk.push([cn, rt, rc]); continue; }
          if(at("check")){ p++; take("("); let d = 1, txt = ""; while(d > 0){ if(at("(")) d++; if(at(")")){ d--; if(!d){ p++; break; } } txt += (ts[p].t==="str"?"'"+ts[p].v+"'":ts[p].v) + " "; p++; } cons.check.push(txt.trim()); continue; }
          break;
        }
      } while(opt(","));
      take(")");
      return {k:"create", name, cols, cons, ifn};
    }
    if(at("drop")){ p++; take("table"); let ife = false; if(at("if")){ p++; take("exists"); ife = true; } return {k:"drop", name: takeId(), ife}; }
    throw new SqlErr("не понял оператор у «" + (ts[p].v || "конец") + "»");
  }
  function returningList(){
    const out = [];
    do{
      if(ts[p].t === "op" && ts[p].v === "*"){ p++; out.push({expr:{k:"star", table:null}, alias:null}); continue; }
      const e = expr(); let alias = null;
      if(at("as")){ p++; alias = takeId(); } else if(ts[p].t === "id") alias = takeId();
      out.push({expr:e, alias});
    } while(opt(","));
    return out;
  }

  const stmts = [];
  while(ts[p].t !== "eof"){
    if(at(";")){ p++; continue; }
    stmts.push(statement());
    if(!at(";") && ts[p].t !== "eof") throw new SqlErr("лишнее после оператора: «" + ts[p].v + "»");
  }
  return stmts;
}
