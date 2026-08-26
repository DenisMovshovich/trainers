/* Эталонные решения (100%) и негативный контроль (0%).
   Запуск: node check.js  |  node check.js --neg  */
const fs = require("fs"), path = require("path");
const dir = __dirname;
const neg = process.argv.includes("--neg");

let eng = "";
for(const f of ["30_obj.js","31_diff.js","32_cmd.js","33_hist.js","34_remote.js","35_run.js","36_more.js"])
  eng += fs.readFileSync(path.join(dir, f), "utf8").replace(/<\/?script>/g, "") + "\n";

let content = "";
for(const f of fs.readdirSync(dir).filter(x => /^4\d_content_.*\.js$/.test(x)).sort())
  content += fs.readFileSync(path.join(dir, f), "utf8");

eval(eng + "\n" + content + "\nglobalThis.MODULES = MODULES; globalThis.runGit = runGit;" +
     "globalThis.newRepo = newRepo; globalThis.applyTodo = applyTodo;" +
     "globalThis.ownCommits = ownCommits; globalThis.resolve = resolve; globalThis.headId = headId;");
eval(fs.readFileSync(path.join(dir, "sol.js"), "utf8") + "\nglobalThis.SOL = SOL;");

function fresh(lab){
  const R = newRepo("webapp");
  R.initialized = true;
  lab.setup(R);
  return R;
}

let total = 0, ok = 0;
const missing = [], bad = [];

for(const m of MODULES){
  for(const lab of m.labs || []){
    const steps = SOL[lab.id];
    if(steps === undefined){ missing.push(lab.id); continue; }

    const R = fresh(lab);
    const st = {R, log: []};
    const push = cmd => {
      const r = runGit(R, cmd);
      st.log.push({cmd, out: r.out || [], err: r.err || null});
      return r;
    };

    if(!neg){
      for(const step of steps){
        if(typeof step === "string"){
          const r = push(step);
          if(r.err) bad.push(lab.id + ": «" + step + "» → " + r.err);
          continue;
        }
        if(step.rebase){
          const picks = ownCommits(R, headId(R), resolve(R, step.rebase));
          st.log.push({cmd: "git rebase -i " + step.rebase, out: [], err: null});
          const r = applyTodo(R, step.rebase,
            step.plan.map(x => ({op: x.op, commit: picks[x.i], msg: x.msg})));
          if(r && r.conflict) bad.push(lab.id + ": интерактивное перебазирование встало на конфликте");
          continue;
        }
        if(step.fn){ step.fn(R, push); continue; }
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
