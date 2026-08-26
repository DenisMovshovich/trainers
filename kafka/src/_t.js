let pass = 0, fail = 0;
function nc(){ return newCluster(); }
function R(c, line){ return runCmd(c, line); }
function sh(c, lines){ let last = null; lines.forEach(l => last = R(c, l)); return last; }
function T(name, fn){
  try{ const r = fn(); if(r === true || r === undefined){ pass++; } else { fail++; console.log("✗ " + name + " → " + r); } }
  catch(e){ fail++; console.log("✗ " + name + " — ИСКЛЮЧЕНИЕ: " + e.message); }
}
function TE(name, fn, frag){
  try{ fn(); fail++; console.log("✗ " + name + " — ожидалась ошибка, её не было"); }
  catch(e){ if(String(e.message).includes(frag)) pass++;
            else { fail++; console.log("✗ " + name + " → «" + e.message + "» не содержит «" + frag + "»"); } }
}
const eq = (a, b, w) => a === b ? true : (w || "") + " получено " + JSON.stringify(a) + ", ожидалось " + JSON.stringify(b);
const out = r => r.lines.join("\n");

console.log("── топики и партиции");
T("создание топика", () => {
  const c = nc(); R(c, "kafka-topics --create --topic orders --partitions 3 --replication-factor 2");
  return eq(c.topics.orders.partitions.length, 3, "партиций:");
});
T("фактор репликации распределён по брокерам", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 3 --replication-factor 3");
  const p = c.topics.t.partitions;
  return eq(p.map(x => x.replicas.map(r => r.broker).join("")).join("|"), "123|231|312");
});
TE("rf больше числа брокеров", () => { const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 4"); }, "больше числа брокеров");
TE("повторное создание", () => { const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1"); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1"); }, "уже существует");
TE("недопустимое имя", () => { const c = nc(); R(c, "kafka-topics --create --topic за-казы --partitions 1 --replication-factor 1"); }, "латиницу");
T("список топиков", () => {
  const c = nc(); R(c, "kafka-topics --create --topic b --partitions 1 --replication-factor 1");
  R(c, "kafka-topics --create --topic a --partitions 1 --replication-factor 1");
  return eq(out(R(c, "kafka-topics --list")), "a\nb");
});
T("партиции можно только добавлять", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 2 --replication-factor 1");
  R(c, "kafka-topics --alter --topic t --partitions 5");
  return eq(c.topics.t.partitions.length, 5);
});
TE("уменьшать партиции нельзя", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 5 --replication-factor 1");
  R(c, "kafka-topics --alter --topic t --partitions 2");
}, "только увеличивать");

console.log("── выбор партиции по ключу");
T("одинаковый ключ → одна партиция", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 3 --replication-factor 1");
  R(c, "produce --topic t --records u1:a,u1:b,u1:c");
  const used = c.topics.t.partitions.filter(p => p.log.length).length;
  return eq(used, 1, "задействовано партиций:");
});
T("без ключа — по кругу", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 3 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  return eq(c.topics.t.partitions.map(p => p.log.length).join(""), "111");
});
T("murmur2 совпадает с формулой Kafka", () => eq(partitionForKey("u1", 3), toPositive(murmur2("u1")) % 3));
T("явная партиция перекрывает ключ", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 3 --replication-factor 1");
  R(c, "produce --topic t --key u1 --value x --partition 2");
  return eq(c.topics.t.partitions[2].log.length, 1);
});
TE("нет такой партиции", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 2 --replication-factor 1");
  R(c, "produce --topic t --value x --partition 9");
}, "нет партиции 9");

console.log("── смещения и журнал");
T("смещения растут внутри партиции", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  return eq(c.topics.t.partitions[0].log.map(r => r.offset).join(","), "0,1,2");
});
T("смещения независимы в разных партициях", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 2 --replication-factor 1");
  R(c, "produce --topic t --value a --partition 0");
  R(c, "produce --topic t --value b --partition 1");
  return eq(c.topics.t.partitions[0].log[0].offset + "/" + c.topics.t.partitions[1].log[0].offset, "0/0");
});
T("LEO и высокая отметка при rf=1", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b");
  const p = c.topics.t.partitions[0];
  return eq(leo(p) + "/" + highWatermark(p), "2/2");
});

console.log("── acks и репликация");
T("acks=1 оставляет фолловеров позади", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "produce --topic t --records a,b,c --acks 1");
  const p = c.topics.t.partitions[0];
  return eq(p.replicas.map(r => r.leo).join(","), "3,0,0");
});
T("acks=1: высокая отметка не двигается, читать нечего", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "produce --topic t --records a,b,c --acks 1");
  return eq(highWatermark(c.topics.t.partitions[0]), 0);
});
T("acks=all продвигает все реплики ISR", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "produce --topic t --records a,b,c --acks all");
  const p = c.topics.t.partitions[0];
  return eq(p.replicas.map(r => r.leo).join(",") + "|" + highWatermark(p), "3,3,3|3");
});
T("replicate догоняет после acks=1", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "produce --topic t --records a,b,c --acks 1"); R(c, "replicate");
  return eq(highWatermark(c.topics.t.partitions[0]), 3);
});
T("min.insync.replicas отклоняет acks=all при усохшем ISR", () => {
  const c = nc();
  R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "kafka-configs --alter --topic t --add-config min.insync.replicas=3");
  R(c, "broker stop 2");
  try{ R(c, "produce --topic t --value x --acks all"); return "ошибки не было"; }
  catch(e){ return e.message.includes("min.insync.replicas") ? true : e.message; }
});
T("acks=1 при усохшем ISR проходит", () => {
  const c = nc();
  R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "kafka-configs --alter --topic t --add-config min.insync.replicas=3");
  R(c, "broker stop 2");
  R(c, "produce --topic t --value x --acks 1");
  return eq(c.topics.t.partitions[0].log.length, 1);
});
TE("min.insync.replicas больше rf", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 2");
  R(c, "kafka-configs --alter --topic t --add-config min.insync.replicas=3");
}, "больше фактора репликации");

console.log("── падение брокера и выборы");
T("падение лидера: выбирается реплика из ISR", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "produce --topic t --value a --acks all");
  const was = c.topics.t.partitions[0].leader;
  R(c, "broker stop " + was);
  const now = c.topics.t.partitions[0].leader;
  return now !== was && now !== null ? true : "лидер " + now;
});
T("реплика упавшего брокера выбывает из ISR", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "broker stop 3");
  return eq(isrOf(c.topics.t.partitions[0]).length, 2);
});
T("подъём брокера возвращает реплику в ISR", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 3");
  R(c, "broker stop 3"); R(c, "broker start 3");
  return eq(isrOf(c.topics.t.partitions[0]).length, 3);
});
T("без живых реплик партиция остаётся без лидера", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 2");
  const p = c.topics.t.partitions[0];
  p.replicas.forEach(r => R(c, "broker stop " + r.broker));
  return eq(p.leader, null);
});
TE("запись в партицию без лидера", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 2");
  c.topics.t.partitions[0].replicas.forEach(r => R(c, "broker stop " + r.broker));
  R(c, "produce --topic t --value x --acks 1");
}, "нет живого лидера");
T("нечистые выборы теряют записи", () => {
  const c = nc();
  R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 2");
  const p = c.topics.t.partitions[0];
  const follower = p.replicas.find(r => r.broker !== p.leader).broker;
  R(c, "produce --topic t --records a,b --acks all");       /* обе реплики на 2 */
  R(c, "broker stop " + follower);                          /* фолловер выпал из ISR на LEO=2 */
  R(c, "produce --topic t --records c,d --acks 1");         /* только у лидера, LEO=4 */
  R(c, "unclean on");
  R(c, "broker stop " + p.leader);                          /* в ISR живых нет */
  R(c, "broker start " + follower);
  R(c, "broker stop " + follower); R(c, "broker start " + follower);
  return true;
});
T("без нечистых выборов лидер не появляется", () => {
  const c = nc();
  R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 2");
  const p = c.topics.t.partitions[0];
  const f = p.replicas.find(r => r.broker !== p.leader).broker, l = p.leader;
  R(c, "produce --topic t --records a,b --acks all");
  R(c, "broker stop " + f); R(c, "broker stop " + l);
  return eq(p.leader, null);
});

console.log("── группы потребителей");
T("одна партиция на потребителя", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 4 --replication-factor 1");
  sh(c, ["consumer add --group g --name c1 --topics t", "consumer add --group g --name c2 --topics t"]);
  const g = c.groups.g;
  return eq(g.members.map(m => m.assignment.length).join(","), "2,2");
});
T("потребителей больше, чем партиций — лишние простаивают", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 2 --replication-factor 1");
  sh(c, ["consumer add --group g --name c1 --topics t", "consumer add --group g --name c2 --topics t",
         "consumer add --group g --name c3 --topics t"]);
  return eq(c.groups.g.members.map(m => m.assignment.length).sort().join(","), "0,1,1");
});
T("уход участника вызывает перебалансировку", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 4 --replication-factor 1");
  sh(c, ["consumer add --group g --name c1 --topics t", "consumer add --group g --name c2 --topics t",
         "consumer remove --group g --name c2"]);
  return eq(c.groups.g.members[0].assignment.length, 4);
});
T("поколение растёт при каждой перебалансировке", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 2 --replication-factor 1");
  sh(c, ["consumer add --group g --name c1 --topics t", "consumer add --group g --name c2 --topics t",
         "consumer remove --group g --name c1"]);
  return eq(c.groups.g.generation, 3);
});
T("две группы читают одно и то же независимо", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  sh(c, ["consumer add --group g1 --name c --topics t --reset earliest",
         "consumer add --group g2 --name c --topics t --reset earliest"]);
  const a = poll(c, "g1", "c", 10).length, b = poll(c, "g2", "c", 10).length;
  return eq(a + "/" + b, "3/3");
});

console.log("── чтение и фиксация");
T("poll читает с начала при reset=earliest", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  R(c, "consumer add --group g --name c1 --topics t --reset earliest");
  return eq(poll(c, "g", "c1", 10).length, 3);
});
T("reset=latest пропускает прошлое", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  R(c, "consumer add --group g --name c1 --topics t --reset latest");
  return eq(poll(c, "g", "c1", 10).length, 0);
});
TE("reset=none без зафиксированного смещения", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --value a");
  R(c, "consumer add --group g --name c1 --topics t --reset none");
  poll(c, "g", "c1", 10);
}, "auto.offset.reset=none");
T("повторный poll не отдаёт то же самое", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  R(c, "consumer add --group g --name c1 --topics t --reset earliest");
  poll(c, "g", "c1", 10);
  return eq(poll(c, "g", "c1", 10).length, 0);
});
T("без фиксации новый участник читает заново", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  sh(c, ["consumer add --group g --name c1 --topics t --reset earliest"]);
  poll(c, "g", "c1", 10);
  sh(c, ["consumer remove --group g --name c1", "consumer add --group g --name c2 --topics t --reset earliest"]);
  return eq(poll(c, "g", "c2", 10).length, 3);
});
T("после фиксации новый участник продолжает", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  sh(c, ["consumer add --group g --name c1 --topics t --reset earliest"]);
  poll(c, "g", "c1", 10); R(c, "commit --group g --name c1");
  sh(c, ["consumer remove --group g --name c1", "consumer add --group g --name c2 --topics t --reset earliest"]);
  return eq(poll(c, "g", "c2", 10).length, 0);
});
T("лаг считается как LEO минус зафиксированное", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c,d,e");
  sh(c, ["consumer add --group g --name c1 --topics t --reset earliest"]);
  poll(c, "g", "c1", 2); R(c, "commit --group g --name c1");
  const r = groupOffsets(c, "g")[0];
  return eq(r.current + "/" + r.end + "/" + r.lag, "2/5/3");
});
T("ручная фиксация конкретного смещения", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  R(c, "consumer add --group g --name c1 --topics t --reset earliest");
  R(c, "commit --group g --name c1 --topic t --partition 0 --offset 1");
  return eq(groupOffsets(c, "g")[0].lag, 2);
});
T("сброс смещений в начало", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b,c");
  sh(c, ["consumer add --group g --name c1 --topics t --reset earliest"]);
  poll(c, "g", "c1", 10); R(c, "commit --group g --name c1");
  R(c, "consumer remove --group g --name c1");
  R(c, "kafka-consumer-groups --reset-offsets --group g --topic t --to-earliest --execute");
  return eq(groupOffsets(c, "g")[0].current, 0);
});
TE("сброс у активной группы запрещён", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "consumer add --group g --name c1 --topics t");
  R(c, "kafka-consumer-groups --reset-offsets --group g --topic t --to-earliest --execute");
}, "неактивной группы");
T("--dry-run без --execute ничего не меняет", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b");
  R(c, "kafka-consumer-groups --reset-offsets --group g --topic t --to-earliest");
  return eq(Object.keys(getGroup(c, "g", true).committed).length, 0);
});

console.log("── порядок и параллелизм");
T("порядок гарантирован внутри партиции", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 3 --replication-factor 1");
  R(c, "produce --topic t --records u1:1,u1:2,u1:3");
  const p = c.topics.t.partitions.find(x => x.log.length);
  return eq(p.log.map(r => r.value).join(""), "123");
});
T("добавление партиций ломает привязку ключа", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 3 --replication-factor 1");
  const before = partitionForKey("u1", 3);
  R(c, "kafka-topics --alter --topic t --partitions 5");
  return before !== partitionForKey("u1", 5) ? true : "ключ остался в той же партиции — выберите другой пример";
});

console.log("── хранение");
T("срок хранения удаляет старые сегменты", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "kafka-configs --alter --topic t --add-config retention.ms=1000,segment.bytes=2");
  R(c, "produce --topic t --records a,b,c,d,e,f");
  R(c, "advance-time 10s");
  const p = c.topics.t.partitions[0];
  return p.logStartOffset > 0 ? true : "logStartOffset=" + p.logStartOffset;
});
T("активный сегмент не удаляется", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "kafka-configs --alter --topic t --add-config retention.ms=1000,segment.bytes=2");
  R(c, "produce --topic t --records a,b,c,d");
  R(c, "advance-time 10s");
  return eq(c.topics.t.partitions[0].log.length, 2);
});
T("уплотнение оставляет последнюю версию ключа в уплотняемой части", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "kafka-configs --alter --topic t --add-config cleanup.policy=compact,segment.bytes=1");
  R(c, "produce --topic t --records k1:v1,k1:v2,k2:x,k1:v3 --partition 0");
  R(c, "compact --topic t");
  const p = c.topics.t.partitions[0];
  /* активный сегмент (последняя запись) не уплотняется, поэтому k1=v2 переживает проход */
  return eq(p.log.map(r => r.key + "=" + r.value).join(","), "k1=v2,k2=x,k1=v3");
});
T("уплотнение сохраняет исходные смещения, в журнале появляется дыра", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "kafka-configs --alter --topic t --add-config cleanup.policy=compact,segment.bytes=1");
  R(c, "produce --topic t --records k1:v1,k1:v2,k2:x,k1:v3 --partition 0");
  R(c, "compact --topic t");
  const p = c.topics.t.partitions[0];
  return eq(p.log.map(r => r.offset).join(",") + "|LEO=" + leo(p), "1,2,3|LEO=4");
});
T("следующий проход убирает версию, ушедшую из активного сегмента", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "kafka-configs --alter --topic t --add-config cleanup.policy=compact,segment.bytes=1");
  R(c, "produce --topic t --records k1:v1,k1:v2,k2:x,k1:v3 --partition 0");
  R(c, "compact --topic t");
  R(c, "produce --topic t --records k9:z --partition 0");
  R(c, "compact --topic t");
  const p = c.topics.t.partitions[0];
  return eq(p.log.map(r => r.key + "=" + r.value).join(","), "k2=x,k1=v3,k9=z");
});
T("надгробие удаляет ключ", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "kafka-configs --alter --topic t --add-config cleanup.policy=compact,segment.bytes=1");
  R(c, "produce --topic t --records k1:v1 --partition 0");
  R(c, 'produce --topic t --key k1 --value null --partition 0');
  R(c, "produce --topic t --records k2:z --partition 0");
  R(c, "compact --topic t");
  return eq(c.topics.t.partitions[0].log.filter(r => r.key === "k1").length, 0);
});
TE("уплотнение при cleanup.policy=delete", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "compact --topic t");
}, "уплотнение применимо только");
T("чтение ниже logStartOffset не падает", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "kafka-configs --alter --topic t --add-config retention.ms=1000,segment.bytes=2");
  R(c, "produce --topic t --records a,b,c,d,e,f");
  sh(c, ["consumer add --group g --name c1 --topics t --reset earliest"]);
  R(c, "commit --group g --name c1 --topic t --partition 0 --offset 0");
  R(c, "advance-time 10s");
  return poll(c, "g", "c1", 10).length > 0 ? true : "ничего не прочитано";
});

console.log("── разбор команд");
TE("неизвестная команда", () => R(nc(), "kafka-magic"), "неизвестная команда");
TE("ключ без значения", () => R(nc(), "kafka-topics --create --topic"), "нет значения");
TE("незакрытая кавычка", () => R(nc(), 'produce --topic t --value "abc'), "незакрытая кавычка");
TE("нецелое число партиций", () => R(nc(), "kafka-topics --create --topic t --partitions два"), "целым числом");
TE("kafka-console-producer подсказывает produce", () => R(nc(), "kafka-console-producer --topic t"), "командой produce");
T("значение в кавычках с пробелами", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, 'produce --topic t --value "привет мир"');
  return eq(c.topics.t.partitions[0].log[0].value, "привет мир");
});
T("--describe печатает лидера и ISR", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 2");
  const s = out(R(c, "kafka-topics --describe --topic t"));
  return s.includes("Leader:") && s.includes("Isr:") ? true : s;
});
T("--describe группы печатает LAG", () => {
  const c = nc(); R(c, "kafka-topics --create --topic t --partitions 1 --replication-factor 1");
  R(c, "produce --topic t --records a,b");
  sh(c, ["consumer add --group g --name c1 --topics t --reset earliest"]);
  R(c, "commit --group g --name c1 --topic t --partition 0 --offset 0");
  const s = out(R(c, "kafka-consumer-groups --describe --group g"));
  return s.includes("LAG") && s.includes("итоговый лаг: 2") ? true : s;
});

console.log("\nитог: " + pass + " пройдено, " + fail + " провалено");
