<script>
"use strict";
/* ============================================================
   Модель сети: имена, узлы, порты, сертификаты
   ============================================================ */
class NetErr extends Error {
  constructor(msg, hint){ super(msg); this.hint = hint || ""; }
}
const nerr = (m, h) => { throw new NetErr(m, h); };

function newNet(opts){
  opts = opts || {};
  const N = {
    now: 0,
    dns: {},          /* имя → [{type, value, ttl}] */
    hostsFile: {},    /* имя → адрес; сильнее DNS */
    nodes: {},        /* адрес → {name, ports:{порт: {server, tls}}, drop:[порты], down:false} */
    servers: {},      /* имя сервера → {routes, slow, requires} */
    certs: {},        /* имя → {cn, san, notAfter, issuer, selfSigned} */
    proxyEnv: null,   /* адрес прокси из окружения */
    origin: opts.origin || "https://app.example.com",
    resolver: opts.resolver || "10.0.0.53",
    latency: opts.latency || {},   /* адрес → мс */
    log: []
  };
  for(const k in (opts.dns || {})) N.dns[k] = [].concat(opts.dns[k]);
  Object.assign(N.hostsFile, opts.hostsFile || {});
  for(const ip in (opts.nodes || {})) N.nodes[ip] = Object.assign({ports:{}, drop:[], down:false}, opts.nodes[ip]);
  for(const s in (opts.servers || {})) N.servers[s] = opts.servers[s];
  for(const h in (opts.certs || {})) N.certs[h] = opts.certs[h];
  if(opts.proxyEnv) N.proxyEnv = opts.proxyEnv;
  return N;
}

/* ── разрешение имени ──────────────────────────────────── */
/* Возвращает {ip, chain:[шаги], source} либо {error} */
function resolve(N, name, opts){
  opts = opts || {};
  const chain = [];
  if(opts.override && opts.override[name]){
    return {ip: opts.override[name], chain: [name + " → " + opts.override[name] + " (--resolve)"], source: "--resolve"};
  }
  if(N.hostsFile[name]){
    return {ip: N.hostsFile[name], chain: [name + " → " + N.hostsFile[name] + " (/etc/hosts)"], source: "/etc/hosts"};
  }
  if(/^\d+\.\d+\.\d+\.\d+$/.test(name)) return {ip: name, chain: [name + " — уже адрес"], source: "literal"};

  let cur = name;
  for(let hop = 0; hop < 6; hop++){
    const rr = N.dns[cur];
    if(!rr || !rr.length)
      return {error: "NXDOMAIN", name: cur,
              msg: "Could not resolve host: " + name,
              hint: cur === name ? "Записи для этого имени нет. Проверьте «dig " + name + "» и опечатки."
                                 : "Цепочка CNAME ведёт к имени «" + cur + "», которого нет в DNS."};
    const cn = rr.filter(r => r.type === "CNAME")[0];
    if(cn){ chain.push(cur + " CNAME " + cn.value); cur = cn.value; continue; }
    const a = rr.filter(r => r.type === "A");
    if(!a.length)
      return {error: "NOANSWER", name: cur, msg: "Could not resolve host: " + name,
              hint: "Для имени есть записи, но нет ни одной A — обращаться некуда."};
    chain.push(cur + " A " + a[0].value + " (ttl " + (a[0].ttl || 300) + ")");
    return {ip: a[0].value, chain, source: "dns", all: a.map(x => x.value)};
  }
  return {error: "LOOP", msg: "Could not resolve host: " + name,
          hint: "Цепочка CNAME зациклилась."};
}

/* ── соединение ────────────────────────────────────────── */
/* {ok, ms} либо {error: refused|timeout|unreach} */
function connect(N, ip, port, timeoutS){
  const node = N.nodes[ip];
  const lat = N.latency[ip] || 20;
  if(!node) return {error: "unreach", ms: (timeoutS || 30) * 1000,
    msg: "Failed to connect to " + ip + " port " + port + ": No route to host",
    hint: "Адрес не отвечает вовсе: имя разрешилось не туда либо узла нет."};
  if(node.down) return {error: "timeout", ms: (timeoutS || 30) * 1000,
    msg: "Failed to connect to " + ip + " port " + port + ": Connection timed out",
    hint: "Узел не отвечает. Так выглядит выключенная машина или потерянные пакеты."};
  if((node.drop || []).indexOf(port) >= 0) return {error: "timeout", ms: (timeoutS || 30) * 1000,
    msg: "Failed to connect to " + ip + " port " + port + ": Connection timed out",
    hint: "Пакеты молча отбрасываются — так ведёт себя межсетевой экран с политикой DROP. Отличие от «отказано в соединении» в том, что ответа нет вовсе."};
  if(!node.ports[port]) return {error: "refused", ms: lat,
    msg: "Failed to connect to " + ip + " port " + port + ": Connection refused",
    hint: "Узел ответил отказом: на этом порту никто не слушает. Значит, машина жива, а служба не запущена или слушает другой порт."};
  return {ok: true, ms: lat, listener: node.ports[port]};
}

/* ── TLS ───────────────────────────────────────────────── */
function tlsHandshake(N, ip, port, hostname, opts){
  opts = opts || {};
  const node = N.nodes[ip];
  const listener = node.ports[port];
  if(!listener.tls) return {error: "notls",
    msg: "error:0A00010B:SSL routines::wrong version number",
    hint: "На этом порту обычный HTTP, а обратились по https. Порт 80 — без шифрования, 443 — с ним."};
  /* сервер выбирает сертификат по имени из SNI */
  const certName = listener.certOf ? listener.certOf(hostname) : listener.cert;
  const cert = N.certs[certName] || N.certs[hostname];
  if(!cert) return {error: "nocert", msg: "SSL certificate problem: unable to get local issuer certificate",
    hint: "Сервер не отдал сертификата для этого имени."};

  const names = [].concat(cert.cn || [], cert.san || []);
  const matches = names.some(n => n === hostname ||
    (String(n).indexOf("*.") === 0 && hostname.split(".").slice(1).join(".") === String(n).slice(2)));
  if(!matches && !opts.insecure) return {error: "hostname", cert,
    msg: "SSL: no alternative certificate subject name matches target host name '" + hostname + "'",
    hint: "Сертификат выдан на другое имя (" + names.join(", ") + "). Обычно это означает, что вы попали не на тот сервер, либо на сервере не настроен SNI."};
  if(cert.notAfter !== undefined && cert.notAfter < N.now && !opts.insecure) return {error: "expired", cert,
    msg: "SSL certificate problem: certificate has expired",
    hint: "Срок действия истёк. Проверьте дату на своей машине тоже: расхождение часов даёт ту же ошибку."};
  if(cert.selfSigned && !opts.insecure) return {error: "untrusted", cert,
    msg: "SSL certificate problem: self-signed certificate",
    hint: "Издатель неизвестен. Такое бывает на внутренних стендах: либо добавляют корневой сертификат в доверенные, либо (только для отладки) идут с ключом -k."};
  return {ok: true, cert, ms: 40};
}
const certLines = (cert, hostname) => [
  "*  subject: CN=" + (cert.cn || hostname),
  "*  start date: " + (cert.notBefore || "2026-01-01"),
  "*  expire date: " + (cert.notAfterText || "2027-01-01"),
  "*  subjectAltName: " + [].concat(cert.san || cert.cn || hostname).join(", "),
  "*  issuer: " + (cert.issuer || (cert.selfSigned ? "самоподписанный" : "Example Root CA"))
];
