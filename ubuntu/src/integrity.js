/* Целостность содержания: счёт, разметка, работоспособность примеров. */
const fs = require("fs"), path = require("path");
const dir = __dirname;

let eng = "";
for(const f of ["30_fs.js","31_sys.js","32_sh.js","33_core.js","34_text.js","35_admin.js","36_net.js","37_run.js"])
  eng += fs.readFileSync(path.join(dir, f), "utf8").replace(/<\/?script>/g, "") + "\n";
let content = "";
for(const f of fs.readdirSync(dir).filter(x => /^4\d_content_.*\.js$/.test(x)).sort())
  content += fs.readFileSync(path.join(dir, f), "utf8");
eval(eng + "\n" + content +
     "\nfor(const n of [\"MODULES\",\"runSh\",\"newMachine\",\"CMDS\"]) globalThis[n] = eval(n);");

let bad = 0;
const say = m => { console.log("  ✗ " + m); bad++; };

/* ── счёт ─────────────────────────────────────────────── */
console.log("── содержание");
let q = 0, l = 0, c = 0, iv = 0;
const ids = {}, labIds = {};
MODULES.forEach((m, i) => {
  if(m.n !== i + 1) say("раздел «" + m.title + "»: номер " + m.n + ", а по порядку " + (i + 1));
  if(ids[m.id]) say("повторный идентификатор раздела: " + m.id);
  ids[m.id] = 1;
  for(const k of ["title", "sub", "lede", "theory"])
    if(!m[k] || !String(m[k]).trim()) say(m.id + ": пусто поле " + k);
  q += (m.quiz || []).length;
  iv += (m.iv || []).length;
  (m.quiz || []).forEach((x, j) => {
    if(!x.opts || x.opts.length !== 4) say(m.id + " вопрос " + (j + 1) + ": вариантов не четыре");
    if(!(x.a >= 0 && x.a < (x.opts || []).length)) say(m.id + " вопрос " + (j + 1) + ": неверный номер ответа");
    if(!x.why || x.why.length < 20) say(m.id + " вопрос " + (j + 1) + ": слишком короткое пояснение");
    const set = {};
    for(const o of x.opts || []){ if(set[o]) say(m.id + " вопрос " + (j + 1) + ": повторяющийся вариант"); set[o] = 1; }
  });
  (m.labs || []).forEach(x => {
    l++;
    if(labIds[x.id]) say("повторный идентификатор задания: " + x.id);
    labIds[x.id] = 1;
    if(typeof x.setup !== "function") say(x.id + ": нет setup");
    if(!x.checks || !x.checks.length) say(x.id + ": нет проверок");
    if(!x.hint) say(x.id + ": нет подсказки");
    c += (x.checks || []).length;
    (x.checks || []).forEach(ch => { if(typeof ch.test !== "function") say(x.id + ": проверка без test"); });
  });
  (m.iv || []).forEach((x, j) => {
    if(!x.a || x.a.length < 200) say(m.id + " карточка " + (j + 1) + ": слишком короткий разбор");
    if(!x.probe) say(m.id + " карточка " + (j + 1) + ": не сказано, что проверяют");
  });
});
console.log("  разделов " + MODULES.length + ", вопросов " + q + ", заданий " + l +
            ", проверок " + c + ", карточек " + iv);
if(MODULES.length !== 12) say("разделов должно быть 12");
if(q !== 72) say("вопросов должно быть 72, а их " + q);

/* ── баланс разметки ──────────────────────────────────── */
console.log("── разметка");
const PAIRED = ["p","ul","ol","li","table","tr","th","td","code","pre","b","i","h2","h3","div","span",
                "figure","figcaption","section","em","strong"];
function balance(html, where){
  const stack = [];
  const re = /<(\/?)([a-z0-9]+)([^>]*)>/gi;
  let m;
  while((m = re.exec(html))){
    const close = m[1] === "/", tag = m[2].toLowerCase(), rest = m[3];
    if(PAIRED.indexOf(tag) < 0) continue;
    if(/\/$/.test(rest)) continue;
    if(close){
      if(!stack.length){ say(where + ": лишний </" + tag + ">"); return; }
      const open = stack.pop();
      if(open !== tag){ say(where + ": </" + tag + "> закрывает <" + open + ">"); return; }
    } else stack.push(tag);
  }
  if(stack.length) say(where + ": не закрыт <" + stack[stack.length - 1] + ">");
}
let checkedHtml = 0;
for(const m of MODULES){
  balance(m.theory, m.id + " / теория"); checkedHtml++;
  for(const x of m.quiz || []){ balance(x.q, m.id + " / вопрос"); balance(x.why, m.id + " / пояснение"); checkedHtml += 2; }
  for(const x of m.labs || []){ balance(x.brief, x.id + " / условие"); checkedHtml++;
    for(const ch of x.checks || []) balance(ch.label, x.id + " / подпись проверки"); }
  for(const x of m.iv || []){ balance(x.a, m.id + " / разбор"); balance(x.q, m.id + " / вопрос собеседования"); checkedHtml += 2; }
}
console.log("  проверено фрагментов разметки: " + checkedHtml);

/* ── примеры команд из теории действительно работают ──── */
console.log("── примеры команд в теории");
const strip = s => String(s).replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
let ex = 0, unknown = {};
for(const m of MODULES){
  for(const raw of String(m.theory).split("\n")){
    const line = strip(raw).trim();
    const mm = /^\$\s+(.+)$/.exec(line);
    if(!mm) continue;
    let cmd = mm[1].trim();
    if(!cmd || /^#/.test(cmd)) continue;
    ex++;
    /* первое слово каждой ступени конвейера должно быть известной командой */
    for(const part of cmd.split(/\||&&|\|\|/)){
      const words = part.trim().split(/\s+/).filter(Boolean);
      let w = words[0];
      if(w === "sudo"){ let i = 1; while(words[i] && words[i][0] === "-") i += (words[i] === "-u" ? 2 : 1); w = words[i]; }
      if(!w || /^[A-Z_]+=/.test(w) || w[0] === "/" || w[0] === "$") continue;
      if(!CMDS[w]) unknown[w] = (unknown[w] || 0) + 1;
    }
  }
}
for(const w in unknown) say("в теории встречается команда «" + w + "», которой нет в движке (" + unknown[w] + " раз)");
console.log("  проверено примеров: " + ex);

/* ── подсказки заданий называют существующие команды ──── */
console.log("── подсказки заданий");
let hints = 0;
for(const m of MODULES) for(const x of m.labs || []){
  hints++;
  for(const w of String(x.hint).match(/\b(?:sudo\s+)?[a-z][a-z0-9-]{2,}\b/g) || []){
    const name = w.replace(/^sudo\s+/, "");
    if(CMDS[name] || !/^(systemctl|journalctl|adduser|useradd|usermod|groupadd|chmod|chown|netplan|truncate|crontab|ssh-copy-id|ssh-keygen|mount|blkid|lsblk)$/.test(name)) continue;
    say(x.id + ": подсказка называет неизвестную команду «" + name + "»");
  }
}
console.log("  проверено подсказок: " + hints);

/* ── сценарии заданий собираются ──────────────────────── */
console.log("── сценарии заданий");
let scen = 0;
for(const m of MODULES) for(const x of m.labs || []){
  try{ const S = x.setup(); if(!S || !S.fs) say(x.id + ": setup вернул не машину"); scen++; }
  catch(e){ say(x.id + ": setup упал — " + e.message); }
}
console.log("  проверено сценариев: " + scen);

console.log("");
console.log(bad ? "целостность: " + bad + " замечаний" : "целостность в порядке");
process.exit(bad ? 1 : 0);
