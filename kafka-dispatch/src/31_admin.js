/* ============================================================
   Репликация, выборы лидера, хранение
   ============================================================ */

/* ── шаг репликации: фолловеры догоняют лидера ─────────── */
function replicate(c, only){
  let moved = 0;
  eachPartition(c, (t, p) => {
    if(only && only !== t.name) return;
    const ld = brokerById(c, p.leader);
    if(!ld || !ld.alive) return;
    const end = leo(p);
    p.replicas.forEach(r => {
      const b = brokerById(c, r.broker);
      if(!b || !b.alive) return;
      if(r.leo < end){ r.leo = end; moved++; }
      if(!r.isr){ r.isr = true; note(c, "реплика " + t.name + "-" + p.id + " на брокере " + r.broker + " догнала лидера и вернулась в ISR"); }
    });
  });
  return moved;
}
function eachPartition(c, fn){
  Object.keys(c.topics).forEach(n => c.topics[n].partitions.forEach(p => fn(c.topics[n], p)));
}

/* ── падение и подъём брокера ──────────────────────────── */
function stopBroker(c, id){
  const b = brokerById(c, id) || kerr("UNKNOWN_BROKER", "нет брокера " + id);
  if(!b.alive) kerr("BROKER_NOT_AVAILABLE", "брокер " + id + " уже остановлен");
  b.alive = false;
  const lost = [];
  eachPartition(c, (t, p) => {
    const r = p.replicas.find(x => x.broker === id);
    if(!r) return;
    if(r.isr){ r.isr = false; }
    if(p.leader === id) lost.push([t, p]);
  });
  lost.forEach(([t, p]) => electLeader(c, t, p));
  return lost.length;
}
function startBroker(c, id){
  const b = brokerById(c, id) || kerr("UNKNOWN_BROKER", "нет брокера " + id);
  if(b.alive) kerr("BROKER_ALREADY_RUNNING", "брокер " + id + " уже работает");
  b.alive = true;
  eachPartition(c, (t, p) => {
    const r = p.replicas.find(x => x.broker === id);
    if(!r) return;
    if(p.leader === null) electLeader(c, t, p);
  });
  replicate(c);
  return true;
}
function electLeader(c, t, p){
  const cand = p.replicas.filter(r => r.isr && (brokerById(c, r.broker) || {}).alive);
  if(cand.length){
    const pick = cand.find(r => r.preferred) || cand[0];
    p.leader = pick.broker;
    note(c, "новый лидер " + t.name + "-" + p.id + ": брокер " + pick.broker + " (из ISR)");
    return true;
  }
  const any = p.replicas.filter(r => (brokerById(c, r.broker) || {}).alive);
  if(c.unclean && any.length){
    const pick = any[0];
    p.leader = pick.broker;
    const lostFrom = pick.leo;
    const had = leo(p);
    p.log = p.log.filter(r => r.offset < lostFrom);
    p.nextOffset = lostFrom;
    pick.isr = true;
    note(c, "НЕЧИСТЫЕ ВЫБОРЫ: лидером " + t.name + "-" + p.id + " стал брокер " + pick.broker +
      " вне ISR; потеряно записей: " + (had - lostFrom));
    return true;
  }
  p.leader = null;
  note(c, "партиция " + t.name + "-" + p.id + " без лидера: живых реплик в ISR нет");
  return false;
}

/* ── изменение топика ──────────────────────────────────── */
function addPartitions(c, name, n){
  const t = getTopic(c, name);
  if(n <= t.partitions.length)
    kerr("INVALID_PARTITIONS", "число партиций можно только увеличивать (сейчас " + t.partitions.length + ")");
  const alive = c.brokers.map(b => b.id);
  for(let p = t.partitions.length; p < n; p++){
    const set = [];
    for(let j = 0; j < t.rf; j++) set.push(alive[(p + j) % alive.length]);
    t.partitions.push(mkPartition(p, set));
  }
  Object.keys(c.groups).forEach(gid => {
    const g = c.groups[gid];
    if(g.members.some(m => m.topics.includes(name))){
      assign(c, g);
      note(c, "число партиций изменилось — перебалансировка группы «" + gid + "», поколение " + g.generation);
    }
  });
  return t;
}
const CFG_OK = new Set(["retention.ms","cleanup.policy","min.insync.replicas","max.message.bytes","segment.bytes","delete.retention.ms"]);
function setConfig(c, name, kv){
  const t = getTopic(c, name);
  Object.keys(kv).forEach(k => {
    if(!CFG_OK.has(k)) kerr("INVALID_CONFIG", "неизвестный параметр «" + k + "»");
    let v = kv[k];
    if(k === "cleanup.policy"){
      if(!["delete","compact","compact,delete"].includes(v))
        kerr("INVALID_CONFIG", "cleanup.policy может быть delete, compact или compact,delete");
    } else {
      v = Number(v);
      if(!isFinite(v)) kerr("INVALID_CONFIG", "значение «" + kv[k] + "» не число");
      if(k === "min.insync.replicas" && v > t.rf)
        kerr("INVALID_CONFIG", "min.insync.replicas=" + v + " больше фактора репликации " + t.rf +
          " — продюсер с acks=all не сможет записать ничего");
    }
    t.config[k] = v;
  });
  return t;
}
function deleteTopic(c, name){
  getTopic(c, name);
  delete c.topics[name];
  Object.keys(c.groups).forEach(g => {
    const grp = c.groups[g];
    Object.keys(grp.committed).forEach(k => { if(k.indexOf(name + "-") === 0) delete grp.committed[k]; });
  });
  return true;
}

/* ── время и очистка журнала ───────────────────────────── */
function advance(c, ms){
  c.now += ms;
  return retention(c);
}
function retention(c){
  let dropped = 0;
  eachPartition(c, (t, p) => {
    const pol = String(t.config["cleanup.policy"]);
    if(pol.indexOf("delete") < 0) return;
    const keep = t.config["retention.ms"];
    const seg = Math.max(1, t.config["segment.bytes"] | 0);
    /* Kafka удаляет целыми сегментами: сегмент уходит, когда устарела его ПОСЛЕДНЯЯ запись */
    while(p.log.length > 0){
      const nseg = Math.min(seg, p.log.length);
      if(p.log.length <= nseg) break;           /* активный сегмент не трогаем */
      const last = p.log[nseg - 1];
      if(c.now - last.ts <= keep) break;
      p.log.splice(0, nseg);
      p.logStartOffset = p.log.length ? p.log[0].offset : p.nextOffset;
      dropped += nseg;
    }
    p.replicas.forEach(r => { if(r.leo < p.logStartOffset) r.leo = p.logStartOffset; });
  });
  if(dropped) note(c, "по сроку хранения удалено записей: " + dropped);
  return dropped;
}
function compact(c, name){
  const t = getTopic(c, name);
  if(String(t.config["cleanup.policy"]).indexOf("compact") < 0)
    kerr("INVALID_CONFIG", "у топика «" + name + "» cleanup.policy=" + t.config["cleanup.policy"] +
      " — уплотнение применимо только при compact");
  let removed = 0;
  t.partitions.forEach(p => {
    const seg = Math.max(1, t.config["segment.bytes"] | 0);
    const activeFrom = Math.max(0, p.log.length - seg);   /* активный сегмент не уплотняется */
    const head = p.log.slice(0, activeFrom), tail = p.log.slice(activeFrom);
    const lastIdx = new Map();
    head.forEach((r, i) => { if(r.key !== null) lastIdx.set(r.key, i); });
    const keep = head.filter((r, i) => {
      if(r.key === null) return true;                     /* записи без ключа уплотнение не трогает */
      if(lastIdx.get(r.key) !== i) return false;          /* не последняя версия ключа */
      if(r.value === null) return false;                  /* надгробие: ключ удаляется */
      return true;
    });
    removed += head.length - keep.length;
    p.log = keep.concat(tail);
  });
  if(removed) note(c, "уплотнение удалило записей: " + removed);
  return removed;
}
