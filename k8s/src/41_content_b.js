
/* ------------------------------------------------ 2 */
{
n:2, id:"pod", title:"Pod", sub:"Минимальная единица",
lede:"Kubernetes запускает не контейнеры, а поды. Разница кажется формальной ровно до первого вопроса «почему у меня два контейнера видят один localhost».",
theory:`
<h2>Что такое под</h2>
<p>Под — это один или несколько контейнеров, которые <b>всегда</b> живут на одном узле и делят:</p>
<div class="tw"><table>
<tr><th>Что общее</th><th>Следствие</th></tr>
<tr><td>Сетевое пространство имён</td><td>контейнеры видят друг друга по <code>localhost</code>, порты внутри пода не должны совпадать</td></tr>
<tr><td>IP-адрес</td><td>адрес выдаётся поду, а не контейнеру</td></tr>
<tr><td>Тома</td><td>можно смонтировать один каталог в оба контейнера</td></tr>
<tr><td>Жизненный цикл</td><td>под планируется, переезжает и удаляется целиком</td></tr>
</table></div>
<div class="note"><b class="hd">Когда контейнеров в поде больше одного</b><p>Редко и по делу: рядом с основным ставят вспомогательный — сборщик логов, прокси сервисной сети, обновлятель конфигурации. Признак правильного случая: вспомогательный контейнер бессмыслен без основного и должен жить ровно столько же. Два независимых приложения в одном поде — почти всегда ошибка: их нельзя масштабировать и обновлять по отдельности.</p></div>

<h2>Под эфемерен</h2>
<pre><code><span class="k">apiVersion</span>: v1
<span class="k">kind</span>: Pod
<span class="k">metadata</span>:
  <span class="k">name</span>: solo
<span class="k">spec</span>:
  <span class="k">containers</span>:
    - <span class="k">name</span>: web
      <span class="k">image</span>: nginx:1.25</code></pre>
<div class="note trap"><b class="hd">Такой под никто не воскресит</b><p>Под, созданный напрямую, ничем не управляется. Упал узел — под исчез навсегда, и его никто не пересоздаст: желаемого состояния, к которому надо приводить, попросту нет. Поэтому в рабочем кластере одиночные поды не создают. Их место — быстрая проверка руками и отладка.</p><p>Всё, что должно жить, описывают контроллером: <code>Deployment</code> для приложений без состояния, <code>StatefulSet</code> для тех, кому важна идентичность, <code>DaemonSet</code> для «по одному на каждый узел», <code>Job</code> и <code>CronJob</code> для разовых и периодических задач.</p></div>

<h2>Жизненный цикл</h2>
<div class="tw"><table>
<tr><th>Фаза</th><th>Что означает</th></tr>
<tr><td><code>Pending</code></td><td>объект принят, но контейнеры ещё не запущены: ждёт планировщика или скачивания образа</td></tr>
<tr><td><code>Running</code></td><td>под привязан к узлу, хотя бы один контейнер работает</td></tr>
<tr><td><code>Succeeded</code></td><td>все контейнеры завершились с нулём и не будут перезапущены</td></tr>
<tr><td><code>Failed</code></td><td>все завершились, хотя бы один — с ошибкой</td></tr>
</table></div>
<p>Отдельно от фазы есть <b>условие Ready</b>: под работает, но готов ли он принимать запросы, решает проба готовности. Именно поэтому в выводе <code>kubectl get pods</code> две колонки: <code>STATUS</code> и <code>READY</code>, и <code>1/1 Running</code> — это не то же самое, что <code>0/1 Running</code>.</p>

<h2><code>restartPolicy</code></h2>
<div class="tw"><table>
<tr><th>Значение</th><th>Когда</th></tr>
<tr><td><code>Always</code> (по умолчанию)</td><td>долгоживущие приложения: контейнер поднимают всегда</td></tr>
<tr><td><code>OnFailure</code></td><td>задачи: перезапуск только при ненулевом коде</td></tr>
<tr><td><code>Never</code></td><td>задачи, где перезапуск не нужен</td></tr>
</table></div>
<div class="note warn"><b class="hd">Про <code>CrashLoopBackOff</code></b><p>Это не отдельная фаза, а состояние ожидания контейнера: он падает, kubelet перезапускает его со всё большей паузой — отсюда «BackOff». Само сообщение ничего не говорит о причине; причину показывают <code>kubectl logs</code> и события в <code>describe</code>.</p></div>
`,
quiz:[
 {q:"Что делят контейнеры внутри одного пода?",
  opts:["Ничего","Сеть, IP-адрес, тома и жизненный цикл","Только диск","Только процессорное время"],
  a:1, why:"Поэтому они видят друг друга по <code>localhost</code>, а порты внутри пода не должны совпадать."},
 {q:"Под создан напрямую манифестом <code>kind: Pod</code>. Узел выключился. Что будет?",
  opts:["Под переедет на другой узел","Под исчезнет навсегда — им никто не управляет","Kubernetes поднимет копию","Под перейдёт в Pending"],
  a:1, why:"Нет желаемого состояния, к которому надо приводить. Поэтому в рабочем кластере одиночные поды не создают."},
 {q:"Когда оправдано ставить два контейнера в один под?",
  opts:["Когда они относятся к одному проекту","Когда вспомогательный бессмыслен без основного и должен жить ровно столько же","Чтобы сэкономить адреса","Всегда, так быстрее"],
  a:1, why:"Два независимых приложения в одном поде нельзя масштабировать и обновлять по отдельности."},
 {q:"Чем <code>0/1 Running</code> отличается от <code>1/1 Running</code>?",
  opts:["Ничем","Под работает, но не готов принимать запросы — не прошла проба готовности","Под остановлен","Ошибка вывода"],
  a:1, why:"Фаза и готовность — разные вещи. Неготовый под не попадёт в балансировку Service."},
 {q:"Что означает <code>CrashLoopBackOff</code>?",
  opts:["Отдельную фазу пода","Состояние ожидания: контейнер падает, kubelet перезапускает его с растущей паузой","Ошибку сети","Нехватку памяти"],
  a:1, why:"Само сообщение о причине молчит — её показывают <code>kubectl logs</code> и события в <code>describe</code>."},
 {q:"Какой <code>restartPolicy</code> подходит разовой задаче?",
  opts:["<code>Always</code>","<code>OnFailure</code> или <code>Never</code>","Любой","Политика не применяется к задачам"],
  a:1, why:"С <code>Always</code> задача, завершившись успешно, будет запускаться снова и снова."}
],
labs:[
 {id:"2a", title:"Одинокий под",
  brief:"<p>Убедитесь, что одиночным подом никто не управляет.</p><ul><li>примените <code>pod.yaml</code>;</li><li>дождитесь <code>Running</code>;</li><li>удалите под;</li><li>посмотрите список.</li></ul><p>В отличие от первого задания, здесь никто ничего не восстановит — подов останется ноль.</p>",
  hint:"kubectl apply -f pod.yaml, kubectl get pods, kubectl delete pod solo, kubectl get pods",
  setup: () => newScenario({files:{"pod.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: solo
  labels:
    app: проба
spec:
  containers:
    - name: web
      image: nginx:1.25`}}),
  checks:[
   {label:"Под создавался", test:st=>okRan(st,/apply\s+-f\s+pod\.yaml/)},
   {label:"И был удалён", test:st=>okRan(st,/delete\s+pod/)},
   {label:"Подов не осталось — восстанавливать некому", test:st=>pods(st).length === 0 && okRan(st,/delete\s+pod/)},
   {label:"Список проверен после удаления", test:st=>st.log.some((e, i) =>
     /delete\s+pod/.test(e.cmd) && st.log.slice(i + 1).some(x => /get\s+(pods?|po)/.test(x.cmd)))}
  ]},
 {id:"2b", title:"Два контейнера, один localhost",
  brief:"<p>Соберите под с двумя контейнерами: основной <code>web</code> с образом <code>nginx:1.25</code> и вспомогательный <code>log</code> с образом <code>busybox</code>.</p><p>Манифест <code>side.yaml</code> уже начат — допишите второй контейнер в панели «Манифест» внизу и примените.</p><p>Под должен получиться один, а контейнеров в нём — два: в списке это будет видно как <code>2/2</code>.</p>",
  hint:"В spec.containers добавьте второй элемент списка: - name: log с image: busybox. Отступ такой же, как у первого.",
  setup: () => newScenario({files:{"side.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: bundle
spec:
  containers:
    - name: web
      image: nginx:1.25
`}}),
  checks:[
   {label:"Под создан", test:st=>!!get(st.C, "default", "Pod", "bundle")},
   {label:"В нём два контейнера", test:st=>{
     const p = get(st.C, "default", "Pod", "bundle");
     return !!p && (p.spec.containers || []).length === 2; }},
   {label:"Имена и образы верные", test:st=>{
     const p = get(st.C, "default", "Pod", "bundle");
     if(!p) return false;
     const c = p.spec.containers || [];
     return c.some(x => x.name === "web" && x.image === "nginx:1.25") &&
            c.some(x => x.name === "log" && x.image === "busybox"); }},
   {label:"Оба контейнера работают", test:st=>{
     const p = get(st.C, "default", "Pod", "bundle");
     return !!p && (p.status.containerStatuses || []).filter(c => c.ready).length === 2; }}
  ]}
],
iv:[
 {q:"Почему Kubernetes запускает поды, а не контейнеры?",
  probe:"Проверяют, понимаете ли вы, зачем нужна лишняя, на первый взгляд, сущность.",
  a:"Потому что бывают вещи, которые обязаны находиться рядом: делить сеть, диск и жизненный цикл. Под — это как раз группа таких контейнеров с общим сетевым пространством имён, общим адресом и общими томами; они видят друг друга по <code>localhost</code> и всегда планируются на один узел. Классический случай — вспомогательный контейнер рядом с основным: сборщик логов, прокси сервисной сети, обновлятель конфигурации. Если бы единицей был контейнер, такие пары пришлось бы связывать вручную и надеяться, что планировщик поставит их вместе. При этом подавляющее большинство подов в реальности содержат ровно один контейнер, и это нормально: под тогда просто тонкая обёртка, дающая единый объект для планирования и адресации.",
  more:["Приведите пример sidecar","Что будет, если положить в под два приложения?"]},
 {q:"Чем отличаются фаза пода и его готовность?",
  probe:"Практический вопрос: от ответа зависит понимание того, почему трафик уходит в неготовый под.",
  a:"Фаза — это укрупнённое состояние жизненного цикла: <code>Pending</code>, <code>Running</code>, <code>Succeeded</code>, <code>Failed</code>. Она отвечает на вопрос «запустились ли контейнеры». Готовность — отдельное условие, которое ставит проба готовности и которое отвечает на другой вопрос: «можно ли слать сюда запросы». Приложение может работать, но ещё прогревать кеш или ждать базу — тогда фаза <code>Running</code>, а готовность <code>False</code>, и в списке это видно как <code>0/1 Running</code>. Практическое значение прямое: в конечные точки Service попадают только готовые поды, поэтому корректно настроенная проба готовности — это то, что не пускает трафик в приложение, которое ещё не может его обслужить, и то, что делает выкатку без простоя действительно бесперебойной.",
  more:["Что будет, если пробы готовности нет?","Чем readiness отличается от liveness?"]}
]
},

/* ------------------------------------------------ 3 */
{
n:3, id:"deploy", title:"Deployment", sub:"Контроллер и ReplicaSet",
lede:"Между вашим манифестом и подами есть промежуточное звено. Понимание, зачем оно, объясняет и обновления, и откаты, и странные имена подов.",
theory:`
<h2>Цепочка</h2>
<pre><code>Deployment  →  ReplicaSet  →  Pod, Pod, Pod</code></pre>
<div class="tw"><table>
<tr><th>Объект</th><th>За что отвечает</th></tr>
<tr><td><b>Deployment</b></td><td>какой шаблон пода актуален и как переходить от старого к новому</td></tr>
<tr><td><b>ReplicaSet</b></td><td>держать заданное число подов <b>одного</b> шаблона</td></tr>
<tr><td><b>Pod</b></td><td>собственно запущенное приложение</td></tr>
</table></div>
<p>Промежуточное звено нужно ровно для обновлений: у каждой версии шаблона свой ReplicaSet, и выкатка — это подъём одного набора и опускание другого. Отсюда и имена: <code>web-7d4b8c9f5</code> — это Deployment, хеш шаблона и суффикс пода.</p>
<div class="note ok"><b class="hd">Посмотрите сами</b><p>Примените Deployment, затем <code>kubectl get rs</code>. Смените образ через <code>kubectl set image</code> и посмотрите снова — наборов станет два, и у старого будет ноль реплик. Он остаётся специально: на него откатываются.</p></div>

<h2>Ключевые поля</h2>
<pre><code><span class="k">spec</span>:
  <span class="k">replicas</span>: 3
  <span class="k">selector</span>:                 <span class="c"># по каким меткам искать СВОИ поды</span>
    <span class="k">matchLabels</span>:
      <span class="k">app</span>: web
  <span class="k">template</span>:                 <span class="c"># шаблон пода</span>
    <span class="k">metadata</span>:
      <span class="k">labels</span>:
        <span class="k">app</span>: web            <span class="c"># должен подходить под селектор</span>
    <span class="k">spec</span>:
      <span class="k">containers</span>:
        - <span class="k">name</span>: web
          <span class="k">image</span>: nginx:1.25</code></pre>
<div class="note trap"><b class="hd">Селектор и метки шаблона обязаны совпадать</b><p>Если <code>selector.matchLabels</code> не является подмножеством <code>template.metadata.labels</code>, контроллер не найдёт поды, которые сам же создал, и будет плодить их снова и снова. Современный API это проверяет и отклоняет манифест — попробуйте в терминале и прочитайте сообщение.</p><p>И отдельно: <b>селектор нельзя изменить после создания</b>. Понадобилось — создавайте новый Deployment.</p></div>

<h2>Масштабирование</h2>
<pre><code>kubectl scale deploy/web --replicas=5      <span class="c"># быстро, но мимо манифеста</span>
<span class="c"># в манифесте: spec.replicas: 5, затем kubectl apply</span></code></pre>
<p>Первый способ хорош для проверки и аварийного вмешательства. Но состояние кластера разойдётся с тем, что лежит в репозитории, и следующий <code>apply</code> вернёт прежнее число. Постоянные изменения делают в манифесте.</p>

<h2>Другие контроллеры</h2>
<div class="tw"><table>
<tr><th>Контроллер</th><th>Для чего</th></tr>
<tr><td><code>Deployment</code></td><td>приложения без состояния: реплики взаимозаменяемы</td></tr>
<tr><td><code>StatefulSet</code></td><td>когда важны устойчивые имена, порядок запуска и свой диск у каждой реплики</td></tr>
<tr><td><code>DaemonSet</code></td><td>по одному поду на каждый узел: сбор логов, метрики, сетевые агенты</td></tr>
<tr><td><code>Job</code> и <code>CronJob</code></td><td>разовая задача и задача по расписанию</td></tr>
</table></div>
`,
quiz:[
 {q:"Зачем между Deployment и подами есть ReplicaSet?",
  opts:["Для совместимости","У каждой версии шаблона свой набор — на этом устроены выкатка и откат","Для масштабирования","Он не нужен"],
  a:1, why:"Выкатка — это подъём одного набора и опускание другого. Старый пустой набор оставляют, чтобы было куда откатиться."},
 {q:"Что произойдёт, если селектор не совпадает с метками шаблона пода?",
  opts:["Ничего страшного","Контроллер не найдёт свои поды; современный API такой манифест отклоняет","Поды не создадутся","Поды создадутся без меток"],
  a:1, why:"Без проверки контроллер плодил бы поды бесконечно, каждый раз не находя предыдущие."},
 {q:"Можно ли изменить <code>selector</code> у существующего Deployment?",
  opts:["Да, обычным apply","Нет — селектор неизменяем, нужен новый Deployment","Только через scale","Только с --force"],
  a:1, why:"Иначе контроллер разом потерял бы все ранее созdata поды."},
 {q:"Чем плохо постоянно масштабировать через <code>kubectl scale</code>?",
  opts:["Это медленно","Состояние кластера расходится с манифестом, и следующий apply всё вернёт","Требует прав","Ломает поды"],
  a:1, why:"Для разовой проверки или аварии — нормально. Постоянные изменения место в манифесте."},
 {q:"Какой контроллер нужен, чтобы поставить агента сбора логов на каждый узел?",
  opts:["<code>Deployment</code>","<code>DaemonSet</code>","<code>StatefulSet</code>","<code>Job</code>"],
  a:1, why:"DaemonSet следит, чтобы на каждом узле был ровно один такой под, включая только что добавленные узлы."},
 {q:"Когда вместо Deployment нужен StatefulSet?",
  opts:["Когда подов много","Когда важны устойчивые имена, порядок запуска и свой диск у каждой реплики","Когда нужен Service","Когда приложение на Java"],
  a:1, why:"Типичный случай — базы данных и кластеры с выборами лидера, где реплики не взаимозаменяемы."}
],
labs:[
 {id:"3a", title:"Собрать Deployment",
  brief:"<p>Манифест <code>api.yaml</code> написан наполовину: есть <code>metadata</code>, но не хватает всего <code>spec</code>.</p><p>Допишите его в панели «Манифест» так, чтобы получилось: <b>4 реплики</b>, образ <code>shop/api:1.0</code>, имя контейнера <code>api</code>, метка <code>app: api</code> и подходящий селектор. Затем примените.</p>",
  hint:"spec: replicas, selector.matchLabels.app, template.metadata.labels.app и template.spec.containers. Метка в шаблоне должна совпадать с селектором.",
  setup: () => newScenario({files:{"api.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
`}}),
  checks:[
   {label:"Deployment создан", test:st=>!!dep(st, "api")},
   {label:"Заказано четыре реплики", test:st=>{ const d = dep(st, "api"); return !!d && d.spec.replicas === 4; }},
   {label:"Все четыре пода работают", test:st=>readyPods(st).length === 4},
   {label:"Образ верный", test:st=>pods(st).length === 4 && pods(st).every(p => p.spec.containers[0].image === "shop/api:1.0")},
   {label:"Появился ReplicaSet-посредник", test:st=>rsets(st).length === 1}
  ]},
 {id:"3b", title:"Сломанный селектор",
  brief:"<p>Манифест <code>bad.yaml</code> не применяется — API его отклоняет. Прочитайте сообщение об ошибке, найдите причину и почините манифест, <b>не меняя метку шаблона</b> <code>app: cache</code>.</p><p>После починки должно подняться две реплики.</p>",
  hint:"Селектор должен быть подмножеством меток шаблона. Сейчас там разные значения.",
  setup: () => newScenario({files:{"bad.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: cache
spec:
  replicas: 2
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: cache
    spec:
      containers:
        - name: cache
          image: redis:7`}}),
  checks:[
   {label:"Ошибка была замечена", test:st=>st.log.some(e => e.err && /селектор|selector/i.test(e.err))},
   {label:"Deployment применился", test:st=>!!dep(st, "cache")},
   {label:"Метка шаблона осталась <code>app: cache</code>", test:st=>{
     const d = dep(st, "cache");
     return !!d && ((d.spec.template.metadata || {}).labels || {}).app === "cache"; }},
   {label:"Два пода работают", test:st=>readyPods(st).length === 2}
  ]},
 {id:"3c", title:"Масштабирование",
  brief:"<p>Нагрузка выросла. Увеличьте число реплик Deployment <code>api</code> с двух до шести, не редактируя манифест — командой.</p><p>Затем убедитесь, что подов действительно шесть и все они готовы.</p>",
  hint:"kubectl scale deploy/api --replicas=6",
  setup: () => seed(newScenario({}),
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
          image: shop/api:1.0`),
  checks:[
   {label:"Использована команда масштабирования", test:st=>okRan(st,/scale/)},
   {label:"Заказано шесть реплик", test:st=>{ const d = dep(st, "api"); return !!d && d.spec.replicas === 6; }},
   {label:"Шесть подов работают", test:st=>readyPods(st).length === 6},
   {label:"ReplicaSet остался один — шаблон не менялся", test:st=>rsets(st).length === 1 && readyPods(st).length === 6}
  ]}
],
iv:[
 {q:"Что происходит между Deployment и подом?",
  probe:"Проверяют, знаете ли вы про ReplicaSet и зачем он.",
  a:"Deployment не создаёт поды напрямую. Он создаёт ReplicaSet под конкретную версию шаблона пода — имя набора включает хеш этого шаблона, — а уже ReplicaSet держит нужное число подов. Промежуточное звено существует ради обновлений: когда я меняю образ, Deployment заводит новый ReplicaSet и начинает поднимать поды в нём, одновременно опуская старый. Старый набор остаётся с нулём реплик, и именно поэтому возможен мгновенный откат: <code>kubectl rollout undo</code> просто снова поднимает его. Побочно это объясняет и имена подов вида <code>web-7d4b8c9f5-x2k9p</code>: имя Deployment, хеш шаблона, суффикс пода. Сколько старых наборов хранить, задаётся полем <code>revisionHistoryLimit</code>.",
  more:["Что будет при откате?","Зачем revisionHistoryLimit?"]}
]
},

/* ------------------------------------------------ 4 */
{
n:4, id:"labels", title:"Метки", sub:"Чем всё связано",
lede:"В Kubernetes почти нет прямых ссылок между объектами. Service не знает про Deployment, Deployment не знает про свои поды по именам — всё держится на метках. Отсюда и гибкость, и целый класс ошибок «работает, но не находит».",
theory:`
<h2>Метки и аннотации</h2>
<div class="tw"><table>
<tr><th></th><th>Метки (labels)</th><th>Аннотации (annotations)</th></tr>
<tr><td>Для чего</td><td>отбор объектов</td><td>произвольные data для людей и инструментов</td></tr>
<tr><td>Можно искать по ним</td><td>да</td><td>нет</td></tr>
<tr><td>Размер</td><td>короткие значения</td><td>сколько угодно</td></tr>
<tr><td>Примеры</td><td><code>app=web</code>, <code>env=prod</code>, <code>tier=backend</code></td><td>ссылка на сборку, контрольная сумма конфигурации, описание</td></tr>
</table></div>

<h2>Кто на что смотрит</h2>
<pre><code>Service      → selector → поды с такими метками
Deployment   → selector → свои ReplicaSet и поды
NetworkPolicy→ selector → к каким подам применять правила
kubectl -l   → selector → что показать</code></pre>
<div class="note trap"><b class="hd">Опечатка в селекторе не вызывает ошибку</b><p>Service с селектором <code>app: wev</code> вместо <code>app: web</code> создастся успешно и будет выглядеть совершенно нормально. Просто в нём не будет ни одной конечной точки, а запросы начнут отваливаться по таймауту. Ошибку не покажет ни <code>apply</code>, ни <code>get svc</code> — её видно только в <code>kubectl get endpoints</code> или в строке <code>Endpoints</code> вывода <code>describe</code>.</p><p>Это первое, что нужно проверять, когда «сервис есть, а не работает».</p></div>

<h2>Отбор в командной строке</h2>
<pre><code>kubectl get pods -l app=web                <span class="c"># равенство</span>
kubectl get pods -l 'env!=prod'            <span class="c"># неравенство</span>
kubectl get pods -l 'app in (web, api)'    <span class="c"># множество</span>
kubectl get pods -l app                    <span class="c"># просто наличие метки</span>
kubectl get pods --show-labels             <span class="c"># посмотреть, что вообще есть</span></code></pre>

<h2>Общепринятые имена меток</h2>
<div class="tw"><table>
<tr><th>Метка</th><th>Что означает</th></tr>
<tr><td><code>app.kubernetes.io/name</code></td><td>имя приложения</td></tr>
<tr><td><code>app.kubernetes.io/instance</code></td><td>конкретный экземпляр установки</td></tr>
<tr><td><code>app.kubernetes.io/version</code></td><td>версия</td></tr>
<tr><td><code>app.kubernetes.io/component</code></td><td>роль внутри системы: <code>frontend</code>, <code>database</code></td></tr>
</table></div>
<p>Никто не обязывает их использовать, но инструменты — панели, сборщики метрик, пакетные менеджеры — рассчитывают именно на них. Свои метки удобно держать в своём пространстве имён, например <code>team.example.com/owner</code>.</p>

<h2>Приём: временно вывести под из-под балансировки</h2>
<pre><code>kubectl label pod web-abc123 app=web-debug --overwrite</code></pre>
<p>Под перестаёт подходить под селектор Service — трафик на него не идёт. Но и под селектор ReplicaSet он тоже больше не подходит, поэтому контроллер немедленно поднимет замену, а этот останется живым для изучения. Хитрый и очень практичный приём: изучать проблему на живом поде, не мешая пользователям.</p>
`,
quiz:[
 {q:"Чем метки отличаются от аннотаций?",
  opts:["Ничем","По меткам можно отбирать объекты, по аннотациям — нет","Аннотации видны только в API","Метки только для подов"],
  a:1, why:"Аннотации — произвольные data для людей и инструментов: ссылка на сборку, контрольная сумма конфигурации."},
 {q:"Service создан с опечаткой в селекторе. Что произойдёт?",
  opts:["Ошибка при apply","Создастся нормально, но останется без конечных точек — запросы будут отваливаться","Не создастся","Возьмёт все поды"],
  a:1, why:"Видно это только в <code>kubectl get endpoints</code> или в строке Endpoints вывода describe."},
 {q:"Как Deployment находит свои поды?",
  opts:["По именам","По меткам через селектор","По порядку создания","По узлу"],
  a:1, why:"Прямых ссылок между объектами в Kubernetes почти нет — всё держится на метках."},
 {q:"Что покажет <code>kubectl get pods -l app</code>?",
  opts:["Ошибку","Поды, у которых метка <code>app</code> есть с любым значением","Поды с меткой app=app","Все поды"],
  a:1, why:"Проверка наличия метки — отдельная форма селектора, без указания значения."},
 {q:"Зачем менять метку у живого пода на <code>app=web-debug</code>?",
  opts:["Чтобы удалить его","Чтобы вывести из-под балансировки и изучать, пока контроллер поднимает замену","Чтобы перезапустить","Чтобы перенести на другой узел"],
  a:1, why:"Под перестаёт подходить и под селектор Service, и под селектор ReplicaSet — трафик уходит, замена поднимается."},
 {q:"Зачем нужны метки вида <code>app.kubernetes.io/name</code>?",
  opts:["Они обязательны","На них рассчитывают инструменты: панели, сборщики метрик, пакетные менеджеры","Они быстрее","Они защищены от изменения"],
  a:1, why:"Свои метки принято держать в своём пространстве имён, например <code>team.example.com/owner</code>."}
],
labs:[
 {id:"4a", title:"Сервис без конечных точек",
  brief:"<p>В кластере развёрнут <code>shop</code> на три пода и Service <code>shop</code>, но запросы к сервису не проходят. Поды при этом в порядке.</p><ul><li>найдите причину — сравните селектор сервиса с метками подов;</li><li>почините Service, не трогая Deployment;</li><li>убедитесь, что конечных точек стало три.</li></ul>",
  hint:"kubectl describe svc shop покажет строку Endpoints и селектор. kubectl get pods --show-labels или describe пода покажет метки. Правьте svc.yaml в панели «Манифест».",
  setup: () => {
    const C = seed(newScenario({files:{"svc.yaml":
`apiVersion: v1
kind: Service
metadata:
  name: shop
spec:
  selector:
    app: shopp
  ports:
    - port: 80
      targetPort: 8080`}}),
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shop
  template:
    metadata:
      labels:
        app: shop
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          ports:
            - containerPort: 8080`);
    seed(C, C.files["svc.yaml"]);
    return C;
  },
  checks:[
   {label:"Причина найдена — селектор осмотрен", test:st=>okRan(st,/describe\s+(svc|service)|get\s+(ep|endpoints)|--show-labels/)},
   {label:"Service чинили, а не пересоздавали Deployment", test:st=>{
     const d = dep(st, "shop"), s = svc(st, "shop");
     return !!d && ((d.spec.selector || {}).matchLabels || {}).app === "shop" &&
            !!s && (s.spec.selector || {}).app === "shop"; }},
   {label:"Селектор сервиса исправлен", test:st=>{
     const s = svc(st, "shop");
     return !!s && (s.spec.selector || {}).app === "shop"; }},
   {label:"Конечных точек стало три", test:st=>{
     const s = svc(st, "shop");
     return !!s && ((s.status || {}).endpoints || []).length === 3; }}
  ]},
 {id:"4b", title:"Изучить под, не мешая пользователям",
  brief:"<p>Один из подов <code>shop</code> ведёт себя странно, и его хочется изучить, не выводя из строя сервис.</p><ul><li>измените метку <code>app</code> у одного пода на <code>shop-debug</code> (потребуется <code>--overwrite</code>);</li><li>убедитесь, что контроллер поднял замену и рабочих подов снова три;</li><li>помеченный под должен остаться живым, но выпасть из конечных точек сервиса.</li></ul>",
  hint:"kubectl label pod <имя> app=shop-debug --overwrite. Имена подов — в kubectl get pods.",
  setup: () => {
    const C = seed(newScenario({}),
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shop
  template:
    metadata:
      labels:
        app: shop
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          ports:
            - containerPort: 8080`);
    seed(C,
`apiVersion: v1
kind: Service
metadata:
  name: shop
spec:
  selector:
    app: shop
  ports:
    - port: 80
      targetPort: 8080`);
    return C;
  },
  checks:[
   {label:"Метка изменена командой <code>label</code>", test:st=>okRan(st,/kubectl\s+label\s+pod/)},
   {label:"Помеченный под жив", test:st=>pods(st).some(p => p.metadata.labels.app === "shop-debug" && podReady(p))},
   {label:"Всего подов стало четыре", test:st=>pods(st).length === 4},
   {label:"В сервисе по-прежнему три точки", test:st=>{
     const s = svc(st, "shop");
     return !!s && ((s.status || {}).endpoints || []).length === 3 && pods(st).length === 4; }}
  ]}
],
iv:[
 {q:"Сервис создан, поды работают, но запросы не проходят. С чего начнёте?",
  probe:"Самый частый практический вопрос по Kubernetes. Ждут конкретной последовательности.",
  a:"Первым делом смотрю конечные точки: <code>kubectl get endpoints &lt;имя&gt;</code> или строку <code>Endpoints</code> в <code>kubectl describe svc</code>. Если там пусто, причина почти всегда одна из двух: селектор сервиса не совпадает с метками подов — банальная опечатка, которую ни <code>apply</code>, ни <code>get svc</code> не покажут, — либо поды есть, но не готовы, и потому не попадают в балансировку; это видно по колонке READY. Если точки на месте, проверяю порты: <code>targetPort</code> сервиса должен указывать на порт, который приложение действительно слушает, — тут часто путают <code>port</code> и <code>targetPort</code>. Дальше уже сетевой уровень: политики сети, DNS-имя, из какого пространства имён обращаются. Но в девяти случаях из десяти всё заканчивается на первом шаге.",
  more:["Чем port отличается от targetPort?","Как проверить DNS-имя сервиса?"]}
]
},
