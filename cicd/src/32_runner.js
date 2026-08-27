
/* ============================================================
   Раннер: что происходит внутри шага
   ============================================================ */

/* Набор тестов проекта. Нестабильные падают не всегда — как в жизни. */
function defaultTests(){
  const t = [];
  const add = (n, group, ms, flaky) => t.push({name: n, group, ms, flaky: flaky || 0});
  for(let i = 1; i <= 40; i++) add("Unit.Case" + i, "unit", 1);
  for(let i = 1; i <= 12; i++) add("Api.Case" + i, "api", 4);
  for(let i = 1; i <= 18; i++) add("Ui.Case" + i, "ui", 9);
  /* два нестабильных теста интерфейса: падают примерно в трети запусков */
  t.filter(x => x.name === "Ui.Case7" || x.name === "Ui.Case13").forEach(x => { x.flaky = 3; });
  return t;
}
/* Детерминированно: падёт ли нестабильный тест в этой попытке */
function flakyFails(R, test, attempt){
  if(!test.flaky) return false;
  if(R.flakyFixed) return false;
  let h = 2166136261 ^ (R.seed + attempt * 7919);
  for(let i = 0; i < test.name.length; i++){ h ^= test.name.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % test.flaky) === 0;
}

const TOOLS = [
  {re: /^dotnet\s+restore/,            id: "restore", ms: 45, cacheOf: "nuget"},
  {re: /^npm\s+ci/,                    id: "restore", ms: 40, cacheOf: "npm"},
  {re: /^npx\s+playwright\s+install/,  id: "browsers", ms: 60, cacheOf: "playwright"},
  {re: /^dotnet\s+build/,              id: "build",   ms: 40},
  {re: /^npm\s+run\s+build/,           id: "build",   ms: 30}
];

function runShell(R, J, line, log){
  const cmd = String(line).trim();
  if(!cmd) return 0;

  const echo = cmd.match(/^echo\s+([\s\S]*)$/);
  if(echo){
    let text = echo[1].trim();
    const redir = text.match(/^([\s\S]*?)\s*>>?\s*(\$?[A-Z_]+|\S+)\s*$/);
    if(redir){
      text = redir[1].replace(/^["']|["']$/g, "");
      const dst = redir[2];
      if(dst === "$GITHUB_OUTPUT" || dst === "$GITHUB_ENV"){
        const kv = text.match(/^([A-Za-z_][A-Za-z0-9_\-]*)=([\s\S]*)$/);
        if(!kv) cierr("в " + dst + " пишут строки вида ключ=значение");
        if(dst === "$GITHUB_OUTPUT") J.stepOut[kv[1]] = kv[2];
        else J.env[kv[1]] = kv[2];
        return 0;
      }
      R.files[dst] = (redir[0].indexOf(">>") >= 0 && R.files[dst] ? R.files[dst] + "\n" : "") + text;
      return 0;
    }
    log(mask(R, text.replace(/^["']|["']$/g, "")));
    return 0;
  }

  const ex = cmd.match(/^exit\s+(\d+)/);
  if(ex) return parseInt(ex[1], 10);

  const sl = cmd.match(/^sleep\s+(\d+)/);
  if(sl){ J.ms += parseInt(sl[1], 10); return 0; }

  if(/^ls\b/.test(cmd)){ for(const f of Object.keys(R.files).sort()) log(f); return 0; }
  const ct = cmd.match(/^cat\s+(\S+)/);
  if(ct){
    if(R.files[ct[1]] === undefined){ log("cat: " + ct[1] + ": No such file or directory"); return 1; }
    for(const l of String(R.files[ct[1]]).split("\n")) log(l);
    return 0;
  }
  if(/^(cd|mkdir|export|set)\b/.test(cmd)) return 0;

  for(const t of TOOLS){
    if(!t.re.test(cmd)) continue;
    const hit = t.cacheOf && J.cacheHits[t.cacheOf];
    J.ms += hit ? Math.round(t.ms / 8) : t.ms;
    log(hit ? "восстановлено из кеша за " + Math.round(t.ms / 8) + "s"
            : "загрузка и подготовка: " + t.ms + "s");
    if(t.id === "build") R.files["bin/app.dll"] = "собрано";
    return 0;
  }

  const test = cmd.match(/^(dotnet\s+test|npx\s+playwright\s+test|npm\s+test)\b([\s\S]*)$/);
  if(test) return runTests(R, J, test[2] || "", log);

  cierr("раннер не знает команду «" + cmd.split(/\s+/)[0] + "»",
    "Понимает: echo, exit, sleep, ls, cat, cd, mkdir, dotnet restore/build/test, npm ci/test/run build, npx playwright install/test.");
}
const mask = (R, s) => {
  let out = String(s);
  for(const k in R.secrets) if(R.secrets[k]) out = out.split(R.secrets[k]).join("***");
  return out;
};

function runTests(R, J, args, log){
  const filter = (args.match(/--filter\s+(\S+)/) || [])[1] || null;
  const retries = parseInt((args.match(/--retries\s+(\d+)/) || [])[1] || "0", 10);
  const shard = (args.match(/--shard[= ](\d+)\/(\d+)/) || null);

  let list = R.tests.slice();
  if(filter){
    const m = filter.match(/(?:Category|group)\s*=\s*(\w+)/i) || filter.match(/^(\w+)$/);
    const g = m ? m[1].toLowerCase() : filter.toLowerCase();
    list = list.filter(t => t.group === g);
    if(!list.length){ log("фильтру «" + filter + "» не соответствует ни один тест"); return 1; }
  }
  if(shard){
    const idx = parseInt(shard[1], 10), total = parseInt(shard[2], 10);
    list = list.filter((_, i) => (i % total) + 1 === idx);
  }

  let failed = [], flakyPassed = [];
  for(const t of list){
    J.ms += t.ms;
    let ok = !flakyFails(R, t, 0);
    if(!ok) for(let a = 1; a <= retries && !ok; a++){
      J.ms += t.ms;
      if(!flakyFails(R, t, a)){
        ok = true; flakyPassed.push(t.name);
        R.files["test-results/" + t.name + "/trace.zip"] = "трассировка первой неудачной попытки";
      }
    }
    if(!ok) failed.push(t.name);
  }
  log("Всего тестов: " + list.length + ", успешно: " + (list.length - failed.length) +
      ", провалено: " + failed.length + (flakyPassed.length ? ", со второй попытки: " + flakyPassed.length : ""));
  for(const f of failed) log("  FAILED  " + f + " — Timeout 30000ms exceeded waiting for locator");
  R.files["TestResults/results.trx"] = "тестов " + list.length + ", провалено " + failed.length;
  if(failed.length){
    for(const f of failed) R.files["test-results/" + f + "/trace.zip"] = "трассировка";
    return 1;
  }
  return 0;
}

/* ── готовые действия ──────────────────────────────────── */
function runAction(R, J, step, cfg, log){
  const uses = String(step.uses).split("@")[0];
  const w = cfg.with || {};

  if(uses === "actions/checkout"){
    J.ms += 5;
    Object.assign(R.files, R.repo);
    log("получен код: " + Object.keys(R.repo).length + " файлов, коммит " + R.commit);
    return 0;
  }
  if(uses === "actions/setup-dotnet" || uses === "actions/setup-node"){
    J.ms += 8;
    log("установлен " + (uses.indexOf("node") > 0 ? "Node " : ".NET ") + (w["dotnet-version"] || w["node-version"] || "по умолчанию"));
    return 0;
  }
  if(uses === "actions/cache"){
    const key = String(w.key || "");
    if(!key) cierr("actions/cache требует key",
      "Ключ обычно включает hashFiles от файла блокировки: иначе кеш не обновится при смене зависимостей.");
    const bucket = cacheBucket(w.path || "");
    let hit = R.cache[key] !== undefined, restored = key;
    if(!hit){
      for(const rk of [].concat(w["restore-keys"] || []).join("\n").split("\n").filter(Boolean)){
        const pref = String(rk).trim();
        const found = Object.keys(R.cache).filter(k => k.indexOf(pref) === 0).sort();
        if(found.length){ restored = found[found.length - 1]; break; }
      }
    }
    const exact = hit;
    const any = hit || restored !== key;
    J.ms += any ? 4 : 1;
    if(exact) log("кеш найден по точному ключу: " + key);
    else if(any) log("точного совпадения нет, восстановлено по запасному ключу: " + restored);
    else log("кеш не найден по ключу " + key);
    if(any && bucket) J.cacheHits[bucket] = true;
    if(!exact) J.cacheSave.push({key, bucket});
    J.stepOut["cache-hit"] = exact ? "true" : "false";
    return 0;
  }
  if(uses === "actions/upload-artifact"){
    const name = String(w.name || "artifact");
    const pats = String(w.path || "").split("\n").map(x => x.trim()).filter(Boolean);
    const files = [];
    for(const p of pats) for(const f of matchFiles(R, p)) files.push(f);
    if(!files.length){
      const mode = String(w["if-no-files-found"] || "warn");
      log("файлов по пути не найдено: " + pats.join(", "));
      if(mode === "error") return 1;
      return 0;
    }
    J.ms += 6;
    const data = {};
    for(const f of files) data[f] = R.files[f];
    R.artifacts[name] = {files: files.slice(), data, job: J.name};
    log("отправлен артефакт «" + name + "»: " + files.length + " файлов");
    return 0;
  }
  if(uses === "actions/download-artifact"){
    const name = String(w.name || "artifact");
    if(!R.artifacts[name]){
      log("артефакт «" + name + "» не найден");
      return 1;
    }
    J.ms += 4;
    Object.assign(R.files, R.artifacts[name].data || {});
    log("получен артефакт «" + name + "»: " + R.artifacts[name].files.length + " файлов");
    return 0;
  }
  cierr("тренажёр не знает действие «" + uses + "»",
    "Есть: actions/checkout, actions/setup-dotnet, actions/setup-node, actions/cache, actions/upload-artifact, actions/download-artifact.");
}
function cacheBucket(path){
  const p = String(path);
  if(/nuget|\.nuget/.test(p)) return "nuget";
  if(/node_modules|\.npm/.test(p)) return "npm";
  if(/playwright|ms-playwright/.test(p)) return "playwright";
  return null;
}
