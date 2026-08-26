/* Эталонные решения заданий. check.js прогоняет их и требует 100% пройденных проверок. */
const SOL = {

"1a": `struct Pt { public int X; }
class Box { public int V; }

var p1 = new Pt(); p1.X = 1;
var p2 = p1; p2.X = 99;
Console.WriteLine(p1.X);

var b1 = new Box(); b1.V = 1;
var b2 = b1; b2.V = 99;
Console.WriteLine(b1.V);`,

"1b": `struct S { public List<int> L; }

var a = new S();
a.L = new List<int>();
var b = a;
b.L.Add(1);
Console.WriteLine(a.L.Count);`,

"2a": `string s = "тест";
s.ToUpper();
Console.WriteLine(s);
s = s.ToUpper();
Console.WriteLine(s);
Console.WriteLine("hi" == "h" + "i");`,

"2b": `bool Empty(string s) {
    return string.IsNullOrWhiteSpace(s);
}

Console.WriteLine(Empty(null));
Console.WriteLine(Empty(""));
Console.WriteLine(Empty("   "));
Console.WriteLine(Empty("текст"));`,

"3a": `var prices = new Dictionary<string,int>();
prices.Add("мышь", 1900);
prices.Add("клавиатура", 4900);

if (prices.TryGetValue("мышь", out int p)) Console.WriteLine(p);
if (prices.TryGetValue("стол", out int q)) Console.WriteLine(q);
else Console.WriteLine("нет такого");`,

"3b": `var list = new List<int> { 1, -2, 3, -4, 5 };
list.RemoveAll(x => x < 0);
Console.WriteLine(string.Join(", ", list));`,

"4a": `var list = new List<int> { 1, 2 };
var lazy = list.Where(x => x > 0);
var eager = list.Where(x => x > 0).ToList();
list.Add(3);
Console.WriteLine(lazy.Count());
Console.WriteLine(eager.Count);`,

"4b": `var words = new List<string> { "да", "нет", "эх", "код", "тест" };
foreach (var g in words.GroupBy(w => w.Length).OrderBy(g2 => g2.Key))
    Console.WriteLine(g.Key + ": " + g.Count());`,

"4c": `class User { public string Name; public int Age; }

var ok = new List<User> {
    new User { Name = "Ким", Age = 30 },
    new User { Name = "Ли",  Age = 41 }
};
var dup = new List<User> {
    new User { Name = "Ким", Age = 30 },
    new User { Name = "Ким", Age = 55 }
};

try { Console.WriteLine(ok.Single(u => u.Name == "Ким").Age); }
catch (Exception e) { Console.WriteLine("ошибка"); }

try { Console.WriteLine(dup.Single(u => u.Name == "Ким").Age); }
catch (Exception e) { Console.WriteLine("ошибка"); }`,

"5a": `class Account {
    private int _balance;
    public int Balance {
        get { return _balance; }
        set {
            if (value < 0) throw new ArgumentException("баланс не бывает отрицательным");
            _balance = value;
        }
    }
}

var a = new Account();
a.Balance = 100;
Console.WriteLine(a.Balance);
try { a.Balance = -5; }
catch (ArgumentException e) { Console.WriteLine("отказ"); }`,

"5b": `class Order {
    public int Id { get; }
    public string Comment { get; set; }
    public Order(int id) { Id = id; }
}

var o = new Order(77) { Comment = "срочно" };
Console.WriteLine(o.Id + ": " + o.Comment);`,

"6a": `class Step {
    public virtual string Name() { return "шаг"; }
}

class Click : Step {
    public override string Name() { return "клик по " + base.Name(); }
}

Step s = new Click();
Console.WriteLine(s.Name());`,

"6b": `class B { public virtual string W() { return "B"; } }
class D1 : B { public override string W() { return "D1"; } }
class D2 : B { public new string W() { return "D2"; } }

B x = new D1();
B y = new D2();
Console.WriteLine(x.W());
Console.WriteLine(y.W());`,

"7a": `interface ILogger { void Log(string m); }

class Service {
    private ILogger _log;
    public Service(ILogger log) { _log = log; }
    public void Run() { _log.Log("запуск"); }
}

class FakeLogger : ILogger {
    public List<string> Lines = new List<string>();
    public void Log(string m) { Lines.Add(m); }
}

var fake = new FakeLogger();
var svc = new Service(fake);
svc.Run();
Console.WriteLine(fake.Lines.Count);
Console.WriteLine(fake.Lines[0]);`,

"7b": `interface IRunnable { string Run(); }
class A : IRunnable { public string Run() { return "бегу"; } }
class B { }
class C : IRunnable { public string Run() { return "бегу"; } }

var items = new List<object> { new A(), new B(), new C() };

foreach (var it in items) {
    if (it is IRunnable r) Console.WriteLine(r.Run());
    else Console.WriteLine("пропуск");
}`,

"8a": `class Addr { public string City; }
class User { public Addr Addr; }

var full = new User { Addr = new Addr { City = "Алматы" } };
var noCity = new User { Addr = new Addr() };
var noAddr = new User();

Console.WriteLine(full?.Addr?.City ?? "город не указан");
Console.WriteLine(noCity?.Addr?.City ?? "город не указан");
Console.WriteLine(noAddr?.Addr?.City ?? "город не указан");`,

"8b": `class Order { public string Name = "заказ №1"; }

string Title(Order o) {
    if (o == null) throw new ArgumentNullException(nameof(o));
    return o.Name;
}

Console.WriteLine(Title(new Order()));
try { Console.WriteLine(Title(null)); }
catch (ArgumentNullException e) { Console.WriteLine("аргумент"); }`,

"9a": `int F() {
    try { return 1; }
    finally { Console.WriteLine("finally"); }
}

Console.WriteLine(F());`,

"9b": `class ElementNotFoundException : Exception {
    public ElementNotFoundException(string selector)
        : base("элемент не найден: " + selector) { }
}

string Find(string selector) {
    if (selector != "#ok") throw new ElementNotFoundException(selector);
    return "найден";
}

Console.WriteLine(Find("#ok"));
try { Console.WriteLine(Find("#нет")); }
catch (ElementNotFoundException e) { Console.WriteLine(e.Message); }`,

"10a": `async Task Work() {
    Console.WriteLine(2);
    await Task.Delay(10);
    Console.WriteLine(4);
}

Console.WriteLine(1);
var t = Work();
Console.WriteLine(3);
await t;
Console.WriteLine(5);`,

"10b": `async Task<int> Slow(string name, int ms) {
    await Task.Delay(ms);
    Console.WriteLine(name + ": готово");
    return ms;
}

var t1 = Slow("A", 40);
var t2 = Slow("B", 30);
await Task.WhenAll(t1, t2);
Console.WriteLine(t1.Result + t2.Result);`,

"11a": `class Res : IDisposable {
    private string _n;
    public Res(string n) { _n = n; Console.WriteLine("открыт " + n); }
    public void Dispose() { Console.WriteLine("закрыт " + _n); }
}

using (var a = new Res("A"))
using (var b = new Res("B")) {
    Console.WriteLine("тело");
}`,

"11b": `class Res : IDisposable {
    private string _n;
    public Res(string n) { _n = n; Console.WriteLine("открыт " + n); }
    public void Dispose() { Console.WriteLine("закрыт " + _n); }
}

try {
    using (var r = new Res("A")) {
        throw new InvalidOperationException("сбой");
    }
}
catch (Exception e) { Console.WriteLine("поймали"); }`,

"12a": `Console.WriteLine(7 / 2);
Console.WriteLine((double)7 / 2);
Console.WriteLine((double)(7 / 2));
Console.WriteLine(0.1 + 0.2 == 0.3);`,

"12b": `var bad = new List<Func<int>>();
var good = new List<Func<int>>();

for (int i = 0; i < 3; i++) bad.Add(() => i);
for (int i = 0; i < 3; i++) { int c = i; good.Add(() => c); }

Console.WriteLine(string.Join(" ", bad.Select(f => f())));
Console.WriteLine(string.Join(" ", good.Select(f => f())));`,

"12c": `void Swap(ref int a, ref int b) {
    int t = a; a = b; b = t;
}

bool TryHalf(int n, out int half) {
    if (n % 2 == 0) { half = n / 2; return true; }
    half = 0;
    return false;
}

int p = 1, q = 2;
Swap(ref p, ref q);
Console.WriteLine(p + "," + q);

bool ok1 = TryHalf(8, out int h1);
Console.WriteLine(ok1 + " " + h1);
bool ok2 = TryHalf(7, out int h2);
Console.WriteLine(ok2 + " " + h2);`

};
