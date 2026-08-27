/* Эталонные решения. Шаг — строка команды либо объект:
     {file, text}          — правка файла машины (/etc/hosts)
     {cmd, expectErr:true} — команда, отказ которой и есть предмет урока */
const SOL = {

"1a": [
  "curl -v https://api.example.com/health",
  "dig api.example.com",
  "nc -zv api.example.com 443"
],

"1b": [
  "curl -v https://api.example.com/health",
  "dig api.example.com",
  "nc -zv api.example.com 443",
  "verdict tls"
],

"2a": [
  "curl https://www.example.com/",
  "dig www.example.com",
  "dig lb-old.example.com",
  "verdict dns"
],

"2b": [
  "curl --connect-timeout 2 https://api.example.com/health",
  "curl --resolve api.example.com:443:203.0.113.20 https://api.example.com/health",
  {file: "/etc/hosts", text: "# IP-адрес\tимя\n127.0.0.1\tlocalhost\n203.0.113.20\tapi.example.com\n"},
  "curl https://api.example.com/health"
],

"3a": [
  "nc -zv api.example.com 443",
  "nc -zv -w 2 db.example.com 5432",
  "verdict tcp"
],

"3b": [
  "ping api.example.com",
  "nc -zv api.example.com 443",
  "curl http://api.example.com/health",
  "verdict tcp"
],

"4a": [
  "curl -v https://expired.example.com/health",
  "curl -v https://wrongname.example.com/health",
  "curl -v https://internal.example.com/health",
  "curl -k https://internal.example.com/health",
  "verdict tls"
],

"4b": [
  "curl https://api.example.com/health",
  "dig api.example.com",
  "openssl s_client -connect api.example.com:443",
  "curl --resolve api.example.com:443:203.0.113.20 https://api.example.com/health",
  "verdict dns"
],

"5a": [
  "curl -I https://api.example.com/orders",
  'curl -I -H "Authorization: Bearer wrong" https://api.example.com/orders',
  'curl -I -H "Authorization: Bearer good" https://api.example.com/orders',
  'curl -I -X DELETE -H "Authorization: Bearer good" https://api.example.com/orders',
  "curl -I https://api.example.com/nope",
  "verdict http"
],

"5b": [
  `curl -i -d '{"item":7}' https://api.example.com/orders`,
  `curl -i -H "Content-Type: application/json" -d '{"item":7}' https://api.example.com/orders`
],

"6a": [
  "curl -i https://api.example.com/orders",
  "curl -v https://api.example.com/orders",
  'curl -v -H "Authorization: Bearer good" -H "Accept: application/json" https://api.example.com/orders'
],

"6b": [
  "curl http://api.example.com/health",
  "curl http://203.0.113.10/health",
  "curl --resolve api.example.com:80:203.0.113.10 http://api.example.com/health"
],

"7a": [
  "curl -I https://api.example.com/old",
  "curl -L https://api.example.com/old",
  "curl -L https://api.example.com/loop"
],

"7b": [
  "curl -I https://api.example.com/catalog",
  `curl -I -H 'If-None-Match: "v7"' https://api.example.com/catalog`
],

"8a": [
  "curl -I https://shop.example.com/",
  "nc -zv -w 2 app-1.internal 8080",
  "verdict proxy"
],

"8b": [
  "env",
  "curl -v http://api.example.com/health",
  'curl --noproxy "*" http://api.example.com/health',
  "verdict proxy"
],

"9a": [
  "curl https://api.example.com/orders",
  "browser https://api.example.com/orders",
  "verdict cors"
],

"9b": [
  "browser https://api.example.com/orders",
  'browser -H "X-Request-Id: 42" https://api.example.com/orders',
  "verdict cors"
],

"10a": [
  `curl -v -X POST -H "Content-Type: application/json" -H "Authorization: Bearer good" -d '{"item":7}' https://api.example.com/orders`
],

"10b": [
  "curl --resolve api.example.com:443:10.0.1.5 https://api.example.com/health",
  "curl -i --resolve api.example.com:443:10.0.1.6 https://api.example.com/health",
  "verdict http"
],

"11a": [
  "curl -v https://internal.example.com/health",
  "curl -k https://internal.example.com/health",
  "openssl s_client -connect internal.example.com:443",
  "verdict tls"
],

"11b": [
  "curl --max-time 2 https://api.example.com/report",
  'curl -v -w "%{time_total}" https://api.example.com/report',
  "verdict timeout"
],

"12a": [
  "dig shop.example.com",
  "nc -zv -w 2 shop.example.com 443",
  "curl -v --connect-timeout 2 https://shop.example.com/",
  "verdict tcp"
],

"12b": [
  "curl -v --connect-timeout 2 https://api.example.com/health",
  "curl -v --resolve api.example.com:443:203.0.113.60 https://api.example.com/health",
  "openssl s_client -connect api.example.com:443 -servername api.example.com",
  "verdict tls"
]

};
