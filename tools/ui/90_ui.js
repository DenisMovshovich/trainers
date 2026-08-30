<script>
/* ============================================================
   Общий слой интерфейса
   Подключается последним ко всем материалам и улучшает уже
   готовую разметку, ничего в ней не переписывая: доступность,
   клавиатура, навигация между разделами, поиск, подтверждения.
   Всё определяется по факту наличия узлов, поэтому один и тот
   же файл работает с тремя разными диалектами разметки.
   ============================================================ */
(function(){
"use strict";
if(window.__uiLayer) return;
window.__uiLayer = 1;

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [].slice.call((r || document).querySelectorAll(s));
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const txt = s => String(s == null ? "" : s).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

/* ── содержание материала, если оно есть ─────────────── */
function listOf(){
  try{ if(typeof MODULES !== "undefined" && Array.isArray(MODULES)) return MODULES; }catch(e){}
  try{ if(typeof SECTIONS !== "undefined" && Array.isArray(SECTIONS)) return SECTIONS; }catch(e){}
  return null;
}
const LIST = listOf();

/* ── разбор разметки: какой диалект перед нами ───────── */
function detect(){
  const d = {};
  /* навигация по разделам: берём тот контейнер, где кнопок ровно столько,
     сколько разделов в содержании, — иначе в список попадут посторонние кнопки */
  const rail = $(".rail") || $("#rail");
  const want = LIST ? LIST.length : 0;
  const cands = [$("#nav"), $("#modList"), rail].filter(Boolean);
  d.nav = cands.filter(c => want && $$("button, a[href]", c).length === want)[0] ||
          cands.filter(c => $$("button, a[href]", c).length > 1)[0] || null;
  d.panel = (rail && d.nav && !rail.contains(d.nav) && rail !== d.nav) ? rail : null;
  d.navItems = d.nav ? $$("button, a[href]", d.nav) : [];
  if(want && d.navItems.length > want) d.navItems = d.navItems.slice(0, want);

  /* вкладки внутри раздела */
  const tabsBox = $("#tabs") || $(".tabs");
  d.tabs = tabsBox ? $$('[role="tab"]', tabsBox) : $$('[role="tab"][aria-controls]');
  d.tabs = d.tabs.filter(b => b.closest("#dtabs") === null);
  d.panelOf = b => {
    const c = b.getAttribute("aria-controls");
    if(c && document.getElementById(c)) return document.getElementById(c);
    if(b.dataset && b.dataset.tab) return $("#pane-" + b.dataset.tab);
    const m = /^(t|tab)-(.+)$/.exec(b.id || "");
    if(m) return $("#p-" + m[2]) || $("#pane-" + m[2]) || $("#panel-" + m[2]);
    return null;
  };
  d.main = $("main") || $(".stage") || $(".col");
  d.title = $("#mttl") || (d.main ? $("h1", d.main) : null);
  d.reset = $("#wipe") || $$("button").filter(b => /сброс/i.test(b.textContent))[0] || null;
  d.status = $("#dst") || $("#status");
  d.out = $("#out") || $("#tout");
  return d;
}
const D = detect();

/* ── стили слоя: опираются на токены материала ───────── */
const C = {
  paper: "var(--paper, var(--surface, var(--ground, #fff)))",
  surf:  "var(--surf, var(--surface, var(--paper, #fff)))",
  surf2: "var(--surf2, var(--surface-2, var(--surf, #eee)))",
  surf3: "var(--surf3, var(--surface-3, var(--surf2, #eee)))",
  ink:   "var(--ink, #111)",
  ink2:  "var(--ink2, var(--ink-2, #444))",
  ink3:  "var(--ink3, var(--ink-3, var(--ink2, #777)))",
  line:  "var(--line, #ccc)",
  line2: "var(--line2, var(--line-soft, var(--line, #bbb)))",
  acc:   "var(--acc, var(--accent, var(--moss, #2b6cb0)))",
  accS:  "var(--acc-s, var(--accent-soft, var(--moss-s, transparent)))",
  onacc: "var(--onacc, #fff)",
  good:  "var(--good, var(--ok, #2a7))",
  fm:    "var(--fm, var(--font-mono, ui-monospace, Menlo, monospace))",
  fs:    "var(--fs, var(--fu, var(--font-ui, inherit)))",
  fd:    "var(--fd, var(--font-read, inherit))"
};
function css(){
  const s = document.createElement("style");
  s.id = "ui-layer-style";
  s.textContent = `
.ui-skip{position:fixed; left:8px; top:-60px; z-index:200; background:${C.acc}; color:${C.onacc};
  font:600 13px/1 ${C.fs}; padding:10px 14px; border-radius:3px; text-decoration:none; transition:top .12s}
.ui-skip:focus{top:8px}
.ui-hint{font-family:${C.fm}; font-size:10.5px; color:${C.ink3}; padding:1px 5px; border:1px solid ${C.line};
  border-radius:3px; background:${C.surf3}; white-space:nowrap}
.ui-nav-pct{font-family:${C.fm}; font-size:10.5px; color:${C.ink3}; margin-left:5px; font-variant-numeric:tabular-nums}
.ui-nav-pct.full{color:${C.good}}
/* горизонтальная полоса разделов: место дорого — прогресс рисуем чертой под пунктом */
/* полосу ставим сверху пункта: снизу у материалов своя черта активного раздела */
.ui-nav-bar{position:absolute; left:6px; right:6px; top:0; height:3px; border-radius:0 0 2px 2px;
  background:${C.line}; overflow:hidden; pointer-events:none}
.ui-nav-bar i{display:block; height:100%; width:0; background:${C.acc}; transition:width .2s}
.ui-nav-bar.full i{background:${C.good}}
.ui-nav-bar.empty{display:none}
/* полоса разделов шире экрана — растворяем тот край, за которым ещё есть разделы;
   маска не зависит от фона материала, в отличие от накладки с градиентом */
.ui-scroll-x{scrollbar-width:none}
.ui-scroll-x::-webkit-scrollbar{height:0}
.ui-scroll-x.fade-e{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 40px),transparent);
  mask-image:linear-gradient(90deg,#000 calc(100% - 40px),transparent)}
.ui-scroll-x.fade-s{-webkit-mask-image:linear-gradient(90deg,transparent,#000 40px);
  mask-image:linear-gradient(90deg,transparent,#000 40px)}
.ui-scroll-x.fade-s.fade-e{-webkit-mask-image:linear-gradient(90deg,transparent,#000 40px,#000 calc(100% - 40px),transparent);
  mask-image:linear-gradient(90deg,transparent,#000 40px,#000 calc(100% - 40px),transparent)}
.ui-updown{display:flex; gap:10px; align-items:stretch; margin:26px 0 6px; padding-top:16px;
  border-top:1px solid ${C.line}; flex-wrap:wrap}
.ui-updown a{flex:1 1 220px; min-width:0; display:flex; flex-direction:column; gap:3px; text-decoration:none;
  border:1px solid ${C.line}; border-radius:3px; padding:10px 13px; background:${C.surf}; color:${C.ink};
  transition:border-color .12s, transform .12s}
.ui-updown a:hover{border-color:${C.acc}; transform:translateY(-1px)}
.ui-updown a[hidden]{display:none!important}
.ui-updown .w{font-size:10px; letter-spacing:.1em; text-transform:uppercase; font-weight:700; color:${C.ink3}}
.ui-updown .t{font-family:${C.fd}; font-size:16px; font-weight:600; line-height:1.2}
.ui-updown .next{text-align:right; align-items:flex-end}
.ui-modal{position:fixed; inset:0; z-index:120; background:rgba(0,0,0,.42);
  display:flex; align-items:flex-start; justify-content:center; padding:8vh 16px 16px}
.ui-modal[hidden]{display:none!important}
.ui-sheet{background:${C.paper}; border:1px solid ${C.line2}; border-radius:4px; width:min(680px, 100%);
  max-height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 18px 50px rgba(0,0,0,.28)}
.ui-sheet h2{font-family:${C.fd}; font-size:17px; margin:0; padding:13px 16px; border-bottom:1px solid ${C.line};
  display:flex; align-items:center; gap:10px}
.ui-sheet h2 .sp{flex:1 1 auto}
.ui-x{font:inherit; font-size:12px; background:${C.surf3}; border:1px solid ${C.line2}; color:${C.ink2};
  padding:3px 9px; border-radius:3px; cursor:pointer}
.ui-x:hover{border-color:${C.acc}; color:${C.acc}}
.ui-sheet .body{overflow:auto; padding:6px 0}
#ui-q{font:inherit; font-family:${C.fm}; font-size:14px; width:100%; box-sizing:border-box; color:${C.ink};
  background:${C.surf}; border:none; border-bottom:1px solid ${C.line}; padding:12px 16px; outline:none}
#ui-q:focus{border-bottom-color:${C.acc}}
.ui-res{display:block; width:100%; text-align:left; background:none; border:none; cursor:pointer;
  padding:8px 16px; font:inherit; color:${C.ink2}; border-left:3px solid transparent}
.ui-res:hover,.ui-res[aria-selected="true"]{background:${C.accS}; border-left-color:${C.acc}; color:${C.ink}}
.ui-res .m{display:block; font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:${C.ink3}; font-weight:700}
.ui-res .h{display:block; font-size:14.5px; color:${C.ink}}
.ui-res .s{display:block; font-size:12.5px; color:${C.ink3}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.ui-res mark{background:${C.accS}; color:${C.acc}; padding:0 1px}
.ui-none{padding:14px 16px; color:${C.ink3}; font-size:13.5px}
.ui-keys{width:100%; border-collapse:collapse; font-size:13.5px}
.ui-keys td{padding:6px 16px; border-bottom:1px solid ${C.line}; color:${C.ink2}}
.ui-keys tr:last-child td{border-bottom:none}
.ui-keys td:first-child{width:1%; white-space:nowrap}
.ui-confirm{border-color:${C.acc}!important; color:${C.acc}!important}
.ui-sr{position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden;
  clip:rect(0 0 0 0); white-space:nowrap; border:0}
.ui-panelbtn{display:none}
@media (max-width:1120px){
  .ui-panelbtn{display:inline-block}
  body.ui-panel-open .rail{display:flex!important; flex-direction:column!important; gap:12px;
    align-items:stretch; position:fixed; inset:auto 0 0 0; z-index:110;
    max-height:76vh; background:${C.paper}; border-top:2px solid ${C.acc}; padding:14px 16px 18px;
    overflow:auto; box-shadow:0 -14px 40px rgba(0,0,0,.3)}
  body.ui-panel-open .rail > *{max-width:100%; min-width:0; flex:0 0 auto}
  body.ui-panel-open .ui-scrim{display:block}
}
.ui-scrim{display:none; position:fixed; inset:0; z-index:109; background:rgba(0,0,0,.35)}
@media (prefers-reduced-motion:reduce){ .ui-updown a, .ui-skip{transition:none} }
`;
  document.head.appendChild(s);
}
css();

/* ── 1. ссылка «к содержанию» ─────────────────────────── */
(function skip(){
  if(!D.main) return;
  if(!D.main.id) D.main.id = "ui-main";
  D.main.setAttribute("tabindex", "-1");
  const a = el("a", "ui-skip", "К содержанию");
  a.href = "#" + D.main.id;
  a.addEventListener("click", () => { setTimeout(() => D.main.focus(), 0); });
  document.body.insertBefore(a, document.body.firstChild);
})();

/* ── 2. вкладки по стандартному образцу ───────────────── */
const TABS = D.tabs;
(function tabs(){
  if(TABS.length < 2) return;
  const box = TABS[0].parentNode;
  if(!box.getAttribute("role")) box.setAttribute("role", "tablist");
  TABS.forEach((b, i) => {
    if(!b.id) b.id = "ui-tab-" + i;
    const p = D.panelOf(b);
    if(p){
      if(!p.id) p.id = "ui-panel-" + i;
      b.setAttribute("aria-controls", p.id);
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", b.id);
      if(!p.hasAttribute("tabindex")) p.setAttribute("tabindex", "0");
      b.setAttribute("data-ui-tab", "1");
    }
    b.setAttribute("tabindex", b.getAttribute("aria-selected") === "true" ? "0" : "-1");
  });
  const roving = () => TABS.forEach(b =>
    b.setAttribute("tabindex", b.getAttribute("aria-selected") === "true" ? "0" : "-1"));
  new MutationObserver(roving).observe(box, {subtree: true, attributes: true, attributeFilter: ["aria-selected"]});
  box.addEventListener("keydown", e => {
    const i = TABS.indexOf(document.activeElement);
    if(i < 0) return;
    let j = -1;
    if(e.key === "ArrowRight") j = (i + 1) % TABS.length;
    if(e.key === "ArrowLeft")  j = (i - 1 + TABS.length) % TABS.length;
    if(e.key === "Home") j = 0;
    if(e.key === "End")  j = TABS.length - 1;
    if(j < 0) return;
    e.preventDefault();
    TABS[j].focus();
    TABS[j].click();
  });
})();
/* прочие группы вкладок (переключатели панелей) — хотя бы клавиатура */
(function otherTabs(){
  const groups = {};
  $$('[role="tab"]').forEach(b => {
    if(TABS.indexOf(b) >= 0) return;
    const k = b.parentNode;
    (groups[k.id || (k.className || "g")] = groups[k.id || (k.className || "g")] || {box: k, items: []}).items.push(b);
  });
  for(const k in groups){
    const g = groups[k];
    if(g.items.length < 2) continue;
    if(!g.box.getAttribute("role")) g.box.setAttribute("role", "tablist");
    const roving = () => g.items.forEach(b =>
      b.setAttribute("tabindex", b.getAttribute("aria-selected") === "true" ? "0" : "-1"));
    roving();
    new MutationObserver(roving).observe(g.box, {subtree: true, attributes: true, attributeFilter: ["aria-selected"]});
    g.box.addEventListener("keydown", e => {
      const i = g.items.indexOf(document.activeElement);
      if(i < 0) return;
      let j = -1;
      if(e.key === "ArrowRight") j = (i + 1) % g.items.length;
      if(e.key === "ArrowLeft")  j = (i - 1 + g.items.length) % g.items.length;
      if(j < 0) return;
      e.preventDefault();
      g.items[j].focus();
      g.items[j].click();
    });
  }
})();

function setTab(i){
  if(!TABS[i]) return;
  TABS[i].click();
  const p = D.panelOf(TABS[i]);
  if(p) setTimeout(() => { try{ p.focus({preventScroll: true}); }catch(e){} }, 0);
}

/* ── 3. навигация по разделам: клавиши и подпись ──────── */
const NAV = D.navItems;
(function nav(){
  if(NAV.length < 2 || !D.nav) return;
  D.nav.addEventListener("keydown", e => {
    const i = NAV.indexOf(document.activeElement);
    if(i < 0) return;
    let j = -1;
    if(e.key === "ArrowRight" || e.key === "ArrowDown") j = Math.min(i + 1, NAV.length - 1);
    if(e.key === "ArrowLeft"  || e.key === "ArrowUp")   j = Math.max(i - 1, 0);
    if(e.key === "Home") j = 0;
    if(e.key === "End")  j = NAV.length - 1;
    if(j < 0) return;
    e.preventDefault();
    NAV[j].focus();
  });
})();
const curIndex = () => {
  let i = NAV.findIndex(b => b.getAttribute("aria-current") === "true" || b.getAttribute("aria-current") === "page");
  if(i < 0) i = NAV.findIndex(b => b.classList.contains("cur") || b.classList.contains("active"));
  return i;
};
function goModule(i){
  if(!NAV[i]) return;
  NAV[i].click();
  try{ NAV[i].scrollIntoView({block: "nearest", inline: "nearest"}); }catch(e){}
  setTimeout(() => { if(D.title) { D.title.setAttribute("tabindex", "-1"); try{ D.title.focus({preventScroll:true}); }catch(e){} } }, 0);
}

/* ── 4. «предыдущий / следующий раздел» ───────────────── */
let updown = null;
(function updownInit(){
  if(NAV.length < 2) return;
  const host = $(".col") || D.main;
  if(!host) return;
  updown = el("nav", "ui-updown");
  updown.setAttribute("aria-label", "Соседние разделы");
  updown.innerHTML =
    '<a class="prev" href="#"><span class="w">← предыдущий</span><span class="t"></span></a>' +
    '<a class="next" href="#"><span class="w">следующий →</span><span class="t"></span></a>';
  host.appendChild(updown);
  $(".prev", updown).addEventListener("click", e => { e.preventDefault(); step(-1); });
  $(".next", updown).addEventListener("click", e => { e.preventDefault(); step(1); });
})();
function step(dir){
  const i = curIndex();
  if(i < 0) return;
  const j = i + dir;
  if(j < 0 || j >= NAV.length) return;
  goModule(j);
  window.scrollTo({top: 0, behavior: "auto"});
}
const navLabel = b => {
  const c = b.cloneNode(true);
  $$(".ui-nav-pct, .ui-nav-bar, .dot, .cnt", c).forEach(x => x.remove());
  return txt(c.textContent).replace(/^\d+\s*/, "");
};
function paintUpdown(){
  if(!updown) return;
  const i = curIndex();
  const p = $(".prev", updown), n = $(".next", updown);
  if(i > 0){ p.hidden = false; $(".t", p).textContent = navLabel(NAV[i - 1]); }
  else p.hidden = true;
  if(i >= 0 && i < NAV.length - 1){ n.hidden = false; $(".t", n).textContent = navLabel(NAV[i + 1]); }
  else n.hidden = true;
}

/* ── 5. прогресс по разделам в навигации ──────────────── */
/* Ключ прогресса ищется по совпадению с идентификаторами разделов: на одном
   домене лежат все материалы, и ключей в хранилище несколько. */
let storeKey = null, storeTried = false;
function findStore(){
  if(storeTried) return storeKey;
  storeTried = true;
  storeKey = (function(){
  if(!LIST) return null;
  const ids = {};
  LIST.forEach(m => { if(m && m.id) ids[m.id] = 1; });
  let best = null, bestHits = 0;
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    let v;
    try{ v = JSON.parse(localStorage.getItem(k)); }catch(e){ continue; }
    if(!v || typeof v !== "object" || (!v.quiz && !v.labs)) continue;
    let hits = 0;
    for(const q in (v.quiz || {})) if(ids[String(q).split(":")[0]]) hits++;
    for(const l in (v.labs || {})) hits += 0;
    if(hits > bestHits){ bestHits = hits; best = k; }
  }
  return bestHits > 0 ? best : null;
  })();
  if(!storeKey) storeTried = false;   /* прогресса ещё нет — поищем в следующий раз */
  return storeKey;
}
function progress(){
  if(!LIST) return null;
  const k = findStore();
  let P = {};
  /* до первого сохранения прогресса ключа ещё нет — показываем 0 из N */
  if(k){ try{ P = JSON.parse(localStorage.getItem(k)) || {}; }catch(e){ P = {}; } }
  const Q = P.quiz || {}, L = P.labs || {};
  return LIST.map(m => {
    const q = (m.quiz || []), l = (m.labs || []);
    let done = 0;
    /* плоский вид «раздел:номер» и вложенный «раздел» → {номер: {ok}} */
    const nested = Q[m.id] && typeof Q[m.id] === "object" && Q[m.id].ok === undefined;
    q.forEach((_, i) => {
      const flat = Q[m.id + ":" + i];
      const nest = nested ? Q[m.id][i] : null;
      if((flat && flat.ok) || (nest && nest.ok)) done++;
    });
    /* ключ задания — либо его собственный, либо «раздел/задание» */
    l.forEach(x => { if(L[x.id] || L[m.id + "/" + x.id] || L[m.id + ":" + x.id]) done++; });
    return {done, all: q.length + l.length};
  });
}
/* пункты в один ряд? тогда цифры «3/8» съели бы ширину и последние разделы
   ушли бы за край — рисуем тонкую черту, она не занимает места вовсе */
let navRow = null;
function navIsRow(){
  if(navRow !== null) return navRow;
  if(NAV.length < 2){ navRow = false; return navRow; }
  const a = NAV[0].getBoundingClientRect(), b = NAV[1].getBoundingClientRect();
  if(!a.height || !b.height) return false;          /* ещё не отрисовано — решим позже */
  navRow = Math.abs(a.top - b.top) < a.height / 2;
  return navRow;
}
function paintScroll(){
  if(!D.nav || !navIsRow()) return;
  const n = D.nav, over = n.scrollWidth - n.clientWidth;
  n.classList.toggle("ui-scroll-x", over > 4);
  n.classList.toggle("fade-s", over > 4 && n.scrollLeft > 4);
  n.classList.toggle("fade-e", over > 4 && n.scrollLeft < over - 4);
}
if(D.nav){
  D.nav.addEventListener("scroll", paintScroll, {passive: true});
  window.addEventListener("resize", paintScroll);
}

function paintProgress(){
  const pr = progress();
  if(!pr || pr.length !== NAV.length) return;
  const row = navIsRow();
  NAV.forEach((b, i) => {
    if(!pr[i].all) return;
    const label = navLabel(b) + ": пройдено " + pr[i].done + " из " + pr[i].all;
    b.setAttribute("aria-label", label);
    if(row){
      const old = $(".ui-nav-pct", b); if(old) old.remove();
      if(getComputedStyle(b).position === "static") b.style.position = "relative";
      let bar = $(".ui-nav-bar", b);
      if(!bar){ bar = el("div", "ui-nav-bar"); bar.innerHTML = "<i></i>"; b.appendChild(bar); }
      $("i", bar).style.width = (pr[i].done / pr[i].all * 100).toFixed(1) + "%";
      bar.classList.toggle("full", pr[i].done === pr[i].all);
      bar.classList.toggle("empty", pr[i].done === 0);
      b.title = label;
    } else {
      const oldBar = $(".ui-nav-bar", b); if(oldBar) oldBar.remove();
      let s = $(".ui-nav-pct", b);
      if(!s){ s = el("span", "ui-nav-pct"); b.appendChild(s); }
      s.textContent = pr[i].done + "/" + pr[i].all;
      s.classList.toggle("full", pr[i].done === pr[i].all);
    }
  });
}

/* ── 6. заголовок вкладки браузера по разделу ─────────── */
const BASE_TITLE = document.title;
function paintTitle(){
  if(!D.title) return;
  const t = txt(D.title.textContent);
  document.title = t ? t + " · " + BASE_TITLE : BASE_TITLE;
}

/* ── 7. отслеживание смены раздела ────────────────────── */
function repaint(){ paintUpdown(); paintProgress(); paintTitle(); paintScroll(); }
(function watch(){
  if(D.title) new MutationObserver(repaint).observe(D.title, {childList: true, characterData: true, subtree: true});
  if(D.nav) new MutationObserver(repaint).observe(D.nav,
    {subtree: true, attributes: true, attributeFilter: ["aria-current", "class"]});
  document.addEventListener("click", () => setTimeout(repaint, 60), true);
  setTimeout(repaint, 0);
  setTimeout(repaint, 300);
})();

/* ── 8. сброс прогресса в два шага ────────────────────── */
(function confirmReset(){
  const b = D.reset;
  if(!b) return;
  const label = b.textContent;
  let armed = false, t = null;
  b.addEventListener("click", e => {
    if(armed) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    armed = true;
    b.classList.add("ui-confirm");
    b.textContent = "Точно сбросить?";
    b.setAttribute("aria-live", "assertive");
    say("Нажмите ещё раз, чтобы сбросить весь прогресс");
    t = setTimeout(disarm, 4000);
  }, true);
  b.addEventListener("blur", () => { if(armed) disarm(); });
  function disarm(){
    armed = false;
    clearTimeout(t);
    b.classList.remove("ui-confirm");
    b.textContent = label;
  }
  /* после подтверждения вернуть исходную подпись */
  b.addEventListener("click", () => { if(armed) setTimeout(disarm, 50); });
})();

/* ── 9. область живых сообщений ───────────────────────── */
const live = el("div", "ui-sr");
live.setAttribute("role", "status");
live.setAttribute("aria-live", "polite");
document.body.appendChild(live);
function say(msg){ live.textContent = ""; setTimeout(() => { live.textContent = msg; }, 30); }
(function liveWire(){
  if(D.status){ D.status.setAttribute("role", "status"); D.status.setAttribute("aria-live", "polite"); }
  if(D.out){
    D.out.setAttribute("aria-live", "polite");
    D.out.setAttribute("aria-atomic", "false");
    if(!D.out.getAttribute("aria-label")) D.out.setAttribute("aria-label", "Вывод");
  }
})();

/* ── 10. боковая панель на узком экране ───────────────── */
(function panelSheet(){
  if(!D.panel) return;
  const scrim = el("div", "ui-scrim");
  document.body.appendChild(scrim);
  const btn = el("button", "tbtn ui-panelbtn", "Панель");
  btn.type = "button";
  btn.setAttribute("aria-expanded", "false");
  const bar = $(".tbar") || $(".top") || document.body;
  const anchor = $("#theme");
  if(anchor && anchor.parentNode === bar) bar.insertBefore(btn, anchor);
  else bar.appendChild(btn);
  const close = () => {
    if(!document.body.classList.contains("ui-panel-open")) return;
    document.body.classList.remove("ui-panel-open");
    btn.setAttribute("aria-expanded", "false");
    try{ btn.focus(); }catch(e){}
  };
  btn.addEventListener("click", () => {
    const open = document.body.classList.toggle("ui-panel-open");
    btn.setAttribute("aria-expanded", String(open));
    if(open) D.panel.setAttribute("tabindex", "-1"), D.panel.focus();
  });
  scrim.addEventListener("click", close);
  window.addEventListener("keydown", e => { if(e.key === "Escape") close(); });
})();

/* ── 11. поиск по разделам ────────────────────────────── */
const INDEX = (function(){
  if(!LIST) return [];
  const out = [];
  LIST.forEach((m, i) => {
    const title = txt(m.title || m.name || ("Раздел " + (i + 1)));
    const add = (kind, head, sub, tab) => out.push({i, tab, kind, title, head: txt(head), sub: txt(sub || "")});
    add("раздел", title, m.sub || m.lede, 0);
    const body = txt(m.theory || m.body || "");
    if(body) add("теория", title, body.slice(0, 220), 0);
    (m.quiz || []).forEach(q => add("вопрос", q.q, q.why, 1));
    (m.labs || []).forEach(l => add("задание", l.title, l.brief, 2));
    (m.iv || []).forEach(c => add("собеседование", c.q, c.probe, 3));
  });
  return out;
})();

const modal = el("div", "ui-modal");
modal.hidden = true;
modal.setAttribute("role", "dialog");
modal.setAttribute("aria-modal", "true");
modal.innerHTML =
  '<div class="ui-sheet" role="document">' +
    '<h2 id="ui-mt">Поиск<span class="sp"></span><button class="ui-x" type="button">Esc</button></h2>' +
    '<input id="ui-q" type="search" autocomplete="off" spellcheck="false" placeholder="что ищем — тема, вопрос, задание">' +
    '<div class="body" id="ui-body" role="listbox" aria-label="Найденное"></div>' +
  '</div>';
modal.setAttribute("aria-labelledby", "ui-mt");
document.body.appendChild(modal);
const qInput = $("#ui-q", modal), body = $("#ui-body", modal), sheetTitle = $("#ui-mt", modal);
let lastFocus = null, mode = "search", sel = 0, hits = [];

function openModal(which){
  mode = which;
  lastFocus = document.activeElement;
  modal.hidden = false;
  if(which === "search"){
    sheetTitle.firstChild.textContent = "Поиск";
    qInput.hidden = false;
    qInput.value = "";
    render("");
    qInput.focus();
  } else {
    sheetTitle.firstChild.textContent = "Сочетания клавиш";
    qInput.hidden = true;
    body.innerHTML = keysHtml();
    body.removeAttribute("role");
    $(".ui-x", modal).focus();
  }
}
function closeModal(){
  modal.hidden = true;
  body.setAttribute("role", "listbox");
  if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
}
$(".ui-x", modal).addEventListener("click", closeModal);
modal.addEventListener("mousedown", e => { if(e.target === modal) closeModal(); });

function keysHtml(){
  const rows = [
    [ownSearch ? "/" : "/", ownSearch ? "поиск материала" : "поиск по разделам"],
    ["?", "это окно"],
    ["[  ]", "предыдущий и следующий раздел"],
    ["1 … " + Math.max(TABS.length, 1), "вкладки внутри раздела"],
    ["← →", "перемещение по вкладкам и по списку разделов"],
    ["Esc", "закрыть окно"]
  ];
  if($("#cmd") || $("#sql") || $("#code")) rows.push(["Ctrl+Enter", "выполнить в поле ввода"]);
  return '<table class="ui-keys"><tbody>' + rows.map(r =>
    "<tr><td><span class=\"ui-hint\">" + esc(r[0]) + "</span></td><td>" + esc(r[1]) + "</td></tr>").join("") +
    "</tbody></table>";
}

function render(q){
  const s = String(q || "").trim().toLowerCase();
  hits = [];
  if(s.length >= 2){
    const words = s.split(/\s+/);
    hits = INDEX.filter(r => {
      const hay = (r.head + " " + r.sub + " " + r.title).toLowerCase();
      return words.every(w => hay.indexOf(w) >= 0);
    }).slice(0, 40);
  }
  sel = 0;
  if(!s.length){
    body.innerHTML = '<p class="ui-none">Введите хотя бы два символа. Ищется по заголовкам, теории, вопросам и заданиям.</p>';
    return;
  }
  if(!hits.length){ body.innerHTML = '<p class="ui-none">Ничего не нашлось.</p>'; return; }
  body.innerHTML = "";
  hits.forEach((r, k) => {
    const b = el("button", "ui-res",
      '<span class="m">' + esc(r.title) + " · " + esc(r.kind) + "</span>" +
      '<span class="h">' + mark(r.head, s) + "</span>" +
      (r.sub ? '<span class="s">' + mark(r.sub.slice(0, 120), s) + "</span>" : ""));
    b.type = "button";
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", k === 0 ? "true" : "false");
    b.addEventListener("click", () => jump(r));
    body.appendChild(b);
  });
}
function mark(text, s){
  const t = esc(text);
  const w = s.split(/\s+/).filter(x => x.length >= 2).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if(!w.length) return t;
  return t.replace(new RegExp("(" + w.join("|") + ")", "gi"), "<mark>$1</mark>");
}
function moveSel(d){
  const items = $$(".ui-res", body);
  if(!items.length) return;
  sel = (sel + d + items.length) % items.length;
  items.forEach((b, k) => b.setAttribute("aria-selected", String(k === sel)));
  items[sel].scrollIntoView({block: "nearest"});
}
function jump(r){
  closeModal();
  goModule(r.i);
  if(TABS[r.tab]) setTimeout(() => setTab(r.tab), 30);
  say("Переход: " + r.title);
}
qInput.addEventListener("input", () => render(qInput.value));
modal.addEventListener("keydown", e => {
  if(e.key === "Escape"){ e.preventDefault(); closeModal(); return; }
  if(e.key === "Tab"){                       /* фокус не уходит из окна */
    const f = $$("button, input, [href], [tabindex]:not([tabindex=\"-1\"])", modal)
      .filter(x => !x.hidden && x.offsetWidth + x.offsetHeight > 0);
    if(!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    else if(!modal.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
    return;
  }
  if(mode !== "search") return;
  if(e.key === "ArrowDown"){ e.preventDefault(); moveSel(1); }
  if(e.key === "ArrowUp"){ e.preventDefault(); moveSel(-1); }
  if(e.key === "Enter"){ e.preventDefault(); if(hits[sel]) jump(hits[sel]); }
});

/* ── 12. сочетания клавиш ─────────────────────────────── */
/* у некоторых материалов «/» уже занят собственным поиском в шапке */
const ownSearch = !!($("header, .tbar, .top, .bar") || document.createElement("div"))
  .querySelector('input[type="text"], input[type="search"]');
const typing = t => {
  if(!t) return false;
  const n = (t.tagName || "").toLowerCase();
  return n === "input" || n === "textarea" || n === "select" || t.isContentEditable;
};
window.addEventListener("keydown", e => {
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  if(!modal.hidden) return;
  if(typing(e.target)){
    /* из поля ввода поиск доступен только по Escape → он отдаёт фокус */
    return;
  }
  if(e.key === "/" && !ownSearch){ e.preventDefault(); if(INDEX.length) openModal("search"); return; }
  if(e.key === "?"){ e.preventDefault(); openModal("keys"); return; }
  if(e.key === "["){ e.preventDefault(); step(-1); return; }
  if(e.key === "]"){ e.preventDefault(); step(1); return; }
  if(/^[1-9]$/.test(e.key) && TABS.length > 1){
    const i = +e.key - 1;
    if(TABS[i]){ e.preventDefault(); setTab(i); }
  }
}, false);

/* кнопка вызова поиска в шапке — для тех, кто не знает про «/» */
(function searchButton(){
  if(!INDEX.length || ownSearch) return;
  const bar = $(".tbar") || $(".top");
  if(!bar) return;
  const b = el("button", "tbtn", "Поиск");
  b.type = "button";
  b.title = "Поиск по разделам (/)";
  b.addEventListener("click", () => openModal("search"));
  const anchor = $("#theme");
  if(anchor && anchor.parentNode === bar) bar.insertBefore(b, anchor);
  else bar.appendChild(b);
})();

/* ── 13. подсказка о клавишах в подвале ───────────────── */
(function footerHint(){
  const f = $(".foot") || $("footer");
  if(!f || !NAV.length) return;
  const p = el("p", "", 'Клавиши: ' + (ownSearch ? "" : '<span class="ui-hint">/</span> — поиск, ') +
    '<span class="ui-hint">[</span> <span class="ui-hint">]</span> — соседние разделы, ' +
    '<span class="ui-hint">?</span> — все сочетания.');
  f.appendChild(p);
})();
})();
</script>
