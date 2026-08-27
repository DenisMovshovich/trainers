
/* ============================================================
   Диспетчер
   ============================================================ */
const CI_CMDS = {
  run: cmdRun, jobs: cmdJobs, logs: cmdLogs, graph: cmdGraph,
  artifacts: cmdArtifacts, cache: cmdCache, history: cmdHistory,
  lint: cmdLint, tests: cmdTests, secrets: cmdSecrets
};

function runCi(C, raw){
  const line = String(raw).trim();
  if(!line) return {out: []};
  let tokens;
  try{ tokens = tokenize(line); }
  catch(e){ return {out: [], err: e.message, hint: e.hint || ""}; }

  try{
    if(tokens[0] === "ls") return {out: Object.keys(C.files).sort()};
    if(tokens[0] === "cat"){
      const f = tokens[1];
      if(C.files[f] === undefined) cierr("cat: " + f + ": нет такого файла",
        "Список файлов репозитория — «ls».");
      return {out: String(C.files[f]).split("\n")};
    }
    if(tokens[0] === "clear") return {out: [], clear: true};

    if(tokens[0] !== "ci")
      return {out: [], err: "команда «" + tokens[0] + "» здесь не живёт",
              hint: "Доступны ci, а также ls и cat для файлов репозитория."};

    const name = tokens[1];
    if(!name) return {out: ["ci — управление конвейером.",
      "Команды: run, jobs, logs, graph, artifacts, cache, history, lint, tests, secrets."]};
    const fn = CI_CMDS[name];
    if(!fn) return {out: [], err: "нет команды «ci " + name + "»",
                    hint: "Что понимает тренажёр — в правой колонке."};
    return fn(C, parseArgs(tokens.slice(2))) || {out: []};
  }catch(e){
    if(e instanceof CiErr) return {out: [], err: e.message, hint: e.hint || ""};
    return {out: [], err: "внутренняя ошибка: " + (e && e.message || e)};
  }
}

/* сценарий: проект с готовыми файлами */
const newScenario = opts => newProject(opts);
