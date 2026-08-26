let pass=0, fail=0;
function T(name, script, expOut, expCode){
  const sh = newShell(); let r;
  try{ r = runProgram(sh, script); }catch(e){ console.log("✗ "+name+" — ИСКЛЮЧЕНИЕ: "+e.message); fail++; return; }
  let ok=true, why=[];
  if(expOut !== null && r.out !== expOut){ ok=false; why.push("вывод "+JSON.stringify(r.out)+" вместо "+JSON.stringify(expOut)); }
  if(expCode !== undefined && r.code !== expCode){ ok=false; why.push("код "+r.code+" вместо "+expCode); }
  if(ok) pass++; else { fail++; console.log("✗ "+name+" → "+why.join("; ")+(r.err?" [err: "+r.err.trim().slice(0,70)+"]":"")); }
}
console.log("── heredoc и запись скриптов");
T("heredoc", "cat <<'EOF'\nстрока1\nстрока2\nEOF", "строка1\nстрока2\n");
T("heredoc с раскрытием", "X=мир\ncat <<EOF\nпривет $X\nEOF", "привет мир\n");
T("heredoc без раскрытия", "X=мир\ncat <<'EOF'\nпривет $X\nEOF", "привет $X\n");
T("heredoc в файл и запуск",
  "cat > s.sh <<'EOF'\n#!/bin/bash\necho здравствуй $1\nEOF\nchmod +x s.sh\n./s.sh мир", "здравствуй мир\n");

console.log("── ловушки со словами и кавычками");
T("пробел в имени без кавычек", "mkdir d; touch 'd/два слова.txt'; ls d | wc -l", "1\n");
T("rm без кавычек ломается", "touch 'a b.txt'; rm a b.txt 2>/dev/null; ls | grep -c 'a b'", "1\n");
T("rm с кавычками работает", "touch 'a b.txt'; rm 'a b.txt'; ls | grep -c 'a b'", "0\n", 1);
T("$@ в кавычках сохраняет слова", 'f(){ for x in "$@"; do echo [$x]; done; }; f "a b" c', "[a b]\n[c]\n");
T("$* склеивает", 'f(){ for x in "$*"; do echo [$x]; done; }; f "a b" c', "[a b c]\n");
T("пустая переменная без кавычек исчезает", 'E=""; set -- x $E y; echo $#', "2\n");
T("пустая переменная в кавычках остаётся", 'E=""; set -- x "$E" y; echo $#', "3\n");

console.log("── коды возврата и надёжность");
T("конвейер возвращает последний код", "false | true; echo $?", "0\n");
T("pipefail меняет это", "set -o pipefail; false | true; echo $?", "1\n");
T("set -e останавливает", "set -e; echo раз; false; echo два", "раз\n", 1);
T("set -e не срабатывает в if", "set -e; if false; then echo да; fi; echo дошли", "дошли\n", 0);
T("|| true гасит ошибку", "set -e; false || true; echo дошли", "дошли\n", 0);
T("код функции", "f(){ return 7; }; f || echo поймали $?", "поймали 7\n");

console.log("── подстановки и вложенность");
T("вложенная подстановка", "echo $(echo $(echo глубоко))", "глубоко\n");
T("подстановка в присваивании", "N=$(ls /home/user | wc -l); echo $N", "5\n");
T("арифметика со сравнением", "echo $((3 > 2))", "1\n");
T("подстановка сохраняет пробелы в кавычках", 'X="$(echo "a  b")"; echo "$X"', "a  b\n");
T("без кавычек пробелы схлопываются", 'echo $(echo "a  b")', "a b\n");

console.log("── файловые операции");
T("mkdir -p", "mkdir -p a/b/c && test -d a/b/c && echo ок", "ок\n");
T("cp -r", "mkdir -p s/x; touch s/x/f; cp -r s t; test -f t/x/f && echo ок", "ок\n");
T("mv переименование", "touch a; mv a b; test -f b && test ! -f a && echo ок", "ок\n");
T("rm -r", "mkdir -p d/e; rm -r d; test -d d || echo удалено", "удалено\n");
T("rm каталога без -r", "mkdir d; rm d 2>/dev/null; test -d d && echo остался", "остался\n");
T("chmod +x и запуск", "echo 'echo привет' > s.sh; ./s.sh 2>/dev/null || chmod +x s.sh; ./s.sh", "привет\n");
T("перезапись >", "echo a > f; echo b > f; cat f", "b\n");

console.log("── обработка текста");
T("подсчёт уникальных", "printf '%s\\n' b a b c a b | sort | uniq -c | sort -rn | head -n 1", "      3 b\n");
T("grep -r", "grep -rn ERROR logs | wc -l", "2\n");
T("cut+sort+head", "cut -d, -f2 data.csv | tail -n 4 | sort -u", "аналитика\nразработка\n");
T("awk сумма полей", "awk -F, 'NR>1 {print $3}' data.csv | sort -n | tail -n 1", "140\n");
T("sed удаление строк", "printf 'a\\nb\\nc\\n' | sed '/b/d'", "a\nc\n");
T("tr удаление", "echo 'a1b2c3' | tr -d '0-9'", "abc\n");
T("find + xargs", "cd docs; find . -name '*.md' | xargs grep -l Проект", "./readme.md\n");

console.log("\nитог: "+pass+" пройдено, "+fail+" провалено");
process.exit(fail?1:0);
