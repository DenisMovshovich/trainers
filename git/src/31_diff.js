
/* ============================================================
   Построчное сравнение и трёхстороннее слияние
   ============================================================ */
const lines = s => s === undefined || s === null ? [] : String(s).split("\n");
const join = a => a.join("\n");

/* наибольшая общая подпоследовательность — основа и diff, и merge */
function lcs(a, b){
  const n = a.length, m = b.length;
  const d = [];
  for(let i = 0; i <= n; i++) d.push(new Array(m + 1).fill(0));
  for(let i = n - 1; i >= 0; i--)
    for(let j = m - 1; j >= 0; j--)
      d[i][j] = a[i] === b[j] ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while(i < n && j < m){
    if(a[i] === b[j]){ out.push({k:" ", v:a[i]}); i++; j++; }
    else if(d[i + 1][j] >= d[i][j + 1]){ out.push({k:"-", v:a[i]}); i++; }
    else { out.push({k:"+", v:b[j]}); j++; }
  }
  while(i < n) out.push({k:"-", v:a[i++]});
  while(j < m) out.push({k:"+", v:b[j++]});
  return out;
}

/* унифицированный формат с контекстом в три строки */
function unified(path, oldS, newS){
  const A = lines(oldS), B = lines(newS);
  const ops = lcs(A, B);
  if(!ops.some(o => o.k !== " ")) return [];
  const out = [];
  out.push("diff --git a/" + path + " b/" + path);
  if(oldS === null || oldS === undefined) out.push("new file mode 100644");
  if(newS === null || newS === undefined) out.push("deleted file mode 100644");
  out.push("--- " + (oldS === null || oldS === undefined ? "/dev/null" : "a/" + path));
  out.push("+++ " + (newS === null || newS === undefined ? "/dev/null" : "b/" + path));

  /* собрать куски: изменения плюс три строки контекста вокруг */
  const keep = ops.map(o => o.k !== " ");
  for(let i = 0; i < ops.length; i++)
    if(ops[i].k !== " ")
      for(let j = Math.max(0, i - 3); j <= Math.min(ops.length - 1, i + 3); j++) keep[j] = true;

  let oi = 0, ni = 0, k = 0;
  while(k < ops.length){
    if(!keep[k]){ if(ops[k].k !== "+") oi++; if(ops[k].k !== "-") ni++; k++; continue; }
    const os = oi + 1, ns = ni + 1, body = [];
    let oc = 0, nc = 0;
    while(k < ops.length && keep[k]){
      const o = ops[k];
      body.push(o.k + o.v);
      if(o.k !== "+"){ oi++; oc++; }
      if(o.k !== "-"){ ni++; nc++; }
      k++;
    }
    out.push("@@ -" + os + "," + oc + " +" + ns + "," + nc + " @@");
    for(const b of body) out.push(b);
  }
  return out;
}
const changed = (a, b) => (a === undefined ? null : a) !== (b === undefined ? null : b);

/* Трёхстороннее слияние по строкам. Возвращает {text, conflict}. */
function merge3(base, ours, theirs){
  const O = lines(base), A = lines(ours), B = lines(theirs);
  const da = lcs(O, A), db = lcs(O, B);

  /* разложить каждую сторону по позициям в базе */
  const spread = ops => {
    const at = [];                     /* at[i] — что вставлено ПЕРЕД строкой i базы */
    const rep = [];                    /* rep[i] — чем заменена строка i базы (null = удалена) */
    for(let i = 0; i <= O.length; i++) at.push([]);
    for(let i = 0; i < O.length; i++) rep.push(undefined);
    let i = 0, pend = [];
    for(const o of ops){
      if(o.k === "+"){ pend.push(o.v); continue; }
      if(o.k === " "){ at[i] = at[i].concat(pend); pend = []; rep[i] = O[i]; i++; continue; }
      /* "-" — строка базы удалена или заменена накопленными вставками */
      if(pend.length){ rep[i] = join(pend); pend = []; }
      else rep[i] = null;
      i++;
    }
    at[O.length] = at[O.length].concat(pend);
    return {at, rep};
  };
  const a = spread(da), b = spread(db);

  const out = [];
  let conflict = false;
  const both = (x, y) => join(x) === join(y);

  for(let i = 0; i <= O.length; i++){
    /* вставки перед строкой i */
    const ia = a.at[i], ib = b.at[i];
    if(ia.length && ib.length && !both(ia, ib)){
      conflict = true;
      out.push("<<<<<<< HEAD");
      for(const l of ia) out.push(l);
      out.push("=======");
      for(const l of ib) out.push(l);
      out.push(">>>>>>> theirs");
    } else {
      for(const l of (ia.length ? ia : ib)) out.push(l);
    }
    if(i === O.length) break;

    /* судьба строки i */
    const ra = a.rep[i], rb = b.rep[i];
    const ca = ra !== O[i], cb = rb !== O[i];
    if(ca && cb && ra !== rb){
      conflict = true;
      out.push("<<<<<<< HEAD");
      if(ra !== null && ra !== undefined) for(const l of lines(ra)) out.push(l);
      out.push("=======");
      if(rb !== null && rb !== undefined) for(const l of lines(rb)) out.push(l);
      out.push(">>>>>>> theirs");
    } else {
      const r = ca ? ra : rb;
      if(r !== null && r !== undefined) for(const l of lines(r)) out.push(l);
    }
  }
  return {text: join(out), conflict};
}
