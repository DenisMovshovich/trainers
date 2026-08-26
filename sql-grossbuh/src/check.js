/* Прогон эталонных решений: все ли проверки заданий проходят */
const fs = require("fs");
const strip = f => fs.readFileSync(f,"utf8").replace(/^<script>\s*/,"").replace(/<\/script>\s*$/,"");
const CODE = ["30_db.js","31_parse.js","32_exec.js","33_run.js"].map(strip).join("\n");
const CONTENT = ["40_content_a.js","41_content_b.js","42_content_c.js","43_content_d.js"].map(strip).join("\n");
const SOLSRC = fs.readFileSync("sol.js","utf8");
const NEG = process.argv.includes("--neg");

const sandbox = {};
const fn = new Function(CODE + "\n" + CONTENT + "\n" + SOLSRC + "\nreturn {MODULES, SOL, newDb, runSql};");
const {MODULES, SOL, newDb, runSql} = fn();

let total = 0, passed = 0, failed = [];
const labs = [];
MODULES.forEach(m => m.labs.forEach(l => labs.push([m, l])));

for(const [m, lab] of labs){
  const st = {db: newDb(), log: []};
  const script = NEG ? [] : (SOL[lab.id] || null);
  if(script === null){ console.log("НЕТ РЕШЕНИЯ для " + lab.id); continue; }
  for(const sql of script){
    let res = null, err = null;
    try{ const out = runSql(st.db, sql); res = out[out.length-1]; }
    catch(e){ err = e.message || String(e); }
    st.log.push({sql, res, err});
  }
  for(const c of lab.checks){
    total++;
    let v = false, ex = null;
    try{ v = !!c.test(st); }catch(e){ ex = e.message; }
    if(v) passed++;
    else failed.push(lab.id + " · " + c.label.replace(/<[^>]+>/g,"") + (ex ? "  [исключение: "+ex+"]" : ""));
  }
}

console.log((NEG ? "НЕГАТИВНЫЙ КОНТРОЛЬ" : "ЭТАЛОННЫЕ РЕШЕНИЯ") + ": " + passed + " / " + total);
if(NEG){
  if(passed === 0) console.log("верно: без работы не проходит ни одна проверка");
  else { console.log("ПРОБЛЕМА — проходят без работы:"); failed.length; }
} else if(failed.length){
  console.log("\nне прошли (" + failed.length + "):");
  failed.forEach(f=>console.log("  ✗ " + f));
}
