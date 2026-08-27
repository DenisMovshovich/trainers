
/* ------------------------------------------------ 5 */
{
n:5, id:"service", title:"Service", sub:"Постоянный адрес для непостоянных подов",
lede:"Поды рождаются и умирают, их адреса меняются. Service — это неподвижная точка, за которой они прячутся, и один из немногих объектов, где ошибка стоит недоступности сервиса.",
theory:`
<h2>Зачем он нужен</h2>
<p>У каждого пода свой IP-адрес, и он не переживает пересоздание пода. Обращаться по такому адресу бессмысленно. Service даёт постоянный адрес и имя, а список подов за ним поддерживается автоматически — по меткам.</p>
<pre><code><span class="k">apiVersion</span>: v1
<span class="k">kind</span>: Service
<span class="k">metadata</span>:
  <span class="k">name</span>: shop
<span class="k">spec</span>:
  <span class="k">selector</span>:
    <span class="k">app</span>: shop           <span class="c"># кого балансируем</span>
  <span class="k">ports</span>:
    - <span class="k">port</span>: 80           <span class="c"># на каком порту слушает СЕРВИС</span>
      <span class="k">targetPort</span>: 8080   <span class="c"># на какой порт ПОДА переслать</span></code></pre>
<div class="note trap"><b class="hd">Путаница <code>port</code> и <code>targetPort</code></b><p><code>port</code> — порт, по которому к сервису обращаются другие. <code>targetPort</code> — порт, который реально слушает приложение в контейнере. Их часто делают одинаковыми, привыкают и потом долго не понимают, почему запросы не доходят. Если <code>targetPort</code> не указан, он считается равным <code>port</code>.</p></div>

<h2>Типы</h2>
<div class="tw"><table>
<tr><th>Тип</th><th>Кто может обратиться</th><th>Когда</th></tr>
<tr><td><code>ClusterIP</code> (по умолчанию)</td><td>только изнутри кластера</td><td>связь между сервисами — большинство случаев</td></tr>
<tr><td><code>NodePort</code></td><td>снаружи, по адресу любого узла и порту 30000–32767</td><td>отладка, простые стенды</td></tr>
<tr><td><code>LoadBalancer</code></td><td>снаружи, через балансировщик облака</td><td>боевой доступ снаружи в облаке</td></tr>
<tr><td><code>ExternalName</code></td><td>—</td><td>псевдоним для внешнего DNS-имени</td></tr>
</table></div>
<p>Типы вложены друг в друга: <code>LoadBalancer</code> создаёт под собой <code>NodePort</code>, а тот — <code>ClusterIP</code>. Отдельно стоит <b>Ingress</b>: это не тип сервиса, а отдельный объект, который принимает HTTP снаружи и раздаёт его по сервисам на основании имени хоста и пути. Один Ingress обычно заменяет десяток <code>LoadBalancer</code>.</p>

<h2>Имена в DNS</h2>
<pre><code>shop                          <span class="c"># из того же пространства имён</span>
shop.prod                     <span class="c"># из другого</span>
shop.prod.svc.cluster.local   <span class="c"># полная форма</span></code></pre>
<p>Имя сервиса — это то, что приложения пишут в настройках вместо адресов. Именно поэтому переименование сервиса ломает связи, а адреса подов вообще не должны попадать в конфигурацию.</p>

<h2>Конечные точки</h2>
<p>За каждым сервисом стоит список конечных точек — адресов <b>готовых</b> подов, подходящих под селектор. Он обновляется автоматически: под стал готов — попал в список, перестал — выпал.</p>
<pre><code>kubectl get endpoints shop
kubectl describe svc shop     <span class="c"># строка Endpoints</span></code></pre>
<div class="note ok"><b class="hd">Ключ к диагностике</b><p>Пустой список конечных точек — это либо неверный селектор, либо поды не готовы. Оба случая проверяются за десять секунд и покрывают подавляющее большинство обращений «сервис не работает».</p></div>

<h2>Сервис без селектора</h2>
<p>Бывает и такое: сервис создают без <code>selector</code> и заполняют конечные точки вручную. Так дают внутреннее имя чему-то, что живёт вне кластера, — например базе данных на отдельной машине. Приложение обращается к обычному имени сервиса и не знает, что там снаружи.</p>
`,
quiz:[
 {q:"Зачем нужен Service, если у пода есть IP-адрес?",
  opts:["Для скорости","Адрес пода не переживает его пересоздание, а адрес сервиса постоянен","Для шифрования","Для внешнего доступа"],
  a:1, why:"Список подов за сервисом поддерживается автоматически по меткам."},
 {q:"Чем <code>port</code> отличается от <code>targetPort</code>?",
  opts:["Ничем","<code>port</code> — порт сервиса, <code>targetPort</code> — порт, который слушает приложение в контейнере","<code>targetPort</code> — внешний","<code>port</code> — для UDP"],
  a:1, why:"Если <code>targetPort</code> не указан, он считается равным <code>port</code>. Их часто путают, и запросы не доходят."},
 {q:"Какой тип сервиса доступен только изнутри кластера?",
  opts:["<code>NodePort</code>","<code>ClusterIP</code>","<code>LoadBalancer</code>","<code>ExternalName</code>"],
  a:1, why:"Это тип по умолчанию и подходящий для большинства случаев — связи между сервисами внутри кластера."},
 {q:"Что такое Ingress?",
  opts:["Тип сервиса","Отдельный объект: принимает HTTP снаружи и раздаёт по сервисам по хосту и пути","Балансировщик облака","Сетевая политика"],
  a:1, why:"Один Ingress обычно заменяет десяток сервисов типа LoadBalancer."},
 {q:"Список конечных точек сервиса пуст. Две вероятные причины?",
  opts:["Нет прав и нет сети","Неверный селектор либо поды не готовы","Сервис не создан и порт занят","Узел упал и DNS сломан"],
  a:1, why:"Оба случая проверяются за десять секунд и покрывают большинство обращений «сервис не работает»."},
 {q:"По какому имени приложение обратится к сервису <code>shop</code> из другого пространства имён <code>prod</code>?",
  opts:["<code>shop</code>","<code>shop.prod</code>","<code>prod.shop</code>","По IP-адресу"],
  a:1, why:"Полная форма — <code>shop.prod.svc.cluster.local</code>. Внутри своего пространства достаточно просто <code>shop</code>."}
],
labs:[
 {id:"5a", title:"Открыть приложение сервисом",
  brief:"<p>Deployment <code>api</code> развёрнут: три пода, приложение слушает порт <b>8080</b>. Сервиса нет.</p><p>Создайте Service с именем <code>api</code>, который принимает запросы на порту <b>80</b> и пересылает их на порт приложения. Манифест <code>svc.yaml</code> заготовлен пустым — допишите его в панели «Манифест».</p><p>После применения в сервисе должно быть три конечные точки.</p>",
  hint:"selector должен совпадать с меткой подов app: api; port: 80, targetPort: 8080.",
  setup: () => seed(newScenario({files:{"svc.yaml": "apiVersion: v1\nkind: Service\nmetadata:\n  name: api\n"}}),
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
            - containerPort: 8080`),
  checks:[
   {label:"Service создан", test:st=>!!svc(st, "api")},
   {label:"Принимает на порту 80", test:st=>{
     const s = svc(st, "api");
     return !!s && (s.spec.ports || []).some(p => p.port === 80); }},
   {label:"Пересылает на 8080", test:st=>{
     const s = svc(st, "api");
     return !!s && (s.spec.ports || []).some(p => String(p.targetPort) === "8080"); }},
   {label:"Три конечные точки", test:st=>{
     const s = svc(st, "api");
     return !!s && ((s.status || {}).endpoints || []).length === 3; }}
  ]},
 {id:"5b", title:"Открыть наружу",
  brief:"<p>Сервис <code>api</code> типа <code>ClusterIP</code> работает внутри кластера. Для стенда нужно достучаться до него снаружи.</p><p>Измените тип сервиса на <code>NodePort</code>, оставив порт 80 и цель 8080. Проверьте через <code>kubectl get svc</code>, что появился внешний порт из диапазона 30000–32767.</p>",
  hint:"В svc.yaml добавьте в spec строку type: NodePort и примените заново.",
  setup: () => {
    const C = seed(newScenario({files:{"svc.yaml":
`apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080`}}),
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
          image: shop/api:1.0
          ports:
            - containerPort: 8080`);
    seed(C, C.files["svc.yaml"]);
    return C;
  },
  checks:[
   {label:"Тип изменён на <code>NodePort</code>", test:st=>{
     const s = svc(st, "api"); return !!s && s.spec.type === "NodePort"; }},
   {label:"Внешний порт назначен", test:st=>{
     const s = svc(st, "api");
     return !!s && (s.spec.ports || []).some(p => p.nodePort >= 30000 && p.nodePort <= 32767); }},
   {label:"Порт и цель прежние", test:st=>{
     const s = svc(st, "api");
     return !!s && s.spec.type === "NodePort" &&
            (s.spec.ports || []).some(p => p.port === 80 && String(p.targetPort) === "8080"); }},
   {label:"Конечные точки на месте", test:st=>{
     const s = svc(st, "api");
     return !!s && s.spec.type === "NodePort" && ((s.status || {}).endpoints || []).length === 2; }}
  ]}
],
iv:[
 {q:"Какие бывают типы Service и что выберете вы?",
  probe:"Простой вопрос, но по нему видно, работали ли вы с реальным доступом снаружи.",
  a:"Основных четыре. <code>ClusterIP</code> — по умолчанию, адрес доступен только внутри кластера; это то, что нужно для связи сервисов между собой, и таких большинство. <code>NodePort</code> открывает порт на каждом узле в диапазоне тридцати тысяч — годится для стенда и отладки, но в бою неудобен: некрасивые порты и нужно знать адреса узлов. <code>LoadBalancer</code> просит у облака внешний балансировщик и даёт настоящий внешний адрес; типы при этом вложены — <code>LoadBalancer</code> создаёт под собой <code>NodePort</code>, а тот <code>ClusterIP</code>. <code>ExternalName</code> — просто псевдоним для внешнего DNS-имени. Для боевого HTTP-доступа я обычно беру не <code>LoadBalancer</code> на каждый сервис, а один Ingress: он принимает трафик снаружи и раздаёт по сервисам на основании хоста и пути, а заодно решает вопрос с сертификатами.",
  more:["Чем Ingress лучше нескольких LoadBalancer?","Что такое Service без селектора?"]}
]
},

/* ------------------------------------------------ 6 */
{
n:6, id:"config", title:"Конфигурация", sub:"ConfigMap и Secret",
lede:"Один и тот же образ должен работать и на стенде, и в бою. Значит, настройки не могут лежать внутри образа — их подают снаружи.",
theory:`
<h2>Два объекта</h2>
<div class="tw"><table>
<tr><th></th><th>ConfigMap</th><th>Secret</th></tr>
<tr><td>Для чего</td><td>обычные настройки</td><td>пароли, ключи, сертификаты</td></tr>
<tr><td>Как хранится</td><td>как есть</td><td>в base64 — это <b>кодирование, а не шифрование</b></td></tr>
<tr><td>Чем защищён</td><td>ничем особенным</td><td>правами доступа, а при настройке — шифрованием в хранилище</td></tr>
</table></div>
<div class="note warn"><b class="hd">Base64 не защищает</b><p>Любой, кто может прочитать Secret через API, видит значение — раскодировать base64 умеет любой. Настоящая защита — это ограничение прав, шифрование etcd на диске и внешние хранилища секретов. Считать Secret безопасным просто потому, что «там base64», — распространённое и опасное заблуждение.</p></div>

<h2>Как настройки попадают в контейнер</h2>
<pre><code><span class="c"># отдельная переменная из ключа</span>
<span class="k">env</span>:
  - <span class="k">name</span>: MODE
    <span class="k">valueFrom</span>:
      <span class="k">configMapKeyRef</span>:
        <span class="k">name</span>: app-config
        <span class="k">key</span>: MODE

<span class="c"># все ключи разом как переменные</span>
<span class="k">envFrom</span>:
  - <span class="k">configMapRef</span>:
      <span class="k">name</span>: app-config

<span class="c"># как файлы в каталоге</span>
<span class="k">volumeMounts</span>:
  - <span class="k">name</span>: config
    <span class="k">mountPath</span>: /etc/app
<span class="k">volumes</span>:
  - <span class="k">name</span>: config
    <span class="k">configMap</span>:
      <span class="k">name</span>: app-config</code></pre>
<div class="tw"><table>
<tr><th>Способ</th><th>Обновляется на лету</th><th>Когда удобнее</th></tr>
<tr><td>Переменные окружения</td><td><b>нет</b> — только при пересоздании пода</td><td>несколько простых значений</td></tr>
<tr><td>Файлы через том</td><td>да, содержимое обновляется</td><td>целые конфигурационные файлы</td></tr>
</table></div>
<div class="note trap"><b class="hd">Изменили ConfigMap — поды об этом не узнают</b><p>Переменные окружения читаются один раз при старте контейнера. Обновление ConfigMap не перезапускает поды: приложение продолжит работать со старыми значениями. Нужен <code>kubectl rollout restart deployment/&lt;имя&gt;</code>.</p><p>Распространённый приём — класть в аннотацию шаблона пода контрольную сумму конфигурации: тогда её изменение меняет шаблон, и выкатка происходит сама.</p></div>

<h2>Что не стоит делать</h2>
<div class="tw"><table>
<tr><th>Приём</th><th>Почему плохо</th></tr>
<tr><td>Секреты прямо в манифесте</td><td>манифест лежит в репозитории, а значит и секрет тоже</td></tr>
<tr><td>Свой ConfigMap на каждый под</td><td>обслуживать нечитаемо; лучше один на приложение</td></tr>
<tr><td>Настройки, вшитые в образ</td><td>один образ перестаёт быть переносимым между средами</td></tr>
<tr><td>Секреты в переменных окружения</td><td>утекают в дампы, логи ошибок и <code>kubectl describe</code> дочерних процессов; тома надёжнее</td></tr>
</table></div>
`,
quiz:[
 {q:"Чем Secret отличается от ConfigMap по защите?",
  opts:["Secret зашифрован","Практически ничем: base64 — это кодирование; защищают права доступа и шифрование хранилища","Secret виден только root","Secret нельзя вывести"],
  a:1, why:"Считать Secret безопасным потому, что «там base64», — опасное заблуждение."},
 {q:"Изменили ConfigMap, из которого берутся переменные окружения. Что произойдёт с работающими подами?",
  opts:["Значения обновятся сразу","Ничего — переменные читаются один раз при старте контейнера","Поды перезапустятся","Ошибка"],
  a:1, why:"Нужен <code>kubectl rollout restart</code>, либо контрольная сумма конфигурации в аннотации шаблона."},
 {q:"Какой способ подачи настроек обновляется без пересоздания пода?",
  opts:["Переменные окружения","Файлы, смонтированные из ConfigMap томом","<code>envFrom</code>","Никакой"],
  a:1, why:"Поэтому целые конфигурационные файлы удобнее подавать томом, а не переменными."},
 {q:"Зачем класть контрольную сумму конфигурации в аннотацию шаблона пода?",
  opts:["Для документации","Изменение суммы меняет шаблон — и выкатка запускается сама","Для проверки целостности","Для ускорения"],
  a:1, why:"Иначе после правки ConfigMap приходится помнить про ручной перезапуск."},
 {q:"Почему секреты лучше монтировать томом, чем отдавать переменной окружения?",
  opts:["Так быстрее","Переменные утекают в дампы, логи ошибок и вывод дочерних процессов","Переменные ограничены по длине","Разницы нет"],
  a:1, why:"Файл читает только то, что должно, и он не попадает в окружение всего дерева процессов."},
 {q:"Почему настройки не вшивают в образ?",
  opts:["Образ станет больше","Один образ перестаёт быть переносимым между средами","Это запрещено","Замедляется bundle"],
  a:1, why:"Смысл в том, чтобы проверенный на стенде образ ушёл в бой без пересборки — меняется только конфигурация."}
],
labs:[
 {id:"6a", title:"Настройки снаружи",
  brief:"<p>Создайте ConfigMap с именем <code>app-config</code> и двумя ключами: <code>MODE=prod</code> и <code>LOG_LEVEL=info</code>. Сделать это можно командой, без манифеста.</p><p>Затем примените <code>pod.yaml</code> — под уже описан так, что берёт <code>MODE</code> из этого ConfigMap. Убедитесь через <code>describe</code>, что переменная подхватилась.</p>",
  hint:"kubectl create configmap app-config --from-literal=MODE=prod --from-literal=LOG_LEVEL=info",
  setup: () => newScenario({files:{"pod.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: shop/api:1.0
      env:
        - name: MODE
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: MODE`}}),
  checks:[
   {label:"ConfigMap создан", test:st=>!!cm(st, "app-config")},
   {label:"В нём оба ключа", test:st=>{
     const c = cm(st, "app-config");
     return !!c && c.data.MODE === "prod" && c.data.LOG_LEVEL === "info"; }},
   {label:"Под запущен и работает", test:st=>{
     const p = get(st.C, "default", "Pod", "app"); return !!p && podReady(p); }},
   {label:"Связь переменной с ConfigMap проверена", test:st=>okRan(st,/describe\s+(pod|po)\s+app/)}
  ]},
 {id:"6b", title:"Конфигурация изменилась",
  brief:"<p>Deployment <code>api</code> берёт настройки из ConfigMap <code>app-config</code> переменными окружения. Настройку нужно поменять: <code>LOG_LEVEL</code> с <code>info</code> на <code>debug</code>.</p><ul><li>примените исправленный <code>cm.yaml</code> (файл уже поправлен, посмотрите его через <code>cat cm.yaml</code>);</li><li>добейтесь, чтобы поды <b>действительно</b> получили новое значение.</li></ul><p>Подсказка по сути: одного применения ConfigMap мало.</p>",
  hint:"После apply ConfigMap выполните kubectl rollout restart deploy/api — иначе поды продолжат работать со старым значением.",
  setup: () => {
    const C = seed(newScenario({files:{"cm.yaml":
`apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: debug`}}),
`apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: info`);
    seed(C,
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
          image: shop/api:1.0
          env:
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: LOG_LEVEL`);
    return C;
  },
  checks:[
   {label:"ConfigMap обновлён", test:st=>{
     const c = cm(st, "app-config"); return !!c && c.data.LOG_LEVEL === "debug"; }},
   {label:"Поды пересозданы, а не оставлены как есть", test:st=>okRan(st,/rollout\s+restart|delete\s+pod/)},
   {label:"Работают две реплики", test:st=>{
     const c = cm(st, "app-config");
     return readyPods(st).length === 2 && !!c && c.data.LOG_LEVEL === "debug"; }},
   {label:"Появилась вторая ревизия", test:st=>{
     const d = dep(st, "api"); return !!d && (d.history || []).length >= 2; }}
  ]}
],
iv:[
 {q:"Как вы подаёте настройки и секреты в приложение?",
  probe:"Практический вопрос. Отдельно ловят на утверждении, что Secret безопасен сам по себе.",
  a:"Настройки держу снаружи образа: обычные — в ConfigMap, чувствительные — в Secret. Способ подачи выбираю по природе значения: несколько простых величин удобно отдать переменными окружения, целые конфигурационные файлы — смонтировать томом, потому что содержимое тома обновляется без пересоздания пода, а переменные читаются один раз при старте. Из этого следует важная практическая вещь: правка ConfigMap сама по себе ничего не меняет для работающих подов, нужен <code>rollout restart</code> или контрольная сумма конфигурации в аннотации шаблона, чтобы выкатка запускалась автоматически. Про Secret важно понимать, что base64 — это кодирование, а не шифрование: защищают его права доступа, шифрование etcd на диске и, в серьёзных случаях, внешнее хранилище секретов. Секреты я предпочитаю монтировать файлом, а не отдавать переменной, потому что переменные утекают в дампы и логи.",
  more:["Что такое checksum-аннотация?","Чем плох Secret в переменной окружения?"]}
]
},

/* ------------------------------------------------ 7 */
{
n:7, id:"storage", title:"Хранилище", sub:"Что переживёт под",
lede:"Контейнер эфемерен по замыслу: его файловая система исчезает вместе с ним. Всё, что должно пережить перезапуск, нужно вынести — и способов ровно столько, сколько видов данных.",
theory:`
<h2>Виды томов</h2>
<div class="tw"><table>
<tr><th>Том</th><th>Живёт</th><th>Для чего</th></tr>
<tr><td><code>emptyDir</code></td><td>пока жив <b>под</b></td><td>обмен файлами между контейнерами пода, временный кеш</td></tr>
<tr><td><code>configMap</code>, <code>secret</code></td><td>пока жив под</td><td>настройки и ключи как файлы</td></tr>
<tr><td><code>persistentVolumeClaim</code></td><td><b>дольше пода</b></td><td>data, которые нельзя потерять</td></tr>
<tr><td><code>hostPath</code></td><td>на конкретном узле</td><td>почти всегда плохая идея: привязывает под к узлу</td></tr>
</table></div>
<div class="note warn"><b class="hd"><code>emptyDir</code> — не постоянное хранилище</b><p>Он переживает перезапуск <b>контейнера</b>, но не пересоздание пода. Под уехал на другой узел — data исчезли. Использовать его для чего-то ценного — типичная ошибка, которая тихо работает месяцами и проявляется при первом переезде.</p></div>

<h2>PV и PVC</h2>
<div class="tw"><table>
<tr><th></th><th>PersistentVolume (PV)</th><th>PersistentVolumeClaim (PVC)</th></tr>
<tr><td>Кто заводит</td><td>кластер или провайдер хранилища</td><td>вы, вместе с приложением</td></tr>
<tr><td>Что описывает</td><td>конкретный кусок хранилища</td><td>требование: сколько нужно и с каким доступом</td></tr>
<tr><td>Аналогия</td><td>диск на полке</td><td>заявка «дайте диск на 10 ГБ»</td></tr>
</table></div>
<pre><code><span class="k">apiVersion</span>: v1
<span class="k">kind</span>: PersistentVolumeClaim
<span class="k">metadata</span>:
  <span class="k">name</span>: data
<span class="k">spec</span>:
  <span class="k">accessModes</span>: [ReadWriteOnce]
  <span class="k">resources</span>:
    <span class="k">requests</span>:
      <span class="k">storage</span>: 10Gi</code></pre>
<p>При динамической выдаче — а так работает почти везде — <code>StorageClass</code> создаёт подходящий PV под заявку автоматически. Вы описываете только PVC, а PV появляется сам.</p>

<h2>Режимы доступа</h2>
<div class="tw"><table>
<tr><th>Режим</th><th>Что означает</th></tr>
<tr><td><code>ReadWriteOnce</code></td><td>монтируется на запись <b>одним узлом</b> — самый частый и самый ограничивающий</td></tr>
<tr><td><code>ReadOnlyMany</code></td><td>многими узлами только на чтение</td></tr>
<tr><td><code>ReadWriteMany</code></td><td>многими узлами на запись — нужна сетевая файловая система</td></tr>
</table></div>
<div class="note trap"><b class="hd">Отсюда следует неприятность</b><p>Deployment с тремя репликами и одним PVC в режиме <code>ReadWriteOnce</code> будет работать, только пока все три пода на одном узле. Разъедутся — часть застрянет в <code>Pending</code>. Именно поэтому приложениям с состоянием нужен <code>StatefulSet</code>: он через <code>volumeClaimTemplates</code> заводит <b>свой</b> PVC каждой реплике.</p></div>

<h2>Практическое правило</h2>
<p>Прежде чем подключать постоянное хранилище, стоит спросить: а должно ли приложение вообще хранить состояние? Загруженные файлы уместнее в объектном хранилище, сессии — в Redis, data — в управляемой базе. Приложение без состояния масштабируется, переезжает и обновляется без единого вопроса; приложение с диском тянет за собой всё, что описано выше.</p>
`,
quiz:[
 {q:"Что произойдёт с данными в <code>emptyDir</code>, если под пересоздадут?",
  opts:["Сохранятся","Исчезнут — том живёт ровно столько, сколько под","Переедут вместе с подом","Попадут в PV"],
  a:1, why:"Перезапуск контейнера он переживает, а пересоздание пода — нет. Частая тихая ошибка."},
 {q:"Чем PVC отличается от PV?",
  opts:["Ничем","PVC — заявка «нужно столько-то», PV — конкретный кусок хранилища","PVC для чтения","PV создаёт разработчик"],
  a:1, why:"При динамической выдаче StorageClass создаёт PV под заявку сам — вы описываете только PVC."},
 {q:"Что означает <code>ReadWriteOnce</code>?",
  opts:["Записать можно один раз","Том монтируется на запись только одним узлом","Только чтение","Один под"],
  a:1, why:"Отсюда и проблема с несколькими репликами: разъехались по узлам — часть застрянет в Pending."},
 {q:"Почему приложению с состоянием нужен StatefulSet, а не Deployment?",
  opts:["Он быстрее","Через <code>volumeClaimTemplates</code> он даёт каждой реплике свой PVC и устойчивое имя","Он поддерживает больше реплик","Deployment не умеет тома"],
  a:1, why:"У Deployment все реплики делят один PVC, что при ReadWriteOnce работает только на одном узле."},
 {q:"Почему <code>hostPath</code> почти всегда плохая идея?",
  opts:["Он медленный","Привязывает под к конкретному узлу и ломает переносимость","Он не поддерживается","Требует root"],
  a:1, why:"Под, переехавший на другой узел, увидит совсем другой каталог или пустоту."},
 {q:"Какой вопрос стоит задать до подключения постоянного хранилища?",
  opts:["Сколько это стоит","Должно ли приложение вообще хранить состояние","Какой StorageClass","Сколько реплик"],
  a:1, why:"Файлы уместнее в объектном хранилище, сессии в Redis, data в управляемой базе."}
],
labs:[
 {id:"7a", title:"Заявка на диск",
  brief:"<p>Приложению нужен постоянный диск на <b>5Gi</b> с режимом доступа <code>ReadWriteOnce</code>.</p><p>Опишите PersistentVolumeClaim с именем <code>data</code> в панели «Манифест» (файл <code>pvc.yaml</code> заготовлен пустым) и примените его. Затем убедитесь, что заявка удовлетворена — <code>kubectl get pvc</code>.</p>",
  hint:"spec.accessModes: [ReadWriteOnce] и spec.resources.requests.storage: 5Gi",
  setup: () => newScenario({files:{"pvc.yaml": "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: data\n"}}),
  checks:[
   {label:"Заявка создана", test:st=>!!get(st.C, "default", "PersistentVolumeClaim", "data")},
   {label:"Запрошено 5Gi", test:st=>{
     const c = get(st.C, "default", "PersistentVolumeClaim", "data");
     return !!c && String(((c.spec.resources || {}).requests || {}).storage) === "5Gi"; }},
   {label:"Режим доступа <code>ReadWriteOnce</code>", test:st=>{
     const c = get(st.C, "default", "PersistentVolumeClaim", "data");
     return !!c && [].concat(c.spec.accessModes || []).indexOf("ReadWriteOnce") >= 0; }},
   {label:"Заявка удовлетворена", test:st=>{
     const c = get(st.C, "default", "PersistentVolumeClaim", "data");
     return !!c && c.status.phase === "Bound"; }}
  ]},
 {id:"7b", title:"Подключить диск к поду",
  brief:"<p>Заявка <code>data</code> уже удовлетворена. Подключите её к поду из <code>pod.yaml</code>: том с именем <code>store</code>, смонтированный в <code>/var/data</code>.</p><p>Нужно дописать в манифест два места: <code>spec.volumes</code> с ссылкой на заявку и <code>volumeMounts</code> у контейнера. Проверьте результат через <code>describe</code> — том должен быть виден в разделе Volumes.</p>",
  hint:"volumes: - name: store с persistentVolumeClaim.claimName: data; в контейнере volumeMounts: - name: store, mountPath: /var/data",
  setup: () => {
    const C = seed(newScenario({files:{"pod.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: store
spec:
  containers:
    - name: app
      image: shop/api:1.0
`}}),
`apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 5Gi`);
    return C;
  },
  checks:[
   {label:"Под создан и работает", test:st=>{
     const p = get(st.C, "default", "Pod", "store"); return !!p && podReady(p); }},
   {label:"Том ссылается на заявку", test:st=>{
     const p = get(st.C, "default", "Pod", "store");
     return !!p && (p.spec.volumes || []).some(v =>
       v.name === "store" && (v.persistentVolumeClaim || {}).claimName === "data"); }},
   {label:"Том смонтирован в <code>/var/data</code>", test:st=>{
     const p = get(st.C, "default", "Pod", "store");
     return !!p && (p.spec.containers || []).some(c =>
       (c.volumeMounts || []).some(m => m.name === "store" && m.mountPath === "/var/data")); }},
   {label:"Результат проверен через <code>describe</code>", test:st=>okRan(st,/describe\s+(pod|po)\s+store/)}
  ]}
],
iv:[
 {q:"Как в Kubernetes хранят data, которые нельзя потерять?",
  probe:"Ждут PV/PVC и понимание, почему Deployment с диском — сомнительная затея.",
  a:"Через PersistentVolumeClaim — заявку на хранилище, которую приложение описывает рядом с собой: сколько нужно и с каким режимом доступа. Кластер по этой заявке выдаёт PersistentVolume, обычно динамически через StorageClass. Важно, что такой том живёт дольше пода: под пересоздали, переехал на другой узел — data на месте. Всё остальное эфемерно: <code>emptyDir</code> исчезает вместе с подом, и использовать его для ценного — распространённая тихая ошибка. Отдельно я обращаю внимание на режим доступа: самый частый <code>ReadWriteOnce</code> позволяет монтировать том на запись только с одного узла, поэтому Deployment с несколькими репликами и одним PVC будет работать, пока все реплики случайно на одном узле. Для приложений с состоянием правильный контроллер — StatefulSet, он через <code>volumeClaimTemplates</code> даёт каждой реплике свой диск. Но первым делом я всё-таки спрашиваю, обязано ли приложение хранить состояние: часто файлам место в объектном хранилище, а данным — в управляемой базе.",
  more:["Что такое StorageClass?","Почему emptyDir не подходит?"]}
]
},

/* ------------------------------------------------ 8 */
{
n:8, id:"sched", title:"Планировщик", sub:"Куда попадёт под",
lede:"Планировщик выбирает узел по одному простому правилу — «влезет ли». Указания, которые вы даёте в манифесте, влияют и на размещение, и на то, кого убьют первым при нехватке памяти.",
theory:`
<h2>requests и limits</h2>
<div class="tw"><table>
<tr><th></th><th><code>requests</code></th><th><code>limits</code></th></tr>
<tr><td>Что означает</td><td>сколько гарантированно нужно</td><td>сколько нельзя превышать</td></tr>
<tr><td>Кто смотрит</td><td><b>планировщик</b> — по ним выбирается узел</td><td><b>kubelet</b> — во время работы</td></tr>
<tr><td>Превышение по процессору</td><td>—</td><td>притормаживание</td></tr>
<tr><td>Превышение по памяти</td><td>—</td><td><b>контейнер убивают</b>: OOMKilled</td></tr>
</table></div>
<div class="note ok"><b class="hd">Единицы</b><p>Процессор: <code>1</code> — одно ядро, <code>500m</code> — половина. Память: <code>128Mi</code> — двоичные мегабайты, <code>128M</code> — десятичные; путать их не смертельно, но разница около пяти процентов.</p></div>
<div class="note trap"><b class="hd">Без requests планировщик считает, что поду нужно ноль</b><p>Он спокойно поставит на узел столько таких подов, сколько попросят, — а потом они начнут драться за память, и узел уйдёт в вытеснение. Отсутствие <code>requests</code> — не «без ограничений», а «планировщик работает вслепую».</p></div>

<h2>Классы обслуживания</h2>
<div class="tw"><table>
<tr><th>Класс</th><th>Когда назначается</th><th>Кого вытесняют первым</th></tr>
<tr><td><code>Guaranteed</code></td><td><code>requests</code> равны <code>limits</code> у всех контейнеров</td><td>последним</td></tr>
<tr><td><code>Burstable</code></td><td><code>requests</code> есть, но меньше <code>limits</code></td><td>вторым</td></tr>
<tr><td><code>BestEffort</code></td><td>ничего не указано</td><td><b>первым</b></td></tr>
</table></div>
<p>Класс виден в <code>kubectl describe pod</code> строкой <code>QoS Class</code>. Для важных сервисов имеет смысл выравнивать <code>requests</code> и <code>limits</code> — так под получает <code>Guaranteed</code> и переживает нехватку памяти на узле дольше остальных.</p>

<h2>Как повлиять на выбор узла</h2>
<div class="tw"><table>
<tr><th>Средство</th><th>Что делает</th></tr>
<tr><td><code>nodeSelector</code></td><td>простейшее: узел обязан иметь такие метки</td></tr>
<tr><td><code>nodeAffinity</code></td><td>то же, но с «обязательно» и «желательно» и с выражениями</td></tr>
<tr><td><code>podAffinity</code> / <code>podAntiAffinity</code></td><td>рядом с такими-то подами или, наоборот, подальше от них</td></tr>
<tr><td><code>topologySpreadConstraints</code></td><td>размазать реплики по зонам и узлам равномерно</td></tr>
</table></div>
<p><code>podAntiAffinity</code> — то, чем добиваются, чтобы три реплики не оказались на одном узле: иначе его отказ унесёт весь сервис разом.</p>

<h2>Метки-ограничители и допуски</h2>
<pre><code><span class="c"># на узле: сюда нельзя, если не разрешено явно</span>
kubectl taint nodes node-1 role=db:NoSchedule

<span class="c"># в поде: мне можно</span>
<span class="k">tolerations</span>:
  - <span class="k">key</span>: role
    <span class="k">operator</span>: Equal
    <span class="k">value</span>: db
    <span class="k">effect</span>: NoSchedule</code></pre>
<div class="tw"><table>
<tr><th>Эффект</th><th>Что делает</th></tr>
<tr><td><code>NoSchedule</code></td><td>новые поды без допуска сюда не попадут</td></tr>
<tr><td><code>PreferNoSchedule</code></td><td>постарается не ставить, но может</td></tr>
<tr><td><code>NoExecute</code></td><td>вдобавок выселит уже работающие поды без допуска</td></tr>
</table></div>
<p>Разница с <code>nodeSelector</code> в направлении: селектор — это «я хочу такой узел», ограничитель — «этот узел не для всех». Первое выбирает под, второе защищает узел.</p>

<h2>Почему под висит в Pending</h2>
<p><code>kubectl describe pod</code> в разделе событий прямо называет причину: <code>Insufficient cpu</code>, <code>Insufficient memory</code>, <code>node(s) had untolerated taint</code>, <code>didn't match Pod's node affinity/selector</code>. Это один из немногих случаев, когда Kubernetes объясняет проблему без всякой догадливости с вашей стороны — надо просто прочитать.</p>
`,
quiz:[
 {q:"Что смотрит планировщик при выборе узла?",
  opts:["<code>limits</code>","<code>requests</code> — сколько гарантированно нужно","Реальное потребление","Число подов на узле"],
  a:1, why:"<code>limits</code> — забота kubelet во время работы, планировщик их не учитывает."},
 {q:"Контейнер превысил <code>limits</code> по памяти. Что произойдёт?",
  opts:["Притормозит","Его убьют — OOMKilled","Переедет на другой узел","Ничего"],
  a:1, why:"По процессору превышение приводит к притормаживанию, а память отобрать нельзя — контейнер убивают."},
 {q:"Под без <code>requests</code> — что это значит для планировщика?",
  opts:["Поду нужно много","Планировщик считает, что нужно ноль, и ставит такие поды без счёта","Под не запустится","Под получит Guaranteed"],
  a:1, why:"Это не «без ограничений», а «планировщик работает вслепую» — узел потом уходит в вытеснение."},
 {q:"Как получить класс <code>Guaranteed</code>?",
  opts:["Указать приоритет","Сделать <code>requests</code> равными <code>limits</code> у всех контейнеров","Указать nodeSelector","Это невозможно"],
  a:1, why:"Такие поды вытесняют последними — имеет смысл для важных сервисов."},
 {q:"Чем ограничитель на узле (taint) отличается от <code>nodeSelector</code>?",
  opts:["Ничем","Селектор — «я хочу такой узел», ограничитель — «этот узел не для всех»","Taint быстрее","Селектор для узлов"],
  a:1, why:"Первое выбирает под, второе защищает узел. Часто используются вместе."},
 {q:"Чем добиться, чтобы три реплики не оказались на одном узле?",
  opts:["<code>nodeSelector</code>","<code>podAntiAffinity</code> или <code>topologySpreadConstraints</code>","<code>limits</code>","Увеличить число реплик"],
  a:1, why:"Иначе отказ одного узла унесёт весь сервис разом, несмотря на три реплики."}
],
labs:[
 {id:"8a", title:"Под, который никуда не влез",
  brief:"<p>Под <code>heavy</code> висит в <code>Pending</code> и не запускается. Узлов в кластере два, по 2 ядра и 4Gi каждый.</p><ul><li>выясните точную причину через <code>describe</code>;</li><li>исправьте <code>pod.yaml</code> так, чтобы под поместился, но запрос остался осмысленным: <b>500m</b> процессора и <b>512Mi</b> памяти;</li><li>примените заново и убедитесь, что под работает.</li></ul><p>Учтите: изменить запросы у существующего пода нельзя — его придётся удалить.</p>",
  hint:"kubectl describe pod heavy покажет Insufficient cpu. Затем kubectl delete pod heavy, правка манифеста, kubectl apply -f pod.yaml.",
  setup: () => seed(newScenario({files:{"pod.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: heavy
spec:
  containers:
    - name: app
      image: shop/api:1.0
      resources:
        requests:
          cpu: "6"
          memory: 8Gi`}}),
`apiVersion: v1
kind: Pod
metadata:
  name: heavy
spec:
  containers:
    - name: app
      image: shop/api:1.0
      resources:
        requests:
          cpu: "6"
          memory: 8Gi`),
  checks:[
   {label:"Причина выяснена через <code>describe</code>", test:st=>okRan(st,/describe\s+(pod|po)/)},
   {label:"Под запущен", test:st=>{
     const p = get(st.C, "default", "Pod", "heavy"); return !!p && podReady(p); }},
   {label:"Запрошено 500m процессора", test:st=>{
     const p = get(st.C, "default", "Pod", "heavy");
     return !!p && cpuOf((((p.spec.containers || [])[0] || {}).resources || {}).requests &&
       p.spec.containers[0].resources.requests.cpu) === 500; }},
   {label:"Запрошено 512Mi памяти", test:st=>{
     const p = get(st.C, "default", "Pod", "heavy");
     return !!p && memOf((((p.spec.containers || [])[0] || {}).resources || {}).requests &&
       p.spec.containers[0].resources.requests.memory) === 512; }}
  ]},
 {id:"8b", title:"Гарантированный класс",
  brief:"<p>Сервис <code>api</code> важен: при нехватке памяти на узле его поды должны вытесняться последними.</p><p>Приведите манифест к классу обслуживания <code>Guaranteed</code>: запросы и лимиты должны совпадать. Возьмите <b>200m</b> процессора и <b>256Mi</b> памяти и там, и там.</p><p>Проверьте результат — строка <code>QoS Class</code> в выводе <code>describe</code> любого пода.</p>",
  hint:"В resources укажите одинаковые requests и limits. После правки манифеста примените его заново.",
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
          image: shop/api:1.0
          resources:
            requests:
              cpu: 100m
              memory: 128Mi`}}),
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
          image: shop/api:1.0
          resources:
            requests:
              cpu: 100m
              memory: 128Mi`),
  checks:[
   {label:"Все поды получили класс <code>Guaranteed</code>", test:st=>
     pods(st).length > 0 && pods(st).every(p => qosOf(p) === "Guaranteed")},
   {label:"Запросы и лимиты по процессору — 200m", test:st=>pods(st).length > 0 && pods(st).every(p => {
     const r = (p.spec.containers[0].resources || {});
     return cpuOf((r.requests || {}).cpu) === 200 && cpuOf((r.limits || {}).cpu) === 200; })},
   {label:"Запросы и лимиты по памяти — 256Mi", test:st=>pods(st).length > 0 && pods(st).every(p => {
     const r = (p.spec.containers[0].resources || {});
     return memOf((r.requests || {}).memory) === 256 && memOf((r.limits || {}).memory) === 256; })},
   {label:"Обе реплики работают", test:st=>readyPods(st).length === 2 &&
     pods(st).every(p => qosOf(p) === "Guaranteed")}
  ]},
 {id:"8c", title:"Узел не для всех",
  brief:"<p>Узел <code>node-2</code> помечен ограничителем <code>role=db:NoSchedule</code> — он выделен под базу. Под <code>db</code> должен попасть именно туда, а на <code>node-1</code> для него не хватает памяти.</p><p>Добавьте в <code>pod.yaml</code> допуск, разрешающий этому поду попасть на защищённый узел, и примените. Проверьте узел через <code>kubectl get pods -o wide</code>.</p>",
  hint:"tolerations: - key: role, operator: Equal, value: db, effect: NoSchedule",
  setup: () => newScenario({
    nodes: [{name:"node-1", cpu:2000, mem:512},
            {name:"node-2", cpu:2000, mem:4096, taints:[{key:"role", value:"db", effect:"NoSchedule"}]}],
    files:{"pod.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: db
spec:
  containers:
    - name: db
      image: postgres:16
      resources:
        requests:
          cpu: 200m
          memory: 1Gi`}}),
  checks:[
   {label:"Под запущен", test:st=>{
     const p = get(st.C, "default", "Pod", "db"); return !!p && podReady(p); }},
   {label:"Он оказался на <code>node-2</code>", test:st=>{
     const p = get(st.C, "default", "Pod", "db"); return !!p && p.spec.nodeName === "node-2"; }},
   {label:"Допуск описан в манифесте", test:st=>{
     const p = get(st.C, "default", "Pod", "db");
     return !!p && (p.spec.tolerations || []).some(t => t.key === "role"); }},
   {label:"Размещение проверено", test:st=>okRan(st,/get\s+(pods?|po)\s+-o\s+wide/)}
  ]}
],
iv:[
 {q:"Чем requests отличаются от limits?",
  probe:"Обязательный вопрос. Ответ «минимум и максимум» слишком поверхностен.",
  a:"<code>requests</code> — это то, что видит планировщик: сколько ресурсов поду гарантированно нужно, и узел выбирается так, чтобы сумма запросов на нём не превышала ёмкость. <code>limits</code> — потолок, который следит kubelet уже во время работы. Разница в последствиях превышения принципиальная: процессор — сжимаемый ресурс, при превышении контейнер просто притормаживают; память отобрать нельзя, поэтому контейнер убивают с <code>OOMKilled</code>. Отсюда практика: <code>requests</code> ставить обязательно, потому что без них планировщик считает, что поду нужно ноль, и набивает узел до состояния, когда поды начинают драться за память. Соотношение запросов и лимитов определяет класс обслуживания: если они равны, под получает <code>Guaranteed</code> и вытесняется последним; если запросов нет вовсе — <code>BestEffort</code> и первым. Для важных сервисов я выравниваю запросы и лимиты сознательно.",
  more:["Что такое QoS-класс?","Что будет при превышении лимита по CPU?"]},
 {q:"Под висит в Pending. Как разобраться?",
  probe:"Проверяют, знаете ли вы, где смотреть, а не гадаете ли.",
  a:"Первым делом <code>kubectl describe pod</code> и раздел событий внизу — там планировщик прямым текстом пишет, почему не смог разместить. Формулировки конкретные: <code>Insufficient cpu</code> или <code>Insufficient memory</code>, если ни на одном узле не хватает свободных ресурсов под запросы; <code>node(s) had untolerated taint</code>, если узлы защищены ограничителями, а у пода нет допуска; <code>didn't match Pod's node affinity/selector</code>, если селектор узла не совпадает ни с одним. Дальше решение зависит от причины: уменьшить запросы, если они завышены, добавить узлов, если кластер действительно полон, добавить допуск или поправить селектор. Отдельный случай — <code>Pending</code> из-за неудовлетворённой заявки на хранилище: тогда в событиях будет упоминание PVC, и смотреть надо на StorageClass. Ещё бывает, что под уже назначен на узел, но всё равно не запускается — тогда причина не в планировщике, а в образе или конфигурации, и это видно по разделу с состоянием контейнеров.",
  more:["Что делать, если кластер действительно полон?","Как посмотреть свободные ресурсы узлов?"]}
]
},
