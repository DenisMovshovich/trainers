<script>
"use strict";
/* ============================================================
   Эмулятор движка Docker
   ============================================================ */

const KB=1024, MB=1024*KB, GB=1024*MB;
const hex = n => Array.from({length:n},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
const ADJ=["brave","calm","clever","eager","gentle","jolly","keen","lucid","mystic","nifty","quirky","serene","stoic","vivid","zealous","amber","bold"];
const SCI=["turing","hopper","lovelace","curie","tesla","ritchie","thompson","knuth","dijkstra","noether","shannon","hamilton","kare","goldberg"];
const petName = () => ADJ[Math.floor(Math.random()*ADJ.length)]+"_"+SCI[Math.floor(Math.random()*SCI.length)];

function fmtSize(b){
  if(b<=0) return "0B";
  if(b<KB) return b+"B";
  if(b<MB) return (b/KB).toFixed(b/KB<10?2:1)+"kB";
  if(b<GB) return (b/MB).toFixed(b/MB<10?1:0)+"MB";
  return (b/GB).toFixed(2)+"GB";
}
function fmtAgo(ts){
  const s=Math.max(1,Math.floor((Date.now()-ts)/1000));
  if(s<60) return s+" second"+(s===1?"":"s")+" ago";
  const m=Math.floor(s/60); if(m<60) return m+" minute"+(m>1?"s":"")+" ago";
  const h=Math.floor(m/60); if(h<24) return h+" hour"+(h>1?"s":"")+" ago";
  return Math.floor(h/24)+" days ago";
}
function fmtUp(ts){
  const s=Math.max(1,Math.floor((Date.now()-ts)/1000));
  if(s<60) return "Up "+s+" second"+(s===1?"":"s");
  const m=Math.floor(s/60); if(m<60) return "Up "+m+" minute"+(m>1?"s":"");
  return "Up "+Math.floor(m/60)+" hours";
}
function hash32(str){
  let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
  return h.toString(16).padStart(8,"0");
}

/* ---------------- реестр базовых образов ---------------- */
const OSREL = name => "NAME=\""+name+"\"\nID="+name.toLowerCase().split(" ")[0]+"\nPRETTY_NAME=\""+name+"\"\n";
const baseFS = os => ({
  "/etc/os-release":OSREL(os),
  "/etc/passwd":"root:x:0:0:root:/root:/bin/sh\nnobody:x:65534:65534:nobody:/:/sbin/nologin\n",
  "/etc/hosts":"127.0.0.1\tlocalhost\n",
  "/bin/sh":"<binary>", "/usr/bin/env":"<binary>"
});

const REGISTRY = {};
function reg(ref, o){
  const [repo,tag] = ref.split(":");
  REGISTRY[ref] = Object.assign({
    repo, tag, size:10*MB, cmd:["/bin/sh"], entrypoint:null, env:{PATH:"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"},
    workdir:"/", user:"root", exposed:[], volumes:[], fs:baseFS("Alpine Linux v3.19"),
    kind:"shell", serve:null, logs:[], health:null, digest:"sha256:"+hex(12)
  }, o);
}

reg("alpine:3.19",{size:7.8*MB, cmd:["/bin/sh"], kind:"shell", fs:baseFS("Alpine Linux v3.19")});
reg("alpine:latest",{size:7.8*MB, cmd:["/bin/sh"], kind:"shell", fs:baseFS("Alpine Linux v3.19")});
reg("busybox:latest",{size:4.3*MB, cmd:["sh"], kind:"shell", fs:baseFS("BusyBox")});
reg("ubuntu:22.04",{size:77*MB, cmd:["/bin/bash"], kind:"shell", fs:baseFS("Ubuntu 22.04.4 LTS")});
reg("debian:12-slim",{size:74*MB, cmd:["bash"], kind:"shell", fs:baseFS("Debian GNU/Linux 12 (bookworm)")});

reg("nginx:alpine",{size:43*MB, cmd:["nginx","-g","daemon off;"], kind:"server", exposed:["80/tcp"],
  serve:{type:"static", root:"/usr/share/nginx/html"},
  fs:Object.assign(baseFS("Alpine Linux v3.19"),{
    "/usr/share/nginx/html/index.html":"<html><head><title>Welcome to nginx!</title></head>\n<body><h1>Welcome to nginx!</h1>\n<p>If you see this page, the nginx web server is successfully installed.</p></body></html>",
    "/etc/nginx/nginx.conf":"user nginx;\nworker_processes auto;\nhttp { include /etc/nginx/conf.d/*.conf; }\n",
    "/etc/nginx/conf.d/default.conf":"server {\n    listen       80;\n    server_name  localhost;\n    location / {\n        root   /usr/share/nginx/html;\n        index  index.html;\n    }\n}\n"}),
  logs:["/docker-entrypoint.sh: Configuration complete; ready for start up",
        "nginx: using the \"epoll\" event method",
        "nginx: start worker processes"]});
REGISTRY["nginx:1.25-alpine"] = Object.assign({},REGISTRY["nginx:alpine"],{tag:"1.25-alpine"});
REGISTRY["nginx:latest"] = Object.assign({},REGISTRY["nginx:alpine"],{tag:"latest", size:187*MB, fs:Object.assign({},REGISTRY["nginx:alpine"].fs,{"/etc/os-release":OSREL("Debian GNU/Linux 12 (bookworm)")})});

reg("httpd:2.4-alpine",{size:57*MB, cmd:["httpd-foreground"], kind:"server", exposed:["80/tcp"],
  serve:{type:"static", root:"/usr/local/apache2/htdocs"},
  fs:Object.assign(baseFS("Alpine Linux v3.19"),{"/usr/local/apache2/htdocs/index.html":"<html><body><h1>It works!</h1></body></html>"}),
  logs:["AH00558: httpd: Could not reliably determine the server's fully qualified domain name",
        "[mpm_event:notice] AH00489: Apache/2.4.58 configured -- resuming normal operations"]});

reg("node:20-alpine",{size:135*MB, cmd:["node"], kind:"shell",
  env:{PATH:"/usr/local/bin:/usr/bin:/bin", NODE_VERSION:"20.11.1"},
  fs:Object.assign(baseFS("Alpine Linux v3.19"),{"/usr/local/bin/node":"<binary>","/usr/local/bin/npm":"<binary>"})});
reg("node:20-slim",{size:220*MB, cmd:["node"], kind:"shell",
  env:{PATH:"/usr/local/bin:/usr/bin:/bin", NODE_VERSION:"20.11.1"},
  fs:Object.assign(baseFS("Debian GNU/Linux 12 (bookworm)"),{"/usr/local/bin/node":"<binary>","/usr/local/bin/npm":"<binary>"})});
reg("node:20",{size:1.09*GB, cmd:["node"], kind:"shell",
  env:{PATH:"/usr/local/bin:/usr/bin:/bin", NODE_VERSION:"20.11.1"},
  fs:Object.assign(baseFS("Debian GNU/Linux 12 (bookworm)"),{"/usr/local/bin/node":"<binary>","/usr/local/bin/npm":"<binary>"})});

reg("python:3.12-alpine",{size:52*MB, cmd:["python3"], kind:"shell",
  fs:Object.assign(baseFS("Alpine Linux v3.19"),{"/usr/local/bin/python":"<binary>","/usr/local/bin/pip":"<binary>"})});
reg("python:3.12-slim",{size:130*MB, cmd:["python3"], kind:"shell",
  fs:Object.assign(baseFS("Debian GNU/Linux 12 (bookworm)"),{"/usr/local/bin/python":"<binary>","/usr/local/bin/pip":"<binary>"})});
reg("python:3.12",{size:1.02*GB, cmd:["python3"], kind:"shell",
  fs:Object.assign(baseFS("Debian GNU/Linux 12 (bookworm)"),{"/usr/local/bin/python":"<binary>","/usr/local/bin/pip":"<binary>"})});

reg("golang:1.22-alpine",{size:251*MB, cmd:["/bin/sh"], kind:"shell",
  fs:Object.assign(baseFS("Alpine Linux v3.19"),{"/usr/local/go/bin/go":"<binary>"})});

reg("postgres:16-alpine",{size:246*MB, cmd:["postgres"], kind:"server", exposed:["5432/tcp"],
  env:{PGDATA:"/var/lib/postgresql/data", PATH:"/usr/local/bin:/usr/bin:/bin"},
  volumes:["/var/lib/postgresql/data"], needsEnv:["POSTGRES_PASSWORD"],
  fs:Object.assign(baseFS("Alpine Linux v3.19"),{"/usr/local/bin/psql":"<binary>"}),
  logs:["The files belonging to this database system will be owned by user \"postgres\".",
        "database system is ready to accept connections"]});
reg("redis:7-alpine",{size:41*MB, cmd:["redis-server"], kind:"server", exposed:["6379/tcp"],
  volumes:["/data"],
  fs:Object.assign(baseFS("Alpine Linux v3.19"),{"/usr/local/bin/redis-cli":"<binary>"}),
  logs:["Redis version=7.2.4, bits=64, commit=00000000, modified=0, pid=1, just started",
        "Ready to accept connections tcp"]});
reg("mysql:8",{size:586*MB, cmd:["mysqld"], kind:"server", exposed:["3306/tcp"],
  volumes:["/var/lib/mysql"], needsEnv:["MYSQL_ROOT_PASSWORD"],
  fs:baseFS("Oracle Linux Server 8.9"),
  logs:["[Server] /usr/sbin/mysqld: ready for connections. Version: '8.3.0'"]});

reg("gcr.io/distroless/static:nonroot",{size:2.4*MB, cmd:[], kind:"shell", user:"nonroot",
  fs:{"/etc/passwd":"nonroot:x:65532:65532::/home/nonroot:/sbin/nologin\n"}});
reg("scratch:latest",{size:0, cmd:[], kind:"shell", fs:{}});

const REG_LIST = Object.keys(REGISTRY);

/* ---------------- состояние движка ---------------- */
function newState(){
  return {
    images:[], containers:[], volumes:[],
    networks:[
      {id:hex(12), name:"bridge", driver:"bridge", subnet:"172.17.0.0/16", builtin:true, next:2},
      {id:hex(12), name:"host", driver:"host", builtin:true, next:2},
      {id:hex(12), name:"none", driver:"null", builtin:true, next:2}
    ],
    files:{}, volStore:{}, buildCache:{}, netSeq:18,
    cwd:"/work", shellIn:null, history:[], pushed:[]
  };
}

/* ---------------- работа с образами ---------------- */
function refParse(ref){
  if(!ref) return null;
  let repo=ref, tag="latest";
  const slash = ref.lastIndexOf("/"), colon = ref.lastIndexOf(":");
  if(colon>slash && colon>-1){ repo=ref.slice(0,colon); tag=ref.slice(colon+1); }
  return {repo, tag, full:repo+":"+tag};
}
function findImage(st, ref){
  if(!ref) return null;
  const r = refParse(ref);
  let img = st.images.find(i=>i.repo===r.repo && i.tag===r.tag);
  if(img) return img;
  return st.images.find(i=>i.id.startsWith(ref) && ref.length>=3) || null;
}
function imgSize(img){ return img.layers.reduce((a,l)=>a+l.size,0); }

function pullImage(st, ref, out){
  const r = refParse(ref);
  const key = REGISTRY[r.full] ? r.full : null;
  if(!key){
    out.err("Error response from daemon: pull access denied for "+r.repo+", repository does not exist or may require 'docker login'");
    out.dim("Доступные в этом эмуляторе образы: "+REG_LIST.filter(k=>k!=="scratch:latest").join(", "));
    return null;
  }
  const exist = st.images.find(i=>i.repo===r.repo && i.tag===r.tag);
  if(exist){ out.line(r.tag+": Pulling from library/"+r.repo); out.line("Digest: "+exist.digest); out.line("Status: Image is up to date for "+r.full); return exist; }
  const b = REGISTRY[key];
  out.line(r.tag+": Pulling from library/"+r.repo);
  const nl = b.size>200*MB?4:2;
  for(let i=0;i<nl;i++){ out.dim(hex(12)+": Pull complete"); }
  const img = {
    id:hex(12), repo:r.repo, tag:r.tag, digest:b.digest, created:Date.now(),
    layers: splitLayers(b),
    config:{cmd:b.cmd.slice(), entrypoint:b.entrypoint?b.entrypoint.slice():null, env:Object.assign({},b.env),
            workdir:b.workdir, user:b.user, exposed:b.exposed.slice(), volumes:b.volumes.slice(),
            health:b.health, labels:{}},
    fs:Object.assign({},b.fs), kind:b.kind, serve:b.serve?Object.assign({},b.serve):null,
    baseLogs:b.logs.slice(), needsEnv:b.needsEnv||[], users:["root","nobody"]
  };
  st.images.push(img);
  out.line("Digest: "+b.digest);
  out.line("Status: Downloaded newer image for "+r.full);
  return img;
}
function splitLayers(b){
  const L=[];
  L.push({id:hex(12), cmd:"/bin/sh -c #(nop) ADD file:"+hex(8)+" in / ", size:b.size, base:true});
  if(b.env && Object.keys(b.env).length) L.push({id:hex(12), cmd:"/bin/sh -c #(nop)  ENV "+Object.entries(b.env).map(([k,v])=>k+"="+v).join(" "), size:0});
  if(b.exposed && b.exposed.length) L.push({id:hex(12), cmd:"/bin/sh -c #(nop)  EXPOSE "+b.exposed.join(" "), size:0});
  L.push({id:hex(12), cmd:"/bin/sh -c #(nop)  CMD [\""+(b.cmd||[]).join("\",\"")+"\"]", size:0});
  return L;
}

/* ---------------- разбор командной строки ---------------- */
function tokenize(line){
  const t=[]; let cur="", q=null;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){ if(c===q){q=null;} else cur+=c; continue; }
    if(c==='"'||c==="'"){ q=c; continue; }
    if(c===" "||c==="\t"){ if(cur){t.push(cur);cur="";} continue; }
    cur+=c;
  }
  if(cur) t.push(cur);
  return t;
}
const ALIAS={"-p":"--publish","-v":"--volume","-e":"--env","-w":"--workdir","-u":"--user","-m":"--memory",
  "-f":"--file","-l":"--label","-h":"--hostname","-n":"--tail","-a":"--all","-q":"--quiet","-d":"--detach",
  "-i":"--interactive","-t":"--tty","-P":"--publish-all","-s":"--size","-c":"--command","-o":"--output"};
function parseArgs(tokens, valueFlags, stopAtFirstArg){
  const flags={}, rest=[];
  const push=(k,v)=>{ (flags[k]=flags[k]||[]).push(v); };
  let i=0, stopped=false;
  for(;i<tokens.length;i++){
    let t=tokens[i];
    if(stopped){ rest.push(t); continue; }
    if(t==="--"){ stopped=true; continue; }
    if(t.startsWith("--")){
      let name=t, val=null;
      const eq=t.indexOf("=");
      if(eq>-1){ name=t.slice(0,eq); val=t.slice(eq+1); }
      if(val===null && valueFlags.has(name)){ val=tokens[++i]; }
      push(name, val===undefined?null:val);
    } else if(t.startsWith("-") && t.length>1){
      const eq=t.indexOf("=");
      if(eq>-1){ const n=ALIAS[t.slice(0,eq)]||t.slice(0,eq); push(n,t.slice(eq+1)); continue; }
      const letters=t.slice(1).split("");
      let consumed=false;
      for(let j=0;j<letters.length;j++){
        const sh="-"+letters[j];
        const n=ALIAS[sh]||sh;
        if(valueFlags.has(n)||valueFlags.has(sh)){
          const inline=t.slice(j+2);
          if(inline){ push(n,inline); consumed=true; break; }
          push(n, tokens[++i]); consumed=true; break;
        }
        push(n,true);
      }
      if(consumed) continue;
    } else {
      rest.push(t);
      if(stopAtFirstArg){ stopped=true; }
    }
  }
  return {flags, rest,
    has:k=>Object.prototype.hasOwnProperty.call(flags,k),
    one:k=>flags[k]?flags[k][flags[k].length-1]:undefined,
    all:k=>flags[k]||[]};
}

/* ---------------- файловая система контейнера ---------------- */
function normPath(p, cwd){
  if(!p.startsWith("/")) p = (cwd==="/"?"":cwd)+"/"+p;
  const parts=[];
  p.split("/").forEach(s=>{ if(!s||s===".") return; if(s===".."){parts.pop(); return;} parts.push(s); });
  return "/"+parts.join("/");
}
function mountFor(c, path){
  let best=null;
  (c.mounts||[]).forEach(m=>{ if(path===m.target || path.startsWith(m.target.replace(/\/$/,"")+"/")){ if(!best||m.target.length>best.target.length) best=m; } });
  return best;
}
function mountStore(st, m){
  if(m.type==="volume") return (st.volStore[m.source] = st.volStore[m.source]||{});
  if(m.type==="tmpfs") return (m.mem = m.mem||{});
  return st.files;
}
function mountKey(m, path, st){
  const relRaw = path.slice(m.target.length).replace(/^\//,"");
  if(m.type==="bind"){ return normPath(m.source.replace(/\/$/,"")+(relRaw?"/"+relRaw:""), "/"); }
  return "/"+relRaw;
}
function cRead(st, c, path){
  path = normPath(path, c.workdir||"/");
  const m = mountFor(c, path);
  if(m){
    const store = mountStore(st,m), key = mountKey(m,path,st);
    if(Object.prototype.hasOwnProperty.call(store,key)) return store[key];
    if(m.type==="volume" || m.type==="tmpfs") return undefined;
    return undefined;
  }
  if(Object.prototype.hasOwnProperty.call(c.layer,path)) return c.layer[path];
  const img = c.imageObj;
  return img && img.fs ? img.fs[path] : undefined;
}
function cWrite(st, c, path, val){
  path = normPath(path, c.workdir||"/");
  if(c.readOnly){ const m0=mountFor(c,path); if(!m0 || m0.type==="bind"&&m0.ro) return {err:"Read-only file system"}; if(!m0) return {err:"Read-only file system"}; }
  const m = mountFor(c, path);
  if(m){
    if(m.ro) return {err:"Read-only file system"};
    const store = mountStore(st,m); store[mountKey(m,path,st)]=val; return {ok:true};
  }
  c.layer[path]=val; return {ok:true};
}
function cList(st, c, dir){
  dir = normPath(dir, c.workdir||"/");
  const pre = dir==="/"?"/":dir+"/";
  const names=new Set();
  const add = p => { if(!p.startsWith(pre)) return; const rest=p.slice(pre.length); if(!rest) return; const seg=rest.split("/")[0]; names.add(seg + (rest.includes("/")?"/":"")); };
  if(c.imageObj && c.imageObj.fs) Object.keys(c.imageObj.fs).forEach(add);
  Object.keys(c.layer).forEach(add);
  (c.mounts||[]).forEach(m=>{
    const store=mountStore(st,m);
    if(m.target===dir || m.target.startsWith(pre)){ if(m.target!==dir){ const rest=m.target.slice(pre.length); names.add(rest.split("/")[0]+"/"); } }
    if(m.target===dir || dir.startsWith(m.target.replace(/\/$/,"")+"/")){
      Object.keys(store).forEach(k=>{
        let virt;
        if(m.type==="bind"){ const src=m.source.replace(/\/$/,""); if(k!==src && !k.startsWith(src+"/")) return; virt = m.target + k.slice(src.length); }
        else virt = normPath(m.target+"/"+k,"/");
        add(virt);
      });
    }
  });
  return [...names].sort();
}

/* ---------------- сети ---------------- */
function netByName(st,n){ return st.networks.find(x=>x.name===n) || st.networks.find(x=>x.id.startsWith(n)&&n.length>=3); }
function allocIP(net){
  if(net.name==="bridge") return "172.17.0."+(net.next++);
  if(net.driver==="host"||net.driver==="null") return "";
  const base = net.subnet.split(".").slice(0,3).join(".");
  return base+"."+(net.next++);
}
function attach(st,c,net,aliases){
  c.networks[net.name]={ip:allocIP(net), aliases:aliases||[]};
}
function resolveName(st, fromC, name){
  const nets = Object.keys(fromC.networks);
  for(const n of nets){
    const net = netByName(st,n);
    if(!net || net.builtin && net.name==="bridge") continue;
    const hit = st.containers.find(c=>c.status==="running" && c.networks[n] &&
      (c.name===name || (c.networks[n].aliases||[]).includes(name) || c.hostname===name || c.composeService===name));
    if(hit) return hit;
  }
  return null;
}

/* ---------------- контейнеры ---------------- */
function findContainer(st, ref){
  return st.containers.find(c=>c.name===ref) ||
         st.containers.find(c=>c.id.startsWith(ref)&&ref.length>=2) || null;
}
function parsePublish(spec){
  const parts=spec.split(":");
  let proto="tcp", last=parts[parts.length-1];
  if(last.includes("/")){ const [p,pr]=last.split("/"); parts[parts.length-1]=p; proto=pr; }
  if(parts.length===1) return {host:null, cont:+parts[0], proto};
  if(parts.length===2) return {host:+parts[0], cont:+parts[1], proto};
  return {hostIp:parts[0], host:+parts[1], cont:+parts[2], proto};
}
function parseMount(st, spec){
  const p=spec.split(":");
  if(p.length===1) return {type:"volume", source:"anon_"+hex(6), target:p[0], anon:true};
  const ro = p[2]==="ro";
  const src=p[0], tgt=p[1];
  if(src.startsWith("/")||src.startsWith(".")||src.startsWith("~")){
    let s=src.replace(/^~/,"/root").replace(/^\.\//,"/work/").replace(/^\.$/,"/work");
    return {type:"bind", source:normPath(s,"/work"), target:tgt, ro};
  }
  return {type:"volume", source:src, target:tgt, ro};
}
function ensureVolume(st,name){
  let v=st.volumes.find(v=>v.name===name);
  if(!v){ v={name, driver:"local", mountpoint:"/var/lib/docker/volumes/"+name+"/_data", created:Date.now()}; st.volumes.push(v); st.volStore[name]=st.volStore[name]||{}; }
  return v;
}
const LONG_RUNNING = ["nginx","httpd","httpd-foreground","postgres","mysqld","redis-server","sleep","tail","node","python3","python","serve","gunicorn","java","top","yes","docker-entrypoint.sh"];
function isLongRunning(cmd, img){
  if(!cmd || !cmd.length) return false;
  const c0 = cmd[0].split("/").pop();
  if(LONG_RUNNING.includes(c0)){
    if((c0==="node"||c0==="python3"||c0==="python") && cmd.length===1) return false;
    if(c0==="tail" && !cmd.includes("-f")) return false;
    return true;
  }
  return false;
}
const unesc = s => String(s).replace(/\\n/g,"\n").replace(/\\t/g,"\t");
