/* ============================================================
   Интерфейс конспекта
   ============================================================ */
const LS = "dotnet.v1";
const $ = s => document.querySelector(s);

/* детерминированное перемешивание вариантов ответа:
   сид от текста вопроса, чтобы сохранённый прогресс не сбивался между сессиями */
function hash32(str){
  let h = 2166136261>>>0;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h,16777619)>>>0; }
  return h>>>0;
}
(function shuffle(){
  SECTIONS.forEach(s=>s.quiz.forEach(q=>{
    let seed = hash32(q.q);
    const rnd = ()=>{ seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    const idx = q.opts.map((_,i)=>i);
    for(let i=idx.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=idx[i]; idx[i]=idx[j]; idx[j]=t; }
    q.opts = idx.map(i=>q.opts[i]);
    q.a = idx.indexOf(q.a);
  }));
})();

let P = {q:{}};
try{ const raw = localStorage.getItem(LS); if(raw) P = Object.assign({q:{}}, JSON.parse(raw)); }catch(e){}
const save = ()=>{ try{ localStorage.setItem(LS, JSON.stringify(P)); }catch(e){} };

let cur = 0;

const qs = s => (P.q[s.id] = P.q[s.id] || {});
const done = s => s.quiz.filter((_,i)=> qs(s)[i] && qs(s)[i].ok).length;
function totals(){ let d=0,a=0; SECTIONS.forEach(s=>{ a+=s.quiz.length; d+=done(s); }); return {d,a}; }
function paintProgress(){
  const t = totals(), pct = t.a ? Math.round(t.d/t.a*100) : 0;
  $("#pl").textContent = t.d+" / "+t.a;
  $("#pf").style.width = pct+"%";
  $("#pb").setAttribute("aria-valuenow", String(pct));
}

function paintToc(){
  $("#secList").innerHTML = SECTIONS.map((s,i)=>{
    const full = done(s)===s.quiz.length;
    return '<button class="sbtn" data-i="'+i+'" aria-current="'+(i===cur)+'">'+
      '<span class="n">'+String(s.n).padStart(2,"0")+'</span>'+
      '<span><span class="t">'+esc(s.title)+(full?'<i class="ok" title="самопроверка пройдена"></i>':'')+'</span>'+
      '<span class="s">'+esc(s.sub)+'</span></span></button>';
  }).join("");
  $("#secList").querySelectorAll(".sbtn").forEach(b=>b.onclick = ()=>go(+b.dataset.i));
}

function go(i){
  cur = i;
  closeSearch();
  paintSection();
  paintToc();
  window.scrollTo({top:0, behavior:"instant"});
}

function paintSection(){
  const s = SECTIONS[cur];
  $("#kicker").textContent = "Раздел "+String(s.n).padStart(2,"0")+" · "+s.sub;
  $("#stitle").textContent = s.title;
  $("#slede").textContent = s.lede;

  const body = $("#sbody");
  body.innerHTML = s.body;
  body.querySelectorAll("[data-file]").forEach(ph=>{
    const d = document.createElement("div");
    d.innerHTML = renderFile(ph.dataset.file);
    ph.replaceWith(d.firstElementChild);
  });
  body.querySelectorAll("[data-widget]").forEach(ph=>{
    const w = WIDGETS[ph.dataset.widget];
    if(!w) return;
    const d = document.createElement("div");
    d.innerHTML = w[0]();
    ph.replaceWith(d.firstElementChild);
  });
  wireFiles(body);
  Object.values(WIDGETS).forEach(w=>w[1](body));

  paintQuiz();
  paintIv();
  const p = $("#prev"), n = $("#next");
  p.disabled = cur===0; n.disabled = cur===SECTIONS.length-1;
  p.innerHTML = '<span>◀ Назад<span class="sub">'+(cur>0?esc(SECTIONS[cur-1].title):"—")+'</span></span>';
  n.innerHTML = '<span>Далее ▶<span class="sub">'+(cur<SECTIONS.length-1?esc(SECTIONS[cur+1].title):"—")+'</span></span>';
  paintProgress();
}

function paintQuiz(){
  const s = SECTIONS[cur], st = qs(s), d = done(s);
  let h = '<div class="chead"><h2>Самопроверка</h2><span>'+d+' из '+s.quiz.length+'</span></div>';
  if(d===s.quiz.length)
    h = '<div class="chead"><h2>Самопроверка</h2><span style="color:var(--ok)">пройдена полностью</span></div>';
  s.quiz.forEach((q,i)=>{
    const a = st[i] || {picks:[], ok:false};
    h += '<div class="qc"><div class="qn"><span>Вопрос '+(i+1)+'</span>'+(a.ok?'<span style="color:var(--ok)">верно</span>':'')+'</div>'+
         '<p class="qt">'+q.q+'</p><div class="opts">';
    q.opts.forEach((o,j)=>{
      let c = "opt";
      if(a.ok && j===q.a) c += " right";
      else if(a.picks.includes(j) && j!==q.a) c += " wrong";
      h += '<button class="'+c+'" data-q="'+i+'" data-o="'+j+'"'+(a.ok?" disabled":"")+'>'+
           '<span class="mk">'+String.fromCharCode(65+j)+'</span><span>'+o+'</span></button>';
    });
    h += '</div>';
    if(a.picks.length) h += '<div class="why '+(a.ok?"g":"b")+'"><b>'+(a.ok?"Верно. ":"Не то. ")+'</b>'+q.why+'</div>';
    h += '</div>';
  });
  const box = $("#scheck");
  box.innerHTML = h;
  box.querySelectorAll(".opt").forEach(b=>b.onclick = ()=>{
    const i = +b.dataset.q, j = +b.dataset.o;
    const a = st[i] = st[i] || {picks:[], ok:false};
    if(a.ok) return;
    if(!a.picks.includes(j)) a.picks.push(j);
    if(j === s.quiz[i].a) a.ok = true;
    save(); paintQuiz(); paintToc(); paintProgress();
  });
}

function paintIv(){
  const s = SECTIONS[cur], box = $("#siv");
  if(!s.iv || !s.iv.length){ box.innerHTML = ""; box.hidden = true; return; }
  box.hidden = false;
  let h = '<div class="chead"><h2>На собеседовании</h2><span>'+s.iv.length+
          (s.iv.length===1?" вопрос":s.iv.length<5?" вопроса":" вопросов")+'</span></div>';
  s.iv.forEach((c,i)=>{
    h += '<div class="ivc"><button class="ivq" data-i="'+i+'" aria-expanded="false">'+
         '<span class="ivn">'+(i+1)+'</span><span class="ivt">'+c.q+'</span><span class="ivx">показать</span></button>'+
         '<div class="ivb" hidden>'+
           '<div class="ivp"><b>Что проверяют</b>'+c.probe+'</div>'+
           '<div class="iva">'+c.a+'</div>'+
           (c.more && c.more.length
             ? '<div class="ivm"><b>Дальше спросят</b><ul>'+c.more.map(x=>"<li>"+x+"</li>").join("")+'</ul></div>'
             : "")+
         '</div></div>';
  });
  box.innerHTML = h;
  box.querySelectorAll(".ivq").forEach(b2=>b2.onclick=()=>{
    const body = b2.nextElementSibling, open = body.hidden;
    body.hidden = !open;
    b2.setAttribute("aria-expanded", open ? "true" : "false");
    b2.querySelector(".ivx").textContent = open ? "скрыть" : "показать";
  });
}

/* ---------------- поиск ---------------- */
const strip = html => String(html).replace(/<[^>]+>/g," ").replace(/&[a-z]+;/g," ").replace(/\s+/g," ").trim();
const INDEX = SECTIONS.map((s,i)=>({
  i, title:s.title, sub:s.sub,
  text: [s.title, s.sub, s.lede, strip(s.body), s.quiz.map(q=>strip(q.q)).join(" ")].join(" ")
}));

function search(term){
  const t = term.trim().toLowerCase();
  if(t.length < 2){ closeSearch(); return; }
  const hits = [];
  INDEX.forEach(e=>{
    const low = e.text.toLowerCase();
    let pos = low.indexOf(t);
    if(pos < 0) return;
    let n = 0, p = pos;
    while(p >= 0){ n++; p = low.indexOf(t, p+t.length); }
    const from = Math.max(0, pos-70), to = Math.min(e.text.length, pos+t.length+110);
    const snip = (from>0?"…":"")+e.text.slice(from,to)+(to<e.text.length?"…":"");
    hits.push({e, n, snip});
  });
  hits.sort((a,b)=>b.n-a.n);
  $("#rTitle").textContent = hits.length
    ? "Найдено в "+hits.length+" раздел"+(hits.length===1?"е":hits.length<5?"ах":"ах")
    : "Ничего не найдено";
  const rx = new RegExp("("+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");
  $("#rList").innerHTML = hits.map(h=>
    '<button class="hit" data-i="'+h.e.i+'"><div class="hs">Раздел '+String(SECTIONS[h.e.i].n).padStart(2,"0")+
    ' · '+esc(h.e.sub)+' · совпадений: '+h.n+'</div>'+
    '<div class="ht">'+esc(h.e.title)+'</div><div class="hx">'+esc(h.snip).replace(rx,"<mark>$1</mark>")+'</div></button>').join("");
  $("#rList").querySelectorAll(".hit").forEach(b=>b.onclick = ()=>{ $("#q").value=""; go(+b.dataset.i); });
  $("#results").hidden = false;
}
function closeSearch(){ $("#results").hidden = true; }

/* ---------------- шпаргалка ---------------- */
const CHEAT = [
 ["Сборка", "dotnet build · dotnet build Portal/Portal.csproj -c Release · dotnet build --no-incremental · dotnet clean · rm -rf bin obj"],
 ["Зависимости", "dotnet restore · dotnet add … package Имя --version X · dotnet list … package --include-transitive · --outdated · --vulnerable · dotnet nuget locals all --list"],
 ["Тесты", "dotnet test Portal/Portal.csproj --settings playwright.runsettings · --filter \"FullyQualifiedName~FooterTests\" · --list-tests · --logger \"trx;LogFileName=r.trx\" · --no-build · --blame-hang"],
 ["Диагностика MSBuild", "dotnet msbuild Проект -getProperty:TargetFramework · -getItem:Compile · dotnet build -v n · dotnet build -bl · dotnet --info · dotnet --list-sdks"],
 ["Решение", "dotnet sln list · dotnet sln add Проект · dotnet sln remove Проект · dotnet sln migrate"],
 ["Переменные этого репозитория", "SPACES_URL · REGUS2025_URL · HQ_URL · BASIC_AUTH_USERNAME · BASIC_AUTH_PASSWORD · BROWSER · HEADED=1 · RP_ENABLED=false"],
 ["Не работают, хотя выглядят рабочими", "HEADLESS — читается только мёртвым свойством TestConfig.Headless · SLOW_MO — не читается ничем · TestRunParameters — ни один тест к ним не обращается"]
];
function cheat(){
  let ov = document.getElementById("ov");
  if(ov){ ov.remove(); return; }
  ov = document.createElement("div");
  ov.id = "ov";
  ov.setAttribute("style","position:fixed;inset:0;z-index:200;background:rgba(10,7,17,.6);display:flex;align-items:center;justify-content:center;padding:24px");
  ov.innerHTML = '<div style="background:var(--surface);border:1px solid var(--line);border-radius:3px;max-width:760px;width:100%;max-height:84vh;overflow:auto">'+
    '<div style="display:flex;align-items:center;padding:13px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface)">'+
      '<b style="font-family:var(--fd);font-size:15px">Шпаргалка команд</b>'+
      '<button class="gbtn" id="ovc" style="margin-left:auto">Закрыть</button></div>'+
    '<div style="padding:16px 18px">'+CHEAT.map(([t,c])=>
      '<div style="margin-bottom:14px"><div style="font-family:var(--fm);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);font-weight:600;margin-bottom:4px">'+esc(t)+'</div>'+
      '<div style="font-family:var(--fm);font-size:11.5px;line-height:1.8;color:var(--ink-2)">'+esc(c)+'</div></div>').join("")+
    '</div></div>';
  document.body.appendChild(ov);
  ov.onclick = e=>{ if(e.target===ov || e.target.id==="ovc") ov.remove(); };
}

/* ---------------- привязка ---------------- */
$("#prev").onclick = ()=>{ if(cur>0) go(cur-1); };
$("#next").onclick = ()=>{ if(cur<SECTIONS.length-1) go(cur+1); };
$("#cheat").onclick = cheat;
$("#reset").onclick = ()=>{
  if(!confirm("Сбросить ответы на все самопроверки?")) return;
  P = {q:{}}; save(); go(0);
};
$("#q").addEventListener("input", e=>search(e.target.value));
document.addEventListener("keydown", e=>{
  if(e.key==="/" && document.activeElement !== $("#q")){ e.preventDefault(); $("#q").focus(); }
  if(e.key==="Escape"){ $("#q").value=""; closeSearch(); const ov=document.getElementById("ov"); if(ov) ov.remove(); }
});

go(0);
</script>
