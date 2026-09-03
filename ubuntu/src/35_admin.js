/* ============================================================
   Учётные записи, повышение прав, службы, пакеты, процессы
   ============================================================ */
const SYSTEM_USERS = {root:1, daemon:1, bin:1, sys:1, "www-data":1, nobody:1, systemd:1, sshd:1};

cmd("su", null, (S, a) => {
  const login = a.flags["-"] || a.args[0] === "-" ;
  const name = a.args.filter(x => x !== "-")[0] || "root";
  if(!S.users[name]) return fail("su: user " + name + " does not exist");
  if(S.who.uid !== 0 && !S.suNoPassword)
    return fail("su: Authentication failure",
                "Пароль root на Ubuntu по умолчанию не задан — вход под root через su невозможен. Для разовых действий используют sudo, для оболочки — sudo -i.");
  S.stack.push({who: S.who, cwd: S.cwd});
  S.who = whoOf(S, name);
  if(login || a.flags.l) S.cwd = homeOf(S, name);
  return ok(["теперь вы " + name + "; вернуться назад — exit"]);
});
cmd("exit", null, S => {
  if(!S.stack.length) return ok(["сеанс здесь не закрывается: это единственная оболочка"]);
  const prev = S.stack.pop();
  S.who = prev.who; S.cwd = prev.cwd;
  return ok(["снова " + S.who.name]);
});
CMDS.logout = CMDS.exit;

cmd("useradd", {s: 1, g: 1, G: 1, d: 1, u: 1, c: 1}, (S, a) => {
  if(S.who.uid !== 0) return fail("useradd: Permission denied.", "Заводить пользователей может только root — через sudo.");
  const name = a.args[0];
  if(!name) return fail("useradd: missing operand");
  if(S.users[name]) return fail("useradd: user '" + name + "' already exists");
  let uid = a.opts.u ? +a.opts.u : 1000;
  while(Object.keys(S.users).some(n => S.users[n].uid === uid)) uid++;
  const home = a.opts.d || "/home/" + name;
  const shell = a.opts.s || (a.flags.m ? "/bin/bash" : "/bin/sh");
  let gid = uid;
  if(a.opts.g){
    if(!S.groups[a.opts.g]) return fail("useradd: group '" + a.opts.g + "' does not exist");
    gid = S.groups[a.opts.g].gid;
  } else S.groups[name] = {gid, members: []};
  S.users[name] = {uid, gid, home, shell, pw: "!", gecos: a.opts.c || ""};
  if(a.flags.m || a.flags.M === undefined && a.flags.m){ /* явный -m */ }
  if(a.flags.m){
    mkdirAt(S, home, {mode: 0o755, who: {uid: 0, gids: [0], name: "root"}});
    const h = statPath(S, home).node;
    h.uid = uid; h.gid = gid;
  }
  if(a.opts.G) for(const g of String(a.opts.G).split(",")){
    if(!S.groups[g]) return fail("useradd: group '" + g + "' does not exist");
    if(S.groups[g].members.indexOf(name) < 0) S.groups[g].members.push(name);
  }
  syncEtc(S);
  return ok(a.flags.m ? [] : ["пользователь " + name + " заведён; домашний каталог не создан — для этого нужен ключ -m"]);
});
cmd("adduser", null, (S, a) => {
  if(S.who.uid !== 0) return fail("adduser: Only root may add a user or group to the system.");
  const [name, group] = a.args;
  if(group){    /* adduser имя группа — добавление в группу */
    if(!S.users[name]) return fail("adduser: The user `" + name + "' does not exist.");
    if(!S.groups[group]) return fail("adduser: The group `" + group + "' does not exist.");
    if(S.groups[group].members.indexOf(name) < 0) S.groups[group].members.push(name);
    syncEtc(S);
    return ok(["Adding user `" + name + "' to group `" + group + "' ...", "Done."]);
  }
  if(!name) return fail("adduser: missing operand");
  if(S.users[name]) return fail("adduser: The user `" + name + "' already exists.");
  let uid = 1000;
  while(Object.keys(S.users).some(n => S.users[n].uid === uid)) uid++;
  S.groups[name] = {gid: uid, members: []};
  S.users[name] = {uid, gid: uid, home: "/home/" + name, shell: "/bin/bash", pw: "$y$hashed"};
  mkdirAt(S, "/home/" + name, {mode: 0o750, who: {uid: 0, gids: [0], name: "root"}});
  const h = statPath(S, "/home/" + name).node;
  h.uid = uid; h.gid = uid;
  syncEtc(S);
  return ok(["Adding user `" + name + "' ...", "Adding new group `" + name + "' (" + uid + ") ...",
             "Creating home directory `/home/" + name + "' ...", "Adding new user `" + name + "' (" + uid + ") ...",
             "Copying files from `/etc/skel' ...", "passwd: password updated successfully", "Done."]);
});
cmd("userdel", null, (S, a) => {
  if(S.who.uid !== 0) return fail("userdel: Permission denied.");
  const name = a.args[0];
  if(!S.users[name]) return fail("userdel: user '" + name + "' does not exist");
  if(a.flags.r) try{ unlinkAt(S, S.users[name].home, {who: {uid: 0, gids: [0], name: "root"}}); }catch(e){}
  delete S.users[name];
  for(const g in S.groups) S.groups[g].members = S.groups[g].members.filter(m => m !== name);
  syncEtc(S);
  return ok();
});
cmd("usermod", {G: 1, g: 1, s: 1, d: 1, L: 0, U: 0}, (S, a) => {
  if(S.who.uid !== 0) return fail("usermod: Permission denied.");
  const name = a.args[0];
  if(!S.users[name]) return fail("usermod: user '" + name + "' does not exist");
  const u = S.users[name];
  if(a.opts.s) u.shell = a.opts.s;
  if(a.opts.d) u.home = a.opts.d;
  if(a.opts.g){
    if(!S.groups[a.opts.g]) return fail("usermod: group '" + a.opts.g + "' does not exist");
    u.gid = S.groups[a.opts.g].gid;
  }
  if(a.opts.G !== undefined){
    const list = String(a.opts.G).split(",").filter(Boolean);
    for(const g of list) if(!S.groups[g]) return fail("usermod: group '" + g + "' does not exist");
    if(!a.flags.a) for(const g in S.groups) S.groups[g].members = S.groups[g].members.filter(m => m !== name);
    for(const g of list) if(S.groups[g].members.indexOf(name) < 0) S.groups[g].members.push(name);
  }
  if(a.flags.L) u.pw = "!" + (u.pw || "");
  if(a.flags.U) u.pw = String(u.pw || "").replace(/^!+/, "");
  syncEtc(S);
  return ok();
});
cmd("groupadd", null, (S, a) => {
  if(S.who.uid !== 0) return fail("groupadd: Permission denied.");
  const g = a.args[0];
  if(!g) return fail("groupadd: missing operand");
  if(S.groups[g]) return fail("groupadd: group '" + g + "' already exists");
  let gid = 1000;
  while(Object.keys(S.groups).some(n => S.groups[n].gid === gid)) gid++;
  S.groups[g] = {gid, members: []};
  syncEtc(S);
  return ok();
});
cmd("groupdel", null, (S, a) => {
  if(S.who.uid !== 0) return fail("groupdel: Permission denied.");
  if(!S.groups[a.args[0]]) return fail("groupdel: group '" + a.args[0] + "' does not exist");
  delete S.groups[a.args[0]];
  syncEtc(S);
  return ok();
});
cmd("passwd", null, (S, a) => {
  const name = a.args[0] || S.who.name;
  if(name !== S.who.name && S.who.uid !== 0)
    return fail("passwd: You may not view or modify password information for " + name + ".");
  if(!S.users[name]) return fail("passwd: user '" + name + "' does not exist");
  if(a.flags.l){ S.users[name].pw = "!" + (S.users[name].pw || ""); syncEtc(S); return ok(["passwd: password expiry information changed."]); }
  if(a.flags.u){ S.users[name].pw = String(S.users[name].pw || "").replace(/^!+/, ""); syncEtc(S); return ok(["passwd: password expiry information changed."]); }
  if(a.flags.S){
    const p = S.users[name].pw || "!";
    return ok([name + " " + (p[0] === "!" ? "L" : p === "*" ? "L" : "P") + " 01/01/2026 0 99999 7 -1"]);
  }
  S.users[name].pw = "$y$set";
  syncEtc(S);
  return ok(["passwd: password updated successfully"]);
});
cmd("visudo", null, S => ok(["visudo здесь не открывает редактор.",
  "Правило кладут отдельным файлом: sudo tee /etc/sudoers.d/имя <<< 'user ALL=(ALL) NOPASSWD: /usr/bin/systemctl'",
  "и ставят на него права 0440."]));

/* ── службы ──────────────────────────────────────────── */
function unitStatus(S, u){
  const out = [];
  const dot = u.failed ? "×" : u.active ? "●" : "○";
  out.push(dot + " " + u.name + " - " + u.desc);
  const efile = u.enabled ? "enabled" : "disabled";
  out.push("     Loaded: loaded (/lib/systemd/system/" + u.name + "; " + efile + "; preset: enabled)");
  out.push("     Active: " + (u.failed ? "failed (Result: " + (u.result || "exit-code") + ")"
            : u.active ? "active (" + u.sub + ") since " + stamp(u.since || 0) + "; " + (S.now - (u.since || 0)) + "s ago"
            : "inactive (dead)"));
  if(u.active && u.pid) out.push("   Main PID: " + u.pid + " (" +
    baseName(String(u.exec || u.name).split(/[\s:]/)[0]) + ")");
  if(u.port && u.active) out.push("     Listen: 0.0.0.0:" + u.port);
  out.push("");
  const rec = S.journal.filter(e => e.unit === u.name).slice(-6);
  for(const e of rec) out.push(stamp(e.t) + " " + S.host + " systemd[1]: " + e.msg);
  return out;
}
cmd("systemctl", null, (S, a) => {
  const sub = a.args[0] || "list-units";
  const name = a.args[1];
  const need = () => { if(!name) return fail("systemctl: expected unit name"); return null; };

  if(sub === "daemon-reload" || sub === "daemon-reexec"){
    if(S.who.uid !== 0) return fail("Failed to reload daemon: Access denied", "Нужны права root: sudo systemctl daemon-reload.");
    S.daemonReloaded = true;
    return ok();
  }
  if(sub === "list-units" || sub === "list-unit-files"){
    const rows = Object.keys(S.units).sort().map(n => {
      const u = S.units[n];
      return sub === "list-unit-files"
        ? padr(n, 30) + " " + padr(u.enabled ? "enabled" : "disabled", 10) + " enabled"
        : padr(n, 30) + " " + padr("loaded", 7) + " " + padr(u.failed ? "failed" : u.active ? "active" : "inactive", 9) +
          " " + padr(u.failed ? "failed" : u.sub, 8) + " " + u.desc;
    });
    const head = sub === "list-unit-files" ? "UNIT FILE                      STATE      PRESET"
      : "UNIT                           LOAD    ACTIVE    SUB      DESCRIPTION";
    const flt = a.flags.failed || a.opts.state === "failed"
      ? rows.filter(r => /failed/.test(r)) : rows;
    return ok([head].concat(flt.length ? flt : ["0 loaded units listed."]));
  }
  if(sub === "list-timers"){
    return ok(["NEXT                        LEFT       LAST  UNIT                     ACTIVATES"].concat(
      Object.keys(S.units).filter(n => /\.timer$/.test(n)).map(n =>
        padr(stamp(S.now + 3) + " UTC", 27) + " " + padr("12min", 10) + " -     " +
        padr(n, 24) + " " + n.replace(/\.timer$/, ".service"))));
  }
  if(sub === "status"){
    if(!name) return ok(["● " + S.host, "    State: " + (Object.keys(S.units).some(n => S.units[n].failed) ? "degraded" : "running"),
                         "     Jobs: 0 queued", "   Units: " + Object.keys(S.units).length + " loaded"]);
    const u = getUnit(S, name);
    if(!u) return {out: ["Unit " + unitName(name) + " could not be found."], code: 4};
    return {out: unitStatus(S, u), code: u.active ? 0 : 3};
  }
  if(sub === "cat"){
    const u = getUnit(S, name);
    if(!u) return fail("No files found for " + unitName(name) + ".");
    return ok(["# /lib/systemd/system/" + u.name, "[Unit]", "Description=" + u.desc,
               "", "[Service]", "ExecStart=" + (u.exec || "/usr/sbin/" + u.name.replace(/\.service$/, "")),
               "Restart=" + u.restart, "", "[Install]", "WantedBy=" + (u.wantedBy || "multi-user.target")]);
  }
  if(sub === "is-active"){
    const u = getUnit(S, name);
    return {out: [u && u.active ? "active" : u && u.failed ? "failed" : "inactive"], code: u && u.active ? 0 : 3};
  }
  if(sub === "is-enabled"){
    const u = getUnit(S, name);
    return {out: [u ? (u.enabled ? "enabled" : "disabled") : "not-found"], code: u && u.enabled ? 0 : 1};
  }
  const writes = {start:1, stop:1, restart:1, reload:1, enable:1, disable:1, mask:1, unmask:1};
  if(writes[sub]){
    const e = need(); if(e) return e;
    if(S.who.uid !== 0)
      return fail("Failed to " + sub + " " + unitName(name) + ": Access denied",
                  "Управление службами требует прав root: sudo systemctl " + sub + " " + name + ".");
    const u = getUnit(S, name);
    if(!u) return fail("Failed to " + sub + " " + unitName(name) + ": Unit " + unitName(name) + " not found.",
                       "Если unit-файл только что положили в /etc/systemd/system, сначала нужен systemctl daemon-reload.");
    if(sub === "start") startUnit(S, name);
    else if(sub === "stop") stopUnit(S, name);
    else if(sub === "restart" || sub === "reload"){ stopUnit(S, name); startUnit(S, name); }
    else if(sub === "enable"){
      u.enabled = true;
      if(a.flags.now) startUnit(S, name);
      return ok(["Created symlink /etc/systemd/system/" + (u.wantedBy || "multi-user.target") +
                 ".wants/" + u.name + " → /lib/systemd/system/" + u.name + "."]);
    }
    else if(sub === "disable"){
      u.enabled = false;
      if(a.flags.now) stopUnit(S, name);
      return ok(["Removed /etc/systemd/system/multi-user.target.wants/" + u.name + "."]);
    }
    else if(sub === "mask"){ u.masked = true; u.enabled = false; return ok(["Created symlink /etc/systemd/system/" + u.name + " → /dev/null."]); }
    else if(sub === "unmask"){ u.masked = false; return ok(["Removed /etc/systemd/system/" + u.name + "."]); }
    return ok();
  }
  return fail("Unknown command verb " + sub + ".",
              "Здесь живут: status, start, stop, restart, enable, disable, is-active, is-enabled, daemon-reload, list-units, list-timers, cat, mask.");
});
cmd("service", null, (S, a) => {
  const [name, sub] = a.args;
  return CMDS.systemctl(S, Object.assign({}, a, {args: [sub, name], flags: {}, opts: {}}));
});
const PRIO = {0:"emerg",1:"alert",2:"crit",3:"err",4:"warning",5:"notice",6:"info",7:"debug"};
cmd("journalctl", {u: 1, n: 1, p: 1, since: 1, until: 1, b: 1}, (S, a) => {
  let e = S.journal.slice();
  if(a.opts.u) e = e.filter(x => x.unit === unitName(a.opts.u));
  if(a.flags.b || a.opts.b !== undefined) e = e.filter(x => x.boot === (a.opts.b ? S.boot + +a.opts.b : S.boot));
  if(a.opts.p !== undefined){
    const want = /^\d$/.test(String(a.opts.p)) ? +a.opts.p
      : Object.keys(PRIO).filter(k => PRIO[k] === a.opts.p)[0];
    e = e.filter(x => x.prio <= +want);
  }
  if(a.flags.x || a.flags.e){ /* -xe: последние строки с пояснениями */ }
  const n = a.opts.n !== undefined ? +a.opts.n : (a.flags.e ? 20 : 0);
  if(n) e = e.slice(-n);
  if(a.flags.f) return ok(["-- слежение в реальном времени здесь не работает: журнал показывается целиком --"]
    .concat(e.map(x => jline(S, x))));
  if(!e.length) return ok(["-- No entries --"]);
  return ok(["-- Journal begins at " + stamp(0) + " UTC. --"].concat(e.map(x => jline(S, x))));
});
function jline(S, x){
  return stamp(x.t) + " " + S.host + " " + (x.unit ? x.unit.replace(/\.service$/, "") + "[" + (x.pid || 1) + "]" : "kernel") +
         ": " + x.msg;
}
cmd("dmesg", null, S => ok(S.journal.filter(x => !x.unit).map(x => "[   " + (x.t * 1.7).toFixed(6) + "] " + x.msg)));

/* ── пакеты ──────────────────────────────────────────── */
function aptNeedRoot(S, what){
  if(S.who.uid !== 0)
    return fail("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n" +
                "E: Unable to acquire the dpkg frontend lock, are you root?",
                "Установка пакетов меняет систему — нужен sudo: sudo apt " + what + ".");
  return null;
}
cmd("apt", null, (S, a) => {
  const sub = a.args[0];
  const names = a.args.slice(1);
  if(sub === "update"){
    const e = aptNeedRoot(S, "update"); if(e) return e;
    S.aptUpdated = true;
    return ok(S.repos.map((r, i) => "Get:" + (i + 1) + " " + r + " InRelease [110 kB]")
      .concat(["Reading package lists... Done",
               S.upgradable.length ? String(S.upgradable.length) + " packages can be upgraded. Run 'apt list --upgradable' to see them."
                                   : "All packages are up to date."]));
  }
  if(sub === "list"){
    if(a.flags.upgradable || a.flags["upgradable"])
      return ok(["Listing... Done"].concat(S.upgradable.map(p =>
        p + "/jammy-updates " + (S.repo[p] ? S.repo[p].ver : "1.0") + " amd64 [upgradable from: " + (S.pkgs[p] || "1.0") + "]")));
    return ok(["Listing... Done"].concat(Object.keys(S.pkgs).sort().map(p =>
      p + "/now " + S.pkgs[p] + " amd64 [installed]")));
  }
  if(sub === "upgrade" || sub === "full-upgrade" || sub === "dist-upgrade"){
    const e = aptNeedRoot(S, "upgrade"); if(e) return e;
    if(!S.aptUpdated)
      return ok(["Reading package lists... Done", "Building dependency tree... Done",
                 "0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.",
                 "(список пакетов не обновлялся — сначала apt update)"]);
    const list = S.upgradable.slice();
    for(const p of list){ S.pkgs[p] = S.repo[p] ? S.repo[p].ver : "2.0"; }
    S.upgradable = [];
    return ok(["Reading package lists... Done", "Building dependency tree... Done",
               "The following packages will be upgraded:", "  " + list.join(" "),
               list.length + " upgraded, 0 newly installed, 0 to remove and 0 not upgraded."]);
  }
  if(sub === "install"){
    const e = aptNeedRoot(S, "install " + names.join(" ")); if(e) return e;
    if(!names.length) return fail("apt: имя пакета не указано");
    const out = ["Reading package lists... Done", "Building dependency tree... Done"];
    for(const n of names){
      if(!pkgKnown(S, n) || (!S.aptUpdated && !pkgInstalled(S, n)))
        return fail("E: Unable to locate package " + n,
                    S.aptUpdated ? "Такого пакета в подключённых репозиториях нет. Проверьте написание: apt search " + n + "."
                                 : "Список пакетов ни разу не обновлялся. Сначала sudo apt update.");
      if(pkgInstalled(S, n)){ out.push(n + " is already the newest version (" + S.pkgs[n] + ")."); continue; }
      const dep = S.repo[n].deps || [];
      for(const d of dep) if(!pkgInstalled(S, d)) S.pkgs[d] = S.repo[d] ? S.repo[d].ver : "1.0";
      S.pkgs[n] = S.repo[n].ver;
      if(dep.length) out.push("The following additional packages will be installed:", "  " + dep.join(" "));
      out.push("The following NEW packages will be installed:",
               "  " + dep.concat([n]).join(" "),
               dep.length + 1 + " newly installed, 0 to remove and 0 not upgraded.");
      for(const d of dep) out.push("Setting up " + d + " (" + ((S.repo[d] || {}).ver || "1.0") + ") ...");
      out.push("Setting up " + n + " (" + S.repo[n].ver + ") ...");
      /* пакет приносит службу и файлы */
      const u = S.repo[n].unit;
      if(u){
        S.units[u.name] = Object.assign({name: u.name, active: false, enabled: true, sub: "dead",
                                         desc: u.desc || n, exec: u.exec || "/usr/sbin/" + n,
                                         restart: "on-failure", type: "simple", pid: 0, valid: true,
                                         user: "root"}, u);
        startUnit(S, u.name);
        out.push("Created symlink /etc/systemd/system/multi-user.target.wants/" + u.name + " → /lib/systemd/system/" + u.name + ".");
      }
      for(const f in (S.repo[n].files || {})){
        const R2 = {uid: 0, gids: [0], name: "root"};
        const parts = dirName(f).split("/").filter(Boolean);
        let acc = "";
        for(const s of parts){ acc += "/" + s; try{ mkdirAt(S, acc, {who: R2}); }catch(x){} }
        writeFile(S, f, S.repo[n].files[f], {who: R2});
      }
      for(const c in (S.repo[n].provides || {})) CMDS[c] = CMDS[S.repo[n].provides[c]];
    }
    out.push("Processing triggers for man-db (2.10.2-1) ...");
    return ok(out);
  }
  if(sub === "remove" || sub === "purge" || sub === "autoremove"){
    const e = aptNeedRoot(S, sub); if(e) return e;
    const out = ["Reading package lists... Done"];
    for(const n of names){
      if(!pkgInstalled(S, n)){ out.push("Package '" + n + "' is not installed, so not removed"); continue; }
      delete S.pkgs[n];
      const u = S.repo[n] && S.repo[n].unit;
      if(u){ try{ stopUnit(S, u.name); }catch(x){} delete S.units[u.name]; }
      out.push("Removing " + n + " ...");
      if(sub === "purge"){
        out.push("Purging configuration files for " + n + " ...");
        for(const f in (S.repo[n].files || {})) try{ unlinkAt(S, f, {who: {uid: 0, gids: [0], name: "root"}}); }catch(x){}
      }
    }
    return ok(out);
  }
  if(sub === "search"){
    const re = new RegExp(names[0] || "", "i");
    return ok(Object.keys(S.repo).filter(p => re.test(p) || re.test(S.repo[p].desc || ""))
      .sort().map(p => p + "/jammy " + S.repo[p].ver + " amd64\n  " + (S.repo[p].desc || "")));
  }
  if(sub === "show" || sub === "policy"){
    const n = names[0];
    if(!S.repo[n]) return fail("N: Unable to locate package " + n);
    return ok(["Package: " + n, "Version: " + S.repo[n].ver,
               "Installed: " + (S.pkgs[n] || "(none)"),
               "Candidate: " + S.repo[n].ver,
               "Description: " + (S.repo[n].desc || "")]);
  }
  return fail("E: Invalid operation " + sub,
              "Действия: update, upgrade, install, remove, purge, search, show, list --installed.");
});
CMDS["apt-get"] = CMDS.apt;
cmd("dpkg", {S: 1, L: 1, l: 1}, (S, a) => {
  if(a.flags.l || a.opts.l !== undefined){
    const pat = a.opts.l || a.args[0];
    const list = Object.keys(S.pkgs).filter(p => !pat || p.indexOf(String(pat).replace(/\*/g, "")) >= 0).sort();
    return ok(["Desired=Unknown/Install/Remove/Purge/Hold",
               "| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst",
               "||/ Name           Version      Architecture Description"]
      .concat(list.map(p => "ii  " + padr(p, 15) + " " + padr(S.pkgs[p], 12) + " amd64        " +
                            ((S.repo[p] || {}).desc || ""))));
  }
  if(a.opts.L !== undefined || a.flags.L){
    const n = a.opts.L || a.args[0];
    if(!pkgInstalled(S, n)) return fail("dpkg-query: package '" + n + "' is not installed");
    const files = Object.keys((S.repo[n] || {}).files || {});
    return ok(["/.", "/usr", "/usr/bin", "/usr/bin/" + n].concat(files));
  }
  if(a.opts.S !== undefined || a.flags.S){
    const p = a.opts.S || a.args[0];
    for(const n in S.pkgs)
      if(Object.keys((S.repo[n] || {}).files || {}).indexOf(p) >= 0) return ok([n + ": " + p]);
    return {out: ["dpkg-query: no path found matching pattern " + p], code: 1};
  }
  return fail("dpkg: здесь разобраны ключи -l, -L и -S");
});

/* ── процессы ────────────────────────────────────────── */
cmd("ps", null, (S, a) => {
  /* «ps aux» — запись BSD: буквы идут без дефиса и попадают в аргументы */
  if(a.args.length === 1 && /^[auxefj]+$/.test(a.args[0])){
    for(const c of a.args[0]) a.flags[c] = true;
    a.args = [];
  }
  const all = a.flags.a || a.flags.e || a.flags.A;
  const rows = (all ? S.procs : S.procs.filter(p => p.user === S.who.name)).slice();
  if(a.flags.f && !a.flags.u)
    return ok(["UID          PID    PPID  C STIME TTY          TIME CMD"].concat(rows.map(p =>
      padr(p.user, 10) + pad(p.pid, 7) + pad(1, 8) + "  0 " + stamp(0).slice(-5) + " ?        00:00:0" +
      (p.pid % 9) + " " + p.cmd)));
  return ok(["USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND"].concat(rows.map(p =>
    padr(p.user, 9) + pad(p.pid, 6) + pad(p.cpu.toFixed(1), 5) + pad(p.mem.toFixed(1), 5) +
    pad(p.vsz || 21500, 7) + pad(p.rss || 4200, 6) + " ?        " + padr(p.stat, 5) + stamp(0).slice(-5) +
    "   0:0" + (p.pid % 9) + " " + p.cmd)));
});
cmd("top", null, (S, a) => ok([
  "top - " + stamp(S.now).slice(-5) + ":01 up " + (2 + S.now % 9) + " days,  1 user,  load average: 0.08, 0.03, 0.01",
  "Tasks: " + S.procs.length + " total,   1 running, " + (S.procs.length - 1) + " sleeping,   0 stopped,   0 zombie",
  "%Cpu(s):  " + S.procs.reduce((s, p) => s + p.cpu, 0).toFixed(1) + " us,  0.7 sy,  0.0 ni, 96.4 id",
  "MiB Mem :   3840.0 total,   2101.4 free,   1122.3 used,    616.3 buff/cache",
  "",
  "    PID USER      PR  NI    VIRT    RES  %CPU  %MEM     TIME+ COMMAND"
].concat(S.procs.slice().sort((x, y) => y.cpu - x.cpu).slice(0, 10).map(p =>
  pad(p.pid, 7) + " " + padr(p.user, 9) + " 20   0 " + pad(p.vsz || 21500, 7) + " " + pad(p.rss || 4200, 6) +
  " " + pad(p.cpu.toFixed(1), 5) + " " + pad(p.mem.toFixed(1), 5) + "   0:00.5 " + baseName(p.cmd.split(" ")[0]).replace(/:$/, "")))));

cmd("kill", null, (S, a) => {
  const sig = a.flags[9] ? 9 : a.flags[15] ? 15 : a.flags.KILL ? 9 : a.flags.HUP ? 1 : 15;
  const pid = +a.args[0];
  if(!pid) return fail("kill: usage: kill [-s sigspec | -n signum | -sigspec] pid");
  const p = S.procs.filter(x => x.pid === pid)[0];
  if(!p) return fail("kill: (" + pid + ") - No such process");
  if(S.who.uid !== 0 && p.user !== S.who.name)
    return fail("kill: (" + pid + ") - Operation not permitted",
                "Убить чужой процесс может только root.");
  if(p.unit){
    const u = S.units[p.unit];
    jlog(S, u.name, 6, u.name + ": Main process exited, code=killed, status=" + sig + "/" + (sig === 9 ? "KILL" : "TERM"));
    if(u.restart === "always" || u.restart === "on-failure"){
      u.pid = S.nextPid++;
      jlog(S, u.name, 6, u.name + ": Scheduled restart job.");
      jlog(S, u.name, 6, "Started " + u.desc + ".");
      syncProcs(S);
      return ok();
    }
    stopUnit(S, u.name);
    return ok();
  }
  S.procs = S.procs.filter(x => x.pid !== pid);
  return ok();
});
cmd("pkill", null, (S, a) => {
  const re = new RegExp(a.args[0] || "$^");
  const hit = S.procs.filter(p => re.test(p.cmd));
  if(!hit.length) return {out: [], code: 1};
  for(const p of hit) CMDS.kill(S, {args: [String(p.pid)], flags: a.flags, opts: {}, argv: []});
  return ok();
});
cmd("pgrep", null, (S, a) => {
  const re = new RegExp(a.args[0] || "$^");
  const hit = S.procs.filter(p => re.test(p.cmd));
  return {out: hit.map(p => a.flags.a ? p.pid + " " + p.cmd : String(p.pid)), code: hit.length ? 0 : 1};
});
