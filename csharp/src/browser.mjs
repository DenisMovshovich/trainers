/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE = rel("../csharp-offline.html");
const b = await chromium.launch({executablePath:EXE});
const errs = [];
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
    fm: getComputedStyle(document.querySelector("#code")).fontFamily.split(",")[0],
    bg: getComputedStyle(document.body).backgroundColor,
    ink: getComputedStyle(document.body).color,
    ref: document.querySelectorAll("#ref details").length
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

  /* ни одна скрытая вкладка не должна просачиваться */
  const leaks = [];
  for(const t of ["theory","quiz","labs","iv"]){
    await p.click('#tabs button[data-tab="' + t + '"]'); await p.waitForTimeout(40);
    const seen = await p.evaluate(() =>
      ["theory","quiz","labs","iv"].filter(x => document.querySelector("#pane-" + x).offsetParent !== null));
    if(seen.length !== 1 || seen[0] !== t) leaks.push("вкладка " + t + " → видно " + seen.join(","));
  }
  if(leaks.length) errs.push(tg + "утечка панелей: " + leaks.join(" · "));

  /* живое выполнение кода */
  await p.locator("#nav button").nth(0).click(); await p.waitForTimeout(50);
  await p.click("#run"); await p.waitForTimeout(200);
  const first = await p.evaluate(() => ({
    lines: [].map.call(document.querySelectorAll("#out .line .tx"), n => n.textContent).join(" | "),
    st: (document.querySelector("#dst") || {}).textContent || ""
  }));

  /* задание 1a: берём заготовку, дописываем решение, проверки должны сойтись */
  await p.click('#tabs button[data-tab="labs"]'); await p.waitForTimeout(50);
  await p.locator(".lab .btn.pri").first().click(); await p.waitForTimeout(60);
  await p.evaluate(() => {
    document.querySelector("#code").value =
      'struct Pt { public int X; }\nclass Box { public int V; }\n' +
      'var a = new Pt(); a.X = 1; var b = a; b.X = 99; Console.WriteLine(a.X);\n' +
      'var c = new Box(); c.V = 1; var d = c; d.V = 99; Console.WriteLine(c.V);';
  });
  await p.click("#run"); await p.waitForTimeout(200);
  const lab = await p.evaluate(() => ({
    st: document.querySelector(".lab .labh .st").textContent,
    done: document.querySelector(".lab").classList.contains("done"),
    meter: document.querySelector("#mtxt").textContent
  }));

  /* ошибка выполнения показывается, а не роняет страницу */
  await p.evaluate(() => { document.querySelector("#code").value = 'int x = ;'; });
  await p.click("#run"); await p.waitForTimeout(150);
  const errShown = await p.evaluate(() => !!document.querySelector("#out .err"));

  /* асинхронный раздел действительно исполняется планировщиком */
  await p.locator("#nav button").nth(9).click(); await p.waitForTimeout(50);
  await p.locator("#chips button").first().click(); await p.waitForTimeout(60);
  await p.click("#run"); await p.waitForTimeout(250);
  const order = await p.evaluate(() =>
    [].map.call(document.querySelectorAll("#out .line .tx"), n => n.textContent.trim()).join(""));

  /* вопрос отвечается и запоминается */
  await p.click('#tabs button[data-tab="quiz"]'); await p.waitForTimeout(50);
  await p.locator(".qc .qo button").first().click(); await p.waitForTimeout(80);
  const answered = await p.evaluate(() => {
    const c = document.querySelector(".qc");
    return c.classList.contains("right") || c.classList.contains("wrong");
  });

  /* карточка собеседования раскрывается */
  await p.click('#tabs button[data-tab="iv"]'); await p.waitForTimeout(50);
  await p.locator(".ivq").first().click(); await p.waitForTimeout(80);
  const ivOpen = await p.evaluate(() => !document.querySelector(".ivb").hidden);

  const ox2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if(ox2 > maxOx){ maxOx = ox2; worst = "после действий"; }

  console.log(theme + " " + w + "×" + h + " | «" + info.t + "» | разделов=" + info.mods +
    " | примеров=" + pres + " вопр=" + quizzes + " пров=" + checks + " собес=" + ivs +
    " чипов=" + chips + " справка=" + info.ref +
    " | шрифты " + info.fd + "/" + info.fs + "/" + info.fm +
    " | фон " + info.bg + " текст " + info.ink +
    " | запуск: " + (/структура: 1/.test(first.lines) && /класс: 99/.test(first.lines) ? "да" : "НЕТ") +
    " | задание 1a: " + lab.st + (lab.done ? " ✓" : " ✗") + " счётчик " + lab.meter +
    " | ошибка показана: " + (errShown ? "да" : "НЕТ") +
    " | async-порядок: " + (order === "12345" ? "12345" : "НЕ " + order) +
    " | вопрос: " + (answered ? "да" : "НЕТ") + " | карточка: " + (ivOpen ? "да" : "НЕТ") +
    " | перелив " + maxOx + (maxOx ? " (" + worst + ")" : ""));
  await ctx.close();
}
await b.close();
if(errs.length){ console.log("\nОШИБКИ:"); errs.slice(0, 20).forEach(e => console.log("  " + e)); process.exit(1); }
console.log("\nошибок в консоли нет");
