
/* ============================================================
   Конвейер: разбор workflow и выполнение задач
   ============================================================ */
function newProject(opts){
  opts = opts || {};
  const C = {
    name: opts.name || "shop",
    files: Object.assign({}, opts.files),          /* репозиторий: то, что правит человек */
    cache: {},                                     /* переживает запуски — в этом весь смысл */
    secrets: Object.assign({TOKEN: "s3cr3t-token", NUGET_KEY: "nk-9f2b"}, opts.secrets),
    event: opts.event || "push",
    branch: opts.branch || "main",
    fork: !!opts.fork,
    commit: opts.commit || "a1b2c3d",
    seed: opts.seed === undefined ? 11 : opts.seed,
    flakyFixed: !!opts.flakyFixed,
    tests: opts.tests || defaultTests(),
    runs: []
  };
  return C;
}

function workflowFile(C){
  const names = Object.keys(C.files).filter(f => /^\.github\/workflows\/.+\.(yml|yaml)$/.test(f));
  if(!names.length) cierr("в репозитории нет ни одного файла конвейера",
    "Он должен лежать в .github/workflows/ и иметь расширение .yml — иначе система его не увидит.");
  return names.sort()[0];
}

function parseWorkflow(C, file){
  const src = C.files[file];
  if(src === undefined) cierr("файла «" + file + "» нет");
  const docs = parseYaml(src);
  const wf = docs[0];
  if(!wf || typeof wf !== "object") cierr("файл конвейера пуст");
  /* «on» в YAML — это булево true, если не взять в кавычки: известная ловушка */
  if(wf.on === undefined && wf[true] !== undefined) wf.on = wf[true];
  if(!wf.jobs || typeof wf.jobs !== "object") cierr("в конвейере нет ни одной задачи (jobs)");
  return wf;
}

function triggers(wf){
  const on = wf.on;
  if(on === undefined || on === null) return [];
  if(typeof on === "string") return [on];
  if(Array.isArray(on)) return on.map(String);
  return Object.keys(on);
}

/* Развернуть матрицу в список наборов переменных */
function expandMatrix(strategy){
  if(!strategy || !strategy.matrix) return [null];
  const m = strategy.matrix;
  const keys = Object.keys(m).filter(k => k !== "include" && k !== "exclude");
  let out = [{}];
  for(const k of keys){
    const vals = [].concat(m[k]);
    const next = [];
    for(const base of out) for(const v of vals) next.push(Object.assign({}, base, {[k]: v}));
    out = next;
  }
  for(const ex of [].concat(m.exclude || []))
    out = out.filter(row => !Object.keys(ex).every(k => String(row[k]) === String(ex[k])));
  for(const inc of [].concat(m.include || [])){
    const fit = out.filter(row => Object.keys(inc).every(k => row[k] === undefined || String(row[k]) === String(inc[k])));
    if(fit.length) fit.forEach(row => Object.assign(row, inc));
    else out.push(Object.assign({}, inc));
  }
  return out.length ? out : [null];
}

function baseCtx(C, R, event){
  return {
    github: {
      event_name: event || R.event || C.event, ref: "refs/heads/" + C.branch, ref_name: C.branch,
      sha: C.commit, repository: "team/" + C.name, actor: "dev",
      head_ref: C.event === "pull_request" ? "feature/x" : ""
    },
    runner: {os: "Linux", arch: "X64"},
    secrets: R.secrets,
    env: {}, matrix: {}, needs: {}, steps: {},
    job: {status: "success"},
    __run: R
  };
}

function runWorkflow(C, opts){
  opts = opts || {};
  const file = opts.file || workflowFile(C);
  const wf = parseWorkflow(C, file);
  const event = opts.event || C.event;
  const tr = triggers(wf);
  if(tr.length && tr.indexOf(event) < 0)
    return {out: ["Конвейер не запущен: событие «" + event + "» не описано в on (" + tr.join(", ") + ")"],
            skipped: true};

  const R = {
    event, files: {}, repo: C.files, cache: C.cache, artifacts: {},
    secrets: (event === "pull_request" && C.fork)
      ? Object.keys(C.secrets).reduce((o, k) => (o[k] = "", o), {})   /* из форка секреты не выдают */
      : Object.assign({}, C.secrets),
    tests: C.tests, seed: C.seed, flakyFixed: C.flakyFixed, commit: C.commit
  };

  const wfEnv = wf.env || {};
  const names = Object.keys(wf.jobs);
  const jobs = {};
  for(const n of names){
    const j = wf.jobs[n];
    if(!j) cierr("задача «" + n + "» пуста");
    if(!j["runs-on"]) cierr("у задачи «" + n + "» нет runs-on",
      "runs-on говорит, на какой машине выполнять задачу, например ubuntu-latest.");
    for(const dep of [].concat(j.needs || []))
      if(names.indexOf(String(dep)) < 0)
        cierr("задача «" + n + "» ждёт «" + dep + "», а такой задачи нет");
    jobs[n] = j;
  }
  /* цикл в зависимостях */
  const seenN = {};
  const walk = (n, path) => {
    if(path.indexOf(n) >= 0) cierr("зависимости задач образуют цикл: " + path.concat(n).join(" → "));
    if(seenN[n]) return;
    for(const d of [].concat(jobs[n].needs || [])) walk(String(d), path.concat(n));
    seenN[n] = 1;
  };
  for(const n of names) walk(n, []);

  const done = {};                 /* имя → {status, outputs, start, end} */
  const results = [];
  let guard = 0;
  while(Object.keys(done).length < names.length && guard++ < 200){
    for(const n of names){
      if(done[n]) continue;
      const deps = [].concat(jobs[n].needs || []).map(String);
      if(!deps.every(d => done[d])) continue;
      const start = deps.length ? Math.max.apply(null, deps.map(d => done[d].end)) : 0;
      const r = runJob(C, R, wf, n, jobs[n], wfEnv, done, start, event);
      done[n] = r;
      results.push(r);
    }
  }

  /* сохранить кеш тех записей, которых не было */
  for(const r of results) for(const inst of r.instances)
    for(const s of inst.cacheSave) if(C.cache[s.key] === undefined) C.cache[s.key] = {bucket: s.bucket};

  const wall = results.reduce((m, r) => Math.max(m, r.end), 0);
  const total = results.reduce((s, r) => s + r.instances.reduce((x, i) => x + i.ms, 0), 0);
  const status = results.some(r => r.status === "failure") ? "failure"
               : results.every(r => r.status === "skipped") ? "skipped" : "success";
  const run = {n: C.runs.length + 1, file, event, status, wall, total, jobs: results,
               artifacts: R.artifacts, commit: C.commit};
  C.runs.push(run);
  if(C.runs.length > 20) C.runs.shift();
  return {run};
}

function runJob(C, R, wf, name, j, wfEnv, done, start, event){
  const needsCtx = {};
  for(const d of [].concat(j.needs || [])) needsCtx[String(d)] = {result: done[String(d)].status,
                                                                 outputs: done[String(d)].outputs || {}};
  const ctx = baseCtx(C, R, event);
  ctx.needs = needsCtx;
  ctx.env = Object.assign({}, wfEnv, j.env || {});

  const depFailed = [].concat(j.needs || []).some(d => done[String(d)].status !== "success");
  const jobIf = j["if"];
  let allowed = true;
  if(jobIf !== undefined){
    ctx.job = {status: depFailed ? "failure" : "success"};
    allowed = truth(evalExpr(String(jobIf).replace(/^\s*\$\{\{|\}\}\s*$/g, ""), ctx));
  } else if(depFailed) allowed = false;

  if(!allowed)
    return {name, status: "skipped", start, end: start, needs: [].concat(j.needs || []).map(String),
            instances: [{name, status: "skipped", ms: 0, steps: [], stepsCtx: {}, cacheSave: []}],
            outputs: {}, matrix: null};

  const rows = expandMatrix(j.strategy);
  /* Каждый вариант задачи выполняется на СВОЕЙ машине: общими остаются
     только кеш, артефакты и исходный репозиторий. */
  const failFast = !(j.strategy && j.strategy["fail-fast"] === false);
  const instances = [];
  for(const row of rows){
    const label = row ? name + " (" + Object.keys(row).map(k => row[k]).join(", ") + ")" : name;
    const RJ = Object.assign({}, R, {files: {}});
    instances.push(runInstance(C, RJ, j, label, row, ctx, needsCtx, event));
  }
  /* fail-fast: те, кто ещё выполнялся к моменту первого падения, отменяются */
  if(failFast && instances.some(i => i.status === "failure")){
    const firstFail = Math.min.apply(null, instances.filter(i => i.status === "failure").map(i => i.ms));
    for(const i of instances)
      if(i.status !== "failure" && i.ms > firstFail){ i.status = "cancelled"; i.ms = firstFail; }
  }
  const ms = instances.reduce((m, i) => Math.max(m, i.ms), 0);
  const status = instances.some(i => i.status === "failure") ? "failure"
               : instances.some(i => i.status === "cancelled") ? "failure" : "success";
  const outputs = {};
  for(const k in (j.outputs || {})){
    const c2 = Object.assign({}, ctx, {steps: instances[0].stepsCtx});
    try{ outputs[k] = String(interp(j.outputs[k], c2)); }catch(e){ outputs[k] = ""; }
  }
  return {name, status, start, end: start + ms, needs: [].concat(j.needs || []).map(String),
          instances, outputs, matrix: rows[0] ? rows : null};
}

function runInstance(C, R, j, label, row, ctx0, needsCtx, event){
  const J = {name: label, ms: 0, env: {}, stepOut: {}, cacheHits: {}, cacheSave: []};
  const stepsCtx = {};
  const steps = [];
  let status = "success";

  for(let k = 0; k < [].concat(j.steps || []).length; k++){
    const raw = [].concat(j.steps)[k];
    const ctx = baseCtx(C, R, event);
    ctx.needs = needsCtx;
    ctx.matrix = row || {};
    ctx.env = Object.assign({}, ctx0.env, J.env);
    ctx.steps = stepsCtx;
    ctx.job = {status};

    let cond = true;
    if(raw["if"] !== undefined)
      cond = truth(evalExpr(String(raw["if"]).replace(/^\s*\$\{\{|\}\}\s*$/g, ""), ctx));
    else if(status === "failure") cond = false;

    const title = String(raw.name || raw.uses || String(raw.run || "").split("\n")[0] || "шаг " + (k + 1));
    if(!cond){ steps.push({name: title, status: "skipped", ms: 0, log: []}); continue; }

    const log = [];
    const before = J.ms;
    J.stepOut = {};
    let code = 0;
    try{
      const cfg = interpDeep({with: raw["with"] || {}, run: raw.run, env: raw.env || {}}, ctx);
      if(raw.uses) code = runAction(R, J, raw, cfg, l => log.push(mask(R, l)));
      else if(raw.run !== undefined){
        for(const line of String(cfg.run).split("\n")){
          if(!line.trim()) continue;
          log.push("$ " + mask(R, line.trim()));
          code = runShell(R, J, line, l => log.push(l));
          if(code) break;
        }
      } else cierr("у шага «" + title + "» нет ни run, ни uses");
    }catch(e){
      if(e instanceof CiErr){ log.push("ошибка: " + e.message); if(e.hint) log.push(e.hint); code = 1; }
      else throw e;
    }

    if(raw.id) stepsCtx[raw.id] = {outputs: Object.assign({}, J.stepOut), outcome: code ? "failure" : "success"};
    const failed = code !== 0;
    const soft = raw["continue-on-error"] === true;
    steps.push({name: title, status: failed ? (soft ? "warned" : "failure") : "success",
                ms: J.ms - before, log});
    if(failed && !soft) status = "failure";
  }
  return {name: label, status, ms: J.ms, steps, stepsCtx, cacheSave: J.cacheSave, matrix: row};
}
