/* Эталонные решения (100%) и негативный контроль (0%).
   Запуск: node check.js  |  node check.js --neg  */
const fs = require("fs"), path = require("path");
const dir = __dirname;
const neg = process.argv.includes("--neg");

let eng = "";
for(const f of ["30_lex.js","31_parse.js","32_val.js","33_eval.js","34_run.js"])
  eng += fs.readFileSync(path.join(dir, f), "utf8").replace(/<\/?script>/g, "") + "\n";

let content = "";
for(const f of fs.readdirSync(dir).filter(x => /^4\d_content_.*\.js$/.test(x)).sort())
  content += fs.readFileSync(path.join(dir, f), "utf8");

eval(eng + "\n" + content + "\nglobalThis.MODULES = MODULES; globalThis.runCs = runCs;");
eval(fs.readFileSync(path.join(dir, "sol.js"), "utf8") + "\nglobalThis.SOL = SOL;");

let total = 0, ok = 0, missing = [];
const bad = [];

for(const m of MODULES){
  for(const lab of m.labs || []){
    const code = SOL[lab.id];
    if(code === undefined){ missing.push(lab.id); continue; }

    let st;
    if(neg){
      st = {log: []};                       /* пустое состояние: не должно проходить ничего */
    }else{
      const r = runCs(code);
      st = {log: [{code, out: r.out || [], error: r.error || null}]};
      if(r.error) bad.push(`${lab.id}: движок не выполнил решение — ${r.error}`);
    }

    for(const c of lab.checks){
      total++;
      let pass = false;
      try{ pass = !!c.test(st); }catch(x){ bad.push(`${lab.id} / ${c.label}: проверка упала — ${x.message}`); }
      if(pass) ok++;
      if(!neg && !pass) bad.push(`${lab.id} / ${c.label.replace(/<[^>]+>/g, "")}`);
      if(neg && pass)  bad.push(`${lab.id} / ${c.label.replace(/<[^>]+>/g, "")} — проходит на пустом состоянии`);
    }
  }
}

const pct = total ? Math.round(ok / total * 100) : 0;
if(missing.length) console.log("нет решения для заданий: " + missing.join(", "));
for(const b of bad) console.log("  ✗ " + b);
console.log((neg ? "негативный контроль" : "эталонные решения") + ": " + ok + " из " + total + " (" + pct + "%)");

const good = neg ? (ok === 0 && !missing.length) : (ok === total && !missing.length);
console.log(good ? "OK" : "ПРОВАЛ");
process.exit(good ? 0 : 1);
