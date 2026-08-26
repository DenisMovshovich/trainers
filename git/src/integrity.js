/* Проверка целостности содержания и разметки */
const fs = require("fs"), path = require("path");
const dir = __dirname;
const strip = f => fs.readFileSync(path.join(dir, f), "utf8").replace(/^<script>\s*/, "").replace(/<\/script>\s*$/, "");
const CODE = ["30_obj.js","31_diff.js","32_cmd.js","33_hist.js","34_remote.js","35_run.js","36_more.js"].map(strip).join("\n");
const CONTENT = fs.readdirSync(dir).filter(x => /^4\d_content_.*\.js$/.test(x)).sort().map(strip).join("\n");
const {MODULES} = new Function(CODE + "\n" + CONTENT + "\nreturn {MODULES};")();

let bad = 0;
const err = m => { console.log("  ✗ " + m); bad++; };
const VOID = new Set(["br","hr","img","input","meta","link","path","rect","circle","line","use","source","col"]);

function balance(html, where){
  const stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let m;
  while((m = re.exec(html))){
    const close = m[1] === "/", name = m[2].toLowerCase(), self = m[3] === "/";
    if(VOID.has(name) || self) continue;
    if(!close) stack.push(name);
    else {
      if(!stack.length) return err(where + ": лишний </" + name + ">");
      const top = stack.pop();
      if(top !== name) return err(where + ": </" + name + "> закрывает <" + top + ">");
    }
  }
  if(stack.length) err(where + ": не закрыт <" + stack[stack.length - 1] + ">");
}

console.log("── содержание");
let nq = 0, nl = 0, nc = 0, ni = 0;
const labIds = new Set(), modIds = new Set();
MODULES.forEach((m, i) => {
  if(m.n !== i + 1) err("раздел " + m.id + ": номер " + m.n);
  if(modIds.has(m.id)) err("раздел " + m.id + ": повторяющийся идентификатор");
  modIds.add(m.id);
  ["id","title","sub","lede","theory"].forEach(k => { if(!m[k]) err("раздел " + m.n + ": нет " + k); });
  balance(m.theory, "раздел " + m.n + " теория");

  if(m.quiz.length < 6) err("раздел " + m.n + ": вопросов " + m.quiz.length);
  m.quiz.forEach((q, qi) => {
    nq++;
    const w = "раздел " + m.n + " вопрос " + (qi + 1);
    if(q.opts.length !== 4) err(w + ": вариантов " + q.opts.length);
    if(!(q.a >= 0 && q.a < q.opts.length)) err(w + ": неверный индекс ответа");
    if(new Set(q.opts).size !== q.opts.length) err(w + ": повторяющиеся варианты");
    if(!q.why || q.why.length < 40) err(w + ": слишком короткое объяснение");
    balance(q.q, w + " формулировка");
    q.opts.forEach((o, oi) => balance(o, w + " вариант " + (oi + 1)));
    balance(q.why, w + " объяснение");
  });

  if(!m.labs.length) err("раздел " + m.n + ": нет заданий");
  m.labs.forEach(l => {
    nl++;
    const w = "задание " + l.id;
    if(labIds.has(l.id)) err(w + ": повторяющийся идентификатор");
    labIds.add(l.id);
    if(!l.hint) err(w + ": нет подсказки");
    if(typeof l.setup !== "function") err(w + ": нет сценария (setup)");
    balance(l.brief, w + " описание");
    if(l.checks.length < 3) err(w + ": проверок " + l.checks.length);
    l.checks.forEach(c => { nc++; balance(c.label, w + " метка"); if(typeof c.test !== "function") err(w + ": проверка не функция"); });
  });

  if(!m.iv || !m.iv.length) err("раздел " + m.n + ": нет карточек собеседования");
  (m.iv || []).forEach((c, ci) => {
    ni++;
    const w = "раздел " + m.n + " карточка " + (ci + 1);
    ["q","probe","a"].forEach(k => { if(!c[k]) err(w + ": нет " + k); });
    if(c.a && c.a.length < 200) err(w + ": слишком короткий ответ");
    balance(c.q, w + " вопрос");
    balance(c.probe, w + " «что проверяют»");
    balance(c.a, w + " ответ");
    (c.more || []).forEach((x, xi) => balance(x, w + " уточнение " + (xi + 1)));
  });
});
console.log("  разделов " + MODULES.length + ", вопросов " + nq + ", заданий " + nl +
            ", проверок " + nc + ", карточек " + ni);

console.log("── примеры кода в теории");
/* Незакрытая подсветка съедает следующий текст: в <pre> теги должны быть сбалансированы,
   а внутри code — только span-подсветка. */
let npre = 0;
MODULES.forEach(m => {
  const re = /<pre><code>([\s\S]*?)<\/code><\/pre>/g;
  let p;
  while((p = re.exec(m.theory))){
    npre++;
    const body = p[1];
    const tags = body.match(/<[^>]+>/g) || [];
    for(const t of tags)
      if(!/^<\/?span\b/.test(t)) err("раздел " + m.n + ": в примере кода посторонний тег " + t);
    balance(body, "раздел " + m.n + " пример " + npre);
  }
});
console.log("  проверено примеров: " + npre);

console.log("── сценарии заданий");
/* Сценарий должен строиться без ошибок и оставлять репозиторий в осмысленном виде. */
{
  const {newRepo, runGit, headId, obj, statusSets} = new Function(CODE +
    "\nreturn {newRepo, runGit, headId, obj, statusSets};")();
  let n = 0;
  for(const m of MODULES) for(const lab of m.labs){
    n++;
    try{
      const R = newRepo("webapp");
      R.initialized = true;
      lab.setup(R);
      if(!headId(R) && !R.merging) err("задание " + lab.id + ": сценарий не создал ни одного коммита");
      statusSets(R);
    }catch(x){ err("задание " + lab.id + ": сценарий упал — " + x.message); }
  }
  console.log("  проверено сценариев: " + n);
}

console.log("── примеры из нижней панели");
/* Каждый пример-чип должен разбираться движком. Часть примеров намеренно падает
   во время выполнения — это учебная демонстрация; ошибка РАЗБОРА недопустима. */
const app = fs.readFileSync(path.join(dir, "50_app.js"), "utf8");
const cm = app.match(/const CHIPS = (\{[\s\S]*?\n\};)/);
if(!cm) err("в 50_app.js не найден список примеров CHIPS");
else {
  const {newRepo, runGit, doCommit, moveHead, checkoutTree} = new Function(CODE +
    "\nreturn {newRepo, runGit, doCommit, moveHead, checkoutTree};")();
  const CHIPS = new Function("return " + cm[1].replace(/;$/, ""))();
  const known = new Set(MODULES.map(m => m.id));
  let n = 0, fail = 0;
  for(const id in CHIPS){
    if(!known.has(id)) err("пример для несуществующего раздела «" + id + "»");
    for(const c of CHIPS[id]){
      n++;
      const cmd = typeof c === "string" ? c : c[1];
      const R = newRepo("webapp");
      R.initialized = true;
      /* минимальный репозиторий, чтобы примерам было к чему обращаться */
      R.index["README.md"] = "# webapp"; R.work["README.md"] = "# webapp";
      R.now += 3600;
      const id0 = doCommit(R, "chore: заготовка проекта", []);
      moveHead(R, id0, "commit (initial): chore: заготовка проекта");
      checkoutTree(R, id0);
      const r = runGit(R, cmd);
      if(r.err && /не живёт|is not a git command|незакрытая/.test(r.err))
        err("пример «" + cmd + "»: движок не понимает команду — " + r.err);
      else if(r.err) fail++;
    }
  }
  for(const m of MODULES) if(!CHIPS[m.id]) err("раздел " + m.n + " (" + m.id + "): нет примеров");
    console.log("  примеров " + n + ", из них не применимы к пустому репозиторию " + fail);
}
console.log(bad ? "\nПРОБЛЕМ: " + bad : "\nцелостность в порядке");
process.exit(bad ? 1 : 0);
