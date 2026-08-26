/* ----------------------------------------------------- 5 */
{
n:5, id:"nuget", title:"NuGet и restore", sub:"Откуда берутся зависимости",
lede:"Шесть строк PackageReference превращаются в 23 пакета. Разберём, как это происходит и где посмотреть результат.",
body:`
<p><b>restore</b> — отдельный этап, предшествующий компиляции. Он решает задачу разрешения зависимостей: по списку прямых пакетов строит полный граф, выбирает версии, скачивает недостающее и записывает результат в <code>obj/</code>. Компилятор потом просто читает готовый список.</p>

<h2>Что происходит по шагам</h2>
<figure class="fig">
<svg viewBox="0 0 620 172" role="img" aria-label="Этапы восстановления пакетов">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="14" width="128" height="46" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="64" y="34" text-anchor="middle" fill="var(--ink)">.csproj</text>
  <text x="64" y="48" text-anchor="middle" font-size="9" fill="var(--ink-3)">6 прямых</text>

  <path d="M132 37h34" stroke="var(--accent)" stroke-width="1.2"/><path d="M166 37l-7-4v8z" fill="var(--accent)"/>

  <rect x="170" y="14" width="140" height="46" rx="2" fill="var(--accent-soft)" stroke="var(--accent)"/>
  <text x="240" y="34" text-anchor="middle" fill="var(--ink)">разрешение графа</text>
  <text x="240" y="48" text-anchor="middle" font-size="9" fill="var(--ink-3)">выбор версий</text>

  <path d="M314 37h34" stroke="var(--accent)" stroke-width="1.2"/><path d="M348 37l-7-4v8z" fill="var(--accent)"/>

  <rect x="352" y="14" width="130" height="46" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="417" y="34" text-anchor="middle" fill="var(--ink)">кэш пакетов</text>
  <text x="417" y="48" text-anchor="middle" font-size="9" fill="var(--ink-3)">~/.nuget/packages</text>

  <path d="M486 37h34" stroke="var(--accent)" stroke-width="1.2"/><path d="M520 37l-7-4v8z" fill="var(--accent)"/>
  <rect x="524" y="14" width="96" height="46" rx="2" fill="var(--surface-3)" stroke="var(--line)" stroke-dasharray="3 3"/>
  <text x="572" y="34" text-anchor="middle" fill="var(--ink-2)">nuget.org</text>
  <text x="572" y="48" text-anchor="middle" font-size="9" fill="var(--ink-3)">если нет в кэше</text>

  <path d="M240 64v22h-70v18" stroke="var(--accent-line)" stroke-width="1" fill="none"/>
  <path d="M170 104l-4-7h8z" fill="var(--accent-line)"/>
  <path d="M240 64v22h130v18" stroke="var(--accent-line)" stroke-width="1" fill="none"/>
  <path d="M370 104l-4-7h8z" fill="var(--accent-line)"/>

  <rect x="86" y="106" width="168" height="42" rx="2" fill="var(--surface)" stroke="var(--accent-line)"/>
  <text x="170" y="124" text-anchor="middle" fill="var(--ink)">obj/project.assets.json</text>
  <text x="170" y="138" text-anchor="middle" font-size="9" fill="var(--ink-3)">23 разрешённых пакета</text>

  <rect x="286" y="106" width="168" height="42" rx="2" fill="var(--surface)" stroke="var(--accent-line)"/>
  <text x="370" y="124" text-anchor="middle" fill="var(--ink)">obj/*.nuget.g.props</text>
  <text x="370" y="138" text-anchor="middle" font-size="9" fill="var(--ink-3)">импорты для MSBuild</text>

  <text x="310" y="166" text-anchor="middle" font-size="9" fill="var(--ink-3)">оба файла лежат в obj/ и не коммитятся — их всегда можно пересоздать</text>
 </g>
</svg>
<figcaption>Пакеты хранятся в одном общем кэше на пользователя, а не внутри проекта. В obj/ попадает лишь результат разрешения — какие версии выбраны и где они лежат.</figcaption>
</figure>

<h2>Прямые и транзитивные</h2>
<p>В csproj перечислены только прямые зависимости. Всё остальное подтягивается само. Вот реальный результат для Portal:</p>
<pre><code><span class="c">$ dotnet list Portal/Portal.csproj package --include-transitive</span>

   Top-level Package                 Requested   Resolved
   &gt; Microsoft.NET.Test.Sdk          17.8.0      17.8.0
   &gt; Microsoft.Playwright.NUnit      1.58.0      1.58.0
   &gt; NUnit                           3.14.0      3.14.0
   &gt; NUnit3TestAdapter               4.5.0       4.5.0
   &gt; NunitXml.TestLogger             8.0.0       8.0.0
   &gt; ReportPortal.NUnit              4.9.0       4.9.0

   Transitive Package                            Resolved
   &gt; Microsoft.Playwright                        1.58.0
   &gt; Microsoft.Playwright.TestAdapter            1.58.0
   &gt; Newtonsoft.Json                             13.0.1
   &gt; System.Text.Json                            6.0.10
   <span class="c">… всего 17 транзитивных</span></code></pre>
<div class="note fact"><b class="h">Измерено на этом проекте</b><p>6 прямых → 23 разрешённых пакета в <code>project.assets.json</code> → 15 записей в <code>Portal.deps.json</code>. Разница между 23 и 15 в том, что часть пакетов участвует только в сборке и не нужна в рантайме.</p></div>
<div class="note"><b class="h">Отсюда следует практическое правило</b><p><code>Microsoft.Playwright.TestAdapter</code> есть во всех трёх проектах — он приходит транзитивно через <code>Microsoft.Playwright.NUnit</code>. Полагаться на транзитивную зависимость рискованно: если авторы <code>…NUnit</code> завтра перестанут её тянуть, проект сломается без единой правки с вашей стороны. Явное объявление в Vertex2025 как раз от этого и страхует.</p></div>

<h2>Как записывается версия</h2>
<div class="tw"><table>
<tr><th>Запись</th><th>Что означает</th></tr>
<tr><td><code>1.58.0</code></td><td>Не ниже 1.58.0. Берётся минимальная подходящая, но поднимается при конфликте</td></tr>
<tr><td><code>[1.58.0]</code></td><td>Ровно эта версия. Жёстко</td></tr>
<tr><td><code>[1.58.0,2.0.0)</code></td><td>Диапазон: от 1.58.0 включительно до 2.0.0 не включая</td></tr>
<tr><td><code>1.58.*</code></td><td>Плавающая версия — при каждом restore может подтянуться новее. Удобно, но убивает воспроизводимость</td></tr>
</table></div>
<div class="note warn"><b class="h">Правило разрешения конфликтов</b><p>Если два пакета требуют разные версии третьего, NuGet выбирает <b>наибольшую</b> из требуемых — это стратегия «nearest wins» с подъёмом версии. Молча. Именно поэтому <code>Resolved</code> в выводе выше иногда выше, чем <code>Requested</code>, и именно поэтому колонку <code>Resolved</code> стоит просматривать.</p></div>

<h2>Полезные команды</h2>
<pre><code>dotnet restore Portal/Portal.csproj          <span class="c"># явно, обычно не нужно</span>
dotnet add Portal/Portal.csproj package NUnit --version 3.14.0
dotnet remove Portal/Portal.csproj package NUnit
dotnet list Portal/Portal.csproj package --outdated      <span class="c"># есть ли новее</span>
dotnet list Portal/Portal.csproj package --vulnerable    <span class="c"># известные уязвимости</span>
dotnet list Portal/Portal.csproj package --deprecated
dotnet nuget locals all --list                <span class="c"># где лежит кэш</span>
dotnet nuget locals all --clear               <span class="c"># снести кэш целиком</span></code></pre>
<div class="note"><b class="h">Кэш общий на пользователя</b><p>Все проекты на машине берут пакеты из <code>~/.nuget/packages</code>. Поэтому первый <code>restore</code> нового проекта может занять минуты, а последующие — секунды: на этом репозитории повторный restore отрабатывает за <b>1,6 секунды</b>. И поэтому же <code>dotnet nuget locals all --clear</code> — тяжёлая операция, она затрагивает все проекты, а не один.</p></div>

<h2>Централизованное управление версиями</h2>
<p>Когда проектов много, версии расползаются. Лечится файлом <code>Directory.Packages.props</code> в корне:</p>
<pre><code>&lt;<span class="k">Project</span>&gt;
  &lt;<span class="k">PropertyGroup</span>&gt;
    &lt;ManagePackageVersionsCentrally&gt;true&lt;/ManagePackageVersionsCentrally&gt;
  &lt;/<span class="k">PropertyGroup</span>&gt;
  &lt;<span class="k">ItemGroup</span>&gt;
    &lt;PackageVersion Include=<span class="s">"NUnit"</span> Version=<span class="s">"3.14.0"</span> /&gt;
    &lt;PackageVersion Include=<span class="s">"Microsoft.Playwright.NUnit"</span> Version=<span class="s">"1.58.0"</span> /&gt;
  &lt;/<span class="k">ItemGroup</span>&gt;
&lt;/<span class="k">Project</span>&gt;</code></pre>
<p>После этого в csproj остаётся <code>&lt;PackageReference Include="NUnit" /&gt;</code> — без версии. Для трёх проектов, где версии сейчас совпадают вручную, это устранило бы риск незаметного расхождения.</p>

<h2>Приватные источники</h2>
<p>Файл <code>nuget.config</code> рядом с решением задаёт, откуда брать пакеты. Для корпоративных фидов Azure Artifacts он обязателен:</p>
<pre><code>&lt;<span class="k">configuration</span>&gt;
  &lt;<span class="k">packageSources</span>&gt;
    &lt;clear /&gt;                                  <span class="c">&lt;!-- отбросить унаследованные --&gt;</span>
    &lt;add key=<span class="s">"nuget.org"</span> value=<span class="s">"https://api.nuget.org/v3/index.json"</span> /&gt;
    &lt;add key=<span class="s">"internal"</span> value=<span class="s">"https://pkgs.dev.azure.com/acme/_packaging/internal/nuget/v3/index.json"</span> /&gt;
  &lt;/<span class="k">packageSources</span>&gt;
&lt;/<span class="k">configuration</span>&gt;</code></pre>
<div class="note trap"><b class="h">Ошибка NU1101</b><p>«Unable to find package X. No packages exist with this id in source(s): …» почти всегда означает не опечатку в имени, а <b>отсутствие нужного источника</b> в списке. Первым делом смотрите, какие источники перечислены в конце сообщения, — там же виден и результат <code>&lt;clear /&gt;</code>, если он отсёк корпоративный фид.</p></div>
`,
quiz:[
 {q:"Где физически лежат скачанные пакеты?",
  opts:["В каталоге obj/ проекта","В общем кэше ~/.nuget/packages","В bin/ рядом со сборкой","В папке packages/ внутри решения"],
  a:1, why:"Кэш общий на пользователя. В <code>obj/</code> попадает лишь результат разрешения — <code>project.assets.json</code> со списком выбранных версий и путей."},
 {q:"Что делает restore, чего не делает компилятор?",
  opts:["Компилирует код в IL","Разрешает граф зависимостей, выбирает версии и записывает результат в obj/","Копирует файлы в bin/","Запускает тесты"],
  a:1, why:"Это отдельный этап. Компилятор потом просто читает готовый список ссылок из <code>project.assets.json</code>."},
 {q:"Два пакета требуют разные версии третьего. Что сделает NuGet?",
  opts:["Остановится с ошибкой конфликта","Молча возьмёт наибольшую из требуемых","Возьмёт наименьшую","Установит обе версии"],
  a:1, why:"Версия поднимается до наибольшей требуемой, без предупреждения. Поэтому в <code>dotnet list package</code> колонка Resolved иногда выше Requested — и её стоит просматривать."},
 {q:"Что означает ошибка NU1101 «Unable to find package»?",
  opts:["Пакет удалён из nuget.org","В списке источников нет фида, где лежит пакет","Версия пакета несовместима с TFM","Нет доступа в интернет"],
  a:1, why:"Чаще всего дело в источниках. В конце сообщения перечислено, где именно искали — сравните этот список с ожидаемым, особенно если в <code>nuget.config</code> есть <code>&lt;clear /&gt;</code>."},
 {q:"Зачем указывать пакет явно, если он и так приходит транзитивно?",
  opts:["Иначе он не попадёт в bin","Чтобы зафиксировать версию и не зависеть от решений авторов промежуточного пакета","Транзитивные пакеты не компилируются","Это требование NuGet"],
  a:1, why:"Транзитивная зависимость может исчезнуть при обновлении промежуточного пакета, и проект сломается без ваших правок. Явное объявление это фиксирует."},
 {q:"Что даёт <code>Directory.Packages.props</code> с <code>ManagePackageVersionsCentrally</code>?",
  opts:["Ускоряет restore","Версии задаются в одном месте, а в csproj остаются только имена пакетов","Отключает транзитивные зависимости","Заменяет nuget.config"],
  a:1, why:"Централизованное управление версиями. Для многопроектного репозитория это устраняет расползание версий одного и того же пакета."}
]
},

/* ----------------------------------------------------- 6 */
{
n:6, id:"binobj", title:"bin и obj", sub:"Что и куда кладёт сборка",
lede:"Два каталога, которые всегда в .gitignore, но заглядывать в них приходится постоянно — особенно когда что-то не находится.",
body:`
<p>Разделение простое: <code>obj/</code> — рабочая кухня MSBuild, <code>bin/</code> — то, что можно запускать. Оба полностью воспроизводимы из исходников, поэтому в git не хранятся.</p>

<div class="tw"><table>
<tr><th></th><th><code>obj/</code></th><th><code>bin/</code></th></tr>
<tr><td>Содержит</td><td>Промежуточное: результат restore, сгенерированный код, объектные файлы</td><td>Готовую сборку и всё, что нужно для запуска</td></tr>
<tr><td>Ключевые файлы</td><td><code>project.assets.json</code>, <code>*.nuget.g.props</code>, <code>*.GlobalUsings.g.cs</code></td><td><code>Portal.dll</code>, <code>*.deps.json</code>, <code>*.runtimeconfig.json</code>, зависимости</td></tr>
<tr><td>Структура</td><td><code>obj/Debug/net8.0/</code></td><td><code>bin/Debug/net8.0/</code></td></tr>
<tr><td>Удалять безопасно?</td><td>Да — пересоздастся при restore</td><td>Да — пересоздастся при build</td></tr>
</table></div>

<h2>Что реально лежит в bin</h2>
<p>После <code>dotnet build</code> в <code>Portal/bin/Debug/net8.0/</code> оказывается <b>49 файлов</b>. Не только своя сборка:</p>
<pre><code>Portal.dll                  <span class="c"># ваш код</span>
Portal.pdb                  <span class="c"># символы для отладки и стектрейсов</span>
Portal.deps.json            <span class="c"># граф зависимостей для рантайма</span>
Portal.runtimeconfig.json   <span class="c"># какой рантайм и с какими настройками запускать</span>
Microsoft.Playwright.dll    <span class="c"># зависимости, скопированные из кэша NuGet</span>
NUnit3.TestAdapter.dll
ReportPortal.json           <span class="c"># файл из проекта — благодаря CopyToOutputDirectory</span>
ReportPortal.addins
playwright.ps1              <span class="c"># скрипт, который кладёт пакет Microsoft.Playwright</span></code></pre>
<div class="note fact"><b class="h">Два наблюдения</b><p>Во-первых, <code>ReportPortal.json</code> здесь именно потому, что в csproj есть <code>CopyToOutputDirectory</code>. Во-вторых, <code>playwright.ps1</code> не написан никем из команды — его приносит пакет. Ровно этот файл потом вызывает пайплайн для установки браузеров.</p></div>

<h2>Два json-файла, которые стоит уметь читать</h2>
<p><code>Portal.runtimeconfig.json</code> — что запускать. Реальное содержимое:</p>
<pre><code>{
  <span class="a">"runtimeOptions"</span>: {
    <span class="a">"tfm"</span>: <span class="s">"net8.0"</span>,
    <span class="a">"framework"</span>: { <span class="a">"name"</span>: <span class="s">"Microsoft.NETCore.App"</span>, <span class="a">"version"</span>: <span class="s">"8.0.0"</span> }
  }
}</code></pre>
<p>Здесь и находится ответ на вопрос «почему приложение не стартует на машине без нужного рантайма»: требуется <code>Microsoft.NETCore.App</code> версии не ниже 8.0.0. На вашей машине это удовлетворено рантаймом 8.0.29.</p>
<p><code>Portal.deps.json</code> — полный список сборок, которые загрузчик имеет право подгрузить. Если положить dll в <code>bin/</code> руками, но не прописать её здесь, рантайм её просто не увидит.</p>

<h2>Debug и Release</h2>
<div class="tw"><table>
<tr><th></th><th>Debug</th><th>Release</th></tr>
<tr><td>Когда</td><td>По умолчанию локально</td><td>Явно: <code>-c Release</code>. Так собирает CI</td></tr>
<tr><td>Оптимизации</td><td>Выключены</td><td>Включены</td></tr>
<tr><td>Каталог</td><td><code>bin/Debug/net8.0/</code></td><td><code>bin/Release/net8.0/</code></td></tr>
<tr><td>Константа <code>DEBUG</code></td><td>Определена</td><td>Нет</td></tr>
</table></div>
<div class="note trap"><b class="h">Самая частая путаница с путями</b><p>Пайплайн собирает <code>-c Release</code> и потом запускает тесты по пути <code>…/bin/Release/net8.0/Portal.dll</code>. Локально вы собираете в Debug. Скопировав команду из пайплайна себе, вы получите «файл не найден» или, хуже того, прогон устаревшей сборки из другого каталога. Всегда сверяйте конфигурацию в пути.</p></div>

<h2>build, publish, pack</h2>
<div class="tw"><table>
<tr><th>Команда</th><th>Что делает</th><th>Куда кладёт</th></tr>
<tr><td><code>dotnet build</code></td><td>Компилирует и копирует зависимости</td><td><code>bin/&lt;cfg&gt;/&lt;tfm&gt;/</code></td></tr>
<tr><td><code>dotnet publish</code></td><td>Готовит к развёртыванию: только нужное, при желании — вместе с рантаймом</td><td><code>bin/&lt;cfg&gt;/&lt;tfm&gt;/publish/</code></td></tr>
<tr><td><code>dotnet pack</code></td><td>Собирает NuGet-пакет</td><td><code>bin/&lt;cfg&gt;/*.nupkg</code></td></tr>
</table></div>
<p>Для тестового проекта нужен только <code>build</code>: <code>dotnet test</code> работает с обычным выходным каталогом, публиковать нечего.</p>

<h2>Когда чистить</h2>
<pre><code>dotnet clean                       <span class="c"># аккуратно, по списку известных выходных файлов</span>
rm -rf Portal/bin Portal/obj       <span class="c"># радикально и надёжнее</span>
dotnet build --no-incremental      <span class="c"># пересобрать, ничего не удаляя</span></code></pre>
<div class="note warn"><b class="h">dotnet clean чистит не всё</b><p>Он удаляет то, что помнит как результат сборки. Файлы, оставшиеся от прежней конфигурации проекта — например, зависимость, которую вы убрали из csproj, — вполне могут пережить очистку и продолжить подгружаться. Когда поведение необъяснимо, надёжнее удалить <code>bin</code> и <code>obj</code> вручную.</p></div>
`,
quiz:[
 {q:"Чем obj/ отличается от bin/?",
  opts:["obj — для Debug, bin — для Release","obj — промежуточные файлы MSBuild и результат restore; bin — готовая к запуску сборка","obj — исходники, bin — бинарники","Разницы нет"],
  a:1, why:"В <code>obj/</code> лежат <code>project.assets.json</code>, сгенерированный код и объектные файлы. В <code>bin/</code> — то, что можно запускать, вместе со всеми зависимостями."},
 {q:"Почему ReportPortal.json оказался в bin/?",
  opts:["SDK копирует все json автоматически","Из-за <code>CopyToOutputDirectory</code> в csproj","Его кладёт туда пакет ReportPortal","Его копирует dotnet test"],
  a:1, why:"Умолчание — не копировать. Явная метадата <code>PreserveNewest</code> в csproj и приводит файл в выходной каталог, где библиотека его и ищет."},
 {q:"Что описывает <code>*.runtimeconfig.json</code>?",
  opts:["Список зависимостей для загрузчика","Какой рантайм и какой версии нужен для запуска","Настройки тестового прогона","Параметры компиляции"],
  a:1, why:"Список зависимостей — это <code>deps.json</code>. В <code>runtimeconfig.json</code> указано семейство и версия рантайма: здесь <code>Microsoft.NETCore.App</code> 8.0.0."},
 {q:"Пайплайн запускает тесты по пути <code>bin/Release/net8.0/Portal.dll</code>, а локально вы собрали по умолчанию. Что произойдёт при копировании команды?",
  opts:["Всё отработает — путь одинаковый","Файла не окажется: локальная сборка легла в bin/Debug/net8.0/","Сборка автоматически пересоберётся в Release","Тесты запустятся, но медленнее"],
  a:1, why:"Конфигурация входит в путь. Локальное умолчание — Debug, в CI явно задан Release."},
 {q:"Безопасно ли удалить каталоги bin и obj?",
  opts:["Нет, потеряются настройки проекта","Да — оба полностью воспроизводимы из исходников","Только obj","Только после dotnet clean"],
  a:1, why:"Оба каталога — производные. Именно поэтому они в <code>.gitignore</code>, и именно поэтому ручное удаление надёжнее, чем <code>dotnet clean</code>, который чистит только известные ему файлы."}
]
},

/* ----------------------------------------------------- 7 */
{
n:7, id:"cli", title:"dotnet CLI", sub:"Команды, флаги и неявные шаги",
lede:"Один исполняемый файл на всё. Главное, что нужно понять, — какие шаги команды выполняют за вас незаметно.",
body:`
<h2>Карта команд</h2>
<div class="tw"><table>
<tr><th>Команда</th><th>Что делает</th><th>Делает ли restore сама</th></tr>
<tr><td><code>dotnet restore</code></td><td>Разрешает и скачивает зависимости</td><td>—</td></tr>
<tr><td><code>dotnet build</code></td><td>Компилирует</td><td><b>да</b></td></tr>
<tr><td><code>dotnet test</code></td><td>Собирает и прогоняет тесты</td><td><b>да</b>, и ещё build</td></tr>
<tr><td><code>dotnet run</code></td><td>Собирает и запускает приложение</td><td><b>да</b>, и ещё build</td></tr>
<tr><td><code>dotnet publish</code></td><td>Готовит к развёртыванию</td><td><b>да</b></td></tr>
<tr><td><code>dotnet pack</code></td><td>Собирает NuGet-пакет</td><td><b>да</b></td></tr>
<tr><td><code>dotnet clean</code></td><td>Удаляет результаты сборки</td><td>—</td></tr>
<tr><td><code>dotnet new</code></td><td>Создаёт проект из шаблона</td><td>—</td></tr>
<tr><td><code>dotnet sln</code></td><td>Правит состав решения</td><td>—</td></tr>
<tr><td><code>dotnet format</code></td><td>Форматирует код по правилам</td><td>—</td></tr>
<tr><td><code>dotnet tool</code></td><td>Ставит глобальные и локальные утилиты</td><td>—</td></tr>
</table></div>
<div class="note"><b class="h">Неявные шаги — источник половины недоумений</b><p><code>dotnet test</code> по умолчанию делает <b>три</b> вещи: restore, build и прогон. Поэтому он «медленный на ровном месте» и поэтому иногда прогоняет не то, что вы ожидали, — он успел пересобрать. Флаги <code>--no-restore</code> и <code>--no-build</code> отключают лишнее, а в CI шаги и вовсе разносят по стадиям.</p></div>

<h2>Флаги, общие почти для всех команд</h2>
<div class="tw"><table>
<tr><th>Флаг</th><th>Смысл</th></tr>
<tr><td><code>-c Release</code></td><td>Конфигурация. Синоним <code>-p:Configuration=Release</code></td></tr>
<tr><td><code>-f net8.0</code></td><td>Конкретный TFM, если проект многоцелевой</td></tr>
<tr><td><code>-o путь</code></td><td>Свой выходной каталог</td></tr>
<tr><td><code>-v q|m|n|d|diag</code></td><td>Подробность вывода</td></tr>
<tr><td><code>--nologo</code></td><td>Без баннера — удобно в скриптах</td></tr>
<tr><td><code>-p:Имя=Значение</code></td><td>Любое свойство MSBuild. Перебивает csproj</td></tr>
<tr><td><code>--no-restore</code> / <code>--no-build</code></td><td>Пропустить неявные шаги</td></tr>
</table></div>

<div data-widget="cmd"></div>

<h2>Локальные инструменты</h2>
<p>Глобальная установка утилиты означает, что у коллеги её может не быть, а версия разъедется. Локальные инструменты решают это: список хранится в репозитории.</p>
<pre><code>dotnet new tool-manifest                 <span class="c"># создаст .config/dotnet-tools.json</span>
dotnet tool install dotnet-reportgenerator-globaltool
dotnet tool restore                      <span class="c"># на другой машине — поставит по манифесту</span>
dotnet tool run reportgenerator …</code></pre>
<p>В этом репозитории манифеста нет, а Playwright CLI README предлагает ставить глобально. Локальный манифест был бы надёжнее: версия браузерного тулинга зафиксировалась бы вместе с кодом.</p>

<h2>Полезные мелочи</h2>
<pre><code>dotnet --info                     <span class="c"># SDK, рантаймы, RID, пути</span>
dotnet new list                   <span class="c"># доступные шаблоны</span>
dotnet new nunit -o Новый         <span class="c"># тестовый проект на NUnit сразу с адаптером</span>
dotnet build -v n                 <span class="c"># видно, чем именно вызывается компилятор</span>
dotnet test --list-tests          <span class="c"># перечислить тесты, ничего не запуская</span></code></pre>
<div class="note warn"><b class="h">Осторожно с dotnet test без фильтра</b><p>В этом репозитории это 249 + 285 + 3 реальных браузерных теста, которые ходят на UAT-стенды. Прогон занимает много времени и создаёт нагрузку на среду. Для проверки, что всё компилируется и обнаруживается, есть <code>--list-tests</code>: он не запускает ни одного теста.</p></div>
`,
quiz:[
 {q:"Какие шаги <code>dotnet test</code> выполняет по умолчанию?",
  opts:["Только прогон тестов","restore, build и прогон","build и прогон","restore и прогон"],
  a:1, why:"Все три. Отсюда и заметная задержка, и риск прогнать не ту сборку. Отключаются флагами <code>--no-restore</code> и <code>--no-build</code>."},
 {q:"Как надёжно задать конфигурацию Release снаружи?",
  opts:["<code>export Configuration=Release</code>","<code>-c Release</code> в командной строке","Правкой csproj","Переменной DOTNET_CONFIGURATION"],
  a:1, why:"Командная строка имеет высший приоритет в MSBuild. Переменная окружения задаёт лишь начальное значение и перекрывается явным присваиванием в проекте."},
 {q:"Что делает <code>--list-tests</code>?",
  opts:["Запускает тесты и печатает список пройденных","Перечисляет обнаруженные тесты, не запуская их","Показывает тесты, отобранные фильтром","Выводит покрытие"],
  a:1, why:"Это discovery без выполнения. Безопасный способ проверить, что тесты собираются и находятся, — особенно когда прогон дорогой, как в UI-автоматизации."},
 {q:"Зачем нужен манифест локальных инструментов?",
  opts:["Ускоряет сборку","Фиксирует состав и версии утилит в репозитории — у всех одинаково","Заменяет PackageReference","Нужен для dotnet test"],
  a:1, why:"Глобально установленные утилиты расходятся по версиям между машинами. Манифест <code>.config/dotnet-tools.json</code> восстанавливается командой <code>dotnet tool restore</code>."},
 {q:"Чем <code>-p:Configuration=Release</code> отличается от <code>-c Release</code>?",
  opts:["Ничем по сути — второе короткая форма первого","Первое работает только для build","Второе не влияет на путь вывода","Первое игнорируется в dotnet test"],
  a:0, why:"<code>-c</code> — сокращение для того же свойства MSBuild. Через <code>-p:</code> при этом можно задать любое другое свойство, для которого отдельного флага нет."}
]
},

/* ----------------------------------------------------- 8 */
{
n:8, id:"test", title:"dotnet test", sub:"VSTest, адаптеры, фильтры",
lede:"Три слоя, которые надо различать: движок запуска, фреймворк тестов и адаптер между ними. Плюс синтаксис фильтров с проверенными подвохами.",
body:`
<h2>Кто здесь кто</h2>
<figure class="fig">
<svg viewBox="0 0 620 186" role="img" aria-label="Слои запуска тестов в .NET">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="12" width="620" height="36" rx="2" fill="var(--accent-soft)" stroke="var(--accent)"/>
  <text x="12" y="29" font-weight="600" fill="var(--ink)">dotnet test</text>
  <text x="12" y="42" font-size="9" fill="var(--ink-3)">команда CLI: делает restore, build и передаёт управление ниже</text>

  <path d="M310 48v14" stroke="var(--accent-line)"/><path d="M310 62l-4-7h8z" fill="var(--accent-line)"/>

  <rect x="0" y="64" width="620" height="36" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="12" y="81" font-weight="600" fill="var(--ink)">VSTest · Microsoft.NET.Test.Sdk</text>
  <text x="12" y="94" font-size="9" fill="var(--ink-3)">движок: находит тесты, запускает хост, собирает результаты, пишет логгерами</text>

  <path d="M310 100v14" stroke="var(--accent-line)"/><path d="M310 114l-4-7h8z" fill="var(--accent-line)"/>

  <rect x="0" y="116" width="304" height="34" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="12" y="132" font-weight="600" fill="var(--ink)">NUnit3TestAdapter</text>
  <text x="12" y="145" font-size="9" fill="var(--ink-3)">переводчик между VSTest и NUnit</text>

  <rect x="316" y="116" width="304" height="34" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="328" y="132" font-weight="600" fill="var(--ink)">NUnit</text>
  <text x="328" y="145" font-size="9" fill="var(--ink-3)">фреймворк: [Test], [SetUp], Assert, [Retry]</text>

  <text x="0" y="172" font-size="9" fill="var(--ink-3)">Убрать адаптер — тесты компилируются, но не находятся. Убрать Test.Sdk — команда dotnet test для проекта бессмысленна.</text>
 </g>
</svg>
<figcaption>Четыре слоя, и каждый ставится отдельным пакетом. «Тестов не найдено» почти всегда означает, что выпал один из средних.</figcaption>
</figure>

<h2>Обнаружение и запуск — разные фазы</h2>
<p>Сначала VSTest сканирует сборку и составляет список тестов, потом запускает отобранные. На этом проекте видно, что список не совпадает с числом методов в коде:</p>
<div class="tw"><table>
<tr><th>Проект</th><th>Методов <code>[Test]</code> в исходниках</th><th>Обнаружено случаев</th></tr>
<tr><td>Portal</td><td>230</td><td><b>249</b></td></tr>
<tr><td>Vertex2025</td><td>285</td><td>285</td></tr>
<tr><td>HQ</td><td>3</td><td>3</td></tr>
</table></div>
<p>Разница в Portal объясняется параметризацией: один метод с <code>[TestCase]</code> раскрывается в несколько случаев. Считать нагрузку надо по обнаруженным случаям, а не по методам.</p>
<div class="note fact"><b class="h">Проверено и стоит запомнить</b><p>Числа выше измерены на текущем состоянии репозитория. В <code>README.md</code> и <code>CLAUDE.md</code> для Vertex2025 указано 294 теста — фактически их 285. Такие счётчики устаревают на каждом коммите; в репозитории для этого даже заведён навык <code>docs-audit</code>. Не доверяйте числу в документе, если можете его измерить.</p></div>

<h2>Фильтры</h2>
<p>Синтаксис <code>--filter</code> принадлежит VSTest, а доступные свойства зависят от адаптера. Для NUnit это <code>FullyQualifiedName</code>, <code>Name</code>, <code>TestCategory</code> (он же <code>Category</code>), <code>Priority</code>.</p>
<div class="tw"><table>
<tr><th>Оператор</th><th>Смысл</th><th>Пример</th></tr>
<tr><td><code>=</code></td><td>Точное совпадение</td><td><code>Name=HomePageShouldLoad</code></td></tr>
<tr><td><code>!=</code></td><td>Не равно</td><td><code>TestCategory!=Slow</code></td></tr>
<tr><td><code>~</code></td><td>Содержит</td><td><code>FullyQualifiedName~FooterTests</code></td></tr>
<tr><td><code>!~</code></td><td>Не содержит</td><td><code>FullyQualifiedName!~ContactForm</code></td></tr>
<tr><td><code>&amp;</code> / <code>|</code></td><td>И / ИЛИ</td><td><code>Cat=A&amp;Name~Login</code></td></tr>
</table></div>

<div data-widget="filter"></div>

<div class="note trap"><b class="h">Проверено: --list-tests игнорирует --filter</b><p>Соблазнительно посмотреть, что попадёт под фильтр, командой <code>dotnet test --list-tests --filter "…"</code>. Так делать нельзя: измерено на этом репозитории — с фильтром и без него список одинаковый, 249 строк. Фильтр применяется только при реальном прогоне. Чтобы прикинуть охват, не запуская тесты, приходится считать по исходникам.</p></div>

<div class="note warn"><b class="h">Ловушка категорий в этом репозитории</b><p><code>--filter "Category=Vertex2025"</code> отберёт далеко не все тесты проекта: атрибут <code>[Category]</code> стоит лишь у 3 фикстур из 12. В Portal наоборот — размечены 32 из 33. Вывод практический: для Vertex2025 фильтруйте по пути проекта или по <code>FullyQualifiedName</code>, а категориям там верить нельзя.</p></div>

<h2>Логгеры и результаты</h2>
<pre><code>--logger "trx;LogFileName=test-results.trx"     <span class="c"># формат VSTest, его понимает Azure DevOps</span>
--logger "nunit;LogFilePath=results.xml"        <span class="c"># нужен пакет NunitXml.TestLogger</span>
--logger "console;verbosity=detailed"           <span class="c"># подробности прямо в консоль</span>
--results-directory ./TestResults               <span class="c"># куда складывать</span></code></pre>
<div class="note"><b class="h">Почему в Portal два логгера</b><p>TRX не переносит <code>[Property]</code> и <code>[Category]</code>. Выгрузке в Xray нужны именно они — отсюда второй логгер и дополнительный пакет в csproj. Это хороший пример того, что выбор формата отчёта диктуется потребителем отчёта, а не вкусом.</p></div>

<h2>Когда тесты не находятся</h2>
<div class="tw"><table>
<tr><th>Симптом</th><th>Обычная причина</th></tr>
<tr><td>«No test is available»</td><td>Нет адаптера (<code>NUnit3TestAdapter</code>) или нет <code>Microsoft.NET.Test.Sdk</code></td></tr>
<tr><td>Часть тестов пропала</td><td>Класс не <code>public</code>, нет <code>[TestFixture]</code>, или метод не <code>public</code></td></tr>
<tr><td>Находятся, но не запускаются</td><td>Фильтр отобрал пустое множество — проверьте синтаксис и регистр</td></tr>
<tr><td>Запускается устаревший код</td><td>Указали <code>.dll</code> или <code>--no-build</code>, а сборка не пересобиралась</td></tr>
<tr><td>Прогон падает целиком</td><td>Ошибка в <code>[SetUp]</code> или в конструкторе фикстуры — смотрите <code>--logger "console;verbosity=detailed"</code></td></tr>
</table></div>
<pre><code>dotnet test --blame-hang --blame-hang-timeout 5m   <span class="c"># найти зависший тест</span>
dotnet test --diag ./log.txt                       <span class="c"># диагностика самого VSTest</span></code></pre>
`,
quiz:[
 {q:"Из csproj убрали <code>NUnit3TestAdapter</code>, остальное на месте. Что произойдёт?",
  opts:["Ошибка компиляции","Проект соберётся, но тесты не будут обнаружены","Тесты выполнятся медленнее","Ничего, адаптер не нужен"],
  a:1, why:"Адаптер — переводчик между VSTest и NUnit. Без него команда честно отработает и сообщит, что тестов нет."},
 {q:"В Portal 230 методов <code>[Test]</code>, а обнаруживается 249 случаев. Почему?",
  opts:["19 тестов дублируются","Параметризованные методы раскрываются в несколько случаев","Адаптер считает и [SetUp]","Часть тестов унаследована"],
  a:1, why:"Обнаружение считает тестовые <em>случаи</em>. Один метод с <code>[TestCase]</code> даёт столько случаев, сколько у него наборов параметров."},
 {q:"Можно ли проверить охват фильтра командой <code>dotnet test --list-tests --filter \"…\"</code>?",
  opts:["Да, это штатный способ","Нет — --list-tests игнорирует --filter и выводит полный список","Да, но только для NUnit","Только вместе с --no-build"],
  a:1, why:"Измерено на этом репозитории: с фильтром и без него список одинаковый — 249 строк. Фильтр действует лишь при реальном прогоне."},
 {q:"Почему <code>--filter \"Category=Vertex2025\"</code> отбирает не все тесты проекта?",
  opts:["Ошибка в синтаксисе фильтра","Атрибут [Category] проставлен лишь у 3 фикстур из 12","Категории не поддерживаются NUnit","Нужен другой логгер"],
  a:1, why:"Фильтр отбирает ровно то, что размечено. В Vertex2025 разметка неполная, поэтому надёжнее фильтровать по пути проекта или по <code>FullyQualifiedName</code>."},
 {q:"Зачем в Portal два логгера сразу?",
  opts:["Для подстраховки на случай сбоя","TRX не переносит [Property] и [Category], а они нужны выгрузке в Xray","Чтобы ускорить прогон","Так требует ReportPortal"],
  a:1, why:"Формат отчёта выбирается под потребителя: Azure DevOps читает TRX, скрипт выгрузки Xray — NUnit XML с атрибутами."},
 {q:"Какой оператор фильтра означает «содержит»?",
  opts:["<code>=</code>","<code>~</code>","<code>*</code>","<code>%</code>"],
  a:1, why:"<code>~</code> — вхождение подстроки, <code>!~</code> — отрицание. Точное равенство — <code>=</code>, звёздочка в синтаксисе фильтров VSTest не используется."}
]
},
