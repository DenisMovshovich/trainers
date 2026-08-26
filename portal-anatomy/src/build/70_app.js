/* ============================================================
   Интерфейс проводника
   ============================================================ */
const $ = s => document.querySelector(s);
const PATHS = Object.keys(MODEL).sort();
let curFile = "Pages/HomePage.cs", curView = null, curMem = null;

/* ---------------- дерево файлов ---------------- */
function tree(){
  const root = {dirs:{}, files:[]};
  PATHS.forEach(p=>{
    const parts = p.split("/");
    let node = root;
    for(let i=0;i<parts.length-1;i++){
      node.dirs[parts[i]] = node.dirs[parts[i]] || {dirs:{}, files:[]};
      node = node.dirs[parts[i]];
    }
    node.files.push(p);
  });
  return root;
}
const open = new Set(["Pages","Tests","Config","Utils","Pages/CommonElements","Tests/ContactForm","Tests/CommonElements","Tests/Explore","Tests/HomePage","Tests/GeneralPages","Scripts"]);
const ICON = {dirOpen:'▾', dirShut:'▸', cs:'◆', md:'¶', json:'{}', yml:'⚙', csproj:'▣', sh:'$'};
function fileIcon(p){
  if(p.endsWith(".cs")) return ICON.cs;
  if(p.endsWith(".md")) return ICON.md;
  if(p.endsWith(".json")) return ICON.json;
  if(p.endsWith(".yml")) return ICON.yml;
  if(p.endsWith(".csproj")) return ICON.csproj;
  if(p.endsWith(".sh")) return ICON.sh;
  return "·";
}
function renderTree(){
  const t = tree();
  let h = "";
  const walk = (node, prefix, depth)=>{
    Object.keys(node.dirs).sort().forEach(d=>{
      const full = prefix ? prefix+"/"+d : d;
      const isOpen = open.has(full);
      h += '<button class="node dir" data-dir="'+esc(full)+'" style="padding-left:'+(12+depth*12)+'px">'+
           '<span class="ic">'+(isOpen?ICON.dirOpen:ICON.dirShut)+'</span><span class="nm">'+esc(d)+'</span></button>';
      if(isOpen) walk(node.dirs[d], full, depth+1);
    });
    node.files.sort().forEach(f=>{
      const v = MODEL[f];
      const name = f.split("/").pop();
      const badge = v.t ? v.t+" т." : (v.cl ? (v.cl[0]? v.cl[0].mem.length+" чл." : "") : v.l+" ст.");
      h += '<button class="node" data-file="'+esc(f)+'" aria-current="'+(f===curFile && !curView)+'" style="padding-left:'+(12+depth*12)+'px">'+
           '<span class="ic">'+fileIcon(f)+'</span><span class="nm">'+esc(name)+'</span><span class="bd">'+esc(badge)+'</span></button>';
    });
  };
  walk(t, "", 0);
  $("#treeBody").innerHTML = h;
  $("#treeStat").textContent = PATHS.length + " файлов";
  $("#treeBody").querySelectorAll("[data-file]").forEach(b=>b.onclick=()=>openFile(b.dataset.file));
  $("#treeBody").querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>{
    const d = b.dataset.dir;
    open.has(d) ? open.delete(d) : open.add(d);
    renderTree();
  });
}

/* ---------------- вкладки ---------------- */
function renderTabs(){
  let h = '<button class="tb" data-view="" aria-selected="'+(!curView)+'">Файл</button>';
  Object.entries(VIEWS).forEach(([k,v])=>{
    h += '<button class="tb" data-view="'+k+'" aria-selected="'+(curView===k)+'">'+esc(v.t)+'</button>';
  });
  $("#tabs").innerHTML = h;
  $("#tabs").querySelectorAll(".tb").forEach(b=>b.onclick=()=>{
    curView = b.dataset.view || null;
    if(curView){ $("#paneView").innerHTML = VIEWS[curView].html(); }
    show();
  });
}
function show(){
  $("#paneFile").hidden = !!curView;
  $("#paneView").hidden = !curView;
  $("#paneFind").hidden = true;
  renderTabs(); renderTree();
  window.scrollTo({top:0, behavior:"instant"});
}

/* ---------------- группировка членов ---------------- */
function memberGroup(m, cls){
  const isLoc = m.t === "ILocator";
  const alias = isLoc ? aliasTarget(m.b) : null;
  const isWrap = isLoc && m.m.includes("public") && alias;
  if(m.a.some(a=>a.startsWith("[Test]"))) return ["tests","Тесты"];
  if(m.a.some(a=>/^\[(SetUp|TearDown|OneTime)/.test(a))) return ["hooks","Подготовка и уборка"];
  if(m.k === "ctor") return ["ctor","Конструктор"];
  if(m.k === "field") return ["fields","Поля и константы"];
  if(isWrap) return ["wrap","Публичные обёртки для Expect()"];
  if(isLoc) return ["loc","Локаторы"];
  if(m.k === "prop") return ["props","Свойства"];
  return ["methods", cls.base === "BaseTest" ? "Вспомогательные методы" : "Действия"];
}
const GROUP_ORDER = ["fields","ctor","props","loc","wrap","methods","hooks","tests"];

function sigHtml(m){
  const mods = m.m.map(x=>'<span class="mod '+(MODS[x]&&/^(public|private|internal|protected)$/.test(x)?x:"other")+'">'+x+'</span>').join(" ");
  const params = m.k==="method"||m.k==="ctor" ? "("+esc(m.p||"")+")" : "";
  return '<span class="sig">'+(m.t?'<span class="ty">'+esc(m.t)+'</span> ':'')+
         '<span class="nmm">'+esc(m.n)+'</span>'+esc(params)+'</span>';
}
function shortHint(m, file){
  const n = NOTES[file];
  if(n && n.mem && n.mem[m.n]) return n.mem[m.n].replace(/<[^>]+>/g,"").slice(0,70);
  if(m.d) return m.d.slice(0,70);
  const desc = m.a.map(a=>a.match(/^\[Description\("([\s\S]*)"\)\]$/)).find(Boolean);
  if(desc) return desc[1].slice(0,70);
  return "";
}

/* ---------------- отрисовка файла ---------------- */
function openFile(p){
  curFile = p; curView = null;
  const v = MODEL[p], n = NOTES[p] || {};
  let h = '<div class="fh"><div class="fp">Portal/'+esc(p)+'</div>'+
    '<span class="role '+(n.role||"doc")+'">'+({page:"page object",test:"тесты",infra:"инфраструктура",cfg:"конфигурация",doc:"документация"}[n.role]||"файл")+'</span>'+
    '<h1>'+esc(n.t||p.split("/").pop())+'</h1>'+
    '<p class="why">'+(n.why||"")+'</p>'+
    '<div class="meta"><span><b>'+v.l+'</b> строк</span>'+
    (v.cl?'<span><b>'+v.cl.length+'</b> класс(ов)</span><span><b>'+v.cl.reduce((a,c)=>a+c.mem.length,0)+'</b> членов</span>':'')+
    (v.t?'<span><b>'+v.t+'</b> тестов</span>':'')+
    (v.r?'<span><b>'+v.r+'</b> × [Retry]</span>':'')+
    (v.x&&v.x.length?'<span>Xray: <b>'+v.x.length+'</b></span>':'')+
    (v.ns?'<span>namespace <b>'+esc(v.ns)+'</b></span>':'')+
    '</div></div>';

  if(n.how) h += '<div class="prose">'+n.how+'</div>';

  if(v.us && v.us.length){
    h += '<h2>Что подключено</h2><div class="prose"><p>'+v.us.map(u=>'<code>'+esc(u)+'</code>').join(" · ")+'</p></div>';
  }

  (v.cl||[]).forEach((c,ci)=>{
    h += '<div class="card"><div class="card-h">'+
      '<span class="chips">'+c.m.map(x=>'<span class="mod '+(/^(public|private|internal|protected)$/.test(x)?x:"other")+'">'+x+'</span>').join(" ")+'</span>'+
      '<span class="cn">'+esc(c.k)+' '+esc(c.n)+'</span>'+
      (c.base?'<span class="cx">наследует '+esc(c.base)+'</span>':'<span class="cx">ничего не наследует</span>')+
      '</div><div class="card-b">';
    if(c.a.length) h += '<div class="chips" style="margin-bottom:9px">'+c.a.map(a=>'<span class="attr" data-attr="'+esc(a)+'">'+esc(a)+'</span>').join("")+'</div>';
    if(c.d) h += '<p style="font-size:13.5px;color:var(--ink2);margin:0 0 10px">'+esc(c.d)+'</p>';

    const groups = {};
    c.mem.forEach(m=>{ const [k,label] = memberGroup(m,c); (groups[k]=groups[k]||{label,items:[]}).items.push(m); });
    GROUP_ORDER.forEach(g=>{
      if(!groups[g]) return;
      h += '<div class="grp"><div class="grp-h">'+esc(groups[g].label)+'<span class="n">'+groups[g].items.length+'</span></div>';
      groups[g].items.forEach(m=>{
        h += '<button class="mem" data-ci="'+ci+'" data-mn="'+esc(m.n)+'" data-ln="'+m.ln+'">'+
             '<span class="chips">'+m.m.slice(0,2).map(x=>'<span class="mod '+(/^(public|private|internal|protected)$/.test(x)?x:"other")+'">'+x+'</span>').join("")+'</span>'+
             sigHtml(m)+'<span class="hint">'+esc(shortHint(m,p))+'</span></button>';
      });
      h += '</div>';
    });
    h += '</div></div>';
  });

  if(!v.cl) h += '<div class="note"><b class="h">Это не C#</b><p>Файл не содержит классов — разбор его роли выше.</p></div>';

  $("#paneFile").innerHTML = h;
  $("#paneFile").querySelectorAll(".mem").forEach(b=>b.onclick=()=>{
    const c = MODEL[p].cl[+b.dataset.ci];
    inspect(p, c, c.mem.find(x=>x.n===b.dataset.mn && x.ln==b.dataset.ln) || c.mem.find(x=>x.n===b.dataset.mn));
    $("#paneFile").querySelectorAll(".mem").forEach(x=>x.removeAttribute("aria-current"));
    b.setAttribute("aria-current","true");
  });
  $("#paneFile").querySelectorAll("[data-attr]").forEach(b=>b.onclick=()=>inspectAttr(b.dataset.attr));
  show();
}

/* ---------------- инспектор ---------------- */
function inspectAttr(a){
  const e = explainAttr(a);
  $("#inspT").textContent = e.name;
  $("#inspB").innerHTML = '<div class="sec"><div class="lb">Атрибут</div><pre><code>'+esc(a)+'</code></pre><p>'+e.text+'</p></div>';
  $("#insp").hidden = false;
}
function inspect(file, cls, m){
  if(!m) return;
  curMem = m;
  $("#inspT").textContent = m.n;
  const n = NOTES[file];
  let h = "";

  h += '<div class="sec"><div class="lb">Объявление · строка '+m.ln+'</div><pre><code>'+
       hiCs(m.m.join(" ")+" "+(m.t?m.t+" ":"")+m.n+(m.k==="method"||m.k==="ctor"?"("+(m.p||"")+")":"")+
       (m.b && m.b!=="{ … }" ? (m.k==="prop"||/=>/.test(m.b)?" => ":" = ")+m.b : ""))+'</code></pre></div>';

  const hand = n && n.mem && n.mem[m.n];
  const desc = (m.a.map(a=>a.match(/^\[Description\("([\s\S]*)"\)\]$/)).find(Boolean)||[])[1];
  h += '<div class="sec"><div class="lb">Что это</div><p>'+(hand || memberKindText(m, cls, file))+'</p>';
  if(desc) h += '<p><b>Из атрибута [Description]:</b> '+esc(desc)+'</p>';
  if(m.d) h += '<p style="border-left:2px solid var(--line);padding-left:9px"><b>Комментарий в коде:</b> '+esc(m.d)+'</p>';
  h += '</div>';

  if(m.m.length){
    h += '<div class="sec"><div class="lb">Модификаторы</div><div class="dec">';
    m.m.forEach(x=>{ const d = MODS[x]; if(d) h += '<div class="k">'+esc(x)+'</div><div class="v"><b>'+esc(d[0])+'.</b> '+d[1]+'</div>'; });
    h += '</div></div>';
  }

  if(m.a.length){
    h += '<div class="sec"><div class="lb">Атрибуты</div><div class="dec">';
    m.a.forEach(a=>{ const e = explainAttr(a); h += '<div class="k">'+esc(e.name)+'</div><div class="v">'+e.text+'</div>'; });
    h += '</div></div>';
  }

  if(m.t === "ILocator"){
    const d = decodeSelector(m.b);
    const al = aliasTarget(m.b);
    if(d.sel){
      h += '<div class="sec"><div class="lb">Разбор селектора · '+(d.kind==="xpath"?"XPath":d.kind==="role"?"по роли":"CSS")+'</div>'+
           '<pre><code>'+esc(d.sel)+'</code></pre><div class="dec">';
      d.notes.concat(d.chain).forEach(([k,v])=>{ h += '<div class="k">'+esc(k)+'</div><div class="v">'+v+'</div>'; });
      h += '</div></div>';
    } else if(al){
      const tgt = al.comp ? null : cls.mem.find(x=>x.n===al.name);
      h += '<div class="sec"><div class="lb">Обёртка</div><p>Собственного селектора нет: свойство отдаёт наружу '+
           (al.comp ? 'локатор <code>'+esc(al.name)+'</code> из компонента <code>'+esc(al.comp)+'</code>. Компонент объявляет свои члены <code>internal</code>, поэтому без такой обёртки тест до него не дотянулся бы.'
                    : 'приватный локатор <code>'+esc(al.name)+'</code> этого же класса. Так тест получает элемент для <code>Expect()</code>, не узнавая селектора.')+'</p>';
      if(tgt){
        const dd = decodeSelector(tgt.b);
        if(dd.sel){
          h += '<div class="lb" style="margin-top:8px">Селектор цели</div><pre><code>'+esc(dd.sel)+'</code></pre><div class="dec">';
          dd.notes.concat(dd.chain).forEach(([k,v])=>{ h += '<div class="k">'+esc(k)+'</div><div class="v">'+v+'</div>'; });
          h += '</div>';
        }
      }
      h += '</div>';
    }
  }

  $("#inspB").innerHTML = h;
  $("#insp").hidden = false;
}
$("#inspX").onclick = ()=>{ $("#insp").hidden = true; };

/* ---------------- поиск ---------------- */
function find(term){
  const t = term.trim().toLowerCase();
  if(t.length < 2){ $("#paneFind").hidden = true; $("#paneFile").hidden = !!curView; $("#paneView").hidden = !curView; return; }
  const hits = [];
  PATHS.forEach(p=>{
    if(p.toLowerCase().includes(t)) hits.push({p, kind:"файл", label:p, sub:(NOTES[p]&&NOTES[p].t)||""});
    (MODEL[p].cl||[]).forEach(c=>{
      if(c.n.toLowerCase().includes(t)) hits.push({p, kind:"класс", label:c.n, sub:p});
      c.mem.forEach(m=>{ if(m.n.toLowerCase().includes(t)) hits.push({p, kind:m.k==="method"?"метод":m.k==="prop"?"свойство":m.k==="field"?"поле":"конструктор", label:m.n, sub:p+" · "+c.n, mem:m.n}); });
    });
  });
  const rx = new RegExp("("+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");
  $("#paneFind").innerHTML = '<h1>Найдено: '+hits.length+'</h1><div class="hits">'+
    hits.slice(0,120).map((x,i)=>'<button class="hit" data-i="'+i+'"><div class="a">'+
      esc(x.label).replace(rx,"<mark>$1</mark>")+' <span style="color:var(--ink3);font-weight:400">— '+x.kind+'</span></div>'+
      '<div class="b">'+esc(x.sub)+'</div></button>').join("")+'</div>'+
      (hits.length>120?'<p class="prose" style="margin-top:10px">Показаны первые 120.</p>':'');
  $("#paneFind").querySelectorAll(".hit").forEach(b=>b.onclick=()=>{
    const x = hits[+b.dataset.i];
    $("#q").value = "";
    openFile(x.p);
    if(x.mem){
      const btn = [...document.querySelectorAll(".mem")].find(e=>e.dataset.mn===x.mem);
      if(btn){ btn.click(); btn.scrollIntoView({block:"center"}); }
    }
  });
  $("#paneFile").hidden = true; $("#paneView").hidden = true; $("#paneFind").hidden = false;
}
$("#q").addEventListener("input", e=>find(e.target.value));
document.addEventListener("keydown", e=>{
  if(e.key==="/" && document.activeElement !== $("#q")){ e.preventDefault(); $("#q").focus(); }
  if(e.key==="Escape"){ $("#insp").hidden = true; $("#q").value=""; find(""); }
});

openFile(curFile);
</script>
