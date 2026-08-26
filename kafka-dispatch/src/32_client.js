/* ============================================================
   Продюсер, группы потребителей, смещения
   ============================================================ */

/* ── выбор партиции ────────────────────────────────────── */
function pickPartition(t, rec, state){
  if(rec.partition !== undefined && rec.partition !== null){
    if(!(rec.partition >= 0 && rec.partition < t.partitions.length))
      kerr("UNKNOWN_TOPIC_OR_PARTITION", "у топика «" + t.name + "» нет партиции " + rec.partition);
    return rec.partition;
  }
  if(rec.key !== null && rec.key !== undefined) return partitionForKey(rec.key, t.partitions.length);
  state.rr = ((state.rr | 0) + 1) % t.partitions.length;   /* без ключа — по кругу */
  return state.rr;
}

/* ── отправка ──────────────────────────────────────────── */
function produce(c, topicName, records, opts){
  const t = getTopic(c, topicName);
  const acks = (opts && opts.acks !== undefined) ? String(opts.acks) : "all";
  if(!["0","1","all","-1"].includes(acks)) kerr("INVALID_CONFIG", "acks может быть 0, 1 или all");
  t.__rr = t.__rr || {rr: -1};
  const out = [];
  records.forEach(rec => {
    const pi = pickPartition(t, rec, t.__rr);
    const p = t.partitions[pi];
    const ld = p.leader === null ? null : brokerById(c, p.leader);
    if(!ld || !ld.alive)
      kerr("LEADER_NOT_AVAILABLE", "у партиции " + t.name + "-" + pi + " нет живого лидера — запись невозможна");
    const size = String(rec.value === null ? "" : rec.value).length + String(rec.key || "").length;
    if(size > t.config["max.message.bytes"])
      kerr("RECORD_TOO_LARGE", "запись больше max.message.bytes=" + t.config["max.message.bytes"]);
    if(acks === "all" || acks === "-1"){
      const n = isrOf(p).filter(r => (brokerById(c, r.broker) || {}).alive).length;
      const need = t.config["min.insync.replicas"];
      if(n < need)
        kerr("NOT_ENOUGH_REPLICAS", "в ISR партиции " + t.name + "-" + pi + " только " + n +
          " реплик при min.insync.replicas=" + need + " — продюсер с acks=all получает отказ");
    }
    const r = {offset: p.nextOffset, key: rec.key === undefined ? null : rec.key,
               value: rec.value === undefined ? null : rec.value, ts: c.now, acks};
    p.log.push(r);
    p.nextOffset++;
    if(p.log.length === 1) p.logStartOffset = r.offset;
    const lr = leaderReplica(p);
    if(lr) lr.leo = p.nextOffset;
    if(acks === "all" || acks === "-1"){
      /* синхронная репликация: подтверждение только после записи во все реплики ISR */
      p.replicas.forEach(x => { if(x.isr && (brokerById(c, x.broker) || {}).alive) x.leo = p.nextOffset; });
    }
    out.push({topic: t.name, partition: pi, offset: r.offset, acks});
  });
  return out;
}

/* ── группы потребителей ───────────────────────────────── */
function getGroup(c, gid, create){
  if(!c.groups[gid]){
    if(!create) kerr("GROUP_ID_NOT_FOUND", "нет группы «" + gid + "»");
    c.groups[gid] = {id: gid, members: [], committed: {}, topics: [], generation: 0};
  }
  return c.groups[gid];
}
const groupState = g => g.members.length ? "Stable" : (Object.keys(g.committed).length ? "Empty" : "Dead");

/* распределение по стратегии range — умолчание Kafka */
function assign(c, g){
  g.members.forEach(m => m.assignment = []);
  const topics = Array.from(new Set(g.members.reduce((a, m) => a.concat(m.topics), []))).sort();
  topics.forEach(tn => {
    const t = c.topics[tn];
    if(!t) return;
    const subs = g.members.filter(m => m.topics.includes(tn)).sort((a, b) => a.id < b.id ? -1 : 1);
    if(!subs.length) return;
    const n = t.partitions.length, k = subs.length;
    const base = Math.floor(n / k), extra = n % k;
    let at = 0;
    subs.forEach((m, i) => {
      const cnt = base + (i < extra ? 1 : 0);
      for(let j = 0; j < cnt; j++) m.assignment.push({topic: tn, partition: at + j});
      at += cnt;
    });
  });
  g.generation++;
  return g;
}
function joinGroup(c, gid, memberId, topics, opts){
  const g = getGroup(c, gid, true);
  if(g.members.some(m => m.id === memberId))
    kerr("MEMBER_ID_REQUIRED", "участник «" + memberId + "» уже состоит в группе «" + gid + "»");
  topics.forEach(tn => getTopic(c, tn));
  g.members.push({
    id: memberId, topics: topics.slice(), assignment: [], position: {},
    reset: (opts && opts.reset) || "latest"
  });
  assign(c, g);
  note(c, "перебалансировка группы «" + gid + "»: поколение " + g.generation + ", участников " + g.members.length);
  return g;
}
function leaveGroup(c, gid, memberId){
  const g = getGroup(c, gid);
  const i = g.members.findIndex(m => m.id === memberId);
  if(i < 0) kerr("UNKNOWN_MEMBER_ID", "в группе «" + gid + "» нет участника «" + memberId + "»");
  g.members.splice(i, 1);
  assign(c, g);
  note(c, "перебалансировка группы «" + gid + "»: поколение " + g.generation + ", участников " + g.members.length);
  return g;
}
const ckey = (tn, pi) => tn + "-" + pi;

function startPosition(c, g, m, tn, pi){
  const k = ckey(tn, pi);
  if(m.position[k] !== undefined) return m.position[k];
  if(g.committed[k] !== undefined) return g.committed[k];
  const p = c.topics[tn].partitions[pi];
  if(m.reset === "earliest") return p.logStartOffset;
  if(m.reset === "none")
    kerr("NO_OFFSET_FOR_PARTITION", "для " + k + " нет зафиксированного смещения, а auto.offset.reset=none");
  return highWatermark(p);
}

/* ── чтение ────────────────────────────────────────────── */
function poll(c, gid, memberId, max){
  const g = getGroup(c, gid);
  const m = g.members.find(x => x.id === memberId) ||
    kerr("UNKNOWN_MEMBER_ID", "в группе «" + gid + "» нет участника «" + memberId + "»");
  const lim = max === undefined || max === null ? 10 : max;
  const out = [];
  m.assignment.forEach(a => {
    if(out.length >= lim) return;
    const t = c.topics[a.topic];
    if(!t) return;
    const p = t.partitions[a.partition];
    const ld = p.leader === null ? null : brokerById(c, p.leader);
    if(!ld || !ld.alive) return;                       /* нет лидера — читать не у кого */
    let pos = startPosition(c, g, m, a.topic, a.partition);
    if(pos < p.logStartOffset) pos = p.logStartOffset; /* смещение устарело: OffsetOutOfRange */
    const hw = highWatermark(p);
    let i = recordFrom(p, pos);
    while(i >= 0 && i < p.log.length && out.length < lim){
      const r = p.log[i];
      if(r.offset >= hw) break;                        /* выше высокой отметки читать нельзя */
      out.push({topic: a.topic, partition: a.partition, offset: r.offset, key: r.key, value: r.value, ts: r.ts});
      pos = r.offset + 1;
      i++;
    }
    if(i >= p.log.length || i < 0) pos = Math.min(hw, Math.max(pos, p.nextOffset > hw ? hw : p.nextOffset));
    m.position[ckey(a.topic, a.partition)] = pos;
  });
  return out;
}
function commit(c, gid, memberId, explicit){
  const g = getGroup(c, gid);
  const m = g.members.find(x => x.id === memberId) ||
    kerr("UNKNOWN_MEMBER_ID", "в группе «" + gid + "» нет участника «" + memberId + "»");
  const done = [];
  if(explicit){
    const k = ckey(explicit.topic, explicit.partition);
    g.committed[k] = explicit.offset;
    done.push([k, explicit.offset]);
  } else {
    m.assignment.forEach(a => {
      const k = ckey(a.topic, a.partition);
      if(m.position[k] !== undefined){ g.committed[k] = m.position[k]; done.push([k, m.position[k]]); }
    });
  }
  return done;
}
/* разовое чтение без группы: kafka-console-consumer без --group */
function readOnce(c, topicName, opts){
  const t = getTopic(c, topicName);
  const from = (opts && opts.from) || "beginning";
  const lim = (opts && opts.max) || 20;
  const only = opts && opts.partition !== undefined && opts.partition !== null ? opts.partition : null;
  const out = [];
  t.partitions.forEach(p => {
    if(only !== null && p.id !== only) return;
    const hw = highWatermark(p);
    const start = from === "beginning" ? p.logStartOffset : hw;
    let i = recordFrom(p, start);
    while(i >= 0 && i < p.log.length && out.length < lim){
      const r = p.log[i];
      if(r.offset >= hw) break;
      out.push({topic: t.name, partition: p.id, offset: r.offset, key: r.key, value: r.value, ts: r.ts});
      i++;
    }
  });
  return out;
}
/* ── смещения группы ───────────────────────────────────── */
function groupOffsets(c, gid){
  const g = getGroup(c, gid);
  const rows = [];
  const seen = new Set();
  const add = (tn, pi) => {
    const k = ckey(tn, pi);
    if(seen.has(k)) return; seen.add(k);
    const t = c.topics[tn]; if(!t) return;
    const p = t.partitions[pi]; if(!p) return;
    const cur = g.committed[k];
    const end = highWatermark(p);
    const owner = g.members.find(m => m.assignment.some(a => a.topic === tn && a.partition === pi));
    rows.push({topic: tn, partition: pi, current: cur === undefined ? null : cur, end,
               lag: cur === undefined ? null : Math.max(0, end - cur), member: owner ? owner.id : "-"});
  };
  g.members.forEach(m => m.assignment.forEach(a => add(a.topic, a.partition)));
  Object.keys(g.committed).forEach(k => {
    const i = k.lastIndexOf("-");
    add(k.slice(0, i), +k.slice(i + 1));
  });
  rows.sort((a, b) => a.topic === b.topic ? a.partition - b.partition : (a.topic < b.topic ? -1 : 1));
  return rows;
}
function resetOffsets(c, gid, topicName, to){
  const g = getGroup(c, gid);
  if(g.members.length)
    kerr("GROUP_NOT_EMPTY", "сбросить смещения можно только у неактивной группы — сначала остановите потребителей");
  const t = getTopic(c, topicName);
  const done = [];
  t.partitions.forEach(p => {
    let v;
    if(to === "earliest") v = p.logStartOffset;
    else if(to === "latest") v = highWatermark(p);
    else { v = Number(to); if(!isFinite(v)) kerr("INVALID_OFFSET", "смещение «" + to + "» не число"); }
    v = Math.max(p.logStartOffset, Math.min(v, highWatermark(p)));
    g.committed[ckey(topicName, p.id)] = v;
    done.push({partition: p.id, offset: v});
  });
  return done;
}
function deleteGroup(c, gid){
  const g = getGroup(c, gid);
  if(g.members.length) kerr("GROUP_NOT_EMPTY", "нельзя удалить активную группу «" + gid + "»");
  delete c.groups[gid];
  return true;
}
