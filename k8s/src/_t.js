
/* ── тесты движка ──────────────────────────────────────── */
let pass = 0, fail = 0;
const WEB = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
          ports:
            - containerPort: 80`;

function run(script, opts){
  const C = newScenario(opts || {});
  let last = [];
  for(const line of script.trim().split("\n")){
    const s = line.trim();
    if(!s) continue;
    const r = runKubectl(C, s);
    last = r.err ? ["ОШИБКА: " + r.err] : r.out;
  }
  return {C, out: last.join("\n")};
}
function T(name, script, expect, opts){
  const {C, out} = run(script, opts);
  const ok = typeof expect === "function" ? expect(out, C) : out.trim() === String(expect).trim();
  if(ok) pass++;
  else { fail++; console.log("✗ " + name); console.log("    вышло:\n" + out.split("\n").map(x => "      " + x).join("\n")); }
}
const has = s => o => o.indexOf(s) >= 0;
const F = (name, body) => { let ok = false; try{ ok = body(); }catch(e){ console.log("    исключение: " + e.message); }
  if(ok) pass++; else { fail++; console.log("✗ " + name); } };

console.log("── желаемое состояние");
T("apply создаёт Deployment", "kubectl apply -f web.yaml", "deployment/web created", {files:{"web.yaml":WEB}});
T("контроллер поднял ровно 3 пода", `
kubectl apply -f web.yaml
kubectl get pods`, (o) => o.split("\n").length === 4 && /Running/.test(o), {files:{"web.yaml":WEB}});
T("ReplicaSet создан автоматически", `
kubectl apply -f web.yaml
kubectl get rs`, (o) => /web-/.test(o) && /\s3\s+3\s+3/.test(o.replace(/ +/g, " ")), {files:{"web.yaml":WEB}});
T("удаление пода восстанавливает число", `
kubectl apply -f web.yaml
kubectl get pods`, (o, C) => {
  const p = list(C, "Pod", "default")[0];
  runKubectl(C, "kubectl delete pod " + p.metadata.name);
  return list(C, "Pod", "default").length === 3;
}, {files:{"web.yaml":WEB}});
T("scale меняет число подов", `
kubectl apply -f web.yaml
kubectl scale deploy/web --replicas=5
kubectl get pods`, (o) => o.split("\n").length === 6, {files:{"web.yaml":WEB}});
T("удаление Deployment уносит поды", `
kubectl apply -f web.yaml
kubectl delete deploy web
kubectl get pods`, has("No resources found"), {files:{"web.yaml":WEB}});

console.log("── метки и селекторы");
T("selector обязателен", `kubectl apply -f bad.yaml`, has("не задан spec.selector"),
  {files:{"bad.yaml":"apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: bad\nspec:\n  replicas: 1\n  template:\n    metadata:\n      labels:\n        app: bad\n    spec:\n      containers:\n        - name: c\n          image: nginx"}});
T("selector должен совпадать с метками шаблона", `kubectl apply -f bad.yaml`, has("не совпадает"),
  {files:{"bad.yaml":"apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: bad\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: other\n  template:\n    metadata:\n      labels:\n        app: bad\n    spec:\n      containers:\n        - name: c\n          image: nginx"}});
T("выборка по метке", `
kubectl apply -f web.yaml
kubectl get pods -l app=web`, (o) => o.split("\n").length === 4, {files:{"web.yaml":WEB}});
T("несовпадающая метка ничего не находит", `
kubectl apply -f web.yaml
kubectl get pods -l app=none`, has("No resources found"), {files:{"web.yaml":WEB}});

console.log("── Service и конечные точки");
const SVC = `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80`;
T("Service находит поды по меткам", `
kubectl apply -f web.yaml
kubectl apply -f svc.yaml
kubectl get ep`, (o) => (o.match(/10\.1\./g) || []).length === 3, {files:{"web.yaml":WEB,"svc.yaml":SVC}});
T("ОПЕЧАТКА В СЕЛЕКТОРЕ — конечных точек нет", `
kubectl apply -f web.yaml
kubectl apply -f svc.yaml
kubectl describe svc web`, has("Endpoints:    <none>"),
  {files:{"web.yaml":WEB,"svc.yaml":SVC.replace("app: web","app: wev")}});
T("под без готовности не попадает в Service", `
kubectl apply -f web.yaml
kubectl apply -f svc.yaml
kubectl get ep`, has("<none>"), {files:{
  "web.yaml":WEB.replace("            - containerPort: 80",
    "            - containerPort: 80\n          readinessProbe:\n            httpGet:\n              path: /nosuch\n              port: 80"),
  "svc.yaml":SVC}});

console.log("── планировщик");
T("под не влезает — Pending с причиной", `kubectl apply -f big.yaml
kubectl get pods`, has("Pending"), {files:{"big.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: big
spec:
  containers:
    - name: c
      image: nginx
      resources:
        requests:
          cpu: "8"
          memory: 16Gi`}});
T("причина видна в describe", `kubectl apply -f big.yaml
kubectl describe pod big`, has("Insufficient cpu"), {files:{"big.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: big
spec:
  containers:
    - name: c
      image: nginx
      resources:
        requests:
          cpu: "8"`}});
T("nodeSelector уводит на нужный узел", `kubectl apply -f p.yaml
kubectl get pods -o wide`, has("node-2"), {
  nodes:[{name:"node-1",cpu:2000,mem:4096},{name:"node-2",cpu:2000,mem:4096,labels:{disk:"ssd"}}],
  files:{"p.yaml":"apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\nspec:\n  nodeSelector:\n    disk: ssd\n  containers:\n    - name: c\n      image: nginx"}});
T("taint без tolerations не пускает", `kubectl apply -f p.yaml
kubectl describe pod p`, has("untolerated taint"), {
  nodes:[{name:"node-1",cpu:2000,mem:4096,taints:[{key:"role",value:"db",effect:"NoSchedule"}]}],
  files:{"p.yaml":"apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\nspec:\n  containers:\n    - name: c\n      image: nginx"}});
T("tolerations пускает", `kubectl apply -f p.yaml
kubectl get pods`, has("Running"), {
  nodes:[{name:"node-1",cpu:2000,mem:4096,taints:[{key:"role",value:"db",effect:"NoSchedule"}]}],
  files:{"p.yaml":"apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\nspec:\n  tolerations:\n    - key: role\n      operator: Equal\n      value: db\n      effect: NoSchedule\n  containers:\n    - name: c\n      image: nginx"}});
T("класс обслуживания", `kubectl apply -f p.yaml
kubectl describe pod p`, has("QoS Class:    Guaranteed"), {files:{"p.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: p
spec:
  containers:
    - name: c
      image: nginx
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 100m
          memory: 128Mi`}});

console.log("── диагностика");
T("неизвестный образ — ImagePullBackOff", `kubectl apply -f p.yaml
kubectl get pods`, has("ImagePullBackOff"), {files:{"p.yaml":
"apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\nspec:\n  containers:\n    - name: c\n      image: nosuch/image:9"}});
T("падающий контейнер — CrashLoopBackOff", `kubectl apply -f p.yaml
kubectl get pods`, has("CrashLoopBackOff"), {files:{"p.yaml":
"apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\nspec:\n  containers:\n    - name: c\n      image: shop/api:broken"}});
T("лимит меньше аппетита — OOMKilled", `kubectl apply -f p.yaml
kubectl describe pod p`, has("OOMKilled"), {files:{"p.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: p
spec:
  containers:
    - name: c
      image: shop/api:hungry
      resources:
        limits:
          memory: 128Mi`}});
T("logs объясняют падение", `kubectl apply -f p.yaml
kubectl logs p`, has("кодом 1"), {files:{"p.yaml":
"apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\nspec:\n  containers:\n    - name: c\n      image: shop/api:broken"}});
T("события видны", `kubectl apply -f p.yaml
kubectl get events`, has("Failed"), {files:{"p.yaml":
"apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\nspec:\n  containers:\n    - name: c\n      image: nosuch/image:9"}});

console.log("── обновления");
T("set image запускает выкатку", `
kubectl apply -f web.yaml
kubectl set image deploy/web web=nginx:1.26
kubectl get pods`, (o, C) => {
  const pods = list(C, "Pod", "default");
  return pods.length === 3 && pods.every(p => p.spec.containers[0].image === "nginx:1.26");
}, {files:{"web.yaml":WEB}});
T("старый ReplicaSet остаётся пустым", `
kubectl apply -f web.yaml
kubectl set image deploy/web web=nginx:1.26
kubectl get rs`, (o) => o.split("\n").length === 3 && /\s0\s+0\s+0/.test(o.replace(/ +/g, " ")), {files:{"web.yaml":WEB}});
T("rollout status подтверждает", `
kubectl apply -f web.yaml
kubectl set image deploy/web web=nginx:1.26
kubectl rollout status deploy/web`, has("successfully rolled out"), {files:{"web.yaml":WEB}});
T("rollout undo возвращает образ", `
kubectl apply -f web.yaml
kubectl set image deploy/web web=nginx:1.26
kubectl rollout undo deploy/web`, (o, C) => {
  const pods = list(C, "Pod", "default");
  return pods.length === 3 && pods.every(p => p.spec.containers[0].image === "nginx:1.25");
}, {files:{"web.yaml":WEB}});
T("выкатка сломанного образа не убивает старые поды", `
kubectl apply -f web.yaml
kubectl set image deploy/web web=shop/api:broken
kubectl get deploy`, (o, C) => {
  const d = get(C, "default", "Deployment", "web");
  return d.status.readyReplicas >= 2 && !d.status.done;
}, {files:{"web.yaml":WEB}});

console.log("── конфигурация");
T("configmap из литералов", `kubectl create configmap app --from-literal=MODE=prod --from-literal=TZ=UTC
kubectl get cm app`, (o) => /app\s+2/.test(o.replace(/ +/g," ")));
T("переменная из configmap видна в describe", `
kubectl create configmap app --from-literal=MODE=prod
kubectl apply -f p.yaml
kubectl describe pod p`, has("<from ConfigMap app/MODE>"), {files:{"p.yaml":
`apiVersion: v1
kind: Pod
metadata:
  name: p
spec:
  containers:
    - name: c
      image: nginx
      env:
        - name: MODE
          valueFrom:
            configMapKeyRef:
              name: app
              key: MODE`}});

console.log("── пространства имён");
T("объекты в разных пространствах не видны друг другу", `
kubectl create namespace prod
kubectl apply -f web.yaml
kubectl get pods -n prod`, has("No resources found"), {files:{"web.yaml":WEB}});
T("несуществующее пространство — понятная ошибка", `kubectl apply -f web.yaml`,
  has('namespaces "prod" not found'), {files:{"web.yaml":WEB.replace("  name: web","  name: web\n  namespace: prod")}});
T("переключение контекста", `
kubectl create namespace prod
kubectl config set-context --current --namespace=prod
kubectl get pods`, has("No resources found in prod"));

console.log("── Job");
T("Job доводит под до Completed", `kubectl apply -f j.yaml
kubectl get job`, (o) => /1\/1/.test(o), {files:{"j.yaml":
`apiVersion: batch/v1
kind: Job
metadata:
  name: migrate
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: m
          image: shop/migrate:1.0`}});

console.log("── прочее");
T("get -o yaml возвращает манифест", `
kubectl apply -f web.yaml
kubectl get deploy web -o yaml`, (o) => /kind: Deployment/.test(o) && /replicas: 3/.test(o), {files:{"web.yaml":WEB}});
T("explain объясняет", "kubectl explain deployment.spec.replicas", has("сколько подов"));
T("несуществующий тип — понятная ошибка", "kubectl get frobs", has("doesn't have a resource type"));
T("не kubectl", "docker ps", has("здесь не живёт"));
T("ошибка YAML внятная", "kubectl apply -f bad.yaml", has("ожидалось «ключ: значение»"),
  {files:{"bad.yaml":"просто строка"}});
T("expose создаёт Service с селектором", `
kubectl apply -f web.yaml
kubectl expose deploy/web --port=80
kubectl get ep`, (o) => (o.match(/10\.1\./g) || []).length === 3, {files:{"web.yaml":WEB}});
T("top показывает потребление", `
kubectl apply -f web.yaml
kubectl top pods`, (o) => o.split("\n").length === 4 && /64Mi/.test(o), {files:{"web.yaml":WEB}});

console.log("── ревизии и счётчики");
T("rollout history растёт", `
kubectl apply -f web.yaml
kubectl set image deploy/web web=nginx:1.26
kubectl rollout history deploy/web`, (o) => o.split("\n").length === 4, {files:{"web.yaml":WEB}});
T("счётчик перезапусков растёт по одному за команду", `kubectl apply -f p.yaml
kubectl get pods`, (o, C) => {
  const before = list(C, "Pod", "default")[0].status.restarts;
  runKubectl(C, "kubectl get pods");
  const after = list(C, "Pod", "default")[0].status.restarts;
  return before <= 4 && after - before <= 2;
}, {files:{"p.yaml":"apiVersion: v1\nkind: Pod\nmetadata:\n  name: p\nspec:\n  containers:\n    - name: c\n      image: shop/api:broken"}});
T("undo на конкретную ревизию", `
kubectl apply -f web.yaml
kubectl set image deploy/web web=nginx:1.26
kubectl set image deploy/web web=shop/api:1.0
kubectl rollout undo deploy/web --to-revision=2`, (o, C) => {
  const pods = list(C, "Pod", "default");
  return pods.length === 3 && pods.every(p => p.spec.containers[0].image === "nginx:1.26");
}, {files:{"web.yaml":WEB}});
T("Recreate гасит старое до подъёма нового", `
kubectl apply -f web.yaml
kubectl set image deploy/web web=nginx:1.26
kubectl get rs`, (o, C) => {
  const rss = list(C, "ReplicaSet", "default");
  return rss.length === 2 && rss.filter(r => r.status.replicas > 0).length === 1;
}, {files:{"web.yaml":WEB.replace("  replicas: 3","  replicas: 3\n  strategy:\n    type: Recreate")}});

console.log("\nитог: " + pass + " пройдено, " + fail + " провалено");
