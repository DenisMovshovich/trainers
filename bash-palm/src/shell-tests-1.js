let pass=0, fail=0;
function T(name, script, expOut, expCode){
  const sh = newShell();
  let r;
  try{ r = runProgram(sh, script); }
  catch(e){ console.log("✗ "+name+" — ИСКЛЮЧЕНИЕ: "+e.message); fail++; return; }
  const got = r.out;
  let ok = true, why = [];
  if(expOut !== null && got !== expOut){ ok = false; why.push("вывод "+JSON.stringify(got)+" вместо "+JSON.stringify(expOut)); }
  if(expCode !== undefined && r.code !== expCode){ ok = false; why.push("код "+r.code+" вместо "+expCode); }
  if(ok) pass++; else { fail++; console.log("✗ "+name+" → "+why.join("; ")+(r.err?"  [stderr: "+r.err.trim()+"]":"")); }
}
function TS(name, script, fn){
  const sh = newShell(); let r;
  try{ r = runProgram(sh, script); }catch(e){ console.log("✗ "+name+" — ИСКЛЮЧЕНИЕ: "+e.message); fail++; return; }
  if(fn(sh, r)) pass++; else { fail++; console.log("✗ "+name+" → состояние не то. out="+JSON.stringify(r.out)+" err="+JSON.stringify(r.err)+" code="+r.code); }
}

console.log("── основы");
T("echo", "echo привет", "привет\n", 0);
T("echo несколько слов", "echo  a   b", "a b\n");
T("pwd", "pwd", "/home/user\n");
T("две команды", "echo a; echo b", "a\nb\n");
T("код возврата", "true; echo $?", "0\n");
T("код возврата ошибки", "false; echo $?", "1\n");
T("несуществующая команда", "нетакой", "", 127);
T("комментарий", "echo a # хвост", "a\n");

console.log("── кавычки и раскрытия");
T("одинарные кавычки", "echo '$HOME'", "$HOME\n");
T("двойные кавычки", 'echo "$HOME"', "/home/user\n");
T("без кавычек", "echo $HOME", "/home/user\n");
T("переменная", "X=5; echo $X", "5\n");
T("фигурные скобки в имени", "X=5; echo ${X}0", "50\n");
T("длина", "X=abcd; echo ${#X}", "4\n");
T("значение по умолчанию", "echo ${NOPE:-запасное}", "запасное\n");
T("обрезка суффикса", "F=a.txt; echo ${F%.txt}", "a\n");
T("обрезка префикса", "P=/a/b/c; echo ${P##*/}", "c\n");
T("замена", "S=aaa; echo ${S//a/b}", "bbb\n");
T("разбиение слов", "X='a b'; for i in $X; do echo $i; done", "a\nb\n");
T("кавычки против разбиения", 'X="a b"; for i in "$X"; do echo $i; done', "a b\n");
T("brace список", "echo {a,b,c}", "a b c\n");
T("brace диапазон", "echo {1..4}", "1 2 3 4\n");
T("brace с префиксом", "echo f{1,2}.txt", "f1.txt f2.txt\n");
T("тильда", "echo ~", "/home/user\n");
T("подстановка команды", "echo $(echo вложено)", "вложено\n");
T("обратные кавычки", "echo `echo x`", "x\n");
T("арифметика", "echo $((2+3*4))", "14\n");
T("арифметика с переменной", "N=7; echo $((N*2))", "14\n");
T("экранирование", "echo a\\ b", "a b\n");

console.log("── файлы и перенаправления");
T("ls", "ls", "data.csv  docs/  logs/  notes.txt  todo.txt\n");
T("cat", "cat notes.txt", "молоко\nхлеб\nсыр\nмолоко\n");
TS("запись в файл", "echo привет > f.txt", sh=>readFile(sh,"/home/user/f.txt")==="привет\n");
TS("дозапись", "echo a > f; echo b >> f", sh=>readFile(sh,"/home/user/f")==="a\nb\n");
T("чтение из файла", "wc -l < notes.txt", "4\n");
T("stderr отдельно", "cat нет 2>/dev/null; echo ok", "ok\n");
TS("stderr в файл", "cat нет 2> e.txt", sh=>readFile(sh,"/home/user/e.txt").includes("Нет такого"));
T("2>&1 в конвейер", "cat нет 2>&1 | wc -l", "1\n");
T("here-string", "tr a-z A-Z <<< hello", "HELLO\n");

console.log("── конвейеры и фильтры");
T("конвейер", "cat notes.txt | wc -l", "4\n");
T("grep", "grep молоко notes.txt", "молоко\nмолоко\n");
T("grep -c", "grep -c молоко notes.txt", "2\n");
T("grep -v", "grep -v молоко notes.txt", "хлеб\nсыр\n");
T("grep -n", "grep -n сыр notes.txt", "3:сыр\n");
T("grep -i", "grep -i МОЛОКО notes.txt", "молоко\nмолоко\n");
T("sort", "sort notes.txt", "молоко\nмолоко\nсыр\nхлеб\n");
T("sort | uniq", "sort notes.txt | uniq", "молоко\nсыр\nхлеб\n");
T("uniq -c", "sort notes.txt | uniq -c", "      2 молоко\n      1 сыр\n      1 хлеб\n");
T("head -n", "head -n 2 notes.txt", "молоко\nхлеб\n");
T("tail -n", "tail -n 1 notes.txt", "молоко\n");
T("cut -d -f", "cut -d, -f1 data.csv | head -n 2", "имя\nАда\n");
T("wc -w", "echo раз два три | wc -w", "3\n");
T("tr", "echo abc | tr a-z A-Z", "ABC\n");
T("sed замена", "echo 'кот кот' | sed 's/кот/пёс/'", "пёс кот\n");
T("sed глобально", "echo 'кот кот' | sed 's/кот/пёс/g'", "пёс пёс\n");
T("sed -n p", "sed -n 2p notes.txt", "хлеб\n");
T("awk поле", "awk -F, '{print $2}' data.csv | tail -n 4 | head -n 1", "разработка\n");
T("awk условие", "awk -F, '$2 == \"аналитика\" {print $1}' data.csv", "Алан\n");
T("awk NR", "awk 'NR==1 {print $0}' notes.txt", "молоко\n");

console.log("── шаблоны");
T("glob *", "cd docs; ls *.md", "readme.md  report.md\n");
TS("glob раскрывается", "cd docs; echo *.md", (sh,r)=>r.out==="readme.md report.md\n");
T("glob без совпадений", "echo нетточно*", "нетточно*\n");
T("glob ?", "cd docs; echo ????me.md", "readme.md\n");

console.log("── условия и циклы");
T("test файл", "[ -f notes.txt ]; echo $?", "0\n");
T("test каталог", "[ -d docs ]; echo $?", "0\n");
T("test нет файла", "[ -f нет ]; echo $?", "1\n");
T("if then", "if [ -f notes.txt ]; then echo есть; fi", "есть\n");
T("if else", "if [ -f нет ]; then echo да; else echo нет; fi", "нет\n");
T("&&", "true && echo да", "да\n");
T("|| не сработал", "true || echo нет", "");
T("|| сработал", "false || echo да", "да\n");
T("числовое сравнение", "[ 5 -gt 3 ] && echo больше", "больше\n");
T("строковое равенство", "[ abc = abc ] && echo равно", "равно\n");
T("for по списку", "for i in 1 2 3; do echo n$i; done", "n1\nn2\nn3\n");
T("for по glob", "cd docs; for f in *.md; do echo $f; done", "readme.md\nreport.md\n");
T("while read", "while read l; do echo [$l]; done < notes.txt", "[молоко]\n[хлеб]\n[сыр]\n[молоко]\n");
T("while счётчик", "i=0; while [ $i -lt 3 ]; do echo $i; i=$((i+1)); done", "0\n1\n2\n");
T("case", "x=b; case $x in a) echo A;; b) echo B;; *) echo прочее;; esac", "B\n");
T("until", "i=0; until [ $i -ge 2 ]; do echo $i; i=$((i+1)); done", "0\n1\n");

console.log("── функции и скрипты");
T("функция", "hi(){ echo привет $1; }; hi мир", "привет мир\n");
T("функция возврат", "f(){ return 3; }; f; echo $?", "3\n");
T("аргументы", "set -- a b c; echo $#; echo $1; echo $@", "3\na\na b c\n");
TS("скрипт", "printf '%s\\n' '#!/bin/bash' 'echo из скрипта' > s.sh; chmod +x s.sh; ./s.sh",
  (sh,r)=>r.out==="из скрипта\n");
T("source", "echo 'V=42' > v.sh; source v.sh; echo $V", "42\n");
T("set -e", "set -e; false; echo не должно", "", 1);
T("set -u", "set -u; echo $NOPE", "", 2);
T("pipefail", "set -o pipefail; false | true; echo $?", "1\n");

console.log("── find и xargs");
T("find -name", "cd docs; find . -name '*.md' | sort", "./readme.md\n./report.md\n");
T("find -type d", "find . -type d | sort", ".\n./docs\n./logs\n");
T("xargs", "echo a b | xargs -n 1 echo x", "x a\nx b\n");
T("xargs -I", "echo f1 | xargs -I{} echo было {} стало", "было f1 стало\n");

console.log("\nитог: "+pass+" пройдено, "+fail+" провалено");
process.exit(fail?1:0);
