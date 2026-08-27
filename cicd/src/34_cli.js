
/* ============================================================
   Командная строка
   ============================================================ */
function tokenize(line){
  const out = []; let cur = "", q = null, has = false;
  for(let i = 0; i < line.length; i++){
    const c = line[i];
    if(q){ if(c === q) q = null; else cur += c; continue; }
    if(c === '"' || c === "'"){ q = c; has = true; continue; }
    if(/\s/.test(c)){ if(cur || has){ out.push(cur); cur = ""; has = false; } continue; }
    cur += c;
  }
  if(q) cierr("незакрытая кавычка");
  if(cur || has) out.push(cur);
  return out;
}
function parseArgs(tokens){
  const flags = {}, opts = {}, args = [];
  const VAL = {f:1, event:1, step:1, file:1, seed:1};
  for(let i = 0; i < tokens.length; i++){
    const t = tokens[i];
    if(t.indexOf("--") === 0){
      const body = t.slice(2), eq = body.indexOf("=");
      if(eq > 0){ opts[body.slice(0, eq)] = body.slice(eq + 1); continue; }
      if(VAL[body] && tokens[i + 1] !== undefined && tokens[i + 1][0] !== "-"){ opts[body] = tokens[++i]; continue; }
      flags[body] = true; continue;
    }
    if(t[0] === "-" && t.length > 1){
      const c = t.slice(1);
      if(VAL[c] && tokens[i + 1] !== undefined){ opts[c] = tokens[++i]; continue; }
      flags[c] = true; continue;
    }
    args.push(t);
  }
  if(opts.file && !opts.f) opts.f = opts.file;
  return {flags, opts, args};
}

const dur = ms => ms >= 60 ? Math.floor(ms / 60) + "м " + (ms % 60) + "с" : ms + "с";
const MARK = {success: "✓", failure: "✗", skipped: "–", cancelled: "⊘", warned: "!"};

function table(rows){
  if(!rows.length) return [];
  const w = [];
  for(const r of rows) r.forEach((c, i) => { w[i] = Math.max(w[i] || 0, String(c).length); });
  return rows.map(r => r.map((c, i) => i === r.length - 1 ? String(c) : String(c).padEnd(w[i] + 3)).join("").replace(/\s+$/, ""));
}

function cmdRun(C, a){
  const r = runWorkflow(C, {event: a.opts.event, file: a.opts.f});
  if(r.skipped) return {out: r.out, warn: true};
  const run = r.run;
  const out = ["Запуск #" + run.n + " · событие " + run.event + " · " + run.file, ""];
  for(const j of run.jobs){
    if(j.instances.length > 1 || j.instances[0].name !== j.name)
      out.push(MARK[j.status] + " " + j.name);
    for(const i of j.instances)
      out.push("  " + MARK[i.status] + " " + i.name + "  " + dur(i.ms) +
        (i.status === "failure" ? "  ← упало" : i.status === "cancelled" ? "  ← отменено (fail-fast)" : ""));
  }
  out.push("");
  out.push("Итог: " + (run.status === "success" ? "успех" : run.status === "skipped" ? "нечего делать" : "ПАДЕНИЕ") +
    " · время конвейера " + dur(run.wall) + " · машинного времени " + dur(run.total));
  if(run.status === "failure"){
    const f = [];
    for(const j of run.jobs) for(const i of j.instances)
      if(i.status === "failure") f.push(i.name);
    out.push("Смотреть журнал: ci logs " + f[0].split(" (")[0]);
  }
  return {out, warn: run.status === "failure"};
}

function lastRun(C){
  if(!C.runs.length) cierr("конвейер ещё ни разу не запускался", "Сначала «ci run».");
  return C.runs[C.runs.length - 1];
}

function cmdJobs(C, a){
  const run = lastRun(C);
  const rows = [["ЗАДАЧА","СТАТУС","НАЧАЛО","ВРЕМЯ","ЖДЁТ"]];
  for(const j of run.jobs) for(const i of j.instances)
    rows.push([i.name, MARK[i.status] + " " + i.status, dur(j.start), dur(i.ms),
               (j.needs || []).join(", ") || "—"]);
  return {out: table(rows)};
}

function cmdLogs(C, a){
  const run = lastRun(C);
  const want = String(a.args[0] || "");
  if(!want) cierr("укажите задачу", "Например: ci logs test. Список — «ci jobs».");
  const hits = [];
  for(const j of run.jobs) for(const i of j.instances)
    if(i.name === want || i.name.indexOf(want + " (") === 0 || j.name === want) hits.push(i);
  if(!hits.length) cierr("в последнем запуске нет задачи «" + want + "»",
    "Посмотрите «ci jobs» — имена там.");
  const out = [];
  for(const i of hits){
    out.push("── " + i.name + " · " + i.status + " · " + dur(i.ms));
    let n = 0;
    for(const s of i.steps){
      n++;
      if(a.opts.step && +a.opts.step !== n) continue;
      out.push("  " + n + ") " + MARK[s.status] + " " + s.name + (s.ms ? "  " + dur(s.ms) : ""));
      if(s.status === "skipped"){ out.push("       пропущен по условию"); continue; }
      for(const l of s.log) out.push("       " + l);
    }
    out.push("");
  }
  return {out};
}

function cmdGraph(C, a){
  const wf = parseWorkflow(C, a.opts.f || workflowFile(C));
  const names = Object.keys(wf.jobs);
  const level = {};
  const depth = n => {
    if(level[n] !== undefined) return level[n];
    const deps = [].concat(wf.jobs[n].needs || []).map(String);
    level[n] = deps.length ? Math.max.apply(null, deps.map(depth)) + 1 : 0;
    return level[n];
  };
  names.forEach(depth);
  const max = Math.max.apply(null, names.map(n => level[n]));
  const out = [];
  for(let L = 0; L <= max; L++){
    const here = names.filter(n => level[n] === L);
    out.push((L ? "  ↓" : "") );
    out.push((L === 0 ? "" : "") + here.map(n => "[" + n + "]").join("   ") +
      (here.length > 1 ? "   ← выполняются одновременно" : ""));
  }
  return {out: out.filter((x, i) => !(i === 0 && x === ""))};
}

function cmdArtifacts(C, a){
  const run = lastRun(C);
  const names = Object.keys(run.artifacts);
  if(!names.length) return {out: ["Артефактов нет.",
    "Их сохраняет шаг actions/upload-artifact — и только если он выполнился."], warn: true};
  const rows = [["АРТЕФАКТ","ФАЙЛОВ","ИЗ ЗАДАЧИ"]];
  for(const n of names) rows.push([n, String(run.artifacts[n].files.length), run.artifacts[n].job]);
  const out = table(rows);
  if(a.flags.v || a.flags.long)
    for(const n of names){ out.push(""); out.push(n + ":"); for(const f of run.artifacts[n].files) out.push("  " + f); }
  return {out};
}

function cmdCache(C, a){
  if(a.args[0] === "clear"){ C.cache = {}; return {out: ["Кеш очищен."]}; }
  const keys = Object.keys(C.cache);
  if(!keys.length) return {out: ["Кеш пуст — следующий запуск будет полным."]};
  return {out: table([["КЛЮЧ","ЧТО"]].concat(keys.map(k => [k, C.cache[k].bucket || "—"])))};
}

function cmdHistory(C, a){
  if(!C.runs.length) return {out: ["Запусков ещё не было."]};
  return {out: table([["#","СОБЫТИЕ","СТАТУС","ВРЕМЯ","МАШИННОЕ"]].concat(
    C.runs.map(r => ["#" + r.n, r.event, MARK[r.status] + " " + r.status, dur(r.wall), dur(r.total)])))};
}

function cmdLint(C, a){
  const file = a.opts.f || workflowFile(C);
  const problems = [];
  const src = C.files[file];
  if(src === undefined) cierr("файла «" + file + "» нет");
  let wf;
  try{ wf = parseWorkflow(C, file); }
  catch(e){ return {out: ["✗ " + e.message].concat(e.hint ? ["  " + e.hint] : []), warn: true}; }

  if(!triggers(wf).length) problems.push("нет ни одного события в on — конвейер никогда не запустится");
  for(const n in wf.jobs){
    const j = wf.jobs[n];
    if(!j["runs-on"]) problems.push("задача «" + n + "»: нет runs-on");
    const steps = [].concat(j.steps || []);
    if(!steps.length) problems.push("задача «" + n + "»: нет ни одного шага");
    const usesCheckout = steps.some(s => String(s.uses || "").indexOf("actions/checkout") === 0);
    const needsCode = steps.some(s => /dotnet|npm|npx|cat |ls/.test(String(s.run || "")));
    if(needsCode && !usesCheckout)
      problems.push("задача «" + n + "»: команды работают с кодом, но нет actions/checkout");
    for(const s of steps){
      if(s.run !== undefined && s.uses !== undefined)
        problems.push("задача «" + n + "»: у шага есть и run, и uses — что-то одно");
      if(s.run === undefined && s.uses === undefined)
        problems.push("задача «" + n + "»: шаг без run и без uses");
      const cache = String(s.uses || "").indexOf("actions/cache") === 0;
      if(cache && !((s["with"] || {}).key))
        problems.push("задача «" + n + "»: actions/cache без key");
      if(cache && (s["with"] || {}).key !== undefined && String((s["with"] || {}).key).indexOf("hashFiles") < 0)
        problems.push("задача «" + n + "»: ключ кеша без hashFiles — кеш не обновится при смене зависимостей");
      if(String(s.uses || "").indexOf("actions/upload-artifact") === 0 && s["if"] === undefined)
        problems.push("задача «" + n + "»: артефакт выгружается без «if» — при падении шаг не выполнится");
    }
  }
  if(!problems.length) return {out: ["✓ " + file + ": замечаний нет"]};
  return {out: ["✗ " + file + ": замечаний " + problems.length]
    .concat(problems.map(p => "  · " + p)), warn: true};
}

function cmdTests(C, a){
  const by = {};
  for(const t of C.tests) by[t.group] = (by[t.group] || 0) + 1;
  const rows = [["ГРУППА","ТЕСТОВ","ИЗ НИХ НЕСТАБИЛЬНЫХ"]];
  for(const g in by) rows.push([g, String(by[g]),
    String(C.tests.filter(t => t.group === g && t.flaky && !C.flakyFixed).length)]);
  return {out: table(rows)};
}

function cmdSecrets(C, a){
  return {out: table([["СЕКРЕТ","ЗНАЧЕНИЕ"]].concat(
    Object.keys(C.secrets).map(k => [k, "***"])))
    .concat(C.fork ? ["", "Событие из форка: секреты в такой запуск не передаются."] : [])};
}
