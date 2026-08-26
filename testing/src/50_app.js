<script>
/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "testing.v1";

let P = {mod:0, quiz:{}, labs:{}, ans:{}, tools:{bva:0, pw:0, sev:0}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
P.ans = P.ans || {}; P.tools = P.tools || {bva:0, pw:0, sev:0};
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };
const ST = {ans: P.ans, tools: P.tools};

function fnv(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffled(q){
  const idx = q.opts.map((_,i)=>i);
  let s = fnv(q.q) || 1;
  for(let i = idx.length - 1; i > 0; i--){
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = (s >>> 15) % (i + 1);
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  return idx;
}

/* ── навигация ────────────────────────────────────────── */
const nav = $("#nav");
MODULES.forEach((m, i) => {
  const b = el("button", "", '<span class="num">' + m.n + '</span><span>' + m.title + '</span><span class="dot"></span>');
  b.type = "button";
  b.addEventListener("click", () => go(i));
  nav.appendChild(b);
});
const modDone = m => m.quiz.every((_, i) => (P.quiz[m.id + ":" + i] || {}).ok) && m.labs.every(x => P.labs[x.id]);
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
let cur = 0;
function go(i){
  cur = i; P.mod = i; save();
  const m = MODULES[i];
  [].forEach.call(nav.children, (b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
  $("#mno").textContent = (m.n < 10 ? "0" : "") + m.n + " ";
  $("#msub").textContent = m.sub;
  $("#mttl").textContent = m.title;
  $("#mlede").textContent = m.lede;
  $("#cq").textContent = m.quiz.length;
  $("#cl").textContent = m.labs.length;
  $("#ci").textContent = m.iv.length;
  $("#pane-theory").innerHTML = m.theory;
  renderQuiz(m); renderLabs(m); renderIv(m); meter();
  const a = nav.children[i];
  if(a && a.scrollIntoView) a.scrollIntoView({block:"nearest", inline:"nearest"});
  window.scrollTo(0, 0);
}
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if(!b) return;
  [].forEach.call($("#tabs").children, x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  ["theory","quiz","labs","iv"].forEach(t => $("#pane-" + t).hidden = (t !== b.dataset.tab));
  const y = $("#tabs").getBoundingClientRect().top + window.pageYOffset - 104;
  if(window.pageYOffset > y) window.scrollTo(0, Math.max(0, y));
});

/* ── тесты ────────────────────────────────────────────── */
function renderQuiz(m){
  const pane = $("#pane-quiz"); pane.innerHTML = "";
  const sum = el("div", "qsum"); pane.appendChild(sum);
  m.quiz.forEach((q, qi) => {
    const key = m.id + ":" + qi;
    const card = el("div", "qc");
    card.appendChild(el("div", "qq", '<span class="qn">' + (qi + 1) + '</span><span class="qt">' + q.q + '</span>'));
    const opts = el("div", "qo"); card.appendChild(opts);
    const why = el("div", "qw", '<span class="lbl">Почему</span>' + q.why); why.hidden = true; card.appendChild(why);
    const btns = [];
    shuffled(q).forEach((orig, pos) => {
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
    let d = 0, ok = 0;
    m.quiz.forEach((_, i) => { const r = P.quiz[m.id + ":" + i]; if(r){ d++; if(r.ok) ok++; } });
    sum.innerHTML = "отвечено <b>" + d + "</b> из <b>" + m.quiz.length + "</b> · верно <b>" + ok + "</b>";
  }
  tally();
}

/* ── упражнения ───────────────────────────────────────── */
function buildEx(lab){
  const ex = lab.ex, id = lab.id, box = el("div", "ex");
  const done = () => { save(); scoreLabs(); };
  if(ex.kind === "values"){
    box.appendChild(el("p", "exh lbl", "Ваш ответ — через запятую"));
    const inp = el("input"); inp.type = "text"; inp.placeholder = ex.placeholder || "";
    inp.value = ST.ans[id] || "";
    inp.addEventListener("input", () => { ST.ans[id] = inp.value; done(); });
    box.appendChild(inp);
    if(ex.tool) box.appendChild(el("p", "exhint", ex.tool));
  } else if(ex.kind === "classify"){
    box.appendChild(el("p", "exh lbl", "Выберите категорию для каждого пункта"));
    ST.ans[id] = ST.ans[id] || {};
    ex.items.forEach((it, i) => {
      const row = el("div", "exrow");
      row.appendChild(el("span", "it", it));
      const sel = el("select");
      sel.appendChild(el("option", "", "— выберите —"));
      ex.options.forEach(o => { const op = el("option", "", esc(o)); op.value = o; sel.appendChild(op); });
      sel.value = ST.ans[id][i] || "";
      sel.addEventListener("change", () => { ST.ans[id][i] = sel.value; done(); });
      row.appendChild(sel);
      box.appendChild(row);
    });
  } else if(ex.kind === "pick"){
    box.appendChild(el("p", "exh lbl", "Отметьте подходящие пункты"));
    ST.ans[id] = ST.ans[id] || {};
    const list = el("div", "expick");
    ex.items.forEach((it, i) => {
      const lb = el("label");
      const cb = el("input"); cb.type = "checkbox"; cb.checked = !!ST.ans[id][i];
      cb.addEventListener("change", () => { ST.ans[id][i] = cb.checked; done(); });
      lb.appendChild(cb); lb.appendChild(el("span", "", it));
      list.appendChild(lb);
    });
    box.appendChild(list);
  } else if(ex.kind === "fields"){
    ST.ans[id] = ST.ans[id] || {};
    const form = el("div", "exf");
    ex.fields.forEach(f => {
      const [name, label, type] = f;
      const wrap = el("div", "ff");
      wrap.appendChild(el("span", "", label));
      let ctl;
      if(type === "area"){ ctl = el("textarea"); ctl.spellcheck = false; }
      else if(String(type).indexOf("select:") === 0){
        ctl = el("select");
        ctl.appendChild(el("option", "", "— выберите —"));
        String(type).slice(7).split(",").forEach(o => { const op = el("option", "", esc(o)); op.value = o; ctl.appendChild(op); });
      } else { ctl = el("input"); ctl.type = "text"; }
      ctl.value = ST.ans[id][name] || "";
      const ev = ctl.tagName === "SELECT" ? "change" : "input";
      ctl.addEventListener(ev, () => { ST.ans[id][name] = ctl.value; done(); });
      wrap.appendChild(ctl);
      form.appendChild(wrap);
    });
    box.appendChild(form);
  }
  return box;
}

const labNodes = [];
function renderLabs(m){
  const pane = $("#pane-labs"); pane.innerHTML = ""; labNodes.length = 0;
  m.labs.forEach(lab => {
    const card = el("div", "lab");
    const head = el("div", "labh",
      '<span class="id">' + lab.id + '</span><span class="nm">' + lab.title + '</span><span class="st"></span>');
    const body = el("div", "labb", lab.brief);
    body.appendChild(buildEx(lab));
    const list = el("ul", "chk");
    lab.checks.forEach(c => list.appendChild(el("li", "", '<span class="bx">✓</span><span>' + c.label + '</span>')));
    body.appendChild(list);
    const act = el("div", "labact");
    const hb = el("button", "btn", "Подсказка"); hb.type = "button";
    const hint = el("div", "hintbox", lab.hint); hint.hidden = true;
    hb.addEventListener("click", () => { hint.hidden = !hint.hidden; });
    act.appendChild(hb);
    const done = el("div", "lab-done", "<span>✓</span><span>задание выполнено</span>"); done.hidden = true;
    card.appendChild(head); card.appendChild(body); card.appendChild(act); card.appendChild(hint); card.appendChild(done);
    pane.appendChild(card);
    labNodes.push({lab, card, head, list, done});
  });
  scoreLabs();
}
function scoreLabs(){
  let changed = false;
  MODULES.forEach(m => m.labs.forEach(lab => {
    const hits = lab.checks.map(c => { try{ return !!c.test(ST); }catch(e){ return false; } });
    if(hits.every(Boolean) && !P.labs[lab.id]){ P.labs[lab.id] = true; changed = true; }
    lab.__hits = hits;
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

/* ── собеседование ────────────────────────────────────── */
function renderIv(m){
  const pane = $("#pane-iv"); pane.innerHTML = "";
  m.iv.forEach((c, i) => {
    const card = el("div", "ivc");
    const q = el("div", "ivq",
      '<span class="qn">' + (i + 1) + '</span><span class="qt">' + c.q + '</span><span class="tog">показать</span>');
    const body = el("div", "ivb");
    body.appendChild(el("div", "ivp", "<b>Что проверяют</b>" + c.probe));
    body.appendChild(el("div", "iva", c.a));
    if(c.more && c.more.length)
      body.appendChild(el("div", "ivm", "<b>Уточняющие вопросы, которые последуют</b><ul>" +
        c.more.map(x => "<li>" + x + "</li>").join("") + "</ul>"));
    body.hidden = true;
    q.addEventListener("click", () => {
      body.hidden = !body.hidden;
      q.querySelector(".tog").textContent = body.hidden ? "показать" : "скрыть";
    });
    card.appendChild(q); card.appendChild(body);
    pane.appendChild(card);
  });
}

/* ── глоссарий ────────────────────────────────────────── */
function renderGlossary(filter){
  const box = $("#gl"); box.innerHTML = "";
  const f = String(filter || "").trim().toLowerCase();
  const rows = GLOSSARY.filter(g => !f || g[0].toLowerCase().indexOf(f) >= 0 || g[1].toLowerCase().indexOf(f) >= 0);
  $("#gn").textContent = rows.length + (f ? " / " + GLOSSARY.length : "");
  if(!rows.length){ box.appendChild(el("p", "none", "ничего не найдено")); return; }
  rows.forEach(g => {
    const d = el("details");
    d.appendChild(el("summary", "", esc(g[0])));
    d.appendChild(el("div", "gd", g[1] + (g[2] ? '<span class="gt">' + g[2] + "</span>" : "")));
    box.appendChild(d);
  });
}
$("#gsearch").addEventListener("input", e => renderGlossary(e.target.value));

/* ── инструменты ──────────────────────────────────────── */
$("#dtabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-d]"); if(!b) return;
  [].forEach.call($("#dtabs").children, x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  ["bva","pw","sev"].forEach(t => $("#t-" + t).hidden = (t !== b.dataset.d));
  if(b.dataset.d === "sev"){ renderSev(); ST.tools.sev++; save(); }
});
const numIn = v => { const n = normNum(v); return n === null ? null : n; };
$("#brun").addEventListener("click", () => {
  const out = $("#bout"); out.innerHTML = "";
  const mn = numIn($("#bmin").value), mx = numIn($("#bmax").value), step = Number($("#bstep").value);
  if(mn === null || mx === null){ out.appendChild(el("p", "empty", "минимум и максимум должны быть числами")); return; }
  if(mx < mn){ out.appendChild(el("p", "empty", "максимум меньше минимума")); return; }
  const r = bva(mn, mx, step);
  const fmt = a => a.join(", ");
  out.appendChild(el("pre", "",
    "диапазон        " + mn + " … " + mx + "   шаг " + step + "\n\n" +
    "две точки       " + fmt(r.two) + "\n" +
    "три точки       " + fmt(r.three) + "\n\n" +
    "внутри границ   " + fmt(r.inner) + "   → ожидается принятие\n" +
    "снаружи границ  " + fmt(r.outer) + "   → ожидается отказ\n\n" +
    "не забудьте классы, не являющиеся числами:\n" +
    "пустое значение, буквы, дробное, отрицательное,\n" +
    "очень длинная строка, спецсимволы, пробелы по краям"));
  ST.tools.bva++; save(); scoreLabs();
});
$("#pwrun").addEventListener("click", () => {
  const out = $("#pwout"); out.innerHTML = "";
  const params = [];
  String($("#pwin").value).split(/\n/).forEach(line => {
    const s = line.trim(); if(!s) return;
    const i = s.indexOf("=");
    if(i < 0) return;
    const vals = parseList(s.slice(i + 1));
    if(vals.length) params.push({name: s.slice(0, i).trim(), vals});
  });
  if(params.length < 2){ out.appendChild(el("p", "empty", "нужно не меньше двух параметров вида имя=знач1,знач2")); return; }
  if(params.reduce((a, p) => a * p.vals.length, 1) > 20000){
    out.appendChild(el("p", "empty", "слишком много комбинаций — сократите значения до классов эквивалентности")); return;
  }
  const r = pairwise(params);
  const chk = pairwiseCheck(params, r.rows);
  const tb = el("table");
  const hr = el("tr");
  hr.appendChild(el("th", "", "№"));
  params.forEach(p => hr.appendChild(el("th", "", esc(p.name))));
  tb.appendChild(hr);
  r.rows.forEach((row, i) => {
    const tr = el("tr");
    tr.appendChild(el("td", "", String(i + 1)));
    row.forEach(v => tr.appendChild(el("td", "", esc(v))));
    tb.appendChild(tr);
  });
  out.appendChild(tb);
  out.appendChild(el("div", "sum",
    "полный перебор: " + r.full + " · попарный набор: " + r.rows.length +
    " · экономия: " + Math.round((1 - r.rows.length / r.full) * 100) + "%" +
    " · пар покрыто: " + (chk.ok ? "все " + r.pairs : r.pairs - chk.missing.length + " из " + r.pairs)));
  ST.tools.pw++; save(); scoreLabs();
});
function renderSev(){
  const box = $("#sevout"); box.innerHTML = "";
  const t = el("table", "mx");
  t.innerHTML =
    "<tr><th></th><th>Высокий приоритет — чинить сейчас</th><th>Низкий приоритет — чинить в очередь</th></tr>" +
    "<tr><th>Высокая серьёзность<br>система не работает</th>" +
    "<td><b>Чинить немедленно</b>Оплата не проходит ни у кого. Утечка персональных данных. Потеря данных пользователя.</td>" +
    "<td><b>В план ближайших работ</b>Падает отчёт, которым пользуются раз в квартал. Отказ в редком сценарии с обходным путём.</td></tr>" +
    "<tr><th>Низкая серьёзность<br>система работает</th>" +
    "<td><b>Быстрая правка</b>Опечатка в названии компании на главной. Неверная цена в рекламном блоке. Битая ссылка в шапке.</td>" +
    "<td><b>Технический долг</b>Сдвиг иконки на 2 пикселя в редком браузере. Неровный отступ во внутренней админке.</td></tr>";
  box.appendChild(t);
  box.appendChild(el("p", "empty",
    "Серьёзность ставит тестировщик — это техническая оценка ущерба. Приоритет ставит владелец продукта — это решение о порядке работ."));
}

/* ── тема, сброс, высота дока ─────────────────────────── */
$("#theme").addEventListener("click", () => {
  const r = document.documentElement, now = r.getAttribute("data-theme");
  const dark = now ? now === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  r.setAttribute("data-theme", dark ? "light" : "dark");
  try{ localStorage.setItem(KEY + ".theme", dark ? "light" : "dark"); }catch(e){}
});
try{ const t = localStorage.getItem(KEY + ".theme"); if(t) document.documentElement.setAttribute("data-theme", t); }catch(e){}
$("#wipe").addEventListener("click", () => {
  P = {mod:0, quiz:{}, labs:{}, ans:{}, tools:{bva:0, pw:0, sev:0}};
  ST.ans = P.ans; ST.tools = P.tools;
  MODULES.forEach(m => m.labs.forEach(l => { delete l.__hits; }));
  save(); go(cur);
});
function dockH(){
  const d = document.querySelector(".dock");
  if(d) document.documentElement.style.setProperty("--dockh", d.offsetHeight + "px");
}
if(window.ResizeObserver) new ResizeObserver(dockH).observe(document.querySelector(".dock"));
window.addEventListener("resize", dockH);
dockH();

$("#dhint").textContent = "рабочие калькуляторы — можно пользоваться на своих задачах";
renderGlossary("");
go(Math.min(Math.max(P.mod | 0, 0), MODULES.length - 1));
})();
</script>
