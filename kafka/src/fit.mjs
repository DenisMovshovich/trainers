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
let bad=0;
for(const [w,h] of [[1520,1000],[1440,900],[1280,820],[1200,760],[1140,700],[1101,660]]){
  const ctx=await b.newContext({viewport:{width:w,height:h}}); const p=await ctx.newPage();
  await p.goto(FILE); await p.waitForTimeout(700);
  await p.evaluate(()=>window.scrollTo(0,1200)); await p.waitForTimeout(250);
  const r=await p.evaluate(()=>{
    const rail=document.querySelector(".rail"), dock=document.querySelector(".dock"), btn=document.querySelector("#reset");
    const rb=rail.getBoundingClientRect(), db=dock.getBoundingClientRect(), bb=btn.getBoundingClientRect();
    return {railBottom:Math.round(rb.bottom), dockTop:Math.round(db.top), btnBottom:Math.round(bb.bottom),
            dockh:getComputedStyle(document.documentElement).getPropertyValue("--dockh").trim(),
            schScroll:document.querySelector(".tps").scrollHeight>document.querySelector(".tps").clientHeight};
  });
  const hidden = r.btnBottom === 0 && r.railBottom === 0;
  const overlap = !hidden && r.btnBottom > r.dockTop;
  if(overlap) bad++;
  console.log(w+"×"+h+" | --dockh="+r.dockh+" | низ кнопки "+r.btnBottom+" · верх консоли "+r.dockTop+
    " → "+(overlap?"ПЕРЕКРЫТИЕ":"ок")+" | схема прокручивается: "+(r.schScroll?"да":"нет"));
  await ctx.close();
}
await b.close(); process.exit(bad?1:0);
