/* ----------------------------------------------------- 9 */
{
n:9, id:"runsettings", title:"runsettings", sub:"Конфигурация прогона",
lede:"Файл, который читает не ваш код, а тестовый движок. Разберём настоящий playwright.runsettings и выясним, какие параметры в нём реально работают.",
body:`
<p><code>.runsettings</code> — XML с настройками тестового прогона. Подключается флагом <code>--settings</code>; без него действуют умолчания. Особенность, из-за которой возникает большинство недоразумений: <b>секции адресованы разным потребителям</b>, и каждый читает только свою.</p>

<div data-file="runsettings"></div>

<h2>Что ещё туда кладут</h2>
<pre><code>&lt;<span class="k">RunConfiguration</span>&gt;
  &lt;MaxCpuCount&gt;<span class="s">4</span>&lt;/MaxCpuCount&gt;                  <span class="c">&lt;!-- параллельно по сборкам --&gt;</span>
  &lt;TestSessionTimeout&gt;<span class="s">3600000</span>&lt;/TestSessionTimeout&gt;  <span class="c">&lt;!-- мс на весь прогон --&gt;</span>
  &lt;ResultsDirectory&gt;./TestResults&lt;/ResultsDirectory&gt;
  &lt;TargetFrameworkVersion&gt;net8.0&lt;/TargetFrameworkVersion&gt;
&lt;/<span class="k">RunConfiguration</span>&gt;</code></pre>
<div class="note warn"><b class="h">Здесь этого нет — и это заметно</b><p>В <code>playwright.runsettings</code> не задано ни одного таймаута. Для набора UI-тестов, который ходит на внешние стенды, зависший прогон будет висеть до таймаута самого агента. <code>TestSessionTimeout</code> — дешёвая страховка.</p></div>

<h2>Два разных параллелизма</h2>
<div class="tw"><table>
<tr><th></th><th>MaxCpuCount (VSTest)</th><th>NumberOfTestWorkers (NUnit)</th></tr>
<tr><td>Что распараллеливает</td><td>Тестовые <b>сборки</b></td><td>Тесты <b>внутри</b> одной сборки</td></tr>
<tr><td>Секция</td><td><code>&lt;RunConfiguration&gt;</code></td><td><code>&lt;NUnit&gt;</code></td></tr>
<tr><td>Здесь задано</td><td>нет</td><td><b>4</b></td></tr>
</table></div>
<div class="note trap"><b class="h">NUnit не распараллеливает без разрешения</b><p>Сколько бы воркеров вы ни выставили, NUnit выполняет фикстуры последовательно, пока не появится атрибут <code>[Parallelizable]</code> — на сборке, классе или методе. Поиск по исходникам этого репозитория такого атрибута не находит. То есть <code>NumberOfTestWorkers=4</code> сейчас, скорее всего, ни на что не влияет, и прогон идёт в один поток. Это стоит проверить замером времени, прежде чем считать четыре воркера работающими.</p></div>

<h2>Приоритет источников</h2>
<p>Одна и та же настройка приходит из нескольких мест. Порядок для этого репозитория такой:</p>
<figure class="fig">
<svg viewBox="0 0 620 118" role="img" aria-label="Приоритет источников настроек прогона">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="10" width="196" height="40" rx="2" fill="var(--accent-soft)" stroke="var(--accent)"/>
  <text x="98" y="28" text-anchor="middle" font-weight="600" fill="var(--ink)">переменные окружения</text>
  <text x="98" y="42" text-anchor="middle" font-size="9" fill="var(--ink-3)">BROWSER, HEADED, SPACES_URL</text>

  <path d="M200 30h22" stroke="var(--ink-3)"/><path d="M222 30l-7-4v8z" fill="var(--ink-3)"/>

  <rect x="226" y="10" width="180" height="40" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="316" y="28" text-anchor="middle" font-weight="600" fill="var(--ink)">.runsettings</text>
  <text x="316" y="42" text-anchor="middle" font-size="9" fill="var(--ink-3)">BrowserName, воркеры</text>

  <path d="M410 30h22" stroke="var(--ink-3)"/><path d="M432 30l-7-4v8z" fill="var(--ink-3)"/>

  <rect x="436" y="10" width="184" height="40" rx="2" fill="var(--surface-3)" stroke="var(--line)" stroke-dasharray="3 3"/>
  <text x="528" y="28" text-anchor="middle" font-weight="600" fill="var(--ink-2)">умолчания</text>
  <text x="528" y="42" text-anchor="middle" font-size="9" fill="var(--ink-3)">chromium, headless</text>

  <text x="0" y="72" font-size="9.5" fill="var(--ink-3)">сильнее ←──────────────────────────────────────────────────────────→ слабее</text>
  <text x="0" y="94" font-size="9.5" fill="var(--ink-2)">Поэтому в CI достаточно выставить BROWSER и HEADED переменными, не редактируя файл,</text>
  <text x="0" y="108" font-size="9.5" fill="var(--ink-2)">и поэтому же локальный export переопределит то, что написано в runsettings.</text>
 </g>
</svg>
<figcaption>Переменные окружения читает адаптер Playwright напрямую и перекрывает ими содержимое файла.</figcaption>
</figure>

<h2>Как этим пользоваться</h2>
<pre><code><span class="c"># обычный прогон одного проекта</span>
RP_ENABLED=false dotnet test Portal/Portal.csproj --settings playwright.runsettings

<span class="c"># с видимым браузером — обязательно с узким фильтром</span>
HEADED=1 RP_ENABLED=false dotnet test Portal/Portal.csproj \\
  --settings playwright.runsettings --filter "FullyQualifiedName~FooterTests"

<span class="c"># другой браузер</span>
BROWSER=firefox dotnet test Portal/Portal.csproj --settings playwright.runsettings</code></pre>
<div class="note"><b class="h">Зачем RP_ENABLED=false</b><p>Пакет <code>ReportPortal.NUnit</code> при каждом прогоне создаёт запуск на сервере отчётов — включая ваши локальные эксперименты. Библиотека принимает префикс <code>RP_</code> для любого ключа конфигурации, поэтому переменная окружения гасит отправку, не трогая <code>ReportPortal.json</code>.</p></div>
`,
quiz:[
 {q:"Кто читает секцию <code>&lt;NUnit&gt;</code> в runsettings?",
  opts:["VSTest","Адаптер NUnit3TestAdapter","Сам dotnet CLI","Код тестов"],
  a:1, why:"Именованные секции принадлежат адаптерам. VSTest в них не заглядывает — ему адресована <code>&lt;RunConfiguration&gt;</code>."},
 {q:"Что произойдёт, если задать <code>NumberOfTestWorkers=4</code>, но нигде не поставить <code>[Parallelizable]</code>?",
  opts:["Тесты пойдут в 4 потока","Тесты останутся последовательными — NUnit требует явного разрешения","Возникнет ошибка конфигурации","Параллелизм включится только для [TestCase]"],
  a:1, why:"NUnit не распараллеливает по умолчанию. Без атрибута воркеры простаивают, и настройка вводит в заблуждение."},
 {q:"В runsettings записано <code>BrowserName=chromium</code>, а в окружении <code>BROWSER=firefox</code>. Какой браузер запустится?",
  opts:["chromium — файл важнее","firefox — переменная окружения перекрывает файл","Оба по очереди","Ошибка конфликта настроек"],
  a:1, why:"Адаптер Playwright читает переменные окружения напрямую и отдаёт им приоритет. Поэтому в CI переменных достаточно, файл править не нужно."},
 {q:"Параметр объявлен в <code>&lt;TestRunParameters&gt;</code>, но в коде нет обращений к <code>TestContext.Parameters</code>. Что это значит?",
  opts:["Параметр применяется автоматически","Он ни на что не влияет — объявление не равно использованию","Он попадёт в переменные окружения","Его прочитает адаптер"],
  a:1, why:"Ровно этот случай и есть в репозитории: <code>headless</code> объявлен, но не читается никем. Полезная привычка — проверять поиском, что параметр где-то потребляется."},
 {q:"Зачем при локальном прогоне ставят <code>RP_ENABLED=false</code>?",
  opts:["Ускоряет тесты","Не засоряет ReportPortal запусками с локальной машины","Отключает параллелизм","Включает подробный лог"],
  a:1, why:"Иначе каждый локальный эксперимент создаёт запуск на общем сервере отчётов. Префикс <code>RP_</code> перекрывает любой ключ из <code>ReportPortal.json</code>."}
]
},

/* ----------------------------------------------------- 10 */
{
n:10, id:"config", title:"Конфигурация", sub:"Переменные окружения, файлы, секреты",
lede:"Как проект получает адреса стендов и учётные данные — и почему для тестового проекта выбран самый простой из механизмов.",
body:`
<p>У .NET есть богатая система конфигурации: <code>IConfiguration</code>, <code>appsettings.json</code>, иерархия провайдеров, привязка к типам. В этом репозитории не используется ничего из этого — и решение вполне обоснованное. Посмотрим на оба подхода.</p>

<h2>Что сделано здесь</h2>
<pre><code><span class="c">// Portal/Config/TestConfig.cs — реальный код</span>
public static class TestConfig
{
    public static string BaseUrl =&gt;
        Environment.GetEnvironmentVariable(<span class="s">"SPACES_URL"</span>) ?? <span class="s">"https://uat.example.com/"</span>;

    public static string BasicAuthUsername =&gt;
        Environment.GetEnvironmentVariable(<span class="s">"BASIC_AUTH_USERNAME"</span>)
        ?? throw new InvalidOperationException(<span class="s">"BASIC_AUTH_USERNAME is not set"</span>);
}</code></pre>
<p>Три приёма, каждый со смыслом:</p>
<ul>
<li><b>Свойства, а не поля.</b> Стрелка <code>=&gt;</code> означает вычисление при каждом обращении, а не однократно при загрузке типа. Переменную можно поменять между тестами, и это подхватится.</li>
<li><b>Оператор <code>??</code></b> даёт значение по умолчанию — стенд UAT.</li>
<li><b><code>?? throw</code></b> вместо умолчания для учётных данных: отсутствие переменной обрушивает прогон сразу и с внятным текстом, а не превращается в непонятный отказ авторизации на сотне тестов.</li>
</ul>
<div class="note fact"><b class="h">Три проекта расходятся именно здесь</b><p>В Portal отсутствие переменной приводит к исключению. В HQ и Vertex2025 подставляются учётные данные, <b>записанные прямо в исходниках</b>. Второй вариант удобнее для новичка и хуже во всём остальном: секрет попадает в историю git навсегда. Portal показывает целевое состояние, к которому стоит привести и остальные два.</p></div>

<h2>Штатный механизм .NET — для сравнения</h2>
<pre><code>var config = new ConfigurationBuilder()
    .AddJsonFile(<span class="s">"appsettings.json"</span>, optional: true)
    .AddJsonFile($<span class="s">"appsettings.{env}.json"</span>, optional: true)   <span class="c">// перекрывает предыдущий</span>
    .AddEnvironmentVariables()                                <span class="c">// перекрывает файлы</span>
    .AddCommandLine(args)                                     <span class="c">// перекрывает всё</span>
    .Build();

string url = config[<span class="s">"Site:BaseUrl"</span>];</code></pre>
<p>Порядок регистрации задаёт приоритет: последний зарегистрированный источник побеждает. Двоеточие в ключе — разделитель уровней вложенности; в переменных окружения на Linux вместо него пишут двойное подчёркивание: <code>Site__BaseUrl</code>.</p>
<div class="tw"><table>
<tr><th></th><th>Environment.GetEnvironmentVariable</th><th>IConfiguration</th></tr>
<tr><td>Зависимости</td><td>Никаких</td><td>Пакеты <code>Microsoft.Extensions.Configuration.*</code></td></tr>
<tr><td>Иерархия и типизация</td><td>Нет, только строки</td><td>Есть, с привязкой к классам</td></tr>
<tr><td>Профили окружений</td><td>Вручную</td><td>Встроенные</td></tr>
<tr><td>Когда уместно</td><td>Пять-шесть параметров, всё приходит из CI</td><td>Приложение с настройками, профилями и вложенной структурой</td></tr>
</table></div>
<div class="note"><b class="h">Вывод для этого репозитория</b><p>Параметров действительно мало, все приходят из пайплайна переменными, вложенность не нужна. Тащить ради этого систему конфигурации не стоит — простое статическое свойство честнее. Единственное, что стоит поправить, — убрать зашитые учётные данные из HQ и Vertex2025.</p></div>

<h2>Как переменные попадают в тест</h2>
<pre><code><span class="c">// Portal/Tests/BaseTest.cs — реальный код</span>
public class BaseTest : PageTest
{
    public override BrowserNewContextOptions ContextOptions() =&gt; new()
    {
        BaseURL = TestConfig.BaseUrl,
        ViewportSize = new ViewportSize { Width = <span class="s">1920</span>, Height = <span class="s">1080</span> },
        HttpCredentials = new HttpCredentials
        {
            Username = TestConfig.BasicAuthUsername,
            Password = TestConfig.BasicAuthPassword,
        },
    };
}</code></pre>
<p>Базовая авторизация задаётся на уровне <em>контекста браузера</em>, поэтому уходит в каждый запрос автоматически — отдельной обработки в тестах не нужно. Это же объясняет, почему при незаданной переменной падает сразу всё: исключение возникает при создании контекста, то есть до первого шага любого теста.</p>

<h2>Секреты</h2>
<div class="tw"><table>
<tr><th>Способ</th><th>Годится для</th></tr>
<tr><td>Переменные окружения из CI</td><td>Основной рабочий вариант, как здесь</td></tr>
<tr><td><code>dotnet user-secrets</code></td><td>Локальная разработка: значения лежат вне репозитория, в профиле пользователя</td></tr>
<tr><td>Хранилище секретов (Key Vault и аналоги)</td><td>Продакшен</td></tr>
<tr><td>Значения в коде или в json репозитория</td><td>Не годится никогда</td></tr>
</table></div>
<div class="note trap"><b class="h">Действующие секреты в репозитории</b><p>Сейчас в git лежат: ключ API ReportPortal во всех трёх файлах <code>ReportPortal.json</code> и учётные данные Basic Auth в <code>TestConfig.cs</code> у HQ и Vertex2025. Удаление из рабочей копии не помогает — значение остаётся в истории и должно считаться скомпрометированным. Правильная последовательность: перевыпустить ключ, перевести чтение на переменные окружения, добавить проверку секретов в конвейер.</p></div>
`,
quiz:[
 {q:"Почему <code>TestConfig.BaseUrl</code> объявлено свойством со стрелкой, а не полем?",
  opts:["Так короче писать","Значение вычисляется при каждом обращении, а не один раз при загрузке типа","Поля не могут быть статическими","Требование NUnit"],
  a:1, why:"Выражение <code>=&gt;</code> — это тело метода доступа. Переменная окружения читается каждый раз, поэтому её изменение подхватывается без перезапуска процесса."},
 {q:"Почему в Portal отсутствие BASIC_AUTH_USERNAME приводит к исключению, а не к значению по умолчанию?",
  opts:["Так требует Playwright","Чтобы отказ был явным и сразу, а не сотней непонятных падений авторизации","Умолчания для строк запрещены","Это ошибка в коде"],
  a:1, why:"Быстрый и внятный отказ лучше отложенного и запутанного. Отсутствие учётных данных иначе проявилось бы как массовые падения на шагах логина."},
 {q:"В <code>ConfigurationBuilder</code> сначала <code>AddJsonFile</code>, потом <code>AddEnvironmentVariables</code>. Что победит?",
  opts:["Файл","Переменная окружения — последний зарегистрированный источник","Тот, где значение непустое","Порядок не влияет"],
  a:1, why:"Приоритет задаётся порядком регистрации: побеждает добавленный позже. Поэтому переменные окружения обычно регистрируют после файлов."},
 {q:"Как в переменной окружения записать вложенный ключ <code>Site:BaseUrl</code>?",
  opts:["<code>Site:BaseUrl</code>","<code>Site__BaseUrl</code> — двойное подчёркивание","<code>Site.BaseUrl</code>","Вложенные ключи так не задаются"],
  a:1, why:"Двоеточие в именах переменных проблемно на Unix-подобных системах, поэтому провайдер понимает двойное подчёркивание как разделитель уровней."},
 {q:"Учётные данные Basic Auth задаются в <code>ContextOptions()</code>. Что из этого следует?",
  opts:["Их надо передавать в каждом тесте","Они уходят в каждый запрос автоматически, а при их отсутствии падает весь прогон сразу","Они работают только для первой страницы","Их надо дублировать в runsettings"],
  a:1, why:"Настройка живёт на уровне контекста браузера. Отсюда и автоматическое применение ко всем запросам, и раннее падение при незаданных переменных."}
]
},

/* ----------------------------------------------------- 11 */
{
n:11, id:"ci", title:"Сборка в CI", sub:"Стадии, артефакты, запуск по dll",
lede:"Локально хватает одной команды. В конвейере те же шаги разносятся по стадиям и агентам — и это меняет способ запуска тестов.",
body:`
<p>Ниже разобран настоящий пайплайн проекта Portal, сокращённый до сути. <b>Строки с пунктиром кликабельны.</b></p>

<div data-file="pipeline"></div>

<h2>Локально и в CI — одно и то же разными словами</h2>
<div class="tw"><table>
<tr><th>Шаг</th><th>Локально</th><th>В конвейере</th></tr>
<tr><td>SDK</td><td>Уже установлен</td><td>Ставится задачей <code>UseDotNet@2</code></td></tr>
<tr><td>restore</td><td>Неявно внутри build</td><td>Отдельным шагом — ради читаемого лога</td></tr>
<tr><td>build</td><td><code>dotnet build</code> (Debug)</td><td><code>--configuration Release</code></td></tr>
<tr><td>браузеры</td><td>Один раз на машину</td><td>Каждый прогон, <code>--with-deps</code></td></tr>
<tr><td>тесты</td><td>По <code>.csproj</code></td><td>По <code>.dll</code> из артефакта</td></tr>
<tr><td>отчёт</td><td>Консоль</td><td>TRX в Azure DevOps + NUnit XML в Xray + ReportPortal</td></tr>
</table></div>

<h2>Почему тесты запускаются по .dll</h2>
<p>Это главное отличие, и оно вытекает из архитектуры конвейера: сборка идёт на одном агенте, тесты — на другом, у которого есть сетевой доступ к внутренним стендам. Между ними результат передаётся артефактом.</p>
<figure class="fig">
<svg viewBox="0 0 620 150" role="img" aria-label="Две стадии конвейера и передача артефакта">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="14" width="270" height="86" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="12" y="32" font-weight="600" fill="var(--ink)">Стадия Build</text>
  <text x="12" y="47" font-size="9" fill="var(--ink-3)">пул: ubuntu-22.04 (облачный)</text>
  <text x="12" y="66" fill="var(--ink-2)">restore → build -c Release</text>
  <text x="12" y="82" fill="var(--ink-2)">→ упаковать bin/ в артефакт</text>

  <path d="M274 57h60" stroke="var(--accent)" stroke-width="1.2"/><path d="M334 57l-8-4.5v9z" fill="var(--accent)"/>
  <text x="304" y="49" text-anchor="middle" font-size="9" fill="var(--accent)">артефакт</text>

  <rect x="338" y="14" width="282" height="86" rx="2" fill="var(--accent-soft)" stroke="var(--accent)"/>
  <text x="350" y="32" font-weight="600" fill="var(--ink)">Стадия Test</text>
  <text x="350" y="47" font-size="9" fill="var(--ink-3)">пул: we-aks-preprod-agent (приватный)</text>
  <text x="350" y="66" fill="var(--ink-2)">скачать артефакт → chmod +x</text>
  <text x="350" y="82" fill="var(--ink-2)">→ playwright install → dotnet test dll</text>

  <text x="0" y="124" font-size="9.5" fill="var(--ink-2)">Приватный агент нужен, потому что UAT-стенды недоступны из публичного облака.</text>
  <text x="0" y="138" font-size="9.5" fill="var(--ink-2)">Шаг chmod +x — потому что права на выполнение теряются при упаковке артефакта.</text>
 </g>
</svg>
<figcaption>Сборка и прогон физически разделены. Отсюда запуск по собранной .dll: пересобирать на тестовом агенте нечего и незачем.</figcaption>
</figure>

<h2>Три предохранителя, о которых надо помнить</h2>
<div class="tw"><table>
<tr><th>Настройка</th><th>Следствие</th></tr>
<tr><td><code>trigger: none</code></td><td>Конвейер не запускается сам. Только вручную — коммит в main тесты не прогонит</td></tr>
<tr><td><code>continueOnError: true</code></td><td>Падение тестов не останавливает конвейер</td></tr>
<tr><td><code>failTaskOnFailedTests: false</code></td><td>Красные тесты не делают сборку красной</td></tr>
</table></div>
<div class="note trap"><b class="h">Зелёный конвейер здесь не означает зелёные тесты</b><p>Все три настройки вместе дают систему, которая почти никогда не показывает красный. Для нестабильного UI-набора это осознанный выбор — иначе конвейер краснел бы постоянно и на него перестали бы смотреть. Но следствие надо держать в голове: <b>результат нужно смотреть в отчёте</b> — на вкладке тестов, в ReportPortal или в Xray, а не по цвету сборки.</p></div>

<h2>Кэширование и скорость</h2>
<p>Каждый прогон заново скачивает пакеты и браузеры. Обычные меры:</p>
<ul>
<li><b>Кэш NuGet</b> — задача <code>Cache@2</code> по ключу от <code>*.csproj</code>. Даёт больше всего при малом риске.</li>
<li><b>Кэш браузеров Playwright</b> — сложнее: они зависят от версии пакета, ключ должен включать её.</li>
<li><b>Готовый образ агента</b> с предустановленными SDK и браузерами — самый радикальный и самый эффективный вариант.</li>
</ul>
<div class="note"><b class="h">Чего в этом конвейере ещё нет</b><ul>
<li>Кэша пакетов и браузеров — каждый прогон начинается с нуля.</li>
<li>Таймаута на прогон: зависший тест будет висеть до таймаута агента.</li>
<li>Сбора артефактов при падении — трассировок, скриншотов и видео Playwright. Для UI-набора это самая полезная из недостающих вещей: сейчас по красному тесту доступен только текст ошибки.</li>
</ul></div>
`,
quiz:[
 {q:"Почему в конвейере тесты запускаются по <code>.dll</code>, а не по <code>.csproj</code>?",
  opts:["Так быстрее компилируется","Сборка и тесты идут на разных агентах, результат передаётся артефактом — пересобирать нечего","dotnet test не принимает csproj","Требование Azure DevOps"],
  a:1, why:"Стадия Build работает на облачном агенте, стадия Test — на приватном с доступом к UAT. Запуск по dll использует то, что приехало артефактом, и не делает ни restore, ни build."},
 {q:"Что означает <code>trigger: none</code>?",
  opts:["Конвейер отключён","Автоматических запусков нет — только вручную","Триггеры задаются в UI","Запуск только по расписанию"],
  a:1, why:"Коммит в ветку конвейер не запустит. Для набора, который ходит на живые стенды, это осознанное решение, но означает, что регрессия не ловится автоматически."},
 {q:"Зачем в конвейере отдельный шаг <code>chmod +x</code>?",
  opts:["Для безопасности","Права на выполнение теряются при упаковке и распаковке артефакта","Так требует Playwright","Чтобы ускорить запуск"],
  a:1, why:"Артефакт не сохраняет файловые права. Без восстановления бита исполнения запуск на Linux-агенте не состоится."},
 {q:"Конвейер зелёный. Значит ли это, что все тесты прошли?",
  opts:["Да","Нет: <code>continueOnError</code> и <code>failTaskOnFailedTests: false</code> прячут падения","Да, если стадия Test завершилась","Зависит от логгера"],
  a:1, why:"Две настройки вместе не дают падениям тестов покрасить сборку. Результат надо смотреть в отчёте, а не по цвету конвейера."},
 {q:"Что даст наибольший выигрыш во времени прогона?",
  opts:["Увеличить число воркеров","Кэшировать пакеты NuGet и браузеры или взять готовый образ агента","Собирать в Debug","Убрать второй логгер"],
  a:1, why:"Сейчас каждый прогон заново скачивает пакеты и браузеры. Кэш или преднастроенный образ агента убирает эти минуты целиком."}
]
},

/* ----------------------------------------------------- 12 */
{
n:12, id:"errors", title:"Диагностика", sub:"Разбор типовых сообщений",
lede:"Каталог ошибок, которые встречаются чаще всего, с настоящими текстами и порядком действий.",
body:`
<p>Сообщения .NET обычно точны, но не всегда очевидны. Ниже — те, что встречаются чаще прочих; тексты приведены как они выглядят на самом деле.</p>

<h2>NETSDK1004 — не выполнен restore</h2>
<pre><code>error <span class="k">NETSDK1004</span>: Assets file '…/obj/project.assets.json' not found.
Run a NuGet package restore to generate this file.</code></pre>
<p>Возникает, когда сборка запущена с <code>--no-restore</code> на чистом дереве или после ручного удаления <code>obj/</code>. Лечение — <code>dotnet restore</code> либо просто убрать флаг.</p>

<h2>NETSDK1045 — TFM новее SDK</h2>
<pre><code>error <span class="k">NETSDK1045</span>: The current .NET SDK does not support targeting .NET 12.0.
Either target .NET 10.0 or lower, or use a version of the .NET SDK that supports .NET 12.0.</code></pre>
<p>Проект целится в платформу новее установленного SDK. Либо понизить <code>TargetFramework</code>, либо обновить SDK. Обратная ситуация ошибкой не является: свежий SDK спокойно собирает старый TFM.</p>

<h2>«A compatible .NET SDK was not found»</h2>
<pre><code>The command could not be loaded, possibly because:
  * You intended to execute a .NET application:
      The application 'build' does not exist or is not a managed .dll or .exe.
  * You intended to execute a .NET SDK command:
      <span class="k">A compatible .NET SDK was not found.</span></code></pre>
<div class="note warn"><b class="h">Сообщение обманывает</b><p>Первая половина уводит в сторону разговором про «команду build». Настоящая причина в последней строке: <code>global.json</code> требует версию SDK, которой на машине нет. Проверьте файл и <code>dotnet --list-sdks</code>; часто достаточно сменить <code>rollForward</code> на <code>latestMajor</code>.</p></div>

<h2>NU1101 — пакет не найден</h2>
<pre><code>error <span class="k">NU1101</span>: Unable to find package X. No packages exist with this id
in source(s): nuget.org</code></pre>
<p>Смотрите на список источников в конце сообщения. Чаще всего дело не в опечатке, а в том, что корпоративный фид не подключён или отсечён элементом <code>&lt;clear /&gt;</code> в <code>nuget.config</code>.</p>

<h2>MSB3277 — конфликт версий сборок</h2>
<p>«Found conflicts between different versions of the same assembly». Два пакета тянут разные версии одной библиотеки. Диагностируется командой <code>dotnet list package --include-transitive</code>: ищите пакет, у которого <code>Resolved</code> выше <code>Requested</code>. Лечится явным <code>PackageReference</code> на согласованную версию.</p>

<h2>Тесты не найдены</h2>
<pre><code>No test is available in …/Portal.dll.
Make sure that test discoverer &amp; executors are registered.</code></pre>
<div class="tw"><table>
<tr><th>Проверьте</th><th>Как</th></tr>
<tr><td>Есть ли <code>Microsoft.NET.Test.Sdk</code></td><td>Без него проект не считается тестовым</td></tr>
<tr><td>Есть ли <code>NUnit3TestAdapter</code></td><td>Без адаптера тесты не обнаруживаются</td></tr>
<tr><td>Класс <code>public</code> и с <code>[TestFixture]</code></td><td>Внутренний класс не найдётся</td></tr>
<tr><td>Не указан ли <code>--no-build</code></td><td>Может прогоняться устаревшая сборка</td></tr>
<tr><td>Верна ли конфигурация в пути</td><td><code>bin/Debug</code> против <code>bin/Release</code></td></tr>
</table></div>

<h2>Собирается не то, что ожидалось</h2>
<div class="tw"><table>
<tr><th>Приём</th><th>Что показывает</th></tr>
<tr><td><code>dotnet msbuild -getProperty:Имя</code></td><td>Реальное значение свойства</td></tr>
<tr><td><code>dotnet msbuild -getItem:Compile</code></td><td>Какие файлы попали в компиляцию</td></tr>
<tr><td><code>dotnet build -v n</code></td><td>Полную командную строку компилятора</td></tr>
<tr><td><code>dotnet build -bl</code></td><td>Двоичный лог всей сборки для детального разбора</td></tr>
<tr><td><code>rm -rf bin obj</code></td><td>Снимает вопросы о залежавшихся файлах надёжнее, чем <code>dotnet clean</code></td></tr>
</table></div>

<h2>Порядок действий, когда непонятно совсем</h2>
<ol>
<li><code>dotnet --info</code> — тот ли SDK, есть ли нужный рантайм.</li>
<li>Есть ли <code>global.json</code> выше по дереву каталогов.</li>
<li><code>rm -rf bin obj</code>, затем <code>dotnet restore</code> и <code>dotnet build</code> по отдельности — станет видно, какой именно этап падает.</li>
<li><code>dotnet build -v n</code> — прочитать, чем на самом деле вызывается компилятор.</li>
<li>Для тестов — <code>--list-tests</code>: обнаруживаются ли они вообще, до всяких фильтров.</li>
<li>Если и это не помогло — <code>-bl</code> и разбор двоичного лога.</li>
</ol>
<div class="note fact"><b class="h">Правило, экономящее больше всего времени</b><p>Разделяйте этапы. <code>dotnet test</code> выполняет restore, build и прогон разом, и по одному сообщению не всегда ясно, что именно сломалось. Три отдельные команды дают три отдельных ответа.</p></div>
`,
quiz:[
 {q:"<code>NETSDK1004: Assets file not found</code>. Что делать?",
  opts:["Обновить SDK","Выполнить restore — либо убрать флаг --no-restore","Понизить TargetFramework","Очистить кэш NuGet"],
  a:1, why:"<code>project.assets.json</code> — результат restore. Файла нет, значит restore не выполнялся: типично после удаления <code>obj/</code> или при сборке с <code>--no-restore</code>."},
 {q:"Что на самом деле означает «The application 'build' does not exist»?",
  opts:["Повреждена установка .NET","global.json требует версию SDK, которой нет на машине","Нет прав на выполнение","Не найден csproj"],
  a:1, why:"Существенная строка — последняя: «A compatible .NET SDK was not found». Начало сообщения уводит в сторону."},
 {q:"Как диагностировать MSB3277 — конфликт версий сборок?",
  opts:["Очистить bin и obj","<code>dotnet list package --include-transitive</code> и искать Resolved выше Requested","Пересоздать решение","Отключить транзитивные зависимости"],
  a:1, why:"Конфликт возникает, когда пакеты тянут разные версии одной библиотеки. Разницу между запрошенной и разрешённой версией видно именно в этом выводе."},
 {q:"«No test is available» при том, что тесты в проекте есть. Первое, что проверить?",
  opts:["Синтаксис фильтра","Наличие Microsoft.NET.Test.Sdk и NUnit3TestAdapter","Версию рантайма","Настройки runsettings"],
  a:1, why:"Обнаружение обеспечивают именно эти два пакета. Без Test.Sdk проект не тестовый, без адаптера тесты не находятся."},
 {q:"Почему при непонятной проблеме советуют выполнить restore и build раздельно?",
  opts:["Так быстрее","Потому что dotnet test делает всё сразу, и по одному сообщению не видно, какой этап упал","Так требует MSBuild","Чтобы обойти кэш"],
  a:1, why:"Разделение этапов локализует проблему: сразу видно, дело в зависимостях, в компиляции или в самом прогоне."},
 {q:"Что надёжнее очищает результаты сборки?",
  opts:["<code>dotnet clean</code>","Ручное удаление bin и obj","<code>dotnet build --no-incremental</code>","<code>dotnet nuget locals all --clear</code>"],
  a:1, why:"<code>dotnet clean</code> удаляет лишь то, что помнит как свой результат. Файлы от прежней конфигурации проекта могут пережить очистку и продолжить подгружаться."}
]
}
];
