/* Эталонные решения (100%) и негативный контроль (0%).
   Запуск: node check.js  |  node check.js --neg  */
const fs = require("fs"), path = require("path");
const dir = __dirname;
const neg = process.argv.includes("--neg");

let eng = "";
for(const f of ["30_net.js","31_http.js","32_curl.js","33_tools.js","35_extra.js","34_run.js"])
  eng += fs.readFileSync(path.join(dir, f), "utf8").replace(/<\/?script>/g, "") + "\n";

let content = "";
for(const f of fs.readdirSync(dir).filter(x => /^4\d_content_.*\.js$/.test(x)).sort())
  content += fs.readFileSync(path.join(dir, f), "utf8");

eval(eng + "\n" + content + "\nfor(const n of [\"MODULES\",\"runNet\",\"newScenario\",\"syncHosts\"]) globalThis[n] = eval(n);");
eval(fs.readFileSync(path.join(dir, "sol.js"), "utf8") + "\nglobalThis.SOL = SOL;");

const fresh = lab => lab.setup();

let total = 0, ok = 0;
const missing = [], bad = [];

for(const m of MODULES){
  for(const lab of m.labs || []){
    const steps = SOL[lab.id];
    if(steps === undefined){ missing.push(lab.id); continue; }

    const C = fresh(lab);
    const st = {N: C, log: []};
    const push = cmd => {
      const r = runNet(C, cmd);
      st.log.push({cmd, out: (r.out || []).concat(r.err2 ? [r.err2] : []), err: r.err || null});
      return r;
    };

    if(!neg){
      for(const step of steps){
        if(typeof step === "string"){
          const r = push(step);
          if(r.err) bad.push(lab.id + ": «" + step + "» → " + r.err);
          continue;
        }
        if(step.file !== undefined){ C.files[step.file] = step.text; syncHosts(C); continue; }
        if(step.fn){ step.fn(C, push); continue; }
        if(step.cmd){
          const r = push(step.cmd);
          if(step.expectErr && !r.err) bad.push(lab.id + ": «" + step.cmd + "» должна была отказать, но прошла");
          if(!step.expectErr && r.err) bad.push(lab.id + ": «" + step.cmd + "» → " + r.err);
          continue;
        }
      }
    }

    for(const c of lab.checks){
      total++;
      let pass = false;
      try{ pass = !!c.test(st); }
      catch(x){ bad.push(lab.id + " / " + c.label.replace(/<[^>]+>/g, "") + ": проверка упала — " + x.message); }
      if(pass) ok++;
      const plain = c.label.replace(/<[^>]+>/g, "");
      if(!neg && !pass) bad.push(lab.id + " / " + plain);
      if(neg && pass)  bad.push(lab.id + " / " + plain + " — проходит на нетронутом сценарии");
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
