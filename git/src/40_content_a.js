
/* ============================================================
   Содержание
   ============================================================ */

/* ── помощники сценариев ───────────────────────────────── */
function sc(R, msg, files){
  for(const p in files){ if(files[p] === null){ delete R.index[p]; } else R.index[p] = files[p]; }
  R.now += 3600;
  const id = doCommit(R, msg, [headId(R)]);
  moveHead(R, id, "commit: " + msg);
  checkoutTree(R, id);
  return id;
}
function scBranch(R, name, at){ setRef(R, "refs/heads/" + name, at || headId(R), "branch: Created from HEAD"); }
function scGo(R, name){ switchTo(R, name, {}); }
function scNew(R, name){ switchTo(R, name, {create: true}); }
function scRemote(R){
  runGit(R, "git remote add origin webapp");
  runGit(R, "git push -u origin " + branchName(R));
}
/* «коллега запушил»: коммит появляется прямо на сервере */
function scTheirs(R, msg, files){
  const rem = R.remotes.origin.repo;
  const ref = "refs/heads/main";
  rem.index = commitFiles(rem, rem.refs[ref]);
  for(const p in files){ if(files[p] === null) delete rem.index[p]; else rem.index[p] = files[p]; }
  rem.now = Math.max(rem.now, R.now) + 3600;
  const id = doCommit(rem, msg, [rem.refs[ref]]);
  rem.refs[ref] = id;
  logRef(rem, ref, null, id, "commit: " + msg);
  return id;
}

/* ── помощники проверок ────────────────────────────────── */
const ran   = (st, re) => st.log.some(e => re.test(e.cmd));
const okRan = (st, re) => st.log.some(e => !e.err && re.test(e.cmd));
const msgs  = st => history(st.R, headId(st.R)).map(c => obj(st.R, c).msg);
const files = st => commitFiles(st.R, headId(st.R));
const work  = st => st.R.work;
const hasBranch = (st, b) => !!st.R.refs["refs/heads/" + b];
const tipMsg = st => { const h = headId(st.R); return h ? obj(st.R, h).msg : null; };
const parentsOf = (st, id) => obj(st.R, id || headId(st.R)).parents;
const linear = st => history(st.R, headId(st.R)).every(c => obj(st.R, c).parents.length <= 1);
const clean = st => { const s = statusSets(st.R); return !s.staged.length && !s.unstaged.length; };
const staged = st => statusSets(st.R).staged.map(x => x.p);
const untracked = st => statusSets(st.R).untracked;

const MODULES = [

/* ------------------------------------------------ 1 */
{
n:1, id:"three", title:"Три дерева", sub:"Рабочая копия, индекс, HEAD",
lede:"Почти все недоумения новичка растут из одного места: в git не два состояния файла, а три. Пока это не уложилось, «почему не закоммитилось» будет повторяться.",
theory:`
<h2>Три состояния, а не два</h2>
<div class="tw"><table>
<tr><th>Дерево</th><th>Что это</th><th>Кто меняет</th></tr>
<tr><td><b>Рабочая копия</b></td><td>файлы на диске, которые вы правите</td><td>редактор</td></tr>
<tr><td><b>Индекс</b> (staging area)</td><td>черновик следующего коммита</td><td><code>git add</code></td></tr>
<tr><td><b>HEAD</b></td><td>последний коммит текущей ветки</td><td><code>git commit</code></td></tr>
</table></div>
<p>Изменение файла не попадает в коммит само. Путь всегда один и тот же: правка → <code>git add</code> → <code>git commit</code>. Пропустили <code>add</code> — коммит уйдёт без вашей правки, и это самая частая причина «я же исправил, а в ветке старое».</p>

<figure class="fig"><svg viewBox="0 0 640 168" role="img" aria-label="Схема трёх деревьев">
<rect x="8" y="34" width="170" height="72" rx="3" fill="none" stroke="currentColor" stroke-width="1"/>
<rect x="235" y="34" width="170" height="72" rx="3" fill="none" stroke="currentColor" stroke-width="1"/>
<rect x="462" y="34" width="170" height="72" rx="3" fill="none" stroke="currentColor" stroke-width="1"/>
<text x="93" y="22" text-anchor="middle" font-size="11" fill="currentColor">рабочая копия</text>
<text x="320" y="22" text-anchor="middle" font-size="11" fill="currentColor">индекс</text>
<text x="547" y="22" text-anchor="middle" font-size="11" fill="currentColor">HEAD</text>
<text x="93" y="64" text-anchor="middle" font-size="12" fill="currentColor">файлы на диске</text>
<text x="93" y="84" text-anchor="middle" font-size="11" fill="currentColor">их правит редактор</text>
<text x="320" y="64" text-anchor="middle" font-size="12" fill="currentColor">черновик коммита</text>
<text x="320" y="84" text-anchor="middle" font-size="11" fill="currentColor">что войдёт в него</text>
<text x="547" y="64" text-anchor="middle" font-size="12" fill="currentColor">последний коммит</text>
<text x="547" y="84" text-anchor="middle" font-size="11" fill="currentColor">уже в истории</text>
<line x1="180" y1="58" x2="232" y2="58" stroke="currentColor" stroke-width="1" marker-end="url(#ah)"/>
<line x1="407" y1="58" x2="459" y2="58" stroke="currentColor" stroke-width="1" marker-end="url(#ah)"/>
<line x1="459" y1="88" x2="407" y2="88" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#ah)"/>
<line x1="232" y1="88" x2="180" y2="88" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#ah)"/>
<text x="206" y="52" text-anchor="middle" font-size="10" fill="currentColor">add</text>
<text x="433" y="52" text-anchor="middle" font-size="10" fill="currentColor">commit</text>
<text x="433" y="104" text-anchor="middle" font-size="10" fill="currentColor">restore --staged</text>
<text x="206" y="104" text-anchor="middle" font-size="10" fill="currentColor">restore</text>
<defs><marker id="ah" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
<path d="M0,0 L6,3 L0,6 z" fill="currentColor"/></marker></defs>
</svg><figcaption>Вправо — команды продвижения, влево пунктиром — отмена. Обратите внимание: обе отменяющие команды называются <code>restore</code> и различаются одним ключом.</figcaption></figure>

<h2>Читать <code>git status</code></h2>
<pre><code>$ <span class="k">git status --short</span>
<span class="g">A</span><span class="c2">M</span> forms.py     <span class="c"># добавлен в индекс, потом изменён снова</span>
<span class="c2"> M</span> render.py    <span class="c"># изменён, но не добавлен</span>
<span class="q">??</span> notes.txt    <span class="c"># git о нём вообще не знает</span></code></pre>
<p>Две колонки — это ровно наши три дерева: первая говорит «индекс против HEAD», вторая — «рабочая копия против индекса». Строка <code>AM</code> означает, что вы добавили файл, а потом правили дальше, и коммит возьмёт только первую версию.</p>
<div class="note ok"><b class="hd">Проверьте руками</b><p>Внизу настоящий терминал с настоящим git. Наберите <code>echo "один" &gt; a.txt</code>, затем <code>git add a.txt</code>, затем <code>echo "два" &gt; a.txt</code> и <code>git status --short</code>. Строка <code>AM</code> — самое наглядное доказательство, что индекс существует отдельно.</p></div>

<h2>Отмена на каждом уровне</h2>
<div class="tw"><table>
<tr><th>Что нужно</th><th>Команда</th><th>Что теряется</th></tr>
<tr><td>Убрать из индекса, правку сохранить</td><td><code>git restore --staged file</code></td><td>ничего</td></tr>
<tr><td>Выбросить правку в файле</td><td><code>git restore file</code></td><td><b>правка, безвозвратно</b></td></tr>
<tr><td>Посмотреть, что уйдёт в коммит</td><td><code>git diff --staged</code></td><td>—</td></tr>
<tr><td>Посмотреть, что ещё не добавлено</td><td><code>git diff</code></td><td>—</td></tr>
</table></div>
<div class="note trap"><b class="hd">Единственная по-настоящему опасная команда здесь</b><p><code>git restore file</code> (старая форма — <code>git checkout -- file</code>) затирает содержимое файла версией из индекса. Эта правка нигде не сохранена, её не вернёт ни reflog, ни что-либо ещё: git её просто никогда не видел. Всё остальное в git обратимо, а это — нет.</p></div>

<h2><code>git add .</code> и почему это не всегда хорошо</h2>
<p>Точка добавляет всё незаигнорированное. Быстро — и поэтому в коммиты регулярно уезжает то, чего там быть не должно: отладочный вывод, локальный конфиг, случайный файл. Привычка сначала посмотреть <code>git status</code>, а лучше <code>git diff</code>, окупается на первом же ревью.</p>
`,
quiz:[
 {q:"Правку сделали, но <code>git add</code> не сделали. Что попадёт в коммит?",
  opts:["Правка попадёт: git видит файл","Ничего из этой правки — коммит собирается из индекса","Коммит не создастся","Git спросит подтверждение"],
  a:1, why:"Коммит — это снимок индекса, а не рабочей копии. Файл без <code>add</code> уйдёт в коммит в прежнем виде или не уйдёт вовсе."},
 {q:"<code>git status --short</code> показал <code>AM forms.py</code>. Что это значит?",
  opts:["Файл добавлен и не менялся","Файл добавлен в индекс, а потом изменён снова — коммит возьмёт первую версию","Конфликт","Файл удалён"],
  a:1, why:"Первая колонка — индекс против HEAD, вторая — рабочая копия против индекса. Нужна свежая версия — <code>git add</code> ещё раз."},
 {q:"Что делает <code>git restore --staged file</code>?",
  opts:["Удаляет файл","Убирает файл из индекса, правку в файле сохраняет","Отменяет коммит","Возвращает файл к версии из HEAD"],
  a:1, why:"Меняется только индекс. Без <code>--staged</code> та же команда затирает саму правку — это уже необратимо."},
 {q:"Какая из этих команд теряет данные безвозвратно?",
  opts:["<code>git restore --staged file</code>","<code>git restore file</code>","<code>git reset --soft</code>","<code>git add .</code>"],
  a:1, why:"Правка в рабочей копии нигде не сохранялась — git её не видел, поэтому вернуть нечего. Остальное восстанавливается."},
 {q:"Чем <code>git diff</code> отличается от <code>git diff --staged</code>?",
  opts:["Ничем","<code>diff</code> сравнивает рабочую копию с индексом, <code>--staged</code> — индекс с HEAD","<code>--staged</code> показывает все коммиты","<code>diff</code> работает только с ветками"],
  a:1, why:"То есть первый показывает «что ещё не добавлено», второй — «что уйдёт в коммит». Разные вопросы."},
 {q:"Почему <code>git add .</code> считают рискованной привычкой?",
  opts:["Она медленная","Добавляет всё подряд — в коммит уезжает отладка, локальный конфиг, случайные файлы","Она устарела","Она ломает индекс"],
  a:1, why:"Лечится не запретом, а привычкой смотреть <code>git status</code> и <code>git diff</code> перед коммитом."}
],
labs:[
 {id:"1a", title:"Увидеть индекс",
  brief:"<p>Докажите, что индекс — отдельное состояние.</p><ul><li>создайте файл <code>notes.txt</code> со строкой <code>первая версия</code>;</li><li>добавьте его в индекс;</li><li>измените файл на <code>вторая версия</code>, <b>не</b> добавляя заново;</li><li>сделайте коммит с сообщением <code>заметки</code>.</li></ul><p>В коммит должна попасть <b>первая</b> версия, а вторая — остаться незакоммиченной правкой.</p>",
  hint:'echo "первая версия" > notes.txt, затем git add notes.txt, затем echo "вторая версия" > notes.txt',
  setup: R => { sc(R, "chore: заготовка проекта", {"README.md": "# webapp"}); },
  checks:[
   {label:"Коммит создан", test:st=>msgs(st).indexOf("заметки") >= 0},
   {label:"В коммите — <b>первая</b> версия", test:st=>files(st)["notes.txt"] === "первая версия"},
   {label:"В рабочей копии — вторая", test:st=>work(st)["notes.txt"] === "вторая версия"},
   {label:"Правка осталась незакоммиченной", test:st=>!clean(st)}
  ]},
 {id:"1b", title:"Отменить на нужном уровне",
  brief:"<p>В индекс по ошибке попал <code>debug.log</code>, а в <code>app.py</code> вы наоставляли отладочных строк.</p><ul><li>уберите <code>debug.log</code> из индекса, <b>не удаляя</b> сам файл;</li><li>верните <code>app.py</code> к версии из последнего коммита;</li><li>убедитесь через <code>git status</code>, что осталось.</li></ul>",
  hint:"Для индекса — git restore --staged, для содержимого файла — git restore без ключа.",
  setup: R => {
    sc(R, "feat: приложение", {"app.py": "def main():\n    return 1"});
    R.work["app.py"] = "def main():\n    print('отладка')\n    return 1";
    R.work["debug.log"] = "шум";
    R.index["debug.log"] = "шум";
  },
  checks:[
   {label:"<code>debug.log</code> убран из индекса", test:st=>staged(st).indexOf("debug.log") < 0},
   {label:"Файл при этом не удалён с диска", test:st=>work(st)["debug.log"] !== undefined && staged(st).indexOf("debug.log") < 0},
   {label:"<code>app.py</code> вернулся к версии из коммита", test:st=>work(st)["app.py"] === files(st)["app.py"]},
   {label:"Использован <code>git restore</code>", test:st=>okRan(st,/git\s+restore|git\s+checkout\s+--/)}
  ]}
],
iv:[
 {q:"Что такое индекс и зачем он нужен?",
  probe:"Базовый вопрос. Ответ «это staging area» без объяснения смысла считают заученным.",
  a:"Индекс — это черновик следующего коммита, отдельное состояние между файлами на диске и историей. Коммит собирается именно из него, а не из рабочей копии, поэтому правка без <code>git add</code> в коммит не попадёт. Смысл этой прослойки в том, что она позволяет собрать коммит не из всего, что накопилось, а из осмысленной части: вы поправили три вещи, а закоммитить хотите одну — добавляете только её, а остальное остаётся в работе. Ровно за этим существует и <code>git add -p</code>, который добавляет отдельные куски одного файла. На практике я смотрю <code>git diff --staged</code> перед коммитом: он показывает то, что действительно уйдёт, и это последний момент заметить забытую отладочную строку.",
  more:["Что делает git add -p?","Как посмотреть, что уйдёт в коммит?"]},
 {q:"Какие команды git необратимы?",
  probe:"Проверяют, понимаете ли вы, где настоящая опасность, а где её раздули.",
  a:"Их мало, и это важно понимать: почти всё в git обратимо, потому что коммиты остаются в базе объектов и находятся через reflog. По-настоящему теряются только данные, которых git никогда не видел. Первое — <code>git restore &lt;файл&gt;</code>, он же старый <code>git checkout -- &lt;файл&gt;</code>: затирает правку в рабочей копии, а она нигде не сохранялась. Второе — <code>git clean -f</code>: удаляет неотслеживаемые файлы. Третье — <code>git reset --hard</code> в части незакоммиченных изменений; сами коммиты при этом никуда не деваются и возвращаются через <code>git reset --hard ORIG_HEAD</code> или reflog. А вот <code>git push --force</code> опасен по-другому: локально всё цело, но вы затираете чужую работу на сервере.",
  more:["Как вернуться после reset --hard?","Чем force-with-lease лучше force?"]}
]
},
