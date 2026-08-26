/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const b=await chromium.launch({executablePath:EXE});
const errs=[];
for(const [w,h] of [[1500,1000],[900,900],[390,844]]){
  const ctx=await b.newContext({viewport:{width:w,height:h}});
  const p=await ctx.newPage();
  p.on("pageerror",e=>errs.push("["+w+"] "+e.message));
  await p.goto("file://"+process.cwd()+"/portal-anatomy-offline.html"); await p.waitForTimeout(800);
  let maxOx=0, worst="";
  const names=await p.$$eval(".tb",els=>els.map(e=>e.textContent));
  for(let i=0;i<names.length;i++){
    const tb=p.locator(".tb").nth(i);
    await tb.scrollIntoViewIfNeeded();
    await tb.click({timeout:5000});
    await p.waitForTimeout(120);
    const ox=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(ox>maxOx){maxOx=ox; worst=names[i];}
  }
  console.log(w+"×"+h+" | вкладок пройдено: "+names.length+" | макс. переполнение: "+maxOx+(maxOx?" ("+worst+")":""));
  await ctx.close();
}
await b.close();
console.log(errs.length?"ОШИБКИ: "+errs.join("; "):"ошибок нет");
