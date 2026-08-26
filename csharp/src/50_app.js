/* ============================================================
   Приложение
   ============================================================ */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if(c) n.className = c; if(h !== undefined) n.innerHTML = h; return n; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "csharp.v1";

/* ── прогресс ─────────────────────────────────────────── */
let P = {mod:0, quiz:{}, labs:{}};
try{ const s = localStorage.getItem(KEY); if(s) P = Object.assign(P, JSON.parse(s)); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(P)); }catch(e){} };

/* ── состояние: журнал запусков ───────────────────────── */
const ST = {log: []};

/* ── детерминированное перемешивание вариантов ────────── */
function fnv(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffled(q){
  const seed = fnv(q.q);
  const idx = q.opts.map((_,i)=>i);
  let s = seed || 1;
  for(let i = idx.length - 1; i > 0; i--){
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = (s >>> 15) % (i + 1);
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  return idx;
}

/* ── шапка и навигация ────────────────────────────────── */
const nav = $("#nav");
MODULES.forEach((m, i) => {
  const b = el("button", "", '<span class="num">' + m.n + '</span><span>' + m.title + '</span><span class="dot"></span>');
  b.type = "button";
  b.addEventListener("click", () => go(i));
  nav.appendChild(b);
});

function modDone(m){
  const q = m.quiz.every((_, i) => (P.quiz[m.id + ":" + i] || {}).ok);
  const l = m.labs.every(x => P.labs[x.id]);
  return q && l;
}
function meter(){
  let done = 0, all = 0;
  MODULES.forEach(m => {
    m.quiz.forEach((_, i) => { all++; if((P.quiz[m.id + ":" + i] || {}).ok) done++; });
    m.labs.forEach(x => { all++; if(P.labs[x.id]) done++; });
  });
  $("#mtxt").textContent = done + " / " + all;
  $("#mbar").style.width = (all ? Math.round(done / all * 100) : 0) + "%";
  [].forEach.call(nav.children, (b, i) => b.classList.toggle("done", modDone(MODULES[i])));
}

let cur = 0, tab = "theory";
function go(i){
  cur = i; P.mod = i; save();
  const m = MODULES[i];
  [].forEach.call(nav.children, (b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
  $("#msub").textContent = "Раздел " + m.n + " · " + m.sub;
  $("#mttl").textContent = m.title;
  $("#mlede").textContent = m.lede;
  $("#cq").textContent = m.quiz.length;
  $("#cl").textContent = m.labs.length;
  $("#ci").textContent = (m.iv || []).length;
  $("#ctx").textContent = "раздел " + m.n;
  renderTheory(m); renderQuiz(m); renderLabs(m); renderIv(m); renderChips(m);
  meter();
  const active = nav.children[i];
  if(active && active.scrollIntoView) active.scrollIntoView({block:"nearest", inline:"nearest"});
  window.scrollTo({top:0, behavior:"auto"});
}

$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if(!b) return;
  tab = b.dataset.tab;
  [].forEach.call($("#tabs").children, x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  ["theory","quiz","labs","iv"].forEach(t => $("#pane-" + t).hidden = (t !== tab));
});

/* ── теория ───────────────────────────────────────────── */
function renderTheory(m){ $("#pane-theory").innerHTML = m.theory; }

/* ── вопросы ──────────────────────────────────────────── */
function renderQuiz(m){
  const pane = $("#pane-quiz"); pane.innerHTML = "";
  const sum = el("div", "qsum");
  pane.appendChild(sum);
  m.quiz.forEach((q, qi) => {
    const key = m.id + ":" + qi;
    const order = shuffled(q);
    const card = el("div", "qc");
    const head = el("div", "qq", '<span class="qn">' + (qi + 1) + '</span><span class="qt">' + q.q + '</span>');
    const opts = el("div", "qo");
    card.appendChild(head); card.appendChild(opts);
    const why = el("div", "qw", '<span class="lbl">Почему</span>' + q.why);
    why.hidden = true;
    card.appendChild(why);
    const btns = [];
    order.forEach((orig, pos) => {
      const b = el("button", "", '<span class="ltr">' + "ABCD"[pos] + '</span><span>' + q.opts[orig] + '</span>');
      b.type = "button"; b.dataset.orig = orig;
      b.addEventListener("click", () => answer(orig));
      opts.appendChild(b); btns.push(b);
    });
    function paint(chosen){
      btns.forEach(b => {
        const o = +b.dataset.orig;
        b.disabled = true;
        b.classList.toggle("good", o === q.a);
        b.classList.toggle("bad", o === chosen && o !== q.a);
      });
      why.hidden = false;
      card.classList.add(chosen === q.a ? "right" : "wrong");
    }
    function answer(chosen){
      if(P.quiz[key]) return;
      P.quiz[key] = {ok: chosen === q.a, pick: chosen};
      save(); paint(chosen); tally(); meter();
    }
    if(P.quiz[key]) paint(P.quiz[key].pick);
    pane.appendChild(card);
  });
  function tally(){
    let done = 0, ok = 0;
    m.quiz.forEach((_, i) => { const r = P.quiz[m.id + ":" + i]; if(r){ done++; if(r.ok) ok++; } });
    sum.innerHTML = "отвечено <b>" + done + "</b> из <b>" + m.quiz.length + "</b> · верно <b>" + ok + "</b>";
  }
  tally();
}

/* ── задания ──────────────────────────────────────────── */
const labNodes = [];
function renderLabs(m){
  const pane = $("#pane-labs"); pane.innerHTML = ""; labNodes.length = 0;
  m.labs.forEach(lab => {
    const card = el("div", "lab");
    const head = el("div", "labh",
      '<span class="id">' + lab.id + '</span><span class="nm">' + lab.title + '</span><span class="st"></span>');
    const body = el("div", "labb", lab.brief);
    const list = el("ul", "chk");
    lab.checks.forEach(c => list.appendChild(el("li", "", '<span class="bx">✓</span><span>' + c.label + '</span>')));
    body.appendChild(list);

    const act = el("div", "labact");
    const load = el("button", "btn pri", "Взять заготовку"); load.type = "button";
    load.addEventListener("click", () => {
      codeBox.value = lab.start || "";
      codeBox.focus();
      codeBox.setSelectionRange(codeBox.value.length, codeBox.value.length);
      status("заготовка задания " + lab.id + " в редакторе");
      document.querySelector(".dock").scrollIntoView({block:"nearest"});
    });
    const hb = el("button", "btn", "Подсказка"); hb.type = "button";
    const hint = el("div", "hintbox", lab.hint); hint.hidden = true;
    hb.addEventListener("click", () => { hint.hidden = !hint.hidden; });
    act.appendChild(load); act.appendChild(hb);

    const done = el("div", "lab-done", '<span>✓</span><span>задание выполнено</span>');
    done.hidden = true;
    card.appendChild(head); card.appendChild(body); card.appendChild(act); card.appendChild(hint); card.appendChild(done);
    pane.appendChild(card);
    labNodes.push({lab, card, head, list, done});
  });
  scoreLabs();
}

function evalCheck(c){ try{ return !!c.test(ST); }catch(e){ return false; } }

function scoreLabs(){
  let changed = false;
  MODULES.forEach(m => m.labs.forEach(lab => {
    const hits = P.labs[lab.id] ? lab.checks.map(()=>true) : lab.checks.map(evalCheck);
    if(hits.every(Boolean) && !P.labs[lab.id]){ P.labs[lab.id] = true; changed = true; }
    lab.__hits = P.labs[lab.id] ? lab.checks.map(()=>true) : hits;
  }));
  if(changed) save();
  labNodes.forEach(n => {
    const hits = n.lab.__hits || [];
    const got = hits.filter(Boolean).length;
    [].forEach.call(n.list.children, (li, i) => li.classList.toggle("hit", !!hits[i]));
    n.head.querySelector(".st").textContent = got + " / " + n.lab.checks.length;
    const ok = got === n.lab.checks.length;
    n.card.classList.toggle("done", ok);
    n.done.hidden = !ok;
  });
  meter();
}

/* ── собеседование ────────────────────────────────────── */
function renderIv(m){
  const pane = $("#pane-iv"); pane.innerHTML = "";
  (m.iv || []).forEach((c, i) => {
    const card = el("div", "ivc");
    const q = el("div", "ivq",
      '<span class="qn">' + (i + 1) + '</span><span class="qt">' + c.q + '</span><span class="tog">показать</span>');
    const body = el("div", "ivb");
    body.appendChild(el("div", "ivp", "<b>Что проверяют</b>" + c.probe));
    body.appendChild(el("div", "iva", c.a));
    if(c.more && c.more.length)
      body.appendChild(el("div", "ivm", "<b>Уточняющие вопросы, которые последуют</b><ul>" +
        c.more.map(x => "<li>" + x + "</li>").join("") + "</ul>"));
    body.hidden = true;
    q.addEventListener("click", () => {
      body.hidden = !body.hidden;
      q.querySelector(".tog").textContent = body.hidden ? "показать" : "скрыть";
    });
    card.appendChild(q); card.appendChild(body);
    pane.appendChild(card);
  });
}

/* ── справочник по возможностям движка ────────────────── */
const REF = [
  ["Объявления", "<p>Операторы верхнего уровня без <code>Main</code>. <code>class</code>, <code>struct</code>, <code>interface</code>, <code>enum</code>, наследование одного класса и любого числа интерфейсов.</p>"],
  ["Члены типов", "<p>Поля, авто-свойства и свойства с телом (<code>get</code>/<code>set</code> с <code>value</code>), выражения-свойства через <code>=&gt;</code>, конструкторы с <code>: base(...)</code> и <code>: this(...)</code>, статические методы, <code>virtual</code>, <code>abstract</code>, <code>override</code>, <code>new</code>.</p>"],
  ["Операторы", "<p><code>if</code>, <code>while</code>, <code>do</code>, <code>for</code>, <code>foreach</code>, <code>switch</code>, <code>break</code>, <code>continue</code>, <code>return</code>, <code>throw</code>, <code>try/catch/finally</code>, <code>using</code>, локальные функции и лямбды.</p>"],
  ["Выражения", "<p>Арифметика с целочисленным делением, <code>?:</code>, <code>??</code>, <code>??=</code>, <code>?.</code>, <code>is</code> с образцом, <code>as</code>, приведение типов, <code>nameof</code>, <code>typeof</code>, интерполяция <code>$\"…\"</code>, <code>ref</code> и <code>out</code>.</p>"],
  ["Коллекции", "<p><code>List&lt;T&gt;</code>, массивы, <code>Dictionary&lt;K,V&gt;</code>, <code>StringBuilder</code>. Инициализаторы объектов и коллекций.</p>"],
  ["LINQ", "<p><code>Where</code>, <code>Select</code>, <code>SelectMany</code>, <code>OrderBy</code>, <code>OrderByDescending</code>, <code>GroupBy</code>, <code>Take</code>, <code>Skip</code>, <code>Distinct</code>, <code>Reverse</code> — отложенные. <code>ToList</code>, <code>ToArray</code>, <code>ToDictionary</code>, <code>Count</code>, <code>Any</code>, <code>All</code>, <code>First</code>, <code>Single</code>, <code>Last</code>, <code>Sum</code>, <code>Min</code>, <code>Max</code>, <code>Average</code> и варианты с <code>OrDefault</code> — немедленные.</p>"],
  ["Строки", "<p><code>Length</code>, <code>ToUpper</code>, <code>ToLower</code>, <code>Trim</code>, <code>Substring</code>, <code>Replace</code>, <code>Split</code>, <code>Contains</code>, <code>StartsWith</code>, <code>EndsWith</code>, <code>IndexOf</code>, <code>PadLeft</code>, <code>PadRight</code>, <code>string.Join</code>, <code>string.Format</code>, <code>string.IsNullOrEmpty</code>, <code>string.IsNullOrWhiteSpace</code>.</p>"],
  ["Асинхронность", "<p><code>async</code>/<code>await</code>, <code>Task</code>, <code>Task&lt;T&gt;</code>, <code>Task.Delay</code>, <code>Task.Run</code>, <code>Task.WhenAll</code>, <code>Task.FromResult</code>, <code>Result</code>. Планировщик виртуальный: задержки не занимают реального времени.</p>"],
  ["Исключения", "<p>Стандартные типы и собственные наследники <code>Exception</code>. Перехват по типу, порядок блоков, <code>finally</code> при любом выходе, <code>Message</code>.</p>"],
  ["Чего нет", "<p>Пространств имён, <code>partial</code>, атрибутов, событий, обобщённых пользовательских типов, рефлексии, настоящих потоков, файлов и сети. Числа с плавающей точкой считаются как <code>double</code>.</p>"]
];
function renderRef(){
  const box = $("#ref"); box.innerHTML = "";
  $("#rn").textContent = REF.length;
  REF.forEach((r, i) => {
    const d = el("details");
    if(i === 0) d.open = true;
    d.appendChild(el("summary", "", esc(r[0])));
    d.appendChild(el("div", "rd", r[1]));
    box.appendChild(d);
  });
}

/* ── редактор ─────────────────────────────────────────── */
const outBox = $("#out"), codeBox = $("#code");
function status(t, kind){
  const n = $("#dst");
  n.textContent = t;
  n.className = "st" + (kind ? " " + kind : "");
}

function renderResult(r){
  outBox.innerHTML = "";
  const lines = (r.out || []);
  if(!lines.length && !r.error){
    outBox.appendChild(el("p", "empty", "программа ничего не вывела"));
    return;
  }
  lines.forEach((s, i) => {
    outBox.appendChild(el("div", "line",
      '<span class="ln">' + (i + 1) + '</span><span class="tx">' + esc(s) + '</span>'));
  });
  if(r.error){
    let t = r.error;
    if(r.line) t += "\nстрока " + r.line;
    outBox.appendChild(el("div", "err", esc(t)));
  }
  const note = r.error
    ? "выполнение прервано"
    : lines.length + (lines.length === 1 ? " строка вывода" : lines.length < 5 ? " строки вывода" : " строк вывода");
  outBox.appendChild(el("div", "note", note));
}

function run(){
  const code = codeBox.value;
  if(!code.trim()){ status("пустой редактор"); return; }
  let r;
  try{ r = runCs(code); }
  catch(e){ r = {out: [], error: "внутренняя ошибка: " + (e && e.message || e)}; }
  ST.log.push({code, out: r.out || [], error: r.error || null});
  if(ST.log.length > 300) ST.log.splice(0, ST.log.length - 300);
  renderResult(r);
  status(r.error ? (r.phase === "разбор" ? "ошибка разбора" : "ошибка выполнения") : "выполнено",
         r.error ? "err" : "ok");
  scoreLabs();
}
$("#run").addEventListener("click", run);
codeBox.addEventListener("keydown", e => {
  if((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); run(); return; }
  if(e.key === "Tab"){
    e.preventDefault();
    const s = codeBox.selectionStart, t = codeBox.selectionEnd;
    codeBox.value = codeBox.value.slice(0, s) + "    " + codeBox.value.slice(t);
    codeBox.selectionStart = codeBox.selectionEnd = s + 4;
  }
});
$("#clear").addEventListener("click", () => {
  outBox.innerHTML = '<p class="empty">вывод появится здесь</p>';
  status("вывод очищен");
});

/* ── примеры под каждый раздел ────────────────────────── */
const CHIPS = {
  types: [
    ["структура копируется", 'struct Pt { public int X; }\n\nvar a = new Pt(); a.X = 1;\nvar b = a; b.X = 99;\nConsole.WriteLine(a.X);'],
    ["класс — нет", 'class Box { public int V; }\n\nvar a = new Box(); a.V = 1;\nvar b = a; b.V = 99;\nConsole.WriteLine(a.V);'],
    ["ссылка внутри структуры", 'struct S { public List<int> L; }\n\nvar a = new S(); a.L = new List<int>();\nvar b = a; b.L.Add(1);\nConsole.WriteLine(a.L.Count);']
  ],
  strings: [
    ["метод не меняет строку", 'string s = "привет";\ns.ToUpper();\nConsole.WriteLine(s);\ns = s.ToUpper();\nConsole.WriteLine(s);'],
    ["== сравнивает содержимое", 'Console.WriteLine("hi" == "h" + "i");'],
    ["пустая и пробельная", 'Console.WriteLine(string.IsNullOrEmpty("   "));\nConsole.WriteLine(string.IsNullOrWhiteSpace("   "));']
  ],
  collections: [
    ["ключа нет", 'var d = new Dictionary<string,int>();\nd.Add("a", 1);\nConsole.WriteLine(d["нет"]);'],
    ["TryGetValue", 'var d = new Dictionary<string,int>();\nd.Add("a", 1);\nif (d.TryGetValue("нет", out int v)) Console.WriteLine(v);\nelse Console.WriteLine("нет ключа");'],
    ["удаление в foreach", 'var l = new List<int> { 1, -2, 3 };\nforeach (var x in l) if (x < 0) l.Remove(x);']
  ],
  linq: [
    ["запрос ленив", 'var l = new List<int> { 1, 2 };\nvar q = l.Where(x => x > 0);\nl.Add(3);\nConsole.WriteLine(q.Count());'],
    ["группировка", 'var w = new List<string> { "да", "нет", "эх" };\nforeach (var g in w.GroupBy(x => x.Length))\n    Console.WriteLine(g.Key + ": " + g.Count());'],
    ["First на пустом", 'var l = new List<int>();\nConsole.WriteLine(l.First());']
  ],
  oop: [
    ["проверка в сеттере", 'class A {\n    private int _v;\n    public int V {\n        get { return _v; }\n        set { if (value < 0) throw new ArgumentException("нет"); _v = value; }\n    }\n}\n\nvar a = new A();\na.V = 5;\nConsole.WriteLine(a.V);\na.V = -1;'],
    ["вычисляемое свойство", 'class U {\n    public int Age { get; set; }\n    public bool IsAdult => Age >= 18;\n}\n\nConsole.WriteLine(new U { Age = 17 }.IsAdult);']
  ],
  inherit: [
    ["полиморфизм", 'class Step { public virtual string Name() { return "шаг"; } }\nclass Click : Step { public override string Name() { return "клик по " + base.Name(); } }\n\nStep s = new Click();\nConsole.WriteLine(s.Name());'],
    ["override против new", 'class B { public virtual string W() { return "B"; } }\nclass D1 : B { public override string W() { return "D1"; } }\nclass D2 : B { public new string W() { return "D2"; } }\n\nB x = new D1(); B y = new D2();\nConsole.WriteLine(x.W() + " " + y.W());']
  ],
  iface: [
    ["подмена реализации", 'interface ILogger { void Log(string m); }\nclass Fake : ILogger {\n    public List<string> Lines = new List<string>();\n    public void Log(string m) { Lines.Add(m); }\n}\n\nvoid Run(ILogger l) { l.Log("привет"); }\nvar f = new Fake();\nRun(f);\nConsole.WriteLine(f.Lines[0]);'],
    ["проверка типа", 'interface I { }\nclass C : I { }\nobject o = new C();\nConsole.WriteLine(o is I);\nConsole.WriteLine((o as I) != null);']
  ],
  "null": [
    ["цепочка обрывается", 'class A { public string City; }\nclass U { public A Addr; }\n\nvar u = new U();\nConsole.WriteLine(u?.Addr?.City ?? "нет города");'],
    ["Nullable", 'int? n = null;\nConsole.WriteLine(n.HasValue);\nConsole.WriteLine(n ?? -1);\nConsole.WriteLine(n.Value);']
  ],
  exceptions: [
    ["finally после return", 'int F() {\n    try { return 1; }\n    finally { Console.WriteLine("finally"); }\n}\n\nConsole.WriteLine(F());'],
    ["порядок блоков", 'try { int z = 0; Console.WriteLine(10 / z); }\ncatch (DivideByZeroException e) { Console.WriteLine("на ноль нельзя"); }\ncatch (Exception e) { Console.WriteLine("что-то другое"); }'],
    ["своё исключение", 'class MyEx : Exception { public MyEx(string m) : base(m) { } }\n\ntry { throw new MyEx("бум"); }\ncatch (MyEx e) { Console.WriteLine(e.Message); }']
  ],
  async: [
    ["порядок выполнения", 'async Task W() {\n    Console.WriteLine(2);\n    await Task.Delay(10);\n    Console.WriteLine(4);\n}\n\nConsole.WriteLine(1);\nvar t = W();\nConsole.WriteLine(3);\nawait t;\nConsole.WriteLine(5);'],
    ["одновременно", 'async Task<int> S(string n, int ms) {\n    await Task.Delay(ms);\n    Console.WriteLine(n);\n    return ms;\n}\n\nvar a = S("A", 40);\nvar b = S("B", 10);\nawait Task.WhenAll(a, b);\nConsole.WriteLine(a.Result + b.Result);']
  ],
  dispose: [
    ["порядок закрытия", 'class Res : IDisposable {\n    private string _n;\n    public Res(string n) { _n = n; Console.WriteLine("открыт " + n); }\n    public void Dispose() { Console.WriteLine("закрыт " + _n); }\n}\n\nusing (var a = new Res("A"))\nusing (var b = new Res("B")) { Console.WriteLine("тело"); }']
  ],
  tricky: [
    ["целочисленное деление", 'Console.WriteLine(7 / 2);\nConsole.WriteLine((double)7 / 2);\nConsole.WriteLine((double)(7 / 2));'],
    ["дробные числа", 'Console.WriteLine(0.1 + 0.2 == 0.3);'],
    ["замыкание в for", 'var a = new List<Func<int>>();\nfor (int i = 0; i < 3; i++) a.Add(() => i);\nforeach (var f in a) Console.Write(f() + " ");'],
    ["== у класса", 'class P { public int X; }\nvar a = new P { X = 5 };\nvar b = new P { X = 5 };\nConsole.WriteLine(a == b);']
  ]
};
function renderChips(m){
  const box = $("#chips"); box.innerHTML = "";
  (CHIPS[m.id] || []).forEach(c => {
    const b = el("button", "", esc(c[0]));
    b.type = "button"; b.title = "загрузить пример в редактор";
    b.addEventListener("click", () => {
      codeBox.value = c[1];
      codeBox.focus();
      status("пример в редакторе — нажмите «Выполнить»");
    });
    box.appendChild(b);
  });
}

/* ── тема и сброс ─────────────────────────────────────── */
$("#theme").addEventListener("click", () => {
  const r = document.documentElement;
  const now = r.getAttribute("data-theme");
  const dark = now ? now === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  r.setAttribute("data-theme", dark ? "light" : "dark");
  try{ localStorage.setItem(KEY + ".theme", dark ? "light" : "dark"); }catch(e){}
});
try{ const t = localStorage.getItem(KEY + ".theme"); if(t) document.documentElement.setAttribute("data-theme", t); }catch(e){}

$("#wipe").addEventListener("click", () => {
  P = {mod:0, quiz:{}, labs:{}};
  MODULES.forEach(m => m.labs.forEach(l => { delete l.__hits; }));
  ST.log.length = 0;
  save(); go(cur);
  outBox.innerHTML = '<p class="empty">вывод появится здесь</p>';
  status("прогресс сброшен");
});

/* ── высота нижней панели ─────────────────────────────── */
function dockH(){
  const d = document.querySelector(".dock");
  if(d) document.documentElement.style.setProperty("--dockh", d.offsetHeight + "px");
}
if(window.ResizeObserver){ const ro = new ResizeObserver(dockH); ro.observe(document.querySelector(".dock")); }
window.addEventListener("resize", dockH);
dockH();

/* ── старт ────────────────────────────────────────────── */
renderRef();
go(Math.min(Math.max(P.mod | 0, 0), MODULES.length - 1));
codeBox.value = 'struct Pt { public int X; }\nclass Box { public int V; }\n\nvar p1 = new Pt(); p1.X = 1;\nvar p2 = p1; p2.X = 99;\nConsole.WriteLine("структура: " + p1.X);\n\nvar b1 = new Box(); b1.V = 1;\nvar b2 = b1; b2.V = 99;\nConsole.WriteLine("класс: " + b1.V);';
status("готов");
})();
</script>
