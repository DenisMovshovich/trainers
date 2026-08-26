/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE=rel("../kafka-offline.html");
const b=await chromium.launch({executablePath:EXE});
const errs=[];
for(const [theme,w,h] of [["light",1520,1000],["dark",1520,1000],["light",1100,900],["light",800,900],["light",390,844]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:theme});
  const p=await ctx.newPage();
  const tg="["+theme+" "+w+"] ";
  p.on("pageerror",e=>errs.push(tg+e.message));
  p.on("console",m=>{if(m.type()==="error")errs.push(tg+"console: "+m.text());});
  await p.goto(FILE); await p.waitForTimeout(700);
  const info=await p.evaluate(()=>({
    t:document.title, mods:document.querySelectorAll("#nav button").length,
    prog:document.querySelector("#mtxt").textContent,
    fd:getComputedStyle(document.querySelector(".mark")).fontFamily.split(",")[0],
    fs:getComputedStyle(document.body).fontFamily.split(",")[0],
    fm:getComputedStyle(document.querySelector("#cmd")).fontFamily.split(",")[0],
    bg:getComputedStyle(document.body).backgroundColor, ink:getComputedStyle(document.body).color,
    brokers:document.querySelectorAll("#brokers .brow").length}));
  let maxOx=0, worst="", figs=0, checks=0, quizzes=0;
  for(let i=0;i<12;i++){
    await p.locator("#nav button").nth(i).click(); await p.waitForTimeout(50);
    for(const t of ["theory","quiz","labs"]){
      await p.click('#tabs button[data-tab="'+t+'"]'); await p.waitForTimeout(40);
      const r=await p.evaluate(()=>({ox:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        f:document.querySelectorAll(".fig svg").length, c:document.querySelectorAll(".chk li").length,
        q:document.querySelectorAll(".qc").length}));
      if(t==="theory") figs+=r.f; if(t==="labs") checks+=r.c; if(t==="quiz") quizzes+=r.q;
      if(r.ox>maxOx){maxOx=r.ox; worst="модуль "+(i+1)+"/"+t;}
    }
  }
  // живой прогон задания 1a
  await p.locator("#nav button").nth(0).click(); await p.waitForTimeout(50);
  await p.click('#tabs button[data-tab="labs"]');
  for(const cmd of ["help","kafka-topics --create --topic orders --partitions 3 --replication-factor 2",
                    "kafka-topics --list","kafka-topics --describe --topic orders",
                    "produce --topic orders --records a,b,c","kafka-console-consumer --topic orders --from-beginning"]){
    await p.fill("#cmd", cmd); await p.press("#cmd","Enter"); await p.waitForTimeout(60);
  }
  const lab=await p.evaluate(()=>({st:document.querySelector(".lab .labh .st").textContent,
    done:document.querySelector(".lab").classList.contains("done"),
    meter:document.querySelector("#mtxt").textContent,
    topics:document.querySelectorAll("#topics details").length}));
  await p.fill("#cmd","kafka-magic"); await p.press("#cmd","Enter"); await p.waitForTimeout(80);
  const errShown=await p.evaluate(()=>!!document.querySelector("#out .err"));
  // визуализатор журнала
  await p.click('#dtabs button[data-d="viz"]'); await p.waitForTimeout(120);
  const viz=await p.evaluate(()=>({rows:document.querySelectorAll("#viz .pr").length,
    cells:document.querySelectorAll("#viz .cell").length}));
  const ox2=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(ox2>maxOx){maxOx=ox2; worst="после команд";}
  console.log(theme+" "+w+"×"+h+" | «"+info.t+"» | модулей="+info.mods+" | рис="+figs+" вопр="+quizzes+" пров="+checks+
    " | брокеров="+info.brokers+" топиков="+lab.topics+
    " | шрифты "+info.fd+"/"+info.fs+"/"+info.fm+" | фон "+info.bg+" текст "+info.ink+
    " | задание 1a: "+lab.st+(lab.done?" ✓":" ✗")+" счётчик "+lab.meter+
    " | ошибка: "+(errShown?"да":"НЕТ")+" | журнал: "+viz.rows+" партиций, "+viz.cells+" ячеек"+
    " | перелив "+maxOx+(maxOx?" ("+worst+")":""));
  await ctx.close();
}
await b.close();
if(errs.length){ console.log("\nОШИБКИ:"); errs.slice(0,20).forEach(e=>console.log("  "+e)); process.exit(1); }
console.log("\nошибок в консоли нет");
