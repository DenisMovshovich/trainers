
/* ------------------------------------------------ 4 */
{
n:4, id:"apt", title:"Пакеты: apt и dpkg", sub:"Откуда на машине берётся софт",
lede:"Программы на сервере не скачивают с сайтов. Их берут из репозиториев — подписанных хранилищ, за содержимым которых кто-то следит. Понимание разницы между apt и dpkg объясняет, почему «просто поставить пакет» иногда не работает.",
theory:`
<h2>Два уровня</h2>
<div class="tw"><table>
<tr><th></th><th><code>dpkg</code></th><th><code>apt</code></th></tr>
<tr><td>Что умеет</td><td>распаковать один <code>.deb</code></td><td>найти пакет, скачать, поставить зависимости</td></tr>
<tr><td>Знает про репозитории</td><td>нет</td><td>да</td></tr>
<tr><td>Разрешает зависимости</td><td>нет — только жалуется</td><td>да</td></tr>
<tr><td>Когда нужен</td><td>чтобы посмотреть, что уже стоит</td><td>во всех остальных случаях</td></tr>
</table></div>
<p>Правило простое: ставите — <code>apt</code>; выясняете, откуда взялся файл, — <code>dpkg</code>.</p>

<h2>update и upgrade — разные вещи</h2>
<div class="tw"><table>
<tr><th>Команда</th><th>Что делает</th></tr>
<tr><td><code>apt update</code></td><td>обновляет <b>список</b> доступных пакетов. Ничего не ставит</td></tr>
<tr><td><code>apt upgrade</code></td><td>обновляет установленные пакеты до версий из этого списка</td></tr>
<tr><td><code>apt full-upgrade</code></td><td>то же, но разрешает удалять пакеты ради разрешения зависимостей</td></tr>
</table></div>
<div class="note trap"><b class="hd">Почему «пакет не найден» сразу после установки системы</b><pre><code>$ <span class="k">sudo apt install nginx</span>
<span class="c">E: Unable to locate package nginx</span></code></pre><p>Список пакетов пуст или устарел — машина просто не знает, что такой пакет бывает. Лечится <code>sudo apt update</code>. Поэтому эти две команды почти всегда пишут вместе.</p></div>

<h2>remove, purge, autoremove</h2>
<div class="tw"><table>
<tr><th>Команда</th><th>Программа</th><th>Настройки в <code>/etc</code></th><th>Данные</th></tr>
<tr><td><code>apt remove</code></td><td>убирает</td><td>оставляет</td><td>оставляет</td></tr>
<tr><td><code>apt purge</code></td><td>убирает</td><td>убирает</td><td>оставляет</td></tr>
<tr><td><code>apt autoremove</code></td><td colspan="3">убирает зависимости, которые больше никому не нужны</td></tr>
</table></div>
<p>Разница важна на практике: переустанавливаете сломанную службу — нужен <code>purge</code>, иначе старая настройка вернётся и вы будете чинить то же самое второй раз. Освобождаете место — <code>autoremove</code>.</p>

<h2>Что установка приносит с собой</h2>
<pre><code>$ <span class="k">sudo apt install nginx</span>
<span class="q">The following NEW packages will be installed:
  nginx-common nginx</span>                                <span class="c2">← зависимость подтянулась сама</span>
<span class="q">Setting up nginx (1.18.0) ...</span>
<span class="q">Created symlink /etc/systemd/system/multi-user.target.wants/nginx.service → ...</span></code></pre>
<p>Обратите внимание на последнюю строку: пакет не только положил файлы, но и <b>включил и запустил службу</b>. Так устроены пакеты в Debian и Ubuntu — служба начинает работать сразу после установки. Проверить: <code>systemctl status nginx</code> и <code>ss -tulpn</code>.</p>

<h2>Расследование: откуда взялся этот файл</h2>
<pre><code>$ <span class="k">dpkg -S /etc/nginx/nginx.conf</span>       <span class="c2">← какой пакет его принёс</span>
<span class="q">nginx: /etc/nginx/nginx.conf</span>
$ <span class="k">dpkg -L nginx</span>                        <span class="c2">← что вообще принёс этот пакет</span>
$ <span class="k">dpkg -l | grep nginx</span>                 <span class="c2">← какие версии стоят</span>
$ <span class="k">apt policy nginx</span>                     <span class="c2">← что стоит и что доступно</span></code></pre>
<div class="note ok"><b class="hd">Файл, которого нет ни в одном пакете</b><p>Если <code>dpkg -S</code> ничего не нашёл — файл положили руками. На чужой машине это первая зацепка: значит, кто-то что-то делал в обход пакетов, и об этом стоит узнать подробнее.</p></div>

<h2>Обновления безопасности</h2>
<p>Отдельный репозиторий <code>jammy-security</code> отдаёт только исправления уязвимостей. Пакет <code>unattended-upgrades</code> ставит их сам, без участия человека, — на сервере это разумная настройка по умолчанию. Обычные обновления при этом можно оставить ручными, чтобы служба не перезапустилась в неподходящий момент.</p>
`,
quiz:[
 {q:"<code>apt update</code> — что делает?",
  opts:["Обновляет установленные пакеты","Обновляет список доступных пакетов","Ставит обновления безопасности","Перезагружает службы"],
  a:1, why:"Ничего не ставит. Обновляет пакеты <code>apt upgrade</code>."},
 {q:"«E: Unable to locate package» сразу после установки системы. Первое действие?",
  opts:["Добавить сторонний репозиторий","Выполнить sudo apt update","Скачать .deb вручную","Проверить сеть"],
  a:1, why:"Список пакетов пуст — машина не знает, что такой пакет существует."},
 {q:"Переустанавливаете службу и хотите начать с чистых настроек. Что нужно?",
  opts:["apt remove","apt purge","apt autoremove","dpkg -r"],
  a:1, why:"<code>remove</code> оставляет файлы в <code>/etc</code>, и старая настройка вернётся."},
 {q:"Чем dpkg принципиально отличается от apt?",
  opts:["dpkg новее","dpkg ставит один файл и не умеет зависимости и репозитории","dpkg только для root","Разницы нет"],
  a:1, why:"apt — надстройка, которая знает про репозитории и зависимости; dpkg работает с одним <code>.deb</code>."},
 {q:"Как узнать, какой пакет положил файл <code>/etc/nginx/nginx.conf</code>?",
  opts:["apt search nginx","dpkg -S /etc/nginx/nginx.conf","dpkg -L nginx","find / -name nginx.conf"],
  a:1, why:"<code>-S</code> ищет по файлу, <code>-L</code> — наоборот, показывает файлы пакета."},
 {q:"После <code>apt install nginx</code> служба:",
  opts:["Требует ручного запуска","Уже включена и работает","Запустится после перезагрузки","Требует systemctl daemon-reload"],
  a:1, why:"Пакеты Debian и Ubuntu включают и запускают службу сразу — это их отличие от многих других систем."}
],
labs:[
 {id:"4a", title:"Поставить веб-сервер и убедиться, что он работает",
  brief:"<p>На чистой машине нужно поднять nginx.</p><ul><li>обновите список пакетов и установите <code>nginx</code>;</li><li>убедитесь, что служба работает и включена в автозапуск;</li><li>проверьте, что кто-то действительно слушает порт 80;</li><li>выясните, какой пакет принёс файл <code>/etc/nginx/nginx.conf</code>.</li></ul><p>Начните с попытки установить пакет без <code>apt update</code> — посмотрите, что ответит система.</p>",
  hint:"sudo apt update, потом sudo apt install nginx. Проверки: systemctl status nginx, ss -tulpn, dpkg -S.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}}),
  checks:[
   {label:"Список пакетов обновлён", test:st=>st.S.aptUpdated},
   {label:"nginx установлен", test:st=>hasPkg(st, "nginx")},
   {label:"Зависимость nginx-common подтянулась", test:st=>hasPkg(st, "nginx-common")},
   {label:"Служба работает", test:st=>isActive(st, "nginx")},
   {label:"Порт 80 занят службой", test:st=>listens(st, 80)},
   {label:"Кто слушает порт — проверено", test:st=>used(st, "ss") || used(st, "netstat")},
   {label:"Найдено, каким пакетом положен nginx.conf", test:st=>logHas(st, /nginx: \/etc\/nginx\/nginx\.conf/)}
  ]},
 {id:"4b", title:"Чистая переустановка сломанной службы",
  brief:"<p>У <code>nginx</code> испорчен файл настроек, и правки его не спасают: нужно вернуть заводское состояние.</p><ul><li>убедитесь, что в <code>/etc/nginx/nginx.conf</code> действительно мусор;</li><li>удалите пакет так, чтобы его настройки тоже исчезли;</li><li>поставьте заново;</li><li>проверьте, что в <code>nginx.conf</code> снова заводское содержимое (в нём должно быть <code>worker_processes</code>) и служба работает.</li></ul><p>Обычного <code>apt remove</code> здесь не хватит — подумайте, почему.</p>",
  hint:"apt purge убирает и настройки. После установки проверьте cat /etc/nginx/nginx.conf.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    pkgs: {nginx: "1.18.0-6ubuntu14.4", "nginx-common": "1.18.0-6ubuntu14.4"},
    units: {"nginx.service": {desc: "A high performance web server", exec: "nginx: master process /usr/sbin/nginx",
                              port: 80, active: true, enabled: true, pid: 870, sub: "running"}},
    files: {"/etc/nginx/nginx.conf": "тут был мусор ;;;\n"},
    after: S => { S.aptUpdated = true; }}),
  checks:[
   {label:"Испорченный файл прочитан", test:st=>used(st, "cat") || used(st, "less") || used(st, "grep")},
   {label:"Пакет удалён с настройками", test:st=>ran(st, /apt\s+(-y\s+)?purge/)},
   {label:"nginx снова установлен", test:st=>ran(st, /apt(-get)?\s+(-y\s+)?purge/) && hasPkg(st, "nginx")},
   {label:"Настройка вернулась к заводской", test:st=>/worker_processes/.test(text(st, "/etc/nginx/nginx.conf"))},
   {label:"Мусора в файле не осталось", test:st=>!/мусор/.test(text(st, "/etc/nginx/nginx.conf"))},
   {label:"Служба снова работает после переустановки",
    test:st=>ran(st, /apt(-get)?\s+(-y\s+)?purge/) && isActive(st, "nginx")}
  ]}
],
iv:[
 {q:"В чём разница между apt remove и apt purge и когда это имеет значение?",
  probe:"Короткий вопрос, по ответу видно, сталкивался ли человек с последствиями.",
  a:"<code>remove</code> убирает программу, но оставляет файлы настроек в <code>/etc</code>; <code>purge</code> убирает и их. Значение это имеет ровно в одном частом случае — когда службу переустанавливают, потому что она сломалась из-за настройки. После <code>remove</code> и повторной установки старый файл остаётся на месте, служба ломается снова, и человек делает вывод, что переустановка не помогает. Второй случай — когда пакет уходит навсегда: <code>purge</code> плюс <code>autoremove</code> оставляют систему чистой. Замечу, что данные, скажем базы, не трогает ни то ни другое: они лежат в <code>/var/lib</code> и удаляются руками.",
  more:["Что делает autoremove?","Где искать данные удалённой службы?"]},
 {q:"Как проверить, что подозрительный файл на сервере пришёл из пакета, а не положен руками?",
  probe:"Практический вопрос на расследование.",
  a:"<code>dpkg -S путь</code> отвечает, какому пакету принадлежит файл. Если ответ «no path found matching pattern» — файла нет ни в одном установленном пакете, то есть его положили в обход. Это уже само по себе сигнал: либо кто-то настраивал руками и не записал, либо это следы постороннего вмешательства. Дальше я бы посмотрел <code>ls -l</code> — владельца и время изменения, сравнил бы время с записями в <code>/var/log/auth.log</code>, кто в этот момент входил. И в обратную сторону полезно: <code>dpkg -L пакет</code> показывает всё, что пакет принёс, — так проверяют, не подменили ли что-то из его файлов.",
  more:["Что ещё в /var/log поможет в таком расследовании?"]}
]
},

/* ------------------------------------------------ 5 */
{
n:5, id:"systemd", title:"systemd: службы", sub:"Что работает, почему упало и как поднимать при загрузке",
lede:"systemd — то, что запускает всё на машине и следит, чтобы оно работало. Половина вопросов на собеседовании про Linux сводится к одному: понимаете ли вы разницу между start и enable.",
theory:`
<h2>Unit — описание того, чем управляют</h2>
<pre><code><span class="c2"># /etc/systemd/system/myapp.service</span>
[Unit]
Description=Моё приложение
After=network.target                <span class="c2">← запускать после того, как поднялась сеть</span>

[Service]
User=prilozhenie                    <span class="c2">← от кого работать, не от root</span>
ExecStart=/usr/local/bin/myapp
Restart=on-failure                  <span class="c2">← поднимать, если упало с ошибкой</span>

[Install]
WantedBy=multi-user.target          <span class="c2">← куда включать при enable</span></code></pre>
<div class="note trap"><b class="hd">Положили файл — сделайте daemon-reload</b><p>systemd читает unit-файлы в память. Пока вы не выполнили <code>sudo systemctl daemon-reload</code>, новый файл для него не существует, и <code>systemctl start</code> ответит «Unit not found». Ровно то же после каждой правки существующего unit-файла.</p></div>

<h2>start и enable отвечают на разные вопросы</h2>
<div class="tw"><table>
<tr><th>Команда</th><th>Отвечает на вопрос</th><th>Действует</th></tr>
<tr><td><code>systemctl start</code></td><td>работает ли сейчас?</td><td>до перезагрузки</td></tr>
<tr><td><code>systemctl enable</code></td><td>поднимется ли при загрузке?</td><td>после перезагрузки</td></tr>
<tr><td><code>systemctl enable --now</code></td><td>и то и другое</td><td>сразу и постоянно</td></tr>
</table></div>
<p>Их путают в обе стороны, и обе ошибки дорогие. Забыли <code>enable</code> — служба поднята, всё работает, а после ближайшей перезагрузки машина приходит без неё, обычно ночью. Забыли <code>start</code> — «я же включил», а служба не работает до перезагрузки. Проверять двумя командами:</p>
<pre><code>$ <span class="k">systemctl is-active myapp</span>    <span class="q">active</span>     <span class="c2">← работает сейчас</span>
$ <span class="k">systemctl is-enabled myapp</span>   <span class="q">enabled</span>    <span class="c2">← поднимется при загрузке</span></code></pre>

<h2>status: что читать в выводе</h2>
<pre><code>$ <span class="k">systemctl status nginx</span>
<span class="q">● nginx.service - A high performance web server</span>
<span class="q">     Loaded: loaded (/lib/systemd/system/nginx.service; <span class="k">enabled</span>; preset: enabled)</span>
<span class="q">     Active: <span class="k">active (running)</span> since Sep  3 09:12; 5min ago</span>
<span class="q">   Main PID: 870 (nginx)</span></code></pre>
<div class="tw"><table>
<tr><th>Что видно</th><th>Где смотреть</th></tr>
<tr><td>Работает ли</td><td>строка <code>Active</code>: <code>active (running)</code>, <code>inactive (dead)</code> или <code>failed</code></td></tr>
<tr><td>Поднимется ли при загрузке</td><td>слово <code>enabled</code> или <code>disabled</code> в строке <code>Loaded</code></td></tr>
<tr><td>Почему упала</td><td>последние строки журнала прямо в выводе status</td></tr>
</table></div>
<p>Кружок слева — быстрый признак: <code>●</code> работает, <code>○</code> остановлена, <code>×</code> упала.</p>

<h2>Служба не запускается: порядок разбора</h2>
<div class="tw"><table>
<tr><th>Шаг</th><th>Команда</th><th>Что ищем</th></tr>
<tr><td>1</td><td><code>systemctl status имя</code></td><td>строку <code>Active: failed</code> и причину под ней</td></tr>
<tr><td>2</td><td><code>journalctl -u имя -n 50</code></td><td>что писала сама программа перед смертью</td></tr>
<tr><td>3</td><td><code>ss -tulpn</code></td><td>не занят ли порт кем-то другим</td></tr>
<tr><td>4</td><td><code>systemctl cat имя</code></td><td>что вообще запускается — путь в <code>ExecStart</code></td></tr>
</table></div>
<p>Самая частая причина — <code>Address already in use</code>: старый процесс не умер или порт занял сосед. Вторая по частоте — <code>ExecStart</code> указывает на файл, которого нет или который не помечен исполняемым.</p>

<h2>Restart: когда поднимать заново</h2>
<div class="tw"><table>
<tr><th>Значение</th><th>Когда перезапускать</th></tr>
<tr><td><code>no</code></td><td>никогда (по умолчанию)</td></tr>
<tr><td><code>on-failure</code></td><td>если завершилась с ошибкой — разумный выбор для служб</td></tr>
<tr><td><code>always</code></td><td>всегда, даже после нормального выхода</td></tr>
</table></div>
<div class="note warn"><b class="hd">Перезапуск не лечит причину</b><p><code>Restart=always</code> на службе, падающей раз в минуту, превращает отказ в незаметную деградацию: снаружи работает, в журнале сотни перезапусков. Смотреть надо в <code>journalctl</code>, а не на строку <code>Active</code>.</p></div>
`,
quiz:[
 {q:"Чем <code>systemctl enable</code> отличается от <code>start</code>?",
  opts:["Ничем","enable включает автозапуск при загрузке, start запускает сейчас","enable требует root","start работает только для systemd"],
  a:1, why:"Разные вопросы: «работает сейчас» и «поднимется после перезагрузки». Обе нужны, иначе служба пропадёт после ребута."},
 {q:"Положили свой unit-файл в /etc/systemd/system, а systemctl start отвечает «Unit not found». Что забыли?",
  opts:["Перезагрузку","systemctl daemon-reload","chmod +x на файл","enable"],
  a:1, why:"systemd держит unit-файлы в памяти и не перечитывает их сам."},
 {q:"Служба упала. С чего начинать разбор?",
  opts:["Перезапустить и надеяться","systemctl status, затем journalctl -u","Перезагрузить машину","Переустановить пакет"],
  a:1, why:"status показывает состояние и последние строки журнала; journalctl — что писала сама программа."},
 {q:"«Job for nginx.service failed... Address already in use». Что проверить?",
  opts:["Место на диске","Кто ещё слушает этот порт: ss -tulpn","Права на /etc/nginx","Версию пакета"],
  a:1, why:"Порт занят другим процессом — либо старым экземпляром, либо соседней службой."},
 {q:"<code>Restart=always</code> на постоянно падающей службе приводит к тому, что:",
  opts:["Проблема решена","Отказ маскируется: снаружи работает, в журнале сотни перезапусков","Служба отключится","systemd пришлёт письмо"],
  a:1, why:"Строка Active перестаёт быть признаком здоровья — смотреть надо в журнал."},
 {q:"Зачем в unit-файле директива <code>User=</code>?",
  opts:["Для журнала","Чтобы служба работала не от root, а от отдельной учётки","Для автозапуска","Для прав на файл"],
  a:1, why:"Ограничение последствий: дыра в службе даёт права этой учётки, а не всей машины."}
],
labs:[
 {id:"5a", title:"Свой unit-файл от начала до конца",
  brief:"<p>В <code>/usr/local/bin/svodka</code> лежит готовая программа. Оформите её как службу.</p><ul><li>создайте <code>/etc/systemd/system/svodka.service</code> с описанием, <code>ExecStart=/usr/local/bin/svodka</code>, <code>User=svodka</code>, <code>Restart=on-failure</code> и <code>WantedBy=multi-user.target</code>;</li><li>заведите служебную учётку <code>svodka</code> с <code>nologin</code>;</li><li>дайте systemd прочитать новый файл;</li><li>добейтесь, чтобы служба работала <b>и</b> поднималась при загрузке.</li></ul>",
  hint:"Файл пишется через tee. После этого — daemon-reload, затем enable --now. Проверка: is-active и is-enabled.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    files: {"/usr/local/bin/svodka": {text: "#!/bin/bash\necho сводка собрана\n", mode: 0o755}},
    after: S => { S.daemonReloaded = false; }}),
  checks:[
   {label:"Учётка svodka заведена", test:st=>hasUser(st, "svodka")},
   {label:"Ей закрыт вход", test:st=>/nologin/.test((st.S.users.svodka || {}).shell || "")},
   {label:"Unit-файл создан", test:st=>!!node(st, "/etc/systemd/system/svodka.service")},
   {label:"В нём указан ExecStart", test:st=>/ExecStart\s*=\s*\/usr\/local\/bin\/svodka/.test(text(st, "/etc/systemd/system/svodka.service"))},
   {label:"Служба работает не от root", test:st=>/^\s*User\s*=\s*svodka/m.test(text(st, "/etc/systemd/system/svodka.service"))},
   {label:"Задан перезапуск при отказе", test:st=>/Restart\s*=\s*(on-failure|always)/.test(text(st, "/etc/systemd/system/svodka.service"))},
   {label:"systemd перечитал файлы", test:st=>ran(st, /systemctl\s+daemon-reload/)},
   {label:"Служба работает сейчас", test:st=>isActive(st, "svodka")},
   {label:"Служба поднимется при загрузке", test:st=>isEnabled(st, "svodka")}
  ]},
 {id:"5b", title:"Служба не поднимается — найти причину",
  brief:"<p><code>api.service</code> отказывается запускаться. Разберитесь и почините.</p><ul><li>посмотрите состояние и журнал службы — там названа причина;</li><li>выясните, кто занял нужный порт;</li><li>освободите порт, остановив мешающую службу и <b>отключив</b> её автозапуск, чтобы она не вернулась после перезагрузки;</li><li>запустите <code>api</code> и убедитесь, что она работает.</li></ul>",
  hint:"journalctl -u api покажет причину, ss -tulpn — кто занял порт. Отключить автозапуск: systemctl disable.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    units: {"api.service": {desc: "API", exec: "/usr/local/bin/api", port: 8080, restart: "on-failure"},
            "staryj-api.service": {desc: "Old API", exec: "/usr/local/bin/staryj-api", port: 8080,
                                   active: true, enabled: true, pid: 890, sub: "running"}},
    after: S => { S.ports[8080] = "staryj-api.service"; syncProcs(S); }}),
  checks:[
   {label:"Состояние службы посмотрели", test:st=>ran(st, /systemctl\s+status\s+api/)},
   {label:"Журнал службы прочитан", test:st=>ran(st, /journalctl.*(-u\s*api|api)/)},
   {label:"Причина увидена в журнале", test:st=>logHas(st, /Address already in use/)},
   {label:"Порт проверен", test:st=>used(st, "ss") || used(st, "netstat")},
   {label:"Мешавшая служба остановлена", test:st=>!isActive(st, "staryj-api")},
   {label:"Её автозапуск отключён", test:st=>!isEnabled(st, "staryj-api")},
   {label:"api работает", test:st=>isActive(st, "api")},
   {label:"Порт 8080 теперь за api", test:st=>st.S.ports[8080] === "api.service"}
  ]}
],
iv:[
 {q:"В чём разница между systemctl start и systemctl enable?",
  probe:"Самый частый вопрос про systemd. Ответ «одно сейчас, другое потом» — минимум; ждут последствий.",
  a:"<code>start</code> запускает службу прямо сейчас и действует до перезагрузки. <code>enable</code> ничего не запускает — он создаёт ссылку в целевом каталоге, чтобы служба поднялась при следующей загрузке. Обе ошибки встречаются, и обе неприятны по-своему. Забыли <code>enable</code>: всё работает, тесты проходят, машину перезагружают через месяц — и служба не поднимается, причём разбираются с этим обычно ночью и не те люди, которые настраивали. Забыли <code>start</code>: человек уверен, что включил, а служба не работает. Поэтому я проверяю двумя командами — <code>is-active</code> и <code>is-enabled</code>, а ставлю обычно <code>enable --now</code>, который делает и то и другое.",
  more:["Что именно делает enable в файловой системе?","Как проверить, что переживёт перезагрузку?"]},
 {q:"Служба падает сразу после запуска. Ваши действия?",
  probe:"Проверяют порядок, а не догадливость.",
  a:"Сначала <code>systemctl status имя</code>: он показывает и состояние, и последние строки журнала — часто причина видна сразу. Если нет, <code>journalctl -u имя -n 50</code>, а лучше <code>-xe</code>: там уже сообщения самой программы, а не systemd. Дальше по типовым причинам. <code>Address already in use</code> — смотрю <code>ss -tulpn</code>, кто держит порт; часто это не умерший старый экземпляр. <code>status=203/EXEC</code> — путь в <code>ExecStart</code> неверен или файл не исполняемый, проверяю <code>systemctl cat</code> и <code>ls -l</code>. Отказ по правам — служба работает от <code>User=</code> и не имеет доступа к своим же файлам. И отдельно: если правили unit-файл, но не сделали <code>daemon-reload</code>, systemd запускает старую версию, и человек чинит то, что уже починил.",
  more:["Что означает код 203/EXEC?","Зачем journalctl -xe, а не просто -e?"]}
]
},

/* ------------------------------------------------ 6 */
{
n:6, id:"logs", title:"Журналы", sub:"Где написано, что случилось",
lede:"Сервер всё про себя рассказывает — вопрос только в том, умеете ли вы это прочитать. journalctl отвечает на вопрос «что было», а умение сузить выборку отличает пятиминутный разбор от двухчасового.",
theory:`
<h2>Два места, где лежат записи</h2>
<div class="tw"><table>
<tr><th></th><th>journald</th><th><code>/var/log/*</code></th></tr>
<tr><td>Кто пишет</td><td>всё, что запущено через systemd</td><td>программы, пишущие в файлы сами</td></tr>
<tr><td>Чем читать</td><td><code>journalctl</code></td><td><code>less</code>, <code>tail</code>, <code>grep</code></td></tr>
<tr><td>Формат</td><td>двоичный, с полями</td><td>текст</td></tr>
<tr><td>Примеры</td><td>любая служба systemd</td><td><code>auth.log</code>, <code>syslog</code>, журналы nginx</td></tr>
</table></div>
<p>Начинают всегда с <code>journalctl</code>: там больше всего и там удобнее фильтровать. В <code>/var/log</code> идут за тем, чего в journald нет, — прежде всего за журналами доступа веб-сервера.</p>

<h2>Четыре ключа, которых хватает почти всегда</h2>
<div class="tw"><table>
<tr><th>Ключ</th><th>Что делает</th><th>Когда</th></tr>
<tr><td><code>-u имя</code></td><td>только эта служба</td><td>всегда, когда знаете, что смотреть</td></tr>
<tr><td><code>-b</code></td><td>только с последней загрузки</td><td>«машину перезагрузили — что было потом»</td></tr>
<tr><td><code>-p err</code></td><td>только ошибки и хуже</td><td>первый заход на незнакомую проблему</td></tr>
<tr><td><code>-f</code></td><td>показывать новое по мере появления</td><td>воспроизводите проблему прямо сейчас</td></tr>
</table></div>
<pre><code>$ <span class="k">journalctl -u nginx -n 50</span>          <span class="c2">← последние 50 строк одной службы</span>
$ <span class="k">journalctl -p err -b</span>                <span class="c2">← все ошибки с последней загрузки</span>
$ <span class="k">journalctl -u api --since "10:00"</span>   <span class="c2">← с указанного времени</span>
$ <span class="k">journalctl -f -u api</span>               <span class="c2">← следить в реальном времени</span></code></pre>
<p>Ключи складываются: <code>journalctl -u api -p err -b</code> — ошибки одной службы с последней загрузки. Это и есть рабочий приём: сужать, пока не останется десяток строк.</p>

<h2>Уровни важности</h2>
<div class="tw"><table>
<tr><th>Номер</th><th>Имя</th><th>Что это</th></tr>
<tr><td>0–2</td><td>emerg, alert, crit</td><td>система в беде</td></tr>
<tr><td>3</td><td>err</td><td>ошибка — то, что ищут в первую очередь</td></tr>
<tr><td>4</td><td>warning</td><td>подозрительно, но работает</td></tr>
<tr><td>6</td><td>info</td><td>обычная жизнь службы</td></tr>
<tr><td>7</td><td>debug</td><td>подробности, обычно выключены</td></tr>
</table></div>
<p><code>-p err</code> означает «err и всё, что важнее», то есть уровни 0–3. Это правильный первый фильтр: он выкидывает 95% шума.</p>

<h2>Что читать в /var/log</h2>
<div class="tw"><table>
<tr><th>Файл</th><th>Что там</th></tr>
<tr><td><code>auth.log</code></td><td>входы, попытки входа, каждое обращение к sudo</td></tr>
<tr><td><code>syslog</code></td><td>общий поток системных сообщений</td></tr>
<tr><td><code>dpkg.log</code></td><td>что и когда ставили или удаляли</td></tr>
<tr><td><code>nginx/access.log</code></td><td>запросы к сайту</td></tr>
</table></div>
<pre><code><span class="c2"># кто пользовался sudo и для чего</span>
$ <span class="k">grep sudo /var/log/auth.log</span>
<span class="q">Sep  3 09:14:02 web-01 sudo:  ubuntu : TTY=pts/0 ; PWD=/home/ubuntu ; USER=root ; COMMAND=/usr/bin/apt update</span></code></pre>
<div class="note ok"><b class="hd">Связка из трёх команд</b><p><code>grep</code> сужает по строке, <code>tail -n</code> берёт свежее, <code>wc -l</code> считает. «Сколько было отказов входа» — это <code>grep "Failed password" /var/log/auth.log | wc -l</code>, и ответ получается за секунду.</p></div>

<h2>Место под журналы кончается</h2>
<p>Журналы растут. За текстовыми файлами следит <code>logrotate</code>: раз в сутки переименовывает, сжимает, старое удаляет. За journald — настройка <code>SystemMaxUse</code>: по умолчанию он занимает до 10% раздела и подчищает себя сам.</p>
<div class="note warn"><b class="hd">Классическая авария</b><p>Диск заполнен, <code>df -h</code> показывает 100%, служба не пишет и падает. Первый подозреваемый — журнал, который кто-то настроил писать в файл в обход logrotate. Найти: <code>du -sh /var/log/*</code>. Именно поэтому <code>df -h</code> входит в первые четыре команды при входе на машину.</p></div>
`,
quiz:[
 {q:"Что показывает <code>journalctl -p err -b</code>?",
  opts:["Все записи","Ошибки и важнее с последней загрузки","Только предупреждения","Журнал одной службы"],
  a:1, why:"<code>-p err</code> — уровни 0–3, <code>-b</code> — с последней загрузки. Хороший первый фильтр."},
 {q:"Где посмотреть, кто и когда пользовался sudo?",
  opts:["/var/log/syslog","/var/log/auth.log","journalctl -u sudo","/etc/sudoers"],
  a:1, why:"Каждое обращение к sudo записывается туда с именем пользователя и самой командой."},
 {q:"Нужно смотреть, что пишет служба прямо сейчас, пока вы воспроизводите ошибку. Какой ключ?",
  opts:["-n","-f","-b","-p"],
  a:1, why:"<code>-f</code> показывает новые записи по мере появления, как <code>tail -f</code>."},
 {q:"Разница между journald и /var/log/*:",
  opts:["Их нет","journald собирает вывод служб systemd, в /var/log пишут программы сами","journald только для ошибок","/var/log устарел"],
  a:1, why:"Поэтому журнал доступа nginx ищут в <code>/var/log/nginx/</code>, а причину падения службы — в journalctl."},
 {q:"Диск заполнен на 100%. Какой каталог проверить первым?",
  opts:["/home","/var/log","/etc","/usr"],
  a:1, why:"<code>du -sh /var/log/*</code> обычно сразу показывает виновника."},
 {q:"Что делает logrotate?",
  opts:["Удаляет журналы","Переименовывает, сжимает и убирает старые файлы журналов","Шифрует их","Отправляет на сервер сбора"],
  a:1, why:"Без него текстовые журналы растут, пока не кончится место."}
],
labs:[
 {id:"6a", title:"Найти причину в журнале",
  brief:"<p>Служба <code>api</code> не работает. Найдите причину и почините её, не гадая.</p><ul><li>посмотрите, какие службы упали;</li><li>прочитайте журнал <code>api</code> и найдите строку с ошибкой;</li><li>причина — в файле настроек <code>/etc/api/api.conf</code>: в нём указан каталог, которого нет. Создайте его;</li><li>запустите службу и убедитесь, что она работает.</li></ul>",
  hint:"systemctl list-units --failed, потом journalctl -u api. В журнале назван путь, которого не хватает.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    units: {"api.service": {desc: "API", exec: "/usr/local/bin/api", restart: "on-failure",
                            failed: true, sub: "failed", result: "exit-code",
                            brokenConfig: S => {
                              try{ statPath(S, "/srv/api/data", {who: {uid: 0, gids: [0], name: "root"}}); return null; }
                              catch(e){ return "api: cannot open data directory /srv/api/data: No such file or directory"; }
                            }}},
    files: {"/etc/api/api.conf": "data_dir = /srv/api/data\nport = 9000\n"},
    journal: [{t: 0, unit: "api.service", prio: 3,
               msg: "api: cannot open data directory /srv/api/data: No such file or directory", boot: 1},
              {t: 0, unit: "api.service", prio: 3, msg: "api.service: Failed with result 'exit-code'.", boot: 1}],
    }),
  checks:[
   {label:"Упавшие службы найдены", test:st=>ran(st, /systemctl\s+(list-units|status)/)},
   {label:"Журнал службы прочитан", test:st=>ran(st, /journalctl/)},
   {label:"Причина увидена", test:st=>logHas(st, /cannot open data directory/)},
   {label:"Каталог данных создан", test:st=>{const n = node(st, "/srv/api/data"); return !!n && n.type === "d";}},
   {label:"Служба работает", test:st=>isActive(st, "api")},
   {label:"Отказов у неё больше нет", test:st=>{const u = unitOf(st, "api"); return !!u && !u.failed;}}
  ]},
 {id:"6b", title:"Разобрать журнал доступа",
  brief:"<p>В <code>/var/log/auth.log</code> накопились записи. Соберите две цифры и сложите их в отчёт.</p><ul><li>посчитайте, сколько было неудачных попыток входа (строки <code>Failed password</code>), и запишите число в <code>/root/otchet-neudach.txt</code>;</li><li>выберите все строки про <code>sudo</code> в файл <code>/root/sudo.txt</code>;</li><li>в отчёте должно быть именно число, без лишнего текста.</li></ul>",
  hint:"grep 'Failed password' /var/log/auth.log | wc -l > /root/otchet-neudach.txt. Второй файл — просто grep с перенаправлением.",
  setup: () => newMachine({files: {"/var/log/auth.log": {text: [
      "Sep  3 09:12:44 web-01 sshd[812]: Accepted publickey for ubuntu from 10.0.2.2 port 51344 ssh2",
      "Sep  3 09:13:01 web-01 sshd[840]: Failed password for root from 203.0.113.9 port 40122 ssh2",
      "Sep  3 09:13:04 web-01 sshd[841]: Failed password for root from 203.0.113.9 port 40124 ssh2",
      "Sep  3 09:13:09 web-01 sshd[842]: Failed password for admin from 203.0.113.9 port 40130 ssh2",
      "Sep  3 09:14:02 web-01 sudo:  ubuntu : TTY=pts/0 ; PWD=/home/ubuntu ; USER=root ; COMMAND=/usr/bin/apt update",
      "Sep  3 09:15:30 web-01 sshd[860]: Failed password for ubuntu from 203.0.113.9 port 40140 ssh2",
      "Sep  3 09:16:11 web-01 sudo:  ubuntu : TTY=pts/0 ; PWD=/etc ; USER=root ; COMMAND=/usr/bin/systemctl restart nginx",
      ""].join("\n"), mode: 0o640}}}),
  checks:[
   {label:"Журнал просматривали", test:st=>used(st, "grep") || used(st, "cat") || used(st, "less")},
   {label:"Отчёт с числом создан", test:st=>!!node(st, "/root/otchet-neudach.txt")},
   {label:"Число подсчитано верно (их четыре)", test:st=>/^\s*4\s*$/.test(text(st, "/root/otchet-neudach.txt"))},
   {label:"Файл с записями sudo создан", test:st=>!!node(st, "/root/sudo.txt")},
   {label:"В нём обе строки про sudo", test:st=>{const t = text(st, "/root/sudo.txt");
      return /apt update/.test(t) && /systemctl restart nginx/.test(t);}},
   {label:"Лишних строк в него не попало", test:st=>text(st, "/root/sudo.txt").length > 0 &&
                                                   !/Failed password/.test(text(st, "/root/sudo.txt"))}
  ]}
],
iv:[
 {q:"Как вы ищете причину отказа в журналах?",
  probe:"Ждут приём сужения выборки, а не перечисление ключей.",
  a:"Я двигаюсь от широкого к узкому. Начинаю с <code>journalctl -p err -b</code> — все ошибки с последней загрузки; это выкидывает почти весь шум и часто сразу называет службу. Дальше сужаю до неё: <code>journalctl -u имя -n 100</code>, и если известно время, добавляю <code>--since</code>. Смотрю не на саму строку с ошибкой, а на десяток строк перед ней: причина обычно раньше следствия — например, «не могу открыть файл» за пять строк до «завершаюсь с ошибкой». Если проблема воспроизводится, самый быстрый способ — <code>journalctl -f -u имя</code> в одном окне и воспроизведение в другом. И отдельно помню, что не всё попадает в journald: журналы доступа веб-сервера лежат файлами в <code>/var/log/nginx/</code>, и туда идти с <code>grep</code>.",
  more:["Чем -p err отличается от -p warning?","Где смотреть, если служба пишет в свой файл?"]},
 {q:"Диск заполнен на 100%. Что делаете?",
  probe:"Проверяют порядок действий под давлением и понимание, что удалять нельзя.",
  a:"Сначала выясняю, где именно: <code>df -h</code> покажет заполнившийся раздел, а <code>du -sh /var/* | sort -h</code> — крупные каталоги внутри. В подавляющем большинстве случаев это <code>/var/log</code>, реже — данные службы или незачищенные временные файлы. Дальше важный момент: просто <code>rm</code> на растущий файл журнала места не вернёт, если его держит открытым живой процесс — место освободится только после перезапуска службы или после <code>truncate</code>. Поэтому я предпочитаю <code>truncate -s 0</code> для файла, который пишется, и обычное удаление для уже повёрнутых архивов. После того как машина задышала, разбираюсь с причиной: почему logrotate не справился или что начало писать в журнал в сто раз больше обычного.",
  more:["Почему rm на открытый файл не освобождает место?","Как настроить ограничение размера journald?"]}
]
},
