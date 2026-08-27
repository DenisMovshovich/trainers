/* Эталонные решения. Шаг — либо строка команды, либо объект:
     {file, text}          — правка манифеста в панели «Манифест»
     {fn}                  — действие, зависящее от имён в кластере
     {cmd, expectErr:true} — команда, отказ которой и есть предмет урока */
const SOL = {

"1a": [
  "kubectl apply -f web.yaml",
  "kubectl get pods",
  {fn: (C, run) => run("kubectl delete pod " + list(C, "Pod", "default")[0].metadata.name)},
  "kubectl get pods"
],

"1b": ["kubectl get all", "kubectl get pods -o wide", "kubectl describe deploy api"],

"2a": [
  "kubectl apply -f pod.yaml",
  "kubectl get pods",
  "kubectl delete pod solo",
  "kubectl get pods"
],

"2b": [
  {file:"side.yaml", text:
`apiVersion: v1
kind: Pod
metadata:
  name: bundle
spec:
  containers:
    - name: web
      image: nginx:1.25
    - name: log
      image: busybox`},
  "kubectl apply -f side.yaml",
  "kubectl get pods"
],

"3a": [
  {file:"api.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
spec:
  replicas: 4
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0`},
  "kubectl apply -f api.yaml",
  "kubectl get pods"
],

"3b": [
  {cmd:"kubectl apply -f bad.yaml", expectErr:true},
  {file:"bad.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: cache
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cache
  template:
    metadata:
      labels:
        app: cache
    spec:
      containers:
        - name: cache
          image: redis:7`},
  "kubectl apply -f bad.yaml",
  "kubectl get pods"
],

"3c": ["kubectl scale deploy/api --replicas=6", "kubectl get pods"],

"4a": [
  "kubectl describe svc shop",
  {file:"svc.yaml", text:
`apiVersion: v1
kind: Service
metadata:
  name: shop
spec:
  selector:
    app: shop
  ports:
    - port: 80
      targetPort: 8080`},
  "kubectl apply -f svc.yaml",
  "kubectl get endpoints shop"
],

"4b": [
  "kubectl get pods",
  {fn: (C, run) => run("kubectl label pod " + list(C, "Pod", "default")[0].metadata.name +
    " app=shop-debug --overwrite")},
  "kubectl get pods"
],

"5a": [
  {file:"svc.yaml", text:
`apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080`},
  "kubectl apply -f svc.yaml",
  "kubectl get endpoints api"
],

"5b": [
  {file:"svc.yaml", text:
`apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  type: NodePort
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080`},
  "kubectl apply -f svc.yaml",
  "kubectl get svc"
],

"6a": [
  "kubectl create configmap app-config --from-literal=MODE=prod --from-literal=LOG_LEVEL=info",
  "kubectl apply -f pod.yaml",
  "kubectl describe pod app"
],

"6b": [
  "cat cm.yaml",
  "kubectl apply -f cm.yaml",
  "kubectl rollout restart deploy/api",
  "kubectl get pods"
],

"7a": [
  {file:"pvc.yaml", text:
`apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 5Gi`},
  "kubectl apply -f pvc.yaml",
  "kubectl get pvc"
],

"7b": [
  {file:"pod.yaml", text:
`apiVersion: v1
kind: Pod
metadata:
  name: store
spec:
  volumes:
    - name: store
      persistentVolumeClaim:
        claimName: data
  containers:
    - name: app
      image: shop/api:1.0
      volumeMounts:
        - name: store
          mountPath: /var/data`},
  "kubectl apply -f pod.yaml",
  "kubectl describe pod store"
],

"8a": [
  "kubectl describe pod heavy",
  "kubectl delete pod heavy",
  {file:"pod.yaml", text:
`apiVersion: v1
kind: Pod
metadata:
  name: heavy
spec:
  containers:
    - name: app
      image: shop/api:1.0
      resources:
        requests:
          cpu: 500m
          memory: 512Mi`},
  "kubectl apply -f pod.yaml",
  "kubectl get pods"
],

"8b": [
  {file:"api.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 200m
              memory: 256Mi`},
  "kubectl apply -f api.yaml",
  {fn: (C, run) => run("kubectl describe pod " + list(C, "Pod", "default")[0].metadata.name)}
],

"8c": [
  {file:"pod.yaml", text:
`apiVersion: v1
kind: Pod
metadata:
  name: db
spec:
  tolerations:
    - key: role
      operator: Equal
      value: db
      effect: NoSchedule
  containers:
    - name: db
      image: postgres:16
      resources:
        requests:
          cpu: 200m
          memory: 1Gi`},
  "kubectl apply -f pod.yaml",
  "kubectl get pods -o wide"
],

"9a": [
  "kubectl get pods",
  {fn: (C, run) => run("kubectl describe pod " + list(C, "Pod", "default")[0].metadata.name)},
  {file:"api.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080`},
  "kubectl apply -f api.yaml",
  "kubectl get endpoints api"
],

"9b": [
  "kubectl get pods",
  {file:"w.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
        - name: worker
          image: shop/worker:1.0`},
  "kubectl apply -f w.yaml",
  "kubectl get pods"
],

"10a": [
  "kubectl set image deploy/api api=shop/api:2.0",
  "kubectl rollout status deploy/api",
  "kubectl get pods"
],

"10b": [
  "kubectl get pods",
  {fn: (C, run) => {
    const bad = list(C, "Pod", "default").filter(p => p.spec.containers[0].image === "shop/api:broken")[0];
    run("kubectl logs " + (bad ? bad.metadata.name : "api"));
  }},
  "kubectl rollout undo deploy/api",
  "kubectl get pods"
],

"10c": [
  {file:"api.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080`},
  "kubectl apply -f api.yaml",
  "kubectl set image deploy/api api=shop/api:2.0",
  "kubectl rollout status deploy/api"
],

"11a": [
  "kubectl get pods",
  {fn: (C, run) => run("kubectl describe pod " + list(C, "Pod", "default")[0].metadata.name)},
  {file:"api.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: shop/api:1.0`},
  "kubectl apply -f api.yaml",
  "kubectl get pods"
],

"11b": [
  "kubectl describe pod hungry",
  {file:"pod.yaml", text:
`apiVersion: v1
kind: Pod
metadata:
  name: hungry
spec:
  containers:
    - name: app
      image: shop/api:hungry
      resources:
        limits:
          memory: 640Mi`},
  "kubectl delete pod hungry",
  "kubectl apply -f pod.yaml",
  "kubectl get pods"
],

"11c": [
  "kubectl get pods",
  {fn: (C, run) => { for(const p of list(C, "Pod", "default")) run("kubectl describe pod " + p.metadata.name); }},
  {file:"one.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: one
spec:
  replicas: 1
  selector:
    matchLabels:
      app: one
  template:
    metadata:
      labels:
        app: one
    spec:
      containers:
        - name: one
          image: shop/api:2.0`},
  {file:"two.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: two
spec:
  replicas: 1
  selector:
    matchLabels:
      app: two
  template:
    metadata:
      labels:
        app: two
    spec:
      containers:
        - name: two
          image: shop/api:1.0
          resources:
            requests:
              cpu: 200m`},
  {file:"three.yaml", text:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: three
spec:
  replicas: 1
  selector:
    matchLabels:
      app: three
  template:
    metadata:
      labels:
        app: three
    spec:
      containers:
        - name: three
          image: shop/api:1.0
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080`},
  "kubectl apply -f one.yaml",
  "kubectl apply -f two.yaml",
  "kubectl apply -f three.yaml",
  "kubectl get pods"
],

"12a": [
  "kubectl create namespace prod",
  "kubectl config set-context --current --namespace=prod",
  "kubectl apply -f api.yaml",
  "kubectl get pods",
  "kubectl get pods -n default"
],

"12b": [
  {file:"all.yaml", text:
`apiVersion: v1
kind: ConfigMap
metadata:
  name: shop-config
data:
  MODE: prod
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shop
  template:
    metadata:
      labels:
        app: shop
    spec:
      containers:
        - name: shop
          image: shop/api:2.0
          ports:
            - containerPort: 8080
          env:
            - name: MODE
              valueFrom:
                configMapKeyRef:
                  name: shop-config
                  key: MODE
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 200m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: shop
spec:
  selector:
    app: shop
  ports:
    - port: 80
      targetPort: 8080`},
  "kubectl apply -f all.yaml",
  "kubectl get all",
  "kubectl get endpoints shop"
]

};
