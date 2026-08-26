<script>
"use strict";
/* ============================================================
   Движок техник тест-дизайна
   ============================================================ */
class QErr extends Error{}
const qerr = m => { throw new QErr(m); };

/* ── нормализация пользовательского ввода ──────────────── */
function parseList(src){
  return String(src == null ? "" : src)
    .split(/[,;\n\r\t]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
/* «−1», «- 1», «1 000», «1_000» → -1, 1000 */
function normNum(s){
  const t = String(s).replace(/[−‒–—]/g, "-").replace(/[\s_ ]/g, "").replace(",", ".");
  if(!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
function numSet(src){
  const out = [];
  parseList(src).forEach(s => { const n = normNum(s); if(n !== null && out.indexOf(n) < 0) out.push(n); });
  return out.sort((a, b) => a - b);
}
const strSet = src => {
  const out = [];
  parseList(src).forEach(s => { const k = s.toLowerCase(); if(!out.some(x => x.toLowerCase() === k)) out.push(s); });
  return out;
};

/* ── граничные значения ────────────────────────────────── */
/* step — шаг сетки значений: 1 для целых, 0.01 для денег и т.п. */
function bva(min, max, step){
  const s = step === undefined ? 1 : step;
  const r = n => Math.round(n * 1e6) / 1e6;
  return {
    two:   [r(min - s), min, max, r(max + s)],
    three: [r(min - s), min, r(min + s), r(max - s), max, r(max + s)],
    inner: [min, max],
    outer: [r(min - s), r(max + s)]
  };
}
/* открытый снизу/сверху диапазон: null означает «границы нет» */
function bvaOpen(min, max, step){
  const s = step === undefined ? 1 : step;
  const out = [];
  if(min !== null && min !== undefined){ out.push(min - s, min, min + s); }
  if(max !== null && max !== undefined){ out.push(max - s, max, max + s); }
  return out.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
}

/* ── классы эквивалентности ────────────────────────────── */
/* classes: [{name, valid, test(v)}] — куда попадает значение */
function classifyValue(classes, v){
  for(const c of classes) if(c.test(v)) return c.name;
  return null;
}
function ecpCoverage(classes, values){
  const hit = {}, miss = [];
  classes.forEach(c => hit[c.name] = 0);
  values.forEach(v => { const n = classifyValue(classes, v); if(n) hit[n]++; });
  classes.forEach(c => { if(!hit[c.name]) miss.push(c.name); });
  return {hit, miss, covered: classes.length - miss.length, total: classes.length};
}

/* ── таблица решений ───────────────────────────────────── */
/* conds: ["условие 1", ...]; rules: [{cond:[true,false,...], act:"..."}] */
function decisionRules(nConds){
  const out = [];
  const total = Math.pow(2, nConds);
  for(let i = 0; i < total; i++){
    const row = [];
    for(let b = nConds - 1; b >= 0; b--) row.push(!!(i & (1 << b)));
    out.push(row);
  }
  return out;
}
function decisionAudit(nConds, rules){
  const seen = new Map();
  const dup = [], contra = [];
  rules.forEach((r, i) => {
    const k = r.cond.map(x => x ? "1" : "0").join("");
    if(seen.has(k)){
      const prev = seen.get(k);
      if(prev.act === r.act) dup.push([prev.i, i]); else contra.push([prev.i, i]);
    } else seen.set(k, {i, act: r.act});
  });
  const all = decisionRules(nConds).map(r => r.map(x => x ? "1" : "0").join(""));
  const missing = all.filter(k => !seen.has(k));
  return {missing, dup, contra, complete: missing.length === 0 && contra.length === 0};
}

/* ── переходы состояний ────────────────────────────────── */
/* trans: [{from, ev, to}] */
function smValid(trans){ return trans.map(t => t.from + " --" + t.ev + "--> " + t.to); }
function smInvalid(states, events, trans){
  const has = new Set(trans.map(t => t.from + "|" + t.ev));
  const out = [];
  states.forEach(s => events.forEach(e => { if(!has.has(s + "|" + e)) out.push({from: s, ev: e}); }));
  return out;
}
/* 0-switch: каждый переход хотя бы раз; 1-switch: каждая пара соседних переходов */
function smPairs(trans){
  const out = [];
  trans.forEach(a => trans.forEach(b => { if(a.to === b.from) out.push([a, b]); }));
  return out;
}

/* ── попарное тестирование ─────────────────────────────── */
/* params: [{name, vals:[...]}] → минимальный (жадный) набор, покрывающий все пары */
function allPairs(params){
  const need = new Set();
  for(let i = 0; i < params.length; i++)
    for(let j = i + 1; j < params.length; j++)
      params[i].vals.forEach(a => params[j].vals.forEach(b => need.add(i + ":" + a + "|" + j + ":" + b)));
  return need;
}
function pairwise(params){
  if(params.length < 2) return {rows: params.length ? params[0].vals.map(v => [v]) : [], pairs: 0};
  const need = allPairs(params);
  const totalPairs = need.size;
  const rows = [];
  let guard = 0;
  while(need.size && guard++ < 5000){
    /* жадно строим строку, максимально закрывающую непокрытые пары */
    let best = null, bestGain = -1;
    const cand = [];
    params[0].vals.forEach(v0 => cand.push([v0]));
    let pool = cand;
    for(let p = 1; p < params.length; p++){
      const next = [];
      pool.forEach(row => params[p].vals.forEach(v => next.push(row.concat([v]))));
      pool = next.length > 400 ? next.slice(0, 400) : next;
    }
    pool.forEach(row => {
      let gain = 0;
      for(let i = 0; i < row.length; i++)
        for(let j = i + 1; j < row.length; j++)
          if(need.has(i + ":" + row[i] + "|" + j + ":" + row[j])) gain++;
      if(gain > bestGain){ bestGain = gain; best = row; }
    });
    if(!best || bestGain <= 0) break;
    rows.push(best);
    for(let i = 0; i < best.length; i++)
      for(let j = i + 1; j < best.length; j++)
        need.delete(i + ":" + best[i] + "|" + j + ":" + best[j]);
  }
  const full = params.reduce((a, p) => a * p.vals.length, 1);
  return {rows, pairs: totalPairs, full, saved: full - rows.length};
}
function pairwiseCheck(params, rows){
  const need = allPairs(params);
  rows.forEach(row => {
    for(let i = 0; i < row.length; i++)
      for(let j = i + 1; j < row.length; j++)
        need.delete(i + ":" + row[i] + "|" + j + ":" + row[j]);
  });
  return {missing: Array.from(need), ok: need.size === 0};
}

/* ── сравнение множеств для проверки заданий ───────────── */
function setDiff(got, want, cmp){
  const eq = cmp || ((a, b) => String(a).toLowerCase() === String(b).toLowerCase());
  const missing = want.filter(w => !got.some(g => eq(g, w)));
  const extra = got.filter(g => !want.some(w => eq(g, w)));
  return {missing, extra, exact: missing.length === 0 && extra.length === 0};
}
const hasVal = (got, v, cmp) => got.some(g => (cmp || ((a, b) => String(a).toLowerCase() === String(b).toLowerCase()))(g, v));

/* ── качество баг-репорта ──────────────────────────────── */
const VAGUE = ["не работает","не robotaet","сломалось","некорректно","что-то не так","ошибка","баг","плохо","странно","不"];
function auditBug(f){
  const g = k => String(f && f[k] !== undefined ? f[k] : "").trim();
  const steps = parseList(g("steps").replace(/\n/g, "\n")).length ||
                g("steps").split(/\n/).map(s => s.trim()).filter(Boolean).length;
  const issues = [];
  const title = g("title");
  if(!title) issues.push("нет заголовка");
  else {
    if(title.length < 12) issues.push("заголовок слишком короткий, чтобы понять суть");
    if(VAGUE.some(v => title.toLowerCase() === v || title.toLowerCase() === v + "!")) issues.push("заголовок ничего не сообщает");
    if(title.length > 120) issues.push("заголовок длиннее 120 символов — это уже описание");
  }
  if(steps < 2) issues.push("шагов воспроизведения меньше двух");
  if(!g("expected")) issues.push("не указан ожидаемый результат");
  if(!g("actual")) issues.push("не указан фактический результат");
  if(g("expected") && g("actual") && g("expected").toLowerCase() === g("actual").toLowerCase())
    issues.push("ожидаемый и фактический результат совпадают");
  if(!g("env")) issues.push("не указано окружение");
  if(!g("severity")) issues.push("не указана серьёзность");
  return {
    issues,
    steps,
    ok: issues.length === 0,
    score: Math.max(0, 7 - issues.length)
  };
}

/* ── severity против priority ──────────────────────────── */
const SEV = ["blocker","critical","major","minor","trivial"];
const PRI = ["highest","high","medium","low"];
