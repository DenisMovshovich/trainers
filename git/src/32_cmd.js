
/* ============================================================
   Команды: рабочая копия, индекс, коммиты, ветки
   ============================================================ */
function tokenize(line){
  const out = [];
  let cur = "", q = null, has = false;
  for(let i = 0; i < line.length; i++){
    const c = line[i];
    if(q){ if(c === q){ q = null; } else cur += c; continue; }
    if(c === '"' || c === "'"){ q = c; has = true; continue; }
    if(/\s/.test(c)){ if(cur || has){ out.push(cur); cur = ""; has = false; } continue; }
    cur += c;
  }
  if(q) gerr("незакрытая кавычка");
  if(cur || has) out.push(cur);
  return out;
}

/* ── разрешение ссылок: main, HEAD~2, abc1234, main@{1}, origin/main ── */
function resolve(R, spec){
  if(!spec) return headId(R);
  let s = String(spec).trim();

  const rl = s.match(/^(.+)@\{(\d+)\}$/);
  if(rl){
    const name = rl[1] === "HEAD" ? "HEAD" : "refs/heads/" + rl[1];
    const log = R.reflog[name] || [];
    const e = log[+rl[2]];
    if(!e) gerr("log for '" + rl[1] + "' only has " + log.length + " entries");
    return e.to;
  }

  let steps = [];
  const m = s.match(/^(.*?)((?:[~^]\d*)*)$/);
  if(m && m[2]){
    s = m[1];
    const re = /([~^])(\d*)/g;
    let x;
    while((x = re.exec(m[2]))) steps.push([x[1], x[2] === "" ? 1 : +x[2]]);
  }

  let id = null;
  if(s === "HEAD" || s === "") id = headId(R);
  else if(s === "ORIG_HEAD") id = R.ORIG_HEAD;
  else if(R.refs["refs/heads/" + s]) id = R.refs["refs/heads/" + s];
  else if(R.refs["refs/remotes/" + s]) id = R.refs["refs/remotes/" + s];
  else if(R.tags[s]) id = R.tags[s].id;
  else if(/^[0-9a-f]{4,40}$/.test(s)){
    const hit = Object.keys(R.objects).filter(k => k.indexOf(s) === 0 && R.objects[k].t === "commit");
    if(hit.length > 1) gerr("short object ID " + s + " is ambiguous");
    id = hit[0] || null;
  }
  if(!id) gerr("unknown revision or path not in the working tree: " + spec,
               "Проверьте «git branch -a» и «git log --oneline» — такого имени или хеша нет.");

  for(const [op, n] of steps){
    for(let k = 0; k < (op === "~" ? n : 1); k++){
      const o = obj(R, id);
      if(!o || !o.parents.length) gerr(spec + ": такого предка нет");
      id = op === "^" ? (o.parents[n - 1] || gerr(spec + ": у коммита нет родителя №" + n)) : o.parents[0];
    }
  }
  return id;
}

/* ── .gitignore ────────────────────────────────────────── */
function ignored(R, path){
  for(const raw of R.ignore){
    const p = raw.trim();
    if(!p || p[0] === "#") continue;
    if(p.slice(-1) === "/"){ if(path.indexOf(p) === 0) return true; continue; }
    const re = new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&")
                                 .replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]") + "$");
    const base = path.split("/").pop();
    if(re.test(path) || re.test(base)) return true;
  }
  return false;
}
function loadIgnore(R){
  R.ignore = R.work[".gitignore"] ? R.work[".gitignore"].split("\n") : [];
}

/* ── состояние ─────────────────────────────────────────── */
function statusSets(R){
  loadIgnore(R);
  const head = commitFiles(R, headId(R));
  const staged = [], unstaged = [], untracked = [];
  const all = new Set([].concat(Object.keys(head), Object.keys(R.index), Object.keys(R.work)));
  for(const p of Array.from(all).sort()){
    const h = head[p], i = R.index[p], w = R.work[p];
    if(changed(h, i)) staged.push({p, k: h === undefined ? "new file" : i === undefined ? "deleted" : "modified"});
    if(changed(i, w)){
      if(i === undefined){ if(!ignored(R, p)) untracked.push(p); }
      else unstaged.push({p, k: w === undefined ? "deleted" : "modified"});
    }
  }
  return {staged, unstaged, untracked};
}

function cmdStatus(R, a){
  const s = statusSets(R);
  const out = [];
  if(a.flags.short || a.flags.porcelain){
    const mark = {};
    for(const x of s.staged) mark[x.p] = (x.k === "new file" ? "A" : x.k === "deleted" ? "D" : "M") + " ";
    for(const x of s.unstaged) mark[x.p] = (mark[x.p] ? mark[x.p][0] : " ") + (x.k === "deleted" ? "D" : "M");
    for(const p of s.untracked) mark[p] = "??";
    for(const p of Object.keys(mark).sort()) out.push(mark[p] + " " + p);
    return {out};
  }
  out.push(detached(R)
    ? "HEAD detached at " + short(headId(R))
    : "On branch " + branchName(R));
  const up = R.upstream[branchName(R)];
  if(up){
    const mine = headId(R), theirs = R.refs["refs/remotes/" + up];
    const ahead = ancestry(R, mine).filter(c => !isAncestor(R, c, theirs) && c !== theirs).length;
    const behind = ancestry(R, theirs).filter(c => !isAncestor(R, c, mine) && c !== mine).length;
    if(!ahead && !behind) out.push("Your branch is up to date with '" + up + "'.");
    else if(ahead && !behind) out.push("Your branch is ahead of '" + up + "' by " + ahead + " commit" + (ahead > 1 ? "s" : "") + ".");
    else if(!ahead && behind) out.push("Your branch is behind '" + up + "' by " + behind + " commit" + (behind > 1 ? "s" : "") + ".");
    else out.push("Your branch and '" + up + "' have diverged,");
  }
  if(R.merging && R.merging.conflicts.length){
    out.push("You have unmerged paths.");
    out.push('  (fix conflicts and run "git commit")');
    out.push('  (use "git merge --abort" to abort the merge)');
    out.push("");
    out.push("Unmerged paths:");
    for(const p of R.merging.conflicts) out.push("\tboth modified:   " + p);
    out.push("");
  }
  if(s.staged.length){
    out.push("");
    out.push("Changes to be committed:");
    out.push('  (use "git restore --staged <file>..." to unstage)');
    for(const x of s.staged) out.push("\t" + (x.k + ":").padEnd(12) + x.p);
  }
  if(s.unstaged.length){
    out.push("");
    out.push("Changes not staged for commit:");
    out.push('  (use "git add <file>..." to update what will be committed)');
    out.push('  (use "git restore <file>..." to discard changes in working directory)');
    for(const x of s.unstaged) out.push("\t" + (x.k + ":").padEnd(12) + x.p);
  }
  if(s.untracked.length){
    out.push("");
    out.push("Untracked files:");
    out.push('  (use "git add <file>..." to include in what will be committed)');
    for(const p of s.untracked) out.push("\t" + p);
  }
  if(!s.staged.length && !s.unstaged.length && !s.untracked.length && !R.merging)
    out.push("nothing to commit, working tree clean");
  else if(!s.staged.length && (s.unstaged.length || s.untracked.length))
    out.push("", 'no changes added to commit (use "git add" and/or "git commit -a")');
  return {out};
}

/* ── индекс ────────────────────────────────────────────── */
function expand(R, pats, where){
  const src = where || R.work;
  const out = [];
  for(const p of pats){
    if(p === "." || p === "-A" || p === "--all" || p === "*"){
      for(const k in src) if(!ignored(R, k)) out.push(k);
      for(const k in R.index) if(src[k] === undefined) out.push(k);   /* удалённые тоже */
      continue;
    }
    if(p.slice(-1) === "/" || p.indexOf("*") >= 0){
      const re = new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"));
      let hit = false;
      for(const k in src) if(re.test(k)){ out.push(k); hit = true; }
      if(!hit) gerr("pathspec '" + p + "' did not match any files");
      continue;
    }
    if(src[p] === undefined && R.index[p] === undefined && R.work[p] === undefined)
      gerr("pathspec '" + p + "' did not match any files");
    out.push(p);
  }
  return Array.from(new Set(out));
}

function cmdAdd(R, a){
  loadIgnore(R);
  if(!a.args.length) gerr("Nothing specified, nothing added.",
    "Укажите файл или «git add .» — но точка добавит вообще всё незаигнорированное.");
  const ps = expand(R, a.args);
  let n = 0;
  for(const p of ps){
    if(R.work[p] === undefined){ delete R.index[p]; n++; continue; }
    if(ignored(R, p) && R.index[p] === undefined && a.args.indexOf(p) < 0) continue;
    R.index[p] = R.work[p]; n++;
  }
  if(R.merging) R.merging.conflicts = R.merging.conflicts.filter(p => ps.indexOf(p) < 0);
  return {out: [], quiet: true, n};
}

function cmdRestore(R, a){
  const st = a.flags.staged;
  const src = a.opts.source ? commitFiles(R, resolve(R, a.opts.source)) : commitFiles(R, headId(R));
  if(!a.args.length) gerr("you must specify path(s) to restore");
  const ps = expand(R, a.args, st ? R.index : R.work);
  for(const p of ps){
    if(st){ if(src[p] === undefined) delete R.index[p]; else R.index[p] = src[p]; }
    else { if(R.index[p] === undefined) delete R.work[p]; else R.work[p] = R.index[p]; }
  }
  return {out: [], quiet: true};
}

function cmdRm(R, a){
  const ps = expand(R, a.args);
  for(const p of ps){
    if(a.flags.cached) delete R.index[p];
    else { delete R.index[p]; delete R.work[p]; }
  }
  return {out: ps.map(p => "rm '" + p + "'")};
}

function cmdClean(R, a){
  loadIgnore(R);
  if(!a.flags.f && !a.flags.n)
    gerr("clean.requireForce defaults to true and neither -i, -n, nor -f given; refusing to clean",
         "git clean удаляет безвозвратно, поэтому требует -f. Сначала посмотрите с -n.");
  const s = statusSets(R);
  const out = [];
  for(const p of s.untracked){
    out.push((a.flags.n ? "Would remove " : "Removing ") + p);
    if(a.flags.f) delete R.work[p];
  }
  return {out};
}

/* ── коммит ────────────────────────────────────────────── */
function doCommit(R, msg, parents, opts){
  opts = opts || {};
  const tree = buildTree(R, R.index);
  R.now += 60;
  const c = {t:"commit", tree, parents: parents.filter(Boolean), msg,
             author: opts.author || R.author, at: opts.at || R.now};
  return store(R, c);
}

function cmdCommit(R, a){
  if(a.flags.a || a.flags.all){
    loadIgnore(R);
    for(const p in R.index) if(R.work[p] === undefined) delete R.index[p];
    for(const p in R.work) if(R.index[p] !== undefined || !ignored(R, p)) {
      if(R.index[p] !== undefined) R.index[p] = R.work[p];
    }
  }
  let msg = a.opts.m;
  const s = statusSets(R);
  /* завершение слияния — сообщение git формирует сам */
  if(!msg && R.merging && !R.merging.conflicts.length)
    msg = R.merging.name === "revert" ? "Revert" : "Merge branch '" + R.merging.name + "'";

  if(R.merging && R.merging.conflicts.length)
    gerr("Committing is not possible because you have unmerged files.",
         "Разрешите конфликт в файле, затем «git add <файл>» — это и означает «конфликт улажен».");

  if(a.flags.amend){
    const cur = headId(R);
    if(!cur) gerr("You have nothing to amend.");
    const o = obj(R, cur);
    const id = doCommit(R, msg || o.msg, o.parents, {author: o.author, at: o.at});
    R.ORIG_HEAD = cur;
    moveHead(R, id, "commit (amend): " + (msg || o.msg));
    return {out: ["[" + (branchName(R) || "detached HEAD") + " " + short(id) + "] " + (msg || o.msg),
                  " Date: изменён последний коммит, хеш стал другим"]};
  }

  if(!msg) gerr("Aborting commit due to empty commit message.",
                'Сообщение обязательно: git commit -m "что и зачем".');
  if(!s.staged.length && !R.merging)
    gerr("nothing to commit, working tree clean",
         "Пусто именно в индексе. Изменённый файл сам туда не попадает — нужен «git add».");

  const parents = R.merging ? [headId(R), R.merging.from] : [headId(R)];
  const id = doCommit(R, msg, parents);
  const first = !headId(R);
  R.ORIG_HEAD = headId(R);
  moveHead(R, id, "commit: " + msg);
  const merged = !!R.merging;
  R.merging = null;
  const n = s.staged.length;
  return {out: ["[" + (branchName(R) || "detached HEAD") + (first ? " (root-commit)" : "") + " " +
                short(id) + "] " + msg,
                " " + n + " file" + (n === 1 ? "" : "s") + " changed" + (merged ? ", merge commit" : "")]};
}

/* ── журнал ────────────────────────────────────────────── */
function refsAt(R, id){
  const names = [];
  if(headId(R) === id) names.push(detached(R) ? "HEAD" : "HEAD -> " + branchName(R));
  for(const b of branches(R)) if(R.refs["refs/heads/" + b] === id && !(!detached(R) && b === branchName(R))) names.push(b);
  for(const r of remoteRefs(R)) if(R.refs["refs/remotes/" + r] === id) names.push(r);
  for(const t in R.tags) if(R.tags[t].id === id) names.push("tag: " + t);
  return names;
}
function cmdLog(R, a){
  /* диапазон A..B — «что есть в B и нет в A» */
  if(a.args.length && a.args[0].indexOf("..") > 0){
    const [f, t] = a.args[0].split("..");
    const only = ownCommits(R, resolve(R, t || "HEAD"), resolve(R, f || "HEAD")).reverse();
    return {out: only.map(id => a.flags.oneline
      ? short(id) + " " + obj(R, id).msg
      : "commit " + id + "\nAuthor: " + obj(R, id).author + "\n\n    " + obj(R, id).msg + "\n")};
  }
  let start = a.args.length ? resolve(R, a.args[0]) : headId(R);
  if(!start) gerr("your current branch '" + branchName(R) + "' does not have any commits yet");
  let hist = history(R, start);
  const path = a.args.length > 1 ? a.args[a.args.length - 1] : (a.args.length === 1 && !a.opts.__rev ? null : null);
  const paths = a.paths || [];
  if(paths.length) hist = hist.filter(id => {
    const o = obj(R, id);
    const now = commitFiles(R, id), was = o.parents.length ? commitFiles(R, o.parents[0]) : {};
    return paths.some(p => changed(was[p], now[p]));
  });
  if(a.opts.author) hist = hist.filter(id => obj(R, id).author.indexOf(a.opts.author) >= 0);
  if(a.opts.grep) hist = hist.filter(id => obj(R, id).msg.indexOf(a.opts.grep) >= 0);
  if(a.opts.n) hist = hist.slice(0, +a.opts.n);
  if(a.flags.oneline){
    return {out: hist.map(id => {
      const r = refsAt(R, id);
      return short(id) + (r.length ? " (" + r.join(", ") + ")" : "") + " " + obj(R, id).msg;
    })};
  }
  const out = [];
  for(const id of hist){
    const o = obj(R, id);
    const r = refsAt(R, id);
    out.push("commit " + id + (r.length ? " (" + r.join(", ") + ")" : ""));
    if(o.parents.length > 1) out.push("Merge: " + o.parents.map(short).join(" "));
    out.push("Author: " + o.author);
    out.push("");
    out.push("    " + o.msg);
    out.push("");
  }
  return {out};
}

function cmdShow(R, a){
  const id = resolve(R, a.args[0]);
  const o = obj(R, id);
  const out = ["commit " + id, "Author: " + o.author, "", "    " + o.msg, ""];
  const now = commitFiles(R, id), was = o.parents.length ? commitFiles(R, o.parents[0]) : {};
  for(const p of Array.from(new Set([].concat(Object.keys(was), Object.keys(now)))).sort())
    if(changed(was[p], now[p])) for(const l of unified(p, was[p], now[p])) out.push(l);
  return {out};
}

function cmdDiff(R, a){
  const out = [];
  let A, B;
  if(a.args.length === 2){ A = commitFiles(R, resolve(R, a.args[0])); B = commitFiles(R, resolve(R, a.args[1])); }
  else if(a.args.length === 1){ A = commitFiles(R, resolve(R, a.args[0])); B = R.work; }
  else if(a.flags.staged || a.flags.cached){ A = commitFiles(R, headId(R)); B = R.index; }
  else { A = R.index; B = R.work; }
  for(const p of Array.from(new Set([].concat(Object.keys(A), Object.keys(B)))).sort())
    if(changed(A[p], B[p])) for(const l of unified(p, A[p], B[p])) out.push(l);
  return {out};
}

/* ── ветки ─────────────────────────────────────────────── */
function cmdBranch(R, a){
  if(a.flags.d || a.flags.D){
    const out = [];
    for(const name of a.args){
      const ref = "refs/heads/" + name;
      if(!R.refs[ref]) gerr("branch '" + name + "' not found");
      if(branchName(R) === name) gerr("Cannot delete branch '" + name + "' checked out at '.'");
      if(!a.flags.D && !isAncestor(R, R.refs[ref], headId(R)))
        gerr("The branch '" + name + "' is not fully merged.",
             "Коммиты этой ветки никуда не влиты — они пропадут из виду. Если это осознанно, повторите с -D. Даже после -D их находит reflog.");
      out.push("Deleted branch " + name + " (was " + short(R.refs[ref]) + ").");
      delete R.refs[ref];
      delete R.reflog[ref];
    }
    return {out};
  }
  if(a.flags.m){
    const [from, to] = a.args.length === 2 ? a.args : [branchName(R), a.args[0]];
    R.refs["refs/heads/" + to] = R.refs["refs/heads/" + from];
    delete R.refs["refs/heads/" + from];
    if(branchName(R) === from) R.HEAD.ref = "refs/heads/" + to;
    return {out: []};
  }
  if(a.args.length){
    const name = a.args[0];
    if(R.refs["refs/heads/" + name]) gerr("a branch named '" + name + "' already exists");
    const at = a.args[1] ? resolve(R, a.args[1]) : headId(R);
    if(!at) gerr("Not a valid object name: 'HEAD'.");
    setRef(R, "refs/heads/" + name, at, "branch: Created from " + (a.args[1] || "HEAD"));
    return {out: [], quiet: true};
  }
  const out = [];
  for(const b of branches(R)){
    const up = R.upstream[b];
    out.push((branchName(R) === b ? "* " : "  ") + b +
             (a.flags.v ? "  " + short(R.refs["refs/heads/" + b]) +
                          (up ? " [" + up + "]" : "") + " " + obj(R, R.refs["refs/heads/" + b]).msg : ""));
  }
  if(a.flags.a || a.flags.r)
    for(const r of remoteRefs(R)) out.push("  remotes/" + r);
  return {out};
}

function switchTo(R, spec, opts){
  opts = opts || {};
  const s = statusSets(R);
  const target = opts.create ? headId(R) : resolve(R, spec);
  const from = commitFiles(R, headId(R)), to = commitFiles(R, target);
  /* незакоммиченные изменения переносятся, если файл в целевом коммите такой же */
  const risky = [].concat(s.staged.map(x => x.p), s.unstaged.map(x => x.p))
                  .filter(p => changed(from[p], to[p]));
  if(risky.length && !opts.force)
    gerr("Your local changes to the following files would be overwritten by checkout:\n\t" +
         risky.join("\n\t"), "Сохраните их: «git stash», или закоммитьте, или отбросьте через «git restore».");

  const dirty = {};
  for(const x of s.unstaged) dirty[x.p] = R.work[x.p];
  for(const x of s.staged) dirty[x.p] = R.work[x.p];
  for(const p of s.untracked) dirty[p] = R.work[p];

  R.index = Object.assign({}, to);
  R.work = Object.assign({}, to);
  for(const p in dirty){ if(dirty[p] === undefined) delete R.work[p]; else R.work[p] = dirty[p]; }

  if(opts.create){
    setRef(R, "refs/heads/" + spec, target, "branch: Created from HEAD");
    R.HEAD = {ref: "refs/heads/" + spec, id: null};
    logRef(R, "HEAD", target, target, "checkout: moving to " + spec);
    return ["Switched to a new branch '" + spec + "'"];
  }
  const wasDetached = detached(R), prev = headId(R);
  if(R.refs["refs/heads/" + spec]){
    R.HEAD = {ref: "refs/heads/" + spec, id: null};
    logRef(R, "HEAD", prev, target, "checkout: moving to " + spec);
    return ["Switched to branch '" + spec + "'"];
  }
  R.HEAD = {ref: null, id: target};
  logRef(R, "HEAD", prev, target, "checkout: moving to " + spec);
  return ["Note: switching to '" + spec + "'.",
          "",
          "You are in 'detached HEAD' state. You can look around, make experimental",
          "changes and commit them, and you can discard any commits you make in this",
          "state without impacting any branches by switching back to a branch.",
          "",
          "HEAD is now at " + short(target) + " " + obj(R, target).msg];
}

function cmdCheckout(R, a){
  if(a.flags.b || a.flags.c) return {out: switchTo(R, a.args[0], {create: true})};
  if(!a.args.length) gerr("you must specify a branch or commit");
  /* git checkout -- file — старая форма восстановления файла */
  if(a.args[0] === "--" || (a.args.length > 1 && a.args[0] === "--"))
    return cmdRestore(R, {args: a.args.filter(x => x !== "--"), flags:{}, opts:{}});
  if(R.work[a.args[0]] !== undefined && !R.refs["refs/heads/" + a.args[0]])
    return cmdRestore(R, {args: a.args, flags:{}, opts:{}});
  return {out: switchTo(R, a.args[0], {force: a.flags.f})};
}

function cmdTag(R, a){
  if(a.flags.d){ for(const n of a.args){ if(!R.tags[n]) gerr("tag '" + n + "' not found"); delete R.tags[n]; } return {out: a.args.map(n => "Deleted tag '" + n + "'")}; }
  if(!a.args.length) return {out: Object.keys(R.tags).sort()};
  const name = a.args[0];
  const at = a.args[1] ? resolve(R, a.args[1]) : headId(R);
  const ann = !!(a.flags.a || a.opts.m);
  R.tags[name] = {id: at, annotated: ann, msg: a.opts.m || ""};
  return {out: [], quiet: true};
}

function cmdCatFile(R, a){
  let spec = a.args[a.args.length - 1];
  let wantTree = false;
  if(/\^\{tree\}$/.test(spec)){ wantTree = true; spec = spec.replace(/\^\{tree\}$/, ""); }
  let id = /^[0-9a-f]{4,40}$/.test(spec)
    ? Object.keys(R.objects).filter(k => k.indexOf(spec) === 0)[0]
    : resolve(R, spec);
  if(!id) gerr("Not a valid object name " + spec);
  if(wantTree) id = obj(R, id).tree;
  const o = obj(R, id);
  if(a.flags.t) return {out: [o.t]};
  if(o.t === "blob") return {out: lines(o.data)};
  if(o.t === "tree") return {out: o.ents.map(e => (e.type === "tree" ? "040000 tree " : "100644 blob ") + e.id + "\t" + e.name)};
  const out = ["tree " + o.tree];
  for(const p of o.parents) out.push("parent " + p);
  out.push("author " + o.author, "", o.msg);
  return {out};
}

function cmdLsFiles(R, a){ return {out: Object.keys(R.index).sort()}; }

function cmdConfig(R, a){
  if(a.args.length >= 2){ R.config = R.config || {}; R.config[a.args[0]] = a.args[1]; return {out: [], quiet: true}; }
  if(a.args.length === 1) return {out: [(R.config || {})[a.args[0]] || ""]};
  return {out: Object.keys(R.config || {}).map(k => k + "=" + R.config[k])};
}
