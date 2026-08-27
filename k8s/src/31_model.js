
/* ============================================================
   Модель кластера
   ============================================================ */

/* Реестр образов. Неизвестный образ ведёт себя как в жизни —
   ImagePullBackOff, а не «молча не работает». */
const IMAGES = {
  "nginx":            {mem: 64,  cpu: 50,  port: 80,   paths: ["/", "/healthz"]},
  "nginx:1.25":       {mem: 64,  cpu: 50,  port: 80,   paths: ["/", "/healthz"]},
  "nginx:1.26":       {mem: 68,  cpu: 50,  port: 80,   paths: ["/", "/healthz"]},
  "redis:7":          {mem: 96,  cpu: 80,  port: 6379, paths: []},
  "postgres:16":      {mem: 256, cpu: 200, port: 5432, paths: []},
  "busybox":          {mem: 8,   cpu: 10,  port: 0,    paths: []},
  "shop/api:1.0":     {mem: 128, cpu: 100, port: 8080, paths: ["/", "/healthz", "/ready"]},
  "shop/api:1.1":     {mem: 128, cpu: 100, port: 8080, paths: ["/", "/healthz", "/ready"]},
  "shop/api:2.0":     {mem: 160, cpu: 120, port: 8080, paths: ["/", "/healthz", "/ready"]},
  "shop/api:2.1-slow":{mem: 160, cpu: 120, port: 8080, paths: ["/", "/healthz"], slowStart: true},
  "shop/api:broken":  {mem: 128, cpu: 100, port: 8080, paths: [], crash: true},
  "shop/api:hungry":  {mem: 512, cpu: 100, port: 8080, paths: ["/", "/healthz", "/ready"]},
  "shop/worker:1.0":  {mem: 96,  cpu: 150, port: 0,    paths: []},
  "shop/migrate:1.0": {mem: 64,  cpu: 50,  port: 0,    paths: [], job: true}
};

function newCluster(opts){
  opts = opts || {};
  const C = {
    now: 0,
    uid: 0,
    ns: "default",
    objects: {},          /* ключ "ns|kind|name" */
    events: [],
    nodes: []
  };
  const nodes = opts.nodes || [
    {name: "node-1", cpu: 2000, mem: 4096},
    {name: "node-2", cpu: 2000, mem: 4096}
  ];
  for(const n of nodes)
    C.nodes.push({name: n.name, cpu: n.cpu, mem: n.mem, ready: n.ready !== false,
                  labels: Object.assign({"kubernetes.io/hostname": n.name}, n.labels || {}),
                  taints: n.taints || []});
  for(const ns of (opts.namespaces || ["default", "kube-system"])) put(C, nsObj(ns));
  return C;
}
const nsObj = name => ({apiVersion:"v1", kind:"Namespace", metadata:{name}, spec:{}, status:{phase:"Active"}});

const key = (ns, kind, name) => (ns || "") + "|" + kind + "|" + name;
const NAMESPACED = {Pod:1, Deployment:1, ReplicaSet:1, Service:1, ConfigMap:1, Secret:1,
                    Job:1, CronJob:1, Ingress:1, PersistentVolumeClaim:1, StatefulSet:1, DaemonSet:1};
const isNamespaced = kind => !!NAMESPACED[kind];

function put(C, o){
  const ns = isNamespaced(o.kind) ? (o.metadata.namespace || "default") : "";
  if(isNamespaced(o.kind)) o.metadata.namespace = ns;
  C.objects[key(ns, o.kind, o.metadata.name)] = o;
  return o;
}
const get = (C, ns, kind, name) => C.objects[key(isNamespaced(kind) ? (ns || "default") : "", kind, name)];
function del(C, ns, kind, name){
  const k = key(isNamespaced(kind) ? (ns || "default") : "", kind, name);
  const o = C.objects[k];
  delete C.objects[k];
  return o;
}
function list(C, kind, ns){
  const out = [];
  for(const k in C.objects){
    const o = C.objects[k];
    if(o.kind !== kind) continue;
    if(isNamespaced(kind) && ns !== "*" && (o.metadata.namespace || "default") !== (ns || "default")) continue;
    out.push(o);
  }
  return out.sort((a, b) => a.metadata.name < b.metadata.name ? -1 : 1);
}

function event(C, o, type, reason, msg){
  C.events.push({ts: C.now, ns: o.metadata.namespace || "", kind: o.kind,
                 name: o.metadata.name, type, reason, msg});
  if(C.events.length > 400) C.events.splice(0, C.events.length - 400);
}

/* ── метки и селекторы ─────────────────────────────────── */
function matches(labels, sel){
  labels = labels || {};
  if(!sel) return false;
  const ml = sel.matchLabels || sel;
  for(const k in ml) if(String(labels[k]) !== String(ml[k])) return false;
  for(const e of (sel.matchExpressions || [])){
    const v = labels[e.key];
    const vals = e.values || [];
    if(e.operator === "In" && vals.indexOf(v) < 0) return false;
    if(e.operator === "NotIn" && vals.indexOf(v) >= 0) return false;
    if(e.operator === "Exists" && v === undefined) return false;
    if(e.operator === "DoesNotExist" && v !== undefined) return false;
  }
  return true;
}
/* строковый селектор из командной строки: app=web,tier!=back */
function parseSelector(s){
  const eq = {}, ne = {};
  for(const part of String(s).split(",")){
    const p = part.trim();
    if(!p) continue;
    let m = p.match(/^([^!=]+)!=(.*)$/);
    if(m){ ne[m[1].trim()] = m[2].trim(); continue; }
    m = p.match(/^([^=]+)=(.*)$/);
    if(m){ eq[m[1].trim()] = m[2].trim(); continue; }
    eq[p] = undefined;                       /* просто наличие метки */
  }
  return {eq, ne};
}
function matchesStr(labels, sel){
  labels = labels || {};
  for(const k in sel.eq){
    if(sel.eq[k] === undefined){ if(labels[k] === undefined) return false; continue; }
    if(String(labels[k]) !== sel.eq[k]) return false;
  }
  for(const k in sel.ne) if(String(labels[k]) === sel.ne[k]) return false;
  return true;
}

/* ── величины ресурсов ─────────────────────────────────── */
/* cpu: 100m, 0.5, 1 → миллиядра; память: 128Mi, 1Gi, 512M → мегабайты */
function cpuOf(v){
  if(v === undefined || v === null) return 0;
  const s = String(v).trim();
  if(/m$/.test(s)) return parseFloat(s) || 0;
  return Math.round((parseFloat(s) || 0) * 1000);
}
function memOf(v){
  if(v === undefined || v === null) return 0;
  const s = String(v).trim();
  const n = parseFloat(s) || 0;
  if(/Gi$/.test(s)) return Math.round(n * 1024);
  if(/Mi$/.test(s)) return Math.round(n);
  if(/Ki$/.test(s)) return Math.round(n / 1024);
  if(/G$/.test(s))  return Math.round(n * 1000);
  if(/M$/.test(s))  return Math.round(n * 1000 / 1024);
  return Math.round(n / 1048576);
}
function podRequests(pod){
  let cpu = 0, mem = 0;
  for(const c of ((pod.spec || {}).containers || [])){
    const r = (c.resources || {}).requests || {};
    cpu += cpuOf(r.cpu); mem += memOf(r.memory);
  }
  return {cpu, mem};
}
function podLimits(pod){
  let cpu = 0, mem = 0, any = false;
  for(const c of ((pod.spec || {}).containers || [])){
    const l = (c.resources || {}).limits || {};
    if(l.cpu !== undefined || l.memory !== undefined) any = true;
    cpu += cpuOf(l.cpu); mem += memOf(l.memory);
  }
  return {cpu, mem, any};
}
/* класс обслуживания: определяет, кого вытеснят первым */
function qosOf(pod){
  const cs = ((pod.spec || {}).containers || []);
  let allEqual = cs.length > 0, anyReq = false;
  for(const c of cs){
    const r = (c.resources || {}).requests || {}, l = (c.resources || {}).limits || {};
    const rc = cpuOf(r.cpu), rm = memOf(r.memory), lc = cpuOf(l.cpu), lm = memOf(l.memory);
    if(rc || rm) anyReq = true;
    if(!lc || !lm || rc !== lc || rm !== lm) allEqual = false;
  }
  if(allEqual) return "Guaranteed";
  if(anyReq) return "Burstable";
  return "BestEffort";
}

/* ── имена ─────────────────────────────────────────────── */
const RNDA = "abcdefghijklmnopqrstuvwxyz0123456789";
function suffix(C, n){
  /* детерминированно: зависит только от счётчика кластера */
  let s = "", x = ++C.uid * 2654435761 >>> 0;
  for(let i = 0; i < n; i++){ s += RNDA[x % 36]; x = Math.imul(x, 48271) >>> 0; }
  return s;
}
function podTemplateHash(C, tmpl){
  const s = JSON.stringify(tmpl || {});
  let h = 2166136261;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h = h >>> 0;
  let out = "";
  for(let i = 0; i < 9; i++){ out += RNDA[h % 36]; h = Math.imul(h, 48271) >>> 0; }
  return out;
}
const validName = n => /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(String(n || "")) && String(n).length <= 63;
