
/* ============================================================
   HTTP: сервер, маршруты, перенаправления, прокси, CORS
   ============================================================ */
const STATUS = {
  200:"OK", 201:"Created", 204:"No Content", 301:"Moved Permanently", 302:"Found",
  304:"Not Modified", 307:"Temporary Redirect", 308:"Permanent Redirect",
  400:"Bad Request", 401:"Unauthorized", 403:"Forbidden", 404:"Not Found",
  405:"Method Not Allowed", 409:"Conflict", 413:"Payload Too Large",
  415:"Unsupported Media Type", 429:"Too Many Requests",
  500:"Internal Server Error", 502:"Bad Gateway", 503:"Service Unavailable", 504:"Gateway Timeout"
};

const lower = h => { const o = {}; for(const k in (h || {})) o[String(k).toLowerCase()] = h[k]; return o; };
const hdr = (h, k) => lower(h)[String(k).toLowerCase()];

/* Обслужить запрос сервером. Возвращает {status, headers, body, ms} */
function serve(N, srvName, req){
  const S = N.servers[srvName];
  if(!S) return {status: 502, headers: {}, body: "no upstream", ms: 5};
  /* сервер с upstream — это обратный прокси: он не обслуживает сам, а пересылает */
  if(S.upstream) return viaProxy(N, srvName, req, {scheme: req.scheme || "https", host: req.host || ""});
  const H = lower(req.headers);
  let ms = (S.slowMs || 0) + 10;

  if(S.down) return {status: 503, headers: {"content-type":"text/plain"}, body: "service unavailable", ms};

  const path = req.path.split("?")[0];
  let route = null;
  for(const r of (S.routes || [])){
    if(r.path === path){ route = r; break; }
    if(r.prefix && path.indexOf(r.prefix) === 0){ route = r; break; }
  }
  if(!route) return {status: 404, headers: {"content-type":"text/plain"}, body: "not found", ms};

  /* HEAD обслуживается везде, где разрешён GET, — только без тела */
  const effMethod = req.method === "HEAD" ? "GET" : req.method;
  if(route.methods && route.methods.indexOf(effMethod) < 0)
    return {status: 405, headers: {"content-type":"text/plain", "allow": route.methods.join(", ")},
            body: "method not allowed", ms};

  if(route.auth){
    const a = H["authorization"];
    if(!a) return {status: 401, headers: {"www-authenticate": "Bearer", "content-type":"text/plain"},
                   body: "unauthorized", ms};
    if(route.token && a !== "Bearer " + route.token)
      return {status: 403, headers: {"content-type":"text/plain"}, body: "forbidden", ms};
  }
  if(route.needsType && H["content-type"] !== route.needsType)
    return {status: 415, headers: {"content-type":"text/plain"},
            body: "ожидался content-type: " + route.needsType, ms};

  if(route.status >= 300 && route.status < 400)
    return {status: route.status, headers: {"location": route.location, "content-type":"text/html"},
            body: "", ms};

  const headers = Object.assign({
    "server": S.serverName || "nginx/1.25",
    "date": "Mon, 27 Aug 2026 10:00:00 GMT",
    "content-type": route.type || (route.json !== undefined ? "application/json" : "text/plain")
  }, route.headers || {});
  const body = route.json !== undefined ? JSON.stringify(route.json) : (route.body === undefined ? "" : route.body);
  headers["content-length"] = String(body.length);
  if(route.etag) headers["etag"] = route.etag;
  if(route.cache) headers["cache-control"] = route.cache;

  /* условный запрос */
  if(route.etag && H["if-none-match"] === route.etag)
    return {status: 304, headers: {"etag": route.etag, "cache-control": route.cache || ""}, body: "", ms};

  return {status: route.status || 200, headers, body, ms};
}

/* Прохождение через прокси: он добавляет свои заголовки и может ответить сам */
function viaProxy(N, proxyName, req, target){
  const P = N.servers[proxyName];
  if(!P) return {status: 502, headers: {}, body: "bad gateway", ms: 5};
  const up = P.upstream;
  const node = up ? N.nodes[up.ip] : null;
  const added = Object.assign({}, req.headers, {
    "X-Forwarded-For": "203.0.113.7",
    "X-Forwarded-Proto": target.scheme,
    "X-Forwarded-Host": target.host
  });
  for(const s of (P.strips || [])) delete added[s];
  if(!node || node.down || !node.ports[up.port])
    return {status: 502, headers: {"server": P.serverName || "nginx/1.25", "content-type":"text/html"},
            body: "502 Bad Gateway", ms: 15, proxied: true, added};
  const r = serve(N, node.ports[up.port].server, Object.assign({}, req, {headers: added}));
  if(P.timeoutS !== undefined && r.ms / 1000 > P.timeoutS)
    return {status: 504, headers: {"server": P.serverName || "nginx/1.25", "content-type":"text/html"},
            body: "504 Gateway Time-out", ms: P.timeoutS * 1000, proxied: true, added};
  r.headers = Object.assign({"server": P.serverName || "nginx/1.25"}, r.headers);
  r.proxied = true; r.added = added;
  r.ms += 8;
  return r;
}

/* ── разбор адреса ─────────────────────────────────────── */
function parseUrl(raw){
  let s = String(raw).trim();
  if(!/^https?:\/\//.test(s)) s = "http://" + s;
  const m = /^(https?):\/\/([^\/:?#]+)(?::(\d+))?([^?#]*)(\?[^#]*)?/.exec(s);
  if(!m) nerr("не разобрать адрес: " + raw);
  const scheme = m[1], host = m[2];
  const port = m[3] ? parseInt(m[3], 10) : (scheme === "https" ? 443 : 80);
  const path = (m[4] || "/") + (m[5] || "");
  return {scheme, host, port, path: path || "/", url: scheme + "://" + host + (m[3] ? ":" + port : "") + (path || "/")};
}

/* ── CORS: правила применяет ТОЛЬКО браузер ────────────── */
const SIMPLE_HEADERS = ["accept", "accept-language", "content-language", "content-type"];
const SIMPLE_TYPES = ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"];
function needsPreflight(method, headers){
  if(["GET", "HEAD", "POST"].indexOf(method) < 0) return true;
  const H = lower(headers);
  for(const k in H){
    if(SIMPLE_HEADERS.indexOf(k) < 0) return true;
    if(k === "content-type" && SIMPLE_TYPES.indexOf(String(H[k]).split(";")[0].trim()) < 0) return true;
  }
  return false;
}
function corsCheck(res, origin, method, headers, credentials){
  const H = lower(res.headers);
  const allow = H["access-control-allow-origin"];
  if(!allow)
    return {blocked: true,
      why: "В ответе нет заголовка Access-Control-Allow-Origin.",
      console: "Access to fetch at ... from origin '" + origin +
        "' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."};
  if(allow !== "*" && allow !== origin)
    return {blocked: true,
      why: "Заголовок Access-Control-Allow-Origin разрешает «" + allow + "», а страница пришла с «" + origin + "».",
      console: "The 'Access-Control-Allow-Origin' header has a value '" + allow +
        "' that is not equal to the supplied origin."};
  if(credentials && allow === "*")
    return {blocked: true,
      why: "С учётными данными подстановка «*» запрещена — нужно точное имя источника.",
      console: "The value of the 'Access-Control-Allow-Origin' header must not be the wildcard '*' when the request's credentials mode is 'include'."};
  if(credentials && String(H["access-control-allow-credentials"]) !== "true")
    return {blocked: true,
      why: "Нет заголовка Access-Control-Allow-Credentials: true.",
      console: "The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true'."};
  return {blocked: false};
}
function preflightCheck(res, method, headers){
  const H = lower(res.headers);
  const okM = String(H["access-control-allow-methods"] || "").split(",").map(x => x.trim().toUpperCase());
  if(okM.indexOf(method) < 0 && okM.indexOf("*") < 0)
    return {blocked: true,
      why: "Предварительный запрос не разрешил метод " + method + " (разрешены: " + (okM.join(", ") || "ничего") + ").",
      console: "Method " + method + " is not allowed by Access-Control-Allow-Headers in preflight response."};
  const okH = String(H["access-control-allow-headers"] || "").toLowerCase().split(",").map(x => x.trim());
  for(const k in lower(headers)){
    if(SIMPLE_HEADERS.indexOf(k) >= 0) continue;
    if(okH.indexOf(k) < 0 && okH.indexOf("*") < 0)
      return {blocked: true,
        why: "Предварительный запрос не разрешил заголовок «" + k + "».",
        console: "Request header field " + k + " is not allowed by Access-Control-Allow-Headers in preflight response."};
  }
  return {blocked: false};
}
