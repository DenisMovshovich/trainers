/* Эталонные решения. Шаг — строка команды либо объект:
     {file, text}          — правка файла во вкладке «Конвейер»
     {fn}                  — действие, зависящее от состояния
     {cmd, expectErr:true} — команда, отказ которой и есть предмет урока */
const WFP = ".github/workflows/ci.yml";
const SOL = {

"1a": ["ls", "cat " + WFP, "ci run", "ci logs build"],

"1b": [
  "ci run",
  "ci logs build",
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cat shop.sln
      - run: dotnet build`},
  "ci run"
],

"2a": [
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet restore
      - run: dotnet build`},
  "ci run"
],

"2b": [
  "ci run",
  {file: WFP, text:
`name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build`},
  "ci run",
  "ci run --event pull_request"
],

"3a": [
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build

  unit:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter unit

  api:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter api`},
  "ci run",
  "ci graph"
],

"3b": [
  "ci run",
  "ci logs test",
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build

  test:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build
      - run: cat bin/app.dll
      - run: dotnet test --filter unit`},
  "ci run",
  "ci logs test"
],

"4a": [
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  prep:
    runs-on: ubuntu-latest
    outputs:
      ver: \${{ steps.ver.outputs.ver }}
    steps:
      - id: ver
        run: echo "ver=1.4.2" >> $GITHUB_OUTPUT

  publish:
    needs: [prep]
    runs-on: ubuntu-latest
    steps:
      - run: echo "собираем \${{ needs.prep.outputs.ver }}"`},
  "ci run",
  "ci logs publish"
],

"4b": [
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: быстрые
        run: echo "быстрые прошли"
      - name: полные
        if: github.ref_name == 'main'
        run: echo "полные прошли"`},
  "ci run",
  "ci logs test"
],

"5a": [
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  ui:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui --shard \${{ matrix.shard }}/3`},
  "ci run"
],

"5b": [
  "ci run",
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        os: [linux, windows, macos]
    steps:
      - if: matrix.os == 'windows'
        run: exit 1
      - run: sleep 20`},
  "ci run"
],

"6a": [
  {file: WFP, text:
`name: CI
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
      - run: dotnet restore
      - run: dotnet build`},
  "ci run",
  "ci run"
],

"6b": [
  "ci run",
  {file: "Directory.Packages.props",
   text: "<Project><PackageVersion Include=\"Xunit\" Version=\"2.6\"/><PackageVersion Include=\"Moq\" Version=\"4.20\"/></Project>"},
  "ci run",
  {file: WFP, text:
`name: CI
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
      - run: dotnet restore`},
  "ci run",
  {file: "Directory.Packages.props",
   text: "<Project><PackageVersion Include=\"Xunit\" Version=\"2.7\"/><PackageVersion Include=\"Moq\" Version=\"4.20\"/></Project>"},
  "ci run",
  "ci cache"
],

"7a": [
  "ci run",
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  ui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/**`},
  "ci run",
  "ci artifacts"
],

"7b": [
  "ci run",
  {file: WFP, text:
`name: CI
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
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: trx
      - run: cat TestResults/results.trx`},
  "ci run"
],

"8a": [
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: тесты
        run: exit 1
      - name: отчёт
        if: always()
        run: echo "отчёт готов"
      - name: уведомление
        if: failure()
        run: echo "сборка упала"
      - name: выкладка
        if: success()
        run: echo "выложено"`},
  "ci run",
  "ci logs test"
],

"8b": [
  {file: WFP, text:
`name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter unit

  deploy:
    needs: [test]
    if: github.ref_name == 'main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - run: echo "выкладываем в бой"`},
  "ci run"
],

"9a": [
  "ci run",
  "ci logs deploy",
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - env:
          TOKEN: \${{ secrets.TOKEN }}
        run: echo "токен получен"`},
  "ci run",
  "ci logs deploy"
],

"9b": [
  {file: WFP, text:
`name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build
      - name: публикация
        if: github.event_name == 'push'
        run: echo "ключ \${{ secrets.NUGET_KEY }}" > pushed.txt`},
  "ci run",
  "ci run --event pull_request"
],

"10a": [
  "ci run",
  "ci logs ui",
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  ui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui --retries 3`},
  "ci run",
  "ci logs ui"
],

"10b": [
  {file: WFP, text:
`name: CI
on: [push, pull_request]

jobs:
  fast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter unit

  slow:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui --retries 3`},
  "ci run --event pull_request"
],

"11a": [
  "ci run",
  "ci logs build",
  {file: WFP, text:
`name: CI
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
      - run: dotnet restore
      - run: dotnet build

  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter unit

  ui:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2]
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui --shard \${{ matrix.shard }}/2`},
  "ci run",
  "ci run",
  "ci logs unit",
  "ci logs ui"
],

"12a": [
  {file: WFP, text:
`name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: ~/.nuget/packages
          key: nuget-\${{ hashFiles('Directory.Packages.props') }}
      - run: dotnet restore
      - run: dotnet build

  unit:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter unit

  ui:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test --filter ui --retries 3
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ui-results
          path: test-results/**

  deploy:
    needs: [unit, ui]
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - run: echo "выложено"`},
  "ci run",
  "ci logs ui"
],

"12b": [
  "ci lint",
  {file: WFP, text:
`name: CI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: ~/.nuget/packages
          key: nuget-\${{ hashFiles('Directory.Packages.props') }}
      - run: dotnet test --filter unit
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: trx
          path: TestResults/**`},
  "ci lint",
  "ci run"
]

};
