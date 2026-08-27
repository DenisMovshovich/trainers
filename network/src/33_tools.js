
/* ============================================================
   Остальные инструменты
   ============================================================ */
function cmdDig(N, a){
  const name = a.args[0];
  if(!name) nerr("dig: укажите имя", "Например: dig api.example.com");
  const want = (a.args[1] || "A").toUpperCase();
  const out = ["; <<>> DiG 9.18 <<>> " + name + (want !== "A" ? " " + want : ""),
               ";; QUESTION SECTION:", ";" + name + ".\t\tIN\t" + want, ""];
  const rr = N.dns[name];
  if(!rr || !rr.length){
    out.push(";; ->>HEADER<<- status: NXDOMAIN");
    out.push(";; ANSWER SECTION: (пусто)");
    out.push("");
    out.push(";; SERVER: " + N.resolver + "#53");
    return {out, warn: true};
  }
  out.push(";; ANSWER SECTION:");
  const seen = [];
  let cur = name;
  for(let i = 0; i < 6; i++){
    const list = N.dns[cur] || [];
    for(const r of list) out.push(cur + ".\t" + (r.ttl || 300) + "\tIN\t" + r.type + "\t" + r.value);
    const cn = list.filter(r => r.type === "CNAME")[0];
    if(!cn || seen.indexOf(cn.value) >= 0) break;
    seen.push(cn.value); cur = cn.value;
  }
  out.push("");
  out.push(";; SERVER: " + N.resolver + "#53");
  if(a.flags.short || a.opts["+short"]) return {out: out.filter(l => /\tIN\t/.test(l)).map(l => l.split("\t").pop())};
  return {out};
}

function cmdPing(N, a){
  const host = a.args[0];
  if(!host) nerr("ping: укажите узел");
  const r = resolve(N, host, {});
  if(r.error) return {out: ["ping: " + r.msg], err2: r.hint, warn: true};
  const node = N.nodes[r.ip];
  const out = ["PING " + host + " (" + r.ip + ") 56(84) bytes of data."];
  if(!node || node.down || node.noIcmp){
    out.push("");
    out.push("--- " + host + " ping statistics ---");
    out.push("4 packets transmitted, 0 received, 100% packet loss");
    out.push("");
    out.push("Ответов нет. Это ещё не значит, что узел недоступен: ICMP часто закрыт,");
    out.push("а служба при этом отвечает. Проверять доступность порта надо через nc.");
    return {out, warn: true};
  }
  const lat = N.latency[r.ip] || 20;
  for(let i = 1; i <= 4; i++)
    out.push("64 bytes from " + r.ip + ": icmp_seq=" + i + " ttl=56 time=" + (lat + i * 0.3).toFixed(1) + " ms");
  out.push("");
  out.push("--- " + host + " ping statistics ---");
  out.push("4 packets transmitted, 4 received, 0% packet loss");
  return {out};
}

function cmdNc(N, a){
  const host = a.args[0], port = parseInt(a.args[1], 10);
  if(!host || !port) nerr("nc: укажите узел и порт", "Например: nc -zv api.example.com 443");
  const r = resolve(N, host, {});
  if(r.error) return {out: ["nc: " + r.msg], err2: r.hint, warn: true};
  const c = connect(N, r.ip, port, a.opts.w ? +a.opts.w : 5);
  if(c.error) return {out: ["nc: connect to " + host + " (" + r.ip + ") port " + port +
    " failed: " + (c.error === "refused" ? "Connection refused" : "Connection timed out")],
    err2: c.hint, warn: true};
  return {out: ["Connection to " + host + " (" + r.ip + ") " + port + " port [tcp/*] succeeded!"]};
}

function cmdOpenssl(N, a){
  if(a.args[0] !== "s_client") nerr("поддерживается только openssl s_client",
    "Например: openssl s_client -connect api.example.com:443");
  const target = a.opts.connect;
  if(!target) nerr("укажите -connect имя:порт");
  const [host, portRaw] = String(target).split(":");
  const port = parseInt(portRaw || "443", 10);
  const sni = a.opts.servername || host;
  const r = resolve(N, host, {});
  if(r.error) return {out: ["connect: " + r.msg], err2: r.hint, warn: true};
  const c = connect(N, r.ip, port, 5);
  if(c.error) return {out: ["connect: " + c.msg], err2: c.hint, warn: true};
  const t = tlsHandshake(N, r.ip, port, sni, {insecure: true});
  if(t.error && t.error === "notls")
    return {out: ["CONNECTED(00000003)", t.msg], err2: t.hint, warn: true};
  const cert = t.cert || {};
  const out = ["CONNECTED(00000003)", "SNI: " + sni, "---",
    "Certificate chain",
    " 0 s:CN=" + (cert.cn || host),
    "   i:" + (cert.issuer || (cert.selfSigned ? "CN=" + (cert.cn || host) + " (самоподписанный)" : "C=RU, O=Example, CN=Example Root CA")),
    "---",
    "subjectAltName: " + [].concat(cert.san || cert.cn || host).join(", "),
    "notAfter: " + (cert.notAfterText || "Jan  1 00:00:00 2027 GMT"),
    "---"];
  const check = tlsHandshake(N, r.ip, port, sni, {});
  out.push(check.error
    ? "Verify return code: 21 (unable to verify the first certificate) — " + check.msg
    : "Verify return code: 0 (ok)");
  return {out, warn: !!check.error};
}

/* ── браузер: то же соединение плюс правила источника ──── */
function cmdBrowser(N, a){
  const url = a.args[0];
  if(!url) nerr("browser: укажите адрес", "Например: browser https://api.example.com/orders");
  const u = parseUrl(url);
  const origin = N.origin;
  const method = (a.opts.X || a.opts.request || "GET").toUpperCase();
  const headers = {};
  for(const h of [].concat(a.opts.H || a.opts.header || [])){
    const i = String(h).indexOf(":");
    if(i >= 0) headers[String(h).slice(0, i).trim()] = String(h).slice(i + 1).trim();
  }
  const creds = !!(a.flags.credentials || a.flags.withCredentials);
  const out = ["Страница: " + origin, "Запрос:  " + method + " " + u.url];
  const sameOrigin = parseUrl(origin).host === u.host && parseUrl(origin).scheme === u.scheme;
  if(sameOrigin){
    const r = request(N, url, {method, headers, follow: true});
    if(r.err){ out.push("net::ERR — " + r.err.msg); return {out, err2: r.err.hint, warn: true}; }
    out.push("Источник тот же — правила CORS не применяются.");
    out.push("< " + r.res.status + " " + (STATUS[r.res.status] || ""));
    if(r.res.body) out.push(String(r.res.body));
    return {out};
  }
  out.push("Источник другой — включаются правила CORS.");

  if(needsPreflight(method, headers)){
    out.push("");
    out.push("1) Предварительный запрос:");
    const pre = request(N, url, {method: "OPTIONS", headers: {
      "Origin": origin, "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": Object.keys(headers).join(", ")}});
    if(pre.err){ out.push("   net::ERR — " + pre.err.msg); return {out, err2: pre.err.hint, warn: true}; }
    out.push("   < " + pre.res.status + " " + (STATUS[pre.res.status] || ""));
    for(const k in pre.res.headers) if(/^access-control/i.test(k)) out.push("   < " + k + ": " + pre.res.headers[k]);
    const c1 = corsCheck(pre.res, origin, method, headers, creds);
    const c2 = c1.blocked ? c1 : preflightCheck(pre.res, method, headers);
    if(c2.blocked){
      out.push("");
      out.push("ЗАБЛОКИРОВАНО браузером: " + c2.why);
      out.push("Консоль: " + c2.console);
      out.push("");
      out.push("Обратите внимание: curl тот же запрос выполнит без единого возражения —");
      out.push("правила CORS соблюдает браузер, а не сервер.");
      return {out, warn: true, cors: true};
    }
    out.push("   предварительный запрос разрешён");
    out.push("");
    out.push("2) Основной запрос:");
  }
  const r = request(N, url, {method, headers: Object.assign({Origin: origin}, headers), follow: true});
  if(r.err){ out.push("net::ERR — " + r.err.msg); return {out, err2: r.err.hint, warn: true}; }
  out.push("   < " + r.res.status + " " + (STATUS[r.res.status] || ""));
  const acao = hdr(r.res.headers, "access-control-allow-origin");
  if(acao !== undefined) out.push("   < access-control-allow-origin: " + acao);
  const c = corsCheck(r.res, origin, method, headers, creds);
  if(c.blocked){
    out.push("");
    out.push("ЗАБЛОКИРОВАНО браузером: " + c.why);
    out.push("Консоль: " + c.console);
    out.push("");
    out.push("Сам ответ сервер прислал — браузер просто не отдал его коду страницы.");
    return {out, warn: true, cors: true};
  }
  if(r.res.body) out.push("   " + String(r.res.body));
  return {out};
}

function cmdHosts(N, a){
  const out = ["127.0.0.1\tlocalhost"];
  for(const n in N.hostsFile) out.push(N.hostsFile[n] + "\t" + n);
  if(Object.keys(N.hostsFile).length === 0) out.push("# своих записей нет");
  return {out};
}
