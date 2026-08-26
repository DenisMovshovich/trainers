/* Прогон эталонных решений по общему кластеру, как в самом тренажёре */
const fs = require("fs");
const strip = f => fs.readFileSync(f, "utf8").replace(/^<script>\s*/, "").replace(/<\/script>\s*$/, "");
const CODE = ["30_cluster.js","31_admin.js","32_client.js","33_cli.js"].map(strip).join("\n");
const CONTENT = ["40_content_a.js","41_content_b.js","42_content_c.js","43_content_d.js"].map(strip).join("\n");
const SOLSRC = fs.readFileSync("sol.js", "utf8");
const NEG = process.argv.includes("--neg");
const VERBOSE = process.argv.includes("-v");

const {MODULES, SOL, newCluster, runCmd} = new Function(
  CODE + "\n" + CONTENT + "\n" + SOLSRC + "\nreturn {MODULES, SOL, newCluster, runCmd};")();

const st = {c: newCluster(), log: []};
let total = 0, passed = 0;
const failed = [];
const labs = [];
MODULES.forEach(m => m.labs.forEach(l => labs.push(l)));

for(const lab of labs){
  const script = NEG ? [] : SOL[lab.id];
  if(script === undefined){ console.log("НЕТ РЕШЕНИЯ для " + lab.id); continue; }
  for(const cmd of script){
    let res = null, err = null;
    try{ res = runCmd(st.c, cmd); }
    catch(e){ err = e && e.message ? e.message : String(e); }
    st.log.push({cmd, lines: res ? res.lines : [], notices: res ? res.notices : [], err});
    if(VERBOSE) console.log((err ? "  ! " : "  $ ") + cmd + (err ? "  → " + err : ""));
  }
  for(const c of lab.checks){
    total++;
    let v = false, ex = null;
    try{ v = !!c.test(st); }catch(e){ ex = e.message; }
    if(v) passed++;
    else failed.push(lab.id + " · " + c.label.replace(/<[^>]+>/g, "") + (ex ? "  [исключение: " + ex + "]" : ""));
  }
}

console.log((NEG ? "НЕГАТИВНЫЙ КОНТРОЛЬ" : "ЭТАЛОННЫЕ РЕШЕНИЯ") + ": " + passed + " / " + total);
if(NEG){
  if(passed === 0) console.log("верно: без работы не проходит ни одна проверка");
  else { console.log("ПРОБЛЕМА — проходят без работы:"); failed.length = 0; }
} else if(failed.length){
  console.log("\nне прошли (" + failed.length + "):");
  failed.forEach(f => console.log("  ✗ " + f));
}
