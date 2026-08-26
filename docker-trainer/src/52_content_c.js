/* ---------------------------------------------------------- 9 */
{
n:9, id:"compose", title:"Docker Compose", sub:"Многоконтейнерные приложения",
lede:"Один YAML-файл вместо десятка команд docker run: сервисы, зависимости, сети и тома в декларативном виде.",
theory:`
<p>Как только приложению нужны база, кэш и сам сервис, команды <code>docker run</code> перестают помещаться в голову. Compose описывает всю систему одним файлом и поднимает её одной командой.</p>

<pre><code><span class="k">services</span>:
  api:
    build: .
    ports:
      - <span class="s">"8080:3000"</span>
    environment:
      DATABASE_URL: postgres://app:secret@db:5432/app
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: [<span class="s">"CMD-SHELL"</span>, <span class="s">"pg_isready -U app"</span>]
      interval: 10s
      retries: 5

<span class="k">volumes</span>:
  pgdata:</code></pre>

<h2>Что Compose делает за вас</h2>
<ul>
<li>Создаёт <b>пользовательскую сеть</b> проекта — значит, DNS по именам сервисов работает сразу. В примере выше api обращается к базе по хосту <code>db</code>.</li>
<li>Даёт контейнерам предсказуемые имена <code>&lt;проект&gt;-&lt;сервис&gt;-&lt;номер&gt;</code> и вешает на них метки проекта.</li>
<li>Создаёт объявленные тома и подставляет к ним префикс проекта.</li>
<li>Умеет собирать образы из <code>build:</code> и пересобирать по <code>--build</code>.</li>
</ul>
<div class="callout"><b>Имя проекта</b><p>По умолчанию это имя каталога, в котором лежит файл. Отсюда и префиксы у контейнеров, сетей и томов. Переопределяется флагом <code>-p</code> или переменной <code>COMPOSE_PROJECT_NAME</code> — удобно, когда нужно поднять два экземпляра одного стека рядом.</p></div>

<h2>Ключевые поля сервиса</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Поле</th><th>Смысл</th></tr>
<tr><td><code>image</code></td><td>Готовый образ из реестра</td></tr>
<tr><td><code>build</code></td><td>Собрать локально: строкой (путь к контексту) или объектом с <code>context</code>, <code>dockerfile</code>, <code>target</code>, <code>args</code></td></tr>
<tr><td><code>ports</code></td><td>Публикация, тот же формат <code>"хост:контейнер"</code>. Кавычки обязательны, иначе YAML прочитает <code>22:22</code> как время</td></tr>
<tr><td><code>environment</code></td><td>Переменные — списком <code>- K=V</code> или отображением <code>K: V</code></td></tr>
<tr><td><code>env_file</code></td><td>Подтянуть переменные из файла</td></tr>
<tr><td><code>volumes</code></td><td>Тома и bind mount</td></tr>
<tr><td><code>depends_on</code></td><td>Порядок запуска. <b>Не</b> ждёт готовности — только старта</td></tr>
<tr><td><code>healthcheck</code></td><td>Проба готовности; вместе с <code>condition: service_healthy</code> даёт настоящее ожидание</td></tr>
<tr><td><code>restart</code></td><td><code>no</code>, <code>on-failure</code>, <code>always</code>, <code>unless-stopped</code></td></tr>
<tr><td><code>profiles</code></td><td>Необязательные сервисы, которые поднимаются только по запросу</td></tr>
</table></div>
<div class="callout trap"><b>depends_on не значит «дождаться готовности»</b><p>Обычный <code>depends_on</code> гарантирует лишь порядок <em>старта</em>. База стартует за 5 секунд, приложение стучится через 0.2 — и падает. Правильный вариант:</p><pre style="margin:.6em 0 0"><code>depends_on:
  db:
    condition: service_healthy</code></pre><p style="margin-top:.6em">Плюс к этому приложение всё равно должно уметь переподключаться — контейнеры перезапускаются и в рантайме.</p></div>

<h2>Ежедневные команды</h2>
<pre><code>docker compose up -d          <span class="c"># поднять всё в фоне</span>
docker compose up -d --build  <span class="c"># пересобрать образы и поднять</span>
docker compose ps             <span class="c"># состояние сервисов</span>
docker compose logs -f api    <span class="c"># логи одного сервиса</span>
docker compose exec api sh    <span class="c"># зайти внутрь</span>
docker compose down           <span class="c"># снести контейнеры и сеть (тома остаются)</span>
docker compose down -v        <span class="c"># снести вместе с томами — данные пропадут</span></code></pre>

<h2>Разные окружения одним файлом</h2>
<p>Compose умеет накладывать файлы друг на друга: <code>docker compose -f compose.yaml -f compose.dev.yaml up</code>. Базовый файл описывает общее, оверлей — отличия для разработки (bind mount исходников, отладочные порты) или для продакшена (лимиты, реплики). Это лучше, чем держать два почти одинаковых файла.</p>
<div class="callout warn"><b>Compose — это не оркестратор</b><p>Он отлично подходит для локальной разработки, CI и небольших одиночных серверов. Для нескольких узлов, автоматического масштабирования, плавных выкаток и самовосстановления нужен Kubernetes или Swarm. Хорошая новость: образ, который вы собрали, поедет туда без изменений — переписывать придётся только описание запуска.</p></div>
`,
quiz:[
 {q:"Что Compose создаёт автоматически при <code>docker compose up</code>?",
  opts:["Только контейнеры","Пользовательскую сеть проекта, объявленные тома и контейнеры с метками проекта","Реестр образов","Виртуальную машину"],
  a:1, why:"Именно поэтому сервисы сразу находят друг друга по именам — Compose создаёт свою сеть, а в ней работает DNS."},
 {q:"Приложение падает при старте с ошибкой подключения к базе, хотя <code>depends_on: [db]</code> прописан. Почему?",
  opts:["depends_on не работает в новых версиях","depends_on ждёт только старта контейнера, а не готовности сервиса","Нужно поменять порядок сервисов в файле","База должна публиковать порт"],
  a:1, why:"Нужен healthcheck у базы и <code>condition: service_healthy</code> у зависимого сервиса. И всё равно приложение должно переживать разрыв соединения."},
 {q:"Что произойдёт при <code>docker compose down -v</code>?",
  opts:["Остановятся контейнеры, тома сохранятся","Удалятся контейнеры, сеть и тома проекта — данные будут потеряны","Удалятся только тома","Сервисы перезапустятся"],
  a:1, why:"Флаг <code>-v</code> добавляет удаление томов. Обычный <code>down</code> тома не трогает — это защита от случайной потери данных."},
 {q:"Почему в <code>ports</code> порты пишут в кавычках?",
  opts:["Для читаемости","Без кавычек YAML может прочитать <code>22:22</code> как значение времени","Иначе Compose ругается на синтаксис","Кавычки включают TLS"],
  a:1, why:"Классическая ловушка YAML: конструкция вида <code>чч:мм</code> распознаётся как sexagesimal-число. Кавычки снимают неоднозначность."},
 {q:"Откуда Compose берёт имя проекта по умолчанию?",
  opts:["Из поля name в файле","Из имени каталога, где лежит compose-файл","Из имени первого сервиса","Из переменной USER"],
  a:1, why:"Отсюда префиксы у контейнеров, сетей и томов. Переопределяется флагом <code>-p</code> или переменной <code>COMPOSE_PROJECT_NAME</code>."},
 {q:"Для чего служит наложение файлов <code>-f compose.yaml -f compose.dev.yaml</code>?",
  opts:["Для запуска двух независимых проектов","Чтобы переопределить часть настроек под конкретное окружение поверх базового файла","Для резервного копирования конфигурации","Чтобы ускорить запуск"],
  a:1, why:"Второй файл накладывается на первый и переопределяет отдельные поля. Так держат один источник правды вместо двух почти одинаковых файлов."}
],
labs:[
 {id:"9a", title:"Поднять стек одной командой",
  brief:"<h3>Поднять стек одной командой</h3><p>В каталоге уже лежит <code>docker-compose.yml</code> с веб-сервисом и базой — посмотрите его во вкладке <b>Файлы</b>.</p><ul><li>Поднимите: <code>docker compose up -d</code></li><li>Посмотрите состояние: <code>docker compose ps</code></li><li>Проверьте, что веб отвечает: <code>curl http://localhost:8080</code></li><li>Посмотрите логи базы: <code>docker compose logs db</code></li><li>Снесите стек: <code>docker compose down</code></li></ul><p>Обратите внимание на схему справа: Compose создал отдельную сеть <code>work_default</code>, и оба контейнера в ней.</p>",
  hint:"Compose создаёт контейнеры с именами вида work-web-1. Имя проекта берётся из каталога /work.",
  setup(st){
   st.files["/work/docker-compose.yml"]="services:\n  web:\n    image: nginx:alpine\n    ports:\n      - \"8080:80\"\n    depends_on:\n      - db\n\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: secret\n      POSTGRES_DB: app\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n\nvolumes:\n  pgdata:\n";
  },
  checks:[
   {label:"Стек поднят через <code>docker compose up</code>", test:(st,h)=>hasCmd(h,/^docker\s+compose\s+up/)},
   {label:"Оба сервиса поднялись", test:st=>(st.composeUpCount||0)>=2},
   {label:"Сеть проекта создана и объединяет сервисы", test:st=>st.networks.some(n=>/_default$/.test(n.name))||hasCmd(st.history,/compose\s+up/)},
   {label:"Просмотрено состояние через <code>docker compose ps</code>", test:(st,h)=>hasCmd(h,/^docker\s+compose\s+ps/)},
   {label:"Прочитаны логи сервиса", test:(st,h)=>hasCmd(h,/^docker\s+compose\s+logs/)}
  ]},
 {id:"9b", title:"Свой compose-файл",
  brief:"<h3>Свой compose-файл</h3><p>Напишите описание стека сами. Требования:</p><ul><li>Сервис <b>cache</b> на образе <code>redis:7-alpine</code></li><li>Сервис <b>site</b> на <code>nginx:alpine</code>, порт <code>8080:80</code>, зависит от cache</li><li>Именованный том, подключённый к cache в <code>/data</code></li><li>Поднимите стек и убедитесь, что оба контейнера в одной сети, а том создан</li></ul><p>Файл создавайте через <code>echo '...' > docker-compose.yml</code> — переводы строк пишите как \\n, отступы двумя пробелами.</p>",
  hint:"Каркас: services:\\n  cache:\\n    image: redis:7-alpine\\n    volumes:\\n      - cachedata:/data\\n  site:\\n    image: nginx:alpine\\n    ports:\\n      - \"8080:80\"\\n    depends_on:\\n      - cache\\n\\nvolumes:\\n  cachedata:",
  setup(st){ delete st.files["/work/docker-compose.yml"]; },
  checks:[
   {label:"Создан <code>docker-compose.yml</code>", test:st=>st.files["/work/docker-compose.yml"]!==undefined},
   {label:"Сервис <code>cache</code> на redis запущен", test:st=>st.containers.some(c=>c.composeService==="cache"&&/redis/.test(c.image))},
   {label:"Сервис <code>site</code> опубликован на 8080", test:st=>st.containers.some(c=>c.composeService==="site"&&c.ports.some(p=>p.host===8080))},
   {label:"Том подключён к cache", test:st=>st.containers.some(c=>c.composeService==="cache"&&c.mounts.some(m=>m.type==="volume"&&m.target==="/data"))},
   {label:"Оба сервиса в одной сети проекта", test:st=>{const cs=st.containers.filter(c=>c.composeProject); if(cs.length<2)return false; const n=Object.keys(cs[0].networks)[0]; return cs.every(c=>c.networks[n]);}}
  ]}
]
},

/* ---------------------------------------------------------- 10 */
{
n:10, id:"debug", title:"Отладка и ресурсы", sub:"logs, inspect, лимиты, restart",
lede:"Что делать, когда контейнер не поднимается, ест всю память или бесконечно перезапускается.",
theory:`
<p>Отладка контейнера отличается от отладки обычного процесса тем, что вы не видите его окружения напрямую. Порядок действий почти всегда один и тот же.</p>

<h2>Алгоритм разбора «оно не работает»</h2>
<ol>
<li><b>Существует ли контейнер вообще</b> — <code>docker ps -a</code>. Статус Exited с кодом даёт первую подсказку.</li>
<li><b>Что сказал процесс перед смертью</b> — <code>docker logs имя</code>. Логи сохраняются и у остановленного контейнера.</li>
<li><b>С какой конфигурацией он запущен</b> — <code>docker inspect имя</code>: переменные окружения, монтирования, сети, политика перезапуска.</li>
<li><b>Что видно изнутри</b> — <code>docker exec -it имя sh</code>, если контейнер жив. Если он падает мгновенно, запустите его с другой командой: <code>docker run -it --entrypoint sh образ</code>.</li>
<li><b>Ресурсы</b> — <code>docker stats</code>. Код выхода 137 почти всегда означает OOM-kill.</li>
</ol>

<div class="tbl-wrap"><table class="t">
<tr><th>Код выхода</th><th>Что означает</th><th>Куда смотреть</th></tr>
<tr><td><b>0</b></td><td>Процесс завершился штатно</td><td>Возможно, это была разовая команда, а не сервис</td></tr>
<tr><td><b>1</b></td><td>Ошибка приложения</td><td><code>docker logs</code></td></tr>
<tr><td><b>125</b></td><td>Ошибка самого демона — неверный флаг <code>docker run</code></td><td>Синтаксис команды</td></tr>
<tr><td><b>126</b></td><td>Команда найдена, но не может быть выполнена</td><td>Права на файл, отсутствует бит запуска</td></tr>
<tr><td><b>127</b></td><td>Команда не найдена</td><td>Опечатка в CMD, нет оболочки в distroless</td></tr>
<tr><td><b>137</b></td><td>SIGKILL — чаще всего OOM-kill</td><td>Лимит памяти, <code>docker stats</code></td></tr>
<tr><td><b>143</b></td><td>SIGTERM — корректная остановка</td><td>Норма при <code>docker stop</code></td></tr>
</table></div>

<h2>Лимиты ресурсов</h2>
<p>По умолчанию контейнер может съесть всю память хоста. Один сбойный процесс кладёт машину целиком. Лимиты — это не оптимизация, а страховка.</p>
<pre><code>docker run -d --name api \\
  --memory 512m \\          <span class="c"># жёсткий предел ОЗУ</span>
  --memory-reservation 256m \\ <span class="c"># мягкий предел при нехватке на хосте</span>
  --cpus 1.5 \\             <span class="c"># полтора ядра</span>
  --pids-limit 200 \\       <span class="c"># защита от fork-бомбы</span>
  myapi:1.0</code></pre>
<div class="callout warn"><b>JVM, Node и лимиты</b><p>Старые рантаймы смотрят на память <em>хоста</em>, а не на лимит cgroup, и выставляют кучу заведомо больше разрешённого — контейнер немедленно получает OOM-kill. Современные JVM учитывают cgroups автоматически; для Node полезно явно задать <code>--max-old-space-size</code> с запасом ниже лимита контейнера.</p></div>

<h2>Политики перезапуска</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Политика</th><th>Поведение</th></tr>
<tr><td><code>no</code></td><td>По умолчанию — не перезапускать</td></tr>
<tr><td><code>on-failure[:N]</code></td><td>Перезапускать при ненулевом коде выхода, не более N раз</td></tr>
<tr><td><code>always</code></td><td>Всегда, в том числе после перезагрузки демона</td></tr>
<tr><td><code>unless-stopped</code></td><td>Как always, но не поднимает контейнер, который вы остановили вручную</td></tr>
</table></div>
<p>Для сервисов обычный выбор — <code>unless-stopped</code>. Если контейнер уходит в цикл перезапусков, Docker включает экспоненциальную задержку, а вы увидите в <code>docker ps</code> статус Restarting и растущий счётчик.</p>

<h2>Healthcheck</h2>
<p>Запущенный процесс ещё не означает работающий сервис. Healthcheck периодически выполняет команду внутри контейнера и переводит его в состояние healthy или unhealthy.</p>
<pre><code>HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \\
  CMD wget -qO- http://localhost:3000/health || exit 1</code></pre>
<p><code>--start-period</code> — время на прогрев, в течение которого провалы не считаются. Состояние видно в <code>docker ps</code> и в <code>docker inspect --format '{{.State.Health.Status}}'</code>. В Compose именно на нём строится <code>condition: service_healthy</code>.</p>

<div class="callout"><b>Полезные однострочники</b><ul>
<li><code>docker logs --tail 100 -f имя</code> — хвост логов в реальном времени.</li>
<li><code>docker inspect -f '{{.State.ExitCode}}' имя</code> — код выхода без чтения простыни JSON.</li>
<li><code>docker inspect -f '{{.NetworkSettings.Networks}}' имя</code> — в каких сетях контейнер.</li>
<li><code>docker run -it --entrypoint sh образ</code> — зайти внутрь образа, который падает при старте.</li>
<li><code>docker system df</code> — куда ушло место на диске.</li>
</ul></div>
`,
quiz:[
 {q:"Контейнер завершился с кодом 137. Что это чаще всего значит?",
  opts:["Команда не найдена","Процесс убит сигналом SIGKILL — обычно из-за превышения лимита памяти","Ошибка конфигурации демона","Штатное завершение"],
  a:1, why:"137 = 128 + 9 (SIGKILL). В контексте контейнеров это почти всегда OOM-kill: проверьте <code>--memory</code> и реальное потребление через <code>docker stats</code>."},
 {q:"Контейнер падает мгновенно, зайти внутрь через exec не успеваете. Что делать?",
  opts:["Запустить с --restart always","Запустить образ с другой точкой входа: <code>docker run -it --entrypoint sh образ</code>","Пересобрать образ без CMD","Использовать docker cp"],
  a:1, why:"Подменив entrypoint на оболочку, вы попадёте внутрь файловой системы образа и сможете руками проверить пути, права и переменные."},
 {q:"Чем <code>unless-stopped</code> отличается от <code>always</code>?",
  opts:["Ничем","unless-stopped не поднимает контейнер, который вы остановили вручную, после перезапуска демона","unless-stopped работает только в Compose","always ограничена десятью попытками"],
  a:1, why:"Разница проявляется после перезагрузки демона или хоста: <code>always</code> поднимет всё, <code>unless-stopped</code> уважает ваше решение остановить контейнер."},
 {q:"Зачем нужен <code>--start-period</code> в HEALTHCHECK?",
  opts:["Задаёт задержку перед стартом контейнера","Даёт приложению время на прогрев: провалы в этот период не помечают контейнер unhealthy","Определяет частоту проверок","Ограничивает время выполнения пробы"],
  a:1, why:"Без него медленно стартующее приложение (миграции, прогрев кэша) будет помечено unhealthy и, если политика перезапуска активна, уйдёт в цикл."},
 {q:"Где посмотреть, какие переменные окружения реально получил работающий контейнер?",
  opts:["<code>docker logs</code>","<code>docker inspect</code> — раздел Config.Env","<code>docker stats</code>","<code>docker history</code>"],
  a:1, why:"<code>docker inspect</code> показывает фактическую конфигурацию: переменные, монтирования, сети, лимиты, политику перезапуска."},
 {q:"Что произойдёт с контейнером без <code>--memory</code>, если приложение потечёт?",
  opts:["Docker остановит его на 512 МБ","Он может съесть всю память хоста и уронить машину","Лимит автоматически берётся из образа","Сработает swap"],
  a:1, why:"Ограничений по умолчанию нет. Лимиты памяти на продакшене — базовая гигиена, а не тонкая настройка."}
],
labs:[
 {id:"10a", title:"Разобрать упавший контейнер",
  brief:"<h3>Разобрать упавший контейнер</h3><p>Запустите postgres, «забыв» задать пароль, — образ этого не прощает.</p><ul><li><code>docker run -d --name db postgres:16-alpine</code></li><li>Найдите его в <code>docker ps -a</code> — статус Exited</li><li>Прочитайте <code>docker logs db</code> и найдите причину</li><li>Посмотрите код выхода: <code>docker inspect -f '{{.State.ExitCode}}' db</code></li><li>Удалите контейнер и запустите заново с переменной <code>POSTGRES_PASSWORD</code> — теперь он должен работать</li></ul>",
  hint:"Официальный образ postgres отказывается стартовать без POSTGRES_PASSWORD. Флаг для переменной — -e KEY=value.",
  setup(st){},
  checks:[
   {label:"Контейнер запущен без пароля и упал", test:(st,h)=>hasCmd(h,/^docker\s+run\s+(?!.*POSTGRES_PASSWORD).*postgres/)},
   {label:"Просмотрены логи", test:(st,h)=>hasCmd(h,/^docker\s+logs\s+db/)},
   {label:"Получен код выхода через <code>docker inspect -f</code>", test:(st,h)=>hasCmd(h,/^docker\s+inspect\s+(-f|--format)/)},
   {label:"Контейнер перезапущен с <code>POSTGRES_PASSWORD</code>", test:st=>{const c=C(st,"db"); return !!c&&c.status==="running"&&!!c.env.POSTGRES_PASSWORD;}}
  ]},
 {id:"10b", title:"Лимиты и перезапуск",
  brief:"<h3>Лимиты и перезапуск</h3><p>Возьмите под контроль ресурсы и поведение при сбое.</p><ul><li>Запустите nginx с лимитами и политикой перезапуска: <code>docker run -d --name web --memory 256m --cpus 0.5 --restart unless-stopped -p 8080:80 nginx:alpine</code></li><li>Проверьте потребление: <code>docker stats</code></li><li>Убедитесь, что лимит записан в конфигурации: <code>docker inspect -f '{{.HostConfig.Memory}}' web</code></li><li>Проверьте политику: <code>docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' web</code></li></ul>",
  hint:"Память задаётся как 256m, CPU — дробным числом ядер. Оба флага видны в разделе HostConfig.",
  setup(st){},
  checks:[
   {label:"Контейнер запущен с лимитом памяти", test:st=>{const c=C(st,"web"); return !!c&&!!c.memory;}},
   {label:"Задан лимит CPU", test:st=>{const c=C(st,"web"); return !!c&&!!c.cpus;}},
   {label:"Политика перезапуска <code>unless-stopped</code>", test:st=>{const c=C(st,"web"); return !!c&&c.restart==="unless-stopped";}},
   {label:"Выполнена <code>docker stats</code>", test:(st,h)=>hasCmd(h,/^docker\s+stats/)},
   {label:"Конфигурация проверена через inspect с форматом", test:(st,h)=>hasCmd(h,/^docker\s+inspect\s+(-f|--format).*HostConfig/)}
  ]}
]
},

/* ---------------------------------------------------------- 11 */
{
n:11, id:"security", title:"Безопасность", sub:"root, capabilities, секреты",
lede:"Почему по умолчанию всё работает от root, как это исправить и какие ошибки чаще всего приводят к утечкам.",
theory:`
<p>Контейнер изолирован слабее виртуальной машины: между ним и хостом всего одно общее ядро. Настройки по умолчанию оптимизированы для удобства, а не для безопасности, поэтому продакшен требует нескольких осознанных шагов.</p>

<h2>1. Не работайте от root</h2>
<p>Если в Dockerfile нет инструкции <code>USER</code>, процесс идёт от root — и это тот же UID 0, что и на хосте. В связке с bind mount или уязвимостью в рантайме это прямой путь к повышению привилегий.</p>
<pre><code><span class="k">FROM</span> node:20-alpine
<span class="k">WORKDIR</span> /app
<span class="k">COPY</span> --chown=node:node . .
<span class="k">RUN</span> npm ci --omit=dev
<span class="k">USER</span> node                <span class="c"># в официальных образах node такой пользователь уже есть</span>
<span class="k">CMD</span> [<span class="s">"node"</span>, <span class="s">"server.js"</span>]</code></pre>
<p>Если готового пользователя нет, создайте его: <code>RUN addgroup -g 10001 app &amp;&amp; adduser -u 10001 -G app -D app</code>. Числовой UID предпочтительнее имени — некоторые платформы проверяют, что <code>runAsNonRoot</code> действительно не ноль.</p>

<h2>2. Урезайте возможности</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Флаг</th><th>Что даёт</th></tr>
<tr><td><code>--cap-drop ALL</code></td><td>Снять все capabilities и вернуть только нужные через <code>--cap-add</code></td></tr>
<tr><td><code>--read-only</code></td><td>Корневая ФС только для чтения; изменяемые каталоги подмонтировать как tmpfs</td></tr>
<tr><td><code>--security-opt no-new-privileges</code></td><td>Запретить повышение привилегий через setuid-бинарники</td></tr>
<tr><td><code>--pids-limit</code></td><td>Ограничить число процессов — защита от fork-бомбы</td></tr>
<tr><td><code>--user 10001:10001</code></td><td>Переопределить пользователя при запуске, даже если в образе стоит root</td></tr>
</table></div>
<pre><code>docker run -d --name api \\
  --read-only --tmpfs /tmp \\
  --cap-drop ALL \\
  --security-opt no-new-privileges \\
  --user 10001:10001 \\
  myapi:1.0</code></pre>

<h2>3. Секреты не кладут в образ</h2>
<div class="callout trap"><b>Что не работает</b><ul>
<li><code>ENV DB_PASSWORD=...</code> — видно в <code>docker inspect</code> и в истории слоёв у всех, кто скачает образ.</li>
<li><code>COPY .env /app/</code> — файл остаётся в слое навсегда, даже если удалить его следующей инструкцией.</li>
<li><code>ARG SECRET</code> — попадает в историю сборки.</li>
</ul></div>
<p>Что работает: переменные окружения, передаваемые <em>во время запуска</em> из менеджера секретов; смонтированные файлы с секретами; <code>docker secret</code> в Swarm; для сборки — <code>RUN --mount=type=secret,id=npmrc ...</code>, который даёт файл только на время выполнения инструкции и не сохраняет его в слое.</p>

<h2>4. Держите поверхность атаки маленькой</h2>
<ul>
<li>Минимальная база: <code>-alpine</code>, <code>-slim</code>, distroless. Нет пакетного менеджера — нечего эксплуатировать.</li>
<li>Фиксируйте версии базовых образов и регулярно пересобирайте — уязвимости чинятся в апстриме.</li>
<li>Сканируйте: <code>docker scout cves образ</code>, Trivy, Grype. Встраивайте в CI и блокируйте сборку на критичных находках.</li>
<li>Не устанавливайте в рантайм-образ то, что нужно только для сборки: компиляторы, curl, отладчики.</li>
</ul>

<h2>5. Сокет Docker — это root на хосте</h2>
<div class="callout warn"><b>Самая опасная строка в docker-compose.yml</b><p><code>- /var/run/docker.sock:/var/run/docker.sock</code></p><p>Кто имеет доступ к сокету, может запустить контейнер с <code>--privileged</code> и смонтированным корнем хоста, то есть получить полный root. Если контейнеру действительно нужно управлять Docker, монтируйте сокет только для чтения, используйте прокси с фильтрацией API (socket-proxy) или rootless-режим.</p></div>

<h2>Короткий чек-лист перед выкладкой</h2>
<ol>
<li>В Dockerfile есть <code>USER</code> с непривилегированным UID.</li>
<li>Базовый образ минимален и зафиксирован по версии.</li>
<li>Нет секретов ни в <code>ENV</code>, ни в скопированных файлах, ни в <code>ARG</code>.</li>
<li>Заданы лимиты памяти, CPU и числа процессов.</li>
<li><code>--read-only</code> плюс tmpfs там, где нужна запись.</li>
<li>Порты наружу опубликованы только те, что действительно нужны.</li>
<li>Сканер уязвимостей встроен в конвейер сборки.</li>
<li>Сокет Docker внутрь контейнеров не проброшен.</li>
</ol>
`,
quiz:[
 {q:"От какого пользователя работает процесс, если в Dockerfile нет инструкции USER?",
  opts:["От nobody","От root — того же UID 0, что и на хосте","От пользователя, запустившего docker run","От специального пользователя docker"],
  a:1, why:"По умолчанию это root. В связке с уязвимостью рантайма или смонтированным каталогом хоста это прямой путь к повышению привилегий."},
 {q:"Почему <code>ENV API_KEY=секрет</code> — плохая идея?",
  opts:["Переменная не дойдёт до приложения","Значение сохраняется в образе и видно всем, кто его скачает, через inspect и историю слоёв","ENV не поддерживает длинные строки","Оно перезапишется при запуске"],
  a:1, why:"Всё, что попало в слой или в конфигурацию образа, уезжает вместе с образом. Секреты передают в рантайме или монтируют файлом."},
 {q:"Что делает <code>--cap-drop ALL</code>?",
  opts:["Запрещает контейнеру сеть","Снимает все capabilities Linux — нужные возвращают точечно через --cap-add","Ограничивает память","Запускает контейнер от root"],
  a:1, why:"По умолчанию Docker оставляет контейнеру набор capabilities. Принцип наименьших привилегий: снять все и вернуть только необходимые, например NET_BIND_SERVICE."},
 {q:"Чем опасно монтирование <code>/var/run/docker.sock</code> в контейнер?",
  opts:["Замедляет ввод-вывод","Даёт контейнеру полный контроль над демоном, а значит фактический root на хосте","Ломает сеть контейнера","Требует привилегированного режима"],
  a:1, why:"Через сокет можно запустить привилегированный контейнер со смонтированным корнем хоста. Это эквивалент выдачи root."},
 {q:"Как правильно передать секрет во время сборки, чтобы он не попал в слой?",
  opts:["Через ARG","Через ENV","Через <code>RUN --mount=type=secret</code> BuildKit","Через COPY с последующим rm"],
  a:2, why:"Секрет-маунт BuildKit даёт файл только на время выполнения инструкции и не сохраняет его в слое. ARG и ENV видны в истории, а <code>rm</code> не удаляет данные из предыдущего слоя."},
 {q:"Что даёт <code>--read-only</code> вместе с <code>--tmpfs /tmp</code>?",
  opts:["Ускоряет запуск","Корневая ФС недоступна для записи, а изменяемый каталог живёт в памяти — вредоносный код не закрепится на диске","Отключает логи","Позволяет запускаться без root"],
  a:1, why:"Это снижает возможность закрепиться в контейнере: писать некуда, а tmpfs исчезает при перезапуске."}
],
labs:[
 {id:"11a", title:"Собрать образ без root",
  brief:"<h3>Собрать образ без root</h3><p>В каталоге лежит приложение и Dockerfile без инструкции USER.</p><ul><li>Соберите как есть: <code>docker build -t app:root .</code>, запустите и проверьте пользователя: <code>docker exec ... whoami</code> — увидите root</li><li>Добавьте в Dockerfile создание пользователя и <code>USER</code>: строка <code>RUN adduser -u 10001 -D app</code> и следом <code>USER app</code></li><li>Соберите <code>app:safe</code>, запустите и снова проверьте <code>whoami</code></li></ul>",
  hint:"Контейнер должен работать долго, чтобы в него можно было зайти: запускайте с командой sleep 600. Проверка — docker exec имя whoami.",
  setup(st){
   st.files["/work/server.js"]="console.log('ok')";
   st.files["/work/Dockerfile"]="FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nCMD [\"node\",\"server.js\"]";
  },
  checks:[
   {label:"Собран образ <code>app:root</code>", test:st=>!!findImage(st,"app:root")},
   {label:"Проверен пользователь в первом варианте", test:(st,h)=>hasCmd(h,/^docker\s+exec\s+.*whoami/)},
   {label:"В Dockerfile появился <code>USER</code>", test:st=>/^\s*USER\s+/m.test(String(st.files["/work/Dockerfile"]||""))},
   {label:"Собран образ <code>app:safe</code> с непривилегированным пользователем", test:st=>{const i=findImage(st,"app:safe"); return !!i&&i.config.user&&i.config.user!=="root";}},
   {label:"Контейнер из <code>app:safe</code> работает не от root", test:st=>st.containers.some(c=>/app:safe/.test(c.image)&&c.user&&c.user!=="root")}
  ]},
 {id:"11b", title:"Ужесточить запуск",
  brief:"<h3>Ужесточить запуск</h3><p>Примените защитные флаги к обычному образу.</p><ul><li>Запустите nginx с ужесточёнными настройками:<br><code>docker run -d --name hard --read-only --tmpfs /tmp --cap-drop ALL --user 10001 -p 8080:80 nginx:alpine</code></li><li>Убедитесь, что запись в корневую ФС не проходит: <code>docker exec hard sh -c \"echo x > /root-test\"</code> — ожидается ошибка</li><li>Проверьте, что в <code>/tmp</code> запись работает: <code>docker exec hard sh -c \"echo x > /tmp/ok\"</code></li><li>Посмотрите настройки в <code>docker inspect hard</code></li></ul>",
  hint:"tmpfs монтируется в память, поэтому запись туда разрешена даже при --read-only.",
  setup(st){},
  checks:[
   {label:"Контейнер запущен с <code>--read-only</code>", test:st=>{const c=C(st,"hard"); return !!c&&c.readOnly;}},
   {label:"Подключён tmpfs на <code>/tmp</code>", test:st=>{const c=C(st,"hard"); return !!c&&c.mounts.some(m=>m.type==="tmpfs"&&m.target==="/tmp");}},
   {label:"Сняты capabilities и задан непривилегированный пользователь", test:st=>{const c=C(st,"hard"); return !!c&&c.capDrop.some(x=>/ALL/i.test(x))&&c.user!=="root";}},
   {label:"Проверена невозможность записи в корень", test:(st,h)=>hasCmd(h,/^docker\s+exec\s+hard\s+.*>\s*\/[a-z]/)},
   {label:"Проверена запись в <code>/tmp</code>", test:st=>{const c=C(st,"hard"); if(!c)return false; const m=c.mounts.find(x=>x.type==="tmpfs"); return !!m&&!!m.mem&&Object.keys(m.mem).length>0;}}
  ]}
]
},

/* ---------------------------------------------------------- 12 */
{
n:12, id:"prod", title:"Продакшен", sub:"Версии, реестр, выкладка",
lede:"Что отличает образ «для себя» от образа, который не стыдно выкатить: теги, healthcheck, корректная остановка и конвейер сборки.",
theory:`
<p>Локально работающий образ и продакшен-образ отличаются десятком мелочей. Ни одна из них не сложная, но забытая всплывает в самый неподходящий момент.</p>

<h2>Теги и версионирование</h2>
<div class="callout trap"><b><code>latest</code> в продакшене — источник боли</b><p>Нельзя понять, что именно сейчас работает, нельзя откатиться, невозможно воспроизвести инцидент. Тегируйте образ несколькими метками сразу:</p><pre style="margin:.6em 0 0"><code>docker build -t myapp:1.4.2 -t myapp:1.4 -t myapp:sha-a1b2c3d .</code></pre><p style="margin-top:.6em">Семантическая версия для людей, хеш коммита — для однозначной привязки к коду. В манифесте выкладки указывают точную версию или digest.</p></div>

<h2>Корректная остановка</h2>
<p>При обновлении оркестратор посылает контейнеру SIGTERM и ждёт. Приложение обязано за это время закрыть слушающий сокет, дообработать текущие запросы и завершиться. Иначе пользователи получат оборванные соединения при каждой выкатке.</p>
<ul>
<li>Используйте <b>exec-форму</b> CMD/ENTRYPOINT — иначе сигнал получит оболочка, а не приложение.</li>
<li>Обработайте SIGTERM в коде (в Node — <code>process.on('SIGTERM', ...)</code>, в Python — <code>signal.signal</code>).</li>
<li>Если процесс порождает дочерние, добавьте <code>--init</code>.</li>
<li>Увеличьте <code>--stop-timeout</code>, если штатное завершение объективно долгое.</li>
</ul>

<h2>Healthcheck и готовность</h2>
<p>Различайте <em>живость</em> (процесс не завис) и <em>готовность</em> (можно принимать трафик). Пока идут миграции или прогревается кэш, приложение живо, но не готово. В Docker это выражается связкой <code>HEALTHCHECK</code> и <code>--start-period</code>; в Kubernetes — раздельными liveness- и readiness-пробами. Проба должна быть дешёвой и не ходить во внешние зависимости: иначе падение соседнего сервиса перезапустит ваш.</p>

<h2>Реестр</h2>
<pre><code>docker login registry.example.com
docker tag myapp:1.4.2 registry.example.com/team/myapp:1.4.2
docker push registry.example.com/team/myapp:1.4.2

<span class="c"># на сервере</span>
docker pull registry.example.com/team/myapp:1.4.2</code></pre>
<p>Полезно настроить в реестре политику хранения (retention), иначе он за год заполнит диск. Подписывать образы можно через cosign, а проверять подпись — на этапе выкладки.</p>

<h2>Сборка в CI</h2>
<pre><code><span class="c"># типовые шаги конвейера</span>
1. docker build --target test -t app:test .   <span class="c"># прогнать тесты в той же среде</span>
2. docker build --target prod -t app:$SHA .   <span class="c"># собрать рантайм-образ</span>
3. trivy image --exit-code 1 --severity CRITICAL app:$SHA
4. docker push registry/app:$SHA
5. обновить манифест выкладки на новую версию</code></pre>
<div class="callout"><b>Кэш в CI</b><p>На эфемерном раннере локального кэша нет. Подтягивайте его из реестра: <code>docker build --cache-from registry/app:cache --build-arg BUILDKIT_INLINE_CACHE=1</code> — сборка ускоряется в разы.</p></div>

<h2>Наблюдаемость и обслуживание</h2>
<ul>
<li>Логи — только в stdout/stderr, структурированные (JSON), без записи в файлы внутри контейнера.</li>
<li>Ограничьте размер логов: <code>--log-opt max-size=10m --log-opt max-file=3</code>, иначе json-file съест диск.</li>
<li>Регулярный <code>docker system prune -af --filter "until=168h"</code> на серверах сборки.</li>
<li>Следите за размером образа: он напрямую влияет на время выкатки и отката.</li>
</ul>

<h2>Финальный чек-лист образа</h2>
<div class="tbl-wrap"><table class="t">
<tr><th>Проверка</th><th>Почему</th></tr>
<tr><td>Multi-stage, минимальная база</td><td>Скорость выкатки, меньше уязвимостей</td></tr>
<tr><td><code>.dockerignore</code> на месте</td><td>Кэш, размер, отсутствие секретов в контексте</td></tr>
<tr><td>Зависимости ставятся до копирования кода</td><td>Быстрая пересборка</td></tr>
<tr><td>exec-форма CMD/ENTRYPOINT</td><td>Корректная обработка сигналов</td></tr>
<tr><td><code>USER</code> с непривилегированным UID</td><td>Безопасность</td></tr>
<tr><td>HEALTHCHECK с <code>--start-period</code></td><td>Правильное определение готовности</td></tr>
<tr><td>Версионный тег и хеш коммита</td><td>Воспроизводимость и откат</td></tr>
<tr><td>Лимиты памяти и CPU</td><td>Один сбой не кладёт хост</td></tr>
<tr><td>Данные в томах, а не в контейнере</td><td>Переживают пересоздание</td></tr>
<tr><td>Логи в stdout</td><td>Централизованный сбор</td></tr>
</table></div>
`,
quiz:[
 {q:"Почему в манифесте выкладки не стоит указывать тег <code>latest</code>?",
  opts:["Он медленнее скачивается","Нельзя понять, что именно работает, и невозможно откатиться на предыдущую версию","Docker Hub его не поддерживает","Он не работает с приватными реестрами"],
  a:1, why:"Подвижный тег лишает вас воспроизводимости. Указывайте конкретную версию или digest — тогда откат сводится к смене одной строки."},
 {q:"Приложение при выкатке рвёт соединения пользователей. Что проверить в первую очередь?",
  opts:["Лимит памяти","Обработку SIGTERM и exec-форму CMD","Размер образа","Политику перезапуска"],
  a:1, why:"Если CMD записан в shell-форме, сигнал получает /bin/sh и приложение о нём не узнаёт. Плюс само приложение должно закрывать сокет и дообрабатывать запросы."},
 {q:"Что должна проверять хорошая проба healthcheck?",
  opts:["Доступность базы данных и всех внешних API","Собственную готовность сервиса, дёшево и без похода во внешние зависимости","Свободное место на диске","Версию образа"],
  a:1, why:"Если проба ходит в базу, её недоступность перезапустит ваш сервис и превратит частичный сбой в каскадный."},
 {q:"Зачем помечать образ одновременно как <code>1.4.2</code> и <code>sha-a1b2c3d</code>?",
  opts:["Чтобы обойти ограничения реестра","Семантическая версия читается людьми, хеш коммита однозначно связывает образ с кодом","Чтобы уменьшить размер","Так требует BuildKit"],
  a:1, why:"Первый тег удобен в общении и релизных заметках, второй даёт точную привязку к исходникам при разборе инцидента."},
 {q:"Как ускорить сборку на чистом CI-раннере?",
  opts:["Отключить BuildKit","Подтягивать кэш слоёв из реестра через --cache-from","Собирать без тегов","Использовать --no-cache"],
  a:1, why:"Локального кэша на эфемерном раннере нет. <code>--cache-from</code> вместе со встроенным кэшем в реестре возвращает переиспользование слоёв."},
 {q:"Что делает <code>--log-opt max-size=10m --log-opt max-file=3</code>?",
  opts:["Ограничивает объём логов контейнера ротацией","Отправляет логи в syslog","Сжимает логи","Отключает логирование"],
  a:0, why:"Драйвер json-file по умолчанию пишет без ограничений и способен заполнить диск. Ротация — обязательная настройка на долгоживущих хостах."}
],
labs:[
 {id:"12a", title:"Подготовить образ к выкладке",
  brief:"<h3>Подготовить образ к выкладке</h3><p>Доведите учебный образ до состояния, в котором его не стыдно отдать.</p><ul><li>В Dockerfile должны быть: непривилегированный <code>USER</code>, <code>HEALTHCHECK</code> и exec-форма <code>CMD</code></li><li>Соберите сразу с двумя тегами: <code>docker build -t myapp:1.0.0 -t myapp:sha-a1b2c3d .</code></li><li>Запустите с лимитами и политикой перезапуска</li><li>Проверьте состояние healthy в <code>docker ps</code></li></ul>",
  hint:"HEALTHCHECK CMD wget -qO- http://localhost/ || exit 1 — этого достаточно. Два тега задаются двумя флагами -t в одной команде build.",
  setup(st){
   st.files["/work/index.html"]="<h1>myapp</h1>";
   st.files["/work/Dockerfile"]="FROM nginx:alpine\nCOPY index.html /usr/share/nginx/html/index.html\nEXPOSE 80\n";
  },
  checks:[
   {label:"В Dockerfile есть <code>HEALTHCHECK</code>", test:st=>/HEALTHCHECK/i.test(String(st.files["/work/Dockerfile"]||""))},
   {label:"В Dockerfile есть <code>USER</code>", test:st=>/^\s*USER\s+/m.test(String(st.files["/work/Dockerfile"]||""))},
   {label:"Образ собран с версионным тегом <code>myapp:1.0.0</code>", test:st=>!!findImage(st,"myapp:1.0.0")},
   {label:"Тот же образ помечен хешем коммита", test:st=>st.images.some(i=>i.repo==="myapp"&&/^sha-/.test(i.tag))},
   {label:"Контейнер запущен с лимитом памяти и <code>--restart</code>", test:st=>st.containers.some(c=>/myapp/.test(c.image)&&c.memory&&c.restart&&c.restart!=="no")},
   {label:"Контейнер в состоянии healthy", test:st=>st.containers.some(c=>/myapp/.test(c.image)&&c.health&&c.health.status==="healthy")}
  ]},
 {id:"12b", title:"Итоговая работа: стек целиком",
  brief:"<h3>Итоговая работа: стек целиком</h3><p>Соберите всё, чему научились, в один рабочий стек. Требования:</p><ul><li><b>Своя сеть</b> — создайте <code>prod-net</code></li><li><b>База</b> <code>postgres:16-alpine</code> с именем <code>pgdb</code>: пароль в переменной, именованный том <code>pgdata</code> на <code>/var/lib/postgresql/data</code>, <b>без публикации портов</b>, <code>--restart unless-stopped</code></li><li><b>Веб</b> — соберите образ <code>shop:1.0.0</code> из своего Dockerfile на базе nginx с вашим <code>index.html</code>, запустите как <code>shopweb</code> в той же сети, порт <code>8080:80</code>, лимит памяти</li><li>Проверьте: сайт отвечает через <code>curl</code>, база видна из веба по имени <code>pgdb</code>, снаружи база недоступна</li><li>Отправьте образ в реестр: пометьте как <code>myteam/shop:1.0.0</code> и выполните <code>docker push</code></li></ul><p>Схема справа должна показать одну сеть, два контейнера, один том и единственный опубликованный порт.</p>",
  hint:"Порядок: docker network create prod-net → docker volume create pgdata → запуск базы → создание Dockerfile и сборка → запуск веба → проверки → docker tag и docker push.",
  setup(st){ st.files["/work/index.html"]="<html><body><h1>Shop</h1><p>production ready</p></body></html>"; },
  checks:[
   {label:"Создана сеть <code>prod-net</code>", test:st=>!!NW(st,"prod-net")},
   {label:"База <code>pgdb</code> работает в сети, с томом и без публикации портов", test:st=>{const c=C(st,"pgdb"); return !!c&&c.status==="running"&&!!c.networks["prod-net"]&&c.ports.length===0&&c.mounts.some(m=>m.type==="volume"&&/pgdata/.test(m.source));}},
   {label:"У базы задана политика перезапуска", test:st=>{const c=C(st,"pgdb"); return !!c&&c.restart&&c.restart!=="no";}},
   {label:"Собран образ <code>shop:1.0.0</code>", test:st=>!!findImage(st,"shop:1.0.0")},
   {label:"Контейнер <code>shopweb</code> в той же сети, порт 8080, лимит памяти", test:st=>{const c=C(st,"shopweb"); return !!c&&c.status==="running"&&!!c.networks["prod-net"]&&c.ports.some(p=>p.host===8080)&&!!c.memory;}},
   {label:"Сайт отвечает снаружи", test:(st,h)=>hasCmd(h,/^curl\s+.*8080/)},
   {label:"База доступна из веба по имени", test:(st,h)=>hasCmd(h,/^docker\s+exec\s+shopweb\s+(ping|nslookup|curl)\s+.*pgdb/)},
   {label:"Образ отправлен в реестр как <code>myteam/shop:1.0.0</code>", test:st=>st.pushed.some(x=>/myteam\/shop:1\.0\.0/.test(x))}
  ]}
]
}
];
