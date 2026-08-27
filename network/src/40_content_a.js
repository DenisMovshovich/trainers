
/* ============================================================
   Содержание
   ============================================================ */
const ran     = (st, re) => st.log.some(e => re.test(e.cmd));
const okRan   = (st, re) => st.log.some(e => !e.err && re.test(e.cmd));
const logHas  = (st, re) => st.log.some(e => (e.out || []).some(l => re.test(l)));
const verdict = st => st.N.verdict;
const used    = (st, tool) => st.log.some(e => new RegExp("^\\s*" + tool + "\\b").test(e.cmd));
const hostsHas = (st, name, ip) => st.N.hostsFile[name] === ip;
const okStatus = (st, code) => st.log.some(e => (e.out || []).some(l =>
  new RegExp("(HTTP/1\\.1|<)\\s*" + code + "\\b").test(l)));

const MODULES = [

/* ------------------------------------------------ 1 */
{
n:1, id:"path", title:"Путь запроса", sub:"Что происходит между строкой и ответом",
lede:"Один вызов проходит четыре независимых слоя. Каждый ломается по-своему и лечится по-разному — и половина навыка отладки в том, чтобы понять, на каком именно застряло.",
theory:`
<h2>Четыре шага</h2>
<div class="tw"><table>
<tr><th>Шаг</th><th>Что происходит</th><th>Как выглядит поломка</th></tr>
<tr><td>1. Разрешение имени</td><td>имя превращается в адрес</td><td><code>Could not resolve host</code></td></tr>
<tr><td>2. Соединение</td><td>устанавливается связь с портом</td><td><code>Connection refused</code> или <code>timed out</code></td></tr>
<tr><td>3. Шифрование</td><td>проверяется сертификат</td><td><code>SSL certificate problem</code></td></tr>
<tr><td>4. Обмен</td><td>уходит запрос, приходит ответ</td><td>код ответа 4xx или 5xx</td></tr>
</table></div>
<p>Порядок жёсткий: пока не разрешилось имя, не будет соединения; пока нет соединения, не будет рукопожатия. Поэтому и разбирать удобнее по порядку — первая же непройденная ступень и есть ответ.</p>

<figure class="fig"><svg viewBox="0 0 640 118" role="img" aria-label="Слои запроса">
<rect x="8" y="30" width="140" height="52" rx="3" fill="none" stroke="currentColor"/>
<rect x="164" y="30" width="140" height="52" rx="3" fill="none" stroke="currentColor"/>
<rect x="320" y="30" width="140" height="52" rx="3" fill="none" stroke="currentColor"/>
<rect x="476" y="30" width="156" height="52" rx="3" fill="none" stroke="currentColor"/>
<text x="78" y="22" text-anchor="middle" font-size="10.5" fill="currentColor">1 · имя</text>
<text x="234" y="22" text-anchor="middle" font-size="10.5" fill="currentColor">2 · соединение</text>
<text x="390" y="22" text-anchor="middle" font-size="10.5" fill="currentColor">3 · шифрование</text>
<text x="554" y="22" text-anchor="middle" font-size="10.5" fill="currentColor">4 · обмен</text>
<text x="78" y="52" text-anchor="middle" font-size="11" fill="currentColor">DNS</text>
<text x="78" y="70" text-anchor="middle" font-size="10" fill="currentColor">имя → адрес</text>
<text x="234" y="52" text-anchor="middle" font-size="11" fill="currentColor">TCP</text>
<text x="234" y="70" text-anchor="middle" font-size="10" fill="currentColor">адрес:порт</text>
<text x="390" y="52" text-anchor="middle" font-size="11" fill="currentColor">TLS</text>
<text x="390" y="70" text-anchor="middle" font-size="10" fill="currentColor">сертификат</text>
<text x="554" y="52" text-anchor="middle" font-size="11" fill="currentColor">HTTP</text>
<text x="554" y="70" text-anchor="middle" font-size="10" fill="currentColor">запрос и ответ</text>
<line x1="150" y1="56" x2="162" y2="56" stroke="currentColor" marker-end="url(#ar)"/>
<line x1="306" y1="56" x2="318" y2="56" stroke="currentColor" marker-end="url(#ar)"/>
<line x1="462" y1="56" x2="474" y2="56" stroke="currentColor" marker-end="url(#ar)"/>
<text x="320" y="104" text-anchor="middle" font-size="10" fill="currentColor">первая непройденная ступень и есть причина</text>
<defs><marker id="ar" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
<path d="M0,0 L6,3 L0,6 z" fill="currentColor"/></marker></defs>
</svg><figcaption>Слои проходятся строго по порядку, поэтому и разбирать их удобно снизу вверх.</figcaption></figure>

<h2>Инструмент, который показывает всё сразу</h2>
<pre><code>$ <span class="k">curl -v https://api.example.com/health</span>
<span class="c">*   Trying 203.0.113.10:443...</span>          <span class="c2">← имя разрешилось</span>
<span class="c">* Connected to api.example.com (203.0.113.10) port 443</span>   <span class="c2">← соединение есть</span>
<span class="c">* SSL connection using TLSv1.3</span>            <span class="c2">← сертификат принят</span>
<span class="g">&gt; GET /health HTTP/1.1</span>                    <span class="c2">← ушёл запрос</span>
<span class="g">&gt; Host: api.example.com</span>
<span class="q">&lt; HTTP/1.1 200 OK</span>                         <span class="c2">← пришёл ответ</span></code></pre>
<div class="tw"><table>
<tr><th>Символ</th><th>Что означает</th></tr>
<tr><td><code>*</code></td><td>что делает сам curl: разрешение, соединение, рукопожатие</td></tr>
<tr><td><code>&gt;</code></td><td>что отправлено серверу</td></tr>
<tr><td><code>&lt;</code></td><td>что получено от сервера</td></tr>
</table></div>
<div class="note ok"><b class="hd">Внизу настоящие инструменты</b><p>Терминал понимает <code>curl</code>, <code>dig</code>, <code>ping</code>, <code>nc</code>, <code>openssl s_client</code> и отдельно <code>browser</code> — он ходит по тому же адресу, но с правилами страницы. Наберите <code>curl -v https://api.example.com/health</code> и сравните вывод со схемой выше.</p></div>

<h2>Почему слой важно определить сразу</h2>
<div class="tw"><table>
<tr><th>Слой</th><th>К кому идти</th></tr>
<tr><td>Имя</td><td>к тем, кто ведёт DNS; иногда достаточно поправить у себя</td></tr>
<tr><td>Соединение</td><td>к сети и межсетевым экранам, либо служба не запущена</td></tr>
<tr><td>Сертификат</td><td>к тем, кто выпускает сертификаты; часто просто истёк срок</td></tr>
<tr><td>Ответ</td><td>к разработчикам приложения — сеть тут ни при чём</td></tr>
</table></div>
<p>Сообщение «сервис недоступен» без указания слоя стоит команде часов. Сообщение «имя разрешается, порт 443 открыт, сертификат истёк вчера» закрывает вопрос за минуту.</p>
`,
quiz:[
 {q:"В каком порядке проходятся слои запроса?",
  opts:["Соединение, имя, шифрование, обмен","Имя, соединение, шифрование, обмен","Шифрование, имя, соединение, обмен","Порядок произвольный"],
  a:1, why:"Порядок жёсткий: без разрешённого имени нет соединения, без соединения нет рукопожатия."},
 {q:"Что означает строка, начинающаяся с <code>&lt;</code>, в выводе <code>curl -v</code>?",
  opts:["Что отправлено серверу","Что получено от сервера","Действие самого curl","Ошибку"],
  a:1, why:"<code>&gt;</code> — отправленное, <code>*</code> — то, что делает сам curl."},
 {q:"Ошибка <code>Could not resolve host</code> — какой это слой?",
  opts:["Соединение","Имя","Сертификат","Ответ сервера"],
  a:1, why:"До соединения дело не дошло: адрес неизвестен, соединяться не с чем."},
 {q:"Почему полезно назвать слой в сообщении о проблеме?",
  opts:["Так принято","Разные слои чинят разные люди — это экономит часы","Для отчётности","Для логов"],
  a:1, why:"«Имя разрешается, порт открыт, сертификат истёк вчера» закрывает вопрос за минуту."},
 {q:"Код ответа 500 — на каком слое проблема?",
  opts:["Имя","Соединение","Обмен: сеть отработала, ошибка в приложении","Сертификат"],
  a:2, why:"Раз пришёл код ответа, значит все нижние слои пройдены успешно."},
 {q:"Что делает ключ <code>-v</code> у curl?",
  opts:["Ускоряет запрос","Показывает каждый шаг: разрешение, соединение, рукопожатие, заголовки","Проверяет сертификат","Повторяет запрос"],
  a:1, why:"Это первый ключ, который стоит добавить, когда что-то не работает."}
],
labs:[
 {id:"1a", title:"Пройти путь целиком",
  brief:"<p>Разберите успешный запрос по слоям.</p><ul><li>выполните <code>curl -v https://api.example.com/health</code>;</li><li>найдите в выводе строку про разрешение имени, строку про соединение, строку про сертификат и код ответа;</li><li>убедитесь отдельно, что имя разрешается — <code>dig api.example.com</code>, и что порт открыт — <code>nc -zv api.example.com 443</code>.</li></ul>",
  hint:"Три команды: curl -v, dig, nc -zv.",
  setup: () => newScenario({
    dns: {"api.example.com": [{type:"A", value:"203.0.113.10", ttl:300}]},
    nodes: {"203.0.113.10": {ports: {443: {server:"api", tls:true, cert:"api.example.com"}}}},
    certs: {"api.example.com": {cn:"api.example.com", san:["api.example.com"], notAfter: 999999}},
    servers: {api: {routes: [{path:"/health", body:"ok"}]}}
  }),
  checks:[
   {label:"Запрос выполнен с подробным выводом", test:st=>okRan(st,/curl\s+.*-v/)},
   {label:"Имя проверено отдельно", test:st=>used(st, "dig") || used(st, "nslookup")},
   {label:"Порт проверен отдельно", test:st=>used(st, "nc")},
   {label:"Ответ получен успешно", test:st=>logHas(st, /200 OK/)},
   {label:"В выводе видно рукопожатие", test:st=>logHas(st, /SSL connection using/)}
  ]},
 {id:"1b", title:"Назвать слой",
  brief:"<p>Запрос к <code>api.example.com</code> не проходит. Определите, на каком слое он застревает, и зафиксируйте вывод командой <code>verdict</code>.</p><p>Возможные слои: <code>dns</code>, <code>tcp</code>, <code>tls</code>, <code>http</code>, <code>proxy</code>, <code>cors</code>, <code>timeout</code>. Список с пояснениями покажет <code>verdict</code> без аргументов.</p><p>Вывод должен опираться на проверки, а не на догадку: сначала посмотрите, докуда доходит запрос.</p>",
  hint:"curl -v покажет, на каком шаге всё остановилось. Сверьте с dig и nc.",
  setup: () => newScenario({
    dns: {"api.example.com": [{type:"A", value:"203.0.113.10", ttl:300}]},
    nodes: {"203.0.113.10": {ports: {443: {server:"api", tls:true, cert:"other"}}}},
    certs: {other: {cn:"internal.example.com", san:["internal.example.com"], notAfter: 999999}},
    servers: {api: {routes: [{path:"/health", body:"ok"}]}}
  }),
  checks:[
   {label:"Запрос выполнялся", test:st=>used(st, "curl")},
   {label:"Имя проверено — оно в порядке", test:st=>used(st, "dig") || logHas(st, /Trying 203\.0\.113\.10/)},
   {label:"Соединение проверено — оно тоже в порядке", test:st=>used(st, "nc") || logHas(st, /Connected to/)},
   {label:"Ошибка сертификата увидена", test:st=>logHas(st, /certificate subject name|SSL certificate problem/)},
   {label:"Вывод записан правильно", test:st=>verdict(st) === "tls"}
  ]}
],
iv:[
 {q:"Приложение не может достучаться до сервиса. Как будете разбираться?",
  probe:"Открывающий вопрос. Ждут порядок действий по слоям, а не перечисление утилит.",
  a:"Я иду снизу вверх по слоям, потому что они проходятся строго по порядку и первая непройденная ступень и есть ответ. Сначала имя: разрешается ли оно вообще и в тот ли адрес — это <code>dig</code>, и полезно сравнить с тем, что ожидается. Потом соединение: открыт ли порт на этом адресе — <code>nc</code> или просто <code>curl -v</code>, который покажет и то, и другое. Отдельно замечу, что <code>ping</code> здесь плохой инструмент: ICMP часто закрыт, и отсутствие ответа ничего не доказывает. Дальше, если это https, — сертификат: срок, имя, издатель. И только когда всё это пройдено, разговор переходит к самому обмену: код ответа, заголовки, тело. Практическая польза в том, что каждый слой чинят разные люди, поэтому сообщение «имя разрешается, порт открыт, сертификат истёк вчера» экономит часы по сравнению с «сервис недоступен».",
  more:["Почему ping — плохой способ проверки?","Что показывает curl -v построчно?"]}
]
},
