
/* ============================================================
   Файлы машины и вывод о причине
   ============================================================ */
const DEFAULT_HOSTS = "# IP-адрес\tимя\n127.0.0.1\tlocalhost\n";

function syncHosts(N){
  N.hostsFile = {};
  for(const raw of String(N.files["/etc/hosts"] || "").split("\n")){
    const line = raw.replace(/#.*$/, "").trim();
    if(!line) continue;
    const p = line.split(/\s+/);
    if(p.length < 2) continue;
    for(const name of p.slice(1)) if(name !== "localhost") N.hostsFile[name] = p[0];
  }
}

/* Слои, между которыми и приходится выбирать при разборе */
const LAYERS = {
  dns:     "имя не разрешается или разрешается не туда",
  tcp:     "не устанавливается соединение с портом",
  tls:     "не проходит проверка сертификата",
  http:    "соединение есть, но сервер отвечает ошибкой",
  proxy:   "запрос ломается на промежуточном узле",
  cors:    "браузер не отдаёт ответ коду страницы",
  timeout: "ответ приходит дольше отведённого времени",
  none:    "сеть в порядке, причина в другом"
};

function cmdVerdict(N, a){
  const w = String(a.args[0] || "").toLowerCase();
  if(!w) return {out: ["Укажите слой: " + Object.keys(LAYERS).join(", ")]
    .concat(Object.keys(LAYERS).map(k => "  " + k.padEnd(9) + " — " + LAYERS[k]))};
  if(!LAYERS[w]) nerr("нет такого слоя: " + w,
    "Возможные: " + Object.keys(LAYERS).join(", ") + ".");
  N.verdict = w;
  const used = Array.from(new Set(N.log.map(x => x.tool))).filter(Boolean);
  return {out: ["Вывод записан: " + w + " — " + LAYERS[w],
                used.length ? "До этого проверяли: " + used.join(", ")
                            : "До этого ничего не проверяли — вывод пока не на чем основывать."]};
}
