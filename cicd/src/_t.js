
/* ── тесты движка ──────────────────────────────────────── */
let pass = 0, fail = 0;
const REPO = {
  "src/App.cs": "class App {}",
  "shop.sln": "решение",
  "Directory.Packages.props": "<Project/>"
};
const WF = (body) => Object.assign({}, REPO, {".github/workflows/ci.yml": body});

function run(script, opts){
  const C = newScenario(opts || {});
  let last = [];
  for(const line of script.trim().split("\n")){
    const s = line.trim();
    if(!s) continue;
    const r = runCi(C, s);
    last = r.err ? ["ОШИБКА: " + r.err] : r.out;
  }
  return {C, out: last.join("\n")};
}
function T(name, script, expect, opts){
  const {C, out} = run(script, opts);
  const ok = typeof expect === "function" ? expect(out, C) : out.trim() === String(expect).trim();
  if(ok) pass++;
  else { fail++; console.log("✗ " + name); console.log("    вышло:\n" + out.split("\n").map(x => "      " + x).join("\n")); }
}
const has = s => o => o.indexOf(s) >= 0;

console.log("── разбор и запуск");
const SIMPLE = `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build`;
T("простой конвейер выполняется", "ci run", has("Итог: успех"), {files: WF(SIMPLE)});
T("без checkout кода нет", "ci run", (o) => /ПАДЕНИЕ/.test(o), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: cat shop.sln`)});
T("checkout приносит файлы", "ci run\nci logs build", has("shop.sln"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cat shop.sln`)});
T("событие не подходит — запуска нет", "ci run --event pull_request",
  has("не описано в on"), {files: WF(SIMPLE)});
T("нет runs-on — понятная ошибка", "ci run", has("нет runs-on"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    steps:
      - run: echo привет`)});
T("ссылка на несуществующую задачу", "ci run", has("а такой задачи нет"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    needs: [prepare]
    steps:
      - run: echo привет`)});
T("цикл в зависимостях", "ci run", has("цикл"), {files: WF(`name: CI
on: [push]
jobs:
  a:
    runs-on: ubuntu-latest
    needs: [b]
    steps:
      - run: echo a
  b:
    runs-on: ubuntu-latest
    needs: [a]
    steps:
      - run: echo b`)});

console.log("── зависимости и параллельность");
const THREE = `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: sleep 30
  unit:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - run: sleep 20
  lint:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - run: sleep 10`;
T("независимые задачи идут одновременно", "ci run", (o, C) => {
  const r = C.runs[0];
  const unit = r.jobs.filter(j => j.name === "unit")[0], lint = r.jobs.filter(j => j.name === "lint")[0];
  return unit.start === lint.start && r.wall === 35 + 20;
}, {files: WF(THREE)});
T("машинное время больше времени конвейера", "ci run",
  (o, C) => C.runs[0].total > C.runs[0].wall, {files: WF(THREE)});
T("падение задачи пропускает зависимые", "ci run", (o, C) => {
  const r = C.runs[0];
  return r.jobs.filter(j => j.name === "build")[0].status === "failure" &&
         r.jobs.filter(j => j.name === "unit")[0].status === "skipped";
}, {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: exit 1
  unit:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - run: echo привет`)});
T("граф показывает уровни", "ci graph", has("выполняются одновременно"), {files: WF(THREE)});

console.log("── матрицы");
const MAT = `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --shard \${{ matrix.shard }}/3`;
T("матрица разворачивается в три запуска", "ci run", (o, C) =>
  C.runs[0].jobs[0].instances.length === 3, {files: WF(MAT)});
T("шардирование уменьшает время конвейера", "ci run", (o, C) => {
  const sharded = C.runs[0].wall;
  const {C: C2} = run("ci run", {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test`)});
  return sharded < C2.runs[0].wall;
}, {files: WF(MAT)});
T("exclude убирает сочетание", "ci run", (o, C) =>
  C.runs[0].jobs[0].instances.length === 3, {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [linux, windows]
        net: ["8", "9"]
        exclude:
          - os: windows
            net: "8"
    steps:
      - run: echo \${{ matrix.os }}-\${{ matrix.net }}`)});
T("fail-fast отменяет остальные", "ci run", (o, C) => {
  const inst = C.runs[0].jobs[0].instances;
  return inst.some(i => i.status === "failure") && inst.some(i => i.status === "cancelled");
}, {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        n: [1, 20, 30]
    steps:
      - if: matrix.n == 1
        run: exit 1
      - run: sleep \${{ matrix.n }}`)});
T("fail-fast: false доводит все до конца", "ci run", (o, C) => {
  const inst = C.runs[0].jobs[0].instances;
  return !inst.some(i => i.status === "cancelled") && inst.filter(i => i.status === "success").length === 2;
}, {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        n: [1, 20, 30]
    steps:
      - if: matrix.n == 1
        run: exit 1
      - run: sleep \${{ matrix.n }}`)});

console.log("── выражения и контексты");
T("подстановка контекста", "ci run\nci logs build", has("ветка main"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "ветка \${{ github.ref_name }}"`)});
T("переменные окружения", "ci run\nci logs build", has("режим prod"), {files: WF(`name: CI
on: [push]
env:
  MODE: prod
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "режим \${{ env.MODE }}"`)});
T("выходные значения между задачами", "ci run\nci logs use", has("версия 1.4.2"), {files: WF(`name: CI
on: [push]
jobs:
  prep:
    runs-on: ubuntu-latest
    outputs:
      ver: \${{ steps.v.outputs.ver }}
    steps:
      - id: v
        run: echo "ver=1.4.2" >> $GITHUB_OUTPUT
  use:
    runs-on: ubuntu-latest
    needs: [prep]
    steps:
      - run: echo "версия \${{ needs.prep.outputs.ver }}"`)});
T("функция contains", "ci run\nci logs build", has("да"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: contains(github.ref, 'main')
        run: echo да`)});

console.log("── условия и статусы");
const COND = `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: exit 1
      - name: обычный шаг
        run: echo не должен выполниться
      - name: всегда
        if: always()
        run: echo выполнился
      - name: при падении
        if: failure()
        run: echo тоже`;
T("после падения обычные шаги пропускаются", "ci run\nci logs test",
  (o) => /пропущен по условию/.test(o) && !/не должен выполниться/.test(o), {files: WF(COND)});
T("always() выполняется", "ci run\nci logs test", has("выполнился"), {files: WF(COND)});
T("failure() выполняется", "ci run\nci logs test", has("тоже"), {files: WF(COND)});
T("continue-on-error не роняет задачу", "ci run", has("Итог: успех"), {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: exit 1
        continue-on-error: true
      - run: echo дальше идём`)});

console.log("── кеш");
const CACHE = `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: ~/.nuget/packages
          key: nuget-\${{ hashFiles('Directory.Packages.props') }}
      - run: dotnet restore`;
T("первый запуск без кеша, второй с кешем", "ci run\nci run", (o, C) =>
  C.runs[0].wall > C.runs[1].wall && Object.keys(C.cache).length === 1, {files: WF(CACHE)});
T("кеш промахивается при смене зависимостей", "ci run", (o, C) => {
  const first = C.runs[0].wall;
  C.files["Directory.Packages.props"] = "<Project>новое</Project>";
  runCi(C, "ci run");
  return C.runs[1].wall === first && Object.keys(C.cache).length === 2;
}, {files: WF(CACHE)});
T("cache без key — понятная ошибка", "ci run\nci logs build", has("требует key"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/cache@v4
        with:
          path: ~/.nuget/packages`)});
T("cache-hit доступен как выход шага", "ci run\nci logs build", has("попадание false"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: c
        uses: actions/cache@v4
        with:
          path: ~/.nuget/packages
          key: nuget-\${{ hashFiles('Directory.Packages.props') }}
      - run: echo "попадание \${{ steps.c.outputs.cache-hit }}"`)});

console.log("── артефакты");
T("артефакт при падении нужен if: always()", "ci run\nci artifacts",
  has("Артефактов нет"), {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui
      - uses: actions/upload-artifact@v4
        with:
          name: results
          path: test-results/**`), seed: 11});
T("с if: always() артефакт сохраняется", "ci run\nci artifacts", (o) =>
  /results/.test(o), {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: results
          path: test-results/**`), seed: 11});
T("артефакт передаётся между задачами", "ci run\nci logs report", has("получен артефакт"), {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter unit
      - uses: actions/upload-artifact@v4
        with:
          name: trx
          path: TestResults/**
  report:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: trx`)});

console.log("── секреты");
T("секрет маскируется в журнале", "ci run\nci logs build",
  (o) => /\*\*\*/.test(o) && !/s3cr3t/.test(o), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "токен \${{ secrets.TOKEN }}"`)});
T("из форка секретов нет", "ci run --event pull_request\nci logs build",
  (o) => /токен\s*$/m.test(o) || /токен $/.test(o) || /токен/.test(o) && !/\*\*\*/.test(o),
  {files: WF(`name: CI
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "токен \${{ secrets.TOKEN }}"`), fork: true});

console.log("── тесты в конвейере");
T("нестабильный тест падает", "ci run", has("ПАДЕНИЕ"), {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui`), seed: 11});
T("перезапуски спасают нестабильный", "ci run", has("Итог: успех"), {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui --retries 3`), seed: 11});
T("фильтр по группе", "ci run\nci logs test", has("Всего тестов: 40"), {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter unit`)});

console.log("── проверка конвейера");
T("lint ловит отсутствие checkout", "ci lint", has("нет actions/checkout"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: dotnet build`)});
T("lint ловит артефакт без if", "ci lint", has("без «if»"), {files: WF(`name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-artifact@v4
        with:
          name: r
          path: x`)});
T("lint ловит ключ кеша без hashFiles", "ci lint", has("без hashFiles"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: ~/.nuget/packages
          key: nuget-cache`)});
T("чистый конвейер без замечаний", "ci lint", has("замечаний нет"), {files: WF(`name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: ~/.nuget/packages
          key: nuget-\${{ hashFiles('Directory.Packages.props') }}
      - run: dotnet build`)});

console.log("── прочее");
T("history показывает запуски", "ci run\nci run\nci history",
  (o) => o.split("\n").length === 3, {files: WF(SIMPLE)});
T("нет файла конвейера", "ci run", has("нет ни одного файла конвейера"), {files: REPO});
T("не ci-команда", "docker ps", has("здесь не живёт"));
T("ошибка YAML внятная", "ci run", has("ожидалось «ключ: значение»"), {files: WF("просто строка")});

console.log("\nитог: " + pass + " пройдено, " + fail + " провалено");
