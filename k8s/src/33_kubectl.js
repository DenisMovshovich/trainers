
/* ============================================================
   kubectl
   ============================================================ */
const ALIAS = {
  po:"Pod", pod:"Pod", pods:"Pod",
  deploy:"Deployment", deployment:"Deployment", deployments:"Deployment",
  rs:"ReplicaSet", replicaset:"ReplicaSet", replicasets:"ReplicaSet",
  svc:"Service", service:"Service", services:"Service",
  cm:"ConfigMap", configmap:"ConfigMap", configmaps:"ConfigMap",
  secret:"Secret", secrets:"Secret",
  ns:"Namespace", namespace:"Namespace", namespaces:"Namespace",
  no:"Node", node:"Node", nodes:"Node",
  job:"Job", jobs:"Job",
  pvc:"PersistentVolumeClaim", persistentvolumeclaim:"PersistentVolumeClaim",
  ing:"Ingress", ingress:"Ingress",
  ep:"Endpoints", endpoints:"Endpoints",
  event:"Event", events:"Event",
  all:"all"
};
const kindOf = w => ALIAS[String(w || "").toLowerCase()] || null;

function tokenize(line){
  const out = []; let cur = "", q = null, has = false;
  for(let i = 0; i < line.length; i++){
    const c = line[i];
    if(q){ if(c === q) q = null; else cur += c; continue; }
    if(c === '"' || c === "'"){ q = c; has = true; continue; }
    if(/\s/.test(c)){ if(cur || has){ out.push(cur); cur = ""; has = false; } continue; }
    cur += c;
  }
  if(q) kerr("незакрытая кавычка");
  if(cur || has) out.push(cur);
  return out;
}
function parseArgs(tokens){
  const flags = {}, opts = {}, args = [];
  const VAL = {n:1, o:1, l:1, f:1, c:1, "from-literal":1, "from-file":1, image:1, port:1,
               replicas:1, namespace:1, output:1, selector:1, filename:1, container:1,
               "target-port":1, type:1, "dry-run":1, revision:1, "current-namespace":1};
  for(let i = 0; i < tokens.length; i++){
    const t = tokens[i];
    if(t.indexOf("--") === 0){
      const body = t.slice(2), eq = body.indexOf("=");
      if(eq > 0){ const k = body.slice(0, eq), v = body.slice(eq + 1);
        if(opts[k] !== undefined) opts[k] = [].concat(opts[k], v); else opts[k] = v;
        continue; }
      if(VAL[body] && tokens[i + 1] !== undefined && tokens[i + 1][0] !== "-"){ opts[body] = tokens[++i]; continue; }
      flags[body] = true; continue;
    }
    if(t[0] === "-" && t.length > 1){
      const letters = t.slice(1);
      if(VAL[letters[0]] && letters.length > 1){ opts[letters[0]] = letters.slice(1); continue; }
      for(let k = 0; k < letters.length; k++){
        const c = letters[k];
        if(VAL[c] && k === letters.length - 1 && tokens[i + 1] !== undefined){ opts[c] = tokens[++i]; }
        else flags[c] = true;
      }
      continue;
    }
    args.push(t);
  }
  if(opts.namespace && !opts.n) opts.n = opts.namespace;
  if(opts.output && !opts.o) opts.o = opts.output;
  if(opts.selector && !opts.l) opts.l = opts.selector;
  if(opts.filename && !opts.f) opts.f = opts.filename;
  if(opts.container && !opts.c) opts.c = opts.container;
  return {flags, opts, args};
}

/* «deploy/web» → {kind, name} */
function target(C, a, i){
  const w = a.args[i];
  if(!w) return null;
  if(w.indexOf("/") > 0){
    const [k, n] = w.split("/");
    const kind = kindOf(k);
    if(!kind) kerr('the server doesn\'t have a resource type "' + k + '"');
    return {kind, name: n};
  }
  const kind = kindOf(w);
  if(!kind) kerr('the server doesn\'t have a resource type "' + w + '"',
    "Список того, что понимает тренажёр, — в правой колонке.");
  return {kind, name: a.args[i + 1] || null};
}
const nsOf = (C, a) => a.opts.n || C.ns;

/* ── таблицы ───────────────────────────────────────────── */
function table(rows){
  if(!rows.length) return [];
  const w = [];
  for(const r of rows) r.forEach((c, i) => { w[i] = Math.max(w[i] || 0, String(c).length); });
  return rows.map(r => r.map((c, i) => i === r.length - 1 ? String(c) : String(c).padEnd(w[i] + 3)).join("").replace(/\s+$/, ""));
}
const age = (C, o) => {
  const s = C.now - (o.metadata.created || 0);
  if(s < 60) return Math.max(s, 0) + "s";
  if(s < 3600) return Math.floor(s / 60) + "m";
  if(s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
};

function rowsFor(C, kind, items, a){
  const wide = a.opts.o === "wide";
  const allNs = a.flags.A || a.flags["all-namespaces"];
  const pre = allNs ? ["NAMESPACE"] : [];
  const preOf = o => allNs ? [o.metadata.namespace || ""] : [];

  if(kind === "Pod"){
    const head = pre.concat(["NAME","READY","STATUS","RESTARTS","AGE"]).concat(wide ? ["IP","NODE"] : []);
    return [head].concat(items.map(p => {
      const cs = p.status.containerStatuses || [];
      const ready = cs.filter(c => c.ready).length + "/" + Math.max(cs.length, (p.spec.containers || []).length);
      return preOf(p).concat([p.metadata.name, ready, podPhase(p), String(p.status.restarts || 0), age(C, p)])
        .concat(wide ? [p.spec.nodeName ? podIp(p) : "<none>", p.spec.nodeName || "<none>"] : []);
    }));
  }
  if(kind === "Deployment"){
    const head = pre.concat(["NAME","READY","UP-TO-DATE","AVAILABLE","AGE"]);
    return [head].concat(items.map(d => preOf(d).concat([
      d.metadata.name,
      (d.status.readyReplicas || 0) + "/" + (d.spec.replicas === undefined ? 1 : d.spec.replicas),
      String(d.status.updatedReplicas || 0), String(d.status.availableReplicas || 0), age(C, d)])));
  }
  if(kind === "ReplicaSet"){
    const head = pre.concat(["NAME","DESIRED","CURRENT","READY","AGE"]);
    return [head].concat(items.map(r => preOf(r).concat([
      r.metadata.name, String(r.spec.replicas || 0), String(r.status.replicas || 0),
      String(r.status.readyReplicas || 0), age(C, r)])));
  }
  if(kind === "Service"){
    const head = pre.concat(["NAME","TYPE","CLUSTER-IP","EXTERNAL-IP","PORT(S)","AGE"]).concat(wide ? ["SELECTOR"] : []);
    return [head].concat(items.map(s => {
      const t = s.spec.type || "ClusterIP";
      const ports = (s.spec.ports || []).map(p =>
        p.port + (t === "NodePort" && p.nodePort ? ":" + p.nodePort : "") + "/" + (p.protocol || "TCP")).join(",");
      const ext = t === "LoadBalancer" ? "203.0.113." + (10 + items.indexOf(s)) : "<none>";
      return preOf(s).concat([s.metadata.name, t, clusterIp(s), ext, ports || "<none>", age(C, s)])
        .concat(wide ? [Object.keys(s.spec.selector || {}).map(k => k + "=" + s.spec.selector[k]).join(",") || "<none>"] : []);
    }));
  }
  if(kind === "Node"){
    const head = ["NAME","STATUS","ROLES","AGE","VERSION"].concat(wide ? ["CPU","MEMORY","TAINTS"] : []);
    return [head].concat(C.nodes.map(n => {
      const f = freeOn(C, n);
      return [n.name, n.ready ? "Ready" : "NotReady", "<none>", "10d", "v1.29.4"]
        .concat(wide ? [(n.cpu - f.cpu) + "m/" + n.cpu + "m", (n.mem - f.mem) + "Mi/" + n.mem + "Mi",
                        (n.taints || []).map(t => t.key + "=" + (t.value || "") + ":" + t.effect).join(",") || "<none>"] : []);
    }));
  }
  if(kind === "ConfigMap" || kind === "Secret"){
    const head = pre.concat(["NAME","DATA","AGE"]).concat(kind === "Secret" ? [] : []);
    return [head].concat(items.map(o => preOf(o).concat([
      o.metadata.name, String(Object.keys(o.data || {}).length), age(C, o)])));
  }
  if(kind === "Job"){
    const head = pre.concat(["NAME","COMPLETIONS","DURATION","AGE"]);
    return [head].concat(items.map(j => preOf(j).concat([
      j.metadata.name, (j.status.succeeded || 0) + "/" + (j.spec.completions === undefined ? 1 : j.spec.completions),
      (C.now - (j.metadata.created || 0)) + "s", age(C, j)])));
  }
  if(kind === "Namespace"){
    return [["NAME","STATUS","AGE"]].concat(items.map(o => [o.metadata.name, "Active", age(C, o)]));
  }
  if(kind === "Endpoints"){
    return [pre.concat(["NAME","ENDPOINTS","AGE"])].concat(items.map(s => preOf(s).concat([
      s.metadata.name,
      ((s.status || {}).endpoints || []).map(e => e.ip + ":" + (((s.spec.ports || [])[0] || {}).targetPort || 80)).join(",") || "<none>",
      age(C, s)])));
  }
  const head = pre.concat(["NAME","AGE"]);
  return [head].concat(items.map(o => preOf(o).concat([o.metadata.name, age(C, o)])));
}

/* ── get ───────────────────────────────────────────────── */
function cmdGet(C, a){
  const t = target(C, a, 0);
  if(!t) kerr("You must specify the type of resource to get.",
    "Например: kubectl get pods, kubectl get deploy, kubectl get svc.");
  if(t.kind === "Event") return cmdEvents(C, a);
  const ns = (a.flags.A || a.flags["all-namespaces"]) ? "*" : nsOf(C, a);

  if(t.kind === "all"){
    const out = [];
    for(const k of ["Deployment","ReplicaSet","Pod","Service"]){
      const items = list(C, k, ns);
      if(!items.length) continue;
      if(out.length) out.push("");
      for(const l of table(rowsFor(C, k, items, a))) out.push(l);
    }
    return {out: out.length ? out : ["No resources found in " + nsOf(C, a) + " namespace."]};
  }

  let items = t.kind === "Node" ? [{metadata:{name:"-"}}] : list(C, t.kind, ns);
  if(t.kind === "Endpoints") items = list(C, "Service", ns);
  if(t.name){
    items = items.filter(o => o.metadata.name === t.name);
    if(!items.length) kerr('Error from server (NotFound): ' + t.kind.toLowerCase() + 's "' + t.name + '" not found');
  }
  if(a.opts.l){
    const sel = parseSelector(a.opts.l);
    items = items.filter(o => matchesStr(o.metadata.labels, sel));
  }
  if(a.opts.o === "yaml" || a.opts.o === "json"){
    const clean = items.map(o => JSON.parse(JSON.stringify(o, (k, v) =>
      ["warned","pullWarned","crashWarned","oomWarned","probeWarned","liveWarned","emptyWarned","deleting","created","done"].indexOf(k) >= 0 ? undefined : v)));
    if(a.opts.o === "json") return {out: JSON.stringify(clean.length === 1 ? clean[0] : {items: clean}, null, 2).split("\n")};
    return {out: clean.map(o => toYaml(o)).join("\n---\n").split("\n")};
  }
  if(t.kind !== "Node" && !items.length)
    return {out: ["No resources found in " + nsOf(C, a) + " namespace."]};
  return {out: table(rowsFor(C, t.kind, items, a))};
}

function cmdEvents(C, a){
  const ns = (a.flags.A || a.flags["all-namespaces"]) ? null : nsOf(C, a);
  const evs = C.events.filter(e => !ns || e.ns === ns || e.ns === "").slice(-25);
  if(!evs.length) return {out: ["No events found in " + (ns || "all") + " namespace."]};
  return {out: table([["LAST SEEN","TYPE","REASON","OBJECT","MESSAGE"]].concat(
    evs.map(e => [(C.now - e.ts) + "s", e.type, e.reason,
                  e.kind.toLowerCase() + "/" + e.name, e.msg])))};
}

/* ── describe ──────────────────────────────────────────── */
function cmdDescribe(C, a){
  const t = target(C, a, 0);
  if(!t || !t.name) kerr("You must specify the type and name of the resource.");
  const ns = nsOf(C, a);
  const out = [];
  if(t.kind === "Node"){
    const n = C.nodes.filter(x => x.name === t.name)[0];
    if(!n) kerr('Error from server (NotFound): nodes "' + t.name + '" not found');
    const f = freeOn(C, n);
    out.push("Name:               " + n.name);
    out.push("Labels:             " + Object.keys(n.labels).map(k => k + "=" + n.labels[k]).join("\n                    "));
    out.push("Taints:             " + ((n.taints || []).map(x => x.key + "=" + (x.value || "") + ":" + x.effect).join(", ") || "<none>"));
    out.push("Capacity:");
    out.push("  cpu:              " + n.cpu + "m");
    out.push("  memory:           " + n.mem + "Mi");
    out.push("Allocated resources:");
    out.push("  cpu               " + (n.cpu - f.cpu) + "m (" + Math.round((n.cpu - f.cpu) / n.cpu * 100) + "%)");
    out.push("  memory            " + (n.mem - f.mem) + "Mi (" + Math.round((n.mem - f.mem) / n.mem * 100) + "%)");
    const pods = list(C, "Pod", "*").filter(p => p.spec.nodeName === n.name);
    out.push("Non-terminated Pods: (" + pods.length + " in total)");
    for(const p of pods) out.push("  " + (p.metadata.namespace || "default") + "/" + p.metadata.name);
    return {out};
  }
  const o = get(C, ns, t.kind, t.name);
  if(!o) kerr('Error from server (NotFound): ' + t.kind.toLowerCase() + 's "' + t.name + '" not found');

  out.push("Name:         " + o.metadata.name);
  if(isNamespaced(o.kind)) out.push("Namespace:    " + o.metadata.namespace);
  out.push("Labels:       " + (kv(o.metadata.labels) || "<none>"));
  out.push("Annotations:  " + (kv(o.metadata.annotations) || "<none>"));

  if(o.kind === "Pod"){
    out.push("Node:         " + (o.spec.nodeName || "<none>"));
    out.push("Status:       " + podPhase(o));
    if(o.status.message) out.push("Message:      " + o.status.message);
    out.push("IP:           " + (o.spec.nodeName ? podIp(o) : "<none>"));
    out.push("QoS Class:    " + qosOf(o));
    out.push("Containers:");
    for(const c of (o.spec.containers || [])){
      const st = (o.status.containerStatuses || []).filter(x => x.name === c.name)[0] || {};
      out.push("  " + c.name + ":");
      out.push("    Image:        " + c.image);
      out.push("    Port:         " + (((c.ports || [])[0] || {}).containerPort || "<none>"));
      out.push("    State:        " + stateOf(st));
      if(st.lastState && st.lastState.terminated)
        out.push("    Last State:   Terminated (" + st.lastState.terminated.reason +
                 ", exit code " + st.lastState.terminated.exitCode + ")");
      out.push("    Ready:        " + (st.ready ? "True" : "False"));
      out.push("    Restart Count: " + (st.restartCount || 0));
      const r = (c.resources || {});
      if(r.requests) out.push("    Requests:     cpu=" + (r.requests.cpu || "-") + ", memory=" + (r.requests.memory || "-"));
      if(r.limits) out.push("    Limits:       cpu=" + (r.limits.cpu || "-") + ", memory=" + (r.limits.memory || "-"));
      if(c.readinessProbe) out.push("    Readiness:    " + probeStr(c.readinessProbe));
      if(c.livenessProbe) out.push("    Liveness:     " + probeStr(c.livenessProbe));
      if(c.env && c.env.length) out.push("    Environment:  " + c.env.map(e =>
        e.name + "=" + (e.value !== undefined ? e.value : "<from " + srcName(e) + ">")).join(", "));
    }
    if(o.spec.volumes && o.spec.volumes.length){
      out.push("Volumes:");
      for(const v of o.spec.volumes) out.push("  " + v.name + ":  " + volKind(v));
    }
    if(o.spec.nodeSelector) out.push("Node-Selectors: " + kv(o.spec.nodeSelector));
    if(o.spec.tolerations) out.push("Tolerations:  " + o.spec.tolerations.map(t =>
      (t.key || "*") + (t.value ? "=" + t.value : "") + ":" + (t.effect || "*")).join(", "));
  }
  if(o.kind === "Deployment"){
    out.push("Replicas:     " + (o.spec.replicas === undefined ? 1 : o.spec.replicas) + " desired | " +
             (o.status.updatedReplicas || 0) + " updated | " + (o.status.replicas || 0) + " total | " +
             (o.status.availableReplicas || 0) + " available");
    out.push("StrategyType: " + ((o.spec.strategy || {}).type || "RollingUpdate"));
    const ru = (o.spec.strategy || {}).rollingUpdate || {};
    if(((o.spec.strategy || {}).type || "RollingUpdate") === "RollingUpdate")
      out.push("RollingUpdateStrategy: " + (ru.maxUnavailable === undefined ? "25%" : ru.maxUnavailable) +
               " max unavailable, " + (ru.maxSurge === undefined ? "25%" : ru.maxSurge) + " max surge");
    out.push("Selector:     " + kv((o.spec.selector || {}).matchLabels));
    out.push("Pod Template:");
    out.push("  Labels:  " + kv(((o.spec.template || {}).metadata || {}).labels));
    for(const c of (((o.spec.template || {}).spec || {}).containers || [])){
      out.push("  Container " + c.name + ":");
      out.push("    Image:  " + c.image);
    }
    out.push("Conditions:");
    for(const c of (o.status.conditions || [])) out.push("  " + c.type + "  " + c.status + "  " + c.reason);
    const rss = list(C, "ReplicaSet", ns).filter(r => ownedBy(r, o));
    out.push("OldReplicaSets:  " + (rss.filter(r => r.spec.replicas === 0).map(r => r.metadata.name).join(", ") || "<none>"));
    out.push("NewReplicaSet:   " + (rss.filter(r => r.spec.replicas > 0).map(r => r.metadata.name).join(", ") || "<none>"));
  }
  if(o.kind === "Service"){
    out.push("Type:         " + (o.spec.type || "ClusterIP"));
    out.push("Selector:     " + (kv(o.spec.selector) || "<none>"));
    out.push("IP:           " + clusterIp(o));
    for(const p of (o.spec.ports || []))
      out.push("Port:         " + (p.name || "<unset>") + "  " + p.port + "/" + (p.protocol || "TCP") +
               "  → targetPort " + (p.targetPort || p.port));
    const eps = (o.status.endpoints || []);
    out.push("Endpoints:    " + (eps.map(e => e.ip).join(", ") || "<none>"));
  }
  if(o.kind === "ConfigMap" || o.kind === "Secret"){
    out.push("Data");
    out.push("====");
    for(const k in (o.data || {}))
      out.push(k + ":\n----\n" + (o.kind === "Secret" ? String(o.data[k]).length + " bytes" : o.data[k]));
  }
  if(o.kind === "ReplicaSet"){
    out.push("Replicas:     " + (o.status.replicas || 0) + " current / " + (o.spec.replicas || 0) + " desired");
    out.push("Selector:     " + kv((o.spec.selector || {}).matchLabels));
  }

  const evs = C.events.filter(e => e.kind === o.kind && e.name === o.metadata.name).slice(-8);
  out.push("Events:");
  if(!evs.length) out.push("  <none>");
  else for(const l of table([["  Type","Reason","Age","Message"]].concat(
    evs.map(e => ["  " + e.type, e.reason, (C.now - e.ts) + "s", e.msg])))) out.push(l);
  return {out};
}
const kv = o => o ? Object.keys(o).map(k => k + "=" + o[k]).join(",") : "";
const stateOf = st => st.state && st.state.running ? "Running"
  : st.state && st.state.waiting ? "Waiting (" + st.state.waiting.reason + ")"
  : st.state && st.state.terminated ? "Terminated (" + st.state.terminated.reason + ")" : "Waiting";
const probeStr = p => p.httpGet ? "http-get " + (p.httpGet.path || "/") + ":" + (p.httpGet.port || 80) +
    " delay=" + (p.initialDelaySeconds || 0) + "s period=" + (p.periodSeconds || 10) + "s"
  : p.tcpSocket ? "tcp-socket :" + p.tcpSocket.port : "exec";
const srcName = e => {
  const f = e.valueFrom || {};
  if(f.configMapKeyRef) return "ConfigMap " + f.configMapKeyRef.name + "/" + f.configMapKeyRef.key;
  if(f.secretKeyRef) return "Secret " + f.secretKeyRef.name + "/" + f.secretKeyRef.key;
  return "?";
};
const volKind = v => v.configMap ? "ConfigMap (" + v.configMap.name + ")"
  : v.secret ? "Secret (" + v.secret.secretName + ")"
  : v.persistentVolumeClaim ? "PVC (" + v.persistentVolumeClaim.claimName + ")"
  : v.emptyDir ? "EmptyDir (исчезнет вместе с подом)" : "?";
