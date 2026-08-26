
/* ------------------------------------------------ 9 */
{
n:9, id:"remote", title:"Сервер", sub:"origin, fetch и pull",
lede:"Половина недоразумений с удалённым репозиторием снимается одним фактом: origin/main — это не ветка на сервере, а ваша локальная запись о том, где она была в последний раз, когда вы смотрели.",
theory:`
<h2>Три вида веток</h2>
<div class="tw"><table>
<tr><th>Что</th><th>Где живёт</th><th>Кто двигает</th></tr>
<tr><td><code>main</code></td><td>у вас</td><td>вы: коммитами, слияниями, сбросами</td></tr>
<tr><td><code>origin/main</code></td><td><b>у вас</b></td><td>только <code>fetch</code>, <code>pull</code> и <code>push</code></td></tr>
<tr><td><code>main</code> на сервере</td><td>на сервере</td><td>чей-нибудь <code>push</code></td></tr>
</table></div>
<div class="note ok"><b class="hd">Ключевая мысль</b><p><code>origin/main</code> — это <b>снимок</b>, сделанный при последней связи с сервером. Он не обновляется сам и не знает о том, что кто-то запушил минуту назад. Пока вы не сделали <code>fetch</code>, ваше представление о сервере может быть каким угодно устаревшим.</p></div>

<h2>fetch и pull</h2>
<pre><code>git fetch origin     <span class="c"># принести чужие коммиты, свою ветку не трогать</span>
git pull             <span class="c"># то же самое + сразу слить в текущую ветку</span></code></pre>
<p><code>pull</code> — это ровно <code>fetch</code> плюс <code>merge</code>. Он ничем не «мощнее», просто выполняет второй шаг автоматически. Привычка делать <code>fetch</code> и смотреть, что приехало, экономит много времени: можно спокойно оценить чужие изменения до того, как они смешаются с вашими.</p>
<pre><code>git fetch
git log --oneline HEAD..origin/main   <span class="c"># что появилось у них</span>
git log --oneline origin/main..HEAD   <span class="c"># что есть у меня и нет у них</span></code></pre>

<h2>Отслеживаемая ветка</h2>
<pre><code>git push -u origin feature/поиск     <span class="c"># -u связывает ветки один раз</span>
git branch -u origin/main            <span class="c"># связать уже существующую</span></code></pre>
<p>После связывания <code>git push</code> и <code>git pull</code> работают без аргументов, а <code>git status</code> начинает показывать «ваша ветка впереди на 2 коммита». Без связывания git каждый раз просит уточнить, куда именно.</p>

<h2>Что показывает status</h2>
<div class="tw"><table>
<tr><th>Строка</th><th>Что значит</th><th>Что делать</th></tr>
<tr><td>ahead of 'origin/main' by 2</td><td>у вас два своих коммита</td><td><code>push</code></td></tr>
<tr><td>behind 'origin/main' by 3</td><td>на сервере три чужих</td><td><code>pull</code></td></tr>
<tr><td>have diverged</td><td>и то, и другое</td><td><code>pull --rebase</code>, потом <code>push</code></td></tr>
</table></div>
<div class="note warn"><b class="hd">Эти цифры — про снимок</b><p>Они считаются относительно <code>origin/main</code>, то есть относительно того, что вы видели при последнем <code>fetch</code>. «Ваша ветка актуальна» вполне может означать «актуальна по состоянию на вчера».</p></div>

<h2>Удаление и уборка</h2>
<pre><code>git push origin --delete feature/поиск   <span class="c"># удалить ветку на сервере</span>
git fetch --prune                        <span class="c"># убрать записи об удалённых там ветках</span></code></pre>
<p>Ветки, удалённые на сервере, продолжают показываться в <code>git branch -r</code>, пока вы не сделаете <code>prune</code>. Через полгода работы список из полусотни несуществующих веток — обычное дело; лечится одной командой или настройкой <code>fetch.prune = true</code>.</p>
`,
quiz:[
 {q:"Что такое <code>origin/main</code>?",
  opts:["Ветка на сервере","Ваша локальная запись о том, где эта ветка была при последней связи","Копия main","Псевдоним сервера"],
  a:1, why:"Она не обновляется сама. Пока не сделали <code>fetch</code>, ваше представление о сервере может быть сколь угодно устаревшим."},
 {q:"Чем <code>git pull</code> отличается от <code>git fetch</code>?",
  opts:["Ничем","<code>pull</code> = <code>fetch</code> + слияние в текущую ветку","<code>fetch</code> меняет файлы","<code>pull</code> только для main"],
  a:1, why:"Привычка делать <code>fetch</code> и смотреть, что приехало, позволяет оценить чужие изменения до смешивания со своими."},
 {q:"Что делает ключ <code>-u</code> в <code>git push -u origin feature</code>?",
  opts:["Форсирует отправку","Связывает локальную ветку с серверной — дальше push и pull работают без аргументов","Обновляет с сервера","Удаляет ветку"],
  a:1, why:"После связывания <code>git status</code> начинает показывать «впереди на N коммитов»."},
 {q:"<code>git status</code> говорит «up to date». Это точно так?",
  opts:["Да, всегда","Это относительно последнего <code>fetch</code> — на сервере уже могло появиться новое","Только для main","Только если был push"],
  a:1, why:"Цифры считаются относительно снимка <code>origin/main</code>, а не относительно сервера прямо сейчас."},
 {q:"Как посмотреть, что появилось на сервере, но ещё не у вас?",
  opts:["<code>git log</code>","<code>git fetch</code>, затем <code>git log HEAD..origin/main</code>","<code>git status</code>","<code>git diff</code>"],
  a:1, why:"Обратная запись <code>origin/main..HEAD</code> покажет то, что есть у вас и нет у них."},
 {q:"Ветку удалили на сервере, а <code>git branch -r</code> её показывает. Почему?",
  opts:["Ошибка git","Локальные записи об удалённых ветках убирает только <code>fetch --prune</code>","Нет прав","Ветка не удалена"],
  a:1, why:"Лечится одной командой или настройкой <code>fetch.prune = true</code>."}
],
labs:[
 {id:"9a", title:"Посмотреть до того, как сливать",
  brief:"<p>Пока вы работали, коллега отправил на сервер два коммита. Сливать их вслепую не хочется.</p><ul><li>принесите чужие коммиты, <b>не</b> меняя свою ветку;</li><li>убедитесь, что <code>main</code> осталась на месте, а <code>origin/main</code> уехала вперёд.</li></ul><p>Посмотреть, что именно приехало, можно через <code>git log --oneline origin/main</code>.</p>",
  hint:"git fetch origin приносит коммиты и двигает только origin/main.",
  setup: R => {
    sc(R, "chore: init", {"app.py": "print('привет')"});
    scRemote(R);
    scTheirs(R, "feat: кеш запросов", {"cache.py": "CACHE = {}"});
    scTheirs(R, "fix: сбрасывать кеш по времени", {"cache.py": "CACHE = {}\nTTL = 60"});
  },
  checks:[
   {label:"Чужие коммиты в вашей базе объектов", test:st=>{
     const rid = st.R.refs["refs/remotes/origin/main"];
     return !!rid && !!obj(st.R, rid) && obj(st.R, rid).msg === "fix: сбрасывать кеш по времени"; }},
   {label:"Ваша ветка не сдвинулась", test:st=>{
     const rid = st.R.refs["refs/remotes/origin/main"];
     return tipMsg(st) === "chore: init" && !!rid && obj(st.R, rid).msg === "fix: сбрасывать кеш по времени"; }},
   {label:"Файлов коллеги в рабочей копии нет", test:st=>{
     const rid = st.R.refs["refs/remotes/origin/main"];
     return work(st)["cache.py"] === undefined && !!rid && obj(st.R, rid).msg === "fix: сбрасывать кеш по времени"; }},
   {label:"Использован <code>fetch</code>, а не <code>pull</code>", test:st=>okRan(st,/git\s+fetch/) && !ran(st,/git\s+pull/)}
  ]},
 {id:"9b", title:"Отправить новую ветку",
  brief:"<p>Ветка <code>feature/экспорт</code> готова и существует только локально. Отправьте её на сервер и <b>свяжите</b> с серверной, чтобы дальше <code>git push</code> работал без аргументов.</p>",
  hint:"git push -u origin feature/экспорт",
  setup: R => {
    sc(R, "chore: init", {"app.py": "print('привет')"});
    scRemote(R);
    scNew(R, "feature/экспорт");
    sc(R, "feat: выгрузка в CSV", {"export.py": "def to_csv(rows): pass"});
  },
  checks:[
   {label:"Ветка появилась на сервере", test:st=>!!st.R.remotes.origin.repo.refs["refs/heads/feature/экспорт"]},
   {label:"Коммит доехал", test:st=>{
     const rem = st.R.remotes.origin.repo, id = rem.refs["refs/heads/feature/экспорт"];
     return !!id && obj(rem, id).msg === "feat: выгрузка в CSV"; }},
   {label:"Ветки связаны", test:st=>st.R.upstream["feature/экспорт"] === "origin/feature/экспорт"},
   {label:"Появилась запись <code>origin/feature/экспорт</code>", test:st=>!!st.R.refs["refs/remotes/origin/feature/экспорт"]}
  ]}
],
iv:[
 {q:"Что такое origin/main и чем pull отличается от fetch?",
  probe:"Проверяют модель в голове. Ответ «origin/main — это ветка на сервере» неверен.",
  a:"<code>origin/main</code> — это локальная ветка отслеживания, то есть моя собственная запись о том, где серверная ветка находилась в момент последней связи. Она лежит в моём репозитории и сама не обновляется: сдвинуть её могут только <code>fetch</code>, <code>pull</code> или мой собственный <code>push</code>. Отсюда важное следствие: когда <code>git status</code> пишет «ваша ветка актуальна», это утверждение относительно снимка, а не относительно сервера прямо сейчас. <code>fetch</code> приносит чужие коммиты и двигает только ветки отслеживания, ничего не меняя в моей работе. <code>pull</code> — это <code>fetch</code> плюс автоматическое слияние в текущую ветку. Я обычно делаю <code>fetch</code> отдельно и смотрю <code>git log HEAD..origin/main</code>, чтобы понять, что приехало, прежде чем это смешается с моим.",
  more:["Что делает pull --rebase?","Как посмотреть, чего у меня нет?"]}
]
},

/* ------------------------------------------------ 10 */
{
n:10, id:"team", title:"В команде", sub:"Отказы, force и синхронизация",
lede:"Все самые дорогие ошибки в git происходят не в одиночку, а при работе вдвоём. Разбираем ровно те ситуации, где можно потерять чужую работу.",
theory:`
<h2>Push отклонён</h2>
<pre><code>! [rejected]  main -&gt; main (fetch first)
error: failed to push some refs</code></pre>
<p>Это не поломка, а защита: на сервере есть коммиты, которых нет у вас, и обычный push стёр бы их. Правильная последовательность:</p>
<pre><code>git pull --rebase     <span class="c"># принести чужое и переложить своё поверх</span>
git push</code></pre>
<div class="note trap"><b class="hd">Чего здесь делать нельзя</b><p><code>git push --force</code> в этой ситуации — прямой способ уничтожить чужую работу: серверная ветка станет вашей копией, а чужие коммиты потеряют ссылки. Отказ push означает «синхронизируйтесь», а не «примените силу».</p></div>

<h2><code>pull --rebase</code> против обычного</h2>
<div class="tw"><table>
<tr><th></th><th><code>pull</code></th><th><code>pull --rebase</code></th></tr>
<tr><td>Что делает с вашими коммитами</td><td>оставляет на месте, добавляет коммит слияния</td><td>перекладывает поверх чужих</td></tr>
<tr><td>История</td><td>с «пузырями» слияний</td><td>линейная</td></tr>
<tr><td>Когда опасно</td><td>никогда</td><td>если ваши коммиты уже отправлены</td></tr>
</table></div>
<p>Обычный <code>pull</code> на каждой синхронизации создаёт коммит «Merge branch 'main' of…», который ничего не значит и засоряет историю. Многие команды включают <code>git config pull.rebase true</code> и забывают об этом.</p>

<h2>Когда force всё-таки нужен</h2>
<p>Законный случай один: ваша <b>личная</b> ветка, которую вы перебазировали или у которой поправили коммиты через <code>--amend</code>, и её нужно обновить на сервере. Тогда:</p>
<pre><code>git push --force-with-lease</code></pre>
<div class="note ok"><b class="hd">Чем <code>--force-with-lease</code> отличается от <code>--force</code></b><p><code>--force</code> говорит «замени тем, что у меня» — без вопросов. <code>--force-with-lease</code> добавляет условие: «замени, <b>если</b> серверная ветка всё ещё там, где я её видел в последний раз». Если кто-то успел запушить, отправка отклоняется, и вы узнаёте об этом до того, как затрёте чужое. Стоимость — ноль, польза — предотвращённая катастрофа. Привычка использовать именно его окупается один раз, но окупается сильно.</p><p>Оговорка: «lease» опирается на вашу ветку отслеживания, поэтому <code>git fetch</code> прямо перед форсом эту защиту обнуляет — вы «увидели» чужой коммит и согласились его затереть.</p></div>

<h2>Если беда всё-таки случилась</h2>
<p>Кто-то форсом затёр коммиты в общей ветке. Это почти всегда поправимо:</p>
<div class="tw"><table>
<tr><th>Шаг</th><th>Что делать</th></tr>
<tr><td>1</td><td>Найти того, у кого затёртые коммиты ещё в локальном клоне</td></tr>
<tr><td>2</td><td>У него они видны в <code>git reflog</code> либо в ветке отслеживания</td></tr>
<tr><td>3</td><td>Создать ветку на нужном хеше и отправить её</td></tr>
<tr><td>4</td><td>Восстановить общую ветку из неё</td></tr>
</table></div>
<p>Именно поэтому первое правило после такого происшествия — <b>никому не делать <code>fetch --prune</code> и не переклонировать репозиторий</b>, пока не восстановили: локальные копии сейчас единственный источник.</p>

<h2>Полезные настройки</h2>
<pre><code>git config pull.rebase true        <span class="c"># не плодить пустые слияния</span>
git config fetch.prune true        <span class="c"># убирать записи об удалённых ветках</span>
git config push.default current    <span class="c"># push отправляет текущую ветку</span>
git config rerere.enabled true     <span class="c"># запоминать разрешённые конфликты</span></code></pre>
<p>Последняя стоит отдельного слова: <code>rerere</code> запоминает, как вы разрешили конфликт, и применяет то же решение, если он встретится снова. Незаменимо при долгом перебазировании, где один и тот же конфликт всплывает на каждом шаге.</p>
`,
quiz:[
 {q:"<code>push</code> отклонён с «fetch first». Что это значит?",
  opts:["Нет прав","На сервере есть коммиты, которых нет у вас — push стёр бы их","Ветка защищена","Сеть недоступна"],
  a:1, why:"Правильный ответ — <code>git pull --rebase</code>, затем push. Форс здесь уничтожит чужую работу."},
 {q:"Чем <code>--force-with-lease</code> лучше <code>--force</code>?",
  opts:["Он быстрее","Проверяет, что серверная ветка там, где вы её видели — иначе отказывает","Не требует прав","Создаёт резервную копию"],
  a:1, why:"Стоимость — ноль, польза — предотвращённая потеря чужих коммитов."},
 {q:"Что делает <code>git pull --rebase</code> с вашими локальными коммитами?",
  opts:["Оставляет на месте и создаёт коммит слияния","Перекладывает их поверх принесённых чужих","Удаляет их","Отправляет на сервер"],
  a:1, why:"История остаётся линейной, без коммитов «Merge branch 'main' of…», которые ничего не значат."},
 {q:"Когда force push законен?",
  opts:["Никогда","В своей личной ветке после rebase или amend","Всегда, если вы уверены","В main, если вы ведущий разработчик"],
  a:1, why:"И даже там — через <code>--force-with-lease</code>."},
 {q:"Коллега форсом затёр коммиты в общей ветке. Что нельзя делать первым делом?",
  opts:["Искать коммиты в чужом reflog","Переклонировать репозиторий или сделать <code>fetch --prune</code>","Создать ветку на найденном хеше","Спросить, у кого есть свежий клон"],
  a:1, why:"Локальные копии сейчас единственный источник затёртых коммитов. Уничтожать их до восстановления нельзя."},
 {q:"Зачем нужна настройка <code>rerere.enabled</code>?",
  opts:["Ускоряет слияния","Запоминает, как вы разрешили конфликт, и применяет то же решение при повторе","Отключает конфликты","Включает автоматическое слияние"],
  a:1, why:"Незаменима при долгом перебазировании, где один конфликт всплывает на каждом шаге."}
],
labs:[
 {id:"10a", title:"Push отклонён",
  brief:"<p>Вы сделали коммит и пытаетесь отправить его, но коллега успел раньше — сервер отказывает.</p><p>Синхронизируйтесь так, чтобы:</p><ul><li>чужой коммит оказался в истории;</li><li>ваш коммит лёг <b>поверх</b> него, без коммита слияния;</li><li>всё уехало на сервер.</li></ul>",
  hint:"git pull --rebase origin main, затем git push.",
  setup: R => {
    sc(R, "chore: init", {"app.py": "print('привет')"});
    scRemote(R);
    scTheirs(R, "feat: журналирование", {"log.py": "def info(m): print(m)"});
    sc(R, "feat: разбор аргументов", {"args.py": "def parse(a): return a"});
  },
  checks:[
   {label:"История линейна", test:st=>linear(st) && msgs(st).indexOf("feat: журналирование") >= 0},
   {label:"Ваш коммит сверху", test:st=>tipMsg(st) === "feat: разбор аргументов" && msgs(st)[1] === "feat: журналирование"},
   {label:"Чужой коммит под ним", test:st=>msgs(st)[1] === "feat: журналирование"},
   {label:"Сервер получил обе работы", test:st=>{
     const rem = st.R.remotes.origin.repo;
     return rem.refs["refs/heads/main"] === headId(st.R); }},
   {label:"Обошлись без force", test:st=>!ran(st,/--force(?!-with-lease)|\s-f\b/) &&
     st.R.remotes.origin.repo.refs["refs/heads/main"] === headId(st.R)}
  ]},
 {id:"10b", title:"Форс, который не затрёт чужое",
  brief:"<p>Вы поправили последний коммит своей личной ветки через <code>--amend</code> — история разошлась с сервером, обычный push не пройдёт. Но пока вы это делали, туда что-то попало.</p><ul><li>попробуйте отправить через <code>--force-with-lease</code>;</li><li>получив отказ, разберитесь, что на сервере: <code>git fetch</code> и <code>git log --oneline origin/feature/поиск</code>;</li><li>принесите чужое и отправьте так, чтобы <b>ничего не потерялось</b>: и ваша правка, и чужой коммит должны остаться.</li></ul>",
  hint:"Перенести чужой коммит поверх своего: git cherry-pick origin/feature/поиск. После этого push --force-with-lease пройдёт — вы уже видели то, что на сервере.",
  setup: R => {
    sc(R, "chore: init", {"app.py": "print('привет')"});
    runGit(R, "git remote add origin webapp");
    scNew(R, "feature/поиск");
    sc(R, "feat: поиск", {"search.py": "def find(q): return []"});
    runGit(R, "git push -u origin feature/поиск");
    /* коллега дописал в ту же ветку */
    const rem = R.remotes.origin.repo;
    const ref = "refs/heads/feature/поиск";
    rem.index = commitFiles(rem, rem.refs[ref]);
    rem.index["search_test.py"] = "def test_find(): pass";
    rem.now = Math.max(rem.now, R.now) + 3600;
    const id = doCommit(rem, "test: тесты поиска", [rem.refs[ref]]);
    rem.refs[ref] = id;
    logRef(rem, ref, null, id, "commit: test: тесты поиска");
    /* а вы поправили свой коммит */
    R.index["search.py"] = "def find(q):\n    return [x for x in ITEMS if q in x]";
    R.work["search.py"] = R.index["search.py"];
    runGit(R, 'git commit --amend -m "feat: поиск по подстроке"');
  },
  checks:[
   {label:"Ваша правка на месте", test:st=>/q in x/.test(files(st)["search.py"] || "") &&
                                          files(st)["search_test.py"] !== undefined},
   {label:"Сообщение исправленное", test:st=>msgs(st).indexOf("feat: поиск по подстроке") >= 0 &&
                                             files(st)["search_test.py"] !== undefined},
   {label:"Чужие тесты не потерялись", test:st=>files(st)["search_test.py"] !== undefined},
   {label:"Сервер получил и то, и другое", test:st=>{
     const rem = st.R.remotes.origin.repo, id = rem.refs["refs/heads/feature/поиск"];
     const f = commitFiles(rem, id);
     return f["search_test.py"] !== undefined && /q in x/.test(f["search.py"] || ""); }}
  ]}
],
iv:[
 {q:"Push отклонён. Ваши действия?",
  probe:"Проверяют инстинкт. Если первым звучит «форсну» — это красный флаг.",
  a:"Отказ означает, что на сервере есть коммиты, которых нет у меня, и обычный push их бы стёр. Значит, надо синхронизироваться: <code>git pull --rebase</code> принесёт чужие коммиты и переложит мои поверх, после чего push пройдёт обычным образом. Обычный <code>pull</code> тоже сработает, но добавит бессмысленный коммит слияния, поэтому я держу <code>pull.rebase = true</code> в настройках. Чего в этой ситуации делать нельзя — форсить: серверная ветка станет копией моей, а чужие коммиты потеряют ссылки, и восстанавливать их придётся из чьего-то локального reflog. Отказ push — это защита, а не препятствие.",
  more:["Что если при rebase возникнет конфликт?","Когда force всё-таки нужен?"]},
 {q:"Чем force-with-lease отличается от force и когда вы его применяете?",
  probe:"Вопрос уровня «работал ли человек в команде». Ждут конкретики про механизм.",
  a:"<code>--force</code> просто заменяет серверную ветку моей, ничего не проверяя. <code>--force-with-lease</code> добавляет условие: заменить, только если серверная ветка сейчас там же, где была при моём последнем <code>fetch</code>. Если за это время кто-то запушил, отправка отклоняется — и я узнаю о чужой работе до того, как её затру. Применяю его в одном сценарии: моя личная ветка задачи, которую я перебазировал на свежий <code>main</code> или у которой поправил коммиты через <code>--amend</code>, и её надо обновить в pull request. В общие ветки не форщу вообще никогда. Важная тонкость: защита опирается на ветку отслеживания, поэтому <code>git fetch</code> непосредственно перед форсом её обнуляет — формально я уже «увидел» чужой коммит и согласился его затереть.",
  more:["Что делать, если чужое всё-таки затёрли?","Почему fetch перед force опасен?"]}
]
},
