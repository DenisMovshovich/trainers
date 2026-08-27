
/* ============================================================
   Разбор командной строки и диспетчер
   ============================================================ */
function tokenize(line){
  const out = []; let cur = "", q = null, has = false;
  for(let i = 0; i < line.length; i++){
    const c = line[i];
    if(q){ if(c === q) q = null; else cur += c; continue; }
    if(c === '"' || c === "'"){ q = c; has = true; continue; }
    if(/\s/.test(c)){ if(cur || has){ out.push(cur); cur = ""; has = false; } continue; }
    cur += c;
  }
  if(q) nerr("незакрытая кавычка");
  if(cur || has) out.push(cur);
  return out;
}
const MULTI = {H:1, header:1, resolve:1};
const VAL = {X:1, request:1, H:1, header:1, d:1, data:1, x:1, proxy:1, resolve:1, o:1,
             "max-time":1, "connect-timeout":1, connect:1, servername:1, w:1, "write-out":1,
             A:1, u:1, e:1, noproxy:1};
function parseArgs(tokens){
  const flags = {}, opts = {}, args = [];
  for(let i = 0; i < tokens.length; i++){
    const t = tokens[i];
    if(t.indexOf("--") === 0){
      const body = t.slice(2), eq = body.indexOf("=");
      if(eq > 0){ put(opts, body.slice(0, eq), body.slice(eq + 1)); continue; }
      if(VAL[body] && tokens[i + 1] !== undefined){ put(opts, body, tokens[++i]); continue; }
      flags[body] = true; continue;
    }
    if(t[0] === "-" && t.length > 1 && !/^-\d/.test(t)){
      const long = t.slice(1);
      /* openssl пишет длинные ключи с одним дефисом: -connect, -servername */
      if(["connect","servername","showcerts","brief"].indexOf(long) >= 0){
        if(VAL[long] && tokens[i + 1] !== undefined) put(opts, long, tokens[++i]);
        else flags[long] = true;
        continue;
      }
      const letters = t.slice(1);
      if(VAL[letters[0]] && letters.length > 1 && !VAL[letters]){ put(opts, letters[0], letters.slice(1)); continue; }
      for(let k = 0; k < letters.length; k++){
        const c = letters[k];
        if(VAL[c] && k === letters.length - 1 && tokens[i + 1] !== undefined) put(opts, c, tokens[++i]);
        else flags[c] = true;
      }
      continue;
    }
    args.push(t);
  }
  return {flags, opts, args};
}
function put(o, k, v){
  if(MULTI[k]) o[k] = [].concat(o[k] === undefined ? [] : o[k], v);
  else o[k] = v;
}

const TOOLS = {
  curl: cmdCurl, dig: cmdDig, nslookup: cmdDig, ping: cmdPing,
  nc: cmdNc, openssl: cmdOpenssl, browser: cmdBrowser, verdict: cmdVerdict
};

function runNet(N, raw){
  const line = String(raw).trim();
  if(!line) return {out: []};
  let tokens;
  try{ tokens = tokenize(line); }
  catch(e){ return {out: [], err: e.message, hint: e.hint || ""}; }

  try{
    if(tokens[0] === "clear") return {out: [], clear: true};
    if(tokens[0] === "cat" && /hosts$/.test(tokens[1] || ""))
      return {out: String(N.files["/etc/hosts"] || "").split("\n").filter(l => l !== "")};
    if(tokens[0] === "cat") nerr("cat: доступен только /etc/hosts");
    if(tokens[0] === "ls") return {out: Object.keys(N.files || {}).sort()};
    if(tokens[0] === "env")
      return {out: N.proxyEnv ? ["https_proxy=" + N.proxyEnv, "http_proxy=" + N.proxyEnv]
                              : ["(переменных прокси не задано)"]};
    if(tokens[0] === "help" || tokens[0] === "?")
      return {out: ["Инструменты: curl, dig, ping, nc, openssl s_client, browser.",
                    "Ещё: cat /etc/hosts, env, clear."]};

    const fn = TOOLS[tokens[0]];
    if(!fn) return {out: [], err: "команда «" + tokens[0] + "» здесь не живёт",
                    hint: "Доступны curl, dig, ping, nc, openssl, browser, cat /etc/hosts, env."};
    const a = parseArgs(tokens.slice(1));
    N.now += 1;
    syncHosts(N);
    if(tokens[0] !== "verdict") N.log.push({tool: tokens[0], line});
    return fn(N, a) || {out: []};
  }catch(e){
    if(e instanceof NetErr) return {out: [], err: e.message, hint: e.hint || ""};
    return {out: [], err: "внутренняя ошибка: " + (e && e.message || e)};
  }
}

/* сценарий — это сеть с заданными именами, узлами и серверами */
function newScenario(opts){
  const N = newNet(opts);
  N.files = Object.assign({"/etc/hosts": DEFAULT_HOSTS}, (opts || {}).files);
  if((opts || {}).hostsFile)
    for(const n in opts.hostsFile) N.files["/etc/hosts"] += opts.hostsFile[n] + "\t" + n + "\n";
  syncHosts(N);
  return N;
}
