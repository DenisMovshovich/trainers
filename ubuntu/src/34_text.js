/* ============================================================
   Обработка текста, поиск и сведения о ресурсах
   ============================================================ */
function srcLines(S, a){
  if(a.args.length > (a.fileFrom || 0)) {
    const out = [];
    for(const p of a.args.slice(a.fileFrom || 0)){
      const t = readFile(S, p);
      out.push.apply(out, t.split("\n").filter((l, i, arr) => !(i === arr.length - 1 && l === "")));
    }
    return out;
  }
  return a.stdin;
}
function reOf(pat, a){
  let p = pat;
  if(a.flags.F) p = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if(a.flags.w) p = "\\b(?:" + p + ")\\b";
  try{ return new RegExp(p, a.flags.i ? "i" : ""); }
  catch(e){ serr("grep: неверное регулярное выражение: " + pat); }
}
cmd("grep", {e: 1, m: 1}, (S, a) => {
  const pat = a.opts.e !== undefined ? a.opts.e : a.args[0];
  if(pat === undefined) return fail("usage: grep [OPTION]... PATTERN [FILE]...");
  const fileFrom = a.opts.e !== undefined ? 0 : 1;
  const files = a.args.slice(fileFrom);
  const re = reOf(pat, a);
  const many = files.length > 1 || a.flags.r || a.flags.R;
  let lines;
  if(a.flags.r || a.flags.R){
    lines = [];
    for(const d of (files.length ? files : ["."]))
      for(const x of walkTree(S, d))
        if(x.node.type === "f" && permitted(x.node, S.who, "r"))
          for(const l of x.node.content.split("\n"))
            if(l !== "") lines.push({f: x.path, l});
  } else if(files.length){
    lines = [];
    for(const p of files){
      const t = readFile(S, p);
      for(const l of t.split("\n")) if(l !== "") lines.push({f: p, l});
    }
  } else lines = a.stdin.map(l => ({f: "", l}));

  let hit = lines.filter(x => re.test(x.l) !== !!a.flags.v);
  if(a.opts.m) hit = hit.slice(0, +a.opts.m);
  if(a.flags.c) return ok([String(hit.length)]);
  if(a.flags.l) return ok(hit.map(x => x.f).filter((v, i, ar) => ar.indexOf(v) === i));
  const out = hit.map(x => (many && x.f ? x.f + ":" : "") + x.l);
  return {out, code: hit.length ? 0 : 1};
});
cmd("head", {n: 1}, (S, a) => {
  a.fileFrom = 0;
  const n = a.opts.n !== undefined ? +a.opts.n : 10;
  return ok(srcLines(S, a).slice(0, n));
});
cmd("tail", {n: 1}, (S, a) => {
  a.fileFrom = 0;
  const n = a.opts.n !== undefined ? +String(a.opts.n).replace(/^\+/, "") : 10;
  const src = srcLines(S, a);
  return ok(String(a.opts.n)[0] === "+" ? src.slice(n - 1) : src.slice(Math.max(0, src.length - n)));
});
cmd("wc", null, (S, a) => {
  a.fileFrom = 0;
  const src = srcLines(S, a);
  const words = src.reduce((s, l) => s + (l.trim() ? l.trim().split(/\s+/).length : 0), 0);
  const chars = src.reduce((s, l) => s + l.length + 1, 0);
  if(a.flags.l) return ok([String(src.length)]);
  if(a.flags.w) return ok([String(words)]);
  if(a.flags.c) return ok([String(chars)]);
  return ok([pad(src.length, 7) + pad(words, 8) + pad(chars, 8) + (a.args.length ? " " + a.args[0] : "")]);
});
cmd("sort", {k: 1, t: 1}, (S, a) => {
  a.fileFrom = 0;
  let src = srcLines(S, a).slice();
  const key = a.opts.k !== undefined ? parseInt(a.opts.k, 10) : 0;
  const sep = a.opts.t;
  const val = l => key ? (sep ? l.split(sep) : l.trim().split(/\s+/))[key - 1] || "" : l;
  src.sort((x, y) => a.flags.n ? (parseFloat(val(x)) || 0) - (parseFloat(val(y)) || 0)
                               : String(val(x)).localeCompare(String(val(y))));
  if(a.flags.r) src.reverse();
  if(a.flags.u) src = src.filter((l, i) => i === 0 || l !== src[i - 1]);
  return ok(src);
});
cmd("uniq", null, (S, a) => {
  a.fileFrom = 0;
  const src = srcLines(S, a);
  const out = [];
  let prev = null, n = 0;
  const flush = () => { if(prev !== null && (!a.flags.d || n > 1)) out.push(a.flags.c ? pad(n, 7) + " " + prev : prev); };
  for(const l of src){ if(l === prev) n++; else { flush(); prev = l; n = 1; } }
  flush();
  return ok(out);
});
cmd("cut", {d: 1, f: 1, c: 1}, (S, a) => {
  a.fileFrom = 0;
  const src = srcLines(S, a);
  const d = a.opts.d === undefined ? "\t" : a.opts.d;
  const fs_ = String(a.opts.f === undefined ? "1" : a.opts.f).split(",").map(x => parseInt(x, 10));
  if(a.opts.c !== undefined){
    const m = /^(\d+)-(\d*)$/.exec(String(a.opts.c));
    return ok(src.map(l => m ? l.slice(+m[1] - 1, m[2] ? +m[2] : undefined) : l[+a.opts.c - 1] || ""));
  }
  return ok(src.map(l => l.indexOf(d) < 0 ? l : fs_.map(i => l.split(d)[i - 1] || "").join(d)));
});
cmd("tr", null, (S, a) => {
  const [from, to] = a.args;
  return ok(a.stdin.map(l => {
    if(a.flags.d) return l.split("").filter(c => from.indexOf(c) < 0).join("");
    return l.split("").map(c => { const i = from.indexOf(c); return i >= 0 && to ? to[Math.min(i, to.length - 1)] : c; }).join("");
  }));
});
cmd("sed", null, (S, a) => {
  const script = a.args[0];
  a.fileFrom = 1;
  const src = srcLines(S, a);
  const m = /^s(.)(.*?)\1(.*?)\1([gi]*)$/.exec(script || "");
  if(m){
    const re = new RegExp(m[2], m[4].indexOf("g") >= 0 ? "g" + (m[4].indexOf("i") >= 0 ? "i" : "") : (m[4].indexOf("i") >= 0 ? "i" : ""));
    const out = src.map(l => l.replace(re, m[3]));
    if(a.flags.i && a.args[1]){ writeFile(S, a.args[1], out.join("\n") + "\n"); return ok(); }
    return ok(out);
  }
  const del = /^\/(.*)\/d$/.exec(script || "");
  if(del){ const re = new RegExp(del[1]); return ok(src.filter(l => !re.test(l))); }
  const pr = /^(\d+),?(\d+)?p$/.exec(script || "");
  if(pr && a.flags.n) return ok(src.slice(+pr[1] - 1, pr[2] ? +pr[2] : +pr[1]));
  return fail("sed: здесь разобраны только s/что/на что/, /шаблон/d и печать строк",
              "Например: sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config");
});
cmd("tee", null, (S, a) => {
  const text = a.stdin.length ? a.stdin.join("\n") + "\n" : "";
  for(const p of a.args){
    if(a.flags.a){
      let old = ""; try{ old = readFile(S, p); }catch(e){ old = ""; }
      writeFile(S, p, old + text);
    } else writeFile(S, p, text);
  }
  return ok(a.stdin);
});
cmd("find", {name: 1, type: 1, perm: 1, user: 1, size: 1, maxdepth: 1}, (S, a) => {
  /* find путь -name шаблон -type f */
  const argv = a.argv;
  const start = argv.length && argv[0][0] !== "-" ? argv[0] : ".";
  const conds = [];
  for(let i = 0; i < argv.length; i++){
    if(argv[i] === "-name" || argv[i] === "-iname"){
      const pat = argv[++i], ci = argv[i - 1] === "-iname";
      const re = new RegExp("^" + String(pat).replace(/[.+^${}()|\\]/g, "\\$&")
        .replace(/\*/g, ".*").replace(/\?/g, ".") + "$", ci ? "i" : "");
      conds.push(x => re.test(baseName(x.path)));
    }
    else if(argv[i] === "-type"){ const t = argv[++i]; conds.push(x => x.node.type === (t === "f" ? "f" : t === "d" ? "d" : "l")); }
    else if(argv[i] === "-user"){ const u = argv[++i]; conds.push(x => x.node.uid === (S.users[u] ? S.users[u].uid : -1)); }
    else if(argv[i] === "-perm"){
      const p = argv[++i];
      if(p[0] === "-"){ const want = parseInt(p.slice(1), 8); conds.push(x => (x.node.mode & want) === want); }
      else if(p[0] === "/"){ const want = parseInt(p.slice(1), 8); conds.push(x => (x.node.mode & want) !== 0); }
      else { const want = parseInt(p, 8); conds.push(x => (x.node.mode & 0o7777) === want); }
    }
    else if(argv[i] === "-maxdepth"){
      const d = +argv[++i], base = absPath(start, S.cwd);
      conds.push(x => x.path === base || (x.path.slice(base.length).split("/").length - 1) <= d);
    }
  }
  let items;
  try{ items = walkTree(S, start); }
  catch(e){ return fail("find: '" + start + "': " + e.message.replace(/^.*: /, "")); }
  let hit = items.filter(x => conds.every(c => c(x)));
  if(argv.indexOf("-delete") >= 0){ for(const x of hit.slice().reverse()) try{ unlinkAt(S, x.path); }catch(e){} return ok(); }
  return ok(hit.map(x => x.path === absPath(start, S.cwd) && start !== "/" ? start : x.path));
});
cmd("which", null, (S, a) => {
  const n = a.args[0];
  if(!CMDS[n]) return {out: [], code: 1};
  return ok([(["systemctl","journalctl","apt","ufw","ip","ss","useradd","usermod","adduser","visudo"].indexOf(n) >= 0
              ? "/usr/sbin/" : "/usr/bin/") + n]);
});
cmd("file", null, (S, a) => {
  const r = statPath(S, a.args[0], {follow: false});
  const n = r.node;
  const kind = n.type === "d" ? "directory" : n.type === "l" ? "symbolic link to " + n.target
             : /^#!/.test(n.content) ? "a " + (/bash/.test(n.content.split("\n")[0]) ? "Bourne-Again" : "POSIX") + " shell script, ASCII text executable"
             : n.content === "" ? "empty" : "ASCII text";
  return ok([a.args[0] + ": " + kind]);
});

/* ── сведения о машине ───────────────────────────────── */
cmd("whoami", null, S => ok([S.who.name]));
cmd("id", null, (S, a) => {
  const name = a.args[0] || S.who.name;
  const u = S.users[name];
  if(!u) return fail("id: '" + name + "': no such user");
  const gs = groupNamesOf(S, name);
  return ok(["uid=" + u.uid + "(" + name + ") gid=" + u.gid + "(" + groupByGid(S, u.gid) + ") groups=" +
             gs.map(g => S.groups[g].gid + "(" + g + ")").join(",")]);
});
cmd("groups", null, (S, a) => ok([groupNamesOf(S, a.args[0] || S.who.name).join(" ")]));
cmd("hostname", null, S => ok([S.host]));
cmd("uname", null, (S, a) => {
  if(a.flags.a) return ok(["Linux " + S.host + " 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux"]);
  if(a.flags.r) return ok(["5.15.0-91-generic"]);
  return ok(["Linux"]);
});
cmd("uptime", null, S => ok([" " + stamp(S.now).slice(-5) + ":01 up " + (2 + S.now % 9) +
  " days,  3:14,  1 user,  load average: 0.08, 0.03, 0.01"]));
cmd("date", null, S => ok(["Wed " + stamp(S.now) + ":07 UTC 2026"]));
cmd("free", null, (S, a) => {
  const h = a.flags.h || a.flags.m;
  const t = h ? "3.8Gi" : "3932160", u = h ? "1.1Gi" : "1153024", f = h ? "2.1Gi" : "2202112";
  return ok(["               total        used        free      shared  buff/cache   available",
             "Mem:      " + pad(t, 12) + pad(u, 12) + pad(f, 12) + pad(h ? "1.0Mi" : "1024", 12) +
             pad(h ? "612Mi" : "577024", 12) + pad(h ? "2.5Gi" : "2621440", 12),
             "Swap:     " + pad(h ? "0B" : "0", 12) + pad(h ? "0B" : "0", 12) + pad(h ? "0B" : "0", 12)]);
});
cmd("df", null, (S, a) => {
  const h = a.flags.h;
  const w = a.flags.i ? [15, 9, 8, 9, 6] : [15, 5, 6, 6, 5];
  const row = c => padr(c[0], w[0]) + pad(c[1], w[1]) + pad(c[2], w[2]) +
                   pad(c[3], w[3]) + pad(c[4], w[4]) + " " + c[5];
  if(a.flags.i)
    return ok([row(["Filesystem", "Inodes", "IUsed", "IFree", "IUse%", "Mounted on"])].concat(
      S.mounts.map(m => {
        const tot = m.inodes || 655360, used = m.iused || 82000;
        return row([m.dev, h ? hsize(tot) : String(tot), h ? hsize(used) : String(used),
                    h ? hsize(tot - used) : String(tot - used),
                    Math.round(used / tot * 100) + "%", m.at]);
      })));
  return ok([row(["Filesystem", h ? "Size" : "1K-blocks", "Used", "Avail", "Use%", "Mounted on"])].concat(
    S.mounts.map(m => row([m.dev,
      h ? hsize(m.size * 1024) : String(m.size),
      h ? hsize(m.used * 1024) : String(m.used),
      h ? hsize((m.size - m.used) * 1024) : String(m.size - m.used),
      Math.round(m.used / m.size * 100) + "%", m.at]))));
});
cmd("du", null, (S, a) => {
  const target = a.args[0] || ".";
  const items = walkTree(S, target);
  if(a.flags.s){
    const total = items.reduce((s, x) => s + Math.max(1, Math.ceil(sizeOf(x.node) / 1024)), 0);
    return ok([(a.flags.h ? hsize(total * 1024) : String(total)) + "\t" + target]);
  }
  const dirs = items.filter(x => x.node.type === "d");
  return ok(dirs.map(d => {
    const sub = walkTree(S, d.path).reduce((s, x) => s + Math.max(1, Math.ceil(sizeOf(x.node) / 1024)), 0);
    return (a.flags.h ? hsize(sub * 1024) : String(sub)) + "\t" + d.path;
  }));
});
cmd("lsblk", null, S => ok(["NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS"].concat(
  S.disks.map(d => padr(d.name, 6) + " " + padr(d.maj || "8:0", 7) + " 0 " + pad(d.size, 5) + "  0 " +
    padr(d.type, 4) + " " + (d.at || "")))));
cmd("blkid", null, S => ok(S.disks.filter(d => d.uuid).map(d =>
  "/dev/" + d.name.replace(/^[^a-z]*/, "") + ": UUID=\"" + d.uuid + "\" TYPE=\"" + (d.fstype || "ext4") + "\"")));
cmd("truncate", {s: 1}, (S, a) => {
  const size = a.opts.s === undefined ? null : +String(a.opts.s).replace(/^[+-]/, "");
  if(size === null) return fail("truncate: you must specify either --size or --reference");
  for(const p of a.args){
    const r = walk(S, p);
    if(!r.node){ writeFile(S, p, ""); continue; }
    if(!permitted(r.node, S.who, "w"))
      return fail("truncate: cannot open '" + p + "' for writing: Permission denied",
                  "Журнал принадлежит root — нужен sudo.");
    r.node.content = r.node.content.slice(0, size);
    r.node.mtime = S.now;
  }
  return ok();
});
cmd("history", null, S => ok(S.history.map((h, i) => pad(i + 1, 5) + "  " + h)));
cmd("clear", null, () => ({out: [], clear: true, code: 0}));
