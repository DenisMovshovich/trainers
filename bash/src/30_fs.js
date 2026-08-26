<script>
"use strict";
/* ============================================================
   Виртуальная файловая система
   ============================================================ */
const HOME = "/home/user";

function newFS(){
  const fs = {};
  const D = p => fs[p] = {t:"d", m:"755"};
  const F = (p,c,m) => fs[p] = {t:"f", m:m||"644", c:c};
  ["/","/bin","/etc","/tmp","/var","/var/log","/home",HOME,
   HOME+"/docs",HOME+"/logs"].forEach(D);
  F("/etc/hostname","workstation\n");
  F("/etc/passwd","root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:User:/home/user:/bin/bash\n");
  F(HOME+"/notes.txt","молоко\nхлеб\nсыр\nмолоко\n");
  F(HOME+"/todo.txt","купить хлеб\nпозвонить в банк\nсдать отчёт\n");
  F(HOME+"/docs/report.md","# Отчёт\n\nВыручка выросла на 12%.\nРасходы выросли на 3%.\n");
  F(HOME+"/docs/readme.md","# Проект\n\nЗапуск: ./run.sh\n");
  F(HOME+"/docs/draft.txt","черновик\n");
  F(HOME+"/logs/app.log",
    "2026-08-01 INFO  запуск\n2026-08-01 WARN  медленный запрос 812ms\n2026-08-02 ERROR не найден пользователь 42\n"+
    "2026-08-02 INFO  повтор\n2026-08-03 ERROR таймаут базы\n2026-08-03 INFO  завершено\n");
  F(HOME+"/logs/access.log",
    "10.0.0.1 GET /users 200\n10.0.0.2 GET /posts 404\n10.0.0.1 POST /users 201\n"+
    "10.0.0.3 GET /users 500\n10.0.0.2 GET /users 200\n10.0.0.1 GET /posts 200\n");
  F(HOME+"/data.csv","имя,отдел,оклад\nАда,разработка,120\nГрейс,разработка,135\nАлан,аналитика,110\nБарбара,разработка,140\n");
  return fs;
}

function newShell(){
  const fs = newFS();
  return {
    fs, cwd: HOME, prevDir: HOME,
    env: {HOME:HOME, USER:"user", SHELL:"/bin/bash", PATH:"/usr/local/bin:/usr/bin:/bin", PWD:HOME, HOSTNAME:"workstation", LANG:"ru_RU.UTF-8"},
    vars: {}, funcs: {}, status: 0, opts:{e:false,u:false,x:false,pipefail:false},
    args: [], name:"bash", log: [], exited:false, depth:0, steps:0
  };
}

/* ---------------- пути ---------------- */
function normPath(p, cwd){
  if(!p) return cwd;
  if(p[0] !== "/") p = (cwd === "/" ? "" : cwd) + "/" + p;
  const out = [];
  p.split("/").forEach(s=>{
    if(!s || s === ".") return;
    if(s === ".."){ out.pop(); return; }
    out.push(s);
  });
  return "/" + out.join("/");
}
const exists = (s,p) => Object.prototype.hasOwnProperty.call(s.fs, p);
const isDir  = (s,p) => exists(s,p) && s.fs[p].t === "d";
const isFile = (s,p) => exists(s,p) && s.fs[p].t === "f";
function children(s, dir){
  const pre = dir === "/" ? "/" : dir + "/";
  const names = new Set();
  Object.keys(s.fs).forEach(k=>{
    if(k === dir || !k.startsWith(pre)) return;
    const rest = k.slice(pre.length);
    if(!rest) return;
    names.add(rest.split("/")[0]);
  });
  return [...names].sort((a,b)=>a.localeCompare(b,"ru"));
}
function mkdirp(s, p){
  const parts = p.split("/").filter(Boolean);
  let cur = "";
  parts.forEach(x=>{ cur += "/" + x; if(!exists(s,cur)) s.fs[cur] = {t:"d", m:"755"}; });
}
function rmPath(s, p){
  delete s.fs[p];
  const pre = p + "/";
  Object.keys(s.fs).forEach(k=>{ if(k.startsWith(pre)) delete s.fs[k]; });
}
function copyPath(s, from, to){
  if(isFile(s,from)){ s.fs[to] = {t:"f", m:s.fs[from].m, c:s.fs[from].c}; return; }
  s.fs[to] = {t:"d", m:s.fs[from].m};
  const pre = from + "/";
  Object.keys(s.fs).filter(k=>k.startsWith(pre)).forEach(k=>{
    s.fs[to + k.slice(from.length)] = JSON.parse(JSON.stringify(s.fs[k]));
  });
}
function movePath(s, from, to){ copyPath(s, from, to); rmPath(s, from); }
const readFile = (s,p) => isFile(s,p) ? s.fs[p].c : null;
function writeFile(s, p, c){
  const dir = p.slice(0, p.lastIndexOf("/")) || "/";
  if(!isDir(s,dir)) return false;
  if(isDir(s,p)) return false;
  s.fs[p] = {t:"f", m: exists(s,p) ? s.fs[p].m : "644", c: c};
  return true;
}
const lines = t => { if(t==null||t==="") return []; const a=t.split("\n"); if(a[a.length-1]==="") a.pop(); return a; };
const unlines = a => a.length ? a.join("\n") + "\n" : "";
