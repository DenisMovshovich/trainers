/* Проверка целостности содержания и разметки */
const fs = require("fs");
const strip = f => fs.readFileSync(f,"utf8").replace(/^<script>\s*/,"").replace(/<\/script>\s*$/,"");
const CODE = ["30_cluster.js","31_admin.js","32_client.js","33_cli.js"].map(strip).join("\n");
const CONTENT = ["40_content_a.js","41_content_b.js","42_content_c.js","43_content_d.js"].map(strip).join("\n");
const {MODULES} = new Function(CODE+"\n"+CONTENT+"\nreturn {MODULES};")();

let bad = 0;
const err = m => { console.log("  ✗ " + m); bad++; };
const VOID = new Set(["br","hr","img","input","meta","link","path","rect","circle","line","use","source","col"]);

function balance(html, where){
  const stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let m;
  while((m = re.exec(html))){
    const close = m[1] === "/", name = m[2].toLowerCase(), self = m[3] === "/";
    if(VOID.has(name) || self) continue;
    if(!close) stack.push(name);
    else {
      if(!stack.length) return err(where + ": лишний </" + name + ">");
      const top = stack.pop();
      if(top !== name) return err(where + ": </" + name + "> закрывает <" + top + ">");
    }
  }
  if(stack.length) err(where + ": не закрыт <" + stack[stack.length-1] + ">");
}

console.log("── содержание");
let nq = 0, nl = 0, nc = 0;
const ids = new Set();
MODULES.forEach((m, i) => {
  if(m.n !== i + 1) err("модуль " + m.id + ": номер " + m.n);
  ["id","title","sub","lede","theory"].forEach(k => { if(!m[k]) err("модуль " + m.n + ": нет " + k); });
  balance(m.theory, "модуль " + m.n + " теория");
  if(m.quiz.length !== 6) err("модуль " + m.n + ": вопросов " + m.quiz.length);
  m.quiz.forEach((q, qi) => {
    nq++;
    const w = "модуль " + m.n + " вопрос " + (qi + 1);
    if(q.opts.length !== 4) err(w + ": вариантов " + q.opts.length);
    if(!(q.a >= 0 && q.a < q.opts.length)) err(w + ": неверный индекс ответа");
    if(new Set(q.opts).size !== q.opts.length) err(w + ": повторяющиеся варианты");
    if(!q.why || q.why.length < 40) err(w + ": слишком короткое объяснение");
    balance(q.q, w + " формулировка");
    q.opts.forEach((o, oi) => balance(o, w + " вариант " + (oi + 1)));
    balance(q.why, w + " объяснение");
  });
  if(!m.labs.length) err("модуль " + m.n + ": нет заданий");
  m.labs.forEach(l => {
    nl++;
    const w = "задание " + l.id;
    if(ids.has(l.id)) err(w + ": повторяющийся идентификатор");
    ids.add(l.id);
    if(!l.hint) err(w + ": нет подсказки");
    if(!/<ul>|<ol>/.test(l.brief)) err(w + ": в описании нет списка шагов");
    balance(l.brief, w + " описание");
    if(l.checks.length < 3) err(w + ": проверок " + l.checks.length);
    l.checks.forEach(c => { nc++; balance(c.label, w + " метка"); if(typeof c.test !== "function") err(w + ": проверка не функция"); });
  });
});
console.log("  модулей " + MODULES.length + ", вопросов " + nq + ", заданий " + nl + ", проверок " + nc);

console.log("── SVG");
const svgRe = /<svg viewBox="0 0 (\d+) (\d+)"[\s\S]*?<\/svg>/g;
let s, nsvg = 0;
const allTheory = MODULES.map(m => m.theory).join("\n");
while((s = svgRe.exec(allTheory))){
  nsvg++;
  const W = +s[1], H = +s[2], body = s[0];
  const tre = /<text x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([\s\S]*?)<\/text>/g;
  let t;
  while((t = tre.exec(body))){
    const x = +t[1], y = +t[2], attrs = t[3];
    const txt = t[4].replace(/<[^>]+>/g, "");
    const anchor = /text-anchor="end"/.test(attrs) ? "end" : /text-anchor="middle"/.test(attrs) ? "middle" : "start";
    const fsz = (attrs.match(/font-size="([\d.]+)"/) || [0, 10])[1] * 1;
    const wpx = txt.length * fsz * 0.56;
    const x0 = anchor === "end" ? x - wpx : anchor === "middle" ? x - wpx / 2 : x;
    const x1 = x0 + wpx;
    if(y > H) err("SVG " + nsvg + ": текст ниже viewBox (y=" + y + " > " + H + "): " + txt.slice(0, 40));
    if(x0 < -2) err("SVG " + nsvg + ": текст левее viewBox (x=" + Math.round(x0) + "): " + txt.slice(0, 40));
    if(x1 > W + 2) err("SVG " + nsvg + ": текст правее viewBox (до " + Math.round(x1) + " > " + W + "): " + txt.slice(0, 40));
  }
}
console.log("  проверено рисунков: " + nsvg);

console.log(bad ? "\nПРОБЛЕМ: " + bad : "\nцелостность в порядке");
process.exit(bad ? 1 : 0);
