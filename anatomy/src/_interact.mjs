/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const b=await chromium.launch({executablePath:EXE});
const ctx=await b.newContext({viewport:{width:1500,height:1000}});
const p=await ctx.newPage(); const errs=[];
p.on("pageerror",e=>errs.push(e.message));
await p.goto("file://"+process.cwd()+"/anatomy-offline.html"); await p.waitForTimeout(800);

async function openF(f){ await p.evaluate(()=>document.querySelectorAll(".node.dir").forEach(d=>{if(d.querySelector(".ic").textContent==="▸")d.click();}));
  await p.waitForTimeout(150); await p.click('[data-file="'+f+'"]'); await p.waitForTimeout(200); }

// 1. приватный локатор — разбор CSS
await openF("Pages/CommonElements/HeaderElements.cs");
await p.locator('.mem[data-mn="ProductsButton"]').click(); await p.waitForTimeout(150);
let t=await p.locator("#inspB").innerText();
console.log("① ProductsButton →", t.includes("class содержит")?"CSS разобран":"НЕ разобран", "|",
  t.includes("Только внутри сборки")?"internal объяснён":"internal НЕ объяснён");

// 2. публичная обёртка — должна показать цель и её селектор
await openF("Pages/ContactFormPage.cs");
await p.locator('.mem[data-mn="EmailFieldLocator"]').click(); await p.waitForTimeout(150);
t=await p.locator("#inspB").innerText();
console.log("② EmailFieldLocator →", t.includes("Обёртка")?"обёртка распознана":"НЕ распознана", "|",
  t.includes("#email")?"селектор цели показан":"цель НЕ показана");

// 3. XPath + parent::
await openF("Pages/CommonElements/NavBarElements.cs");
await p.locator('.mem[data-mn="MeetingRoomsButton"]').click(); await p.waitForTimeout(150);
t=await p.locator("#inspB").innerText();
console.log("③ MeetingRoomsButton →", t.includes("parent::")?"XPath разобран":"НЕ разобран", "|",
  t.includes("отрицание")?"not() объяснён":"not() НЕ объяснён");

// 4. тест с атрибутами
await openF("Tests/GeneralPages/GeneralPagesTests.cs");
await p.locator('.mem[data-mn="Page_ShouldRenderCorrectly"]').click(); await p.waitForTimeout(150);
t=await p.locator("#inspB").innerText();
console.log("④ тест →", t.includes("TestCaseSource")?"TestCaseSource объяснён":"нет", "|",
  t.includes("Xray")?"Xray объяснён":"нет", "|", t.includes("Description")?"описание показано":"нет");

// 5. член с комментарием в коде
await openF("Pages/ExplorePage.cs");
await p.locator('.mem[data-mn="WaitForResultCountToStabilizeAsync"]').click(); await p.waitForTimeout(150);
t=await p.locator("#inspB").innerText();
console.log("⑤ WaitForResultCountToStabilize →", t.includes("Комментарий в коде")?"комментарий показан":"нет", "|",
  t.includes("Опрашивает")?"ручное пояснение":"авто");

// 6. поиск
await p.fill("#q","Locator"); await p.waitForTimeout(350);
const hits=await p.locator(".hit").count();
const title=await p.locator("#paneFind h1").innerText();
await p.locator(".hit").first().click(); await p.waitForTimeout(300);
console.log("⑥ поиск 'Locator' →", title, "| переход:", await p.locator("h1").first().innerText());

// 7. проверка, что весь текст в схемах помещается в viewBox
let bad=[];
for(let i=1;i<7;i++){
  await p.locator(".tb").nth(i).click(); await p.waitForTimeout(200);
  const r=await p.evaluate(()=>{const out=[];document.querySelectorAll(".fig svg").forEach((s,k)=>{const vb=s.viewBox.baseVal;
    s.querySelectorAll("text").forEach(t=>{const bb=t.getBBox();
      if(bb.x<-1||bb.x+bb.width>vb.width+1||bb.y+bb.height>vb.height+1)
        out.push("svg"+k+" «"+t.textContent.slice(0,40)+"» правый="+Math.round(bb.x+bb.width)+"/"+vb.width);});});return out;});
  r.forEach(x=>bad.push("вкладка "+i+": "+x));
}
console.log("⑦ текст за границами схем:", bad.length?bad:"нет");
console.log(errs.length?"ОШИБКИ: "+errs.join("; "):"ошибок нет");
await b.close();
