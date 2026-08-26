<script>
"use strict";

/* ============================================================
   Разбираемые файлы. Все — реальные файлы Acme.WebAutomation,
   кроме помеченных как «пример».
   ============================================================ */
const FILES = {

"portal-csproj":{
 path:"Portal/Portal.csproj", lang:"xml", tag:"реальный файл",
 lines:[
  {c:'<Project Sdk="Microsoft.NET.Sdk">', k:"sdk"},
  {c:''},
  {c:'  <PropertyGroup>', k:"pg"},
  {c:'    <TargetFramework>net8.0</TargetFramework>', k:"tfm"},
  {c:'    <Nullable>enable</Nullable>', k:"nullable"},
  {c:'    <ImplicitUsings>enable</ImplicitUsings>', k:"usings"},
  {c:'    <RootNamespace>Acme.WebAutomation.Portal</RootNamespace>', k:"rootns"},
  {c:'  </PropertyGroup>'},
  {c:''},
  {c:'  <ItemGroup>', k:"ig"},
  {c:'    <PackageReference Include="Microsoft.Playwright.NUnit" Version="1.58.0" />', k:"pr"},
  {c:'    <PackageReference Include="NUnit" Version="3.14.0" />'},
  {c:'    <PackageReference Include="NUnit3TestAdapter" Version="4.5.0" />', k:"adapter"},
  {c:'    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />', k:"testsdk"},
  {c:'    <PackageReference Include="NunitXml.TestLogger" Version="8.0.0" />', k:"logger"},
  {c:'    <PackageReference Include="ReportPortal.NUnit" Version="4.9.0" />'},
  {c:'  </ItemGroup>'},
  {c:''},
  {c:'  <ItemGroup>'},
  {c:'    <None Update="ReportPortal.json">', k:"none"},
  {c:'      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>', k:"copy"},
  {c:'    </None>'},
  {c:'  </ItemGroup>'},
  {c:''},
  {c:'</Project>'}
 ],
 notes:{
  sdk:{h:'Атрибут Sdk — вся невидимая часть проекта',
    p:['Одна эта строка подключает <b>Microsoft.NET.Sdk</b>: сотни готовых свойств, элементов и таргетов. Именно она делает файл коротким — компиляция, сборка, упаковка, очистка уже описаны внутри SDK.',
       'Технически SDK вставляет два неявных импорта: <code>Sdk.props</code> в самое начало файла и <code>Sdk.targets</code> в самый конец. Всё, что вы пишете между ними, лишь <em>дополняет и переопределяет</em> умолчания.',
       'Другие значения: <code>Microsoft.NET.Sdk.Web</code> (ASP.NET Core), <code>Microsoft.NET.Sdk.Razor</code>, <code>Microsoft.NET.Sdk.Worker</code>. Для тестового проекта достаточно базового.']},
  pg:{h:'PropertyGroup — скалярные настройки',
    p:['Свойства это пары «имя — строковое значение». Обращение к ним в MSBuild: <code>$(TargetFramework)</code>.',
       'Групп может быть сколько угодно, и они могут нести условия: <code>&lt;PropertyGroup Condition="\x27$(Configuration)\x27==\x27Release\x27"&gt;</code>. Побеждает последнее присваивание по ходу файла — порядок имеет значение.']},
  tfm:{h:'TargetFramework — под какую версию платформы компилируем',
    p:['Это <b>не</b> версия установленного SDK. Проект нацелен на API-поверхность .NET 8, а собирать его может SDK и 8-й, и 10-й версии.',
       'На вашей машине стоит SDK 10.0.302, и <code>dotnet build</code> для этого проекта проходит успешно — проверено.',
       'Для нескольких целей сразу используется <code>&lt;TargetFrameworks&gt;</code> (во множественном числе) со списком через точку с запятой.']},
  nullable:{h:'Nullable — контекст ссылочных типов, допускающих null',
    p:['Со значением <code>enable</code> компилятор считает <code>string</code> недопускающим null, а <code>string?</code> — допускающим, и предупреждает о возможных разыменованиях null.',
       'Отсюда идиома, которая вам постоянно встречается в тестах: <code>private HomePage _homePage = null!;</code>. Оператор <code>!</code> — обещание компилятору «здесь null не будет», потому что поле на самом деле инициализируется в <code>[SetUp]</code>, о чём компилятор знать не может.',
       'Это диагностика времени компиляции. На поведение в рантайме она не влияет никак.']},
  usings:{h:'ImplicitUsings — неявные using-директивы',
    p:['SDK сам добавляет в каждый файл набор пространств имён: <code>System</code>, <code>System.Collections.Generic</code>, <code>System.Linq</code>, <code>System.Threading.Tasks</code> и ещё несколько.',
       'Поэтому в коде тестов нет <code>using System;</code>, а <code>Task</code> доступен без объявления. Список зависит от типа SDK.',
       'Реальный список лежит в сгенерированном файле <code>obj/Debug/net8.0/Portal.GlobalUsings.g.cs</code> — туда полезно заглянуть, если непонятно, откуда взялся тип.']},
  rootns:{h:'RootNamespace — база для пространств имён, а не имя сборки',
    p:['Влияет на то, какое пространство имён подставит IDE при создании файла. На имя выходной сборки не влияет — за него отвечает <code>AssemblyName</code>, а он по умолчанию равен имени файла проекта.',
       'Здесь: <code>RootNamespace</code> = <code>Acme.WebAutomation.Portal</code>, а сборка на выходе всё равно <code>Portal.dll</code> — это проверяется командой <code>dotnet msbuild -getProperty:AssemblyName</code>.']},
  ig:{h:'ItemGroup — списки',
    p:['Элементы это списки с метаданными. Обращение: <code>@(Compile)</code>, метаданные — <code>%(Filename)</code>.',
       'Самое важное для понимания: <b>файлы <code>.cs</code> здесь не перечислены</b>. SDK включает их сам по маске <code>**/*.cs</code>, исключая <code>bin/</code> и <code>obj/</code>. В проекте старого формата каждый файл пришлось бы прописывать вручную.',
       'Отключается это свойством <code>&lt;EnableDefaultCompileItems&gt;false&lt;/EnableDefaultCompileItems&gt;</code>. Отсюда же типичная ошибка «duplicate Compile item»: файл добавили вручную, а SDK уже включил его по маске.']},
  pr:{h:'PackageReference — зависимость от NuGet-пакета',
    p:['Перечисляются только <b>прямые</b> зависимости. Всё, что нужно им самим, подтягивается транзитивно.',
       'Здесь шесть прямых пакетов разворачиваются в 23 разрешённых — это измерено командой <code>dotnet list package --include-transitive</code> на этом проекте.',
       'Версия <code>1.58.0</code> означает «не ниже 1.58.0», а не «ровно». NuGet возьмёт минимальную подходящую, но если другой пакет потребует более высокую — поднимет её.']},
  adapter:{h:'Адаптер тестового движка',
    p:['<code>NUnit3TestAdapter</code> — переходник между VSTest (движком, который запускает <code>dotnet test</code>) и NUnit (фреймворком, на котором написаны тесты).',
       'Без адаптера тесты компилируются, но <b>не обнаруживаются</b>: <code>dotnet test</code> отработает и честно сообщит, что тестов нет.']},
  testsdk:{h:'Microsoft.NET.Test.Sdk — то, что делает проект тестовым',
    p:['Этот пакет выставляет свойство <code>IsTestProject=true</code> и приносит хост VSTest. Без него <code>dotnet test</code> для проекта бессмыслен.',
       'Он же генерирует точку входа, поэтому библиотека классов превращается в исполняемый тестовый хост.']},
  logger:{h:'Логгер результатов — и почему их здесь два',
    p:['TRX (формат VSTest) не переносит <code>[Property]</code> и <code>[Category]</code>. Интеграции с Xray нужны именно они, поэтому в Portal добавлен <code>NunitXml.TestLogger</code>, и пайплайн пишет результаты <b>дважды</b>: <code>--logger trx</code> для Azure DevOps и <code>--logger nunit</code> для выгрузки в Xray.',
       'В HQ и Vertex2025 этого пакета нет — им хватает TRX.']},
  none:{h:'None Update — правка существующего элемента',
    p:['Ключевое слово именно <code>Update</code>, а не <code>Include</code>. Файл уже включён в проект неявно (по маске SDK), и мы лишь <em>дописываем ему метаданные</em>.',
       'Написать <code>Include</code> здесь означало бы добавить второй такой же элемент — и получить ошибку о дубликате.']},
  copy:{h:'CopyToOutputDirectory — попасть в bin рядом со сборкой',
    p:['<code>PreserveNewest</code> копирует файл в выходной каталог, если он новее уже лежащего там. <code>Always</code> копирует всегда, <code>Never</code> — значение по умолчанию.',
       'Без этой строки <code>ReportPortal.json</code> остался бы только в исходниках, а библиотека ReportPortal ищет его рядом с исполняемой сборкой и молча работала бы с настройками по умолчанию.',
       'Проверено: после сборки файл действительно лежит в <code>Portal/bin/Debug/net8.0/ReportPortal.json</code>.']}
 }
},

"runsettings":{
 path:"playwright.runsettings", lang:"xml", tag:"реальный файл",
 lines:[
  {c:'<?xml version="1.0" encoding="utf-8"?>'},
  {c:'<RunSettings>', k:"root"},
  {c:'  <TestRunParameters>', k:"params"},
  {c:'    <Parameter name="browser" value="chromium" />'},
  {c:'    <Parameter name="headless" value="true" />', k:"dead"},
  {c:'  </TestRunParameters>'},
  {c:'  <NUnit>', k:"nunit"},
  {c:'    <NumberOfTestWorkers>4</NumberOfTestWorkers>', k:"workers"},
  {c:'  </NUnit>'},
  {c:'  <Playwright>', k:"pw"},
  {c:'    <BrowserName>chromium</BrowserName>'},
  {c:'  </Playwright>'},
  {c:'</RunSettings>'}
 ],
 notes:{
  root:{h:'runsettings — конфигурация тестового прогона',
    p:['Файл читает VSTest, а не ваш код. Подключается флагом <code>--settings</code>; без него берутся умолчания.',
       'Секции верхнего уровня адресованы разным потребителям: <code>RunConfiguration</code> — самому VSTest, именованные секции — конкретным адаптерам.']},
  params:{h:'TestRunParameters — параметры, доступные тесту',
    p:['Читаются из кода как <code>TestContext.Parameters["browser"]</code>.',
       '<b>В этом репозитории их не читает никто.</b> Поиск по исходникам не находит ни одного обращения к <code>TestContext.Parameters</code> — секция осталась от прежней конфигурации.']},
  dead:{h:'Мёртвый параметр',
    p:['Ни <code>headless</code> отсюда, ни свойство <code>TestConfig.Headless</code> в C# ничего не решают. Режим окна определяет переменная окружения <code>HEADED</code>, которую напрямую читает <code>Microsoft.Playwright.TestAdapter</code>.',
       'Это ровно та ловушка, ради которой стоит различать «параметр объявлен» и «параметр кем-то читается». Объявление само по себе ни на что не влияет.']},
  nunit:{h:'Секция адаптера',
    p:['Имя элемента должно совпадать с именем, которое зарегистрировал адаптер. <code>NUnit3TestAdapter</code> читает секцию <code>&lt;NUnit&gt;</code>, и она полностью его собственная — VSTest в неё не смотрит.']},
  workers:{h:'NumberOfTestWorkers — параллельность NUnit',
    p:['Четыре тестовых потока внутри одной сборки. Для UI-тестов это одновременно четыре браузера.',
       'Не путайте с параллельностью VSTest (<code>MaxCpuCount</code> в <code>RunConfiguration</code>) — та распараллеливает <em>сборки</em>, а не тесты внутри одной.',
       'NUnit при этом требует явного разрешения на параллельный запуск: без атрибута <code>[Parallelizable]</code> фикстуры выполняются последовательно, сколько воркеров ни задай.']},
  pw:{h:'Секция Playwright',
    p:['Её читает <code>Microsoft.Playwright.TestAdapter</code>. Переменная окружения <code>BROWSER</code> перекрывает то, что здесь написано, — поэтому в CI достаточно выставить переменную, не трогая файл.']}
 }
},

"pipeline":{
 path:"Portal/azure-portal-automation-build-pipeline.yml", lang:"yaml", tag:"реальный файл, фрагмент",
 lines:[
  {c:'- task: UseDotNet@2', k:"usedotnet"},
  {c:'  inputs:'},
  {c:'    packageType: sdk'},
  {c:'    version: 8.x'},
  {c:''},
  {c:'- task: NuGetCommand@2', k:"restore"},
  {c:'  inputs:'},
  {c:'    restoreSolution: "$(project)"'},
  {c:''},
  {c:'- script: |', k:"build"},
  {c:'    dotnet build "$(project)" --configuration Release'},
  {c:''},
  {c:'# ---- отдельная стадия: тесты на другом агенте ----'},
  {c:'- script: |', k:"pwinstall"},
  {c:'    pwsh .../bin/Release/net8.0/playwright.ps1 install --with-deps chromium'},
  {c:''},
  {c:'- script: |', k:"test"},
  {c:'    dotnet test "$(testDll)" \\', k:"testdll"},
  {c:'      --logger "trx;LogFileName=test-results.trx" \\'},
  {c:'      --logger "nunit;LogFilePath=$(...)/test-results.xml" \\', k:"twologgers"},
  {c:'      --results-directory "$(...)/TestResults" \\'},
  {c:'      --settings ".../playwright.runsettings"'},
  {c:'  continueOnError: true', k:"continue"},
  {c:'  env:', k:"env"},
  {c:'    BASIC_AUTH_USERNAME: $(BASIC_AUTH_USERNAME)'},
  {c:'    BASIC_AUTH_PASSWORD: $(BASIC_AUTH_PASSWORD)'},
  {c:''},
  {c:'- task: PublishTestResults@2', k:"publish"},
  {c:'  inputs:'},
  {c:'    testResultsFormat: VSTest'},
  {c:'    failTaskOnFailedTests: false', k:"failfalse"}
 ],
 notes:{
  usedotnet:{h:'Установка SDK на агенте',
    p:['<code>8.x</code> — «любая последняя версия ветки 8». На чистом агенте .NET нужного поколения может не оказаться вовсе, поэтому шаг обязателен.',
       'Если бы в репозитории лежал <code>global.json</code>, версия бралась бы из него, и этот шаг пришлось бы согласовывать с файлом.']},
  restore:{h:'Отдельный restore',
    p:['<code>dotnet build</code> и так делает restore неявно. Отдельный шаг нужен, чтобы <em>видеть</em> в логе, что упало именно скачивание пакетов, а не компиляция, и чтобы кэшировать этот шаг.',
       'В локальной работе он избыточен — вы просто пишете <code>dotnet build</code>.']},
  build:{h:'Сборка в конфигурации Release',
    p:['Локально по умолчанию собирается <code>Debug</code>. В CI явно указан <code>Release</code>: включены оптимизации, другой выходной каталог <code>bin/Release/net8.0/</code>.',
       'Отсюда важное следствие для следующей стадии: путь к сборке содержит <code>Release</code>, и перепутать его с <code>Debug</code> — типовая причина «а почему тестов не найдено».']},
  pwinstall:{h:'Установка браузеров',
    p:['<code>playwright.ps1</code> — скрипт, который сам появляется в выходном каталоге: его кладёт туда пакет <code>Microsoft.Playwright</code>. Это хороший пример того, что в <code>bin/</code> попадают не только сборки.',
       '<code>--with-deps</code> доставляет ещё и системные библиотеки, нужные браузеру на голом Linux-агенте.']},
  test:{h:'Тесты запускаются на другой стадии и другом агенте',
    p:['Сборка идёт на <code>ubuntu-22.04</code> из облака, тесты — на приватном пуле <code>we-aks-preprod-agent</code>, у которого есть доступ к внутренним UAT-адресам.',
       'Поэтому результат сборки передаётся между стадиями артефактом, а не остаётся на диске.']},
  testdll:{h:'dotnet test по .dll, а не по .csproj',
    p:['Это ключевое отличие CI от локального запуска. Когда аргумент — собранная сборка, шаги restore и build <b>не выполняются вовсе</b>: используется то, что приехало артефактом.',
       'Локально вы обычно передаёте <code>.csproj</code>, и тогда <code>dotnet test</code> сам сделает restore и build. Тот же эффект без артефактов даёт флаг <code>--no-build</code>.']},
  twologgers:{h:'Два логгера одновременно',
    p:['<code>--logger</code> можно указывать сколько угодно раз. TRX уходит в Azure DevOps, NUnit XML — в скрипт выгрузки Xray, которому нужны <code>[Property]</code> и <code>[Category]</code>, отсутствующие в TRX.']},
  continue:{h:'continueOnError — падение тестов не рушит пайплайн',
    p:['Шаг помечается как частично успешный, а выполнение идёт дальше. Без этого шаги публикации результатов просто не запустились бы, и вы остались бы без отчёта именно тогда, когда он нужнее всего.']},
  env:{h:'Секреты приходят из переменных пайплайна',
    p:['<code>$(BASIC_AUTH_USERNAME)</code> — подстановка переменной Azure DevOps. Именно поэтому <code>TestConfig</code> в Portal читает окружение и падает, если переменной нет: конфигурация приходит снаружи, а не из файла в репозитории.']},
  publish:{h:'Публикация результатов',
    p:['<code>testResultsFormat: VSTest</code> — это про TRX. Файл NUnit XML в Azure DevOps не публикуется, он существует только ради Xray.']},
  failfalse:{h:'И ещё один предохранитель',
    p:['<code>failTaskOnFailedTests: false</code> означает, что даже красные тесты не сделают сборку красной. Осознанное решение для нестабильного UI-набора — но помнить о нём обязательно: зелёный пайплайн здесь <b>не</b> гарантирует зелёные тесты.']}
 }
}
};

/* ============================================================
   Разделы конспекта
   ============================================================ */
const SECTIONS = [

/* ----------------------------------------------------- 1 */
{
n:1, id:"sdk", title:"SDK, рантайм и TFM", sub:"Что установлено и подо что собирается",
lede:"Три разные версии, которые постоянно путают: версия SDK, версия рантайма и целевая платформа проекта. Разберём на вашей машине.",
body:`
<p>Слово «.NET» обозначает сразу несколько вещей, и пока они не разделены в голове, сообщения об ошибках выглядят загадочно. Разделять нужно три сущности.</p>

<div class="tw"><table>
<tr><th>Что</th><th>Зачем</th><th>Как узнать</th></tr>
<tr><td><b>SDK</b></td><td>Инструменты разработчика: компилятор, MSBuild, весь <code>dotnet</code> CLI. Нужен, чтобы <em>собирать</em></td><td><code>dotnet --list-sdks</code></td></tr>
<tr><td><b>Рантайм</b></td><td>То, на чём приложение <em>выполняется</em>. Входит в SDK, но ставится и отдельно</td><td><code>dotnet --list-runtimes</code></td></tr>
<tr><td><b>TFM</b><br><span style="color:var(--ink-3);font-size:12px">target framework moniker</span></td><td>Под какую версию API компилируется <em>проект</em>. Свойство в <code>.csproj</code></td><td><code>&lt;TargetFramework&gt;</code></td></tr>
</table></div>

<h2>Как это выглядит на вашей машине</h2>
<p>Вот что показывает система прямо сейчас — и это отличная иллюстрация того, что три версии независимы:</p>
<pre><code><span class="c">$ dotnet --version</span>
10.0.302

<span class="c">$ dotnet --list-runtimes</span>
Microsoft.AspNetCore.App 10.0.10
Microsoft.NETCore.App 8.0.29
Microsoft.NETCore.App 10.0.10

<span class="c">$ grep TargetFramework Portal/Portal.csproj</span>
&lt;TargetFramework&gt;net8.0&lt;/TargetFramework&gt;</code></pre>

<div class="note fact"><b class="h">Проверено</b><p>SDK десятой версии, проект нацелен на <code>net8.0</code> — и <code>dotnet build</code> проходит без единого предупреждения. Это нормальное, штатное положение вещей, а не недосмотр.</p></div>

<h2>Почему свежий SDK собирает проект под старую платформу</h2>
<p>SDK умеет собирать под <b>свою версию и любую более раннюю</b>. Ему нужен только <em>пакет таргетинга</em> — набор ссылочных сборок с описанием API нужной версии. Если такого пакета нет в комплекте, он приезжает из NuGet, как обычная зависимость.</p>
<p>Это видно вживую. Если собрать проект под <code>net7.0</code> и посмотреть подробный лог, в аргументах компилятора будут ссылки такого вида:</p>
<pre><code>/reference:~/.nuget/packages/microsoft.netcore.app.ref/<span class="s">7.0.20</span>/ref/net7.0/System.Runtime.dll</code></pre>
<p>Обратное неверно: собрать под платформу <em>новее</em> самого SDK невозможно, и ошибка об этом вполне прямая.</p>
<pre><code><span class="c">// в csproj поставили net12.0, SDK десятый:</span>
error <span class="k">NETSDK1045</span>: The current .NET SDK does not support targeting .NET 12.0.
Either target .NET 10.0 or lower, or use a version of the .NET SDK that supports .NET 12.0.</code></pre>

<div data-widget="tfm"></div>

<h2>Как читается TFM</h2>
<div class="tw"><table>
<tr><th>TFM</th><th>Значение</th></tr>
<tr><td><code>net8.0</code></td><td>Современный кросс-платформенный .NET, версия 8. Здесь и живёт репозиторий</td></tr>
<tr><td><code>net8.0-windows</code></td><td>То же плюс API, существующие только в Windows. Такой проект не соберётся на macOS-агенте</td></tr>
<tr><td><code>netstandard2.0</code></td><td>Общий знаменатель для библиотек, которым надо работать и на .NET Framework, и на современном .NET. Для приложений и тестов не нужен</td></tr>
<tr><td><code>net48</code></td><td>Старый .NET Framework, только Windows. Не путать с <code>net8.0</code>: цифры похожи, платформы разные</td></tr>
</table></div>
<div class="note warn"><b class="h">Ловушка чтения</b><p><code>net5.0</code> и выше — это современный .NET. <code>net47</code>, <code>net48</code> без точки — это .NET Framework. Точка в номере версии и есть признак: <code>net8.0</code> ≠ <code>net80</code>.</p></div>

<h2>global.json — когда версию SDK нужно зафиксировать</h2>
<p>По умолчанию <code>dotnet</code> берёт самый свежий установленный SDK. Файл <code>global.json</code> рядом с решением это меняет: команда идёт вверх по дереву каталогов, находит файл и подчиняется ему.</p>
<pre><code>{
  <span class="a">"sdk"</span>: {
    <span class="a">"version"</span>: <span class="s">"8.0.100"</span>,
    <span class="a">"rollForward"</span>: <span class="s">"latestMajor"</span>
  }
}</code></pre>
<div class="tw"><table>
<tr><th>rollForward</th><th>Поведение при отсутствии точной версии</th></tr>
<tr><td><code>latestMajor</code></td><td>Взять любую более новую. Самый мягкий вариант</td></tr>
<tr><td><code>latestMinor</code> / <code>latestFeature</code> / <code>latestPatch</code></td><td>Подниматься только в пределах указанного уровня</td></tr>
<tr><td><code>disable</code></td><td>Только точное совпадение. Ошибка, если версии нет</td></tr>
</table></div>
<p>Последний вариант ведёт себя жёстко — и сообщение при этом сбивает с толку сильнее, чем следовало бы:</p>
<pre><code><span class="c">// global.json требует SDK 6.0.400, rollForward: disable</span>
The command could not be loaded, possibly because:
  * You intended to execute a .NET application:
      The application 'build' does not exist or is not a managed .dll or .exe.
  * You intended to execute a .NET SDK command:
      <span class="k">A compatible .NET SDK was not found.</span></code></pre>
<p>Читается как «не нашлась команда <code>build</code>», а на самом деле не нашёлся SDK. Существенная строка — последняя.</p>
<div class="note"><b class="h">Нужен ли global.json этому репозиторию</b><p>Сейчас его нет, и это работает: любой SDK от 8-го и выше соберёт <code>net8.0</code>. Файл стоит завести, когда команда начнёт расходиться в поведении сборки между машинами или когда CI-агент однажды обновится до версии, которая что-то ломает. Добавляя его, не забудьте согласовать с шагом <code>UseDotNet@2</code> в пайплайне — иначе агент поставит одну версию, а <code>global.json</code> потребует другую.</p></div>
`,
quiz:[
 {q:"Проект указывает <code>net8.0</code>, на машине установлен только SDK 10. Что произойдёт при <code>dotnet build</code>?",
  opts:["Ошибка: нужна точно восьмая версия SDK","Соберётся: SDK умеет собирать под свою и более ранние версии","Проект автоматически переведётся на net10.0","Соберётся, но с предупреждением о несовместимости"],
  a:1, why:"SDK собирает под свою версию и любую более раннюю; недостающий пакет таргетинга скачивается из NuGet. Проверено на этом репозитории: SDK 10.0.302 собирает <code>net8.0</code> без предупреждений."},
 {q:"Что означает <code>&lt;TargetFramework&gt;</code> в csproj?",
  opts:["Версию SDK, которой надо собирать","Версию API платформы, под которую компилируется проект","Минимальную версию рантайма на машине разработчика","Версию C#"],
  a:1, why:"Это целевая поверхность API. Версия SDK, версия рантайма и версия языка C# задаются независимо — последняя свойством <code>LangVersion</code>."},
 {q:"Чем ошибка <code>NETSDK1045</code> отличается по причине от «A compatible .NET SDK was not found»?",
  opts:["Это одно и то же разными словами","Первая — TFM новее SDK; вторая — global.json требует версию SDK, которой нет","Первая про рантайм, вторая про пакеты","Обе означают отсутствие интернета"],
  a:1, why:"<code>NETSDK1045</code> возникает, когда проект целится в платформу новее самого SDK. Вторая появляется, когда <code>global.json</code> просит версию SDK, которой на машине нет, — особенно при <code>rollForward: disable</code>."},
 {q:"Где <code>dotnet</code> ищет <code>global.json</code>?",
  opts:["Только в домашнем каталоге","В текущем каталоге и выше по дереву до корня","В каталоге установки SDK","В переменной окружения DOTNET_ROOT"],
  a:1, why:"Поиск идёт от текущего каталога вверх. Поэтому файл, положенный в корень репозитория, действует на все проекты внутри него."},
 {q:"На агенте CI нет .NET вообще. Какой шаг обязателен перед сборкой?",
  opts:["Установить рантайм — SDK не нужен","Установить SDK, например задачей <code>UseDotNet@2</code>","Достаточно скопировать bin с локальной машины","Установить только MSBuild"],
  a:1, why:"Для сборки нужен именно SDK: он содержит компилятор и MSBuild. Одного рантайма хватает лишь для запуска уже собранного приложения."}
]
},

/* ----------------------------------------------------- 2 */
{
n:2, id:"csproj", title:"Анатомия .csproj", sub:"Свойства, элементы, неявные умолчания",
lede:"Файл проекта — это программа для MSBuild. Разберём построчно настоящий Portal.csproj и посмотрим, что происходит без единой строки в нём.",
body:`
<p>Современный файл проекта короткий, и это его главная особенность: почти всё поведение приходит из SDK, а в файле остаются только отличия от умолчаний. Ниже — настоящий файл из репозитория. <b>Строки с пунктирным подчёркиванием кликабельны.</b></p>

<div data-file="portal-csproj"></div>

<h2>Две вещи, которые нужно различать</h2>
<div class="tw"><table>
<tr><th></th><th>Свойство (property)</th><th>Элемент (item)</th></tr>
<tr><td>Что это</td><td>Одно строковое значение</td><td>Список значений с метаданными</td></tr>
<tr><td>Объявляется в</td><td><code>&lt;PropertyGroup&gt;</code></td><td><code>&lt;ItemGroup&gt;</code></td></tr>
<tr><td>Читается как</td><td><code>$(TargetFramework)</code></td><td><code>@(Compile)</code>, метаданные — <code>%(Filename)</code></td></tr>
<tr><td>Пример</td><td><code>&lt;Nullable&gt;enable&lt;/Nullable&gt;</code></td><td><code>&lt;PackageReference Include="NUnit" /&gt;</code></td></tr>
<tr><td>При повторе</td><td>Побеждает последнее присваивание</td><td>Добавляется в список — отсюда ошибки о дубликатах</td></tr>
</table></div>

<h2>Что происходит без единой строки</h2>
<p>SDK по умолчанию делает довольно много, и это стоит держать в голове:</p>
<ul>
<li>Включает <b>все</b> <code>*.cs</code> из каталога проекта и подкаталогов, кроме <code>bin/</code> и <code>obj/</code>. Новый файл в <code>Tests/</code> попадает в сборку сам, ничего прописывать не нужно.</li>
<li>Ставит <code>AssemblyName</code> и <code>RootNamespace</code> равными имени файла проекта. Здесь <code>RootNamespace</code> переопределён, а <code>AssemblyName</code> нет — поэтому на выходе <code>Portal.dll</code>.</li>
<li>Кладёт результат в <code>bin/$(Configuration)/$(TargetFramework)/</code>, промежуточные файлы — в <code>obj/</code>.</li>
<li>Генерирует атрибуты сборки (версия, конфигурация) в файл в <code>obj/</code>. Отсюда классическая ошибка о дубликате <code>AssemblyVersion</code>, если такой атрибут написать ещё и руками.</li>
</ul>

<div class="note trap"><b class="h">Duplicate Compile item</b><p>Самая частая ошибка при переносе старого проекта: файлы перечислили вручную, а SDK уже включил их по маске. Каждый файл оказывается в списке дважды. Лечится либо удалением ручных <code>&lt;Compile Include&gt;</code>, либо <code>&lt;EnableDefaultCompileItems&gt;false&lt;/EnableDefaultCompileItems&gt;</code>.</p></div>

<h2>Include, Update, Remove</h2>
<p>Три глагола, которые постоянно путают, — а разница принципиальная:</p>
<div class="tw"><table>
<tr><th>Атрибут</th><th>Что делает</th><th>Когда нужен</th></tr>
<tr><td><code>Include</code></td><td>Добавляет новый элемент в список</td><td>Файла ещё нет в проекте</td></tr>
<tr><td><code>Update</code></td><td>Меняет метаданные уже существующего элемента</td><td>Файл уже включён неявно — как <code>ReportPortal.json</code> выше</td></tr>
<tr><td><code>Remove</code></td><td>Убирает элемент из списка</td><td>Исключить каталог из компиляции</td></tr>
</table></div>

<h2>Три проекта репозитория рядом</h2>
<p>Полезное упражнение: файлы почти одинаковы, и различия ровно там, где проекты разошлись функционально.</p>
<div class="tw"><table>
<tr><th></th><th>HQ</th><th>Vertex2025</th><th>Portal</th></tr>
<tr><td>TargetFramework</td><td colspan="3" style="text-align:center">net8.0 — везде одинаково</td></tr>
<tr><td>Nullable / ImplicitUsings</td><td colspan="3" style="text-align:center">enable — везде одинаково</td></tr>
<tr><td>RootNamespace</td><td><code>…HQ</code></td><td><code>…Vertex2025</code></td><td><code>…Portal</code></td></tr>
<tr><td>Playwright.TestAdapter явно</td><td>—</td><td><b>да</b></td><td>—</td></tr>
<tr><td>NunitXml.TestLogger</td><td>—</td><td>—</td><td><b>да</b></td></tr>
<tr><td>Прямых пакетов</td><td>5</td><td>6</td><td>6</td></tr>
</table></div>
<div class="note"><b class="h">Почему Vertex2025 указывает TestAdapter явно</b><p>Пакет <code>Microsoft.Playwright.TestAdapter</code> и так приходит транзитивно через <code>Microsoft.Playwright.NUnit</code> — это видно в <code>dotnet list package --include-transitive</code> для всех трёх проектов. Явная строка ничего не добавляет функционально, она лишь фиксирует версию и объявляет намерение. Различие косметическое, но знать о нём стоит, чтобы не искать в нём глубокого смысла.</p></div>

<h2>Свойства, которые чаще всего добавляют</h2>
<div class="tw"><table>
<tr><th>Свойство</th><th>Смысл</th></tr>
<tr><td><code>LangVersion</code></td><td>Версия языка C# отдельно от TFM</td></tr>
<tr><td><code>TreatWarningsAsErrors</code></td><td>Предупреждения ломают сборку. Резкая, но полезная настройка для CI</td></tr>
<tr><td><code>NoWarn</code></td><td>Список кодов предупреждений, которые надо погасить</td></tr>
<tr><td><code>GenerateDocumentationFile</code></td><td>XML-документация рядом со сборкой</td></tr>
<tr><td><code>IsPackable</code></td><td><code>false</code> для тестовых проектов, чтобы <code>dotnet pack</code> их не трогал</td></tr>
<tr><td><code>OutputPath</code></td><td>Свой каталог сборки вместо <code>bin/</code></td></tr>
<tr><td><code>InvariantGlobalization</code></td><td>Отключает ICU. Иногда чинит поведение на голых Linux-образах</td></tr>
</table></div>
`,
quiz:[
 {q:"В <code>Tests/</code> добавили новый файл <code>NewFeatureTests.cs</code>. Что нужно дописать в csproj?",
  opts:["<code>&lt;Compile Include=&quot;Tests/NewFeatureTests.cs&quot; /&gt;</code>","Ничего — SDK включает все .cs по маске","Добавить файл в ItemGroup с None","Перегенерировать csproj"],
  a:1, why:"SDK-проекты включают <code>**/*.cs</code> автоматически, исключая bin и obj. Ручное добавление приведёт к ошибке о дубликате элемента."},
 {q:"Зачем у <code>ReportPortal.json</code> написано <code>Update</code>, а не <code>Include</code>?",
  opts:["Это синонимы","Файл уже включён неявно, и мы лишь добавляем ему метаданные","Update работает быстрее","Include годится только для .cs"],
  a:1, why:"<code>Include</code> добавил бы второй такой же элемент и вызвал ошибку дубликата. <code>Update</code> правит метаданные уже существующего."},
 {q:"Что произойдёт, если убрать строку <code>CopyToOutputDirectory</code>?",
  opts:["Сборка упадёт","Файл не попадёт в bin, и ReportPortal будет работать с настройками по умолчанию","Файл всё равно скопируется — это поведение по умолчанию","Изменится только время сборки"],
  a:1, why:"Умолчание — <code>Never</code>. Библиотека ищет конфигурацию рядом с исполняемой сборкой, не найдёт её и молча возьмёт значения по умолчанию — без единой ошибки."},
 {q:"Чем <code>RootNamespace</code> отличается от <code>AssemblyName</code>?",
  opts:["Ничем, это синонимы","RootNamespace — база для пространств имён, AssemblyName — имя выходного файла","RootNamespace задаёт имя dll","AssemblyName влияет на using-директивы"],
  a:1, why:"В этом проекте <code>RootNamespace</code> = <code>Acme.WebAutomation.Portal</code>, а сборка всё равно <code>Portal.dll</code>, потому что <code>AssemblyName</code> по умолчанию равен имени csproj."},
 {q:"Что означает <code>Version=&quot;1.58.0&quot;</code> в PackageReference?",
  opts:["Ровно эта версия, иначе ошибка","Не ниже 1.58.0; при конфликте требований версия может подняться","Максимально допустимая версия","Версия игнорируется, всегда берётся последняя"],
  a:1, why:"Это нижняя граница. NuGet берёт минимальную подходящую версию, но поднимает её, если другой пакет в графе требует больше. Точное закрепление — <code>[1.58.0]</code> в квадратных скобках."},
 {q:"Почему в коде тестов нет <code>using System.Threading.Tasks;</code>, но <code>Task</code> доступен?",
  opts:["NUnit добавляет его сам","Включено <code>ImplicitUsings</code> — SDK добавляет набор пространств имён неявно","Task входит в глобальную область без using","Его добавляет Playwright"],
  a:1, why:"<code>ImplicitUsings=enable</code> генерирует файл <code>obj/…/GlobalUsings.g.cs</code> с набором global using. Его можно открыть и посмотреть точный список."}
]
},
