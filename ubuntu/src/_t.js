/* ============================================================
   Тесты движка учебной машины
   ============================================================ */
let pass = 0, failn = 0;
const fails = [];
function t(name, fn){
  try{ fn(); pass++; }
  catch(e){ failn++; fails.push(name + " — " + (e && e.message || e)); }
}
function eq(got, want, what){
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if(g !== w) throw new Error((what ? what + ": " : "") + "получено " + g + ", ожидалось " + w);
}
function has(hay, needle, what){
  const s = Array.isArray(hay) ? hay.join("\n") : String(hay);
  if(s.indexOf(needle) < 0) throw new Error((what ? what + ": " : "") + "в выводе нет «" + needle + "»\n" + s);
}
function nothas(hay, needle, what){
  const s = Array.isArray(hay) ? hay.join("\n") : String(hay);
  if(s.indexOf(needle) >= 0) throw new Error((what ? what + ": " : "") + "в выводе неожиданно есть «" + needle + "»\n" + s);
}
const M = o => newMachine(o);
const run = (S, c) => runSh(S, c);
const outOf = (S, c) => { const r = run(S, c); if(r.err) throw new Error(c + " → " + r.err); return r.out; };
const errOf = (S, c) => { const r = run(S, c); if(!r.err) throw new Error(c + " прошла, а должна была отказать: " + r.out.join(" | ")); return r.err; };

/* ── файловая система и права ────────────────────────── */
t("pwd и cd по дереву", () => {
  const S = M();
  eq(outOf(S, "pwd"), ["/root"]);
  run(S, "cd /etc"); eq(outOf(S, "pwd"), ["/etc"]);
  run(S, "cd .."); eq(outOf(S, "pwd"), ["/"]);
  run(S, "cd -"); eq(outOf(S, "pwd"), ["/etc"]);
});
t("ls -l показывает права, владельца и имя", () => {
  const S = M();
  const o = outOf(S, "ls -l /etc/ssh/sshd_config");
  has(o, "-rw-r--r--"); has(o, "root"); has(o, "sshd_config");
});
t("обычный пользователь не пишет в /etc", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}});
  has(errOf(S, "touch /etc/proba"), "Permission denied");
});
t("sudo даёт записать, и файл принадлежит root", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}});
  outOf(S, "sudo touch /etc/proba");
  has(outOf(S, "ls -l /etc/proba"), "root");
});
t("без группы sudo команда отклоняется", () => {
  const S = M({as: "bob", users: {bob: {uid: 1001}}});
  has(errOf(S, "sudo touch /etc/proba"), "is not in the sudoers file");
});
t("перенаправление выполняет оболочка, а не sudo", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}});
  /* классическая ловушка: sudo echo ... > /etc/файл всё равно отказывает */
  has(errOf(S, "sudo echo x > /etc/proba"), "Permission denied");
  /* а tee — работает, потому что файл открывает уже поднятый процесс */
  outOf(S, "echo x | sudo tee /etc/proba");
  eq(outOf(S, "cat /etc/proba"), ["x"]);
});
t("бит x на каталоге отвечает за вход, r — за показ", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
               dirs: {"/srv/zakryto": {mode: 0o600, owner: "root"}}});
  has(errOf(S, "cd /srv/zakryto"), "Permission denied");
  const S2 = M({as: "ubuntu", users: {ubuntu: {uid: 1000}},
                dirs: {"/srv/tolkovhod": {mode: 0o711, owner: "root"}},
                files: {"/srv/tolkovhod/f.txt": {text: "секрет\n", mode: 0o644}}});
  eq(outOf(S2, "cat /srv/tolkovhod/f.txt"), ["секрет"]);
  has(errOf(S2, "ls /srv/tolkovhod"), "Permission denied");
});
t("chmod принимает и восьмеричную, и буквенную запись", () => {
  const S = M();
  run(S, "touch /tmp/a");
  run(S, "chmod 640 /tmp/a"); has(outOf(S, "ls -l /tmp/a"), "-rw-r-----");
  run(S, "chmod u+x /tmp/a"); has(outOf(S, "ls -l /tmp/a"), "-rwxr-----");
  run(S, "chmod go= /tmp/a");  has(outOf(S, "ls -l /tmp/a"), "-rwx------");
});
t("липкий бит: чужое в /tmp не удалить", () => {
  const S = M({users: {alice: {uid: 1001}, bob: {uid: 1002}}});
  run(S, "touch /tmp/alicefile");
  run(S, "chown alice:alice /tmp/alicefile");
  const S2 = S;
  S2.who = whoOf(S2, "bob");
  has(errOf(S2, "rm /tmp/alicefile"), "Operation not permitted");
});
t("chown только для root", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}});
  run(S, "touch /home/ubuntu/f");
  has(errOf(S, "chown root /home/ubuntu/f"), "Operation not permitted");
  outOf(S, "sudo chown root:root /home/ubuntu/f");
  has(outOf(S, "ls -l /home/ubuntu/f"), "root root");
});
t("rm -r нужен для каталога, rmdir — только для пустого", () => {
  const S = M();
  run(S, "mkdir -p /tmp/d/sub");
  has(errOf(S, "rm /tmp/d"), "Is a directory");
  has(errOf(S, "rmdir /tmp/d"), "Directory not empty");
  outOf(S, "rm -r /tmp/d");
  has(errOf(S, "ls /tmp/d"), "No such file");
});
t("umask влияет на права нового файла", () => {
  const S = M();
  run(S, "umask 077");
  run(S, "touch /tmp/tajna");
  has(outOf(S, "ls -l /tmp/tajna"), "-rw-------");
});

/* ── оболочка ────────────────────────────────────────── */
t("конвейер передаёт вывод дальше", () => {
  const S = M();
  eq(outOf(S, "cat /etc/passwd | grep -c root"), ["1"]);
});
t("перенаправление и дозапись", () => {
  const S = M();
  run(S, "echo one > /tmp/f");
  run(S, "echo two >> /tmp/f");
  eq(outOf(S, "cat /tmp/f"), ["one", "two"]);
  run(S, "echo three > /tmp/f");
  eq(outOf(S, "cat /tmp/f"), ["three"]);
});
t("&& и || смотрят на код возврата", () => {
  const S = M();
  eq(outOf(S, "true 2>/dev/null; ls /etc/hostname && echo есть"), ["/etc/hostname", "есть"]);
  const r = run(S, "ls /net/takogo/net || echo подобрано");
  has(r.out, "подобрано");
});
t("кавычки удерживают пробелы, одинарные гасят подстановку", () => {
  const S = M();
  run(S, "V=мир");
  eq(outOf(S, 'echo "привет $V"'), ["привет мир"]);
  eq(outOf(S, "echo 'привет $V'"), ["привет $V"]);
});
t("шаблон имён раскрывается оболочкой", () => {
  const S = M();
  run(S, "mkdir -p /tmp/g"); run(S, "touch /tmp/g/a.log /tmp/g/b.log /tmp/g/c.txt");
  eq(outOf(S, "ls /tmp/g/*.log"), ["/tmp/g/a.log", "/tmp/g/b.log"]);
});
t("$? хранит код последней команды", () => {
  const S = M();
  run(S, "ls /net/takogo");
  eq(outOf(S, "echo $?"), ["1"]);
  run(S, "ls /etc");
  eq(outOf(S, "echo $?"), ["0"]);
});
t("2>&1 сливает ошибку в общий поток", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000}}});
  const o = outOf(S, "cat /etc/shadow 2>&1");
  has(o, "Permission denied");
});
t("исполняемый файл требует бита x", () => {
  const S = M({files: {"/root/go.sh": {text: "#!/bin/bash\necho сработало\n", mode: 0o644}}});
  has(errOf(S, "/root/go.sh"), "Permission denied");
  run(S, "chmod +x /root/go.sh");
  eq(outOf(S, "/root/go.sh"), ["сработало"]);
});

/* ── пользователи ────────────────────────────────────── */
t("adduser заводит пользователя, группу и домашний каталог", () => {
  const S = M();
  outOf(S, "adduser deploy");
  has(outOf(S, "id deploy"), "uid=1000(deploy)");
  has(outOf(S, "ls -ld /home/deploy"), "deploy deploy");
  has(outOf(S, "grep deploy /etc/passwd"), "/home/deploy");
});
t("usermod -aG добавляет, не стирая прежние группы", () => {
  const S = M({users: {deploy: {uid: 1000, groups: ["adm"]}}});
  outOf(S, "usermod -aG sudo deploy");
  const g = outOf(S, "groups deploy").join(" ");
  has(g, "adm"); has(g, "sudo");
});
t("usermod -G без -a затирает прежние группы", () => {
  const S = M({users: {deploy: {uid: 1000, groups: ["adm"]}}});
  outOf(S, "usermod -G sudo deploy");
  nothas(outOf(S, "groups deploy"), "adm");
});
t("useradd без -m не создаёт домашний каталог", () => {
  const S = M();
  outOf(S, "useradd -s /bin/bash svc");
  has(errOf(S, "ls -ld /home/svc"), "No such file");
});
t("служебная учётка с nologin видна в passwd", () => {
  const S = M();
  has(outOf(S, "grep www-data /etc/passwd"), "/usr/sbin/nologin");
});
t("su на root не проходит: пароля нет", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}});
  has(errOf(S, "su -"), "Authentication failure");
  outOf(S, "sudo -i");
  eq(outOf(S, "whoami"), ["root"]);
  outOf(S, "exit");
  eq(outOf(S, "whoami"), ["ubuntu"]);
});
t("правило в sudoers.d даёт право без группы sudo", () => {
  const S = M({as: "ci", users: {ci: {uid: 1005}},
               files: {"/etc/sudoers.d/ci": {text: "ci ALL=(ALL) NOPASSWD: ALL\n", mode: 0o440}}});
  outOf(S, "sudo touch /etc/ok");
  has(outOf(S, "ls /etc/ok"), "/etc/ok");
});

/* ── службы ──────────────────────────────────────────── */
t("systemctl status и разница enable/start", () => {
  const S = M({units: {"myapp.service": {desc: "My App", exec: "/usr/bin/myapp"}}});
  has(outOf(S, "systemctl status myapp"), "inactive (dead)");
  run(S, "systemctl enable myapp");
  eq(outOf(S, "systemctl is-enabled myapp"), ["enabled"]);
  eq(outOf(S, "systemctl is-active myapp"), ["inactive"]);
  run(S, "systemctl start myapp");
  eq(outOf(S, "systemctl is-active myapp"), ["active"]);
});
t("управление службой требует root", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}},
               units: {"myapp.service": {exec: "/usr/bin/myapp"}}});
  has(errOf(S, "systemctl start myapp"), "Access denied");
  outOf(S, "sudo systemctl start myapp");
  eq(outOf(S, "systemctl is-active myapp"), ["active"]);
});
t("свой unit-файл виден только после daemon-reload", () => {
  const S = M();
  run(S, "mkdir -p /etc/systemd/system");
  S.daemonReloaded = false;
  writeFile(S, "/etc/systemd/system/site.service",
    "[Unit]\nDescription=Site\n\n[Service]\nExecStart=/usr/local/bin/site\n\n[Install]\nWantedBy=multi-user.target\n");
  has(errOf(S, "systemctl start site"), "not found");
  outOf(S, "systemctl daemon-reload");
  outOf(S, "systemctl start site");
  eq(outOf(S, "systemctl is-active site"), ["active"]);
});
t("занятый порт валит запуск, причина в журнале", () => {
  const S = M({units: {"web.service": {exec: "/usr/sbin/web", port: 80, desc: "Web"},
                       "old.service": {exec: "/usr/sbin/old", port: 80, active: true, desc: "Old", pid: 900}}});
  S.ports[80] = "old.service";
  has(errOf(S, "systemctl start web"), "failed");
  has(outOf(S, "journalctl -u web"), "Address already in use");
  has(outOf(S, "systemctl status web"), "failed");
});
t("kill по службе с Restart=always поднимает её заново", () => {
  const S = M({units: {"api.service": {exec: "/usr/bin/api", active: true, pid: 901, restart: "always", desc: "API"}}});
  syncProcs(S);
  const before = outOf(S, "systemctl is-active api");
  eq(before, ["active"]);
  outOf(S, "kill -9 901");
  eq(outOf(S, "systemctl is-active api"), ["active"]);
  has(outOf(S, "journalctl -u api"), "Scheduled restart job");
});
t("journalctl фильтрует по службе и уровню", () => {
  const S = M({units: {"web.service": {exec: "/usr/sbin/web", port: 80}}});
  jlog(S, "web.service", 3, "что-то сломалось");
  jlog(S, "web.service", 6, "обычная строка");
  has(outOf(S, "journalctl -u web -p err"), "что-то сломалось");
  nothas(outOf(S, "journalctl -u web -p err"), "обычная строка");
});

/* ── пакеты ──────────────────────────────────────────── */
t("apt install без sudo отказывает, с sudo ставит и поднимает службу", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}});
  has(errOf(S, "apt install nginx"), "are you root");
  outOf(S, "sudo apt update");
  outOf(S, "sudo apt install nginx");
  has(outOf(S, "dpkg -l nginx"), "nginx");
  eq(outOf(S, "systemctl is-active nginx"), ["active"]);
  has(outOf(S, "ss -tulpn"), ":80");
});
t("неизвестный пакет: понятный отказ", () => {
  const S = M();
  has(errOf(S, "apt install nqinx"), "Unable to locate package");
});
t("apt remove оставляет настройки, purge убирает", () => {
  const S = M();
  outOf(S, "apt update"); outOf(S, "apt install nginx");
  has(outOf(S, "cat /etc/nginx/nginx.conf"), "worker_processes");
  outOf(S, "apt remove nginx");
  has(outOf(S, "cat /etc/nginx/nginx.conf"), "worker_processes");
  S.pkgs.nginx = "1.18.0";
  outOf(S, "apt purge nginx");
  has(errOf(S, "cat /etc/nginx/nginx.conf"), "No such file");
});
t("apt upgrade без update ничего не обновляет", () => {
  const S = M({upgradable: ["curl"], pkgs: {curl: "7.81.0-1"}});
  has(outOf(S, "apt upgrade"), "не обновлялся");
  outOf(S, "apt update");
  has(outOf(S, "apt upgrade"), "curl");
});
t("команда не найдена подсказывает пакет", () => {
  const S = M();
  const r = run(S, "htop");
  has(r.err, "command not found");
  has(r.hint, "apt install htop");
});

/* ── сеть и экран ────────────────────────────────────── */
t("ip a и ip r показывают адрес и шлюз", () => {
  const S = M();
  has(outOf(S, "ip a"), "10.0.2.15/24");
  has(outOf(S, "ip r"), "default via 10.0.2.2");
});
t("netplan с постоянным адресом применяется", () => {
  const S = M();
  writeFile(S, "/etc/netplan/00-installer-config.yaml", [
    "network:", "  version: 2", "  ethernets:", "    ens3:",
    "      dhcp4: false", "      addresses: [192.168.10.5/24]", "      gateway4: 192.168.10.1", ""].join("\n"));
  outOf(S, "netplan apply");
  has(outOf(S, "ip a"), "192.168.10.5/24");
  has(outOf(S, "ip r"), "default via 192.168.10.1");
});
t("netplan c ошибкой в отступах называет причину", () => {
  const S = M();
  writeFile(S, "/etc/netplan/00-installer-config.yaml", "network:\n  version: 2\n");
  has(errOf(S, "netplan apply"), "ethernets");
});
t("ss показывает, кто слушает порт", () => {
  const S = M();
  has(outOf(S, "ss -tulpn"), ":22");
  has(outOf(S, "ss -tulpn"), "ssh");
});
t("ufw enable без правила на 22 предупреждает", () => {
  const S = M();
  has(outOf(S, "ufw enable"), "порта 22");
  eq(S.lockedOut, true);
  outOf(S, "ufw allow OpenSSH");
  eq(S.lockedOut, false);
  has(outOf(S, "ufw status"), "ALLOW");
});
t("закрытый порт даёт таймаут при подключении", () => {
  const S = M();
  outOf(S, "ufw allow 80");
  outOf(S, "ufw enable");
  has(errOf(S, "ssh ubuntu@web-01"), "Connection timed out");
});
t("ufw без sudo отказывает", () => {
  const S = M({as: "ubuntu", users: {ubuntu: {uid: 1000, groups: ["sudo"]}}});
  has(errOf(S, "ufw enable"), "root");
});

/* ── доступ по ssh ───────────────────────────────────── */
t("PermitRootLogin no запрещает вход root", () => {
  const S = M();
  writeFile(S, "/etc/ssh/sshd_config", "Port 22\nPermitRootLogin no\n");
  has(errOf(S, "ssh root@web-01"), "Permission denied");
});
t("ssh-copy-id кладёт ключ с правильными правами", () => {
  const S = M({users: {deploy: {uid: 1000}}});
  outOf(S, "ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519");
  outOf(S, "ssh-copy-id -i /root/.ssh/id_ed25519.pub deploy@web-01");
  has(outOf(S, "ls -l /home/deploy/.ssh/authorized_keys"), "-rw-------");
  has(outOf(S, "ssh deploy@web-01"), "Welcome to Ubuntu");
});
t("слишком открытые права на ключ — sshd его не берёт", () => {
  const S = M({users: {deploy: {uid: 1000}}});
  outOf(S, "ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519");
  outOf(S, "ssh-copy-id -i /root/.ssh/id_ed25519.pub deploy@web-01");
  outOf(S, "chmod 644 /home/deploy/.ssh/authorized_keys");
  has(errOf(S, "ssh deploy@web-01"), "bad ownership or modes");
});
t("остановленная служба ssh — отказ в соединении", () => {
  const S = M();
  outOf(S, "systemctl stop ssh");
  has(errOf(S, "ssh root@web-01"), "Connection refused");
});

/* ── расписание и диски ──────────────────────────────── */
t("crontab проверяет число полей", () => {
  const S = M();
  writeFile(S, "/root/cron.txt", "0 3 * * * /usr/local/bin/backup.sh\n");
  outOf(S, "crontab /root/cron.txt");
  has(outOf(S, "crontab -l"), "backup.sh");
  writeFile(S, "/root/plohoy.txt", "0 3 * /usr/local/bin/backup.sh\n");
  has(errOf(S, "crontab /root/plohoy.txt"), "errors in crontab");
});
t("df и du отвечают на разные вопросы", () => {
  const S = M();
  has(outOf(S, "df -h"), "/dev/sda1");
  run(S, "mkdir -p /srv/data"); run(S, "echo много > /srv/data/f");
  has(outOf(S, "du -sh /srv/data"), "/srv/data");
});
t("mount -a разбирает fstab и жалуется на неизвестное устройство", () => {
  const S = M({disks: [{name: "sdb", size: "50G", type: "disk", uuid: "aaaa-bbbb", fstype: "ext4", blocks: 52428800}]});
  writeFile(S, "/etc/fstab", "UUID=aaaa-bbbb /srv/data ext4 defaults 0 2\n");
  outOf(S, "mount -a");
  has(outOf(S, "df -h"), "/srv/data");
  writeFile(S, "/etc/fstab", "UUID=net-takogo /srv/other ext4 defaults 0 2\n");
  has(errOf(S, "mount -a"), "can't find");
});
t("find по имени и по правам", () => {
  const S = M();
  run(S, "mkdir -p /srv/a/b"); run(S, "touch /srv/a/x.conf /srv/a/b/y.conf /srv/a/z.txt");
  const o = outOf(S, "find /srv -name *.conf");
  has(o, "/srv/a/x.conf"); has(o, "/srv/a/b/y.conf"); nothas(o, "z.txt");
  run(S, "chmod 777 /srv/a/z.txt");
  has(outOf(S, "find /srv -perm 777"), "z.txt");
});
t("grep -r ищет по дереву", () => {
  const S = M();
  run(S, "mkdir -p /srv/c"); run(S, "echo listen 8080 > /srv/c/app.conf");
  has(outOf(S, "grep -r 8080 /srv"), "app.conf");
});
t("mkfs создаёт файловую систему и UUID", () => {
  const S = M({disks: [{name: "sdb", size: "50G", type: "disk", blocks: 52428800}]});
  const before = outOf(S, "blkid");
  outOf(S, "mkfs.ext4 /dev/sdb");
  const after = outOf(S, "blkid");
  if(after.length <= before.length) throw new Error("UUID не появился");
  has(after, "TYPE=\"ext4\"");
});
t("подключённый раздел форматировать нельзя", () => {
  const S = M();
  has(errOf(S, "mkfs.ext4 /dev/sda1"), "is mounted");
});

console.log("");
for(const f of fails) console.log("  ✗ " + f);
console.log("итог: " + pass + " пройдено, " + failn + " провалено");
if(failn) process.exit(1);
