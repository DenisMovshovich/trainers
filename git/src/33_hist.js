
/* ============================================================
   Слияние, перебазирование, отмена, спасение
   ============================================================ */

/* Применить дерево коммита к индексу и рабочей копии */
function checkoutTree(R, id){
  const f = commitFiles(R, id);
  R.index = Object.assign({}, f);
  R.work = Object.assign({}, f);
}

/* Трёхстороннее слияние наборов файлов. Возвращает {files, conflicts} */
function mergeTrees(R, base, ours, theirs){
  const files = {}, conflicts = [];
  const all = Array.from(new Set([].concat(Object.keys(base), Object.keys(ours), Object.keys(theirs)))).sort();
  for(const p of all){
    const b = base[p], o = ours[p], t = theirs[p];
    if(o === t){ if(o !== undefined) files[p] = o; continue; }
    if(o === b){ if(t !== undefined) files[p] = t; continue; }   /* менял только он */
    if(t === b){ if(o !== undefined) files[p] = o; continue; }   /* меняли только мы */
    if(o === undefined || t === undefined){                      /* один удалил, другой правил */
      conflicts.push(p);
      files[p] = (o === undefined ? t : o);
      continue;
    }
    const m = merge3(b === undefined ? "" : b, o, t);
    files[p] = m.text;
    if(m.conflict) conflicts.push(p);
  }
  return {files, conflicts};
}

function cmdMerge(R, a){
  if(a.flags.abort){
    if(!R.merging) gerr("There is no merge in progress (MERGE_HEAD missing).");
    checkoutTree(R, headId(R));
    R.merging = null;
    return {out: []};
  }
  if(R.merging) gerr("You have not concluded your merge (MERGE_HEAD exists).",
                     "Сначала завершите: разрешите конфликт и «git commit», либо «git merge --abort».");
  if(!a.args.length) gerr("No commit specified and merge.defaultToUpstream not set.");
  const other = resolve(R, a.args[0]);
  const mine = headId(R);
  const base = mergeBase(R, mine, other);

  if(other === mine || isAncestor(R, other, mine)) return {out: ["Already up to date."]};

  if(base === mine && !a.flags["no-ff"] && !a.flags.squash){
    if(a.flags["ff-only"] === false){ /* ничего */ }
    R.ORIG_HEAD = mine;
    moveHead(R, other, "merge " + a.args[0] + ": Fast-forward");
    checkoutTree(R, other);
    return {out: ["Updating " + short(mine) + ".." + short(other), "Fast-forward"]};
  }
  if(a.flags["ff-only"] && base !== mine)
    gerr("Not possible to fast-forward, aborting.",
         "Ветки разошлись. Политика --ff-only как раз для того и нужна, чтобы это заметить: сначала перебазируйтесь.");

  const M = mergeTrees(R, commitFiles(R, base), commitFiles(R, mine), commitFiles(R, other));
  R.index = {}; R.work = {};
  for(const p in M.files){ R.work[p] = M.files[p]; if(M.conflicts.indexOf(p) < 0) R.index[p] = M.files[p]; }

  if(M.conflicts.length){
    R.merging = {from: other, name: a.args[0], conflicts: M.conflicts};
    return {out: M.conflicts.map(p => "CONFLICT (content): Merge conflict in " + p)
      .concat(["Automatic merge failed; fix conflicts and then commit the result."]), conflict: true};
  }

  if(a.flags.squash){
    return {out: ["Squash commit -- not updating HEAD", "Automatic merge went well; stopped before committing as requested"]};
  }
  const msg = a.opts.m || ("Merge branch '" + a.args[0] + "'");
  const id = doCommit(R, msg, [mine, other]);
  R.ORIG_HEAD = mine;
  moveHead(R, id, "merge " + a.args[0] + ": Merge made by the 'ort' strategy.");
  return {out: ["Merge made by the 'ort' strategy.", " " + Object.keys(M.files).length + " files changed"]};
}

/* ── перебазирование ───────────────────────────────────── */
/* коммиты ветки, которых нет в upstream, от старых к новым */
function ownCommits(R, tip, upstream){
  const up = new Set(ancestry(R, upstream));
  return ancestry(R, tip).filter(c => !up.has(c))
    .sort((x, y) => obj(R, x).at - obj(R, y).at);
}

/* Перенести один коммит поверх onto. Возвращает {id} либо {conflicts, files} */
function replay(R, c, onto){
  const o = obj(R, c);
  const base = o.parents.length ? commitFiles(R, o.parents[0]) : {};
  const M = mergeTrees(R, base, commitFiles(R, onto), commitFiles(R, c));
  if(M.conflicts.length) return {conflicts: M.conflicts, files: M.files};
  const before = R.index;
  R.index = M.files;
  R.now += 60;
  const id = doCommit(R, o.msg, [onto], {author: o.author, at: R.now});
  R.index = before;
  return {id};
}

function finishRebase(R){
  const S = R.rebasing;
  while(S.todo.length){
    const step = S.todo.shift();
    const o = obj(R, step.commit);

    if(step.op === "drop") continue;

    if(step.op === "squash" || step.op === "fixup"){
      /* влить изменения в уже перенесённый коммит */
      const prev = obj(R, S.onto);
      const base = o.parents.length ? commitFiles(R, o.parents[0]) : {};
      const M = mergeTrees(R, base, commitFiles(R, S.onto), commitFiles(R, step.commit));
      if(M.conflicts.length){
        for(const p in M.files) R.work[p] = M.files[p];
        R.index = {}; for(const p in M.files) if(M.conflicts.indexOf(p) < 0) R.index[p] = M.files[p];
        S.stopped = {commit: step.commit, conflicts: M.conflicts, squashInto: true};
        return {out: M.conflicts.map(p => "CONFLICT (content): Merge conflict in " + p)
          .concat(["error: could not apply " + short(step.commit) + "... " + o.msg,
                   'Resolve all conflicts manually, mark them as resolved with "git add", then run "git rebase --continue".']),
          conflict: true};
      }
      const before = R.index;
      R.index = M.files;
      const msg = step.op === "squash" ? prev.msg + "\n" + o.msg : prev.msg;
      R.now += 60;
      const id = doCommit(R, msg, prev.parents, {author: prev.author, at: R.now});
      R.index = before;
      S.onto = id;
      continue;
    }

    /* pick / reword */
    const r = replay(R, step.commit, S.onto);
    if(r.conflicts){
      for(const p in r.files) R.work[p] = r.files[p];
      R.index = {}; for(const p in r.files) if(r.conflicts.indexOf(p) < 0) R.index[p] = r.files[p];
      S.stopped = {commit: step.commit, conflicts: r.conflicts};
      return {out: r.conflicts.map(p => "CONFLICT (content): Merge conflict in " + p)
        .concat(["error: could not apply " + short(step.commit) + "... " + o.msg,
                 'Resolve all conflicts manually, mark them as resolved with "git add", then run "git rebase --continue".',
                 'You can instead skip this commit: run "git rebase --skip".']),
        conflict: true};
    }
    if(step.op === "reword" && step.msg){
      const p = obj(R, r.id);
      R.now += 60;
      S.onto = doCommit2(R, step.msg, p.parents, p.tree, {author: p.author, at: R.now});
    } else S.onto = r.id;
  }
  const branch = S.branch;
  R.ORIG_HEAD = S.orig;
  if(branch) setRef(R, "refs/heads/" + branch, S.onto, "rebase (finish): refs/heads/" + branch);
  else { R.HEAD.id = S.onto; logRef(R, "HEAD", S.orig, S.onto, "rebase (finish)"); }
  checkoutTree(R, S.onto);
  R.rebasing = null;
  return {out: ["Successfully rebased and updated " + (branch ? "refs/heads/" + branch : "HEAD") + "."]};
}
/* коммит с готовым деревом (нужен для reword) */
function doCommit2(R, msg, parents, tree, opts){
  R.now += 60;
  return store(R, {t:"commit", tree, parents, msg, author: opts.author || R.author, at: opts.at || R.now});
}

function startRebase(R, upstream, todo, ontoSpec){
  const mine = headId(R);
  const up = resolve(R, upstream);
  const onto = ontoSpec ? resolve(R, ontoSpec) : up;
  R.rebasing = {onto, branch: branchName(R), orig: mine, todo, stopped: null, upstream: up};
  return finishRebase(R);
}

function cmdRebase(R, a){
  if(a.flags.abort){
    if(!R.rebasing) gerr("No rebase in progress?");
    const S = R.rebasing;
    R.rebasing = null;
    if(S.branch) setRef(R, "refs/heads/" + S.branch, S.orig, "rebase: aborting");
    checkoutTree(R, S.orig);
    return {out: []};
  }
  if(a.flags.continue){
    const S = R.rebasing;
    if(!S) gerr("No rebase in progress?");
    if(!S.stopped) gerr("No rebase in progress?");
    const left = statusSets(R);
    if(left.unstaged.length)
      gerr("You must edit all merge conflicts and then\nmark them as resolved using git add",
           "Файл с маркерами <<<<<<< правится руками, затем «git add <файл>».");
    const o = obj(R, S.stopped.commit);
    R.now += 60;
    if(S.stopped.squashInto){
      const prev = obj(R, S.onto);
      S.onto = doCommit(R, prev.msg + "\n" + o.msg, prev.parents, {author: prev.author, at: R.now});
    } else {
      S.onto = doCommit(R, o.msg, [S.onto], {author: o.author, at: R.now});
    }
    S.stopped = null;
    return finishRebase(R);
  }
  if(a.flags.skip){
    const S = R.rebasing;
    if(!S) gerr("No rebase in progress?");
    checkoutTree(R, S.onto);
    S.stopped = null;
    return finishRebase(R);
  }
  if(R.rebasing) gerr("It seems that there is already a rebase directory.",
                      "Незавершённое перебазирование: «git rebase --continue», «--skip» или «--abort».");
  if(!a.args.length) gerr("There is no tracking information for the current branch.");

  const upstream = a.opts.onto ? a.args[0] : a.args[0];
  const up = resolve(R, upstream);
  const picks = ownCommits(R, headId(R), a.opts.onto ? resolve(R, a.args[0]) : up);
  if(!picks.length){
    if(isAncestor(R, headId(R), up)){
      R.ORIG_HEAD = headId(R);
      moveHead(R, up, "rebase (finish)");
      checkoutTree(R, up);
      return {out: ["Fast-forwarded " + (branchName(R) || "HEAD") + " to " + upstream + "."]};
    }
    return {out: ["Current branch " + branchName(R) + " is up to date."]};
  }
  if(a.flags.i || a.flags.interactive)
    return {interactive: {upstream, onto: a.opts.onto || null,
                          todo: picks.map(c => ({op: "pick", commit: c, msg: obj(R, c).msg}))}};

  return startRebase(R, upstream, picks.map(c => ({op: "pick", commit: c})), a.opts.onto);
}

/* ── сброс ─────────────────────────────────────────────── */
function cmdReset(R, a){
  const mode = a.flags.soft ? "soft" : a.flags.hard ? "hard" : "mixed";
  if(a.args.length && !/^(HEAD|ORIG_HEAD|[0-9a-f]{4,40}|.+@\{\d+\})/.test(a.args[0]) &&
     !R.refs["refs/heads/" + a.args[0]] && !R.refs["refs/remotes/" + a.args[0]] &&
     (R.index[a.args[0]] !== undefined || R.work[a.args[0]] !== undefined))
    return cmdRestore(R, {args: a.args, flags:{staged:true}, opts:{}});

  const target = a.args.length ? resolve(R, a.args[0]) : headId(R);
  R.ORIG_HEAD = headId(R);
  moveHead(R, target, "reset: moving to " + (a.args[0] || "HEAD"));
  const f = commitFiles(R, target);
  if(mode !== "soft") R.index = Object.assign({}, f);
  if(mode === "hard") R.work = Object.assign({}, f);
  R.merging = null;
  if(mode === "hard") return {out: ["HEAD is now at " + short(target) + " " + obj(R, target).msg]};
  if(mode === "mixed"){
    const s = statusSets(R);
    const out = [];
    if(s.unstaged.length){ out.push("Unstaged changes after reset:"); for(const x of s.unstaged) out.push("M\t" + x.p); }
    return {out};
  }
  return {out: []};
}

/* ── revert и cherry-pick ──────────────────────────────── */
function cmdRevert(R, a){
  if(a.flags.abort){ R.merging = null; checkoutTree(R, headId(R)); return {out: []}; }
  const spec = a.args[0];
  let ids;
  if(spec && spec.indexOf("..") > 0){
    const [f, t] = spec.split("..");
    const from = resolve(R, f), to = resolve(R, t);
    ids = ownCommits(R, to, from).reverse();
  } else ids = [resolve(R, spec)];

  const out = [];
  for(const id of ids){
    const o = obj(R, id);
    if(o.parents.length > 1 && !a.opts.m)
      gerr("commit " + short(id) + " is a merge but no -m option was given.",
           "У merge-коммита два родителя, и git не знает, относительно какого отменять. Обычно нужен «-m 1» — вернуть состояние основной ветки.");
    const parent = o.parents.length > 1 ? o.parents[(+a.opts.m || 1) - 1] : o.parents[0];
    /* отмена = слияние, где «их сторона» это родитель коммита */
    const M = mergeTrees(R, commitFiles(R, id), commitFiles(R, headId(R)), commitFiles(R, parent));
    if(M.conflicts.length){
      R.index = {}; R.work = {};
      for(const p in M.files){ R.work[p] = M.files[p]; if(M.conflicts.indexOf(p) < 0) R.index[p] = M.files[p]; }
      R.merging = {from: null, name: "revert", conflicts: M.conflicts};
      return {out: out.concat(M.conflicts.map(p => "CONFLICT (content): Merge conflict in " + p),
        ["error: could not revert " + short(id) + "... " + o.msg]), conflict: true};
    }
    R.index = M.files; R.work = Object.assign({}, M.files);
    const msg = a.opts.m && o.parents.length > 1
      ? 'Revert "' + o.msg + '"'
      : 'Revert "' + o.msg + '"';
    const nid = doCommit(R, msg, [headId(R)]);
    R.ORIG_HEAD = headId(R);
    moveHead(R, nid, "revert: " + msg);
    out.push("[" + (branchName(R) || "detached HEAD") + " " + short(nid) + "] " + msg);
  }
  return {out};
}

function cmdCherryPick(R, a){
  if(a.flags.abort){ R.merging = null; checkoutTree(R, headId(R)); return {out: []}; }
  const spec = a.args[0];
  let ids;
  if(spec && spec.indexOf("..") > 0){
    const [f, t] = spec.split("..");
    ids = ownCommits(R, resolve(R, t), resolve(R, f));
  } else ids = a.args.map(x => resolve(R, x));

  const out = [];
  for(const id of ids){
    const r = replay(R, id, headId(R));
    if(r.conflicts){
      R.index = {}; R.work = {};
      for(const p in r.files){ R.work[p] = r.files[p]; if(r.conflicts.indexOf(p) < 0) R.index[p] = r.files[p]; }
      R.merging = {from: id, name: "cherry-pick", conflicts: r.conflicts};
      return {out: out.concat(r.conflicts.map(p => "CONFLICT (content): Merge conflict in " + p),
        ["error: could not apply " + short(id) + "... " + obj(R, id).msg]), conflict: true};
    }
    R.ORIG_HEAD = headId(R);
    moveHead(R, r.id, "cherry-pick: " + obj(R, id).msg);
    checkoutTree(R, r.id);
    out.push("[" + (branchName(R) || "detached HEAD") + " " + short(r.id) + "] " + obj(R, id).msg);
  }
  return {out};
}

/* ── прятки ────────────────────────────────────────────── */
function cmdStash(R, a){
  const sub = a.args[0] || "push";
  if(sub === "list")
    return {out: R.stash.map((s, i) => "stash@{" + i + "}: WIP on " + s.branch + ": " + short(s.at) + " " + s.msg)};
  if(sub === "push" || sub === "save" || !a.args.length){
    const s = statusSets(R);
    const withUntracked = a.flags.u || a.flags["include-untracked"];
    if(!s.staged.length && !s.unstaged.length && !(withUntracked && s.untracked.length))
      return {out: ["No local changes to save"]};
    R.stash.unshift({work: Object.assign({}, R.work), index: Object.assign({}, R.index),
                     at: headId(R), branch: branchName(R) || "detached",
                     msg: obj(R, headId(R)) ? obj(R, headId(R)).msg : ""});
    const keep = withUntracked ? {} : (() => { const k = {}; for(const p of s.untracked) k[p] = R.work[p]; return k; })();
    checkoutTree(R, headId(R));
    for(const p in keep) R.work[p] = keep[p];
    return {out: ["Saved working directory and index state WIP on " + (branchName(R) || "detached")]};
  }
  if(sub === "pop" || sub === "apply"){
    if(!R.stash.length) gerr("No stash entries found.");
    const idx = a.args[1] ? +(a.args[1].match(/\{(\d+)\}/) || [0, 0])[1] : 0;
    const s = R.stash[idx];
    if(!s) gerr("stash@{" + idx + "} is not a valid reference");
    const cur = commitFiles(R, headId(R));
    const M = mergeTrees(R, commitFiles(R, s.at), cur, s.work);
    R.work = Object.assign({}, M.files);
    R.index = {};
    for(const p in M.files) if(M.conflicts.indexOf(p) < 0) R.index[p] = cur[p] !== undefined ? cur[p] : undefined;
    for(const p in R.index) if(R.index[p] === undefined) delete R.index[p];
    if(M.conflicts.length){
      R.merging = {from: null, name: "stash", conflicts: M.conflicts};
      return {out: M.conflicts.map(p => "CONFLICT (content): Merge conflict in " + p)
        .concat(["The stash entry is kept in case you need it again."]), conflict: true};
    }
    if(sub === "pop") R.stash.splice(idx, 1);
    return cmdStatus(R, {flags:{}, opts:{}, args:[]});
  }
  if(sub === "drop"){ R.stash.shift(); return {out: ["Dropped stash@{0}"]}; }
  if(sub === "clear"){ R.stash = []; return {out: []}; }
  gerr("unknown stash subcommand: " + sub);
}

/* ── журнал перемещений ────────────────────────────────── */
function cmdReflog(R, a){
  if(a.args[0] === "expire"){
    /* срок хранения вышел — сеть безопасности убрана, остаётся только fsck */
    if(a.flags.all || a.opts.expire === "now") R.reflog = {};
    else R.reflog = {};
    return {out: [], quiet: true};
  }
  if(a.args[0] === "delete"){ return {out: [], quiet: true}; }
  const name = a.args[0] && a.args[0] !== "show" ? (a.args[0] === "HEAD" ? "HEAD" : "refs/heads/" + a.args[0]) :
               (a.args[1] ? (a.args[1] === "HEAD" ? "HEAD" : "refs/heads/" + a.args[1]) : "HEAD");
  const log = R.reflog[name] || [];
  const label = name === "HEAD" ? "HEAD" : name.replace("refs/heads/", "");
  return {out: log.map((e, i) =>
    short(e.to) + " " + label + "@{" + i + "}: " + e.what)};
}

function cmdFsck(R, a){
  /* Пока на коммит ссылается хоть один reflog, git не считает его висячим.
     Поэтому сразу после «branch -D» fsck молчит — коммит держит reflog HEAD. */
  const alive = new Set();
  for(const r in R.refs) for(const c of ancestry(R, R.refs[r])) alive.add(c);
  for(const t in R.tags) for(const c of ancestry(R, R.tags[t].id)) alive.add(c);
  if(!a.flags["no-reflogs"])
    for(const n in R.reflog) for(const e of R.reflog[n]) if(e.to) alive.add(e.to);
  const dangling = Object.keys(R.objects).filter(k => R.objects[k].t === "commit" && !alive.has(k));
  return {out: dangling.map(id => "dangling commit " + id)};
}

/* ── поиск ─────────────────────────────────────────────── */
function cmdBlame(R, a){
  const path = a.args[a.args.length - 1];
  const hist = history(R, headId(R)).slice().reverse();   /* от старых к новым */
  const cur = lines(R.work[path] !== undefined ? R.work[path] : commitFiles(R, headId(R))[path]);
  if(R.work[path] === undefined && commitFiles(R, headId(R))[path] === undefined)
    gerr("no such path '" + path + "' in HEAD");
  /* для каждой строки — самый ранний коммит, где она появилась в текущем виде */
  const owner = new Array(cur.length).fill(null);
  for(const c of hist){
    const f = commitFiles(R, c)[path];
    if(f === undefined) continue;
    const has = lines(f);
    for(let i = 0; i < cur.length; i++)
      if(owner[i] === null && has.indexOf(cur[i]) >= 0) owner[i] = c;
  }
  return {out: cur.map((l, i) => {
    const c = owner[i] || headId(R), o = obj(R, c);
    return short(c) + " (" + o.author.split(" <")[0] + " " + (i + 1) + ") " + l;
  })};
}

function cmdGrep(R, a){
  const pat = a.args[0];
  const out = [];
  for(const p of Object.keys(R.work).sort())
    lines(R.work[p]).forEach((l, i) => { if(l.indexOf(pat) >= 0) out.push(p + ":" + (i + 1) + ":" + l); });
  return {out};
}

/* git log -S: в каких коммитах менялось число вхождений строки */
function cmdLogS(R, a, needle){
  const out = [];
  for(const id of history(R, headId(R))){
    const o = obj(R, id);
    const now = commitFiles(R, id), was = o.parents.length ? commitFiles(R, o.parents[0]) : {};
    const count = f => Object.keys(f).reduce((n, p) => n + String(f[p]).split(needle).length - 1, 0);
    if(count(now) !== count(was)) out.push(short(id) + " " + o.msg);
  }
  return {out};
}
