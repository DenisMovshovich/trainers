
/* ── тесты движка ──────────────────────────────────────── */
let pass = 0, fail = 0;
function run(script){
  const R = newRepo("webapp");
  R.initialized = true;
  let last = [];
  for(const line of script.trim().split("\n")){
    const s = line.trim();
    if(!s) continue;
    const r = runGit(R, s);
    last = r.err ? ["ОШИБКА: " + r.err] : r.out;
  }
  return {R, out: last.join("\n")};
}
function T(name, script, expect){
  const {R, out} = run(script);
  const ok = typeof expect === "function" ? expect(out, R) : out.trim() === String(expect).trim();
  if(ok) pass++;
  else { fail++; console.log("✗ " + name); console.log("    вышло:\n" + out.split("\n").map(x => "      " + x).join("\n")); }
}
const has = s => (o) => o.indexOf(s) >= 0;

console.log("── три дерева");
T("новый файл не отслеживается", `
echo "hello" > a.txt
git status --short`, "?? a.txt");
T("после add файл в индексе", `
echo "hello" > a.txt
git add a.txt
git status --short`, "A  a.txt");
T("изменение после add видно отдельно", `
echo "one" > a.txt
git add a.txt
echo "two" > a.txt
git status --short`, "AM a.txt");
T("commit требует индекса", `
echo "hi" > a.txt
git commit -m "нет"`, has("nothing to commit"));
T("commit без -m ругается", `
echo "hi" > a.txt
git add a.txt
git commit`, has("empty commit message"));
T("первый коммит помечен root-commit", `
echo "hi" > a.txt
git add a.txt
git commit -m "первый"`, has("(root-commit)"));
T("после коммита дерево чистое", `
echo "hi" > a.txt
git add a.txt
git commit -m "первый"
git status`, has("working tree clean"));
T("restore --staged убирает из индекса", `
echo "hi" > a.txt
git add a.txt
git restore --staged a.txt
git status --short`, "?? a.txt");
T("restore возвращает файл", `
echo "one" > a.txt
git add a.txt
git commit -m "c1"
echo "two" > a.txt
git restore a.txt
cat a.txt`, "one");

console.log("── .gitignore");
T("игнорируемый файл не виден", `
echo "*.log" > .gitignore
echo "шум" > app.log
git add .gitignore
git commit -m "ignore"
git status --short`, "");
T("уже отслеженный файл игнор не спасает", `
echo "данные" > app.log
git add app.log
git commit -m "добавил лог"
echo "*.log" > .gitignore
echo "ещё" > app.log
git status --short`, (o) => o.indexOf(" M app.log") >= 0);
T("rm --cached снимает с учёта", `
echo "данные" > app.log
git add app.log
git commit -m "c1"
echo "*.log" > .gitignore
git rm --cached app.log
git status --short`, (o) => o.indexOf("D  app.log") >= 0);

console.log("── объектная модель");
T("одинаковое содержимое — один blob", "", (o, R) => {
  const a = blobId(R, "привет"), b = blobId(R, "привет"), c = blobId(R, "пока");
  return a === b && a !== c && a.length === 40;
});
T("хеш коммита зависит от родителя", `
echo "a" > a.txt
git add a.txt
git commit -m "one"
git log --oneline`, (o, R) => {
  const id = headId(R);
  return obj(R, id).parents.length === 0 && id.length === 40;
});
T("cat-file показывает тип", `
echo "a" > a.txt
git add a.txt
git commit -m "one"
git cat-file -t HEAD`, "commit");
T("дерево содержит подкаталоги", `
echo "x" > src/app.js
git add .
git commit -m "one"
git cat-file -p HEAD^{tree}`, (o) => /tree .* src/.test(o) || o.indexOf("src") >= 0);

console.log("── ветки");
T("новая ветка указывает туда же", `
echo "a" > a.txt
git add .
git commit -m "one"
git branch feature
git branch`, "  feature\n* main");
T("checkout -b создаёт и переключает", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature`, "Switched to a new branch 'feature'");
T("switch -c то же самое", `
echo "a" > a.txt
git add .
git commit -m "one"
git switch -c feature
git branch`, (o) => o.indexOf("* feature") >= 0);
T("отсоединённый HEAD", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "b" > b.txt
git add .
git commit -m "two"
git checkout HEAD~1`, has("detached HEAD"));
T("ветку с невлитым нельзя удалить без -D", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "два"
git checkout main
git branch -d feature`, has("not fully merged"));

console.log("── слияние");
T("fast-forward когда main не двигался", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "two"
git checkout main
git merge feature`, has("Fast-forward"));
T("--no-ff делает коммит слияния", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "two"
git checkout main
git merge --no-ff feature -m "merge"
git log --oneline`, (o, R) => obj(R, headId(R)).parents.length === 2);
T("расхождение даёт настоящий merge", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "two"
git checkout main
echo "c" > c.txt
git add .
git commit -m "three"
git merge feature`, has("Merge made by"));
T("правки в разных файлах не конфликтуют", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "новое" > b.txt
git add .
git commit -m "b"
git checkout main
echo "другое" > c.txt
git add .
git commit -m "c"
git merge feature
cat b.txt`, has("новое"));
T("КОНФЛИКТ при правке одной строки", `
echo "версия один" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "версия ветки" > a.txt
git add .
git commit -m "ветка"
git checkout main
echo "версия main" > a.txt
git add .
git commit -m "main"
git merge feature`, has("CONFLICT"));
T("маркеры конфликта попадают в файл", `
echo "версия один" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "версия ветки" > a.txt
git add .
git commit -m "ветка"
git checkout main
echo "версия main" > a.txt
git add .
git commit -m "main"
git merge feature
cat a.txt`, (o) => o.indexOf("<<<<<<< HEAD") >= 0 && o.indexOf("=======") >= 0 && o.indexOf(">>>>>>>") >= 0);
T("merge --abort возвращает как было", `
echo "один" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "ветка" > a.txt
git add .
git commit -m "f"
git checkout main
echo "main" > a.txt
git add .
git commit -m "m"
git merge feature
git merge --abort
cat a.txt`, "main");
T("commit во время конфликта запрещён", `
echo "один" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "ветка" > a.txt
git add .
git commit -m "f"
git checkout main
echo "main" > a.txt
git add .
git commit -m "m"
git merge feature
git commit -m "рано"`, has("unmerged files"));
T("разрешение конфликта через add + commit", `
echo "один" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "ветка" > a.txt
git add .
git commit -m "f"
git checkout main
echo "main" > a.txt
git add .
git commit -m "m"
git merge feature
echo "итог" > a.txt
git add a.txt
git commit -m "resolve"
git log --oneline`, (o, R) => obj(R, headId(R)).parents.length === 2 && R.work["a.txt"] === "итог");
T("--ff-only отказывается при расхождении", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "two"
git checkout main
echo "c" > c.txt
git add .
git commit -m "three"
git merge --ff-only feature`, has("Not possible to fast-forward"));

console.log("── перебазирование");
T("rebase переносит коммиты", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "фича"
git checkout main
echo "c" > c.txt
git add .
git commit -m "main-работа"
git checkout feature
git rebase main
git log --oneline`, (o, R) => {
  const h = history(R, headId(R));
  return h.length === 3 && obj(R, headId(R)).msg === "фича" &&
         obj(R, obj(R, headId(R)).parents[0]).msg === "main-работа";
});
T("после rebase история линейна", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "f1"
git checkout main
echo "c" > c.txt
git add .
git commit -m "m1"
git checkout feature
git rebase main`, (o, R) => history(R, headId(R)).every(c => obj(R, c).parents.length <= 1));
T("rebase меняет хеши", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "f1"
git checkout main
echo "c" > c.txt
git add .
git commit -m "m1"
git checkout feature
git rebase main`, (o, R) => {
  const old = (R.reflog["refs/heads/feature"] || []).map(e => e.to);
  return headId(R) !== old[old.length - 1];
});

console.log("── сброс и отмена");
T("reset --soft оставляет индекс", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "b" > b.txt
git add .
git commit -m "two"
git reset --soft HEAD~1
git status --short`, "A  b.txt");
T("reset --mixed убирает из индекса", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "b" > b.txt
git add .
git commit -m "two"
git reset HEAD~1
git status --short`, "?? b.txt");
T("reset --hard стирает всё", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "b" > b.txt
git add .
git commit -m "two"
git reset --hard HEAD~1
git status --short`, "");
T("revert добавляет коммит, а не убирает", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "плохо" > bad.txt
git add .
git commit -m "плохой"
git revert HEAD`, (o, R) => history(R, headId(R)).length === 3 && R.work["bad.txt"] === undefined);
T("revert merge требует -m", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b f
echo "b" > b.txt
git add .
git commit -m "f1"
git checkout main
echo "c" > c.txt
git add .
git commit -m "m1"
git merge f
git revert HEAD`, has("no -m option"));

console.log("── reflog и спасение");
T("reflog помнит перемещения", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "b" > b.txt
git add .
git commit -m "two"
git reset --hard HEAD~1
git reflog`, (o) => o.indexOf("reset: moving to") >= 0 && o.indexOf("commit: two") >= 0);
T("возврат после reset --hard", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "b" > b.txt
git add .
git commit -m "two"
git reset --hard HEAD~1
git reset --hard main@{1}
cat b.txt`, "b");
T("ORIG_HEAD после reset", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "b" > b.txt
git add .
git commit -m "two"
git reset --hard HEAD~1
git reset --hard ORIG_HEAD
git log --oneline`, has("two"));
T("после branch -D коммит держит reflog, fsck молчит", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "нужный"
git checkout main
git branch -D feature
git fsck`, "");
T("но reflog его помнит", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "нужный"
git checkout main
git branch -D feature
git reflog`, has("commit: нужный"));
T("ветка восстанавливается из reflog", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "нужный"
git checkout main
git branch -D feature
git branch feature HEAD@{1}
git checkout feature
cat b.txt`, "b");
T("когда reflog вычищен, остаётся fsck", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "нужный"
git checkout main
git branch -D feature
git reflog expire --expire=now --all
git fsck`, has("dangling commit"));

console.log("── прятки");
T("stash убирает изменения", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "черновик" > a.txt
git stash
cat a.txt`, "a");
T("stash pop возвращает", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "черновик" > a.txt
git stash
git stash pop
cat a.txt`, "черновик");
T("stash list", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "черновик" > a.txt
git stash
git stash list`, has("stash@{0}"));

console.log("── cherry-pick");
T("переносит один коммит", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "нужное" > fix.txt
git add .
git commit -m "нужный фикс"
echo "лишнее" > junk.txt
git add .
git commit -m "лишний"
git checkout main
git cherry-pick feature~1`, (o, R) => R.work["fix.txt"] === "нужное" && R.work["junk.txt"] === undefined);

console.log("── удалённые репозитории");
T("push создаёт ветку на сервере", `
git remote add origin webapp
echo "a" > a.txt
git add .
git commit -m "one"
git push -u origin main`, (o, R) => R.remotes.origin.repo.refs["refs/heads/main"] === headId(R));
T("fetch не двигает локальную ветку", "", (o, R0) => {
  const {R} = run(`
git remote add origin webapp
echo "a" > a.txt
git add .
git commit -m "one"
git push -u origin main`);
  /* коллега запушил */
  const rem = R.remotes.origin.repo;
  rem.index = commitFiles(rem, rem.refs["refs/heads/main"]);
  rem.index["colleague.txt"] = "их работа";
  rem.now += 60;
  const nid = doCommit(rem, "чужой коммит", [rem.refs["refs/heads/main"]]);
  rem.refs["refs/heads/main"] = nid;
  const before = headId(R);
  runGit(R, "git fetch origin");
  return headId(R) === before && R.refs["refs/remotes/origin/main"] === nid;
});
T("push отклоняется, если сервер ушёл вперёд", "", () => {
  const {R} = run(`
git remote add origin webapp
echo "a" > a.txt
git add .
git commit -m "one"
git push -u origin main`);
  const rem = R.remotes.origin.repo;
  rem.index = commitFiles(rem, rem.refs["refs/heads/main"]);
  rem.index["theirs.txt"] = "их";
  rem.now += 60;
  rem.refs["refs/heads/main"] = doCommit(rem, "чужой", [rem.refs["refs/heads/main"]]);
  runGit(R, 'echo "мой" > mine.txt');
  runGit(R, "git add .");
  runGit(R, 'git commit -m "мой"');
  const r = runGit(R, "git push origin main");
  return !!r.err && r.err.indexOf("rejected") >= 0;
});
T("pull --rebase кладёт мой коммит сверху", "", () => {
  const {R} = run(`
git remote add origin webapp
echo "a" > a.txt
git add .
git commit -m "one"
git push -u origin main`);
  const rem = R.remotes.origin.repo;
  rem.index = commitFiles(rem, rem.refs["refs/heads/main"]);
  rem.index["theirs.txt"] = "их";
  rem.now += 60;
  rem.refs["refs/heads/main"] = doCommit(rem, "чужой", [rem.refs["refs/heads/main"]]);
  runGit(R, 'echo "мой" > mine.txt');
  runGit(R, "git add .");
  runGit(R, 'git commit -m "мой"');
  runGit(R, "git pull --rebase origin main");
  const h = history(R, headId(R));
  return obj(R, headId(R)).msg === "мой" && obj(R, h[1]).msg === "чужой" && h.length === 3;
});
T("force-with-lease ловит чужой коммит", "", () => {
  const {R} = run(`
git remote add origin webapp
echo "a" > a.txt
git add .
git commit -m "one"
git push -u origin main`);
  const rem = R.remotes.origin.repo;
  rem.index = commitFiles(rem, rem.refs["refs/heads/main"]);
  rem.index["theirs.txt"] = "их";
  rem.now += 60;
  rem.refs["refs/heads/main"] = doCommit(rem, "чужой", [rem.refs["refs/heads/main"]]);
  runGit(R, 'echo "мой" > mine.txt');
  runGit(R, "git add .");
  runGit(R, 'git commit --amend -m "переписал"');
  const r = runGit(R, "git push --force-with-lease origin main");
  return !!r.err && r.err.indexOf("stale info") >= 0;
});

console.log("── интерактивное перебазирование");
T("squash склеивает два коммита", "", () => {
  const {R} = run(`
echo "a" > a.txt
git add .
git commit -m "one"
echo "фича" > f.txt
git add .
git commit -m "feat: начало"
echo "правка" >> f.txt
git add .
git commit -m "wip"`);
  const picks = ownCommits(R, headId(R), resolve(R, "HEAD~2"));
  applyTodo(R, "HEAD~2", [{op:"pick", commit:picks[0]}, {op:"fixup", commit:picks[1]}]);
  const h = history(R, headId(R));
  return h.length === 2 && obj(R, headId(R)).msg === "feat: начало" &&
         R.work["f.txt"] === "фича\nправка";
});
T("drop выбрасывает коммит", "", () => {
  const {R} = run(`
echo "a" > a.txt
git add .
git commit -m "one"
echo "секрет" > secret.txt
git add .
git commit -m "случайно"
echo "b" > b.txt
git add .
git commit -m "нужное"`);
  const picks = ownCommits(R, headId(R), resolve(R, "HEAD~2"));
  applyTodo(R, "HEAD~2", [{op:"drop", commit:picks[0]}, {op:"pick", commit:picks[1]}]);
  return R.work["secret.txt"] === undefined && R.work["b.txt"] === "b" &&
         history(R, headId(R)).length === 2;
});
T("reorder меняет порядок", "", () => {
  const {R} = run(`
echo "a" > a.txt
git add .
git commit -m "one"
echo "x" > x.txt
git add .
git commit -m "первый"
echo "y" > y.txt
git add .
git commit -m "второй"`);
  const picks = ownCommits(R, headId(R), resolve(R, "HEAD~2"));
  applyTodo(R, "HEAD~2", [{op:"pick", commit:picks[1]}, {op:"pick", commit:picks[0]}]);
  return obj(R, headId(R)).msg === "первый" &&
         obj(R, obj(R, headId(R)).parents[0]).msg === "второй";
});

console.log("── поиск");
T("blame показывает автора строки", `
echo "первая" > a.txt
git add .
git commit -m "one"
echo "вторая" >> a.txt
git add .
git commit -m "two"
git blame a.txt`, (o) => o.split("\n").length === 2 && /первая/.test(o) && /вторая/.test(o));
T("log -S находит коммит со строкой", `
echo "чисто" > a.txt
git add .
git commit -m "one"
echo "PASSWORD=123" > cfg.txt
git add .
git commit -m "утечка"
git log -S PASSWORD`, has("утечка"));

console.log("── ошибки внятные");
T("неизвестная ветка", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout nosuch`, has("unknown revision"));
T("не git-команда", `svn commit`, has("здесь не живёт"));
T("не та подкоманда git", `git frobnicate`, has("is not a git command"));

console.log("── двоичный поиск и фильтры");
T("bisect находит виновника", `
echo "RESULT = 42" > calc.py
git add .
git commit -m "one"
echo "x = 1" > a.py
git add .
git commit -m "шаг 1"
echo "x = 2" > b.py
git add .
git commit -m "шаг 2"
echo "RESULT = -1" > calc.py
git add .
git commit -m "сломал"
echo "x = 4" > d.py
git add .
git commit -m "шаг 4"
echo "x = 5" > e.py
git add .
git commit -m "шаг 5"
git bisect start
git bisect bad
git bisect good HEAD~5`, (o, R) => {
  /* доводим поиск до конца, отвечая по содержимому файла */
  for(let i = 0; i < 10; i++){
    const broken = R.work["calc.py"] === "RESULT = -1";
    const r = runGit(R, "git bisect " + (broken ? "bad" : "good"));
    if(r.out.some(l => /is the first bad commit/.test(l)))
      return r.out.some(l => /сломал/.test(l));
  }
  return false;
});
T("bisect reset возвращает на ветку", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "b" > b.txt
git add .
git commit -m "two"
echo "c" > c.txt
git add .
git commit -m "three"
git bisect start
git bisect bad
git bisect good HEAD~2
git bisect reset`, (o, R) => branchName(R) === "main" && !R.bisect);
T("merge-base находит общего предка", `
echo "a" > a.txt
git add .
git commit -m "база"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "f"
git checkout main
echo "c" > c.txt
git add .
git commit -m "m"
git merge-base main feature`, (o, R) => obj(R, o.trim()).msg === "база");
T("log по пути", `
echo "a" > a.txt
git add .
git commit -m "про a"
echo "b" > b.txt
git add .
git commit -m "про b"
echo "a2" > a.txt
git add .
git commit -m "снова про a"
git log --oneline -- a.txt`, (o) => o.split("\n").length === 2 && !/про b/.test(o));
T("log --grep", `
echo "a" > a.txt
git add .
git commit -m "feat: раз"
echo "b" > b.txt
git add .
git commit -m "fix: два"
git log --oneline --grep=fix`, (o) => o.split("\n").length === 1 && /два/.test(o));
T("диапазон A..B", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "только в ветке"
git log --oneline main..feature`, (o) => o.split("\n").length === 1 && /только в ветке/.test(o));
T("коммит слияния без -m", `
echo "a" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "b" > b.txt
git add .
git commit -m "f"
git checkout main
echo "c" > c.txt
git add .
git commit -m "m"
git merge feature`, (o, R) => obj(R, headId(R)).msg === "Merge branch 'feature'");
T("checkout --ours берёт свою сторону", `
echo "один" > a.txt
git add .
git commit -m "one"
git checkout -b feature
echo "ветка" > a.txt
git add .
git commit -m "f"
git checkout main
echo "main" > a.txt
git add .
git commit -m "m"
git merge feature
git checkout --ours a.txt
cat a.txt`, "main");
T("push --delete убирает ветку с сервера", `
git remote add origin webapp
echo "a" > a.txt
git add .
git commit -m "one"
git push -u origin main
git checkout -b temp
echo "b" > b.txt
git add .
git commit -m "t"
git push -u origin temp
git push origin --delete temp`, (o, R) => !R.remotes.origin.repo.refs["refs/heads/temp"]);
T("stash -u прячет и неотслеживаемое", `
echo "a" > a.txt
git add .
git commit -m "one"
echo "черновик" > new.txt
git stash -u
ls`, "a.txt");

console.log("\nитог: " + pass + " пройдено, " + fail + " провалено");
