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
const url="file://"+process.cwd()+"/portal-anatomy-offline.html";
for(const [theme,w,h] of [["light",1500,1000],["dark",1500,1000],["light",760,900],["light",390,844]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:theme});
  const p=await ctx.newPage();
  p.on("pageerror",e=>errs.push("["+theme+" "+w+"] "+e.message));
  p.on("console",m=>{if(m.type()==="error")errs.push("["+theme+" "+w+"] console: "+m.text());});
  await p.goto(url); await p.waitForTimeout(900);
  const info=await p.evaluate(()=>({title:document.title, nodes:document.querySelectorAll(".node").length,
    tabs:document.querySelectorAll(".tb").length, font:getComputedStyle(document.querySelector("h1")).fontFamily.split(",")[0],
    bg:getComputedStyle(document.body).backgroundColor}));
  // раскрыть все папки и пройти по КАЖДОМУ файлу
  await p.evaluate(()=>{ document.querySelectorAll(".node.dir").forEach(d=>{ if(d.querySelector(".ic").textContent==="▸") d.click(); }); });
  await p.waitForTimeout(300);
  const files = await p.$$eval("[data-file]", els=>els.map(e=>e.dataset.file));
  let maxOx=0, worst="", membersTotal=0;
  for(const f of files){
    await p.click('[data-file="'+f.replace(/"/g,'\\"')+'"]'); await p.waitForTimeout(30);
    const r=await p.evaluate(()=>({ox:document.documentElement.scrollWidth-document.documentElement.clientWidth,
                                   m:document.querySelectorAll(".mem").length}));
    membersTotal+=r.m;
    if(r.ox>maxOx){maxOx=r.ox; worst=f;}
  }
  // все схемы
  for(let i=1;i<info.tabs;i++){
    await p.click('.tb:nth-child('+(i+1)+')'); await p.waitForTimeout(120);
    const ox=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(ox>maxOx){maxOx=ox; worst="схема "+i;}
  }
  console.log(theme+" "+w+"×"+h+" | "+info.title+" | узлов дерева="+info.nodes+" | вкладок="+info.tabs+
    " | шрифт="+info.font+" | фон="+info.bg+" | файлов пройдено="+files.length+" | членов отрисовано="+membersTotal+
    " | макс. переполнение="+maxOx+(maxOx?" ("+worst+")":""));
  await ctx.close();
}
await b.close();
console.log(errs.length? "ОШИБКИ:\n  "+errs.slice(0,8).join("\n  ") : "ошибок нет");
