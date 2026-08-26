<script>
/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const KEY = "sql.v1";

/* ── прогресс ─────────────────────────────────────────── */
let P = {mod:0, quiz:{}, labs:{}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };

/* ── состояние базы ───────────────────────────────────── */
const ST = {db: newDb(), log: []};
const resetDb = () => { ST.db = newDb(); ST.log.length = 0; renderSchema(); status("база возвращена в исходное состояние"); };

/* ── детерминированное перемешивание вариантов ────────── */
function fnv(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffled(q){
  const seed = fnv(q.q);
  const idx = q.opts.map((_,i)=>i);
  let s = seed || 1;
  for(let i = idx.length - 1; i > 0; i--){
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = (s >>> 15) % (i + 1);
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  return idx;
}

/* ── шапка и навигация ────────────────────────────────── */
const nav = $("#nav");
MODULES.forEach((m, i) => {
  const b = el("button", "", '<span class="num">' + m.n + '</span><span>' + m.title + '</span><span class="dot"></span>');
  b.type = "button";
  b.addEventListener("click", () => go(i));
  nav.appendChild(b);
});

function modDone(m){
  const q = m.quiz.every((_, i) => (P.quiz[m.id + ":" + i] || {}).ok);
  const l = m.labs.every(x => P.labs[x.id]);
  return q && l;
}
function meter(){
  let done = 0, all = 0;
  MODULES.forEach(m => {
    m.quiz.forEach((_, i) => { all++; if((P.quiz[m.id + ":" + i] || {}).ok) done++; });
    m.labs.forEach(x => { all++; if(P.labs[x.id]) done++; });
  });
  $("#mtxt").textContent = done + " / " + all;
  $("#mbar").style.width = (all ? Math.round(done / all * 100) : 0) + "%";
  [].forEach.call(nav.children, (b, i) => b.classList.toggle("done", modDone(MODULES[i])));
}

let cur = 0, tab = "theory";
function go(i){
  cur = i; P.mod = i; save();
  const m = MODULES[i];
  [].forEach.call(nav.children, (b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
  $("#msub").textContent = "Модуль " + m.n + " · " + m.sub;
  $("#mttl").textContent = m.title;
  $("#mlede").textContent = m.lede;
  $("#cq").textContent = m.quiz.length;
  $("#cl").textContent = m.labs.length;
  $("#ctx").textContent = "модуль " + m.n;
  renderTheory(m); renderQuiz(m); renderLabs(m); renderChips(m);
  meter();
  const active = nav.children[i];
  if(active && active.scrollIntoView) active.scrollIntoView({block:"nearest", inline:"nearest"});
  window.scrollTo({top:0, behavior:"instant" in window ? "auto" : "auto"});
}

$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if(!b) return;
  tab = b.dataset.tab;
  [].forEach.call($("#tabs").children, x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  ["theory","quiz","labs"].forEach(t => $("#pane-" + t).hidden = (t !== tab));
});

/* ── теория ───────────────────────────────────────────── */
function renderTheory(m){ $("#pane-theory").innerHTML = m.theory; }

/* ── тесты ────────────────────────────────────────────── */
function renderQuiz(m){
  const pane = $("#pane-quiz"); pane.innerHTML = "";
  const sum = el("div", "qsum");
  pane.appendChild(sum);
  m.quiz.forEach((q, qi) => {
    const key = m.id + ":" + qi;
    const order = shuffled(q);
    const card = el("div", "qc");
    const head = el("div", "qq", '<span class="qn">' + (qi + 1) + '</span><span class="qt">' + q.q + '</span>');
    const opts = el("div", "qo");
    card.appendChild(head); card.appendChild(opts);
    const why = el("div", "qw", '<span class="lbl">Почему</span>' + q.why);
    why.hidden = true;
    card.appendChild(why);
    const btns = [];
    order.forEach((orig, pos) => {
      const b = el("button", "", '<span class="ltr">' + "ABCD"[pos] + '</span><span>' + q.opts[orig] + '</span>');
      b.type = "button"; b.dataset.orig = orig;
      b.addEventListener("click", () => answer(orig));
      opts.appendChild(b); btns.push(b);
    });
    function paint(chosen){
      btns.forEach(b => {
        const o = +b.dataset.orig;
        b.disabled = true;
        b.classList.toggle("good", o === q.a);
        b.classList.toggle("bad", o === chosen && o !== q.a);
      });
      why.hidden = false;
      card.classList.add(chosen === q.a ? "right" : "wrong");
    }
    function answer(chosen){
      if(P.quiz[key]) return;
      P.quiz[key] = {ok: chosen === q.a, pick: chosen};
      save(); paint(chosen); tally(); meter();
    }
    if(P.quiz[key]) paint(P.quiz[key].pick);
    pane.appendChild(card);
  });
  function tally(){
    let done = 0, ok = 0;
    m.quiz.forEach((_, i) => { const r = P.quiz[m.id + ":" + i]; if(r){ done++; if(r.ok) ok++; } });
    sum.innerHTML = "отвечено <b>" + done + "</b> из <b>" + m.quiz.length + "</b> · верно <b>" + ok + "</b>";
  }
  tally();
}

/* ── задания ──────────────────────────────────────────── */
const labNodes = [];
function renderLabs(m){
  const pane = $("#pane-labs"); pane.innerHTML = ""; labNodes.length = 0;
  m.labs.forEach(lab => {
    const card = el("div", "lab");
    const head = el("div", "labh",
      '<span class="id">' + lab.id + '</span><span class="nm">' + lab.title + '</span><span class="st"></span>');
    const body = el("div", "labb", lab.brief.replace(/^\s*<h3>[\s\S]*?<\/h3>/, ""));
    const list = el("ul", "chk");
    lab.checks.forEach(c => {
      const li = el("li", "", '<span class="bx">✓</span><span>' + c.label + '</span>');
      list.appendChild(li);
    });
    body.appendChild(list);
    const act = el("div", "labact");
    const hb = el("button", "btn", "Подсказка"); hb.type = "button";
    const hint = el("div", "hintbox", lab.hint); hint.hidden = true;
    hb.addEventListener("click", () => { hint.hidden = !hint.hidden; });
    act.appendChild(hb);
    const done = el("div", "lab-done", '<span>✓</span><span>задание выполнено</span>');
    done.hidden = true;
    card.appendChild(head); card.appendChild(body); card.appendChild(act); card.appendChild(hint); card.appendChild(done);
    pane.appendChild(card);
    labNodes.push({lab, card, head, list, done});
  });
  scoreLabs();
}

function evalCheck(c){ try{ return !!c.test(ST); }catch(e){ return false; } }

function scoreLabs(){
  let changed = false;
  MODULES.forEach(m => m.labs.forEach(lab => {
    const hits = P.labs[lab.id] ? lab.checks.map(()=>true) : lab.checks.map(evalCheck);
    const all = hits.every(Boolean);
    if(all && !P.labs[lab.id]){ P.labs[lab.id] = true; changed = true; }
    lab.__hits = P.labs[lab.id] ? lab.checks.map(()=>true) : hits;
  }));
  if(changed) save();
  labNodes.forEach(n => {
    const hits = n.lab.__hits || [];
    const got = hits.filter(Boolean).length;
    [].forEach.call(n.list.children, (li, i) => li.classList.toggle("hit", !!hits[i]));
    n.head.querySelector(".st").textContent = got + " / " + n.lab.checks.length;
    const ok = got === n.lab.checks.length;
    n.card.classList.toggle("done", ok);
    n.done.hidden = !ok;
  });
  meter();
}

/* ── обозреватель схемы ───────────────────────────────── */
function renderSchema(){
  const box = $("#sch"); box.innerHTML = "";
  const names = Object.keys(ST.db.tables);
  if(!names.length){ box.appendChild(el("div", "", '<p style="padding:9px 11px;margin:0;font-size:12px;color:var(--ink3)">таблиц нет</p>')); return; }
  names.forEach((name, i) => {
    const t = ST.db.tables[name];
    const d = el("details");
    if(i < 3) d.open = true;
    const cons = t.cons || {};
    const pk = new Set(cons.pk || []);
    const nn = new Set(cons.notnull || []);
    const fk = new Map((cons.fk || []).map(f => [f[0], f[1]]));
    d.appendChild(el("summary", "", '<span>' + name + '</span><span class="n">' + t.rows.length + '</span>'));
    const dl = el("dl");
    t.cols.forEach(c => {
      const badges = [];
      if(pk.has(c[0])) badges.push('<span class="kb pk">PK</span>');
      if(fk.has(c[0])) badges.push('<span class="kb fk" title="→ ' + fk.get(c[0]) + '">FK</span>');
      if(!pk.has(c[0]) && nn.has(c[0])) badges.push('<span class="kb nn">NN</span>');
      dl.appendChild(el("div", "row",
        '<span class="cn">' + c[0] + '</span>' + badges.join("") + '<span class="ct">' + c[1] + '</span>'));
    });
    d.appendChild(dl);
    box.appendChild(d);
  });
}

/* ── консоль ──────────────────────────────────────────── */
const outBox = $("#out"), sqlBox = $("#sql");
function status(t){ $("#dst").textContent = t; }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function renderResult(r, err){
  outBox.innerHTML = "";
  if(err){ outBox.appendChild(el("div", "err", esc(err))); return; }
  if(!r){ outBox.appendChild(el("p", "empty", "нет результата")); return; }
  if(r.kind !== "rows"){ outBox.appendChild(el("div", "msg", esc(r.message || "готово"))); return; }
  if(!r.cols || !r.cols.length){ outBox.appendChild(el("div", "msg", esc(r.note || "готово"))); return; }
  const tb = el("table");
  const tr = el("tr");
  r.cols.forEach(c => tr.appendChild(el("th", "", esc(c))));
  tb.appendChild(tr);
  r.rows.slice(0, 200).forEach(row => {
    const t = el("tr");
    row.forEach(v => {
      const td = el("td", "", v === null || v === undefined ? "NULL" : esc(v));
      if(v === null || v === undefined) td.className = "nul";
      else if(typeof v === "number") td.className = "num";
      t.appendChild(td);
    });
    tb.appendChild(t);
  });
  outBox.appendChild(tb);
  let note = r.note || (r.rows.length + "");
  if(r.rows.length > 200) note += " · показаны первые 200";
  outBox.appendChild(el("div", "note", note));
}

function run(){
  const sql = sqlBox.value.trim();
  if(!sql){ status("пустой запрос"); return; }
  let res = null, err = null;
  try{
    const out = runSql(ST.db, sql);
    res = out[out.length - 1];
  }catch(e){ err = e && e.message ? e.message : String(e); }
  ST.log.push({sql, res, err});
  if(ST.log.length > 400) ST.log.splice(0, ST.log.length - 400);
  renderResult(res, err);
  status(err ? "ошибка" : (res && res.kind === "rows" ? (res.note || "готово") : (res && res.message) || "готово"));
  renderSchema();
  scoreLabs();
}
$("#run").addEventListener("click", run);
sqlBox.addEventListener("keydown", e => {
  if((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); run(); }
});
$("#reset").addEventListener("click", resetDb);

const CHIPS = {
  select:["SELECT * FROM customers;","SELECT name, city FROM customers;","SELECT count(*) FROM orders;"],
  where:["SELECT * FROM products WHERE price < 10000;","SELECT * FROM orders WHERE status IN ('оформлен','в пути');"],
  null:["SELECT * FROM customers WHERE city IS NULL;","SELECT count(*), count(city) FROM customers;"],
  order:["SELECT title, price FROM products ORDER BY price DESC LIMIT 3;","SELECT DISTINCT category FROM products;"],
  agg:["SELECT category, count(*) FROM products GROUP BY category;","SELECT customer_id, count(*) FROM orders GROUP BY customer_id HAVING count(*) > 1;"],
  join:["SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id;","SELECT c.name, count(o.id) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name;"],
  sub:["SELECT * FROM products WHERE price > (SELECT avg(price) FROM products);","SELECT * FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);"],
  cte:["WITH t AS (SELECT category, count(*) AS n FROM products GROUP BY category) SELECT * FROM t WHERE n > 1;","SELECT id FROM customers EXCEPT SELECT customer_id FROM orders;"],
  win:["SELECT title, category, price, rank() OVER (PARTITION BY category ORDER BY price DESC) AS r FROM products;"],
  dml:["INSERT INTO customers (id, name, email, city) VALUES (9, 'Анна', 'anna@example.com', 'Казань') RETURNING id;","BEGIN;"],
  ddl:["CREATE TABLE reviews (id integer PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id), author text NOT NULL, rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5));"],
  perf:["EXPLAIN SELECT * FROM orders WHERE customer_id = 3;","EXPLAIN SELECT customer_id, count(*) FROM orders GROUP BY customer_id ORDER BY count(*) DESC;"]
};
function renderChips(m){
  const box = $("#chips"); box.innerHTML = "";
  (CHIPS[m.id] || []).forEach(q => {
    const b = el("button", "", esc(q.length > 62 ? q.slice(0, 60) + "…" : q));
    b.type = "button"; b.title = q;
    b.addEventListener("click", () => { sqlBox.value = q; sqlBox.focus(); });
    box.appendChild(b);
  });
}

/* ── тема и сброс ─────────────────────────────────────── */
$("#theme").addEventListener("click", () => {
  const r = document.documentElement;
  const now = r.getAttribute("data-theme");
  const dark = now ? now === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  r.setAttribute("data-theme", dark ? "light" : "dark");
  try{ localStorage.setItem(KEY + ".theme", dark ? "light" : "dark"); }catch(e){}
});
try{ const t = localStorage.getItem(KEY + ".theme"); if(t) document.documentElement.setAttribute("data-theme", t); }catch(e){}

$("#wipe").addEventListener("click", () => {
  P = {mod:0, quiz:{}, labs:{}};
  MODULES.forEach(m => m.labs.forEach(l => { delete l.__hits; }));
  save(); resetDb(); go(cur);
  status("прогресс сброшен");
});

/* ── высота консоли ───────────────────────────────────── */
function dockH(){
  const d = document.querySelector(".dock");
  if(d) document.documentElement.style.setProperty("--dockh", d.offsetHeight + "px");
}
if(window.ResizeObserver){ const ro = new ResizeObserver(dockH); ro.observe(document.querySelector(".dock")); }
window.addEventListener("resize", dockH);
dockH();

/* ── старт ────────────────────────────────────────────── */
renderSchema();
go(Math.min(Math.max(P.mod | 0, 0), MODULES.length - 1));
status("готов");
})();
</script>
