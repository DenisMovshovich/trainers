/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "net.v1";
const Q = String.fromCharCode(34);   /* кавычка для сборки разметки */

/* ── прогресс ─────────────────────────────────────────── */
let P = {mod:0, quiz:{}, labs:{}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };

/* ── состояние: сеть и журнал команд ──────────────────── */
const ST = {N: null, log: [], lab: null};

const SANDBOX = () => newScenario({
  origin: "https://app.example.com",
  dns: {
    "api.example.com": [{type:"A", value:"203.0.113.10", ttl:300}],
    "www.example.com": [{type:"CNAME", value:"api.example.com"}],
    "app.example.com": [{type:"A", value:"203.0.113.20"}]
  },
  nodes: {
    "203.0.113.10": {ports: {80: {server:"api"}, 443: {server:"api", tls:true, cert:"c1"}}},
    "203.0.113.20": {ports: {443: {server:"web", tls:true, cert:"c2"}}}
  },
  certs: {
    c1: {cn:"api.example.com", san:["api.example.com","www.example.com"], notAfter: 999999},
    c2: {cn:"app.example.com", san:["app.example.com"], notAfter: 999999}
  },
  servers: {
    api: {routes: [
      {path:"/health", body:"ok"},
      {path:"/orders", json:[{id:1, item:"кружка"}],
       headers:{"access-control-allow-origin":"https://app.example.com"}},
      {path:"/private", auth:true, token:"good", json:{secret:"тайна"}},
      {path:"/old", status:301, location:"/health"},
      {path:"/cached", body:"данные", etag:'"v1"', cache:"max-age=60"}
    ]},
    web: {routes: [{path:"/", body:"страница приложения"}]}
  }
});

function loadScenario(lab){
  ST.lab = lab || null;
  ST.log.length = 0;
  ST.N = lab ? lab.setup() : SANDBOX();
  outBox.innerHTML = "";
  openFile = null;
  print(lab ? "сценарий задания " + lab.id + " загружен"
            : "учебная сеть: api.example.com и app.example.com — карта справа", "h");
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

/* ── карта сети ───────────────────────────────────────── */
function refreshRail(){
  const N = ST.N;
  $("#rctx").textContent = Object.keys(N.dns).length + " имён";
  $("#prompt").textContent = "dev@laptop $";

  const box = $("#map"); box.innerHTML = "";
  box.appendChild(el("div", "hd2", "<span>Имена</span>"));
  const names = Object.keys(N.dns).sort();
  if(!names.length) box.appendChild(el("div", "rempty", "записей нет"));
  for(const n of names){
    const rr = N.dns[n];
    for(const r of rr)
      box.appendChild(el("div", "nrow",
        "<span class=" + Q + "nm" + Q + ">" + esc(n) + "</span>" +
        "<span class=" + Q + "arrow" + Q + ">" + r.type + "</span>" +
        "<span class=" + Q + "ip" + Q + ">" + esc(r.value) + "</span>"));
  }
  const local = Object.keys(N.hostsFile || {});
  if(local.length){
    box.appendChild(el("div", "hd2", "<span>/etc/hosts</span>"));
    for(const n of local)
      box.appendChild(el("div", "nrow",
        "<span class=" + Q + "nm" + Q + ">" + esc(n) + "</span>" +
        "<span class=" + Q + "arrow" + Q + ">→</span>" +
        "<span class=" + Q + "ip" + Q + ">" + esc(N.hostsFile[n]) + "</span>"));
  }

  box.appendChild(el("div", "hd2", "<span>Узлы</span>"));
  const ips = Object.keys(N.nodes).sort();
  if(!ips.length) box.appendChild(el("div", "rempty", "узлов нет"));
  for(const ip of ips){
    const node = N.nodes[ip];
    box.appendChild(el("div", "nrow",
      "<span class=" + Q + "ip" + Q + ">" + esc(ip) + "</span>" +
      (node.down ? "<span class=" + Q + "tag shut" + Q + ">не отвечает</span>" : "")));
    const ports = Object.keys(node.ports || {});
    if(!ports.length && !node.down)
      box.appendChild(el("div", "nrow kid", "<span class=" + Q + "tag shut" + Q + ">портов нет</span>"));
    for(const p of ports){
      const dropped = (node.drop || []).indexOf(+p) >= 0;
      const l = node.ports[p];
      box.appendChild(el("div", "nrow kid",
        "<span class=" + Q + "nm" + Q + ">:" + p + "</span>" +
        "<span class=" + Q + "arrow" + Q + ">" + esc(l.server || "?") + "</span>" +
        (l.tls ? "<span class=" + Q + "tag" + Q + ">tls</span>" : "") +
        (dropped ? "<span class=" + Q + "tag drop" + Q + ">пакеты теряются</span>"
                 : node.down ? "" : "<span class=" + Q + "tag open" + Q + ">открыт</span>")));
    }
  }

  const certs = Object.keys(N.certs || {});
  if(certs.length){
    box.appendChild(el("div", "hd2", "<span>Сертификаты</span>"));
    for(const c of certs){
      const x = N.certs[c];
      const bad = x.selfSigned ? "самоподписанный" : (x.notAfter !== undefined && x.notAfter < N.now) ? "истёк" : "";
      box.appendChild(el("div", "nrow",
        "<span class=" + Q + "nm" + Q + ">" + esc([].concat(x.san || x.cn || c).join(", ")) + "</span>" +
        (bad ? "<span class=" + Q + "tag shut" + Q + ">" + bad + "</span>"
             : "<span class=" + Q + "tag open" + Q + ">действителен</span>")));
    }
  }

  const ex = $("#extra"); ex.innerHTML = "";
  ex.appendChild(el("div", "hd2", "<span>Состояние</span>"));
  ex.appendChild(el("div", "vbox",
    "источник страницы: <b>" + esc(N.origin) + "</b><br>" +
    "прокси: <b>" + (N.proxyEnv ? esc(N.proxyEnv) : "нет") + "</b><br>" +
    "вывод: <b>" + (N.verdict ? esc(N.verdict) : "не записан") + "</b>"));
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
  if(/^\*/.test(text)) cls = "star";
  else if(/^>/.test(text)) cls = "req";
  else if(/^</.test(text)) cls = "res";
  else if(/(curl: \(|ЗАБЛОКИРОВАНО|refused|timed out|NXDOMAIN|packet loss|problem|error:)/.test(text)) cls = "bad2";
  else if(/(succeeded|Verify return code: 0|Вывод записан|правила CORS не применяются)/.test(text)) cls = "ok2";
  else if(/(Обратите внимание|Ответов нет|пока не на чем)/.test(text)) cls = "warn2";
  print(text, cls);
}
function status(t, kind){
  const n = $("#dst");
  n.textContent = t;
  n.className = "st" + (kind ? " " + kind : "");
}

function exec(line){
  const N = ST.N;
  outBox.appendChild(el("div", "l cmd", '<span class="p">' + esc($("#prompt").textContent) + '</span> ' + esc(line)));
  const r = runNet(N, line);
  ST.log.push({cmd: line, out: (r.out || []).concat(r.err2 ? [r.err2] : []), err: r.err || null});
  if(ST.log.length > 400) ST.log.splice(0, ST.log.length - 400);

  if(r.clear){ outBox.innerHTML = ""; status(""); return; }
  if(r.err){
    print(r.err, "e");
    if(r.hint) print(r.hint, "h");
    status("ошибка", "err");
  } else {
    if(r.err2) r.out = (r.out || []).concat([""]);
    (r.out || []).forEach(printLine);
    if(!(r.out || []).length && !r.quiet) print("", "none");
    if(r.err2) print(r.err2, "h");
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

const SUBS = ["curl","dig","ping","nc","openssl","browser","verdict","cat","env","clear","help"];
const LAYERS_L = ["dns","tcp","tls","http","proxy","cors","timeout","none"];
function complete(){
  const v = cmdBox.value;
  const parts = v.split(/\s+/);
  const last = parts[parts.length - 1];
  let pool = [];
  if(parts.length === 1) pool = SUBS;
  else if(parts[0] === "verdict") pool = LAYERS_L;
  else if(parts[0] === "cat") pool = Object.keys(ST.N.files || {});
  else pool = Object.keys(ST.N.dns || {}).concat(
    Object.keys(ST.N.dns || {}).map(n => "https://" + n + "/"),
    Object.keys(ST.N.nodes || {}));
  const hit = pool.filter(x => x.indexOf(last) === 0);
  if(hit.length === 1){ parts[parts.length - 1] = hit[0]; cmdBox.value = parts.join(" ") + " "; }
  else if(hit.length > 1){ print(hit.join("  "), "h"); }
}

$("#clear").addEventListener("click", () => { outBox.innerHTML = ""; status(""); });
$("#reset").addEventListener("click", () => { loadScenario(ST.lab); status("сценарий перезагружен"); });

/* ── редактор файла ───────────────────────────────────── */
function fillPicker(){
  const sel = $("#fpick"), names = Object.keys(ST.N.files || {}).sort();
  sel.innerHTML = "";
  if(!names.length){ sel.appendChild(el("option", "", "— файлов нет")); sel.disabled = true; return; }
  sel.disabled = false;
  names.forEach(n => { const o = el("option", "", esc(n)); o.value = n; if(n === openFile) o.selected = true; sel.appendChild(o); });
}
function openInEditor(p){
  openFile = p;
  $("#fname").textContent = ST.N.files[p] === undefined ? "новый файл" : "правится вручную";
  $("#ftext").value = ST.N.files[p] === undefined ? "" : ST.N.files[p];
  fillPicker();
  showTool("file");
  refreshRail();
}
$("#fpick").addEventListener("change", e => openInEditor(e.target.value));
function syncEditor(){ fillPicker(); }
$("#fsave").addEventListener("click", () => {
  if(openFile === null){ status("файл не выбран", "err"); return; }
  ST.N.files[openFile] = $("#ftext").value;
  syncHosts(ST.N);
  status("сохранён " + openFile);
  refreshRail();
  scoreLabs();
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
    if(openFile === null || ST.N.files[openFile] === undefined){
      const first = Object.keys(ST.N.files || {}).sort()[0];
      if(first) openInEditor(first);
    }
  }
});

/* ── примеры под каждый раздел ────────────────────────── */
const CHIPS = {
  path: ["curl -v https://api.example.com/health", "dig api.example.com", "nc -zv api.example.com 443", "verdict"],
  dns: ["dig api.example.com", "dig www.example.com", "cat /etc/hosts",
        "curl --resolve api.example.com:443:203.0.113.10 https://api.example.com/health"],
  tcp: ["nc -zv api.example.com 443", "nc -zv api.example.com 8080", "ping api.example.com",
        "curl --connect-timeout 2 https://api.example.com/health"],
  tls: ["curl -v https://api.example.com/health", "openssl s_client -connect api.example.com:443",
        "curl -k https://api.example.com/health"],
  http: ["curl -I https://api.example.com/health", "curl -i https://api.example.com/private",
         "curl -I -X DELETE https://api.example.com/health", "curl -I https://api.example.com/nope"],
  headers: ['curl -v -H "Authorization: Bearer good" https://api.example.com/private',
            "curl -v https://api.example.com/health", "curl -I https://api.example.com/orders"],
  redirect: ["curl -I https://api.example.com/old", "curl -L https://api.example.com/old",
             "curl -I https://api.example.com/cached"],
  proxy: ["env", "curl -v https://api.example.com/health", "curl -I https://api.example.com/health"],
  cors: ["curl https://api.example.com/orders", "browser https://api.example.com/orders",
         "browser https://app.example.com/", 'browser -H "X-Token: 1" https://api.example.com/orders'],
  curl: ["curl -v https://api.example.com/health", 'curl -w "%{time_total}" https://api.example.com/health',
         "curl -I https://api.example.com/health", "curl -L https://api.example.com/old"],
  flaky: ["curl --max-time 2 https://api.example.com/health", "env", "cat /etc/hosts",
          "openssl s_client -connect api.example.com:443"],
  debug: ["dig api.example.com", "nc -zv api.example.com 443", "curl -v https://api.example.com/health",
          "browser https://api.example.com/orders", "verdict"]
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
