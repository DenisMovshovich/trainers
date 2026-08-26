/* ============================================================
   Командная строка: разбор аргументов и вывод
   ============================================================ */
function tokenize(line){
  const out = [];
  let i = 0;
  while(i < line.length){
    const ch = line[i];
    if(/\s/.test(ch)){ i++; continue; }
    if(ch === '"' || ch === "'"){
      const q = ch; let s = ""; i++;
      while(i < line.length && line[i] !== q){ s += line[i++]; }
      if(i >= line.length) kerr("PARSE", "незакрытая кавычка");
      i++; out.push(s);
    } else {
      let s = "";
      while(i < line.length && !/\s/.test(line[i])) s += line[i++];
      out.push(s);
    }
  }
  return out;
}
const FLAGS = new Set(["--create","--list","--describe","--alter","--delete","--from-beginning",
  "--execute","--to-earliest","--to-latest","--reset-offsets","--dry-run","--all-groups","--if-not-exists"]);
function parseArgs(tok){
  const a = {_: [], flags: new Set()};
  for(let i = 0; i < tok.length; i++){
    const t = tok[i];
    if(t.indexOf("--") === 0){
      if(FLAGS.has(t)){ a.flags.add(t.slice(2)); continue; }
      const eq = t.indexOf("=");
      if(eq > 0){ a[t.slice(2, eq)] = t.slice(eq + 1); continue; }
      const nx = tok[i + 1];
      if(nx === undefined || nx.indexOf("--") === 0) kerr("PARSE", "у ключа " + t + " нет значения");
      const name = t.slice(2);
      if(a[name] === undefined) a[name] = nx;
      else a[name] = [].concat(a[name], nx);
      i++;
    } else a._.push(t);
  }
  return a;
}
const need = (a, k, cmd) => a[k] !== undefined ? a[k] : kerr("MISSING_ARG", "команде " + cmd + " нужен ключ --" + k);
const asInt = (v, k) => { const n = Number(v); if(!Number.isInteger(n)) kerr("PARSE", "--" + k + " должен быть целым числом, получено «" + v + "»"); return n; };

/* ── выравнивание таблиц ───────────────────────────────── */
function table(head, rows){
  const all = [head].concat(rows).map(r => r.map(x => x === null || x === undefined ? "-" : String(x)));
  const w = head.map((_, i) => Math.max.apply(null, all.map(r => (r[i] || "").length)));
  return all.map(r => r.map((x, i) => x + " ".repeat(Math.max(0, w[i] - x.length))).join("  ").replace(/\s+$/, ""));
}
const isrStr = p => p.replicas.filter(r => r.isr).map(r => r.broker).join(",") || "—";
const repStr = p => p.replicas.map(r => r.broker).join(",");

function describeTopic(c, t){
  const out = [];
  const under = t.partitions.filter(p => isrOf(p).length < t.rf).length;
  out.push("Topic: " + t.name + "\tPartitionCount: " + t.partitions.length +
    "\tReplicationFactor: " + t.rf + "\tConfigs: " +
    Object.keys(t.config).filter(k => t.config[k] !== DEF_TOPIC[k]).map(k => k + "=" + t.config[k]).join(",") );
  t.partitions.forEach(p => {
    out.push("\tTopic: " + t.name + "\tPartition: " + p.id +
      "\tLeader: " + (p.leader === null ? "none" : p.leader) +
      "\tReplicas: " + repStr(p) + "\tIsr: " + isrStr(p) +
      "\tOffsets: " + p.logStartOffset + ".." + leo(p) + " (HW " + highWatermark(p) + ")");
  });
  if(under) out.push("  ⚠ партиций с неполным набором реплик: " + under);
  return out;
}

/* ── команды ───────────────────────────────────────────── */
function cmdTopics(c, a){
  if(a.flags.has("create")){
    const name = need(a, "topic", "kafka-topics --create");
    const np = a.partitions === undefined ? 1 : asInt(a.partitions, "partitions");
    const rf = a["replication-factor"] === undefined ? 1 : asInt(a["replication-factor"], "replication-factor");
    const cfg = {};
    [].concat(a.config === undefined ? [] : a.config).forEach(s => {
      const i = s.indexOf("="); if(i < 0) kerr("PARSE", "--config ждёт вид ключ=значение");
      cfg[s.slice(0, i)] = s.slice(i + 1);
    });
    const t = createTopic(c, name, np, rf, {});
    if(Object.keys(cfg).length) setConfig(c, name, cfg);
    return ["Created topic " + t.name + "."];
  }
  if(a.flags.has("list")) return Object.keys(c.topics).sort();
  if(a.flags.has("describe")){
    const names = a.topic ? [a.topic] : Object.keys(c.topics).sort();
    if(!names.length) return ["топиков нет"];
    return names.reduce((acc, n) => acc.concat(describeTopic(c, getTopic(c, n))), []);
  }
  if(a.flags.has("alter")){
    const t = addPartitions(c, need(a, "topic", "kafka-topics --alter"), asInt(need(a, "partitions", "kafka-topics --alter"), "partitions"));
    return ["у топика " + t.name + " теперь " + t.partitions.length + " партиций",
            "⚠ распределение по ключу изменилось: murmur2(key) % " + t.partitions.length +
            " даст другую партицию, порядок для существующих ключей больше не гарантирован"];
  }
  if(a.flags.has("delete")){
    const n = need(a, "topic", "kafka-topics --delete");
    deleteTopic(c, n);
    return ["топик " + n + " удалён"];
  }
  return kerr("USAGE", "kafka-topics: нужен один из ключей --create, --list, --describe, --alter, --delete");
}
function cmdConfigs(c, a){
  const name = need(a, "topic", "kafka-configs");
  const t = getTopic(c, name);
  if(a.flags.has("alter")){
    const kv = {};
    String(need(a, "add-config", "kafka-configs --alter")).split(",").forEach(s => {
      const i = s.indexOf("="); if(i < 0) kerr("PARSE", "--add-config ждёт вид ключ=значение");
      kv[s.slice(0, i).trim()] = s.slice(i + 1).trim();
    });
    setConfig(c, name, kv);
    return ["Completed updating config for topic " + name + "."];
  }
  return ["Dynamic configs for topic " + name + ":"].concat(
    Object.keys(t.config).sort().map(k => "  " + k + "=" + t.config[k] +
      (t.config[k] === DEF_TOPIC[k] ? "  (по умолчанию)" : "")));
}
function cmdProduce(c, a){
  const name = need(a, "topic", "produce");
  const acks = a.acks === undefined ? "all" : String(a.acks);
  const part = a.partition === undefined ? null : asInt(a.partition, "partition");
  const recs = [];
  if(a.records !== undefined){
    String(a.records).split(",").forEach(s => {
      const i = s.indexOf(":");
      if(i < 0) recs.push({key: null, value: s, partition: part});
      else recs.push({key: s.slice(0, i) || null, value: s.slice(i + 1), partition: part});
    });
  } else if(a.value !== undefined){
    [].concat(a.value).forEach(v => recs.push({key: a.key === undefined ? null : String(a.key), value: v === "null" ? null : v, partition: part}));
  } else kerr("MISSING_ARG", "команде produce нужен --value или --records");
  const res = produce(c, name, recs, {acks});
  const rows = res.map(r => [r.topic + "-" + r.partition, r.offset]);
  return ["отправлено записей: " + res.length + " (acks=" + acks + ")"]
    .concat(table(["ПАРТИЦИЯ","СМЕЩЕНИЕ"], rows));
}
function fmtRec(r, showKey){
  const v = r.value === null ? "<null · надгробие>" : r.value;
  return (showKey ? (r.key === null ? "<без ключа>" : r.key) + "\t" : "") + v;
}
function cmdConsole(c, a){
  const name = need(a, "topic", "kafka-console-consumer");
  const max = a["max-messages"] === undefined ? 20 : asInt(a["max-messages"], "max-messages");
  const part = a.partition === undefined ? null : asInt(a.partition, "partition");
  const showKey = String(a.property === undefined ? "" : [].concat(a.property).join(",")).indexOf("print.key=true") >= 0;
  const recs = readOnce(c, name, {from: a.flags.has("from-beginning") ? "beginning" : "latest", max, partition: part});
  if(!recs.length) return ["(ничего не прочитано" + (a.flags.has("from-beginning") ? "" : "; без --from-beginning читается только то, что появится после подписки") + ")"];
  return recs.map(r => fmtRec(r, showKey)).concat(["Processed a total of " + recs.length + " messages"]);
}
function cmdConsumer(c, a){
  const sub = a._[1];
  if(sub === "add"){
    const g = need(a, "group", "consumer add"), nm = need(a, "name", "consumer add");
    const topics = String(need(a, "topics", "consumer add")).split(",").map(s => s.trim()).filter(Boolean);
    const grp = joinGroup(c, g, nm, topics, {reset: a.reset || "latest"});
    return ["участник " + nm + " присоединился к группе " + g + " (поколение " + grp.generation + ")"]
      .concat(assignLines(grp));
  }
  if(sub === "remove"){
    const g = need(a, "group", "consumer remove"), nm = need(a, "name", "consumer remove");
    const grp = leaveGroup(c, g, nm);
    return ["участник " + nm + " покинул группу " + g + " (поколение " + grp.generation + ")"]
      .concat(assignLines(grp));
  }
  if(sub === "list" || sub === undefined){
    const gs = a.group ? [getGroup(c, a.group)] : Object.keys(c.groups).map(k => c.groups[k]);
    if(!gs.length) return ["групп нет"];
    return gs.reduce((acc, g) => acc.concat(["группа " + g.id + " · " + groupState(g) + " · поколение " + g.generation], assignLines(g)), []);
  }
  return kerr("USAGE", "consumer: доступны add, remove, list");
}
function assignLines(g){
  if(!g.members.length) return ["  участников нет"];
  return g.members.map(m => "  " + m.id + " → " +
    (m.assignment.length ? m.assignment.map(a => a.topic + "-" + a.partition).join(" ") : "(ничего не назначено — партиций меньше, чем потребителей)"));
}
function cmdPoll(c, a){
  const g = need(a, "group", "poll"), nm = need(a, "name", "poll");
  const recs = poll(c, g, nm, a.max === undefined ? 10 : asInt(a.max, "max"));
  if(!recs.length) return ["(пусто: новых записей ниже высокой отметки нет)"];
  return ["прочитано записей: " + recs.length + " — смещения продвинулись, но НЕ зафиксированы"]
    .concat(table(["ПАРТИЦИЯ","СМЕЩЕНИЕ","КЛЮЧ","ЗНАЧЕНИЕ"],
      recs.map(r => [r.topic + "-" + r.partition, r.offset, r.key === null ? "-" : r.key, r.value === null ? "<null>" : r.value])));
}
function cmdCommit(c, a){
  const g = need(a, "group", "commit"), nm = need(a, "name", "commit");
  let ex = null;
  if(a.offset !== undefined)
    ex = {topic: need(a, "topic", "commit --offset"), partition: asInt(need(a, "partition", "commit --offset"), "partition"), offset: asInt(a.offset, "offset")};
  const done = commit(c, g, nm, ex);
  if(!done.length) return ["нечего фиксировать: с прошлой фиксации ничего не прочитано"];
  return ["зафиксировано:"].concat(done.map(d => "  " + d[0] + " → " + d[1]));
}
function cmdGroups(c, a){
  if(a.flags.has("list")){
    const ks = Object.keys(c.groups).sort();
    return ks.length ? ks : ["групп нет"];
  }
  if(a.flags.has("reset-offsets")){
    const g = need(a, "group", "kafka-consumer-groups --reset-offsets");
    const t = need(a, "topic", "kafka-consumer-groups --reset-offsets");
    let to;
    if(a.flags.has("to-earliest")) to = "earliest";
    else if(a.flags.has("to-latest")) to = "latest";
    else if(a["to-offset"] !== undefined) to = asInt(a["to-offset"], "to-offset");
    else kerr("USAGE", "укажите --to-earliest, --to-latest или --to-offset N");
    if(!a.flags.has("execute")) return ["предпросмотр (добавьте --execute, чтобы применить):"]
      .concat(getTopic(c, t).partitions.map(p => "  " + t + "-" + p.id + " → " +
        (to === "earliest" ? p.logStartOffset : to === "latest" ? highWatermark(p) : to)));
    const done = resetOffsets(c, g, t, to);
    return ["смещения группы " + g + " сброшены:"].concat(done.map(d => "  " + t + "-" + d.partition + " → " + d.offset));
  }
  if(a.flags.has("delete")){
    const g = need(a, "group", "kafka-consumer-groups --delete");
    deleteGroup(c, g);
    return ["группа " + g + " удалена"];
  }
  const gid = need(a, "group", "kafka-consumer-groups --describe");
  const g = getGroup(c, gid);
  const rows = groupOffsets(c, gid);
  if(!rows.length) return ["группа " + gid + " · " + groupState(g) + " · смещений нет"];
  return ["GROUP " + gid + " · состояние " + groupState(g) + " · участников " + g.members.length + " · поколение " + g.generation]
    .concat(table(["TOPIC","PARTITION","CURRENT-OFFSET","LOG-END-OFFSET","LAG","CONSUMER-ID"],
      rows.map(r => [r.topic, r.partition, r.current, r.end, r.lag, r.member])))
    .concat(["итоговый лаг: " + rows.reduce((s, r) => s + (r.lag || 0), 0)]);
}
function cmdBroker(c, a){
  const sub = a._[1];
  if(sub === "stop"){
    const id = asInt(a._[2] !== undefined ? a._[2] : need(a, "id", "broker stop"), "id");
    const n = stopBroker(c, id);
    return ["брокер " + id + " остановлен; партиций, потерявших лидера: " + n];
  }
  if(sub === "start"){
    const id = asInt(a._[2] !== undefined ? a._[2] : need(a, "id", "broker start"), "id");
    startBroker(c, id);
    return ["брокер " + id + " запущен, реплики догнали лидеров"];
  }
  if(sub === "list" || sub === undefined)
    return table(["BROKER","СТАТУС","СТОЙКА","ЛИДЕР ДЛЯ"],
      c.brokers.map(b => {
        const lead = [];
        eachPartition(c, (t, p) => { if(p.leader === b.id) lead.push(t.name + "-" + p.id); });
        return [b.id, b.alive ? "работает" : "остановлен", b.rack, lead.join(" ") || "—"];
      }));
  return kerr("USAGE", "broker: доступны list, stop N, start N");
}
function cmdCluster(c){
  const parts = [];
  eachPartition(c, (t, p) => parts.push([t, p]));
  const under = parts.filter(([t, p]) => isrOf(p).length < t.rf).length;
  const noLeader = parts.filter(([, p]) => p.leader === null).length;
  const recs = parts.reduce((s, [, p]) => s + p.log.length, 0);
  return ["Кластер: брокеров " + c.brokers.length + " (живых " + aliveBrokers(c).length + ")" +
          ", топиков " + Object.keys(c.topics).length +
          ", партиций " + parts.length + ", записей " + recs,
          "Групп потребителей: " + Object.keys(c.groups).length +
          " · unclean.leader.election.enable=" + (c.unclean ? "true" : "false") +
          " · условное время " + fmtMs(c.now),
          under ? "⚠ партиций с неполным ISR: " + under : "все партиции полностью реплицированы"]
         .concat(noLeader ? ["⚠ партиций без лидера: " + noLeader] : []);
}
function fmtMs(ms){
  if(ms === 0) return "0";
  const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000);
  return [d ? d + "д" : "", h ? h + "ч" : "", m ? m + "м" : "", (!d && !h && !m) ? ms + "мс" : ""].filter(Boolean).join(" ");
}
function parseDur(s){
  const m = String(s).match(/^(\d+)(ms|s|m|h|d)?$/);
  if(!m) kerr("PARSE", "длительность вида 30s, 15m, 2h, 7d или число миллисекунд");
  const n = +m[1], u = m[2] || "ms";
  return n * ({ms:1, s:1000, m:60000, h:3600000, d:86400000})[u];
}
function cmdDump(c, a){
  const t = getTopic(c, need(a, "topic", "dump"));
  const only = a.partition === undefined ? null : asInt(a.partition, "partition");
  const out = [];
  t.partitions.forEach(p => {
    if(only !== null && p.id !== only) return;
    out.push(t.name + "-" + p.id + "  lider=" + (p.leader === null ? "none" : p.leader) +
      "  isr=" + isrStr(p) + "  logStart=" + p.logStartOffset + "  LEO=" + leo(p) + "  HW=" + highWatermark(p));
    if(!p.log.length){ out.push("    (журнал пуст)"); return; }
    p.log.forEach(r => {
      out.push("    offset=" + String(r.offset).padStart(4) +
        "  key=" + (r.key === null ? "<null>" : r.key) +
        "  value=" + (r.value === null ? "<null · надгробие>" : r.value) +
        "  ts=" + fmtMs(r.ts));
    });
  });
  return out;
}
const HELP = [
  "Топики:",
  "  kafka-topics --create --topic T --partitions N --replication-factor R [--config k=v]",
  "  kafka-topics --list | --describe [--topic T] | --alter --topic T --partitions N | --delete --topic T",
  "  kafka-configs --describe --topic T",
  "  kafka-configs --alter --topic T --add-config retention.ms=60000,cleanup.policy=compact",
  "Запись:",
  "  produce --topic T --value V [--key K] [--acks 0|1|all] [--partition N]",
  "  produce --topic T --records k1:v1,k2:v2 [--acks all]",
  "Чтение без группы:",
  "  kafka-console-consumer --topic T [--from-beginning] [--partition N] [--max-messages N] [--property print.key=true]",
  "Группы потребителей:",
  "  consumer add --group G --name C --topics T[,T2] [--reset earliest|latest|none]",
  "  consumer remove --group G --name C     |  consumer list [--group G]",
  "  poll --group G --name C [--max N]      |  commit --group G --name C",
  "  commit --group G --name C --topic T --partition P --offset N",
  "  kafka-consumer-groups --list | --describe --group G | --delete --group G",
  "  kafka-consumer-groups --reset-offsets --group G --topic T --to-earliest|--to-latest|--to-offset N [--execute]",
  "Кластер и журнал:",
  "  cluster | broker list | broker stop N | broker start N | replicate [--topic T]",
  "  dump --topic T [--partition N] | advance-time 7d | compact --topic T",
  "  unclean on|off | reset"
];

/* ── точка входа ───────────────────────────────────────── */
function runCmd(c, line){
  c.notices.length = 0;
  const tok = tokenize(String(line || "").trim());
  if(!tok.length) return {lines: [], notices: []};
  const a = parseArgs(tok);
  const cmd = a._[0];
  let lines;
  switch(cmd){
    case "kafka-topics": case "kafka-topics.sh": lines = cmdTopics(c, a); break;
    case "kafka-configs": case "kafka-configs.sh": lines = cmdConfigs(c, a); break;
    case "produce": lines = cmdProduce(c, a); break;
    case "kafka-console-producer": case "kafka-console-producer.sh":
      kerr("USAGE", "в этом тренажёре запись делается командой produce: настоящий kafka-console-producer читает строки со стандартного ввода");
      break;
    case "kafka-console-consumer": case "kafka-console-consumer.sh": lines = cmdConsole(c, a); break;
    case "consumer": lines = cmdConsumer(c, a); break;
    case "poll": lines = cmdPoll(c, a); break;
    case "commit": lines = cmdCommit(c, a); break;
    case "kafka-consumer-groups": case "kafka-consumer-groups.sh": lines = cmdGroups(c, a); break;
    case "broker": lines = cmdBroker(c, a); break;
    case "cluster": case "describe": lines = cmdCluster(c); break;
    case "replicate": { const n = replicate(c, a.topic); lines = ["реплики продвинуты: " + n]; break; }
    case "advance-time": {
      const ms = parseDur(a._[1] !== undefined ? a._[1] : need(a, "by", "advance-time"));
      const d = advance(c, ms);
      lines = ["условное время: " + fmtMs(c.now) + "; удалено по сроку хранения: " + d];
      break;
    }
    case "compact": { const n = compact(c, need(a, "topic", "compact")); lines = ["уплотнение завершено, удалено записей: " + n]; break; }
    case "dump": lines = cmdDump(c, a); break;
    case "unclean": {
      const v = a._[1];
      if(v !== "on" && v !== "off") kerr("USAGE", "unclean on | unclean off");
      c.unclean = v === "on";
      lines = ["unclean.leader.election.enable=" + (c.unclean ? "true" : "false") +
        (c.unclean ? " — доступность важнее сохранности: лидером может стать реплика вне ISR, и часть записей пропадёт"
                   : " — сохранность важнее доступности: без живой реплики в ISR партиция остаётся без лидера")];
      break;
    }
    case "help": case "?": lines = HELP; break;
    default: kerr("UNKNOWN_COMMAND", "неизвестная команда «" + cmd + "»; наберите help");
  }
  return {lines: lines || [], notices: c.notices.slice()};
}
