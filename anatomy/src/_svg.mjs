/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const b=await chromium.launch({executablePath:EXE});
const ctx=await b.newContext({viewport:{width:1500,height:1000}}); const p=await ctx.newPage();
await p.goto("file://"+process.cwd()+"/anatomy-offline.html"); await p.waitForTimeout(900);
let bad=[];
for(let i=1;i<7;i++){
  await p.locator(".tb").nth(i).click(); await p.waitForTimeout(200);
  const name=await p.locator(".tb").nth(i).innerText();
  const r=await p.evaluate(()=>{const out=[];document.querySelectorAll(".fig svg").forEach((s,k)=>{const vb=s.viewBox.baseVal;
    s.querySelectorAll("text").forEach(t=>{const bb=t.getBBox();
      if(bb.x<-1||bb.x+bb.width>vb.width+1||bb.y+bb.height>vb.height+1) out.push("«"+t.textContent.slice(0,36)+"» "+Math.round(bb.x+bb.width)+"/"+vb.width);});});return out;});
  r.forEach(x=>bad.push(name+": "+x));
}
console.log(bad.length?("текст за границами:\n  "+bad.join("\n  ")):"весь текст схем помещается в viewBox");
// повторная проверка обёртки без учёта регистра
await p.evaluate(()=>document.querySelectorAll(".node.dir").forEach(d=>{if(d.querySelector(".ic").textContent==="▸")d.click();}));
await p.waitForTimeout(150);
await p.click('[data-file="Pages/ContactFormPage.cs"]'); await p.waitForTimeout(250);
await p.locator('.mem[data-mn="EmailFieldLocator"]').click(); await p.waitForTimeout(150);
const t=(await p.locator("#inspB").innerText()).toLowerCase();
console.log("обёртка распознана:", t.includes("обёртка"), "| цель показана:", t.includes("#email"), "| объяснено зачем:", t.includes("не узнавая селектора"));
await b.close();
