/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE = rel("../network-offline.html");
const b = await chromium.launch({executablePath:EXE});
const errs = [];
const type = async (p, cmd) => { await p.fill("#cmd", cmd); await p.press("#cmd", "Enter"); await p.waitForTimeout(60); };
const lastOut = p => p.evaluate(() =>
  [].map.call(document.querySelectorAll("#out .l"), n => n.textContent).join("\n"));
const setFile = async (p, name, text) => {
  await p.click('#dtabs button[data-d="file"]'); await p.waitForTimeout(60);
  await p.selectOption("#fpick", name); await p.waitForTimeout(60);
  await p.fill("#ftext", text);
  await p.click("#fsave"); await p.waitForTimeout(60);
  await p.click('#dtabs button[data-d="term"]'); await p.waitForTimeout(40);
};

for(const [theme,w,h] of [["light",1540,1000],["dark",1540,1000],["light",1120,900],["light",820,900],["light",390,844]]){
  const ctx = await b.newContext({viewport:{width:w,height:h}, colorScheme:theme});
  const p = await ctx.newPage();
  const tg = "[" + theme + " " + w + "] ";
  p.on("pageerror", e => errs.push(tg + e.message));
  p.on("console", m => { if(m.type() === "error") errs.push(tg + "console: " + m.text()); });
  await p.goto(FILE); await p.waitForTimeout(700);

  const info = await p.evaluate(() => ({
    t: document.title,
    mods: document.querySelectorAll("#nav button").length,
    fd: getComputedStyle(document.querySelector(".mark")).fontFamily.split(",")[0],
    fs: getComputedStyle(document.body).fontFamily.split(",")[0],
    fm: getComputedStyle(document.querySelector("#cmd")).fontFamily.split(",")[0],
    bg: getComputedStyle(document.body).backgroundColor,
    ink: getComputedStyle(document.body).color
  }));

  let maxOx = 0, worst = "", checks = 0, quizzes = 0, ivs = 0, pres = 0, chips = 0;
  for(let i = 0; i < 12; i++){
    await p.locator("#nav button").nth(i).click(); await p.waitForTimeout(45);
    chips += await p.evaluate(() => document.querySelectorAll("#chips button").length);
    for(const t of ["theory","quiz","labs","iv"]){
      await p.click('#tabs button[data-tab="' + t + '"]'); await p.waitForTimeout(35);
      const r = await p.evaluate(() => ({
        ox: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pre: document.querySelectorAll(".theory pre").length,
        c: document.querySelectorAll(".chk li").length,
        q: document.querySelectorAll(".qc").length,
        v: document.querySelectorAll(".ivc").length
      }));
      if(t === "theory") pres += r.pre;
      if(t === "labs") checks += r.c;
      if(t === "quiz") quizzes += r.q;
      if(t === "iv") ivs += r.v;
      if(r.ox > maxOx){ maxOx = r.ox; worst = "раздел " + (i + 1) + "/" + t; }
    }
  }

  /* скрытые панели не должны просачиваться */
  const leaks = [];
  for(const t of ["theory","quiz","labs","iv"]){
    await p.click('#tabs button[data-tab="' + t + '"]'); await p.waitForTimeout(40);
    const seen = await p.evaluate(() =>
      ["theory","quiz","labs","iv"].filter(x => document.querySelector("#pane-" + x).offsetParent !== null));
    if(seen.length !== 1 || seen[0] !== t) leaks.push("вкладка " + t + " → видно " + seen.join(","));
  }
  for(const d of ["term","file"]){
    await p.click('#dtabs button[data-d="' + d + '"]'); await p.waitForTimeout(40);
    const seen = await p.evaluate(() =>
      ["term","file"].filter(x => document.querySelector("#t-" + x).offsetParent !== null));
    if(seen.length !== 1 || seen[0] !== d) leaks.push("панель " + d + " → видно " + seen.join(","));
  }
  if(leaks.length) errs.push(tg + "утечка панелей: " + leaks.join(" · "));
  await p.click('#dtabs button[data-d="term"]'); await p.waitForTimeout(40);

  /* живая сеть */
  await type(p, "curl -v https://api.example.com/health");
  const first = await lastOut(p);
  const rows = await p.evaluate(() => document.querySelectorAll("#map .nrow").length);

  /* неудача curl помечается и сопровождается подсказкой */
  await type(p, "curl https://nope.example.com/");
  const failMarked = await p.evaluate(() =>
    !!document.querySelector("#out .bad2") && !!document.querySelector("#out .h"));
  /* а неизвестный инструмент — это уже ошибка самой команды */
  await type(p, "wget https://api.example.com/");
  const errShown = await p.evaluate(() => !!document.querySelector("#out .e"));

  /* задание 1a: три инструмента подряд */
  await p.locator("#nav button").nth(0).click(); await p.waitForTimeout(50);
  await p.click('#tabs button[data-tab="labs"]'); await p.waitForTimeout(50);
  await p.locator(".lab .btn.pri").first().click(); await p.waitForTimeout(120);
  await type(p, "curl -v https://api.example.com/health");
  await type(p, "dig api.example.com");
  await type(p, "nc -zv api.example.com 443");
  const lab1 = await p.evaluate(() => ({
    st: document.querySelector(".lab .labh .st").textContent,
    done: document.querySelector(".lab").classList.contains("done"),
    meter: document.querySelector("#mtxt").textContent
  }));

  /* задание 2b: правка /etc/hosts во вкладке «Машина» */
  await p.locator("#nav button").nth(1).click(); await p.waitForTimeout(50);
  await p.click('#tabs button[data-tab="labs"]'); await p.waitForTimeout(50);
  await p.locator(".lab").nth(1).locator(".btn.pri").click(); await p.waitForTimeout(120);
  await type(p, "curl --connect-timeout 2 https://api.example.com/health");
  await type(p, "curl --resolve api.example.com:443:203.0.113.20 https://api.example.com/health");
  await setFile(p, "/etc/hosts", "127.0.0.1\tlocalhost\n203.0.113.20\tapi.example.com\n");
  await type(p, "curl https://api.example.com/health");
  const lab2 = await p.evaluate(() => {
    const c = document.querySelectorAll(".lab");
    return {st: c[1].querySelector(".labh .st").textContent, done: c[1].classList.contains("done")};
  });

  /* задание 9a: curl проходит, браузер блокирует */
  await p.locator("#nav button").nth(8).click(); await p.waitForTimeout(50);
  await p.click('#tabs button[data-tab="labs"]'); await p.waitForTimeout(50);
  await p.locator(".lab .btn.pri").first().click(); await p.waitForTimeout(120);
  await type(p, "curl https://api.example.com/orders");
  await type(p, "browser https://api.example.com/orders");
  const blocked = /ЗАБЛОКИРОВАНО/.test(await lastOut(p));
  await type(p, "verdict cors");
  const lab9 = await p.evaluate(() => ({
    st: document.querySelector(".lab .labh .st").textContent,
    done: document.querySelector(".lab").classList.contains("done")
  }));

  /* вопрос и карточка */
  await p.click('#tabs button[data-tab="quiz"]'); await p.waitForTimeout(50);
  await p.locator(".qc .qo button").first().click(); await p.waitForTimeout(80);
  const answered = await p.evaluate(() => {
    const c = document.querySelector(".qc");
    return c.classList.contains("right") || c.classList.contains("wrong");
  });
  await p.click('#tabs button[data-tab="iv"]'); await p.waitForTimeout(50);
  await p.locator(".ivq").first().click(); await p.waitForTimeout(80);
  const ivOpen = await p.evaluate(() => !document.querySelector(".ivb").hidden);

  const ox2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if(ox2 > maxOx){ maxOx = ox2; worst = "после действий"; }

  console.log(theme + " " + w + "×" + h + " | «" + info.t + "» | разделов=" + info.mods +
    " | примеров=" + pres + " вопр=" + quizzes + " пров=" + checks + " собес=" + ivs + " чипов=" + chips +
    " | шрифты " + info.fd + "/" + info.fs + "/" + info.fm +
    " | фон " + info.bg + " текст " + info.ink +
    " | запрос: " + (/200 OK/.test(first) ? "да" : "НЕТ") + " карта=" + rows +
    " | неудача помечена: " + (failMarked ? "да" : "НЕТ") + " ошибка: " + (errShown ? "да" : "НЕТ") +
    " | 1a: " + lab1.st + (lab1.done ? " ✓" : " ✗") +
    " | 2b: " + lab2.st + (lab2.done ? " ✓" : " ✗") +
    " | 9a: браузер " + (blocked ? "блокирует" : "НЕ БЛОКИРУЕТ") + ", " + lab9.st + (lab9.done ? " ✓" : " ✗") +
    " | счётчик " + lab1.meter +
    " | вопрос: " + (answered ? "да" : "НЕТ") + " карточка: " + (ivOpen ? "да" : "НЕТ") +
    " | перелив " + maxOx + (maxOx ? " (" + worst + ")" : ""));
  await ctx.close();
}
await b.close();
if(errs.length){ console.log("\nОШИБКИ:"); errs.slice(0, 20).forEach(e => console.log("  " + e)); process.exit(1); }
console.log("\nошибок в консоли нет");
