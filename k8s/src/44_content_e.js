
/* ------------------------------------------------ 11 */
{
n:11, id:"debug", title:"Диагностика", sub:"Почему под не работает",
lede:"Kubernetes почти всегда прямо говорит, что не так, — надо знать, куда смотреть. Пять состояний покрывают подавляющее большинство обращений.",
theory:`
<h2>Порядок действий</h2>
<pre><code>kubectl get pods                  <span class="c"># 1. что вообще происходит</span>
kubectl describe pod &lt;имя&gt;        <span class="c"># 2. события внизу вывода</span>
kubectl logs &lt;имя&gt;                <span class="c"># 3. что говорит приложение</span>
kubectl logs &lt;имя&gt; --previous     <span class="c"># 4. что говорил перед падением</span>
kubectl get events                <span class="c"># 5. что происходило в целом</span></code></pre>
<p>Ключевое место — <b>раздел событий</b> внизу <code>describe</code>. Он существует именно для того, чтобы объяснять, и почти всегда объясняет.</p>

<h2>Пять состояний</h2>
<div class="tw"><table>
<tr><th>Состояние</th><th>Что случилось</th><th>Куда смотреть</th></tr>
<tr><td><code>Pending</code></td><td>планировщик не нашёл узел</td><td>события: <code>Insufficient cpu/memory</code>, ограничители, селектор</td></tr>
<tr><td><code>ImagePullBackOff</code></td><td>образ не скачался</td><td>опечатка в имени или теге, нет доступа к реестру</td></tr>
<tr><td><code>CrashLoopBackOff</code></td><td>контейнер стартует и падает</td><td><code>logs --previous</code>: обычно нет настройки или недоступна зависимость</td></tr>
<tr><td><code>OOMKilled</code></td><td>превышен лимит памяти</td><td>раздел Last State в <code>describe</code>; поднять лимит или чинить утечку</td></tr>
<tr><td><code>Running</code>, но <code>0/1</code></td><td>не проходит проба готовности</td><td>адрес и порт пробы, зависимости приложения</td></tr>
</table></div>

<h2>Разбор частых случаев</h2>
<div class="note trap"><b class="hd"><code>ImagePullBackOff</code></b><p>Сначала <code>ErrImagePull</code>, потом, после нескольких попыток, <code>ImagePullBackOff</code>. Причины по убыванию частоты: опечатка в имени образа или теге; тег, которого нет в реестре; закрытый реестр без <code>imagePullSecrets</code>; неверный адрес реестра. Точное сообщение — в событиях <code>describe</code>.</p></div>
<div class="note trap"><b class="hd"><code>CrashLoopBackOff</code></b><p>Само по себе оно ничего не говорит — это лишь «падает и перезапускается с растущей паузой». Причину даёт <code>kubectl logs &lt;имя&gt; --previous</code>: обычно не задана обязательная переменная окружения, недоступна база, нет файла конфигурации или процесс завершается сразу, потому что это не сервис, а разовая команда.</p></div>
<div class="note warn"><b class="hd"><code>OOMKilled</code> — не всегда утечка</b><p>Прежде чем поднимать лимит, стоит понять, сколько приложению нужно на самом деле: <code>kubectl top pods</code>, метрики. Иногда лимит просто занижен и был поставлен наугад, иногда приложение действительно течёт, а иногда среда выполнения не знает про лимит контейнера и считает доступной всю память узла — так бывает у виртуальных машин языков со сборкой мусора.</p></div>

<h2>Полезные приёмы</h2>
<div class="tw"><table>
<tr><th>Приём</th><th>Зачем</th></tr>
<tr><td><code>kubectl logs -f deploy/api</code></td><td>поток логов, не выясняя имя пода</td></tr>
<tr><td><code>kubectl exec -it &lt;под&gt; -- sh</code></td><td>заглянуть внутрь работающего контейнера</td></tr>
<tr><td><code>kubectl port-forward svc/api 8080:80</code></td><td>достучаться до сервиса со своей машины</td></tr>
<tr><td><code>kubectl get events --sort-by=.lastTimestamp</code></td><td>что происходило в кластере по времени</td></tr>
<tr><td>Сменить метку у пода</td><td>вывести из балансировки и изучать живым</td></tr>
</table></div>
<div class="note ok"><b class="hd">Про <code>exec</code> в упавший контейнер</b><p>Не получится: команда выполняется <b>внутри работающего</b> контейнера, а его нет. Для таких случаев есть эфемерные отладочные контейнеры (<code>kubectl debug</code>), а в простом варианте — временно заменить команду запуска на <code>sleep</code>, чтобы контейнер поднялся и в него можно было зайти.</p></div>
`,
quiz:[
 {q:"С чего начинается разбор проблемного пода?",
  opts:["<code>kubectl logs</code>","<code>kubectl describe pod</code> и раздел событий внизу","<code>kubectl get all</code>","Перезапуск пода"],
  a:1, why:"Раздел событий существует именно для того, чтобы объяснять, и почти всегда объясняет."},
 {q:"<code>ImagePullBackOff</code> — самая частая причина?",
  opts:["Нет места на узле","Опечатка в имени образа или теге","Нет прав у пода","Сломан kubelet"],
  a:1, why:"Дальше по убыванию: несуществующий тег, закрытый реестр без imagePullSecrets, неверный адрес реестра."},
 {q:"Что показывает <code>kubectl logs &lt;под&gt; --previous</code>?",
  opts:["Логи соседнего пода","Логи предыдущего запуска контейнера — то, что он сказал перед падением","Логи узла","Историю команд"],
  a:1, why:"Для CrashLoopBackOff это главный источник: текущий контейнер ещё ничего не успел написать."},
 {q:"Под в состоянии <code>Running</code>, но <code>0/1</code>. Что это?",
  opts:["Ошибка вывода","Не проходит проба готовности — трафик в него не идёт","Контейнер остановлен","Нет образа"],
  a:1, why:"Смотреть надо на адрес и порт пробы и на зависимости приложения."},
 {q:"Можно ли зайти в упавший контейнер через <code>kubectl exec</code>?",
  opts:["Да","Нет: команда выполняется внутри работающего контейнера, а его нет","Только с --force","Только root"],
  a:1, why:"Есть эфемерные отладочные контейнеры (<code>kubectl debug</code>) либо временная замена команды на <code>sleep</code>."},
 {q:"Что стоит сделать до поднятия лимита памяти при <code>OOMKilled</code>?",
  opts:["Перезапустить под","Понять, сколько приложению нужно на самом деле — <code>top</code> и метрики","Добавить узел","Отключить лимиты"],
  a:1, why:"Иногда лимит занижен наугад, иногда приложение течёт, а иногда среда выполнения не видит лимит контейнера."}
],
labs:[
 {id:"11a", title:"Образ не скачался",
  brief:"<p>Deployment <code>api</code> не поднимается: поды в <code>ImagePullBackOff</code>.</p><ul><li>найдите точное сообщение в событиях;</li><li>в манифесте опечатка в теге образа — правильная версия <code>shop/api:1.0</code>;</li><li>исправьте и примените.</li></ul>",
  hint:"kubectl describe pod <имя> — раздел Events внизу назовёт образ, который не удалось скачать.",
  setup: () => seed(newScenario({files:{"api.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
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
          image: shop/api:1.O`}}),
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
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
          image: shop/api:1.O`),
  checks:[
   {label:"События осмотрены", test:st=>okRan(st,/describe\s+(pod|po)|get\s+events/)},
   {label:"Образ исправлен", test:st=>pods(st).length > 0 &&
     pods(st).every(p => p.spec.containers[0].image === "shop/api:1.0")},
   {label:"Обе реплики работают", test:st=>readyPods(st).length === 2},
   {label:"Ошибок скачивания больше нет", test:st=>pods(st).length > 0 &&
     pods(st).every(p => podPhase(p) === "Running")}
  ]},
 {id:"11b", title:"Убит по памяти",
  brief:"<p>Под <code>hungry</code> перезапускается по кругу. В <code>describe</code> видно, что предыдущий запуск завершился с <code>OOMKilled</code>.</p><ul><li>посмотрите, какой лимит памяти стоит сейчас;</li><li>приложению нужно около 512Mi — поднимите лимит до <b>640Mi</b>, оставив запас;</li><li>примените заново (под придётся пересоздать) и убедитесь, что он работает.</li></ul>",
  hint:"kubectl describe pod hungry покажет Last State и лимит. Правьте pod.yaml, затем delete и apply.",
  setup: () => seed(newScenario({files:{"pod.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: hungry
spec:
  containers:
    - name: app
      image: shop/api:hungry
      resources:
        limits:
          memory: 128Mi`}}),
`apiVersion: v1
kind: Pod
metadata:
  name: hungry
spec:
  containers:
    - name: app
      image: shop/api:hungry
      resources:
        limits:
          memory: 128Mi`),
  checks:[
   {label:"Причина найдена в <code>describe</code>", test:st=>okRan(st,/describe\s+(pod|po)\s+hungry/)},
   {label:"Под работает", test:st=>{
     const p = get(st.C, "default", "Pod", "hungry"); return !!p && podReady(p); }},
   {label:"Лимит поднят до 640Mi", test:st=>{
     const p = get(st.C, "default", "Pod", "hungry");
     return !!p && memOf((((p.spec.containers[0] || {}).resources || {}).limits || {}).memory) === 640; }},
   {label:"Образ не подменяли", test:st=>{
     const p = get(st.C, "default", "Pod", "hungry");
     return !!p && p.spec.containers[0].image === "shop/api:hungry" &&
       memOf(((p.spec.containers[0].resources || {}).limits || {}).memory) === 640; }}
  ]},
 {id:"11c", title:"Разобраться самому",
  brief:"<p>В пространстве имён развёрнуто четыре приложения, и <b>три из них не работают</b> — каждое по своей причине. Манифесты всех четырёх лежат в панели «Манифест».</p><p>Найдите и почините все три. Подсказок о том, что именно сломано, здесь нет — это и есть задание: пройти путём <code>get</code> → <code>describe</code> → <code>logs</code> и прочитать, что говорит кластер.</p><p>Итог: все поды всех четырёх приложений работают и готовы.</p>",
  hint:"Одно не находит образ, второе не влезает по ресурсам (узлы по 2 ядра и 4Gi), третье не проходит пробу готовности — приложение отвечает по /, /healthz и /ready.",
  setup: () => {
    const C = newScenario({files:{
      "ok.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: ok
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ok
  template:
    metadata:
      labels:
        app: ok
    spec:
      containers:
        - name: ok
          image: nginx:1.25`,
      "one.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: one
spec:
  replicas: 1
  selector:
    matchLabels:
      app: one
  template:
    metadata:
      labels:
        app: one
    spec:
      containers:
        - name: one
          image: shop/api:2.O`,
      "two.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: two
spec:
  replicas: 1
  selector:
    matchLabels:
      app: two
  template:
    metadata:
      labels:
        app: two
    spec:
      containers:
        - name: two
          image: shop/api:1.0
          resources:
            requests:
              cpu: "16"`,
      "three.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: three
spec:
  replicas: 1
  selector:
    matchLabels:
      app: three
  template:
    metadata:
      labels:
        app: three
    spec:
      containers:
        - name: three
          image: shop/api:1.0
          readinessProbe:
            httpGet:
              path: /status
              port: 8080`}});
    for(const f of ["ok.yaml","one.yaml","two.yaml","three.yaml"]) seed(C, C.files[f]);
    return C;
  },
  checks:[
   {label:"Все четыре приложения на месте", test:st=>
     ["ok","one","two","three"].every(n => !!dep(st, n)) &&
     pods(st).length >= 4 && readyPods(st).length === pods(st).length},
   {label:"Образ у <code>one</code> исправлен", test:st=>{
     const ps = pods(st).filter(p => p.metadata.labels.app === "one");
     return ps.length > 0 && ps.every(p => podReady(p)); }},
   {label:"Запрос ресурсов у <code>two</code> стал разумным", test:st=>{
     const ps = pods(st).filter(p => p.metadata.labels.app === "two");
     return ps.length > 0 && ps.every(p => podReady(p)); }},
   {label:"Проба у <code>three</code> проходит", test:st=>{
     const ps = pods(st).filter(p => p.metadata.labels.app === "three");
     return ps.length > 0 && ps.every(p => podReady(p)); }},
   {label:"Готовы все поды без исключения", test:st=>
     pods(st).length >= 4 && readyPods(st).length === pods(st).length}
  ]}
],
iv:[
 {q:"Под в CrashLoopBackOff. Ваши действия?",
  probe:"Самый частый практический вопрос по эксплуатации. Ждут последовательность, а не догадки.",
  a:"Само состояние означает лишь «контейнер стартует, падает и перезапускается с растущей паузой» — о причине оно не говорит ничего. Поэтому первым делом <code>kubectl logs &lt;под&gt; --previous</code>: текущий контейнер обычно ещё ничего не успел написать, а вот предыдущий запуск оставил сообщение об ошибке. Чаще всего там не задана обязательная переменная окружения, недоступна база или отсутствует файл конфигурации; отдельный случай — когда в контейнере запускается не сервис, а разовая команда, и он честно завершается сразу. Параллельно смотрю <code>kubectl describe pod</code>: раздел Last State покажет код возврата и, если это была нехватка памяти, причину <code>OOMKilled</code> — тогда разговор уже про лимиты, а не про конфигурацию. Зайти внутрь через <code>exec</code> не выйдет, контейнера ведь нет; если нужно осмотреться, помогает эфемерный отладочный контейнер или временная подмена команды запуска на <code>sleep</code>.",
  more:["Что делать при OOMKilled?","Как отладить контейнер, который не стартует?"]}
]
},

/* ------------------------------------------------ 12 */
{
n:12, id:"ops", title:"Эксплуатация", sub:"Пространства, права, здравый смысл",
lede:"Последний раздел — про то, что отличает работающий кластер от учебного: как делят пространство, чем ограничивают аппетиты и какие вопросы стоит задать до того, как переезжать в Kubernetes.",
theory:`
<h2>Пространства имён</h2>
<p>Namespace — это область имён и точка приложения ограничений, а не изоляция. Внутри пространства имена уникальны; между пространствами объекты видят друг друга по полным DNS-именам и, если не настроены сетевые политики, свободно ходят в гости.</p>
<div class="tw"><table>
<tr><th>Что даёт</th><th>Чего не даёт</th></tr>
<tr><td>уникальность имён</td><td>сетевую изоляцию — нужны NetworkPolicy</td></tr>
<tr><td>границу для квот и лимитов</td><td>изоляцию узлов и ресурсов физически</td></tr>
<tr><td>границу для прав доступа</td><td>защиту от соседа, съевшего весь узел</td></tr>
</table></div>
<pre><code>kubectl create namespace prod
kubectl get pods -n prod
kubectl config set-context --current --namespace=prod   <span class="c"># не писать -n каждый раз</span></code></pre>
<div class="note warn"><b class="hd">Самая дорогая ошибка эксплуатации</b><p>Выполнить команду не в том пространстве имён. Привычка смотреть в текущий контекст перед любым изменяющим действием, а в боевых кластерах — держать их в отдельном контексте с явным именем, экономит очень много нервов.</p></div>

<h2>Квоты и лимиты</h2>
<div class="tw"><table>
<tr><th>Объект</th><th>Что ограничивает</th></tr>
<tr><td><code>ResourceQuota</code></td><td>суммарные ресурсы и число объектов в пространстве имён</td></tr>
<tr><td><code>LimitRange</code></td><td>значения по умолчанию и допустимый диапазон для отдельного контейнера</td></tr>
</table></div>
<p><code>LimitRange</code> особенно полезен: он подставляет <code>requests</code> и <code>limits</code> тем, кто их не указал, — а это ровно те поды, которые иначе ломают планировщику расчёт.</p>

<h2>Права доступа</h2>
<p>RBAC отвечает на вопрос «кто и что может делать». Четыре объекта: <code>Role</code> и <code>RoleBinding</code> действуют внутри пространства имён, <code>ClusterRole</code> и <code>ClusterRoleBinding</code> — во всём кластере. Роль перечисляет разрешённые действия над типами объектов, привязка соединяет роль с пользователем или служебной учётной записью.</p>
<div class="note ok"><b class="hd">Практическое правило</b><p>Приложению по умолчанию не нужен доступ к API кластера вообще. Если нужен — минимально возможная роль в своём пространстве имён. Служебная учётная запись с правами администратора кластера у обычного приложения — типичная находка при разборе инцидента.</p></div>

<h2>Что стоит настроить сразу</h2>
<div class="tw"><table>
<tr><th>Настройка</th><th>Зачем</th></tr>
<tr><td><code>requests</code> и <code>limits</code> у всего</td><td>иначе планировщик работает вслепую</td></tr>
<tr><td>Пробы готовности</td><td>без них выкатка без простоя — фикция</td></tr>
<tr><td>Несколько реплик и <code>podAntiAffinity</code></td><td>иначе отказ узла уносит сервис целиком</td></tr>
<tr><td>Конкретные теги образов</td><td><code>latest</code> ломает откат и выкатку</td></tr>
<tr><td><code>PodDisruptionBudget</code></td><td>чтобы обслуживание узлов не выселило все реплики разом</td></tr>
</table></div>

<h2>Нужен ли вообще Kubernetes</h2>
<p>Честный ответ — далеко не всегда. Он даёт много, но взамен требует людей, которые умеют его чинить, и добавляет слой, где ошибиться можно новыми способами. Для одного приложения на паре машин управляемый сервис контейнеров или обычная виртуальная машина проще, дешевле и надёжнее. Kubernetes начинает окупаться, когда сервисов десятки, команд несколько, а требования к выкатке и отказоустойчивости настоящие, а не декларативные.</p>
<p>Умение сказать это на собеседовании ценится выше, чем перечисление типов объектов: оно показывает, что вы выбираете инструмент под задачу, а не наоборот.</p>
`,
quiz:[
 {q:"Что даёт Namespace?",
  opts:["Сетевую изоляцию","Уникальность имён и границу для квот и прав","Отдельные узлы","Отдельный кластер"],
  a:1, why:"Сетевой изоляции он не даёт — для неё нужны NetworkPolicy. Соседи по умолчанию свободно ходят друг к другу."},
 {q:"Зачем нужен <code>LimitRange</code>?",
  opts:["Ограничить число подов","Подставить <code>requests</code> и <code>limits</code> по умолчанию и задать допустимый диапазон","Ограничить трафик","Задать квоту диска"],
  a:1, why:"Поды без запросов — ровно те, что ломают планировщику расчёт. LimitRange закрывает эту дыру."},
 {q:"Чем <code>Role</code> отличается от <code>ClusterRole</code>?",
  opts:["Правами на запись","Областью действия: пространство имён против всего кластера","Числом пользователей","Ничем"],
  a:1, why:"Привязка (<code>RoleBinding</code> или <code>ClusterRoleBinding</code>) соединяет роль с пользователем или служебной учётной записью."},
 {q:"Какие права нужны обычному приложению к API кластера?",
  opts:["Полные — так проще","Никаких по умолчанию; если нужны — минимальная роль в своём пространстве имён","Только чтение всего кластера","Права администратора"],
  a:1, why:"Служебная учётная запись с правами администратора у обычного приложения — типичная находка при разборе инцидента."},
 {q:"Зачем нужен <code>PodDisruptionBudget</code>?",
  opts:["Ограничить расходы","Чтобы обслуживание узлов не выселило все реплики сервиса разом","Ограничить число подов","Задать приоритет"],
  a:1, why:"Он задаёт, сколько реплик обязано остаться доступными при добровольных выселениях."},
 {q:"Когда Kubernetes избыточен?",
  opts:["Никогда","Когда приложений мало и требования к выкатке невысоки — он требует людей, умеющих его чинить","Для веб-приложений","Для баз данных"],
  a:1, why:"Умение назвать границу применимости на собеседовании ценится выше, чем перечисление типов объектов."}
],
labs:[
 {id:"12a", title:"Развернуть в отдельном пространстве",
  brief:"<p>Приложение должно жить в пространстве имён <code>prod</code>, которого пока нет.</p><ul><li>создайте пространство имён;</li><li>переключите текущий контекст на него, чтобы не писать <code>-n</code> каждый раз;</li><li>примените <code>api.yaml</code>;</li><li>убедитесь, что в <code>default</code> при этом пусто.</li></ul>",
  hint:"kubectl create namespace prod, kubectl config set-context --current --namespace=prod, затем apply.",
  setup: () => newScenario({files:{"api.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
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
          image: shop/api:1.0`}}),
  checks:[
   {label:"Пространство имён создано", test:st=>!!get(st.C, "", "Namespace", "prod")},
   {label:"Контекст переключён", test:st=>st.C.ns === "prod"},
   {label:"Две реплики работают в <code>prod</code>", test:st=>readyPods(st, "prod").length === 2},
   {label:"В <code>default</code> пусто", test:st=>list(st.C, "Pod", "default").length === 0 &&
     readyPods(st, "prod").length === 2}
  ]},
 {id:"12b", title:"Собрать полный комплект",
  brief:"<p>Итоговое задание. В пространстве <code>default</code> нужно развернуть приложение так, как это делают в рабочем кластере. Все манифесты пишутся с нуля в панели «Манифест» — файл <code>all.yaml</code> заготовлен пустым, объекты в нём разделяются строкой <code>---</code>.</p><p>Требуется:</p><ul><li><b>ConfigMap</b> <code>shop-config</code> с ключом <code>MODE=prod</code>;</li><li><b>Deployment</b> <code>shop</code>: 3 реплики, образ <code>shop/api:2.0</code>, метка <code>app: shop</code>, порт 8080, переменная <code>MODE</code> из ConfigMap, проба готовности на <code>/ready</code>, запросы и лимиты <code>200m</code> и <code>256Mi</code> (одинаковые — класс Guaranteed);</li><li><b>Service</b> <code>shop</code>: порт 80 на порт приложения 8080.</li></ul>",
  hint:"Три документа через ---. Селектор Deployment должен совпадать с меткой шаблона, а селектор Service — с той же меткой.",
  setup: () => newScenario({files:{"all.yaml": "# опишите здесь ConfigMap, Deployment и Service\n"}}),
  checks:[
   {label:"ConfigMap на месте", test:st=>{
     const c = cm(st, "shop-config"); return !!c && c.data.MODE === "prod"; }},
   {label:"Три пода работают на версии 2.0", test:st=>readyPods(st).length === 3 &&
     pods(st).every(p => p.spec.containers[0].image === "shop/api:2.0")},
   {label:"Класс обслуживания <code>Guaranteed</code>", test:st=>pods(st).length === 3 &&
     pods(st).every(p => qosOf(p) === "Guaranteed")},
   {label:"Переменная берётся из ConfigMap", test:st=>pods(st).length === 3 &&
     pods(st).every(p => (p.spec.containers[0].env || []).some(e =>
       e.name === "MODE" && ((e.valueFrom || {}).configMapKeyRef || {}).name === "shop-config"))},
   {label:"Проба готовности на <code>/ready</code>", test:st=>pods(st).length === 3 &&
     pods(st).every(p => (((p.spec.containers[0] || {}).readinessProbe || {}).httpGet || {}).path === "/ready")},
   {label:"Service отдаёт три конечные точки", test:st=>{
     const s = svc(st, "shop");
     return !!s && (s.spec.ports || []).some(p => p.port === 80 && String(p.targetPort) === "8080") &&
            ((s.status || {}).endpoints || []).length === 3; }}
  ]}
],
iv:[
 {q:"Что даёт Namespace и что он не даёт?",
  probe:"Проверяют, не считаете ли вы пространство имён средством изоляции.",
  a:"Namespace — это область уникальности имён и точка приложения ограничений: квот через <code>ResourceQuota</code>, значений по умолчанию через <code>LimitRange</code>, прав через <code>Role</code> и <code>RoleBinding</code>. Чего он не даёт — изоляции. Поды из разных пространств по умолчанию свободно ходят друг к другу по сети, и чтобы это ограничить, нужны <code>NetworkPolicy</code>. Он также не изолирует ресурсы физически: сосед, съевший память узла, повлияет на вас независимо от пространства — от этого спасают запросы, лимиты и, при необходимости, разделение по узлам. Поэтому для по-настоящему разных сред — стенд и бой — я предпочитаю разные кластеры, а пространства имён использую для разделения команд и приложений внутри одной среды. Ну и практическая мелочь, которая дорого стоит: перед любым изменяющим действием стоит смотреть, в каком контексте и пространстве вы находитесь.",
  more:["Что такое NetworkPolicy?","Разные кластеры или разные namespace для прода?"]},
 {q:"Когда Kubernetes не нужен?",
  probe:"Вопрос на инженерную зрелость. Ответ «он нужен всегда» считают плохим знаком.",
  a:"Он не нужен, когда его цена выше отдачи. Kubernetes даёт декларативное управление, самовосстановление, выкатку без простоя и единообразие — но взамен требует людей, которые умеют его настраивать и чинить, и добавляет слой, в котором можно ошибиться новыми способами: сеть, права, хранилище, планировщик. Для одного приложения на паре машин управляемый сервис контейнеров, а то и обычная виртуальная машина с systemd, будут проще, дешевле и надёжнее — там нечему ломаться. Он начинает окупаться, когда сервисов десятки, команд несколько, выкатки частые, а требования к отказоустойчивости настоящие. Отдельно я бы отметил, что переезд в Kubernetes не чинит архитектуру: приложение, хранящее состояние в памяти процесса или пишущее на локальный диск, в кластере станет работать хуже, а не лучше, потому что поды там пересоздаются постоянно.",
  more:["Что нужно поменять в приложении перед переездом?","Какие альтернативы вы рассматривали?"]}
]
}

];
