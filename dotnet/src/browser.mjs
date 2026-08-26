/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE=rel("../dotnet-offline.html");
const b=await chromium.launch({executablePath:EXE});
const errs=[];
for(const [theme,w,h] of [["light",1500,980],["dark",1500,980],["light",1000,900],["light",390,844]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:theme});
  const p=await ctx.newPage();
  const tg="["+theme+" "+w+"] ";
  p.on("pageerror",e=>errs.push(tg+e.message));
  p.on("console",m=>{if(m.type()==="error")errs.push(tg+"console: "+m.text());});
  await p.goto(FILE); await p.waitForTimeout(700);
  const n=await p.evaluate(()=>document.querySelectorAll("#secList [data-i]").length ||
                                document.querySelectorAll("#secList button, #secList a, #secList .ti").length);
  let maxOx=0,worst="",figs=0,quiz=0,ivs=0,files=0,wdg=0;
  for(let i=0;i<20;i++){
    await p.evaluate(k=>{ const el=document.querySelectorAll("#secList [data-i]")[k]||document.querySelectorAll("#secList *[data-i]")[k]; if(el) el.click(); }, i);
    await p.waitForTimeout(90);
    const r=await p.evaluate(()=>({
      ox:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      f:document.querySelectorAll(".fig svg").length, q:document.querySelectorAll(".qc").length,
      v:document.querySelectorAll(".ivc").length, fl:document.querySelectorAll(".file").length,
      w:document.querySelectorAll(".tool").length, t:(document.querySelector("#stitle")||{}).textContent}));
    figs+=r.f; quiz+=r.q; ivs+=r.v; files+=r.fl; wdg+=r.w;
    if(r.ox>maxOx){maxOx=r.ox; worst="раздел "+(i+1);}
  }
  // раскрыть карточку собеседования и проверить конструкторы
  await p.evaluate(()=>{ const el=document.querySelectorAll("#secList [data-i]")[14]; if(el) el.click(); });
  await p.waitForTimeout(120);
  await p.locator(".ivq").first().click(); await p.waitForTimeout(80);
  const ivOpen=await p.evaluate(()=>!document.querySelector(".ivb").hidden);
  await p.locator(".lbtn").first().click(); await p.waitForTimeout(80);
  const locOut=await p.evaluate(()=>{const o=document.querySelector(".lout"); return o&&!o.hidden?o.textContent.slice(0,28):"НЕТ";});
  await p.evaluate(()=>{ const el=document.querySelectorAll("#secList [data-i]")[16]; if(el) el.click(); });
  await p.waitForTimeout(120);
  await p.locator(".fsym input").first().check(); await p.waitForTimeout(100);
  const flOut=await p.evaluate(()=>document.querySelectorAll(".frow").length);
  // клик по подчёркнутой строке разбираемого файла
  await p.evaluate(()=>{ const el=document.querySelectorAll("#secList [data-i]")[15]; if(el) el.click(); });
  await p.waitForTimeout(120);
  await p.locator(".row.hot").first().click(); await p.waitForTimeout(90);
  const ann=await p.evaluate(()=>{const a=document.querySelector(".ann"); return a&&!a.hidden?a.textContent.slice(0,24):"НЕТ";});
  const ox2=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(ox2>maxOx){maxOx=ox2; worst="после действий";}
  console.log(theme+" "+w+"×"+h+" | разделов в оглавлении="+n+" | рис="+figs+" вопр="+quiz+" карточек="+ivs+
    " файлов="+files+" конструкторов="+wdg+
    " | карточка: "+(ivOpen?"раскрылась":"НЕТ")+" | локатор: "+(locOut!=="НЕТ"?"оценка есть":"НЕТ")+
    " | флаки: "+flOut+" причин | пояснение к строке: "+(ann!=="НЕТ"?"есть":"НЕТ")+
    " | перелив "+maxOx+(maxOx?" ("+worst+")":""));
  await ctx.close();
}
await b.close();
if(errs.length){console.log("\nОШИБКИ:");[...new Set(errs)].slice(0,12).forEach(e=>console.log("  "+e));process.exit(1);}
console.log("\nошибок в консоли нет");
