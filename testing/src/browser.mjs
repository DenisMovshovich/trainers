/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE=rel("../testing-offline.html");
const b=await chromium.launch({executablePath:EXE});
const errs=[];
for(const [theme,w,h] of [["light",1540,1000],["dark",1540,1000],["light",1120,900],["light",820,900],["light",390,844]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:theme});
  const p=await ctx.newPage();
  const tg="["+theme+" "+w+"] ";
  p.on("pageerror",e=>errs.push(tg+e.message));
  p.on("console",m=>{if(m.type()==="error")errs.push(tg+"console: "+m.text());});
  await p.goto(FILE); await p.waitForTimeout(700);
  const info=await p.evaluate(()=>({
    t:document.title, mods:document.querySelectorAll("#nav button").length,
    fd:getComputedStyle(document.querySelector(".mark")).fontFamily.split(",")[0],
    fs:getComputedStyle(document.body).fontFamily.split(",")[0],
    fm:getComputedStyle(document.querySelector("#bmin")).fontFamily.split(",")[0],
    bg:getComputedStyle(document.body).backgroundColor, ink:getComputedStyle(document.body).color,
    gl:document.querySelectorAll("#gl details").length}));
  let maxOx=0, worst="", figs=0, checks=0, quizzes=0, ivs=0, exs=0;
  for(let i=0;i<12;i++){
    await p.locator("#nav button").nth(i).click(); await p.waitForTimeout(45);
    for(const t of ["theory","quiz","labs","iv"]){
      await p.click('#tabs button[data-tab="'+t+'"]'); await p.waitForTimeout(35);
      const r=await p.evaluate(()=>({ox:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        f:document.querySelectorAll(".fig svg").length, c:document.querySelectorAll(".chk li").length,
        q:document.querySelectorAll(".qc").length, v:document.querySelectorAll(".ivc").length,
        e:document.querySelectorAll(".ex").length}));
      if(t==="theory") figs+=r.f; if(t==="labs"){ checks+=r.c; exs+=r.e; }
      if(t==="quiz") quizzes+=r.q; if(t==="iv") ivs+=r.v;
      if(r.ox>maxOx){maxOx=r.ox; worst="раздел "+(i+1)+"/"+t;}
    }
  }
  // ни одна скрытая панель и ни один скрытый инструмент не должны просачиваться
  const leaks=[];
  for(const t of ["theory","quiz","labs","iv"]){
    await p.click('#tabs button[data-tab="'+t+'"]'); await p.waitForTimeout(40);
    const seen=await p.evaluate(()=>["theory","quiz","labs","iv"].filter(x=>document.querySelector("#pane-"+x).offsetParent!==null));
    if(seen.length!==1||seen[0]!==t) leaks.push("вкладка "+t+" → видно "+seen.join(","));
  }
  for(const d of ["bva","pw","sev"]){
    await p.click('#dtabs button[data-d="'+d+'"]'); await p.waitForTimeout(40);
    const seen=await p.evaluate(()=>["bva","pw","sev"].filter(x=>document.querySelector("#t-"+x).offsetParent!==null));
    if(seen.length!==1||seen[0]!==d) leaks.push("инструмент "+d+" → видно "+seen.join(","));
  }
  if(leaks.length) errs.push(tg+"утечка панелей: "+leaks.join(" · "));
  await p.click('#dtabs button[data-d="bva"]'); await p.waitForTimeout(40);

  // живое выполнение задания 4a
  await p.locator("#nav button").nth(3).click(); await p.waitForTimeout(50);
  await p.click('#tabs button[data-tab="labs"]');
  await p.fill('.lab input[type=text]', "0, 1, 99, 100'".replace("'","")); await p.waitForTimeout(150);
  const lab=await p.evaluate(()=>({st:document.querySelector(".lab .labh .st").textContent,
    done:document.querySelector(".lab").classList.contains("done"), meter:document.querySelector("#mtxt").textContent}));
  // инструменты
  await p.click("#brun"); await p.waitForTimeout(120);
  const bv=await p.evaluate(()=>(document.querySelector("#bout pre")||{}).textContent||"");
  await p.click('#dtabs button[data-d="pw"]'); await p.waitForTimeout(60);
  await p.click("#pwrun"); await p.waitForTimeout(250);
  const pw=await p.evaluate(()=>({rows:document.querySelectorAll("#pwout table tr").length-1,
    sum:(document.querySelector("#pwout .sum")||{}).textContent||""}));
  await p.click('#dtabs button[data-d="sev"]'); await p.waitForTimeout(80);
  const sev=await p.evaluate(()=>document.querySelectorAll("#sevout .mx td").length);
  // раскрытие карточки собеседования
  await p.click('#tabs button[data-tab="iv"]'); await p.waitForTimeout(50);
  await p.locator(".ivq").first().click(); await p.waitForTimeout(80);
  const ivOpen=await p.evaluate(()=>!document.querySelector(".ivb").hidden);
  // поиск по глоссарию
  let gf=0;
  if(w>1120){ await p.fill("#gsearch","severity"); await p.waitForTimeout(120);
    gf=await p.evaluate(()=>document.querySelectorAll("#gl details").length); }
  const ox2=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(ox2>maxOx){maxOx=ox2; worst="после действий";}
  console.log(theme+" "+w+"×"+h+" | «"+info.t+"» | разделов="+info.mods+" | рис="+figs+" вопр="+quizzes+
    " пров="+checks+" упр="+exs+" собес="+ivs+" глоссарий="+info.gl+
    " | шрифты "+info.fd+"/"+info.fs+"/"+info.fm+" | фон "+info.bg+" текст "+info.ink+
    " | задание 4a: "+lab.st+(lab.done?" ✓":" ✗")+" счётчик "+lab.meter+
    " | границы: "+(/две точки/.test(bv)?"да":"НЕТ")+" | попарно: "+pw.rows+" строк"+
    " | матрица: "+sev+" клеток | карточка раскрылась: "+(ivOpen?"да":"НЕТ")+
    (w>1120?" | поиск в глоссарии: "+gf:"")+
    " | перелив "+maxOx+(maxOx?" ("+worst+")":""));
  await ctx.close();
}
await b.close();
if(errs.length){ console.log("\nОШИБКИ:"); errs.slice(0,20).forEach(e=>console.log("  "+e)); process.exit(1); }
console.log("\nошибок в консоли нет");
