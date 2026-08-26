<script>
"use strict";
/* ============================================================
   Эмулятор кластера Kafka: брокеры, топики, партиции, журнал
   ============================================================ */
class KErr extends Error{ constructor(code, msg){ super(msg); this.code = code; } }
const kerr = (code, msg) => { throw new KErr(code, msg); };

/* murmur2 — тот самый хеш, которым Kafka выбирает партицию по ключу */
function murmur2(str){
  const bytes = [];
  for(let i = 0; i < str.length; i++){
    const c = str.charCodeAt(i);
    if(c < 0x80) bytes.push(c);
    else if(c < 0x800){ bytes.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
    else { bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  const len = bytes.length, seed = 0x9747b28c, m = 0x5bd1e995, r = 24;
  let h = (seed ^ len) | 0;
  let i = 0;
  while(len - i >= 4){
    let k = (bytes[i] & 0xff) | ((bytes[i+1] & 0xff) << 8) | ((bytes[i+2] & 0xff) << 16) | ((bytes[i+3] & 0xff) << 24);
    k = Math.imul(k, m); k ^= k >>> r; k = Math.imul(k, m);
    h = Math.imul(h, m); h ^= k;
    i += 4;
  }
  const rest = len - i;
  if(rest === 3){ h ^= (bytes[i+2] & 0xff) << 16; }
  if(rest >= 2){ h ^= (bytes[i+1] & 0xff) << 8; }
  if(rest >= 1){ h ^= (bytes[i] & 0xff); h = Math.imul(h, m); }
  h ^= h >>> 13; h = Math.imul(h, m); h ^= h >>> 15;
  return h | 0;
}
const toPositive = x => x & 0x7fffffff;
const partitionForKey = (key, n) => toPositive(murmur2(key)) % n;

/* ── значения по умолчанию ─────────────────────────────── */
const DEF_TOPIC = {
  "retention.ms": 604800000,           /* 7 дней */
  "cleanup.policy": "delete",
  "min.insync.replicas": 1,
  "max.message.bytes": 1048576,
  "segment.bytes": 4                    /* учебный сегмент: 4 записи */
};

/* ── создание кластера ─────────────────────────────────── */
function newCluster(){
  const c = {
    brokers: [],
    topics: {},
    groups: {},
    now: 0,                     /* условное время в мс */
    seq: 0,
    unclean: false,             /* unclean.leader.election.enable */
    notices: []
  };
  [1,2,3].forEach(id => c.brokers.push({id, alive:true, rack:"r" + ((id - 1) % 2 + 1)}));
  return c;
}
const aliveBrokers = c => c.brokers.filter(b => b.alive).map(b => b.id);
const brokerById = (c, id) => c.brokers.find(b => b.id === id);
const note = (c, t) => { c.notices.push(t); };

/* ── топики и партиции ─────────────────────────────────── */
function mkPartition(id, replicaIds){
  return {
    id,
    replicas: replicaIds.map((b, i) => ({broker:b, leo:0, isr:true, preferred: i === 0})),
    leader: replicaIds[0],
    log: [],                 /* {offset, key, value, ts, headers} — смещения явные, после уплотнения возможны дыры */
    logStartOffset: 0,
    nextOffset: 0
  };
}
function assignReplicas(c, nPart, rf){
  const alive = c.brokers.map(b => b.id);
  if(rf > alive.length)
    kerr("INVALID_REPLICATION_FACTOR",
      "фактор репликации " + rf + " больше числа брокеров (" + alive.length + ")");
  const out = [];
  for(let p = 0; p < nPart; p++){
    const set = [];
    for(let j = 0; j < rf; j++) set.push(alive[(p + j) % alive.length]);
    out.push(set);
  }
  return out;
}
function createTopic(c, name, nPart, rf, cfg){
  if(c.topics[name]) kerr("TOPIC_ALREADY_EXISTS", "топик «" + name + "» уже существует");
  if(!/^[a-zA-Z0-9._-]+$/.test(name))
    kerr("INVALID_TOPIC_EXCEPTION", "имя топика может содержать только латиницу, цифры, точку, дефис и подчёркивание");
  if(!(nPart >= 1)) kerr("INVALID_PARTITIONS", "число партиций должно быть не меньше 1");
  const sets = assignReplicas(c, nPart, rf);
  const t = {
    name, rf,
    config: Object.assign({}, DEF_TOPIC, cfg || {}),
    partitions: sets.map((s, i) => mkPartition(i, s))
  };
  c.topics[name] = t;
  return t;
}
const getTopic = (c, name) => c.topics[name] ||
  kerr("UNKNOWN_TOPIC_OR_PARTITION", "нет топика «" + name + "»");

/* ── журнал ────────────────────────────────────────────── */
const leo = p => p.nextOffset;                            /* log end offset: смещение следующей записи */
const isrOf = p => p.replicas.filter(r => r.isr);
function highWatermark(p){
  const set = isrOf(p);
  if(!set.length) return p.logStartOffset;
  return Math.min.apply(null, set.map(r => r.leo));
}
const leaderReplica = p => p.replicas.find(r => r.broker === p.leader);
function recordAt(p, offset){
  for(let i = 0; i < p.log.length; i++) if(p.log[i].offset === offset) return p.log[i];
  return null;
}
/* первая существующая запись со смещением не меньше заданного */
function recordFrom(p, offset){
  for(let i = 0; i < p.log.length; i++) if(p.log[i].offset >= offset) return i;
  return -1;
}
