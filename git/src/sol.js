/* Эталонные решения заданий. Шаг — либо строка команды, либо объект:
     {rebase, plan:[{op, i}]}  — интерактивное перебазирование (i — номер коммита от старых к новым)
     {fn}                      — действие, которое человек делает по ходу (например, ответы bisect)
     {cmd, expectErr:true}     — команда, отказ которой и есть предмет урока */
const SOL = {

"1a": [
  'echo "первая версия" > notes.txt',
  "git add notes.txt",
  'echo "вторая версия" > notes.txt',
  'git commit -m "заметки"'
],

"1b": [
  "git restore --staged debug.log",
  "git restore app.py",
  "git status"
],

"2a": [
  "git add export/csv.py",
  'git commit --amend -m "feat: экспорт отчёта в CSV"'
],

"2b": [
  'echo ".env" > .gitignore',
  "git rm --cached .env",
  "git add .gitignore",
  'git commit -m "chore: перестать отслеживать .env"'
],

"3a": [
  'echo "одно и то же" > a.txt',
  'echo "одно и то же" > b.txt',
  'echo "другое" > c.txt',
  "git add .",
  'git commit -m "test: одинаковые файлы"',
  "git cat-file -p HEAD^{tree}"
],

"3b": [
  "git log --oneline",
  'git tag -a v1.0 HEAD~1 -m "релиз 1.0"'
],

"4a": [
  "git switch -c hotfix",
  "git switch main"
],

"4b": [
  "git stash",
  "git switch release",
  "git switch main",
  "git stash pop"
],

"5a": [
  'git merge --no-ff "feature/поиск" -m "Merge branch \'feature/поиск\'"'
],

"5b": [
  'git merge "feature/таймауты"',
  "cat config.py",
  'echo "timeout = 30" > config.py',
  "git add config.py",
  'git commit -m "merge: компромиссный таймаут"'
],

"5c": [
  "git merge --abort"
],

"6a": [
  'git switch "feature/фильтры"',
  "git rebase main",
  "git switch main",
  'git merge "feature/фильтры"'
],

"6b": [
  {rebase: "HEAD~4", plan: [{op:"pick", i:0}, {op:"fixup", i:1}, {op:"fixup", i:2}, {op:"drop", i:3}]}
],

"6c": [
  'git rebase --onto main release "feature/подсказки"'
],

"7a": [
  "git reset HEAD~1",
  "git add parse.py",
  'git commit -m "fix: разбор пустого запроса"',
  "git add FORMAT.md",
  'git commit -m "docs: описание формата"'
],

"7b": [
  "git log --oneline",
  "git revert HEAD~1"
],

"8a": [
  "git reflog",
  "git reset --hard ORIG_HEAD"
],

"8b": [
  "git reflog",
  'git branch "feature/импорт" HEAD@{1}'
],

"9a": [
  "git fetch origin",
  "git log --oneline origin/main"
],

"9b": [
  'git push -u origin "feature/экспорт"'
],

"10a": [
  "git pull --rebase origin main",
  "git push"
],

"10b": [
  {cmd: "git push --force-with-lease", expectErr: true},   /* отказ — это и есть урок */
  "git fetch",
  'git log --oneline "origin/feature/поиск"',
  'git cherry-pick "origin/feature/поиск"',
  "git push --force-with-lease"
],

"11a": [
  "git log -S API_KEY",
  "git show HEAD~1"
],

"11b": [
  "git bisect start",
  "git bisect bad",
  "git bisect good HEAD~8",
  {fn: (R, push) => {
    /* человек на каждом шаге смотрит файл и отвечает */
    for(let i = 0; i < 12; i++){
      push("cat calc.py");
      const broken = R.work["calc.py"] === "RESULT = -1";
      const r = push("git bisect " + (broken ? "bad" : "good"));
      if(r.out.some(l => /is the first bad commit/.test(l))) break;
    }
  }},
  "git bisect reset"
],

"12a": [
  'git switch -c "feature/TC-1042"',
  'echo "PAGE_SIZE = 50" > paging.py',
  "git add paging.py",
  'git commit -m "feat: пагинация списка"',
  'git push -u origin "feature/TC-1042"',
  "git switch main"
],

"12b": [
  "git switch main",
  "git pull",
  'git branch -D "feature/фильтры"'
]

};
