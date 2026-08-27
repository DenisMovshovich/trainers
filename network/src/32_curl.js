
/* ============================================================
   curl: весь путь запроса по шагам
   ============================================================ */
/* Один обмен без учёта перенаправлений.
   Возвращает {v:[строки -v], res} либо {v, err:{code, msg, hint}} */
function exchange(N, u, o){
  const v = [];
  const timeout = o.maxTime === undefined ? 30 : o.maxTime;
  const ctimeout = o.connectTimeout === undefined ? timeout : o.connectTimeout;

  /* через прокси соединяются с прокси, а не с целевым узлом */
  const proxy = o.noProxy ? null : (o.proxy || N.proxyEnv);
  const connectHost = proxy ? parseUrl(proxy).host : u.host;
  const connectPort = proxy ? parseUrl(proxy).port : u.port;
  if(proxy) v.push("* Uses proxy env variable / -x → " + proxy);

  const r = resolve(N, connectHost, {override: o.resolveMap});
  if(r.error) return {v, err: {code: 6, msg: r.msg, hint: r.hint}};
  for(const step of r.chain) v.push("* Resolved " + step);
  v.push("*   Trying " + r.ip + ":" + connectPort + "...");

  const c = connect(N, r.ip, connectPort, ctimeout);
  if(c.error){
    const timedOut = c.error === "timeout" || c.error === "unreach";
    return {v, err: {code: timedOut ? 28 : 7, msg: c.msg, hint: c.hint,
                     ms: Math.min(c.ms, ctimeout * 1000)}};
  }
  v.push("* Connected to " + connectHost + " (" + r.ip + ") port " + connectPort);
  let ms = c.ms;

  if(u.scheme === "https" && !proxy){
    const t = tlsHandshake(N, r.ip, connectPort, u.host, {insecure: o.insecure});
    if(t.error) return {v, err: {code: t.error === "notls" ? 35 : 60, msg: t.msg, hint: t.hint,
                                 cert: t.cert, host: u.host}};
    v.push("* TLS handshake, SNI: " + u.host);
    v.push("* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384");
    for(const l of certLines(t.cert, u.host)) v.push(l);
    if(o.insecure) v.push("* WARNING: проверка сертификата отключена ключом -k");
    ms += t.ms;
  }

  /* запрос */
  const method = o.method || (o.data !== undefined ? "POST" : (o.head ? "HEAD" : "GET"));
  const headers = Object.assign({
    "Host": u.host,
    "User-Agent": o.agent || "curl/8.6.0",
    "Accept": "*/*"
  }, o.headers || {});
  if(o.data !== undefined){
    if(!hdr(headers, "content-type")) headers["Content-Type"] = "application/x-www-form-urlencoded";
    headers["Content-Length"] = String(o.data.length);
  }
  v.push("> " + method + " " + (proxy ? u.url : u.path) + " HTTP/1.1");
  for(const k in headers) v.push("> " + k + ": " + mask(k, headers[k]));
  v.push(">");

  const req = {method, path: u.path, headers, body: o.data, scheme: u.scheme, host: u.host};
  let res;
  if(proxy){
    const pnode = N.nodes[r.ip].ports[connectPort];
    res = viaProxy(N, pnode.server, req, u);
  } else {
    res = serve(N, serverFor(N.nodes[r.ip].ports[connectPort], u.host), req);
  }
  ms += res.ms;
  if(ms > timeout * 1000)
    return {v, err: {code: 28, msg: "Operation timed out after " + timeout * 1000 +
      " milliseconds with 0 bytes received",
      hint: "Сервер отвечает дольше, чем позволяет --max-time. Соединение установилось — значит, дело не в сети, а в самой обработке."},
      ms: timeout * 1000};

  v.push("< HTTP/1.1 " + res.status + " " + (STATUS[res.status] || ""));
  for(const k in res.headers) v.push("< " + k + ": " + res.headers[k]);
  v.push("<");
  return {v, res, ms, req, ip: r.ip};
}
/* На одном адресе может отвечать несколько сайтов — выбор по заголовку Host */
function serverFor(listener, host){
  if(listener.byHost && listener.byHost[host]) return listener.byHost[host];
  return listener.server;
}

/* значение заголовка авторизации в журнал не пишут целиком */
function mask(k, val){
  if(String(k).toLowerCase() !== "authorization") return val;
  const s = String(val), sp = s.indexOf(" ");
  return sp > 0 ? s.slice(0, sp + 1) + s.slice(sp + 1, sp + 4) + "…" : s.slice(0, 3) + "…";
}

/* Полный запрос с перенаправлениями */
function request(N, rawUrl, o){
  o = o || {};
  const out = [], hops = [];
  let u = parseUrl(rawUrl);
  let total = 0;
  for(let hop = 0; hop <= (o.follow ? 20 : 0); hop++){
    const r = exchange(N, u, o);
    for(const l of r.v) out.push(l);
    total += r.ms || 0;
    if(r.err) return {v: out, err: r.err, ms: total, hops};
    hops.push({url: u.url, status: r.res.status, location: r.res.headers.location});
    const loc = hdr(r.res.headers, "location");
    if(o.follow && r.res.status >= 300 && r.res.status < 400 && loc){
      if(hops.filter(h => h.url === absolute(u, loc)).length >= 2)
        return {v: out, err: {code: 47, msg: "Maximum (20) redirects followed",
          hint: "Перенаправления зациклились: адреса повторяются. Смотрите цепочку выше."},
          ms: total, hops, res: r.res};
      out.push("* Issue another request to this URL: '" + absolute(u, loc) + "'");
      u = parseUrl(absolute(u, loc));
      continue;
    }
    if(o.follow && hop === 20)
      return {v: out, err: {code: 47, msg: "Maximum (20) redirects followed"}, ms: total, hops, res: r.res};
    return {v: out, res: r.res, ms: total, hops, req: r.req, ip: r.ip};
  }
  return {v: out, err: {code: 47, msg: "Maximum (20) redirects followed"}, ms: total, hops};
}
function absolute(u, loc){
  if(/^https?:\/\//.test(loc)) return loc;
  if(loc[0] === "/") return u.scheme + "://" + u.host + (u.port !== 80 && u.port !== 443 ? ":" + u.port : "") + loc;
  return u.scheme + "://" + u.host + "/" + loc;
}

/* ── командная строка curl ─────────────────────────────── */
function cmdCurl(N, a){
  const url = a.args[0];
  if(!url) nerr("curl: try 'curl --help' for more information",
    "Нужен адрес: curl https://api.example.com/health");
  const o = {
    method: a.opts.X || a.opts.request,
    headers: {}, follow: !!(a.flags.L || a.flags.location),
    head: !!(a.flags.I || a.flags.head),
    insecure: !!(a.flags.k || a.flags.insecure),
    data: a.opts.d !== undefined ? a.opts.d : a.opts.data,
    proxy: a.opts.x || a.opts.proxy,
    noProxy: a.opts.noproxy !== undefined || a.flags.noproxy,
    maxTime: a.opts["max-time"] !== undefined ? +a.opts["max-time"] : undefined,
    connectTimeout: a.opts["connect-timeout"] !== undefined ? +a.opts["connect-timeout"] : undefined,
    resolveMap: {}
  };
  for(const h of [].concat(a.opts.H || a.opts.header || [])){
    const i = String(h).indexOf(":");
    if(i < 0) nerr("заголовок задают как «Имя: значение», а не «" + h + "»");
    o.headers[String(h).slice(0, i).trim()] = String(h).slice(i + 1).trim();
  }
  for(const rs of [].concat(a.opts.resolve || [])){
    const p = String(rs).split(":");
    if(p.length < 3) nerr("--resolve задают как имя:порт:адрес");
    o.resolveMap[p[0]] = p[2];
  }

  const r = request(N, url, o);
  const out = [];
  const verbose = a.flags.v || a.flags.verbose;
  if(verbose) for(const l of r.v) out.push(l);

  if(r.err){
    out.push("curl: (" + r.err.code + ") " + r.err.msg);
    return {out, err2: r.err.hint, code: r.err.code, warn: true};
  }
  const res = r.res;
  if(o.head || a.flags.i || a.flags.include){
    if(!verbose){
      out.push("HTTP/1.1 " + res.status + " " + (STATUS[res.status] || ""));
      for(const k in res.headers) out.push(k + ": " + res.headers[k]);
      out.push("");
    }
  }
  if(!o.head && res.body) for(const l of String(res.body).split("\n")) out.push(l);
  if(a.opts.w !== undefined || a.opts["write-out"] !== undefined){
    /* формат вывода, как у настоящего curl */
    const fmt = String(a.opts.w !== undefined ? a.opts.w : a.opts["write-out"]);
    out.push(fmt.replace(/%\{time_total\}/g, (r.ms / 1000).toFixed(3))
                .replace(/%\{http_code\}/g, String(res.status))
                .replace(/%\{time_connect\}/g, "0.020")
                .replace(/\\n/g, ""));
  }
  N.log.push({url, status: res.status, ms: r.ms});
  return {out, res, warn: res.status >= 400};
}
