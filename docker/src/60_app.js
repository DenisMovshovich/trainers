/* ============================================================
   Интерфейс тренажёра
   ============================================================ */
const LS_KEY="docker.v1";
const $ = s => document.querySelector(s);

let P = {quiz:{}, labs:{}};
try{ const raw=localStorage.getItem(LS_KEY); if(raw) P=Object.assign({quiz:{},labs:{}}, JSON.parse(raw)); }catch(e){}
const save = () => { try{ localStorage.setItem(LS_KEY, JSON.stringify(P)); }catch(e){} };

(function shuffleOptions(){
  MODULES.forEach(m=>m.quiz.forEach(q=>{
    let seed=parseInt(hash32(q.q),16)>>>0;
    const rnd=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    const idx=q.opts.map((_,i)=>i);
    for(let i=idx.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=idx[i]; idx[i]=idx[j]; idx[j]=t; }
    q.opts=idx.map(i=>q.opts[i]);
    q.a=idx.indexOf(q.a);
  }));
})();

let curMod=0, curTab="theory", curLab=0, vizTab="map";
const labStates={};

function labKey(m,l){ return m.id+"/"+l.id; }
function labState(m,l){
  const k=labKey(m,l);
  if(!labStates[k]){ const st=newState(); try{ l.setup&&l.setup(st); }catch(e){} labStates[k]={st, lines:[], hist:[], hi:-1}; }
  return labStates[k];
}
function resetLab(m,l){
  const k=labKey(m,l);
  const st=newState(); try{ l.setup&&l.setup(st); }catch(e){}
  labStates[k]={st, lines:[], hist:[], hi:-1};
}

/* ---------- прогресс ---------- */
function quizState(m){ return (P.quiz[m.id]=P.quiz[m.id]||{}); }
function quizDone(m){ const q=quizState(m); return m.quiz.filter((_,i)=>q[i]&&q[i].ok).length; }
function labsDone(m){ return m.labs.filter(l=>P.labs[labKey(m,l)]).length; }
function totals(){
  let done=0,all=0;
  MODULES.forEach(m=>{ all+=m.quiz.length+m.labs.length; done+=quizDone(m)+labsDone(m); });
  return {done, all};
}
function paintProgress(){
  const t=totals(), pct=t.all?Math.round(t.done/t.all*100):0;
  $("#progLabel").textContent=t.done+" / "+t.all;
  $("#progFill").style.width=pct+"%";
  $("#progBar").setAttribute("aria-valuenow",String(pct));
}

/* ---------- рейка модулей ---------- */
function paintRail(){
  $("#modList").innerHTML = MODULES.map((m,i)=>{
    const qd=quizDone(m)===m.quiz.length, ld=labsDone(m)===m.labs.length;
    return '<button class="mod-btn" data-i="'+i+'" aria-current="'+(i===curMod)+'">'+
      '<span class="mod-n">'+String(m.n).padStart(2,"0")+'</span>'+
      '<span><span class="mod-t">'+esc(m.title)+'</span><span class="mod-s">'+esc(m.sub)+'</span></span>'+
      '<span class="mod-dots"><i class="dot'+(qd?" on":"")+'" title="тест"></i><i class="dot'+(ld?" on":"")+'" title="практика"></i></span>'+
    '</button>';
  }).join("");
  $("#modList").querySelectorAll(".mod-btn").forEach(b=>b.onclick=()=>{ curMod=+b.dataset.i; curTab="theory"; curLab=0; paintAll(); window.scrollTo({top:0,behavior:"instant"}); });
}

/* ---------- шапка и вкладки ---------- */
function paintHead(){
  const m=MODULES[curMod];
  $("#eyebrow").textContent="Модуль "+String(m.n).padStart(2,"0")+" · "+m.sub;
  $("#mtitle").textContent=m.title;
  $("#mlede").textContent=m.lede;
  const qb=$("#quizBadge"), lb=$("#labBadge");
  qb.textContent=quizDone(m)+"/"+m.quiz.length;
  qb.classList.toggle("done", quizDone(m)===m.quiz.length);
  lb.textContent=labsDone(m)+"/"+m.labs.length;
  lb.classList.toggle("done", labsDone(m)===m.labs.length);
  ["theory","quiz","lab"].forEach(t=>{
    $("#tab-"+t).setAttribute("aria-selected", String(curTab===t));
    $("#panel-"+t).hidden = curTab!==t;
  });
  const prev=$("#prevMod"), next=$("#nextMod");
  prev.disabled=curMod===0; next.disabled=curMod===MODULES.length-1;
  prev.innerHTML='<span>◀ Назад<span class="sub">'+(curMod>0?esc(MODULES[curMod-1].title):"—")+'</span></span>';
  next.innerHTML='<span>Далее ▶<span class="sub">'+(curMod<MODULES.length-1?esc(MODULES[curMod+1].title):"—")+'</span></span>';
}

/* ---------- теория ---------- */
function paintTheory(){ $("#theoryBody").innerHTML = MODULES[curMod].theory; }

/* ---------- тест ---------- */
function paintQuiz(){
  const m=MODULES[curMod], qs=quizState(m);
  const correct=quizDone(m);
  let html="";
  if(correct===m.quiz.length){
    html+='<div class="done-banner"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6 11.4l3.4 3.4L16 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><div><strong>Тест пройден полностью</strong><p>Все '+m.quiz.length+' вопросов закрыты. Переходите к практике.</p></div></div>';
  } else {
    html+='<div class="quiz-score"><span class="big">'+correct+'<span style="color:var(--ink-3);font-size:16px">/'+m.quiz.length+'</span></span><p>Ошибка не блокирует: объяснение появляется сразу, вопрос остаётся открытым, пока не выберете верный вариант.</p></div>';
  }
  m.quiz.forEach((q,i)=>{
    const s=qs[i]||{picks:[],ok:false};
    html+='<div class="q-card"><div class="q-num"><span>Вопрос '+(i+1)+' из '+m.quiz.length+'</span>'+
      (s.ok?'<span style="color:var(--ok)">верно</span>':'')+'</div>'+
      '<p class="q-text">'+q.q+'</p><div class="opts">';
    q.opts.forEach((o,j)=>{
      let cls="opt";
      if(s.ok && j===q.a) cls+=" right";
      else if(s.picks.includes(j) && j!==q.a) cls+=" wrong";
      html+='<button class="'+cls+'" data-q="'+i+'" data-o="'+j+'"'+(s.ok?" disabled":"")+'>'+
        '<span class="mk">'+String.fromCharCode(65+j)+'</span><span>'+o+'</span></button>';
    });
    html+='</div>';
    if(s.picks.length){
      const good=s.ok;
      html+='<div class="why '+(good?"good":"bad")+'"><b>'+(good?"Верно. ":"Не то. ")+'</b>'+q.why+'</div>';
    }
    html+='</div>';
  });
  $("#quizBody").innerHTML=html;
  $("#quizBody").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.q, j=+b.dataset.o, q=m.quiz[i];
    const s=qs[i]=qs[i]||{picks:[],ok:false};
    if(s.ok) return;
    if(!s.picks.includes(j)) s.picks.push(j);
    if(j===q.a) s.ok=true;
    save(); paintQuiz(); paintHead(); paintRail(); paintProgress();
  });
}

/* ---------- практика ---------- */
function paintLabPicker(){
  const m=MODULES[curMod];
  $("#labPicker").innerHTML = m.labs.map((l,i)=>{
    const done=!!P.labs[labKey(m,l)];
    return '<button class="lab-chip'+(done?" done":"")+'" data-i="'+i+'" aria-current="'+(i===curLab)+'">'+
      '<svg class="tick" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6"/><path d="M4 7.2l2.1 2.1L10 5.4"/></svg>'+
      esc(l.title)+'</button>';
  }).join("");
  $("#labPicker").querySelectorAll(".lab-chip").forEach(b=>b.onclick=()=>{ curLab=+b.dataset.i; paintLab(); });
}
function paintLab(){
  const m=MODULES[curMod], l=m.labs[curLab];
  paintLabPicker();
  $("#labBrief").innerHTML = l.brief +
    '<div class="lab-tools">'+
      '<button class="mini" id="btnHint">Подсказка</button>'+
      '<button class="mini" id="btnResetLab">Начать задание заново</button>'+
      '<button class="mini mono" id="btnHelp">help</button>'+
    '</div><div id="hintSlot"></div>';
  $("#btnHint").onclick=()=>{
    const slot=$("#hintSlot");
    slot.innerHTML = slot.innerHTML ? "" : '<div class="hintbox"><b>Подсказка.</b> '+l.hint+'</div>';
  };
  $("#btnResetLab").onclick=()=>{ resetLab(m,l); paintLab(); };
  $("#btnHelp").onclick=()=>{ runCommand("help"); };
  const S=labState(m,l);
  renderTerm(S);
  refreshChecks();
  paintViz();
  $("#termInput").value="";
}
function renderTerm(S){
  const out=$("#termOut");
  out.innerHTML = S.lines.length ? S.lines.map(l=>'<div class="'+l.cls+'">'+esc(l.t||" ")+'</div>').join("")
    : '<div class="dim">Эмулятор Docker. Команды выполняются по-настоящему: состояние движка меняется, схема справа обновляется.\nНаберите <b>help</b>, чтобы увидеть список команд.</div>';
  out.scrollTop=out.scrollHeight;
  const st=S.st;
  $("#termPfx").textContent = st.shellIn ? "/ #" : "$";
  $("#termCwd").textContent = st.shellIn ? (C(st,"")||{}).name||"внутри контейнера" : st.cwd.replace("/work","~/work");
  if(st.shellIn){ const c=st.containers.find(x=>x.id===st.shellIn); if(c) $("#termCwd").textContent=c.name+":"+(c.workdir||"/"); }
}
function curLabRefs(){ const m=MODULES[curMod]; return {m, l:m.labs[curLab], S:labState(m,m.labs[curLab])}; }

function runCommand(line){
  const {m,l,S}=curLabRefs();
  const st=S.st;
  S.lines.push({t:(st.shellIn?"/ # ":"$ ")+line, cls:"cmd"});
  if(line.trim()==="clear"){ S.lines=[]; renderTerm(S); return; }
  if(line.trim()==="reset"){ resetLab(m,l); paintLab(); return; }
  let out;
  try{ out=engineExec(st,line); }
  catch(e){ out=mkOut(); out.err("внутренняя ошибка эмулятора: "+e.message); }
  out.L.forEach(x=>S.lines.push({t:x.t, cls:x.cls}));
  if(S.lines.length>900) S.lines=S.lines.slice(-700);
  if(line.trim() && S.hist[S.hist.length-1]!==line) S.hist.push(line);
  S.hi=-1;
  renderTerm(S);
  refreshChecks();
  paintViz();
}

function refreshChecks(){
  const {m,l,S}=curLabRefs();
  const st=S.st;
  let passed=0;
  const items = l.checks.map(ch=>{
    let ok=false;
    try{ ok=!!ch.test(st, st.history); }catch(e){ ok=false; }
    if(ok) passed++;
    return '<li class="'+(ok?"on":"")+'"><span class="bx"><svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 5.2l2.4 2.4L8.6 2.7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>'+ch.label+'</span></li>';
  });
  $("#checkList").innerHTML=items.join("");
  $("#checkCount").textContent=passed+"/"+l.checks.length;
  const done=passed===l.checks.length;
  $("#labDone").hidden=!done;
  if(done && !P.labs[labKey(m,l)]){ P.labs[labKey(m,l)]=true; save(); paintHead(); paintRail(); paintProgress(); paintLabPicker(); }
}

function paintViz(){
  const {S}=curLabRefs();
  const st=S.st;
  const body=$("#vizBody");
  if(vizTab==="map") body.innerHTML=vizMap(st);
  else if(vizTab==="layers") body.innerHTML=vizLayers(st);
  else if(vizTab==="state") body.innerHTML=vizState(st);
  else body.innerHTML=vizFiles(st);
}

/* ---------- автодополнение ---------- */
function completions(st){
  const out=COMPLETIONS.slice();
  st.containers.forEach(c=>out.push("docker logs "+c.name,"docker stop "+c.name,"docker exec -it "+c.name+" sh","docker inspect "+c.name,"docker rm "+c.name));
  st.images.forEach(i=>{ if(i.repo!=="<none>") out.push("docker history "+i.repo+":"+i.tag,"docker run "+i.repo+":"+i.tag); });
  REG_LIST.forEach(r=>out.push("docker pull "+r));
  st.networks.forEach(n=>{ if(!n.builtin) out.push("docker network inspect "+n.name); });
  st.volumes.forEach(v=>out.push("docker volume inspect "+v.name));
  Object.keys(st.files).forEach(f=>out.push("cat "+f.replace("/work/","")));
  return out;
}
function complete(S){
  const inp=$("#termInput"), v=inp.value;
  if(!v.trim()) return;
  const cands=[...new Set(completions(S.st).filter(c=>c.startsWith(v)))];
  if(!cands.length) return;
  if(cands.length===1){ inp.value=cands[0]; return; }
  let pre=cands[0];
  cands.forEach(c=>{ let i=0; while(i<pre.length&&i<c.length&&pre[i]===c[i]) i++; pre=pre.slice(0,i); });
  if(pre.length>v.length){ inp.value=pre; return; }
  S.lines.push({t:"$ "+v, cls:"cmd"});
  S.lines.push({t:cands.slice(0,14).join("   "), cls:"dim"});
  renderTerm(S);
}

/* ---------- шпаргалка ---------- */
const CHEAT=[
 ["Образы","docker pull образ · docker images · docker history образ · docker tag src dst · docker rmi образ · docker build -t имя:тег . · docker build --target стадия . · docker push репо/имя:тег"],
 ["Контейнеры","docker run [-d] [-it] [--rm] [--name N] [-p Х:К] [-v И:Ц] [-e K=V] образ [cmd] · docker create · docker start/stop/restart/kill · docker rm [-f] · docker ps [-a] [-q]"],
 ["Внутрь и наружу","docker exec [-it] N cmd · docker logs [--tail N] [-f] N · docker inspect [-f формат] N · docker top N · docker port N · docker cp путь N:путь · docker stats"],
 ["Сети","docker network ls · docker network create имя · docker network connect сеть контейнер · docker network inspect сеть · docker network prune · --network host|none|имя"],
 ["Тома","docker volume create имя · docker volume ls · docker volume inspect имя · docker volume rm имя · docker volume prune · -v имя:/путь · -v /хост:/цель:ro · --tmpfs /tmp"],
 ["Compose","docker compose up -d [--build] · docker compose ps · docker compose logs [-f] [сервис] · docker compose down [-v] · docker compose build"],
 ["Система","docker system df · docker system prune [-a] · docker version · docker info"],
 ["Безопасность","--user UID · --read-only · --cap-drop ALL · --security-opt no-new-privileges · --pids-limit N · --memory 512m · --cpus 1.5 · --restart unless-stopped"],
 ["Оболочка эмулятора","ls · cat файл · pwd · echo текст > файл · rm файл · mkdir · curl http://localhost:порт · history · help · clear · reset"]
];
function showCheat(){
  let ov=document.getElementById("cheatOverlay");
  if(ov){ ov.remove(); return; }
  ov=document.createElement("div");
  ov.id="cheatOverlay";
  ov.setAttribute("style","position:fixed;inset:0;z-index:200;background:rgba(8,16,18,.55);display:flex;align-items:center;justify-content:center;padding:24px");
  const inner=CHEAT.map(([t,c])=>'<div style="margin-bottom:13px"><div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:3px">'+t+'</div><div style="font-family:var(--font-mono);font-size:11.5px;line-height:1.75;color:var(--ink-2)">'+esc(c)+'</div></div>').join("");
  ov.innerHTML='<div style="background:var(--surface);border:1px solid var(--line);border-radius:4px;max-width:720px;width:100%;max-height:82vh;overflow:auto;box-shadow:var(--shadow)">'+
    '<div style="display:flex;align-items:center;padding:13px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface)">'+
    '<b style="font-size:14px">Шпаргалка по командам</b>'+
    '<button id="cheatClose" class="mini" style="margin-left:auto">Закрыть</button></div>'+
    '<div style="padding:16px 18px">'+inner+'</div></div>';
  document.body.appendChild(ov);
  ov.onclick=e=>{ if(e.target===ov||e.target.id==="cheatClose") ov.remove(); };
}

/* ---------- сборка страницы ---------- */
function paintAll(){
  paintRail(); paintHead(); paintTheory(); paintQuiz(); paintLab(); paintProgress();
}

$("#tab-theory").onclick=()=>{ curTab="theory"; paintHead(); };
$("#tab-quiz").onclick=()=>{ curTab="quiz"; paintHead(); };
$("#tab-lab").onclick=()=>{ curTab="lab"; paintHead(); paintLab(); };
$("#prevMod").onclick=()=>{ if(curMod>0){ curMod--; curTab="theory"; curLab=0; paintAll(); window.scrollTo({top:0}); } };
$("#nextMod").onclick=()=>{ if(curMod<MODULES.length-1){ curMod++; curTab="theory"; curLab=0; paintAll(); window.scrollTo({top:0}); } };
$("#showCheat").onclick=showCheat;
$("#resetAll").onclick=()=>{
  if(!confirm("Сбросить весь прогресс: ответы на тесты и отметки о выполненных заданиях?")) return;
  P={quiz:{},labs:{}}; save();
  Object.keys(labStates).forEach(k=>delete labStates[k]);
  curMod=0; curTab="theory"; curLab=0; paintAll();
};
document.querySelectorAll(".vizbar button").forEach(b=>b.onclick=()=>{
  vizTab=b.dataset.viz;
  document.querySelectorAll(".vizbar button").forEach(x=>x.setAttribute("aria-selected",String(x===b)));
  paintViz();
});
$("#termForm").onsubmit=e=>{
  e.preventDefault();
  const inp=$("#termInput"), v=inp.value;
  if(!v.trim()) return;
  inp.value="";
  runCommand(v);
};
$("#termInput").addEventListener("keydown", e=>{
  const {S}=curLabRefs();
  if(e.key==="Tab"){ e.preventDefault(); complete(S); return; }
  if(e.key==="ArrowUp"){
    e.preventDefault();
    if(!S.hist.length) return;
    S.hi = S.hi<0 ? S.hist.length-1 : Math.max(0,S.hi-1);
    e.target.value=S.hist[S.hi];
    return;
  }
  if(e.key==="ArrowDown"){
    e.preventDefault();
    if(S.hi<0) return;
    S.hi++;
    if(S.hi>=S.hist.length){ S.hi=-1; e.target.value=""; }
    else e.target.value=S.hist[S.hi];
  }
  if(e.key==="l" && e.ctrlKey){ e.preventDefault(); S.lines=[]; renderTerm(S); }
});
$("#termOut").addEventListener("click", ()=>$("#termInput").focus());

paintAll();
</script>
