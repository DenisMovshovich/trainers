/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "git.v1";

/* ── прогресс ─────────────────────────────────────────── */
let P = {mod:0, quiz:{}, labs:{}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };

/* ── состояние: репозиторий и журнал команд ───────────── */
const ST = {R: null, log: [], lab: null};

function sandbox(){
  const R = newRepo("webapp");
  R.initialized = true;
  R.index["README.md"] = "# webapp\n\nУчебный репозиторий.";
  R.work["README.md"] = R.index["README.md"];
  R.now += 3600;
  const id = doCommit(R, "chore: заготовка проекта", []);
  moveHead(R, id, "commit (initial): chore: заготовка проекта");
  checkoutTree(R, id);
  return R;
}
function loadScenario(lab){
  ST.lab = lab || null;
  ST.log.length = 0;
  if(lab){ const R = newRepo("webapp"); R.initialized = true; lab.setup(R); ST.R = R; }
  else ST.R = sandbox();
  outBox.innerHTML = "";
  openFile = null;
  print(lab ? "сценарий задания " + lab.id + " загружен" : "чистый репозиторий", "h");
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

/* ── обозреватель репозитория ─────────────────────────── */
function refreshRail(){
  const R = ST.R;
  $("#rctx").textContent = detached(R) ? "HEAD отсоединён"
    : (branchName(R) || "—") + (R.merging ? " · слияние" : R.rebasing ? " · rebase" : R.bisect ? " · bisect" : "");
  $("#prompt").textContent = "~/" + R.name + " (" + (branchName(R) || short(headId(R)) || "—") + ") $";

  /* граф истории по всем веткам */
  const g = $("#graph"); g.innerHTML = "";
  g.appendChild(el("div", "hd2", '<span>История</span><span class="n" id="gn"></span>'));
  const tips = [];
  if(headId(R)) tips.push(headId(R));
  for(const b of branches(R)) tips.push(R.refs["refs/heads/" + b]);
  for(const r of remoteRefs(R)) tips.push(R.refs["refs/remotes/" + r]);
  const seen = new Set(), all = [];
  for(const t of tips) for(const c of ancestry(R, t)) if(!seen.has(c)){ seen.add(c); all.push(c); }
  all.sort((a, b) => obj(R, b).at - obj(R, a).at);
  g.querySelector(".n").textContent = all.length + (all.length === 1 ? " коммит" : all.length < 5 ? " коммита" : " коммитов");
  if(!all.length) g.appendChild(el("div", "rempty", "коммитов пока нет"));
  all.slice(0, 40).forEach(id => {
    const o = obj(R, id);
    const refs = refsAt(R, id);
    const isHead = headId(R) === id;
    const merge = o.parents.length > 1;
    g.appendChild(el("div", "gline" + (isHead ? " head" : ""),
      '<span class="dot">' + (merge ? "◇" : isHead ? "●" : "○") + '</span>' +
      '<span class="sha">' + short(id) + '</span>' +
      (refs.length ? '<span class="ref">(' + esc(refs.join(", ")) + ')</span>' : "") +
      '<span class="msg">' + esc(o.msg.split("\n")[0]) + '</span>'));
  });

  /* рабочая копия */
  const t = $("#tree"); t.innerHTML = "";
  const s = statusSets(R);
  const mark = {};
  for(const x of s.staged) mark[x.p] = ["a", "+"];
  for(const x of s.unstaged) mark[x.p] = ["m", "~"];
  for(const p of s.untracked) mark[p] = ["u", "?"];
  if(R.merging) for(const p of R.merging.conflicts) mark[p] = ["u", "!"];
  const names = Object.keys(R.work).sort();
  t.appendChild(el("div", "hd2", '<span>Рабочая копия</span><span class="n">' + names.length + '</span>'));
  if(!names.length) t.appendChild(el("div", "rempty", "файлов нет"));
  names.forEach(p => {
    const m = mark[p] || ["", " "];
    const b = el("button", "frow" + (openFile === p ? " sel" : ""),
      '<span class="st ' + m[0] + '">' + m[1] + '</span><span class="nm">' + esc(p) + '</span>');
    b.type = "button";
    b.addEventListener("click", () => openInEditor(p));
    t.appendChild(b);
  });
}

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
  if(/^\+/.test(text) && !/^\+\+\+/.test(text)) cls = "add";
  else if(/^-/.test(text) && !/^---/.test(text)) cls = "del";
  else if(/^@@/.test(text)) cls = "hunk";
  else if(/^(CONFLICT|Auto-merging|error:|warning:)/.test(text)) cls = "cfl";
  print(text, cls);
}
function status(t, kind){
  const n = $("#dst");
  n.textContent = t;
  n.className = "st" + (kind ? " " + kind : "");
}

function exec(line){
  const R = ST.R;
  outBox.appendChild(el("div", "l cmd", '<span class="p">' + esc($("#prompt").textContent) + '</span> ' + esc(line)));
  const r = runGit(R, line);
  ST.log.push({cmd: line, out: r.out || [], err: r.err || null});
  if(ST.log.length > 400) ST.log.splice(0, ST.log.length - 400);

  if(r.interactive){ openTodo(r.interactive); status("план перебазирования"); }
  else if(r.err){
    print(r.err, "e");
    if(r.hint) print(r.hint, "h");
    status("ошибка", "err");
  } else {
    (r.out || []).forEach(printLine);
    if(!(r.out || []).length && !r.quiet) print("", "none");
    status(r.conflict ? "конфликт" : "выполнено", r.conflict ? "err" : "");
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

const SUBS = ["status","add","commit","log","show","diff","branch","checkout","switch","restore","rm","clean",
  "merge","rebase","reset","revert","cherry-pick","stash","reflog","fsck","tag","blame","grep","bisect",
  "merge-base","remote","fetch","pull","push","config","cat-file","ls-files","init"];
function complete(){
  const v = cmdBox.value;
  const parts = v.split(/\s+/);
  const last = parts[parts.length - 1];
  let pool = [];
  if(parts.length === 1) pool = ["git"].concat(["echo","cat","ls","rm","touch"]);
  else if(parts.length === 2 && parts[0] === "git") pool = SUBS;
  else pool = Object.keys(ST.R.work).concat(branches(ST.R), remoteRefs(ST.R).map(r => r));
  const hit = pool.filter(x => x.indexOf(last) === 0);
  if(hit.length === 1){ parts[parts.length - 1] = hit[0]; cmdBox.value = parts.join(" ") + " "; }
  else if(hit.length > 1){ print(hit.join("  "), "h"); }
}

$("#clear").addEventListener("click", () => { outBox.innerHTML = ""; status(""); });
$("#reset").addEventListener("click", () => { loadScenario(ST.lab); status("сценарий перезагружен"); });

/* ── редактор файла ───────────────────────────────────── */
function fillPicker(){
  const sel = $("#fpick"), names = Object.keys(ST.R.work).sort();
  sel.innerHTML = "";
  if(!names.length){ sel.appendChild(el("option", "", "— файлов нет")); sel.disabled = true; return; }
  sel.disabled = false;
  names.forEach(n => { const o = el("option", "", esc(n)); o.value = n; if(n === openFile) o.selected = true; sel.appendChild(o); });
}
function openInEditor(p){
  openFile = p;
  $("#fname").textContent = ST.R.work[p] === undefined ? "новый файл" : "правится вручную";
  $("#ftext").value = ST.R.work[p] === undefined ? "" : ST.R.work[p];
  fillPicker();
  showTool("file");
  refreshRail();
}
$("#fpick").addEventListener("change", e => openInEditor(e.target.value));
function syncEditor(){
  fillPicker();
  if(openFile === null) return;
  if(ST.R.work[openFile] === undefined){ openFile = null; $("#fname").textContent = "файл не выбран"; $("#ftext").value = ""; return; }
  $("#ftext").value = ST.R.work[openFile];
}
$("#fsave").addEventListener("click", () => {
  if(openFile === null){ status("файл не выбран", "err"); return; }
  ST.R.work[openFile] = $("#ftext").value;
  status("сохранён " + openFile);
  refreshRail();
  scoreLabs();
});

/* ── план интерактивного перебазирования ──────────────── */
let todoState = null;
const OPS = ["pick","reword","squash","fixup","drop"];
function openTodo(info){
  todoState = {upstream: info.upstream, onto: info.onto, rows: info.todo.slice()};
  $("#tnote").textContent = "Коммиты идут от старых к новым. Действие меняется в списке, порядок — стрелками.";
  $("#dtabs button[data-d=todo]").hidden = false;
  drawTodo();
  showTool("todo");
}
function drawTodo(){
  const box = $("#tlist"); box.innerHTML = "";
  todoState.rows.forEach((r, i) => {
    const row = el("div", "tr" + (r.op === "drop" ? " drop" : ""));
    const sel = el("select");
    OPS.forEach(o => { const opt = el("option", "", o); opt.value = o; if(o === r.op) opt.selected = true; sel.appendChild(opt); });
    sel.addEventListener("change", () => { r.op = sel.value; drawTodo(); });
    row.appendChild(sel);
    row.appendChild(el("span", "sha", short(r.commit)));
    row.appendChild(el("span", "msg", esc(r.msg || obj(ST.R, r.commit).msg)));
    const up = el("button", "mv", "↑"); up.type = "button";
    up.addEventListener("click", () => { if(i > 0){ const t = todoState.rows[i-1]; todoState.rows[i-1] = r; todoState.rows[i] = t; drawTodo(); } });
    const dn = el("button", "mv", "↓"); dn.type = "button";
    dn.addEventListener("click", () => { if(i < todoState.rows.length-1){ const t = todoState.rows[i+1]; todoState.rows[i+1] = r; todoState.rows[i] = t; drawTodo(); } });
    row.appendChild(up); row.appendChild(dn);
    box.appendChild(row);
  });
}
$("#tapply").addEventListener("click", () => {
  if(!todoState) return;
  const S = todoState; todoState = null;
  $("#dtabs button[data-d=todo]").hidden = true;
  showTool("term");
  outBox.appendChild(el("div", "l h", "план: " + S.rows.map(r => r.op + " " + short(r.commit)).join(", ")));
  ST.log.push({cmd: "git rebase -i " + S.upstream, out: [], err: null});
  let r;
  try{ r = applyTodo(ST.R, S.upstream, S.rows, S.onto); }
  catch(e){ r = {out: [], err: e && e.message || String(e)}; }
  if(r.err){ print(r.err, "e"); status("ошибка", "err"); }
  else { (r.out || []).forEach(printLine); status(r.conflict ? "конфликт" : "выполнено", r.conflict ? "err" : ""); }
  refreshRail(); syncEditor(); scoreLabs();
});
$("#tcancel").addEventListener("click", () => {
  todoState = null;
  $("#dtabs button[data-d=todo]").hidden = true;
  showTool("term");
  print("перебазирование отменено", "h");
});

/* ── вкладки нижней панели ────────────────────────────── */
function showTool(which){
  ["term","file","todo"].forEach(t => $("#t-" + t).hidden = (t !== which));
  [].forEach.call($("#dtabs").children, b => b.setAttribute("aria-selected", b.dataset.d === which ? "true" : "false"));
}
$("#dtabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-d]"); if(!b) return;
  showTool(b.dataset.d);
  if(b.dataset.d === "term") cmdBox.focus();
  if(b.dataset.d === "file"){
    fillPicker();
    /* открыт впервые — показываем первый конфликтный файл, иначе первый попавшийся */
    if(openFile === null || ST.R.work[openFile] === undefined){
      const cf = ST.R.merging ? ST.R.merging.conflicts[0] : null;
      const first = cf || Object.keys(ST.R.work).sort()[0];
      if(first) openInEditor(first);
    }
  }
});

/* ── примеры под каждый раздел ────────────────────────── */
const CHIPS = {
  three: ["git status --short", "git diff", "git diff --staged", 'echo "проба" > a.txt', "git add ."],
  commit: ["git log --oneline", "git commit --amend", "git cat-file -p HEAD", "git ls-files"],
  objects: ["git cat-file -p HEAD^{tree}", "git cat-file -t HEAD", "git tag", "git log --oneline"],
  branch: ["git branch -v", "git switch -c проба", "git log --oneline --graph --all", "git checkout HEAD~1"],
  merge: ["git merge-base main HEAD", "git merge --abort", "git log --oneline --graph --all"],
  rebase: ["git rebase -i HEAD~3", "git rebase --abort", "git log --oneline"],
  undo: ["git reset --soft HEAD~1", "git reset HEAD~1", "git reset --hard HEAD~1", "git revert HEAD"],
  rescue: ["git reflog", "git fsck", "git stash list", "git reset --hard ORIG_HEAD"],
  remote: ["git remote -v", "git fetch origin", "git branch -a", "git log --oneline origin/main"],
  team: ["git status", "git pull --rebase", "git push --force-with-lease", "git config pull.rebase true"],
  search: ["git log --oneline -5", "git blame README.md", "git log -S TODO", "git bisect start"],
  flow: ["git branch -v", "git log --oneline --graph --all", "git branch -d проба"]
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
