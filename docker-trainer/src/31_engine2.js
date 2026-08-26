/* ---------------- вывод ---------------- */
function mkOut(){
  const L=[];
  const push=(t,cls)=>L.push({t:t===undefined?"":String(t),cls:cls||""});
  return {L, line:t=>push(t), err:t=>push(t,"err"), dim:t=>push(t,"dim"),
          ok:t=>push(t,"ok"), warn:t=>push(t,"warn"), raw:(t,c)=>push(t,c)};
}
function table(out, headers, rows){
  const w = headers.map((h,i)=>Math.max(h.length, ...rows.map(r=>String(r[i]==null?"":r[i]).length)));
  out.dim(headers.map((h,i)=>h.padEnd(w[i])).join("   ").trimEnd());
  rows.forEach(r=>out.line(r.map((c,i)=>String(c==null?"":c).padEnd(w[i])).join("   ").trimEnd()));
}

/* ---------------- HTTP внутри «сети» ---------------- */
function serveFrom(st, c, path){
  const img=c.imageObj;
  const s = img && img.serve;
  if(!s){
    if(img && (img.kind==="server")) return {err:"curl: (52) Empty reply from server"};
    return {err:"curl: (7) Failed to connect: Connection refused"};
  }
  if(s.type==="static"){
    const p = (path==="/"||!path) ? s.root+"/index.html" : s.root+path;
    const v = cRead(st,c,p);
    if(v===undefined) return {status:404, body:"<html><head><title>404 Not Found</title></head><body><center><h1>404 Not Found</h1></center><hr><center>nginx</center></body></html>"};
    c.logs.push("172.17.0.1 - - \""+"GET "+(path||"/")+" HTTP/1.1\" 200 "+String(v).length+" \"-\" \"curl/8.4.0\"");
    return {status:200, body:String(v)};
  }
  if(s.type==="app"){
    const idx = cRead(st,c,"/app/index.html");
    if(idx!==undefined) return {status:200, body:String(idx)};
    const g = c.env.GREETING || c.env.MESSAGE;
    c.logs.push("GET "+(path||"/")+" 200");
    return {status:200, body:(g?g:"Hello from "+c.hostname)+"\n"};
  }
  return {err:"curl: (52) Empty reply from server"};
}
function httpFetch(st, url, fromC){
  let u = url.replace(/^https?:\/\//,"");
  const slash = u.indexOf("/");
  let path = slash>-1 ? u.slice(slash) : "/";
  let hostport = slash>-1 ? u.slice(0,slash) : u;
  let [host,portS] = hostport.split(":");
  let port = portS?+portS:80;
  if(!fromC){
    if(!["localhost","127.0.0.1","0.0.0.0","host.docker.internal"].includes(host))
      return {err:"curl: (6) Could not resolve host: "+host};
    const hit = st.containers.find(c=>c.status==="running" && c.ports.some(p=>p.host===port));
    if(hit){ const pm = hit.ports.find(p=>p.host===port); return serveFrom(st,hit,path); }
    const hostNet = st.containers.find(c=>c.status==="running" && c.netMode==="host" &&
       (c.imageObj.config.exposed||[]).some(e=>+e.split("/")[0]===port));
    if(hostNet) return serveFrom(st,hostNet,path);
    return {err:"curl: (7) Failed to connect to "+host+" port "+port+": Connection refused"};
  }
  if(["localhost","127.0.0.1"].includes(host)){
    const exp=(fromC.imageObj.config.exposed||[]).map(e=>+e.split("/")[0]);
    if(exp.includes(port)||port===80) return serveFrom(st,fromC,path);
    return {err:"curl: (7) Failed to connect to localhost port "+port+": Connection refused"};
  }
  const target = resolveName(st, fromC, host);
  if(!target) return {err:"curl: (6) Could not resolve host: "+host};
  const shared = Object.keys(fromC.networks).some(n=>target.networks[n]);
  if(!shared) return {err:"curl: (7) Failed to connect to "+host+": No route to host"};
  const exp=(target.imageObj.config.exposed||[]).map(e=>+e.split("/")[0]);
  if(exp.length && !exp.includes(port) && port!==80) return {err:"curl: (7) Failed to connect to "+host+" port "+port+": Connection refused"};
  return serveFrom(st,target,path);
}

/* ---------------- шелл внутри контейнера ---------------- */
function shellExec(st, c, line){
  const out=mkOut(); let code=0;
  const chunks = line.split("&&").map(s=>s.trim()).filter(Boolean);
  for(const chunk of chunks){
    const r = shellOne(st,c,chunk,out);
    code = r;
    if(code!==0) break;
  }
  return {out, code};
}
function splitRedir(tokens){
  let redir=null; const t=[];
  for(let i=0;i<tokens.length;i++){
    const x=tokens[i];
    if(x===">"||x===">>"){ redir={path:tokens[i+1], append:x===">>"}; i++; continue; }
    const m=x.match(/^(>>?)(.+)$/);
    if(m){ redir={path:m[2], append:m[1]===">>"}; continue; }
    t.push(x);
  }
  return {t, redir};
}
function shellOne(st, c, line, out){
  const sr = splitRedir(tokenize(line));
  const t = sr.t, redir = sr.redir;
  if(!t.length) return 0;
  const cmd=t[0], a=t.slice(1);
  const emit = txt => {
    if(redir){
      const abs=normPath(redir.path, c.workdir||"/");
      const prev = redir.append ? (cRead(st,c,abs)||"") : "";
      const res = cWrite(st,c,abs, prev+txt+(txt.endsWith("\n")?"":"\n"));
      if(res.err){ out.err(cmd+": can't create "+redir.path+": "+res.err); return 1; }
      return 0;
    }
    String(txt).split("\n").forEach(l=>out.line(l));
    return 0;
  };
  switch(cmd){
    case "echo": return emit(unesc(a.join(" ")));
    case "pwd": return emit(c.workdir||"/");
    case "hostname": return emit(c.hostname);
    case "whoami": return emit((c.user||"root").split(":")[0]);
    case "id": {
      const u=(c.user||"root").split(":")[0];
      const uid = u==="root"?0 : (u==="nobody"?65534 : (u==="nonroot"?65532 : 1000));
      return emit("uid="+uid+"("+u+") gid="+uid+"("+u+") groups="+uid+"("+u+")");
    }
    case "uname": return emit(a.includes("-a")?"Linux "+c.hostname+" 6.6.16-linuxkit #1 SMP x86_64 Linux":"Linux");
    case "env": case "printenv": { Object.entries(c.env).forEach(([k,v])=>out.line(k+"="+v)); return 0; }
    case "cd": { const d=normPath(a[0]||"/", c.workdir||"/"); c.workdir=d; return 0; }
    case "ls": {
      const dir = a.filter(x=>!x.startsWith("-"))[0] || c.workdir || "/";
      const items = cList(st,c,dir);
      if(!items.length){
        const asFile = cRead(st,c,dir);
        if(asFile!==undefined) return emit(dir);
        out.err("ls: "+dir+": No such file or directory"); return 1;
      }
      if(a.includes("-l")||a.includes("-la")||a.includes("-al")){
        items.forEach(n=>{
          const isDir=n.endsWith("/");
          const v = isDir?null:cRead(st,c,normPath(dir+"/"+n,"/"));
          out.line((isDir?"drwxr-xr-x":"-rw-r--r--")+"    1 "+(c.user||"root").padEnd(8)+String(isDir?4096:String(v||"").length).padStart(8)+"  "+n.replace(/\/$/,""));
        });
        return 0;
      }
      return emit(items.join("  "));
    }
    case "cat": {
      let code=0;
      a.filter(x=>!x.startsWith("-")).forEach(f=>{
        const v=cRead(st,c,f);
        if(v===undefined){ out.err("cat: can't open '"+f+"': No such file or directory"); code=1; }
        else emit(String(v));
      });
      return code;
    }
    case "touch": { a.forEach(f=>{ const r=cWrite(st,c,f, cRead(st,c,f)||""); if(r.err) out.err("touch: "+f+": "+r.err); }); return 0; }
    case "mkdir": return 0;
    case "rm": { a.filter(x=>!x.startsWith("-")).forEach(f=>{ const p=normPath(f,c.workdir||"/"); const m=mountFor(c,p); if(m){ delete mountStore(st,m)[mountKey(m,p,st)]; } else delete c.layer[p]; }); return 0; }
    case "df": { out.dim("Filesystem           1K-blocks      Used Available Use% Mounted on"); out.line("overlay               61202244   8123456  49876543  14% /"); (c.mounts||[]).forEach(m=>out.line(("/dev/vda1").padEnd(21)+"  61202244   8123456  49876543  14% "+m.target)); return 0; }
    case "ps": { out.dim("PID   USER     COMMAND"); out.line("    1 "+(c.user||"root").padEnd(8)+" "+c.cmd.join(" ")); out.line("   42 "+(c.user||"root").padEnd(8)+" sh"); return 0; }
    case "sleep": return 0;
    case "true": return 0;
    case "false": return 1;
    case "exit": return a[0]?+a[0]:0;
    case "sh": case "bash": case "ash": {
      const i=a.indexOf("-c");
      if(i>-1) { const r=shellExec(st,c,a.slice(i+1).join(" ")); r.out.L.forEach(l=>out.raw(l.t,l.cls)); return r.code; }
      return 0;
    }
    case "wget": case "curl": {
      const url = a.filter(x=>!x.startsWith("-")).pop();
      if(!url){ out.err(cmd+": missing URL"); return 1; }
      const r = httpFetch(st, url, c);
      if(r.err){ out.err(r.err.replace(/^curl:/, cmd+":")); return 1; }
      if(a.includes("-I")||a.includes("--head")){ out.line("HTTP/1.1 "+r.status+" "+(r.status===200?"OK":"Not Found")); return 0; }
      return emit(r.body);
    }
    case "nslookup": case "ping": {
      const host=a.filter(x=>!x.startsWith("-"))[0];
      const t=resolveName(st,c,host);
      if(!t){ out.err(cmd+": bad address '"+host+"'"); return 1; }
      const net=Object.keys(c.networks).find(n=>t.networks[n]);
      const ip=t.networks[net].ip;
      if(cmd==="ping"){ out.line("PING "+host+" ("+ip+"): 56 data bytes"); out.line("64 bytes from "+ip+": seq=0 ttl=64 time=0.081 ms"); }
      else { out.line("Server:\t\t127.0.0.11"); out.line("Name:\t"+host); out.line("Address: "+ip); }
      return 0;
    }
    case "redis-cli": { if(a.includes("ping")||a.includes("PING")) return emit("PONG"); return emit("OK"); }
    case "psql": { if(a.join(" ").includes("SELECT 1")) return emit(" ?column?\n----------\n        1\n(1 row)"); return emit("psql (16.2)\nType \"help\" for help."); }
    case "node": { const i=a.indexOf("-e"); if(i>-1) return emit("(node) "+a[i+1]); return 0; }
    case "python": case "python3": { const i=a.indexOf("-c"); if(i>-1) return emit("(python) "+a[i+1]); return 0; }
    case "apk": case "apt-get": case "apt": case "yum": { out.dim(cmd+": в эмуляторе установка пакетов работает только в RUN при сборке образа"); return 0; }
    case "clear": return 0;
    default:
      out.err(cmd+": not found");
      return 127;
  }
}

/* ---------------- запуск/создание контейнера ---------------- */
const RUN_VF = new Set(["--name","--publish","--volume","--env","--network","--net","--workdir","--user","--memory",
  "--cpus","--restart","--entrypoint","--hostname","--label","--mount","--env-file","--health-cmd","--health-interval",
  "--cap-add","--cap-drop","--tmpfs","--device","--pull","--platform","--log-driver","--stop-signal","--pid","--ipc",
  "--shm-size","--add-host","--dns","--ulimit","--security-opt","--link","--expose","--memory-swap","--pids-limit","--network-alias"]);

function createContainer(st, args, out, startIt){
  const p = parseArgs(args, RUN_VF, true);
  const ref = p.rest[0];
  if(!ref){ out.err("docker: 'docker run' requires at least 1 argument."); out.dim("Usage:  docker run [OPTIONS] IMAGE [COMMAND] [ARG...]"); return null; }
  let img = findImage(st, ref);
  if(!img){
    const r=refParse(ref);
    if(!REGISTRY[r.full]){ out.err("Unable to find image '"+r.full+"' locally"); out.err("docker: Error response from daemon: pull access denied for "+r.repo+"."); return null; }
    out.line("Unable to find image '"+r.full+"' locally");
    img = pullImage(st, ref, out);
    if(!img) return null;
  }
  const name = p.one("--name") || petName();
  if(st.containers.some(c=>c.name===name)){
    out.err("docker: Error response from daemon: Conflict. The container name \"/"+name+"\" is already in use by container.");
    out.dim("Удалите старый контейнер (docker rm "+name+") или выберите другое имя.");
    return null;
  }
  const id=hex(32);
  const env = Object.assign({}, img.config.env);
  p.all("--env").forEach(e=>{ if(typeof e!=="string") return; const i=e.indexOf("="); if(i>-1) env[e.slice(0,i)]=e.slice(i+1); else env[e]=""; });
  const cmd = p.rest.length>1 ? p.rest.slice(1) : (img.config.cmd||[]).slice();
  const entry = p.has("--entrypoint") ? [p.one("--entrypoint")] : (img.config.entrypoint||null);
  const netMode = p.one("--network")||p.one("--net")||"bridge";
  const c = {
    id, name, image:img.repo+":"+img.tag, imageId:img.id, imageObj:img,
    cmd: entry ? entry.concat(cmd) : cmd,
    entrypoint: entry, rawCmd: cmd,
    status:"created", created:Date.now(), started:null, exitCode:null,
    env, workdir: p.one("--workdir")||img.config.workdir||"/",
    user: p.one("--user")||img.config.user||"root",
    hostname: p.one("--hostname")||id.slice(0,12),
    ports:[], mounts:[], networks:{}, netMode,
    logs:[], layer:{}, autoRemove:p.has("--rm"),
    restart:p.one("--restart")||"no", memory:p.one("--memory")||null, cpus:p.one("--cpus")||null,
    readOnly:p.has("--read-only"), capDrop:p.all("--cap-drop").filter(x=>typeof x==="string"),
    capAdd:p.all("--cap-add").filter(x=>typeof x==="string"),
    tty:p.has("--tty"), interactive:p.has("--interactive"), detach:p.has("--detach"),
    labels:{}, health: img.config.health?{status:"starting", cfg:img.config.health}:null,
    composeService:null, restarts:0
  };
  p.all("--label").forEach(l=>{ if(typeof l!=="string")return; const i=l.indexOf("="); c.labels[i>-1?l.slice(0,i):l]= i>-1?l.slice(i+1):""; });
  if(p.has("--health-cmd")) c.health={status:"starting", cfg:{test:["CMD-SHELL",p.one("--health-cmd")]}};

  p.all("--publish").forEach(spec=>{
    if(typeof spec!=="string") return;
    const pm=parsePublish(spec);
    if(pm.host===null) pm.host = 32768+Math.floor(Math.random()*2000);
    const busy = st.containers.find(x=>x.status==="running" && x.ports.some(q=>q.host===pm.host));
    if(busy){ out.err("docker: Error response from daemon: driver failed programming external connectivity: Bind for 0.0.0.0:"+pm.host+" failed: port is already allocated."); c.portConflict=true; }
    c.ports.push(pm);
  });
  if(c.portConflict) return null;
  if(p.has("--publish-all")) (img.config.exposed||[]).forEach(e=>c.ports.push({host:32768+Math.floor(Math.random()*2000), cont:+e.split("/")[0], proto:"tcp"}));

  p.all("--volume").forEach(spec=>{
    if(typeof spec!=="string") return;
    const m=parseMount(st,spec);
    c.mounts = c.mounts.filter(x=>x.target!==m.target);
    if(m.type==="volume") ensureVolume(st,m.source);
    c.mounts.push(m);
  });
  p.all("--mount").forEach(spec=>{
    if(typeof spec!=="string") return;
    const kv={}; spec.split(",").forEach(x=>{ const [k,v]=x.split("="); kv[k]=v===undefined?true:v; });
    const m={type:kv.type||"volume", source:kv.source||kv.src||("anon_"+hex(6)), target:kv.target||kv.dst||kv.destination, ro:!!kv.readonly};
    if(m.type==="volume") ensureVolume(st,m.source);
    if(m.type==="bind") m.source=normPath(m.source,"/work");
    c.mounts=c.mounts.filter(x=>x.target!==m.target); c.mounts.push(m);
  });
  p.all("--tmpfs").forEach(t=>{ if(typeof t==="string") c.mounts.push({type:"tmpfs", source:"tmpfs", target:t.split(":")[0], mem:{}}); });
  (img.config.volumes||[]).forEach(v=>{
    if(c.mounts.some(m=>m.target===v)) return;
    const an="anon_"+hex(6); ensureVolume(st,an);
    c.mounts.push({type:"volume", source:an, target:v, anon:true});
  });

  st.containers.push(c);
  if(netMode==="host"||netMode==="none"){ c.networks[netMode]={ip:"", aliases:[]}; if(netMode==="host") c.ports=[]; }
  else {
    const net = netByName(st,netMode);
    if(!net){ out.err("docker: Error response from daemon: network "+netMode+" not found."); st.containers.pop(); return null; }
    const aliases=[c.name].concat(p.all("--network-alias").filter(x=>typeof x==="string"));
    attach(st,c,net,aliases);
  }
  if(startIt){
    const okv=startContainer(st,c,out,!p.has("--detach"));
    if(okv==="shell"){ st.shellIn=c.id; out.dim("Вы внутри контейнера "+c.name+". Доступны ls, cat, env, hostname, whoami, curl, ping. Выход — exit"); }
    if(!okv) return c;
  }
  return c;
}

function startContainer(st, c, out, attached){
  if(c.status==="running"){ return true; }
  const img=c.imageObj;
  c.status="running"; c.started=Date.now(); c.exitCode=null;
  const missing=(img.needsEnv||[]).filter(k=>!c.env[k]);
  if(missing.length){
    c.logs.push("Error: Database is uninitialized and superuser password is not specified.");
    c.logs.push("       You must specify "+missing[0]+" to a non-empty value for the superuser password.");
    c.status="exited"; c.exitCode=1;
    if(attached){ c.logs.forEach(l=>out.err(l)); }
    else { out.line(c.id); out.warn("Контейнер сразу упал: не задана переменная "+missing[0]+". Смотрите docker logs "+c.name); }
    return false;
  }
  (img.baseLogs||[]).forEach(l=>c.logs.push(l));
  if(c.health) c.health.status="healthy";
  const long = isLongRunning(c.cmd, img);
  if(long){
    if(attached){
      c.logs.forEach(l=>out.line(l));
      out.dim("(процесс продолжает работать; в реальном терминале он держал бы консоль — используйте -d, чтобы запустить в фоне)");
    } else out.line(c.id);
    return true;
  }
  if(!c.cmd.length){ c.status="exited"; c.exitCode=0; if(!attached) out.line(c.id); return true; }
  if((c.cmd[0]==="/bin/sh"||c.cmd[0]==="sh"||c.cmd[0]==="/bin/bash"||c.cmd[0]==="bash"||c.cmd[0]==="ash") && c.cmd.length===1){
    if(c.tty && c.interactive){ return "shell"; }
    c.status="exited"; c.exitCode=0;
    if(!attached) out.line(c.id);
    else out.dim("(процесс /bin/sh завершился сразу: нет TTY и нечего исполнять — добавьте -it, чтобы получить оболочку)");
    return true;
  }
  const r = shellExec(st, c, c.cmd.map(x=>/\s/.test(x)?'"'+x+'"':x).join(" "));
  r.out.L.forEach(l=>{ c.logs.push(l.t); if(attached) out.raw(l.t,l.cls); });
  c.status="exited"; c.exitCode=r.code;
  if(!attached) out.line(c.id);
  if(c.autoRemove) removeContainer(st,c,true);
  return true;
}
function stopContainer(st,c){
  if(c.status!=="running") return false;
  c.status="exited"; c.exitCode=0; c.stopped=Date.now();
  if(c.autoRemove) removeContainer(st,c,true);
  return true;
}
function removeContainer(st,c,rmVols){
  st.containers = st.containers.filter(x=>x!==c);
  if(rmVols) c.mounts.filter(m=>m.anon).forEach(m=>{ st.volumes=st.volumes.filter(v=>v.name!==m.source); delete st.volStore[m.source]; });
}
