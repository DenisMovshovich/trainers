/* Прогон эталонных ответов по всем заданиям */
const fs = require("fs");
const strip = f => fs.readFileSync(f, "utf8").replace(/^<script>\s*/, "").replace(/<\/script>\s*$/, "");
const CODE = ["30_lib.js","31_glossary.js"].map(strip).join("\n");
const CONTENT = ["40_content_a.js","41_content_b.js","42_content_c.js","43_content_d.js","44_content_e.js"].map(strip).join("\n");
const SOLSRC = fs.readFileSync("sol.js", "utf8");
const NEG = process.argv.includes("--neg");

const {MODULES, SOL, SOL_TOOLS} = new Function(
  CODE + "\n" + CONTENT + "\n" + SOLSRC + "\nreturn {MODULES, SOL, SOL_TOOLS};")();

const st = {ans: NEG ? {} : SOL, tools: NEG ? {bva:0, pw:0, sev:0} : SOL_TOOLS};
let total = 0, passed = 0;
const failed = [];
MODULES.forEach(m => m.labs.forEach(lab => {
  if(!NEG && SOL[lab.id] === undefined){ console.log("НЕТ РЕШЕНИЯ для " + lab.id); }
  lab.checks.forEach(c => {
    total++;
    let v = false, ex = null;
    try{ v = !!c.test(st); }catch(e){ ex = e.message; }
    if(v) passed++;
    else failed.push(lab.id + " · " + c.label.replace(/<[^>]+>/g, "") + (ex ? "  [исключение: " + ex + "]" : ""));
  });
}));
console.log((NEG ? "НЕГАТИВНЫЙ КОНТРОЛЬ" : "ЭТАЛОННЫЕ ОТВЕТЫ") + ": " + passed + " / " + total);
if(NEG){
  if(passed === 0) console.log("верно: без работы не проходит ни одна проверка");
  else { console.log("ПРОБЛЕМА — проходят без работы:"); failed.length = 0; }
} else if(failed.length){
  console.log("\nне прошли (" + failed.length + "):");
  failed.forEach(f => console.log("  ✗ " + f));
}
