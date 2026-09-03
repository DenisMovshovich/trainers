/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "ubuntu.v1";

/* ── прогресс ─────────────────────────────────────────── */
let P = {mod:0, quiz:{}, labs:{}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };

/* ── состояние: машина и журнал команд ────────────────── */
const ST = {S: null, log: [], lab: null};
const ROOT = {uid: 0, gids: [0], name: "root"};

function sandbox(){
  return newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}});
}
function loadScenario(lab){
  ST.lab = lab || null;
  ST.log.length = 0;
  ST.S = lab ? lab.setup() : sandbox();
  outBox.innerHTML = "";
  openFile = null;
  print(lab ? "сценарий задания " + lab.id + " загружен" : "чистая машина: вы ubuntu, право sudo есть", "h");
  print("наберите help, чтобы увидеть список команд", "h");
  refreshRail(); fillPicker(); syncPrompt(); scoreLabs();
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
const TOTAL = MODULES.reduce((s, m) => s + m.quiz.length + m.labs.length, 0);
function modDone(m){
  return m.quiz.every((_, i) => (P.quiz[m.id + ":" + i] || {}).ok) && m.labs.every(x => P.labs[x.id]);
}
function meter(){
  let done = 0;
  MODULES.forEach(m => {
    m.quiz.forEach((_, i) => { if((P.quiz[m.id + ":" + i] || {}).ok) done++; });
    m.labs.forEach(x => { if(P.labs[x.id]) done++; });
  });
  $("#mtxt").textContent = done + " / " + TOTAL;
  $("#mbar").style.width = (done / TOTAL * 100).toFixed(1) + "%";
  [].forEach.call(nav.children, (b, i) => b.classList.toggle("done", modDone(MODULES[i])));
}

/* ── переключение разделов и вкладок ──────────────────── */
let cur = 0, tab = "theory";
function go(i){
  cur = Math.max(0, Math.min(MODULES.length - 1, i));
  P.mod = cur; save();
  const m = MODULES[cur];
  [].forEach.call(nav.children, (b, j) => b.setAttribute("aria-current", j === cur ? "true" : "false"));
  $("#msub").textContent = "Раздел " + m.n + " · " + m.sub;
  $("#mttl").textContent = m.title;
  $("#mlede").textContent = m.lede;
  $("#cq").textContent = m.quiz.length;
  $("#cl").textContent = m.labs.length;
  $("#ci").textContent = (m.iv || []).length;
  renderTheory(m); renderQuiz(m); renderLabs(m); renderIv(m); renderChips(m);
  showTab(tab);
  window.scrollTo({top: 0, behavior: "auto"});
}
function showTab(t){
  tab = t;
  [].forEach.call($("#tabs").children, b => b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"));
  for(const k of ["theory","quiz","labs","iv"]) $("#pane-" + k).hidden = k !== t;
}
[].forEach.call($("#tabs").children, b => { b.type = "button"; b.addEventListener("click", () => showTab(b.dataset.tab)); });

/* ── теория ───────────────────────────────────────────── */
function renderTheory(m){ $("#pane-theory").innerHTML = m.theory; }

/* ── вопросы ──────────────────────────────────────────── */
function renderQuiz(m){
  const pane = $("#pane-quiz"); pane.innerHTML = "";
  const sum = el("p", "qsum"); pane.appendChild(sum);
  m.quiz.forEach((q, i) => {
    const key = m.id + ":" + i;
    const card = el("div", "qc");
    card.appendChild(el("div", "qq", '<span class="qn">' + (i + 1) + '</span><span class="qt">' + q.q + '</span>'));
    const opts = el("div", "qo");
    const order = shuffled(q);
    const btns = [];
    order.forEach((oi, pos) => {
      const b = el("button", "", '<span class="ltr">' + "АБВГ"[pos] + '</span><span>' + q.opts[oi] + '</span>');
      b.type = "button";
      b.addEventListener("click", () => answer(oi));
      opts.appendChild(b); btns.push({b, oi});
    });
    card.appendChild(opts);
    const why = el("div", "qw", '<span class="lbl">почему</span>' + q.why);
    why.hidden = true;
    card.appendChild(why);

    function paint(chosen){
      btns.forEach(x => {
        x.b.disabled = true;
        if(x.oi === q.a) x.b.classList.add("good");
        else if(x.oi === chosen) x.b.classList.add("bad");
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
    sum.innerHTML = done ? "отвечено <b>" + done + "</b> из " + m.quiz.length + ", верно <b>" + ok + "</b>"
                         : "вопросов в разделе: " + m.quiz.length;
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
    body.hidden = true;
    body.innerHTML = '<div class="ivp"><b>что проверяют</b>' + c.probe + '</div><div class="iva">' + c.a + '</div>' +
      (c.more && c.more.length ? '<div class="ivm"><b>могут спросить дальше</b><ul>' +
        c.more.map(x => '<li>' + x + '</li>').join("") + '</ul></div>' : "");
    q.addEventListener("click", () => {
      body.hidden = !body.hidden;
      q.querySelector(".tog").textContent = body.hidden ? "показать" : "скрыть";
    });
    card.appendChild(q); card.appendChild(body);
    pane.appendChild(card);
  });
}

/* ── правая колонка: состояние машины ─────────────────── */
function refreshRail(){
  const S = ST.S;
  $("#rctx").textContent = S.who.name + "@" + S.host;

  const svc = $("#rsvc");
  const units = Object.keys(S.units).sort();
  svc.innerHTML = '<div class="hd2"><span>Службы</span><span class="n">' + units.length + '</span></div>';
  if(!units.length) svc.appendChild(el("div", "rempty", "служб нет"));
  units.forEach(n => {
    const u = S.units[n];
    const cls = u.failed ? "fail" : u.active ? "up" : "down";
    const mark = u.failed ? "×" : u.active ? "●" : "○";
    svc.appendChild(el("div", "rrow " + cls,
      '<span class="dot">' + mark + '</span><span class="nm">' + esc(n.replace(/\.service$/, "")) + '</span>' +
      '<span class="sub">' + (u.enabled ? "авто" : "") + '</span>'));
  });

  const ports = $("#rports");
  const open = Object.keys(S.ports).filter(p => { const u = S.units[S.ports[p]]; return u && u.active; })
    .sort((a, b) => a - b);
  ports.innerHTML = '<div class="hd2"><span>Слушают</span><span class="n">' + open.length + '</span></div>';
  if(!open.length) ports.appendChild(el("div", "rempty", "ничего не слушает"));
  open.forEach(p => {
    const u = S.units[S.ports[p]];
    ports.appendChild(el("div", "rrow up",
      '<span class="port">' + p + '</span><span class="nm">' + esc(S.ports[p].replace(/\.service$/, "")) + '</span>' +
      '<span class="sub">' + esc(u.bind || "0.0.0.0") + '</span>'));
  });

  const res = $("#rres");
  const m0 = S.mounts[0] || {size: 1, used: 0, at: "/"};
  const pct = Math.round(m0.used / m0.size * 100);
  const fw = S.ufw.enabled ? (S.lockedOut ? "включён, ssh не разрешён" : "включён") : "выключен";
  res.innerHTML = '<div class="hd2"><span>Ресурсы</span><span class="n">' + esc(m0.at) + '</span></div>';
  const g = el("div", "gauge");
  g.innerHTML = '<div class="gl"><span>диск</span><span>' + pct + '%</span></div>' +
    '<div class="gb"><i class="' + (pct > 90 ? "hi" : pct > 70 ? "mid" : "") + '" style="width:' + pct + '%"></i></div>';
  res.appendChild(g);
  res.appendChild(el("div", "rrow " + (S.ufw.enabled ? (S.lockedOut ? "fail" : "up") : "down"),
    '<span class="dot">' + (S.ufw.enabled ? (S.lockedOut ? "×" : "●") : "○") + '</span>' +
    '<span class="nm">экран</span><span class="sub">' + fw + '</span>'));
  res.appendChild(el("div", "rrow",
    '<span class="dot"> </span><span class="nm">учётных записей</span><span class="sub">' +
    Object.keys(S.users).length + '</span>'));
}

/* ── терминал ─────────────────────────────────────────── */
const outBox = $("#out"), cmdBox = $("#cmd");
let hist = [], histPos = -1, openFile = null;

function print(text, cls){
  const n = el("div", "l" + (cls ? " " + cls : ""));
  n.textContent = text;
  outBox.appendChild(n);
  outBox.scrollTop = outBox.scrollHeight;
}
function printLine(text){
  /* окраска по смыслу: приглашение, ошибка, успех */
  let cls = "";
  if(/(^|\s)(FAIL|failed|Failed|error|Error|denied|refused|No such)/.test(text)) cls = "e";
  else if(/^(●|active \(running\)|Rule added|OK|done)/.test(text)) cls = "add";
  print(text, cls);
}
function status(t, kind){
  const n = $("#dst");
  n.textContent = t;
  n.classList.toggle("err", kind === "err");
}
function syncPrompt(){
  const S = ST.S;
  const home = homeOf(S, S.who.name);
  const p = S.cwd === home ? "~" : S.cwd;
  $("#prompt").textContent = S.who.name + "@" + S.host + ":" + p + (S.who.uid === 0 ? "#" : "$");
}
function exec(line){
  const S = ST.S;
  const home = homeOf(S, S.who.name);
  const shown = S.cwd === home ? "~" : S.cwd;
  const pr = S.who.name + "@" + S.host + ":" + shown + (S.who.uid === 0 ? "#" : "$");
  const c = el("div", "l cmd");
  c.innerHTML = '<span class="p">' + esc(pr) + '</span> ' + esc(line);
  outBox.appendChild(c);

  let r;
  try{ r = runSh(S, line); }
  catch(e){ r = {out: [], err: "внутренняя ошибка: " + (e && e.message || e)}; }
  if(r.clear){ outBox.innerHTML = ""; }
  else {
    for(const l of r.out || []) printLine(l);
    if(r.err) for(const l of String(r.err).split("\n")) print(l, "e");
    if(r.hint) print("↳ " + r.hint, "h");
  }
  ST.log.push({cmd: line, out: (r.out || []).slice(), err: r.err || null});
  outBox.scrollTop = outBox.scrollHeight;
  status(r.err ? "ошибка" : "готов", r.err ? "err" : "");
  syncPrompt(); refreshRail(); fillPicker(); scoreLabs();
  if(openFile) syncEditor();
}
cmdBox.addEventListener("keydown", e => {
  if(e.key === "Enter"){
    const v = cmdBox.value.trim();
    if(!v) return;
    hist.push(v); histPos = hist.length;
    cmdBox.value = "";
    exec(v);
    return;
  }
  if(e.key === "ArrowUp"){ e.preventDefault(); if(histPos > 0){ histPos--; cmdBox.value = hist[histPos]; } return; }
  if(e.key === "ArrowDown"){
    e.preventDefault();
    if(histPos < hist.length - 1){ histPos++; cmdBox.value = hist[histPos]; }
    else { histPos = hist.length; cmdBox.value = ""; }
    return;
  }
  if(e.key === "Tab"){ e.preventDefault(); complete(); }
});
function complete(){
  const v = cmdBox.value;
  const parts = v.split(/\s+/);
  const last = parts[parts.length - 1];
  let cands;
  if(parts.length === 1){
    cands = Object.keys(CMDS).filter(x => x.indexOf(last) === 0 && x[0] !== "_");
  } else {
    /* дополнение путей */
    const slash = last.lastIndexOf("/");
    const dirPart = slash < 0 ? "." : (slash === 0 ? "/" : last.slice(0, slash));
    const base = slash < 0 ? last : last.slice(slash + 1);
    let items = [];
    try{ items = listDir(ST.S, dirPart).map(x => x.name + (x.node.type === "d" ? "/" : "")); }catch(e){ items = []; }
    cands = items.filter(x => x.indexOf(base) === 0)
                 .map(x => (slash < 0 ? "" : last.slice(0, slash + 1)) + x);
  }
  if(!cands.length) return;
  if(cands.length === 1){
    parts[parts.length - 1] = cands[0];
    cmdBox.value = parts.join(" ") + (/\/$/.test(cands[0]) ? "" : " ");
    return;
  }
  /* общий префикс */
  let pre = cands[0];
  for(const c of cands) while(c.indexOf(pre) !== 0) pre = pre.slice(0, -1);
  if(pre.length > last.length){ parts[parts.length - 1] = pre; cmdBox.value = parts.join(" "); }
  else print(cands.slice(0, 40).join("  "), "h");
}

/* ── редактор файлов ──────────────────────────────────── */
const EDIT_ROOTS = ["/etc", "/root", "/home", "/srv", "/usr/local/bin", "/var/spool/cron/crontabs", "/var/log"];
function editableFiles(){
  const out = [];
  for(const r of EDIT_ROOTS){
    let items;
    try{ items = walkTree(ST.S, r, {who: ROOT}); }catch(e){ continue; }
    for(const x of items)
      if(x.node.type === "f" && x.node.content.length < 20000) out.push(x.path);
  }
  return out.sort();
}
function fillPicker(){
  const sel = $("#fpick");
  const was = sel.value;
  const files = editableFiles();
  sel.innerHTML = '<option value="">— выберите файл —</option>' +
    files.map(f => '<option value="' + esc(f) + '">' + esc(f) + '</option>').join("");
  if(was && files.indexOf(was) >= 0) sel.value = was;
}
function openInEditor(p){
  openFile = p;
  $("#fname").textContent = p;
  try{ $("#ftext").value = readFile(ST.S, p, {who: ROOT}); }
  catch(e){ $("#ftext").value = ""; }
}
function syncEditor(){
  if(!openFile) return;
  try{ $("#ftext").value = readFile(ST.S, openFile, {who: ROOT}); }catch(e){}
}
$("#fpick").addEventListener("change", e => { if(e.target.value) openInEditor(e.target.value); });
$("#fsave").addEventListener("click", () => {
  if(!openFile){ status("файл не выбран", "err"); return; }
  try{
    writeFile(ST.S, openFile, $("#ftext").value, {who: ROOT});
    status("сохранено: " + openFile, "");
    print("файл " + openFile + " сохранён", "h");
    ST.log.push({cmd: "правка " + openFile, out: [], err: null});
    refreshRail(); scoreLabs();
  }catch(e){ status("не сохранилось: " + e.message, "err"); }
});

/* ── переключение инструментов внизу ──────────────────── */
function showTool(which){
  [].forEach.call($("#dtabs").children, b => b.setAttribute("aria-selected", b.dataset.d === which ? "true" : "false"));
  $("#t-term").hidden = which !== "term";
  $("#t-file").hidden = which !== "file";
  if(which === "file") fillPicker();
}
[].forEach.call($("#dtabs").children, b => { b.type = "button"; b.addEventListener("click", () => showTool(b.dataset.d)); });

/* ── быстрые примеры под терминалом ───────────────────── */
const CHIPS = {
  start: ["id", "hostnamectl", "df -h", "ls -l /etc", "systemctl list-units --failed"],
  perm:  ["ls -l /var/www/html", "chmod 640 файл", "chown deploy:www-data файл", "ls -ld /tmp", "umask"],
  users: ["id", "cat /etc/passwd", "sudo adduser marina", "sudo usermod -aG sudo marina", "groups"],
  apt:   ["sudo apt update", "sudo apt install nginx", "dpkg -l | grep nginx", "apt policy nginx", "dpkg -S /etc/nginx/nginx.conf"],
  systemd:["systemctl status ssh", "systemctl is-enabled ssh", "sudo systemctl daemon-reload", "systemctl list-units --failed", "systemctl cat ssh"],
  logs:  ["journalctl -p err -b", "journalctl -u ssh -n 20", "grep sudo /var/log/auth.log", "dmesg", "du -sh /var/log"],
  proc:  ["ps aux", "top", "free -h", "uptime", "sudo systemctl stop имя"],
  disk:  ["df -h", "df -i", "du -sh /var/log", "lsblk", "cat /etc/fstab"],
  net:   ["ip a", "ip r", "sudo ss -tulpn", "cat /etc/netplan/00-installer-config.yaml", "sudo netplan apply"],
  ssh:   ["ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519", "cat /etc/ssh/sshd_config", "ls -l /home", "sudo systemctl restart ssh"],
  fw:    ["sudo ufw status numbered", "sudo ufw allow OpenSSH", "sudo ufw enable", "sudo ss -tulpn"],
  cron:  ["crontab -l", "systemctl list-timers", "systemctl list-units --failed", "df -h", "free -h"]
};
function renderChips(m){
  const box = $("#chips"); box.innerHTML = "";
  (CHIPS[m.id] || []).forEach(c => {
    const b = el("button", "", c); b.type = "button";
    b.addEventListener("click", () => { cmdBox.value = c; cmdBox.focus(); });
    box.appendChild(b);
  });
}

/* ── высота нижней панели для правой колонки ──────────── */
function dockH(){
  const d = document.querySelector(".dock");
  if(d) document.documentElement.style.setProperty("--dockh", d.offsetHeight + "px");
}
window.addEventListener("resize", dockH);

/* ── тема, сброс, запуск ──────────────────────────────── */
$("#theme").addEventListener("click", () => {
  const now = document.documentElement.getAttribute("data-theme");
  const dark = now === "dark" || (!now && window.matchMedia("(prefers-color-scheme:dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  try{ localStorage.setItem(KEY + ".theme", dark ? "light" : "dark"); }catch(e){}
});
try{ const t = localStorage.getItem(KEY + ".theme"); if(t) document.documentElement.setAttribute("data-theme", t); }catch(e){}

$("#wipe").addEventListener("click", () => {
  P = {mod:0, quiz:{}, labs:{}};
  save();
  loadScenario(null);
  go(0);
});
$("#reset").addEventListener("click", () => loadScenario(ST.lab));
$("#clear").addEventListener("click", () => { outBox.innerHTML = ""; });

loadScenario(null);
go(Math.min(P.mod || 0, MODULES.length - 1));
dockH();
setTimeout(dockH, 300);
})();
</script>
