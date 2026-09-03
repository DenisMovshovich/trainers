
/* ------------------------------------------------ 7 */
{
n:7, id:"proc", title:"Процессы и ресурсы", sub:"Кто съел процессор и почему кончилась память",
lede:"«Сервер тормозит» — это не диагноз. За минуту можно выяснить, чего именно не хватает: процессора, памяти, диска или их вовсе хватает, а дело в чём-то другом.",
theory:`
<h2>Что показывает ps</h2>
<pre><code>$ <span class="k">ps aux</span>
<span class="q">USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
www-data     870  0.4  1.2  55200 24800 ?        S    09:12   0:03 nginx: worker process</span></code></pre>
<div class="tw"><table>
<tr><th>Столбец</th><th>Что это</th><th>На что смотреть</th></tr>
<tr><td><code>USER</code></td><td>от кого работает</td><td>служба под root — повод спросить почему</td></tr>
<tr><td><code>PID</code></td><td>номер процесса</td><td>им пользуются <code>kill</code> и <code>journalctl</code></td></tr>
<tr><td><code>%CPU</code></td><td>доля процессора</td><td>устойчивые 100% — зацикливание</td></tr>
<tr><td><code>RSS</code></td><td>занятая память в килобайтах</td><td>настоящее потребление</td></tr>
<tr><td><code>STAT</code></td><td>состояние</td><td><code>Z</code> — зомби, <code>D</code> — застрял на диске</td></tr>
</table></div>
<p><code>VSZ</code> — сколько памяти процесс запросил, <code>RSS</code> — сколько реально занял. Разница бывает огромной, и пугаться <code>VSZ</code> не нужно: считают по <code>RSS</code>.</p>

<h2>Сигналы: как просят и как заставляют</h2>
<div class="tw"><table>
<tr><th>Сигнал</th><th>Команда</th><th>Что происходит</th></tr>
<tr><td><code>TERM</code> (15)</td><td><code>kill PID</code></td><td>вежливая просьба: программа успевает закрыть файлы</td></tr>
<tr><td><code>HUP</code> (1)</td><td><code>kill -HUP PID</code></td><td>перечитать настройки, не прерывая работу</td></tr>
<tr><td><code>KILL</code> (9)</td><td><code>kill -9 PID</code></td><td>убить немедленно — программа не узнает и ничего не сохранит</td></tr>
</table></div>
<div class="note warn"><b class="hd">-9 не первый выбор, а последний</b><p>После <code>kill -9</code> база данных остаётся с недописанным файлом, а служба — с висящим сокетом на порту. Правильный порядок: обычный <code>kill</code>, подождать несколько секунд, и только если не помогло — <code>-9</code>. Для службы под systemd вместо <code>kill</code> вообще нужен <code>systemctl stop</code>: иначе она поднимется по <code>Restart=</code>.</p></div>

<h2>Память: почему «свободной» почти нет</h2>
<pre><code>$ <span class="k">free -h</span>
<span class="q">               total        used        free      shared  buff/cache   available
Mem:            3.8Gi       1.1Gi       2.1Gi       1.0Mi       612Mi       2.5Gi</span></code></pre>
<p>Смотреть надо на <code>available</code>, а не на <code>free</code>. Ядро занимает свободную память под кеш диска и мгновенно отдаёт её, когда она понадобится приложению. Поэтому <code>free</code> близкий к нулю — нормальное состояние здоровой машины, а не признак беды.</p>

<h2>Когда память кончается по-настоящему</h2>
<p>Если памяти не хватает даже с учётом кеша, ядро запускает OOM killer — выбирает самый прожорливый процесс и убивает его. Снаружи это выглядит как «служба сама пропала без причины». Причина есть, и она записана:</p>
<pre><code>$ <span class="k">journalctl -k | grep -i "out of memory"</span>
<span class="q">Out of memory: Killed process 1284 (postgres) total-vm:2841200kB</span></code></pre>
<div class="note trap"><b class="hd">Признак, по которому OOM узнают сразу</b><p>Служба остановилась, в её собственном журнале — ничего, последняя запись обычная. Это и есть подпись OOM: процесс убит сигналом <code>KILL</code>, попрощаться он не успел. Ищите в журнале ядра, а не службы.</p></div>

<h2>Нагрузка: что означает load average</h2>
<pre><code>$ <span class="k">uptime</span>
<span class="q"> 17:56:01 up 10 days,  1 user,  load average: 0.08, 0.03, 0.01</span>
                                              <span class="c2">1 мин  5 мин  15 мин</span></code></pre>
<p>Это среднее число процессов, которые чего-то ждут — процессора или диска. Сравнивать надо с числом ядер: нагрузка 4 на четырёхъядерной машине — полная загрузка, на одноядерной — четырёхкратная перегрузка. Полезнее не само число, а тенденция: если за пятнадцать минут выросло вчетверо, что-то началось.</p>
<div class="note ok"><b class="hd">Высокая нагрузка при простаивающем процессоре</b><p>Значит, процессы ждут не процессор, а диск. В <code>ps</code> у них состояние <code>D</code>. Обычная причина — медленный или отказывающий диск, и лечится это не перезапуском службы.</p></div>

<h2>Порядок разбора «сервер тормозит»</h2>
<div class="tw"><table>
<tr><th>Шаг</th><th>Команда</th><th>Вывод</th></tr>
<tr><td>1. Есть ли место</td><td><code>df -h</code></td><td>100% объясняет почти любой отказ</td></tr>
<tr><td>2. Есть ли память</td><td><code>free -h</code></td><td>смотреть <code>available</code></td></tr>
<tr><td>3. Кто грузит</td><td><code>top</code></td><td>отсортировано по процессору</td></tr>
<tr><td>4. Не убивало ли</td><td><code>journalctl -k | grep -i oom</code></td><td>следы OOM killer</td></tr>
</table></div>
`,
quiz:[
 {q:"В <code>free -h</code> свободной памяти почти нет. Это плохо?",
  opts:["Да, нужно срочно добавить памяти","Нет: ядро занимает свободное под кеш; смотреть надо на available","Да, служба течёт","Означает своп"],
  a:1, why:"Кеш отдаётся приложению мгновенно. Настоящий показатель — <code>available</code>."},
 {q:"Чем <code>kill -9</code> отличается от обычного <code>kill</code>?",
  opts:["Быстрее","Программа не получает сигнал и не успевает ничего сохранить","Требует root","Работает только для служб"],
  a:1, why:"<code>TERM</code> позволяет закрыть файлы, <code>KILL</code> обрывает мгновенно — отсюда битые данные."},
 {q:"Служба пропала, в её журнале ничего необычного. Что проверить?",
  opts:["Права на файлы","Журнал ядра на предмет OOM killer","Настройки сети","Место на диске"],
  a:1, why:"Убитый по <code>KILL</code> процесс не успевает ничего записать. Запись есть у ядра."},
 {q:"Load average 4.0 на машине с четырьмя ядрами — это:",
  opts:["Четырёхкратная перегрузка","Примерно полная загрузка","Простой","Ошибка измерения"],
  a:1, why:"Сравнивать нужно с числом ядер. На одном ядре та же цифра означала бы перегрузку."},
 {q:"Процессы в состоянии <code>D</code> при простаивающем процессоре означают:",
  opts:["Зомби","Ожидание диска","Нехватку памяти","Сетевую проблему"],
  a:1, why:"<code>D</code> — непрерываемый сон, почти всегда ввод-вывод. Лечится не перезапуском службы."},
 {q:"Как правильно остановить службу systemd?",
  opts:["kill -9 её PID","systemctl stop","pkill по имени","Перезагрузкой"],
  a:1, why:"После <code>kill</code> служба с <code>Restart=</code> поднимется заново, и вы решите, что она бессмертна."}
],
labs:[
 {id:"7a", title:"Найти прожорливый процесс и остановить правильно",
  brief:"<p>Машина отзывается медленно. Разберитесь.</p><ul><li>посмотрите общую картину: место, память, загрузку;</li><li>найдите процесс, который занимает больше всего процессора;</li><li>он принадлежит службе <code>schet</code>. Остановите её так, чтобы она не поднялась заново, и отключите автозапуск;</li><li>убедитесь, что она больше не работает.</li></ul><p><code>kill -9</code> здесь не поможет — у службы задан перезапуск.</p>",
  hint:"top или ps aux покажут виновника. Служба останавливается через systemctl stop, автозапуск снимается через disable.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    units: {"schet.service": {desc: "Считалка", exec: "/usr/local/bin/schet", active: true, enabled: true,
                              pid: 1284, sub: "running", restart: "always", cpu: 98.4, mem: 12.6}},
    after: S => { syncProcs(S); }}),
  checks:[
   {label:"Ресурсы осмотрены", test:st=>used(st, "top") || used(st, "ps") || used(st, "free")},
   {label:"Место проверено", test:st=>used(st, "df")},
   {label:"Служба остановлена", test:st=>!isActive(st, "schet")},
   {label:"Автозапуск снят", test:st=>!isEnabled(st, "schet")},
   {label:"Остановлена именно через systemctl", test:st=>ran(st, /systemctl\s+stop\s+schet/)},
   {label:"Процесса больше нет", test:st=>!st.S.procs.some(p => p.unit === "schet.service")}
  ]},
 {id:"7b", title:"Разобраться, почему служба исчезла",
  brief:"<p>Служба <code>tyazhelyj</code> вчера работала, а сегодня её нет. В её собственном журнале — ничего необычного.</p><ul><li>убедитесь, что в журнале самой службы нет причины;</li><li>найдите её в журнале ядра (записи без службы; попробуйте <code>dmesg</code> или <code>journalctl</code> с поиском по слову <code>memory</code>);</li><li>запишите вывод в <code>/home/ubuntu/prichina.txt</code> — там должно встретиться слово <code>memory</code>;</li><li>запустите службу снова.</li></ul>",
  hint:"dmesg | grep -i memory > /home/ubuntu/prichina.txt. Потом sudo systemctl start tyazhelyj.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    units: {"tyazhelyj.service": {desc: "Тяжёлый расчёт", exec: "/usr/local/bin/tyazhelyj", enabled: true}},
    journal: [{t: 0, unit: "tyazhelyj.service", prio: 6, msg: "Started Тяжёлый расчёт.", boot: 1},
              {t: 1, unit: "tyazhelyj.service", prio: 6, msg: "расчёт начат, шаг 1 из 40", boot: 1},
              {t: 2, unit: null, prio: 3, msg: "Out of memory: Killed process 1284 (tyazhelyj) total-vm:2841200kB, anon-rss:2703440kB", boot: 1}]}),
  checks:[
   {label:"Журнал службы прочитан", test:st=>ran(st, /journalctl.*tyazhelyj/)},
   {label:"Журнал ядра просмотрен", test:st=>used(st, "dmesg") || ran(st, /journalctl\s+-k/) || ran(st, /journalctl.*memory/)},
   {label:"Причина найдена", test:st=>logHas(st, /Out of memory/)},
   {label:"Отчёт создан", test:st=>!!node(st, "/home/ubuntu/prichina.txt")},
   {label:"В отчёте названа нехватка памяти", test:st=>/memory/i.test(text(st, "/home/ubuntu/prichina.txt"))},
   {label:"Служба снова работает", test:st=>isActive(st, "tyazhelyj")}
  ]}
],
iv:[
 {q:"«Сервер тормозит». Что делаете?",
  probe:"Проверяют наличие порядка, а не список утилит.",
  a:"Я не начинаю с догадок, а быстро отсекаю четыре причины. <code>df -h</code> — потому что заполненный диск выглядит как отказ чего угодно и проверяется за секунду. <code>free -h</code>, где смотрю на <code>available</code>, а не на <code>free</code>: свободной памяти на здоровой машине почти нет, её занимает кеш. <code>top</code>, отсортированный по процессору, — виден ли конкретный виновник. И <code>uptime</code>: нагрузка сравнивается с числом ядер, а важнее — как она менялась. Отдельно смотрю на состояние процессов: если нагрузка высокая, а процессор простаивает и процессы в состоянии <code>D</code>, это диск, и лечится совсем иначе. Если ничего не нашлось на машине, значит, дело снаружи — сеть, база, соседний сервис.",
  more:["Почему смотреть на available, а не на free?","Что означает состояние D?"]},
 {q:"Когда допустим kill -9?",
  probe:"Проверяют, понимаете ли последствия.",
  a:"Когда обычный <code>kill</code> уже отправлен и процесс за разумное время не завершился. <code>TERM</code> программа получает и обрабатывает: дописывает файлы, закрывает соединения, снимает блокировки. <code>KILL</code> не доходит до программы вовсе, её просто снимает ядро — отсюда недописанные файлы базы, оставшиеся файлы блокировок, иногда занятый порт. Отдельно: для службы под systemd правильный инструмент вообще не <code>kill</code>, а <code>systemctl stop</code>, потому что при <code>Restart=always</code> убитая служба через секунду поднимется, и человек делает вывод, что она не убивается. И если процесс не умирает даже от <code>-9</code>, значит, он в состоянии <code>D</code> — ждёт диск, и тут не поможет ничего, кроме разбирательства с диском.",
  more:["Что делает kill -HUP?","Почему процесс может не умирать от -9?"]}
]
},

/* ------------------------------------------------ 8 */
{
n:8, id:"disk", title:"Диски и файловые системы", sub:"Куда делось место и как подключить новый диск",
lede:"Кончившееся место — самая частая авария на сервере. Разбираться в ней быстро помогает понимание разницы между df и du и умение читать fstab, не превращая машину в незагружающуюся.",
theory:`
<h2>df и du отвечают на разные вопросы</h2>
<div class="tw"><table>
<tr><th></th><th><code>df</code></th><th><code>du</code></th></tr>
<tr><td>Вопрос</td><td>сколько занято на разделе</td><td>сколько занимает каталог</td></tr>
<tr><td>Кого спрашивает</td><td>файловую систему</td><td>обходит файлы</td></tr>
<tr><td>Скорость</td><td>мгновенно</td><td>долго на больших деревьях</td></tr>
<tr><td>Порядок</td><td>первым</td><td>вторым, когда known раздел</td></tr>
</table></div>
<pre><code>$ <span class="k">df -h</span>                            <span class="c2">← какой раздел заполнен</span>
$ <span class="k">du -sh /var/* | sort -h</span>          <span class="c2">← что именно его заполнило</span></code></pre>
<div class="note trap"><b class="hd">df и du разошлись</b><p>Бывает, что <code>df</code> показывает 90%, а <code>du</code> насчитывает вдвое меньше. Почти всегда причина одна: удалённый файл, который держит открытым живой процесс. Место освободится только когда процесс закроет файл — то есть при перезапуске службы. Поэтому <code>rm</code> на растущий журнал не помогает, а <code>truncate -s 0</code> помогает.</p></div>

<h2>Место есть, а записать нельзя</h2>
<p>Второй способ исчерпать раздел — израсходовать inode. Их фиксированное число, и каждый файл занимает один, независимо от размера. Миллион пустых файлов кеша съедает inode при пустом диске:</p>
<pre><code>$ <span class="k">df -h</span>   <span class="q">Use% 34%</span>      <span class="c2">← место есть</span>
$ <span class="k">df -i</span>   <span class="q">IUse% 100%</span>    <span class="c2">← а вот записать больше нечего</span></code></pre>
<p>Симптом обманчивый: «No space left on device» при почти пустом диске. Поэтому при такой ошибке смотрят обе команды.</p>

<h2>Устройства, разделы, точки подключения</h2>
<pre><code>$ <span class="k">lsblk</span>
<span class="q">NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
sda      8:0     0   20G  0 disk
└─sda1   8:1     0   20G  0 part /</span></code></pre>
<div class="tw"><table>
<tr><th>Понятие</th><th>Что это</th></tr>
<tr><td>Устройство (<code>sda</code>)</td><td>физический или виртуальный диск целиком</td></tr>
<tr><td>Раздел (<code>sda1</code>)</td><td>часть диска с файловой системой</td></tr>
<tr><td>Точка подключения (<code>/</code>)</td><td>каталог, через который к разделу обращаются</td></tr>
</table></div>
<p>В Linux нет букв дисков: новый диск «появляется» как каталог. Подключить его в <code>/srv/data</code> — значит сделать так, чтобы запись в этот каталог шла на новый диск.</p>

<h2>Подключение нового диска</h2>
<pre><code>$ <span class="k">lsblk</span>                                  <span class="c2">← увидеть, что диск виден системе</span>
$ <span class="k">sudo mkfs.ext4 /dev/sdb1</span>               <span class="c2">← создать файловую систему (один раз!)</span>
$ <span class="k">sudo mkdir -p /srv/data</span>                <span class="c2">← каталог, куда подключим</span>
$ <span class="k">sudo blkid /dev/sdb1</span>                   <span class="c2">← узнать UUID</span>
$ <span class="k">sudo mount /dev/sdb1 /srv/data</span>         <span class="c2">← подключить сейчас</span>
<span class="c2"># и чтобы пережило перезагрузку — строка в /etc/fstab</span></code></pre>

<h2>fstab: шесть полей и одна опасность</h2>
<pre><code>UUID=1a2b3c4d-0001-4a1b-9c2d-000000000001  /srv/data  ext4  defaults  0  2
<span class="c2">└──────────────┬───────────────┘  └───┬──┘  └─┬┘  └──┬───┘  │  │
               что подключаем         куда     тип   ключи   │  порядок проверки
                                                             дамп (обычно 0)</span></code></pre>
<div class="note warn"><b class="hd">Почему UUID, а не /dev/sdb1</b><p>Имена устройств зависят от порядка обнаружения и после добавления диска могут поменяться местами. Тогда машина при загрузке попытается подключить не тот раздел. UUID привязан к самой файловой системе и не меняется.</p></div>
<div class="note trap"><b class="hd">Ошибка в fstab не даёт загрузиться</b><p>Опечатка в строке — и машина уходит в аварийную консоль, а если это удалённый сервер, вы просто теряете к нему доступ. Правило: после правки <b>всегда</b> проверять <code>sudo mount -a</code> — она подключит всё из файла прямо сейчас и покажет ошибки, пока машина ещё жива. Строка <code>nofail</code> в ключах — вторая страховка: с ней недоступный диск не блокирует загрузку.</p></div>

<h2>Что делать, когда место кончилось</h2>
<div class="tw"><table>
<tr><th>Шаг</th><th>Команда</th></tr>
<tr><td>1. Какой раздел</td><td><code>df -h</code> и сразу <code>df -i</code></td></tr>
<tr><td>2. Что занимает</td><td><code>du -sh /var/* | sort -h</code>, потом вглубь</td></tr>
<tr><td>3. Освободить журнал, который пишется</td><td><code>sudo truncate -s 0 файл</code>, не <code>rm</code></td></tr>
<tr><td>4. Убрать лишние пакеты</td><td><code>sudo apt autoremove &amp;&amp; sudo apt clean</code></td></tr>
<tr><td>5. Понять причину</td><td>почему выросло — иначе повторится через неделю</td></tr>
</table></div>
`,
quiz:[
 {q:"<code>df</code> показывает 90%, <code>du</code> насчитывает вдвое меньше. Причина?",
  opts:["Ошибка df","Удалённый файл держит открытым живой процесс","Скрытые файлы","Разные единицы"],
  a:1, why:"Место вернётся при перезапуске службы. Поэтому <code>rm</code> на растущий журнал не помогает."},
 {q:"«No space left on device» при заполнении диска на 34%. Что проверить?",
  opts:["Права","df -i: закончились inode","Память","Сеть"],
  a:1, why:"Каждый файл занимает inode независимо от размера. Миллион мелких файлов исчерпывает их при пустом диске."},
 {q:"Почему в fstab указывают UUID, а не /dev/sdb1?",
  opts:["Короче","Имена устройств зависят от порядка обнаружения и могут поменяться","Требование ext4","UUID быстрее"],
  a:1, why:"После добавления диска система может подключить не тот раздел — и не загрузиться."},
 {q:"Что обязательно сделать после правки /etc/fstab?",
  opts:["Перезагрузиться","Проверить sudo mount -a, пока машина жива","Ничего","systemctl daemon-reload"],
  a:1, why:"Ошибка в fstab уводит машину в аварийную консоль при загрузке. <code>mount -a</code> показывает её заранее."},
 {q:"Растущий журнал занял диск, служба пишет в него прямо сейчас. Как освободить место?",
  opts:["rm файла","truncate -s 0 файла","Перезагрузить машину","chmod 000"],
  a:1, why:"После <code>rm</code> место не вернётся, пока процесс держит файл открытым."},
 {q:"<code>du -sh /var/*</code> — что делает ключ <code>-s</code>?",
  opts:["Сортирует","Показывает только итог по каждому каталогу, без вложенных","Считает в секторах","Ищет ссылки"],
  a:1, why:"Без него вывод — тысячи строк. С ним — по строке на каталог."}
],
labs:[
 {id:"8a", title:"Освободить заполненный диск",
  brief:"<p>Диск заполнен, служба не пишет. Разберитесь по порядку.</p><ul><li>посмотрите, какой раздел заполнен и не кончились ли inode;</li><li>найдите каталог-виновник в <code>/var</code>;</li><li>виноват разросшийся <code>/var/log/prilozhenie.log</code>. Обнулите его, не удаляя файл;</li><li>запишите в <code>/home/ubuntu/najdeno.txt</code> путь к виновнику.</li></ul><p>Файл держит открытым живой процесс — подумайте, почему <code>rm</code> тут не подходит.</p>",
  hint:"df -h, df -i, du -sh /var/* | sort -h. Обнуление: truncate -s 0 файл (или : > файл).",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    mounts: [{dev: "/dev/sda1", at: "/", size: 20961280, used: 20330000, fs: "ext4", inodes: 1310720, iused: 190000}],
    files: {"/var/log/prilozhenie.log": {text: new Array(400).join("Sep  3 09:00 много-много записей подряд\n"), mode: 0o644}},
    units: {"prilozhenie.service": {desc: "Приложение", exec: "/usr/local/bin/prilozhenie",
                                    active: true, enabled: true, pid: 990, sub: "running"}}}),
  checks:[
   {label:"Занятость раздела проверена", test:st=>used(st, "df")},
   {label:"inode проверены отдельно", test:st=>ran(st, /df\s+.*-i/)},
   {label:"Виновник найден через du", test:st=>used(st, "du")},
   {label:"Файл журнала обнулён", test:st=>text(st, "/var/log/prilozhenie.log").length < 100},
   {label:"Файл при этом не удалён, а именно обнулён",
    test:st=>!!node(st, "/var/log/prilozhenie.log") && text(st, "/var/log/prilozhenie.log").length < 100},
   {label:"Путь записан в отчёт", test:st=>/prilozhenie\.log/.test(text(st, "/home/ubuntu/najdeno.txt"))}
  ]},
 {id:"8b", title:"Подключить новый диск навсегда",
  brief:"<p>К машине добавили диск <code>/dev/sdb1</code> с готовой файловой системой. Подключите его в <code>/srv/data</code> так, чтобы он вернулся после перезагрузки.</p><ul><li>найдите диск и узнайте его UUID;</li><li>создайте каталог <code>/srv/data</code>;</li><li>добавьте строку в <code>/etc/fstab</code> — по UUID, тип <code>ext4</code>, ключи <code>defaults,nofail</code>;</li><li>проверьте строку командой <code>mount -a</code> и убедитесь, что раздел виден в <code>df</code>.</li></ul><p>Указывать <code>/dev/sdb1</code> вместо UUID задание не засчитывает — вспомните, почему.</p>",
  hint:"lsblk и blkid покажут диск и UUID. Строку в fstab добавляйте через tee -a, потом sudo mount -a.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    disks: [{name: "sda", size: "20G", type: "disk"},
            {name: "└─sda1", size: "20G", type: "part", at: "/", uuid: "1a2b3c4d-0001-4a1b-9c2d-000000000001",
             fstype: "ext4", blocks: 20961280},
            {name: "sdb", size: "50G", type: "disk"},
            {name: "└─sdb1", size: "50G", type: "part", uuid: "9f8e7d6c-0002-4b2c-8d3e-000000000002",
             fstype: "ext4", blocks: 52428800}]}),
  checks:[
   {label:"Диски осмотрены", test:st=>used(st, "lsblk") || used(st, "blkid")},
   {label:"UUID выяснен", test:st=>logHas(st, /9f8e7d6c-0002/)},
   {label:"Каталог /srv/data создан", test:st=>{const n = node(st, "/srv/data"); return !!n && n.type === "d";}},
   {label:"Строка добавлена в fstab", test:st=>/9f8e7d6c-0002/.test(text(st, "/etc/fstab"))},
   {label:"Подключение задано по UUID, а не по имени устройства",
    test:st=>/^\s*UUID=9f8e7d6c-0002\S*\s+\/srv\/data\b/m.test(text(st, "/etc/fstab"))},
   {label:"Задан ключ nofail", test:st=>/\/srv\/data\s+\S+\s+\S*nofail/.test(text(st, "/etc/fstab"))},
   {label:"Строка проверена через mount -a", test:st=>okRan(st, /mount\s+-a/)},
   {label:"Раздел подключён", test:st=>st.S.mounts.some(m => m.at === "/srv/data")}
  ]}
],
iv:[
 {q:"На сервере кончилось место. Ваши действия по шагам?",
  probe:"Классический вопрос. Ждут порядок и знание ловушки с открытым файлом.",
  a:"Сначала <code>df -h</code> — какой именно раздел, и сразу <code>df -i</code>, потому что бывает, что место есть, а закончились inode, и симптом при этом тот же самый. Дальше сужаю: <code>du -sh /var/* | sort -h</code> и вглубь по самому крупному; в подавляющем большинстве случаев это <code>/var/log</code>. Тут есть ловушка: если файл журнала держит открытым живой процесс, <code>rm</code> места не вернёт — файл исчезнет из каталога, но останется занятым, и <code>df</code> с <code>du</code> разойдутся. Поэтому растущий журнал я обнуляю через <code>truncate -s 0</code>, а не удаляю. Когда машина задышала, обязательно возвращаюсь к причине: почему logrotate не справился или что начало писать в сто раз больше — иначе через неделю повторится.",
  more:["Как понять, что место держит удалённый файл?","Что даёт apt clean?"]},
 {q:"Как подключить новый диск, чтобы он пережил перезагрузку?",
  probe:"Проверяют знание fstab и осторожность.",
  a:"Порядок такой: <code>lsblk</code> — убедиться, что система видит диск; при необходимости создать файловую систему; создать каталог для подключения; узнать UUID через <code>blkid</code>; добавить строку в <code>/etc/fstab</code>. Важны две вещи. Первая — подключать по UUID, а не по <code>/dev/sdb1</code>: имена устройств зависят от порядка обнаружения, и после добавления ещё одного диска система может подключить не тот раздел. Вторая, и она важнее, — сразу после правки выполнить <code>sudo mount -a</code>. Ошибка в fstab уводит машину в аварийную консоль при следующей загрузке, а если сервер удалённый, вы просто теряете к нему доступ. <code>mount -a</code> показывает ту же ошибку, пока машина ещё работает. Для необязательных дисков добавляю <code>nofail</code>, чтобы недоступный диск не мешал загрузке.",
  more:["Что означают последние два поля в строке fstab?","Зачем nofail?"]}
]
},

/* ------------------------------------------------ 9 */
{
n:9, id:"net", title:"Сеть", sub:"Адрес, маршрут, имена и кто слушает порт",
lede:"Сетевые проблемы на сервере разбираются по слоям: есть ли адрес, есть ли маршрут, разрешается ли имя, слушает ли кто-нибудь порт. Каждый слой — одна команда.",
theory:`
<h2>Четыре вопроса и четыре команды</h2>
<div class="tw"><table>
<tr><th>Вопрос</th><th>Команда</th><th>Что смотреть</th></tr>
<tr><td>Есть ли адрес?</td><td><code>ip a</code></td><td>строка <code>inet</code> у нужного интерфейса</td></tr>
<tr><td>Есть ли маршрут наружу?</td><td><code>ip r</code></td><td>строка <code>default via</code></td></tr>
<tr><td>Разрешаются ли имена?</td><td><code>resolvectl status</code></td><td>какой сервер имён используется</td></tr>
<tr><td>Кто слушает порт?</td><td><code>ss -tulpn</code></td><td>адрес привязки и имя процесса</td></tr>
</table></div>
<pre><code>$ <span class="k">ip a</span>
<span class="q">2: ens3: &lt;BROADCAST,MULTICAST,UP,LOWER_UP&gt; mtu 1500 state UP
    inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic ens3</span>
                     <span class="c2">└┬┘
                      маска: /24 значит, сеть 10.0.2.0—10.0.2.255</span></code></pre>

<h2>ss: главная команда при «сервис не отвечает»</h2>
<pre><code>$ <span class="k">sudo ss -tulpn</span>
<span class="q">Netid  State   Recv-Q  Send-Q    Local Address:Port    Process
tcp    LISTEN       0     511    <span class="k">0.0.0.0</span>:80             users:(("nginx",pid=870,fd=3))
tcp    LISTEN       0     511    <span class="k">127.0.0.1</span>:5432         users:(("postgres",pid=920,fd=5))</span></code></pre>
<div class="tw"><table>
<tr><th>Ключ</th><th>Что добавляет</th></tr>
<tr><td><code>-t</code> / <code>-u</code></td><td>tcp / udp</td></tr>
<tr><td><code>-l</code></td><td>только слушающие</td></tr>
<tr><td><code>-n</code></td><td>номера портов вместо имён — читается однозначно</td></tr>
<tr><td><code>-p</code></td><td>какой процесс слушает (нужен root)</td></tr>
</table></div>
<div class="note trap"><b class="hd">0.0.0.0 против 127.0.0.1</b><p>Это самая частая причина «локально работает, снаружи нет». <code>127.0.0.1</code> означает, что служба принимает только с самой машины: снаружи к ней не подключиться ни при каких правилах экрана. <code>0.0.0.0</code> — со всех интерфейсов. Меняется это в настройках самой службы, а не в сети.</p></div>

<h2>Настройка адреса: netplan</h2>
<p>В Ubuntu Server сеть описывают в YAML в <code>/etc/netplan/</code>. Файл читается при загрузке и по команде.</p>
<pre><code><span class="c2"># /etc/netplan/00-installer-config.yaml — постоянный адрес</span>
network:
  version: 2
  ethernets:
    ens3:
      dhcp4: false
      addresses: [192.168.10.5/24]
      gateway4: 192.168.10.1
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]</code></pre>
<div class="note warn"><b class="hd">YAML не прощает отступов</b><p>Только пробелы, никаких табуляций, по два пробела на уровень. И проверяйте <code>sudo netplan try</code>, а не сразу <code>apply</code>: <code>try</code> откатит настройку, если вы не подтвердите её за отведённое время. На удалённой машине неверный адрес означает потерю связи с ней.</p></div>

<h2>Разрешение имён</h2>
<div class="tw"><table>
<tr><th>Где смотрят</th><th>Что это</th></tr>
<tr><td><code>/etc/hosts</code></td><td>ручные записи; проверяются первыми</td></tr>
<tr><td><code>systemd-resolved</code></td><td>служба разрешения имён; настраивается через netplan</td></tr>
<tr><td><code>/etc/resolv.conf</code></td><td>обычно ссылка на файл, которым управляет resolved — править руками бесполезно</td></tr>
</table></div>
<p>Разделять «имя не разрешается» и «адрес недоступен» важно, потому что чинят их разные люди. <code>ping имя</code> отвечает «Temporary failure in name resolution» — это имена. <code>ping адрес</code> не отвечает — это сеть.</p>
<div class="note ok"><b class="hd">ping — плохой признак доступности службы</b><p>ICMP часто закрыт на межсетевых экранах: машина работает, а <code>ping</code> молчит. И наоборот — <code>ping</code> проходит, а нужный порт закрыт. Доступность службы проверяют по порту, а не по <code>ping</code>.</p></div>
`,
quiz:[
 {q:"Служба слушает <code>127.0.0.1:5432</code>. Почему к ней не подключиться с другой машины?",
  opts:["Закрыт межсетевой экран","Она принимает только с самой машины","Нет маршрута","Не разрешается имя"],
  a:1, why:"Меняется это в настройках службы. Никакие правила экрана тут не помогут."},
 {q:"Какой ключ <code>ss</code> показывает процесс, слушающий порт?",
  opts:["-n","-p (и нужны права root)","-l","-t"],
  a:1, why:"Без root имя процесса не покажется — частая причина «а у меня пусто в этом столбце»."},
 {q:"<code>ping имя</code> отвечает «Temporary failure in name resolution». Что это значит?",
  opts:["Машина недоступна","Не разрешается имя — проблема в DNS, а не в сети","Закрыт порт","Нет маршрута"],
  a:1, why:"До отправки пакета дело не дошло: адрес неизвестен. Проверять <code>resolvectl</code>."},
 {q:"Почему на удалённой машине лучше <code>netplan try</code>, а не <code>apply</code>?",
  opts:["try быстрее","try откатит настройку, если её не подтвердить — и вы не потеряете связь","apply требует root","Разницы нет"],
  a:1, why:"Неверный адрес на удалённой машине означает потерю доступа к ней."},
 {q:"Строка <code>default via 10.0.2.2</code> в <code>ip r</code> — это:",
  opts:["Адрес машины","Шлюз: куда отправлять всё, что не в своей сети","Сервер имён","Маска сети"],
  a:1, why:"Без этой строки машина видит только свою подсеть."},
 {q:"Правка <code>/etc/resolv.conf</code> руками на Ubuntu Server обычно:",
  opts:["Единственный правильный способ","Бесполезна: файлом управляет systemd-resolved","Требует перезагрузки","Ломает сеть"],
  a:1, why:"Изменения затрутся. Серверы имён задаются в netplan."}
],
labs:[
 {id:"9a", title:"Перевести машину на постоянный адрес",
  brief:"<p>Машина получает адрес по DHCP, а нужен постоянный.</p><ul><li>посмотрите текущий адрес и маршрут;</li><li>исправьте <code>/etc/netplan/00-installer-config.yaml</code>: выключите <code>dhcp4</code>, задайте адрес <code>192.168.10.5/24</code> и шлюз <code>192.168.10.1</code>;</li><li>примените настройку;</li><li>убедитесь, что <code>ip a</code> показывает новый адрес, а <code>ip r</code> — новый шлюз.</li></ul><p>Файл можно открыть во вкладке «Файл» внизу и править прямо там.</p>",
  hint:"Отступы по два пробела: network → ethernets → ens3 → addresses. Применить: sudo netplan apply.",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}}),
  checks:[
   {label:"Текущее состояние сети осмотрено", test:st=>ran(st, /ip\s+a/) || ran(st, /ip\s+addr/)},
   {label:"DHCP выключен в файле", test:st=>/dhcp4:\s*(false|no)/.test(text(st, "/etc/netplan/00-installer-config.yaml"))},
   {label:"Адрес прописан", test:st=>/192\.168\.10\.5\/24/.test(text(st, "/etc/netplan/00-installer-config.yaml"))},
   {label:"Шлюз прописан", test:st=>/192\.168\.10\.1/.test(text(st, "/etc/netplan/00-installer-config.yaml"))},
   {label:"Настройка применена", test:st=>okRan(st, /netplan\s+(apply|try)/)},
   {label:"Машина получила новый адрес", test:st=>Object.keys(st.S.ifaces).some(n => st.S.ifaces[n].addr === "192.168.10.5/24")},
   {label:"Маршрут по умолчанию ведёт на новый шлюз", test:st=>Object.keys(st.S.ifaces).some(n => st.S.ifaces[n].gw === "192.168.10.1")}
  ]},
 {id:"9b", title:"«Локально работает, снаружи нет»",
  brief:"<p>Приложение <code>vnutri</code> отвечает на самой машине, но недоступно с других. Найдите причину и устраните.</p><ul><li>посмотрите, на каком адресе оно слушает;</li><li>в <code>/etc/vnutri/vnutri.conf</code> есть строка <code>bind = 127.0.0.1</code>. Замените адрес на <code>0.0.0.0</code>;</li><li>перезапустите службу;</li><li>убедитесь по <code>ss</code>, что она теперь слушает на всех интерфейсах.</li></ul>",
  hint:"ss -tulpn покажет 127.0.0.1:8000. Правку можно сделать через sed -i или во вкладке «Файл».",
  setup: () => newMachine({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
    files: {"/etc/vnutri/vnutri.conf": "bind = 127.0.0.1\nport = 8000\n"},
    units: {"vnutri.service": {desc: "Внутреннее приложение", exec: "/usr/local/bin/vnutri", port: 8000,
                               active: true, enabled: true, pid: 950, sub: "running",
                               bind: "127.0.0.1"}},
    after: S => {
      S.ports[8000] = "vnutri.service";
      /* адрес привязки службы читается из её файла настроек */
      const u = S.units["vnutri.service"];
      Object.defineProperty(u, "bind", {get(){
        const m = /^\s*bind\s*=\s*(\S+)/m.exec((function(){
          try{ return readFile(S, "/etc/vnutri/vnutri.conf", {who: {uid: 0, gids: [0], name: "root"}}); }
          catch(e){ return ""; }
        })());
        return m ? m[1] : "127.0.0.1";
      }});
      syncProcs(S);
    }}),
  checks:[
   {label:"Проверено, кто слушает порт", test:st=>used(st, "ss") || used(st, "netstat")},
   {label:"Видно, что служба была привязана к localhost", test:st=>logHas(st, /127\.0\.0\.1:8000/)},
   {label:"Адрес привязки исправлен в файле", test:st=>/^\s*bind\s*=\s*0\.0\.0\.0/m.test(text(st, "/etc/vnutri/vnutri.conf"))},
   {label:"Служба перезапущена", test:st=>ran(st, /systemctl\s+(restart|stop)\s+vnutri/)},
   {label:"Служба работает уже с новой привязкой",
    test:st=>isActive(st, "vnutri") && /^\s*bind\s*=\s*0\.0\.0\.0/m.test(text(st, "/etc/vnutri/vnutri.conf"))},
   {label:"Теперь слушает на всех интерфейсах", test:st=>logHas(st, /0\.0\.0\.0:8000/)}
  ]}
],
iv:[
 {q:"Сервис доступен с самой машины, но не снаружи. Как будете разбираться?",
  probe:"Ждут разделение трёх причин: привязка, экран, маршрут.",
  a:"Причин ровно три, и они проверяются по порядку. Первая и самая частая — служба слушает <code>127.0.0.1</code>, а не <code>0.0.0.0</code>: смотрю <code>ss -tulpn</code> и столбец Local Address. Если там localhost, никакие правила экрана не помогут, лечится в настройках самой службы. Вторая — межсетевой экран: <code>sudo ufw status</code>, есть ли правило на этот порт. Третья — сеть между машинами: маршрут, чужой экран, группа безопасности у облачного провайдера. Проверяю с той стороны, откуда не работает, причём по порту, а не пингом: <code>ping</code> ничего не доказывает, потому что ICMP часто закрыт отдельно. Практически первая причина покрывает больше половины случаев, поэтому <code>ss -tulpn</code> — первая команда.",
  more:["Чем 0.0.0.0 отличается от 127.0.0.1 при привязке?","Почему ping — плохая проверка?"]},
 {q:"Как задать серверу постоянный адрес в Ubuntu Server?",
  probe:"Проверяют знание netplan и осторожность при удалённой работе.",
  a:"Через netplan: файл в <code>/etc/netplan/</code>, формат YAML. Выключаю <code>dhcp4</code>, задаю <code>addresses</code> с маской, шлюз и серверы имён. Два момента, на которых спотыкаются. Первый — YAML не прощает отступов: только пробелы, по два на уровень, табуляции ломают файл целиком. Второй, и он важнее: на удалённой машине применять надо <code>netplan try</code>, а не <code>apply</code>. <code>try</code> ждёт подтверждения и, если его нет, откатывает настройку — то есть при ошибке в адресе вы не теряете доступ к серверу, а получаете его обратно через полторы минуты. С <code>apply</code> ошибка означает поездку к машине или обращение к провайдеру за консолью. И серверы имён задаются там же, а не правкой <code>/etc/resolv.conf</code> — этим файлом управляет systemd-resolved, правки затрутся.",
  more:["Что будет, если в netplan табуляция вместо пробелов?","Чем занимается systemd-resolved?"]}
]
},
