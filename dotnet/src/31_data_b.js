/* ----------------------------------------------------- 3 */
{
n:3, id:"msbuild", title:"MSBuild", sub:"Кто на самом деле собирает",
lede:"dotnet build — тонкая обёртка. Работу делает MSBuild, и понимание его модели снимает почти все вопросы «почему собралось не то».",
body:`
<p>MSBuild выполняет файл проекта как программу. У неё три вида сущностей: <b>свойства</b> (скаляры), <b>элементы</b> (списки) и <b>таргеты</b> (шаги с зависимостями). SDK приносит готовый набор таргетов — <code>Restore</code>, <code>Build</code>, <code>Clean</code>, <code>Publish</code>, <code>Pack</code>, <code>VSTest</code>, — а csproj их настраивает.</p>

<h2>Порядок вычисления и приоритет</h2>
<p>Один и тот же параметр можно задать в четырёх местах. Приоритет фиксированный, и знать его нужно наизусть:</p>
<figure class="fig">
<svg viewBox="0 0 620 196" role="img" aria-label="Приоритет источников значения свойства MSBuild">
 <g font-family="var(--fm)" font-size="10.5">
  <text x="0" y="12" font-size="9.5" letter-spacing="1" fill="var(--ink-3)">СИЛЬНЕЕ ВСЕГО</text>
  <rect x="0" y="20" width="620" height="34" rx="2" fill="var(--accent-soft)" stroke="var(--accent)"/>
  <text x="14" y="41" font-weight="600" fill="var(--ink)">1 · Командная строка</text>
  <text x="230" y="41" fill="var(--ink-2)">-p:Configuration=Release</text>
  <text x="606" y="41" text-anchor="end" fill="var(--accent)">перебивает всё</text>

  <rect x="0" y="60" width="620" height="34" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="14" y="81" font-weight="600" fill="var(--ink)">2 · Сам .csproj</text>
  <text x="230" y="81" fill="var(--ink-2)">&lt;Configuration&gt;Debug&lt;/Configuration&gt;</text>
  <text x="606" y="81" text-anchor="end" fill="var(--ink-3)">перебивает окружение</text>

  <rect x="0" y="100" width="620" height="34" rx="2" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="14" y="121" font-weight="600" fill="var(--ink)">3 · Directory.Build.props</text>
  <text x="230" y="121" fill="var(--ink-2)">импортируется до тела проекта</text>
  <text x="606" y="121" text-anchor="end" fill="var(--ink-3)">общее для дерева</text>

  <rect x="0" y="140" width="620" height="34" rx="2" fill="var(--surface-3)" stroke="var(--line)" stroke-dasharray="3 3"/>
  <text x="14" y="161" font-weight="600" fill="var(--ink)">4 · Переменные окружения</text>
  <text x="230" y="161" fill="var(--ink-2)">export Configuration=Release</text>
  <text x="606" y="161" text-anchor="end" fill="var(--ink-3)">начальные значения</text>
  <text x="0" y="190" font-size="9.5" letter-spacing="1" fill="var(--ink-3)">СЛАБЕЕ ВСЕГО</text>
 </g>
</svg>
<figcaption>Переменная окружения задаёт лишь стартовое значение: любая явная строка в проекте её перекроет. Флаг -p: в командной строке не перекрывается ничем.</figcaption>
</figure>
<div class="note warn"><b class="h">Практическое следствие</b><p>Если экспортировать <code>Configuration=Release</code> в окружение, а в csproj стоит явное присваивание — вы получите Debug и будете долго искать причину. Надёжный способ задать конфигурацию снаружи только один: <code>-c Release</code> или <code>-p:Configuration=Release</code> в командной строке.</p></div>

<h2>Как посмотреть, что получилось на самом деле</h2>
<p>Не нужно гадать — MSBuild умеет отвечать напрямую. Ниже реальный вывод на проекте Portal:</p>
<pre><code><span class="c">$ dotnet msbuild Portal/Portal.csproj -getProperty:TargetFramework \\
      -getProperty:OutputPath -getProperty:AssemblyName -getProperty:RootNamespace</span>
{
  <span class="a">"Properties"</span>: {
    <span class="a">"TargetFramework"</span>: <span class="s">"net8.0"</span>,
    <span class="a">"OutputPath"</span>: <span class="s">"bin\\Debug/net8.0/"</span>,
    <span class="a">"AssemblyName"</span>: <span class="s">"Portal"</span>,
    <span class="a">"RootNamespace"</span>: <span class="s">"Acme.WebAutomation.Portal"</span>
  }
}

<span class="c">$ dotnet msbuild Portal/Portal.csproj -getProperty:Configuration -p:Configuration=Release</span>
Release</code></pre>
<div class="note fact"><b class="h">Заметьте две детали</b><p>Во-первых, <code>AssemblyName</code> = <code>Portal</code>, хотя <code>RootNamespace</code> совсем другой — это и есть подтверждение, что они независимы. Во-вторых, в <code>OutputPath</code> смешаны разделители <code>\\</code> и <code>/</code>: MSBuild исторически оперирует Windows-разделителями и нормализует их лишь при обращении к файловой системе. Пугаться не нужно.</p></div>

<h2>Полезные ключи диагностики</h2>
<div class="tw"><table>
<tr><th>Команда</th><th>Что показывает</th></tr>
<tr><td><code>-getProperty:Имя</code></td><td>Вычисленное значение свойства, без сборки</td></tr>
<tr><td><code>-getItem:Compile</code></td><td>Какие файлы реально попали в компиляцию</td></tr>
<tr><td><code>-v n</code> / <code>-v d</code></td><td>Подробность лога: normal / detailed. На detailed видна полная командная строка компилятора</td></tr>
<tr><td><code>-bl</code></td><td>Двоичный лог <code>msbuild.binlog</code> — исчерпывающая запись сборки, открывается MSBuild Structured Log Viewer</td></tr>
<tr><td><code>-t:Rebuild</code></td><td>Явно вызвать таргет. <code>Rebuild</code> = <code>Clean</code> + <code>Build</code></td></tr>
<tr><td><code>--no-incremental</code></td><td>Игнорировать кэш инкрементальной сборки</td></tr>
</table></div>

<h2>Directory.Build.props — общие настройки на всё дерево</h2>
<p>Файл с таким именем в корне репозитория MSBuild импортирует <b>в начало</b> каждого проекта ниже по дереву. Это штатный способ не дублировать настройки по трём csproj:</p>
<pre><code><span class="c">&lt;!-- Directory.Build.props в корне — сейчас в репозитории его нет --&gt;</span>
&lt;<span class="k">Project</span>&gt;
  &lt;<span class="k">PropertyGroup</span>&gt;
    &lt;TargetFramework&gt;net8.0&lt;/TargetFramework&gt;
    &lt;Nullable&gt;enable&lt;/Nullable&gt;
    &lt;ImplicitUsings&gt;enable&lt;/ImplicitUsings&gt;
    &lt;IsPackable&gt;false&lt;/IsPackable&gt;
  &lt;/<span class="k">PropertyGroup</span>&gt;
&lt;/<span class="k">Project</span>&gt;</code></pre>
<p>Парный <code>Directory.Build.targets</code> импортируется, наоборот, <b>в конец</b> — туда кладут то, что должно переопределить уже вычисленное проектом.</p>
<div class="note"><b class="h">Стоит ли заводить его здесь</b><p>Три csproj повторяют одни и те же четыре строки. Вынести их в <code>Directory.Build.props</code> — очевидное упрощение, но у него есть цена: настройки перестают быть видны в самом файле проекта. Для репозитория, где принципиально заявлено «три проекта независимы и не должны заимствовать друг у друга», это осознанный компромисс, а не забытая оптимизация.</p></div>

<h2>Условия</h2>
<p>Атрибут <code>Condition</code> вешается почти на что угодно. Кавычки вокруг обеих частей сравнения обязательны — иначе пустое значение сломает выражение:</p>
<pre><code>&lt;PropertyGroup Condition=<span class="s">"'$(Configuration)' == 'Release'"</span>&gt;
  &lt;TreatWarningsAsErrors&gt;true&lt;/TreatWarningsAsErrors&gt;
&lt;/PropertyGroup&gt;

&lt;ItemGroup Condition=<span class="s">"'$(OS)' == 'Windows_NT'"</span>&gt;
  &lt;PackageReference Include=<span class="s">"SomeWindowsOnlyThing"</span> Version=<span class="s">"1.0.0"</span> /&gt;
&lt;/ItemGroup&gt;</code></pre>
`,
quiz:[
 {q:"В окружении задано <code>Configuration=Release</code>, а в csproj явно написано <code>&lt;Configuration&gt;Debug&lt;/Configuration&gt;</code>. Что получится?",
  opts:["Release — окружение сильнее","Debug — явное присваивание в проекте перекрывает окружение","Ошибка о конфликте","Зависит от версии MSBuild"],
  a:1, why:"Переменная окружения задаёт лишь начальное значение свойства. Любое явное присваивание в проекте её перекрывает. Гарантированно перебить можно только из командной строки: <code>-p:Configuration=Release</code>."},
 {q:"Как узнать вычисленное значение свойства, не запуская сборку?",
  opts:["<code>dotnet build -v d</code> и искать глазами","<code>dotnet msbuild -getProperty:Имя</code>","Открыть obj/project.assets.json","Только через отладчик MSBuild"],
  a:1, why:"<code>-getProperty</code> печатает готовое значение и ничего не собирает. Для списков есть парный <code>-getItem</code>."},
 {q:"Куда импортируется <code>Directory.Build.props</code>?",
  opts:["В конец каждого проекта","В начало каждого проекта ниже по дереву каталогов","Только в проект, лежащий рядом с ним","Никуда, его надо импортировать вручную"],
  a:1, why:"<code>.props</code> идёт в начало — поэтому проект может переопределить заданное в нём. Файл <code>Directory.Build.targets</code>, наоборот, импортируется в конец и перекрывает проект."},
 {q:"Что делает <code>-bl</code>?",
  opts:["Собирает без логов","Пишет двоичный лог всей сборки для последующего разбора","Включает параллельную сборку","Билдит только изменённое"],
  a:1, why:"Получается <code>msbuild.binlog</code> — полная запись сборки со всеми свойствами, элементами и таргетами. Незаменим, когда сборка ведёт себя необъяснимо."},
 {q:"Свойство присвоено дважды в разных PropertyGroup одного файла. Какое значение победит?",
  opts:["Первое","Последнее по порядку в файле","Возникнет ошибка","Значения объединятся"],
  a:1, why:"Свойства вычисляются последовательно сверху вниз, побеждает последнее присваивание. Элементы ведут себя иначе — они накапливаются в список."}
]
},

/* ----------------------------------------------------- 4 */
{
n:4, id:"sln", title:"Solution", sub:"Зачем нужен .sln и когда не нужен",
lede:"Файл решения — это список проектов и таблица соответствия конфигураций. На то, как собирается отдельный проект, он не влияет.",
body:`
<p>Решение группирует проекты. Оно нужно IDE (дерево, «собрать всё», «запустить все тесты») и удобно в CLI, когда одной командой надо обойти все проекты сразу. Собственной логики сборки в нём нет.</p>

<h2>Что внутри</h2>
<pre><code><span class="c">// WebAutomation.sln — реальный фрагмент</span>
Project(<span class="s">"{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}"</span>) = <span class="s">"Portal"</span>, <span class="s">"Portal\\Portal.csproj"</span>, <span class="s">"{B19B0122-…}"</span>
EndProject</code></pre>
<p>Здесь три идентификатора, и они разного назначения:</p>
<div class="tw"><table>
<tr><th>Что</th><th>Смысл</th></tr>
<tr><td><code>{FAE04EC0-…}</code></td><td>Тип проекта. Один и тот же для всех C#-проектов — это не уникальный идентификатор</td></tr>
<tr><td><code>"Portal\\Portal.csproj"</code></td><td>Путь. Разделитель <b>всегда</b> обратный слэш, даже на macOS и Linux</td></tr>
<tr><td><code>{B19B0122-…}</code></td><td>Идентификатор конкретного проекта внутри решения. На него ссылается таблица конфигураций</td></tr>
</table></div>

<h2>Таблица конфигураций и её сюрприз</h2>
<p>Дальше идёт сопоставление конфигураций решения конфигурациям проектов. В этом решении оно любопытное:</p>
<pre><code>{B19B0122-…}.Debug|x64.ActiveCfg = Debug|<span class="k">Any CPU</span>
{B19B0122-…}.Debug|x86.ActiveCfg = Debug|<span class="k">Any CPU</span>
{B19B0122-…}.Release|x64.ActiveCfg = Release|<span class="k">Any CPU</span></code></pre>
<p>Решение объявляет шесть конфигураций (Debug и Release × Any CPU, x64, x86), но <b>все платформы ведут в одну и ту же</b> <code>Any CPU</code>. Выбор x64 или x86 в IDE ничего не меняет — проекты платформо-независимы. Такие строки обычно порождает мастер создания решения, и они остаются навсегда.</p>

<h2>Команды</h2>
<pre><code>dotnet sln list                              <span class="c"># что входит в решение</span>
dotnet sln add Nuevo/Nuevo.csproj            <span class="c"># добавить</span>
dotnet sln remove HQ/HQ.csproj               <span class="c"># убрать (файлы не удаляются)</span>

dotnet build                                 <span class="c"># найдёт .sln в текущем каталоге</span>
dotnet build Portal/Portal.csproj            <span class="c"># только один проект</span>
dotnet test                                  <span class="c"># прогонит тесты всех проектов решения</span></code></pre>
<div class="note"><b class="h">Как dotnet выбирает, что собирать</b><p>Без аргумента команда ищет в текущем каталоге единственный <code>.sln</code> или единственный <code>.csproj</code>. Если их несколько — останавливается с ошибкой и просит указать явно. Отсюда привычка всегда писать путь к проекту: это снимает неоднозначность и экономит время, потому что не собирается лишнее.</p></div>

<h2>Формат .slnx</h2>
<p>Старый формат <code>.sln</code> — не XML и не JSON, он читается тяжело и конфликтует при слиянии веток. Начиная с .NET 9 SDK поддерживает <code>.slnx</code>: тот же смысл, но нормальный XML без GUID-ов.</p>
<pre><code>&lt;<span class="k">Solution</span>&gt;
  &lt;<span class="k">Project</span> Path=<span class="s">"Portal/Portal.csproj"</span> /&gt;
  &lt;<span class="k">Project</span> Path=<span class="s">"Vertex2025/Vertex2025.csproj"</span> /&gt;
  &lt;<span class="k">Project</span> Path=<span class="s">"HQ/HQ.csproj"</span> /&gt;
&lt;/<span class="k">Solution</span>&gt;</code></pre>
<p>Конвертация — одной командой <code>dotnet sln migrate</code>. Переходить стоит, только когда все участники и все агенты сборки перешли на SDK, который его понимает.</p>

<div class="note trap"><b class="h">Три проекта в решении, но общего кода нет</b><p>В этом репозитории между проектами нет ни одного <code>ProjectReference</code> — это заявленное архитектурное решение. Решение здесь выполняет ровно одну функцию: собрать и прогнать всё одной командой. Из этого следует и практическое правило: правку, сделанную в одном проекте, нельзя «перенести» в другой ссылкой — только копированием, осознанно.</p></div>
`,
quiz:[
 {q:"Влияет ли .sln на то, как собирается отдельный проект?",
  opts:["Да, задаёт общие настройки сборки","Нет — это список проектов и таблица конфигураций","Да, через него подключаются пакеты","Только для конфигурации Release"],
  a:1, why:"Логики сборки в решении нет. Общие настройки на дерево проектов задаются файлом <code>Directory.Build.props</code>, а не решением."},
 {q:"В решении объявлены Debug|x64 и Debug|x86, но обе ведут в <code>Debug|Any CPU</code>. Что это значит?",
  opts:["Ошибка конфигурации","Выбор платформы ни на что не влияет — проекты платформо-независимы","Проекты соберутся дважды","x86 будет игнорироваться при сборке"],
  a:1, why:"Это типовой артефакт мастера создания решения. Все платформы отображаются в единственную реальную конфигурацию <code>Any CPU</code>."},
 {q:"Вы выполнили <code>dotnet build</code> без аргументов в каталоге с двумя csproj и без .sln. Что произойдёт?",
  opts:["Соберутся оба","Соберётся первый по алфавиту","Ошибка: нужно указать проект явно","Будет создан .sln автоматически"],
  a:2, why:"Команда требует однозначности: ровно один <code>.sln</code> или ровно один <code>.csproj</code> в каталоге. Иначе она останавливается и просит указать цель."},
 {q:"Зачем нужен формат .slnx?",
  opts:["Он ускоряет сборку","Это читаемый XML вместо старого формата — меньше конфликтов при слиянии","Он позволяет собирать несколько TFM","Он заменяет Directory.Build.props"],
  a:1, why:"Смысл тот же, форма другая: нормальный XML без GUID-ов. Требует SDK 9 и новее у всех участников и на всех агентах."}
]
},
