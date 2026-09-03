/* ============================================================
   Команды: файлы, права, сведения о машине
   ============================================================ */
const SPEC = {};            /* какие ключи берут значение */
const CMDS = {};
const HELPTXT = {};
function cmd(name, spec, fn, help){
  CMDS[name] = fn;
  if(spec) SPEC[name] = spec;
  if(help) HELPTXT[name] = help;
}
const ok = out => ({out: out || [], code: 0});
const fail = (msg, hint, code) => ({out: [], err: msg, hint: hint || "", code: code === undefined ? 1 : code});

function userByUid(S, uid){
  for(const n in S.users) if(S.users[n].uid === uid) return n;
  return String(uid);
}
function groupByGid(S, gid){
  for(const g in S.groups) if(S.groups[g].gid === gid) return g;
  return String(gid);
}
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function stamp(t){
  const d = 3 + (t % 25), h = 9 + (t % 13), mi = (t * 7) % 60;
  return MON[(Math.floor(t / 25) + 8) % 12] + " " + String(d).padStart(2, " ") +
         " " + String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
}
const pad = (s, n) => String(s).padStart(n, " ");
const padr = (s, n) => String(s).padEnd(n, " ");

/* ── навигация ───────────────────────────────────────── */
cmd("pwd", null, S => ok([S.cwd]));
cmd("cd", null, (S, a) => {
  const target = a.args[0] === undefined || a.args[0] === "~" ? homeOf(S, S.who.name)
               : a.args[0] === "-" ? (S.oldcwd || S.cwd) : a.args[0];
  const r = walk(S, target);
  if(!r.node) return fail("cd: " + absPath(target, S.cwd) + ": No such file or directory");
  if(r.node.type !== "d") return fail("cd: " + r.path + ": Not a directory");
  if(!permitted(r.node, S.who, "x"))
    return fail("cd: " + r.path + ": Permission denied",
                "Войти в каталог позволяет бит x, а не r. Посмотрите ls -ld " + r.path + ".");
  S.oldcwd = S.cwd; S.cwd = r.path;
  return ok();
});
cmd("ls", null, (S, a) => {
  const long = a.flags.l, all = a.flags.a || a.flags.A, dirOnly = a.flags.d,
        human = a.flags.h, recur = a.flags.R, one = a.flags[1], time = a.flags.t;
  const targets = a.args.length ? a.args : ["."];
  const out = [];
  for(let ti = 0; ti < targets.length; ti++){
    const t = targets[ti];
    const r = walk(S, t, {follow: !dirOnly});
    if(!r.node) return fail("ls: cannot access '" + t + "': No such file or directory");
    let items;
    if(dirOnly || r.node.type !== "d") items = [{name: t, node: r.node, path: r.path}];
    else items = listDir(S, r.path);
    if(!all) items = items.filter(x => x.name[0] !== ".");
    if(time) items = items.slice().sort((x, y) => y.node.mtime - x.node.mtime);
    if(targets.length > 1 && !dirOnly && r.node.type === "d") out.push((ti ? "\n" : "") + t + ":");
    if(long){
      if(r.node.type === "d" && !dirOnly)
        out.push("total " + items.reduce((s, x) => s + Math.ceil(sizeOf(x.node) / 1024) + 4, 0));
      const w = {u: 0, g: 0, s: 0};
      for(const x of items){
        w.u = Math.max(w.u, userByUid(S, x.node.uid).length);
        w.g = Math.max(w.g, groupByGid(S, x.node.gid).length);
        w.s = Math.max(w.s, String(human ? hsize(sizeOf(x.node)) : sizeOf(x.node)).length);
      }
      for(const x of items)
        out.push([modeStr(x.node), pad(x.node.type === "d" ? 2 : 1, 2),
                  padr(userByUid(S, x.node.uid), w.u), padr(groupByGid(S, x.node.gid), w.g),
                  pad(human ? hsize(sizeOf(x.node)) : sizeOf(x.node), w.s),
                  stamp(x.node.mtime), x.name + (x.node.type === "l" ? " -> " + x.node.target : "")
                 ].join(" "));
    } else if(one || items.length > 6) out.push.apply(out, items.map(x => x.name));
    else if(items.length) out.push(items.map(x => x.name).join("  "));
    if(recur && r.node.type === "d")
      for(const x of items)
        if(x.node.type === "d"){
          out.push("", x.path + ":");
          const sub = listDir(S, x.path).filter(y => all || y.name[0] !== ".");
          if(sub.length) out.push(sub.map(y => y.name).join("  "));
        }
  }
  return ok(out);
});
function hsize(n){
  const f = (v, s) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1)) + s;
  if(n < 1024) return String(n);
  if(n < 1048576) return f(n / 1024, "K");
  if(n < 1073741824) return f(n / 1048576, "M");
  return f(n / 1073741824, "G");
}

/* ── чтение и запись ─────────────────────────────────── */
cmd("cat", null, (S, a) => {
  if(!a.args.length) return ok(a.stdin);
  const out = [];
  for(const p of a.args){
    const txt = readFile(S, p);
    out.push.apply(out, txt.split("\n").filter((l, i, arr) => !(i === arr.length - 1 && l === "")));
  }
  if(a.flags.n) return ok(out.map((l, i) => pad(i + 1, 6) + "\t" + l));
  return ok(out);
});
CMDS.less = CMDS.more = CMDS.cat;
cmd("echo", null, (S, a) => {
  const s = a.argv.filter(x => x !== "-n" && x !== "-e").join(" ");
  return ok(a.flags.n && !s ? [] : [s]);
});
cmd("touch", null, (S, a) => {
  if(!a.args.length) return fail("touch: missing file operand");
  for(const p of a.args){
    const r = walk(S, p);
    if(r.node) r.node.mtime = S.now;
    else writeFile(S, p, "");
  }
  return ok();
});
cmd("mkdir", null, (S, a) => {
  if(!a.args.length) return fail("mkdir: missing operand");
  for(const p of a.args){
    if(a.flags.p){
      const parts = absPath(p, S.cwd).split("/").filter(Boolean);
      let acc = "";
      for(const s of parts){
        acc += "/" + s;
        const r = walk(S, acc);
        if(!r.node) mkdirAt(S, acc);
        else if(r.node.type !== "d") return fail("mkdir: " + acc + ": Not a directory");
      }
    } else mkdirAt(S, p);
  }
  return ok();
});
cmd("rmdir", null, (S, a) => {
  for(const p of a.args){
    const r = statPath(S, p);
    if(r.node.type !== "d") return fail("rmdir: failed to remove '" + p + "': Not a directory");
    if(Object.keys(r.node.children).length)
      return fail("rmdir: failed to remove '" + p + "': Directory not empty",
                  "rmdir убирает только пустые каталоги. Непустой — rm -r.");
    unlinkAt(S, p);
  }
  return ok();
});
cmd("rm", null, (S, a) => {
  if(!a.args.length) return fail("rm: missing operand");
  for(const p of a.args){
    const r = walk(S, p, {follow: false});
    if(!r.node){ if(a.flags.f) continue; return fail("rm: cannot remove '" + p + "': No such file or directory"); }
    if(r.node.type === "d" && !(a.flags.r || a.flags.R))
      return fail("rm: cannot remove '" + p + "': Is a directory", "Каталог удаляется с ключом -r.");
    if(absPath(p, S.cwd) === "/")
      return fail("rm: it is dangerous to operate recursively on '/'", "Так делать не нужно.");
    unlinkAt(S, p);
  }
  return ok();
});
function copyNode(n){
  const c = Object.assign({}, n);
  if(n.type === "d"){ c.children = {}; for(const k in n.children) c.children[k] = copyNode(n.children[k]); }
  return c;
}
cmd("cp", null, (S, a) => {
  if(a.args.length < 2) return fail("cp: missing destination file operand");
  const dst = a.args[a.args.length - 1], srcs = a.args.slice(0, -1);
  const dr = walk(S, dst);
  const intoDir = dr.node && dr.node.type === "d";
  if(srcs.length > 1 && !intoDir) return fail("cp: target '" + dst + "' is not a directory");
  for(const s of srcs){
    const sr = statPath(S, s);
    if(sr.node.type === "d" && !(a.flags.r || a.flags.R || a.flags.a))
      return fail("cp: -r not specified; omitting directory '" + s + "'");
    if(!permitted(sr.node, S.who, "r"))
      return fail("cp: cannot open '" + s + "' for reading: Permission denied");
    const target = intoDir ? (dr.path === "/" ? "" : dr.path) + "/" + baseName(sr.path) : dst;
    const tr = walk(S, target);
    if(!tr.parent && !tr.node) return fail("cp: cannot create '" + target + "': No such file or directory");
    const parent = tr.parent || walk(S, dirName(target)).node;
    if(!permitted(parent, S.who, "w"))
      return fail("cp: cannot create '" + target + "': Permission denied",
                  "Нет права на запись в " + dirName(target) + ".");
    const copy = copyNode(sr.node);
    if(!a.flags.p && !a.flags.a){ copy.uid = S.who.uid; copy.gid = S.who.gids[0]; }
    copy.mtime = S.now;
    parent.children[baseName(target)] = copy;
  }
  return ok();
});
cmd("mv", null, (S, a) => {
  if(a.args.length < 2) return fail("mv: missing destination file operand");
  const dst = a.args[a.args.length - 1], srcs = a.args.slice(0, -1);
  const dr = walk(S, dst);
  const intoDir = dr.node && dr.node.type === "d";
  for(const s of srcs){
    const sr = statPath(S, s, {follow: false});
    const target = intoDir ? (dr.path === "/" ? "" : dr.path) + "/" + baseName(sr.path) : dst;
    const tr = walk(S, target);
    const parent = tr.parent || walk(S, dirName(target)).node;
    if(!parent) return fail("mv: cannot move '" + s + "': No such file or directory");
    if(!permitted(parent, S.who, "w"))
      return fail("mv: cannot move '" + s + "' to '" + target + "': Permission denied");
    const srcParent = walk(S, dirName(sr.path)).node;
    if(!permitted(srcParent, S.who, "w"))
      return fail("mv: cannot move '" + s + "': Permission denied",
                  "Переименование — это запись в каталог-источник.");
    parent.children[baseName(target)] = sr.node;
    delete srcParent.children[baseName(sr.path)];
  }
  return ok();
});
cmd("ln", null, (S, a) => {
  if(!a.flags.s) return fail("ln: здесь поддерживаются только символьные ссылки",
                             "Добавьте ключ -s: ln -s цель имя.");
  if(a.args.length < 2) return fail("ln: missing file operand");
  const [target, name] = a.args;
  const r = walk(S, name);
  const parent = r.parent || (r.node && r.node.type === "d" ? r.node : null);
  if(r.node && r.node.type === "d"){
    r.node.children[baseName(target)] = link(target);
    return ok();
  }
  if(r.node) return fail("ln: failed to create symbolic link '" + name + "': File exists");
  if(!parent || !permitted(parent, S.who, "w"))
    return fail("ln: failed to create symbolic link '" + name + "': Permission denied");
  parent.children[r.name] = link(target);
  return ok();
});
cmd("readlink", null, (S, a) => {
  const r = statPath(S, a.args[0], {follow: false});
  if(r.node.type !== "l") return fail("");
  return ok([r.node.target]);
});
cmd("basename", null, (S, a) => ok([baseName(a.args[0] || "")]));
cmd("dirname", null, (S, a) => ok([dirName(a.args[0] || "")]));

/* ── права и владение ────────────────────────────────── */
cmd("chmod", null, (S, a) => {
  if(a.args.length < 2) return fail("chmod: missing operand");
  const spec = a.args[0];
  const apply = p => {
    const r = statPath(S, p, {follow: false});
    if(S.who.uid !== 0 && r.node.uid !== S.who.uid)
      return fail("chmod: changing permissions of '" + p + "': Operation not permitted",
                  "Менять права может владелец файла или root. Кто владелец — покажет ls -l.");
    r.node.mode = parseMode(spec, r.node.mode, r.node.type === "d");
    if(a.flags.R && r.node.type === "d")
      for(const x of walkTree(S, r.path)) x.node.mode = parseMode(spec, x.node.mode, x.node.type === "d");
    return null;
  };
  for(const p of a.args.slice(1)){ const e = apply(p); if(e) return e; }
  return ok();
});
cmd("chown", null, (S, a) => {
  if(a.args.length < 2) return fail("chown: missing operand");
  if(S.who.uid !== 0)
    return fail("chown: changing ownership of '" + a.args[1] + "': Operation not permitted",
                "Менять владельца может только root — попробуйте через sudo.");
  const [uname, gname] = a.args[0].split(":");
  if(uname && !S.users[uname]) return fail("chown: invalid user: '" + a.args[0] + "'");
  if(gname && !S.groups[gname]) return fail("chown: invalid group: '" + a.args[0] + "'");
  for(const p of a.args.slice(1)){
    const r = statPath(S, p, {follow: false});
    const nodes = a.flags.R && r.node.type === "d" ? walkTree(S, r.path).map(x => x.node) : [r.node];
    for(const n of nodes){
      if(uname) n.uid = S.users[uname].uid;
      if(gname) n.gid = S.groups[gname].gid;
      else if(uname && a.args[0].indexOf(":") >= 0) n.gid = S.users[uname].gid;
    }
  }
  return ok();
});
cmd("chgrp", null, (S, a) => {
  if(a.args.length < 2) return fail("chgrp: missing operand");
  const g = a.args[0];
  if(!S.groups[g]) return fail("chgrp: invalid group: '" + g + "'");
  for(const p of a.args.slice(1)){
    const r = statPath(S, p, {follow: false});
    if(S.who.uid !== 0 && r.node.uid !== S.who.uid)
      return fail("chgrp: changing group of '" + p + "': Operation not permitted");
    r.node.gid = S.groups[g].gid;
  }
  return ok();
});
cmd("umask", null, (S, a) => {
  if(!a.args.length) return ok(["0" + S.umask.toString(8).padStart(3, "0")]);
  S.umask = parseInt(a.args[0], 8);
  return ok();
});
cmd("stat", null, (S, a) => {
  const r = statPath(S, a.args[0], {follow: false});
  const n = r.node;
  return ok([
    "  File: " + r.path + (n.type === "l" ? " -> " + n.target : ""),
    "  Size: " + sizeOf(n) + "\tBlocks: 8\t" + (n.type === "d" ? "directory" : n.type === "l" ? "symbolic link" : "regular file"),
    "Access: (0" + (n.mode & 0o7777).toString(8).padStart(3, "0") + "/" + modeStr(n) + ")  " +
      "Uid: (" + pad(n.uid, 5) + "/" + padr(userByUid(S, n.uid), 8) + ")   " +
      "Gid: (" + pad(n.gid, 5) + "/" + padr(groupByGid(S, n.gid), 8) + ")",
    "Modify: " + stamp(n.mtime)
  ]);
});
