
/* ============================================================
   Содержание
   ============================================================ */

/* ── помощники проверок ────────────────────────────────── */
const ran   = (st, re) => st.log.some(e => re.test(e.cmd));
const okRan = (st, re) => st.log.some(e => !e.err && re.test(e.cmd));
const pods  = (st, ns) => list(st.C, "Pod", ns || st.C.ns);
const readyPods = (st, ns) => pods(st, ns).filter(podReady);
const dep   = (st, n, ns) => get(st.C, ns || st.C.ns, "Deployment", n);
const svc   = (st, n, ns) => get(st.C, ns || st.C.ns, "Service", n);
const cm    = (st, n, ns) => get(st.C, ns || st.C.ns, "ConfigMap", n);
const rsets = (st, ns) => list(st.C, "ReplicaSet", ns || st.C.ns);
const imgs  = st => pods(st).map(p => (p.spec.containers || []).map(c => c.image).join(",")).sort();
const saw   = (st, re) => st.log.some(e => !e.err && (e.out || []).some(l => re.test(l)));

const MODULES = [

/* ------------------------------------------------ 1 */
{
n:1, id:"cluster", title:"Кластер", sub:"Желаемое состояние",
lede:"Kubernetes устроен вокруг одной идеи: вы описываете, как должно быть, а система непрерывно приводит реальность к этому описанию. Всё остальное — следствия.",
theory:`
<h2>Императивно и декларативно</h2>
<div class="tw"><table>
<tr><th></th><th>Императивно</th><th>Декларативно</th></tr>
<tr><td>Что вы говорите</td><td>«запусти три контейнера»</td><td>«пусть всегда будет три»</td></tr>
<tr><td>Кто следит дальше</td><td>вы</td><td>контроллер</td></tr>
<tr><td>Один умер</td><td>надо заметить и поднять</td><td>поднимется сам</td></tr>
<tr><td>Инструмент</td><td><code>docker run</code></td><td>манифест и <code>kubectl apply</code></td></tr>
</table></div>
<div class="note ok"><b class="hd">Это стоит увидеть сразу</b><p>Внизу настоящий кластер. Примените манифест, посмотрите <code>kubectl get pods</code>, а потом удалите один под руками — <code>kubectl delete pod &lt;имя&gt;</code>. Через мгновение подов снова будет столько же, сколько заказано. Никто вам не поможет — это и есть цикл согласования.</p></div>

<h2>Из чего состоит кластер</h2>
<div class="tw"><table>
<tr><th>Часть</th><th>Что делает</th></tr>
<tr><td><b>API-сервер</b></td><td>единственная дверь: принимает манифесты, проверяет, кладёт в хранилище</td></tr>
<tr><td><b>etcd</b></td><td>хранит состояние всего кластера</td></tr>
<tr><td><b>Планировщик</b></td><td>решает, на каком узле запускать под</td></tr>
<tr><td><b>Контроллеры</b></td><td>сравнивают желаемое с фактическим и устраняют разницу</td></tr>
<tr><td><b>kubelet</b></td><td>на каждом узле: запускает контейнеры и докладывает об их состоянии</td></tr>
</table></div>
<p>Важная деталь: компоненты не вызывают друг друга напрямую. Все читают и пишут через API-сервер, и каждый занят своим маленьким циклом. Отсюда устойчивость: упавший контроллер, поднявшись, просто продолжит сверять желаемое с фактическим.</p>

<figure class="fig"><svg viewBox="0 0 640 172" role="img" aria-label="Схема кластера">
<rect x="10" y="18" width="180" height="136" rx="3" fill="none" stroke="currentColor"/>
<text x="100" y="38" text-anchor="middle" font-size="11" fill="currentColor">управляющий слой</text>
<rect x="26" y="50" width="148" height="24" rx="2" fill="none" stroke="currentColor"/>
<text x="100" y="66" text-anchor="middle" font-size="10.5" fill="currentColor">API-сервер</text>
<rect x="26" y="82" width="70" height="24" rx="2" fill="none" stroke="currentColor"/>
<text x="61" y="98" text-anchor="middle" font-size="10.5" fill="currentColor">etcd</text>
<rect x="104" y="82" width="70" height="24" rx="2" fill="none" stroke="currentColor"/>
<text x="139" y="98" text-anchor="middle" font-size="10.5" fill="currentColor">планировщик</text>
<rect x="26" y="114" width="148" height="24" rx="2" fill="none" stroke="currentColor"/>
<text x="100" y="130" text-anchor="middle" font-size="10.5" fill="currentColor">контроллеры</text>

<rect x="280" y="18" width="160" height="136" rx="3" fill="none" stroke="currentColor"/>
<text x="360" y="38" text-anchor="middle" font-size="11" fill="currentColor">узел 1</text>
<rect x="296" y="50" width="128" height="22" rx="2" fill="none" stroke="currentColor"/>
<text x="360" y="65" text-anchor="middle" font-size="10.5" fill="currentColor">kubelet</text>
<rect x="296" y="82" width="128" height="56" rx="2" fill="none" stroke="currentColor" stroke-dasharray="3 2"/>
<text x="360" y="104" text-anchor="middle" font-size="10.5" fill="currentColor">поды</text>
<text x="360" y="122" text-anchor="middle" font-size="10.5" fill="currentColor">контейнеры</text>

<rect x="460" y="18" width="160" height="136" rx="3" fill="none" stroke="currentColor"/>
<text x="540" y="38" text-anchor="middle" font-size="11" fill="currentColor">узел 2</text>
<rect x="476" y="50" width="128" height="22" rx="2" fill="none" stroke="currentColor"/>
<text x="540" y="65" text-anchor="middle" font-size="10.5" fill="currentColor">kubelet</text>
<rect x="476" y="82" width="128" height="56" rx="2" fill="none" stroke="currentColor" stroke-dasharray="3 2"/>
<text x="540" y="104" text-anchor="middle" font-size="10.5" fill="currentColor">поды</text>
<line x1="192" y1="62" x2="292" y2="62" stroke="currentColor" stroke-dasharray="3 2"/>
<line x1="192" y1="72" x2="472" y2="62" stroke="currentColor" stroke-dasharray="3 2" opacity="0.5"/>
<text x="242" y="56" text-anchor="middle" font-size="9.5" fill="currentColor">докладывает</text>
</svg><figcaption>Всё общение идёт через API-сервер. Ни планировщик, ни kubelet не знают друг о друге.</figcaption></figure>

<h2>Манифест</h2>
<pre><code><span class="k">apiVersion</span>: apps/v1        <span class="c"># какая версия API описывает объект</span>
<span class="k">kind</span>: Deployment          <span class="c"># что это за объект</span>
<span class="k">metadata</span>:
  <span class="k">name</span>: web                <span class="c"># имя внутри пространства имён</span>
<span class="k">spec</span>:                       <span class="c"># ЖЕЛАЕМОЕ состояние — его пишете вы</span>
  <span class="k">replicas</span>: 3
<span class="c"># status: заполняет система — ФАКТИЧЕСКОЕ состояние</span></code></pre>
<p>Пара <code>spec</code> и <code>status</code> есть почти у каждого объекта, и это буквально «как надо» и «как есть». Работа контроллера — сводить их.</p>

<h2>Основные команды</h2>
<div class="tw"><table>
<tr><th>Команда</th><th>Что делает</th></tr>
<tr><td><code>kubectl get &lt;тип&gt;</code></td><td>список объектов</td></tr>
<tr><td><code>kubectl get &lt;тип&gt; -o wide</code></td><td>то же плюс узел и адрес</td></tr>
<tr><td><code>kubectl describe &lt;тип&gt; &lt;имя&gt;</code></td><td>подробности и <b>события</b> — с этого начинается любая диагностика</td></tr>
<tr><td><code>kubectl apply -f файл.yaml</code></td><td>привести кластер к описанному</td></tr>
<tr><td><code>kubectl delete &lt;тип&gt; &lt;имя&gt;</code></td><td>убрать объект</td></tr>
<tr><td><code>kubectl explain &lt;тип&gt;.&lt;поле&gt;</code></td><td>справка по полю прямо из кластера</td></tr>
</table></div>
`,
quiz:[
 {q:"В чём смысл декларативного подхода?",
  opts:["Меньше печатать","Вы описываете желаемое состояние, а контроллер непрерывно приводит к нему фактическое","Быстрее запуск","Не нужен YAML"],
  a:1, why:"Отсюда самовосстановление: убитый под поднимется сам, потому что желаемое число не изменилось."},
 {q:"Что произойдёт, если удалить под, созданный Deployment?",
  opts:["Ничего, подов станет меньше","Контроллер создаст новый — желаемое число не изменилось","Deployment удалится","Ошибка"],
  a:1, why:"Чтобы подов стало меньше, надо изменить желаемое: <code>kubectl scale</code> или правку манифеста."},
 {q:"Через что общаются компоненты кластера?",
  opts:["Напрямую друг с другом","Только через API-сервер","Через очередь сообщений","Через файлы на узлах"],
  a:1, why:"Отсюда устойчивость: упавший контроллер, поднявшись, просто продолжит сверять желаемое с фактическим."},
 {q:"Что означает пара <code>spec</code> и <code>status</code> в объекте?",
  opts:["Настройки и метаданные","«Как надо» и «как есть» — работа контроллера сводить их","Вход и выход","Версии объекта"],
  a:1, why:"<code>spec</code> пишете вы, <code>status</code> заполняет система."},
 {q:"Кто решает, на каком узле запустится под?",
  opts:["kubelet","Планировщик","API-сервер","Вы в манифесте"],
  a:1, why:"Указать узел вручную можно, но это исключение: обычно выбор оставляют планировщику."},
 {q:"С какой команды начинается диагностика проблемы с объектом?",
  opts:["<code>kubectl get</code>","<code>kubectl describe</code> — там подробности и события","<code>kubectl logs</code>","<code>kubectl top</code>"],
  a:1, why:"События внизу вывода обычно прямо называют причину: не влез по ресурсам, не скачался образ, не прошла проба."}
],
labs:[
 {id:"1a", title:"Увидеть самовосстановление",
  brief:"<p>В сценарии лежит манифест <code>web.yaml</code> — Deployment на три реплики. Посмотреть его можно командой <code>cat web.yaml</code>.</p><ul><li>примените манифест;</li><li>убедитесь, что подов три;</li><li>удалите <b>любой</b> под руками;</li><li>посмотрите список ещё раз.</li></ul><p>Подов снова должно быть три — вы этого не делали, это сделал контроллер.</p>",
  hint:"kubectl apply -f web.yaml, затем kubectl get pods, затем kubectl delete pod <имя одного из них>.",
  setup: () => newScenario({files:{"web.yaml":
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
          ports:
            - containerPort: 80`}}),
  checks:[
   {label:"Манифест применён", test:st=>!!dep(st, "web")},
   {label:"Под удалялся руками", test:st=>okRan(st,/delete\s+pod/)},
   {label:"Подов снова три", test:st=>pods(st).length === 3 && okRan(st,/delete\s+pod/)},
   {label:"Все три работают", test:st=>readyPods(st).length === 3 && okRan(st,/delete\s+pod/)}
  ]},
 {id:"1b", title:"Прочитать состояние кластера",
  brief:"<p>В кластере уже что-то развёрнуто, но неизвестно что. Разберитесь, не меняя ничего:</p><ul><li>посмотрите все основные объекты сразу — <code>kubectl get all</code>;</li><li>узнайте, на каких узлах оказались поды (<code>-o wide</code>);</li><li>посмотрите подробности Deployment с именем <code>api</code> через <code>describe</code>.</li></ul>",
  hint:"kubectl get all, kubectl get pods -o wide, kubectl describe deploy api",
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
   {label:"Просмотрены все объекты сразу", test:st=>okRan(st,/get\s+all/)},
   {label:"Узлы подов выяснены", test:st=>okRan(st,/get\s+pods?\s+-o\s+wide|get\s+po\s+-o\s+wide/)},
   {label:"Deployment разобран через <code>describe</code>", test:st=>okRan(st,/describe\s+(deploy|deployment)\s+api/)},
   {label:"В кластере ничего не изменилось", test:st=>!ran(st,/delete|apply|scale|set\s+image/) &&
     pods(st).length === 2 && okRan(st,/get\s+all/) && okRan(st,/describe\s+(deploy|deployment)\s+api/)}
  ]}
],
iv:[
 {q:"Что такое Kubernetes и какую задачу он решает?",
  probe:"Открывающий вопрос. Ждут не пересказ сайта, а понимание модели.",
  a:"Это система, которая держит приложение в заданном состоянии на группе машин. Ключевая идея — декларативность: я описываю, как должно быть, — столько-то одинаковых экземпляров, такой образ, такие настройки, — а кластер непрерывно сравнивает это с фактическим положением дел и устраняет разницу. Отсюда всё практически ценное: упавший контейнер поднимется сам, узел выключился — поды переедут, обновление можно выкатывать постепенно и откатывать. Технически это набор небольших контроллеров, каждый со своим циклом согласования, общающихся только через API-сервер, — поэтому система хорошо переживает отказ собственных частей. Стоит понимать и границу: Kubernetes управляет запуском и сетью, но не делает приложение отказоустойчивым сам по себе — если приложение хранит состояние в памяти пода, никакой кластер это не исправит.",
  more:["Что такое цикл согласования?","Когда Kubernetes избыточен?"]}
]
},
