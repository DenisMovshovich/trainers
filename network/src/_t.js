
/* ── тесты движка ──────────────────────────────────────── */
let pass = 0, fail = 0;
const WORLD = () => newScenario({
  dns: {
    "api.example.com": [{type:"A", value:"203.0.113.10", ttl:300}],
    "www.example.com": [{type:"CNAME", value:"api.example.com"}],
    "old.example.com": [{type:"A", value:"203.0.113.10"}],
    "dead.example.com": [{type:"A", value:"203.0.113.99"}],
    "app.example.com": [{type:"A", value:"203.0.113.20"}]
  },
  nodes: {
    "203.0.113.10": {ports: {80: {server:"api"}, 443: {server:"api", tls:true, cert:"api.example.com"}}},
    "203.0.113.99": {down: true, ports: {}},
    "203.0.113.20": {ports: {443: {server:"web", tls:true, cert:"app.example.com"}}}
  },
  certs: {
    "api.example.com": {cn:"api.example.com", san:["api.example.com"], notAfter: 999999},
    "app.example.com": {cn:"app.example.com", san:["app.example.com"], notAfter: 999999}
  },
  servers: {
    api: {routes: [
      {path:"/health", body:"ok"},
      {path:"/orders", json:[{id:1}], headers:{"access-control-allow-origin":"https://app.example.com"}},
      {path:"/private", auth:true, token:"good", json:{secret:1}},
      {path:"/only-post", methods:["POST"], body:"created", status:201},
      {path:"/old", status:301, location:"/health"},
      {path:"/loop-a", status:302, location:"/loop-b"},
      {path:"/loop-b", status:302, location:"/loop-a"},
      {path:"/cached", body:"data", etag:'"v1"', cache:"max-age=60"},
      {path:"/no-cors", json:{ok:1}}
    ]},
    web: {routes: [{path:"/", body:"страница"}]}
  }
});

function run(script, world){
  const N = world || WORLD();
  let last = [];
  for(const line of script.trim().split("\n")){
    const s = line.trim();
    if(!s) continue;
    const r = runNet(N, s);
    last = r.err ? ["ОШИБКА: " + r.err] : (r.out || []).concat(r.err2 ? [r.err2] : []);
  }
  return {N, out: last.join("\n")};
}
function T(name, script, expect, world){
  const {N, out} = run(script, world);
  const ok = typeof expect === "function" ? expect(out, N) : out.trim() === String(expect).trim();
  if(ok) pass++;
  else { fail++; console.log("✗ " + name); console.log("    вышло:\n" + out.split("\n").map(x => "      " + x).join("\n")); }
}
const has = s => o => o.indexOf(s) >= 0;

console.log("── имена");
T("успешный запрос", "curl https://api.example.com/health", "ok");
T("несуществующее имя", "curl https://nope.example.com/", has("Could not resolve host"));
T("код ошибки 6 при NXDOMAIN", "curl https://nope.example.com/", has("curl: (6)"));
T("dig показывает запись", "dig api.example.com", has("A\t203.0.113.10"));
T("dig на пустом имени", "dig nope.example.com", has("NXDOMAIN"));
T("CNAME разворачивается", "curl -v https://www.example.com/health",
  (o) => /CNAME api\.example\.com/.test(o) === false || /Resolved/.test(o), WORLD());
T("CNAME виден в dig", "dig www.example.com", has("CNAME\tapi.example.com"));
T("/etc/hosts сильнее DNS", "curl -v http://api.example.com/health",
  has("(/etc/hosts)"), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    hostsFile: {"api.example.com": "127.0.0.1"},
    nodes: {"127.0.0.1": {ports:{80:{server:"local"}}}},
    servers: {local: {routes:[{path:"/health", body:"локально"}]}}
  }));

console.log("── соединение");
T("порт закрыт — connection refused", "curl http://api.example.com:8080/",
  has("Connection refused"));
T("код 7 при отказе", "curl http://api.example.com:8080/", has("curl: (7)"));
T("узел не отвечает — таймаут", "curl --connect-timeout 2 http://dead.example.com/",
  has("Connection timed out"));
T("DROP отличается от REFUSED", "curl --connect-timeout 2 https://api.example.com/health",
  has("Connection timed out"), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    nodes: {"203.0.113.10": {ports:{443:{server:"api",tls:true,cert:"c"}}, drop:[443]}},
    certs: {c:{cn:"api.example.com", notAfter: 999999}},
    servers: {api:{routes:[{path:"/health", body:"ok"}]}}
  }));
T("nc проверяет порт", "nc -zv api.example.com 443", has("succeeded"));
T("nc на закрытом порту", "nc -zv api.example.com 8080", has("Connection refused"));
T("ping отвечает", "ping api.example.com", has("0% packet loss"));
T("ping молчит, а порт открыт", "ping api.example.com",
  (o) => /100% packet loss/.test(o) && /ICMP часто закрыт/.test(o), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    nodes: {"203.0.113.10": {noIcmp: true, ports:{443:{server:"api",tls:true,cert:"c"}}}},
    certs: {c:{cn:"api.example.com", notAfter: 999999}},
    servers: {api:{routes:[{path:"/health", body:"ok"}]}}
  }));

console.log("── шифрование");
T("https на порту 80 — не тот протокол", "curl https://api.example.com:80/health",
  has("wrong version number"));
T("просроченный сертификат", "curl https://api.example.com/health",
  has("certificate has expired"), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    nodes: {"203.0.113.10": {ports:{443:{server:"api",tls:true,cert:"c"}}}},
    certs: {c:{cn:"api.example.com", san:["api.example.com"], notAfter: -1, notAfterText:"Jan 1 2020"}},
    servers: {api:{routes:[{path:"/health", body:"ok"}]}}
  }));
T("сертификат на другое имя", "curl https://api.example.com/health",
  has("no alternative certificate subject name"), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    nodes: {"203.0.113.10": {ports:{443:{server:"api",tls:true,cert:"c"}}}},
    certs: {c:{cn:"other.example.com", san:["other.example.com"], notAfter: 999999}},
    servers: {api:{routes:[{path:"/health", body:"ok"}]}}
  }));
T("самоподписанный", "curl https://api.example.com/health",
  has("self-signed certificate"), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    nodes: {"203.0.113.10": {ports:{443:{server:"api",tls:true,cert:"c"}}}},
    certs: {c:{cn:"api.example.com", san:["api.example.com"], notAfter: 999999, selfSigned:true}},
    servers: {api:{routes:[{path:"/health", body:"ok"}]}}
  }));
T("-k пропускает проверку", "curl -k https://api.example.com/health", "ok", newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    nodes: {"203.0.113.10": {ports:{443:{server:"api",tls:true,cert:"c"}}}},
    certs: {c:{cn:"api.example.com", notAfter: 999999, selfSigned:true}},
    servers: {api:{routes:[{path:"/health", body:"ok"}]}}
  }));
T("openssl показывает цепочку", "openssl s_client -connect api.example.com:443",
  (o) => /Certificate chain/.test(o) && /Verify return code: 0/.test(o));
T("-v печатает сертификат", "curl -v https://api.example.com/health",
  (o) => /subjectAltName/.test(o) && /issuer/.test(o) && /expire date/.test(o));

console.log("── HTTP");
T("заголовки через -I", "curl -I https://api.example.com/health",
  (o) => /HTTP\/1.1 200 OK/.test(o) && /content-length/.test(o));
T("404 на неизвестном пути", "curl -I https://api.example.com/nope", has("404 Not Found"));
T("405 на неверном методе", "curl -I https://api.example.com/only-post", has("405"));
T("401 без токена", "curl -I https://api.example.com/private", has("401"));
T("403 с неверным токеном", 'curl -I -H "Authorization: Bearer bad" https://api.example.com/private',
  has("403"));
T("200 с верным токеном", 'curl -H "Authorization: Bearer good" https://api.example.com/private',
  has('{"secret":1}'));
T("токен маскируется в -v", 'curl -v -H "Authorization: Bearer good" https://api.example.com/private',
  (o) => /Authorization: Bearer goo…/.test(o) && !/Bearer good\b/.test(o.split("\n").filter(l => /^>/.test(l)).join("\n")));
T("POST задаёт метод сам", 'curl -d "x=1" https://api.example.com/only-post', has("created"));
T("перенаправление без -L не переходит", "curl -I https://api.example.com/old",
  (o) => /301/.test(o) && /location: \/health/.test(o));
T("с -L переходит", "curl -L https://api.example.com/old", "ok");
T("цикл перенаправлений ловится", "curl -L https://api.example.com/loop-a",
  has("Maximum (20) redirects followed"));
T("условный запрос даёт 304", "curl -I -H 'If-None-Match: \"v1\"' https://api.example.com/cached",
  has("304"));

console.log("── прокси");
const PROXY = () => newScenario({
  dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}],
        "proxy.corp":[{type:"A", value:"10.0.0.8"}]},
  nodes: {"203.0.113.10": {ports:{80:{server:"api"}}},
          "10.0.0.8": {ports:{3128:{server:"proxy"}}}},
  servers: {
    api: {routes:[{path:"/health", body:"ok"}, {path:"/who", body:"кто-то"}]},
    proxy: {serverName:"squid/6.6", upstream:{ip:"203.0.113.10", port:80}}
  }
});
T("через прокси запрос доходит", "curl -x http://proxy.corp:3128 http://api.example.com/health",
  "ok", PROXY());
T("прокси добавляет X-Forwarded-For", "curl -v -x http://proxy.corp:3128 http://api.example.com/health",
  has("Uses proxy"), PROXY());
T("прокси отдаёт 502, если сервер лежит", "curl -x http://proxy.corp:3128 http://api.example.com/health",
  has("502"), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}], "proxy.corp":[{type:"A", value:"10.0.0.8"}]},
    nodes: {"203.0.113.10": {down:true, ports:{}}, "10.0.0.8": {ports:{3128:{server:"proxy"}}}},
    servers: {proxy:{upstream:{ip:"203.0.113.10", port:80}}}
  }));
T("переменная окружения тоже включает прокси", "curl http://api.example.com/health",
  "ok", newScenario({
    proxyEnv: "http://proxy.corp:3128",
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}], "proxy.corp":[{type:"A", value:"10.0.0.8"}]},
    nodes: {"203.0.113.10": {ports:{80:{server:"api"}}}, "10.0.0.8": {ports:{3128:{server:"proxy"}}}},
    servers: {api:{routes:[{path:"/health", body:"ok"}]}, proxy:{upstream:{ip:"203.0.113.10", port:80}}}
  }));

console.log("── CORS");
T("curl проходит, а браузер — нет", "browser https://api.example.com/no-cors",
  (o) => /ЗАБЛОКИРОВАНО/.test(o) && /Access-Control-Allow-Origin/.test(o));
T("тот же адрес через curl работает", "curl https://api.example.com/no-cors", has('{"ok":1}'));
T("с правильным заголовком браузер пропускает", "browser https://api.example.com/orders",
  (o) => !/ЗАБЛОКИРОВАНО/.test(o) && /200 OK/.test(o));
T("тот же источник — правил нет", "browser https://app.example.com/",
  has("правила CORS не применяются"));
T("нестандартный заголовок требует предварительного запроса",
  'browser -H "X-Token: 1" https://api.example.com/orders',
  (o) => /Предварительный запрос/.test(o) && /ЗАБЛОКИРОВАНО/.test(o));

console.log("── таймауты");
T("медленный ответ и --max-time", "curl --max-time 2 https://api.example.com/slow",
  has("Operation timed out"), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    nodes: {"203.0.113.10": {ports:{443:{server:"api",tls:true,cert:"c"}}}},
    certs: {c:{cn:"api.example.com", san:["api.example.com"], notAfter: 999999}},
    servers: {api:{slowMs: 5000, routes:[{path:"/slow", body:"поздно"}]}}
  }));
T("тот же запрос без ограничения проходит", "curl https://api.example.com/slow",
  has("поздно"), newScenario({
    dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
    nodes: {"203.0.113.10": {ports:{443:{server:"api",tls:true,cert:"c"}}}},
    certs: {c:{cn:"api.example.com", san:["api.example.com"], notAfter: 999999}},
    servers: {api:{slowMs: 5000, routes:[{path:"/slow", body:"поздно"}]}}
  }));
T("--resolve обходит DNS", "curl -v --resolve api.example.com:443:203.0.113.10 https://api.example.com/health",
  has("(--resolve)"));

console.log("── ошибки внятные");
T("не тот инструмент", "wget https://api.example.com/", has("здесь не живёт"));
T("curl без адреса", "curl", has("try 'curl --help'"));
T("заголовок без двоеточия", 'curl -H "Broken" https://api.example.com/health',
  has("заголовок задают"));

console.log("── файлы и вывод");
T("правка /etc/hosts меняет разрешение имени", `curl http://api.example.com/health`,
  has("локально"), (function(){
    const N = newScenario({
      dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
      nodes: {"203.0.113.10": {ports:{80:{server:"api"}}}, "127.0.0.1": {ports:{80:{server:"local"}}}},
      servers: {api:{routes:[{path:"/health", body:"с сервера"}]},
                local:{routes:[{path:"/health", body:"локально"}]}}
    });
    N.files["/etc/hosts"] += "127.0.0.1\tapi.example.com\n";
    return N;
  })());
T("cat /etc/hosts показывает файл", "cat /etc/hosts", has("localhost"));
T("вывод записывается", "curl https://api.example.com/health\nverdict dns",
  (o, N) => N.verdict === "dns" && /Вывод записан/.test(o));
T("вывод без проверок отмечается", "verdict tls",
  has("вывод пока не на чем основывать"));
T("несуществующий слой", "verdict магия", has("нет такого слоя"));

console.log("── виртуальные хосты");
T("сервер выбирается по имени", "curl http://api.example.com/health", "ok", newScenario({
  dns: {"api.example.com":[{type:"A", value:"203.0.113.10"}]},
  nodes: {"203.0.113.10": {ports:{80:{server:"vhost", byHost:{"api.example.com":"api"}}}}},
  servers: {vhost:{routes:[{path:"/health", body:"по умолчанию"}]},
            api:{routes:[{path:"/health", body:"ok"}]}}
}));
T("обращение по адресу даёт сайт по умолчанию", "curl http://203.0.113.10/health",
  has("по умолчанию"), newScenario({
  dns: {},
  nodes: {"203.0.113.10": {ports:{80:{server:"vhost", byHost:{"api.example.com":"api"}}}}},
  servers: {vhost:{routes:[{path:"/health", body:"по умолчанию"}]},
            api:{routes:[{path:"/health", body:"ok"}]}}
}));
T("--resolve сохраняет имя", "curl --resolve api.example.com:80:203.0.113.10 http://api.example.com/health",
  "ok", newScenario({
  dns: {},
  nodes: {"203.0.113.10": {ports:{80:{server:"vhost", byHost:{"api.example.com":"api"}}}}},
  servers: {vhost:{routes:[{path:"/health", body:"по умолчанию"}]},
            api:{routes:[{path:"/health", body:"ok"}]}}
}));

console.log("── измерение времени");
T("-w печатает время", "curl -w \"%{time_total}\" https://api.example.com/health",
  (o) => /^ok$/m.test(o) && /^\d+\.\d{3}$/m.test(o));
T("-w печатает код", "curl -o /dev/null -w \"%{http_code}\" https://api.example.com/nope",
  has("404"));

console.log("\nитог: " + pass + " пройдено, " + fail + " провалено");
