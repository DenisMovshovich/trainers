/* Эталонные решения. Шаг — строка команды либо объект:
     {file, text}          — правка файла машины напрямую (как через вкладку «Файл»)
     {cmd, expectErr:true} — команда, отказ которой и есть предмет урока */
const SOL = {

"1a": [
  "id",
  "hostnamectl",
  "df -h",
  "mkdir /home/ubuntu/otchet",
  "hostnamectl > /home/ubuntu/otchet/machine.txt",
  "cat /home/ubuntu/otchet/machine.txt"
],

"1b": [
  "ls -l /root/prishlo",
  "mv /root/prishlo/svodka.log /var/log/",
  "mv /root/prishlo/app.conf /etc/",
  "mv /root/prishlo/obsluga.sh /usr/local/bin/",
  "chmod +x /usr/local/bin/obsluga.sh",
  "/usr/local/bin/obsluga.sh"
],

"2a": [
  "sudo ls -l /var/www/html",
  "sudo chown deploy:www-data /var/www/html/index.html",
  "sudo chown deploy:www-data /var/www/html/style.css",
  "sudo chown deploy:www-data /var/www/html",
  "sudo chmod 640 /var/www/html/index.html",
  "sudo chmod 640 /var/www/html/style.css",
  "sudo chmod 750 /var/www/html",
  "sudo ls -l /var/www/html"
],

"2b": [
  "sudo groupadd razrabotchiki",
  "sudo mkdir -p /srv/obshee",
  "sudo chown root:razrabotchiki /srv/obshee",
  "sudo chmod 3770 /srv/obshee",
  "ls -ld /srv/obshee"
],

"3a": [
  "sudo adduser marina",
  "sudo usermod -aG sudo marina",
  "id marina",
  "sudo useradd -s /usr/sbin/nologin prilozhenie",
  "grep prilozhenie /etc/passwd"
],

"3b": [
  "echo 'ci ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart myapp' | sudo tee /etc/sudoers.d/ci",
  "sudo chmod 0440 /etc/sudoers.d/ci",
  "ls -l /etc/sudoers.d/ci",
  "sudo systemctl restart myapp",
  "systemctl is-active myapp"
],

"4a": [
  {cmd: "sudo apt install nginx", expectErr: true},
  "sudo apt update",
  "sudo apt install nginx",
  "systemctl status nginx",
  "sudo ss -tulpn",
  "dpkg -S /etc/nginx/nginx.conf"
],

"4b": [
  "cat /etc/nginx/nginx.conf",
  "sudo apt update",
  "sudo apt purge nginx",
  "sudo apt install nginx",
  "cat /etc/nginx/nginx.conf",
  "systemctl is-active nginx"
],

"5a": [
  "sudo useradd -s /usr/sbin/nologin svodka",
  {file: "/etc/systemd/system/svodka.service", text:
    "[Unit]\nDescription=Сводка\nAfter=network.target\n\n[Service]\nUser=svodka\nExecStart=/usr/local/bin/svodka\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n"},
  "sudo systemctl daemon-reload",
  "sudo systemctl enable --now svodka",
  "systemctl is-active svodka",
  "systemctl is-enabled svodka"
],

"5b": [
  "systemctl status api",
  {cmd: "sudo systemctl start api", expectErr: true},
  "journalctl -u api",
  "sudo ss -tulpn",
  "sudo systemctl stop staryj-api",
  "sudo systemctl disable staryj-api",
  "sudo systemctl start api",
  "systemctl is-active api"
],

"6a": [
  "systemctl list-units --failed",
  "journalctl -u api",
  "cat /etc/api/api.conf",
  "sudo mkdir -p /srv/api/data",
  "sudo systemctl start api",
  "systemctl is-active api"
],

"6b": [
  "grep 'Failed password' /var/log/auth.log",
  "grep 'Failed password' /var/log/auth.log | wc -l > /root/otchet-neudach.txt",
  "grep sudo /var/log/auth.log > /root/sudo.txt",
  "cat /root/otchet-neudach.txt",
  "cat /root/sudo.txt"
],

"7a": [
  "df -h",
  "free -h",
  "top",
  "ps aux",
  "sudo systemctl stop schet",
  "sudo systemctl disable schet",
  "systemctl is-active schet"
],

"7b": [
  "journalctl -u tyazhelyj",
  "dmesg",
  "dmesg | grep -i memory > /home/ubuntu/prichina.txt",
  "cat /home/ubuntu/prichina.txt",
  "sudo systemctl start tyazhelyj",
  "systemctl is-active tyazhelyj"
],

"8a": [
  "df -h",
  "df -i",
  "du -sh /var/log",
  "sudo truncate -s 0 /var/log/prilozhenie.log",
  "echo /var/log/prilozhenie.log > /home/ubuntu/najdeno.txt",
  "ls -l /var/log/prilozhenie.log"
],

"8b": [
  "lsblk",
  "sudo blkid",
  "sudo mkdir -p /srv/data",
  "echo 'UUID=9f8e7d6c-0002-4b2c-8d3e-000000000002 /srv/data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab",
  "sudo mount -a",
  "df -h"
],

"9a": [
  "ip a",
  "ip r",
  {file: "/etc/netplan/00-installer-config.yaml", text:
    "network:\n  version: 2\n  ethernets:\n    ens3:\n      dhcp4: false\n      addresses: [192.168.10.5/24]\n      gateway4: 192.168.10.1\n"},
  "sudo netplan apply",
  "ip a",
  "ip r"
],

"9b": [
  "sudo ss -tulpn",
  "cat /etc/vnutri/vnutri.conf",
  "sudo sed -i 's/bind = 127.0.0.1/bind = 0.0.0.0/' /etc/vnutri/vnutri.conf",
  "sudo systemctl restart vnutri",
  "sudo ss -tulpn"
],

"10a": [
  "ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519",
  "ssh-copy-id -i /root/.ssh/id_ed25519.pub marina@web-01",
  "ls -l /home/marina/.ssh",
  "ssh marina@web-01",
  "sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config",
  "systemctl restart ssh"
],

"10b": [
  {cmd: "ssh deploy@web-01", expectErr: true},
  "ls -ld /home/deploy/.ssh",
  "chmod 700 /home/deploy/.ssh",
  "chmod 600 /home/deploy/.ssh/authorized_keys",
  "chown -R deploy:deploy /home/deploy/.ssh",
  "ssh deploy@web-01",
  "sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config"
],

"11a": [
  "sudo ss -tulpn",
  "sudo ufw allow OpenSSH",
  "sudo ufw allow 80",
  "sudo ufw allow from 10.0.0.0/8 to any port 5432",
  "sudo ufw enable",
  "sudo ufw status numbered",
  "ssh ubuntu@web-01"
],

"11b": [
  "sudo ufw status numbered",
  "sudo ufw delete 3",
  "sudo ufw allow from 10.0.0.0/8 to any port 5432",
  "sudo apt install unattended-upgrades",
  "sudo ufw status numbered"
],

"12a": [
  "mkdir -p /srv/backup",
  {file: "/usr/local/bin/backup.sh", text:
    "#!/bin/bash\ntar -czf /srv/backup/data.tar.gz /var/lib/prilozhenie\n"},
  "chmod +x /usr/local/bin/backup.sh",
  "/usr/local/bin/backup.sh",
  "ls -l /srv/backup",
  {file: "/root/cron.txt", text:
    "0 3 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1\n"},
  "crontab /root/cron.txt",
  "crontab -l"
],

"12b": [
  "systemctl list-units --failed",
  "sudo systemctl start otchety",
  "sudo ss -tulpn",
  "sudo ufw status numbered",
  "sudo ufw delete 3",
  "sudo crontab -l",
  "sudo crontab -l > /home/ubuntu/rasporyadok.txt",
  "df -h",
  "free -h"
]

};
