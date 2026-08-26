let pass=0, fail=0;
function T(name, code, expect){
  const r = runCs(code);
  const got = (r.error ? "ОШИБКА: " + r.error : r.out.join("\n"));
  const ok = typeof expect === "function" ? expect(got, r) : got === expect;
  if(ok) pass++; else { fail++; console.log("✗ "+name+"\n    ждали: "+JSON.stringify(expect)+"\n    вышло: "+JSON.stringify(got)); }
}
const P = s => "Console.WriteLine("+s+");";

console.log("── основы");
T("вывод строки", `Console.WriteLine("привет");`, "привет");
T("арифметика", P("2 + 3 * 4"), "14");
T("целочисленное деление", P("5 / 2"), "2");
T("дробное деление", P("5.0 / 2"), "2.5");
T("остаток", P("7 % 3"), "1");
T("интерполяция", `int x = 5; Console.WriteLine($"x={x}, x+1={x+1}");`, "x=5, x+1=6");
T("bool печатается как True", P("1 < 2"), "True");
T("конкатенация числа и строки", P(`"n=" + 42`), "n=42");
T("Write без перевода строки", `Console.Write("a"); Console.Write("b"); Console.WriteLine("c");`, "abc");

console.log("── значимые и ссылочные типы");
T("class передаётся по ссылке", `
class Box { public int V; }
var a = new Box(); a.V = 1;
var b = a; b.V = 99;
Console.WriteLine(a.V);`, "99");
T("struct копируется", `
struct Pt { public int X; }
var a = new Pt(); a.X = 1;
var b = a; b.X = 99;
Console.WriteLine(a.X);`, "1");
T("struct копируется при передаче в метод", `
struct Pt { public int X; }
void Bump(Pt p) { p.X = 100; }
var a = new Pt(); a.X = 1;
Bump(a);
Console.WriteLine(a.X);`, "1");
T("class изменяется методом", `
class Box { public int V; }
void Bump(Box b) { b.V = 100; }
var a = new Box(); a.V = 1;
Bump(a);
Console.WriteLine(a.V);`, "100");
T("int копируется", `int a = 1; int b = a; b = 99; Console.WriteLine(a);`, "1");

console.log("── строки");
T("строка неизменяема", `string s = "abc"; s.ToUpper(); Console.WriteLine(s);`, "abc");
T("ToUpper возвращает новую", `string s = "abc"; Console.WriteLine(s.ToUpper());`, "ABC");
T("== сравнивает содержимое", `string a = "hi"; string b = "h" + "i"; Console.WriteLine(a == b);`, "True");
T("Length", P(`"привет".Length`), "6");
T("Substring", P(`"abcdef".Substring(1, 3)`), "bcd");
T("Split и Join", `var p = "a,b,c".Split(","); Console.WriteLine(string.Join("-", p));`, "a-b-c");
T("IsNullOrEmpty", P(`string.IsNullOrEmpty("")`), "True");

console.log("── коллекции");
T("List добавление и Count", `var l = new List<int>(); l.Add(1); l.Add(2); Console.WriteLine(l.Count);`, "2");
T("инициализатор списка", `var l = new List<int> { 1, 2, 3 }; Console.WriteLine(l[1]);`, "2");
T("массив", `int[] a = new int[] { 5, 6 }; Console.WriteLine(a[0] + a.Length);`, "7");
T("словарь", `var d = new Dictionary<string,int>(); d.Add("a", 1); Console.WriteLine(d["a"]);`, "1");
T("словарь: дубликат ключа", `var d = new Dictionary<string,int>(); d.Add("a",1); d.Add("a",2);`,
  g => g.includes("ArgumentException"));
T("словарь: нет ключа", `var d = new Dictionary<string,int>(); Console.WriteLine(d["нет"]);`,
  g => g.includes("KeyNotFoundException"));
T("выход за границы массива", `int[] a = new int[] { 1 }; Console.WriteLine(a[5]);`,
  g => g.includes("IndexOutOfRange"));
T("foreach по списку", `var l = new List<int> {1,2,3}; int s = 0; foreach (var x in l) s += x; Console.WriteLine(s);`, "6");

console.log("── LINQ");
T("Where + Select + ToList", `
var l = new List<int> { 1, 2, 3, 4 };
var r = l.Where(x => x % 2 == 0).Select(x => x * 10).ToList();
Console.WriteLine(string.Join(",", r));`, "20,40");
T("Sum с условием", `var l = new List<int>{1,2,3}; Console.WriteLine(l.Sum());`, "6");
T("Any и All", `var l = new List<int>{2,4}; Console.WriteLine(l.All(x => x % 2 == 0));`, "True");
T("OrderBy", `var l = new List<int>{3,1,2}; Console.WriteLine(string.Join(",", l.OrderBy(x => x).ToList()));`, "1,2,3");
T("First на пустом бросает", `var l = new List<int>(); Console.WriteLine(l.Where(x => x > 0).First());`,
  g => g.includes("InvalidOperationException"));
T("FirstOrDefault не бросает", `var l = new List<int>(); var v = l.FirstOrDefault(); Console.WriteLine(v == null);`, "True");
T("ОТЛОЖЕННОЕ ВЫПОЛНЕНИЕ", `
var l = new List<int> { 1, 2 };
var q = l.Where(x => x > 0);
l.Add(3);
Console.WriteLine(q.Count());`, "3");
T("ToList фиксирует результат", `
var l = new List<int> { 1, 2 };
var q = l.Where(x => x > 0).ToList();
l.Add(3);
Console.WriteLine(q.Count);`, "2");

console.log("── классы и ООП");
T("свойства", `
class P { public string Name { get; set; } }
var p = new P(); p.Name = "Иван"; Console.WriteLine(p.Name);`, "Иван");
T("конструктор", `
class P { public int A; public P(int a) { A = a; } }
Console.WriteLine(new P(7).A);`, "7");
T("вычисляемое свойство", `
class P { public int W; public int H; public int Area { get { return W * H; } } }
var p = new P(); p.W = 3; p.H = 4; Console.WriteLine(p.Area);`, "12");
T("наследование и override", `
class A { public virtual string Who() { return "A"; } }
class B : A { public override string Who() { return "B"; } }
A x = new B(); Console.WriteLine(x.Who());`, "B");
T("base вызывает родителя", `
class A { public virtual string Who() { return "A"; } }
class B : A { public override string Who() { return base.Who() + "B"; } }
Console.WriteLine(new B().Who());`, "AB");
T("ToString переопределён", `
class P { public override string ToString() { return "я P"; } }
Console.WriteLine(new P());`, "я P");
T("инициализатор объекта", `
class P { public string N { get; set; } public int A { get; set; } }
var p = new P { N = "Иван", A = 30 }; Console.WriteLine(p.N + p.A);`, "Иван30");
T("is проверяет тип", `
class A {} class B : A {}
A x = new B(); Console.WriteLine(x is B);`, "True");

console.log("── null");
T("NullReferenceException", `
class P { public string N; }
P p = null; Console.WriteLine(p.N);`, g => g.includes("NullReference"));
T("?. возвращает null", `
class P { public string N; }
P p = null; Console.WriteLine(p?.N == null);`, "True");
T("?? подставляет запасное", `string s = null; Console.WriteLine(s ?? "пусто");`, "пусто");

console.log("── исключения");
T("try/catch ловит", `
try { throw new InvalidOperationException("бум"); }
catch (InvalidOperationException e) { Console.WriteLine("поймал: " + e.Message); }`, "поймал: бум");
T("finally выполняется всегда", `
try { throw new Exception("x"); } catch (Exception e) { Console.WriteLine("catch"); } finally { Console.WriteLine("finally"); }`,
  "catch\nfinally");
T("finally при успехе", `
try { Console.WriteLine("try"); } finally { Console.WriteLine("finally"); }`, "try\nfinally");
T("catch по базовому типу", `
try { throw new ArgumentException("a"); } catch (Exception e) { Console.WriteLine("общий"); }`, "общий");
T("деление на ноль", `int a = 1, b = 0; Console.WriteLine(a / b);`, g => g.includes("DivideByZero"));

console.log("── using и IDisposable");
T("Dispose вызывается", `
class R { public string N; public R(string n) { N = n; } public void Dispose() { Console.WriteLine("dispose " + N); } }
using (var r = new R("a")) { Console.WriteLine("работа"); }`, "работа\ndispose a");
T("Dispose при исключении", `
class R { public void Dispose() { Console.WriteLine("dispose"); } }
try { using (var r = new R()) { throw new Exception("x"); } } catch (Exception e) { Console.WriteLine("поймал"); }`,
 "dispose\nпоймал");

console.log("── async");
T("порядок при await", `
async Task Work() { Console.WriteLine("2"); await Task.Delay(10); Console.WriteLine("4"); }
Console.WriteLine("1");
var t = Work();
Console.WriteLine("3");
await t;
Console.WriteLine("5");`, ["1","2","3","4","5"].join("\n"));
T("async возвращает значение", `
async Task<int> F() { await Task.Delay(5); return 42; }
var v = await F(); Console.WriteLine(v);`, "42");
T("исключение из async", `
async Task F() { await Task.Delay(1); throw new InvalidOperationException("из async"); }
try { await F(); } catch (InvalidOperationException e) { Console.WriteLine("поймал: " + e.Message); }`,
  "поймал: из async");

console.log("── тонкости, ради которых всё затевалось");
T("замыкание видит изменение переменной", `
var fs = new List<int>();
for (int i = 0; i < 3; i++) { fs.Add(i); }
Console.WriteLine(string.Join(",", fs));`, "0,1,2");
T("список внутри класса — общий", `
class Box { public List<int> Items = new List<int>(); }
var a = new Box(); var b = a; b.Items.Add(5);
Console.WriteLine(a.Items.Count);`, "1");
T("struct со списком: список всё равно общий", `
struct S { public List<int> L; }
var a = new S(); a.L = new List<int>();
var b = a; b.L.Add(1);
Console.WriteLine(a.L.Count);`, "1");
T("== для классов сравнивает ссылки", `
class P { public int A; }
var x = new P(); x.A = 1; var y = new P(); y.A = 1;
Console.WriteLine(x == y);`, "False");
T("== для struct сравнивает поля", `
struct S { public int A; }
var x = new S(); x.A = 1; var y = new S(); y.A = 1;
Console.WriteLine(x.A == y.A);`, "True");
T("отложенный Select пересчитывается", `
var src = new List<int> { 1, 2 };
var q = src.Select(x => x * 10);
src.Add(3);
Console.WriteLine(string.Join(",", q.ToList()));`, "10,20,30");
T("цепочка Where.Where отложена", `
var src = new List<int> { 1, 2, 3, 4, 5, 6 };
var q = src.Where(x => x % 2 == 0).Where(x => x > 2);
Console.WriteLine(q.Count());`, "2");
T("finally выполняется при return", `
int F() { try { return 1; } finally { Console.WriteLine("finally"); } }
Console.WriteLine(F());`, "finally\n1");
T("вложенный using: обратный порядок", `
class R { public string N; public R(string n){ N = n; } public void Dispose(){ Console.WriteLine("d" + N); } }
using (var a = new R("1")) { using (var b = new R("2")) { Console.WriteLine("тело"); } }`,
 "тело\nd2\nd1");
T("несколько await подряд", `
async Task<int> A() { await Task.Delay(5); Console.WriteLine("A"); return 1; }
async Task<int> B() { await Task.Delay(1); Console.WriteLine("B"); return 2; }
var ta = A(); var tb = B();
Console.WriteLine(await ta + await tb);`, "B\nA\n3");
T("await без Delay не прерывает", `
async Task<int> F() { return 7; }
Console.WriteLine("до");
var v = await F();
Console.WriteLine(v);`, "до\n7");
T("интерфейс и полиморфизм", `
interface IShape { double Area(); }
class Sq : IShape { public double S; public Sq(double s){ S = s; } public double Area() { return S * S; } }
IShape x = new Sq(3);
Console.WriteLine(x.Area());`, "9");
T("is с интерфейсом", `
interface I {} class C : I {}
object o = new C();
Console.WriteLine(o is I);`, "True");
T("абстрактный базовый", `
abstract class A { public abstract string Name(); public string Hello() { return "я " + Name(); } }
class B : A { public override string Name() { return "B"; } }
Console.WriteLine(new B().Hello());`, "я B");
T("статический метод", `
class M { public static int Twice(int x) { return x * 2; } }
Console.WriteLine(M.Twice(21));`, "42");
T("рекурсия", `
int Fact(int n) { return n <= 1 ? 1 : n * Fact(n - 1); }
Console.WriteLine(Fact(5));`, "120");
T("out-параметр", `
string s = "42";
if (int.TryParse(s, out int n)) Console.WriteLine(n * 2);`, "84");
T("TryParse на мусоре", `
if (int.TryParse("абв", out int n)) Console.WriteLine("да"); else Console.WriteLine("нет");`, "нет");
T("switch", `
int x = 2; string r;
switch (x) { case 1: r = "один"; break; case 2: r = "два"; break; default: r = "?"; break; }
Console.WriteLine(r);`, "два");
T("словарь: перебор", `
var d = new Dictionary<string,int>(); d.Add("a",1); d.Add("b",2);
int s = 0; foreach (var kv in d) s += kv.Value;
Console.WriteLine(s);`, "3");
T("бесконечный цикл ловится", `while (true) { }`, g => g.includes("бесконечн"));
T("ошибка разбора внятная", `int x = ;`, g => g.includes("ОШИБКА"));

console.log("── LINQ: группировка");
T("GroupBy: ключи и размеры", `
var l = new List<int> { 1, 2, 3, 4, 5, 6 };
foreach (var g in l.GroupBy(x => x % 3))
    Console.WriteLine(g.Key + ":" + g.Count());`, "1:2\n2:2\n0:2");
T("GroupBy по строке", `
var l = new List<string> { "аа", "б", "вв" };
var g = l.GroupBy(s => s.Length).OrderBy(x => x.Key).ToList();
Console.WriteLine(g.Count + " " + g[0].Key + " " + g[1].Key);`, "2 1 2");
T("ToDictionary", `
var l = new List<string> { "раз", "два" };
var d = l.ToDictionary(s => s, s => s.Length);
Console.WriteLine(d["раз"] + "," + d["два"]);`, "3,3");
T("ToDictionary без селектора значения", `
var l = new List<int> { 5, 7 };
var d = l.ToDictionary(x => x);
Console.WriteLine(d[5]);`, "5");

console.log("── Nullable и свои исключения");
T("HasValue у null", `int? n = null; Console.WriteLine(n.HasValue);`, "False");
T("HasValue у значения", `int? n = 5; Console.WriteLine(n.HasValue + " " + n.Value);`, "True 5");
T("Value у null бросает", `int? n = null; Console.WriteLine(n.Value);`,
  g => g.includes("InvalidOperationException"));
T("свой класс исключения: Message через base", `
class MyEx : Exception { public MyEx(string m) : base(m) { } }
try { throw new MyEx("бум"); } catch (MyEx e) { Console.WriteLine(e.Message); }`, "бум");
T("свой класс ловится как Exception", `
class MyEx : Exception { public MyEx(string m) : base(m) { } }
try { throw new MyEx("два"); } catch (Exception e) { Console.WriteLine(e.Message); }`, "два");
T("интерфейс: подмена реализации", `
interface ILogger { void Log(string m); }
class Fake : ILogger { public List<string> L = new List<string>(); public void Log(string m) { L.Add(m); } }
void Run(ILogger l) { l.Log("x"); }
var f = new Fake(); Run(f);
Console.WriteLine(f.L.Count + " " + (f is ILogger));`, "1 True");

console.log("── ref, out и замыкания");
T("ref возвращает значение", `
void Swap(ref int x, ref int y) { int t = x; x = y; y = t; }
int p = 1, q = 2; Swap(ref p, ref q);
Console.WriteLine(p + "," + q);`, "2,1");
T("out у своего метода", `
bool Try(string s, out int len) { len = s.Length; return true; }
bool ok = Try("абв", out int L);
Console.WriteLine(ok + " " + L);`, "True 3");
T("ЗАМЫКАНИЕ: for захватывает одну переменную", `
var a = new List<Func<int>>();
for (int i = 0; i < 3; i++) a.Add(() => i);
foreach (var f in a) Console.Write(f() + " ");`, "3 3 3 ");
T("ЗАМЫКАНИЕ: foreach захватывает новую", `
var b = new List<Func<int>>();
foreach (var x in new List<int> { 0, 1, 2 }) b.Add(() => x);
foreach (var f in b) Console.Write(f() + " ");`, "0 1 2 ");
T("копия внутри for лечит захват", `
var a = new List<Func<int>>();
for (int i = 0; i < 3; i++) { int c = i; a.Add(() => c); }
foreach (var f in a) Console.Write(f() + " ");`, "0 1 2 ");

console.log("── сокрытие, свойства, Single");
T("СОКРЫТИЕ: new против override", `
class B { public virtual string W() { return "B"; } }
class D1 : B { public override string W() { return "D1"; } }
class D2 : B { public new string W() { return "D2"; } }
B x = new D1(); B y = new D2(); D2 z = new D2();
Console.WriteLine(x.W() + " " + y.W() + " " + z.W());`, "D1 B D2");
T("value в сеттере", `
class A {
  private int _v;
  public int V { get { return _v; } set { if (value < 0) throw new ArgumentException("нет"); _v = value; } }
}
var a = new A(); a.V = 5; Console.WriteLine(a.V);
try { a.V = -1; } catch (ArgumentException e) { Console.WriteLine("отказ"); }`, "5\nотказ");
T("RemoveAll", `
var l = new List<int> { 1, -2, 3, -4 };
l.RemoveAll(x => x < 0);
Console.WriteLine(string.Join(",", l));`, "1,3");
T("Single на одном элементе", `
var l = new List<int> { 1, 2, 3 };
Console.WriteLine(l.Single(x => x == 2));`, "2");
T("Single на нескольких бросает", `
var l = new List<int> { 2, 2 };
Console.WriteLine(l.Single(x => x == 2));`, g => g.includes("больше одного"));

console.log("── изменение коллекции во время перебора");
T("удаление в foreach бросает", `
var l = new List<int> { 1, -2, 3 };
foreach (var x in l) if (x < 0) l.Remove(x);`, g => g.includes("изменена во время перебора"));
T("изменение словаря в foreach бросает", `
var d = new Dictionary<string,int>(); d.Add("a",1); d.Add("b",2);
foreach (var kv in d) d.Remove("a");`, g => g.includes("изменена во время перебора"));
T("перебор копии безопасен", `
var l = new List<int> { 1, -2, 3 };
foreach (var x in l.ToList()) if (x < 0) l.Remove(x);
Console.WriteLine(string.Join(",", l));`, "1,3");
T("обычный перебор не ломается", `
var l = new List<int> { 1, 2, 3 };
int s = 0; foreach (var x in l) s += x;
Console.WriteLine(s);`, "6");

console.log("\nитог: "+pass+" пройдено, "+fail+" провалено");
