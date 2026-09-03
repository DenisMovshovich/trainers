/* ============================================================
   Состояние системы: учётные записи, службы, пакеты, журнал, сеть
   ============================================================ */
function homeOf(S, name){
  const u = S.users[name];
  return u ? u.home : "/root";
}
function whoOf(S, name){
  const u = S.users[name];
  if(!u) serr("пользователь " + name + " не существует");
  const gids = [u.gid];
  for(const g in S.groups)
    if(S.groups[g].members.indexOf(name) >= 0 && gids.indexOf(S.groups[g].gid) < 0)
      gids.push(S.groups[g].gid);
  return {name, uid: u.uid, gids};
}
function groupNamesOf(S, name){
  const u = S.users[name];
  if(!u) return [];
  const primary = Object.keys(S.groups).filter(g => S.groups[g].gid === u.gid);
  const extra = Object.keys(S.groups).filter(g => S.groups[g].members.indexOf(name) >= 0);
  return primary.concat(extra.filter(g => primary.indexOf(g) < 0));
}
const inGroup = (S, user, g) => groupNamesOf(S, user).indexOf(g) >= 0;
/* право на sudo: членство в группе sudo либо явное правило в /etc/sudoers.d */
function canSudo(S, name){
  if(name === "root") return true;
  if(inGroup(S, name, "sudo") || inGroup(S, name, "admin")) return true;
  const d = S.fs.root.children.etc && S.fs.root.children.etc.children["sudoers.d"];
  if(d && d.type === "d")
    for(const f in d.children){
      const txt = d.children[f].content || "";
      if(new RegExp("^\\s*" + name + "\\s+ALL", "m").test(txt)) return true;
      for(const g of groupNamesOf(S, name))
        if(new RegExp("^\\s*%" + g + "\\s+ALL", "m").test(txt)) return true;
    }
  return false;
}

/* ── /etc/passwd, /etc/group, /etc/shadow строятся из учётных данных ── */
function syncEtc(S){
  const etc = S.fs.root.children.etc;
  if(!etc) return;
  const byUid = Object.keys(S.users).sort((a, b) => S.users[a].uid - S.users[b].uid);
  etc.children.passwd = file(byUid.map(n => {
    const u = S.users[n];
    return [n, "x", u.uid, u.gid, u.gecos || "", u.home, u.shell].join(":");
  }).join("\n") + "\n", 0o644, 0, 0);
  etc.children.shadow = file(byUid.map(n => {
    const u = S.users[n];
    return [n, u.pw === undefined ? "!" : u.pw, "19700", "0", "99999", "7", "", "", ""].join(":");
  }).join("\n") + "\n", 0o640, 0, 42);
  const byGid = Object.keys(S.groups).sort((a, b) => S.groups[a].gid - S.groups[b].gid);
  etc.children.group = file(byGid.map(g =>
    [g, "x", S.groups[g].gid, S.groups[g].members.join(",")].join(":")).join("\n") + "\n", 0o644, 0, 0);
  etc.children.hostname = file(S.host + "\n", 0o644, 0, 0);
}

/* ── службы systemd ──────────────────────────────────── */
function unitName(n){ return /\./.test(n) ? n : n + ".service"; }
function getUnit(S, name){
  const n = unitName(name);
  if(S.units[n]) return S.units[n];
  /* unit-файл, положенный руками в /etc/systemd/system */
  const d = S.fs.root.children.etc && S.fs.root.children.etc.children.systemd &&
            S.fs.root.children.etc.children.systemd.children.system;
  if(d && d.children[n] && S.daemonReloaded){
    const u = parseUnit(d.children[n].content, n);
    S.units[n] = u;
    return u;
  }
  return null;
}
function parseUnit(text, name){
  const u = {name, active: false, enabled: false, sub: "dead", desc: name, exec: "", restart: "no",
             after: [], wants: [], type: "simple", pid: 0, fromFile: true, user: "root"};
  let sect = "";
  for(const raw of String(text).split("\n")){
    const line = raw.trim();
    if(!line || line[0] === "#" || line[0] === ";") continue;
    const s = /^\[(.+)\]$/.exec(line);
    if(s){ sect = s[1]; continue; }
    const kv = /^([A-Za-z]+)\s*=\s*(.*)$/.exec(line);
    if(!kv) continue;
    const k = kv[1], v = kv[2];
    if(k === "Description") u.desc = v;
    else if(k === "ExecStart") u.exec = v;
    else if(k === "Restart") u.restart = v;
    else if(k === "Type") u.type = v;
    else if(k === "User") u.user = v;
    else if(k === "After") u.after = v.split(/\s+/);
    else if(k === "Wants") u.wants = v.split(/\s+/);
    else if(k === "WantedBy") u.wantedBy = v;
  }
  u.valid = !!u.exec || u.type === "oneshot";
  return u;
}
function jlog(S, unit, prio, msg){
  S.journal.push({t: S.now, unit, prio: prio === undefined ? 6 : prio, msg, boot: S.boot});
}
function startUnit(S, name){
  const u = getUnit(S, name);
  if(!u) serr("Unit " + unitName(name) + " not found.",
              "Список известных служб: systemctl list-units --type=service. Свой unit-файл нужно положить в /etc/systemd/system и выполнить systemctl daemon-reload.");
  if(u.active) return u;
  if(!u.valid){
    u.failed = true;
    jlog(S, u.name, 3, u.name + ": Unit is not valid: ExecStart= is missing.");
    serr("Job for " + u.name + " failed.",
         "Служба не запустилась. Причину показывает systemctl status " + u.name + " и journalctl -u " + u.name + ".");
  }
  /* порт уже занят другой службой — типичная причина отказа */
  if(u.port && S.ports[u.port] && S.ports[u.port] !== u.name){
    u.failed = true; u.sub = "failed"; u.result = "exit-code";
    jlog(S, u.name, 3, "bind: Address already in use");
    jlog(S, u.name, 3, u.name + ": Failed with result 'exit-code'.");
    serr("Job for " + u.name + " failed because the control process exited with error code.",
         "Порт " + u.port + " уже занят. Посмотрите ss -tulpn и journalctl -u " + u.name + ".");
  }
  /* причина может быть условной: тогда устранение условия снимает отказ */
  const broken = typeof u.brokenConfig === "function" ? u.brokenConfig(S) : u.brokenConfig;
  if(broken){
    u.failed = true; u.sub = "failed"; u.result = "exit-code";
    jlog(S, u.name, 3, broken);
    jlog(S, u.name, 3, u.name + ": Failed with result 'exit-code'.");
    serr("Job for " + u.name + " failed because the control process exited with error code.",
         "Смотрите journalctl -u " + u.name + " — там записана причина.");
  }
  u.active = true; u.sub = "running"; u.failed = false; u.result = "";
  u.pid = S.nextPid++;
  u.since = S.now;
  if(u.port) S.ports[u.port] = u.name;
  if(u.type === "oneshot"){ u.sub = "exited"; u.active = true; }
  jlog(S, u.name, 6, "Started " + u.desc + ".");
  syncProcs(S);
  return u;
}
function stopUnit(S, name){
  const u = getUnit(S, name);
  if(!u) serr("Unit " + unitName(name) + " not loaded.");
  if(!u.active && !u.failed) return u;
  if(u.port && S.ports[u.port] === u.name) delete S.ports[u.port];
  u.active = false; u.sub = "dead"; u.pid = 0; u.failed = false;
  jlog(S, u.name, 6, "Stopped " + u.desc + ".");
  syncProcs(S);
  return u;
}
function syncProcs(S){
  S.procs = S.procs.filter(p => !p.unit);
  for(const n in S.units){
    const u = S.units[n];
    if(u.active && u.pid)
      S.procs.push({pid: u.pid, user: u.user || "root", cpu: u.cpu || 0.0, mem: u.mem || 0.4,
                    stat: "Ss", cmd: u.exec || ("/usr/sbin/" + n.replace(/\.service$/, "")), unit: n});
  }
  S.procs.sort((a, b) => a.pid - b.pid);
}

/* ── пакеты ──────────────────────────────────────────── */
function pkgInstalled(S, name){ return !!S.pkgs[name]; }
function pkgKnown(S, name){ return !!S.repo[name]; }

/* ── сеть ────────────────────────────────────────────── */
function ifaceList(S){ return Object.keys(S.ifaces); }
function applyNetplan(S){
  const d = S.fs.root.children.etc && S.fs.root.children.etc.children.netplan;
  if(!d) serr("netplan: /etc/netplan не существует");
  let found = false;
  for(const f in d.children){
    const txt = d.children[f].content || "";
    const cfg = parseNetplan(txt, f);
    found = true;
    for(const name in cfg){
      if(!S.ifaces[name]) serr("netplan: интерфейс " + name + " не найден",
                               "Список интерфейсов показывает ip a.");
      const it = S.ifaces[name], c = cfg[name];
      if(c.dhcp4){ it.addr = it.dhcpAddr || "10.0.2.15/24"; it.gw = "10.0.2.2"; it.dhcp = true; }
      else if(c.addresses && c.addresses.length){
        it.addr = c.addresses[0]; it.dhcp = false;
        it.gw = c.gateway || (c.routes && c.routes[0]) || "";
      }
      if(c.nameservers) S.resolvers = c.nameservers;
      it.up = true;
    }
  }
  if(!found) serr("netplan: в /etc/netplan нет файлов настройки");
  return true;
}
function parseNetplan(text, fname){
  /* небольшой разбор YAML ровно под netplan: отступы по два пробела */
  const lines = String(text).split("\n").filter(l => l.trim() && !/^\s*#/.test(l));
  const out = {};
  let inEth = false, cur = null, indentEth = -1;
  for(const raw of lines){
    const ind = raw.length - raw.replace(/^\s*/, "").length;
    const line = raw.trim();
    if(/^ethernets:\s*$/.test(line)){ inEth = true; indentEth = ind; continue; }
    if(inEth && ind <= indentEth && !/^ethernets:/.test(line)){ inEth = false; cur = null; }
    if(!inEth) continue;
    const m = /^([A-Za-z0-9_-]+):\s*$/.exec(line);
    if(m && ind === indentEth + 2){ cur = m[1]; out[cur] = {addresses: []}; continue; }
    if(!cur) continue;
    if(/^dhcp4:\s*(true|yes)\s*$/.test(line)){ out[cur].dhcp4 = true; continue; }
    if(/^dhcp4:\s*(false|no)\s*$/.test(line)){ out[cur].dhcp4 = false; continue; }
    const g = /^gateway4:\s*(\S+)\s*$/.exec(line);
    if(g){ out[cur].gateway = g[1]; continue; }
    const a = /^addresses:\s*\[(.+)\]\s*$/.exec(line);
    if(a){ out[cur].addresses = a[1].split(",").map(s => s.trim().replace(/^["']|["']$/g, "")); continue; }
    const one = /^-\s*(\S+)\s*$/.exec(line);
    if(one){
      const v = one[1].replace(/^["']|["']$/g, "");
      if(/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(v)) out[cur].addresses.push(v);
      else (out[cur].nameservers = out[cur].nameservers || []).push(v);
      continue;
    }
    const via = /^via:\s*(\S+)\s*$/.exec(line);
    if(via){ (out[cur].routes = out[cur].routes || []).push(via[1]); continue; }
  }
  if(!Object.keys(out).length)
    serr("netplan: в " + fname + " не нашлось ни одного интерфейса под ethernets:",
         "Проверьте отступы: network: → ethernets: → имя интерфейса, по два пробела на уровень.");
  return out;
}

/* ── межсетевой экран ────────────────────────────────── */
function ufwAllows(S, port){
  if(!S.ufw.enabled) return true;
  for(const r of S.ufw.rules)
    if(String(r.port) === String(port) && r.action === "ALLOW") return true;
  return false;
}
function portOfService(name){
  const map = {ssh: 22, OpenSSH: 22, http: 80, https: 443, "Nginx Full": 80, "Nginx HTTP": 80};
  return map[name] !== undefined ? map[name] : (/^\d+$/.test(name) ? +name : null);
}
