
/* ============================================================
   Удалённые репозитории
   origin — это отдельный репозиторий в памяти. Обмен идёт
   объектами и ссылками, ровно как по сети.
   ============================================================ */
function copyObjects(from, to, tip){
  for(const c of ancestry(from, tip)){
    const o = obj(from, c);
    if(!o) continue;
    to.objects[c] = o;
    const walk = id => {
      const t = obj(from, id);
      if(!t || to.objects[id]) { to.objects[id] = t; if(!t || t.t !== "tree") return; }
      to.objects[id] = t;
      if(t.t === "tree") for(const e of t.ents) walk(e.id);
    };
    walk(o.tree);
  }
}

function cmdRemote(R, a){
  if(a.args[0] === "add"){
    const name = a.args[1];
    R.remotes[name] = R.remotes[name] || {repo: newRepo(a.args[2] || name)};
    return {out: [], quiet: true};
  }
  if(a.args[0] === "remove" || a.args[0] === "rm"){ delete R.remotes[a.args[1]]; return {out: []}; }
  if(a.args[0] === "prune"){
    const name = a.args[1] || "origin";
    const rem = R.remotes[name];
    if(!rem) gerr("No such remote '" + name + "'");
    const out = [];
    for(const r of remoteRefs(R)){
      if(r.indexOf(name + "/") !== 0) continue;
      const b = r.slice(name.length + 1);
      if(!rem.repo.refs["refs/heads/" + b]){
        out.push(" * [pruned] " + r);
        delete R.refs["refs/remotes/" + r];
      }
    }
    return {out: out.length ? ["Pruning " + name].concat(out) : []};
  }
  if(a.flags.v){
    const out = [];
    for(const n in R.remotes){ out.push(n + "\tgit@example.com:team/" + R.remotes[n].repo.name + ".git (fetch)");
                               out.push(n + "\tgit@example.com:team/" + R.remotes[n].repo.name + ".git (push)"); }
    return {out};
  }
  return {out: Object.keys(R.remotes)};
}

function fetchInto(R, name){
  const rem = R.remotes[name];
  if(!rem) gerr("'" + name + "' does not appear to be a git repository",
                "Удалённый репозиторий не подключён: «git remote -v» покажет, какие есть.");
  const out = [];
  for(const ref in rem.repo.refs){
    if(ref.indexOf("refs/heads/") !== 0) continue;
    const b = ref.replace("refs/heads/", "");
    const id = rem.repo.refs[ref];
    const local = "refs/remotes/" + name + "/" + b;
    const had = R.refs[local];
    if(had === id) continue;
    copyObjects(rem.repo, R, id);
    R.refs[local] = id;
    logRef(R, local, had, id, "fetch " + name);
    out.push(had && isAncestor(R, had, id)
      ? "   " + short(had) + ".." + short(id) + "  " + b + " -> " + name + "/" + b
      : " * [new branch]      " + b + " -> " + name + "/" + b);
  }
  for(const t in rem.repo.tags) if(!R.tags[t]){ copyObjects(rem.repo, R, rem.repo.tags[t].id); R.tags[t] = rem.repo.tags[t]; }
  return out;
}

function cmdFetch(R, a){
  const name = a.args[0] || "origin";
  const out = fetchInto(R, name);
  if(a.flags.prune || a.flags.p){
    const r = cmdRemote(R, {args:["prune", name], flags:{}, opts:{}});
    for(const l of r.out) out.push(l);
  }
  return {out: out.length ? ["From git@example.com:team/" + R.remotes[name].repo.name].concat(out) : []};
}

function cmdPull(R, a){
  const name = a.args[0] || "origin";
  const branch = a.args[1] || branchName(R);
  const out = fetchInto(R, name);
  const head = ["From git@example.com:team/" + R.remotes[name].repo.name].concat(out);
  const track = "refs/remotes/" + name + "/" + branch;
  if(!R.refs[track]) gerr("couldn't find remote ref " + branch);
  const rebase = a.flags.rebase || (R.config || {})["pull.rebase"] === "true";
  const r = rebase
    ? cmdRebase(R, {args: [name + "/" + branch], flags: {}, opts: {}})
    : cmdMerge(R, {args: [name + "/" + branch], flags: {}, opts: {}});
  return {out: (out.length ? head : []).concat(r.out), conflict: r.conflict};
}

function cmdPush(R, a){
  const name = a.args[0] || "origin";
  const rem = R.remotes[name];
  if(!rem) gerr("'" + name + "' does not appear to be a git repository");
  const branch = a.args[1] || branchName(R);
  if(!branch) gerr("You are not currently on a branch.");
  const mine = R.refs["refs/heads/" + branch];
  if(!mine) gerr("src refspec " + branch + " does not match any");
  const ref = "refs/heads/" + branch;
  const there = rem.repo.refs[ref] || null;
  const force = a.flags.f || a.flags.force;
  const lease = a.opts["force-with-lease"] !== undefined || a.flags["force-with-lease"];

  if(a.flags.u || a.opts.u || a.flags["set-upstream"]) R.upstream[branch] = name + "/" + branch;

  if(there && !isAncestor(R, there, mine) && !force && !lease)
    gerr("Updates were rejected because the remote contains work that you do not have locally.",
         "Кто-то запушил раньше вас. Сначала «git pull --rebase», потом push. Форсить здесь нельзя — затрёте чужое.");

  if(lease && there){
    const known = R.refs["refs/remotes/" + name + "/" + branch];
    if(known !== there)
      gerr("stale info: remote ref is at " + short(there) + ", you last saw " + short(known || "ничего"),
           "Именно от этого --force-with-lease и защищает: на сервере появилось то, чего вы не видели. Сделайте fetch и посмотрите.");
  }

  copyObjects(R, rem.repo, mine);
  rem.repo.refs[ref] = mine;
  logRef(rem.repo, ref, there, mine, "push");
  R.refs["refs/remotes/" + name + "/" + branch] = mine;

  if(a.flags.tags || a.opts.tags) for(const t in R.tags){ copyObjects(R, rem.repo, R.tags[t].id); rem.repo.tags[t] = R.tags[t]; }

  const kind = !there ? " * [new branch]      " + branch + " -> " + branch
             : isAncestor(R, there, mine) ? "   " + short(there) + ".." + short(mine) + "  " + branch + " -> " + branch
             : " + " + short(there) + "..." + short(mine) + " " + branch + " -> " + branch + " (forced update)";
  return {out: ["To git@example.com:team/" + rem.repo.name + ".git", kind]};
}

function cmdClone(R, a){ gerr("клонировать внутри тренажёра нечего: репозиторий уже здесь",
  "Сценарий каждого задания создаёт репозиторий сам. Смотрите «git remote -v» и «git log --oneline --all»."); }

/* ветка ↔ ветка на сервере */
function setUpstream(R, a){
  /* git branch -u origin/main [ветка]  или  --set-upstream-to=origin/main */
  const val = a.opts["set-upstream-to"] || (a.flags.u ? a.args[0] : null);
  const b = (a.flags.u ? a.args[1] : a.args[0]) || branchName(R);
  if(!val) gerr("нужно указать ветку на сервере: git branch -u origin/<ветка>");
  R.upstream[b] = val;
  return {out: ["branch '" + b + "' set up to track '" + val + "'."]};
}
