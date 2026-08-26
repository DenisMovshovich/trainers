/* ============================================================
   Обзорные схемы
   ============================================================ */
const VIEWS = {};

VIEWS.map = {t:"Карта проекта", html:()=>`
<h1>Карта проекта</h1>
<p class="prose">Проект Portal — это одна сборка <code>Portal.dll</code>, внутри которой три слоя. Стрелки показывают, кто кого вызывает: сверху вниз, и никогда наоборот.</p>
<figure class="fig">
<svg viewBox="0 0 620 320" role="img" aria-label="Слои проекта Portal">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="10" width="620" height="66" rx="3" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="12" y="28" font-weight="600" fill="var(--ink)">Tests/ — 30 файлов, 32 фикстуры, 230 методов [Test]</text>
  <text x="12" y="44" font-size="9" fill="var(--ink2)">что проверяем. Знают сценарий и ожидаемый результат, не знают селекторов</text>
  <text x="12" y="60" font-size="9" fill="var(--ink3)">BaseTest · ContactForm/ (23) · CommonElements/ (3) · Explore/ (2) · HomePage/ · GeneralPages/</text>

  <path d="M150 78v26" stroke="var(--moss)" stroke-width="1.3"/><path d="M150 104l-4-7h8z" fill="var(--moss)"/>
  <text x="160" y="96" font-size="9" fill="var(--moss)">вызывает методы и читает локаторы</text>

  <rect x="0" y="106" width="620" height="74" rx="3" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="12" y="124" font-weight="600" fill="var(--ink)">Pages/ — 11 файлов</text>
  <text x="12" y="140" font-size="9" fill="var(--ink2)">как устроен сайт. Знают селекторы и шаги, не знают, что считается успехом</text>
  <rect x="12" y="148" width="290" height="24" rx="2" fill="var(--surf)" stroke="var(--moss-l)"/>
  <text x="22" y="164" font-size="9" fill="var(--ink)">BasePage → HomePage · ContactFormPage · ExplorePage</text>
  <text x="22" y="164" font-size="9" fill="transparent">.</text>
  <rect x="312" y="148" width="296" height="24" rx="2" fill="var(--surf)" stroke="var(--line)"/>
  <text x="322" y="164" font-size="9" fill="var(--ink)">CommonElements/ — Header · NavBar · Footer</text>

  <path d="M150 182v26" stroke="var(--moss)" stroke-width="1.3"/><path d="M150 208l-4-7h8z" fill="var(--moss)"/>
  <path d="M430 182v26" stroke="var(--moss)" stroke-width="1.3"/><path d="M430 208l-4-7h8z" fill="var(--moss)"/>

  <rect x="0" y="210" width="300" height="58" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="12" y="228" font-weight="600" fill="var(--ink)">Config/TestConfig.cs</text>
  <text x="12" y="244" font-size="9" fill="var(--ink2)">адрес стенда и учётные данные</text>
  <text x="12" y="258" font-size="9" fill="var(--ink3)">читает переменные окружения</text>

  <rect x="320" y="210" width="300" height="58" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="332" y="228" font-weight="600" fill="var(--ink)">Utils/PageQualityChecks.cs</text>
  <text x="332" y="244" font-size="9" fill="var(--ink2)">общая проверка «страница отрисовалась»</text>
  <text x="332" y="258" font-size="9" fill="var(--ink3)">шапка, подвал, h1, нет ошибок JS</text>

  <text x="0" y="292" font-size="9.5" fill="var(--ink3)">Слой ниже никогда не обращается к слою выше: страница не знает о тестах, конфигурация не знает о страницах.</text>
  <text x="0" y="308" font-size="9.5" fill="var(--ink3)">Нарушение этого правила — первый признак, что абстракция поехала.</text>
 </g>
</svg>
<figcaption>Три слоя и два вспомогательных модуля. Всё лежит в одной сборке, поэтому internal-члены компонентов видны тестам.</figcaption>
</figure>

<h2>Что где искать</h2>
<div class="tw"><table>
<tr><th>Вопрос</th><th>Где ответ</th></tr>
<tr><td>Какой стенд и под каким пользователем</td><td><code>Config/TestConfig.cs</code></td></tr>
<tr><td>Какие настройки браузера у всех тестов</td><td><code>Tests/BaseTest.cs</code></td></tr>
<tr><td>Как найти элемент на странице</td><td>соответствующий файл в <code>Pages/</code></td></tr>
<tr><td>Что именно проверяется</td><td>файл в <code>Tests/</code>, атрибут <code>[Description]</code> у теста</td></tr>
<tr><td>Почему здесь пауза или повтор</td><td>комментарий над методом — в этом проекте они с датами и причинами</td></tr>
<tr><td>Особенности сайта и домена</td><td><code>CLAUDE.md</code></td></tr>
</table></div>`};

VIEWS.inherit = {t:"Наследование", html:()=>{
  const fixtures = Object.values(MODEL).filter(v=>(v.cl||[]).some(c=>c.base==="BaseTest"));
  const pages = Object.values(MODEL).filter(v=>(v.cl||[]).some(c=>c.base==="BasePage"));
  return `
<h1>Наследование и композиция</h1>
<p class="prose">В проекте два дерева наследования и один приём композиции. Путать их не стоит: наследование отвечает на вопрос «чем этот класс <b>является</b>», композиция — «из чего он <b>состоит</b>».</p>

<h2>Дерево тестов</h2>
<figure class="fig">
<svg viewBox="0 0 620 214" role="img" aria-label="Дерево наследования тестовых классов">
 <g font-family="var(--fm)" font-size="10">
  <rect x="150" y="8" width="320" height="44" rx="3" fill="var(--surf3)" stroke="var(--line)" stroke-dasharray="4 3"/>
  <text x="310" y="26" text-anchor="middle" font-weight="600" fill="var(--ink)">PageTest</text>
  <text x="310" y="42" text-anchor="middle" font-size="9" fill="var(--ink3)">из пакета Microsoft.Playwright.NUnit — не наш код</text>

  <path d="M310 54v20" stroke="var(--moss)" stroke-width="1.3"/><path d="M310 74l-4-7h8z" fill="var(--moss)"/>
  <text x="320" y="69" font-size="9" fill="var(--moss)">даёт Page, Context, Expect()</text>

  <rect x="150" y="76" width="320" height="44" rx="3" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="310" y="94" text-anchor="middle" font-weight="600" fill="var(--ink)">BaseTest</text>
  <text x="310" y="110" text-anchor="middle" font-size="9" fill="var(--ink2)">переопределяет ContextOptions(): адрес, 1920×1080, Basic Auth</text>

  <path d="M310 122v18" stroke="var(--moss)" stroke-width="1.3"/><path d="M60 140h500" stroke="var(--moss)" stroke-width="1.3"/>
  <path d="M60 140v14M180 140v14M310 140v14M440 140v14M560 140v14" stroke="var(--moss)" stroke-width="1.3"/>

  <rect x="6" y="156" width="108" height="34" rx="2" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="60" y="170" text-anchor="middle" font-size="9" fill="var(--ink)">ContactForm/</text>
  <text x="60" y="183" text-anchor="middle" font-size="9" fill="var(--ink3)">23 фикстуры</text>
  <rect x="126" y="156" width="108" height="34" rx="2" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="180" y="170" text-anchor="middle" font-size="9" fill="var(--ink)">CommonElements/</text>
  <text x="180" y="183" text-anchor="middle" font-size="9" fill="var(--ink3)">3 фикстуры</text>
  <rect x="256" y="156" width="108" height="34" rx="2" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="310" y="170" text-anchor="middle" font-size="9" fill="var(--ink)">Explore/</text>
  <text x="310" y="183" text-anchor="middle" font-size="9" fill="var(--ink3)">2 фикстуры</text>
  <rect x="386" y="156" width="108" height="34" rx="2" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="440" y="170" text-anchor="middle" font-size="9" fill="var(--ink)">HomePage/</text>
  <text x="440" y="183" text-anchor="middle" font-size="9" fill="var(--ink3)">1 фикстура</text>
  <rect x="506" y="156" width="108" height="34" rx="2" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="560" y="170" text-anchor="middle" font-size="9" fill="var(--ink)">GeneralPages/</text>
  <text x="560" y="183" text-anchor="middle" font-size="9" fill="var(--ink3)">1 фикстура</text>
  <text x="0" y="208" font-size="9" fill="var(--ink3)">Всего ${fixtures.length} классов наследуют BaseTest. Ни один не наследует другую фикстуру — дерево ровно в два уровня.</text>
 </g>
</svg>
<figcaption>Плоское дерево: два уровня и никакой иерархии между фикстурами. Общий код между тестами переиспользуется приватными методами внутри фикстуры, а не наследованием.</figcaption>
</figure>

<h2>Дерево страниц</h2>
<figure class="fig">
<svg viewBox="0 0 620 210" role="img" aria-label="Дерево наследования страниц и композиция компонентов">
 <g font-family="var(--fm)" font-size="10">
  <rect x="180" y="8" width="260" height="52" rx="3" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="310" y="26" text-anchor="middle" font-weight="600" fill="var(--ink)">BasePage</text>
  <text x="310" y="41" text-anchor="middle" font-size="9" fill="var(--ink2)">protected Page, BaseUrl</text>
  <text x="310" y="54" text-anchor="middle" font-size="9" fill="var(--ink2)">public Header, NavBar, Footer</text>

  <path d="M310 62v16" stroke="var(--moss)" stroke-width="1.3"/><path d="M52 78h516" stroke="var(--moss)" stroke-width="1.3"/>
  <path d="M52 78v12M155 78v12M258 78v12M362 78v12M465 78v12M568 78v12" stroke="var(--moss)" stroke-width="1.3"/>
  ${["HomePage","ContactFormPage","ExplorePage","LocationPage","ProductPage","SolutionsPage"].map((n,i)=>{
    const x = 2 + i*103;
    return `<rect x="${x}" y="92" width="98" height="30" rx="2" fill="var(--surf)" stroke="var(--moss-l)"/>
            <text x="${x+49}" y="111" text-anchor="middle" font-size="8.5" fill="var(--ink)">${n}</text>`;
  }).join("")}

  <text x="0" y="146" font-size="9.5" font-weight="600" fill="var(--ink3)">КОМПОЗИЦИЯ, А НЕ НАСЛЕДОВАНИЕ</text>
  <rect x="0" y="154" width="180" height="30" rx="2" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="90" y="173" text-anchor="middle" font-size="9" fill="var(--ink)">HeaderElements</text>
  <rect x="196" y="154" width="180" height="30" rx="2" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="286" y="173" text-anchor="middle" font-size="9" fill="var(--ink)">NavBarElements</text>
  <rect x="392" y="154" width="180" height="30" rx="2" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="482" y="173" text-anchor="middle" font-size="9" fill="var(--ink)">FooterElements</text>
  <text x="0" y="200" font-size="9" fill="var(--ink3)">Ничего не наследуют. Создаются в конструкторе BasePage и доступны как _page.Header.Logo</text>
 </g>
</svg>
<figcaption>Шесть страниц наследуют BasePage. Три компонента общих элементов не наследуют ничего — они вкладываются внутрь.</figcaption>
</figure>

<div class="note"><b class="h">Почему компоненты не сделали базовыми классами</b><p>Шапка есть на каждой странице, но страница <b>не является</b> шапкой — она её <b>содержит</b>. Наследование здесь дало бы бессмыслицу вроде «HomePage — это разновидность HeaderElements». Правило простое: «является» — наследование, «содержит» — поле или свойство.</p></div>

<h2>Что именно наследуется</h2>
<div class="tw"><table>
<tr><th>Откуда</th><th>Что достаётся наследнику</th></tr>
<tr><td><code>PageTest</code></td><td><code>Page</code>, <code>Context</code>, <code>Browser</code>, метод <code>Expect()</code>, создание нового контекста на каждый тест</td></tr>
<tr><td><code>BaseTest</code></td><td>всё вышеперечисленное плюс настроенный <code>ContextOptions()</code> — адрес, размер окна, Basic Auth</td></tr>
<tr><td><code>BasePage</code></td><td><code>Page</code> и <code>BaseUrl</code> (защищённые), готовые <code>Header</code>, <code>NavBar</code>, <code>Footer</code></td></tr>
</table></div>
<div class="note warn"><b class="h">Два разных <code>Page</code></b><p>В тесте <code>Page</code> — это свойство, унаследованное от <code>PageTest</code>. В странице <code>Page</code> — защищённое поле <code>BasePage</code>, куда тот же объект попал через конструктор. Имя одно, происхождение разное; путаницы не возникает только потому, что тест не видит поле страницы.</p></div>`;
}};

VIEWS.scope = {t:"Области видимости", html:()=>`
<h1>Области видимости</h1>
<p class="prose">Модификатор доступа отвечает на вопрос «кто имеет право это увидеть». В проекте они расставлены не случайно — на них держится всё разделение обязанностей между тестом и страницей.</p>

<figure class="fig">
<svg viewBox="0 0 620 246" role="img" aria-label="Области видимости в проекте">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="8" width="620" height="200" rx="3" fill="none" stroke="var(--line)" stroke-dasharray="4 3"/>
  <text x="10" y="24" font-size="9" fill="var(--ink3)">СБОРКА Portal.dll — граница для internal</text>

  <rect x="16" y="34" width="288" height="160" rx="3" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="28" y="52" font-weight="600" fill="var(--ink)">Pages/ — класс ContactFormPage</text>
  <rect x="28" y="62" width="264" height="30" rx="2" fill="var(--red-s)" stroke="var(--red)"/>
  <text x="38" y="81" font-size="9" fill="var(--ink)">private ILocator EmailField → селектор</text>
  <rect x="28" y="98" width="264" height="30" rx="2" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="38" y="117" font-size="9" fill="var(--ink)">public FillEmailFieldAsync() → действие</text>
  <rect x="28" y="134" width="264" height="30" rx="2" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="38" y="153" font-size="9" fill="var(--ink)">public EmailFieldLocator → для Expect()</text>
  <text x="28" y="182" font-size="8.5" fill="var(--ink3)">наружу выходит намерение, внутри остаётся механика</text>

  <rect x="320" y="34" width="284" height="160" rx="3" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="332" y="52" font-weight="600" fill="var(--ink)">Tests/ — фикстура</text>
  <text x="332" y="74" font-size="9" fill="var(--ink2)">видит: public-члены страниц</text>
  <text x="332" y="90" font-size="9" fill="var(--ink2)">видит: internal-члены компонентов —</text>
  <text x="332" y="104" font-size="9" fill="var(--ink2)">только потому, что сборка одна</text>
  <text x="332" y="126" font-size="9" fill="var(--red)">не видит: private-локаторы страниц</text>
  <text x="332" y="142" font-size="9" fill="var(--plum)">не видит: protected Page у BasePage</text>
  <text x="332" y="168" font-size="8.5" fill="var(--ink3)">тест физически не может обратиться</text>
  <text x="332" y="181" font-size="8.5" fill="var(--ink3)">к селектору — только к имени</text>

  <path d="M306 114h10" stroke="var(--moss)" stroke-width="1.2"/><path d="M316 114l-7-4v8z" fill="var(--moss)"/>
  <text x="0" y="222" font-size="9" fill="var(--ink3)">Уберите private у локаторов — и через полгода селекторы окажутся скопированы по тестам,</text>
  <text x="0" y="238" font-size="9" fill="var(--ink3)">а правка вёрстки превратится в правку двадцати файлов вместо одной.</text>
 </g>
</svg>
<figcaption>Граница между «что проверяем» и «как найти» проходит по модификаторам доступа, а не по договорённости.</figcaption>
</figure>

<h2>Пять модификаторов в этом проекте</h2>
<div class="tw"><table>
<tr><th>Модификатор</th><th>Кто видит</th><th>Где в проекте</th></tr>
<tr><td><span class="mod public">public</span></td><td>кто угодно, включая другие сборки</td><td>методы-действия и локаторы-обёртки страниц, тестовые методы</td></tr>
<tr><td><span class="mod private">private</span></td><td>только сам класс</td><td>все селекторы в page object, вспомогательные методы фикстур, поля <code>_contactFormPage</code></td></tr>
<tr><td><span class="mod internal">internal</span></td><td>только сборка <code>Portal.dll</code></td><td>все члены <code>HeaderElements</code>, <code>NavBarElements</code>, <code>FooterElements</code>, класс <code>PageQualityChecks</code></td></tr>
<tr><td><span class="mod protected">protected</span></td><td>класс и его наследники</td><td>ровно два члена: <code>BasePage.Page</code> и <code>BasePage.BaseUrl</code></td></tr>
<tr><td><span class="mod other">static</span></td><td>—</td><td>принадлежит типу: <code>TestConfig</code>, <code>PageQualityChecks</code>, <code>LocationPage.HashParameter</code></td></tr>
</table></div>

<div class="note trap"><b class="h">Хрупкое место проекта</b><p>Классы компонентов объявлены <code>public</code>, а их конструкторы и все локаторы — <code>internal</code>. Это компилируется <b>только</b> пока тесты лежат в одной сборке со страницами. Попытка вынести <code>Pages/</code> в отдельную библиотеку — а это первое, что делают при появлении второго тестового проекта, — сломает сборку в десятках мест. Проверить легко: класс <code>public</code>, а создать его снаружи нельзя, потому что конструктор <code>internal</code>.</p></div>

<div class="note"><b class="h">Почему у фикстуры поля private, а тесты public</b><p>NUnit находит тесты через отражение и требует, чтобы метод был <code>public</code>. Поля же нужны только самой фикстуре, поэтому они закрыты. Отсюда и характерный вид класса: <code>private</code> поле страницы, <code>private const</code> таймаут, <code>public</code> методы с <code>[Test]</code>.</p></div>`};

VIEWS.po = {t:"Page Object", html:()=>`
<h1>Page Object</h1>
<p class="prose">Шаблон, на котором держится весь проект. Идея одна: <b>тест описывает намерение, страница описывает механику</b>. Тест говорит «заполни поле почты», страница знает, что это <code>#email</code>.</p>

<h2>Путь одного действия</h2>
<figure class="fig">
<svg viewBox="0 0 620 168" role="img" aria-label="Как вызов из теста доходит до браузера">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="14" width="146" height="52" rx="3" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="73" y="34" text-anchor="middle" font-size="9" fill="var(--ink)">тест</text>
  <text x="73" y="50" text-anchor="middle" font-size="8.5" fill="var(--ink2)">FillEmailFieldAsync(…)</text>

  <path d="M150 40h28" stroke="var(--moss)" stroke-width="1.2"/><path d="M178 40l-7-4v8z" fill="var(--moss)"/>

  <rect x="182" y="14" width="146" height="52" rx="3" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="255" y="34" text-anchor="middle" font-size="9" fill="var(--ink)">page object</text>
  <text x="255" y="50" text-anchor="middle" font-size="8.5" fill="var(--ink2)">EmailField.FillAsync(…)</text>

  <path d="M332 40h28" stroke="var(--moss)" stroke-width="1.2"/><path d="M360 40l-7-4v8z" fill="var(--moss)"/>

  <rect x="364" y="14" width="120" height="52" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="424" y="34" text-anchor="middle" font-size="9" fill="var(--ink)">локатор</text>
  <text x="424" y="50" text-anchor="middle" font-size="8.5" fill="var(--ink2)">#email</text>

  <path d="M488 40h28" stroke="var(--moss)" stroke-width="1.2"/><path d="M516 40l-7-4v8z" fill="var(--moss)"/>
  <rect x="520" y="14" width="100" height="52" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="570" y="40" text-anchor="middle" font-size="9" fill="var(--ink)">браузер</text>

  <text x="0" y="94" font-size="9.5" font-weight="600" fill="var(--ink3)">ЧТО ЗНАЕТ КАЖДЫЙ УРОВЕНЬ</text>
  <text x="0" y="112" font-size="9" fill="var(--ink2)">тест — что считается успехом, но не знает ни одного селектора</text>
  <text x="0" y="128" font-size="9" fill="var(--ink2)">страница — где элемент и как с ним обращаться, но не знает, что проверяют</text>
  <text x="0" y="144" font-size="9" fill="var(--ink2)">локатор — только правило поиска; элемента у него нет до самого обращения</text>
  <text x="0" y="162" font-size="9" fill="var(--ink3)">Фронтенд переименовал класс → правка в одной строке страницы, тесты не трогаются.</text>
 </g>
</svg>
<figcaption>Каждая правка вёрстки останавливается на слое страницы и не доходит до тестов.</figcaption>
</figure>

<h2>Локатор — это не элемент</h2>
<p class="prose">Самое важное для понимания Playwright. Свойство объявлено так:</p>
<pre><code><span class="kw">private ILocator</span> EmailField =&gt; Page.Locator(<span class="str">"#email"</span>);</code></pre>
<p class="prose">Стрелка <code>=&gt;</code> означает тело метода доступа: <b>выражение выполняется при каждом обращении</b>. Обращение возвращает не найденный элемент, а описание того, как его искать. Поиск происходит в момент действия — <code>ClickAsync</code>, <code>FillAsync</code>, <code>Expect</code>.</p>
<div class="note"><b class="h">Следствие, ради которого всё и сделано</b><p>Страница может перерисоваться сколько угодно раз — «устаревшей ссылки на элемент» не возникает, потому что ссылки и нет. Если бы вместо свойства было поле, инициализированное один раз, оно бы хранило результат поиска и ломалось при каждой перерисовке.</p></div>

<h2>Три вида членов в page object этого проекта</h2>
<div class="tw"><table>
<tr><th>Вид</th><th>Видимость</th><th>Зачем</th><th>Пример</th></tr>
<tr><td>Локатор</td><td><span class="mod private">private</span></td><td>знает селектор, наружу не выходит</td><td><code>EmailField</code></td></tr>
<tr><td>Действие</td><td><span class="mod public">public</span></td><td>выражает намерение теста</td><td><code>FillEmailFieldAsync</code></td></tr>
<tr><td>Локатор-обёртка</td><td><span class="mod public">public</span></td><td>отдаёт элемент для <code>Expect()</code>, не раскрывая селектор</td><td><code>EmailFieldLocator</code></td></tr>
</table></div>
<p class="prose">В <code>ContactFormPage</code> обёрток около семидесяти — это цена того, что проверки пишутся в тестах, а не в странице. Альтернатива — методы вида <code>AssertEmailVisibleAsync</code> внутри страницы, но тогда страница начала бы знать, что считается успехом, и слои бы смешались.</p>

<h2>Где проходит граница в этом проекте</h2>
<div class="note warn"><b class="h">Общий путь до шага живёт в фикстуре, а не в странице</b><p>Методы вроде <code>GoToStep3Async</code> или <code>GoToTourStepAsync</code> объявлены <code>private</code> внутри тестовых классов. Это осознанно: они описывают <b>сценарий</b>, а не устройство страницы. Обратная сторона — такие методы дублируются между фикстурами, потому что делиться ими негде.</p></div>`};

VIEWS.life = {t:"Жизненный цикл теста", html:()=>`
<h1>Жизненный цикл теста</h1>
<p class="prose">Что происходит от запуска <code>dotnet test</code> до строчки в отчёте. Два механизма работают одновременно: хуки NUnit и создание браузерного контекста из <code>PageTest</code>.</p>

<figure class="fig">
<svg viewBox="0 0 620 290" role="img" aria-label="Последовательность выполнения теста">
 <g font-family="var(--fm)" font-size="9.5">
  <rect x="0" y="8" width="620" height="30" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="12" y="27" fill="var(--ink)">VSTest находит классы с [TestFixture] и методы с [Test] через адаптер NUnit</text>

  <path d="M60 40v14" stroke="var(--moss)"/><path d="M60 54l-4-7h8z" fill="var(--moss)"/>
  <rect x="0" y="56" width="620" height="30" rx="3" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="12" y="75" fill="var(--ink)">на каждый тест: PageTest создаёт новый контекст браузера, вызвав ваш ContextOptions()</text>

  <path d="M60 88v14" stroke="var(--moss)"/><path d="M60 102l-4-7h8z" fill="var(--moss)"/>
  <rect x="0" y="104" width="620" height="30" rx="3" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="12" y="123" fill="var(--ink)">[SetUp] — создать page object, открыть страницу, закрыть баннер кук</text>

  <path d="M60 136v14" stroke="var(--moss)"/><path d="M60 150l-4-7h8z" fill="var(--moss)"/>
  <rect x="0" y="152" width="620" height="30" rx="3" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="12" y="171" fill="var(--ink)">[Test] — тело теста: действия через page object и проверки через Expect / Assert</text>

  <path d="M60 184v14" stroke="var(--moss)"/><path d="M60 198l-4-7h8z" fill="var(--moss)"/>
  <rect x="0" y="200" width="620" height="30" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="12" y="219" fill="var(--ink)">контекст закрывается — куки, хранилище и состояние формы уходят вместе с ним</text>

  <path d="M60 232v14" stroke="var(--moss)"/><path d="M60 246l-4-7h8z" fill="var(--moss)"/>
  <rect x="0" y="248" width="300" height="30" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="12" y="267" fill="var(--ink)">упал и есть [Retry(2)] → до 2 повторов</text>
  <rect x="316" y="248" width="304" height="30" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="328" y="267" fill="var(--ink)">результат → TRX, NUnit XML, ReportPortal</text>
 </g>
</svg>
<figcaption>Новый контекст на каждый тест — то, что делает тесты независимыми от порядка выполнения.</figcaption>
</figure>

<h2>Хуки NUnit</h2>
<div class="tw"><table>
<tr><th>Атрибут</th><th>Когда</th><th>Есть ли в Portal</th></tr>
<tr><td><code>[OneTimeSetUp]</code></td><td>один раз до первого теста фикстуры</td><td>нет</td></tr>
<tr><td><code>[SetUp]</code></td><td>перед каждым тестом</td><td>да, в каждой фикстуре свой</td></tr>
<tr><td><code>[TearDown]</code></td><td>после каждого теста, даже упавшего</td><td>нет — уборка не нужна, контекст закрывается сам</td></tr>
<tr><td><code>[OneTimeTearDown]</code></td><td>один раз после последнего теста</td><td>нет</td></tr>
</table></div>

<div class="note"><b class="h">Почему <code>[SetUp]</code> продублирован в 30 файлах</b><p><code>BaseTest</code> не объявляет ни одного хука. Поэтому каждая фикстура пишет свой: создать страницу, перейти, закрыть баннер. Вынести это в базовый класс было бы можно, но фикстуры открывают разные страницы, и общий хук пришлось бы делать настраиваемым — команда предпочла явность.</p></div>

<h2>Две разные проверки</h2>
<div class="tw"><table>
<tr><th></th><th><code>Expect(локатор)</code></th><th><code>Assert.That(значение)</code></th></tr>
<tr><td>Откуда</td><td>Playwright</td><td>NUnit</td></tr>
<tr><td>Поведение</td><td><b>ждёт</b> выполнения условия до таймаута</td><td>проверяет мгновенно, здесь и сейчас</td></tr>
<tr><td>Для чего</td><td>состояние элементов на странице</td><td>адреса, тела запросов, вычисленные значения</td></tr>
<tr><td>Пример</td><td><code>Expect(x).ToBeVisibleAsync(new(){Timeout=15000})</code></td><td><code>Assert.That(Page.Url, Does.Contain("/contact-form"))</code></td></tr>
</table></div>
<div class="note trap"><b class="h">Частая ошибка</b><p>Проверять элемент через <code>Assert.That(await x.IsVisibleAsync(), Is.True)</code>. Такая проверка не ждёт: она спрашивает состояние в конкретный миг и падает на любой задержке отрисовки. Для элементов нужен <code>Expect</code> — он повторяет проверку, пока не истечёт таймаут.</p></div>`};

VIEWS.flow = {t:"Поток контактной формы", html:()=>`
<h1>Поток контактной формы</h1>
<p class="prose">23 из 30 тестовых файлов проверяют одну эту анкету. Без карты её шагов их названия не читаются. Вся анкета живёт на одном адресе <code>/en/contact-form</code> — шаги переключаются на клиенте, навигации между ними нет.</p>

<figure class="fig">
<svg viewBox="0 0 620 372" role="img" aria-label="Шаги контактной формы и ветвления">
 <g font-family="var(--fm)" font-size="9">
  <rect x="0" y="6" width="140" height="34" rx="3" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="70" y="21" text-anchor="middle" font-size="9" fill="var(--ink)">1 · контакты</text>
  <text x="70" y="33" text-anchor="middle" font-size="8" fill="var(--ink3)">почта, телефон, страна</text>

  <path d="M144 23h26" stroke="var(--moss)"/><path d="M170 23l-7-4v8z" fill="var(--moss)"/>

  <rect x="174" y="6" width="150" height="34" rx="3" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="249" y="21" text-anchor="middle" font-size="9" fill="var(--ink)">2 · How can we help?</text>
  <text x="249" y="33" text-anchor="middle" font-size="8" fill="var(--ink3)">три ветки, первая по умолчанию</text>

  <path d="M249 44v14" stroke="var(--brass)"/><path d="M120 58h380" stroke="var(--brass)"/>
  <path d="M120 58v12M330 58v12M500 58v12" stroke="var(--brass)"/>
  <rect x="40" y="72" width="160" height="30" rx="2" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="120" y="91" text-anchor="middle" font-size="8.5" fill="var(--ink)">существующий клиент → портал</text>
  <rect x="250" y="72" width="160" height="30" rx="2" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="330" y="91" text-anchor="middle" font-size="8.5" fill="var(--ink)">что-то ещё → 4 landing-страницы</text>
  <rect x="420" y="72" width="160" height="30" rx="2" fill="var(--moss-s)" stroke="var(--moss)"/>
  <text x="500" y="87" text-anchor="middle" font-size="8.5" fill="var(--ink)">нужно рабочее место</text>
  <text x="500" y="98" text-anchor="middle" font-size="8" fill="var(--ink3)">основная ветка ↓</text>

  <path d="M500 104v12" stroke="var(--moss)"/><path d="M500 116l-4-7h8z" fill="var(--moss)"/>

  ${[["3 · имя и компания","предзаполнено из почты"],["4 · где ищете","поиск области + один или много"],["5 · продукты","мультивыбор, пропустить нельзя"],["6 · SMS","согласие, по умолчанию снято"]].map((s,i)=>{
    const y = 120 + i*30;
    return `<rect x="330" y="${y}" width="290" height="26" rx="2" fill="var(--moss-s)" stroke="var(--moss-l)"/>
      <text x="340" y="${y+17}" font-size="8.5" fill="var(--ink)">${s[0]}</text>
      <text x="612" y="${y+17}" text-anchor="end" font-size="8" fill="var(--ink3)">${s[1]}</text>`;
  }).join("")}

  <path d="M475 242v12" stroke="var(--moss)"/><path d="M300 254h350" stroke="var(--moss)" stroke-dasharray="0"/>
  <path d="M300 254v12M620 254v0" stroke="var(--moss)"/>
  <rect x="330" y="256" width="290" height="30" rx="2" fill="var(--azure-s)" stroke="var(--azure)"/>
  <text x="340" y="275" font-size="8.5" fill="var(--ink)">7 · благодарность — офисная или неофисная</text>

  <rect x="0" y="120" width="290" height="80" rx="3" fill="var(--surf3)" stroke="var(--line)" stroke-dasharray="3 3"/>
  <text x="10" y="136" font-size="8.5" font-weight="600" fill="var(--ink)">подквиз 8–13 · progress max=6</text>
  <text x="10" y="150" font-size="8" fill="var(--ink2)">размер команды · дата старта</text>
  <text x="10" y="163" font-size="8" fill="var(--ink3)">кастомизация и дополнения — за фича-флагом</text>
  <text x="10" y="176" font-size="8" fill="var(--ink2)">размер компании · отрасль</text>
  <text x="10" y="192" font-size="8" fill="var(--ink3)">каждый шаг пропускается кнопкой Skip</text>

  <rect x="0" y="212" width="290" height="74" rx="3" fill="var(--surf3)" stroke="var(--line)" stroke-dasharray="3 3"/>
  <text x="10" y="228" font-size="8.5" font-weight="600" fill="var(--ink)">тур 14–17</text>
  <text x="10" y="242" font-size="8" fill="var(--ink2)">выбор центра · дата · время · подтверждение</text>
  <text x="10" y="256" font-size="8" fill="var(--red)">«No thanks» → Abandon Thank You</text>
  <text x="10" y="270" font-size="8" fill="var(--brass)">2 минуты без действий → тот же Abandon</text>

  <path d="M0 300h620" stroke="var(--line)"/>
  <text x="0" y="318" font-size="9" fill="var(--ink3)">Три разные страницы благодарности, и у двух из них одинаковый заголовок «Thank you».</text>
  <text x="0" y="332" font-size="9" fill="var(--ink3)">Различают их по содержимому: офисная — по кнопке Continue, неофисная — по четырём ссылкам покупки,</text>
  <text x="0" y="346" font-size="9" fill="var(--ink3)">страница отказа — по фразе «We will be in contact with you as soon as possible».</text>
  <text x="0" y="364" font-size="9" fill="var(--ink3)">Вход со страницы продукта, решения или локации несёт хеш и преднастраивает соответствующий шаг.</text>
 </g>
</svg>
<figcaption>Основная ветка идёт вправо, две другие уходят на отдельные страницы. Подквиз и тур — вложенные последовательности внутри той же формы.</figcaption>
</figure>

<h2>Какая фикстура какой участок закрывает</h2>
<div class="tw"><table>
<tr><th>Участок</th><th>Файлы тестов</th></tr>
<tr><td>Шаг 1, валидация</td><td>ContactFormValidationTests, ContactFormPhoneNumberFieldTests, ContactFormPhoneValidationEdgeCaseTests</td></tr>
<tr><td>Шаг 2, ветвления</td><td>ContactFormPositiveTests, ContactFormNoLeadJourneyTests</td></tr>
<tr><td>Шаги 3–6</td><td>ContactFormProfileStepTests, ContactFormLocationSearchTests, ContactFormProductsTests, ContactFormSmsConsentTests, ContactFormStepPersistenceTests</td></tr>
<tr><td>Страницы благодарности</td><td>ContactFormOfficeThankYouTests, ContactFormNonOfficeThankYouTests, ContactFormNonOfficeCompletionTests</td></tr>
<tr><td>Подквиз</td><td>ContactFormOptionalStepsTests</td></tr>
<tr><td>Тур</td><td>ContactFormTourLocationTests, ContactFormTourDateTimeTests, ContactFormTourThankYouTests, ContactFormAbandonThankYouTests, ContactFormComingSoonTests</td></tr>
<tr><td>Вход с хешем</td><td>ContactFormProductPrefillTests, ContactFormCategoryPrefillTests, ContactFormIndustryPrefillTests, ContactFormLocationPrefillTests</td></tr>
<tr><td>Прочее</td><td>ContactFormTimerTests, ContactFormLeaveConfirmationTests</td></tr>
</table></div>`};
