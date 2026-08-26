/* ============================================================
   Интерфейс тренажёра
   ============================================================ */
const LS = "restwire.v1";
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

let P = {q:{}, l:{}};
try{ const raw = localStorage.getItem(LS); if(raw) P = Object.assign({q:{},l:{}}, JSON.parse(raw)); }catch(e){}
const save = ()=>{ try{ localStorage.setItem(LS, JSON.stringify(P)); }catch(e){} };

let cur = 0, tab = "th", curLab = 0;
const labs = {};
const key = (m,l) => m.id+"/"+l.id;
function labState(m,l){
  const k = key(m,l);
  if(!labs[k]){ const s = newServer(); try{ l.setup && l.setup(s); }catch(e){} labs[k] = {s, lines:[], hist:[], hi:-1}; }
  return labs[k];
}
function resetLab(m,l){ const s=newServer(); try{ l.setup&&l.setup(s); }catch(e){} labs[key(m,l)] = {s, lines:[], hist:[], hi:-1}; }

const qs = m => (P.q[m.id] = P.q[m.id] || {});
const qDone = m => m.quiz.filter((_,i)=> qs(m)[i] && qs(m)[i].ok).length;
const lDone = m => m.labs.filter(l=>P.l[key(m,l)]).length;
function totals(){ let d=0,a=0; MODULES.forEach(m=>{ a+=m.quiz.length+m.labs.length; d+=qDone(m)+lDone(m); }); return {d,a}; }
function paintProg(){
  const t=totals(), pct = t.a?Math.round(t.d/t.a*100):0;
  $("#pl").textContent = t.d+" / "+t.a;
  $("#pf").style.width = pct+"%";
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
  $("#kick").textContent = "Модуль "+String(m.n).padStart(2,"0")+" · "+m.sub;
  $("#mtitle").textContent = m.title;
  $("#mlede").textContent = m.lede;
  const bq=$("#bqz"), bl=$("#blb");
  bq.textContent = qDone(m)+"/"+m.quiz.length; bq.classList.toggle("ok", qDone(m)===m.quiz.length);
  bl.textContent = lDone(m)+"/"+m.labs.length; bl.classList.toggle("ok", lDone(m)===m.labs.length);
  ["th","qz","lb"].forEach(t=>{ $("#t-"+t).setAttribute("aria-selected", String(tab===t)); $("#p-"+t).hidden = tab!==t; });
  const p=$("#prev"), n=$("#next");
  p.disabled = cur===0; n.disabled = cur===MODULES.length-1;
  p.innerHTML = '<span>◀ Назад<span class="sub">'+(cur>0?esc(MODULES[cur-1].title):"—")+'</span></span>';
  n.innerHTML = '<span>Далее ▶<span class="sub">'+(cur<MODULES.length-1?esc(MODULES[cur+1].title):"—")+'</span></span>';
}
function paintTheory(){ $("#theory").innerHTML = MODULES[cur].theory; }

function paintQuiz(){
  const m = MODULES[cur], st = qs(m), d = qDone(m);
  let h = d===m.quiz.length
    ? '<div class="score"><span class="big" style="color:var(--s2)">'+d+'/'+m.quiz.length+'</span><p>Тест пройден полностью. Переходите к практике.</p></div>'
    : '<div class="score"><span class="big">'+d+'<span style="color:var(--ink3);font-size:16px">/'+m.quiz.length+'</span></span><p>Ошибка не блокирует: объяснение появляется сразу, вопрос остаётся открытым до верного ответа.</p></div>';
  m.quiz.forEach((q,i)=>{
    const a = st[i] || {picks:[], ok:false};
    h += '<div class="qc"><div class="qn"><span>Вопрос '+(i+1)+' из '+m.quiz.length+'</span>'+(a.ok?'<span style="color:var(--s2)">верно</span>':'')+'</div>'+
         '<p class="qt">'+q.q+'</p><div class="opts">';
    q.opts.forEach((o,j)=>{
      let c="opt";
      if(a.ok && j===q.a) c+=" right"; else if(a.picks.includes(j)&&j!==q.a) c+=" wrong";
      h += '<button class="'+c+'" data-q="'+i+'" data-o="'+j+'"'+(a.ok?" disabled":"")+'><span class="mk">'+String.fromCharCode(65+j)+'</span><span>'+o+'</span></button>';
    });
    h += '</div>';
    if(a.picks.length) h += '<div class="why '+(a.ok?"g":"b")+'"><b>'+(a.ok?"Верно. ":"Не то. ")+'</b>'+q.why+'</div>';
    h += '</div>';
  });
  $("#quiz").innerHTML = h;
  $("#quiz").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.q, j=+b.dataset.o;
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
    const done = !!P.l[key(m,l)];
    return '<button class="chip'+(done?" done":"")+'" data-i="'+i+'" aria-current="'+(i===curLab)+'">'+
      '<svg class="tk" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6"/><path d="M4 7.2l2.1 2.1L10 5.4"/></svg>'+esc(l.title)+'</button>';
  }).join("");
  $("#picker").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{ curLab=+b.dataset.i; paintLab(); });
}
function refs(){ const m=MODULES[cur]; const l=m.labs[curLab]; return {m,l,S:labState(m,l)}; }

function paintLab(){
  const {m,l,S} = refs();
  paintPicker();
  $("#brief").innerHTML = l.brief +
    '<div class="tools"><button class="mini" id="bh">Подсказка</button>'+
    '<button class="mini" id="br">Начать заново</button>'+
    '<button class="mini" id="bhelp">help</button></div><div id="hs"></div>';
  $("#bh").onclick = ()=>{ const s=$("#hs"); s.innerHTML = s.innerHTML ? "" : '<div class="hintbox"><b>Подсказка.</b> '+l.hint+'</div>'; };
  $("#br").onclick = ()=>{ resetLab(m,l); paintLab(); };
  $("#bhelp").onclick = ()=>run("help");
  renderTape(S); refreshChecks(); paintSrv(); $("#inp").value="";
}
function renderTape(S){
  const t = $("#tape");
  t.innerHTML = S.lines.length ? S.lines.join("")
    : '<div class="empty">Эмулятор REST-сервера <b>api.example.com</b>. Запросы выполняются по-настоящему: состояние меняется, панель справа обновляется.\n\nПримеры:\n  GET /users\n  GET /users/1\n  POST /auth/token -H \'Content-Type: application/json\' -d \'{"username":"demo","password":"secret"}\'\n\nНаберите help для списка возможностей.</div>';
  t.scrollTop = t.scrollHeight;
}
function paintSrv(){ $("#srv").innerHTML = renderState(refs().S.s); }

const HELP = [
 ["Формат","МЕТОД /путь [-H 'Имя: значение'] [-d 'тело']. Метод можно опустить — тогда GET. Поддерживается и запись в стиле curl."],
 ["Ресурсы","/ · /users · /users/{id} · /users/{id}/posts · /posts · /posts/{id} · /orders · /orders/{id} · /auth/token"],
 ["Параметры","?limit= ?page= ?sort=поле или -поле ?role= ?q= ?userId= ?published="],
 ["Заголовки","Content-Type · Accept · Authorization · If-None-Match · If-Match · Idempotency-Key"],
 ["Учётные данные","demo / secret. Область доступа задаётся полем scope в теле запроса токена."],
 ["Команды","help — эта справка · clear — очистить ленту · reset — начать задание заново"]
];
function run(line){
  const {m,l,S} = refs();
  const cmd = line.trim();
  if(cmd==="clear"){ S.lines=[]; renderTape(S); return; }
  if(cmd==="reset"){ resetLab(m,l); paintLab(); return; }
  if(cmd==="help"){
    S.lines.push('<div class="ex"><div class="lbl">справка</div><pre>'+
      HELP.map(([a,b])=>'<span class="h">'+esc(a)+'</span>\n  '+esc(b)).join("\n\n")+'</pre></div>');
    renderTape(S); return;
  }
  const req = parseRequest(cmd);
  if(req.error){
    S.lines.push('<div class="ex c4"><div class="lbl">клиент</div><pre><span class="c">'+esc(cmd)+'</span>\n\nне удалось разобрать: '+esc(req.error)+'</pre></div>');
    renderTape(S); return;
  }
  let r;
  try{ r = handle(S.s, req); }
  catch(e){ r = {status:500, headers:{"Content-Type":"application/json"}, body:{error:"emulator_failure", detail:e.message}}; }
  S.lines.push(renderExchange(req, r));
  if(S.lines.length>60) S.lines = S.lines.slice(-40);
  if(cmd && S.hist[S.hist.length-1]!==cmd) S.hist.push(cmd);
  S.hi = -1;
  renderTape(S); refreshChecks(); paintSrv();
}

function refreshChecks(){
  const {m,l,S} = refs();
  let n = 0;
  const items = l.checks.map(c=>{
    let ok=false; try{ ok = !!c.test(S.s); }catch(e){ ok=false; }
    if(ok) n++;
    return '<li class="'+(ok?"on":"")+'"><span class="bx"><svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 5.2l2.4 2.4L8.6 2.7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>'+c.label+'</span></li>';
  });
  $("#clist").innerHTML = items.join("");
  $("#cct").textContent = n+"/"+l.checks.length;
  const done = n===l.checks.length;
  $("#cdone").hidden = !done;
  if(done && !P.l[key(m,l)]){ P.l[key(m,l)] = true; save(); paintHead(); paintRail(); paintProg(); paintPicker(); }
}

function paintAll(){ paintRail(); paintHead(); paintTheory(); paintQuiz(); paintLab(); paintProg(); }

$("#t-th").onclick=()=>{ tab="th"; paintHead(); };
$("#t-qz").onclick=()=>{ tab="qz"; paintHead(); };
$("#t-lb").onclick=()=>{ tab="lb"; paintHead(); paintLab(); };
$("#prev").onclick=()=>{ if(cur>0){ cur--; tab="th"; curLab=0; paintAll(); window.scrollTo({top:0}); } };
$("#next").onclick=()=>{ if(cur<MODULES.length-1){ cur++; tab="th"; curLab=0; paintAll(); window.scrollTo({top:0}); } };
$("#reset").onclick=()=>{
  if(!confirm("Сбросить весь прогресс: ответы на тесты и выполненные задания?")) return;
  P={q:{},l:{}}; save(); Object.keys(labs).forEach(k=>delete labs[k]);
  cur=0; tab="th"; curLab=0; paintAll();
};
$("#cheat").onclick=()=>{
  let ov = document.getElementById("ov");
  if(ov){ ov.remove(); return; }
  ov = document.createElement("div"); ov.id="ov";
  ov.setAttribute("style","position:fixed;inset:0;z-index:200;background:rgba(8,10,18,.6);display:flex;align-items:center;justify-content:center;padding:24px");
  const REF = HELP.concat([
   ["Коды","200 OK · 201 Created + Location · 204 No Content · 301 Moved · 304 Not Modified · 400 Bad Request · 401 Unauthorized · 403 Forbidden · 404 Not Found · 405 Method Not Allowed + Allow · 406 Not Acceptable · 409 Conflict · 412 Precondition Failed · 415 Unsupported Media Type · 422 Unprocessable · 429 Too Many Requests + Retry-After"],
   ["Свойства методов","безопасные: GET HEAD OPTIONS · идемпотентные: GET HEAD OPTIONS PUT DELETE · неидемпотентный: POST · PATCH — как получится"]
  ]);
  ov.innerHTML = '<div style="background:var(--surf);border:1px solid var(--line);border-radius:4px;max-width:740px;width:100%;max-height:84vh;overflow:auto">'+
   '<div style="display:flex;align-items:center;padding:13px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surf)">'+
   '<b style="font-family:var(--fd);font-size:15px">Справочник</b><button class="gb" id="ovc" style="margin-left:auto">Закрыть</button></div>'+
   '<div style="padding:16px 18px">'+REF.map(([a,b])=>'<div style="margin-bottom:13px"><div style="font-family:var(--fm);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--acc);font-weight:700;margin-bottom:3px">'+esc(a)+'</div><div style="font-family:var(--fm);font-size:11.5px;line-height:1.75;color:var(--ink2)">'+esc(b)+'</div></div>').join("")+'</div></div>';
  document.body.appendChild(ov);
  ov.onclick = e=>{ if(e.target===ov||e.target.id==="ovc") ov.remove(); };
};
$("#form").onsubmit = e=>{ e.preventDefault(); const v=$("#inp").value; if(!v.trim()) return; $("#inp").value=""; run(v); };
$("#inp").addEventListener("keydown", e=>{
  const {S} = refs();
  if(e.key==="Tab"){
    e.preventDefault();
    const v = e.target.value;
    if(!v.trim()) return;
    const c = [...new Set(SUGGEST.filter(x=>x.toLowerCase().startsWith(v.toLowerCase())))];
    if(!c.length) return;
    if(c.length===1){ e.target.value = c[0]; return; }
    let pre = c[0];
    c.forEach(x=>{ let i=0; while(i<pre.length&&i<x.length&&pre[i].toLowerCase()===x[i].toLowerCase()) i++; pre = pre.slice(0,i); });
    if(pre.length>v.length){ e.target.value = pre; return; }
    S.lines.push('<div class="ex"><div class="lbl">варианты</div><pre>'+c.slice(0,8).map(x=>esc(x)).join("\n")+'</pre></div>');
    renderTape(S); return;
  }
  if(e.key==="ArrowUp"){ e.preventDefault(); if(!S.hist.length) return;
    S.hi = S.hi<0 ? S.hist.length-1 : Math.max(0,S.hi-1); e.target.value = S.hist[S.hi]; return; }
  if(e.key==="ArrowDown"){ e.preventDefault(); if(S.hi<0) return;
    S.hi++; if(S.hi>=S.hist.length){ S.hi=-1; e.target.value=""; } else e.target.value = S.hist[S.hi]; }
});
$("#tape").addEventListener("click", ()=>$("#inp").focus());

paintAll();
</script>
