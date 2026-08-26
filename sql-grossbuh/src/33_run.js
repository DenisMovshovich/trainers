/* ============================================================
   SELECT, DML и диспетчер операторов
   ============================================================ */
function labelOf(item, i){
  if(item.alias) return item.alias;
  const e = item.expr;
  if(e.k === "col") return e.name;
  if(e.k === "func") return e.name;
  if(e.k === "cast") return labelOf({expr:e.e, alias:null}, i);
  return "?column?";
}
function expandItems(items, sampleRow){
  const out = [];
  items.forEach((it, i)=>{
    if(it.expr.k === "star"){
      const tf = it.expr.table ? String(it.expr.table).toLowerCase() : null;
      const fields = sampleRow ? sampleRow.fields : [];
      const picked = fields.filter(f=>!tf || String(f.t).toLowerCase() === tf);
      if(tf && !picked.length) throw new SqlErr("нет таблицы «" + it.expr.table + "» в FROM");
      picked.forEach(f=>out.push({expr:{k:"col", table:f.t, name:f.n}, alias:f.n}));
      return;
    }
    out.push(it);
  });
  return out;
}

function runCore(core, ctx, outerRow){
  let rows = core.from ? scan(core.from, ctx, outerRow) : [{fields:[]}];
  const base = Object.assign({}, ctx, {outer: outerRow});

  if(core.where) rows = rows.filter(r=>truthy(ev(core.where, r, base)));

  const items = expandItems(core.items, rows[0] || (core.from ? emptySample(core.from, ctx) : {fields:[]}));

  const aggs = [];
  items.forEach(it=>collectAggs(it.expr, aggs));
  if(core.having) collectAggs(core.having, aggs);
  const grouped = !!core.group || aggs.length > 0;

  let outRows = [];
  if(!grouped){
    outRows = rows.map(r=>({row:r, aggVals:{}}));
  } else {
    const groups = new Map();
    if(core.group){
      rows.forEach(r=>{
        const key = JSON.stringify(core.group.map(g=>ev(g, r, base)));
        if(!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      });
    } else groups.set("__all__", rows);
    if(!core.group && rows.length === 0) groups.set("__all__", []);
    groups.forEach(grp=>{
      const rep = grp[0] || {fields:(rows[0] ? rows[0].fields.map(f=>({t:f.t,n:f.n,v:null})) : [])};
      const aggVals = {};
      aggs.forEach(a=>{ aggVals[a.__id] = aggregate(a, grp, base); });
      outRows.push({row: rep, aggVals, group: grp});
    });
  }

  if(core.having){
    outRows = outRows.filter(o=>truthy(ev(core.having, o.row, Object.assign({}, base, {aggVals:o.aggVals, inAgg:false}))));
  }

  const wins = [];
  items.forEach(it=>collectWins(it.expr, wins));
  if(wins.length){
    outRows.forEach(o=>o.winVals = {});
    wins.forEach(fn=>{
      const parts = new Map();
      outRows.forEach(o=>{
        const key = fn.over.partition ? JSON.stringify(fn.over.partition.map(pe=>ev(pe, o.row, Object.assign({}, base, {aggVals:o.aggVals})))) : "__all__";
        if(!parts.has(key)) parts.set(key, []);
        parts.get(key).push(o);
      });
      parts.forEach(list=>{
        let ordered = list;
        if(fn.over.order){
          ordered = list.slice().sort((a,b)=>cmpBySpecs(fn.over.order, a, b, base));
        }
        const vals = ordered.map(o=>fn.args.length && fn.args[0].k !== "star"
          ? ev(fn.args[0], o.row, Object.assign({}, base, {aggVals:o.aggVals, inAgg:true})) : null);
        ordered.forEach((o, i)=>{
          let v;
          switch(fn.name){
            case "row_number": v = i + 1; break;
            case "rank": { let r = 1; for(let j = 0; j < i; j++) if(cmpBySpecs(fn.over.order || [], ordered[j], o, base) !== 0){ r = j + 2; } 
                           v = rankOf(ordered, i, fn.over.order, base, false); break; }
            case "dense_rank": v = rankOf(ordered, i, fn.over.order, base, true); break;
            case "lag": v = i - (fn.args[1] ? num(ev(fn.args[1], o.row, base)) : 1) >= 0 ? vals[i - (fn.args[1] ? num(ev(fn.args[1], o.row, base)) : 1)] : null; break;
            case "lead": { const k = i + (fn.args[1] ? num(ev(fn.args[1], o.row, base)) : 1); v = k < vals.length ? vals[k] : null; break; }
            case "first_value": v = vals[0]; break;
            case "last_value": v = vals[fn.over.order ? i : vals.length - 1]; break;
            case "count": v = fn.args[0] && fn.args[0].k === "star" ? ordered.length : vals.filter(x=>!isNull(x)).length; break;
            case "sum": case "avg": case "min": case "max": {
              const slice = fn.over.order ? vals.slice(0, i+1) : vals;
              const nn = slice.filter(x=>!isNull(x));
              if(!nn.length){ v = null; break; }
              if(fn.name === "sum") v = nn.reduce((a,b)=>a+num(b),0);
              else if(fn.name === "avg") v = nn.reduce((a,b)=>a+num(b),0)/nn.length;
              else if(fn.name === "min"){ v = nn[0]; nn.forEach(x=>{ if(cmpVals(x,v)<0) v = x; }); }
              else { v = nn[0]; nn.forEach(x=>{ if(cmpVals(x,v)>0) v = x; }); }
              break;
            }
            default: throw new SqlErr("нет оконной функции " + fn.name + "()");
          }
          o.winVals[fn.__wid] = v;
        });
      });
    });
  }

  const cols = items.map((it,i)=>labelOf(it, i));
  const data = outRows.map(o=>{
    const c = Object.assign({}, base, {aggVals:o.aggVals, winVals:o.winVals || {}});
    return {vals: items.map(it=>ev(it.expr, o.row, c)), src: o};
  });
  return {cols, data, items, base};
}
function rankOf(ordered, i, specs, base, dense){
  if(!specs || !specs.length) return 1;
  let rank = 1, seen = 0;
  for(let j = 1; j <= i; j++){
    if(cmpBySpecs(specs, ordered[j-1], ordered[j], base) !== 0){ seen++; rank = dense ? seen + 1 : j + 1; }
  }
  return rank;
}
function emptySample(from, ctx){
  try{ const rows = scan(from, ctx, null); return rows[0] || {fields: sampleFields(from, ctx)}; }
  catch(e){ return {fields:[]}; }
}
function sampleFields(from, ctx){
  if(from.k === "table"){
    const nm = from.name.toLowerCase();
    if(ctx.ctes && ctx.ctes[nm]) return ctx.ctes[nm].cols.map(c=>({t: from.alias || from.name, n:c, v:null}));
    const t = tableRows(ctx.db, nm);
    return t.cols.map(c=>({t: from.alias || t.name, n:c[0], v:null}));
  }
  if(from.k === "join") return sampleFields(from.left, ctx).concat(sampleFields(from.right, ctx));
  if(from.k === "subq"){ const r = runSelect(from.sub, ctx, null); return r.cols.map(c=>({t: from.alias || "подзапрос", n:c, v:null})); }
  return [];
}
function cmpBySpecs(specs, a, b, base){
  for(const s of specs){
    const ca = Object.assign({}, base, {aggVals:a.aggVals || {}, winVals:a.winVals || {}});
    const cb = Object.assign({}, base, {aggVals:b.aggVals || {}, winVals:b.winVals || {}});
    const va = ev(s.e, a.row, ca), vb = ev(s.e, b.row, cb);
    let c;
    const an = isNull(va), bn = isNull(vb);
    if(an || bn){
      if(an && bn) c = 0;
      else {
        const nullsFirst = s.nulls ? s.nulls === "first" : (s.dir === "desc");
        c = an ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1);
        return c;
      }
    } else c = cmpVals(va, vb);
    if(c !== 0) return s.dir === "desc" ? -c : c;
  }
  return 0;
}

function runSelect(node, ctx, outerRow){
  const c2 = Object.assign({}, ctx);
  if(node.ctes && node.ctes.length){
    c2.ctes = Object.assign({}, ctx.ctes || {});
    node.ctes.forEach(cte=>{
      if(cte.recursive){
        const seedNode = {k:"select", ctes:[], cores:[cte.sub.cores[0]], ops:[], order:null, limit:null, offset:null};
        let res = runSelect(seedNode, c2, outerRow);
        let cols = cte.cols || res.cols;
        let all = res.rows.slice();
        c2.ctes[cte.name.toLowerCase()] = {cols, rows: all.slice()};
        if(cte.sub.cores.length > 1){
          let work = res.rows.slice();
          for(let iter = 0; iter < 100 && work.length; iter++){
            c2.ctes[cte.name.toLowerCase()] = {cols, rows: work};
            const step = {k:"select", ctes:[], cores:[cte.sub.cores[1]], ops:[], order:null, limit:null, offset:null};
            const r = runSelect(step, c2, outerRow);
            work = r.rows;
            all = all.concat(work);
          }
        }
        c2.ctes[cte.name.toLowerCase()] = {cols, rows: all};
      } else {
        const r = runSelect(cte.sub, c2, outerRow);
        c2.ctes[cte.name.toLowerCase()] = {cols: cte.cols || r.cols, rows: r.rows};
      }
    });
  }

  let first = runCore(node.cores[0], c2, outerRow);
  let cols = first.cols;
  let data = first.data;

  if(node.cores.length > 1){
    let acc = data.map(d=>d.vals);
    for(let i = 1; i < node.cores.length; i++){
      const r = runCore(node.cores[i], c2, outerRow);
      if(r.cols.length !== cols.length) throw new SqlErr("наборы столбцов в UNION/EXCEPT/INTERSECT должны совпадать по количеству");
      const b = r.data.map(d=>d.vals);
      const op = node.ops[i-1];
      const key = v => JSON.stringify(v);
      if(op.op === "union"){
        acc = acc.concat(b);
        if(!op.all){ const seen = new Set(); acc = acc.filter(v=>{ const k = key(v); if(seen.has(k)) return false; seen.add(k); return true; }); }
      } else if(op.op === "except"){
        const bs = new Set(b.map(key));
        acc = acc.filter(v=>!bs.has(key(v)));
        if(!op.all){ const seen = new Set(); acc = acc.filter(v=>{ const k = key(v); if(seen.has(k)) return false; seen.add(k); return true; }); }
      } else {
        const bs = new Set(b.map(key));
        acc = acc.filter(v=>bs.has(key(v)));
        if(!op.all){ const seen = new Set(); acc = acc.filter(v=>{ const k = key(v); if(seen.has(k)) return false; seen.add(k); return true; }); }
      }
    }
    data = acc.map(vals=>({vals, src:{row:{fields: cols.map((c,i)=>({t:null, n:c, v:vals[i]}))}, aggVals:{}, winVals:{}}}));
  }

  if(node.cores[0].distinct){
    const seen = new Set();
    data = data.filter(d=>{ const k = JSON.stringify(d.vals); if(seen.has(k)) return false; seen.add(k); return true; });
  }

  if(node.order){
    const base = first.base;
    const withAlias = data.map(d=>({
      row: {fields: cols.map((c,i)=>({t:null, n:c, v:d.vals[i], pri:true})).concat(d.src.row.fields)},
      aggVals: d.src.aggVals, winVals: d.src.winVals || {}, d
    }));
    const specs = node.order.map(s=>{
      if(s.e.k === "num"){ const idx = s.e.v - 1;
        if(idx < 0 || idx >= cols.length) throw new SqlErr("ORDER BY " + s.e.v + ": нет такого столбца в выборке");
        return {e:{k:"col", table:null, name: cols[idx]}, dir:s.dir, nulls:s.nulls}; }
      return s;
    });
    withAlias.sort((a,b)=>cmpBySpecs(specs, a, b, base));
    data = withAlias.map(x=>x.d);
  }

  let off = node.offset ? num(ev(node.offset, {fields:[]}, c2)) : 0;
  let lim = node.limit ? num(ev(node.limit, {fields:[]}, c2)) : null;
  if(off) data = data.slice(off);
  if(lim !== null) data = data.slice(0, lim);

  return {cols, rows: data.map(d=>d.vals)};
}

/* ---------- ограничения ---------- */
function checkConstraints(db, t, vals, exceptIdx){
  const cons = t.cons || {};
  (cons.notnull || []).forEach(c=>{
    const i = colIndex(t, c);
    if(i >= 0 && isNull(vals[i])) throw new SqlErr('нарушено NOT NULL для столбца "' + c + '" таблицы "' + t.name + '"');
  });
  const uniques = [];
  if(cons.pk && cons.pk.length) uniques.push(cons.pk);
  (cons.unique || []).forEach(u=>uniques.push(u));
  uniques.forEach(u=>{
    const idxs = u.map(c=>colIndex(t, c));
    if(idxs.some(i=>i < 0)) return;
    const key = idxs.map(i=>JSON.stringify(vals[i])).join("|");
    t.rows.forEach((r, ri)=>{
      if(ri === exceptIdx) return;
      if(idxs.map(i=>JSON.stringify(r[i])).join("|") === key)
        throw new SqlErr('нарушена уникальность: ключ (' + u.join(", ") + ')=(' + idxs.map(i=>vals[i]).join(", ") + ') уже существует в "' + t.name + '"');
    });
  });
  (cons.fk || []).forEach(([col, rt, rc])=>{
    const i = colIndex(t, col);
    if(i < 0 || isNull(vals[i])) return;
    const target = db.tables[rt.toLowerCase()];
    if(!target) return;
    const ri = colIndex(target, rc);
    if(!target.rows.some(r=>eqVals(r[ri], vals[i]) === true))
      throw new SqlErr('нарушен внешний ключ: в "' + rt + '" нет строки с ' + rc + '=' + vals[i]);
  });
  (cons.check || []).forEach(txt=>{
    let e;
    try{ e = parse("select " + txt)[0].cores[0].items[0].expr; }catch(err){ return; }
    const row = {fields: t.cols.map((c,i)=>({t:t.name, n:c[0], v:vals[i]}))};
    const v = ev(e, row, {db});
    if(v === false) throw new SqlErr('нарушено ограничение CHECK (' + txt + ') в таблице "' + t.name + '"');
  });
}
function fkBlocksDelete(db, t, row){
  const idIdx = {};
  Object.values(db.tables).forEach(other=>{
    (other.cons && other.cons.fk || []).forEach(([col, rt, rc])=>{
      if(rt.toLowerCase() !== t.name.toLowerCase()) return;
      const ci = colIndex(other, col), ri = colIndex(t, rc);
      if(ci < 0 || ri < 0) return;
      if(other.rows.some(r=>eqVals(r[ci], row[ri]) === true))
        throw new SqlErr('нельзя удалить: внешний ключ таблицы "' + other.name + '" (столбец ' + col + ') ссылается на эту строку');
    });
  });
}

/* ---------- операторы ---------- */
function execStmt(db, st){
  const ctx = {db};
  if(st.k === "select"){
    const r = runSelect(st, ctx, null);
    return {kind:"rows", cols:r.cols, rows:r.rows, note: r.rows.length + " " + plural(r.rows.length, "строка","строки","строк")};
  }
  if(st.k === "tx"){
    if(st.op === "begin"){ db.tx = JSON.parse(JSON.stringify(db.tables)); return {kind:"msg", message:"BEGIN — транзакция открыта"}; }
    if(st.op === "commit"){ const had = !!db.tx; db.tx = null; return {kind:"msg", message: had ? "COMMIT — изменения зафиксированы" : "COMMIT (транзакция не была открыта)"}; }
    if(db.tx){ db.tables = db.tx; db.tx = null; return {kind:"msg", message:"ROLLBACK — изменения отменены"}; }
    return {kind:"msg", message:"ROLLBACK (транзакция не была открыта)"};
  }
  if(st.k === "explain") return {kind:"rows", cols:["QUERY PLAN"], rows: explain(db, st.stmt).map(l=>[l]), note:"учебный план"};
  if(st.k === "create"){
    const nm = st.name.toLowerCase();
    if(db.tables[nm]){ if(st.ifn) return {kind:"msg", message:"таблица уже существует, пропущено"}; throw new SqlErr('таблица "' + st.name + '" уже существует'); }
    db.tables[nm] = {name: st.name, cols: st.cols, rows: [], cons: st.cons, seq: 0};
    return {kind:"msg", message:"CREATE TABLE — таблица «" + st.name + "» создана"};
  }
  if(st.k === "drop"){
    const nm = st.name.toLowerCase();
    if(!db.tables[nm]){ if(st.ife) return {kind:"msg", message:"таблицы нет, пропущено"}; throw new SqlErr('нет таблицы "' + st.name + '"'); }
    delete db.tables[nm];
    return {kind:"msg", message:"DROP TABLE — таблица удалена"};
  }
  if(st.k === "insert"){
    const t = tableRows(db, st.table);
    const cols = st.cols || t.cols.map(c=>c[0]);
    let rows;
    if(st.sub){ const r = runSelect(st.sub, ctx, null); rows = r.rows; }
    else rows = st.rows.map(r=>r.map(e=>ev(e, {fields:[]}, ctx)));
    const inserted = [];
    rows.forEach(vals=>{
      const full = t.cols.map(c=>{
        const i = cols.findIndex(x=>x.toLowerCase() === c[0].toLowerCase());
        if(i >= 0) return vals[i];
        if(t.cons && t.cons.def && t.cons.def[c[0]]) return ev(t.cons.def[c[0]], {fields:[]}, ctx);
        if(t.cons && t.cons.pkAuto === c[0]) return ++t.seq;
        return null;
      });
      if(st.conflict){
        const target = st.conflict.target || (t.cons && t.cons.pk) || [];
        const idxs = target.map(c=>colIndex(t, c));
        const key = idxs.map(i=>JSON.stringify(full[i])).join("|");
        const hit = t.rows.findIndex(r=>idxs.map(i=>JSON.stringify(r[i])).join("|") === key);
        if(hit >= 0){
          if(st.conflict.action === "nothing") return;
          const row = {fields: t.cols.map((c,i)=>({t:t.name, n:c[0], v:t.rows[hit][i]}))
                                 .concat(t.cols.map((c,i)=>({t:"excluded", n:c[0], v:full[i]})))};
          st.conflict.sets.forEach(s=>{ const ci = colIndex(t, s.col); if(ci >= 0) t.rows[hit][ci] = ev(s.e, row, ctx); });
          checkConstraints(db, t, t.rows[hit], hit);
          inserted.push(t.rows[hit]);
          return;
        }
      }
      checkConstraints(db, t, full, -1);
      t.rows.push(full);
      if(t.cons && t.cons.pkAuto === undefined) t.seq = Math.max(t.seq, 0);
      inserted.push(full);
    });
    if(st.returning) return projectRows(t, inserted, st.returning, ctx);
    return {kind:"msg", message:"INSERT " + inserted.length + " — добавлено " + inserted.length + " " + plural(inserted.length,"строка","строки","строк")};
  }
  if(st.k === "update"){
    const t = tableRows(db, st.table);
    const alias = st.alias || t.name;
    let n = 0;
    const touched = [];
    t.rows.forEach((r, ri)=>{
      const row = {fields: t.cols.map((c,i)=>({t:alias, n:c[0], v:r[i]}))};
      if(st.where && !truthy(ev(st.where, row, ctx))) return;
      const next = r.slice();
      st.sets.forEach(s=>{ const ci = colIndex(t, s.col); if(ci < 0) throw new SqlErr('нет столбца "' + s.col + '"'); next[ci] = ev(s.e, row, ctx); });
      checkConstraints(db, t, next, ri);
      t.rows[ri] = next; n++; touched.push(next);
    });
    if(st.returning) return projectRows(t, touched, st.returning, ctx);
    return {kind:"msg", message:"UPDATE " + n + " — изменено " + n + " " + plural(n,"строка","строки","строк")};
  }
  if(st.k === "delete"){
    const t = tableRows(db, st.table);
    const keep = [], gone = [];
    t.rows.forEach(r=>{
      const row = {fields: t.cols.map((c,i)=>({t:t.name, n:c[0], v:r[i]}))};
      if(st.where && !truthy(ev(st.where, row, ctx))){ keep.push(r); return; }
      fkBlocksDelete(db, t, r);
      gone.push(r);
    });
    t.rows = keep;
    if(st.returning) return projectRows(t, gone, st.returning, ctx);
    return {kind:"msg", message:"DELETE " + gone.length + " — удалено " + gone.length + " " + plural(gone.length,"строка","строки","строк")};
  }
  throw new SqlErr("не умею выполнять " + st.k);
}
function projectRows(t, rows, returning, ctx){
  const sample = {fields: t.cols.map(c=>({t:t.name, n:c[0], v:null}))};
  const items = expandItems(returning, sample);
  const cols = items.map((it,i)=>labelOf(it,i));
  const out = rows.map(r=>{
    const row = {fields: t.cols.map((c,i)=>({t:t.name, n:c[0], v:r[i]}))};
    return items.map(it=>ev(it.expr, row, ctx));
  });
  return {kind:"rows", cols, rows: out, note:"RETURNING · " + out.length + " " + plural(out.length,"строка","строки","строк")};
}
function plural(n, one, few, many){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return many;
  if(b > 1 && b < 5) return few;
  if(b === 1) return one;
  return many;
}

/* ---------- учебный EXPLAIN ---------- */
function explain(db, st){
  const out = [];
  if(st.k !== "select"){ out.push("операция изменения данных"); return out; }
  const core = st.cores[0];
  const push = (d, s) => out.push("  ".repeat(d) + (d ? "->  " : "") + s);
  const cost = n => "(rows=" + n + ")";
  const scanOf = (node, d)=>{
    if(node.k === "table"){
      const t = db.tables[node.name.toLowerCase()];
      const rows = t ? t.rows.length : 0;
      const pk = t && t.cons && t.cons.pk && t.cons.pk[0];
      const usesPk = core.where && pk && JSON.stringify(core.where).includes('"' + pk + '"') &&
                     JSON.stringify(core.where).includes('"="');
      push(d, (usesPk ? "Index Scan using " + node.name + "_pkey on " : "Seq Scan on ") + node.name + " " + cost(usesPk ? 1 : rows));
      if(core.where && !usesPk) push(d+1, "Filter: применяется условие WHERE");
      return;
    }
    if(node.k === "join"){
      push(d, (node.type === "cross" ? "Nested Loop" : "Hash " + (node.type === "inner" ? "Join" : node.type.toUpperCase() + " Join")));
      scanOf(node.left, d+1); scanOf(node.right, d+1);
      return;
    }
    if(node.k === "subq"){ push(d, "Subquery Scan"); return; }
  };
  let d = 0;
  if(st.limit){ push(d, "Limit"); d++; }
  if(st.order){ push(d, "Sort"); push(d+1, "Sort Key: " + st.order.map(o=>o.e.name || "выражение").join(", ")); d++; }
  const hasAgg = [];
  core.items.forEach(it=>collectAggs(it.expr, hasAgg));
  if(core.group || hasAgg.length){ push(d, core.group ? "HashAggregate" : "Aggregate"); if(core.group) push(d+1, "Group Key: " + core.group.map(g=>g.name || "выражение").join(", ")); d++; }
  if(core.from) scanOf(core.from, d); else push(d, "Result");
  out.push("");
  out.push("Это учебный план: он показывает форму дерева и порядок шагов,");
  out.push("а не реальные оценки стоимости планировщика PostgreSQL.");
  return out;
}

/* ---------- точка входа ---------- */
function runSql(db, sql){
  __uid = 0;
  const stmts = parse(sql);
  if(!stmts.length) return [{kind:"msg", message:"пустой запрос"}];
  return stmts.map(st=>execStmt(db, st));
}
