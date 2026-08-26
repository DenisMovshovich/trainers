/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE = rel("../grossbuh-offline.html");
const b = await chromium.launch({executablePath: EXE});
const errs = [];
for(const [theme, w, h] of [["light",1500,980],["dark",1500,980],["light",1000,900],["light",760,900],["light",390,844]]){
  const ctx = await b.newContext({viewport:{width:w,height:h}, colorScheme:theme});
  const p = await ctx.newPage();
  const tagg = "["+theme+" "+w+"] ";
  p.on("pageerror", e => errs.push(tagg + e.message));
  p.on("console", m => { if(m.type() === "error") errs.push(tagg + "console: " + m.text()); });
  await p.goto(FILE); await p.waitForTimeout(700);
  const info = await p.evaluate(() => ({
    t: document.title,
    mods: document.querySelectorAll("#nav button").length,
    prog: document.querySelector("#mtxt").textContent,
    fd: getComputedStyle(document.querySelector(".mark")).fontFamily.split(",")[0],
    fs: getComputedStyle(document.body).fontFamily.split(",")[0],
    fm: getComputedStyle(document.querySelector("#sql")).fontFamily.split(",")[0],
    bg: getComputedStyle(document.body).backgroundColor,
    ink: getComputedStyle(document.body).color,
    tables: document.querySelectorAll("#sch details").length
  }));
  let maxOx = 0, worst = "", figs = 0, checks = 0, quizzes = 0;
  for(let i = 0; i < 12; i++){
    await p.locator("#nav button").nth(i).click(); await p.waitForTimeout(60);
    for(const t of ["theory","quiz","labs"]){
      await p.click('#tabs button[data-tab="'+t+'"]'); await p.waitForTimeout(50);
      const r = await p.evaluate(() => ({
        ox: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        f: document.querySelectorAll(".fig svg").length,
        c: document.querySelectorAll(".chk li").length,
        q: document.querySelectorAll(".qc").length
      }));
      if(t === "theory") figs += r.f;
      if(t === "labs") checks += r.c;
      if(t === "quiz") quizzes += r.q;
      if(r.ox > maxOx){ maxOx = r.ox; worst = "модуль " + (i+1) + "/" + t; }
    }
  }
  // живой прогон запроса
  await p.locator("#nav button").nth(0).click(); await p.waitForTimeout(60);
  await p.fill("#sql", "SELECT c.name, count(o.id) AS n FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name ORDER BY n DESC");
  await p.click("#run"); await p.waitForTimeout(200);
  const q1 = await p.evaluate(() => ({
    rows: document.querySelectorAll("#out table tr").length - 1,
    note: (document.querySelector("#out .note") || {}).textContent || "",
    err: !!document.querySelector("#out .err")
  }));
  await p.fill("#sql", "SELECT * FROM nosuch");
  await p.click("#run"); await p.waitForTimeout(150);
  const q2 = await p.evaluate(() => (document.querySelector("#out .err") || {}).textContent || "");
  // задание 1a целиком
  await p.click('#tabs button[data-tab="labs"]');
  for(const s of ["SELECT * FROM customers","SELECT name, city FROM customers",
                  "SELECT name AS клиент, city AS город FROM customers",
                  "SELECT * FROM products WHERE price > 20000","SELECT count(*) FROM orders"]){
    await p.fill("#sql", s); await p.click("#run"); await p.waitForTimeout(90);
  }
  const lab = await p.evaluate(() => ({
    st: document.querySelector(".lab .labh .st").textContent,
    done: document.querySelector(".lab").classList.contains("done"),
    meter: document.querySelector("#mtxt").textContent
  }));
  const ox2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if(ox2 > maxOx){ maxOx = ox2; worst = "после запросов"; }
  console.log(theme + " " + w + "×" + h + " | «" + info.t + "» | модулей=" + info.mods +
    " | рис=" + figs + " вопр=" + quizzes + " пров=" + checks + " табл=" + info.tables +
    " | шрифты " + info.fd + "/" + info.fs + "/" + info.fm +
    " | фон " + info.bg + " текст " + info.ink +
    " | запрос: " + q1.rows + " строк" + (q1.err ? " ОШИБКА" : "") +
    " | ошибка показана: " + (q2 ? "да" : "НЕТ") +
    " | задание 1a: " + lab.st + (lab.done ? " ✓" : " ✗") + " | счётчик " + lab.meter +
    " | перелив " + maxOx + (maxOx ? " (" + worst + ")" : ""));
  await ctx.close();
}
await b.close();
if(errs.length){ console.log("\nОШИБКИ В КОНСОЛИ:"); errs.slice(0,20).forEach(e=>console.log("  " + e)); process.exit(1); }
console.log("\nошибок в консоли нет");
