/* ============================================================
   Диспетчер и сборка учебной машины
   ============================================================ */
cmd("help", null, S => ok([
  "Файлы:      ls  cd  pwd  cat  less  cp  mv  rm  mkdir  rmdir  touch  ln  find  stat  file  du",
  "Права:      chmod  chown  chgrp  umask  id  groups  whoami",
  "Текст:      grep  head  tail  wc  sort  uniq  cut  tr  sed  tee  echo",
  "Учётки:     sudo  su  adduser  useradd  usermod  userdel  groupadd  passwd",
  "Службы:     systemctl  journalctl  service  ps  top  kill  pgrep",
  "Пакеты:     apt  apt-get  dpkg",
  "Сеть:       ip  ss  ping  netplan  hostnamectl  resolvectl  ufw  ssh  ssh-keygen  ssh-copy-id",
  "Диски:      df  free  lsblk  blkid  mount  umount  tar",
  "Расписание: crontab  systemctl list-timers",
  "Прочее:     man  history  clear  reset-scenario",
  "",
  "Работают конвейеры (|), перенаправления (> >> < 2> 2>&1), && и ||, шаблоны имён и $ПЕРЕМЕННЫЕ."
]));
cmd("true", null, () => ({out: [], code: 0}));
cmd("false", null, () => ({out: [], code: 1}));
cmd("sleep", null, (S, a) => { S.now += +(a.args[0] || 1); return ok(); });

cmd("__tree", null, (S, a) => {
  const root = a.args[0] || ".";
  const items = walkTree(S, root);
  const base = absPath(root, S.cwd);
  return ok([root].concat(items.slice(1).map(x => {
    const depth = x.path.slice(base === "/" ? 0 : base.length).split("/").length - 1;
    return "│   ".repeat(Math.max(0, depth - 1)) + "├── " + baseName(x.path);
  })));
});

/* главный вход: строка → результат */
function runSh(S, raw){
  const line = String(raw).trim();
  if(!line) return {out: []};
  S.now += 1;
  S.history.push(line);
  let r;
  try{
    r = runLine(S, line);
  }catch(e){
    if(e instanceof SysErr) r = {out: [], err: e.message, hint: e.hint || "", code: 1};
    else r = {out: [], err: "внутренняя ошибка: " + (e && e.message || e), code: 1};
  }
  r.out = r.out || [];

  S.lastCode = r.code === undefined ? 0 : r.code;
  syncEtc(S);
  S.log.push({cmd: line, out: r.out.slice(), err: r.err || null, who: S.who.name, cwd: S.cwd});
  return r;
}

/* ── учебная машина ──────────────────────────────────── */
const BASE_REPO = {
  nginx: {ver: "1.18.0-6ubuntu14.4", desc: "small, powerful, scalable web/proxy server",
          deps: ["nginx-common"], unit: {name: "nginx.service", desc: "A high performance web server", port: 80,
                                          exec: "nginx: master process /usr/sbin/nginx"},
          files: {"/etc/nginx/nginx.conf": "user www-data;\nworker_processes auto;\n\nhttp {\n    include /etc/nginx/sites-enabled/*;\n}\n"}},
  "nginx-common": {ver: "1.18.0-6ubuntu14.4", desc: "small, powerful, scalable web/proxy server - common files"},
  htop: {ver: "3.0.5-7build2", desc: "interactive processes viewer", provides: {htop: "top"}},
  tree: {ver: "2.0.2-1", desc: "displays an indented directory tree", provides: {tree: "__tree"}},
  curl: {ver: "7.81.0-1ubuntu1.15", desc: "command line tool for transferring data with URL syntax"},
  git:  {ver: "1:2.34.1-1ubuntu1.10", desc: "fast, scalable, distributed revision control system"},
  fail2ban: {ver: "0.11.2-6", desc: "ban hosts that cause multiple authentication errors",
             unit: {name: "fail2ban.service", desc: "Fail2Ban Service", exec: "/usr/bin/fail2ban-server"}},
  postgresql: {ver: "14+238", desc: "object-relational SQL database",
               unit: {name: "postgresql.service", desc: "PostgreSQL RDBMS", port: 5432,
                      exec: "/usr/lib/postgresql/14/bin/postgres"}},
  "unattended-upgrades": {ver: "2.8ubuntu1", desc: "automatic installation of security upgrades",
                          unit: {name: "unattended-upgrades.service", desc: "Unattended Upgrades Shutdown",
                                 exec: "/usr/bin/unattended-upgrade"}}
};

function newMachine(o){
  o = o || {};
  const S = {
    fs: newFS(), cwd: "/root", umask: 0o022, now: 0, boot: 1, nextPid: 600,
    host: o.host || "web-01", env: {PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                                     HOME: "/root", USER: "root", SHELL: "/bin/bash", LANG: "C.UTF-8"},
    users: {}, groups: {}, units: {}, journal: [], procs: [], pkgs: {}, repo: {},
    ports: {}, ifaces: {}, resolvers: ["127.0.0.53"], hosts: {}, unreachable: {},
    ufw: {enabled: false, rules: [], default: "deny"}, mounts: [], disks: [],
    upgradable: [], repos: ["http://archive.ubuntu.com/ubuntu jammy",
                            "http://security.ubuntu.com/ubuntu jammy-security"],
    aptUpdated: false, daemonReloaded: true, history: [], log: [], stack: [], lastCode: 0,
    lockedOut: false, suNoPassword: false
  };
  /* учётные записи */
  S.groups = {root: {gid: 0, members: []}, sudo: {gid: 27, members: []},
              adm: {gid: 4, members: []}, "www-data": {gid: 33, members: []},
              shadow: {gid: 42, members: []}, users: {gid: 100, members: []}};
  S.users = {root: {uid: 0, gid: 0, home: "/root", shell: "/bin/bash", pw: "*"},
             "www-data": {uid: 33, gid: 33, home: "/var/www", shell: "/usr/sbin/nologin", pw: "*"},
             nobody: {uid: 65534, gid: 65534, home: "/nonexistent", shell: "/usr/sbin/nologin", pw: "*"}};
  S.groups.nogroup = {gid: 65534, members: []};
  for(const n in (o.users || {})){
    const u = o.users[n];
    S.users[n] = {uid: u.uid || 1000, gid: u.gid || u.uid || 1000, home: u.home || "/home/" + n,
                  shell: u.shell || "/bin/bash", pw: u.pw === undefined ? "$y$x" : u.pw};
    if(!Object.keys(S.groups).some(g => S.groups[g].gid === S.users[n].gid))
      S.groups[n] = {gid: S.users[n].gid, members: []};
    for(const g of (u.groups || [])){
      if(!S.groups[g]) S.groups[g] = {gid: 1100 + Object.keys(S.groups).length, members: []};
      S.groups[g].members.push(n);
    }
  }
  /* дерево каталогов */
  const R = {uid: 0, gids: [0], name: "root"};
  const mk = (p, mode, own) => {
    const parts = p.split("/").filter(Boolean);
    let node = S.fs.root, acc = "";
    for(const s of parts){
      acc += "/" + s;
      if(!node.children[s]) node.children[s] = dir(mode === undefined ? 0o755 : mode, 0, 0);
      node = node.children[s];
    }
    if(own){ node.uid = own[0]; node.gid = own[1]; }
    if(mode !== undefined) node.mode = mode;
    return node;
  };
  for(const p of ["/bin","/boot","/dev","/etc","/home","/lib","/opt","/proc","/root","/run","/sbin",
                  "/srv","/sys","/usr/bin","/usr/sbin","/usr/local/bin","/usr/share",
                  "/var/log","/var/www/html","/var/lib","/var/spool/cron/crontabs",
                  "/etc/systemd/system","/etc/ssh","/etc/netplan","/etc/sudoers.d","/etc/apt"]) mk(p);
  mk("/root", 0o700, [0, 0]);
  mk("/tmp", 0o1777, [0, 0]);
  mk("/var/www", 0o755, [33, 33]);
  mk("/var/www/html", 0o755, [33, 33]);
  for(const n in S.users){
    const u = S.users[n];
    if(u.home.indexOf("/home/") === 0) mk(u.home, 0o750, [u.uid, u.gid]);
  }
  /* базовые файлы */
  const etc = S.fs.root.children.etc;
  etc.children.hosts = file("127.0.0.1\tlocalhost\n127.0.1.1\t" + S.host + "\n", 0o644, 0, 0);
  etc.children.fstab = file([
    "# <file system> <mount point>   <type>  <options>       <dump>  <pass>",
    "UUID=1a2b3c4d-0001-4a1b-9c2d-000000000001 /               ext4    defaults        0 1", ""
  ].join("\n"), 0o644, 0, 0);
  etc.children["os-release"] = file('PRETTY_NAME="Ubuntu 22.04.4 LTS"\nNAME="Ubuntu"\nVERSION_ID="22.04"\nID=ubuntu\n', 0o644, 0, 0);
  etc.children.ssh.children.sshd_config = file([
    "# Настройки сервера ssh. Полный список — man sshd_config",
    "Port 22",
    "PermitRootLogin prohibit-password",
    "PubkeyAuthentication yes",
    "PasswordAuthentication yes",
    "X11Forwarding no",
    "UsePAM yes",
    ""].join("\n"), 0o644, 0, 0);
  etc.children.netplan.children["00-installer-config.yaml"] = file([
    "network:",
    "  version: 2",
    "  ethernets:",
    "    ens3:",
    "      dhcp4: true",
    ""].join("\n"), 0o600, 0, 0);
  S.fs.root.children.var.children.log.children.syslog = file(
    "Sep  3 09:00:01 " + S.host + " systemd[1]: Started Daily apt download activities.\n", 0o640, 0, 4);
  S.fs.root.children.var.children.log.children["auth.log"] = file([
    "Sep  3 09:12:44 " + S.host + " sshd[812]: Accepted publickey for ubuntu from 10.0.2.2 port 51344 ssh2",
    "Sep  3 09:14:02 " + S.host + " sudo:  ubuntu : TTY=pts/0 ; PWD=/home/ubuntu ; USER=root ; COMMAND=/usr/bin/apt update",
    ""].join("\n"), 0o640, 0, 4);
  /* сеть, диски, службы */
  S.ifaces = o.ifaces || {ens3: {up: true, addr: "10.0.2.15/24", gw: "10.0.2.2", dhcp: true,
                                 dhcpAddr: "10.0.2.15/24", mac: "52:54:00:12:34:56"}};
  S.hosts = Object.assign({localhost: "127.0.0.1", "10.0.2.2": "10.0.2.2",
                           "archive.ubuntu.com": "185.125.190.36"}, o.hosts);
  S.disks = o.disks || [{name: "sda", size: "20G", type: "disk"},
                        {name: "└─sda1", size: "20G", type: "part", at: "/", uuid: "1a2b3c4d-0001-4a1b-9c2d-000000000001",
                         fstype: "ext4", blocks: 20961280}];
  S.mounts = o.mounts || [{dev: "/dev/sda1", at: "/", size: 20961280, used: 4194304, fs: "ext4",
                           inodes: 1310720, iused: 168000}];
  S.repo = Object.assign({}, BASE_REPO, o.repo || {});
  S.pkgs = Object.assign({"openssh-server": "1:8.9p1-3ubuntu0.6", "ubuntu-server": "1.481.1",
                          bash: "5.1-6ubuntu1", coreutils: "8.32-4.1ubuntu1"}, o.pkgs || {});
  S.upgradable = o.upgradable || [];
  S.units = {"ssh.service": {name: "ssh.service", desc: "OpenBSD Secure Shell server", active: true,
                             enabled: true, sub: "running", pid: 812, port: 22, exec: "sshd: /usr/sbin/sshd -D [listener]",
                             restart: "on-failure", type: "simple", valid: true, user: "root", since: 0, cpu: 0.0, mem: 0.6},
             "systemd-journald.service": {name: "systemd-journald.service", desc: "Journal Service", active: true,
                             enabled: true, sub: "running", pid: 231, exec: "/lib/systemd/systemd-journald",
                             restart: "always", type: "notify", valid: true, user: "root", since: 0, cpu: 0.0, mem: 0.3},
             "cron.service": {name: "cron.service", desc: "Regular background program processing daemon", active: true,
                             enabled: true, sub: "running", pid: 745, exec: "/usr/sbin/cron -f -P",
                             restart: "on-failure", type: "simple", valid: true, user: "root", since: 0, cpu: 0.0, mem: 0.1}};
  for(const n in (o.units || {})) S.units[n] = Object.assign({name: n, active: false, enabled: false, sub: "dead",
    desc: n, exec: "/usr/sbin/" + n.replace(/\..*$/, ""), restart: "no", type: "simple", pid: 0, valid: true,
    user: "root", cpu: 0.0, mem: 0.2}, o.units[n]);
  S.ports = {};
  for(const n in S.units){ const u = S.units[n]; if(u.active && u.port) S.ports[u.port] = n; }
  S.journal = [
    {t: 0, unit: null, prio: 6, msg: "Linux version 5.15.0-91-generic (buildd@lcy02) ", boot: 1},
    {t: 0, unit: "systemd-journald.service", prio: 6, msg: "Journal started", boot: 1},
    {t: 0, unit: "ssh.service", prio: 6, msg: "Started OpenBSD Secure Shell server.", boot: 1},
    {t: 0, unit: "cron.service", prio: 6, msg: "Started Regular background program processing daemon.", boot: 1}
  ].concat(o.journal || []);
  syncProcs(S);
  S.procs.push({pid: 1, user: "root", cpu: 0.0, mem: 0.5, stat: "Ss", cmd: "/sbin/init", vsz: 168000, rss: 13000});
  S.procs.sort((a, b) => a.pid - b.pid);
  S.ufw = Object.assign({enabled: false, rules: [], default: "deny"}, o.ufw || {});
  if(o.files) for(const p in o.files){
    const parts = p.split("/").filter(Boolean);
    let node = S.fs.root;
    for(let i = 0; i < parts.length - 1; i++){
      if(!node.children[parts[i]]) node.children[parts[i]] = dir(0o755, 0, 0);
      node = node.children[parts[i]];
    }
    const spec = o.files[p];
    const body = typeof spec === "string" ? {text: spec} : spec;
    const n = file(body.text === undefined ? "" : body.text,
                   body.mode === undefined ? 0o644 : body.mode, 0, 0);
    if(body.owner){ n.uid = S.users[body.owner] ? S.users[body.owner].uid : 0;
                    n.gid = S.users[body.owner] ? S.users[body.owner].gid : 0; }
    node.children[parts[parts.length - 1]] = n;
  }
  if(o.dirs) for(const p in o.dirs){
    const spec = o.dirs[p];
    const n = mk(p, spec.mode);
    if(spec.owner && S.users[spec.owner]){ n.uid = S.users[spec.owner].uid; n.gid = S.users[spec.owner].gid; }
  }
  S.who = whoOf(S, o.as || "root");
  S.cwd = o.cwd || homeOf(S, S.who.name);
  S.env.HOME = S.cwd; S.env.USER = S.who.name;
  syncEtc(S);
  if(o.after) o.after(S);
  return S;
}
cmd("reset-scenario", null, () => ok(["сценарий сбрасывается кнопкой справа"]));
