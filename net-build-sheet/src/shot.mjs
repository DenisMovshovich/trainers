/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE=rel("../net-build-sheet-offline.html");
const b=await chromium.launch({executablePath:EXE});
for(const [name,theme,idx,act,scroll] of [["n1","light",14,"loc",900],["n2","dark",19,"iv",300],["n3","light",16,"flaky",700]]){
  const ctx=await b.newContext({viewport:{width:1440,height:960},colorScheme:theme,deviceScaleFactor:2});
  const p=await ctx.newPage(); await p.goto(FILE); await p.waitForTimeout(700);
  await p.evaluate(k=>{const e=document.querySelectorAll("#secList [data-i]")[k]; if(e) e.click();}, idx);
  await p.waitForTimeout(150);
  if(act==="loc"){ await p.locator(".lbtn").nth(7).click(); await p.waitForTimeout(100); }
  if(act==="flaky"){ const c=await p.locator(".fsym input").all(); await c[0].check(); await c[8].check(); await p.waitForTimeout(120); }
  if(act==="iv"){ await p.locator(".ivq").first().click(); await p.waitForTimeout(120); }
  if(scroll) await p.evaluate(y=>window.scrollTo(0,y),scroll);
  await p.waitForTimeout(250); await p.screenshot({path:"src/"+name+".png"}); await ctx.close();
}
await b.close(); console.log("готово");
