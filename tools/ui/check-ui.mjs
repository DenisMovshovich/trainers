/* Проверка общего слоя интерфейса по всем материалам сразу.
   Работает по собранному сайту: сначала ./tools/build-site.sh, потом этот файл.
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера */
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core"));
} catch (e) {
  console.error("playwright-core не найден. Установите: npm i -D playwright-core && npx playwright install chromium");
  console.error("или укажите путь: PLAYWRIGHT_CORE=/путь/к/playwright-core/index.mjs");
  process.exit(2);
}
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const SLUGS = ["docker","rest","bash","sql","kafka","network","testing","git","k8s","cicd","csharp","dotnet","anatomy"];
const WIDE = [1540, 1000], NARROW = [390, 844];

let b;
try {
  b = await chromium.launch({executablePath: EXE});
} catch (e) {
  console.error("браузер не запустился: " + String(e.message || e).split("\n")[0]);
  console.error("поставьте его — npx playwright install chromium — или укажите CHROMIUM_PATH");
  process.exit(2);
}
let bad = 0;
const problems = [];
const note = (slug, msg) => { problems.push(slug + ": " + msg); bad++; };

for(const slug of SLUGS){
  const ctx = await b.newContext({viewport: {width: WIDE[0], height: WIDE[1]}});
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if(m.type() === "error") errs.push("console: " + m.text()); });
  await p.goto(rel("../../docs/" + slug + "/index.html"));
  await p.waitForTimeout(500);

  const base = await p.evaluate(() => {
    const skip = document.querySelector(".ui-skip");
    const tabs = [].slice.call(document.querySelectorAll('[role="tab"][data-ui-tab]'));
    const wired = tabs.filter(t => {
      const c = t.getAttribute("aria-controls");
      const pane = c && document.getElementById(c);
      return pane && pane.getAttribute("role") === "tabpanel" && pane.getAttribute("aria-labelledby") === t.id;
    });
    return {
      skip: !!skip && skip.getAttribute("href") === "#" + (document.querySelector("main") || {}).id,
      live: !!document.querySelector('[role="status"][aria-live="polite"]'),
      tabs: tabs.length, wired: wired.length,
      nav: document.querySelectorAll("#nav button, #rail button").length,
      updown: !!document.querySelector(".ui-updown"),
      badges: document.querySelectorAll(".ui-nav-pct, .ui-nav-bar").length,
      badgeKind: document.querySelector(".ui-nav-bar") ? "черта" : (document.querySelector(".ui-nav-pct") ? "цифры" : "нет"),
      sections: (typeof MODULES !== "undefined" ? MODULES.length : 0),
      searchBtn: [].slice.call(document.querySelectorAll("button")).some(x => x.textContent.trim() === "Поиск"),
      title: document.title
    };
  });

  if(!base.skip) note(slug, "нет ссылки «к содержанию» или она ведёт не в main");
  if(!base.live) note(slug, "нет области живых сообщений");
  if(base.sections > 1 && base.badges < base.sections)
    note(slug, "прогресс показан не у всех разделов: " + base.badges + " из " + base.sections);
  if(base.tabs > 1 && base.wired !== base.tabs) note(slug, "вкладки связаны с панелями не полностью: " + base.wired + " из " + base.tabs);

  /* ── клавиатура: вкладки ── */
  if(base.tabs > 1){
    await p.evaluate(() => {
      document.querySelector('[role="tab"][data-ui-tab]').focus();
    });
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(120);
    const moved = await p.evaluate(() => {
      const t = [].slice.call(document.querySelectorAll('[role="tab"][data-ui-tab]'));
      return t[1] && t[1].getAttribute("aria-selected") === "true";
    });
    if(!moved) note(slug, "стрелка вправо не переключает вкладку");
  }

  /* ── клавиатура: разделы ── */
  let stepped = "нет разделов";
  if(base.nav > 1){
    const before = await p.evaluate(() => document.title);
    await p.evaluate(() => document.body.focus());
    await p.keyboard.press("]");
    await p.waitForTimeout(220);
    const after = await p.evaluate(() => document.title);
    stepped = before !== after ? "да" : "НЕТ";
    if(before === after) note(slug, "клавиша ] не переходит к следующему разделу");
    await p.keyboard.press("[");
    await p.waitForTimeout(180);
    if(!base.updown) note(slug, "нет блока «предыдущий / следующий»");
  }

  /* ── поиск ── */
  let found = "нет";
  const own = await p.evaluate(() => !!(document.querySelector("header, .tbar, .top, .bar") || {querySelector:()=>null})
    .querySelector('input[type="text"], input[type="search"]'));
  const hasIndex = await p.evaluate(() => {
    try{ return typeof MODULES !== "undefined" || typeof SECTIONS !== "undefined"; }catch(e){ return false; }
  });
  if(own){
    /* у материала свой поиск в шапке — слой не должен перехватывать «/» */
    await p.evaluate(() => document.activeElement.blur());
    await p.keyboard.press("/");
    await p.waitForTimeout(150);
    const mine = await p.evaluate(() => !document.querySelector(".ui-modal").hidden);
    const theirs = await p.evaluate(() => {
      const a = document.activeElement;
      return a && (a.tagName === "INPUT");
    });
    if(mine) note(slug, "слой перехватил «/», хотя у материала свой поиск");
    found = theirs ? "свой в шапке" : "свой в шапке, но фокус не встал";
    await p.evaluate(() => document.activeElement.blur());
  }
  else if(hasIndex){
    await p.keyboard.press("/");
    await p.waitForTimeout(150);
    const open = await p.evaluate(() => !document.querySelector(".ui-modal").hidden);
    if(!open) note(slug, "клавиша / не открывает поиск");
    else {
      const word = await p.evaluate(() => {
        const L = (typeof MODULES !== "undefined" ? MODULES : SECTIONS);
        return String((L[1] || L[0]).title || (L[1] || L[0]).name || "").split(/\s+/)[0].toLowerCase();
      });
      await p.fill("#ui-q", word);
      await p.waitForTimeout(180);
      const n = await p.evaluate(() => document.querySelectorAll(".ui-res").length);
      found = n + " по «" + word + "»";
      if(!n) note(slug, "поиск ничего не находит по слову из заголовка раздела");
      else {
        await p.keyboard.press("Enter");
        await p.waitForTimeout(220);
        const closed = await p.evaluate(() => document.querySelector(".ui-modal").hidden);
        if(!closed) note(slug, "Enter в поиске не выполняет переход");
      }
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(100);
  }

  /* ── справка по клавишам ── */
  await p.evaluate(() => {
    const b = document.querySelector("[role=\"tab\"][data-ui-tab]") ||
              document.querySelector("main button") ||
              document.querySelector("button");
    if(b) b.focus(); else if(document.activeElement) document.activeElement.blur();
  });
  const beforeModal = await p.evaluate(() =>
    document.activeElement ? document.activeElement.outerHTML.slice(0, 60) : "");
  await p.keyboard.press("?");
  await p.waitForTimeout(150);
  const keysOpen = await p.evaluate(() => !document.querySelector(".ui-modal").hidden &&
    !!document.querySelector(".ui-keys"));
  if(!keysOpen) note(slug, "клавиша ? не открывает справку");

  /* ── фокус не убегает из окна ── */
  let trap = "нет окна";
  if(keysOpen){
    await p.keyboard.press("Tab"); await p.waitForTimeout(60);
    await p.keyboard.press("Tab"); await p.waitForTimeout(60);
    const inside = await p.evaluate(() =>
      document.querySelector(".ui-modal").contains(document.activeElement));
    await p.keyboard.down("Shift"); await p.keyboard.press("Tab"); await p.keyboard.up("Shift");
    await p.waitForTimeout(60);
    const insideBack = await p.evaluate(() =>
      document.querySelector(".ui-modal").contains(document.activeElement));
    trap = inside && insideBack ? "держит" : "убегает";
    if(trap === "убегает") note(slug, "фокус уходит из окна по Tab");
  }

  await p.keyboard.press("Escape");
  await p.waitForTimeout(100);
  const afterModal = await p.evaluate(() =>
    document.activeElement ? document.activeElement.outerHTML.slice(0, 60) : "");
  if(keysOpen && beforeModal && afterModal !== beforeModal)
    note(slug, "после закрытия окна фокус не вернулся туда, откуда его взяли");

  /* ── сброс прогресса в два шага ── */
  let reset = "нет кнопки";
  const resetSel = await p.evaluate(() => {
    const b = document.querySelector("#wipe") ||
      [].slice.call(document.querySelectorAll("button")).filter(x => /сброс/i.test(x.textContent))[0];
    if(!b) return null;
    if(!b.id) b.id = "ui-reset-probe";
    return "#" + b.id;
  });
  if(resetSel){
    const before = await p.evaluate(s => document.querySelector(s).textContent, resetSel);
    await p.click(resetSel);
    await p.waitForTimeout(120);
    const armed = await p.evaluate(s => /Точно/.test(document.querySelector(s).textContent), resetSel);
    if(!armed) note(slug, "сброс прогресса срабатывает с первого нажатия");
    /* второе нажатие должно действительно сбросить и вернуть подпись */
    await p.click(resetSel);
    await p.waitForTimeout(200);
    const now = await p.evaluate(s => document.querySelector(s).textContent, resetSel);
    if(now !== before) note(slug, "после подтверждения подпись кнопки не вернулась: «" + now + "»");
    reset = armed ? (now === before ? "два шага" : "два шага, подпись НЕ вернулась") : "СРАЗУ";
  }

  /* ── перелив по горизонтали ── */
  const ox = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if(ox > 0) note(slug, "горизонтальный перелив " + ox + "px");

  /* ── узкий экран: доступна ли боковая панель ── */
  await p.setViewportSize({width: NARROW[0], height: NARROW[1]});
  await p.waitForTimeout(200);
  const narrow = await p.evaluate(() => {
    const btn = document.querySelector(".ui-panelbtn");
    if(!btn) return {need: false};
    btn.click();
    const rail = document.querySelector(".rail");
    const vis = rail && getComputedStyle(rail).display !== "none" && rail.getBoundingClientRect().height > 40;
    if(!vis) return {need: true, open: document.body.classList.contains("ui-panel-open"), visible: false};
    /* содержимое должно лежать столбцом: два соседних блока в одной строке —
       признак того, что панели навязали горизонтальную раскладку */
    const kids = [].slice.call(rail.children)
      .map(k => k.getBoundingClientRect()).filter(r => r.width > 1 && r.height > 1);
    let side = 0, narrowKid = 0;
    for(let i = 1; i < kids.length; i++)
      if(kids[i].left >= kids[i-1].right - 1 && kids[i].top < kids[i-1].bottom - 1) side++;
    kids.forEach(k => { if(k.width < rail.clientWidth * 0.4) narrowKid++; });
    return {need: true, open: document.body.classList.contains("ui-panel-open"), visible: true,
            kids: kids.length, side, narrowKid};
  });
  if(narrow.need && !narrow.visible) note(slug, "на узком экране боковая панель не открывается");
  if(narrow.visible && narrow.side)
    note(slug, "содержимое панели уложено в строку, а не в столбец: " + narrow.side + " пар");
  if(narrow.visible && narrow.kids > 1 && narrow.narrowKid === narrow.kids)
    note(slug, "все блоки панели сжаты уже 40% её ширины — раскладка сломана");
  /* вернулись на широкий экран: у прокручиваемой полосы разделов должна быть подсказка */
  await p.setViewportSize({width: WIDE[0], height: WIDE[1]});
  await p.waitForTimeout(250);
  const strip = await p.evaluate(() => {
    const n = document.querySelector("#nav") || document.querySelector(".rail") || document.querySelector("#modList");
    if(!n) return null;
    const items = [].slice.call(n.querySelectorAll("button, a[href]"));
    if(items.length < 2) return null;
    const a = items[0].getBoundingClientRect(), b = items[1].getBoundingClientRect();
    if(!a.height || Math.abs(a.top - b.top) >= a.height / 2) return null;   /* не строка */
    return {over: Math.round(n.scrollWidth - n.clientWidth), hint: n.classList.contains("ui-scroll-x")};
  });
  if(strip && strip.over > 4 && !strip.hint)
    note(slug, "разделы не влезают в полосу (" + strip.over + "px), но о прокрутке ничего не говорит");
  await p.setViewportSize({width: NARROW[0], height: NARROW[1]});
  await p.waitForTimeout(200);
  const oxN = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if(oxN > 0) note(slug, "перелив на узком экране " + oxN + "px");

  if(errs.length) note(slug, "ошибки в консоли: " + errs.slice(0, 2).join(" | "));

  console.log(slug.padEnd(9) +
    " вкладок=" + base.wired + "/" + base.tabs +
    " разделов=" + base.nav +
    " прогресс=" + base.badgeKind + "×" + base.badges +
    " переход=" + stepped +
    " фокус=" + trap +
    " поиск=" + found +
    " сброс=" + reset +
    " панель=" + (narrow.need ? (narrow.visible ? "столбцом" : "НЕТ") : "не нужна") +
    " полоса=" + (strip ? (strip.over > 4 ? "прокрутка " + strip.over + "px" : "влезает") : "не в строку") +
    " перелив=" + ox + "/" + oxN);
  await ctx.close();
}
await b.close();

if(problems.length){
  console.log("\nЗАМЕЧАНИЯ:");
  problems.forEach(x => console.log("  ✗ " + x));
  process.exit(1);
}
console.log("\nинтерфейс: замечаний нет");
