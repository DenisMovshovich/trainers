
/* ============================================================
   Двоичный поиск, merge-base и фильтры лога
   ============================================================ */
function bisectStep(R){
  const B = R.bisect;
  const badSet = ancestry(R, B.bad);
  const goodSet = new Set();
  for(const g of B.good) for(const c of ancestry(R, g)) goodSet.add(c);
  /* кандидаты: предки плохого, не являющиеся предками хорошего, кроме самого плохого */
  const cand = badSet.filter(c => !goodSet.has(c) && c !== B.bad);
  if(!cand.length){
    const o = obj(R, B.bad);
    return {out: [B.bad + " is the first bad commit",
                  "Author: " + o.author, "", "    " + o.msg, ""], done: true};
  }
  cand.sort((a, b) => obj(R, b).at - obj(R, a).at);
  const mid = cand[Math.floor(cand.length / 2)];
  switchTo(R, mid, {force: true});
  const steps = Math.ceil(Math.log(cand.length + 1) / Math.log(2));
  return {out: ["Bisecting: " + cand.length + " revision" + (cand.length === 1 ? "" : "s") +
                " left to test after this (roughly " + steps + " step" + (steps === 1 ? "" : "s") + ")",
                "[" + mid + "] " + obj(R, mid).msg]};
}

function cmdBisect(R, a){
  const sub = a.args[0];
  if(sub === "start"){
    R.bisect = {bad: null, good: [], branch: branchName(R), orig: headId(R)};
    return {out: [], quiet: true};
  }
  if(sub === "reset"){
    if(!R.bisect) gerr("We are not bisecting.");
    const B = R.bisect;
    R.bisect = null;
    if(B.branch) switchTo(R, B.branch, {force: true});
    else switchTo(R, B.orig, {force: true});
    return {out: [], quiet: true};
  }
  if(sub === "bad" || sub === "good"){
    if(!R.bisect) gerr("You need to start by \"git bisect start\"");
    const id = a.args[1] ? resolve(R, a.args[1]) : headId(R);
    if(sub === "bad") R.bisect.bad = id;
    else R.bisect.good.push(id);
    if(!R.bisect.bad || !R.bisect.good.length) return {out: [], quiet: true};
    const r = bisectStep(R);
    if(r.done){ /* поиск завершён, но выходим по reset — как в настоящем git */ }
    return {out: r.out};
  }
  if(sub === "log"){
    if(!R.bisect) gerr("We are not bisecting.");
    return {out: ["# bad: " + short(R.bisect.bad)].concat(R.bisect.good.map(g => "# good: " + short(g)))};
  }
  gerr("usage: git bisect (start|bad|good|reset|log)");
}

function cmdMergeBase(R, a){
  if(a.args.length < 2) gerr("usage: git merge-base <commit> <commit>");
  const b = mergeBase(R, resolve(R, a.args[0]), resolve(R, a.args[1]));
  if(!b) gerr("общего предка нет");
  return {out: [b]};
}

/* git checkout --ours / --theirs <файл> во время конфликта */
function takeSide(R, a, side){
  if(!R.merging) gerr("нет незавершённого слияния — брать нечего");
  const M = R.merging;
  for(const p of a.args){
    if(M.conflicts.indexOf(p) < 0) gerr("path '" + p + "' does not have our/their version");
    const ours = commitFiles(R, headId(R))[p];
    const theirs = M.from ? commitFiles(R, M.from)[p] : undefined;
    const v = side === "ours" ? ours : theirs;
    if(v === undefined) delete R.work[p]; else R.work[p] = v;
  }
  return {out: [], quiet: true};
}
