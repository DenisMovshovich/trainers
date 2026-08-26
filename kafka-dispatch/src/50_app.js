<script>
/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "dispatch.v1";

let P = {mod:0, quiz:{}, labs:{}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };

const ST = {c: newCluster(), log: []};
let history = [], hpos = -1;

/* ── перемешивание вариантов ──────────────────────────── */
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
let cur = 0;
function go(i){
  cur = i; P.mod = i; save();
  const m = MODULES[i];
  [].forEach.call(nav.children, (b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
  $("#mno").textContent = m.n < 10 ? "0" + m.n : String(m.n);
  $("#msub").textContent = m.sub;
  $("#mttl").textContent = m.title;
  $("#mlede").textContent = m.lede;
  $("#cq").textContent = m.quiz.length;
  $("#cl").textContent = m.labs.length;
  $("#ctx").textContent = "модуль " + m.n;
  $("#pane-theory").innerHTML = m.theory;
  renderQuiz(m); renderLabs(m); renderChips(m); meter();
  const a = nav.children[i];
  if(a && a.scrollIntoView) a.scrollIntoView({block:"nearest", inline:"nearest"});
  window.scrollTo(0, 0);
}
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if(!b) return;
  [].forEach.call($("#tabs").children, x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  ["theory","quiz","labs"].forEach(t => $("#pane-" + t).hidden = (t !== b.dataset.tab));
});
$("#dtabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-d]"); if(!b) return;
  [].forEach.call($("#dtabs").children, x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  $("#out").hidden = b.dataset.d !== "out";
  $("#viz").hidden = b.dataset.d !== "viz";
  if(b.dataset.d === "viz") renderViz();
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
    let hits;
    if(P.labs[lab.id]) hits = lab.checks.map(() => true);
    else {
      hits = lab.checks.map(c => { try{ return !!c.test(ST); }catch(e){ return false; } });
      if(hits.every(Boolean)){ P.labs[lab.id] = true; changed = true; }
    }
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

/* ── состояние кластера справа ────────────────────────── */
function renderState(){
  const bb = $("#brokers"); bb.innerHTML = "";
  ST.c.brokers.forEach(b => {
    const lead = [];
    Object.keys(ST.c.topics).forEach(tn => ST.c.topics[tn].partitions.forEach(p => { if(p.leader === b.id) lead.push(tn + "-" + p.id); }));
    const row = el("div", "brow " + (b.alive ? "up" : "down"),
      '<span class="bi">broker ' + b.id + '</span>' +
      '<span class="bl">' + b.rack + (lead.length ? " · лидер ×" + lead.length : "") + '</span>' +
      '<span class="bs">' + (b.alive ? "up" : "down") + '</span>');
    bb.appendChild(row);
  });
  $("#bn").textContent = aliveBrokers(ST.c).length + " / " + ST.c.brokers.length;

  const tb = $("#topics"); tb.innerHTML = "";
  const names = Object.keys(ST.c.topics);
  $("#tn").textContent = names.length;
  if(!names.length){ tb.appendChild(el("div", "", '<p style="padding:8px 10px;margin:0;font-size:11.5px;color:var(--ink3)">топиков нет</p>')); return; }
  names.forEach((n, i) => {
    const t = ST.c.topics[n];
    const d = el("details");
    if(i >= names.length - 3) d.open = true;
    const recs = t.partitions.reduce((s, p) => s + p.log.length, 0);
    d.appendChild(el("summary", "", '<span>' + esc(n) + '</span><span class="n">p' + t.partitions.length +
      ' rf' + t.rf + ' · ' + recs + '</span>'));
    const pl = el("div", "pl");
    t.partitions.forEach(p => {
      const isr = p.replicas.filter(r => r.isr).map(r => r.broker);
      pl.appendChild(el("div", "prow" + (isr.length < t.rf ? " bad" : ""),
        '<span class="pid">п' + p.id + '</span>' +
        '<span class="ld">L' + (p.leader === null ? "—" : p.leader) + '</span>' +
        '<span>' + p.logStartOffset + '‥' + leo(p) + '</span>' +
        '<span class="isr">isr ' + (isr.join(",") || "—") + '</span>'));
    });
    d.appendChild(pl);
    tb.appendChild(d);
  });
}

/* ── визуализатор журнала ─────────────────────────────── */
let vizTopic = null;
function renderViz(){
  const box = $("#viz"); box.innerHTML = "";
  const names = Object.keys(ST.c.topics);
  const bar = el("div", "vt");
  bar.appendChild(el("span", "lbl", "Журнал партиций"));
  if(!names.length){
    box.appendChild(bar);
    box.appendChild(el("p", "empty", "топиков ещё нет — создайте первый командой kafka-topics --create"));
    return;
  }
  if(!vizTopic || names.indexOf(vizTopic) < 0) vizTopic = names[names.length - 1];
  const sel = el("select");
  names.forEach(n => { const o = el("option", "", esc(n)); o.value = n; if(n === vizTopic) o.selected = true; sel.appendChild(o); });
  sel.addEventListener("change", () => { vizTopic = sel.value; renderViz(); });
  bar.appendChild(sel);
  box.appendChild(bar);

  const t = ST.c.topics[vizTopic];
  t.partitions.forEach(p => {
    const hw = highWatermark(p);
    const pr = el("div", "pr");
    pr.appendChild(el("div", "ph",
      '<b>' + esc(vizTopic) + '-' + p.id + '</b>' +
      '<span>лидер ' + (p.leader === null ? "нет" : p.leader) + '</span>' +
      '<span>isr ' + (p.replicas.filter(r => r.isr).map(r => r.broker).join(",") || "—") + '</span>' +
      '<span>logStart ' + p.logStartOffset + '</span><span>HW ' + hw + '</span><span>LEO ' + leo(p) + '</span>'));
    const cells = el("div", "cells");
    if(!p.log.length) cells.appendChild(el("span", "empty", "журнал пуст"));
    let prev = null;
    p.log.forEach(r => {
      if(prev !== null && r.offset !== prev + 1) cells.appendChild(el("span", "gap", "⋯"));
      prev = r.offset;
      const tomb = r.value === null;
      const above = r.offset >= hw;
      const c = el("span", "cell" + (tomb ? " tomb" : "") + (above ? " hw" : ""),
        '<span class="o">' + r.offset + '</span>' + esc(tomb ? "␀" : (r.key === null ? "·" : r.key)));
      c.title = "смещение " + r.offset + " · ключ " + (r.key === null ? "нет" : r.key) +
        " · значение " + (tomb ? "null (надгробие)" : r.value) + (above ? " · выше высокой отметки: потребителям не видно" : "");
      if(r.key !== null && !tomb){
        const h = fnv(r.key) % 360;
        c.style.borderColor = "hsl(" + h + " 45% 55%)";
      }
      cells.appendChild(c);
    });
    pr.appendChild(cells);
    box.appendChild(pr);
  });
  box.appendChild(el("div", "lg",
    '<span><i style="border-style:dashed;opacity:.45"></i>выше высокой отметки</span>' +
    '<span><i style="background:var(--trap-s);border-color:var(--trap)"></i>надгробие</span>' +
    '<span>⋯ — дыра после уплотнения</span><span>· — запись без ключа</span>'));
}

/* ── консоль ──────────────────────────────────────────── */
const outBox = $("#out"), inBox = $("#cmd");
function status(t){ $("#dst").textContent = t; }
function renderHist(){
  const h = $("#hist"); h.innerHTML = "";
  ST.log.slice(-60).reverse().forEach(e => {
    const b = el("button", e.err ? "bad" : "", esc(e.cmd));
    b.type = "button"; b.title = e.err || e.lines.join("\n").slice(0, 300);
    b.addEventListener("click", () => { inBox.value = e.cmd; inBox.focus(); });
    h.appendChild(b);
  });
}
function run(){
  const cmd = inBox.value.trim();
  if(!cmd) return;
  let res = null, err = null;
  try{ res = runCmd(ST.c, cmd); }
  catch(e){ err = e && e.message ? e.message : String(e); }
  const entry = {cmd, lines: res ? res.lines : [], notices: res ? res.notices : [], err};
  ST.log.push(entry);
  if(ST.log.length > 400) ST.log.splice(0, ST.log.length - 400);
  history.push(cmd); hpos = history.length;
  outBox.innerHTML = "";
  outBox.appendChild(el("pre", "", '<span style="color:var(--acc)">$ </span>' + esc(cmd)));
  if(err) outBox.appendChild(el("pre", "err", esc(err)));
  else if(entry.lines.length) outBox.appendChild(el("pre", "", esc(entry.lines.join("\n"))));
  else outBox.appendChild(el("pre", "", "(без вывода)"));
  if(entry.notices.length) outBox.appendChild(el("pre", "nt", esc(entry.notices.map(n => "· " + n).join("\n"))));
  outBox.scrollTop = 0;
  status(err ? "ошибка" : "готово");
  inBox.value = "";
  renderHist(); renderState(); scoreLabs();
  if(!$("#viz").hidden) renderViz();
}
$("#cmd").addEventListener("keydown", e => {
  if(e.key === "Enter"){ e.preventDefault(); run(); return; }
  if(e.key === "ArrowUp"){ e.preventDefault(); if(hpos > 0){ hpos--; inBox.value = history[hpos] || ""; } return; }
  if(e.key === "ArrowDown"){ e.preventDefault(); if(hpos < history.length - 1){ hpos++; inBox.value = history[hpos] || ""; } else { hpos = history.length; inBox.value = ""; } }
});
$("#reset").addEventListener("click", () => {
  ST.c = newCluster(); ST.log.length = 0; vizTopic = null;
  outBox.innerHTML = '<p class="empty">кластер пересоздан · наберите help</p>';
  renderHist(); renderState(); if(!$("#viz").hidden) renderViz();
  status("кластер пересоздан");
});

const CHIPS = {
  why:["help","kafka-topics --create --topic orders --partitions 3 --replication-factor 2","kafka-topics --describe --topic orders","produce --topic orders --records a,b,c","kafka-console-consumer --topic orders --from-beginning"],
  part:["kafka-topics --create --topic events --partitions 3 --replication-factor 1","produce --topic events --records u1:x,u1:y,u1:z","dump --topic events","kafka-topics --alter --topic events --partitions 6"],
  prod:["kafka-topics --create --topic clicks --partitions 4 --replication-factor 1","produce --topic clicks --records u1:a,u2:a,u1:b","produce --topic clicks --key u1 --value forced --partition 3","dump --topic clicks"],
  acks:["kafka-topics --create --topic pay --partitions 1 --replication-factor 3","produce --topic pay --records a,b --acks all","produce --topic pay --records c,d --acks 1","dump --topic pay","replicate"],
  repl:["broker list","broker stop 1","kafka-topics --describe --topic pay","broker start 1","unclean on"],
  group:["consumer add --group workers --name c1 --topics tasks --reset earliest","consumer list --group workers","consumer remove --group workers --name c1"],
  offsets:["poll --group workers --name c1 --max 5","commit --group workers --name c1","kafka-consumer-groups --describe --group workers","kafka-consumer-groups --reset-offsets --group workers --topic tasks --to-earliest --execute"],
  order:["produce --topic saga --records o1:created,o1:paid,o1:shipped","dump --topic saga","commit --group proc --name c1 --topic jobs --partition 0 --offset 3"],
  store:["kafka-configs --alter --topic metrics --add-config retention.ms=60000,segment.bytes=2","advance-time 10m","kafka-configs --alter --topic profile --add-config cleanup.policy=compact,segment.bytes=1","compact --topic profile"],
  schema:["produce --topic ser --key \" 42\" --value c","kafka-console-consumer --topic users --from-beginning --property print.key=true"],
  ops:["kafka-consumer-groups --list","kafka-consumer-groups --describe --group bill","cluster","consumer list"],
  choose:["kafka-topics --create --topic payments --partitions 3 --replication-factor 3","kafka-configs --alter --topic payments --add-config min.insync.replicas=2","cluster"]
};
function renderChips(m){
  const box = $("#chips"); box.innerHTML = "";
  (CHIPS[m.id] || []).forEach(q => {
    const b = el("button", "", esc(q.length > 58 ? q.slice(0, 56) + "…" : q));
    b.type = "button"; b.title = q;
    b.addEventListener("click", () => { inBox.value = q; inBox.focus(); });
    box.appendChild(b);
  });
}

/* ── тема, сброс, высота консоли ──────────────────────── */
$("#theme").addEventListener("click", () => {
  const r = document.documentElement, now = r.getAttribute("data-theme");
  const dark = now ? now === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  r.setAttribute("data-theme", dark ? "light" : "dark");
  try{ localStorage.setItem(KEY + ".theme", dark ? "light" : "dark"); }catch(e){}
});
try{ const t = localStorage.getItem(KEY + ".theme"); if(t) document.documentElement.setAttribute("data-theme", t); }catch(e){}
$("#wipe").addEventListener("click", () => {
  P = {mod:0, quiz:{}, labs:{}};
  MODULES.forEach(m => m.labs.forEach(l => { delete l.__hits; }));
  save(); go(cur); status("прогресс сброшен");
});
function dockH(){
  const d = document.querySelector(".dock");
  if(d) document.documentElement.style.setProperty("--dockh", d.offsetHeight + "px");
}
if(window.ResizeObserver) new ResizeObserver(dockH).observe(document.querySelector(".dock"));
window.addEventListener("resize", dockH);
dockH();

renderState(); renderHist();
go(Math.min(Math.max(P.mod | 0, 0), MODULES.length - 1));
status("готов");
})();
</script>
