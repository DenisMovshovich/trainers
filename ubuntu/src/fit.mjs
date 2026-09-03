/* Правая колонка не должна уходить под нижнюю панель. */
let chromium;
try { ({ chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core")); }
catch (e) { console.error("playwright-core не найден"); process.exit(2); }
const EXE = process.env.CHROMIUM_PATH || undefined;
const FILE = new URL("../ubuntu-offline.html", import.meta.url).href;

let b;
try { b = await chromium.launch({executablePath: EXE}); }
catch (e) { console.error("браузер не запустился"); process.exit(2); }

let bad = 0;
for(const [w, h] of [[1540,1000],[1440,900],[1280,820],[1200,760],[1140,700]]){
  const ctx = await b.newContext({viewport:{width:w,height:h}});
  const p = await ctx.newPage();
  await p.goto(FILE);
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const rail = document.querySelector(".rail"), dock = document.querySelector(".dock");
    const btn = document.querySelector("#reset");
    const dockh = getComputedStyle(document.documentElement).getPropertyValue("--dockh").trim();
    return {
      dockh,
      btnBottom: Math.round(btn.getBoundingClientRect().bottom),
      dockTop: Math.round(dock.getBoundingClientRect().top),
      railH: Math.round(rail.getBoundingClientRect().height),
      svcScrolls: (() => { const n = document.querySelector("#rsvc"); return n.scrollHeight > n.clientHeight; })()
    };
  });
  const ok = r.btnBottom <= r.dockTop;
  if(!ok) bad++;
  console.log(w + "×" + h + " | --dockh=" + r.dockh + " | низ кнопки " + r.btnBottom +
              " · верх панели " + r.dockTop + " → " + (ok ? "ок" : "НАЛОЖЕНИЕ") +
              " | высота колонки " + r.railH + " | список служб прокручивается: " + (r.svcScrolls ? "да" : "нет"));
  await ctx.close();
}
await b.close();
if(bad){ console.log("раскладка: " + bad + " наложений"); process.exit(1); }
