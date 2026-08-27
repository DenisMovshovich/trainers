let p = 0, f = 0;
const T = (name, src, expect) => {
  let got;
  try{ got = JSON.stringify(parseYaml(src)); }
  catch(e){ got = "ОШИБКА: " + e.message; }
  const want = typeof expect === "string" ? expect : JSON.stringify(expect);
  if(got === want) p++;
  else { f++; console.log("✗ " + name + "\n    ждали: " + want + "\n    вышло: " + got); }
};
T("простой словарь", "a: 1\nb: два", [{a:1,b:"два"}]);
T("вложенность", "meta:\n  name: web\n  ns: default", [{meta:{name:"web",ns:"default"}}]);
T("список строк", "args:\n  - one\n  - two", [{args:["one","two"]}]);
T("список словарей", "containers:\n  - name: web\n    image: nginx\n  - name: log\n    image: fluentd",
  [{containers:[{name:"web",image:"nginx"},{name:"log",image:"fluentd"}]}]);
T("вложенный список в элементе", "containers:\n  - name: web\n    ports:\n      - containerPort: 80",
  [{containers:[{name:"web",ports:[{containerPort:80}]}]}]);
T("инлайн-словарь", "labels: {app: web, tier: front}", [{labels:{app:"web",tier:"front"}}]);
T("инлайн-список", "cmd: [sh, -c, sleep]", [{cmd:["sh","-c","sleep"]}]);
T("булевы и числа", "a: true\nb: false\nc: 3\nd: 1.5", [{a:true,b:false,c:3,d:1.5}]);
T("кавычки сохраняют строку", 'v: "3"', [{v:"3"}]);
T("комментарии игнорируются", "# заголовок\na: 1  # хвост\nb: 2", [{a:1,b:2}]);
T("несколько документов", "a: 1\n---\nb: 2", [{a:1},{b:2}]);
T("манифест целиком", `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
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
            - containerPort: 80
          env:
            - name: MODE
              value: prod`,
  [{apiVersion:"apps/v1",kind:"Deployment",metadata:{name:"web",labels:{app:"web"}},
    spec:{replicas:3,selector:{matchLabels:{app:"web"}},
      template:{metadata:{labels:{app:"web"}},
        spec:{containers:[{name:"web",image:"nginx:1.25",ports:[{containerPort:80}],
          env:[{name:"MODE",value:"prod"}]}]}}}}]);
T("ошибка отступа внятная", "a: 1\n   b: 2", (0, s => s)("ОШИБКА: странный отступ в строке 2"));
T("ошибка без двоеточия", "просто строка", "ОШИБКА: ожидалось «ключ: значение» в строке 1: «просто строка»");

/* обратная сборка */
const round = src => { const d = parseYaml(src)[0]; return JSON.stringify(parseYaml(toYaml(d))[0]) === JSON.stringify(d); };
const R = (name, src) => { if(round(src)) p++; else { f++; console.log("✗ round-trip: " + name + "\n" + toYaml(parseYaml(src)[0])); } };
R("манифест", `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: web
          image: nginx
          ports:
            - containerPort: 80`);
R("метки", "metadata:\n  labels:\n    app: web\n    tier: front");

console.log("\nYAML: " + p + " пройдено, " + f + " провалено");
