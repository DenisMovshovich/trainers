
/* ============================================================
   Разбор командной строки и диспетчер
   ============================================================ */
const TAKES_VALUE = {m:1, onto:1, n:1, C:1, S:1, source:1, "set-upstream-to":1,
                     author:1, message:1};

function parseArgs(tokens){
  const flags = {}, opts = {}, args = [], paths = [];
  for(let i = 0; i < tokens.length; i++){
    const t = tokens[i];
    if(t === "--"){ paths.push.apply(paths, tokens.slice(i + 1)); break; }
    if(t.indexOf("--") === 0){
      const body = t.slice(2);
      const eq = body.indexOf("=");
      if(eq > 0){ opts[body.slice(0, eq)] = body.slice(eq + 1); continue; }
      if(TAKES_VALUE[body] === 1 && tokens[i + 1] !== undefined && tokens[i + 1][0] !== "-"){ opts[body] = tokens[++i]; continue; }
      flags[body] = true;
      if(body === "no-ff" || body === "ff-only") flags[body] = true;
      continue;
    }
    if(t[0] === "-" && t.length > 1 && !/^-\d+$/.test(t)){
      const letters = t.slice(1);
      /* -S"строка", -m"текст" — значение слитно */
      const vk = letters[0];
      if(TAKES_VALUE[vk] === 1 && letters.length > 1 && letters !== "u"){
        opts[vk] = letters.slice(1); continue;
      }
      for(let k = 0; k < letters.length; k++){
        const c = letters[k];
        if(TAKES_VALUE[c] === 1 && k === letters.length - 1 && tokens[i + 1] !== undefined){ opts[c] = tokens[++i]; }
        else flags[c] = true;
      }
      continue;
    }
    if(/^-\d+$/.test(t)){ opts.n = t.slice(1); continue; }
    args.push(t);
  }
  if(opts.message && !opts.m) opts.m = opts.message;
  if(flags.oneline === undefined && flags["oneline"]) flags.oneline = true;
  return {flags, opts, args, paths};
}

/* ── команды не из git: без них нечем создать файл ─────── */
function shellCmd(R, tokens, raw){
  const c = tokens[0];
  if(c === "ls"){
    loadIgnore(R);
    const set = new Set();
    for(const p in R.work) set.add(p.indexOf("/") > 0 ? p.slice(0, p.indexOf("/")) + "/" : p);
    return {out: Array.from(set).sort()};
  }
  if(c === "cat"){
    const p = tokens[1];
    if(R.work[p] === undefined) gerr("cat: " + p + ": No such file or directory");
    return {out: lines(R.work[p])};
  }
  if(c === "rm"){
    const ps = tokens.slice(1).filter(x => x[0] !== "-");
    for(const p of ps){ if(R.work[p] === undefined) gerr("rm: " + p + ": No such file or directory"); delete R.work[p]; }
    return {out: [], quiet: true};
  }
  if(c === "touch"){
    for(const p of tokens.slice(1)) if(R.work[p] === undefined) R.work[p] = "";
    return {out: [], quiet: true};
  }
  if(c === "mkdir") return {out: [], quiet: true};
  if(c === "pwd") return {out: ["/home/dev/" + R.name]};
  if(c === "echo"){
    /* echo "текст" > файл   и   >> */
    const m = raw.match(/^echo\s+([\s\S]*?)\s*(>>?)\s*(\S+)\s*$/);
    if(!m){
      const t = tokenize(raw).slice(1);
      return {out: [t.join(" ")]};
    }
    const text = tokenize(m[1]).join(" ");
    const p = m[3];
    R.work[p] = m[2] === ">>" ? (R.work[p] === undefined ? text : R.work[p] + "\n" + text) : text;
    return {out: [], quiet: true};
  }
  return null;
}

const GIT_CMDS = {
  status: cmdStatus, add: cmdAdd, restore: cmdRestore, rm: cmdRm, clean: cmdClean,
  commit: cmdCommit, log: cmdLog, show: cmdShow, diff: cmdDiff,
  branch: cmdBranch, checkout: cmdCheckout, tag: cmdTag,
  merge: cmdMerge, rebase: cmdRebase, reset: cmdReset, revert: cmdRevert,
  "cherry-pick": cmdCherryPick, stash: cmdStash, reflog: cmdReflog, fsck: cmdFsck,
  blame: cmdBlame, grep: cmdGrep, remote: cmdRemote, fetch: cmdFetch,
  pull: cmdPull, push: cmdPush, clone: cmdClone, config: cmdConfig,
  "cat-file": cmdCatFile, "ls-files": cmdLsFiles,
  bisect: cmdBisect, "merge-base": cmdMergeBase
};

function runGit(R, raw){
  const line = String(raw).trim();
  if(!line) return {out: []};
  let tokens;
  try{ tokens = tokenize(line); }
  catch(e){ return {out: [], err: e.message, hint: e.hint || ""}; }

  try{
    const sh = shellCmd(R, tokens, line);
    if(sh) return sh;

    if(tokens[0] !== "git")
      return {out: [], err: "команда «" + tokens[0] + "» здесь не живёт",
              hint: "Доступны git и немного оболочки: echo, cat, ls, rm, touch."};

    let name = tokens[1];
    if(!name) return {out: ["usage: git <command> [<args>]"]};

    /* git switch / git restore --staged — современные имена */
    if(name === "switch"){
      const a = parseArgs(tokens.slice(2));
      if(a.flags.c) return {out: switchTo(R, a.args[0], {create: true})};
      if(a.args[0] === "-") return {out: switchTo(R, prevBranch(R) || gerr("нет предыдущей ветки"), {})};
      return {out: switchTo(R, a.args[0], {force: a.flags.f})};
    }
    if(name === "init"){
      R.initialized = true;
      return {out: ["Initialized empty Git repository in /home/dev/" + R.name + "/.git/"]};
    }

    const a = parseArgs(tokens.slice(2));

    if(name === "log" && a.opts.S) return cmdLogS(R, a, a.opts.S);
    if(name === "checkout" && (a.flags.ours || a.flags.theirs))
      return takeSide(R, a, a.flags.ours ? "ours" : "theirs");
    if(name === "push" && (a.flags.delete || a.flags.d)) return pushDelete(R, a);
    if(name === "branch" && (a.flags.u || a.opts["set-upstream-to"])) return setUpstream(R, a);

    const fn = GIT_CMDS[name];
    if(!fn) return {out: [], err: "git: '" + name + "' is not a git command.",
                    hint: "Список того, что понимает тренажёр, — в правой колонке."};
    const r = fn(R, a);
    return r || {out: []};
  }catch(e){
    if(e instanceof GitErr) return {out: [], err: e.message, hint: e.hint || ""};
    return {out: [], err: "внутренняя ошибка: " + (e && e.message || e)};
  }
}

function pushDelete(R, a){
  const name = a.args[0] || "origin", branch = a.args[1];
  const rem = R.remotes[name];
  if(!rem) gerr("'" + name + "' does not appear to be a git repository");
  if(!rem.repo.refs["refs/heads/" + branch]) gerr("unable to delete '" + branch + "': remote ref does not exist");
  delete rem.repo.refs["refs/heads/" + branch];
  delete R.refs["refs/remotes/" + name + "/" + branch];
  return {out: ["To git@example.com:team/" + rem.repo.name + ".git",
                " - [deleted]         " + branch]};
}

function prevBranch(R){
  const log = R.reflog.HEAD || [];
  for(const e of log){
    const m = /checkout: moving to (.+)$/.exec(e.what);
    if(m && R.refs["refs/heads/" + m[1]] && m[1] !== branchName(R)) return m[1];
  }
  return null;
}

/* Интерактивное перебазирование: план готовит интерфейс, применяет движок */
function applyTodo(R, upstream, todo, onto){
  return startRebase(R, upstream, todo, onto);
}
