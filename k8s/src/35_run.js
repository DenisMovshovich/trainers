
/* ============================================================
   Диспетчер
   ============================================================ */
const CMDS = {
  get: cmdGet, describe: cmdDescribe, apply: cmdApply, delete: cmdDelete,
  scale: cmdScale, set: cmdSet, rollout: cmdRollout, create: cmdCreate,
  expose: cmdExpose, label: cmdLabel, logs: cmdLogs, top: cmdTop,
  config: cmdConfig, explain: cmdExplain, events: cmdEvents
};

function runKubectl(C, raw){
  const line = String(raw).trim();
  if(!line) return {out: []};
  let tokens;
  try{ tokens = tokenize(line); }
  catch(e){ return {out: [], err: e.message, hint: e.hint || ""}; }

  try{
    /* немного оболочки: посмотреть манифесты и вывести их список */
    if(tokens[0] === "ls") return {out: Object.keys(C.files).sort()};
    if(tokens[0] === "cat"){
      const f = tokens[1];
      if(C.files[f] === undefined) kerr("cat: " + f + ": No such file or directory");
      return {out: String(C.files[f]).split("\n")};
    }
    if(tokens[0] === "clear") return {out: [], clear: true};

    if(tokens[0] !== "kubectl" && tokens[0] !== "k")
      return {out: [], err: "команда «" + tokens[0] + "» здесь не живёт",
              hint: "Доступны kubectl (можно сокращённо k), а также ls и cat для манифестов."};

    const name = tokens[1];
    if(!name) return {out: ["kubectl controls the Kubernetes cluster manager.",
                            "Основные команды: get, describe, apply, delete, scale, rollout, logs, top, explain."]};
    const fn = CMDS[name];
    if(!fn) return {out: [], err: 'error: unknown command "' + name + '" for "kubectl"',
                    hint: "Что понимает тренажёр — в правой колонке."};

    const a = parseArgs(tokens.slice(2));
    C.now += 5;
    const r = fn(C, a) || {out: []};
    reconcile(C, 8);
    C.now += 5;
    reconcile(C, 4);
    return r;
  }catch(e){
    if(e instanceof K8sErr) return {out: [], err: e.message, hint: e.hint || ""};
    return {out: [], err: "внутренняя ошибка: " + (e && e.message || e)};
  }
}

/* ── сборка сценариев ──────────────────────────────────── */
function newScenario(opts){
  const C = newCluster(opts);
  C.files = Object.assign({}, (opts || {}).files);
  return C;
}
/* применить манифест напрямую — для подготовки сценариев */
function seed(C, yaml){
  for(const d of parseYaml(yaml)) applyDoc(C, d, "default");
  reconcile(C, 10);
  C.now += 30;
  reconcile(C, 6);
  return C;
}
