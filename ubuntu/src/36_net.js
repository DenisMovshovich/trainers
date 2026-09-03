/* ============================================================
   Сеть, межсетевой экран, доступ по ssh, расписание, диски
   ============================================================ */
cmd("ip", null, (S, a) => {
  const sub = a.args[0] || "addr";
  if(/^a(ddr)?$/.test(sub)){
    const out = [];
    let i = 1;
    out.push(i + ": lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default",
             "    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00",
             "    inet 127.0.0.1/8 scope host lo");
    for(const n in S.ifaces){
      const it = S.ifaces[n]; i++;
      out.push(i + ": " + n + ": <BROADCAST,MULTICAST" + (it.up ? ",UP,LOWER_UP" : "") +
               "> mtu 1500 qdisc fq_codel state " + (it.up ? "UP" : "DOWN") + " group default qlen 1000",
               "    link/ether " + (it.mac || "52:54:00:12:34:56") + " brd ff:ff:ff:ff:ff:ff");
      if(it.addr) out.push("    inet " + it.addr + " brd " + it.addr.replace(/\.\d+\//, ".255/").split("/")[0] +
                           " scope global " + (it.dhcp ? "dynamic " : "") + n);
      else out.push("    (адреса нет)");
    }
    return ok(out);
  }
  if(/^r(oute)?$/.test(sub)){
    const out = [];
    for(const n in S.ifaces){
      const it = S.ifaces[n];
      if(it.gw) out.push("default via " + it.gw + " dev " + n + (it.dhcp ? " proto dhcp" : " proto static") + " metric 100");
    }
    for(const n in S.ifaces){
      const it = S.ifaces[n];
      if(it.addr){
        const net = it.addr.replace(/\.\d+\/(\d+)$/, ".0/$1");
        out.push(net + " dev " + n + " proto kernel scope link src " + it.addr.split("/")[0]);
      }
    }
    return ok(out.length ? out : ["(маршрутов нет)"]);
  }
  if(/^l(ink)?$/.test(sub)){
    if(a.args[1] === "set"){
      if(S.who.uid !== 0) return fail("RTNETLINK answers: Operation not permitted");
      const n = a.args[2], st = a.args[3];
      if(!S.ifaces[n]) return fail("Cannot find device \"" + n + "\"");
      S.ifaces[n].up = st === "up";
      return ok();
    }
    return ok(Object.keys(S.ifaces).map((n, i) => (i + 2) + ": " + n + ": <BROADCAST,MULTICAST" +
      (S.ifaces[n].up ? ",UP,LOWER_UP" : "") + "> mtu 1500 state " + (S.ifaces[n].up ? "UP" : "DOWN")));
  }
  return fail("ip: здесь разобраны ip a, ip r и ip link set");
});
cmd("ss", null, (S, a) => {
  const rows = [];
  for(const port in S.ports){
    const unit = S.ports[port];
    const u = S.units[unit];
    if(!u || !u.active) continue;
    rows.push({port: +port, unit, pid: u.pid, proto: u.udp ? "udp" : "tcp", bind: u.bind || "0.0.0.0"});
  }
  rows.sort((x, y) => x.port - y.port);
  const head = "Netid  State   Recv-Q  Send-Q    Local Address:Port    Peer Address:Port  Process";
  const body = rows.map(r => padr(r.proto, 6) + " " + padr("LISTEN", 7) + " " + pad(0, 6) + "  " + pad(511, 6) +
    "    " + padr(r.bind + ":" + r.port, 21) + " " + padr("0.0.0.0:*", 18) +
    (a.flags.p ? " users:((\"" + r.unit.replace(/\.service$/, "") + "\",pid=" + r.pid + ",fd=3))" : ""));
  return ok([head].concat(body.length ? body : ["(ничего не слушает)"]));
});
CMDS.netstat = CMDS.ss;
cmd("ping", {c: 1, W: 1}, (S, a) => {
  const host = a.args[0];
  if(!host) return fail("ping: usage error: Destination address required");
  const ip = S.hosts[host] || (/^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : null);
  if(!ip) return fail("ping: " + host + ": Temporary failure in name resolution",
                      "Имя не разрешилось. Проверьте /etc/hosts и resolvectl status.");
  const up = Object.keys(S.ifaces).some(n => S.ifaces[n].up && S.ifaces[n].addr);
  const n = a.opts.c ? +a.opts.c : 4;
  if(!up || S.unreachable[ip])
    return {out: ["PING " + host + " (" + ip + ") 56(84) bytes of data."].concat(
      ["", "--- " + host + " ping statistics ---",
       n + " packets transmitted, 0 received, 100% packet loss, time " + (n * 1000) + "ms"]), code: 1};
  const out = ["PING " + host + " (" + ip + ") 56(84) bytes of data."];
  for(let i = 1; i <= n; i++)
    out.push("64 bytes from " + ip + ": icmp_seq=" + i + " ttl=64 time=" + (0.2 + i * 0.03).toFixed(3) + " ms");
  out.push("", "--- " + host + " ping statistics ---",
           n + " packets transmitted, " + n + " received, 0% packet loss, time " + (n * 1000 - 999) + "ms");
  return ok(out);
});
cmd("netplan", null, (S, a) => {
  const sub = a.args[0];
  if(sub === "try" || sub === "apply"){
    if(S.who.uid !== 0) return fail("netplan: permission denied (are you root?)");
    applyNetplan(S);
    return ok(sub === "try" ? ["Do you want to keep these settings? Applied."] : []);
  }
  if(sub === "get" || sub === "status") return ok(Object.keys(S.ifaces).map(n =>
    n + ": " + (S.ifaces[n].addr || "нет адреса") + (S.ifaces[n].gw ? "  шлюз " + S.ifaces[n].gw : "")));
  return fail("netplan: здесь разобраны apply, try и get");
});
cmd("hostnamectl", null, (S, a) => {
  if(a.args[0] === "set-hostname"){
    if(S.who.uid !== 0) return fail("Could not set property: Access denied");
    S.host = a.args[1];
    syncEtc(S);
    return ok();
  }
  return ok([" Static hostname: " + S.host, "       Icon name: computer-vm", "         Chassis: vm",
             "Operating System: Ubuntu 22.04.4 LTS", "          Kernel: Linux 5.15.0-91-generic",
             "    Architecture: x86-64"]);
});
cmd("timedatectl", null, S => ok(["               Local time: Wed " + stamp(S.now) + ":07 UTC",
  "           Universal time: Wed " + stamp(S.now) + ":07 UTC",
  "                Time zone: Etc/UTC (UTC, +0000)",
  "System clock synchronized: yes", "              NTP service: active"]));
cmd("resolvectl", null, S => ok(["Global", "       Protocols: LLMNR=resolve -mDNS", "",
  "Link 2 (" + (Object.keys(S.ifaces)[0] || "eth0") + ")",
  "    Current Scopes: DNS",
  "Current DNS Server: " + (S.resolvers[0] || "127.0.0.53"),
  "       DNS Servers: " + S.resolvers.join(" ")]));

/* ── межсетевой экран ────────────────────────────────── */
cmd("ufw", null, (S, a) => {
  const sub = a.args[0];
  if(S.who.uid !== 0 && sub !== "status" && sub !== "version")
    return fail("ERROR: You need to be root to run this script",
                "ufw меняет правила ядра — нужен sudo.");
  if(sub === "status"){
    if(!S.ufw.enabled) return ok(["Status: inactive"]);
    const num = a.args[1] === "numbered" || a.flags.numbered;
    const out = ["Status: active", "",
                 (num ? "     " : "") + "To                         Action      From",
                 (num ? "     " : "") + "--                         ------      ----"];
    S.ufw.rules.forEach((r, i) => {
      out.push((num ? "[" + pad(i + 1, 2) + "] " : "") + padr(r.name || String(r.port), 26) + " " +
               padr(r.action + " IN", 11) + " " + (r.from || "Anywhere"));
    });
    return ok(out);
  }
  if(sub === "enable"){
    const hasSsh = S.ufw.rules.some(r => String(r.port) === "22" && r.action === "ALLOW");
    S.ufw.enabled = true;
    S.ufw.default = S.ufw.default || "deny";
    const out = ["Firewall is active and enabled on system startup"];
    if(!hasSsh){
      S.lockedOut = true;
      out.push("", "ВНИМАНИЕ: правила для порта 22 нет, а политика по умолчанию — deny.",
               "На настоящей машине это отрезало бы вам ssh. Здесь вы остались в консоли,",
               "но состояние сохранено: проверьте ufw status и добавьте правило.");
    }
    return ok(out);
  }
  if(sub === "disable"){ S.ufw.enabled = false; S.lockedOut = false; return ok(["Firewall stopped and disabled on system startup"]); }
  if(sub === "reset"){ S.ufw = {enabled: false, rules: [], default: "deny"}; return ok(["Backing up 'user.rules'", "Firewall reset"]); }
  if(sub === "default"){
    S.ufw.default = a.args[1];
    return ok(["Default " + a.args[2] + " policy changed to '" + a.args[1] + "'"]);
  }
  if(sub === "allow" || sub === "deny" || sub === "limit" || sub === "reject"){
    const rest = a.args.slice(1);
    let spec = rest.join(" ");
    let from = "Anywhere", nameSpec = spec;
    const fi = rest.indexOf("from");
    if(fi >= 0){ from = rest[fi + 1]; nameSpec = rest.slice(0, fi).join(" ").replace(/^proto\s+\w+\s+/, ""); }
    const ti = rest.indexOf("to");
    if(ti >= 0) nameSpec = rest.slice(ti + 2).join(" ").replace(/^port\s+/, "");
    const port = portOfService(nameSpec.split("/")[0]);
    if(port === null && !/^\d+$/.test(nameSpec))
      return fail("ERROR: Could not find a profile matching '" + nameSpec + "'",
                  "Готовые профили: OpenSSH, Nginx Full, Nginx HTTP. Иначе указывайте номер порта.");
    S.ufw.rules.push({port, name: nameSpec, action: sub === "allow" || sub === "limit" ? "ALLOW" : "DENY", from});
    if(String(port) === "22") S.lockedOut = false;
    return ok(["Rule added"].concat(from === "Anywhere" ? ["Rule added (v6)"] : []));
  }
  if(sub === "delete"){
    const n = +a.args[1];
    if(n && S.ufw.rules[n - 1]){ S.ufw.rules.splice(n - 1, 1); return ok(["Rule deleted"]); }
    const act = a.args[1], rest = a.args.slice(2).join(" ");
    const idx = S.ufw.rules.findIndex(r => r.name === rest);
    if(idx < 0) return fail("ERROR: Could not delete non-existent rule");
    S.ufw.rules.splice(idx, 1);
    return ok(["Rule deleted"]);
  }
  if(sub === "app") return ok(["Available applications:", "  Nginx Full", "  Nginx HTTP", "  OpenSSH"]);
  return fail("ufw: здесь разобраны status, enable, disable, default, allow, deny, delete, reset, app");
});

/* ── доступ по ssh ───────────────────────────────────── */
cmd("ssh-keygen", {t: 1, f: 1, C: 1, b: 1}, (S, a) => {
  const f = a.opts.f || homeOf(S, S.who.name) + "/.ssh/id_" + (a.opts.t || "rsa");
  try{ mkdirAt(S, dirName(f), {mode: 0o700}); }catch(e){}
  writeFile(S, f, "-----BEGIN OPENSSH PRIVATE KEY-----\nучебный ключ\n-----END OPENSSH PRIVATE KEY-----\n", {mode: 0o600});
  writeFile(S, f + ".pub", "ssh-" + (a.opts.t || "rsa") + " AAAAB3NzaC1yc2EUCHEBNY " +
            (a.opts.C || S.who.name + "@" + S.host) + "\n", {mode: 0o644});
  return ok(["Generating public/private " + (a.opts.t || "rsa") + " key pair.",
             "Your identification has been saved in " + f,
             "Your public key has been saved in " + f + ".pub"]);
});
function sshdConf(S, key){
  let txt = "";
  try{ txt = readFile(S, "/etc/ssh/sshd_config", {who: {uid: 0, gids: [0], name: "root"}}); }catch(e){ return null; }
  const m = new RegExp("^\\s*" + key + "\\s+(\\S+)", "mi").exec(txt);
  return m ? m[1] : null;
}
cmd("ssh", {p: 1, i: 1}, (S, a) => {
  const spec = a.args[0];
  if(!spec) return fail("usage: ssh [user@]hostname");
  const [user, host] = spec.indexOf("@") >= 0 ? spec.split("@") : [S.who.name, spec];
  const port = a.opts.p ? +a.opts.p : (sshdConf(S, "Port") ? +sshdConf(S, "Port") : 22);
  const sshd = S.units["ssh.service"];
  if(!sshd || !sshd.active)
    return fail("ssh: connect to host " + host + " port " + port + ": Connection refused",
                "Служба ssh не запущена: systemctl status ssh.");
  if(!ufwAllows(S, port))
    return fail("ssh: connect to host " + host + " port " + port + ": Connection timed out",
                "Порт закрыт межсетевым экраном. Посмотрите sudo ufw status.");
  if(!S.users[user]) return fail(user + "@" + host + ": Permission denied (publickey,password).");
  if(user === "root" && String(sshdConf(S, "PermitRootLogin") || "prohibit-password") === "no")
    return fail("root@" + host + ": Permission denied (publickey).",
                "В sshd_config стоит PermitRootLogin no — и это правильная настройка.");
  const allow = sshdConf(S, "AllowUsers");
  if(allow && allow.split(/[\s,]+/).indexOf(user) < 0)
    return fail(user + "@" + host + ": Permission denied (publickey).",
                "В sshd_config есть AllowUsers — в списке этого пользователя нет.");
  /* ключ: файл и права на него */
  const akPath = homeOf(S, user) + "/.ssh/authorized_keys";
  let ak = null, akNode = null;
  try{ akNode = statPath(S, akPath, {who: {uid: 0, gids: [0], name: "root"}}).node; ak = akNode.content; }catch(e){}
  if(ak && akNode){
    const homeNode = statPath(S, homeOf(S, user), {who: {uid: 0, gids: [0], name: "root"}}).node;
    if((akNode.mode & 0o077) || (homeNode.mode & 0o022))
      return fail("Authentication refused: bad ownership or modes for file " + akPath,
                  "sshd отказывается брать ключ, если каталог или файл доступны на запись кому-то ещё. Нужно chmod 700 ~/.ssh и chmod 600 authorized_keys.");
    if(akNode.uid !== S.users[user].uid)
      return fail("Authentication refused: bad ownership or modes for file " + akPath,
                  "Файл должен принадлежать самому пользователю: chown -R " + user + ":" + user + " " + dirName(akPath) + ".");
    return ok(["Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-91-generic x86_64)", "",
               "Last login: " + stamp(S.now) + " from 10.0.2.2",
               "(вход по ключу удался; это учебная проверка — оболочка остаётся здешней)"]);
  }
  if(String(sshdConf(S, "PasswordAuthentication") || "yes") === "no")
    return fail(user + "@" + host + ": Permission denied (publickey).",
                "Пароли выключены, а ключ не подошёл. Положите открытый ключ в ~/.ssh/authorized_keys.");
  return ok(["Welcome to Ubuntu 22.04.4 LTS", "(вход по паролю удался)"]);
});
cmd("ssh-copy-id", {i: 1}, (S, a) => {
  const spec = a.args[0] || "";
  const [user, host] = spec.indexOf("@") >= 0 ? spec.split("@") : [S.who.name, spec];
  if(!S.users[user]) return fail("ssh-copy-id: user " + user + " unknown");
  const pub = a.opts.i || homeOf(S, S.who.name) + "/.ssh/id_rsa.pub";
  let key;
  try{ key = readFile(S, pub.replace(/(\.pub)?$/, ".pub").replace(/\.pub\.pub$/, ".pub")); }
  catch(e){ return fail("ssh-copy-id: ERROR: failed to open ID file '" + pub + "': No such file",
                        "Сначала создайте пару ключей: ssh-keygen -t ed25519."); }
  const root = {uid: 0, gids: [0], name: "root"};
  const d = homeOf(S, user) + "/.ssh";
  try{ mkdirAt(S, d, {mode: 0o700, who: root}); }catch(e){}
  const dn = statPath(S, d, {who: root}).node;
  dn.uid = S.users[user].uid; dn.gid = S.users[user].gid; dn.mode = 0o700;
  let old = "";
  try{ old = readFile(S, d + "/authorized_keys", {who: root}); }catch(e){}
  writeFile(S, d + "/authorized_keys", old + key, {who: root, mode: 0o600});
  const kn = statPath(S, d + "/authorized_keys", {who: root}).node;
  kn.uid = S.users[user].uid; kn.gid = S.users[user].gid; kn.mode = 0o600;
  return ok(["Number of key(s) added: 1", "",
             "Now try logging into the machine, with:   \"ssh '" + spec + "'\""]);
});

/* ── расписание ──────────────────────────────────────── */
cmd("crontab", {u: 1}, (S, a) => {
  const who = a.opts.u || S.who.name;
  if(who !== S.who.name && S.who.uid !== 0) return fail("crontab: must be privileged to use -u");
  const path = "/var/spool/cron/crontabs/" + who;
  if(a.flags.l){
    let t;
    try{ t = readFile(S, path, {who: {uid: 0, gids: [0], name: "root"}}); }
    catch(e){ return {out: ["no crontab for " + who], code: 1}; }
    return ok(t.split("\n").filter(l => l !== ""));
  }
  if(a.flags.r){ try{ unlinkAt(S, path, {who: {uid: 0, gids: [0], name: "root"}}); }catch(e){} return ok(); }
  if(a.flags.e) return ok(["crontab -e открывает редактор, которого здесь нет.",
    "Положите строки в файл и загрузите их: crontab файл",
    "Формат: мин час день месяц день_недели команда"]);
  if(a.args[0]){
    const txt = readFile(S, a.args[0]);
    for(const l of txt.split("\n")){
      if(!l.trim() || l[0] === "#") continue;
      if(!/^(\S+\s+){5}\S/.test(l))
        return fail("crontab: errors in crontab file, can't install",
                    "В строке «" + l.trim() + "» меньше пяти полей времени. Порядок: минута час день месяц день_недели, затем команда.");
    }
    writeFile(S, path, txt, {who: {uid: 0, gids: [0], name: "root"}});
    return ok();
  }
  return fail("crontab: usage: crontab [-u user] file | -l | -r | -e");
});
cmd("systemd-run", null, S => ok(["Running as unit: run-u" + S.nextPid++ + ".service"]));

/* ── диски ───────────────────────────────────────────── */
cmd("mount", null, (S, a) => {
  if(!a.args.length && !a.flags.a)
    return ok(S.mounts.map(m => m.dev + " on " + m.at + " type " + (m.fs || "ext4") + " (rw,relatime)"));
  if(S.who.uid !== 0) return fail("mount: only root can do that");
  if(a.flags.a){
    const txt = readFile(S, "/etc/fstab", {who: {uid: 0, gids: [0], name: "root"}});
    for(const l of txt.split("\n")){
      if(!l.trim() || l[0] === "#") continue;
      const f = l.trim().split(/\s+/);
      if(f.length < 4) return fail("mount: /etc/fstab: parse error at line: " + l.trim(),
                                   "В строке должно быть шесть полей: что, куда, тип, ключи, dump, pass.");
      const dev = f[0], at = f[1];
      const disk = S.disks.filter(d => "UUID=" + d.uuid === dev || "/dev/" + d.name.replace(/^[^a-z]*/, "") === dev)[0];
      if(!disk) return fail("mount: " + at + ": can't find " + dev + ".",
                            "Такого устройства нет. Проверьте blkid и lsblk.");
      if(!S.mounts.some(m => m.at === at)){
        try{ mkdirAt(S, at, {who: {uid: 0, gids: [0], name: "root"}}); }catch(e){}
        S.mounts.push({dev: "/dev/" + disk.name.replace(/^[^a-z]*/, ""), at, size: disk.blocks || 20961280,
                       used: 45000, fs: disk.fstype || "ext4"});
        disk.at = at;
      }
    }
    return ok();
  }
  const [dev, at] = a.args;
  if(!S.mounts.some(m => m.at === at))
    S.mounts.push({dev, at, size: 20961280, used: 45000, fs: "ext4"});
  return ok();
});
/* создание файловой системы: диск получает тип и UUID */
cmd("mkfs", {t: 1}, (S, a) => {
  if(S.who.uid !== 0) return fail("mke2fs: Permission denied", "Форматирование доступно только root — нужен sudo.");
  const type = a.opts.t || (a.name.indexOf(".") > 0 ? a.name.split(".")[1] : "ext4");
  const dev = a.args[0];
  if(!dev) return fail("mkfs: no device specified");
  const short = baseName(dev);
  const d = S.disks.filter(x => x.name.replace(/^[^a-z]*/, "") === short)[0];
  if(!d) return fail("mke2fs: No such file or directory while trying to determine filesystem size",
                     "Такого устройства нет. Список — lsblk.");
  if(S.mounts.some(m => m.dev === dev))
    return fail("mke2fs: /dev/" + short + " is mounted; will not make a filesystem here!",
                "Сначала отключите раздел: umount.");
  d.fstype = type;
  if(!d.uuid){
    /* устойчивый идентификатор: он должен быть одинаковым при повторном прогоне */
    let h = 0;
    for(let i = 0; i < short.length; i++) h = (Math.imul(h, 31) + short.charCodeAt(i)) >>> 0;
    const hex = n => (h + n).toString(16).padStart(8, "0").slice(-8);
    d.uuid = hex(0) + "-" + hex(1).slice(0, 4) + "-4" + hex(2).slice(0, 3) + "-9" + hex(3).slice(0, 3) + "-" + hex(4) + hex(5).slice(0, 4);
  }
  return ok(["mke2fs 1.46.5 (30-Dec-2021)",
             "Creating filesystem with " + Math.round((d.blocks || 20961280) / 4) + " 4k blocks and 1310720 inodes",
             "Filesystem UUID: " + d.uuid, "",
             "Writing superblocks and filesystem accounting information: done"]);
});
for(const t of ["ext4", "ext3", "xfs"]){ CMDS["mkfs." + t] = CMDS.mkfs; SPEC["mkfs." + t] = {t: 1}; }

cmd("umount", null, (S, a) => {
  if(S.who.uid !== 0) return fail("umount: only root can do that");
  const at = a.args[0];
  const i = S.mounts.findIndex(m => m.at === at || m.dev === at);
  if(i < 0) return fail("umount: " + at + ": not mounted.");
  S.mounts.splice(i, 1);
  return ok();
});
cmd("tar", {f: 1, C: 1}, (S, a) => {
  const f = a.opts.f;
  if(!f) return fail("tar: ключ -f обязателен: tar -czf архив.tar.gz каталог");
  if(a.flags.c){
    const items = [];
    for(const p of a.args) for(const x of walkTree(S, p)) items.push(x.path);
    writeFile(S, f, "TAR\n" + items.join("\n") + "\n");
    return ok(a.flags.v ? items : []);
  }
  if(a.flags.t){
    const txt = readFile(S, f);
    return ok(txt.split("\n").slice(1).filter(Boolean));
  }
  if(a.flags.x) return ok(["архив распакован (учебная модель хранит только список файлов)"]);
  return fail("tar: укажите одно из действий: -c (создать), -t (посмотреть), -x (распаковать)");
});
cmd("man", null, (S, a) => {
  const n = a.args[0];
  if(!n) return fail("What manual page do you want?");
  const h = HELPTXT[n];
  if(!h) return {out: ["No manual entry for " + n], code: 16};
  return ok([n.toUpperCase() + "(1)", "", "NAME", "    " + n + " — " + h.name, "", "SYNOPSIS", "    " + h.syn, "",
             "DESCRIPTION"].concat(h.desc.map(l => "    " + l)));
});
