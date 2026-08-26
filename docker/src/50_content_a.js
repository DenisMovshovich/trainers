/* ============================================================
   Содержание курса
   ============================================================ */
const hasCmd=(h,re)=>h.some(l=>re.test(l));
const C=(st,n)=>st.containers.find(c=>c.name===n);
const CS=(st,f)=>st.containers.filter(f);
const V=(st,n)=>st.volumes.find(v=>v.name===n);
const NW=(st,n)=>st.networks.find(x=>x.name===n);

const MODULES=[
/* ---------------------------------------------------------- 1 */
{
n:1, id:"intro", title:"Что такое Docker", sub:"Контейнер, образ, демон",
lede:"Зачем нужны контейнеры, чем они отличаются от виртуальных машин и что происходит, когда вы набираете docker run.",
theory:`
<p><b>Docker</b> — это инструмент, который упаковывает приложение вместе со всем его окружением (библиотеками, интерпретатором, конфигами) в один переносимый артефакт и запускает его изолированно от остальной системы. Классическая проблема «у меня на ноутбуке работает, а на сервере нет» решается тем, что на сервер приезжает ровно тот же самый образ, который вы собрали и протестировали.</p>

<h2>Контейнер — это не виртуальная машина</h2>
<p>Виртуальная машина эмулирует железо: у неё своё ядро, свой процесс загрузки, свои гигабайты диска. Контейнер — это <em>обычный процесс операционной системы</em>, которому ядро Linux наврало о том, что он видит. Ядро одно на всех, поэтому контейнер стартует за десятки миллисекунд и весит мегабайты.</p>

<figure class="fig">
<svg viewBox="0 0 620 250" role="img" aria-label="Сравнение архитектуры виртуальных машин и контейнеров">
  <g font-family="var(--font-mono)" font-size="10.5">
    <text x="0" y="12" font-weight="700" fill="var(--ink-3)" letter-spacing="1">ВИРТУАЛЬНЫЕ МАШИНЫ</text>
    <rect x="0" y="196" width="286" height="26" fill="var(--surface-2)" stroke="var(--line)"/><text x="143" y="213" text-anchor="middle" fill="var(--ink-2)">Железо</text>
    <rect x="0" y="166" width="286" height="26" fill="var(--surface-2)" stroke="var(--line)"/><text x="143" y="183" text-anchor="middle" fill="var(--ink-2)">Хостовая ОС</text>
    <rect x="0" y="136" width="286" height="26" fill="var(--surface-3)" stroke="var(--line)"/><text x="143" y="153" text-anchor="middle" fill="var(--ink-2)">Гипервизор</text>
    <g>
      <rect x="0" y="26" width="90" height="106" fill="none" stroke="var(--signal)" stroke-width="1.2"/>
      <rect x="6" y="98" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="45" y="116" text-anchor="middle" font-size="9" fill="var(--ink-2)">Гостевая ОС</text>
      <rect x="6" y="66" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="45" y="84" text-anchor="middle" font-size="9" fill="var(--ink-2)">Библиотеки</text>
      <rect x="6" y="34" width="78" height="28" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="45" y="52" text-anchor="middle" font-size="9" fill="var(--ink)">Прил. A</text>
    </g>
    <g transform="translate(98,0)">
      <rect x="0" y="26" width="90" height="106" fill="none" stroke="var(--signal)" stroke-width="1.2"/>
      <rect x="6" y="98" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="45" y="116" text-anchor="middle" font-size="9" fill="var(--ink-2)">Гостевая ОС</text>
      <rect x="6" y="66" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="45" y="84" text-anchor="middle" font-size="9" fill="var(--ink-2)">Библиотеки</text>
      <rect x="6" y="34" width="78" height="28" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="45" y="52" text-anchor="middle" font-size="9" fill="var(--ink)">Прил. B</text>
    </g>
    <g transform="translate(196,0)">
      <rect x="0" y="26" width="90" height="106" fill="none" stroke="var(--signal)" stroke-width="1.2"/>
      <rect x="6" y="98" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="45" y="116" text-anchor="middle" font-size="9" fill="var(--ink-2)">Гостевая ОС</text>
      <rect x="6" y="66" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="45" y="84" text-anchor="middle" font-size="9" fill="var(--ink-2)">Библиотеки</text>
      <rect x="6" y="34" width="78" height="28" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="45" y="52" text-anchor="middle" font-size="9" fill="var(--ink)">Прил. C</text>
    </g>

    <text x="334" y="12" font-weight="700" fill="var(--accent)" letter-spacing="1">КОНТЕЙНЕРЫ</text>
    <rect x="334" y="196" width="286" height="26" fill="var(--surface-2)" stroke="var(--line)"/><text x="477" y="213" text-anchor="middle" fill="var(--ink-2)">Железо</text>
    <rect x="334" y="166" width="286" height="26" fill="var(--surface-2)" stroke="var(--line)"/><text x="477" y="183" text-anchor="middle" fill="var(--ink-2)">Хостовая ОС · одно ядро Linux</text>
    <rect x="334" y="136" width="286" height="26" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="477" y="153" text-anchor="middle" fill="var(--ink)">Docker Engine</text>
    <g>
      <rect x="334" y="66" width="90" height="66" fill="none" stroke="var(--accent)" stroke-width="1.2"/>
      <rect x="340" y="98" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="379" y="116" text-anchor="middle" font-size="9" fill="var(--ink-2)">Библиотеки</text>
      <rect x="340" y="72" width="78" height="22" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="379" y="87" text-anchor="middle" font-size="9" fill="var(--ink)">Прил. A</text>
    </g>
    <g transform="translate(98,0)">
      <rect x="334" y="66" width="90" height="66" fill="none" stroke="var(--accent)" stroke-width="1.2"/>
      <rect x="340" y="98" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="379" y="116" text-anchor="middle" font-size="9" fill="var(--ink-2)">Библиотеки</text>
      <rect x="340" y="72" width="78" height="22" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="379" y="87" text-anchor="middle" font-size="9" fill="var(--ink)">Прил. B</text>
    </g>
    <g transform="translate(196,0)">
      <rect x="334" y="66" width="90" height="66" fill="none" stroke="var(--accent)" stroke-width="1.2"/>
      <rect x="340" y="98" width="78" height="28" fill="var(--surface-2)" stroke="var(--line)"/><text x="379" y="116" text-anchor="middle" font-size="9" fill="var(--ink-2)">Библиотеки</text>
      <rect x="340" y="72" width="78" height="22" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="379" y="87" text-anchor="middle" font-size="9" fill="var(--ink)">Прил. C</text>
    </g>
    <text x="477" y="46" text-anchor="middle" font-size="9" fill="var(--ink-3)">гостевых ОС нет: экономия ~1 ГБ и ~30 с старта</text>
  </g>
</svg>
<figcaption>Три виртуальные машины несут три ядра и три установленные ОС. Три контейнера делят одно ядро хоста и содержат только то, чего нет в базовом слое.</figcaption>
</figure>

<h2>Чем ядро «врёт» процессу</h2>
<p>Изоляция собирается из трёх механизмов ядра Linux, и Docker их только оркеструет:</p>
<ul>
<li><b>namespaces</b> — что процесс <em>видит</em>. Отдельные пространства имён для PID (внутри контейнера ваш процесс — номер 1), сети (свой сетевой стек и свои интерфейсы), точек монтирования, имени хоста, пользователей и IPC.</li>
<li><b>cgroups</b> (control groups) — сколько процесс <em>может взять</em>. Лимиты и учёт CPU, памяти, дискового и сетевого ввода-вывода.</li>
<li><b>union-файловая система</b> (обычно overlay2) — как собирается корневая ФС: несколько слоёв только для чтения плюс один тонкий слой для записи сверху.</li>
</ul>
<div class="callout"><b>Следствие</b><p>Контейнер использует ядро хоста. Поэтому Linux-образ не может запуститься на «голой» Windows или macOS — там Docker Desktop поднимает маленькую Linux-виртуалку, внутри которой уже работают контейнеры. И по той же причине контейнер с ARM-образом не запустится на x86 без эмуляции.</p></div>

<h2>Образ и контейнер — разные вещи</h2>
<p>Это первое, что нужно уложить в голове:</p>
<div class="tbl-wrap"><table class="t">
<tr><th></th><th>Образ (image)</th><th>Контейнер (container)</th></tr>
<tr><td><b>Что это</b></td><td>Неизменяемый шаблон: набор слоёв файловой системы + метаданные (какую команду запускать, какие переменные окружения, какой порт)</td><td>Запущенный (или остановленный) экземпляр образа: те же слои плюс тонкий записываемый слой сверху</td></tr>
<tr><td><b>Аналогия</b></td><td>Класс, инсталлятор, шаблон</td><td>Объект, установленная программа, экземпляр</td></tr>
<tr><td><b>Сколько</b></td><td>Один образ</td><td>Сколько угодно контейнеров из него</td></tr>
<tr><td><b>Команда</b></td><td><code>docker images</code></td><td><code>docker ps -a</code></td></tr>
</table></div>

<h2>Что происходит при docker run</h2>
<p>Клиент <code>docker</code> — это тонкая программа, которая ничего сама не запускает. Она отправляет HTTP-запрос демону <code>dockerd</code> через unix-сокет <code>/var/run/docker.sock</code>. Дальше цепочка такая:</p>
<pre><code>docker run -d -p 8080:80 nginx:alpine
   │
   ├─ 1. клиент → REST API демона dockerd
   ├─ 2. образа nginx:alpine нет локально → docker тянет слои из registry (Docker Hub)
   ├─ 3. dockerd просит containerd подготовить корневую ФС (overlay2) и создать контейнер
   ├─ 4. containerd вызывает runc — тот создаёт namespaces + cgroups и запускает процесс
   ├─ 5. сетевой драйвер выдаёт контейнеру IP в сети bridge и ставит правило проброса :8080 → :80
   └─ 6. клиент печатает длинный ID контейнера и возвращает вам приглашение (флаг -d)</code></pre>

<h2>Реестр образов</h2>
<p><b>Registry</b> — хранилище образов. По умолчанию это Docker Hub. Полное имя образа выглядит так: <code>registry/namespace/repository:tag</code>. Когда вы пишете просто <code>nginx:alpine</code>, docker разворачивает это в <code>docker.io/library/nginx:alpine</code>. Официальные образы живут в неймспейсе <code>library</code>, ваши личные — в <code>&lt;ваш-логин&gt;/&lt;имя&gt;</code>.</p>

<h2>Минимальный набор команд</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Команда</th><th>Что делает</th></tr>
<tr><td><code>docker version</code></td><td>Версии клиента и сервера — быстрая проверка, что демон жив</td></tr>
<tr><td><code>docker pull образ</code></td><td>Скачать образ в локальный кэш</td></tr>
<tr><td><code>docker images</code></td><td>Список локальных образов</td></tr>
<tr><td><code>docker run образ [команда]</code></td><td>Создать контейнер из образа и запустить</td></tr>
<tr><td><code>docker ps</code> / <code>docker ps -a</code></td><td>Запущенные контейнеры / вообще все, включая завершившиеся</td></tr>
<tr><td><code>docker rm имя</code></td><td>Удалить контейнер</td></tr>
</table></div>
<div class="callout trap"><b>Частая ошибка новичка</b><p><code>docker ps</code> показывает <em>только запущенные</em> контейнеры. Если вы запустили что-то и оно «пропало» — почти наверняка процесс завершился, и контейнер виден только в <code>docker ps -a</code>. Это не поломка, это нормальная жизнь контейнера: он живёт ровно столько, сколько живёт его главный процесс.</p></div>
`,
quiz:[
 {q:"Чем контейнер принципиально отличается от виртуальной машины?",
  opts:["Контейнер использует ядро хоста, а ВМ несёт собственное ядро и гостевую ОС","Контейнер всегда меньше по размеру, но устроен точно так же","Контейнер работает только на Linux, а ВМ — везде","Контейнер изолирован сильнее, чем виртуальная машина"],
  a:0, why:"Контейнер — это процесс на ядре хоста, изолированный namespaces и ограниченный cgroups. Отсюда и быстрый старт, и малый размер. Изоляция при этом <b>слабее</b>, чем у ВМ, — граница проходит по ядру, а не по гипервизору."},
 {q:"Какой механизм ядра отвечает за то, что контейнер видит только свои процессы и свой сетевой интерфейс?",
  opts:["cgroups","namespaces","overlay2","seccomp"],
  a:1, why:"<b>namespaces</b> отвечают за видимость (PID, net, mnt, uts, ipc, user). <b>cgroups</b> — за лимиты ресурсов, <b>overlay2</b> — за слоистую файловую систему, <b>seccomp</b> — за фильтрацию системных вызовов."},
 {q:"Вы запустили контейнер, но <code>docker ps</code> его не показывает. Что это вероятнее всего значит?",
  opts:["Контейнер не создался из-за ошибки сети","Главный процесс завершился, и контейнер перешёл в состояние Exited","Нужны права root, чтобы увидеть контейнер","Контейнер работает, но в другой сети"],
  a:1, why:"Контейнер живёт ровно столько, сколько живёт его процесс с PID 1. Как только процесс завершился — контейнер в состоянии Exited и виден только через <code>docker ps -a</code>."},
 {q:"Во что docker разворачивает короткое имя <code>redis:7-alpine</code>?",
  opts:["docker.io/redis/redis:7-alpine","docker.io/library/redis:7-alpine","hub.docker.com/redis:7-alpine","localhost:5000/redis:7-alpine"],
  a:1, why:"Реестр по умолчанию — <code>docker.io</code>, неймспейс официальных образов — <code>library</code>. Полное имя: <code>docker.io/library/redis:7-alpine</code>."},
 {q:"Что из перечисленного НЕ является частью образа?",
  opts:["Слои файловой системы","Команда по умолчанию (CMD)","Записываемый слой контейнера","Переменные окружения"],
  a:2, why:"Записываемый слой создаётся при запуске контейнера и принадлежит контейнеру, а не образу. Именно поэтому данные, записанные внутрь контейнера, исчезают вместе с ним."},
 {q:"Почему Linux-контейнер нельзя запустить напрямую на macOS?",
  opts:["Docker не портирован на macOS","Контейнеру нужно ядро Linux, а на macOS ядро другое","Мешает файловая система APFS","Из-за лицензионных ограничений"],
  a:1, why:"Контейнер — это процесс на ядре Linux. На macOS и Windows Docker Desktop поднимает лёгкую Linux-виртуалку, и контейнеры работают уже внутри неё."}
],
labs:[
 {id:"1a", title:"Первый запуск",
  brief:"<h3>Первый запуск</h3><p>Освойте базовый цикл: проверить демон, скачать образ, запустить контейнер, посмотреть результат.</p><ul><li>Проверьте версию: <code>docker version</code></li><li>Скачайте образ <code>alpine:3.19</code></li><li>Убедитесь, что он появился в списке образов</li><li>Запустите контейнер, который напечатает текст: <code>docker run alpine:3.19 echo привет</code></li><li>Найдите завершившийся контейнер в списке всех контейнеров</li></ul>",
  hint:"Список <em>всех</em> контейнеров, включая остановленные, показывает <code>docker ps -a</code>.",
  setup(st){},
  checks:[
   {label:"Выполнена <code>docker version</code>", test:(st,h)=>hasCmd(h,/^docker\s+version/)},
   {label:"Образ alpine:3.19 скачан", test:(st,h)=>!!findImage(st,"alpine:3.19")},
   {label:"Выполнена <code>docker images</code>", test:(st,h)=>hasCmd(h,/^docker\s+(images|image\s+ls)/)},
   {label:"Запущен контейнер с командой echo", test:(st,h)=>hasCmd(h,/^docker\s+run[^|]*alpine[^|]*echo/)},
   {label:"Выполнена <code>docker ps -a</code>", test:(st,h)=>hasCmd(h,/^docker\s+ps\b.*(-a|--all)/)}
  ]},
 {id:"1b", title:"Почему контейнер сразу умирает",
  brief:"<h3>Почему контейнер сразу умирает</h3><p>Самая частая точка недоумения. Разберём её руками.</p><ul><li>Запустите <code>docker run alpine:3.19</code> без команды и посмотрите в <code>docker ps -a</code> — контейнер уже Exited</li><li>Теперь запустите долгоживущий процесс в фоне: <code>docker run -d --name sleeper alpine:3.19 sleep 600</code></li><li>Убедитесь, что контейнер <b>sleeper</b> виден в обычном <code>docker ps</code></li><li>Остановите его и удалите</li></ul><p>Вывод, который надо унести: контейнер — это обёртка вокруг процесса, а не «маленькая виртуалка, которая просто работает».</p>",
  hint:"Без команды alpine запускает /bin/sh; без терминала оболочке нечего делать, и она завершается. <code>sleep 600</code> — процесс, который живёт 10 минут.",
  setup(st){},
  checks:[
   {label:"Запущен alpine без команды (контейнер завершился сам)", test:(st,h)=>hasCmd(h,/^docker\s+run\s+(alpine|alpine:3\.19)\s*$/)},
   {label:"Создан фоновый контейнер <code>sleeper</code>", test:(st,h)=>!!CS(st,c=>c.name==="sleeper").length || hasCmd(h,/--name\s+sleeper/)},
   {label:"<code>sleeper</code> был в состоянии running", test:(st,h)=>hasCmd(h,/^docker\s+run\s+.*-d.*sleep/) || hasCmd(h,/-d.*--name\s+sleeper/)},
   {label:"Контейнер остановлен", test:(st,h)=>hasCmd(h,/^docker\s+stop\s+sleeper/)},
   {label:"Контейнер удалён", test:(st,h)=>hasCmd(h,/^docker\s+rm\s+.*sleeper/) && !C(st,"sleeper")}
  ]}
]
},

/* ---------------------------------------------------------- 2 */
{
n:2, id:"images", title:"Образы и слои", sub:"Теги, digest, overlay",
lede:"Как устроен образ изнутри, почему слои переиспользуются между образами и чем тег отличается от digest.",
theory:`
<p>Образ — это упорядоченный стек слоёв только для чтения плюс небольшой JSON с конфигурацией. Каждый слой — это <em>diff</em>: набор файлов, добавленных, изменённых или удалённых относительно предыдущего слоя.</p>

<h2>Как слои складываются</h2>
<p>Когда вы запускаете контейнер, драйвер overlay2 монтирует все слои образа один поверх другого и добавляет сверху тонкий <b>записываемый слой контейнера</b>. Приложение видит единое дерево файлов и не знает, что оно склеено из кусков.</p>

<figure class="fig">
<svg viewBox="0 0 620 236" role="img" aria-label="Стек слоёв образа и записываемый слой контейнера">
 <g font-family="var(--font-mono)" font-size="10">
  <text x="0" y="12" font-weight="700" fill="var(--ink-3)" letter-spacing="1">ОБРАЗ app:1.0</text>
  <rect x="0" y="176" width="250" height="30" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="10" y="195" fill="var(--ink)">1 · alpine:3.19 (базовый)</text><text x="240" y="195" text-anchor="end" fill="var(--ink-3)">7.8 MB</text>
  <rect x="0" y="142" width="250" height="30" fill="var(--surface-3)" stroke="var(--line)"/><text x="10" y="161" fill="var(--ink)">2 · RUN apk add --no-cache curl</text><text x="240" y="161" text-anchor="end" fill="var(--ink-3)">9 MB</text>
  <rect x="0" y="108" width="250" height="30" fill="var(--surface-3)" stroke="var(--line)"/><text x="10" y="127" fill="var(--ink)">3 · COPY . /app</text><text x="240" y="127" text-anchor="end" fill="var(--ink-3)">180 kB</text>
  <rect x="0" y="74" width="250" height="30" fill="var(--surface-3)" stroke="var(--line)"/><text x="10" y="93" fill="var(--ink)">4 · CMD ["/app/run"]</text><text x="240" y="93" text-anchor="end" fill="var(--ink-3)">0 B</text>
  <text x="0" y="60" fill="var(--ink-3)">только для чтения ▲</text>

  <path d="M266 130h34" stroke="var(--ink-3)" stroke-width="1"/><path d="M300 130l-7-4v8z" fill="var(--ink-3)"/>
  <text x="283" y="122" text-anchor="middle" font-size="9" fill="var(--ink-3)">run</text>

  <text x="316" y="12" font-weight="700" fill="var(--accent)" letter-spacing="1">ДВА КОНТЕЙНЕРА ИЗ НЕГО</text>
  <rect x="316" y="176" width="290" height="30" fill="var(--accent-soft)" stroke="var(--accent-line)"/><text x="326" y="195" fill="var(--ink)">те же 4 слоя — на диске лежат один раз</text>
  <rect x="316" y="142" width="290" height="30" fill="var(--surface-3)" stroke="var(--line)"/>
  <rect x="316" y="108" width="290" height="30" fill="var(--surface-3)" stroke="var(--line)"/>
  <rect x="316" y="74" width="290" height="30" fill="var(--surface-3)" stroke="var(--line)"/>
  <rect x="316" y="36" width="140" height="30" fill="var(--surface)" stroke="var(--signal)" stroke-dasharray="3 2"/><text x="326" y="55" fill="var(--signal)">rw-слой c1</text>
  <rect x="466" y="36" width="140" height="30" fill="var(--surface)" stroke="var(--signal)" stroke-dasharray="3 2"/><text x="476" y="55" fill="var(--signal)">rw-слой c2</text>
  <text x="461" y="224" text-anchor="middle" font-size="9" fill="var(--ink-3)">copy-on-write: пока файл не изменён, он общий для всех</text>
 </g>
</svg>
<figcaption>Слои образа неизменяемы и разделяются между всеми контейнерами. Каждый контейнер получает только собственный тонкий слой для записи.</figcaption>
</figure>

<h2>Copy-on-write</h2>
<p>Если процесс внутри контейнера читает файл — он читается прямо из нижнего слоя, никакого копирования. Если процесс <em>пишет</em> в файл — overlay2 сначала копирует файл наверх, в записываемый слой, и меняет уже копию. Отсюда два практических следствия:</p>
<ul>
<li>Запуск ста контейнеров из одного образа почти не стоит места на диске.</li>
<li>Запись больших файлов внутрь контейнера медленнее обычной и всё равно теряется при <code>docker rm</code>. Для данных нужны тома — им посвящён отдельный модуль.</li>
</ul>

<h2>Тег и digest</h2>
<p>Тег — это <em>подвижная</em> метка. Сегодня <code>node:20-alpine</code> указывает на один набор слоёв, через неделю мейнтейнеры пересоберут образ, и тот же тег будет указывать на другой. Digest — это <code>sha256</code> от манифеста, он неизменен по определению.</p>
<pre><code><span class="c"># тег — читаемо, но не воспроизводимо</span>
FROM node:20-alpine

<span class="c"># digest — некрасиво, но железобетонно</span>
FROM node:20-alpine@sha256:8f1b4a0c...</code></pre>
<div class="callout trap"><b>Ловушка тега latest</b><p><code>latest</code> — это не «самая свежая версия», а просто тег по умолчанию, который подставляется, когда вы не указали никакого. Никто не обязан его обновлять, и он может годами указывать на старьё. В продакшене всегда фиксируйте версию явно: <code>postgres:16.2-alpine</code>, а не <code>postgres:latest</code>.</p></div>

<h2>Команды для работы с образами</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Команда</th><th>Назначение</th></tr>
<tr><td><code>docker pull образ</code></td><td>Скачать. Слои, которые уже есть локально, не качаются повторно</td></tr>
<tr><td><code>docker images</code></td><td>Что есть локально. Колонка SIZE — <em>логический</em> размер, у образов с общими слоями суммы складывать нельзя</td></tr>
<tr><td><code>docker history образ</code></td><td>Слои с командами, которые их создали, и размерами — главный инструмент диагностики «почему образ такой жирный»</td></tr>
<tr><td><code>docker inspect образ</code></td><td>Полный JSON: конфигурация, переменные окружения, точки монтирования, список слоёв</td></tr>
<tr><td><code>docker tag src dst</code></td><td>Добавить ещё одно имя тому же образу. Новых слоёв не создаёт — это просто указатель</td></tr>
<tr><td><code>docker rmi образ</code></td><td>Удалить тег. Слои исчезнут, только когда пропадёт последняя ссылка на них</td></tr>
<tr><td><code>docker image prune -a</code></td><td>Вычистить образы, на которые не ссылается ни один контейнер</td></tr>
</table></div>

<h2>Почему alpine такой популярный</h2>
<p>Базовый образ определяет «пол» размера. Разница между <code>node:20</code> (около гигабайта) и <code>node:20-alpine</code> (около 135 МБ) — это Debian со всем инструментарием против Alpine с musl libc и busybox. Alpine экономит место и уменьшает поверхность атаки, но иногда ломает нативные модули, собранные под glibc. Компромисс — <code>-slim</code>: Debian, но без документации, компиляторов и лишних пакетов.</p>
<div class="callout"><b>Как выбирать базовый образ</b><ul><li>Стандартный выбор — <code>-alpine</code> или <code>-slim</code>.</li><li>Есть нативные зависимости с glibc — берите <code>-slim</code>.</li><li>Собираете статический бинарник (Go, Rust) — финальный образ может быть <code>scratch</code> или distroless, буквально несколько мегабайт.</li></ul></div>
`,
quiz:[
 {q:"Что произойдёт со слоями образа, если вы удалите его тег через <code>docker rmi</code>, но тот же набор слоёв используется вторым тегом?",
  opts:["Слои удалятся, второй тег сломается","Удалится только тег, слои останутся на диске","Docker откажется удалять тег","Слои будут помечены как dangling и удалены через сутки"],
  a:1, why:"Тег — указатель. Слои удаляются только тогда, когда на них не осталось ни одной ссылки: ни тега, ни контейнера."},
 {q:"Приложение внутри контейнера записало файл размером 200 МБ в <code>/tmp</code>. Где он физически оказался?",
  opts:["В нижнем слое образа","В записываемом слое контейнера","В томе Docker","В памяти хоста"],
  a:1, why:"Все записи идут в тонкий записываемый слой контейнера. Он исчезнет вместе с контейнером при <code>docker rm</code> — и, кстати, такие записи медленнее, чем в том."},
 {q:"Чем digest надёжнее тега?",
  opts:["Digest короче и удобнее","Digest — хеш манифеста, он не может начать указывать на другой образ","Digest работает без интернета","Digest автоматически обновляется до последней версии"],
  a:1, why:"Тег можно переназначить на другой образ в любой момент. Digest вычисляется от содержимого, поэтому <code>образ@sha256:...</code> всегда даёт ровно тот же набор слоёв."},
 {q:"Вы видите три образа по 900 МБ каждый в <code>docker images</code>. Сколько места они занимают на диске, если собраны из одного базового слоя?",
  opts:["Ровно 2.7 ГБ","Заметно меньше 2.7 ГБ — общий слой хранится один раз","Ровно 900 МБ","Определить невозможно даже приблизительно"],
  a:1, why:"Колонка SIZE показывает логический размер каждого образа целиком. Общие слои на диске лежат в одном экземпляре — реальное потребление покажет <code>docker system df</code>."},
 {q:"Какая команда быстрее всего покажет, какая инструкция сборки раздула образ?",
  opts:["<code>docker inspect</code>","<code>docker history</code>","<code>docker images -a</code>","<code>docker stats</code>"],
  a:1, why:"<code>docker history</code> печатает список слоёв с командами и размерами — сразу видно, какой RUN или COPY стоил больше всего."},
 {q:"Что означает тег <code>latest</code>?",
  opts:["Самую свежую собранную версию образа","Тег по умолчанию, который подставляется, если тег не указан","Версию с последними патчами безопасности","Ветку main в репозитории образа"],
  a:1, why:"Это просто имя тега по умолчанию. Никакой гарантии свежести оно не даёт — сопровождающие могут его вообще не обновлять."}
],
labs:[
 {id:"2a", title:"Слои под микроскопом",
  brief:"<h3>Слои под микроскопом</h3><p>Посмотрим, из чего состоит готовый образ.</p><ul><li>Скачайте <code>nginx:alpine</code> и <code>alpine:3.19</code></li><li>Сравните их размеры в <code>docker images</code></li><li>Выведите слои nginx: <code>docker history nginx:alpine</code></li><li>Посмотрите конфигурацию: <code>docker inspect nginx:alpine</code></li></ul><p>Обратите внимание на вкладку <b>Слои</b> справа — она рисует то же самое наглядно.</p>",
  hint:"Первый слой — базовый, он же самый тяжёлый. Слои с метаданными (ENV, EXPOSE, CMD) весят 0 байт.",
  setup(st){},
  checks:[
   {label:"Скачан <code>nginx:alpine</code>", test:st=>!!findImage(st,"nginx:alpine")},
   {label:"Скачан <code>alpine:3.19</code>", test:st=>!!findImage(st,"alpine:3.19")},
   {label:"Просмотрен список образов", test:(st,h)=>hasCmd(h,/^docker\s+(images|image\s+ls)/)},
   {label:"Выполнена <code>docker history</code>", test:(st,h)=>hasCmd(h,/^docker\s+history/)},
   {label:"Выполнена <code>docker inspect</code> по образу", test:(st,h)=>hasCmd(h,/^docker\s+inspect\s+.*nginx/)}
  ]},
 {id:"2b", title:"Теги — это указатели",
  brief:"<h3>Теги — это указатели</h3><p>Докажите себе, что тег не копирует образ.</p><ul><li>Пометьте alpine новым именем: <code>docker tag alpine:3.19 mybase:v1</code></li><li>Посмотрите <code>docker images</code> — у двух строк одинаковый IMAGE ID</li><li>Удалите тег <code>mybase:v1</code> через <code>docker rmi</code></li><li>Убедитесь, что <code>alpine:3.19</code> на месте</li></ul>",
  hint:"Одинаковый IMAGE ID в двух строках — верный признак, что это один и тот же образ под двумя именами.",
  setup(st){},
  checks:[
   {label:"Создан тег <code>mybase:v1</code>", test:(st,h)=>hasCmd(h,/^docker\s+tag\s+alpine.*mybase:v1/)},
   {label:"Список образов просмотрен после тегирования", test:(st,h)=>{const i=h.findIndex(l=>/^docker\s+tag/.test(l)); return i>-1 && h.slice(i).some(l=>/^docker\s+(images|image\s+ls)/.test(l));}},
   {label:"Тег <code>mybase:v1</code> удалён", test:(st,h)=>hasCmd(h,/^docker\s+rmi\s+.*mybase/) && !findImage(st,"mybase:v1")},
   {label:"Образ <code>alpine:3.19</code> остался на месте", test:st=>!!findImage(st,"alpine:3.19")}
  ]}
]
},

/* ---------------------------------------------------------- 3 */
{
n:3, id:"lifecycle", title:"Жизненный цикл контейнера", sub:"run, exec, logs, PID 1",
lede:"Состояния контейнера, флаги -d, -it и --rm, чтение логов и вход внутрь работающего контейнера.",
theory:`
<p>Контейнер проходит через несколько состояний, и почти все проблемы новичков — это непонимание, в каком состоянии он сейчас и почему.</p>

<figure class="fig">
<svg viewBox="0 0 620 176" role="img" aria-label="Состояния контейнера и переходы между ними">
 <g font-family="var(--font-mono)" font-size="10">
  <rect x="6" y="60" width="96" height="34" rx="2" fill="var(--surface-3)" stroke="var(--line)"/><text x="54" y="81" text-anchor="middle" fill="var(--ink)">created</text>
  <rect x="176" y="60" width="96" height="34" rx="2" fill="var(--ok-soft)" stroke="var(--ok)"/><text x="224" y="81" text-anchor="middle" fill="var(--ink)">running</text>
  <rect x="346" y="60" width="96" height="34" rx="2" fill="var(--surface-3)" stroke="var(--line)"/><text x="394" y="81" text-anchor="middle" fill="var(--ink)">exited</text>
  <rect x="516" y="60" width="98" height="34" rx="2" fill="none" stroke="var(--line)" stroke-dasharray="3 3"/><text x="565" y="81" text-anchor="middle" fill="var(--ink-3)">удалён</text>
  <rect x="176" y="10" width="96" height="30" rx="2" fill="var(--warn-soft)" stroke="var(--warn)"/><text x="224" y="29" text-anchor="middle" fill="var(--ink)">paused</text>

  <g stroke="var(--ink-3)" fill="none">
   <path d="M102 77h68"/><path d="M272 77h68"/><path d="M442 77h68"/>
   <path d="M224 60V44"/><path d="M240 44v16"/>
   <path d="M394 100c0 24-170 24-170 0"/>
  </g>
  <g fill="var(--ink-3)">
   <path d="M170 77l-7-4v8z"/><path d="M340 77l-7-4v8z"/><path d="M510 77l-7-4v8z"/>
   <path d="M224 44l-4 7h8z"/><path d="M240 60l4-7h-8z"/><path d="M224 100l-4-7h8z"/>
  </g>
  <g font-size="9" fill="var(--accent)" text-anchor="middle">
   <text x="136" y="70">start</text><text x="306" y="70">stop / kill</text><text x="476" y="70">rm</text>
   <text x="309" y="121">start (тот же контейнер)</text>
   <text x="196" y="53">pause</text><text x="268" y="53">unpause</text>
  </g>
  <text x="6" y="140" font-size="9" fill="var(--ink-3)">docker run = create + start одной командой · docker run --rm = create + start + автоматический rm при выходе</text>
  <text x="6" y="156" font-size="9" fill="var(--ink-3)">exited-контейнер сохраняет записываемый слой и логи — его можно перезапустить и осмотреть</text>
 </g>
</svg>
<figcaption>Полный жизненный цикл. Контейнер не исчезает сам после завершения процесса — он остаётся в состоянии exited, пока вы его не удалите.</figcaption>
</figure>

<h2>PID 1 и главный процесс</h2>
<p>Внутри контейнера главный процесс получает номер 1. Контейнер живёт ровно столько, сколько живёт этот процесс. Есть три следствия, которые постоянно кусают на практике:</p>
<ul>
<li><b>Процесс должен работать в переднем плане.</b> Демонизирующиеся программы (<code>nginx</code> без <code>daemon off;</code>, <code>httpd -k start</code>) завершаются сразу после форка, и контейнер падает.</li>
<li><b>Сигналы приходят PID 1.</b> <code>docker stop</code> отправляет SIGTERM и ждёт 10 секунд, потом SIGKILL. Если ваш процесс не обрабатывает SIGTERM, каждая остановка будет длиться 10 секунд и заканчиваться жёстким убийством.</li>
<li><b>PID 1 не пожинает зомби-процессы.</b> Если внутри порождаются дочерние процессы, добавьте <code>--init</code> или явный init-процесс (tini).</li>
</ul>

<h2>Три флага, которые нужно понимать</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Флаг</th><th>Что делает</th><th>Когда нужен</th></tr>
<tr><td><code>-d</code> / <code>--detach</code></td><td>Запустить в фоне, сразу вернуть приглашение и напечатать ID</td><td>Всё, что должно работать долго: серверы, БД</td></tr>
<tr><td><code>-it</code></td><td><code>-i</code> держит открытым stdin, <code>-t</code> выделяет псевдотерминал</td><td>Интерактивная оболочка: <code>docker run -it alpine sh</code></td></tr>
<tr><td><code>--rm</code></td><td>Удалить контейнер автоматически при завершении</td><td>Разовые задачи, чтобы не копить мусор</td></tr>
<tr><td><code>--name</code></td><td>Задать читаемое имя вместо случайного <em>brave_turing</em></td><td>Всегда, когда к контейнеру потом обращаются</td></tr>
</table></div>
<div class="callout"><b>Почему <code>docker run alpine</code> тут же выходит</b><p>У alpine команда по умолчанию — <code>/bin/sh</code>. Без <code>-it</code> у оболочки нет ни терминала, ни ввода: она читает EOF и завершается с кодом 0. Добавьте <code>-it</code> — и получите приглашение внутри контейнера.</p></div>

<h2>Заглянуть внутрь работающего контейнера</h2>
<pre><code><span class="c"># логи главного процесса (stdout + stderr)</span>
docker logs <span class="s">web</span>
docker logs --tail 50 -f <span class="s">web</span>

<span class="c"># выполнить команду внутри уже работающего контейнера</span>
docker exec <span class="s">web</span> ls /usr/share/nginx/html
docker exec -it <span class="s">web</span> sh

<span class="c"># процессы, порты, потребление ресурсов</span>
docker top <span class="s">web</span>
docker port <span class="s">web</span>
docker stats</code></pre>
<div class="callout trap"><b>run ≠ exec</b><p><code>docker run</code> создаёт <em>новый</em> контейнер, <code>docker exec</code> запускает процесс в <em>уже работающем</em>. Если вы «зашли в контейнер» через <code>docker run -it образ sh</code>, вы попали в свежий контейнер, а не в тот, который вас интересовал, — и не увидите там ни его данных, ни его состояния.</p></div>

<h2>Куда идут логи</h2>
<p>Docker собирает <em>stdout</em> и <em>stderr</em> процесса PID 1 и складывает их в файл на хосте (драйвер <code>json-file</code> по умолчанию). Поэтому в контейнерах не пишут логи в файлы — приложение должно писать в стандартный вывод, а сбором занимается платформа. Если приложение упорно пишет в файл, обычный приём — сделать симлинк файла на <code>/dev/stdout</code>, именно так поступает официальный образ nginx.</p>
`,
quiz:[
 {q:"Контейнер с nginx падает сразу после старта, в логах пусто. Самая вероятная причина?",
  opts:["Не проброшен порт","Главный процесс демонизировался и завершился, вместо того чтобы работать в переднем плане","Не хватило памяти","Не указан --name"],
  a:1, why:"Контейнер живёт, пока живёт PID 1. Демонизирующийся процесс форкается и выходит — контейнер немедленно переходит в exited. Отсюда <code>nginx -g \"daemon off;\"</code> в официальном образе."},
 {q:"В чём разница между <code>docker stop</code> и <code>docker kill</code>?",
  opts:["Никакой, это синонимы","stop шлёт SIGTERM и ждёт grace-период, kill сразу SIGKILL","stop удаляет контейнер, kill — нет","kill работает только с фоновыми контейнерами"],
  a:1, why:"<code>stop</code> даёт приложению корректно завершиться: SIGTERM, ожидание (по умолчанию 10 с), затем SIGKILL. <code>kill</code> отправляет SIGKILL сразу — данные могут не успеть записаться."},
 {q:"Вам нужно посмотреть содержимое каталога в работающем контейнере <code>web</code>. Что вы сделаете?",
  opts:["<code>docker run -it web sh</code>","<code>docker exec web ls /path</code>","<code>docker inspect web ls</code>","<code>docker logs web /path</code>"],
  a:1, why:"<code>docker exec</code> выполняет команду в существующем контейнере. <code>docker run</code> создал бы новый контейнер — и, кстати, <code>web</code> там было бы именем образа, а не контейнера."},
 {q:"Что произойдёт с записанными внутрь контейнера файлами после <code>docker stop</code>, а затем <code>docker start</code>?",
  opts:["Файлы пропадут — слой очищается при остановке","Файлы останутся: записываемый слой живёт до docker rm","Файлы перенесутся в образ","Зависит от базового образа"],
  a:1, why:"Записываемый слой принадлежит контейнеру и переживает stop/start. Он исчезает только при удалении контейнера — вот тогда данные и теряются."},
 {q:"Зачем нужен флаг <code>--init</code>?",
  opts:["Чтобы контейнер стартовал быстрее","Чтобы получить процесс-init, который пожинает зомби и корректно раздаёт сигналы","Чтобы инициализировать том","Чтобы запустить контейнер до остальных"],
  a:1, why:"PID 1 в Linux несёт особые обязанности. Если ваш главный процесс к этому не готов, <code>--init</code> подставляет крошечный init (tini), который правильно обрабатывает сигналы и подбирает осиротевшие процессы."},
 {q:"Где приложение в контейнере должно писать логи?",
  opts:["В /var/log внутри контейнера","В stdout и stderr","В смонтированный том","В syslog хоста"],
  a:1, why:"Docker перехватывает stdout/stderr процесса PID 1 и передаёт их логирующему драйверу. Так логи доступны через <code>docker logs</code> и любой централизованный сборщик."}
],
labs:[
 {id:"3a", title:"Полный цикл вручную",
  brief:"<h3>Полный цикл вручную</h3><p>Пройдите все состояния по одному, вместо того чтобы делать всё через <code>run</code>.</p><ul><li>Создайте контейнер, не запуская: <code>docker create --name box alpine:3.19 sleep 300</code></li><li>Убедитесь, что он в состоянии Created (<code>docker ps -a</code>)</li><li>Запустите: <code>docker start box</code></li><li>Остановите: <code>docker stop box</code></li><li>Удалите: <code>docker rm box</code></li></ul>",
  hint:"docker run — это ровно create + start. Разделив их, легче увидеть состояние Created.",
  setup(st){},
  checks:[
   {label:"Контейнер <code>box</code> создан через <code>docker create</code>", test:(st,h)=>hasCmd(h,/^docker\s+create\s+.*--name\s+box|^docker\s+create\s+--name\s+box/)},
   {label:"Состояние проверено в <code>docker ps -a</code>", test:(st,h)=>hasCmd(h,/^docker\s+ps\b.*(-a|--all)/)},
   {label:"Контейнер запущен через <code>docker start</code>", test:(st,h)=>hasCmd(h,/^docker\s+start\s+box/)},
   {label:"Контейнер остановлен", test:(st,h)=>hasCmd(h,/^docker\s+stop\s+box/)},
   {label:"Контейнер удалён", test:(st,h)=>hasCmd(h,/^docker\s+rm\s+.*\bbox\b/)&&!C(st,"box")}
  ]},
 {id:"3b", title:"Фон, логи и вход внутрь",
  brief:"<h3>Фон, логи и вход внутрь</h3><p>Рабочий сценарий с настоящим сервером.</p><ul><li>Запустите nginx в фоне с именем <b>web</b> и портом 8080: <code>docker run -d --name web -p 8080:80 nginx:alpine</code></li><li>Проверьте, что он в <code>docker ps</code></li><li>Посмотрите логи: <code>docker logs web</code></li><li>Проверьте отдачу страницы с хоста: <code>curl http://localhost:8080</code></li><li>Зайдите внутрь: <code>docker exec -it web sh</code>, выполните там <code>ls /usr/share/nginx/html</code> и выйдите командой <code>exit</code></li></ul>",
  hint:"Внутри контейнера приглашение меняется. Доступны ls, cat, env, hostname, curl. Выход — exit.",
  setup(st){},
  checks:[
   {label:"nginx запущен в фоне как <code>web</code> с портом 8080", test:st=>{const c=C(st,"web"); return !!c&&c.status==="running"&&c.ports.some(p=>p.host===8080);}},
   {label:"Прочитаны логи контейнера", test:(st,h)=>hasCmd(h,/^docker\s+logs\s+web/)},
   {label:"Страница получена с хоста через curl", test:(st,h)=>hasCmd(h,/^curl\s+.*(localhost|127\.0\.0\.1):8080/)},
   {label:"Выполнен вход внутрь через <code>docker exec -it</code>", test:(st,h)=>hasCmd(h,/^docker\s+exec\s+-it\s+web\s+(sh|bash|\/bin\/sh)/)},
   {label:"Внутри контейнера просмотрен каталог сайта", test:(st,h)=>hasCmd(h,/^ls\s+\/usr\/share\/nginx\/html/)}
  ]},
 {id:"3c", title:"Уборка за собой",
  brief:"<h3>Уборка за собой</h3><p>Разовые контейнеры не должны копиться.</p><ul><li>Запустите разовую задачу без <code>--rm</code>: <code>docker run alpine:3.19 echo раз</code></li><li>Запустите такую же с <code>--rm</code>: <code>docker run --rm alpine:3.19 echo два</code></li><li>Сравните <code>docker ps -a</code>: первый контейнер остался, второго нет</li><li>Уберите остатки: <code>docker system prune</code></li></ul>",
  hint:"--rm удаляет контейнер сразу после завершения процесса. docker system prune чистит все остановленные контейнеры и неиспользуемые сети.",
  setup(st){},
  checks:[
   {label:"Запущен контейнер без <code>--rm</code>", test:(st,h)=>hasCmd(h,/^docker\s+run\s+(?!.*--rm).*alpine.*echo/)},
   {label:"Запущен контейнер с <code>--rm</code>", test:(st,h)=>hasCmd(h,/^docker\s+run\s+.*--rm.*alpine/)},
   {label:"Разница видна в <code>docker ps -a</code>", test:(st,h)=>hasCmd(h,/^docker\s+ps\b.*(-a|--all)/)},
   {label:"Выполнена очистка <code>docker system prune</code>", test:(st,h)=>hasCmd(h,/^docker\s+system\s+prune/)},
   {label:"После очистки остановленных контейнеров не осталось", test:(st,h)=>hasCmd(h,/^docker\s+system\s+prune/)&&hasCmd(h,/^docker\s+run\s+.*echo/)&&!st.containers.some(c=>c.status==="exited")}
  ]}
]
},

/* ---------------------------------------------------------- 4 */
{
n:4, id:"dockerfile", title:"Dockerfile", sub:"Инструкции и форма записи",
lede:"Как описать сборку образа: FROM, COPY, RUN, WORKDIR, ENV, EXPOSE и вечный вопрос CMD против ENTRYPOINT.",
theory:`
<p>Dockerfile — это рецепт сборки. Каждая инструкция выполняется поверх результата предыдущей и (почти всегда) порождает новый слой. Собирается всё командой <code>docker build</code>.</p>

<pre><code><span class="k">FROM</span> node:20-alpine
<span class="k">WORKDIR</span> /app
<span class="k">COPY</span> package*.json ./
<span class="k">RUN</span> npm ci --omit=dev
<span class="k">COPY</span> . .
<span class="k">ENV</span> NODE_ENV=production
<span class="k">EXPOSE</span> 3000
<span class="k">USER</span> node
<span class="k">CMD</span> [<span class="s">"node"</span>, <span class="s">"server.js"</span>]</code></pre>

<h2>Инструкции по одной</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Инструкция</th><th>Что делает</th><th>Что стоит знать</th></tr>
<tr><td><code>FROM</code></td><td>Базовый образ</td><td>Обязательно первая (кроме ARG). <code>FROM scratch</code> — пустой образ</td></tr>
<tr><td><code>WORKDIR</code></td><td>Рабочий каталог для последующих инструкций и для запуска</td><td>Создаёт каталог, если его нет. Всегда лучше, чем <code>RUN cd</code> — тот не сохраняется между слоями</td></tr>
<tr><td><code>COPY</code></td><td>Копирует файлы из контекста сборки в образ</td><td>Предпочтительна. Пути — относительно контекста, выйти за него нельзя</td></tr>
<tr><td><code>ADD</code></td><td>То же плюс распаковка архивов и загрузка по URL</td><td>Магия часто вредна — берите COPY, если не нужна распаковка tar</td></tr>
<tr><td><code>RUN</code></td><td>Выполняет команду во время <em>сборки</em></td><td>Каждый RUN — новый слой. Объединяйте связанные шаги через <code>&amp;&amp;</code></td></tr>
<tr><td><code>ENV</code></td><td>Переменная окружения в образе и во всех контейнерах из него</td><td>Видна и при сборке, и в рантайме. Секреты сюда класть нельзя</td></tr>
<tr><td><code>ARG</code></td><td>Переменная только на время сборки</td><td>Задаётся через <code>--build-arg</code>. В готовом образе её нет, но она видна в истории слоёв</td></tr>
<tr><td><code>EXPOSE</code></td><td>Документирует порт</td><td><b>Ничего не публикует.</b> Порт наружу открывает только <code>-p</code> при запуске</td></tr>
<tr><td><code>USER</code></td><td>От какого пользователя работать дальше</td><td>Пользователь должен существовать. По умолчанию всё идёт от root</td></tr>
<tr><td><code>VOLUME</code></td><td>Объявляет точку монтирования</td><td>При запуске без <code>-v</code> создаётся анонимный том — и незаметно копится</td></tr>
<tr><td><code>CMD</code> / <code>ENTRYPOINT</code></td><td>Что запускать</td><td>См. ниже — здесь ошибаются чаще всего</td></tr>
</table></div>

<h2>CMD против ENTRYPOINT</h2>
<p>Обе инструкции задают команду запуска, но по-разному реагируют на аргументы <code>docker run</code>:</p>
<ul>
<li><b>CMD</b> — значение по умолчанию, которое <em>полностью заменяется</em> аргументами после имени образа.</li>
<li><b>ENTRYPOINT</b> — фиксированная часть команды; аргументы <code>docker run</code> <em>дописываются к ней</em>. Заменить её можно только флагом <code>--entrypoint</code>.</li>
</ul>
<div class="tbl-wrap"><table class="t">
<tr><th>В Dockerfile</th><th><code>docker run img</code></th><th><code>docker run img --version</code></th></tr>
<tr><td><code>CMD ["curl","site"]</code></td><td>curl site</td><td>--version <em>(запустится как команда — почти наверняка ошибка)</em></td></tr>
<tr><td><code>ENTRYPOINT ["curl"]</code></td><td>curl</td><td>curl --version</td></tr>
<tr><td><code>ENTRYPOINT ["curl"]</code> + <code>CMD ["site"]</code></td><td>curl site</td><td>curl --version</td></tr>
</table></div>
<div class="callout"><b>Практическое правило</b><p>Образ — это «утилита» с фиксированным поведением (например, <code>ffmpeg</code>) → <code>ENTRYPOINT</code> с исполняемым файлом и <code>CMD</code> с аргументами по умолчанию. Образ — это «среда», где хочется иногда запустить что-то другое (например, приложение, куда полезно зайти оболочкой) → достаточно одного <code>CMD</code>.</p></div>

<h2>Shell-форма и exec-форма</h2>
<p>Любую из этих инструкций можно писать двумя способами, и разница важна:</p>
<pre><code><span class="c"># exec-форма (JSON-массив) — процесс запускается напрямую, PID 1 = ваша программа</span>
CMD [<span class="s">"node"</span>, <span class="s">"server.js"</span>]

<span class="c"># shell-форма — на самом деле выполняется /bin/sh -c "node server.js"</span>
CMD node server.js</code></pre>
<div class="callout trap"><b>Почему shell-форма опасна</b><p>В shell-форме PID 1 — это <code>/bin/sh</code>, а ваше приложение — его дочерний процесс. Сигнал SIGTERM от <code>docker stop</code> приходит оболочке, которая его не пересылает. Приложение не узнает об остановке и будет убито через 10 секунд по SIGKILL: незакрытые соединения, недописанные файлы. <b>Для CMD и ENTRYPOINT используйте exec-форму.</b> Shell-форма уместна только в RUN, где нужны пайпы и подстановки.</p></div>

<h2>Контекст сборки</h2>
<p>Последний аргумент <code>docker build</code> — это <em>контекст</em>: каталог, который целиком отправляется демону перед сборкой. <code>COPY</code> может брать файлы только оттуда. Отсюда два правила: не собирайте из домашнего каталога (уедут гигабайты) и всегда пишите <code>.dockerignore</code>.</p>
<pre><code><span class="c"># docker build -t app:1.0 .   — контекст «текущий каталог», Dockerfile в нём</span>
<span class="c"># docker build -t app:1.0 -f docker/Dockerfile .  — Dockerfile лежит отдельно</span></code></pre>
`,
quiz:[
 {q:"В Dockerfile написано <code>EXPOSE 3000</code>. Приложение доступно снаружи?",
  opts:["Да, порт 3000 открыт на хосте","Нет — EXPOSE только документирует; наружу порт открывает <code>-p</code> при запуске","Да, но только с localhost","Только если запустить с --network host"],
  a:1, why:"EXPOSE — метаданные. Реальную публикацию делает <code>-p 3000:3000</code> (или <code>-P</code>, который использует EXPOSE для выбора портов)."},
 {q:"<code>ENTRYPOINT [\"python\"]</code> и <code>CMD [\"app.py\"]</code>. Что выполнится при <code>docker run img worker.py</code>?",
  opts:["python app.py","python worker.py","worker.py","python app.py worker.py"],
  a:1, why:"Аргументы <code>docker run</code> заменяют CMD целиком и дописываются к ENTRYPOINT. Получается <code>python worker.py</code>."},
 {q:"Почему <code>CMD node server.js</code> хуже, чем <code>CMD [\"node\",\"server.js\"]</code>?",
  opts:["Первый вариант медленнее собирается","В shell-форме PID 1 — это /bin/sh, и приложение не получит SIGTERM при docker stop","Shell-форма не поддерживает переменные окружения","Разницы нет"],
  a:1, why:"Shell-форма разворачивается в <code>/bin/sh -c \"...\"</code>. Оболочка становится PID 1, сигналы до приложения не доходят, и остановка всегда заканчивается SIGKILL через grace-период."},
 {q:"Чем ARG отличается от ENV?",
  opts:["ARG доступна только при сборке, ENV — и при сборке, и в контейнере","ARG нельзя переопределить снаружи","ENV работает только в RUN","Разницы нет, ARG — устаревший синоним"],
  a:0, why:"ARG задаётся флагом <code>--build-arg</code> и исчезает из готового образа. ENV сохраняется в конфигурации образа и видна каждому контейнеру. Ни то, ни другое не годится для секретов — оба видны в истории слоёв."},
 {q:"Почему <code>RUN cd /app</code> не работает так, как ожидается?",
  opts:["cd нет в alpine","Каждая RUN выполняется в своей оболочке — смена каталога не переживает переход к следующему слою","Нужно писать RUN cd /app с флагом -w","Нужны права root"],
  a:1, why:"Каждая инструкция RUN — отдельный процесс поверх нового слоя. Рабочий каталог задают инструкцией <code>WORKDIR</code>, она сохраняется в метаданных."},
 {q:"Что такое контекст сборки?",
  opts:["Кэш слоёв на диске","Каталог, который целиком передаётся демону и из которого COPY берёт файлы","Набор переменных окружения при сборке","Список базовых образов"],
  a:1, why:"Это последний аргумент <code>docker build</code>. Он архивируется и отправляется демону, поэтому лишние файлы замедляют сборку и раздувают образ — их отсекает <code>.dockerignore</code>."}
],
labs:[
 {id:"4a", title:"Первый Dockerfile",
  brief:"<h3>Первый Dockerfile</h3><p>В рабочем каталоге уже лежит <code>index.html</code> (вкладка <b>Файлы</b> справа). Соберите из него образ статического сайта.</p><p>Создайте Dockerfile такого содержания — можно одной командой из терминала:</p><pre style=\"font-family:var(--font-mono);font-size:11.5px;background:var(--surface-3);padding:9px 11px;border-radius:3px;overflow-x:auto\">echo 'FROM nginx:alpine\nCOPY index.html /usr/share/nginx/html/index.html\nEXPOSE 80' > Dockerfile</pre><ul><li>Соберите: <code>docker build -t site:1.0 .</code></li><li>Запустите: <code>docker run -d --name site -p 8080:80 site:1.0</code></li><li>Проверьте: <code>curl http://localhost:8080</code> — должен вернуться ваш HTML, а не приветствие nginx</li></ul>",
  hint:"Многострочный файл можно создать одной командой echo с символами \\n — эмулятор их разворачивает. Проверить содержимое: cat Dockerfile.",
  setup(st){ st.files["/work/index.html"]="<html><body><h1>Мой сайт</h1><p>Собрано своими руками.</p></body></html>"; },
  checks:[
   {label:"Создан <code>Dockerfile</code>", test:st=>st.files["/work/Dockerfile"]!==undefined},
   {label:"Собран образ <code>site:1.0</code>", test:st=>!!findImage(st,"site:1.0")},
   {label:"Контейнер <code>site</code> работает на порту 8080", test:st=>{const c=C(st,"site"); return !!c&&c.status==="running"&&c.ports.some(p=>p.host===8080);}},
   {label:"Страница получена через curl", test:(st,h)=>hasCmd(h,/^curl\s+.*8080/)},
   {label:"Отдаётся ваш HTML, а не страница nginx по умолчанию", test:st=>{const c=C(st,"site"); if(!c)return false; const v=cRead(st,c,"/usr/share/nginx/html/index.html"); return v!==undefined && /Собрано своими руками/.test(String(v));}}
  ]},
 {id:"4b", title:"CMD против ENTRYPOINT",
  brief:"<h3>CMD против ENTRYPOINT</h3><p>Проверьте поведение на практике, а не по памяти.</p><ul><li>Соберите образ <code>greeter:cmd</code> из Dockerfile с <code>CMD [\"echo\",\"привет\"]</code></li><li>Запустите его без аргументов и с аргументом: <code>docker run greeter:cmd</code> и <code>docker run greeter:cmd пока</code></li><li>Теперь соберите <code>greeter:entry</code>, где вместо CMD стоит <code>ENTRYPOINT [\"echo\"]</code>, и запустите с аргументом</li><li>Сравните вывод</li></ul><p>Файл Dockerfile можно перезаписывать той же командой echo.</p>",
  hint:"CMD аргументы заменяет целиком, ENTRYPOINT — дописывает их к себе. Второй Dockerfile проще создать через echo с перезаписью.",
  setup(st){},
  checks:[
   {label:"Собран образ <code>greeter:cmd</code>", test:st=>!!findImage(st,"greeter:cmd")},
   {label:"Запущен без аргументов", test:(st,h)=>hasCmd(h,/^docker\s+run\s+greeter:cmd\s*$/)},
   {label:"Запущен с аргументом (CMD заменился)", test:(st,h)=>hasCmd(h,/^docker\s+run\s+greeter:cmd\s+\S+/)},
   {label:"Собран образ <code>greeter:entry</code> с ENTRYPOINT", test:st=>{const i=findImage(st,"greeter:entry"); return !!i && !!i.config.entrypoint;}},
   {label:"Запущен образ с ENTRYPOINT и аргументом", test:(st,h)=>hasCmd(h,/^docker\s+run\s+greeter:entry\s+\S+/)}
  ]}
]
},
