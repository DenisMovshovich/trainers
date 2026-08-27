
/* ============================================================
   Цикл согласования: контроллеры, планировщик, kubelet
   Здесь и живёт главная идея Kubernetes — желаемое состояние
   приводится к фактическому раз за разом, а не одной командой.
   ============================================================ */

function ownerRef(o){
  return {apiVersion: o.apiVersion, kind: o.kind, name: o.metadata.name,
          uid: o.metadata.uid, controller: true};
}
const ownedBy = (child, parent) =>
  (child.metadata.ownerReferences || []).some(r => r.kind === parent.kind && r.name === parent.metadata.name);

/* ── контроллер Deployment ─────────────────────────────── */
function reconcileDeployment(C, d){
  const ns = d.metadata.namespace;
  const want = d.spec.replicas === undefined ? 1 : d.spec.replicas;
  const hash = podTemplateHash(C, d.spec.template);
  const mine = list(C, "ReplicaSet", ns).filter(r => ownedBy(r, d));

  let cur = mine.filter(r => r.metadata.labels["pod-template-hash"] === hash)[0];
  if(!cur){
    cur = put(C, {
      apiVersion: "apps/v1", kind: "ReplicaSet",
      metadata: {name: d.metadata.name + "-" + hash, namespace: ns,
                 labels: Object.assign({}, d.spec.template.metadata && d.spec.template.metadata.labels,
                                       {"pod-template-hash": hash}),
                 ownerReferences: [ownerRef(d)], created: C.now},
      spec: {replicas: 0,
             selector: {matchLabels: Object.assign({}, (d.spec.selector || {}).matchLabels,
                                                   {"pod-template-hash": hash})},
             template: JSON.parse(JSON.stringify(d.spec.template))},
      status: {replicas: 0, readyReplicas: 0}
    });
    cur.spec.template.metadata = cur.spec.template.metadata || {};
    cur.spec.template.metadata.labels = Object.assign({}, cur.spec.template.metadata.labels,
                                                      {"pod-template-hash": hash});
    event(C, d, "Normal", "ScalingReplicaSet", "Scaled up replica set " + cur.metadata.name + " to " + want);
  }
  const old = mine.filter(r => r !== cur);

  /* плавное обновление: новый набор растёт, старый уменьшается */
  const strategy = (d.spec.strategy || {}).type || "RollingUpdate";
  if(strategy === "Recreate"){
    let oldAlive = 0;
    for(const r of old){ if(r.spec.replicas > 0){ r.spec.replicas = 0; } oldAlive += (r.status.replicas || 0); }
    cur.spec.replicas = oldAlive > 0 ? 0 : want;
  } else {
    const ru = (d.spec.strategy || {}).rollingUpdate || {};
    const maxSurge = pctOr(ru.maxSurge, want, 1);
    const maxUnavail = pctOr(ru.maxUnavailable, want, 1);
    /* Арифметика ведётся по ЗАКАЗАННОМУ числу реплик, а не по фактическим подам:
       поды удаляются с задержкой, и повторный проход по фактическим числам
       погасил бы старый набор дважды. По заказанному согласование идемпотентно. */
    const podsOf = r => list(C, "Pod", ns).filter(p => ownedBy(p, r) &&
      matches(p.metadata.labels, r.spec.selector) && !p.metadata.deleting);
    const desired = () => mine.concat(mine.indexOf(cur) < 0 ? [cur] : [])
                              .reduce((n, r) => n + (r.spec.replicas || 0), 0);

    /* сколько можно поднять сверх желаемого */
    const room = want + maxSurge - desired();
    if(cur.spec.replicas < want) cur.spec.replicas = Math.min(want, cur.spec.replicas + Math.max(room, 0));
    if(cur.spec.replicas > want) cur.spec.replicas = want;

    /* сколько можно погасить, не опустившись ниже порога доступности.
       Недоступные поды НОВОГО набора вычитаются: пока они не готовы,
       гасить старые нельзя — иначе сломанная выкатка уронила бы сервис. */
    const minAvailable = want - maxUnavail;
    const newUnavailable = Math.max(0, (cur.spec.replicas || 0) - podsOf(cur).filter(podReady).length);
    let canKill = desired() - minAvailable - newUnavailable;
    for(const r of old){
      if(canKill <= 0) break;
      if(r.spec.replicas <= 0) continue;
      const kill = Math.min(r.spec.replicas, canKill);
      r.spec.replicas -= kill;
      canKill -= kill;
    }
  }

  /* уборка пустых старых наборов, кроме нескольких про запас */
  const limit = d.spec.revisionHistoryLimit === undefined ? 10 : d.spec.revisionHistoryLimit;
  const empty = old.filter(r => r.spec.replicas === 0 && (r.status.replicas || 0) === 0)
                   .sort((a, b) => a.metadata.created - b.metadata.created);
  while(empty.length > limit){ const r = empty.shift(); del(C, ns, "ReplicaSet", r.metadata.name); }

  const all = list(C, "ReplicaSet", ns).filter(r => ownedBy(r, d));
  d.status = d.status || {};
  d.status.replicas = all.reduce((n, r) => n + (r.status.replicas || 0), 0);
  d.status.readyReplicas = all.reduce((n, r) => n + (r.status.readyReplicas || 0), 0);
  d.status.updatedReplicas = cur.status.replicas || 0;
  d.status.availableReplicas = d.status.readyReplicas;
  d.status.observedGeneration = d.metadata.generation || 1;
  d.status.conditions = [
    {type: "Available", status: d.status.readyReplicas >= Math.max(want - 1, 1) || (want === 0 && true) ? "True" : "False",
     reason: d.status.readyReplicas ? "MinimumReplicasAvailable" : "MinimumReplicasUnavailable"},
    {type: "Progressing",
     status: d.status.updatedReplicas === want && d.status.readyReplicas === want ? "True" : "True",
     reason: d.status.updatedReplicas === want && d.status.readyReplicas === want
       ? "NewReplicaSetAvailable" : "ReplicaSetUpdated"}
  ];
  d.status.done = d.status.updatedReplicas === want && d.status.readyReplicas === want &&
                  d.status.replicas === want;
}
function pctOr(v, base, def){
  if(v === undefined || v === null) return def;
  const s = String(v);
  if(/%$/.test(s)) return Math.max(0, Math.floor(base * parseFloat(s) / 100));
  return parseInt(s, 10) || 0;
}

/* ── контроллер ReplicaSet ─────────────────────────────── */
function reconcileRS(C, rs){
  const ns = rs.metadata.namespace;
  const want = rs.spec.replicas === undefined ? 1 : rs.spec.replicas;
  for(const p of list(C, "Pod", ns)){
    if(!ownedBy(p, rs)) continue;
    if(matches(p.metadata.labels, rs.spec.selector)) continue;
    p.metadata.ownerReferences = (p.metadata.ownerReferences || [])
      .filter(r => !(r.kind === rs.kind && r.name === rs.metadata.name));
    event(C, rs, "Normal", "Released", "Pod " + p.metadata.name + " больше не подходит под селектор");
  }
  let mine = list(C, "Pod", ns).filter(p => ownedBy(p, rs) && !p.metadata.deleting &&
                                            matches(p.metadata.labels, rs.spec.selector));

  while(mine.length < want){
    const tmpl = rs.spec.template || {};
    const p = put(C, {
      apiVersion: "v1", kind: "Pod",
      metadata: {name: rs.metadata.name + "-" + suffix(C, 5), namespace: ns,
                 labels: Object.assign({}, (tmpl.metadata || {}).labels),
                 annotations: Object.assign({}, (tmpl.metadata || {}).annotations),
                 ownerReferences: [ownerRef(rs)], created: C.now},
      spec: JSON.parse(JSON.stringify(tmpl.spec || {})),
      status: {phase: "Pending", conditions: [], containerStatuses: [], restarts: 0}
    });
    event(C, rs, "Normal", "SuccessfulCreate", "Created pod: " + p.metadata.name);
    mine.push(p);
  }
  while(mine.length > want){
    /* гасим сначала неготовые — так делает и настоящий контроллер */
    mine.sort((a, b) => (podReady(a) ? 1 : 0) - (podReady(b) ? 1 : 0) || b.metadata.created - a.metadata.created);
    const p = mine.shift();
    del(C, ns, "Pod", p.metadata.name);
    event(C, rs, "Normal", "SuccessfulDelete", "Deleted pod: " + p.metadata.name);
  }
  rs.status = rs.status || {};
  rs.status.replicas = mine.length;
  rs.status.readyReplicas = mine.filter(podReady).length;
  rs.status.availableReplicas = rs.status.readyReplicas;
}

/* ── планировщик ───────────────────────────────────────── */
function freeOn(C, node){
  let cpu = node.cpu, mem = node.mem;
  for(const p of list(C, "Pod", "*")){
    if(p.spec.nodeName !== node.name) continue;
    if(p.status.phase === "Succeeded" || p.status.phase === "Failed") continue;
    const r = podRequests(p);
    cpu -= r.cpu; mem -= r.mem;
  }
  return {cpu, mem};
}
function tolerates(pod, taint){
  for(const t of (pod.spec.tolerations || [])){
    const keyOk = t.key === undefined || t.key === taint.key;
    const opOk = t.operator === "Exists" || t.value === undefined || String(t.value) === String(taint.value);
    const effOk = t.effect === undefined || t.effect === taint.effect;
    if(keyOk && opOk && effOk) return true;
  }
  return false;
}
function schedule(C, pod){
  if(pod.spec.nodeName) return;
  const req = podRequests(pod);
  const why = [];
  const fits = [];
  for(const n of C.nodes){
    if(!n.ready){ why.push("node(s) were not ready"); continue; }
    const sel = pod.spec.nodeSelector;
    if(sel && !matches(n.labels, sel)){ why.push("node(s) didn't match Pod's node affinity/selector"); continue; }
    const bad = (n.taints || []).filter(t => t.effect !== "PreferNoSchedule" && !tolerates(pod, t));
    if(bad.length){ why.push("node(s) had untolerated taint {" + bad[0].key + ": " + (bad[0].value || "") + "}"); continue; }
    const f = freeOn(C, n);
    if(f.cpu < req.cpu){ why.push("Insufficient cpu"); continue; }
    if(f.mem < req.mem){ why.push("Insufficient memory"); continue; }
    fits.push({n, f});
  }
  if(!fits.length){
    pod.status.phase = "Pending";
    pod.status.reason = "Unschedulable";
    const uniq = Array.from(new Set(why));
    pod.status.message = "0/" + C.nodes.length + " nodes are available: " + uniq.join(", ") + ".";
    if(!pod.status.warned){
      pod.status.warned = true;
      event(C, pod, "Warning", "FailedScheduling", pod.status.message);
    }
    return;
  }
  /* самый свободный узел — приближение к LeastAllocated */
  fits.sort((a, b) => (b.f.cpu + b.f.mem) - (a.f.cpu + a.f.mem));
  pod.spec.nodeName = fits[0].n.name;
  pod.status.reason = null;
  pod.status.message = null;
  pod.status.startedAt = C.now;
  event(C, pod, "Normal", "Scheduled", "Successfully assigned " +
    pod.metadata.namespace + "/" + pod.metadata.name + " to " + pod.spec.nodeName);
}

/* ── kubelet: что происходит с контейнерами ────────────── */
function probeOk(img, probe){
  if(!probe) return true;
  if(probe.httpGet){
    const path = probe.httpGet.path || "/";
    return (img.paths || []).indexOf(path) >= 0;
  }
  if(probe.tcpSocket) return !!img.port;
  if(probe.exec) return true;
  return true;
}
function runKubelet(C, pod){
  if(!pod.spec.nodeName) return;
  if(pod.status.phase === "Succeeded" || pod.status.phase === "Failed") return;
  const cs = [];
  let running = true, ready = true, waitReason = null;

  for(const c of (pod.spec.containers || [])){
    const img = IMAGES[c.image];
    const st = {name: c.name, image: c.image, restartCount: 0, ready: false, state: {}};

    if(!img){
      st.state = {waiting: {reason: "ImagePullBackOff",
        message: 'Back-off pulling image "' + c.image + '"'}};
      running = false; ready = false; waitReason = "ImagePullBackOff";
      if(!pod.status.pullWarned){
        pod.status.pullWarned = true;
        event(C, pod, "Warning", "Failed", 'Failed to pull image "' + c.image + '": not found in registry');
      }
      cs.push(st); continue;
    }
    const lim = (c.resources || {}).limits || {};
    const memLim = memOf(lim.memory);
    if(memLim && memLim < img.mem){
      if(pod.status.lastRestartAt !== C.now){
        pod.status.restarts = (pod.status.restarts || 0) + 1;
        pod.status.lastRestartAt = C.now;
      }
      st.restartCount = pod.status.restarts;
      st.state = {waiting: {reason: "CrashLoopBackOff", message: "back-off restarting failed container"}};
      st.lastState = {terminated: {reason: "OOMKilled", exitCode: 137}};
      running = false; ready = false; waitReason = "CrashLoopBackOff";
      if(!pod.status.oomWarned){
        pod.status.oomWarned = true;
        event(C, pod, "Warning", "OOMKilling", "Container " + c.name + " exceeded memory limit " +
          lim.memory + " (образу нужно " + img.mem + "Mi)");
      }
      cs.push(st); continue;
    }
    if(img.crash || (c.command && /exit\s+[1-9]/.test(String(c.command)))){
      if(pod.status.lastRestartAt !== C.now){
        pod.status.restarts = (pod.status.restarts || 0) + 1;
        pod.status.lastRestartAt = C.now;
      }
      st.restartCount = pod.status.restarts;
      st.state = {waiting: {reason: "CrashLoopBackOff", message: "back-off restarting failed container"}};
      st.lastState = {terminated: {reason: "Error", exitCode: 1}};
      running = false; ready = false; waitReason = "CrashLoopBackOff";
      if(!pod.status.crashWarned){
        pod.status.crashWarned = true;
        event(C, pod, "Warning", "BackOff", "Back-off restarting failed container " + c.name);
      }
      cs.push(st); continue;
    }

    st.state = {running: {startedAt: pod.status.startedAt}};

    /* проба готовности решает, попадёт ли под в Service */
    const rp = c.readinessProbe;
    let rOk = probeOk(img, rp);
    if(rOk && rp && img.slowStart && (C.now - (pod.status.startedAt || 0)) < ((rp.initialDelaySeconds || 0) + 2)) rOk = false;
    st.ready = rOk;
    if(!rOk){
      ready = false;
      if(rp && !probeOk(img, rp) && !pod.status.probeWarned){
        pod.status.probeWarned = true;
        event(C, pod, "Warning", "Unhealthy", "Readiness probe failed: HTTP probe failed with statuscode: 404");
      }
    }
    /* проба живости перезапускает контейнер */
    const lp = c.livenessProbe;
    if(lp && !probeOk(img, lp)){
      if(pod.status.lastRestartAt !== C.now){
        pod.status.restarts = (pod.status.restarts || 0) + 1;
        pod.status.lastRestartAt = C.now;
      }
      st.restartCount = pod.status.restarts;
      st.ready = false; ready = false; running = false;
      st.state = {waiting: {reason: "CrashLoopBackOff", message: "liveness probe failed"}};
      waitReason = "CrashLoopBackOff";
      if(!pod.status.liveWarned){
        pod.status.liveWarned = true;
        event(C, pod, "Warning", "Unhealthy", "Liveness probe failed: HTTP probe failed with statuscode: 404");
      }
    }
    cs.push(st);
  }

  pod.status.containerStatuses = cs;
  if(pod.spec.restartPolicy === "Never" || pod.spec.restartPolicy === "OnFailure"){
    /* разовая задача завершается сама */
    if(running && ready){
      pod.status.phase = "Succeeded";
      pod.status.reason = "Completed";
      for(const s of cs){ s.state = {terminated: {reason: "Completed", exitCode: 0}}; s.ready = false; }
      return;
    }
  }
  pod.status.phase = running ? "Running" : (waitReason === "CrashLoopBackOff" ? "Running" : "Pending");
  pod.status.reason = running ? null : waitReason;
  pod.status.conditions = [{type: "Ready", status: (running && ready) ? "True" : "False"}];
}
const podReady = p => (p.status.conditions || []).some(c => c.type === "Ready" && c.status === "True");
const podPhase = p => {
  if(p.metadata.deleting) return "Terminating";
  const w = (p.status.containerStatuses || []).map(c => (c.state.waiting || {}).reason).filter(Boolean);
  if(w.length) return w[0];
  return p.status.phase || "Pending";
};

/* ── Service: подбор конечных точек ────────────────────── */
function reconcileService(C, svc){
  const ns = svc.metadata.namespace;
  const sel = svc.spec.selector;
  if(!sel){ svc.status.endpoints = []; return; }
  const eps = list(C, "Pod", ns)
    .filter(p => matches(p.metadata.labels, sel) && podReady(p) && !p.metadata.deleting)
    .map(p => ({pod: p.metadata.name, ip: podIp(p)}));
  svc.status = svc.status || {};
  svc.status.endpoints = eps;
  if(!eps.length && !svc.status.emptyWarned){
    svc.status.emptyWarned = true;
    event(C, svc, "Warning", "NoEndpoints", "Нет готовых подов, подходящих под селектор");
  }
  if(eps.length) svc.status.emptyWarned = false;
}
function podIp(p){
  let h = 0;
  const s = p.metadata.name;
  for(let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return "10.1." + (h % 250) + "." + ((h >> 8) % 250 + 1);
}
function clusterIp(svc){
  let h = 0;
  const s = svc.metadata.namespace + "/" + svc.metadata.name;
  for(let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return "10.96." + (h % 250) + "." + ((h >> 8) % 250 + 1);
}

/* ── Job ───────────────────────────────────────────────── */
function reconcileJob(C, job){
  const ns = job.metadata.namespace;
  const want = job.spec.completions === undefined ? 1 : job.spec.completions;
  let mine = list(C, "Pod", ns).filter(p => ownedBy(p, job));
  const done = mine.filter(p => p.status.phase === "Succeeded").length;
  const active = mine.filter(p => p.status.phase !== "Succeeded" && p.status.phase !== "Failed").length;
  if(done < want && active === 0 && mine.length < want + 6){
    const tmpl = job.spec.template || {};
    const spec = JSON.parse(JSON.stringify(tmpl.spec || {}));
    if(!spec.restartPolicy) spec.restartPolicy = "Never";
    const p = put(C, {
      apiVersion: "v1", kind: "Pod",
      metadata: {name: job.metadata.name + "-" + suffix(C, 5), namespace: ns,
                 labels: Object.assign({"job-name": job.metadata.name}, (tmpl.metadata || {}).labels),
                 ownerReferences: [ownerRef(job)], created: C.now},
      spec, status: {phase: "Pending", conditions: [], containerStatuses: [], restarts: 0}
    });
    event(C, job, "Normal", "SuccessfulCreate", "Created pod: " + p.metadata.name);
  }
  job.status = job.status || {};
  job.status.succeeded = done;
  job.status.active = active;
}

/* ── общий проход ──────────────────────────────────────── */
function reconcile(C, passes){
  for(let i = 0; i < (passes || 6); i++){
    for(const d of list(C, "Deployment", "*")) reconcileDeployment(C, d);
    for(const j of list(C, "Job", "*")) reconcileJob(C, j);
    for(const rs of list(C, "ReplicaSet", "*")) reconcileRS(C, rs);
    for(const p of list(C, "Pod", "*")){ schedule(C, p); runKubelet(C, p); }
    for(const rs of list(C, "ReplicaSet", "*")) reconcileRS(C, rs);
    for(const d of list(C, "Deployment", "*")) reconcileDeployment(C, d);
    for(const s of list(C, "Service", "*")) reconcileService(C, s);
  }
}
