/* ============================================================
   Подсветка и разбор файлов
   ============================================================ */
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function hi(text, lang){
  let s = esc(text);
  if(lang==="xml"){
    s = s.replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<span class="c">$1</span>');
    s = s.replace(/(&lt;\/?)([A-Za-z_][\w.-]*)/g,'$1<span class="k">$2</span>');
    s = s.replace(/([A-Za-z_][\w.-]*)=(&quot;[^&]*?&quot;)/g,'<span class="a">$1</span>=<span class="s">$2</span>');
  } else if(lang==="cs"){
    /* Подстановка спанов и подсветка ключевых слов конфликтуют: слово class
       встречается и в коде, и в атрибуте class= вставляемой разметки.
       Поэтому строки и комментарии сначала прячем в плейсхолдеры. */
    const KW = "using|namespace|public|private|protected|internal|static|readonly|const|class|record|struct|"+
               "interface|async|await|return|new|var|void|string|bool|int|double|override|virtual|abstract|"+
               "sealed|partial|if|else|for|foreach|while|try|catch|finally|throw|null|true|false|this|base";
    const box = [];
    const hide = (re, cls) => { s = s.replace(re, m => { box.push('<span class="'+cls+'">'+m+'</span>'); return "\u0000"+(box.length-1)+"\u0000"; }); };
    hide(/&quot;(?:[^&]|&(?!quot;))*?&quot;/g, "s");  /* строки прячем первыми: // внутри них не комментарий */
    hide(/\/\/[^\n]*/g, "c");                       /* комментарии */
    hide(/\[[A-Z][\w.]*(?:\([^\)]*\))?\]/g, "a");   /* атрибуты */
    s = s.replace(new RegExp("\\b("+KW+")\\b","g"), '<span class="k">$1</span>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => box[+i]);
  } else if(lang==="yaml"){
    s = s.replace(/(#.*)$/g,'<span class="c">$1</span>');
    s = s.replace(/^(\s*-?\s*)([A-Za-z_][\w.-]*)(:)/,'$1<span class="k">$2</span>$3');
    s = s.replace(/(&quot;[^&]*?&quot;)/g,'<span class="s">$1</span>');
    s = s.replace(/(\$\([A-Za-z_.]+\))/g,'<span class="a">$1</span>');
  }
  return s;
}

function renderFile(id){
  const f = FILES[id];
  if(!f) return '<div class="note trap">Файл '+esc(id)+' не найден</div>';
  const rows = f.lines.map((l,i)=>{
    const hot = l.k ? ' hot' : '';
    const attr = l.k ? ' data-k="'+esc(l.k)+'" role="button" tabindex="0"' : '';
    return '<div class="row'+hot+'"'+attr+'><span class="ln">'+(i+1)+'</span><span class="cd">'+
           (l.c ? '<span class="tx">'+hi(l.c, f.lang)+'</span>' : "&nbsp;")+'</span></div>';
  }).join("");
  const hotCount = f.lines.filter(l=>l.k).length;
  return '<div class="file" data-file-id="'+esc(id)+'">'+
    '<div class="file-h"><span class="p">'+esc(f.path)+'</span><span class="r">'+esc(f.tag)+'</span></div>'+
    '<div class="code-rows">'+rows+'</div>'+
    '<div class="file-hint">'+hotCount+' строк(и) с пояснением — нажмите на подчёркнутую строку</div>'+
    '<div class="ann" hidden></div></div>';
}

function wireFiles(root){
  root.querySelectorAll(".file").forEach(box=>{
    const f = FILES[box.dataset.fileId];
    const ann = box.querySelector(".ann");
    const open = row=>{
      const k = row.dataset.k;
      const was = row.classList.contains("on");
      box.querySelectorAll(".row.on").forEach(r=>r.classList.remove("on"));
      if(was){ ann.hidden = true; return; }
      row.classList.add("on");
      const n = f.notes[k];
      ann.innerHTML = '<h4>'+esc(n.h)+'</h4>'+n.p.map(p=>'<p>'+p+'</p>').join("");
      ann.hidden = false;
    };
    box.querySelectorAll(".row.hot").forEach(row=>{
      row.onclick = ()=>open(row);
      row.onkeydown = e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); open(row); } };
    });
  });
}

/* ============================================================
   Виджет 1 — совместимость SDK и TFM
   ============================================================ */
const SDKS = ["8.0.404","9.0.100","10.0.302"];
const TFMS = ["net6.0","net7.0","net8.0","net9.0","net10.0","net12.0"];
function widgetTfm(){
  return '<div class="tool" data-w="tfm"><div class="tool-h">Проверка совместимости</div><div class="tool-b">'+
    '<div class="selrow">'+
      '<label style="font-size:12.5px;color:var(--ink-3)">SDK на машине</label>'+
      '<select id="wt-sdk">'+SDKS.map(s=>'<option'+(s==="10.0.302"?" selected":"")+'>'+s+'</option>').join("")+'</select>'+
      '<label style="font-size:12.5px;color:var(--ink-3);margin-left:8px">TargetFramework проекта</label>'+
      '<select id="wt-tfm">'+TFMS.map(t=>'<option'+(t==="net8.0"?" selected":"")+'>'+t+'</option>').join("")+'</select>'+
    '</div><div class="out" id="wt-out"></div></div></div>';
}
function wireTfm(root){
  const box = root.querySelector('[data-w="tfm"]'); if(!box) return;
  const sdk = box.querySelector("#wt-sdk"), tfm = box.querySelector("#wt-tfm"), out = box.querySelector("#wt-out");
  const upd = ()=>{
    const sMaj = parseInt(sdk.value,10);
    const tMaj = parseInt(tfm.value.replace("net",""),10);
    if(tMaj <= sMaj){
      const extra = tMaj < sMaj
        ? "\nПакет таргетинга для "+tfm.value+" приедет из NuGet:\n  ~/.nuget/packages/microsoft.netcore.app.ref/"+tMaj+".0.x/"
        : "";
      out.innerHTML = '<span style="color:#7FCF9F">Соберётся.</span> SDK '+esc(sdk.value)+
        ' умеет собирать под свою версию и любую более раннюю.'+esc(extra)+
        (tfm.value==="net8.0"&&sdk.value==="10.0.302" ? '\n\nЭто ровно ваш случай — проверено на Acme.WebAutomation.' : '');
    } else {
      out.innerHTML = '<span style="color:#F08C7E">Не соберётся.</span>\n\n'+
        esc('error NETSDK1045: The current .NET SDK does not support targeting .NET '+tMaj+'.0.\n'+
            'Either target .NET '+sMaj+'.0 or lower, or use a version of the .NET SDK that supports .NET '+tMaj+'.0.');
    }
  };
  sdk.onchange = upd; tfm.onchange = upd; upd();
}

/* ============================================================
   Виджет 2 — конструктор команд dotnet
   ============================================================ */
const VERBS = [
 {id:"build", t:"build", why:"Компилирует проект. Неявно выполняет restore."},
 {id:"test",  t:"test",  why:"Прогоняет тесты. Неявно выполняет restore и build."},
 {id:"restore",t:"restore",why:"Только разрешение и загрузка зависимостей."},
 {id:"publish",t:"publish",why:"Готовит набор файлов к развёртыванию в подкаталог publish/."},
 {id:"clean", t:"clean", why:"Удаляет известные результаты сборки."}
];
const TARGETS = [
 {id:"sln", t:"(решение целиком)", txt:"", why:"Без пути берётся единственный .sln или .csproj в текущем каталоге — здесь это WebAutomation.sln, то есть все три проекта."},
 {id:"portal", t:"Portal", txt:"Portal/Portal.csproj", why:"Один проект: 249 обнаруженных тестовых случаев."},
 {id:"vertex", t:"Vertex2025", txt:"Vertex2025/Vertex2025.csproj", why:"Один проект: 285 тестов."},
 {id:"hq", t:"HQ", txt:"HQ/HQ.csproj", why:"Один проект: 3 теста."},
 {id:"dll", t:"собранная .dll", txt:"Portal/bin/Release/net8.0/Portal.dll", why:"Так делает конвейер. Ни restore, ни build не выполняются — берётся готовая сборка."}
];
const OPTS = [
 {id:"cfg", txt:"-c Release", on:["build","test","publish","clean"], why:"Конфигурация Release: оптимизации включены, вывод идёт в bin/Release/. Локальное умолчание — Debug."},
 {id:"nores", txt:"--no-restore", on:["build","test","publish"], why:"Пропустить restore. Ускоряет повторные запуски, но на чистом дереве даст NETSDK1004."},
 {id:"nobuild", txt:"--no-build", on:["test"], why:"Пропустить сборку и взять то, что уже лежит в bin/. Осторожно: легко прогнать устаревший код."},
 {id:"set", txt:"--settings playwright.runsettings", on:["test"], why:"Подключает файл настроек прогона: браузер, число воркеров NUnit."},
 {id:"filter", txt:'--filter "FullyQualifiedName~FooterTests"', on:["test"], why:"Отбирает подмножество тестов. Обязателен при HEADED=1, иначе откроется слишком много окон."},
 {id:"list", txt:"--list-tests", on:["test"], why:"Только перечислить обнаруженные тесты, ничего не запуская. Внимание: --filter при этом игнорируется."},
 {id:"trx", txt:'--logger "trx;LogFileName=test-results.trx"', on:["test"], why:"Отчёт в формате VSTest — его читает Azure DevOps."},
 {id:"nunit", txt:'--logger "nunit;LogFilePath=results.xml"', on:["test"], why:"Отчёт NUnit XML. Нужен там, где важны [Category] и [Property] — TRX их не переносит."},
 {id:"verb", txt:"-v n", on:["build","test","publish","restore"], why:"Подробность вывода normal: видно вызовы компилятора и порядок таргетов."},
 {id:"prop", txt:"-p:TreatWarningsAsErrors=true", on:["build","test","publish"], why:"Любое свойство MSBuild из командной строки. Приоритет выше, чем у csproj."}
];
const ENVS = [
 {id:"rp", txt:"RP_ENABLED=false", why:"Не отправлять результаты локального прогона в ReportPortal."},
 {id:"headed", txt:"HEADED=1", why:"Видимый браузер. Читается адаптером Playwright напрямую."},
 {id:"browser", txt:"BROWSER=firefox", why:"Перекрывает BrowserName из runsettings."},
 {id:"url", txt:"SPACES_URL=https://www.example.com/", why:"Другой стенд. Читается TestConfig.BaseUrl."},
 {id:"auth", txt:"BASIC_AUTH_USERNAME=… BASIC_AUTH_PASSWORD=…", why:"Basic Auth. Для Portal обязателен — без него прогон падает сразу."}
];
let cmdState = {verb:"test", target:"portal", opts:new Set(["set"]), envs:new Set(["rp"])};

function widgetCmd(){
  return '<div class="tool" data-w="cmd"><div class="tool-h">Конструктор команды</div><div class="tool-b">'+
    '<div class="grp"><div class="grp-l">Команда</div><div class="chips" id="wc-verbs"></div></div>'+
    '<div class="grp"><div class="grp-l">Над чем</div><div class="chips" id="wc-targets"></div></div>'+
    '<div class="grp"><div class="grp-l">Флаги</div><div class="chips" id="wc-opts"></div></div>'+
    '<div class="grp"><div class="grp-l">Переменные окружения</div><div class="chips" id="wc-envs"></div></div>'+
    '<div class="out" id="wc-out"></div><div class="expl" id="wc-expl"></div></div></div>';
}
function wireCmd(root){
  const box = root.querySelector('[data-w="cmd"]'); if(!box) return;
  const chip = (t,pressed,d)=>'<button class="chip" aria-pressed="'+pressed+'" data-id="'+d+'">'+esc(t)+'</button>';
  const draw = ()=>{
    box.querySelector("#wc-verbs").innerHTML = VERBS.map(v=>chip("dotnet "+v.t, cmdState.verb===v.id, v.id)).join("");
    box.querySelector("#wc-targets").innerHTML = TARGETS.map(t=>chip(t.t, cmdState.target===t.id, t.id)).join("");
    const avail = OPTS.filter(o=>o.on.includes(cmdState.verb));
    box.querySelector("#wc-opts").innerHTML = avail.length
      ? avail.map(o=>chip(o.txt, cmdState.opts.has(o.id), o.id)).join("")
      : '<span style="font-size:12px;color:var(--ink-3)">для этой команды нечего добавить</span>';
    box.querySelector("#wc-envs").innerHTML = ENVS.map(e=>chip(e.txt, cmdState.envs.has(e.id), e.id)).join("");

    const tgt = TARGETS.find(t=>t.id===cmdState.target);
    const envTxt = ENVS.filter(e=>cmdState.envs.has(e.id)).map(e=>e.txt).join(" ");
    const optTxt = avail.filter(o=>cmdState.opts.has(o.id)).map(o=>o.txt);
    let cmd = (envTxt?envTxt+" ":"")+"dotnet "+VERBS.find(v=>v.id===cmdState.verb).t+
              (tgt.txt?" "+tgt.txt:"")+(optTxt.length?" \\\n  "+optTxt.join(" \\\n  "):"");
    box.querySelector("#wc-out").textContent = cmd;

    const items = [];
    items.push(["dotnet "+VERBS.find(v=>v.id===cmdState.verb).t, VERBS.find(v=>v.id===cmdState.verb).why]);
    items.push([tgt.txt||"(без пути)", tgt.why]);
    avail.filter(o=>cmdState.opts.has(o.id)).forEach(o=>items.push([o.txt.split(" ")[0], o.why]));
    ENVS.filter(e=>cmdState.envs.has(e.id)).forEach(e=>items.push([e.txt.split("=")[0], e.why]));
    if(cmdState.verb==="test" && cmdState.target==="dll" && (cmdState.opts.has("nores")||cmdState.opts.has("nobuild")))
      items.push(["ⓘ", "Для запуска по .dll флаги --no-restore и --no-build избыточны: эти шаги и так не выполняются."]);
    if(cmdState.verb==="test" && cmdState.opts.has("list") && cmdState.opts.has("filter"))
      items.push(["⚠", "--list-tests игнорирует --filter — список будет полным. Проверено на этом репозитории."]);
    if(cmdState.verb==="test" && cmdState.envs.has("headed") && !cmdState.opts.has("filter"))
      items.push(["⚠", "HEADED=1 без --filter откроет окна на все тесты проекта. Добавьте фильтр."]);
    if(cmdState.verb==="test" && cmdState.target==="portal" && !cmdState.envs.has("auth"))
      items.push(["⚠", "Portal бросает исключение, если BASIC_AUTH_* не заданы в окружении."]);
    box.querySelector("#wc-expl").innerHTML = items.map(([a,b])=>'<div><code>'+esc(a)+'</code><span>'+esc(b)+'</span></div>').join("");
  };
  box.addEventListener("click", e=>{
    const b = e.target.closest(".chip"); if(!b) return;
    const grp = b.parentElement.id, id = b.dataset.id;
    if(grp==="wc-verbs"){ cmdState.verb=id; cmdState.opts = new Set([...cmdState.opts].filter(o=>{
      const def = OPTS.find(x=>x.id===o); return def && def.on.includes(id); })); }
    else if(grp==="wc-targets") cmdState.target=id;
    else if(grp==="wc-opts") cmdState.opts.has(id)?cmdState.opts.delete(id):cmdState.opts.add(id);
    else cmdState.envs.has(id)?cmdState.envs.delete(id):cmdState.envs.add(id);
    draw();
  });
  draw();
}

/* ============================================================
   Виджет 3 — конструктор фильтра тестов
   ============================================================ */
const FPROPS = [
 {v:"FullyQualifiedName", why:"Полное имя: пространство имён, класс, метод. Самый надёжный способ отобрать фикстуру."},
 {v:"Name", why:"Только имя метода, без класса и пространства имён."},
 {v:"TestCategory", why:"Значение атрибута [Category]. В NUnit синоним — просто Category."},
 {v:"Priority", why:"Значение атрибута [Priority]. В этом репозитории не используется."}
];
const FOPS = [
 {v:"~", t:"~ содержит", why:"Вхождение подстроки. Регистр учитывается."},
 {v:"=", t:"= равно", why:"Точное совпадение целиком."},
 {v:"!~", t:"!~ не содержит", why:"Отрицание вхождения — удобно, чтобы исключить группу."},
 {v:"!=", t:"!= не равно", why:"Точное исключение."}
];
let fRows = [{p:"FullyQualifiedName", o:"~", v:"FooterTests"}];
let fJoin = "&";
function widgetFilter(){
  return '<div class="tool" data-w="filter"><div class="tool-h">Конструктор фильтра</div><div class="tool-b">'+
    '<div id="wf-rows"></div>'+
    '<div class="selrow" style="margin-top:9px">'+
      '<button class="chip" id="wf-add">+ условие</button>'+
      '<span style="font-size:12px;color:var(--ink-3);margin-left:6px">соединять:</span>'+
      '<button class="chip" data-join="&amp;">И (&amp;)</button><button class="chip" data-join="|">ИЛИ (|)</button>'+
    '</div>'+
    '<div class="out" id="wf-out"></div><div class="expl" id="wf-expl"></div></div></div>';
}
function wireFilter(root){
  const box = root.querySelector('[data-w="filter"]'); if(!box) return;
  const draw = ()=>{
    box.querySelector("#wf-rows").innerHTML = fRows.map((r,i)=>
      '<div class="selrow" style="margin-bottom:6px">'+
        '<select data-i="'+i+'" data-f="p">'+FPROPS.map(p=>'<option'+(p.v===r.p?" selected":"")+'>'+p.v+'</option>').join("")+'</select>'+
        '<select data-i="'+i+'" data-f="o">'+FOPS.map(o=>'<option value="'+o.v+'"'+(o.v===r.o?" selected":"")+'>'+esc(o.t)+'</option>').join("")+'</select>'+
        '<input type="text" data-i="'+i+'" data-f="v" value="'+esc(r.v)+'">'+
        (fRows.length>1?'<button class="chip" data-del="'+i+'">×</button>':'')+
      '</div>').join("");
    box.querySelectorAll("[data-join]").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.join===fJoin)));
    const expr = fRows.map(r=>r.p+r.o+r.v).join(fJoin);
    box.querySelector("#wf-out").textContent = 'dotnet test Portal/Portal.csproj --settings playwright.runsettings \\\n  --filter "'+expr+'"';
    const items = fRows.map(r=>{
      const p = FPROPS.find(x=>x.v===r.p), o = FOPS.find(x=>x.v===r.o);
      return [r.p+r.o+r.v, p.why+" "+o.why];
    });
    if(fRows.length>1) items.push([fJoin, fJoin==="&" ? "Все условия должны выполняться одновременно." : "Достаточно любого из условий."]);
    if(fRows.some(r=>r.p==="TestCategory"))
      items.push(["⚠","В Vertex2025 атрибут [Category] стоит лишь у 3 фикстур из 12 — фильтр по категории отберёт далеко не все тесты. В Portal размечены 32 из 33."]);
    if(fRows.some(r=>/\*/.test(r.v)))
      items.push(["⚠","Звёздочка в синтаксисе фильтров VSTest не работает как подстановка. Для «содержит» используйте оператор ~."]);
    box.querySelector("#wf-expl").innerHTML = items.map(([a,b])=>'<div><code>'+esc(a)+'</code><span>'+esc(b)+'</span></div>').join("");
  };
  box.addEventListener("change", e=>{
    const el = e.target; if(el.dataset.i===undefined) return;
    fRows[+el.dataset.i][el.dataset.f] = el.value; draw();
  });
  box.addEventListener("input", e=>{
    const el = e.target; if(el.dataset.f!=="v") return;
    fRows[+el.dataset.i].v = el.value; draw();
  });
  box.addEventListener("click", e=>{
    const b = e.target.closest("button"); if(!b) return;
    if(b.id==="wf-add"){ fRows.push({p:"FullyQualifiedName",o:"~",v:""}); draw(); }
    else if(b.dataset.del!==undefined){ fRows.splice(+b.dataset.del,1); draw(); }
    else if(b.dataset.join){ fJoin = b.dataset.join==="&amp;" ? "&" : b.dataset.join; draw(); }
  });
  draw();
}

const WIDGETS = {tfm:[widgetTfm,wireTfm], cmd:[widgetCmd,wireCmd], filter:[widgetFilter,wireFilter]};
