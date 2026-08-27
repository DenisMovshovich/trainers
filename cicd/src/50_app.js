/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "ci.v1";
const Q = String.fromCharCode(34);   /* кавычка для сборки разметки */

/* ── прогресс ─────────────────────────────────────────── */
let P = {mod:0, quiz:{}, labs:{}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };

/* ── состояние: проект и журнал команд ────────────────── */
const ST = {C: null, log: [], lab: null};

const SANDBOX = {
  "src/App.cs": "class App { }",
  "shop.sln": "решение",
  "Directory.Packages.props": "<Project/>",
  ".github/workflows/ci.yml": [
    "name: CI",
    "on: [push]",
    "",
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - run: dotnet restore",
    "      - run: dotnet build",
    "      - run: dotnet test --filter unit"
  ].join("\n")
};

function loadScenario(lab){
  ST.lab = lab || null;
  ST.log.length = 0;
  ST.C = lab ? lab.setup() : newScenario({files: SANDBOX});
  outBox.innerHTML = "";
  openFile = null;
  print(lab ? "сценарий задания " + lab.id + " загружен" : "учебный проект: код и конвейер в .github/workflows/ci.yml", "h");
  refreshRail();
  fillPicker();
  scoreLabs();
}

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
  return m.quiz.every((_, i) => (P.quiz[m.id + ":" + i] || {}).ok) && m.labs.every(x => P.labs[x.id]);
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
  $("#msub").textContent = "Раздел " + m.n + " · " + m.sub;
  $("#mttl").textContent = m.title;
  $("#mlede").textContent = m.lede;
  $("#cq").textContent = m.quiz.length;
  $("#cl").textContent = m.labs.length;
  $("#ci").textContent = (m.iv || []).length;
  renderTheory(m); renderQuiz(m); renderLabs(m); renderIv(m); renderChips(m);
  meter();
  const active = nav.children[i];
  if(active && active.scrollIntoView) active.scrollIntoView({block:"nearest", inline:"nearest"});
  window.scrollTo({top:0, behavior:"auto"});
}

$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if(!b) return;
  tab = b.dataset.tab;
  [].forEach.call($("#tabs").children, x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  ["theory","quiz","labs","iv"].forEach(t => $("#pane-" + t).hidden = (t !== tab));
});

function renderTheory(m){ $("#pane-theory").innerHTML = m.theory; }

/* ── вопросы ──────────────────────────────────────────── */
function renderQuiz(m){
  const pane = $("#pane-quiz"); pane.innerHTML = "";
  const sum = el("div", "qsum");
  pane.appendChild(sum);
  m.quiz.forEach((q, qi) => {
    const key = m.id + ":" + qi;
    const order = shuffled(q);
    const card = el("div", "qc");
    card.appendChild(el("div", "qq", '<span class="qn">' + (qi + 1) + '</span><span class="qt">' + q.q + '</span>'));
    const opts = el("div", "qo");
    card.appendChild(opts);
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
    const body = el("div", "labb", lab.brief);
    const list = el("ul", "chk");
    lab.checks.forEach(c => list.appendChild(el("li", "", '<span class="bx">✓</span><span>' + c.label + '</span>')));
    body.appendChild(list);

    const act = el("div", "labact");
    const load = el("button", "btn pri", "Загрузить сценарий"); load.type = "button";
    load.addEventListener("click", () => {
      loadScenario(lab);
      showTool("term");
      $("#cmd").focus();
      document.querySelector(".dock").scrollIntoView({block:"nearest"});
    });
    const hb = el("button", "btn", "Подсказка"); hb.type = "button";
    const hint = el("div", "hintbox", lab.hint); hint.hidden = true;
    hb.addEventListener("click", () => { hint.hidden = !hint.hidden; });
    act.appendChild(load); act.appendChild(hb);

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
    if(P.labs[lab.id]){ lab.__hits = lab.checks.map(() => true); return; }
    /* проверки смотрят на репозиторий, поэтому считаем только для загруженного сценария */
    const hits = (ST.lab && ST.lab.id === lab.id) ? lab.checks.map(evalCheck) : lab.checks.map(() => false);
    if(hits.length && hits.every(Boolean)){ P.labs[lab.id] = true; changed = true; }
    lab.__hits = hits;
  }));
  if(changed) save();
  labNodes.forEach(n => {
    const hits = n.lab.__hits || [];
    const got = hits.filter(Boolean).length;
    [].forEach.call(n.list.children, (li, i) => li.classList.toggle("hit", !!hits[i]));
    const active = ST.lab && ST.lab.id === n.lab.id;
    n.head.querySelector(".st").textContent = P.labs[n.lab.id] || active
      ? got + " / " + n.lab.checks.length : "сценарий не загружен";
    const ok = got === n.lab.checks.length;
    n.card.classList.toggle("done", ok);
    n.done.hidden = !ok;
  });
  meter();
}

/* ── собеседование ────────────────────────────────────── */
function renderIv(m){
  const pane = $("#pane-iv"); pane.innerHTML = "";
  (m.iv || []).forEach((c, i) => {
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

/* ── последний запуск ─────────────────────────────────── */
const MK = {success: ["✓","ok"], failure: ["✗","bad"], skipped: ["–","skip"],
            cancelled: ["⊘","cancel"], warned: ["!","cancel"]};
function refreshRail(){
  const C = ST.C;
  const run = C.runs.length ? C.runs[C.runs.length - 1] : null;
  $("#rctx").textContent = run ? "#" + run.n + " · " + run.event : "ещё не запускался";
  $("#prompt").textContent = "~/" + C.name + " $";

  const box = $("#jobs"); box.innerHTML = "";
  box.appendChild(el("div", "hd2", "<span>Задачи</span><span class=" + Q + "n" + Q + ">" +
    (run ? run.jobs.length : 0) + "</span>"));
  if(!run){ box.appendChild(el("div", "rempty", "наберите ci run внизу")); }
  else {
    const wall = Math.max(run.wall, 1);
    for(const j of run.jobs){
      const multi = j.instances.length > 1 || j.instances[0].name !== j.name;
      if(multi) box.appendChild(row(j.status, j.name, ""));
      for(const i of j.instances){
        box.appendChild(row(i.status, i.name, dur(i.ms), multi));
        const w = Math.max(1, Math.round(i.ms / wall * 100));
        const off = Math.round(j.start / wall * 100);
        const bar = el("div", "jbar");
        bar.appendChild(el("i", "", ""));
        bar.firstChild.style.width = Math.min(100 - off, w) + "%";
        bar.firstChild.style.marginLeft = off + "%";
        box.appendChild(bar);
      }
    }
  }

  const ex = $("#extra"); ex.innerHTML = "";
  ex.appendChild(el("div", "hd2", "<span>Итог</span>"));
  if(!run) ex.appendChild(el("div", "rempty", "—"));
  else {
    const cls = run.status === "success" ? "ok" : run.status === "failure" ? "bad" : "";
    ex.appendChild(el("div", "sum2",
      "статус <b class=" + Q + cls + Q + ">" + (run.status === "success" ? "успех" :
        run.status === "failure" ? "падение" : "пропущено") + "</b><br>" +
      "конвейер <b>" + dur(run.wall) + "</b> · машинное <b>" + dur(run.total) + "</b><br>" +
      "артефактов <b>" + Object.keys(run.artifacts).length + "</b> · кеш <b>" +
      Object.keys(C.cache).length + "</b> · запусков <b>" + C.runs.length + "</b>"));
  }
}
function row(status, name, time, kid){
  const m = MK[status] || ["·","skip"];
  return el("div", "jrow" + (kid ? " kid" : ""),
    "<span class=" + Q + "m " + m[1] + Q + ">" + m[0] + "</span>" +
    "<span class=" + Q + "nm" + Q + ">" + esc(name) + "</span>" +
    (time ? "<span class=" + Q + "t" + Q + ">" + esc(time) + "</span>" : ""));
}
const dur = ms => ms >= 60 ? Math.floor(ms / 60) + "м " + (ms % 60) + "с" : ms + "с";

/* ── терминал ─────────────────────────────────────────── */
const outBox = $("#out"), cmdBox = $("#cmd");
let hist = [], histPos = -1, openFile = null;

function print(text, cls){
  const n = el("div", "l" + (cls ? " " + cls : ""), esc(text));
  outBox.appendChild(n);
  outBox.scrollTop = outBox.scrollHeight;
}
function printLine(text){
  let cls = "";
  if(/^\s*[✗⊘]/.test(text) || /(ПАДЕНИЕ|упало|FAILED|ошибка|не найден)/.test(text)) cls = "bad2";
  else if(/^\s*[–!]/.test(text) || /(отменено|пропущен|не запущен|Кеш пуст|Артефактов нет|замечани)/.test(text)) cls = "warn2";
  else if(/^\s*✓/.test(text) || /(успех|восстановлено|отправлен артефакт|получен артефакт|кеш найден)/.test(text)) cls = "ok2";
  else if(/^──/.test(text)) cls = "job";
  else if(/^(ЗАДАЧА|КЛЮЧ|АРТЕФАКТ|REVISION|#)/.test(text)) cls = "hdr";
  print(text, cls);
}
function status(t, kind){
  const n = $("#dst");
  n.textContent = t;
  n.className = "st" + (kind ? " " + kind : "");
}

function exec(line){
  const C = ST.C;
  outBox.appendChild(el("div", "l cmd", '<span class="p">' + esc($("#prompt").textContent) + '</span> ' + esc(line)));
  const r = runCi(C, line);
  ST.log.push({cmd: line, out: r.out || [], err: r.err || null});
  if(ST.log.length > 400) ST.log.splice(0, ST.log.length - 400);

  if(r.clear){ outBox.innerHTML = ""; status(""); return; }
  if(r.err){
    print(r.err, "e");
    if(r.hint) print(r.hint, "h");
    status("ошибка", "err");
  } else {
    (r.out || []).forEach(printLine);
    if(!(r.out || []).length && !r.quiet) print("", "none");
    status(r.warn ? "внимание" : "выполнено", r.warn ? "err" : "");
  }
  outBox.scrollTop = outBox.scrollHeight;
  refreshRail();
  if(openFile) syncEditor();
  scoreLabs();
}

cmdBox.addEventListener("keydown", e => {
  if(e.key === "Enter"){
    const line = cmdBox.value.trim();
    if(!line) return;
    hist.unshift(line); histPos = -1;
    cmdBox.value = "";
    exec(line);
    return;
  }
  if(e.key === "ArrowUp"){ e.preventDefault(); if(histPos < hist.length - 1){ histPos++; cmdBox.value = hist[histPos]; } return; }
  if(e.key === "ArrowDown"){ e.preventDefault(); if(histPos > 0){ histPos--; cmdBox.value = hist[histPos]; } else { histPos = -1; cmdBox.value = ""; } return; }
  if(e.key === "Tab"){ e.preventDefault(); complete(); }
});

const SUBS = ["run","jobs","logs","graph","artifacts","cache","history","lint","tests","secrets"];
function complete(){
  const v = cmdBox.value;
  const parts = v.split(/\s+/);
  const last = parts[parts.length - 1];
  let pool = [];
  if(parts.length === 1) pool = ["ci", "cat", "ls", "clear"];
  else if(parts.length === 2 && parts[0] === "ci") pool = SUBS;
  else {
    const run = ST.C.runs.length ? ST.C.runs[ST.C.runs.length - 1] : null;
    pool = Object.keys(ST.C.files).concat(run ? run.jobs.map(j => j.name) : []);
  }
  const hit = pool.filter(x => x.indexOf(last) === 0);
  if(hit.length === 1){ parts[parts.length - 1] = hit[0]; cmdBox.value = parts.join(" ") + " "; }
  else if(hit.length > 1){ print(hit.join("  "), "h"); }
}

$("#clear").addEventListener("click", () => { outBox.innerHTML = ""; status(""); });
$("#reset").addEventListener("click", () => { loadScenario(ST.lab); status("сценарий перезагружен"); });

/* ── редактор файла ───────────────────────────────────── */
function fillPicker(){
  const sel = $("#fpick"), names = Object.keys(ST.C.files).sort();
  sel.innerHTML = "";
  if(!names.length){ sel.appendChild(el("option", "", "— файлов нет")); sel.disabled = true; return; }
  sel.disabled = false;
  names.forEach(n => { const o = el("option", "", esc(n)); o.value = n; if(n === openFile) o.selected = true; sel.appendChild(o); });
}
function openInEditor(p){
  openFile = p;
  $("#fname").textContent = ST.C.files[p] === undefined ? "новый файл" : "правится вручную";
  $("#ftext").value = ST.C.files[p] === undefined ? "" : ST.C.files[p];
  fillPicker();
  showTool("file");
  refreshRail();
}
$("#fpick").addEventListener("change", e => openInEditor(e.target.value));
function syncEditor(){ fillPicker(); }
$("#fsave").addEventListener("click", () => {
  if(openFile === null){ status("файл не выбран", "err"); return; }
  ST.C.files[openFile] = $("#ftext").value;
  let bad = null;
  if(/\.(ya?ml)$/.test(openFile)){ try{ parseYaml($("#ftext").value); }catch(e){ bad = e.message; } }
  status(bad ? openFile + ": " + bad : "сохранён " + openFile, bad ? "err" : "");
  refreshRail();
});

/* ── вкладки нижней панели ────────────────────────────── */
function showTool(which){
  ["term","file"].forEach(t => $("#t-" + t).hidden = (t !== which));
  [].forEach.call($("#dtabs").children, b => b.setAttribute("aria-selected", b.dataset.d === which ? "true" : "false"));
}
$("#dtabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-d]"); if(!b) return;
  showTool(b.dataset.d);
  if(b.dataset.d === "term") cmdBox.focus();
  if(b.dataset.d === "file"){
    fillPicker();
    if(openFile === null || ST.C.files[openFile] === undefined){
      const names = Object.keys(ST.C.files).sort();
      const first = names.filter(f => /workflows\/.+\.ya?ml$/.test(f))[0] || names[0];
      if(first) openInEditor(first);
    }
  }
});

/* ── примеры под каждый раздел ────────────────────────── */
const CHIPS = {
  why: ["ls", "cat .github/workflows/ci.yml", "ci run", "ci logs build"],
  workflow: ["ci run", "ci lint", "ci run --event pull_request", "cat .github/workflows/ci.yml"],
  jobs: ["ci run", "ci graph", "ci jobs", "ci logs build"],
  context: ["ci run", "ci logs build", "ci secrets"],
  matrix: ["ci run", "ci jobs", "ci history"],
  cache: ["ci run", "ci cache", "ci cache clear"],
  artifacts: ["ci run", "ci artifacts", "ci artifacts -v"],
  conditions: ["ci run", "ci logs test", "ci jobs"],
  secrets: ["ci secrets", "ci run", "ci run --event pull_request"],
  tests: ["ci tests", "ci run", "ci logs ui", "ci history"],
  speed: ["ci run", "ci jobs", "ci history", "ci cache"],
  design: ["ci lint", "ci graph", "ci run", "ci jobs"]
};
function renderChips(m){
  const box = $("#chips"); box.innerHTML = "";
  (CHIPS[m.id] || []).forEach(c => {
    const b = el("button", "", esc(c));
    b.type = "button"; b.title = "подставить в терминал";
    b.addEventListener("click", () => { cmdBox.value = c; showTool("term"); cmdBox.focus(); });
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
  save();
  loadScenario(null);
  go(cur);
  status("прогресс сброшен");
});

/* ── высота нижней панели ─────────────────────────────── */
function dockH(){
  const d = document.querySelector(".dock");
  if(d) document.documentElement.style.setProperty("--dockh", d.offsetHeight + "px");
}
if(window.ResizeObserver){ const ro = new ResizeObserver(dockH); ro.observe(document.querySelector(".dock")); }
window.addEventListener("resize", dockH);
dockH();

/* ── старт ────────────────────────────────────────────── */
loadScenario(null);
go(Math.min(Math.max(P.mod | 0, 0), MODULES.length - 1));
status("готов");
})();
</script>
