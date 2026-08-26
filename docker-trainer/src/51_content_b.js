/* ---------------------------------------------------------- 5 */
{
n:5, id:"cache", title:"Кэш слоёв", sub:"Порядок инструкций и .dockerignore",
lede:"Почему пересборка занимает то две секунды, то две минуты, и как расставить инструкции, чтобы кэш работал на вас.",
theory:`
<p>Каждая инструкция Dockerfile порождает слой. Перед тем как выполнить инструкцию, BuildKit проверяет: есть ли в кэше слой, полученный <em>из того же родителя</em> той же самой инструкцией? Если да — слой берётся готовым, в выводе появляется <code>CACHED</code>. Если нет — слой пересобирается, и <b>все последующие инструкции тоже пересобираются</b>, потому что у них изменился родитель.</p>

<div class="callout"><b>Главное правило</b><p>Кэш ломается <em>сверху вниз</em>. Одна изменившаяся строка обесценивает всё, что ниже. Значит, редко меняющееся должно стоять вверху, часто меняющееся — внизу.</p></div>

<h2>Классическая ошибка и её цена</h2>
<figure class="fig">
<svg viewBox="0 0 620 268" role="img" aria-label="Сравнение порядка инструкций и поведения кэша при пересборке">
 <g font-family="var(--font-mono)" font-size="9.5">
  <text x="0" y="12" font-weight="700" fill="var(--signal)" letter-spacing=".5">ПЛОХО — код копируется до установки зависимостей</text>
  <g>
   <rect x="0" y="22" width="290" height="24" fill="var(--ok-soft)" stroke="var(--ok)"/><text x="8" y="38" fill="var(--ink)">FROM node:20-alpine</text><text x="282" y="38" text-anchor="end" fill="var(--ok)">CACHED</text>
   <rect x="0" y="50" width="290" height="24" fill="var(--ok-soft)" stroke="var(--ok)"/><text x="8" y="66" fill="var(--ink)">WORKDIR /app</text><text x="282" y="66" text-anchor="end" fill="var(--ok)">CACHED</text>
   <rect x="0" y="78" width="290" height="24" fill="var(--err-soft)" stroke="var(--err)"/><text x="8" y="94" fill="var(--ink)">COPY . .</text><text x="282" y="94" text-anchor="end" fill="var(--err)">изменилось</text>
   <rect x="0" y="106" width="290" height="24" fill="var(--err-soft)" stroke="var(--err)"/><text x="8" y="122" fill="var(--ink)">RUN npm ci</text><text x="282" y="122" text-anchor="end" fill="var(--err)">92 c</text>
   <rect x="0" y="134" width="290" height="24" fill="var(--err-soft)" stroke="var(--err)"/><text x="8" y="150" fill="var(--ink)">CMD ["node","server.js"]</text><text x="282" y="150" text-anchor="end" fill="var(--err)">заново</text>
  </g>
  <text x="0" y="176" fill="var(--ink-2)">правка кода → полная переустановка зависимостей</text>

  <text x="330" y="12" font-weight="700" fill="var(--accent)" letter-spacing=".5">ХОРОШО — манифест отдельно от кода</text>
  <g transform="translate(330,0)">
   <rect x="0" y="22" width="290" height="24" fill="var(--ok-soft)" stroke="var(--ok)"/><text x="8" y="38" fill="var(--ink)">FROM node:20-alpine</text><text x="282" y="38" text-anchor="end" fill="var(--ok)">CACHED</text>
   <rect x="0" y="50" width="290" height="24" fill="var(--ok-soft)" stroke="var(--ok)"/><text x="8" y="66" fill="var(--ink)">WORKDIR /app</text><text x="282" y="66" text-anchor="end" fill="var(--ok)">CACHED</text>
   <rect x="0" y="78" width="290" height="24" fill="var(--ok-soft)" stroke="var(--ok)"/><text x="8" y="94" fill="var(--ink)">COPY package*.json ./</text><text x="282" y="94" text-anchor="end" fill="var(--ok)">CACHED</text>
   <rect x="0" y="106" width="290" height="24" fill="var(--ok-soft)" stroke="var(--ok)"/><text x="8" y="122" fill="var(--ink)">RUN npm ci</text><text x="282" y="122" text-anchor="end" fill="var(--ok)">CACHED</text>
   <rect x="0" y="134" width="290" height="24" fill="var(--err-soft)" stroke="var(--err)"/><text x="8" y="150" fill="var(--ink)">COPY . .</text><text x="282" y="150" text-anchor="end" fill="var(--err)">изменилось</text>
   <rect x="0" y="162" width="290" height="24" fill="var(--err-soft)" stroke="var(--err)"/><text x="8" y="178" fill="var(--ink)">CMD ["node","server.js"]</text><text x="282" y="178" text-anchor="end" fill="var(--err)">2 c</text>
  </g>
  <text x="330" y="204" fill="var(--ink-2)">та же правка → пересобираются два последних слоя</text>
  <path d="M0 224h620" stroke="var(--line)"/>
  <text x="0" y="244" fill="var(--ink-3)">Инвалидация COPY определяется контрольной суммой копируемых файлов, а не датой изменения.</text>
  <text x="0" y="258" fill="var(--ink-3)">Инвалидация RUN — текстом самой команды: docker не знает, что делает apt-get, и не проверяет результат.</text>
 </g>
</svg>
<figcaption>Слева правка одной строки исходника стоит полной переустановки зависимостей. Справа зависимости отделены от кода и остаются в кэше.</figcaption>
</figure>

<h2>Как считается ключ кэша</h2>
<ul>
<li>Для <code>RUN</code> — по <em>тексту команды</em>. Docker не выполняет её, чтобы сравнить результат. Поэтому <code>RUN apt-get update</code> может отдать вам кэш недельной давности с устаревшими индексами пакетов.</li>
<li>Для <code>COPY</code> и <code>ADD</code> — по содержимому копируемых файлов (контрольная сумма), правам и путям. Изменение времени модификации без изменения содержимого кэш не ломает.</li>
<li>Для метаданных (<code>ENV</code>, <code>WORKDIR</code>, <code>LABEL</code>) — по тексту инструкции.</li>
</ul>
<div class="callout warn"><b>Ловушка apt-get update</b><p>Никогда не разделяйте <code>update</code> и <code>install</code> на два RUN. Если <code>install</code> изменится, а <code>update</code> возьмётся из кэша, вы получите установку по устаревшим индексам и загадочные ошибки «package not found». Правильно — одной командой:</p><pre style="margin:.6em 0 0"><code>RUN apt-get update &amp;&amp; apt-get install -y --no-install-recommends \\
      curl ca-certificates \\
 &amp;&amp; rm -rf /var/lib/apt/lists/*</code></pre></div>

<h2>.dockerignore</h2>
<p>Файл рядом с Dockerfile, по синтаксису похож на <code>.gitignore</code>. Он решает сразу три задачи: ускоряет отправку контекста демону, не даёт секретам и мусору попасть в образ и защищает кэш от ложных срабатываний — без него любая правка в <code>.git/</code> ломает <code>COPY . .</code>.</p>
<pre><code>.git
node_modules
dist
*.log
.env
.env.*
**/__pycache__
Dockerfile
docker-compose.yml
README.md</code></pre>
<div class="callout trap"><b>node_modules обязательно в игнор</b><p>Если локальный <code>node_modules</code> уедет в контекст, он, во-первых, перезапишет то, что установил <code>npm ci</code> внутри образа, а во-вторых, притащит бинарники, собранные под вашу ОС. На Linux-контейнере они не запустятся.</p></div>

<h2>Ещё несколько приёмов</h2>
<ul>
<li><b>Объединяйте связанные RUN.</b> Файл, удалённый в следующем слое, всё равно остаётся в предыдущем и весит. Удалять кэш пакетного менеджера нужно в той же инструкции, где он создан.</li>
<li><b>Указывайте <code>--no-install-recommends</code></b> для apt и <code>--no-cache</code> для apk — не тащите рекомендованные пакеты и индексы.</li>
<li><b>Кэш-маунты BuildKit</b> сохраняют каталог между сборками, не попадая в образ:<br><code>RUN --mount=type=cache,target=/root/.npm npm ci</code></li>
<li><b>В CI кэша нет по умолчанию.</b> Используйте <code>--cache-from</code> вместе с реестром или встроенный кэш раннера, иначе каждая сборка будет с нуля.</li>
</ul>
`,
quiz:[
 {q:"Вы поправили одну строку в <code>server.js</code>. В Dockerfile <code>COPY . .</code> стоит перед <code>RUN npm ci</code>. Что произойдёт при пересборке?",
  opts:["Пересоберётся только слой COPY","Пересоберётся COPY и всё, что ниже, включая npm ci","Docker заметит, что package.json не менялся, и сохранит кэш npm ci","Сборка завершится ошибкой"],
  a:1, why:"Кэш инвалидируется сверху вниз: изменился слой COPY — у всех следующих инструкций изменился родитель, и они пересобираются, сколько бы времени это ни занимало."},
 {q:"По чему определяется, изменилась ли инструкция <code>RUN apt-get update</code>?",
  opts:["По содержимому индексов пакетов","По тексту самой команды","По дате последней сборки","По размеру получившегося слоя"],
  a:1, why:"Docker сравнивает строку инструкции. Он не выполняет команду ради сравнения результата — поэтому <code>update</code> и <code>install</code> нужно держать в одной инструкции."},
 {q:"Зачем в <code>.dockerignore</code> добавляют <code>node_modules</code>?",
  opts:["Чтобы образ собирался с правами root","Чтобы локальные модули не уехали в контекст, не перетёрли установленные внутри и не ломали кэш","Так требует npm ci","Чтобы работал multi-stage"],
  a:1, why:"Локальный node_modules раздувает контекст, ломает кэш при каждой правке и приносит бинарники, собранные под другую ОС."},
 {q:"Что даёт объединение <code>RUN apt-get install ... &amp;&amp; rm -rf /var/lib/apt/lists/*</code> в одну инструкцию?",
  opts:["Ускоряет установку","Удалённые файлы не остаются в предыдущем слое, и образ реально меньше","Позволяет обойтись без sudo","Ничего, это стилистика"],
  a:1, why:"Слой фиксирует состояние на момент завершения инструкции. Если удалить файлы в следующем RUN, они останутся в предыдущем слое и продолжат весить — удалять нужно там же, где создали."},
 {q:"В каком порядке правильнее расположить инструкции?",
  opts:["COPY . . → RUN npm ci → CMD","COPY package*.json ./ → RUN npm ci → COPY . . → CMD","RUN npm ci → COPY package*.json ./ → COPY . . → CMD","Порядок не влияет на скорость сборки"],
  a:1, why:"Сначала копируем только манифест зависимостей и ставим их — этот тяжёлый слой кэшируется до тех пор, пока не изменится package.json. Код копируем последним."},
 {q:"Почему в CI сборка часто идёт дольше, чем локально?",
  opts:["CI-раннеры слабее по железу","На чистом раннере локального кэша слоёв нет — нужен --cache-from или кэш раннера","В CI отключён BuildKit","Из-за ограничений сети"],
  a:1, why:"Кэш слоёв живёт на машине, где идёт сборка. На эфемерном раннере его нет, поэтому кэш подтягивают из реестра через <code>--cache-from</code> или сохраняют средствами CI."}
],
labs:[
 {id:"5a", title:"Сломать и починить кэш",
  brief:"<h3>Сломать и починить кэш</h3><p>В рабочем каталоге лежат <code>package.json</code>, <code>server.js</code> и <b>неудачный</b> Dockerfile — посмотрите его во вкладке <b>Файлы</b>.</p><ul><li>Соберите первый раз: <code>docker build -t api:1.0 .</code></li><li>Соберите второй раз без изменений — все шаги должны стать <code>Using cache</code></li><li>Измените код: <code>echo 'console.log(2)' > server.js</code></li><li>Соберите снова и увидьте, что <code>npm ci</code> пересобрался</li><li>Перепишите Dockerfile так, чтобы <code>COPY package*.json ./</code> и <code>RUN npm ci</code> шли <b>до</b> <code>COPY . .</code>, соберите дважды и убедитесь: правка кода больше не ломает установку зависимостей</li></ul>",
  hint:"Правильный порядок: FROM → WORKDIR → COPY package*.json ./ → RUN npm ci → COPY . . → CMD. Перезаписать Dockerfile можно тем же echo с \\n.",
  setup(st){
   st.files["/work/package.json"]='{\n  "name": "api",\n  "version": "1.0.0",\n  "dependencies": { "express": "^4.18.0" }\n}';
   st.files["/work/server.js"]="console.log(1)";
   st.files["/work/Dockerfile"]="FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci --omit=dev\nCMD [\"node\",\"server.js\"]";
  },
  checks:[
   {label:"Первая сборка выполнена", test:(st,h)=>h.filter(l=>/^docker\s+build/.test(l)).length>=1},
   {label:"Сборка повторена — кэш сработал", test:(st,h)=>h.filter(l=>/^docker\s+build/.test(l)).length>=2},
   {label:"Изменён <code>server.js</code>", test:st=>st.files["/work/server.js"]!==undefined && st.files["/work/server.js"]!=="console.log(1)"},
   {label:"Dockerfile переписан: манифест копируется до кода", test:st=>{const d=String(st.files["/work/Dockerfile"]||""); const iP=d.indexOf("package"); const iN=d.indexOf("npm ci"); const iC=d.search(/COPY\s+\.\s+\./); return iP>-1&&iN>-1&&iC>-1&&iP<iN&&iN<iC;}},
   {label:"Проведена сборка после исправления", test:(st,h)=>h.filter(l=>/^docker\s+build/.test(l)).length>=4}
  ]},
 {id:"5b", title:".dockerignore в деле",
  brief:"<h3>.dockerignore в деле</h3><p>В каталоге появился мусор: <code>node_modules/big.js</code>, <code>debug.log</code> и <code>.env</code> с паролем. Всё это сейчас уезжает в образ через <code>COPY . .</code>.</p><ul><li>Соберите как есть и посмотрите размер контекста в первой строке вывода</li><li>Создайте <code>.dockerignore</code>, исключив <code>node_modules</code>, <code>*.log</code> и <code>.env</code></li><li>Соберите снова — контекст должен уменьшиться</li><li>Проверьте, что секрет не попал в образ: запустите контейнер и выполните <code>docker exec</code> с <code>cat /app/.env</code> — файла быть не должно</li></ul>",
  hint:"Каждый шаблон — с новой строки. Проверить попадание файла проще всего так: docker run -d --name t app:2.0 sleep 300, затем docker exec t cat /app/.env",
  setup(st){
   st.files["/work/package.json"]='{ "name":"api", "version":"1.0.0" }';
   st.files["/work/server.js"]="console.log('ok')";
   st.files["/work/.env"]="DB_PASSWORD=super-secret-123";
   st.files["/work/debug.log"]="[warn] ".repeat(400);
   st.files["/work/node_modules/big.js"]="x".repeat(9000);
   st.files["/work/Dockerfile"]="FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nCMD [\"node\",\"server.js\"]";
  },
  checks:[
   {label:"Выполнена сборка без .dockerignore", test:(st,h)=>h.filter(l=>/^docker\s+build/.test(l)).length>=1},
   {label:"Создан <code>.dockerignore</code>", test:st=>st.files["/work/.dockerignore"]!==undefined},
   {label:"Исключены node_modules, *.log и .env", test:st=>{const d=String(st.files["/work/.dockerignore"]||""); return /node_modules/.test(d)&&/\*\.log/.test(d)&&/\.env/.test(d);}},
   {label:"Проведена повторная сборка", test:(st,h)=>h.filter(l=>/^docker\s+build/.test(l)).length>=2},
   {label:"Секрет <code>.env</code> в образ не попал", test:st=>{const i=st.images.filter(x=>x.built).pop(); return !!i && i.fs["/app/.env"]===undefined;}}
  ]}
]
},

/* ---------------------------------------------------------- 6 */
{
n:6, id:"multistage", title:"Multi-stage и размер", sub:"Сборочная и рантайм-стадии",
lede:"Как получить образ на 12 МБ вместо 900, разделив сборку и запуск, и чем помогают distroless и scratch.",
theory:`
<p>Для сборки приложения нужен компилятор, менеджер пакетов, заголовочные файлы. Для <em>запуска</em> — только результат. Multi-stage сборка позволяет держать и то и другое в одном Dockerfile, но отдавать наружу лишь финальную стадию.</p>

<h2>Как это выглядит</h2>
<pre><code><span class="c"># ---- стадия 1: собираем ----</span>
<span class="k">FROM</span> golang:1.22-alpine <span class="k">AS</span> builder
<span class="k">WORKDIR</span> /src
<span class="k">COPY</span> go.mod go.sum ./
<span class="k">RUN</span> go mod download
<span class="k">COPY</span> . .
<span class="k">RUN</span> CGO_ENABLED=0 go build -o /out/app ./cmd/server

<span class="c"># ---- стадия 2: только запускаем ----</span>
<span class="k">FROM</span> alpine:3.19
<span class="k">RUN</span> apk add --no-cache ca-certificates
<span class="k">COPY</span> --from=builder /out/app /usr/local/bin/app
<span class="k">USER</span> 10001
<span class="k">ENTRYPOINT</span> [<span class="s">"/usr/local/bin/app"</span>]</code></pre>
<p>В финальный образ попадают только слои второй стадии. Компилятор Go, исходники, кэш модулей — всё остаётся в стадии <code>builder</code> и наружу не выходит.</p>

<figure class="fig">
<svg viewBox="0 0 620 200" role="img" aria-label="Сравнение одностадийной и многостадийной сборки по размеру">
 <g font-family="var(--font-mono)" font-size="10">
  <text x="0" y="12" font-weight="700" fill="var(--signal)">ОДНА СТАДИЯ · 268 MB</text>
  <rect x="0" y="22" width="252" height="26" fill="var(--surface-3)" stroke="var(--line)"/><text x="8" y="39" fill="var(--ink-2)">golang:1.22-alpine · 251 MB</text>
  <rect x="0" y="52" width="252" height="26" fill="var(--surface-3)" stroke="var(--line)"/><text x="8" y="69" fill="var(--ink-2)">кэш модулей · 22 MB</text>
  <rect x="0" y="82" width="252" height="26" fill="var(--surface-3)" stroke="var(--line)"/><text x="8" y="99" fill="var(--ink-2)">исходники · 1 MB</text>
  <rect x="0" y="112" width="252" height="26" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="8" y="129" fill="var(--ink)">бинарник · 6 MB</text>
  <text x="0" y="156" font-size="9" fill="var(--ink-3)">компилятор и исходники едут в продакшен</text>
  <text x="0" y="170" font-size="9" fill="var(--ink-3)">и остаются поверхностью атаки</text>

  <path d="M276 80h44" stroke="var(--accent)" stroke-width="1.2"/><path d="M320 80l-8-4.5v9z" fill="var(--accent)"/>
  <text x="298" y="72" text-anchor="middle" font-size="9" fill="var(--accent)">COPY --from</text>

  <text x="344" y="12" font-weight="700" fill="var(--accent)">ДВЕ СТАДИИ · 14 MB</text>
  <rect x="344" y="22" width="252" height="26" fill="none" stroke="var(--line)" stroke-dasharray="3 3"/><text x="352" y="39" fill="var(--ink-3)">builder — отбрасывается целиком</text>
  <rect x="344" y="82" width="252" height="26" fill="var(--surface-3)" stroke="var(--line)"/><text x="352" y="99" fill="var(--ink-2)">alpine:3.19 · 7.8 MB</text>
  <rect x="344" y="112" width="252" height="26" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="352" y="129" fill="var(--ink)">бинарник · 6 MB</text>
  <text x="344" y="156" font-size="9" fill="var(--ink-3)">в образе только то, что нужно для запуска:</text>
  <text x="344" y="170" font-size="9" fill="var(--ink-3)">быстрее выкладка, меньше уязвимостей</text>
 </g>
</svg>
<figcaption>Стадия builder существует только во время сборки. Финальный образ собирается с нуля и забирает из неё ровно один файл.</figcaption>
</figure>

<h2>Что ещё умеет multi-stage</h2>
<ul>
<li><b>Именованные стадии</b> — <code>AS builder</code>, потом <code>COPY --from=builder</code>. Можно ссылаться и по номеру (<code>--from=0</code>), но имя читается лучше.</li>
<li><b>Сборка до нужной стадии</b> — <code>docker build --target builder .</code> соберёт только сборочную стадию. Удобно для CI: одна стадия <code>test</code>, другая <code>prod</code>.</li>
<li><b>Копирование из чужого образа</b> — <code>COPY --from=nginx:alpine /etc/nginx/nginx.conf /tmp/</code>. Стадия не обязана быть вашей.</li>
<li><b>Параллельность</b> — независимые стадии BuildKit собирает одновременно.</li>
</ul>

<h2>Насколько маленьким может быть финальный образ</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>База</th><th>Размер</th><th>Что внутри</th><th>Когда брать</th></tr>
<tr><td><code>node:20</code></td><td>~1 ГБ</td><td>Debian + компиляторы + git</td><td>Только как сборочная стадия</td></tr>
<tr><td><code>node:20-slim</code></td><td>~220 МБ</td><td>Debian без лишнего</td><td>Нужны нативные модули под glibc</td></tr>
<tr><td><code>node:20-alpine</code></td><td>~135 МБ</td><td>Alpine + musl</td><td>Обычный выбор по умолчанию</td></tr>
<tr><td><code>distroless</code></td><td>2–25 МБ</td><td>Рантайм и сертификаты, без оболочки</td><td>Продакшен, где важна безопасность</td></tr>
<tr><td><code>scratch</code></td><td>0</td><td>Ничего</td><td>Статический бинарник (Go, Rust)</td></tr>
</table></div>
<div class="callout warn"><b>У distroless и scratch нет оболочки</b><p>В такой контейнер нельзя зайти через <code>docker exec -it ... sh</code> — там нет <code>sh</code>. Это и есть плюс с точки зрения безопасности и минус с точки зрения отладки. Приёмы: держать отладочный тег на базе alpine, использовать <code>docker debug</code> или временный sidecar-контейнер с тем же namespace.</p></div>

<h2>Чек-лист «образ распух»</h2>
<ol>
<li><code>docker history образ</code> — найти самые тяжёлые слои.</li>
<li>Тяжёлый базовый образ? Перейти на <code>-alpine</code>/<code>-slim</code> или вынести сборку в отдельную стадию.</li>
<li>Тяжёлый слой <code>COPY</code>? Проверить <code>.dockerignore</code> — скорее всего, туда уехало лишнее.</li>
<li>Тяжёлый <code>RUN</code>? Не забыт ли <code>--no-install-recommends</code>, удалён ли кэш пакетного менеджера в той же инструкции.</li>
<li>Остались ли dev-зависимости? Для npm — <code>npm ci --omit=dev</code>, для Python — не ставить <code>requirements-dev.txt</code>.</li>
</ol>
`,
quiz:[
 {q:"Что попадает в финальный образ при multi-stage сборке?",
  opts:["Все слои всех стадий","Только слои последней стадии (или указанной через --target)","Стадии, помеченные AS","Слои, которые не удалось закэшировать"],
  a:1, why:"Промежуточные стадии живут только во время сборки. В образ идёт последняя стадия плюс то, что вы явно перенесли туда инструкцией <code>COPY --from=</code>."},
 {q:"Зачем нужен <code>docker build --target builder .</code>?",
  opts:["Чтобы собрать только сборочную стадию — например, для прогона тестов в CI","Чтобы указать целевую архитектуру","Чтобы задать имя итогового образа","Чтобы отключить кэш"],
  a:0, why:"<code>--target</code> останавливает сборку на нужной стадии. Типовой приём: стадии <code>deps</code>, <code>test</code>, <code>prod</code> в одном файле, а CI собирает нужную."},
 {q:"Что произойдёт при <code>docker exec -it app sh</code>, если образ собран на distroless?",
  opts:["Откроется оболочка от nonroot","Ошибка: исполняемого файла sh в образе нет","Docker подставит busybox","Контейнер перезапустится"],
  a:1, why:"В distroless нет ни оболочки, ни пакетного менеджера — только рантайм. Это осознанный компромисс: безопаснее, но отлаживать сложнее."},
 {q:"Образ Go-приложения весит 900 МБ. Что даст наибольший эффект?",
  opts:["Сжать бинарник","Вынести компиляцию в стадию builder, а в финальный образ скопировать только бинарник","Добавить .dockerignore","Объединить RUN-инструкции"],
  a:1, why:"Основную массу составляет тулчейн Go. Финальная стадия на alpine или scratch с одним статическим бинарником даёт образ порядка десятка мегабайт."},
 {q:"Можно ли копировать файлы из чужого публичного образа?",
  opts:["Нет, только из своих стадий","Да: <code>COPY --from=nginx:alpine /путь /путь</code>","Только через docker cp","Только если образ собран локально"],
  a:1, why:"<code>--from</code> принимает и имя стадии, и ссылку на образ. Удобно, чтобы забрать конфиг, сертификаты или готовый бинарник."},
 {q:"Почему <code>CGO_ENABLED=0</code> важно при сборке Go под scratch?",
  opts:["Ускоряет компиляцию","Даёт статический бинарник без зависимости от системных библиотек","Уменьшает потребление памяти","Включает оптимизации компилятора"],
  a:1, why:"С включённым cgo бинарник динамически линкуется с libc. В scratch никаких библиотек нет, и такой бинарник не запустится."}
],
labs:[
 {id:"6a", title:"Похудеть в двадцать раз",
  brief:"<h3>Похудеть в двадцать раз</h3><p>В каталоге лежит Go-проект и одностадийный Dockerfile.</p><ul><li>Соберите как есть: <code>docker build -t app:fat .</code> и посмотрите размер в <code>docker images</code></li><li>Перепишите Dockerfile в две стадии: <code>golang:1.22-alpine AS builder</code> собирает бинарник в <code>/out/app</code>, вторая стадия на <code>alpine:3.19</code> забирает его через <code>COPY --from=builder</code></li><li>Соберите: <code>docker build -t app:slim .</code></li><li>Сравните размеры двух образов</li></ul>",
  hint:"Вторая стадия начинается со второго FROM. Пример строки: COPY --from=builder /out/app /usr/local/bin/app — и ENTRYPOINT [\"/usr/local/bin/app\"].",
  setup(st){
   st.files["/work/go.mod"]="module example.com/app\n\ngo 1.22";
   st.files["/work/main.go"]="package main\n\nimport \"fmt\"\n\nfunc main() { fmt.Println(\"hello from go\") }";
   st.files["/work/Dockerfile"]="FROM golang:1.22-alpine\nWORKDIR /src\nCOPY . .\nRUN go build -o /out/app .\nENTRYPOINT [\"/out/app\"]";
  },
  checks:[
   {label:"Собран одностадийный образ <code>app:fat</code>", test:st=>!!findImage(st,"app:fat")},
   {label:"Dockerfile содержит две стадии", test:st=>(String(st.files["/work/Dockerfile"]||"").match(/^FROM/gmi)||[]).length>=2},
   {label:"Есть <code>COPY --from=</code>", test:st=>/COPY\s+--from=/i.test(String(st.files["/work/Dockerfile"]||""))},
   {label:"Собран образ <code>app:slim</code>", test:st=>!!findImage(st,"app:slim")},
   {label:"<code>app:slim</code> минимум в 5 раз меньше <code>app:fat</code>", test:st=>{const a=findImage(st,"app:fat"),b=findImage(st,"app:slim"); return a&&b&&imgSize(b)*5<imgSize(a);}}
  ]},
 {id:"6b", title:"Сборка до нужной стадии",
  brief:"<h3>Сборка до нужной стадии</h3><p>Пусть тот же файл обслуживает и CI, и продакшен.</p><ul><li>Убедитесь, что в Dockerfile сборочная стадия названа <code>builder</code></li><li>Соберите только её: <code>docker build --target builder -t app:build .</code></li><li>Сравните <code>docker images</code>: <code>app:build</code> тяжёлый, потому что содержит весь тулчейн</li><li>Посмотрите слои сборочного образа через <code>docker history app:build</code></li></ul>",
  hint:"--target останавливает сборку на указанной стадии. Имя стадии задаётся как FROM образ AS имя.",
  setup(st){
   st.files["/work/go.mod"]="module example.com/app\n\ngo 1.22";
   st.files["/work/main.go"]="package main\n\nimport \"fmt\"\n\nfunc main() { fmt.Println(\"hello from go\") }";
   st.files["/work/Dockerfile"]="FROM golang:1.22-alpine AS builder\nWORKDIR /src\nCOPY . .\nRUN go build -o /out/app .\n\nFROM alpine:3.19\nCOPY --from=builder /out/app /usr/local/bin/app\nENTRYPOINT [\"/usr/local/bin/app\"]";
  },
  checks:[
   {label:"Dockerfile прочитан, сборочная стадия названа <code>builder</code>", test:(st,h)=>hasCmd(h,/^cat\s+Dockerfile/)&&/AS\s+builder/i.test(String(st.files["/work/Dockerfile"]||""))},
   {label:"Выполнена сборка с <code>--target builder</code>", test:(st,h)=>hasCmd(h,/^docker\s+build\s+.*--target\s+builder/)},
   {label:"Образ <code>app:build</code> создан", test:st=>!!findImage(st,"app:build")},
   {label:"Просмотрены слои сборочного образа", test:(st,h)=>hasCmd(h,/^docker\s+history\s+.*app:build/)}
  ]}
]
},

/* ---------------------------------------------------------- 7 */
{
n:7, id:"data", title:"Данные: тома и монтирование", sub:"volume, bind, tmpfs",
lede:"Где живут данные контейнера, чем именованный том отличается от bind mount и как не потерять базу при пересоздании контейнера.",
theory:`
<p>Записываемый слой контейнера умирает вместе с контейнером. Любые данные, которые должны пережить <code>docker rm</code>, обязаны лежать <em>вне</em> контейнера. Docker предлагает три механизма.</p>

<figure class="fig">
<svg viewBox="0 0 620 214" role="img" aria-label="Три способа монтирования данных в контейнер">
 <g font-family="var(--font-mono)" font-size="9.5">
  <rect x="196" y="18" width="228" height="76" rx="3" fill="var(--surface-3)" stroke="var(--accent)"/>
  <text x="310" y="38" text-anchor="middle" font-weight="700" fill="var(--accent)">КОНТЕЙНЕР</text>
  <rect x="208" y="46" width="204" height="18" fill="var(--surface)" stroke="var(--line)" stroke-dasharray="2 2"/>
  <text x="310" y="59" text-anchor="middle" fill="var(--ink-3)">rw-слой — исчезнет при docker rm</text>
  <text x="310" y="82" text-anchor="middle" fill="var(--ink-2)">/var/lib/postgresql/data · /site · /tmp</text>

  <g stroke="var(--accent-line)" fill="none" stroke-width="1.1">
   <path d="M240 94v34"/><path d="M310 94v34"/><path d="M380 94v34"/>
  </g>
  <g fill="var(--accent-line)"><path d="M240 130l-4-7h8z"/><path d="M310 130l-4-7h8z"/><path d="M380 130l-4-7h8z"/></g>

  <rect x="10" y="130" width="190" height="66" rx="3" fill="var(--accent-soft)" stroke="var(--accent-line)"/>
  <text x="20" y="148" font-weight="700" fill="var(--ink)">volume — именованный том</text>
  <text x="20" y="163" fill="var(--ink-2)">-v pgdata:/var/lib/.../data</text>
  <text x="20" y="177" fill="var(--ink-3)">хранится в /var/lib/docker/volumes</text>
  <text x="20" y="190" fill="var(--ink-3)">для БД, очередей, состояния</text>

  <rect x="212" y="130" width="196" height="66" rx="3" fill="var(--surface-3)" stroke="var(--line)"/>
  <text x="222" y="148" font-weight="700" fill="var(--ink)">bind — каталог хоста</text>
  <text x="222" y="163" fill="var(--ink-2)">-v $(pwd)/site:/site</text>
  <text x="222" y="177" fill="var(--ink-3)">путь задаёте вы · права хоста</text>
  <text x="222" y="190" fill="var(--ink-3)">для исходников в разработке</text>

  <rect x="420" y="130" width="190" height="66" rx="3" fill="var(--surface-3)" stroke="var(--line)" stroke-dasharray="3 3"/>
  <text x="430" y="148" font-weight="700" fill="var(--ink)">tmpfs — только в памяти</text>
  <text x="430" y="163" fill="var(--ink-2)">--tmpfs /tmp</text>
  <text x="430" y="177" fill="var(--ink-3)">на диск не попадает</text>
  <text x="430" y="190" fill="var(--ink-3)">для секретов и временных файлов</text>
 </g>
</svg>
<figcaption>Именованный том, привязка каталога хоста и файловая система в памяти. Выбор зависит от того, кто владеет данными — Docker, вы или никто.</figcaption>
</figure>

<h2>Именованный том (volume)</h2>
<p>Хранилищем управляет Docker: каталог внутри <code>/var/lib/docker/volumes/&lt;имя&gt;/_data</code>. Вы работаете с ним по имени и не думаете о путях на хосте.</p>
<pre><code>docker volume create pgdata
docker run -d --name db \\
  -e POSTGRES_PASSWORD=secret \\
  -v pgdata:/var/lib/postgresql/data \\
  postgres:16-alpine

<span class="c"># контейнер можно снести и пересоздать — данные останутся в томе</span>
docker rm -f db
docker run -d --name db -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data postgres:16-alpine</code></pre>
<p>Это способ по умолчанию для всего, что имеет состояние: баз данных, очередей, загруженных пользователями файлов.</p>

<h2>Bind mount</h2>
<p>Каталог хоста подставляется в контейнер напрямую. Изменения видны мгновенно в обе стороны — отсюда главный сценарий: разработка с горячей перезагрузкой.</p>
<pre><code>docker run -d --name web -p 8080:80 \\
  -v <span class="s">"$(pwd)/site"</span>:/usr/share/nginx/html:ro \\
  nginx:alpine</code></pre>
<div class="callout warn"><b>Два подводных камня bind mount</b><ul><li><b>Затенение.</b> Монтирование в непустой каталог <em>скрывает</em> его содержимое образа. Смонтировали пустой каталог в <code>/app</code> — приложение исчезло.</li><li><b>Права.</b> UID внутри контейнера и на хосте не совпадают, отсюда «permission denied» на смонтированных файлах. Лечится флагом <code>--user</code> или подгонкой прав.</li></ul></div>

<h2>tmpfs</h2>
<p><code>--tmpfs /tmp</code> монтирует файловую систему в оперативной памяти. Ничего не записывается на диск, всё исчезает при остановке. Подходит для временных файлов и для смонтированных секретов.</p>

<h2>Флаги и опции</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Запись</th><th>Смысл</th></tr>
<tr><td><code>-v имя:/путь</code></td><td>Именованный том</td></tr>
<tr><td><code>-v /абс/путь:/путь</code></td><td>Bind mount (источник начинается со <code>/</code> или <code>.</code>)</td></tr>
<tr><td><code>-v /путь</code></td><td>Анонимный том — Docker создаст том со случайным именем</td></tr>
<tr><td><code>:ro</code> в конце</td><td>Только чтение — хороший тон для конфигов и статики</td></tr>
<tr><td><code>--mount type=bind,source=...,target=...</code></td><td>Многословный, но явный синтаксис; ошибается в путях реже</td></tr>
</table></div>
<div class="callout trap"><b>Анонимные тома копятся незаметно</b><p>Если в Dockerfile образа есть <code>VOLUME /data</code>, то каждый запуск <em>без</em> <code>-v</code> создаёт новый анонимный том. Через месяц <code>docker volume ls</code> покажет сотню томов с шестнадцатеричными именами и десятки гигабайт. Лечится флагом <code>--rm</code> (удаляет анонимные тома вместе с контейнером) и периодическим <code>docker volume prune</code>.</p></div>

<h2>Резервная копия тома</h2>
<pre><code><span class="c"># выгрузить том в архив на хосте</span>
docker run --rm -v pgdata:/data -v <span class="s">"$(pwd)"</span>:/backup alpine \\
  tar czf /backup/pgdata.tar.gz -C /data .

<span class="c"># восстановить в новый том</span>
docker run --rm -v pgdata_new:/data -v <span class="s">"$(pwd)"</span>:/backup alpine \\
  tar xzf /backup/pgdata.tar.gz -C /data</code></pre>
`,
quiz:[
 {q:"Куда попадут данные, записанные в контейнер без единого тома?",
  opts:["В именованный том по умолчанию","В записываемый слой контейнера — и исчезнут при docker rm","В каталог /var/lib/docker/volumes","В оперативную память"],
  a:1, why:"Без монтирования всё пишется в тонкий rw-слой контейнера. Он удаляется вместе с контейнером — отсюда классическая потеря базы данных."},
 {q:"Чем именованный том лучше bind mount для базы данных?",
  opts:["Он быстрее на любой ОС","Управляется Docker, не зависит от путей и прав на хосте, переносим между машинами","Он автоматически резервируется","Он шифруется по умолчанию"],
  a:1, why:"Bind привязывает вас к конкретному пути и правам конкретного хоста. Том — абстракция, которой управляет Docker; на macOS и Windows он ещё и заметно быстрее."},
 {q:"Вы смонтировали пустой каталог хоста в <code>/app</code>, где в образе лежало приложение. Что увидит контейнер?",
  opts:["Объединение файлов образа и хоста","Пустой каталог — монтирование затеняет содержимое образа","Ошибку при запуске","Файлы образа, доступные только для чтения"],
  a:1, why:"Точка монтирования полностью перекрывает то, что лежало в образе по этому пути. Файлы никуда не делись, но изнутри они больше не видны."},
 {q:"Что делает <code>:ro</code> в конце <code>-v ./conf:/etc/app:ro</code>?",
  opts:["Включает удалённый доступ","Монтирует только для чтения — контейнер не сможет изменить файлы","Перезагружает конфиг при изменении","Копирует файлы вместо монтирования"],
  a:1, why:"Хорошая практика для конфигов, статики и любых данных, которые контейнер должен только читать: случайная или вредоносная запись не пройдёт."},
 {q:"Откуда берутся десятки томов со случайными шестнадцатеричными именами?",
  opts:["Docker создаёт их для кэша слоёв","Это анонимные тома от инструкции VOLUME в образах, запущенных без -v","Это остатки удалённых образов","Их создаёт docker compose"],
  a:1, why:"Каждый запуск образа с <code>VOLUME</code> без явного <code>-v</code> порождает новый анонимный том. Убирает <code>docker volume prune</code>, предотвращает <code>--rm</code>."},
 {q:"Когда уместен <code>--tmpfs</code>?",
  opts:["Для базы данных, чтобы было быстрее","Для временных файлов и секретов, которые не должны попадать на диск","Для исходников при разработке","Для логов приложения"],
  a:1, why:"tmpfs живёт в памяти и исчезает при остановке контейнера. Это ровно то, что нужно временным файлам и смонтированным секретам, и категорически не подходит данным, которые надо сохранить."}
],
labs:[
 {id:"7a", title:"Данные переживают контейнер",
  brief:"<h3>Данные переживают контейнер</h3><p>Докажите, что том живёт отдельно от контейнера.</p><ul><li>Создайте том: <code>docker volume create appdata</code></li><li>Запустите контейнер с этим томом: <code>docker run -d --name box -v appdata:/data alpine:3.19 sleep 600</code></li><li>Запишите файл: <code>docker exec box sh -c \"echo важные-данные > /data/notes.txt\"</code></li><li>Уничтожьте контейнер: <code>docker rm -f box</code></li><li>Создайте новый контейнер с тем же томом и прочитайте файл: <code>docker exec box2 cat /data/notes.txt</code></li></ul>",
  hint:"Второй контейнер запускайте с тем же -v appdata:/data, но с новым именем — например box2.",
  setup(st){},
  checks:[
   {label:"Создан том <code>appdata</code>", test:st=>!!V(st,"appdata")},
   {label:"Файл записан в том", test:st=>{const s=st.volStore["appdata"]||{}; return Object.keys(s).some(k=>/notes/.test(k));}},
   {label:"Первый контейнер удалён", test:(st,h)=>hasCmd(h,/^docker\s+rm\s+.*box(\s|$)/)},
   {label:"Запущен новый контейнер с тем же томом", test:st=>st.containers.some(c=>c.mounts.some(m=>m.source==="appdata"))},
   {label:"Данные прочитаны из нового контейнера", test:(st,h)=>hasCmd(h,/^docker\s+exec\s+\S+\s+cat\s+\/data\/notes\.txt/)}
  ]},
 {id:"7b", title:"Bind mount для разработки",
  brief:"<h3>Bind mount для разработки</h3><p>В каталоге <code>/work/site</code> лежит <code>index.html</code>. Подключите его в nginx напрямую — без пересборки образа.</p><ul><li>Запустите: <code>docker run -d --name dev -p 8080:80 -v /work/site:/usr/share/nginx/html:ro nginx:alpine</code></li><li>Проверьте отдачу: <code>curl http://localhost:8080</code></li><li>Отредактируйте файл на хосте: <code>echo '&lt;h1&gt;версия 2&lt;/h1&gt;' > site/index.html</code></li><li>Снова выполните curl — новая версия отдаётся без перезапуска контейнера</li><li>Убедитесь, что режим ro работает: попытка записи изнутри должна дать ошибку — <code>docker exec dev sh -c \"echo x > /usr/share/nginx/html/index.html\"</code></li></ul>",
  hint:"В эмуляторе рабочий каталог — /work, поэтому источник для bind пишите как /work/site (или ./site).",
  setup(st){ st.files["/work/site/index.html"]="<h1>версия 1</h1>"; },
  checks:[
   {label:"Контейнер <code>dev</code> запущен с bind mount", test:st=>{const c=C(st,"dev"); return !!c&&c.mounts.some(m=>m.type==="bind"&&/site/.test(m.source));}},
   {label:"Монтирование только для чтения (<code>:ro</code>)", test:st=>{const c=C(st,"dev"); return !!c&&c.mounts.some(m=>m.type==="bind"&&m.ro);}},
   {label:"Страница получена через curl", test:(st,h)=>hasCmd(h,/^curl\s+.*8080/)},
   {label:"Файл на хосте изменён", test:st=>/версия 2|version 2/i.test(String(st.files["/work/site/index.html"]||""))},
   {label:"Проверена невозможность записи изнутри", test:(st,h)=>hasCmd(h,/^docker\s+exec\s+dev\s+.*nginx\/html/)}
  ]},
 {id:"7c", title:"Уборка томов",
  brief:"<h3>Уборка томов</h3><p>Посмотрите, как анонимные тома появляются сами собой.</p><ul><li>Запустите postgres без указания тома: <code>docker run -d --name db -e POSTGRES_PASSWORD=secret postgres:16-alpine</code></li><li>Посмотрите <code>docker volume ls</code> — появился том со случайным именем: его создала инструкция VOLUME в образе</li><li>Удалите контейнер: <code>docker rm -f db</code></li><li>Убедитесь, что том остался, и вычистите его: <code>docker volume prune</code></li></ul>",
  hint:"docker volume prune удаляет тома, не связанные ни с одним контейнером.",
  setup(st){},
  checks:[
   {label:"postgres запущен без явного тома", test:(st,h)=>hasCmd(h,/^docker\s+run\s+(?!.*-v\s)(?!.*--volume).*postgres/)},
   {label:"Анонимный том появился в списке", test:(st,h)=>hasCmd(h,/^docker\s+volume\s+ls/)},
   {label:"Контейнер удалён", test:(st,h)=>hasCmd(h,/^docker\s+rm\s+.*db(\s|$)/)},
   {label:"Выполнена очистка <code>docker volume prune</code>", test:(st,h)=>hasCmd(h,/^docker\s+volume\s+prune/)},
   {label:"После очистки неиспользуемых томов не осталось", test:(st,h)=>hasCmd(h,/^docker\s+volume\s+prune/)&&hasCmd(h,/^docker\s+run\s+.*postgres/)&&!st.volumes.some(v=>!st.containers.some(c=>c.mounts.some(m=>m.source===v.name)))}
  ]}
]
},

/* ---------------------------------------------------------- 8 */
{
n:8, id:"network", title:"Сети", sub:"bridge, DNS, публикация портов",
lede:"Как контейнеры находят друг друга по имени, чем сеть по умолчанию хуже пользовательской и что на самом деле делает -p.",
theory:`
<p>Каждый контейнер получает собственный сетевой namespace: свой сетевой интерфейс, свою таблицу маршрутов, свои порты. Как этот namespace подключён к внешнему миру, определяет <b>сетевой драйвер</b>.</p>

<h2>Драйверы</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Драйвер</th><th>Что даёт</th><th>Когда нужен</th></tr>
<tr><td><code>bridge</code></td><td>Виртуальный коммутатор на хосте; контейнеры получают приватные IP и выходят наружу через NAT</td><td>По умолчанию для всего на одном хосте</td></tr>
<tr><td><code>host</code></td><td>Контейнер использует сетевой стек хоста напрямую; изоляции сети нет, <code>-p</code> не нужен и не работает</td><td>Когда критична задержка или нужен весь диапазон портов</td></tr>
<tr><td><code>none</code></td><td>Только loopback, никакого внешнего доступа</td><td>Полностью изолированные задачи</td></tr>
<tr><td><code>overlay</code></td><td>Сеть поверх нескольких хостов</td><td>Swarm, кластерные сценарии</td></tr>
</table></div>

<h2>Главное различие: bridge по умолчанию и пользовательский bridge</h2>
<p>Сеть <code>bridge</code>, которая существует сразу после установки, — это <em>legacy</em>. В ней нет встроенного DNS: контейнеры видят друг друга только по IP-адресам, которые меняются при каждом перезапуске. Как только вы создаёте <b>свою</b> сеть, включается встроенный DNS-резолвер Docker на <code>127.0.0.11</code>, и контейнеры находят друг друга по именам.</p>

<figure class="fig">
<svg viewBox="0 0 620 254" role="img" aria-label="Сравнение сети bridge по умолчанию и пользовательской сети">
 <g font-family="var(--font-mono)" font-size="9.5">
  <text x="0" y="12" font-weight="700" fill="var(--signal)">bridge по умолчанию</text>
  <rect x="0" y="20" width="286" height="106" rx="3" fill="var(--surface-3)" stroke="var(--line)" stroke-dasharray="3 3"/>
  <rect x="16" y="44" width="110" height="42" rx="2" fill="var(--surface)" stroke="var(--line)"/><text x="71" y="62" text-anchor="middle" fill="var(--ink)">web</text><text x="71" y="76" text-anchor="middle" fill="var(--ink-3)">172.17.0.2</text>
  <rect x="160" y="44" width="110" height="42" rx="2" fill="var(--surface)" stroke="var(--line)"/><text x="215" y="62" text-anchor="middle" fill="var(--ink)">db</text><text x="215" y="76" text-anchor="middle" fill="var(--ink-3)">172.17.0.3</text>
  <path d="M126 65h34" stroke="var(--err)" stroke-width="1.2"/>
  <path d="M136 58l14 14M150 58l-14 14" stroke="var(--err)" stroke-width="1.4"/>
  <text x="143" y="104" text-anchor="middle" fill="var(--err)">curl http://db — не резолвится</text>
  <text x="143" y="118" text-anchor="middle" fill="var(--ink-3)">только по IP, а он меняется</text>

  <text x="334" y="12" font-weight="700" fill="var(--accent)">пользовательская сеть app-net</text>
  <rect x="334" y="20" width="286" height="106" rx="3" fill="var(--accent-soft)" stroke="var(--accent)"/>
  <rect x="350" y="44" width="110" height="42" rx="2" fill="var(--surface)" stroke="var(--accent-line)"/><text x="405" y="62" text-anchor="middle" fill="var(--ink)">web</text><text x="405" y="76" text-anchor="middle" fill="var(--ink-3)">172.18.0.2</text>
  <rect x="494" y="44" width="110" height="42" rx="2" fill="var(--surface)" stroke="var(--accent-line)"/><text x="549" y="62" text-anchor="middle" fill="var(--ink)">db</text><text x="549" y="76" text-anchor="middle" fill="var(--ink-3)">172.18.0.3</text>
  <path d="M460 65h34" stroke="var(--ok)" stroke-width="1.2"/><path d="M494 65l-7-4v8z" fill="var(--ok)"/>
  <text x="477" y="104" text-anchor="middle" fill="var(--ok)">curl http://db — работает</text>
  <text x="477" y="118" text-anchor="middle" fill="var(--ink-3)">встроенный DNS 127.0.0.11</text>

  <path d="M0 146h620" stroke="var(--line)"/>
  <text x="0" y="168" font-weight="700" fill="var(--ink-3)">ПУБЛИКАЦИЯ ПОРТА</text>
  <rect x="0" y="178" width="150" height="34" rx="2" fill="var(--surface-3)" stroke="var(--line)"/><text x="75" y="199" text-anchor="middle" fill="var(--ink-2)">браузер :8080</text>
  <path d="M154 195h60" stroke="var(--signal)" stroke-width="1.2"/><path d="M214 195l-7-4v8z" fill="var(--signal)"/>
  <rect x="218" y="178" width="170" height="34" rx="2" fill="var(--surface-3)" stroke="var(--signal)"/><text x="303" y="199" text-anchor="middle" fill="var(--ink-2)">хост 0.0.0.0:8080 (NAT)</text>
  <path d="M392 195h60" stroke="var(--signal)" stroke-width="1.2"/><path d="M452 195l-7-4v8z" fill="var(--signal)"/>
  <rect x="456" y="178" width="164" height="34" rx="2" fill="var(--surface)" stroke="var(--accent-line)"/><text x="538" y="199" text-anchor="middle" fill="var(--ink)">контейнер :80</text>
  <text x="0" y="230" fill="var(--ink-3)">-p 8080:80 — слева порт хоста, справа порт контейнера.</text>
  <text x="0" y="244" fill="var(--ink-3)">Внутри сети контейнеры общаются напрямую — публикация им не нужна.</text>
 </g>
</svg>
<figcaption>Имя контейнера работает как DNS-имя только в пользовательской сети. Публикация портов нужна лишь для доступа снаружи хоста.</figcaption>
</figure>

<h2>Публикация портов</h2>
<pre><code>-p 8080:80          <span class="c"># хост:8080 → контейнер:80, на всех интерфейсах</span>
-p 127.0.0.1:8080:80 <span class="c"># только с локальной машины — важно для баз</span>
-p 80               <span class="c"># случайный свободный порт хоста → 80</span>
-P                  <span class="c"># опубликовать всё, что объявлено в EXPOSE</span></code></pre>
<div class="callout trap"><b>Порядок в -p путают постоянно</b><p>Слева <b>хост</b>, справа <b>контейнер</b>. <code>-p 5432:5432</code> для базы означает, что ваш postgres теперь доступен из интернета, если на хосте нет фаервола. Базам порт публиковать обычно вообще не надо — приложение достучится до них внутри сети по имени.</p></div>

<h2>Практические команды</h2>
<pre><code>docker network create app-net
docker run -d --name db  --network app-net -e POSTGRES_PASSWORD=secret postgres:16-alpine
docker run -d --name api --network app-net -p 8080:3000 myapi:1.0

<span class="c"># api обращается к базе так: postgres://db:5432 — по имени контейнера</span>

docker network inspect app-net     <span class="c"># кто подключён и с какими IP</span>
docker network connect app-net web <span class="c"># подключить существующий контейнер</span>
docker network disconnect app-net web</code></pre>

<h2>Как изолировать базу правильно</h2>
<p>Типовая схема на одном хосте: две сети. Публичная <code>frontend</code>, где живут обратный прокси и приложение, и внутренняя <code>backend</code>, где живут приложение и база. Прокси не видит базу вовсе, база не имеет опубликованных портов, а приложение подключено к обеим сетям. Для сети можно дополнительно указать <code>--internal</code> — тогда из неё вообще нет выхода наружу.</p>
<div class="callout"><b>Что запомнить про имена</b><ul><li>Имя контейнера = DNS-имя внутри пользовательской сети.</li><li><code>--network-alias</code> добавляет дополнительные имена; в compose имя сервиса и так становится алиасом.</li><li>Внутри сети обращаться нужно к <em>внутреннему</em> порту (80, 5432), а не к опубликованному.</li><li><code>localhost</code> внутри контейнера — это сам контейнер, а не хост. Для доступа к хосту есть <code>host.docker.internal</code>.</li></ul></div>
`,
quiz:[
 {q:"Два контейнера в сети bridge по умолчанию. Почему <code>curl http://db</code> из первого не работает?",
  opts:["Нужно опубликовать порт через -p","В сети bridge по умолчанию нет DNS — имена контейнеров не резолвятся","Требуется флаг --link","Нужно совпадение подсетей"],
  a:1, why:"Автоматический DNS работает только в пользовательских сетях. В legacy-сети bridge остаются лишь IP-адреса, которые меняются при перезапуске. Решение — <code>docker network create</code>."},
 {q:"Что означает <code>-p 8080:80</code>?",
  opts:["Порт 8080 контейнера доступен на порту 80 хоста","Порт 80 контейнера доступен на порту 8080 хоста","Контейнер слушает оба порта","Порты 8080–80 проброшены диапазоном"],
  a:1, why:"Формат <code>ХОСТ:КОНТЕЙНЕР</code>. Снаружи обращаемся к 8080, внутрь трафик приходит на 80."},
 {q:"Приложение и база в одной пользовательской сети. Какой адрес базы должен быть в строке подключения?",
  opts:["localhost:5432","db:5432 — по имени контейнера и внутреннему порту","172.17.0.1:5432","host.docker.internal:5432"],
  a:1, why:"Внутри сети контейнер обращается к соседу по имени и по <em>внутреннему</em> порту. <code>localhost</code> внутри контейнера указывает на него самого."},
 {q:"Что делает <code>--network host</code>?",
  opts:["Добавляет контейнер в сеть с именем host","Отдаёт контейнеру сетевой стек хоста: изоляции сети нет и -p не действует","Разрешает доступ к хосту по имени","Создаёт мост между двумя хостами"],
  a:1, why:"Контейнер слушает порты хоста напрямую. Быстрее и без NAT, но пропадает изоляция и возможны конфликты портов; на macOS и Windows работает иначе, чем на Linux."},
 {q:"Почему для базы данных обычно не публикуют порт наружу?",
  opts:["Docker это запрещает","Приложение достучится до неё внутри сети по имени, а публикация открывает базу всему миру","Публикация замедляет запросы","Порт 5432 зарезервирован"],
  a:1, why:"Публикация нужна только для доступа <em>снаружи хоста</em>. Внутри пользовательской сети контейнеры общаются напрямую. Лишний <code>-p 5432:5432</code> — типовая дыра в безопасности."},
 {q:"К чему обращается <code>localhost</code> внутри контейнера?",
  opts:["К хосту","К самому контейнеру","К шлюзу сети docker0","К первому контейнеру в сети"],
  a:1, why:"У контейнера свой сетевой namespace, и loopback в нём собственный. Чтобы дотянуться до хоста, используют <code>host.docker.internal</code> (Docker Desktop) или IP шлюза."}
],
labs:[
 {id:"8a", title:"Почему нужна своя сеть",
  brief:"<h3>Почему нужна своя сеть</h3><p>Сначала воспроизведите проблему, потом решите её.</p><ul><li>Запустите два контейнера в сети по умолчанию: <code>docker run -d --name web nginx:alpine</code> и <code>docker run -d --name client alpine:3.19 sleep 600</code></li><li>Попробуйте из client достучаться до web по имени: <code>docker exec client curl http://web</code> — не сработает</li><li>Создайте сеть: <code>docker network create app-net</code></li><li>Подключите оба контейнера: <code>docker network connect app-net web</code> и то же для client</li><li>Повторите curl — теперь имя резолвится</li></ul>",
  hint:"Обращайтесь к внутреннему порту 80, публиковать ничего не нужно: оба контейнера в одной сети.",
  setup(st){},
  checks:[
   {label:"Запущены <code>web</code> и <code>client</code>", test:st=>!!C(st,"web")&&!!C(st,"client")},
   {label:"Попытка обращения по имени в сети по умолчанию", test:(st,h)=>hasCmd(h,/^docker\s+exec\s+client\s+curl/)},
   {label:"Создана сеть <code>app-net</code>", test:st=>!!NW(st,"app-net")},
   {label:"Оба контейнера подключены к <code>app-net</code>", test:st=>{const w=C(st,"web"),c=C(st,"client"); return !!w&&!!c&&!!w.networks["app-net"]&&!!c.networks["app-net"];}},
   {label:"Обращение по имени выполнено после подключения", test:(st,h)=>{const i=h.findIndex(l=>/^docker\s+network\s+connect/.test(l)); return i>-1&&h.slice(i).some(l=>/^docker\s+exec\s+client\s+curl/.test(l));}}
  ]},
 {id:"8b", title:"Изолировать базу",
  brief:"<h3>Изолировать базу</h3><p>Соберите правильную схему: наружу торчит только веб, база доступна лишь изнутри.</p><ul><li>Создайте сеть <code>backend</code></li><li>Запустите базу <b>без публикации портов</b>: <code>docker run -d --name db --network backend -e POSTGRES_PASSWORD=secret postgres:16-alpine</code></li><li>Запустите веб в той же сети с публикацией: <code>docker run -d --name web --network backend -p 8080:80 nginx:alpine</code></li><li>Проверьте: снаружи <code>curl http://localhost:5432</code> не отвечает, а <code>curl http://localhost:8080</code> отвечает</li><li>Убедитесь, что изнутри база видна по имени: <code>docker exec web ping db</code></li></ul>",
  hint:"У db не должно быть ни одного -p. Проверка изнутри — ping или nslookup по имени db.",
  setup(st){},
  checks:[
   {label:"Создана сеть <code>backend</code>", test:st=>!!NW(st,"backend")},
   {label:"База запущена без опубликованных портов", test:st=>{const c=C(st,"db"); return !!c&&c.ports.length===0&&!!c.networks["backend"];}},
   {label:"Веб опубликован на порту 8080 в той же сети", test:st=>{const c=C(st,"web"); return !!c&&c.ports.some(p=>p.host===8080)&&!!c.networks["backend"];}},
   {label:"Веб отвечает снаружи", test:(st,h)=>hasCmd(h,/^curl\s+.*8080/)},
   {label:"Изнутри сети база доступна по имени", test:(st,h)=>hasCmd(h,/^docker\s+exec\s+\S+\s+(ping|nslookup|curl)\s+.*\bdb\b/)}
  ]}
]
},
