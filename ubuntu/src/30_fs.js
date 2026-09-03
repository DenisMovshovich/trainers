<script>
/* ============================================================
   Файловая система: узлы, права, разрешение путей
   ============================================================ */
function SysErr(msg, hint){ this.message = msg; this.hint = hint || ""; }
SysErr.prototype = Object.create(Error.prototype);
SysErr.prototype.name = "SysErr";
function serr(msg, hint){ throw new SysErr(msg, hint); }

/* узел: d — каталог, f — обычный файл, l — символьная ссылка */
function nd(type, mode, uid, gid, extra){
  const n = {type, mode, uid: uid || 0, gid: gid || 0, mtime: 0};
  if(type === "d") n.children = {};
  else if(type === "l") n.target = (extra || {}).target || "";
  else n.content = (extra || {}).content || "";
  return n;
}
const dir  = (mode, uid, gid) => nd("d", mode === undefined ? 0o755 : mode, uid, gid);
const file = (content, mode, uid, gid) => nd("f", mode === undefined ? 0o644 : mode, uid, gid, {content});
const link = (target) => nd("l", 0o777, 0, 0, {target});

function newFS(){
  const root = dir(0o755, 0, 0);
  return {root};
}

/* ── разбор пути ─────────────────────────────────────── */
function normPath(p){
  const abs = p[0] === "/";
  const parts = [];
  for(const s of String(p).split("/")){
    if(s === "" || s === ".") continue;
    if(s === ".."){ if(parts.length) parts.pop(); continue; }
    parts.push(s);
  }
  return (abs ? "/" : "") + parts.join("/");
}
function absPath(p, cwd){
  p = String(p === undefined ? "" : p);
  if(p === "") return cwd;
  if(p[0] === "~") p = (p === "~" || p[0 + 1] === "/") ? "@HOME@" + p.slice(1) : p;
  if(p[0] === "/") return normPath(p) || "/";
  return normPath(cwd + "/" + p) || "/";
}
const baseName = p => { const n = normPath(p); const i = n.lastIndexOf("/"); return i < 0 ? n : n.slice(i + 1); };
const dirName  = p => { const n = normPath(p); const i = n.lastIndexOf("/"); return i <= 0 ? "/" : n.slice(0, i); };

/* ── права ───────────────────────────────────────────── */
/* who: {uid, gids:[...]}; want: строка из "r","w","x" */
function permitted(node, who, want){
  if(!node) return false;
  if(who.uid === 0) return want !== "x" || node.type === "d" || (node.mode & 0o111) !== 0;
  let bits;
  if(node.uid === who.uid) bits = (node.mode >> 6) & 7;
  else if(who.gids.indexOf(node.gid) >= 0) bits = (node.mode >> 3) & 7;
  else bits = node.mode & 7;
  const need = {r: 4, w: 2, x: 1}[want];
  return (bits & need) === need;
}
function modeStr(node){
  const t = node.type === "d" ? "d" : node.type === "l" ? "l" : "-";
  const m = node.mode;
  let s = "";
  for(let sh = 6; sh >= 0; sh -= 3){
    const b = (m >> sh) & 7;
    s += (b & 4 ? "r" : "-") + (b & 2 ? "w" : "-") + (b & 1 ? "x" : "-");
  }
  /* особые биты */
  const sp = m >> 9;
  if(sp & 4) s = s.slice(0, 2) + (s[2] === "x" ? "s" : "S") + s.slice(3);
  if(sp & 2) s = s.slice(0, 5) + (s[5] === "x" ? "s" : "S") + s.slice(6);
  if(sp & 1) s = s.slice(0, 8) + (s[8] === "x" ? "t" : "T");
  return t + s;
}
function parseMode(spec, cur, isDir){
  if(/^[0-7]{3,4}$/.test(spec)) return parseInt(spec, 8);
  let m = cur;
  for(const part of String(spec).split(",")){
    const mm = /^([ugoa]*)([-+=])([rwxXst]*)$/.exec(part.trim());
    if(!mm) serr("chmod: неверный режим: «" + spec + "»",
                 "Либо восьмеричное число (755), либо буквенная запись (u+x, go-w, a=r).");
    let who = mm[1] || "a", op = mm[2], what = mm[3];
    if(who.indexOf("a") >= 0) who = "ugo";
    let bits = 0;
    if(what.indexOf("r") >= 0) bits |= 4;
    if(what.indexOf("w") >= 0) bits |= 2;
    if(what.indexOf("x") >= 0) bits |= 1;
    if(what.indexOf("X") >= 0 && (isDir || (m & 0o111))) bits |= 1;
    let mask = 0;
    if(who.indexOf("u") >= 0) mask |= bits << 6;
    if(who.indexOf("g") >= 0) mask |= bits << 3;
    if(who.indexOf("o") >= 0) mask |= bits;
    let clear = 0;
    if(who.indexOf("u") >= 0) clear |= 7 << 6;
    if(who.indexOf("g") >= 0) clear |= 7 << 3;
    if(who.indexOf("o") >= 0) clear |= 7;
    if(op === "+") m |= mask;
    else if(op === "-") m &= ~mask;
    else m = (m & ~clear) | mask;
    if(what.indexOf("s") >= 0){
      const sb = (who.indexOf("u") >= 0 ? 0o4000 : 0) | (who.indexOf("g") >= 0 ? 0o2000 : 0);
      if(op === "-") m &= ~sb; else m |= sb;
    }
    if(what.indexOf("t") >= 0){ if(op === "-") m &= ~0o1000; else m |= 0o1000; }
  }
  return m;
}

/* ── обход с проверкой прав ──────────────────────────── */
/* возвращает {node, path}; follow — разыменовывать ли последнюю ссылку */
function walk(S, p, opts){
  opts = opts || {};
  const who = opts.who || S.who;
  const start = absPath(p, opts.cwd === undefined ? S.cwd : opts.cwd).replace("@HOME@", homeOf(S, who.name));
  const parts = normPath(start).split("/").filter(Boolean);
  let node = S.fs.root, cur = "";
  for(let i = 0; i < parts.length; i++){
    if(node.type === "l"){
      const t = absPath(node.target, dirName(cur));
      return walk(S, t + "/" + parts.slice(i).join("/"), opts);
    }
    if(node.type !== "d") serr(parts.slice(0, i).join("/") + ": Not a directory");
    if(!permitted(node, who, "x"))
      serr((cur || "/") + ": Permission denied",
           "Чтобы войти в каталог, нужен бит x. Посмотрите ls -ld " + (cur || "/") + ".");
    const name = parts[i];
    const next = node.children[name];
    cur = (cur === "/" ? "" : cur) + "/" + name;
    if(!next){
      if(i === parts.length - 1) return {node: null, path: cur, parent: node, name};
      serr(cur + ": No such file or directory");
    }
    node = next;
    if(node.type === "l" && (i < parts.length - 1 || opts.follow !== false)){
      const t = absPath(node.target, dirName(cur));
      const rest = parts.slice(i + 1);
      const r = walk(S, t + (rest.length ? "/" + rest.join("/") : ""), opts);
      return r;
    }
  }
  return {node, path: normPath(start) || "/", parent: null, name: baseName(start)};
}
function statPath(S, p, opts){
  const r = walk(S, p, opts);
  if(!r.node) serr(r.path + ": No such file or directory");
  return r;
}
function readFile(S, p, opts){
  const r = statPath(S, p, opts);
  const who = (opts || {}).who || S.who;
  if(r.node.type === "d") serr(r.path + ": Is a directory");
  if(!permitted(r.node, who, "r"))
    serr(r.path + ": Permission denied",
         "Нет права на чтение. Посмотрите ls -l " + r.path + " — и кто вы: id.");
  return r.node.content;
}
function writeFile(S, p, text, opts){
  opts = opts || {};
  const who = opts.who || S.who;
  const r = walk(S, p, opts);
  if(r.node){
    if(r.node.type === "d") serr(r.path + ": Is a directory");
    if(!permitted(r.node, who, "w"))
      serr(r.path + ": Permission denied",
           "Нет права на запись. Файлы в /etc обычно принадлежат root — попробуйте через sudo.");
    r.node.content = text;
    r.node.mtime = S.now;
    return r.node;
  }
  const parent = r.parent;
  if(!parent) serr(dirName(r.path) + ": No such file or directory");
  if(!permitted(parent, who, "w"))
    serr(r.path + ": Permission denied",
         "Создание файла — это запись в каталог. Нужен бит w на " + dirName(r.path) + ".");
  const n = file(text, opts.mode === undefined ? (0o666 & ~S.umask) : opts.mode, who.uid, who.gids[0]);
  n.mtime = S.now;
  parent.children[r.name] = n;
  return n;
}
function mkdirAt(S, p, opts){
  opts = opts || {};
  const who = opts.who || S.who;
  const r = walk(S, p, opts);
  if(r.node) serr(r.path + ": File exists");
  if(!r.parent) serr(dirName(r.path) + ": No such file or directory");
  if(!permitted(r.parent, who, "w"))
    serr(r.path + ": Permission denied", "Нужен бит w на родительском каталоге " + dirName(r.path) + ".");
  const n = dir(opts.mode === undefined ? (0o777 & ~S.umask) : opts.mode, who.uid, who.gids[0]);
  n.mtime = S.now;
  r.parent.children[r.name] = n;
  return n;
}
function unlinkAt(S, p, opts){
  opts = opts || {};
  const who = opts.who || S.who;
  const r = walk(S, p, Object.assign({}, opts, {follow: false}));
  if(!r.node) serr(r.path + ": No such file or directory");
  const parent = r.parent || walk(S, dirName(r.path), opts).node;
  if(!permitted(parent, who, "w"))
    serr(r.path + ": Permission denied", "Удаление — это запись в каталог, а не в файл.");
  /* липкий бит: в общем каталоге удалять может только владелец */
  if((parent.mode & 0o1000) && who.uid !== 0 && r.node.uid !== who.uid)
    serr(r.path + ": Operation not permitted",
         "На каталоге стоит липкий бит (t): удалять можно только свои файлы.");
  delete parent.children[baseName(r.path)];
}
function listDir(S, p, opts){
  const r = statPath(S, p, opts);
  const who = (opts || {}).who || S.who;
  if(r.node.type !== "d") return [{name: baseName(r.path), node: r.node, path: r.path}];
  if(!permitted(r.node, who, "r"))
    serr(r.path + ": Permission denied", "Для показа содержимого нужен бит r на самом каталоге.");
  return Object.keys(r.node.children).sort().map(name =>
    ({name, node: r.node.children[name], path: (r.path === "/" ? "" : r.path) + "/" + name}));
}
/* обход дерева вглубь: [{path, node}] */
function walkTree(S, p, opts, out){
  out = out || [];
  const r = walk(S, p, opts);
  if(!r.node) return out;
  out.push({path: r.path, node: r.node});
  if(r.node.type === "d" && permitted(r.node, (opts || {}).who || S.who, "r"))
    for(const name of Object.keys(r.node.children).sort())
      walkTree(S, (r.path === "/" ? "" : r.path) + "/" + name, opts, out);
  return out;
}
function sizeOf(node){
  if(node.type === "d") return 4096;
  if(node.type === "l") return node.target.length;
  return node.content.length;
}
