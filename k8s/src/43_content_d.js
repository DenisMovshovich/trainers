
/* ------------------------------------------------ 9 */
{
n:9, id:"health", title:"Пробы", sub:"Живой, готовый, запустившийся",
lede:"Три пробы отвечают на три разных вопроса. Их путают чаще всего остального в Kubernetes — и цена ошибки высока: неправильная проба живости роняет здоровое приложение по кругу.",
theory:`
<h2>Три пробы</h2>
<div class="tw"><table>
<tr><th>Проба</th><th>Вопрос</th><th>Что при отказе</th></tr>
<tr><td><code>readinessProbe</code></td><td>можно ли слать сюда запросы?</td><td>под убирают из конечных точек Service — трафик не идёт</td></tr>
<tr><td><code>livenessProbe</code></td><td>жив ли процесс вообще?</td><td><b>контейнер перезапускают</b></td></tr>
<tr><td><code>startupProbe</code></td><td>закончился ли долгий старт?</td><td>пока не прошла — остальные пробы не работают</td></tr>
</table></div>
<div class="note trap"><b class="hd">Самая дорогая ошибка</b><p>Поставить пробе живости тот же адрес, что и пробе готовности, и короткий таймаут. Приложение под нагрузкой отвечает медленно → проба живости не укладывается → kubelet перезапускает контейнер → нагрузка переезжает на соседей → они тоже начинают отвечать медленно → перезапускается весь сервис по кругу. Так небольшой всплеск нагрузки превращается в полный отказ.</p><p>Правило: проба живости должна проверять <b>только</b> «процесс не завис» и не ходить в базу, кеш и соседние сервисы. Всё остальное — работа пробы готовности.</p></div>

<h2>Как выглядит</h2>
<pre><code><span class="k">readinessProbe</span>:
  <span class="k">httpGet</span>:
    <span class="k">path</span>: /ready
    <span class="k">port</span>: 8080
  <span class="k">initialDelaySeconds</span>: 5     <span class="c"># подождать перед первой проверкой</span>
  <span class="k">periodSeconds</span>: 10          <span class="c"># как часто</span>
  <span class="k">failureThreshold</span>: 3        <span class="c"># сколько неудач подряд считать отказом</span>

<span class="k">livenessProbe</span>:
  <span class="k">httpGet</span>:
    <span class="k">path</span>: /healthz          <span class="c"># лёгкая проверка, без зависимостей</span>
    <span class="k">port</span>: 8080
  <span class="k">periodSeconds</span>: 20
  <span class="k">failureThreshold</span>: 3</code></pre>
<p>Виды проверок: <code>httpGet</code> — код ответа 200–399 считается успехом; <code>tcpSocket</code> — достаточно, что порт открыт; <code>exec</code> — команда внутри контейнера с нулевым кодом возврата.</p>

<h2>Что зависит от готовности</h2>
<div class="tw"><table>
<tr><th>Механизм</th><th>Как использует готовность</th></tr>
<tr><td>Service</td><td>в конечные точки попадают только готовые поды</td></tr>
<tr><td>Плавное обновление</td><td>новый под считается доступным только когда готов — иначе выкатка не идёт дальше</td></tr>
<tr><td><code>kubectl get pods</code></td><td>колонка READY</td></tr>
</table></div>
<div class="note ok"><b class="hd">Отсюда следует важное</b><p>Проба готовности — это то, что делает обновление действительно бесперебойным. Без неё Kubernetes считает под пригодным сразу после старта процесса и начинает слать в него запросы, пока приложение ещё поднимается. Пользователи увидят ошибки, хотя формально «выкатка прошла успешно».</p></div>

<h2>Долгий старт</h2>
<p>Приложение, которому нужны две минуты на прогрев, ставит разработчика перед выбором: либо большой <code>initialDelaySeconds</code> у пробы живости — и тогда настоящее зависание будут замечать две минуты, либо короткий — и здоровое приложение будут убивать на старте. <code>startupProbe</code> снимает выбор: пока она не прошла, остальные пробы не выполняются, а после — работают с нормальными короткими таймаутами.</p>

<h2>Чего пробы не делают</h2>
<p>Проба готовности не «чинит» приложение — она лишь убирает его из балансировки. Если все реплики стали неготовы, сервис останется без конечных точек, и запросы будут отваливаться. Это правильное поведение: лучше явная ошибка, чем ответы от неработающего приложения, — но рассчитывать, что пробы сами вытянут сервис, не стоит.</p>
`,
quiz:[
 {q:"Что происходит при отказе <code>livenessProbe</code>?",
  opts:["Под убирают из Service","Контейнер перезапускают","Под удаляют","Ничего"],
  a:1, why:"Убирает из Service проба готовности. Проба живости именно перезапускает."},
 {q:"Почему опасно ставить пробе живости тот же адрес, что и пробе готовности?",
  opts:["Это дублирование","Медленный ответ под нагрузкой вызовет перезапуск, нагрузка переедет на соседей — и сервис ляжет по кругу","Ошибка конфигурации","Пробы конфликтуют"],
  a:1, why:"Проба живости должна отвечать только на вопрос «процесс не завис» и не ходить во внешние зависимости."},
 {q:"Что делает <code>startupProbe</code>?",
  opts:["Проверяет образ","Пока не прошла — остальные пробы не выполняются: это для приложений с долгим стартом","Запускает контейнер","Заменяет readiness"],
  a:1, why:"Иначе приходится выбирать между большим initialDelaySeconds и убийством здорового приложения на старте."},
 {q:"Что будет с выкаткой, если у новых подов нет пробы готовности?",
  opts:["Она не пойдёт","Под считается доступным сразу после старта процесса — запросы полетят в неподнявшееся приложение","Она замедлится","Ничего не изменится"],
  a:1, why:"Формально «выкатка прошла успешно», а пользователи в это время видели ошибки."},
 {q:"Какая проверка считается успешной при <code>httpGet</code>?",
  opts:["Только 200","Код ответа 200–399","Любой ответ","Ответ быстрее секунды"],
  a:1, why:"Есть ещё <code>tcpSocket</code> — достаточно открытого порта, и <code>exec</code> — нулевой код возврата команды."},
 {q:"Все реплики стали неготовы. Что произойдёт с сервисом?",
  opts:["Трафик пойдёт в неготовые поды","Конечных точек не останется — запросы будут отваливаться","Поды перезапустятся","Сервис удалится"],
  a:1, why:"Это правильное поведение: лучше явная ошибка, чем ответы от неработающего приложения."}
],
labs:[
 {id:"9a", title:"Проба, которая не проходит",
  brief:"<p>Deployment <code>api</code> развёрнут на три реплики, поды в состоянии <code>Running</code>, но сервис <code>api</code> не отвечает: конечных точек ноль.</p><ul><li>посмотрите поды — обратите внимание на колонку READY;</li><li>найдите в манифесте пробу готовности и поймите, почему она не проходит;</li><li>приложение отвечает по путям <code>/</code>, <code>/healthz</code> и <code>/ready</code> — исправьте путь на существующий и примените.</li></ul>",
  hint:"kubectl describe pod покажет строку Readiness с адресом пробы. Приложение не знает пути /health — правильный /healthz.",
  setup: () => {
    const C = seed(newScenario({files:{"api.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health
              port: 8080`}}),
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health
              port: 8080`);
    seed(C,
`apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080`);
    return C;
  },
  checks:[
   {label:"Поды осмотрены", test:st=>okRan(st,/describe\s+(pod|po)|get\s+(pods?|po)/)},
   {label:"Путь пробы исправлен", test:st=>pods(st).length > 0 && pods(st).every(p => {
     const pr = ((p.spec.containers[0] || {}).readinessProbe || {}).httpGet || {};
     return pr.path === "/healthz" || pr.path === "/ready" || pr.path === "/"; })},
   {label:"Все три пода готовы", test:st=>readyPods(st).length === 3},
   {label:"В сервисе три конечные точки", test:st=>{
     const s = svc(st, "api");
     return !!s && ((s.status || {}).endpoints || []).length === 3; }}
  ]},
 {id:"9b", title:"Проба живости убивает здоровое",
  brief:"<p>Поды <code>worker</code> бесконечно перезапускаются: счётчик RESTARTS растёт, состояние — <code>CrashLoopBackOff</code>. При этом само приложение исправно, а логи ничего плохого не показывают.</p><ul><li>найдите пробу живости и её адрес;</li><li>образ <code>shop/worker:1.0</code> вообще не обслуживает HTTP — эта проба живости к нему неприменима;</li><li>уберите её из манифеста и примените заново.</li></ul>",
  hint:"Проверять HTTP у приложения без HTTP бессмысленно. Удалите блок livenessProbe целиком.",
  setup: () => seed(newScenario({files:{"w.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
        - name: worker
          image: shop/worker:1.0
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080`}}),
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
        - name: worker
          image: shop/worker:1.0
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080`),
  checks:[
   {label:"Проба живости убрана", test:st=>pods(st).length > 0 &&
     pods(st).every(p => !(p.spec.containers[0] || {}).livenessProbe)},
   {label:"Обе реплики работают", test:st=>readyPods(st).length === 2},
   {label:"Перезапуски прекратились", test:st=>readyPods(st).length === 2 &&
     pods(st).every(p => podPhase(p) === "Running")},
   {label:"Образ не подменяли", test:st=>pods(st).length > 0 &&
     pods(st).every(p => p.spec.containers[0].image === "shop/worker:1.0" &&
                         !(p.spec.containers[0] || {}).livenessProbe)}
  ]}
],
iv:[
 {q:"Чем readiness отличается от liveness и что бывает при их путанице?",
  probe:"Один из самых частых вопросов. И один из самых показательных.",
  a:"Проба готовности отвечает на вопрос «можно ли слать сюда запросы»: при отказе под убирают из конечных точек Service, но не трогают — он продолжает работать и, скорее всего, восстановится. Проба живости отвечает на вопрос «жив ли процесс»: при отказе контейнер перезапускают. Отсюда и главная ошибка — дать пробе живости тот же тяжёлый адрес, что и пробе готовности, особенно если он ходит в базу или соседний сервис. Тогда под нагрузкой приложение отвечает медленно, проба живости не укладывается в таймаут, контейнер убивают, нагрузка переезжает на соседей, и весь сервис уходит в перезапуск по кругу — небольшой всплеск превращается в полный отказ. Поэтому проба живости должна быть максимально дешёвой и проверять только, что процесс не завис, а всё, что зависит от внешних систем, — забота пробы готовности. Для приложений с долгим стартом есть третья, <code>startupProbe</code>: пока она не прошла, остальные не выполняются.",
  more:["Зачем нужна startupProbe?","Что если пробы не настроены вовсе?"]}
]
},

/* ------------------------------------------------ 10 */
{
n:10, id:"rollout", title:"Обновления", sub:"Выкатка и откат",
lede:"Обновление без простоя — не магия, а арифметика: сколько подов можно поднять сверх нормы и сколько погасить, не опустившись ниже допустимого. Плюс одно условие, без которого всё это не работает.",
theory:`
<h2>Как идёт плавное обновление</h2>
<p>Deployment создаёт новый ReplicaSet и начинает переливать реплики: поднимает поды в новом, гасит в старом. Скорость задают два числа:</p>
<div class="tw"><table>
<tr><th>Параметр</th><th>Что означает</th><th>По умолчанию</th></tr>
<tr><td><code>maxSurge</code></td><td>сколько подов можно поднять <b>сверх</b> заказанного</td><td>25%</td></tr>
<tr><td><code>maxUnavailable</code></td><td>сколько подов можно держать недоступными</td><td>25%</td></tr>
</table></div>
<pre><code><span class="k">strategy</span>:
  <span class="k">type</span>: RollingUpdate
  <span class="k">rollingUpdate</span>:
    <span class="k">maxSurge</span>: 1
    <span class="k">maxUnavailable</span>: 0     <span class="c"># ни одного лишнего простоя</span></code></pre>
<p><code>maxUnavailable: 0</code> — самая безопасная настройка: новый под должен стать <b>готовым</b>, и только потом гасится старый. Платите тем, что нужна ёмкость под одну лишнюю реплику и выкатка идёт медленнее.</p>
<div class="note trap"><b class="hd">Всё это работает только с пробой готовности</b><p>Без неё Kubernetes считает под доступным сразу после старта процесса и гасит старый — а новый ещё поднимается. Формально «обновление без простоя», фактически — окно ошибок на каждой реплике. Проба готовности не украшение, а условие корректности выкатки.</p></div>

<h2>Две стратегии</h2>
<div class="tw"><table>
<tr><th></th><th><code>RollingUpdate</code></th><th><code>Recreate</code></th></tr>
<tr><td>Как</td><td>постепенно, версии сосуществуют</td><td>погасить всё, потом поднять новое</td></tr>
<tr><td>Простой</td><td>нет</td><td>есть</td></tr>
<tr><td>Когда нужно</td><td>почти всегда</td><td>когда две версии не могут работать одновременно — например, несовместимая миграция базы</td></tr>
</table></div>

<h2>Команды</h2>
<pre><code>kubectl set image deploy/api api=shop/api:2.0   <span class="c"># запустить выкатку</span>
kubectl rollout status deploy/api               <span class="c"># дождаться и проверить</span>
kubectl rollout history deploy/api              <span class="c"># список ревизий</span>
kubectl rollout undo deploy/api                 <span class="c"># откатить на предыдущую</span>
kubectl rollout undo deploy/api --to-revision=2 <span class="c"># на конкретную</span>
kubectl rollout restart deploy/api              <span class="c"># перезапустить без смены образа</span></code></pre>
<div class="note ok"><b class="hd">Почему откат мгновенный</b><p>Старый ReplicaSet никуда не делся — он просто с нулём реплик. Откат поднимает его обратно, ничего не пересобирая и не скачивая заново. Сколько ревизий хранить, задаёт <code>revisionHistoryLimit</code>.</p></div>

<h2>Сломанная выкатка</h2>
<p>Если новый образ не запускается — не скачивается, падает, не проходит пробу, — выкатка <b>останавливается</b>. Новые поды висят в ошибке, старые продолжают работать и обслуживать трафик. Это принципиально: правильно настроенная выкатка сломанной версии не роняет сервис, а замирает.</p>
<pre><code>$ <span class="k">kubectl rollout status deploy/api</span>
Waiting for deployment "api" rollout to finish: 2 of 3 updated replicas are available...</code></pre>
<p>Увидели такое — смотрите поды нового набора: <code>kubectl get pods</code>, затем <code>describe</code> и <code>logs</code> проблемного. Дальше либо чините, либо откатываете.</p>

<div class="note warn"><b class="hd"><code>latest</code> ломает всё это</b><p>Тег <code>latest</code> не даёт понять, какая версия сейчас работает, делает откат бессмысленным (там снова <code>latest</code>) и мешает Kubernetes заметить изменение образа — шаблон-то не поменялся, выкатка не начнётся. В рабочем кластере образы всегда с конкретной версией, а лучше — по цифровому отпечатку.</p></div>
`,
quiz:[
 {q:"Что означает <code>maxSurge</code>?",
  opts:["Сколько подов можно держать недоступными","Сколько подов можно поднять сверх заказанного","Скорость выкатки","Число ревизий"],
  a:1, why:"Второе число — <code>maxUnavailable</code> — задаёт, сколько можно держать недоступными."},
 {q:"<code>maxUnavailable: 0</code> — что это даёт?",
  opts:["Мгновенную выкатку","Новый под должен стать готовым, и только потом гасится старый — простоя нет","Отключает выкатку","Экономию ресурсов"],
  a:1, why:"Платите ёмкостью под одну лишнюю реплику и более медленной выкаткой."},
 {q:"Почему обновление без простоя не работает без пробы готовности?",
  opts:["Она обязательна по схеме","Под считается доступным сразу после старта процесса — старый гасится, пока новый ещё поднимается","Она ускоряет старт","Без неё поды не создаются"],
  a:1, why:"Формально «обновление без простоя», фактически — окно ошибок на каждой реплике."},
 {q:"Почему <code>rollout undo</code> срабатывает мгновенно?",
  opts:["Образ кешируется","Старый ReplicaSet остался с нулём реплик — его просто поднимают обратно","Откат идёт в фоне","Он не мгновенный"],
  a:1, why:"Сколько таких наборов хранить, задаёт <code>revisionHistoryLimit</code>."},
 {q:"Новый образ падает при старте. Что произойдёт с сервисом?",
  opts:["Он ляжет","Выкатка остановится, старые поды продолжат обслуживать трафик","Все поды перезапустятся","Deployment удалится"],
  a:1, why:"Правильно настроенная выкатка сломанной версии не роняет сервис, а замирает."},
 {q:"Чем плох тег <code>latest</code>?",
  opts:["Он медленный","Непонятно, что работает; откат бессмыслен; смена образа не меняет шаблон — выкатка не начнётся","Он занимает место","Он устарел"],
  a:1, why:"В рабочем кластере образы всегда с конкретной версией, а лучше — по цифровому отпечатку."}
],
labs:[
 {id:"10a", title:"Выкатить новую версию",
  brief:"<p>Сервис <code>api</code> работает на образе <code>shop/api:1.0</code>, три реплики. Вышла версия <code>shop/api:2.0</code>.</p><ul><li>запустите выкатку командой, без правки манифеста;</li><li>дождитесь её завершения через <code>rollout status</code>;</li><li>убедитесь, что все три пода на новом образе.</li></ul>",
  hint:"kubectl set image deploy/api api=shop/api:2.0, затем kubectl rollout status deploy/api",
  setup: () => seed(newScenario({}),
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080`),
  checks:[
   {label:"Выкатка запущена командой", test:st=>okRan(st,/set\s+image/)},
   {label:"Все поды на версии 2.0", test:st=>pods(st).length === 3 &&
     pods(st).every(p => p.spec.containers[0].image === "shop/api:2.0")},
   {label:"Все три готовы", test:st=>readyPods(st).length === 3 &&
     pods(st).every(p => p.spec.containers[0].image === "shop/api:2.0")},
   {label:"Завершение проверено через <code>rollout status</code>", test:st=>okRan(st,/rollout\s+status/)},
   {label:"Старый набор остался про запас", test:st=>rsets(st).length === 2}
  ]},
 {id:"10b", title:"Откатить сломанное",
  brief:"<p>Кто-то выкатил образ <code>shop/api:broken</code> — он падает при старте. Выкатка замерла: новые поды в <code>CrashLoopBackOff</code>, часть старых ещё жива.</p><ul><li>посмотрите, что происходит, и найдите причину в логах проблемного пода;</li><li>откатите Deployment на предыдущую ревизию;</li><li>убедитесь, что все три пода снова на <code>shop/api:1.0</code> и работают.</li></ul>",
  hint:"kubectl get pods, kubectl logs <упавший под>, затем kubectl rollout undo deploy/api",
  setup: () => {
    const C = seed(newScenario({}),
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080`);
    runKubectl(C, "kubectl set image deploy/api api=shop/api:broken");
    return C;
  },
  checks:[
   {label:"Логи упавшего пода прочитаны", test:st=>okRan(st,/kubectl\s+logs/)},
   {label:"Выполнен откат", test:st=>okRan(st,/rollout\s+undo/)},
   {label:"Все поды снова на 1.0", test:st=>pods(st).length === 3 &&
     pods(st).every(p => p.spec.containers[0].image === "shop/api:1.0")},
   {label:"Все три готовы", test:st=>readyPods(st).length === 3}
  ]},
 {id:"10c", title:"Выкатка без единого простоя",
  brief:"<p>Сервис критичен: во время обновления число доступных реплик <b>не должно опускаться</b> ниже заказанного.</p><p>Настройте в манифесте стратегию так, чтобы <code>maxUnavailable</code> был <b>0</b>, а <code>maxSurge</code> — <b>1</b>. Примените и выкатите версию <code>shop/api:2.0</code>.</p>",
  hint:"spec.strategy.type: RollingUpdate и вложенный rollingUpdate с maxSurge: 1, maxUnavailable: 0.",
  setup: () => seed(newScenario({files:{"api.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080`}}),
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080`),
  checks:[
   {label:"Стратегия описана в манифесте", test:st=>{
     const d = dep(st, "api");
     return !!d && ((d.spec.strategy || {}).type || "RollingUpdate") === "RollingUpdate" &&
            !!(d.spec.strategy || {}).rollingUpdate; }},
   {label:"<code>maxUnavailable</code> равен 0", test:st=>{
     const d = dep(st, "api");
     return !!d && String((((d.spec.strategy || {}).rollingUpdate || {}).maxUnavailable)) === "0"; }},
   {label:"<code>maxSurge</code> равен 1", test:st=>{
     const d = dep(st, "api");
     return !!d && String((((d.spec.strategy || {}).rollingUpdate || {}).maxSurge)) === "1"; }},
   {label:"Версия 2.0 выкачена и работает", test:st=>readyPods(st).length === 3 &&
     pods(st).every(p => p.spec.containers[0].image === "shop/api:2.0")}
  ]}
],
iv:[
 {q:"Как устроено обновление без простоя и что нужно, чтобы оно действительно работало?",
  probe:"Ждут не только описание RollingUpdate, но и упоминание пробы готовности.",
  a:"Deployment создаёт новый ReplicaSet под новую версию шаблона и постепенно переливает реплики: поднимает поды в новом наборе, гасит в старом. Темп задают <code>maxSurge</code> — сколько подов можно поднять сверх заказанного, и <code>maxUnavailable</code> — сколько допустимо держать недоступными; по умолчанию оба по двадцать пять процентов. Для критичных сервисов я ставлю <code>maxUnavailable: 0</code> и <code>maxSurge: 1</code>: тогда сначала поднимается лишний под, дожидается готовности, и только после этого гасится старый. И здесь ключевое условие: всё это имеет смысл только при настроенной пробе готовности. Без неё Kubernetes считает под пригодным сразу после старта процесса и гасит старый, пока новый ещё поднимается, — получается формально бесперебойная выкатка с окном ошибок на каждой реплике. Если новая версия не запускается, выкатка замирает, старые поды продолжают обслуживать трафик, и дальше либо чиним, либо <code>rollout undo</code>, который мгновенен, потому что старый ReplicaSet никуда не делся.",
  more:["Когда нужна стратегия Recreate?","Почему тег latest мешает?"]}
]
},
