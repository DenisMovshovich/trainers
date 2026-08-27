
/* ============================================================
   Изменяющие команды
   ============================================================ */
const DEFAULTS = {
  Pod: o => { o.apiVersion = o.apiVersion || "v1"; o.spec = o.spec || {}; },
  Deployment: o => {
    o.apiVersion = o.apiVersion || "apps/v1";
    o.spec = o.spec || {};
    if(o.spec.replicas === undefined) o.spec.replicas = 1;
    if(!o.spec.selector) kerr('Deployment "' + o.metadata.name + '" не задан spec.selector',
      "Селектор обязателен: по нему Deployment находит свои поды. Обычно повторяет метки из template.");
    const tl = ((o.spec.template || {}).metadata || {}).labels;
    if(!matches(tl, o.spec.selector))
      kerr('Deployment "' + o.metadata.name + '" is invalid: selector не совпадает с метками шаблона пода',
        "spec.selector.matchLabels должен быть подмножеством spec.template.metadata.labels — иначе контроллер не увидит созданные им же поды.");
  },
  Service: o => {
    o.apiVersion = o.apiVersion || "v1";
    o.spec = o.spec || {};
    o.spec.type = o.spec.type || "ClusterIP";
    for(const p of (o.spec.ports || [])){
      if(!p.targetPort) p.targetPort = p.port;
      if(o.spec.type === "NodePort" && !p.nodePort) p.nodePort = 30000 + (p.port % 2000);
    }
  },
  ConfigMap: o => { o.apiVersion = o.apiVersion || "v1"; o.data = o.data || {}; },
  Secret: o => { o.apiVersion = o.apiVersion || "v1"; o.data = o.data || {}; },
  Job: o => { o.apiVersion = o.apiVersion || "batch/v1"; o.spec = o.spec || {}; },
  Namespace: o => { o.apiVersion = o.apiVersion || "v1"; },
  PersistentVolumeClaim: o => { o.apiVersion = o.apiVersion || "v1"; o.spec = o.spec || {};
    o.status = {phase: "Bound", capacity: ((o.spec.resources || {}).requests || {}).storage}; }
};

function applyDoc(C, doc, ns){
  if(!doc || typeof doc !== "object") kerr("пустой манифест");
  if(!doc.kind) kerr("в манифесте нет поля kind",
    "Любой объект начинается с apiVersion и kind — по ним API-сервер понимает, что вы прислали.");
  if(!doc.metadata || !doc.metadata.name) kerr("в манифесте нет metadata.name");
  if(!validName(doc.metadata.name))
    kerr('имя "' + doc.metadata.name + '" недопустимо',
      "Имена объектов — только строчные буквы, цифры, дефис и точка, не длиннее 63 символов.");
  const kind = doc.kind;
  if(!DEFAULTS[kind] && kind !== "ReplicaSet")
    kerr('тип "' + kind + '" тренажёр не поддерживает',
      "Поддерживаются: Pod, Deployment, Service, ConfigMap, Secret, Job, Namespace, PersistentVolumeClaim.");
  if(isNamespaced(kind)) doc.metadata.namespace = doc.metadata.namespace || ns;
  if(isNamespaced(kind) && !get(C, "", "Namespace", doc.metadata.namespace))
    kerr('namespaces "' + doc.metadata.namespace + '" not found',
      "Пространство имён создают заранее: kubectl create namespace <имя>.");

  const old = get(C, doc.metadata.namespace, kind, doc.metadata.name);
  const o = JSON.parse(JSON.stringify(doc));
  o.status = old ? old.status : {};
  o.metadata.created = old ? old.metadata.created : C.now;
  o.metadata.uid = old ? old.metadata.uid : "uid-" + (++C.uid);
  o.metadata.generation = old ? (old.metadata.generation || 1) + 1 : 1;
  if(DEFAULTS[kind]) DEFAULTS[kind](o);
  if(kind === "Deployment"){
    const tmpl = JSON.stringify(o.spec.template);
    if(!old){
      o.baseTemplate = JSON.parse(tmpl);
      o.history = [{rev: "1", cause: "<none>", template: JSON.parse(tmpl)}];
      o.metadata.annotations = Object.assign({"deployment.kubernetes.io/revision": "1"}, o.metadata.annotations);
    } else {
      o.baseTemplate = old.baseTemplate;
      o.history = old.history || [];
      if(JSON.stringify(old.spec.template) !== tmpl){
        put(C, o);
        bumpRevision(C, o, "kubectl apply");
      }
    }
  }
  put(C, o);
  const verb = old ? "configured" : "created";
  event(C, o, "Normal", old ? "Updated" : "Created", kind + " " + o.metadata.name + " " + verb);
  return kind.toLowerCase() + "/" + o.metadata.name + " " + verb;
}

function readFile(C, name){
  if(C.files[name] === undefined)
    kerr('error: the path "' + name + '" does not exist',
      "Манифесты лежат в панели «Манифест» внизу. Файлы этого сценария перечислены в списке.");
  return C.files[name];
}

function cmdApply(C, a){
  const f = a.opts.f;
  if(!f) kerr("error: must specify -f", 'Например: kubectl apply -f deploy.yaml');
  const names = [].concat(f);
  const out = [];
  for(const n of names){
    const docs = parseYaml(readFile(C, n));
    for(const d of docs) out.push(applyDoc(C, d, nsOf(C, a)));
  }
  return {out};
}

function cmdDelete(C, a){
  const out = [];
  if(a.opts.f){
    for(const n of [].concat(a.opts.f))
      for(const d of parseYaml(readFile(C, n))){
        const ns = d.metadata.namespace || nsOf(C, a);
        if(!get(C, ns, d.kind, d.metadata.name))
          kerr('Error from server (NotFound): ' + d.kind.toLowerCase() + 's "' + d.metadata.name + '" not found');
        removeCascade(C, ns, d.kind, d.metadata.name);
        out.push(d.kind.toLowerCase() + '"' + d.metadata.name + '" deleted');
      }
    return {out};
  }
  const t = target(C, a, 0);
  if(!t) kerr("You must specify the type of resource to delete.");
  const ns = nsOf(C, a);
  let items = list(C, t.kind, ns);
  if(a.opts.l) items = items.filter(o => matchesStr(o.metadata.labels, parseSelector(a.opts.l)));
  else if(t.name) items = items.filter(o => o.metadata.name === t.name);
  else if(!a.flags.all) kerr("resource(s) were provided, but no name was specified");
  if(!items.length && t.name)
    kerr('Error from server (NotFound): ' + t.kind.toLowerCase() + 's "' + t.name + '" not found');
  for(const o of items){
    removeCascade(C, ns, o.kind, o.metadata.name);
    out.push(o.kind.toLowerCase() + ' "' + o.metadata.name + '" deleted');
  }
  return {out};
}
/* удаление владельца уносит подчинённых — так работает сборка мусора по ownerReferences */
function removeCascade(C, ns, kind, name){
  const o = get(C, ns, kind, name);
  if(!o) return;
  del(C, ns, kind, name);
  for(const k in C.objects){
    const c = C.objects[k];
    if(isNamespaced(c.kind) && c.metadata.namespace !== o.metadata.namespace) continue;
    if(ownedBy(c, o)) removeCascade(C, c.metadata.namespace, c.kind, c.metadata.name);
  }
}

function cmdScale(C, a){
  const t = target(C, a, 0);
  const n = a.opts.replicas;
  if(n === undefined) kerr("error: must specify --replicas");
  const o = get(C, nsOf(C, a), t.kind, t.name);
  if(!o) kerr('Error from server (NotFound): ' + t.kind.toLowerCase() + 's "' + t.name + '" not found');
  o.spec.replicas = parseInt(n, 10);
  event(C, o, "Normal", "Scaled", "Scaled to " + o.spec.replicas + " replicas");
  return {out: [t.kind.toLowerCase() + "." + (t.kind === "Deployment" ? "apps" : "") + "/" + t.name + " scaled"]};
}

function cmdSet(C, a){
  if(a.args[0] !== "image") kerr("поддерживается только kubectl set image");
  const t = target(C, a, 1);
  const o = get(C, nsOf(C, a), t.kind, t.name);
  if(!o) kerr('Error from server (NotFound): ' + t.kind.toLowerCase() + 's "' + t.name + '" not found');
  let n = 0;
  for(const spec of a.args.slice(2)){
    const i = spec.indexOf("=");
    if(i < 0) kerr('неверный формат "' + spec + '"', "Нужно контейнер=образ, например web=nginx:1.26.");
    const cname = spec.slice(0, i), img = spec.slice(i + 1);
    for(const c of ((o.spec.template || {}).spec || {}).containers || [])
      if(c.name === cname || cname === "*"){ c.image = img; n++; }
  }
  if(!n) kerr("контейнер с таким именем не найден");
  o.metadata.generation = (o.metadata.generation || 1) + 1;
  bumpRevision(C, o, "kubectl set image");
  return {out: [t.kind.toLowerCase() + ".apps/" + t.name + " image updated"]};
}
function bumpRevision(C, d, cause){
  d.metadata.annotations = d.metadata.annotations || {};
  d.metadata.annotations["deployment.kubernetes.io/revision"] =
    String((parseInt(d.metadata.annotations["deployment.kubernetes.io/revision"] || "1", 10)) + 1);
  d.history = d.history || [];
  d.history.push({rev: d.metadata.annotations["deployment.kubernetes.io/revision"],
                  cause, template: JSON.parse(JSON.stringify(d.spec.template))});
  event(C, d, "Normal", "Updated", cause);
}

function cmdRollout(C, a){
  const sub = a.args[0];
  const t = target(C, a, 1);
  const ns = nsOf(C, a);
  const d = get(C, ns, t.kind, t.name);
  if(!d) kerr('Error from server (NotFound): ' + (t.kind || "deployment").toLowerCase() + 's "' + t.name + '" not found');

  if(sub === "status"){
    reconcile(C, 12);
    if(d.status.done) return {out: ['deployment "' + t.name + '" successfully rolled out']};
    return {out: ["Waiting for deployment \"" + t.name + "\" rollout to finish: " +
      (d.status.readyReplicas || 0) + " of " + d.spec.replicas + " updated replicas are available..."],
      warn: true};
  }
  if(sub === "history"){
    const h = d.history || [];
    return {out: ["deployment.apps/" + t.name].concat(
      table([["REVISION","CHANGE-CAUSE"]].concat(h.map(x => [x.rev, x.cause]))))};
  }
  if(sub === "undo"){
    const h = d.history || [];
    if(!h.length) kerr('error: no rollout history found for deployment "' + t.name + '"');
    const to = a.opts.revision
      ? h.filter(x => x.rev === String(a.opts.revision))[0]
      : null;
    /* без --to-revision откатываемся на предыдущий шаблон */
    const prev = to ? to.template : (h.length >= 2 ? h[h.length - 2].template : (d.baseTemplate || null));
    if(!prev) kerr("откатываться не на что");
    d.spec.template = JSON.parse(JSON.stringify(prev));
    bumpRevision(C, d, "kubectl rollout undo");
    return {out: ["deployment.apps/" + t.name + " rolled back"]};
  }
  if(sub === "restart"){
    d.spec.template.metadata = d.spec.template.metadata || {};
    d.spec.template.metadata.annotations = d.spec.template.metadata.annotations || {};
    d.spec.template.metadata.annotations["kubectl.kubernetes.io/restartedAt"] = "t" + C.now;
    bumpRevision(C, d, "kubectl rollout restart");
    return {out: ["deployment.apps/" + t.name + " restarted"]};
  }
  kerr("usage: kubectl rollout (status|history|undo|restart)");
}

function cmdCreate(C, a){
  const what = String(a.args[0] || "").toLowerCase();
  const name = a.args[1];
  const ns = nsOf(C, a);
  if(what === "namespace" || what === "ns"){
    if(get(C, "", "Namespace", name)) kerr('namespaces "' + name + '" already exists');
    put(C, nsObj(name)).metadata.created = C.now;
    return {out: ['namespace/' + name + " created"]};
  }
  if(what === "configmap" || what === "cm" || what === "secret"){
    const kind = what === "secret" ? "Secret" : "ConfigMap";
    const data = {};
    for(const lit of [].concat(a.opts["from-literal"] || [])){
      const i = String(lit).indexOf("=");
      if(i < 0) kerr('неверный формат "' + lit + '"', "Нужно ключ=значение.");
      data[String(lit).slice(0, i)] = String(lit).slice(i + 1);
    }
    const o = {apiVersion:"v1", kind, metadata:{name, namespace:ns, created:C.now}, data};
    DEFAULTS[kind](o);
    put(C, o);
    return {out: [kind.toLowerCase() + "/" + name + " created"]};
  }
  if(what === "deployment" || what === "deploy"){
    const img = a.opts.image;
    if(!img) kerr("error: --image is required");
    const o = {apiVersion:"apps/v1", kind:"Deployment",
      metadata:{name, namespace:ns, labels:{app:name}, created:C.now},
      spec:{replicas: parseInt(a.opts.replicas || "1", 10), selector:{matchLabels:{app:name}},
        template:{metadata:{labels:{app:name}}, spec:{containers:[{name, image:img}]}}}};
    DEFAULTS.Deployment(o);
    put(C, o);
    return {out: ["deployment.apps/" + name + " created"]};
  }
  if(what === "job"){
    const img = a.opts.image;
    if(!img) kerr("error: --image is required");
    const o = {apiVersion:"batch/v1", kind:"Job", metadata:{name, namespace:ns, created:C.now},
      spec:{template:{spec:{containers:[{name, image:img}], restartPolicy:"Never"}}}};
    put(C, o);
    return {out: ["job.batch/" + name + " created"]};
  }
  kerr('создание "' + what + '" не поддерживается',
    "Есть: namespace, configmap, secret, deployment, job. Остальное — через манифест и kubectl apply.");
}

function cmdExpose(C, a){
  const t = target(C, a, 0);
  const ns = nsOf(C, a);
  const o = get(C, ns, t.kind, t.name);
  if(!o) kerr('Error from server (NotFound): ' + t.kind.toLowerCase() + 's "' + t.name + '" not found');
  const port = parseInt(a.opts.port || "80", 10);
  const name = a.opts.name || t.name;
  const sel = t.kind === "Deployment" ? (o.spec.selector || {}).matchLabels : o.metadata.labels;
  const svc = {apiVersion:"v1", kind:"Service", metadata:{name, namespace:ns, created:C.now, labels:o.metadata.labels},
    spec:{type: a.opts.type || "ClusterIP", selector: JSON.parse(JSON.stringify(sel)),
          ports:[{port, targetPort: parseInt(a.opts["target-port"] || port, 10), protocol:"TCP"}]}};
  DEFAULTS.Service(svc);
  put(C, svc);
  return {out: ["service/" + name + " exposed"]};
}

function cmdLabel(C, a){
  const t = target(C, a, 0);
  const ns = nsOf(C, a);
  const o = get(C, ns, t.kind, t.name);
  if(!o) kerr('Error from server (NotFound): ' + t.kind.toLowerCase() + 's "' + t.name + '" not found');
  o.metadata.labels = o.metadata.labels || {};
  for(const spec of a.args.slice(2)){
    if(/-$/.test(spec)){ delete o.metadata.labels[spec.slice(0, -1)]; continue; }
    const i = spec.indexOf("=");
    if(i < 0) kerr('неверный формат "' + spec + '"', "Нужно ключ=значение либо ключ- для удаления.");
    const k = spec.slice(0, i);
    if(o.metadata.labels[k] !== undefined && !a.flags.overwrite)
      kerr("error: '" + k + "' already has a value (" + o.metadata.labels[k] + "), and --overwrite is false");
    o.metadata.labels[k] = spec.slice(i + 1);
  }
  return {out: [t.kind.toLowerCase() + "/" + t.name + " labeled"]};
}

function cmdLogs(C, a){
  const name = a.args[0];
  const ns = nsOf(C, a);
  let pod = get(C, ns, "Pod", name);
  if(!pod && a.args[0] && a.args[0].indexOf("/") > 0){
    const t = target(C, a, 0);
    const o = get(C, ns, t.kind, t.name);
    if(o){
      const pods = list(C, "Pod", ns).filter(p => matches(p.metadata.labels,
        t.kind === "Deployment" ? (o.spec.selector || {}).matchLabels : o.metadata.labels));
      pod = pods[0];
    }
  }
  if(!pod) kerr('Error from server (NotFound): pods "' + name + '" not found');
  const c = (pod.spec.containers || [])[0] || {};
  const img = IMAGES[c.image];
  if(!img) return {out: ['Error from server (BadRequest): container "' + c.name +
    '" in pod "' + pod.metadata.name + '" is waiting to start: trying and failing to pull image'], warn: true};
  const st = (pod.status.containerStatuses || [])[0] || {};
  const w = (st.state || {}).waiting;
  if(w && w.reason === "CrashLoopBackOff"){
    const term = (st.lastState || {}).terminated || {};
    if(term.reason === "OOMKilled")
      return {out: ["starting app...", "allocating cache...",
        "fatal: cannot allocate memory (limit reached)", "",
        "(контейнер убит по превышению лимита памяти, код 137)"]};
    return {out: ["starting app...",
      "config: reading /etc/app/config.yaml",
      "fatal: required key DATABASE_URL is missing", "",
      "(контейнер завершился с кодом 1 и был перезапущен " + (st.restartCount || 0) + " раз)"]};
  }
  if(pod.status.phase === "Pending")
    return {out: ["Error from server (BadRequest): container \"" + c.name +
      "\" in pod \"" + pod.metadata.name + "\" is waiting to start: ContainerCreating"], warn: true};
  return {out: ["starting app...",
    "listening on :" + (img.port || 8080),
    "ready",
    "GET /healthz 200",
    "GET / 200"]};
}

function cmdTop(C, a){
  const what = String(a.args[0] || "").toLowerCase();
  if(what.indexOf("node") === 0){
    return {out: table([["NAME","CPU(cores)","CPU%","MEMORY(bytes)","MEMORY%"]].concat(
      C.nodes.map(n => {
        const f = freeOn(C, n);
        const uc = n.cpu - f.cpu, um = n.mem - f.mem;
        return [n.name, uc + "m", Math.round(uc / n.cpu * 100) + "%", um + "Mi", Math.round(um / n.mem * 100) + "%"];
      })))};
  }
  const ns = nsOf(C, a);
  const pods = list(C, "Pod", ns).filter(p => p.spec.nodeName);
  if(!pods.length) return {out: ["No resources found in " + ns + " namespace."]};
  return {out: table([["NAME","CPU(cores)","MEMORY(bytes)"]].concat(pods.map(p => {
    let cpu = 0, mem = 0;
    for(const c of (p.spec.containers || [])){ const i = IMAGES[c.image]; if(i){ cpu += i.cpu; mem += i.mem; } }
    return [p.metadata.name, cpu + "m", mem + "Mi"];
  })))};
}

function cmdConfig(C, a){
  if(a.args[0] === "set-context"){
    const ns = a.opts.namespace;
    if(!ns) kerr("укажите --namespace=<имя>");
    if(!get(C, "", "Namespace", ns)) kerr('namespaces "' + ns + '" not found');
    C.ns = ns;
    return {out: ['Context "learn" modified.']};
  }
  if(a.args[0] === "get-contexts" || a.args[0] === "view")
    return {out: table([["CURRENT","NAME","CLUSTER","NAMESPACE"]].concat([["*","learn","learn","" + C.ns]]))};
  kerr("usage: kubectl config (set-context|get-contexts)");
}

function cmdExplain(C, a){
  const path = String(a.args[0] || "");
  const DOC = {
    "pod": "Pod — минимальная единица развёртывания: один или несколько контейнеров, которые всегда живут на одном узле и делят сеть и тома.",
    "deployment": "Deployment — контроллер, который поддерживает заданное число одинаковых подов и умеет обновлять их без простоя.",
    "deployment.spec.replicas": "replicas <integer> — сколько подов должно быть. Контроллер приводит фактическое число к этому.",
    "deployment.spec.selector": "selector <LabelSelector> — по каким меткам Deployment считает поды своими. Менять после создания нельзя.",
    "deployment.spec.strategy": "strategy <DeploymentStrategy> — RollingUpdate (по умолчанию) или Recreate.",
    "service": "Service — постоянный адрес и балансировка для набора подов, отобранных по меткам.",
    "service.spec.type": "type <string> — ClusterIP (по умолчанию), NodePort, LoadBalancer, ExternalName.",
    "configmap": "ConfigMap — набор пар ключ-значение с настройками, отделёнными от образа.",
    "secret": "Secret — то же, что ConfigMap, но для чувствительных данных; хранится в base64 и управляется правами доступа."
  };
  const d = DOC[path.toLowerCase()];
  if(!d) kerr('the server doesn\'t have a resource type "' + path + '"',
    "Попробуйте: kubectl explain pod, deployment, deployment.spec.replicas, service, configmap.");
  return {out: [d]};
}
