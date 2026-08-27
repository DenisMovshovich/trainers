
/* ------------------------------------------------ 2 */
{
n:2, id:"workflow", title:"Описание", sub:"Как читается файл конвейера",
lede:"Файл конвейера — обычный YAML с тремя обязательными частями: когда запускать, что за задачи и какие шаги внутри. Ловушки здесь ровно две, зато обе встречаются у всех.",
theory:`
<h2>Скелет</h2>
<pre><code><span class="k">name</span>: CI                    <span class="c"># имя для интерфейса, ни на что не влияет</span>
<span class="k">on</span>: [push, pull_request]   <span class="c"># когда запускать</span>

<span class="k">jobs</span>:
  <span class="k">build</span>:                    <span class="c"># идентификатор задачи</span>
    <span class="k">runs-on</span>: ubuntu-latest   <span class="c"># на какой машине</span>
    <span class="k">steps</span>:
      - <span class="k">uses</span>: actions/checkout@v4
      - <span class="k">run</span>: dotnet build</code></pre>
<p>Файл должен лежать в <code>.github/workflows/</code> и иметь расширение <code>.yml</code> — иначе система его просто не увидит, и это первая причина «конвейер не запускается».</p>

<h2><code>run</code> против <code>uses</code></h2>
<div class="tw"><table>
<tr><th></th><th><code>run</code></th><th><code>uses</code></th></tr>
<tr><td>Что это</td><td>команда оболочки на раннере</td><td>готовое действие</td></tr>
<tr><td>Параметры</td><td>прямо в строке</td><td>блок <code>with:</code></td></tr>
<tr><td>Когда</td><td>своё: сборка, тесты, скрипты</td><td>типовое: выгрузка кода, установка среды, кеш, артефакты</td></tr>
</table></div>
<pre><code>- <span class="k">uses</span>: actions/setup-dotnet@v4
  <span class="k">with</span>:
    <span class="k">dotnet-version</span>: <span class="s">"8.0"</span>

- <span class="k">name</span>: Тесты          <span class="c"># имя — то, что видно в интерфейсе</span>
  <span class="k">run</span>: dotnet test</code></pre>
<div class="note ok"><b class="hd">Версию действия указывают всегда</b><p><code>@v4</code> — это не украшение. Без версии или с плавающей меткой конвейер может измениться сам по себе, а разбираться придётся в тот момент, когда он упадёт без единой правки с вашей стороны. В более строгих случаях указывают не метку, а конкретный отпечаток коммита.</p></div>

<h2>Ловушка первая: чистая машина</h2>
<p>Раннер даёт пустую машину. Ни кода, ни установленных пакетов, ни кешей. Отсюда правило: <b>первый шаг почти всегда <code>actions/checkout</code></b>. Забыли — команды не найдут файлов, и сообщение будет про отсутствующий файл, а не про отсутствующий checkout.</p>

<h2>Ловушка вторая: <code>on</code> — это не строка</h2>
<div class="note trap"><b class="hd">Почему <code>on:</code> иногда исчезает</b><p>В YAML <code>on</code>, <code>yes</code>, <code>no</code>, <code>off</code> без кавычек читаются как булевы значения. Поэтому запись <code>on:</code> в некоторых обработчиках превращается в ключ <code>true</code>, и конвейер «не видит» событий. Современные системы это обходят, но, встретив странное поведение с <code>on</code>, вспомните про эту особенность — то же касается версий вида <code>8.0</code>, которые без кавычек становятся числом <code>8</code>.</p></div>

<h2>События</h2>
<div class="tw"><table>
<tr><th>Событие</th><th>Когда</th></tr>
<tr><td><code>push</code></td><td>отправка в ветку</td></tr>
<tr><td><code>pull_request</code></td><td>создание и обновление запроса на слияние</td></tr>
<tr><td><code>schedule</code></td><td>по расписанию: ночные прогоны медленных тестов</td></tr>
<tr><td><code>workflow_dispatch</code></td><td>вручную кнопкой — незаменимо для выкладки</td></tr>
</table></div>
<pre><code><span class="k">on</span>:
  <span class="k">push</span>:
    <span class="k">branches</span>: [main]
  <span class="k">pull_request</span>:
  <span class="k">schedule</span>:
    - <span class="k">cron</span>: <span class="s">"0 2 * * *"</span></code></pre>
<p>Разделять события полезно: на pull request гоняют быстрое, на <code>main</code> — полное, ночью — самое медленное.</p>
`,
quiz:[
 {q:"Где должен лежать файл конвейера?",
  opts:["В корне репозитория","В <code>.github/workflows/</code> с расширением <code>.yml</code>","В любом месте","В настройках проекта"],
  a:1, why:"Иначе система его просто не увидит — первая причина «конвейер не запускается»."},
 {q:"Чем <code>uses</code> отличается от <code>run</code>?",
  opts:["Ничем","<code>uses</code> подключает готовое действие с параметрами в <code>with</code>, <code>run</code> выполняет команду","<code>uses</code> быстрее","<code>run</code> только для оболочки Windows"],
  a:1, why:"Типовое — выгрузка кода, установка среды, кеш, артефакты — берут готовым; своё пишут через <code>run</code>."},
 {q:"Зачем указывать версию действия — <code>@v4</code>?",
  opts:["Для читаемости","Иначе конвейер может измениться сам и упасть без единой вашей правки","Это обязательно синтаксически","Для ускорения"],
  a:1, why:"В строгих случаях указывают не метку, а конкретный отпечаток коммита."},
 {q:"Почему первым шагом почти всегда идёт <code>actions/checkout</code>?",
  opts:["Так принято","Раннер даёт пустую машину — кода на ней нет, пока его не выгрузят","Он ускоряет сборку","Он настраивает права"],
  a:1, why:"Забыли — команды не найдут файлов, и сообщение будет про отсутствующий файл, а не про отсутствующий checkout."},
 {q:"Что произойдёт с <code>dotnet-version: 8.0</code> без кавычек?",
  opts:["Ничего","YAML прочитает это как число 8 — версия потеряет дробную часть","Ошибка разбора","Возьмётся последняя версия"],
  a:1, why:"Родственная ловушка: <code>on</code>, <code>yes</code>, <code>no</code>, <code>off</code> без кавычек читаются как булевы значения."},
 {q:"Зачем разделять события <code>push</code> и <code>pull_request</code>?",
  opts:["Это обязательно","Чтобы на запрос слияния гонять быстрое, а на основную ветку — полное","Для экономии места","Иначе будет два запуска"],
  a:1, why:"Самое медленное часто выносят в ночной запуск по расписанию."}
],
labs:[
 {id:"2a", title:"Собрать конвейер с нуля",
  brief:"<p>В репозитории есть код, но файла конвейера нет вовсе. Создайте его во вкладке «Конвейер» — файл <code>.github/workflows/ci.yml</code> уже заведён пустым.</p><p>Нужно: имя <code>CI</code>, запуск на <code>push</code>, одна задача <code>build</code> на <code>ubuntu-latest</code>, а в ней три шага — выгрузка кода, <code>dotnet restore</code> и <code>dotnet build</code>.</p>",
  hint:"Порядок ключей: name, on, jobs. Внутри задачи обязательны runs-on и steps.",
  setup: () => newScenario({files:{
    "src/App.cs": "class App { }",
    "shop.sln": "решение",
    "Directory.Packages.props": "<Project/>",
    ".github/workflows/ci.yml": "# опишите конвейер здесь\n"}}),
  checks:[
   {label:"Конвейер разбирается", test:st=>!!wf(st)},
   {label:"Запускается на <code>push</code>", test:st=>{ const w = wf(st); return !!w && triggers(w).indexOf("push") >= 0; }},
   {label:"Есть задача <code>build</code> с <code>runs-on</code>", test:st=>{
     const w = wf(st); return !!w && !!w.jobs.build && !!w.jobs.build["runs-on"]; }},
   {label:"Три шага: выгрузка, restore, build", test:st=>{
     const w = wf(st);
     if(!w || !w.jobs.build) return false;
     const s = [].concat(w.jobs.build.steps || []);
     return s.length === 3 && /checkout/.test(String(s[0].uses || "")) &&
            /restore/.test(String(s[1].run || "")) && /build/.test(String(s[2].run || "")); }},
   {label:"Запуск проходит успешно", test:st=>{ const r = last(st); return !!r && r.status === "success"; }}
  ]},
 {id:"2b", title:"Конвейер не запускается",
  brief:"<p>Файл конвейера есть, команда <code>ci run</code> отрабатывает — а конвейер не выполняется. Разберитесь почему.</p><p>Нужно, чтобы он запускался и на <code>push</code>, и на <code>pull_request</code>. Проверьте оба события: <code>ci run</code> и <code>ci run --event pull_request</code>.</p>",
  hint:"Посмотрите, какие события перечислены в on. Сообщение при запуске прямо называет несоответствие.",
  setup: () => newScenario({files:{
    "src/App.cs": "class App { }",
    "shop.sln": "решение",
    ".github/workflows/ci.yml":
`name: CI
on: [schedule]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build`}}),
  checks:[
   {label:"Оба события описаны", test:st=>{
     const w = wf(st); if(!w) return false;
     const t = triggers(w);
     return t.indexOf("push") >= 0 && t.indexOf("pull_request") >= 0; }},
   {label:"Запуск на <code>push</code> проходит", test:st=>st.C.runs.some(r => r.event === "push" && r.status === "success")},
   {label:"Запуск на <code>pull_request</code> проходит", test:st=>st.C.runs.some(r => r.event === "pull_request" && r.status === "success")},
   {label:"Задача осталась прежней", test:st=>{
     const w = wf(st);
     return !!w && !!w.jobs.build && triggers(w).length === 2; }}
  ]}
],
iv:[
 {q:"Что обязательно должно быть в описании конвейера?",
  probe:"Простой вопрос, по которому видно, писали ли вы конвейер сами или только читали чужой.",
  a:"Три вещи: событие запуска, хотя бы одна задача и внутри неё шаги. Событие в блоке <code>on</code> — без него конвейер существует, но никогда не выполнится. У задачи обязателен <code>runs-on</code>, потому что надо знать, на какой машине выполнять. Шаг — это либо <code>run</code> с командой оболочки, либо <code>uses</code> с готовым действием и параметрами в <code>with</code>. И почти всегда первым шагом идёт выгрузка кода: раннер даёт чистую машину, на ней нет ничего, включая ваш репозиторий. Из мелочей, которые экономят часы: версию действия указывать обязательно, иначе конвейер может измениться сам; версии вроде <code>8.0</code> и слово <code>on</code> в YAML брать в кавычки, чтобы они не превратились в число и булево значение.",
  more:["Что произойдёт без checkout?","Как разделить проверки для PR и main?"]}
]
},

/* ------------------------------------------------ 3 */
{
n:3, id:"jobs", title:"Задачи", sub:"Зависимости и параллельность",
lede:"Задачи — единица параллельности и единица изоляции одновременно. Из второго следует то, что чаще всего удивляет: между задачами не переносится ничего.",
theory:`
<h2>Что делится, а что нет</h2>
<div class="tw"><table>
<tr><th></th><th>Между шагами одной задачи</th><th>Между задачами</th></tr>
<tr><td>Файловая система</td><td>общая</td><td><b>ничего</b> — каждая задача на своей машине</td></tr>
<tr><td>Установленные пакеты</td><td>общие</td><td>нет</td></tr>
<tr><td>Переменные окружения</td><td>общие</td><td>нет, только через <code>outputs</code></td></tr>
<tr><td>Результаты сборки</td><td>лежат на диске</td><td>только через артефакты</td></tr>
</table></div>
<div class="note trap"><b class="hd">Отсюда самая частая ошибка новичка в конвейерах</b><p>«Собрал в одной задаче, тестирую в другой» — и вторая не находит собранного. Между задачами нужно либо передать артефакт, либо просто собрать заново, либо не разделять их вовсе. Разделение оправдано, когда задачи действительно идут параллельно или требуют разного окружения.</p></div>

<h2>Зависимости</h2>
<pre><code><span class="k">jobs</span>:
  <span class="k">build</span>:
    <span class="k">runs-on</span>: ubuntu-latest
    <span class="k">steps</span>: [...]

  <span class="k">unit</span>:
    <span class="k">needs</span>: [build]        <span class="c"># дождаться build</span>
    <span class="k">runs-on</span>: ubuntu-latest
    <span class="k">steps</span>: [...]

  <span class="k">lint</span>:
    <span class="k">needs</span>: [build]        <span class="c"># тоже после build — параллельно с unit</span>
    <span class="k">runs-on</span>: ubuntu-latest
    <span class="k">steps</span>: [...]</code></pre>
<p>Задачи без <code>needs</code> стартуют сразу и одновременно. Задачи с одинаковым <code>needs</code> тоже идут параллельно между собой. Получается граф, а не список, и именно от его формы зависит время конвейера.</p>
<div class="note ok"><b class="hd">Посмотрите форму</b><p>Команда <code>ci graph</code> внизу рисует уровни: кто кого ждёт и кто выполняется одновременно. Полезно перед тем, как объяснять, почему конвейер идёт двадцать минут.</p></div>

<h2>Что происходит при падении</h2>
<div class="tw"><table>
<tr><th>Ситуация</th><th>Поведение</th></tr>
<tr><td>Упала задача</td><td>её зависимые <b>пропускаются</b>, независимые продолжают</td></tr>
<tr><td>Упал шаг</td><td>следующие шаги задачи пропускаются, кроме помеченных условием</td></tr>
<tr><td>Нужно выполнить всё равно</td><td><code>if: always()</code> — об этом отдельный раздел</td></tr>
</table></div>

<h2>Как проектировать граф</h2>
<div class="tw"><table>
<tr><th>Приём</th><th>Что даёт</th></tr>
<tr><td>Быстрые проверки без <code>needs</code></td><td>ответ через минуту, а не в конце</td></tr>
<tr><td>Медленное — параллельными задачами</td><td>время конвейера равно самой длинной ветке, а не сумме</td></tr>
<tr><td>Выкладка — с <code>needs</code> на все проверки</td><td>гарантия, что в бой не уйдёт красное</td></tr>
<tr><td>Не дробить слишком мелко</td><td>каждая задача платит за подъём машины и выгрузку кода</td></tr>
</table></div>
<p>Последнее важно: разбить конвейер на пятнадцать задач по одному шагу — верный способ сделать его медленнее и дороже. Накладные расходы на задачу — десятки секунд, и они не параллелятся в ноль.</p>
`,
quiz:[
 {q:"Что переносится между задачами по умолчанию?",
  opts:["Файлы сборки","Ничего — каждая задача выполняется на своей машине","Переменные окружения","Установленные пакеты"],
  a:1, why:"Отсюда «собрал в одной, тестирую в другой, а собранного нет». Нужен артефакт либо повторная сборка."},
 {q:"Две задачи с одинаковым <code>needs: [build]</code> — как они выполнятся?",
  opts:["По очереди","Параллельно, обе после build","Только первая","Зависит от порядка в файле"],
  a:1, why:"Получается граф, а не список, и от его формы зависит время конвейера."},
 {q:"Упала задача, от которой зависят две другие. Что с ними?",
  opts:["Выполнятся","Будут пропущены","Выполнятся с ошибкой","Запустятся повторно"],
  a:1, why:"Независимые задачи при этом продолжают выполняться."},
 {q:"Чем плохо разбить конвейер на пятнадцать задач по одному шагу?",
  opts:["Ничем","Каждая задача платит за подъём машины и выгрузку кода — станет медленнее и дороже","Ограничение системы","Сложно читать"],
  a:1, why:"Накладные расходы на задачу — десятки секунд, и они не параллелятся в ноль."},
 {q:"Как передать результат сборки в следующую задачу?",
  opts:["Через переменную окружения","Через артефакт","Он передастся сам","Через кеш"],
  a:1, why:"Кеш для другого — он ускоряет повторную подготовку, а не переносит результаты между задачами."},
 {q:"Какие задачи стоит поставить без <code>needs</code>?",
  opts:["Выкладку","Быстрые проверки — чтобы ответ пришёл через минуту","Тесты интерфейса","Сборку образа"],
  a:1, why:"А выкладку, наоборот, вешают на <code>needs</code> по всем проверкам."}
],
labs:[
 {id:"3a", title:"Разложить на параллельные ветки",
  brief:"<p>Сейчас всё выполняется одной задачей подряд, и конвейер идёт долго. Перестройте его в три задачи:</p><ul><li><code>build</code> — выгрузка кода и <code>dotnet build</code>;</li><li><code>unit</code> — после сборки, <code>dotnet test --filter unit</code>;</li><li><code>api</code> — тоже после сборки, <code>dotnet test --filter api</code>.</li></ul><p>Не забудьте: у каждой задачи своя машина, поэтому выгрузка кода нужна в каждой. Проверьте форму через <code>ci graph</code>.</p>",
  hint:"Три ключа внутри jobs. У unit и api — needs: [build] и свой actions/checkout@v4.",
  setup: () => newScenario({files:{
    "src/App.cs": "class App { }",
    "shop.sln": "решение",
    ".github/workflows/ci.yml":
`name: CI
on: [push]

jobs:
  all:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build
      - run: dotnet test --filter unit
      - run: dotnet test --filter api`}}),
  checks:[
   {label:"Три задачи описаны", test:st=>{
     const w = wf(st); return !!w && ["build","unit","api"].every(n => !!w.jobs[n]); }},
   {label:"Тесты ждут сборку", test:st=>{
     const w = wf(st); if(!w || !w.jobs.unit || !w.jobs.api) return false;
     return [].concat(w.jobs.unit.needs || []).indexOf("build") >= 0 &&
            [].concat(w.jobs.api.needs || []).indexOf("build") >= 0; }},
   {label:"Тестовые задачи идут одновременно", test:st=>{
     const u = jobOf(st, "unit"), a = jobOf(st, "api");
     return !!u && !!a && u.start === a.start; }},
   {label:"Конвейер проходит", test:st=>{ const r = last(st); return !!r && r.status === "success"; }},
   {label:"И стал быстрее последовательного", test:st=>{ const r = last(st); return !!r && r.wall < r.total; }}
  ]},
 {id:"3b", title:"Собранного нет",
  brief:"<p>Задача <code>test</code> падает: она ждёт <code>build</code>, но не находит собранных файлов. Это не ошибка настройки зависимостей — это следствие того, что задачи выполняются на разных машинах.</p><p>Почините конвейер так, чтобы <code>test</code> дошёл до конца. Проще всего — дать задаче то, что ей нужно, самой.</p>",
  hint:"У задачи test нет ни выгрузки кода, ни сборки. Добавьте недостающие шаги в неё саму.",
  setup: () => newScenario({files:{
    "src/App.cs": "class App { }",
    "shop.sln": "решение",
    ".github/workflows/ci.yml":
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
      - run: cat bin/app.dll
      - run: dotnet test --filter unit`}}),
  checks:[
   {label:"Падение было замечено", test:st=>st.C.runs.some(r => r.status === "failure")},
   {label:"Задача <code>test</code> проходит", test:st=>{
     const j = jobOf(st, "test"); return !!j && j.status === "success"; }},
   {label:"Она по-прежнему ждёт <code>build</code>", test:st=>{
     const w = wf(st), j = jobOf(st, "test");
     return !!w && !!w.jobs.test && [].concat(w.jobs.test.needs || []).indexOf("build") >= 0 &&
            !!j && j.status === "success"; }},
   {label:"Тесты действительно выполнялись", test:st=>logHas(st, /Всего тестов/)},
   {label:"Конвейер целиком зелёный", test:st=>{ const r = last(st); return !!r && r.status === "success"; }}
  ]}
],
iv:[
 {q:"Что переносится между задачами конвейера?",
  probe:"Практический вопрос, на котором спотыкаются при первом же разделении конвейера.",
  a:"По умолчанию ничего. Каждая задача получает свою чистую машину, поэтому ни файлы, ни установленные пакеты, ни переменные окружения между ними не переезжают. Внутри одной задачи всё наоборот: шаги идут на одной машине и делят файловую систему. Из этого следует пара практических вещей. Первая: если задача <code>test</code> зависит от результатов задачи <code>build</code>, надо либо передать их артефактом через выгрузку и загрузку, либо просто собрать заново — второе часто дешевле, чем кажется, особенно с кешем. Вторая: небольшие значения между задачами передают через <code>outputs</code>, а не через переменные окружения. И общий вывод по проектированию: разделять задачи стоит тогда, когда они реально идут параллельно или требуют разного окружения, а не по эстетическим соображениям — каждая задача платит за подъём машины и выгрузку кода.",
  more:["Как передать артефакт между задачами?","Когда разделение задач себя не оправдывает?"]}
]
},

/* ------------------------------------------------ 4 */
{
n:4, id:"context", title:"Контексты", sub:"Переменные и выражения",
lede:"Внутри конвейера доступно несколько наборов данных: про событие, про окружение, про предыдущие задачи. Разница между ними определяет, что можно подставить и в какой момент.",
theory:`
<h2>Основные контексты</h2>
<div class="tw"><table>
<tr><th>Контекст</th><th>Что внутри</th></tr>
<tr><td><code>github</code></td><td>событие, ветка, коммит, репозиторий, автор</td></tr>
<tr><td><code>env</code></td><td>переменные, заданные в конвейере, задаче или шаге</td></tr>
<tr><td><code>secrets</code></td><td>секреты — значение подставляется, но в журнале маскируется</td></tr>
<tr><td><code>matrix</code></td><td>текущий набор значений матрицы</td></tr>
<tr><td><code>needs</code></td><td>результаты и выходные значения задач, которых ждали</td></tr>
<tr><td><code>steps</code></td><td>выходные значения предыдущих шагов этой задачи</td></tr>
<tr><td><code>runner</code></td><td>операционная система и архитектура машины</td></tr>
</table></div>

<h2>Подстановка</h2>
<pre><code>- <span class="k">run</span>: echo <span class="s">"ветка \${{ github.ref_name }}, коммит \${{ github.sha }}"</span>
- <span class="k">run</span>: echo <span class="s">"режим \${{ env.MODE }}"</span></code></pre>
<p>Всё, что внутри <code>\${{ }}</code>, вычисляется <b>до</b> запуска шага и подставляется как текст. Отсюда следствие, о котором стоит помнить в разделе про безопасность: подставленное значение становится частью команды.</p>

<h2>Переменные окружения</h2>
<pre><code><span class="k">env</span>:                      <span class="c"># на весь конвейер</span>
  <span class="k">MODE</span>: prod

<span class="k">jobs</span>:
  <span class="k">build</span>:
    <span class="k">env</span>:                  <span class="c"># на задачу — перекрывает</span>
      <span class="k">MODE</span>: staging
    <span class="k">steps</span>:
      - <span class="k">env</span>:              <span class="c"># на шаг — перекрывает и это</span>
          <span class="k">MODE</span>: test
        <span class="k">run</span>: echo \${{ env.MODE }}</code></pre>

<h2>Значения между шагами и задачами</h2>
<pre><code><span class="c"># шаг публикует значение</span>
- <span class="k">id</span>: ver
  <span class="k">run</span>: echo <span class="s">"ver=1.4.2"</span> &gt;&gt; $GITHUB_OUTPUT

<span class="c"># следующий шаг читает</span>
- <span class="k">run</span>: echo <span class="s">"версия \${{ steps.ver.outputs.ver }}"</span></code></pre>
<pre><code><span class="c"># задача публикует наружу</span>
<span class="k">jobs</span>:
  <span class="k">prep</span>:
    <span class="k">outputs</span>:
      <span class="k">ver</span>: \${{ steps.ver.outputs.ver }}
    ...
  <span class="k">use</span>:
    <span class="k">needs</span>: [prep]
    <span class="k">steps</span>:
      - <span class="k">run</span>: echo <span class="s">"версия \${{ needs.prep.outputs.ver }}"</span></code></pre>
<div class="note ok"><b class="hd">Два разных файла</b><p><code>$GITHUB_OUTPUT</code> публикует значение шага, <code>$GITHUB_ENV</code> задаёт переменную окружения для следующих шагов. Первое читается через <code>steps.&lt;id&gt;.outputs</code>, второе — через <code>env</code>. Путать их — обычное дело.</p></div>

<h2>Полезные функции</h2>
<div class="tw"><table>
<tr><th>Функция</th><th>Зачем</th></tr>
<tr><td><code>contains(a, b)</code></td><td>условия по ветке, метке, сообщению коммита</td></tr>
<tr><td><code>startsWith</code>, <code>endsWith</code></td><td>то же для префиксов вроде <code>release/</code></td></tr>
<tr><td><code>format('{0}-{1}', a, b)</code></td><td>сборка строк, чаще всего ключей кеша</td></tr>
<tr><td><code>hashFiles('**/lock')</code></td><td>отпечаток файлов — основа ключа кеша</td></tr>
<tr><td><code>success()</code>, <code>failure()</code>, <code>always()</code></td><td>условия по состоянию — следующий раздел</td></tr>
</table></div>
`,
quiz:[
 {q:"Где взять имя текущей ветки?",
  opts:["<code>env.BRANCH</code>","<code>github.ref_name</code>","<code>runner.branch</code>","<code>needs.branch</code>"],
  a:1, why:"Контекст <code>github</code> содержит всё про событие: ветку, коммит, репозиторий, автора."},
 {q:"Когда вычисляется выражение в <code>\${{ }}</code>?",
  opts:["Во время выполнения команды","До запуска шага — результат подставляется как текст","После шага","Не вычисляется"],
  a:1, why:"Отсюда следует, что подставленное значение становится частью команды, — это важно для безопасности."},
 {q:"Чем <code>$GITHUB_OUTPUT</code> отличается от <code>$GITHUB_ENV</code>?",
  opts:["Ничем","Первый публикует значение шага, второй задаёт переменную окружения для следующих шагов","Первый только для задач","Второй устарел"],
  a:1, why:"Читаются они тоже по-разному: через <code>steps.&lt;id&gt;.outputs</code> и через <code>env</code>."},
 {q:"Переменная <code>MODE</code> задана в конвейере, в задаче и в шаге. Какое значение увидит команда шага?",
  opts:["Из конвейера","Из шага — ближайшее перекрывает","Из задачи","Ошибка"],
  a:1, why:"Порядок перекрытия: конвейер → задача → шаг."},
 {q:"Как передать значение из одной задачи в другую?",
  opts:["Через переменную окружения","Через <code>outputs</code> задачи и контекст <code>needs</code>","Через файл","Никак"],
  a:1, why:"Переменные окружения между задачами не переносятся — машины разные."},
 {q:"Зачем нужна функция <code>hashFiles</code>?",
  opts:["Для проверки целостности","Даёт отпечаток файлов — основу ключа кеша","Для сравнения версий","Для подписи артефактов"],
  a:1, why:"Меняется файл зависимостей — меняется ключ, и кеш обновляется. Об этом следующий раздел."}
],
labs:[
 {id:"4a", title:"Версия сборки",
  brief:"<p>Нужно вычислить версию один раз и использовать её в другой задаче.</p><ul><li>в задаче <code>prep</code> шаг с <code>id: ver</code> должен опубликовать <code>ver=1.4.2</code> в <code>$GITHUB_OUTPUT</code>;</li><li>задача <code>prep</code> должна отдать это значение через <code>outputs</code> под именем <code>ver</code>;</li><li>задача <code>publish</code> должна напечатать строку <code>собираем 1.4.2</code>, взяв версию из <code>needs</code>.</li></ul>",
  hint:"outputs у задачи: ver: \${{ steps.ver.outputs.ver }}. В publish читайте \${{ needs.prep.outputs.ver }}.",
  setup: () => newScenario({files:{
    "src/App.cs": "class App { }",
    ".github/workflows/ci.yml":
`name: CI
on: [push]

jobs:
  prep:
    runs-on: ubuntu-latest
    steps:
      - id: ver
        run: echo "версия будет тут"

  publish:
    needs: [prep]
    runs-on: ubuntu-latest
    steps:
      - run: echo "собираем ???"`}}),
  checks:[
   {label:"Задача <code>prep</code> отдаёт значение", test:st=>{
     const j = jobOf(st, "prep"); return !!j && j.outputs && j.outputs.ver === "1.4.2"; }},
   {label:"Значение опубликовано через <code>$GITHUB_OUTPUT</code>", test:st=>{
     const w = wf(st); if(!w) return false;
     return [].concat((w.jobs.prep || {}).steps || []).some(s => /GITHUB_OUTPUT/.test(String(s.run || ""))); }},
   {label:"Вторая задача печатает «собираем 1.4.2»", test:st=>logHas(st, /собираем 1\.4\.2/)},
   {label:"Значение взято из <code>needs</code>", test:st=>{
     const w = wf(st); if(!w) return false;
     return [].concat((w.jobs.publish || {}).steps || []).some(s => /needs\.prep\.outputs/.test(String(s.run || ""))); }}
  ]},
 {id:"4b", title:"Разное поведение по ветке",
  brief:"<p>Один конвейер должен вести себя по-разному:</p><ul><li>шаг с именем <code>быстрые</code> выполняется всегда;</li><li>шаг с именем <code>полные</code> — <b>только</b> когда ветка <code>main</code>.</li></ul><p>Сейчас выполняются оба. Добавьте условие второму шагу и проверьте оба случая: сценарий запускается на ветке <code>feature/x</code>, а событие <code>push</code> с <code>main</code> проверяется командой <code>ci run</code> после смены ветки — она уже <code>feature/x</code>, поэтому «полные» выполняться не должны.</p>",
  hint:"if: github.ref_name == 'main' — обратите внимание на одинарные кавычки внутри выражения.",
  setup: () => newScenario({branch: "feature/x", files:{
    "src/App.cs": "class App { }",
    ".github/workflows/ci.yml":
`name: CI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: быстрые
        run: echo "быстрые прошли"
      - name: полные
        run: echo "полные прошли"`}}),
  checks:[
   {label:"Условие добавлено", test:st=>{
     const w = wf(st); if(!w) return false;
     return [].concat((w.jobs.test || {}).steps || []).some(s =>
       String(s.name) === "полные" && s["if"] !== undefined); }},
   {label:"Условие смотрит на ветку", test:st=>{
     const w = wf(st); if(!w) return false;
     return [].concat((w.jobs.test || {}).steps || []).some(s =>
       String(s.name) === "полные" && /ref_name|ref\b|head_ref/.test(String(s["if"]))); }},
   {label:"На ветке <code>feature/x</code> шаг пропускается", test:st=>{
     const s = stepsOf(st, "test").filter(x => x.name === "полные")[0];
     return !!s && s.status === "skipped"; }},
   {label:"Быстрые шаги при этом выполняются", test:st=>logHas(st, /быстрые прошли/)}
  ]}
],
iv:[
 {q:"Как передать данные между шагами и между задачами?",
  probe:"Практический вопрос. Ловушка — в разнице между двумя специальными файлами.",
  a:"Внутри одной задачи есть два способа. Через <code>$GITHUB_OUTPUT</code> шаг публикует именованное значение, и следующие шаги читают его как <code>steps.&lt;id&gt;.outputs.&lt;имя&gt;</code> — для этого шагу нужен <code>id</code>. Через <code>$GITHUB_ENV</code> шаг задаёт переменную окружения, которая будет видна следующим шагам как <code>env.&lt;имя&gt;</code>. Разница в том, что первое — это данные с адресом, а второе — окружение целиком; путают их регулярно. Между задачами переменные не переносятся вообще, потому что машины разные: там нужно объявить <code>outputs</code> у задачи, сославшись на выход шага, и читать в зависимой задаче через <code>needs.&lt;задача&gt;.outputs.&lt;имя&gt;</code>. Для файлов, а не значений, это уже артефакты.",
  more:["Почему нужен id у шага?","Как передать файл, а не строку?"]}
]
},
