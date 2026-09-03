/* Браузерная проверка. Пути не зашиты: playwright-core берётся из node_modules
   (npm i -D playwright-core), при необходимости переопределяется переменными:
     PLAYWRIGHT_CORE — путь к модулю playwright-core
     CHROMIUM_PATH   — путь к исполняемому файлу браузера */
let chromium;
try { ({ chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core")); }
catch (e) {
  console.error("playwright-core не найден: npm i -D playwright-core && npx playwright install chromium");
  process.exit(2);
}
const EXE = process.env.CHROMIUM_PATH || undefined;
const rel = p => new URL(p, import.meta.url).href;
const FILE = rel("../ubuntu-offline.html");

let b;
try { b = await chromium.launch({executablePath: EXE}); }
catch (e) { console.error("браузер не запустился: " + String(e.message || e).split("\n")[0]); process.exit(2); }

const errs = [];
const type = async (p, cmd) => { await p.fill("#cmd", cmd); await p.press("#cmd", "Enter"); await p.waitForTimeout(50); };
const lastOut = p => p.evaluate(() =>
  [].map.call(document.querySelectorAll("#out .l"), n => n.textContent).join("\n"));

for(const [theme, w, h] of [["light",1540,1000],["dark",1540,1000],["light",1120,900],["light",820,900],["light",390,844]]){
  const ctx = await b.newContext({viewport:{width:w,height:h}, colorScheme:theme});
  const p = await ctx.newPage();
  const tg = "[" + theme + " " + w + "] ";
  p.on("console", m => { if(m.type() === "error") errs.push(tg + m.text()); });
  p.on("pageerror", e => errs.push(tg + e.message));
  await p.goto(FILE);
  await p.waitForTimeout(500);

  const bits = [];
  bits.push(theme + " " + w + "×" + h);

  const title = await p.title();
  bits.push("«" + title + "»");

  const counts = await p.evaluate(() => ({
    mods: document.querySelectorAll("#nav button").length,
    quiz: MODULES.reduce((s, m) => s + m.quiz.length, 0),
    labs: MODULES.reduce((s, m) => s + m.labs.length, 0),
    checks: MODULES.reduce((s, m) => s + m.labs.reduce((t, l) => t + l.checks.length, 0), 0),
    iv: MODULES.reduce((s, m) => s + (m.iv || []).length, 0),
    chips: document.querySelectorAll("#chips button").length
  }));
  bits.push("разделов=" + counts.mods + " вопр=" + counts.quiz + " задач=" + counts.labs +
            " пров=" + counts.checks + " собес=" + counts.iv + " чипов=" + counts.chips);
  if(counts.mods !== 12) errs.push(tg + "разделов не 12, а " + counts.mods);
  if(counts.quiz !== 72) errs.push(tg + "вопросов не 72");

  const look = await p.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return {font: cs.fontFamily.split(",")[0], bg: cs.backgroundColor, fg: cs.color,
            mono: getComputedStyle(document.querySelector("#cmd")).fontFamily.split(",")[0]};
  });
  bits.push("шрифты " + look.font + "/" + look.mono);
  bits.push("фон " + look.bg);

  /* терминал: базовые команды работают */
  await type(p, "id");
  let out = await lastOut(p);
  bits.push("id: " + (/uid=1000\(ubuntu\)/.test(out) ? "да" : "НЕТ"));
  if(!/uid=1000\(ubuntu\)/.test(out)) errs.push(tg + "id не отвечает");

  await type(p, "ls -l /etc/ssh/sshd_config");
  out = await lastOut(p);
  if(!/-rw-r--r--/.test(out)) errs.push(tg + "ls -l не показывает права");

  await type(p, "cat /etc/shadow");
  out = await lastOut(p);
  bits.push("отказ: " + (/Permission denied/.test(out) ? "да" : "НЕТ"));
  if(!/Permission denied/.test(out)) errs.push(tg + "чтение /etc/shadow не отклонено");

  await type(p, "sudo apt update");
  await type(p, "sudo apt install nginx");
  out = await lastOut(p);
  if(!/Setting up nginx/.test(out)) errs.push(tg + "apt install не отработал");

  await type(p, "sudo ss -tulpn");
  out = await lastOut(p);
  bits.push("порты: " + (/:80/.test(out) && /:22/.test(out) ? "да" : "НЕТ"));
  if(!/:80/.test(out)) errs.push(tg + "ss не показывает порт 80");

  /* правая колонка обновилась */
  if(w > 1120){
    const rail = await p.evaluate(() => ({
      svc: document.querySelectorAll("#rsvc .rrow").length,
      ports: document.querySelectorAll("#rports .rrow").length,
      ctx: document.querySelector("#rctx").textContent
    }));
    bits.push("колонка: служб=" + rail.svc + " портов=" + rail.ports + " «" + rail.ctx + "»");
    if(rail.svc < 3) errs.push(tg + "в колонке нет служб");
    if(rail.ports < 2) errs.push(tg + "в колонке нет портов");
  }

  /* задание: загрузка сценария и прохождение проверок */
  await p.evaluate(() => {
    const i = MODULES.findIndex(m => m.id === "perm");
    document.querySelectorAll("#nav button")[i].click();
  });
  await p.waitForTimeout(120);
  await p.evaluate(() => document.querySelector('#tabs button[data-tab="labs"]').click());
  await p.waitForTimeout(120);
  await p.evaluate(() => document.querySelectorAll("#pane-labs .lab")[0].querySelector(".btn.pri").click());
  await p.waitForTimeout(150);
  for(const c of ["sudo chown deploy:www-data /var/www/html/index.html",
                  "sudo chown deploy:www-data /var/www/html/style.css",
                  "sudo chown deploy:www-data /var/www/html",
                  "sudo chmod 640 /var/www/html/index.html",
                  "sudo chmod 640 /var/www/html/style.css",
                  "sudo chmod 750 /var/www/html"]) await type(p, c);
  const lab = await p.evaluate(() => {
    const card = document.querySelectorAll("#pane-labs .lab")[0];
    return {st: card.querySelector(".st").textContent, done: card.classList.contains("done")};
  });
  bits.push("2a: " + lab.st + (lab.done ? " ✓" : " ✗"));
  if(!lab.done) errs.push(tg + "задание 2a не засчитано: " + lab.st);

  /* счётчик прогресса вырос */
  const meter = await p.evaluate(() => document.querySelector("#mtxt").textContent);
  bits.push("счётчик " + meter);

  /* вопрос отвечается, карточка собеседования раскрывается */
  await p.evaluate(() => document.querySelector('#tabs button[data-tab="quiz"]').click());
  await p.waitForTimeout(100);
  const quizOk = await p.evaluate(() => {
    const btns = document.querySelectorAll("#pane-quiz .qc")[0].querySelectorAll(".qo button");
    btns[0].click();
    return document.querySelectorAll("#pane-quiz .qc")[0].querySelector(".qw").hidden === false;
  });
  await p.evaluate(() => document.querySelector('#tabs button[data-tab="iv"]').click());
  await p.waitForTimeout(100);
  const ivOk = await p.evaluate(() => {
    const c = document.querySelectorAll("#pane-iv .ivc")[0];
    c.querySelector(".ivq").click();
    return c.querySelector(".ivb").hidden === false;
  });
  bits.push("вопрос: " + (quizOk ? "да" : "НЕТ") + " карточка: " + (ivOk ? "да" : "НЕТ"));
  if(!quizOk) errs.push(tg + "вопрос не раскрывает пояснение");
  if(!ivOk) errs.push(tg + "карточка собеседования не раскрывается");

  /* редактор файлов */
  await p.evaluate(() => document.querySelector('#dtabs button[data-d="file"]').click());
  await p.waitForTimeout(120);
  const fed = await p.evaluate(() => {
    const sel = document.querySelector("#fpick");
    const opt = [].slice.call(sel.options).filter(o => o.value === "/etc/ssh/sshd_config")[0];
    if(!opt) return {ok: false, n: sel.options.length};
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change"));
    return {ok: /PermitRootLogin/.test(document.querySelector("#ftext").value), n: sel.options.length};
  });
  bits.push("редактор: файлов=" + fed.n + (fed.ok ? " ✓" : " ✗"));
  if(!fed.ok) errs.push(tg + "редактор не открыл /etc/ssh/sshd_config");

  const ox = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  bits.push("перелив " + ox);
  if(ox > 0) errs.push(tg + "горизонтальный перелив " + ox + "px");

  console.log(bits.join(" | "));
  await ctx.close();
}
await b.close();
console.log("");
if(errs.length){ for(const e of errs) console.log("  ✗ " + e); console.log("ошибок: " + errs.length); process.exit(1); }
console.log("ошибок в консоли нет");
