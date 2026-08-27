/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "k8s.v1";
const Q = String.fromCharCode(34);   /* кавычка для сборки разметки */

/* ── прогресс ─────────────────────────────────────────── */
let P = {mod:0, quiz:{}, labs:{}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };

/* ── состояние: кластер и журнал команд ───────────────── */
const ST = {C: null, log: [], lab: null};

const SANDBOX_FILE = [
  "apiVersion: apps/v1",
  "kind: Deployment",
  "metadata:",
  "  name: web",
  "spec:",
  "  replicas: 2",
  "  selector:",
  "    matchLabels:",
  "      app: web",
  "  template:",
  "    metadata:",
  "      labels:",
  "        app: web",
  "    spec:",
  "      containers:",
  "        - name: web",
  "          image: nginx:1.25",
  "          ports:",
  "            - containerPort: 80"
].join("\n");

function loadScenario(lab){
  ST.lab = lab || null;
  ST.log.length = 0;
  ST.C = lab ? lab.setup() : newScenario({files: {"web.yaml": SANDBOX_FILE}});
  outBox.innerHTML = "";
  openFile = null;
  print(lab ? "сценарий задания " + lab.id + " загружен" : "чистый кластер: два узла, манифест web.yaml", "h");
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

/* ── обозреватель кластера ────────────────────────────── */
function refreshRail(){
  const C = ST.C;
  $("#rctx").textContent = "ns " + C.ns;
  $("#prompt").textContent = "ns/" + C.ns + " $";

  const box = $("#objs"); box.innerHTML = "";
  const nAll = list(C, "Pod", "*").length;
  box.appendChild(el("div", "hd2", "<span>Объекты</span><span class=" + Q + "n" + Q + ">" +
    nAll + (nAll === 1 ? " под" : nAll < 5 ? " пода" : " подов") + "</span>"));

  const seen = {};
  let rows = 0;
  for(const d of list(C, "Deployment", C.ns)){
    rows++;
    const want = d.spec.replicas === undefined ? 1 : d.spec.replicas;
    const ready = d.status.readyReplicas || 0;
    box.appendChild(el("div", "orow",
      tag("deploy") + nm(d.metadata.name) +
      st(ready + "/" + want, ready === want ? "ok" : ready ? "warn" : "bad")));
    for(const rs of list(C, "ReplicaSet", C.ns)){
      if(!(rs.metadata.ownerReferences || []).some(r => r.name === d.metadata.name)) continue;
      box.appendChild(el("div", "orow kid",
        tag("rs") + nm(rs.metadata.name.slice(-9)) +
        st((rs.status.replicas || 0) + "/" + (rs.spec.replicas || 0), "dim")));
      for(const p of list(C, "Pod", C.ns)){
        if(!(p.metadata.ownerReferences || []).some(r => r.name === rs.metadata.name)) continue;
        seen[p.metadata.name] = 1;
        box.appendChild(podRow(p, "kid2"));
      }
    }
  }
  for(const j of list(C, "Job", C.ns)){
    rows++;
    box.appendChild(el("div", "orow", tag("job") + nm(j.metadata.name) +
      st((j.status.succeeded || 0) + "/" + (j.spec.completions === undefined ? 1 : j.spec.completions), "dim")));
  }
  for(const p of list(C, "Pod", C.ns)){
    if(seen[p.metadata.name]) continue;
    rows++;
    box.appendChild(podRow(p, ""));
  }
  for(const s of list(C, "Service", C.ns)){
    rows++;
    const eps = ((s.status || {}).endpoints || []).length;
    box.appendChild(el("div", "orow", tag("svc") + nm(s.metadata.name) +
      st(eps + " ep", eps ? "ok" : "bad")));
  }
  for(const c of list(C, "ConfigMap", C.ns).concat(list(C, "Secret", C.ns))){
    rows++;
    box.appendChild(el("div", "orow", tag(c.kind === "Secret" ? "secret" : "cm") + nm(c.metadata.name) +
      st(String(Object.keys(c.data || {}).length), "dim")));
  }
  if(!rows) box.appendChild(el("div", "rempty", "в этом пространстве имён пусто"));

  const nb = $("#nodes"); nb.innerHTML = "";
  nb.appendChild(el("div", "hd2", "<span>Узлы</span><span class=" + Q + "n" + Q + ">" + C.nodes.length + "</span>"));
  for(const n of C.nodes){
    const f = freeOn(C, n);
    const uc = Math.max(0, n.cpu - f.cpu), um = Math.max(0, n.mem - f.mem);
    const pc = Math.min(100, Math.round(uc / n.cpu * 100)), pm = Math.min(100, Math.round(um / n.mem * 100));
    nb.appendChild(el("div", "nrow",
      "<span class=" + Q + "nm" + Q + ">" + esc(n.name) + "</span>" +
      "<span class=" + Q + "bars" + Q + "><span class=" + Q + "b" + Q + "><i style=" + Q + "width:" + pc + "%" + Q + "></i></span>" +
      "<span class=" + Q + "b mem" + Q + "><i style=" + Q + "width:" + pm + "%" + Q + "></i></span></span>" +
      "<span class=" + Q + "pc" + Q + ">" + pc + "% / " + pm + "%</span>"));
  }
}
const tag = t => "<span class=" + Q + "kd" + Q + ">" + t + "</span>";
const nm  = n => "<span class=" + Q + "nm" + Q + ">" + esc(n) + "</span>";
const st  = (t, k) => "<span class=" + Q + "st " + k + Q + ">" + esc(t) + "</span>";
function podRow(p, cls){
  const ph = podPhase(p);
  const cs = p.status.containerStatuses || [];
  const ready = cs.filter(c => c.ready).length + "/" + Math.max(cs.length, (p.spec.containers || []).length);
  const kind = ph === "Running" ? (podReady(p) ? "ok" : "warn")
    : ph === "Succeeded" ? "dim" : ph === "Pending" ? "warn" : "bad";
  return el("div", "orow " + cls, tag("pod") + nm(p.metadata.name) + st(ready + " " + ph, kind));
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
  if(/^(NAME|LAST SEEN|REVISION|CURRENT)\b/.test(text)) cls = "hdr";
  else if(/(CrashLoopBackOff|ImagePullBackOff|OOMKilled|Error|Failed|Unhealthy|Insufficient|Warning)/.test(text)) cls = "bad2";
  else if(/(Pending|Terminating|BackOff|not found|<none>)/.test(text)) cls = "warn2";
  else if(/(Running|Completed|created|configured|scaled|successfully|Normal|exposed|labeled)/.test(text)) cls = "ok2";
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
  const r = runKubectl(C, line);
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

const SUBS = ["get","describe","apply","delete","scale","set","rollout","create","expose",
  "label","logs","top","config","explain","events"];
const KINDS = ["pods","deploy","rs","svc","cm","secret","ns","nodes","job","pvc","ep","events","all"];
function complete(){
  const v = cmdBox.value;
  const parts = v.split(/\s+/);
  const last = parts[parts.length - 1];
  let pool = [];
  if(parts.length === 1) pool = ["kubectl", "cat", "ls", "clear"];
  else if(parts.length === 2 && (parts[0] === "kubectl" || parts[0] === "k")) pool = SUBS;
  else if(parts.length === 3 && (parts[0] === "kubectl" || parts[0] === "k")) pool = KINDS;
  else pool = Object.keys(ST.C.files).concat(
    list(ST.C, "Pod", ST.C.ns).map(p => p.metadata.name),
    list(ST.C, "Deployment", ST.C.ns).map(p => p.metadata.name),
    list(ST.C, "Service", ST.C.ns).map(p => p.metadata.name));
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
  try{ parseYaml($("#ftext").value); }catch(e){ bad = e.message; }
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
      const first = Object.keys(ST.C.files).sort()[0];
      if(first) openInEditor(first);
    }
  }
});

/* ── примеры под каждый раздел ────────────────────────── */
const CHIPS = {
  cluster: ["kubectl get all", "kubectl get nodes -o wide", "kubectl apply -f web.yaml", "kubectl get events"],
  pod: ["kubectl get pods", "kubectl get pods -o wide", "kubectl explain pod", "cat web.yaml"],
  deploy: ["kubectl get deploy", "kubectl get rs", "kubectl scale deploy/web --replicas=4",
           "kubectl explain deployment.spec.replicas"],
  labels: ["kubectl get pods -l app=web", "kubectl get pods -l app=none", "kubectl get endpoints"],
  service: ["kubectl get svc", "kubectl get endpoints", "kubectl expose deploy/web --port=80"],
  config: ["kubectl create configmap app --from-literal=MODE=prod", "kubectl get cm", "kubectl explain configmap"],
  storage: ["kubectl get pvc", "kubectl explain pod"],
  sched: ["kubectl get nodes -o wide", "kubectl top nodes", "kubectl top pods", "kubectl describe node node-1"],
  health: ["kubectl get pods", "kubectl describe deploy web", "kubectl get endpoints"],
  rollout: ["kubectl set image deploy/web web=nginx:1.26", "kubectl rollout status deploy/web",
            "kubectl rollout history deploy/web", "kubectl rollout undo deploy/web"],
  debug: ["kubectl get events", "kubectl get pods", "kubectl top pods"],
  ops: ["kubectl create namespace prod", "kubectl config get-contexts", "kubectl get ns", "kubectl get all -A"]
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
