let pass = 0, fail = 0;
function T(name, fn){
  try{ const r = fn(); if(r === true || r === undefined) pass++; else { fail++; console.log("✗ " + name + " → " + r); } }
  catch(e){ fail++; console.log("✗ " + name + " — ИСКЛЮЧЕНИЕ: " + e.message); }
}
const eq = (a, b, w) => JSON.stringify(a) === JSON.stringify(b) ? true :
  (w || "") + " получено " + JSON.stringify(a) + ", ожидалось " + JSON.stringify(b);

console.log("── разбор пользовательского ввода");
T("список через запятую", () => eq(parseList("a, b ,c"), ["a","b","c"]));
T("список через перенос строки", () => eq(parseList("a\nb\n\nc"), ["a","b","c"]));
T("точка с запятой тоже разделитель", () => eq(parseList("a; b;c"), ["a","b","c"]));
T("минус юникодный", () => eq(normNum("−5"), -5));
T("пробелы внутри числа", () => eq(normNum("1 000"), 1000));
T("подчёркивание как разделитель разрядов", () => eq(normNum("1_000"), 1000));
T("запятая как десятичный разделитель", () => eq(normNum("2,5"), 2.5));
T("не число", () => eq(normNum("abc"), null));
T("числовое множество сортируется и убирает дубли", () => eq(numSet("5, 1, 5, −2, x"), [-2,1,5]));
T("строковое множество без учёта регистра", () => eq(strSet("Admin, admin, USER"), ["Admin","USER"]));

console.log("── граничные значения");
T("две границы для 1..100", () => eq(bva(1,100).two, [0,1,100,101]));
T("три границы для 1..100", () => eq(bva(1,100).three, [0,1,2,99,100,101]));
T("шаг 0.01 для денег", () => eq(bva(0.01, 99.99, 0.01).two, [0, 0.01, 99.99, 100]));
T("отрицательный диапазон", () => eq(bva(-10,-1).two, [-11,-10,-1,0]));
T("диапазон из одного значения", () => eq(bva(5,5).two, [4,5,5,6]));
T("открыт сверху", () => eq(bvaOpen(18, null), [17,18,19]));
T("открыт снизу", () => eq(bvaOpen(null, 65), [64,65,66]));

console.log("── классы эквивалентности");
const CL = [
  {name:"меньше минимума", valid:false, test:v => v < 1},
  {name:"допустимый",      valid:true,  test:v => v >= 1 && v <= 100},
  {name:"больше максимума",valid:false, test:v => v > 100}
];
T("значение попадает в класс", () => eq(classifyValue(CL, 50), "допустимый"));
T("покрытие всех классов", () => eq(ecpCoverage(CL, [0, 50, 101]).miss, []));
T("непокрытый класс виден", () => eq(ecpCoverage(CL, [50, 60]).miss, ["меньше минимума","больше максимума"]));
T("несколько значений одного класса покрытия не добавляют", () => eq(ecpCoverage(CL, [10,20,30]).covered, 1));

console.log("── таблицы решений");
T("для двух условий четыре правила", () => eq(decisionRules(2).length, 4));
T("для трёх условий восемь правил", () => eq(decisionRules(3).length, 8));
T("неполная таблица", () => eq(decisionAudit(2, [{cond:[true,true],act:"A"}]).missing.length, 3));
T("полная таблица", () => {
  const rules = decisionRules(2).map((c,i) => ({cond:c, act:"A"+i}));
  return eq(decisionAudit(2, rules).complete, true);
});
T("противоречие обнаружено", () => {
  const a = decisionAudit(1, [{cond:[true],act:"A"},{cond:[true],act:"B"},{cond:[false],act:"C"}]);
  return eq(a.contra.length, 1);
});
T("дубликат обнаружен", () => {
  const a = decisionAudit(1, [{cond:[true],act:"A"},{cond:[true],act:"A"},{cond:[false],act:"C"}]);
  return eq(a.dup.length + a.contra.length, 1) === true && a.dup.length === 1 ? true : "dup=" + a.dup.length;
});

console.log("── переходы состояний");
const STATES = ["новый","оплачен","отправлен"];
const EVENTS = ["оплатить","отправить"];
const TR = [{from:"новый",ev:"оплатить",to:"оплачен"},{from:"оплачен",ev:"отправить",to:"отправлен"}];
T("допустимые переходы", () => eq(smValid(TR).length, 2));
T("недопустимых переходов четыре", () => eq(smInvalid(STATES, EVENTS, TR).length, 4));
T("оплатить дважды — недопустимо", () => smInvalid(STATES,EVENTS,TR).some(t => t.from === "оплачен" && t.ev === "оплатить") ? true : "не найдено");
T("пары переходов для 1-switch", () => eq(smPairs(TR).length, 1));

console.log("── попарное тестирование");
const P4 = [{name:"ОС",vals:["win","mac","lin"]},{name:"Бр",vals:["chrome","ff","safari"]},
            {name:"Роль",vals:["admin","user"]},{name:"Яз",vals:["ru","en"]}];
T("покрывает все пары", () => eq(pairwiseCheck(P4, pairwise(P4).rows).ok, true));
T("строк меньше полного перебора", () => pairwise(P4).rows.length < 36 ? true : "строк " + pairwise(P4).rows.length);
T("полный перебор посчитан верно", () => eq(pairwise(P4).full, 36));
T("два параметра по два значения — четыре пары", () => {
  const p = [{name:"a",vals:["1","2"]},{name:"b",vals:["x","y"]}];
  return eq(pairwise(p).pairs, 4);
});
T("неполный набор ловится проверкой", () => {
  const p = [{name:"a",vals:["1","2"]},{name:"b",vals:["x","y"]}];
  return eq(pairwiseCheck(p, [["1","x"]]).ok, false);
});
T("один параметр — вырожденный случай", () => eq(pairwise([{name:"a",vals:["1","2"]}]).rows.length, 2));

console.log("── сравнение ответов");
T("точное совпадение", () => eq(setDiff([1,2,3],[3,2,1]).exact, true));
T("не хватает значения", () => eq(setDiff([1,2],[1,2,3]).missing, [3]));
T("лишнее значение", () => eq(setDiff([1,2,3],[1,2]).extra, [3]));
T("регистр не важен", () => eq(setDiff(["Admin"],["admin"]).exact, true));

console.log("── аудит баг-репорта");
T("пустой репорт — много замечаний", () => auditBug({}).issues.length >= 6 ? true : auditBug({}).issues.length);
T("полный репорт без замечаний", () => {
  const r = auditBug({title:"Кнопка «Оплатить» не отправляет форму при сумме 0.01",
    steps:"1. Открыть корзину\n2. Ввести сумму 0.01\n3. Нажать «Оплатить»",
    expected:"Форма отправлена, показан экран оплаты", actual:"Ничего не происходит, в консоли ошибка 500",
    env:"Chrome 120, Windows 11, стенд stage", severity:"critical"});
  return r.ok ? true : JSON.stringify(r.issues);
});
T("расплывчатый заголовок", () => auditBug({title:"не работает"}).issues.some(i => /ничего не сообщает|слишком короткий/.test(i)) ? true : "не поймано");
T("совпадение ожидаемого и фактического", () => {
  const r = auditBug({title:"Длинный осмысленный заголовок дефекта", steps:"1. шаг\n2. шаг",
    expected:"одно и то же", actual:"Одно И То Же", env:"x", severity:"minor"});
  return r.issues.some(i => /совпадают/.test(i)) ? true : JSON.stringify(r.issues);
});
T("один шаг — мало", () => auditBug({steps:"открыть страницу"}).issues.some(i => /шагов/.test(i)) ? true : "не поймано");

console.log("\nитог: " + pass + " пройдено, " + fail + " провалено");
