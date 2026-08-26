/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE=rel("../git-offline.html");
const b=await chromium.launch({executablePath:EXE});
let bad=0;
for(const [w,h] of [[1540,1000],[1440,900],[1280,820],[1200,760],[1160,700],[1121,660]]){
  const ctx=await b.newContext({viewport:{width:w,height:h}}); const p=await ctx.newPage();
  await p.goto(FILE); await p.waitForTimeout(600);
  await p.fill("#cmd", "git status"); await p.press("#cmd", "Enter"); await p.waitForTimeout(200);
  await p.evaluate(()=>window.scrollTo(0,1400)); await p.waitForTimeout(200);
  const r=await p.evaluate(()=>{
    const rail=document.querySelector(".rail"), dock=document.querySelector(".dock"), gl=document.querySelector("#graph");
    const rb=rail.getBoundingClientRect(), db=dock.getBoundingClientRect(), gb=gl.getBoundingClientRect();
    return {railBottom:Math.round(rb.bottom), dockTop:Math.round(db.top), glH:Math.round(gb.height),
            hidden:getComputedStyle(rail).display==="none",
            dockh:getComputedStyle(document.documentElement).getPropertyValue("--dockh").trim(),
            dockH:Math.round(db.height)};
  });
  const overlap = !r.hidden && r.railBottom > r.dockTop + 1;
  const tiny = !r.hidden && r.glH < 40;
  if(overlap||tiny) bad++;
  console.log(w+"×"+h+" | --dockh="+r.dockh+" (факт "+r.dockH+") | низ графа "+r.railBottom+
    " · верх панели "+r.dockTop+" → "+(r.hidden?"колонка скрыта":overlap?"ПЕРЕКРЫТИЕ":"ок")+
    " | высота графа "+r.glH+(tiny?" — СЛИШКОМ МАЛО":""));
  await ctx.close();
}
await b.close(); process.exit(bad?1:0);
