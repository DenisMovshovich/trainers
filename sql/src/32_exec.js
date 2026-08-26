/* ============================================================
   Выполнение запросов
   ============================================================ */
const isNull = v => v === null || v === undefined;
const N = v => isNull(v) ? null : v;
function truthy(v){ return v === true; }
function cmpVals(a, b){
  if(isNull(a) || isNull(b)) return null;
  if(typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
  if(typeof a === "boolean" || typeof b === "boolean"){ const x = a?1:0, y = b?1:0; return x<y?-1:x>y?1:0; }
  const A = String(a), B = String(b);
  if(/^\d{4}-\d{2}-\d{2}/.test(A) && /^\d{4}-\d{2}-\d{2}/.test(B)) return A<B?-1:A>B?1:0;
  const r = A.localeCompare(B, "ru");
  return r < 0 ? -1 : r > 0 ? 1 : 0;
}
function eqVals(a, b){ const c = cmpVals(a, b); return c === null ? null : c === 0; }
function num(v, what){
  if(isNull(v)) return null;
  if(typeof v === "number") return v;
  const n = parseFloat(v);
  if(Number.isNaN(n)) throw new SqlErr("нечисловое значение в арифметике: " + JSON.stringify(v));
  return n;
}
function likeToRe(pat, ci){
  let r = "";
  for(let i = 0; i < pat.length; i++){
    const c = pat[i];
    if(c === "\\"){ r += (pat[++i] || "\\").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); continue; }
    if(c === "%"){ r += "[\\s\\S]*"; continue; }
    if(c === "_"){ r += "[\\s\\S]"; continue; }
    r += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + r + "$", ci ? "i" : "");
}

const AGG = new Set(["count","sum","avg","min","max","string_agg","array_agg","bool_and","bool_or","every"]);
const WINFN = new Set(["row_number","rank","dense_rank","lag","lead","first_value","last_value","ntile"]);

/* ---------- поиск значения поля ---------- */
function lookup(row, table, name){
  const ln = name.toLowerCase(), lt = table ? table.toLowerCase() : null;
  let hit = null, count = 0, pri = null;
  for(const f of row.fields){
    if(f.n.toLowerCase() !== ln) continue;
    if(lt && String(f.t).toLowerCase() !== lt) continue;
    if(f.pri && pri === null) pri = f;
    hit = f; count++;
  }
  if(pri) return pri.v;
  if(count === 0) return undefined;
  if(count > 1 && !lt) throw new SqlErr("столбец «" + name + "» встречается в нескольких таблицах — уточните имя");
  return hit.v;
}

/* ---------- вычисление выражения ---------- */
function ev(e, row, ctx){
  switch(e.k){
    case "num": return e.v;
    case "str": return e.v;
    case "bool": return e.v;
    case "null": return null;
    case "col": {
      if(ctx.aggRow && ctx.aggRow.named && Object.prototype.hasOwnProperty.call(ctx.aggRow.named, e.name.toLowerCase()) && !e.table)
        return ctx.aggRow.named[e.name.toLowerCase()];
      let v = lookup(row, e.table, e.name);
      if(v === undefined && ctx.outer) v = lookup(ctx.outer, e.table, e.name);
      if(v === undefined) throw new SqlErr("нет столбца «" + (e.table ? e.table + "." : "") + e.name + "»");
      return v;
    }
    case "un":
      if(e.op === "not"){ const v = ev(e.e, row, ctx); return isNull(v) ? null : !v; }
      { const v = num(ev(e.e, row, ctx)); return isNull(v) ? null : (e.op === "-" ? -v : v); }
    case "bin": return evBin(e, row, ctx);
    case "is": {
      const v = ev(e.e, row, ctx);
      let r;
      if(e.what === "null") r = isNull(v);
      else if(e.what === "true") r = v === true;
      else r = v === false;
      return e.not ? !r : r;
    }
    case "isdistinct": {
      const a = ev(e.e, row, ctx), b = ev(e.r, row, ctx);
      const same = (isNull(a) && isNull(b)) || (!isNull(a) && !isNull(b) && eqVals(a,b) === true);
      return e.not ? same : !same;
    }
    case "between": {
      const v = ev(e.e, row, ctx), lo = ev(e.lo, row, ctx), hi = ev(e.hi, row, ctx);
      if(isNull(v) || isNull(lo) || isNull(hi)) return null;
      const r = cmpVals(v, lo) >= 0 && cmpVals(v, hi) <= 0;
      return e.not ? !r : r;
    }
    case "like": {
      const v = ev(e.e, row, ctx), pt = ev(e.pat, row, ctx);
      if(isNull(v) || isNull(pt)) return null;
      const r = likeToRe(String(pt), e.ci).test(String(v));
      return e.not ? !r : r;
    }
    case "in": {
      const v = ev(e.e, row, ctx);
      const vals = e.sub ? runSelect(e.sub, ctx, row).rows.map(r=>r[0]) : e.list.map(x=>ev(x, row, ctx));
      if(isNull(v)) return vals.length ? null : (e.not ? true : false);
      let sawNull = false;
      for(const x of vals){
        if(isNull(x)){ sawNull = true; continue; }
        if(eqVals(v, x) === true) return !e.not;
      }
      if(sawNull) return null;
      return !!e.not;
    }
    case "exists": {
      const r = runSelect(e.sub, ctx, row);
      return r.rows.length > 0;
    }
    case "sub": {
      const r = runSelect(e.sub, ctx, row);
      if(r.rows.length === 0) return null;
      if(r.rows.length > 1) throw new SqlErr("подзапрос вернул больше одной строки");
      return r.rows[0][0];
    }
    case "anyall": {
      const v = ev(e.e, row, ctx);
      const vals = runSelect(e.sub, ctx, row).rows.map(r=>r[0]);
      const test = x => {
        const c = cmpVals(v, x);
        if(c === null) return null;
        switch(e.op){ case "=": return c===0; case "<>": return c!==0; case "<": return c<0;
          case ">": return c>0; case "<=": return c<=0; case ">=": return c>=0; }
      };
      if(e.kind === "all"){
        let sawNull = false;
        for(const x of vals){ const t = test(x); if(t === false) return false; if(t === null) sawNull = true; }
        return sawNull ? null : true;
      }
      let sawNull = false;
      for(const x of vals){ const t = test(x); if(t === true) return true; if(t === null) sawNull = true; }
      return sawNull ? null : false;
    }
    case "cast": {
      const v = ev(e.e, row, ctx);
      if(isNull(v)) return null;
      if(["integer","int","bigint","smallint"].includes(e.type)) return Math.trunc(num(v));
      if(["numeric","decimal","real","float","double"].includes(e.type)) return num(v);
      if(["text","varchar","char"].includes(e.type)) return String(v);
      if(e.type === "boolean") return v === true || v === "true" || v === 1;
      if(e.type === "date") return String(v).slice(0,10);
      return v;
    }
    case "case": {
      if(e.operand !== null){
        const o = ev(e.operand, row, ctx);
        for(const w of e.whens) if(eqVals(o, ev(w.when, row, ctx)) === true) return ev(w.then, row, ctx);
      } else {
        for(const w of e.whens) if(truthy(ev(w.when, row, ctx))) return ev(w.then, row, ctx);
      }
      return e.else ? ev(e.else, row, ctx) : null;
    }
    case "func": return evFunc(e, row, ctx);
    case "star": throw new SqlErr("* здесь недопустима");
  }
  throw new SqlErr("не умею вычислять узел " + e.k);
}
function evBin(e, row, ctx){
  const op = e.op;
  if(op === "and"){
    const a = ev(e.l, row, ctx);
    if(a === false) return false;
    const b = ev(e.r, row, ctx);
    if(b === false) return false;
    if(isNull(a) || isNull(b)) return null;
    return true;
  }
  if(op === "or"){
    const a = ev(e.l, row, ctx);
    if(a === true) return true;
    const b = ev(e.r, row, ctx);
    if(b === true) return true;
    if(isNull(a) || isNull(b)) return null;
    return false;
  }
  const a = ev(e.l, row, ctx), b = ev(e.r, row, ctx);
  if(op === "||"){ if(isNull(a) || isNull(b)) return null; return String(a) + String(b); }
  if(["=","<>","<",">","<=",">="].includes(op)){
    const c = cmpVals(a, b);
    if(c === null) return null;
    switch(op){ case "=": return c===0; case "<>": return c!==0; case "<": return c<0;
      case ">": return c>0; case "<=": return c<=0; case ">=": return c>=0; }
  }
  const x = num(a), y = num(b);
  if(isNull(x) || isNull(y)) return null;
  switch(op){
    case "+": return x + y;
    case "-": return x - y;
    case "*": return x * y;
    case "/": if(y === 0) throw new SqlErr("деление на ноль");
              return (Number.isInteger(x) && Number.isInteger(y)) ? Math.trunc(x / y) : x / y;
    case "%": if(y === 0) throw new SqlErr("деление на ноль"); return x % y;
  }
  throw new SqlErr("неизвестная операция " + op);
}
function evFunc(e, row, ctx){
  const n = e.name;
  if(ctx.aggVals && e.__id !== undefined && Object.prototype.hasOwnProperty.call(ctx.aggVals, e.__id))
    return ctx.aggVals[e.__id];
  if(ctx.winVals && e.__wid !== undefined && Object.prototype.hasOwnProperty.call(ctx.winVals, e.__wid))
    return ctx.winVals[e.__wid];
  if(e.over || (WINFN.has(n) && !ctx.winVals))
    throw new SqlErr("оконные функции нельзя использовать в WHERE, GROUP BY и HAVING — оберните запрос в подзапрос или CTE");
  if(AGG.has(n) && !ctx.inAgg) throw new SqlErr("агрегат " + n.toUpperCase() + " здесь недопустим — нужен GROUP BY или контекст агрегации");
  const A = e.args.map(a=>a.k === "star" ? "*" : ev(a, row, ctx));
  switch(n){
    case "coalesce": { for(const v of A) if(!isNull(v)) return v; return null; }
    case "nullif": return eqVals(A[0], A[1]) === true ? null : A[0];
    case "greatest": { let m = null; for(const v of A){ if(isNull(v)) continue; if(m === null || cmpVals(v,m) > 0) m = v; } return m; }
    case "least": { let m = null; for(const v of A){ if(isNull(v)) continue; if(m === null || cmpVals(v,m) < 0) m = v; } return m; }
    case "upper": return isNull(A[0]) ? null : String(A[0]).toUpperCase();
    case "lower": return isNull(A[0]) ? null : String(A[0]).toLowerCase();
    case "length": case "char_length": return isNull(A[0]) ? null : String(A[0]).length;
    case "trim": case "btrim": return isNull(A[0]) ? null : String(A[0]).trim();
    case "substr": case "substring": return isNull(A[0]) ? null : String(A[0]).substr(A[1]-1, A[2] === undefined ? undefined : A[2]);
    case "concat": return A.filter(v=>!isNull(v)).map(String).join("");
    case "replace": return isNull(A[0]) ? null : String(A[0]).split(String(A[1])).join(String(A[2]));
    case "position": case "strpos": return isNull(A[0]) ? null : String(A[0]).indexOf(String(A[1])) + 1;
    case "abs": return isNull(A[0]) ? null : Math.abs(num(A[0]));
    case "round": { if(isNull(A[0])) return null; const d = A[1] || 0; const f = Math.pow(10, d); return Math.round(num(A[0]) * f) / f; }
    case "ceil": case "ceiling": return isNull(A[0]) ? null : Math.ceil(num(A[0]));
    case "floor": return isNull(A[0]) ? null : Math.floor(num(A[0]));
    case "mod": return isNull(A[0]) || isNull(A[1]) ? null : num(A[0]) % num(A[1]);
    case "extract": return isNull(A[0]) ? null : null;
    case "date_part": {
      if(isNull(A[1])) return null;
      const d = String(A[1]);
      const part = String(A[0]).toLowerCase();
      if(part === "year") return +d.slice(0,4);
      if(part === "month") return +d.slice(5,7);
      if(part === "day") return +d.slice(8,10);
      return null;
    }
    case "to_char": {
      if(isNull(A[0])) return null;
      const d = String(A[0]), f = String(A[1] || "");
      return f.replace(/YYYY/g, d.slice(0,4)).replace(/MM/g, d.slice(5,7)).replace(/DD/g, d.slice(8,10));
    }
    case "now": case "current_date": return "2025-08-19";
    case "cardinality": return Array.isArray(A[0]) ? A[0].length : null;
  }
  throw new SqlErr("нет функции " + n + "()");
}

/* ---------- источники строк ---------- */
function tableRows(db, name){
  const t = db.tables[name.toLowerCase()] || db.tables[name];
  if(!t) throw new SqlErr("нет таблицы «" + name + "»");
  return t;
}
function scan(node, ctx, outerRow){
  if(node.k === "table"){
    const nm = node.name.toLowerCase();
    if(ctx.ctes && ctx.ctes[nm]){
      const c = ctx.ctes[nm];
      const alias = node.alias || node.name;
      return c.rows.map(r=>({fields: c.cols.map((cn,i)=>({t:alias, n:cn, v:r[i]}))}));
    }
    const t = tableRows(ctx.db, nm);
    const alias = node.alias || t.name;
    return t.rows.map(r=>({fields: t.cols.map((c,i)=>({t:alias, n:c[0], v:r[i]}))}));
  }
  if(node.k === "subq"){
    const res = runSelect(node.sub, ctx, outerRow);
    const alias = node.alias || "подзапрос";
    return res.rows.map(r=>({fields: res.cols.map((c,i)=>({t:alias, n:c, v:r[i]}))}));
  }
  if(node.k === "join"){
    const L = scan(node.left, ctx, outerRow);
    const R = scan(node.right, ctx, outerRow);
    const out = [];
    const rightCols = R.length ? R[0].fields : [];
    const nullRight = () => rightCols.map(f=>({t:f.t, n:f.n, v:null}));
    const leftCols = L.length ? L[0].fields : [];
    const nullLeft = () => leftCols.map(f=>({t:f.t, n:f.n, v:null}));
    const match = (a, b) => {
      if(node.type === "cross") return true;
      const merged = {fields: a.fields.concat(b.fields)};
      if(node.using) return node.using.every(c=>eqVals(lookup(a,null,c), lookup(b,null,c)) === true);
      if(!node.on) return true;
      return truthy(ev(node.on, merged, Object.assign({}, ctx, {outer: outerRow})));
    };
    const usedRight = new Set();
    L.forEach(a=>{
      let hit = false;
      R.forEach((b, bi)=>{
        if(match(a, b)){ hit = true; usedRight.add(bi); out.push({fields: a.fields.concat(b.fields)}); }
      });
      if(!hit && (node.type === "left" || node.type === "full")) out.push({fields: a.fields.concat(nullRight())});
    });
    if(node.type === "right" || node.type === "full")
      R.forEach((b, bi)=>{ if(!usedRight.has(bi)) out.push({fields: nullLeft().concat(b.fields)}); });
    return out;
  }
  throw new SqlErr("неизвестный источник строк");
}

/* ---------- агрегаты и окна ---------- */
let __uid = 0;
function collectAggs(e, acc){
  if(!e || typeof e !== "object") return;
  if(e.k === "sub" || e.k === "exists" || e.sel || e.stmts) return;   /* подзапрос — своя область видимости */
  if(e.k === "func" && AGG.has(e.name) && !e.over){ if(e.__id === undefined) e.__id = ++__uid; acc.push(e); }
  Object.keys(e).forEach(k=>{
    if(k === "__id" || k === "__wid") return;
    const v = e[k];
    if(Array.isArray(v)) v.forEach(x=>collectAggs(x, acc));
    else if(v && typeof v === "object" && v.k) collectAggs(v, acc);
    else if(v && typeof v === "object" && (v.when || v.then || v.e)) collectAggs(v, acc);
  });
  if(e.whens) e.whens.forEach(w=>{ collectAggs(w.when, acc); collectAggs(w.then, acc); });
}
function collectWins(e, acc){
  if(!e || typeof e !== "object") return;
  if(e.k === "sub" || e.k === "exists" || e.sel || e.stmts) return;   /* подзапрос — своя область видимости */
  if(e.k === "func" && e.over){ if(e.__wid === undefined) e.__wid = ++__uid; acc.push(e); }
  Object.keys(e).forEach(k=>{
    if(k === "__id" || k === "__wid" || k === "over") return;
    const v = e[k];
    if(Array.isArray(v)) v.forEach(x=>collectWins(x, acc));
    else if(v && typeof v === "object" && v.k) collectWins(v, acc);
  });
  if(e.whens) e.whens.forEach(w=>{ collectWins(w.when, acc); collectWins(w.then, acc); });
}
function aggregate(fn, rows, ctx){
  const name = fn.name;
  let vals;
  if(fn.filter) rows = rows.filter(r=>truthy(ev(fn.filter, r, Object.assign({}, ctx, {inAgg:true}))));
  if(fn.args.length && fn.args[0].k === "star") vals = rows.map(()=>1);
  else vals = rows.map(r=>ev(fn.args[0], r, Object.assign({}, ctx, {inAgg:true})));
  if(fn.args.length && fn.args[0].k !== "star") vals = vals.filter(v=>!isNull(v));
  if(fn.distinct){
    const seen = new Set(), out = [];
    vals.forEach(v=>{ const k = JSON.stringify(v); if(!seen.has(k)){ seen.add(k); out.push(v); } });
    vals = out;
  }
  switch(name){
    case "count": return vals.length;
    case "sum": return vals.length ? vals.reduce((a,b)=>a + num(b), 0) : null;
    case "avg": return vals.length ? vals.reduce((a,b)=>a + num(b), 0) / vals.length : null;
    case "min": { let m = null; vals.forEach(v=>{ if(m === null || cmpVals(v,m) < 0) m = v; }); return m; }
    case "max": { let m = null; vals.forEach(v=>{ if(m === null || cmpVals(v,m) > 0) m = v; }); return m; }
    case "string_agg": {
      const sep = fn.args[1] ? ev(fn.args[1], rows[0], ctx) : ",";
      return vals.length ? vals.map(String).join(String(sep)) : null;
    }
    case "bool_and": case "every": return vals.length ? vals.every(v=>v === true) : null;
    case "bool_or": return vals.length ? vals.some(v=>v === true) : null;
    case "array_agg": return vals.length ? vals : null;
  }
  throw new SqlErr("нет агрегата " + name);
}
