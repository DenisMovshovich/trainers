
/* ------------------------------------------------ 10 */
{
n:10, id:"ssh", title:"Доступ по ssh", sub:"Ключи вместо паролей и настройка сервера",
lede:"ssh — единственная дверь в сервер, и настроена она обычно небрежно. Переход на ключи и три строки в sshd_config убирают почти весь поток попыток подбора.",
theory:`
<h2>Пара ключей: что куда кладут</h2>
<div class="tw"><table>
<tr><th>Файл</th><th>Где живёт</th><th>Кому показывать</th></tr>
<tr><td><code>id_ed25519</code></td><td>на вашей машине, <code>~/.ssh/</code></td><td>никому и никогда</td></tr>
<tr><td><code>id_ed25519.pub</code></td><td>там же</td><td>кому угодно</td></tr>
<tr><td><code>authorized_keys</code></td><td>на сервере, <code>~/.ssh/</code> нужного пользователя</td><td>содержит открытые ключи тех, кому можно войти</td></tr>
</table></div>
<pre><code>$ <span class="k">ssh-keygen -t ed25519 -C "marina@ноутбук"</span>   <span class="c2">← создать пару</span>
$ <span class="k">ssh-copy-id marina@web-01</span>                     <span class="c2">← положить открытый ключ на сервер</span></code></pre>
<p><code>ssh-copy-id</code> сам создаёт <code>~/.ssh</code>, дописывает ключ и выставляет права. Делать это руками через <code>cat</code> — обычный источник следующей проблемы.</p>

<h2>Права на ~/.ssh: почему ключ «не работает»</h2>
<div class="note trap"><b class="hd">sshd отказывается от ключа, если файл доступен кому-то ещё</b><pre><code>Authentication refused: bad ownership or modes for file /home/marina/.ssh/authorized_keys</code></pre><p>Это не придирка: если чужой может дописать строку в ваш <code>authorized_keys</code>, он войдёт под вами. Поэтому sshd проверяет права и молча отказывает.</p></div>
<div class="tw"><table>
<tr><th>Что</th><th>Права</th><th>Владелец</th></tr>
<tr><td><code>~</code></td><td>не больше <code>755</code> — группа и остальные без записи</td><td>сам пользователь</td></tr>
<tr><td><code>~/.ssh</code></td><td><code>700</code></td><td>сам пользователь</td></tr>
<tr><td><code>~/.ssh/authorized_keys</code></td><td><code>600</code></td><td>сам пользователь</td></tr>
</table></div>
<p>Диагноз ставится за секунду: если вход по ключу не проходит, а пароль работает, — это почти всегда права. Настоящую причину видно в журнале сервера: <code>journalctl -u ssh</code>.</p>

<h2>Настройка сервера: /etc/ssh/sshd_config</h2>
<div class="tw"><table>
<tr><th>Директива</th><th>Значение</th><th>Зачем</th></tr>
<tr><td><code>PermitRootLogin</code></td><td><code>no</code></td><td>root — единственное имя, которое подбирают всегда</td></tr>
<tr><td><code>PasswordAuthentication</code></td><td><code>no</code></td><td>убирает подбор паролей как класс</td></tr>
<tr><td><code>PubkeyAuthentication</code></td><td><code>yes</code></td><td>вход по ключам</td></tr>
<tr><td><code>AllowUsers</code></td><td>список</td><td>входить могут только перечисленные</td></tr>
</table></div>
<div class="note warn"><b class="hd">Порядок действий, чтобы не запереть себя снаружи</b><ol><li>Положить ключ и <b>проверить вход по нему в отдельном окне</b>, не закрывая текущее.</li><li>Только убедившись, что ключ работает, выключать <code>PasswordAuthentication</code>.</li><li>Перезапустить: <code>sudo systemctl restart ssh</code>.</li><li>Снова проверить вход в новом окне, не закрывая старое.</li></ol><p>Открытый сеанс — страховка: пока он жив, ошибку можно откатить. Именно поэтому настройку ssh никогда не делают «одной командой и выходом».</p></div>

<h2>Что видно в журнале</h2>
<pre><code>$ <span class="k">grep "Failed password" /var/log/auth.log | wc -l</span>
<span class="q">2841</span>                                   <span class="c2">← столько попыток подбора за сутки</span>
$ <span class="k">grep "Accepted" /var/log/auth.log</span>
<span class="q">Accepted publickey for marina from 10.0.2.2 port 51344 ssh2</span></code></pre>
<p>Тысячи <code>Failed password</code> — нормальный фон для сервера с открытым портом. После <code>PasswordAuthentication no</code> они исчезают: подбирать становится нечего.</p>

<h2>Смена порта — не защита</h2>
<p>Перенос ssh на нестандартный порт убирает шум от простых сканеров, но не защищает: порт находится сканированием за секунды. Это гигиена, а не безопасность. Настоящая защита — ключи вместо паролей, и уже потом всё остальное.</p>
`,
quiz:[
 {q:"Вход по ключу не проходит, а по паролю работает. Что проверить первым?",
  opts:["Версию ssh","Права на ~/.ssh и authorized_keys","Порт","Сеть"],
  a:1, why:"sshd отказывается от ключа, если файл доступен кому-то, кроме владельца."},
 {q:"Какие права должны быть у <code>~/.ssh/authorized_keys</code>?",
  opts:["644","600","755","777"],
  a:1, why:"Только владелец, и только чтение с записью. У каталога <code>~/.ssh</code> — 700."},
 {q:"Какой файл нельзя показывать никому?",
  opts:["id_ed25519.pub","id_ed25519","authorized_keys","known_hosts"],
  a:1, why:"Без расширения <code>.pub</code> — закрытый ключ. Открытый затем и открытый, чтобы его раздавать."},
 {q:"Правильный порядок при выключении входа по паролю:",
  opts:["Выключить, перезапустить, проверить","Проверить вход по ключу в отдельном окне, потом выключать, не закрывая старый сеанс","Выключить и перезагрузить машину","Порядок не важен"],
  a:1, why:"Открытый сеанс — единственная страховка от того, чтобы запереть себя снаружи."},
 {q:"<code>PermitRootLogin no</code> — что даёт?",
  opts:["Ускоряет вход","Закрывает вход под именем, которое подбирают чаще всего","Отключает sudo","Требует ключей"],
  a:1, why:"root есть на каждой машине, поэтому его и подбирают. Работать всё равно нужно через sudo."},
 {q:"Перенос ssh на порт 2222:",
  opts:["Надёжно защищает","Убирает шум простых сканеров, но не защищает: порт находят сканированием","Ускоряет соединение","Обязателен"],
  a:1, why:"Это гигиена, а не безопасность. Защищают ключи вместо паролей."}
],
labs:[
 {id:"10a", title:"Перевести доступ на ключи",
  brief:"<p>Пользователь <code>marina</code> заведён, но входит по паролю. Переведите её на ключ.</p><ul><li>создайте пару ключей (<code>ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519</code>);</li><li>положите открытый ключ пользователю <code>marina</code> так, чтобы права оказались верными;</li><li>проверьте, что вход по ключу проходит: <code>ssh marina@web-01</code>;</li><li>только после этого выключите вход по паролю в <code>/etc/ssh/sshd_config</code> и перезапустите службу.</li></ul>",
  hint:"ssh-copy-id -i /root/.ssh/id_ed25519.pub marina@web-01 сделает и каталог, и права. Правка настройки — sed -i или вкладка «Файл».",
  setup: () => newMachine({users: {marina: {uid: 1000}}}),
  checks:[
   {label:"Пара ключей создана", test:st=>!!node(st, "/root/.ssh/id_ed25519") && !!node(st, "/root/.ssh/id_ed25519.pub")},
   {label:"Ключ лежит у marina", test:st=>/ssh-/.test(text(st, "/home/marina/.ssh/authorized_keys"))},
   {label:"Права на каталог .ssh — 700", test:st=>mode(st, "/home/marina/.ssh") === 0o700},
   {label:"Права на authorized_keys — 600", test:st=>mode(st, "/home/marina/.ssh/authorized_keys") === 0o600},
   {label:"Файл принадлежит самой marina", test:st=>ownerOf(st, "/home/marina/.ssh/authorized_keys") === "marina"},
   {label:"Вход по ключу проверен до правки настроек",
    test:st=>{
      const i = st.log.findIndex(e => /^\s*ssh\s+marina@/.test(e.cmd) && !e.err);
      const j = st.log.findIndex(e => /PasswordAuthentication\s+no/.test(e.cmd));
      return i >= 0 && (j < 0 || i < j);
    }},
   {label:"Вход по паролю выключен", test:st=>conf(st, "/etc/ssh/sshd_config", "PasswordAuthentication") === "no"},
   {label:"Служба ssh перезапущена", test:st=>ran(st, /systemctl\s+(restart|reload)\s+ssh/)}
  ]},
 {id:"10b", title:"Ключ положили, а вход не работает",
  brief:"<p>Ключ пользователя <code>deploy</code> лежит на месте, но войти не получается.</p><ul><li>попробуйте <code>ssh deploy@web-01</code> и прочитайте, что ответит сервер;</li><li>посмотрите права на <code>/home/deploy/.ssh</code> и файл внутри;</li><li>исправьте их и владельца;</li><li>добейтесь успешного входа.</li></ul><p>Заодно закройте вход под root: в <code>sshd_config</code> должно быть <code>PermitRootLogin no</code>.</p>",
  hint:"Каталог 700, файл 600, владелец — deploy. Меняются chmod и chown -R.",
  setup: () => newMachine({users: {deploy: {uid: 1000}},
    dirs: {"/home/deploy/.ssh": {mode: 0o777, owner: "root"}},
    files: {"/home/deploy/.ssh/authorized_keys":
              {text: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5UCHEBNY deploy@ноутбук\n", mode: 0o644}}}),
  checks:[
   {label:"Отказ увиден своими глазами", test:st=>errSeen(st, /bad ownership or modes|Permission denied/)},
   {label:"Права каталога исправлены на 700", test:st=>mode(st, "/home/deploy/.ssh") === 0o700},
   {label:"Права файла исправлены на 600", test:st=>mode(st, "/home/deploy/.ssh/authorized_keys") === 0o600},
   {label:"Владельцем стал deploy", test:st=>ownerOf(st, "/home/deploy/.ssh/authorized_keys") === "deploy" &&
                                             ownerOf(st, "/home/deploy/.ssh") === "deploy"},
   {label:"Вход по ключу теперь проходит", test:st=>logHas(st, /Welcome to Ubuntu/)},
   {label:"Вход под root закрыт", test:st=>conf(st, "/etc/ssh/sshd_config", "PermitRootLogin") === "no"}
  ]}
],
iv:[
 {q:"Как безопасно перевести сервер на вход только по ключам?",
  probe:"Ждут не список директив, а порядок, который не запирает вас снаружи.",
  a:"Главное здесь не что менять, а в каком порядке. Сначала кладу открытый ключ — через <code>ssh-copy-id</code>, потому что он сам создаёт каталог и ставит права, а руками это делают неправильно чаще, чем правильно. Потом обязательно проверяю вход по ключу <b>в новом окне, не закрывая текущий сеанс</b>. И только когда убедился, выключаю <code>PasswordAuthentication</code> и перезапускаю sshd — снова не закрывая старое соединение, потому что перезапуск sshd действующие сеансы не рвёт, и если что-то пошло не так, у меня остаётся живая дверь, чтобы откатить. После этого проверяю ещё раз в третьем окне. Заодно ставлю <code>PermitRootLogin no</code>. Если пропустить проверку и просто выключить пароли, при малейшей ошибке в правах сервер становится недоступен, и дальше только консоль провайдера.",
  more:["Почему ssh-copy-id лучше, чем cat в authorized_keys?","Рвёт ли перезапуск sshd текущие соединения?"]},
 {q:"Вход по ключу не работает, хотя ключ на месте. Причины?",
  probe:"Проверяют, знаете ли вы про права — это причина в большинстве случаев.",
  a:"Первое и самое частое — права. sshd отказывается брать <code>authorized_keys</code>, если файл или каталог доступны на запись кому-то, кроме владельца, и это не придирка: иначе посторонний просто допишет туда свой ключ. Нужно <code>700</code> на <code>~/.ssh</code>, <code>600</code> на сам файл, и оба должны принадлежать этому пользователю — частая ошибка, когда файл клали через sudo и он остался за root. Причём клиент говорит просто «Permission denied (publickey)», без подробностей; настоящая причина видна на сервере, в <code>journalctl -u ssh</code>, там будет «bad ownership or modes». Из остального: домашний каталог доступен на запись группе; ключ положили не тому пользователю; в <code>sshd_config</code> есть <code>AllowUsers</code>, и человека там нет.",
  more:["Где именно смотреть настоящую причину отказа?","Какие права нужны на сам домашний каталог?"]}
]
},

/* ------------------------------------------------ 11 */
{
n:11, id:"fw", title:"Межсетевой экран", sub:"Закрыть лишнее, не отрезав себя",
lede:"ufw делает правила ядра понятными. Главная опасность здесь не в сложности, а в одной команде, которая на удалённой машине обрывает вам доступ навсегда.",
theory:`
<h2>Порядок, который нельзя менять местами</h2>
<div class="note warn"><b class="hd">Сначала разрешить ssh, потом включать экран</b><pre><code>$ <span class="k">sudo ufw allow OpenSSH</span>     <span class="c2">← ПЕРВЫМ</span>
$ <span class="k">sudo ufw enable</span>             <span class="c2">← только теперь</span></code></pre><p>По умолчанию ufw запрещает всё входящее. Включив его без правила на 22-й порт, вы обрываете собственное соединение — и на удалённой машине вернуться уже нечем. Ubuntu предупреждает об этом, но предупреждение легко пролистать.</p></div>

<h2>Основные команды</h2>
<div class="tw"><table>
<tr><th>Команда</th><th>Что делает</th></tr>
<tr><td><code>ufw status verbose</code></td><td>включён ли и какие правила</td></tr>
<tr><td><code>ufw allow 80/tcp</code></td><td>разрешить порт</td></tr>
<tr><td><code>ufw allow OpenSSH</code></td><td>разрешить по имени профиля</td></tr>
<tr><td><code>ufw allow from 10.0.0.0/8 to any port 5432</code></td><td>разрешить только из своей сети</td></tr>
<tr><td><code>ufw status numbered</code> + <code>ufw delete 3</code></td><td>посмотреть с номерами и удалить нужное</td></tr>
<tr><td><code>ufw default deny incoming</code></td><td>политика по умолчанию</td></tr>
</table></div>
<pre><code>$ <span class="k">sudo ufw status numbered</span>
<span class="q">Status: active

     To                         Action      From
     --                         ------      ----
[ 1] OpenSSH                    ALLOW IN    Anywhere
[ 2] 80/tcp                     ALLOW IN    Anywhere
[ 3] 5432/tcp                   ALLOW IN    10.0.0.0/8</span></code></pre>

<h2>Правило для базы: не «открыть порт», а «открыть кому»</h2>
<p>База данных не должна быть доступна из интернета. Но и закрывать её полностью нельзя — к ней ходит приложение. Правильная формулировка не «разрешить 5432», а «разрешить 5432 из своей сети»:</p>
<pre><code>$ <span class="k">sudo ufw allow from 10.0.0.0/8 to any port 5432 proto tcp</span></code></pre>
<div class="note ok"><b class="hd">Ещё лучше — вообще не выставлять наружу</b><p>Если база нужна только приложению на той же машине, привяжите её к <code>127.0.0.1</code> в её собственных настройках. Тогда правило экрана не нужно вовсе: порт снаружи просто не существует. Экран — второй рубеж, а не первый.</p></div>

<h2>Что закрывать, а что и не открывалось</h2>
<p>Полезная привычка — смотреть на <code>ss -tulpn</code> глазами постороннего: каждая строка с <code>0.0.0.0</code> означает открытую наружу службу. Дальше по каждой задают один вопрос: она должна быть доступна снаружи? Обычно ответ «нет» для баз, кешей и внутренних панелей, и «да» только для веб-сервера и ssh.</p>
<div class="tw"><table>
<tr><th>Служба</th><th>Обычно наружу</th><th>Чем закрывать</th></tr>
<tr><td>ssh (22)</td><td>да, но лучше по ключам</td><td>ключи, <code>AllowUsers</code></td></tr>
<tr><td>http/https (80, 443)</td><td>да</td><td>—</td></tr>
<tr><td>postgres (5432)</td><td>нет</td><td>привязка к 127.0.0.1</td></tr>
<tr><td>панели, метрики</td><td>нет</td><td>правило «только из своей сети»</td></tr>
</table></div>

<h2>Обновления безопасности</h2>
<p>Самая частая причина взлома сервера — не открытый порт, а непропатченная уязвимость в службе, которая и должна быть открыта. Пакет <code>unattended-upgrades</code> ставит исправления безопасности сам:</p>
<pre><code>$ <span class="k">sudo apt install unattended-upgrades</span>
$ <span class="k">systemctl status unattended-upgrades</span></code></pre>
<p>Это разумная настройка по умолчанию для сервера: обновления безопасности редко ломают совместимость, а задержка с ними стоит дорого.</p>
`,
quiz:[
 {q:"Что произойдёт при <code>sudo ufw enable</code> на удалённой машине без правила для ssh?",
  opts:["Ничего особенного","Соединение оборвётся, и вернуться будет нечем","ufw сам разрешит 22","Появится запрос подтверждения"],
  a:1, why:"Политика по умолчанию — запрет всего входящего. Правило для ssh добавляют первым."},
 {q:"Как разрешить доступ к базе только из внутренней сети?",
  opts:["ufw allow 5432","ufw allow from 10.0.0.0/8 to any port 5432","ufw default allow","Открыть порт в настройках базы"],
  a:1, why:"Вопрос не «какой порт открыть», а «кому его открыть»."},
 {q:"Как удалить конкретное правило ufw?",
  opts:["ufw reset","ufw status numbered, затем ufw delete N","Переустановить ufw","Править файлы вручную"],
  a:1, why:"<code>numbered</code> показывает номера, по номеру и удаляют."},
 {q:"База нужна только приложению на этой же машине. Лучший способ её закрыть:",
  opts:["Правило ufw","Привязать её к 127.0.0.1 в её настройках","Сменить порт","Пароль подлиннее"],
  a:1, why:"Тогда порт снаружи не существует вовсе, и экран становится вторым рубежом, а не единственным."},
 {q:"Самая частая причина взлома сервера:",
  opts:["Открытый 22-й порт","Непропатченная уязвимость в службе, которая и должна быть открыта","Слабый пароль root","Отсутствие антивируса"],
  a:1, why:"Поэтому <code>unattended-upgrades</code> для обновлений безопасности — базовая настройка сервера."},
 {q:"Строка <code>0.0.0.0:6379</code> в <code>ss -tulpn</code> означает:",
  opts:["Служба недоступна","Служба принимает соединения со всех интерфейсов, то есть снаружи","Ошибку настройки сети","Служба остановлена"],
  a:1, why:"Каждая такая строка — вопрос: это точно должно быть открыто наружу?"}
],
labs:[
 {id:"11a", title:"Закрыть машину, не заперев себя",
  brief:"<p>На машине работают ssh, веб-сервер и база. Наружу должны смотреть только ssh и порт 80.</p><ul><li>посмотрите, кто что слушает;</li><li>разрешите ssh <b>до</b> включения экрана;</li><li>разрешите порт 80;</li><li>базе (5432) откройте доступ только из сети <code>10.0.0.0/8</code>;</li><li>включите экран и проверьте, что <code>ssh ubuntu@web-01</code> по-прежнему работает.</li></ul>",
  hint:"sudo ufw allow OpenSSH, потом allow 80, потом allow from 10.0.0.0/8 to any port 5432, и лишь затем enable.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    pkgs: {nginx: "1.18.0-6ubuntu14.4", postgresql: "14+238"},
    units: {"nginx.service": {desc: "A high performance web server", exec: "nginx: master process /usr/sbin/nginx",
                              port: 80, active: true, enabled: true, pid: 870, sub: "running"},
            "postgresql.service": {desc: "PostgreSQL RDBMS", exec: "/usr/lib/postgresql/14/bin/postgres",
                                   port: 5432, active: true, enabled: true, pid: 920, sub: "running"}}}),
  checks:[
   {label:"Слушающие порты осмотрены", test:st=>used(st, "ss") || used(st, "netstat")},
   {label:"Экран включён", test:st=>st.S.ufw.enabled},
   {label:"Правило для ssh есть", test:st=>ufwRule(st, 22)},
   {label:"Правило для ssh добавлено до включения экрана",
    test:st=>{
      const i = st.log.findIndex(e => /ufw\s+allow\s+(OpenSSH|22)/.test(e.cmd));
      const j = st.log.findIndex(e => /ufw\s+enable/.test(e.cmd));
      return i >= 0 && j >= 0 && i < j;
    }},
   {label:"Порт 80 открыт", test:st=>ufwRule(st, 80)},
   {label:"База открыта только из своей сети",
    test:st=>st.S.ufw.rules.some(r => String(r.port) === "5432" && r.action === "ALLOW" && /^10\.0\.0\.0/.test(r.from || ""))},
   {label:"Себя не заперли", test:st=>st.S.ufw.enabled && !st.S.lockedOut},
   {label:"Доступ по ssh проверен после включения", test:st=>logHas(st, /Welcome to Ubuntu/)}
  ]},
 {id:"11b", title:"Убрать лишнее правило",
  brief:"<p>Кто-то оставил открытым наружу порт базы данных. Приведите правила в порядок.</p><ul><li>посмотрите правила с номерами;</li><li>удалите правило, открывающее 5432 всем;</li><li>вместо него разрешите 5432 только из <code>10.0.0.0/8</code>;</li><li>поставьте <code>unattended-upgrades</code>, чтобы обновления безопасности ставились сами.</li></ul>",
  hint:"sudo ufw status numbered покажет номера. Удаление: sudo ufw delete N — номера сдвигаются после каждого удаления.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    ufw: {enabled: true, default: "deny",
          rules: [{port: 22, name: "OpenSSH", action: "ALLOW", from: "Anywhere"},
                  {port: 80, name: "80/tcp", action: "ALLOW", from: "Anywhere"},
                  {port: 5432, name: "5432/tcp", action: "ALLOW", from: "Anywhere"}]},
    after: S => { S.aptUpdated = true; }}),
  checks:[
   {label:"Правила просмотрены с номерами", test:st=>ran(st, /ufw\s+status\s+numbered/)},
   {label:"Открытого всем правила на 5432 больше нет",
    test:st=>!st.S.ufw.rules.some(r => String(r.port) === "5432" && (r.from || "Anywhere") === "Anywhere")},
   {label:"База доступна из внутренней сети",
    test:st=>st.S.ufw.rules.some(r => String(r.port) === "5432" && r.action === "ALLOW" && /^10\.0\.0\.0/.test(r.from || ""))},
   {label:"ssh и порт 80 не пострадали", test:st=>ran(st, /ufw\s+delete/) && ufwRule(st, 22) && ufwRule(st, 80)},
   {label:"Экран остался включённым", test:st=>ran(st, /ufw\s+delete/) && st.S.ufw.enabled},
   {label:"Автообновления безопасности установлены", test:st=>hasPkg(st, "unattended-upgrades")}
  ]}
],
iv:[
 {q:"Что нужно сделать перед включением ufw на удалённом сервере?",
  probe:"Вопрос-ловушка на осторожность.",
  a:"Разрешить ssh — до включения, а не после. У ufw политика по умолчанию «запретить всё входящее», поэтому <code>ufw enable</code> без правила на 22-й порт обрывает ваше собственное соединение в ту же секунду, и вернуться уже нечем: нужна консоль провайдера или поездка к машине. Правильная последовательность — <code>sudo ufw allow OpenSSH</code>, затем <code>sudo ufw status</code>, чтобы своими глазами увидеть правило, и только потом <code>enable</code>. Ubuntu показывает предупреждение, но его легко пролистать. И общая привычка: любую настройку, способную отрезать доступ, я делаю, не закрывая текущий сеанс, и проверяю в новом окне — то же самое и с ssh, и с сетью.",
  more:["Что делает ufw default deny incoming?","Как посмотреть правила с номерами?"]},
 {q:"Какие службы стоит закрывать от внешнего мира и как?",
  probe:"Проверяют, мыслите ли вы уровнями защиты.",
  a:"Я начинаю не с правил, а с <code>ss -tulpn</code>: каждая строка с <code>0.0.0.0</code> — служба, открытая наружу, и по каждой задаю вопрос, должна ли она такой быть. Обычно снаружи нужны только веб-сервер и ssh; базы, кеши, панели и метрики — нет. Дальше выбираю уровень. Лучший способ закрыть службу — вообще не выставлять её наружу: если база нужна приложению на той же машине, её привязывают к <code>127.0.0.1</code> в её собственных настройках, и тогда порта снаружи просто нет, никакое правило экрана не требуется. Если доступ нужен, но только из внутренней сети, — правило вида «разрешить 5432 из 10.0.0.0/8», а не «открыть 5432». Экран у меня второй рубеж, а не первый: он страхует от того, что служба однажды переедет на <code>0.0.0.0</code> при обновлении настроек.",
  more:["Почему привязка надёжнее правила экрана?","Зачем unattended-upgrades?"]}
]
},

/* ------------------------------------------------ 12 */
{
n:12, id:"cron", title:"Расписание и обслуживание", sub:"Что должно случаться само",
lede:"Последний раздел собирает всё вместе: регулярные задачи, резервные копии и разбор незнакомой машины — та работа, ради которой всё предыдущее и нужно.",
theory:`
<h2>cron: пять полей</h2>
<pre><code><span class="c2">┌─ минута (0–59)
│ ┌─ час (0–23)
│ │ ┌─ день месяца (1–31)
│ │ │ ┌─ месяц (1–12)
│ │ │ │ ┌─ день недели (0–7, 0 и 7 — воскресенье)
│ │ │ │ │</span>
  0 3 * * *  /usr/local/bin/backup.sh</code></pre>
<div class="tw"><table>
<tr><th>Запись</th><th>Когда</th></tr>
<tr><td><code>0 3 * * *</code></td><td>каждый день в 3:00</td></tr>
<tr><td><code>*/15 * * * *</code></td><td>каждые 15 минут</td></tr>
<tr><td><code>0 4 * * 0</code></td><td>по воскресеньям в 4:00</td></tr>
<tr><td><code>@reboot</code></td><td>один раз при загрузке</td></tr>
</table></div>
<div class="note trap"><b class="hd">Три причины, почему задача «не запускается»</b><ol><li><b>Пути.</b> У cron почти пустой <code>PATH</code>. Команда, работающая в вашей оболочке, у него не находится. Лекарство: всегда писать полные пути — <code>/usr/local/bin/backup.sh</code>, а не <code>backup.sh</code>.</li><li><b>Вывод.</b> По умолчанию он уходит письмом, которого никто не читает, — то есть в никуда. Лекарство: <code>&gt;&gt; /var/log/backup.log 2&gt;&amp;1</code> в конце строки.</li><li><b>Права.</b> Задача выполняется от владельца crontab, а не от root. Лекарство: <code>sudo crontab -e</code> для системных задач.</li></ol></div>

<h2>systemd timer: то же самое, но с журналом</h2>
<div class="tw"><table>
<tr><th></th><th>cron</th><th>systemd timer</th></tr>
<tr><td>Настройка</td><td>одна строка</td><td>два файла: <code>.timer</code> и <code>.service</code></td></tr>
<tr><td>Журнал</td><td>нужно настраивать самому</td><td><code>journalctl -u</code> из коробки</td></tr>
<tr><td>Пропущенный запуск</td><td>пропал</td><td><code>Persistent=true</code> догонит после включения</td></tr>
<tr><td>Когда брать</td><td>простое и привычное</td><td>когда важно видеть, чем кончилось</td></tr>
</table></div>
<pre><code>$ <span class="k">systemctl list-timers</span>       <span class="c2">← что и когда сработает</span></code></pre>

<h2>Резервная копия, которую не проверяли, — не копия</h2>
<p>Копия существует не тогда, когда она делается, а когда из неё удалось восстановиться. Три вопроса к любой схеме:</p>
<div class="tw"><table>
<tr><th>Вопрос</th><th>Плохой ответ</th></tr>
<tr><td>Что копируем?</td><td>«всё» — обычно значит, что данные службы не попали</td></tr>
<tr><td>Куда?</td><td>«на тот же диск» — авария диска уносит и копию</td></tr>
<tr><td>Когда восстанавливались в последний раз?</td><td>«ни разу»</td></tr>
</table></div>
<pre><code><span class="c2"># типовая строка: архив с датой в имени</span>
$ <span class="k">tar -czf /srv/backup/data-$(date +%F).tar.gz /var/lib/prilozhenie</span></code></pre>

<h2>Приём в наследство незнакомой машины</h2>
<div class="tw"><table>
<tr><th>Вопрос</th><th>Команда</th></tr>
<tr><td>Что за система и сколько работает</td><td><code>hostnamectl</code>, <code>uptime</code></td></tr>
<tr><td>Что вообще запущено</td><td><code>systemctl list-units --type=service</code></td></tr>
<tr><td>Что сломано</td><td><code>systemctl list-units --failed</code></td></tr>
<tr><td>Что смотрит наружу</td><td><code>ss -tulpn</code>, <code>ufw status</code></td></tr>
<tr><td>Кто может входить</td><td><code>getent passwd</code>, <code>/etc/ssh/sshd_config</code>, кто в группе sudo</td></tr>
<tr><td>Что запускается по расписанию</td><td><code>crontab -l</code>, <code>systemctl list-timers</code></td></tr>
<tr><td>Что ставили руками</td><td>файлы, которых нет в пакетах (<code>dpkg -S</code>)</td></tr>
<tr><td>Есть ли место и память</td><td><code>df -h</code>, <code>free -h</code></td></tr>
</table></div>
<div class="note ok"><b class="hd">Записывайте, что меняете</b><p>Полчаса на такой обход экономят дни. И заведите привычку: любое изменение на сервере — строка в общем журнале команды, с датой и причиной. Через полгода вы сами будете тем человеком, который спрашивает «а зачем это здесь».</p></div>
`,
quiz:[
 {q:"Что означает <code>*/15 * * * *</code>?",
  opts:["15-го числа каждого месяца","Каждые 15 минут","В 15:00 ежедневно","Каждые 15 часов"],
  a:1, why:"Звёздочка со слешем — «каждые N» для этого поля."},
 {q:"Задача в cron работает из оболочки, но не по расписанию. Самая частая причина?",
  opts:["Ошибка в расписании","У cron почти пустой PATH — нужны полные пути","Нет прав","cron не запущен"],
  a:1, why:"Поэтому в crontab пишут <code>/usr/local/bin/backup.sh</code>, а не <code>backup.sh</code>."},
 {q:"Куда по умолчанию уходит вывод задачи cron?",
  opts:["В journalctl","Письмом, которого никто не читает","В /var/log/cron.log","Никуда, теряется молча"],
  a:1, why:"Практически — в никуда. Поэтому вывод перенаправляют в файл: <code>&gt;&gt; файл 2&gt;&amp;1</code>."},
 {q:"Главное преимущество systemd timer перед cron:",
  opts:["Быстрее","Вывод сразу попадает в журнал, и пропущенный запуск можно догнать","Проще настроить","Работает без root"],
  a:1, why:"<code>journalctl -u</code> из коробки и <code>Persistent=true</code> для пропущенных запусков."},
 {q:"Когда резервная копия считается существующей?",
  opts:["Когда настроено расписание","Когда из неё успешно восстановились","Когда файл появился","Когда прошла без ошибок"],
  a:1, why:"Непроверенная копия регулярно оказывается пустой или неполной именно в тот день, когда понадобилась."},
 {q:"Приняли незнакомый сервер. Какая команда покажет, что на нём сломано прямо сейчас?",
  opts:["ps aux","systemctl list-units --failed","df -h","journalctl"],
  a:1, why:"Короткий список того, что systemd не смог поднять или что упало."}
],
labs:[
 {id:"12a", title:"Поставить резервное копирование на расписание",
  brief:"<p>Нужна ежедневная копия каталога <code>/var/lib/prilozhenie</code>.</p><ul><li>создайте <code>/usr/local/bin/backup.sh</code>, который делает <code>tar -czf /srv/backup/data.tar.gz /var/lib/prilozhenie</code>, и сделайте его исполняемым;</li><li>создайте каталог <code>/srv/backup</code>;</li><li>проверьте, что сценарий работает, запустив его руками;</li><li>положите в crontab строку на 3:00 ежедневно, с полным путём и перенаправлением вывода в <code>/var/log/backup.log</code>.</li></ul><p>Строку расписания подготовьте в файле и загрузите командой <code>crontab файл</code>.</p>",
  hint:"Строка: 0 3 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1",
  setup: () => newMachine({dirs: {"/var/lib/prilozhenie": {mode: 0o755}},
    files: {"/var/lib/prilozhenie/dannye.db": "данные\n"}}),
  checks:[
   {label:"Каталог для копий создан", test:st=>{const n = node(st, "/srv/backup"); return !!n && n.type === "d";}},
   {label:"Сценарий создан", test:st=>!!node(st, "/usr/local/bin/backup.sh")},
   {label:"Сценарий исполняемый", test:st=>bits(st, "/usr/local/bin/backup.sh", 0o100)},
   {label:"Сценарий проверен запуском", test:st=>okRan(st, /backup\.sh/)},
   {label:"Архив действительно создался", test:st=>!!node(st, "/srv/backup/data.tar.gz")},
   {label:"Расписание загружено в crontab", test:st=>!!node(st, "/var/spool/cron/crontabs/root")},
   {label:"Время задано верно — 3:00 ежедневно",
    test:st=>/^\s*0\s+3\s+\*\s+\*\s+\*/m.test(text(st, "/var/spool/cron/crontabs/root"))},
   {label:"Указан полный путь к сценарию",
    test:st=>/\/usr\/local\/bin\/backup\.sh/.test(text(st, "/var/spool/cron/crontabs/root"))},
   {label:"Вывод не теряется", test:st=>/>>?\s*\/var\/log\/backup\.log/.test(text(st, "/var/spool/cron/crontabs/root"))}
  ]},
 {id:"12b", title:"Принять машину в наследство",
  brief:"<p>Вам передали сервер без документации. Проведите обход и приведите очевидное в порядок.</p><ul><li>выясните, что запущено и что упало;</li><li>упавшую службу <code>otchety</code> нужно просто запустить — причина отказа устранена до вас;</li><li>посмотрите, что смотрит наружу; лишний открытый порт 6379 закройте, удалив правило;</li><li>найдите, что стоит в расписании, и запишите вывод <code>crontab -l</code> в <code>/home/ubuntu/rasporyadok.txt</code>;</li><li>проверьте место и память.</li></ul>",
  hint:"systemctl list-units --failed, ss -tulpn, ufw status numbered, crontab -l > /home/ubuntu/rasporyadok.txt.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    units: {"otchety.service": {desc: "Сборка отчётов", exec: "/usr/local/bin/otchety", enabled: true,
                                failed: true, sub: "failed", result: "exit-code"},
            "nginx.service": {desc: "A high performance web server", exec: "nginx: master process /usr/sbin/nginx",
                              port: 80, active: true, enabled: true, pid: 870, sub: "running"}},
    ufw: {enabled: true, default: "deny",
          rules: [{port: 22, name: "OpenSSH", action: "ALLOW", from: "Anywhere"},
                  {port: 80, name: "80/tcp", action: "ALLOW", from: "Anywhere"},
                  {port: 6379, name: "6379/tcp", action: "ALLOW", from: "Anywhere"}]},
    files: {"/var/spool/cron/crontabs/root":
              {text: "0 3 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1\n*/10 * * * * /usr/local/bin/proverka.sh\n", mode: 0o600}},
    journal: [{t: 0, unit: "otchety.service", prio: 3, msg: "otchety.service: Failed with result 'exit-code'.", boot: 1}]}),
  checks:[
   {label:"Список упавших служб получен", test:st=>ran(st, /systemctl\s+list-units.*failed/) || ran(st, /systemctl\s+status\s+otchety/)},
   {label:"Упавшая служба поднята", test:st=>isActive(st, "otchety")},
   {label:"Открытые порты осмотрены", test:st=>used(st, "ss") || ran(st, /ufw\s+status/)},
   {label:"Лишнее правило на 6379 удалено", test:st=>!ufwRule(st, 6379)},
   {label:"Нужные правила не задеты", test:st=>ran(st, /ufw\s+delete/) && ufwRule(st, 22) && ufwRule(st, 80)},
   {label:"Расписание выписано в файл", test:st=>/backup\.sh/.test(text(st, "/home/ubuntu/rasporyadok.txt"))},
   {label:"В выписке обе задачи", test:st=>/proverka\.sh/.test(text(st, "/home/ubuntu/rasporyadok.txt"))},
   {label:"Место и память проверены", test:st=>used(st, "df") && used(st, "free")}
  ]}
],
iv:[
 {q:"Задача в cron не выполняется, хотя вручную команда работает. Причины?",
  probe:"Классика. Ждут PATH первым.",
  a:"Первая и самая частая — окружение. У cron почти пустой <code>PATH</code> и нет ничего из вашего <code>.bashrc</code>, поэтому команда, которая прекрасно находится в вашей оболочке, у него не находится вовсе. Лечится тем, что в crontab пишут полные пути ко всему. Вторая — вывод: по умолчанию он уходит письмом, которого на сервере обычно никто не получает, то есть ошибка происходит и исчезает бесследно; поэтому я всегда добавляю <code>&gt;&gt; /var/log/имя.log 2&gt;&amp;1</code> и первым делом смотрю туда. Третья — от кого выполняется: пользовательский crontab работает от этого пользователя, и если задача трогает системные файлы, ей не хватит прав. Четвёртая, менее очевидная, — <code>%</code> в строке crontab имеет особое значение и его нужно экранировать; на этом спотыкаются, когда в команде есть <code>date +%F</code>.",
  more:["Почему systemd timer в этом смысле удобнее?","Как проверить, что задача вообще запускалась?"]},
 {q:"Вам передали сервер без документации. Что сделаете в первый час?",
  probe:"Итоговый вопрос. Ждут систематический обход, а не набор команд.",
  a:"Я делаю обход по одним и тем же вопросам и всё записываю, потому что вторым делом эту запись придётся кому-то передать. Что за машина и сколько работает — <code>hostnamectl</code>, <code>uptime</code>. Что запущено и что сломано — <code>systemctl list-units --type=service</code> и отдельно <code>--failed</code>. Что смотрит наружу — <code>ss -tulpn</code> плюс <code>ufw status</code>; каждая строка с <code>0.0.0.0</code> получает вопрос «это должно быть открыто?». Кто может войти — кто состоит в группе sudo, что в <code>sshd_config</code>, разрешены ли пароли. Что происходит само — <code>crontab -l</code>, <code>systemctl list-timers</code>. Есть ли запас — <code>df -h</code> и <code>free -h</code>. И отдельно, что мне интереснее всего: что ставили руками. Файл, которого нет ни в одном пакете, — это либо чья-то недокументированная настройка, либо след постороннего, и в обоих случаях об этом надо узнать раньше, чем оно себя проявит. Ничего в первый час я не меняю, кроме очевидно упавшего.",
  more:["Как найти файлы, положенные в обход пакетов?","С чего начнёте, если машина при этом ещё и тормозит?"]}
]
}

];
