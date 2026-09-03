
/* ============================================================
   Содержание
   ============================================================ */
const ran      = (st, re) => st.log.some(e => re.test(e.cmd));
const okRan    = (st, re) => st.log.some(e => !e.err && re.test(e.cmd));
const used     = (st, tool) => st.log.some(e => new RegExp("(^|\\|\\s*|sudo\\s+)" + tool + "\\b").test(e.cmd));
const logHas   = (st, re) => st.log.some(e => (e.out || []).some(l => re.test(l)));
const errSeen  = (st, re) => st.log.some(e => e.err && re.test(e.err));
const node     = (st, p) => { try{ return statPath(st.S, p, {who: {uid: 0, gids: [0], name: "root"}, follow: false}).node; }catch(e){ return null; } };
const text     = (st, p) => { const n = node(st, p); return n && n.type === "f" ? n.content : ""; };
const mode     = (st, p) => { const n = node(st, p); return n ? (n.mode & 0o7777) : -1; };
const bits     = (st, p, m) => { const n = node(st, p); return !!n && (n.mode & m) === m; };
const ownerOf  = (st, p) => { const n = node(st, p); return n ? userByUid(st.S, n.uid) : ""; };
const groupOf  = (st, p) => { const n = node(st, p); return n ? groupByGid(st.S, n.gid) : ""; };
const hasUser  = (st, n) => !!st.S.users[n];
const inGrp    = (st, u, g) => hasUser(st, u) && inGroup(st.S, u, g);
const unitOf   = (st, n) => st.S.units[unitName(n)];
const isActive = (st, n) => { const u = unitOf(st, n); return !!(u && u.active); };
const isEnabled= (st, n) => { const u = unitOf(st, n); return !!(u && u.enabled); };
const hasPkg   = (st, n) => !!st.S.pkgs[n];
const ufwRule  = (st, port) => st.S.ufw.rules.some(r => String(r.port) === String(port) && r.action === "ALLOW");
const listens  = (st, port) => { const u = st.S.units[st.S.ports[port]]; return !!(u && u.active); };
const conf     = (st, p, key) => { const m = new RegExp("^\\s*" + key + "\\s+(\\S+)", "mi").exec(text(st, p)); return m ? m[1] : null; };

const MODULES = [

/* ------------------------------------------------ 1 */
{
n:1, id:"start", title:"Сервер без экрана", sub:"Где вы оказались и как это выяснить",
lede:"Ubuntu Server — это та же Ubuntu без рабочего стола. Всё, что у вас есть, — одна строка приглашения. Первый навык не в том, чтобы что-то менять, а в том, чтобы за минуту понять, куда вы попали.",
theory:`
<h2>Строка приглашения уже всё сказала</h2>
<pre><code><span class="k">ubuntu@web-01</span>:<span class="q">~</span>$ </code></pre>
<div class="tw"><table>
<tr><th>Часть</th><th>Что означает</th></tr>
<tr><td><code>ubuntu</code></td><td>кто вы сейчас</td></tr>
<tr><td><code>web-01</code></td><td>имя машины — на какой из них вы работаете</td></tr>
<tr><td><code>~</code></td><td>где вы находитесь; <code>~</code> — это домашний каталог</td></tr>
<tr><td><code>$</code></td><td>обычный пользователь. У root здесь <code>#</code></td></tr>
</table></div>
<div class="note warn"><b class="hd">Разница между <code>$</code> и <code>#</code> стоит дороже всего</b><p>Большинство разрушительных ошибок делают, не заметив, что приглашение сменилось на <code>#</code>. Взгляд на последний символ — привычка, которая однажды спасёт рабочий день.</p></div>

<h2>Четыре вопроса при входе на незнакомую машину</h2>
<div class="tw"><table>
<tr><th>Вопрос</th><th>Команда</th><th>Что смотреть в ответе</th></tr>
<tr><td>Кто я?</td><td><code>id</code></td><td>состою ли в группе <code>sudo</code></td></tr>
<tr><td>Что это за машина?</td><td><code>hostnamectl</code></td><td>имя, версия системы, ядро</td></tr>
<tr><td>Есть ли место?</td><td><code>df -h</code></td><td>столбец <code>Use%</code> — не подошёл ли к 100%</td></tr>
<tr><td>Что вообще работает?</td><td><code>systemctl list-units --failed</code></td><td>пустой список — хорошая новость</td></tr>
</table></div>
<pre><code>$ <span class="k">id</span>
<span class="q">uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),27(sudo)</span>   <span class="c2">← право на sudo есть</span>
$ <span class="k">df -h</span>
<span class="q">Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        20G  4.0G   16G  20% /</span>                       <span class="c2">← места достаточно</span></code></pre>

<h2>Дерево каталогов: не свалка, а соглашение</h2>
<div class="tw"><table>
<tr><th>Каталог</th><th>Что там лежит</th><th>Правите ли вы это руками</th></tr>
<tr><td><code>/etc</code></td><td>настройки всей системы</td><td>да, это ваша основная работа</td></tr>
<tr><td><code>/var/log</code></td><td>журналы</td><td>только читаете</td></tr>
<tr><td><code>/var/www</code>, <code>/srv</code></td><td>данные служб и сайтов</td><td>да</td></tr>
<tr><td><code>/home</code></td><td>домашние каталоги людей</td><td>да, свой</td></tr>
<tr><td><code>/usr/bin</code>, <code>/usr/sbin</code></td><td>программы из пакетов</td><td>нет — этим ведает apt</td></tr>
<tr><td><code>/usr/local/bin</code></td><td>ваши собственные программы</td><td>да</td></tr>
<tr><td><code>/tmp</code></td><td>временное, чистится при перезагрузке</td><td>да, но не храните там нужное</td></tr>
</table></div>
<p>Соглашение полезно ровно тем, что настройку любой службы можно искать в <code>/etc</code>, не читая её документацию. Служба, которая кладёт настройки в другое место, — повод насторожиться.</p>

<h2>Как читать строку <code>ls -l</code></h2>
<pre><code>$ <span class="k">ls -l /etc/ssh/sshd_config</span>
<span class="q">-rw-r--r-- 1 root root 3264 Sep  3 09:00 /etc/ssh/sshd_config</span>
 <span class="c2">│└┬┘└┬┘└┬┘ │ └─┬┘ └─┬┘  └─┬┘   └───┬───┘   └────────┬───────┘
 │ │  │  │  │   │    │     │         │            имя
 │ │  │  │  │   │    │     │         когда изменён
 │ │  │  │  │   │    │     размер в байтах
 │ │  │  │  │   │    группа
 │ │  │  │  │   владелец
 │ │  │  │  число ссылок
 │ │  │  права для всех остальных
 │ │  права для группы
 │ права для владельца
 тип: «-» файл, «d» каталог, «l» ссылка</span></code></pre>
<p>Эти девять букв — половина всей работы администратора. Следующий раздел только про них.</p>

<h2>Где искать, когда не знаете команду</h2>
<div class="tw"><table>
<tr><th>Приём</th><th>Когда помогает</th></tr>
<tr><td><code>команда --help</code></td><td>быстрая справка по ключам, почти всегда есть</td></tr>
<tr><td><code>man команда</code></td><td>подробное руководство</td></tr>
<tr><td><code>which команда</code></td><td>откуда она берётся и есть ли вообще</td></tr>
<tr><td>Tab</td><td>дополнение имён — заодно проверка, что путь существует</td></tr>
<tr><td>↑</td><td>предыдущая команда: не набирайте длинное дважды</td></tr>
</table></div>
<div class="note ok"><b class="hd">Внизу настоящая машина</b><p>Терминал под текстом — работающая модель Ubuntu Server. Наберите <code>help</code>, чтобы увидеть список команд, и <code>ls -l /etc</code>, чтобы осмотреться. Всё, что вы измените, останется до сброса сценария.</p></div>
`,
quiz:[
 {q:"Приглашение показывает <code>#</code> вместо <code>$</code>. Что это значит?",
  opts:["Ошибка в настройках","Вы работаете под root","Машина перегружена","Оболочка не bash"],
  a:1, why:"<code>#</code> — приглашение root. Это первое, на что стоит смотреть перед разрушительной командой."},
 {q:"Где искать настройки только что установленной службы?",
  opts:["/usr/bin","/etc","/var/log","/home"],
  a:1, why:"Соглашение FHS: настройки системы — в <code>/etc</code>. Поэтому службу можно настроить, не читая её документацию."},
 {q:"Что показывает первый символ в выводе <code>ls -l</code>?",
  opts:["Права владельца","Тип: файл, каталог или ссылка","Можно ли читать","Владельца"],
  a:1, why:"<code>-</code> — обычный файл, <code>d</code> — каталог, <code>l</code> — символьная ссылка."},
 {q:"Вы написали свой сценарий и хотите положить его так, чтобы он не пропал при обновлении. Куда?",
  opts:["/usr/bin","/usr/local/bin","/bin","/etc"],
  a:1, why:"<code>/usr/bin</code> ведает пакетный менеджер и может перезаписать файл. <code>/usr/local</code> отдан под ваше."},
 {q:"Команда <code>id</code> нужна, чтобы узнать:",
  opts:["Номер процесса","Кто вы и в каких вы группах","Адрес машины","Версию системы"],
  a:1, why:"Главное в её выводе — есть ли <code>sudo</code> среди групп: от этого зависит, что вы вообще сможете сделать."},
 {q:"Файлы в <code>/tmp</code>:",
  opts:["Хранятся вечно","Исчезают при перезагрузке","Доступны только root","Не занимают места"],
  a:1, why:"<code>/tmp</code> чистится. Класть туда то, что должно пережить перезагрузку, — распространённая ошибка."}
],
labs:[
 {id:"1a", title:"Осмотреться и записать вывод",
  brief:"<p>Вы впервые вошли на машину. Соберите четыре факта и сложите их в отчёт.</p><ul><li>выясните, кто вы и есть ли у вас <code>sudo</code>;</li><li>узнайте имя машины и версию системы;</li><li>посмотрите, сколько свободного места;</li><li>создайте каталог <code>/home/ubuntu/otchet</code>, а в нём файл <code>machine.txt</code>, куда положите вывод <code>hostnamectl</code>.</li></ul><p>Файл должен содержать имя машины — проверьте <code>cat</code>-ом, что попало внутрь.</p>",
  hint:"Перенаправление: hostnamectl > /home/ubuntu/otchet/machine.txt. Каталог создаётся заранее: mkdir.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}}),
  checks:[
   {label:"Проверено, кто вы", test:st=>used(st, "id") || used(st, "whoami") || used(st, "groups")},
   {label:"Машина опознана", test:st=>used(st, "hostnamectl") || used(st, "uname") || used(st, "hostname")},
   {label:"Свободное место посмотрено", test:st=>used(st, "df")},
   {label:"Каталог отчёта создан", test:st=>{const n = node(st, "/home/ubuntu/otchet"); return !!n && n.type === "d";}},
   {label:"В machine.txt попало имя машины", test:st=>/web-01/.test(text(st, "/home/ubuntu/otchet/machine.txt"))}
  ]},
 {id:"1b", title:"Разложить файл по полкам",
  brief:"<p>В <code>/root/prishlo</code> лежат вперемешку три вида файлов. Разложите их по правилам FHS:</p><ul><li><code>svodka.log</code> — в <code>/var/log/</code>;</li><li><code>app.conf</code> — в <code>/etc/</code>;</li><li><code>obsluga.sh</code> — в <code>/usr/local/bin/</code>, и сделайте его исполняемым.</li></ul><p>После этого <code>/usr/local/bin/obsluga.sh</code> должен запускаться просто по имени пути.</p>",
  hint:"mv переносит, chmod +x делает исполняемым. Проверьте результат: ls -l /usr/local/bin/.",
  setup: () => newMachine({
    dirs: {"/root/prishlo": {mode: 0o755}},
    files: {"/root/prishlo/svodka.log": "Sep  3 09:00 старт\n",
            "/root/prishlo/app.conf": "listen = 8080\n",
            "/root/prishlo/obsluga.sh": {text: "#!/bin/bash\necho обслуживание выполнено\n", mode: 0o644}}}),
  checks:[
   {label:"Журнал лежит в /var/log", test:st=>!!node(st, "/var/log/svodka.log")},
   {label:"Настройка лежит в /etc", test:st=>/listen/.test(text(st, "/etc/app.conf"))},
   {label:"Сценарий лежит в /usr/local/bin", test:st=>!!node(st, "/usr/local/bin/obsluga.sh")},
   {label:"Сценарий помечен исполняемым", test:st=>bits(st, "/usr/local/bin/obsluga.sh", 0o100)},
   {label:"Он действительно запускается", test:st=>logHas(st, /обслуживание выполнено/)},
   {label:"В /root/prishlo ничего не осталось", test:st=>{const n = node(st, "/root/prishlo"); return !n || Object.keys(n.children).length === 0;}}
  ]}
],
iv:[
 {q:"Вас пустили на незнакомый сервер и сказали «там что-то не так». С чего начнёте?",
  probe:"Проверяют не знание команд, а наличие порядка действий.",
  a:"Я начинаю с того, чтобы понять обстановку, а не чинить. Сначала <code>id</code> — кто я и что мне вообще позволено, потому что от этого зависит весь дальнейший разговор. Потом <code>hostnamectl</code>: убедиться, что я на той машине, на которой думаю, — на это попадаются чаще, чем кажется. Дальше три быстрых вопроса: <code>df -h</code>, потому что кончившееся место выглядит как отказ чего угодно; <code>systemctl list-units --failed</code>, который сразу называет упавшие службы; и <code>journalctl -p err -b</code> — ошибки с последней загрузки. Эти четыре команды занимают минуту и в большинстве случаев уже показывают направление. Только после этого я трогаю что-то руками, и обязательно записываю, что именно поменял.",
  more:["Почему df -h раньше журналов?","Что делать, если места действительно нет?"]},
 {q:"Чем /usr/local/bin отличается от /usr/bin и почему это важно?",
  probe:"Проверяют понимание границы между тем, что ведает пакетный менеджер, и тем, что ведаете вы.",
  a:"<code>/usr/bin</code> принадлежит пакетному менеджеру: всё, что там лежит, положил apt, и при обновлении пакета он вправе это перезаписать. <code>/usr/local</code> — граница, за которую apt не заходит, она отдана под то, что вы принесли сами. Практический смысл простой: если положить свой сценарий в <code>/usr/bin</code>, однажды он молча исчезнет после обновления, и разбираться будут долго, потому что подозрение на пакетный менеджер приходит в голову последним. Та же логика везде: <code>/etc</code> ваш, а вот файлы, которые пакет туда положил, при <code>purge</code> он уберёт.",
  more:["Что делает apt purge в отличие от remove?"]}
]
},

/* ------------------------------------------------ 2 */
{
n:2, id:"perm", title:"Права и владение", sub:"Девять букв, из-за которых всё ломается",
lede:"«Permission denied» — самая частая строка в жизни администратора. За ней стоит простая механика: у файла есть владелец, группа и три набора по три бита. Разобравшись однажды, вы перестанете лечить это командой chmod 777.",
theory:`
<h2>Три набора по три бита</h2>
<pre><code>-<span class="k">rwx</span><span class="g">r-x</span><span class="q">r--</span>  1 deploy  www-data  ...
 <span class="c2">└┬┘└┬┘└┬┘
  │  │  все остальные: только чтение
  │  группа www-data: чтение и запуск
  владелец deploy: чтение, запись, запуск</span></code></pre>
<p>Проверка идёт <b>по первому подходящему набору</b>, а не по сумме. Если вы владелец, смотрятся только ваши три бита — даже если группе позволено больше. Отсюда парадокс, который многих ставит в тупик: владелец файла <code>-r--rw-r--</code> не может в него писать, а посторонний из группы — может.</p>

<h2>Восьмеричная запись</h2>
<div class="tw"><table>
<tr><th>Цифра</th><th>Биты</th><th>Что можно</th></tr>
<tr><td>7</td><td>rwx</td><td>всё</td></tr>
<tr><td>6</td><td>rw-</td><td>читать и писать</td></tr>
<tr><td>5</td><td>r-x</td><td>читать и запускать</td></tr>
<tr><td>4</td><td>r--</td><td>только читать</td></tr>
<tr><td>0</td><td>---</td><td>ничего</td></tr>
</table></div>
<div class="tw"><table>
<tr><th>Режим</th><th>Для чего это норма</th></tr>
<tr><td><code>644</code></td><td>обычный файл настроек: владелец правит, остальные читают</td></tr>
<tr><td><code>600</code></td><td>секрет: ключ, пароль, токен</td></tr>
<tr><td><code>755</code></td><td>программа или каталог</td></tr>
<tr><td><code>700</code></td><td>личный каталог, например <code>~/.ssh</code></td></tr>
<tr><td><code>777</code></td><td>почти всегда ошибка — см. ниже</td></tr>
</table></div>

<h2>У каталогов те же буквы значат другое</h2>
<div class="tw"><table>
<tr><th>Бит</th><th>На файле</th><th>На каталоге</th></tr>
<tr><td><code>r</code></td><td>прочитать содержимое</td><td>получить список имён (<code>ls</code>)</td></tr>
<tr><td><code>w</code></td><td>изменить содержимое</td><td>создать, удалить, переименовать в нём</td></tr>
<tr><td><code>x</code></td><td>запустить</td><td>войти и обратиться к файлу по имени</td></tr>
</table></div>
<div class="note trap"><b class="hd">Два следствия, которые всегда удивляют</b><ul><li>Удаление файла — это <b>запись в каталог</b>, а не в файл. Файл может быть <code>444</code> и принадлежать root — если каталог ваш, вы его удалите.</li><li>Каталог <code>--x</code> (режим <code>711</code>) не позволяет посмотреть список, но позволяет открыть файл, если знаешь имя. Так устроены домашние каталоги на многопользовательских машинах.</li></ul></div>
<pre><code>$ <span class="k">ls /srv/zakrytyj</span>
<span class="c">ls: cannot open directory '/srv/zakrytyj': Permission denied</span>   <span class="c2">← нет r</span>
$ <span class="k">cat /srv/zakrytyj/izvestnoe-imya.txt</span>
<span class="q">содержимое</span>                                     <span class="c2">← но x есть, и по имени файл открылся</span></code></pre>

<h2>Почему <code>chmod 777</code> — это не решение</h2>
<p>777 означает «любой пользователь на машине может это изменить». В том числе служба, которую однажды взломают. Настоящий вопрос при «Permission denied» другой: <b>кто должен иметь доступ?</b> Ответ почти всегда — «владелец и одна группа», и лечится это <code>chown</code>, а не <code>chmod</code>.</p>
<pre><code><span class="c2"># было: веб-сервер не может читать файлы сайта</span>
$ <span class="k">ls -l /var/www/html/index.html</span>
<span class="q">-rw------- 1 deploy deploy 512 Sep  3 09:10 index.html</span>
<span class="c2"># неправильно: открыть всем</span>
$ <span class="k">chmod 777 /var/www/html/index.html</span>
<span class="c2"># правильно: отдать нужной группе и позволить ей читать</span>
$ <span class="k">sudo chown deploy:www-data /var/www/html/index.html</span>
$ <span class="k">chmod 640 /var/www/html/index.html</span></code></pre>

<h2>Особые биты</h2>
<div class="tw"><table>
<tr><th>Бит</th><th>Как видно</th><th>Что делает</th></tr>
<tr><td>setuid</td><td><code>-rws</code> у владельца</td><td>программа работает от имени владельца файла, а не запустившего</td></tr>
<tr><td>setgid</td><td><code>-rwxr-s</code> у группы</td><td>на каталоге: новые файлы наследуют его группу — удобно для общих папок</td></tr>
<tr><td>липкий</td><td><code>drwxrwxrwt</code></td><td>в общем каталоге удалять может только владелец файла. Так устроен <code>/tmp</code></td></tr>
</table></div>
<pre><code>$ <span class="k">ls -ld /tmp</span>
<span class="q">drwxrwxrwt 2 root root 4096 Sep  3 09:00 /tmp</span>   <span class="c2">← t на конце: чужое не удалить</span></code></pre>

<h2>umask: права по умолчанию</h2>
<p><code>umask</code> — не права, а маска: какие биты <b>снять</b> с того, что создаётся. При обычной <code>022</code> новый файл получает <code>644</code>, каталог — <code>755</code>. Поставьте <code>077</code> — и всё созданное будет доступно только вам.</p>
`,
quiz:[
 {q:"Файл <code>-r--rw-r--</code> принадлежит вам, вы же состоите в его группе. Можете ли вы в него писать?",
  opts:["Да, права группы дают запись","Нет: вы владелец, и смотрятся только первые три бита","Да, если использовать sudo без пароля","Зависит от umask"],
  a:1, why:"Проверяется первый подходящий набор, а не сумма. Владелец «застревает» на своих битах."},
 {q:"Что нужно, чтобы удалить файл, который вам не принадлежит?",
  opts:["Право w на сам файл","Право w на каталог, где он лежит","Быть в группе файла","Право x на файл"],
  a:1, why:"Удаление меняет каталог, а не файл. Поэтому чужой файл 444 в вашем каталоге удаляется свободно."},
 {q:"Каталог имеет режим <code>711</code>. Что вы сможете сделать?",
  opts:["Посмотреть список файлов","Открыть файл, если знаете его имя","И то и другое","Ничего"],
  a:1, why:"<code>x</code> даёт проход внутрь, <code>r</code> — список имён. Здесь есть только <code>x</code>."},
 {q:"Веб-сервер не читает файлы сайта. Что правильнее сделать?",
  opts:["chmod 777 на каталог","Отдать каталог группе www-data и поставить 640/750","Запустить веб-сервер от root","Отключить права"],
  a:1, why:"777 открывает файлы всем на машине. Вопрос не «как разрешить всем», а «кому именно нужно»."},
 {q:"Что означает <code>t</code> в конце <code>drwxrwxrwt</code>?",
  opts:["Каталог временный","Удалять в нём можно только свои файлы","Только чтение","Каталог для tmp-файлов по имени"],
  a:1, why:"Липкий бит. Без него любой в общем каталоге стирал бы чужое."},
 {q:"<code>umask 077</code> — какие права получит новый файл?",
  opts:["777","600","644","700"],
  a:1, why:"Из базовых 666 снимаются все биты группы и остальных: остаётся 600."}
],
labs:[
 {id:"2a", title:"Открыть сайт веб-серверу, не открывая его всем",
  brief:"<p>Файлы сайта в <code>/var/www/html</code> принадлежат <code>deploy</code> и закрыты от всех остальных, поэтому <code>nginx</code> (он работает от <code>www-data</code>) их не читает.</p><p>Сделайте так, чтобы:</p><ul><li>владельцем файлов остался <code>deploy</code>, а группой стала <code>www-data</code>;</li><li>владелец мог править, группа — только читать, остальные — ничего (<code>640</code> на файлы);</li><li>в каталог <code>/var/www/html</code> можно было войти группе, но не всем (<code>750</code>).</li></ul><p>Права <code>777</code> задание не засчитывает.</p>",
  hint:"chown deploy:www-data и chmod. Каталог и файлы требуют разных режимов — правьте их отдельно.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}, deploy: {uid: 1001}},
    dirs: {"/var/www/html": {mode: 0o700, owner: "deploy"}},
    files: {"/var/www/html/index.html": {text: "<h1>привет</h1>\n", mode: 0o600, owner: "deploy"},
            "/var/www/html/style.css": {text: "body{}\n", mode: 0o600, owner: "deploy"}}}),
  checks:[
   {label:"Группой файлов стала www-data", test:st=>groupOf(st, "/var/www/html/index.html") === "www-data" &&
                                                    groupOf(st, "/var/www/html/style.css") === "www-data"},
   {label:"Владельцем остался deploy, а не сменился на root",
    test:st=>ownerOf(st, "/var/www/html/index.html") === "deploy" &&
             groupOf(st, "/var/www/html/index.html") === "www-data"},
   {label:"Файлы в режиме 640", test:st=>mode(st, "/var/www/html/index.html") === 0o640 &&
                                          mode(st, "/var/www/html/style.css") === 0o640},
   {label:"Каталог в режиме 750", test:st=>mode(st, "/var/www/html") === 0o750},
   {label:"Каталог отдан группе www-data", test:st=>groupOf(st, "/var/www/html") === "www-data"},
   {label:"Группе доступ открыт, остальным — ничего",
    test:st=>(mode(st, "/var/www/html") & 0o050) === 0o050 && (mode(st, "/var/www/html") & 0o007) === 0 &&
             (mode(st, "/var/www/html/index.html") & 0o040) === 0o040 &&
             (mode(st, "/var/www/html/index.html") & 0o007) === 0}
  ]},
 {id:"2b", title:"Общий каталог, где не стирают чужое",
  brief:"<p>Команде нужен каталог <code>/srv/obshee</code> для обмена файлами. Требования:</p><ul><li>владелец — <code>root</code>, группа — <code>razrabotchiki</code> (группу нужно завести);</li><li>участники группы могут создавать файлы, посторонние — нет;</li><li>новые файлы автоматически получают группу <code>razrabotchiki</code> (бит setgid);</li><li>удалять можно только свои файлы (липкий бит).</li></ul><p>Итоговый режим каталога — <code>3770</code>.</p>",
  hint:"groupadd, mkdir, chown :группа, затем chmod 3770 — двойка это setgid, единица липкий бит.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}, alice: {uid: 1001}, bob: {uid: 1002}}}),
  checks:[
   {label:"Группа razrabotchiki заведена", test:st=>!!st.S.groups.razrabotchiki},
   {label:"Каталог /srv/obshee существует", test:st=>{const n = node(st, "/srv/obshee"); return !!n && n.type === "d";}},
   {label:"Группой каталога стала razrabotchiki", test:st=>groupOf(st, "/srv/obshee") === "razrabotchiki"},
   {label:"Группа может писать, посторонние — нет", test:st=>{const m = mode(st, "/srv/obshee"); return (m & 0o070) === 0o070 && (m & 0o007) === 0;}},
   {label:"Стоит бит setgid", test:st=>bits(st, "/srv/obshee", 0o2000)},
   {label:"Стоит липкий бит", test:st=>bits(st, "/srv/obshee", 0o1000)}
  ]}
],
iv:[
 {q:"Сотрудник говорит: «не работало, я поставил chmod 777 — заработало». Что вы ответите?",
  probe:"Проверяют, умеете ли объяснить риск без нравоучения и предложить замену.",
  a:"Что заработало — правда, и это худшая часть: приём закрепляется. 777 значит «любой процесс на машине может это переписать», включая тот, который однажды окажется скомпрометирован; для каталога это ещё и «любой может подложить туда файл». Я бы предложил другой ход мысли: «Permission denied» — это не вопрос «сколько прав добавить», а вопрос «кто именно должен иметь доступ». Обычно ответ — конкретная служба, и она работает от конкретного пользователя. Значит, лечение — <code>chown</code> на нужную группу и <code>640</code> или <code>750</code>, а не открытие всем. Практически: посмотреть <code>ps aux</code>, от кого работает служба, и отдать ей файлы через группу.",
  more:["Чем 640 отличается от 660 для файла настроек?","Когда 777 всё-таки допустимо?"]},
 {q:"Зачем на каталоге нужен бит setgid?",
  probe:"Вопрос на общие каталоги — типовая задача в командах.",
  a:"Обычно новый файл получает основную группу того, кто его создал. В общем каталоге это разваливает доступ: Алиса создала файл — группа <code>alice</code>, и Борис его уже не прочитает, хотя оба в общей группе. Бит setgid на каталоге меняет правило: всё созданное внутри наследует группу самого каталога. Вместе с липким битом получается рабочая пара — общий доступ на запись, но каждый удаляет только своё. Итоговый режим такого каталога <code>3770</code>: тройка впереди и есть setgid плюс липкий бит.",
  more:["Что делает setuid на программе и почему это опасно?"]}
]
},

/* ------------------------------------------------ 3 */
{
n:3, id:"users", title:"Пользователи и sudo", sub:"Кто на машине и что ему позволено",
lede:"На сервере почти нет людей: большинство учётных записей заведены для служб и никогда не входят в систему. Понимание этой разницы и правильная выдача sudo — то, с чего начинается безопасность машины.",
theory:`
<h2>Три файла, в которых всё записано</h2>
<div class="tw"><table>
<tr><th>Файл</th><th>Что хранит</th><th>Кто читает</th></tr>
<tr><td><code>/etc/passwd</code></td><td>имя, номер, домашний каталог, оболочка</td><td>все</td></tr>
<tr><td><code>/etc/group</code></td><td>группы и их состав</td><td>все</td></tr>
<tr><td><code>/etc/shadow</code></td><td>хеши паролей</td><td>только root (режим <code>640</code>, группа <code>shadow</code>)</td></tr>
</table></div>
<pre><code>$ <span class="k">cat /etc/passwd</span>
<span class="q">root:x:0:0:root:/root:/bin/bash</span>
<span class="q">www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin</span>   <span class="c2">← служебная: входить нельзя</span>
<span class="q">deploy:x:1000:1000::/home/deploy:/bin/bash</span>            <span class="c2">← человек</span>
 <span class="c2">└──┬─┘ │ └┬┘ └┬┘  └──────┬─────┘ └───┬────┘
   имя  │ uid  gid    домашний    оболочка
        пароль давно переехал в /etc/shadow, «x» — след от этого</span></code></pre>
<div class="tw"><table>
<tr><th>Номер (uid)</th><th>Кто это</th></tr>
<tr><td>0</td><td>root — проверок прав для него нет</td></tr>
<tr><td>1–999</td><td>служебные учётки: их заводят пакеты для своих служб</td></tr>
<tr><td>от 1000</td><td>люди</td></tr>
</table></div>
<div class="note ok"><b class="hd">Оболочка <code>/usr/sbin/nologin</code> — это защита</b><p>Служба вроде nginx работает от <code>www-data</code>, но входить этой учёткой нельзя: даже подобрав пароль, войти не получится. Заводя учётку для службы, всегда ставьте <code>nologin</code>.</p></div>

<h2>adduser и useradd — не одно и то же</h2>
<div class="tw"><table>
<tr><th></th><th><code>adduser</code></th><th><code>useradd</code></th></tr>
<tr><td>Что это</td><td>дружелюбная обёртка Debian/Ubuntu</td><td>низкоуровневая команда</td></tr>
<tr><td>Домашний каталог</td><td>создаёт сам</td><td>только с ключом <code>-m</code></td></tr>
<tr><td>Группа</td><td>создаёт одноимённую</td><td>нужно указывать</td></tr>
<tr><td>Пароль</td><td>спрашивает</td><td>не трогает: вход закрыт</td></tr>
<tr><td>Когда брать</td><td>для человека, руками</td><td>в сценариях, где нужна точность</td></tr>
</table></div>
<pre><code><span class="c2"># человек</span>
$ <span class="k">sudo adduser deploy</span>
<span class="c2"># служебная учётка: без входа, без домашнего каталога</span>
$ <span class="k">sudo useradd -r -s /usr/sbin/nologin prilozhenie</span></code></pre>

<h2>Группы: основная и дополнительные</h2>
<p>У пользователя одна основная группа (её <code>gid</code> записан в <code>passwd</code>) и сколько угодно дополнительных. Право на что-либо почти всегда даётся через дополнительную группу.</p>
<div class="note trap"><b class="hd">Ключ <code>-a</code> обязателен</b><pre><code>$ <span class="k">sudo usermod -aG sudo deploy</span>   <span class="c2">← добавить к имеющимся</span>
$ <span class="k">sudo usermod -G sudo deploy</span>    <span class="c2">← ЗАМЕНИТЬ все дополнительные группы одной</span></code></pre><p>Второй вариант молча выкидывает человека из всех прочих групп. Восстанавливать потом приходится по памяти.</p></div>
<p>Новые группы вступают в силу при следующем входе: у текущего сеанса список групп уже прочитан. Проверить, что записано в системе, можно <code>id deploy</code> — он читает файлы заново.</p>

<h2>sudo вместо входа под root</h2>
<p>В Ubuntu у root <b>нет пароля</b> — вход под ним закрыт. Права получают через <code>sudo</code>, и это лучше по трём причинам: каждое действие попадает в <code>/var/log/auth.log</code> с именем человека; повышение действует на одну команду; отобрать право можно, убрав из группы, не меняя паролей.</p>
<div class="tw"><table>
<tr><th>Команда</th><th>Что делает</th></tr>
<tr><td><code>sudo команда</code></td><td>одна команда от root</td></tr>
<tr><td><code>sudo -i</code></td><td>оболочка root — для длинной серии действий</td></tr>
<tr><td><code>sudo -u deploy команда</code></td><td>от имени другого пользователя, не root</td></tr>
<tr><td><code>su - deploy</code></td><td>стать другим пользователем, зная его пароль</td></tr>
</table></div>
<div class="note trap"><b class="hd">Ловушка с перенаправлением</b><pre><code>$ <span class="k">sudo echo "текст" &gt; /etc/файл</span>
<span class="c">bash: /etc/файл: Permission denied</span></code></pre><p>Файл открывает <b>оболочка</b>, и делает это до того, как sudo что-то повысит, — от вашего имени. Работают два обхода:</p><pre><code>$ <span class="k">echo "текст" | sudo tee /etc/файл</span>
$ <span class="k">sudo tee /etc/файл &lt;&lt;&lt; "текст"</span></code></pre></div>

<h2>Как раздают право на sudo</h2>
<p>Членство в группе <code>sudo</code> даёт всё. Когда нужно меньше — кладут отдельный файл в <code>/etc/sudoers.d/</code>:</p>
<pre><code><span class="c2"># /etc/sudoers.d/deploy-restart, права 0440</span>
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart myapp</code></pre>
<p>Отдельные файлы, а не правка <code>/etc/sudoers</code>: ошибка в главном файле лишает sudo всех сразу, и чинить придётся с консоли восстановления. Права ровно <code>0440</code> — более открытый файл sudo молча игнорирует.</p>
`,
quiz:[
 {q:"Чем отличается <code>usermod -aG</code> от <code>usermod -G</code>?",
  opts:["Ничем","-aG добавляет к имеющимся группам, -G заменяет их все","-G работает только для root","-aG требует перезагрузки"],
  a:1, why:"Забытое <code>-a</code> молча выкидывает человека из всех прочих групп."},
 {q:"Почему служебным учёткам ставят оболочку <code>/usr/sbin/nologin</code>?",
  opts:["Так быстрее","Чтобы этой учёткой нельзя было войти в систему","Экономит память","Требование systemd"],
  a:1, why:"Служба работает от неё, но интерактивный вход закрыт — даже с паролем."},
 {q:"<code>sudo echo текст > /etc/f</code> отвечает «Permission denied». Почему?",
  opts:["sudo не работает с echo","Файл открывает оболочка от вашего имени, до повышения прав","Нужен ключ -i","В /etc нельзя писать вообще"],
  a:1, why:"Перенаправление — работа оболочки. Обход: <code>echo текст | sudo tee /etc/f</code>."},
 {q:"Правило для sudo лучше класть:",
  opts:["В конец /etc/sudoers","Отдельным файлом в /etc/sudoers.d/ с правами 0440","В ~/.bashrc","В /etc/passwd"],
  a:1, why:"Ошибка в главном файле лишает sudo всех сразу. Отдельные файлы изолируют риск."},
 {q:"Пользователь с uid 0 — это:",
  opts:["Первый заведённый","root, для которого проверок прав нет","Гость","Служебная учётка"],
  a:1, why:"Нулевой uid и есть определение root: ядро не проверяет для него права."},
 {q:"Вы добавили себя в группу docker, но команда всё ещё отказывает. Что вероятнее всего?",
  opts:["Группа не создана","Список групп читается при входе — нужен новый сеанс","Нужен reboot","Нужен sudo"],
  a:1, why:"Текущий сеанс держит старый список. <code>id</code> покажет, что в файлах всё правильно."}
],
labs:[
 {id:"3a", title:"Завести человека и службу",
  brief:"<p>На машину приходит новый инженер и въезжает новое приложение.</p><ul><li>заведите пользователя <code>marina</code> с домашним каталогом и оболочкой <code>/bin/bash</code>;</li><li>дайте ей право на <code>sudo</code>, не забрав ничего другого;</li><li>заведите служебную учётку <code>prilozhenie</code> с оболочкой <code>/usr/sbin/nologin</code> и без домашнего каталога — входить ей не нужно.</li></ul>",
  hint:"adduser для человека; useradd -s /usr/sbin/nologin для службы. Группа добавляется через usermod -aG.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}}),
  checks:[
   {label:"Пользователь marina заведён", test:st=>hasUser(st, "marina")},
   {label:"У неё есть домашний каталог", test:st=>{const n = node(st, "/home/marina"); return !!n && n.type === "d";}},
   {label:"Оболочка marina — bash", test:st=>/bash/.test((st.S.users.marina || {}).shell || "")},
   {label:"marina в группе sudo", test:st=>inGrp(st, "marina", "sudo")},
   {label:"Служебная учётка prilozhenie заведена", test:st=>hasUser(st, "prilozhenie")},
   {label:"Ей закрыт вход через nologin", test:st=>/nologin/.test((st.S.users.prilozhenie || {}).shell || "")},
   {label:"Домашнего каталога у службы нет", test:st=>hasUser(st, "prilozhenie") && !node(st, "/home/prilozhenie")}
  ]},
 {id:"3b", title:"Узкое право вместо полного sudo",
  brief:"<p>Инженеру <code>ci</code> нужно перезапускать одну службу — и больше ничего. Полный <code>sudo</code> ему давать нельзя.</p><ul><li>положите правило в <code>/etc/sudoers.d/ci</code>: <code>ci ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart myapp</code>;</li><li>поставьте на файл права <code>0440</code>;</li><li><code>ci</code> не должен состоять в группе <code>sudo</code>;</li><li>проверьте, что правило работает: перезапустите <code>myapp</code>.</li></ul><p>Записать файл в <code>/etc</code> обычным перенаправлением не выйдет — вспомните про <code>tee</code>.</p>",
  hint:"echo 'строка' | sudo tee /etc/sudoers.d/ci, затем sudo chmod 0440 на него.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}, ci: {uid: 1005}},
    units: {"myapp.service": {desc: "My App", exec: "/usr/bin/myapp", active: true, enabled: true, pid: 880, sub: "running"}}}),
  checks:[
   {label:"Файл /etc/sudoers.d/ci создан", test:st=>!!node(st, "/etc/sudoers.d/ci")},
   {label:"В нём есть правило для ci", test:st=>/^\s*ci\s+ALL=/m.test(text(st, "/etc/sudoers.d/ci"))},
   {label:"Правило разрешает только перезапуск myapp", test:st=>/systemctl\s+restart\s+myapp/.test(text(st, "/etc/sudoers.d/ci"))},
   {label:"Права на файле 0440", test:st=>mode(st, "/etc/sudoers.d/ci") === 0o440},
   {label:"ci не в группе sudo — право дано только правилом",
    test:st=>!!node(st, "/etc/sudoers.d/ci") && !inGrp(st, "ci", "sudo")},
   {label:"Право проверено делом: myapp перезапущена", test:st=>isActive(st, "myapp") &&
      st.log.some(e => /systemctl\s+(restart|start)\s+myapp/.test(e.cmd) && !e.err)}
  ]}
],
iv:[
 {q:"Почему в Ubuntu не входят под root, а пользуются sudo?",
  probe:"Проверяют понимание причин, а не заученное «так принято».",
  a:"Три причины, и все практические. Первая — учёт: каждая команда через sudo попадает в <code>/var/log/auth.log</code> с именем человека, а под общим root видно только «кто-то из семерых». Вторая — ограниченность: повышение действует на одну команду, а не на весь сеанс, поэтому случайная разрушительная команда в середине работы выполняется от вас и обычно просто отказывает. Третья — управление доступом: чтобы забрать право, достаточно убрать человека из группы <code>sudo</code>, не меняя общий пароль и не оповещая остальных. Плюс sudo умеет то, чего root не умеет вовсе, — разрешить ровно одну команду через файл в <code>/etc/sudoers.d/</code>.",
  more:["Как выдать право только на перезапуск одной службы?","Почему правило кладут отдельным файлом?"]},
 {q:"Чем служебная учётная запись отличается от обычной и зачем это разделение?",
  probe:"Проверяют, понимаете ли вы принцип наименьших прав на уровне учёток.",
  a:"Формально — номером и оболочкой: у служебных uid меньше 1000 и оболочка <code>/usr/sbin/nologin</code>, то есть войти ими нельзя. Смысл в изоляции последствий. Если nginx работает от <code>www-data</code>, то дыра в nginx даёт нападающему права <code>www-data</code> — а это почти ничего: чужие файлы недоступны, войти нельзя, sudo нет. Если бы служба работала от root, та же дыра отдавала бы машину целиком. Поэтому у каждой службы своя учётка, и заводит её обычно сам пакет при установке. Своё приложение стоит запускать так же — отдельным пользователем, а не от root «чтобы точно работало».",
  more:["Что даёт директива User= в unit-файле systemd?"]}
]
},
