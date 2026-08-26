/* ============================================================
   Интерфейс тренажёра
   ============================================================ */
const LS = "bash.v1";
const $ = s => document.querySelector(s);

function hash32(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }
(function shuffle(){
  MODULES.forEach(m=>m.quiz.forEach(q=>{
    let seed = hash32(q.q);
    const rnd = ()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    const idx = q.opts.map((_,i)=>i);
    for(let i=idx.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=idx[i]; idx[i]=idx[j]; idx[j]=t; }
    q.opts = idx.map(i=>q.opts[i]); q.a = idx.indexOf(q.a);
  }));
})();

let PROG = {q:{}, l:{}};
try{ const raw = localStorage.getItem(LS); if(raw) PROG = Object.assign({q:{},l:{}}, JSON.parse(raw)); }catch(e){}
const save = ()=>{ try{ localStorage.setItem(LS, JSON.stringify(PROG)); }catch(e){} };

let cur = 0, tab = "th", curLab = 0;
const labs = {};
const key = (m,l) => m.id+"/"+l.id;
function labState(m,l){
  const k = key(m,l);
  if(!labs[k]){ const sh = newShell(); try{ l.setup && l.setup(sh); }catch(e){} labs[k] = {sh, lines:[], hist:[], hi:-1}; }
  return labs[k];
}
function resetLab(m,l){ const sh = newShell(); try{ l.setup && l.setup(sh); }catch(e){} labs[key(m,l)] = {sh, lines:[], hist:[], hi:-1}; }
function refs(){ const m = MODULES[cur]; const l = m.labs[curLab]; return {m, l, S: labState(m,l)}; }

const qs = m => (PROG.q[m.id] = PROG.q[m.id] || {});
const qDone = m => m.quiz.filter((_,i)=> qs(m)[i] && qs(m)[i].ok).length;
const lDone = m => m.labs.filter(l=>PROG.l[key(m,l)]).length;
function paintProg(){
  let d = 0, a = 0;
  MODULES.forEach(m=>{ a += m.quiz.length + m.labs.length; d += qDone(m) + lDone(m); });
  const pct = a ? Math.round(d/a*100) : 0;
  $("#pl").textContent = d + " / " + a;
  $("#pf").style.width = pct + "%";
  $("#pb").setAttribute("aria-valuenow", String(pct));
}
function paintRail(){
  $("#modList").innerHTML = MODULES.map((m,i)=>{
    const qd = qDone(m)===m.quiz.length, ld = lDone(m)===m.labs.length;
    return '<button class="mb" data-i="'+i+'" aria-current="'+(i===cur)+'">'+
      '<span class="n">'+String(m.n).padStart(2,"0")+'</span>'+
      '<span><span class="t">'+esc(m.title)+'</span><span class="s">'+esc(m.sub)+'</span></span>'+
      '<span class="d"><i class="dot'+(qd?" on":"")+'"></i><i class="dot'+(ld?" on":"")+'"></i></span></button>';
  }).join("");
  $("#modList").querySelectorAll(".mb").forEach(b=>b.onclick=()=>{ cur=+b.dataset.i; tab="th"; curLab=0; paintAll(); window.scrollTo({top:0}); });
}
function paintHead(){
  const m = MODULES[cur];
  $("#kick").textContent = "Модуль " + String(m.n).padStart(2,"0") + " · " + m.sub;
  $("#mtitle").textContent = m.title;
  $("#mlede").textContent = m.lede;
  const bq = $("#bqz"), bl = $("#blb");
  bq.textContent = qDone(m)+"/"+m.quiz.length; bq.classList.toggle("ok", qDone(m)===m.quiz.length);
  bl.textContent = lDone(m)+"/"+m.labs.length; bl.classList.toggle("ok", lDone(m)===m.labs.length);
  ["th","qz","lb"].forEach(t=>{ $("#t-"+t).setAttribute("aria-selected", String(tab===t)); $("#p-"+t).hidden = tab!==t; });
  const p = $("#prev"), n = $("#next");
  p.disabled = cur===0; n.disabled = cur===MODULES.length-1;
  p.innerHTML = '<span>◀ Назад<span class="sub">'+(cur>0?esc(MODULES[cur-1].title):"—")+'</span></span>';
  n.innerHTML = '<span>Далее ▶<span class="sub">'+(cur<MODULES.length-1?esc(MODULES[cur+1].title):"—")+'</span></span>';
}
function paintTheory(){ $("#theory").innerHTML = MODULES[cur].theory; }
function paintQuiz(){
  const m = MODULES[cur], st = qs(m), d = qDone(m);
  let h = d===m.quiz.length
    ? '<div class="score"><span class="big" style="color:var(--ok)">'+d+'/'+m.quiz.length+'</span><p>Тест пройден. Переходите к практике.</p></div>'
    : '<div class="score"><span class="big">'+d+'<span style="color:var(--ink3);font-size:16px">/'+m.quiz.length+'</span></span><p>Ошибка не блокирует: объяснение появляется сразу, вопрос остаётся открытым до верного ответа.</p></div>';
  m.quiz.forEach((q,i)=>{
    const a = st[i] || {picks:[], ok:false};
    h += '<div class="qc"><div class="qn"><span>Вопрос '+(i+1)+' из '+m.quiz.length+'</span>'+(a.ok?'<span style="color:var(--ok)">верно</span>':'')+'</div>'+
         '<p class="qt">'+q.q+'</p><div class="opts">';
    q.opts.forEach((o,j)=>{
      let c = "opt";
      if(a.ok && j===q.a) c += " right"; else if(a.picks.includes(j) && j!==q.a) c += " wrong";
      h += '<button class="'+c+'" data-q="'+i+'" data-o="'+j+'"'+(a.ok?" disabled":"")+'><span class="mk">'+String.fromCharCode(65+j)+'</span><span>'+o+'</span></button>';
    });
    h += '</div>';
    if(a.picks.length) h += '<div class="why '+(a.ok?"g":"b")+'"><b>'+(a.ok?"Верно. ":"Не то. ")+'</b>'+q.why+'</div>';
    h += '</div>';
  });
  $("#quiz").innerHTML = h;
  $("#quiz").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
    const i = +b.dataset.q, j = +b.dataset.o;
    const a = st[i] = st[i] || {picks:[], ok:false};
    if(a.ok) return;
    if(!a.picks.includes(j)) a.picks.push(j);
    if(j===m.quiz[i].a) a.ok = true;
    save(); paintQuiz(); paintHead(); paintRail(); paintProg();
  });
}
function paintPicker(){
  const m = MODULES[cur];
  $("#picker").innerHTML = m.labs.map((l,i)=>{
    const done = !!PROG.l[key(m,l)];
    return '<button class="chip'+(done?" done":"")+'" data-i="'+i+'" aria-current="'+(i===curLab)+'">'+
      '<svg class="tk" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6"/><path d="M4 7.2l2.1 2.1L10 5.4"/></svg>'+esc(l.title)+'</button>';
  }).join("");
  $("#picker").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{ curLab=+b.dataset.i; paintLab(); });
}
function paintLab(){
  const {m,l,S} = refs();
  paintPicker();
  $("#brief").innerHTML = l.brief +
    '<div class="tools"><button class="mini" id="bh">Подсказка</button>'+
    '<button class="mini" id="br">Начать заново</button></div><div id="hs"></div>';
  $("#bh").onclick = ()=>{ const s = $("#hs"); s.innerHTML = s.innerHTML ? "" : '<div class="hintbox"><b>Подсказка.</b> '+l.hint+'</div>'; };
  $("#br").onclick = ()=>{ resetLab(m,l); paintLab(); };
  $("#dockLab").textContent = "модуль " + m.n + " · " + l.title;
  renderTape(S); refreshChecks(); paintFs();
}
function renderTape(S){
  const t = $("#tape");
  t.innerHTML = S.lines.length ? S.lines.join("")
    : '<span class="dim">Настоящая оболочка с виртуальной файловой системой: кавычки, раскрытия, конвейеры, циклы и скрипты разбираются по-честному.\n\nПопробуйте: <b>ls</b> · <b>cat notes.txt</b> · <b>for f in *.txt; do echo "$f"; done</b>\n\nТерминал доступен на любой вкладке — пробуйте прямо во время чтения.</span>';
  t.scrollTop = t.scrollHeight;
  $("#ps1").textContent = (S.sh.cwd === HOME ? "~" : S.sh.cwd.replace(HOME, "~")) + " $";
}
function paintFs(){
  const {S} = refs();
  const sh = S.sh;
  let h = '<div class="h">файловая система</div>';
  const walk = (dir, depth, prefix)=>{
    if(depth > 3) return;
    children(sh, dir).forEach(n=>{
      const full = normPath(dir + "/" + n, sh.cwd);
      const isD = isDir(sh, full);
      const x = !isD && "1357".includes(sh.fs[full].m[0]);
      h += '<div class="'+(isD?"d":(x?"x":"f"))+'">'+prefix+esc(n)+(isD?"/":(x?"*":""))+'</div>';
      if(isD) walk(full, depth+1, prefix + "  ");
    });
  };
  h += '<div class="d">~/</div>';
  walk(HOME, 0, "  ");
  $("#fsp").innerHTML = h;
}
function refreshChecks(){
  const {m,l,S} = refs();
  let n = 0;
  const items = l.checks.map(c=>{
    let ok = false; try{ ok = !!c.test(S.sh); }catch(e){ ok = false; }
    if(ok) n++;
    return '<li class="'+(ok?"on":"")+'"><span class="bx"><svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 5.2l2.4 2.4L8.6 2.7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>'+c.label+'</span></li>';
  });
  $("#clist").innerHTML = items.join("");
  $("#cct").textContent = n + "/" + l.checks.length;
  const done = n === l.checks.length;
  $("#cdone").hidden = !done;
  if(done && !PROG.l[key(m,l)]){ PROG.l[key(m,l)] = true; save(); paintHead(); paintRail(); paintProg(); paintPicker(); }
}

function run(src){
  const {m,l,S} = refs();
  const sh = S.sh;
  const prompt = (sh.cwd === HOME ? "~" : sh.cwd.replace(HOME, "~")) + " $ ";
  S.lines.push('<span class="cmd"><span class="p">'+esc(prompt)+'</span>'+esc(src)+'</span>\n');
  if(src.trim() === "clear"){ S.lines = []; renderTape(S); return; }
  if(src.trim() === "reset"){ resetLab(m,l); paintLab(); return; }
  let r;
  sh.steps = 0; sh.exited = false;
  try{ r = runProgram(sh, src); }
  catch(e){ r = {out:"", err:"bash: сбой эмулятора: " + e.message + "\n", code:2}; }
  sh.log.push({cmd:src, out:r.out, err:r.err, code:r.code});
  if(r.out) S.lines.push(esc(r.out));
  if(r.err) S.lines.push('<span class="err">'+esc(r.err)+'</span>');
  if(S.lines.length > 400) S.lines = S.lines.slice(-260);
  if(src.trim() && S.hist[S.hist.length-1] !== src) S.hist.push(src);
  S.hi = -1;
  renderTape(S); refreshChecks(); paintFs();
}

function paintAll(){ paintRail(); paintHead(); paintTheory(); paintQuiz(); paintLab(); paintProg(); }

$("#t-th").onclick = ()=>{ tab="th"; paintHead(); };
$("#t-qz").onclick = ()=>{ tab="qz"; paintHead(); };
$("#t-lb").onclick = ()=>{ tab="lb"; paintHead(); paintLab(); };
$("#prev").onclick = ()=>{ if(cur>0){ cur--; tab="th"; curLab=0; paintAll(); window.scrollTo({top:0}); } };
$("#next").onclick = ()=>{ if(cur<MODULES.length-1){ cur++; tab="th"; curLab=0; paintAll(); window.scrollTo({top:0}); } };
$("#dClear").onclick = ()=>{ const {S} = refs(); S.lines = []; renderTape(S); };
$("#dReset").onclick = ()=>{ const {m,l} = refs(); resetLab(m,l); paintLab(); };
$("#dToggle").onclick = ()=>{
  document.body.classList.toggle("docked-min");
  $("#dToggle").textContent = document.body.classList.contains("docked-min") ? "развернуть" : "свернуть";
};
$("#reset").onclick = ()=>{
  if(!confirm("Сбросить весь прогресс: ответы на тесты и выполненные задания?")) return;
  PROG = {q:{}, l:{}}; save(); Object.keys(labs).forEach(k=>delete labs[k]);
  cur = 0; tab = "th"; curLab = 0; paintAll();
};
const CHEAT = [
 ["Навигация","pwd · ls -la · cd путь · cd .. · cd - · cd (домой) · tree"],
 ["Файлы","touch · mkdir -p · cp -r · mv · rm -r · rmdir · cat -n · head -n N · tail -n N · wc -l · stat · file"],
 ["Перенаправление","> файл · >> файл · 2> файл · &> файл · < файл · <<< строка · 2>&1 · > /dev/null · | tee файл"],
 ["Фильтры","grep -i -v -n -c -r -l · sort -n -r -u -k N · uniq -c -d · cut -d, -f2 · tr -d -s · sed 's/a/b/g' · awk -F, '{print $1}'"],
 ["Шаблоны","* любые символы · ? один символ · [abc] один из · {a,b} список · {1..5} диапазон"],
 ["Переменные","X=значение (без пробелов) · \"$X\" всегда в кавычках · ${X:-умолчание} · ${X#шаблон} · ${X%шаблон} · ${#X} · export"],
 ["Подстановка","$(команда) · $((арифметика)) · $? код возврата · $# число аргументов · \"$@\" аргументы"],
 ["Условия","[ -f файл ] · [ -d кат ] · [ -z \"$S\" ] · [ \"$A\" = \"$B\" ] · [ $A -eq $B ] · if … then … else … fi · case … esac · && · ||"],
 ["Циклы","for f in *; do … done · while [ … ]; do … done · while read -r l; do … done < файл · break · continue"],
 ["Скрипты","#!/usr/bin/env bash · set -euo pipefail · chmod +x · ./скрипт.sh · функция(){ …; } · local · return"],
 ["Поиск","find . -name '*.log' -type f -maxdepth N · find … -exec cmd {} \; · … | xargs -I{} cmd {} · grep -rl"],
 ["Терминал тренажёра","Enter — выполнить · Shift+Enter — новая строка · ↑↓ — история · clear — очистить · reset — начать задание заново"]
];
$("#cheat").onclick = ()=>{
  let ov = document.getElementById("ov");
  if(ov){ ov.remove(); return; }
  ov = document.createElement("div"); ov.id = "ov";
  ov.setAttribute("style","position:fixed;inset:0;z-index:200;background:rgba(15,10,17,.6);display:flex;align-items:center;justify-content:center;padding:22px");
  ov.innerHTML = '<div style="background:var(--surf);border:1px solid var(--line);border-radius:4px;max-width:760px;width:100%;max-height:80vh;overflow:auto">'+
   '<div style="display:flex;align-items:center;padding:13px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surf)">'+
   '<b style="font-family:var(--fd);font-size:15px">Шпаргалка</b><button class="gb" id="ovc" style="margin-left:auto">Закрыть</button></div>'+
   '<div style="padding:16px 18px">'+CHEAT.map(([a,b])=>'<div style="margin-bottom:13px"><div style="font-family:var(--fm);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--acc);font-weight:600;margin-bottom:3px">'+esc(a)+'</div><div style="font-family:var(--fm);font-size:11.5px;line-height:1.8;color:var(--ink2)">'+esc(b)+'</div></div>').join("")+'</div></div>';
  document.body.appendChild(ov);
  ov.onclick = e=>{ if(e.target===ov || e.target.id==="ovc") ov.remove(); };
};
$("#form").onsubmit = e=>{ e.preventDefault(); };
const inp = $("#inp");
function autosize(){ inp.style.height = "20px"; inp.style.height = Math.min(110, inp.scrollHeight) + "px"; }
inp.addEventListener("input", autosize);
inp.addEventListener("keydown", e=>{
  const {S} = refs();
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    const v = inp.value;
    if(!v.trim()) return;
    inp.value = ""; autosize();
    run(v);
    return;
  }
  if(e.key === "ArrowUp" && !inp.value.includes("\n")){
    e.preventDefault(); if(!S.hist.length) return;
    S.hi = S.hi < 0 ? S.hist.length-1 : Math.max(0, S.hi-1);
    inp.value = S.hist[S.hi]; autosize(); return;
  }
  if(e.key === "ArrowDown" && !inp.value.includes("\n")){
    e.preventDefault(); if(S.hi < 0) return;
    S.hi++;
    if(S.hi >= S.hist.length){ S.hi = -1; inp.value = ""; } else inp.value = S.hist[S.hi];
    autosize();
  }
});
$("#tape").addEventListener("click", ()=>inp.focus());
document.addEventListener("keydown", e=>{ if(e.key === "Escape"){ const ov = document.getElementById("ov"); if(ov) ov.remove(); } });

paintAll();
</script>
