/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера
   Проверяемый файл ищется относительно этого скрипта. */
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;

const FILE = rel("../cicd-offline.html");
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

  /* живой конвейер */
  await type(p, "ci run");
  const first = await lastOut(p);
  const jobs = await p.evaluate(() => document.querySelectorAll("#jobs .jrow").length);

  /* ошибка показывается, а не роняет страницу */
  await type(p, "ci frobnicate");
  const errShown = await p.evaluate(() => !!document.querySelector("#out .e"));

  /* задание 1b: правка конвейера через редактор чинит падение */
  await p.locator("#nav button").nth(0).click(); await p.waitForTimeout(50);
  await p.click('#tabs button[data-tab="labs"]'); await p.waitForTimeout(50);
  await p.locator(".lab").nth(1).locator(".btn.pri").click(); await p.waitForTimeout(120);
  await type(p, "ci run");
  const failedFirst = /ПАДЕНИЕ/.test(await lastOut(p));
  await setFile(p, ".github/workflows/ci.yml",
    "name: CI\non: [push]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n" +
    "      - uses: actions/checkout@v4\n      - run: cat shop.sln\n      - run: dotnet build");
  await type(p, "ci run");
  const lab1 = await p.evaluate(() => {
    const cards = document.querySelectorAll(".lab");
    return {st: cards[1].querySelector(".labh .st").textContent,
            done: cards[1].classList.contains("done"),
            meter: document.querySelector("#mtxt").textContent};
  });

  /* задание 5a: матрица разворачивается и ускоряет конвейер */
  await p.locator("#nav button").nth(4).click(); await p.waitForTimeout(50);
  await p.click('#tabs button[data-tab="labs"]'); await p.waitForTimeout(50);
  await p.locator(".lab .btn.pri").first().click(); await p.waitForTimeout(120);
  await setFile(p, ".github/workflows/ci.yml",
    "name: CI\non: [push]\n\njobs:\n  ui:\n    runs-on: ubuntu-latest\n    strategy:\n" +
    "      matrix:\n        shard: [1, 2, 3]\n    steps:\n      - uses: actions/checkout@v4\n" +
    "      - run: dotnet test --filter ui --shard ${{ matrix.shard }}/3");
  await type(p, "ci run");
  const sharded = await lastOut(p);
  const lab5 = await p.evaluate(() => ({
    st: document.querySelector(".lab .labh .st").textContent,
    done: document.querySelector(".lab").classList.contains("done")
  }));

  /* задание 7a: артефакт при падении */
  await p.locator("#nav button").nth(6).click(); await p.waitForTimeout(50);
  await p.click('#tabs button[data-tab="labs"]'); await p.waitForTimeout(50);
  await p.locator(".lab .btn.pri").first().click(); await p.waitForTimeout(120);
  await type(p, "ci run");
  await setFile(p, ".github/workflows/ci.yml",
    "name: CI\non: [push]\n\njobs:\n  ui:\n    runs-on: ubuntu-latest\n    steps:\n" +
    "      - uses: actions/checkout@v4\n      - run: dotnet test --filter ui\n" +
    "      - if: always()\n        uses: actions/upload-artifact@v4\n        with:\n" +
    "          name: test-results\n          path: test-results/**");
  await type(p, "ci run");
  await type(p, "ci artifacts");
  const arts = /test-results/.test(await lastOut(p));
  const lab7 = await p.evaluate(() => ({
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
    " | запуск: " + (/Итог: успех/.test(first) ? "да" : "НЕТ") + " задач=" + jobs +
    " | ошибка: " + (errShown ? "да" : "НЕТ") +
    " | 1b: падало " + (failedFirst ? "да" : "НЕТ") + ", " + lab1.st + (lab1.done ? " ✓" : " ✗") +
    " | 5a: " + (/✓ ui \(3\)/.test(sharded) ? "3 шарда" : "НЕ РАЗВЕРНУЛОСЬ") + ", " + lab5.st + (lab5.done ? " ✓" : " ✗") +
    " | 7a: артефакт " + (arts ? "есть" : "НЕТ") + ", " + lab7.st + (lab7.done ? " ✓" : " ✗") +
    " | счётчик " + lab1.meter +
    " | вопрос: " + (answered ? "да" : "НЕТ") + " карточка: " + (ivOpen ? "да" : "НЕТ") +
    " | перелив " + maxOx + (maxOx ? " (" + worst + ")" : ""));
  await ctx.close();
}
await b.close();
if(errs.length){ console.log("\nОШИБКИ:"); errs.slice(0, 20).forEach(e => console.log("  " + e)); process.exit(1); }
console.log("\nошибок в консоли нет");
