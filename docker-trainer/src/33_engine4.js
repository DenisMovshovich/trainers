/* ---------------- вспомогательные представления ---------------- */
function statusText(c){
  if(c.status==="running"){
    let s=fmtUp(c.started);
    if(c.health) s+=" ("+c.health.status+")";
    return s;
  }
  if(c.status==="created") return "Created";
  if(c.status==="paused") return "Up (paused)";
  return "Exited ("+(c.exitCode==null?0:c.exitCode)+") "+fmtAgo(c.stopped||c.started||c.created);
}
function portsText(c){
  if(c.netMode==="host") return "";
  return c.ports.map(p=>p.host?("0.0.0.0:"+p.host+"->"+p.cont+"/"+p.proto):(p.cont+"/"+p.proto)).join(", ");
}
function cmdText(c){
  const s=c.cmd.join(" ");
  return "\""+(s.length>20?s.slice(0,19)+"…":s)+"\"";
}
function inspectJson(st,obj,kind){
  if(kind==="container"){
    return {
      Id:obj.id, Created:new Date(obj.created).toISOString(), Name:"/"+obj.name,
      State:{Status:obj.status, Running:obj.status==="running", ExitCode:obj.exitCode||0,
             Health:obj.health?{Status:obj.health.status}:undefined},
      Config:{Hostname:obj.hostname, User:obj.user, Image:obj.image, WorkingDir:obj.workdir,
              Env:Object.entries(obj.env).map(([k,v])=>k+"="+v), Cmd:obj.rawCmd, Entrypoint:obj.entrypoint,
              Labels:obj.labels},
      HostConfig:{NetworkMode:obj.netMode, RestartPolicy:{Name:obj.restart}, Memory:obj.memory||0,
                  NanoCpus:obj.cpus?Math.round(parseFloat(obj.cpus)*1e9):0, ReadonlyRootfs:!!obj.readOnly,
                  CapDrop:obj.capDrop, CapAdd:obj.capAdd,
                  PortBindings:Object.fromEntries(obj.ports.map(p=>[p.cont+"/"+p.proto,[{HostIp:"0.0.0.0",HostPort:String(p.host)}]]))},
      Mounts:obj.mounts.map(m=>({Type:m.type, Name:m.type==="volume"?m.source:undefined, Source:m.type==="bind"?m.source:undefined, Destination:m.target, RW:!m.ro})),
      NetworkSettings:{Networks:Object.fromEntries(Object.entries(obj.networks).map(([n,v])=>[n,{IPAddress:v.ip, Aliases:v.aliases}]))}
    };
  }
  if(kind==="image"){
    return {Id:"sha256:"+obj.id, RepoTags:[obj.repo+":"+obj.tag], Created:new Date(obj.created).toISOString(),
      Size:imgSize(obj), Config:obj.config,
      RootFS:{Type:"layers", Layers:obj.layers.map(l=>"sha256:"+l.id)}};
  }
  if(kind==="network"){
    const members=st.containers.filter(c=>c.networks[obj.name]);
    return {Name:obj.name, Id:obj.id, Driver:obj.driver, Internal:!!obj.internal,
      IPAM:{Config:[{Subnet:obj.subnet}]},
      Containers:Object.fromEntries(members.map(c=>[c.id,{Name:c.name, IPv4Address:c.networks[obj.name].ip+"/16"}]))};
  }
  return {Name:obj.name, Driver:obj.driver, Mountpoint:obj.mountpoint, CreatedAt:new Date(obj.created).toISOString()};
}
function findAny(st,ref){
  const c=findContainer(st,ref); if(c) return {obj:c, kind:"container"};
  const i=findImage(st,ref); if(i) return {obj:i, kind:"image"};
  const n=netByName(st,ref); if(n) return {obj:n, kind:"network"};
  const v=st.volumes.find(v=>v.name===ref); if(v) return {obj:v, kind:"volume"};
  return null;
}

/* ---------------- шелл хоста ---------------- */
function hostShell(st, line, out){
  const sr=splitRedir(tokenize(line));
  const t=sr.t, redir=sr.redir;
  if(!t.length) return true;
  const cmd=t[0], a=t.slice(1);
  const emit=txt=>{
    if(redir){ const p=normPath(redir.path,st.cwd); st.files[p]=(redir.append?(st.files[p]||""):"")+txt+"\n"; return; }
    String(txt).split("\n").forEach(l=>out.line(l));
  };
  switch(cmd){
    case "pwd": emit(st.cwd); return true;
    case "echo": emit(unesc(a.join(" "))); return true;
    case "cd": { st.cwd=normPath(a[0]||"/work","/work"); return true; }
    case "ls": {
      const dir=normPath(a.filter(x=>!x.startsWith("-"))[0]||st.cwd, st.cwd);
      const pre=dir==="/"?"/":dir+"/"; const names=new Set();
      Object.keys(st.files).forEach(k=>{ if(!k.startsWith(pre))return; const r=k.slice(pre.length); if(!r)return; names.add(r.split("/")[0]+(r.includes("/")?"/":"")); });
      if(!names.size){ if(st.files[dir]!==undefined) emit(dir.split("/").pop()); else out.err("ls: "+dir+": No such file or directory"); return true; }
      emit([...names].sort().join("  ")); return true;
    }
    case "cat": {
      a.filter(x=>!x.startsWith("-")).forEach(f=>{
        const v=st.files[normPath(f,st.cwd)];
        if(v===undefined) out.err("cat: "+f+": No such file or directory"); else emit(String(v));
      }); return true;
    }
    case "rm": { a.filter(x=>!x.startsWith("-")).forEach(f=>{ const p=normPath(f,st.cwd); delete st.files[p]; Object.keys(st.files).forEach(k=>{ if(k.startsWith(p+"/")) delete st.files[k]; }); }); return true; }
    case "mkdir": { a.filter(x=>!x.startsWith("-")).forEach(d=>{ st.files[normPath(d,st.cwd)+"/.keep"]=""; }); return true; }
    case "touch": { a.forEach(f=>{ const p=normPath(f,st.cwd); if(st.files[p]===undefined) st.files[p]=""; }); return true; }
    case "curl": case "wget": {
      const url=a.filter(x=>!x.startsWith("-")).pop();
      if(!url){ out.err(cmd+": no URL specified"); return true; }
      const r=httpFetch(st,url,null);
      if(r.err){ out.err(r.err.replace(/^curl:/,cmd+":")); return true; }
      if(a.includes("-I")||a.includes("--head")){ out.line("HTTP/1.1 "+r.status+" "+(r.status===200?"OK":"Not Found")); out.line("Server: nginx"); return true; }
      emit(r.body); return true;
    }
    case "uname": emit("Darwin docker-yard 6.6.16 x86_64"); return true;
    case "whoami": emit("you"); return true;
    case "history": { st.history.slice(-25).forEach((h,i)=>out.line(String(i+1).padStart(4)+"  "+h)); return true; }
    default: return false;
  }
}

/* ---------------- главный диспетчер ---------------- */
function engineExec(st, line){
  const out=mkOut();
  line=String(line).trim();
  if(!line) return out;
  st.history.push(line);

  if(st.shellIn){
    const c=st.containers.find(x=>x.id===st.shellIn);
    if(!c){ st.shellIn=null; out.err("container gone"); return out; }
    if(/^exit\b/.test(line)){ st.shellIn=null; out.dim("exit"); return out; }
    const r=shellExec(st,c,line);
    r.out.L.forEach(l=>out.raw(l.t,l.cls));
    return out;
  }

  const t=tokenize(line);
  if(t[0]!=="docker"){
    if(hostShell(st,line,out)) return out;
    out.err(t[0]+": command not found");
    out.dim("Подсказка: наберите help, чтобы увидеть список доступных команд.");
    return out;
  }
  let a=t.slice(1);
  if(!a.length){ usage(out); return out; }

  // docker image / container / network / volume / system — приводим к плоскому виду
  if(a[0]==="image"&&["ls","list"].includes(a[1])) a=["images"].concat(a.slice(2));
  else if(a[0]==="image"&&["rm","remove"].includes(a[1])) a=["rmi"].concat(a.slice(2));
  else if(a[0]==="image"&&a[1]) a=[a[1]].concat(a.slice(2));
  else if(a[0]==="container"&&["ls","list"].includes(a[1])) a=["ps"].concat(a.slice(2));
  else if(a[0]==="container"&&a[1]) a=[a[1]].concat(a.slice(2));

  const cmd=a[0], rest=a.slice(1);
  switch(cmd){
    case "version": out.line("Client: Docker Engine - Community"); out.line(" Version:    26.1.4"); out.line(" API version: 1.45"); out.line("Server: Docker Desktop"); out.line(" Engine Version: 26.1.4"); out.line(" containerd: 1.6.33"); return out;
    case "info": {
      out.line("Server:"); out.line(" Containers: "+st.containers.length);
      out.line("  Running: "+st.containers.filter(c=>c.status==="running").length);
      out.line("  Stopped: "+st.containers.filter(c=>c.status!=="running").length);
      out.line(" Images: "+st.images.length);
      out.line(" Storage Driver: overlay2"); out.line(" Cgroup Driver: cgroupfs  Cgroup Version: 2");
      out.line(" Kernel Version: 6.6.16-linuxkit"); out.line(" Total Memory: 7.654GiB");
      return out;
    }
    case "help": case "--help": usage(out); return out;
    case "login": out.ok("Login Succeeded"); return out;
    case "logout": out.line("Removing login credentials"); return out;

    case "pull": { const p=parseArgs(rest,new Set(["--platform"]),false); if(!p.rest[0]){out.err("\"docker pull\" requires exactly 1 argument.");return out;} pullImage(st,p.rest[0],out); return out; }
    case "push": {
      const ref=rest.filter(x=>!x.startsWith("-"))[0];
      const img=findImage(st,ref);
      if(!img){ out.err("An image does not exist locally with the tag: "+ref); return out; }
      if(!/\//.test(img.repo)){ out.err("denied: requested access to the resource is denied"); out.dim("Для отправки в Docker Hub образ должен быть помечен как <пользователь>/<имя>:<тег>."); return out; }
      out.line("The push refers to repository ["+(img.repo.includes(".")?"":"docker.io/")+img.repo+"]");
      img.layers.slice(0,3).forEach(l=>out.dim(l.id.slice(0,12)+": Pushed"));
      out.line(img.tag+": digest: "+img.digest+" size: "+(1000+img.layers.length*400));
      st.pushed.push(img.repo+":"+img.tag);
      return out;
    }
    case "tag": {
      const [src,dst]=rest.filter(x=>!x.startsWith("-"));
      const img=findImage(st,src);
      if(!img){ out.err("Error response from daemon: No such image: "+src); return out; }
      const r=refParse(dst);
      const dup=st.images.find(x=>x.repo===r.repo&&x.tag===r.tag);
      if(dup){ dup.repo="<none>"; dup.tag="<none>"; }
      if(img.repo==="<none>"){ img.repo=r.repo; img.tag=r.tag; }
      else st.images.push(Object.assign({},img,{repo:r.repo,tag:r.tag}));
      return out;
    }
    case "images": {
      const p=parseArgs(rest,new Set(["--filter","--format"]),false);
      let list=st.images.slice().reverse();
      if(!p.has("--all")) list=list;
      if(p.has("--quiet")){ list.forEach(i=>out.line(i.id.slice(0,12))); return out; }
      const filt=p.one("--filter");
      if(filt==="dangling=true") list=list.filter(i=>i.repo==="<none>");
      if(p.rest[0]) list=list.filter(i=>i.repo===p.rest[0]||i.repo+":"+i.tag===p.rest[0]);
      table(out,["REPOSITORY","TAG","IMAGE ID","CREATED","SIZE"],
        list.map(i=>[i.repo,i.tag,i.id.slice(0,12),fmtAgo(i.created),fmtSize(imgSize(i))]));
      return out;
    }
    case "rmi": {
      const p=parseArgs(rest.map(x=>x==="-f"?"--force":x),new Set([]),false);
      p.rest.forEach(ref=>{
        const img=findImage(st,ref);
        if(!img){ out.err("Error response from daemon: No such image: "+ref); return; }
        const used=st.containers.find(c=>c.imageId===img.id);
        if(used && !p.has("--force")){ out.err("Error response from daemon: conflict: unable to remove repository reference \""+ref+"\" (must force) - container "+used.id.slice(0,12)+" is using its referenced image "+img.id.slice(0,12)); return; }
        st.images=st.images.filter(x=>x!==img);
        out.line("Untagged: "+img.repo+":"+img.tag);
        out.line("Deleted: sha256:"+img.id);
      });
      return out;
    }
    case "history": {
      const img=findImage(st,rest.filter(x=>!x.startsWith("-"))[0]);
      if(!img){ out.err("Error response from daemon: No such image"); return out; }
      table(out,["IMAGE","CREATED","CREATED BY","SIZE"],
        img.layers.slice().reverse().map((l,i)=>[i===0?img.id.slice(0,12):"<missing>", fmtAgo(img.created),
          (l.cmd.length>52?l.cmd.slice(0,51)+"…":l.cmd), fmtSize(l.size)]));
      return out;
    }
    case "build": dockerBuild(st,rest,out); return out;

    case "run": { const c=createContainer(st,rest,out,true); if(c && c.__shell) {} return out; }
    case "create": { const c=createContainer(st,rest,out,false); if(c) out.line(c.id); return out; }
    case "start": {
      const p=parseArgs(rest,new Set([]),false);
      p.rest.forEach(r=>{ const c=findContainer(st,r); if(!c){out.err("Error response from daemon: No such container: "+r);return;}
        startContainer(st,c,mkOut(),false); out.line(c.name); });
      return out;
    }
    case "stop": {
      const p=parseArgs(rest,new Set(["--time","-t"]),false);
      p.rest.forEach(r=>{ const c=findContainer(st,r); if(!c){out.err("Error response from daemon: No such container: "+r);return;}
        stopContainer(st,c); out.line(c.name); });
      return out;
    }
    case "kill": { rest.filter(x=>!x.startsWith("-")).forEach(r=>{ const c=findContainer(st,r); if(!c){out.err("Error response from daemon: No such container: "+r);return;} c.status="exited"; c.exitCode=137; c.stopped=Date.now(); out.line(c.name); }); return out; }
    case "restart": { rest.filter(x=>!x.startsWith("-")).forEach(r=>{ const c=findContainer(st,r); if(!c){out.err("Error response from daemon: No such container: "+r);return;} stopContainer(st,c); c.logs=[]; startContainer(st,c,mkOut(),false); c.restarts++; out.line(c.name); }); return out; }
    case "pause": { rest.forEach(r=>{const c=findContainer(st,r); if(c){c.status="paused"; out.line(c.name);}}); return out; }
    case "unpause": { rest.forEach(r=>{const c=findContainer(st,r); if(c){c.status="running"; out.line(c.name);}}); return out; }
    case "rm": {
      const p=parseArgs(rest.map(x=>x==="-f"?"--force":x),new Set([]),false);
      p.rest.forEach(r=>{
        const c=findContainer(st,r);
        if(!c){ out.err("Error response from daemon: No such container: "+r); return; }
        if(c.status==="running" && !p.has("--force")){ out.err("Error response from daemon: cannot remove container \"/"+c.name+"\": container is running: stop the container before removing or force remove"); return; }
        removeContainer(st,c,p.has("--volumes")); out.line(r);
      });
      return out;
    }
    case "ps": {
      const p=parseArgs(rest,new Set(["--filter","--format","--last"]),false);
      let list=st.containers.slice().reverse();
      if(!p.has("--all")) list=list.filter(c=>c.status==="running"||c.status==="paused");
      p.all("--filter").forEach(f=>{
        if(typeof f!=="string") return;
        const [k,v]=f.split("=");
        if(k==="status") list=list.filter(c=>c.status===v);
        if(k==="name") list=list.filter(c=>c.name.includes(v));
        if(k==="ancestor") list=list.filter(c=>c.image===v||c.image.startsWith(v));
        if(k==="label") list=list.filter(c=>{const [lk,lv]=v.split("="); return lv?c.labels[lk]===lv:lk in c.labels;});
      });
      if(p.has("--quiet")){ list.forEach(c=>out.line(c.id.slice(0,12))); return out; }
      table(out,["CONTAINER ID","IMAGE","COMMAND","CREATED","STATUS","PORTS","NAMES"],
        list.map(c=>[c.id.slice(0,12),c.image,cmdText(c),fmtAgo(c.created),statusText(c),portsText(c),c.name]));
      return out;
    }
    case "logs": {
      const p=parseArgs(rest.map(x=>x==="-f"?"--follow":x),new Set(["--tail","--since","--until"]),false);
      const c=findContainer(st,p.rest[0]);
      if(!c){ out.err("Error response from daemon: No such container: "+(p.rest[0]||"")); return out; }
      let L=c.logs.slice();
      const tail=p.one("--tail"); if(tail && tail!=="all") L=L.slice(-Math.max(0,+tail));
      if(!L.length) out.dim("(лог пуст)");
      L.forEach(l=>out.line(l));
      if(p.has("--follow")) out.dim("(-f в эмуляторе показывает уже накопленный лог и возвращает приглашение)");
      return out;
    }
    case "exec": {
      const p=parseArgs(rest,new Set(["--env","--workdir","--user","-e","-w","-u"]),true);
      const c=findContainer(st,p.rest[0]);
      if(!c){ out.err("Error response from daemon: No such container: "+(p.rest[0]||"")); return out; }
      if(c.status!=="running"){ out.err("Error response from daemon: container "+c.id.slice(0,12)+" is not running"); return out; }
      const inner=p.rest.slice(1);
      if(!inner.length){ out.err("\"docker exec\" requires at least 2 arguments."); return out; }
      if(["sh","bash","/bin/sh","/bin/bash","ash"].includes(inner[0]) && inner.length===1){
        if(p.has("--interactive")&&p.has("--tty")){
          st.shellIn=c.id;
          out.dim("Вы внутри контейнера "+c.name+". Команды: ls, cat, env, hostname, whoami, curl, ping. Выход — exit");
          return out;
        }
        out.dim("(без -it оболочка запускается и сразу завершается — добавьте -it)");
        return out;
      }
      const saveWd=c.workdir;
      if(p.one("--workdir")) c.workdir=p.one("--workdir");
      const r=shellExec(st,c,inner.map(x=>/\s/.test(x)?'"'+x+'"':x).join(" "));
      c.workdir=saveWd;
      r.out.L.forEach(l=>out.raw(l.t,l.cls));
      return out;
    }
    case "inspect": {
      const p=parseArgs(rest.map(x=>x==="-f"?"--format":x),new Set(["--format","--type"]),false);
      const refs=p.rest;
      if(!refs.length){ out.err("\"docker inspect\" requires at least 1 argument."); return out; }
      const res=refs.map(r=>{ const f=findAny(st,r); return f?inspectJson(st,f.obj,f.kind):null; });
      if(res.some(x=>x===null)){ out.err("Error: No such object: "+refs[res.indexOf(null)]); return out; }
      const fmt=p.one("--format");
      if(fmt){
        res.forEach(o=>{
          const path=fmt.replace(/[{}.]+/g," ").trim().split(/\s+/).filter(Boolean);
          let v=o; path.forEach(k=>{ v = v==null?v : v[k]; });
          out.line(typeof v==="object"?JSON.stringify(v):String(v));
        });
        return out;
      }
      JSON.stringify(res,null,4).split("\n").forEach(l=>out.line(l));
      return out;
    }
    case "port": {
      const c=findContainer(st,rest[0]);
      if(!c){ out.err("Error response from daemon: No such container: "+rest[0]); return out; }
      if(!c.ports.length){ out.dim("(нет опубликованных портов)"); return out; }
      c.ports.forEach(p=>out.line(p.cont+"/"+p.proto+" -> 0.0.0.0:"+p.host));
      return out;
    }
    case "top": {
      const c=findContainer(st,rest[0]);
      if(!c){ out.err("Error response from daemon: No such container: "+rest[0]); return out; }
      table(out,["UID","PID","PPID","CMD"],[[c.user,"1","0",c.cmd.join(" ")]]);
      return out;
    }
    case "stats": {
      const list=st.containers.filter(c=>c.status==="running");
      if(!list.length){ out.dim("(нет запущенных контейнеров)"); return out; }
      table(out,["CONTAINER ID","NAME","CPU %","MEM USAGE / LIMIT","MEM %","NET I/O"],
        list.map(c=>{
          const lim=c.memory?parseMem(c.memory):512*MB;
          const use=Math.round(lim*(0.08+Math.random()*0.25));
          return [c.id.slice(0,12),c.name,(Math.random()*4).toFixed(2)+"%",fmtSize(use)+" / "+fmtSize(lim),
                  (use/lim*100).toFixed(2)+"%",fmtSize(Math.random()*3*MB)+" / "+fmtSize(Math.random()*MB)];
        }));
      return out;
    }
    case "cp": {
      const [src,dst]=rest.filter(x=>!x.startsWith("-"));
      if(!src||!dst){ out.err("\"docker cp\" requires 2 arguments."); return out; }
      const parse=s=>{ const i=s.indexOf(":"); if(i>0 && !s.startsWith("/") && !s.startsWith(".")) return {c:findContainer(st,s.slice(0,i)), p:s.slice(i+1)}; return {c:null,p:s}; };
      const S=parse(src), D=parse(dst);
      if(S.c&&!D.c){ const v=cRead(st,S.c,S.p); if(v===undefined){out.err("Error: No such container:path");return out;} st.files[normPath(D.p,st.cwd)]=v; out.dim("Successfully copied to "+D.p); return out; }
      if(!S.c&&D.c){ const v=st.files[normPath(S.p,st.cwd)]; if(v===undefined){out.err("Error: no such file "+S.p);return out;} cWrite(st,D.c,D.p,v); out.dim("Successfully copied to "+D.c.name+":"+D.p); return out; }
      out.err("Error: unsupported copy"); return out;
    }

    case "network": {
      const sub=rest[0], r2=rest.slice(1);
      if(sub==="ls"||sub==="list"){ table(out,["NETWORK ID","NAME","DRIVER","SCOPE"], st.networks.map(n=>[n.id.slice(0,12),n.name,n.driver,"local"])); return out; }
      if(sub==="create"){
        const p=parseArgs(r2.map(x=>x==="-d"?"--driver":x),new Set(["--driver","--subnet","--gateway","--label","--opt"]),false);
        const name=p.rest[0];
        if(!name){ out.err("\"docker network create\" requires exactly 1 argument."); return out; }
        if(netByName(st,name)&&st.networks.find(n=>n.name===name)){ out.err("Error response from daemon: network with name "+name+" already exists"); return out; }
        const n={id:hex(12),name,driver:p.one("--driver")||"bridge",subnet:p.one("--subnet")||("172."+(st.netSeq++)+".0.0/16"),next:2,internal:p.has("--internal")};
        st.networks.push(n); out.line(n.id); return out;
      }
      if(sub==="rm"||sub==="remove"){
        r2.filter(x=>!x.startsWith("-")).forEach(nm=>{
          const n=netByName(st,nm);
          if(!n){ out.err("Error response from daemon: network "+nm+" not found"); return; }
          if(n.builtin){ out.err("Error response from daemon: "+n.name+" is a pre-defined network and cannot be removed"); return; }
          const used=st.containers.find(c=>c.networks[n.name]);
          if(used){ out.err("Error response from daemon: error while removing network: network "+n.name+" id "+n.id+" has active endpoints"); return; }
          st.networks=st.networks.filter(x=>x!==n); out.line(nm);
        });
        return out;
      }
      if(sub==="connect"||sub==="disconnect"){
        const p=parseArgs(r2,new Set(["--alias","--ip"]),false);
        const n=netByName(st,p.rest[0]), c=findContainer(st,p.rest[1]);
        if(!n){ out.err("Error response from daemon: network "+p.rest[0]+" not found"); return out; }
        if(!c){ out.err("Error response from daemon: No such container: "+p.rest[1]); return out; }
        if(sub==="connect") attach(st,c,n,[c.name].concat(p.all("--alias").filter(x=>typeof x==="string")));
        else delete c.networks[n.name];
        return out;
      }
      if(sub==="inspect"){ const n=netByName(st,r2[0]); if(!n){out.err("Error: No such network: "+r2[0]);return out;} JSON.stringify([inspectJson(st,n,"network")],null,4).split("\n").forEach(l=>out.line(l)); return out; }
      if(sub==="prune"){
        const unused=st.networks.filter(n=>!n.builtin && !st.containers.some(c=>c.networks[n.name]));
        if(unused.length) out.line("Deleted Networks:");
        unused.forEach(n=>{ out.line(n.name); st.networks=st.networks.filter(x=>x!==n); });
        return out;
      }
      out.err("docker network: unknown command \""+(sub||"")+"\""); return out;
    }
    case "volume": {
      const sub=rest[0], r2=rest.slice(1);
      if(sub==="ls"||sub==="list"){ table(out,["DRIVER","VOLUME NAME"], st.volumes.map(v=>[v.driver,v.name])); return out; }
      if(sub==="create"){ const p=parseArgs(r2.map(x=>x==="-d"?"--driver":x),new Set(["--driver","--label","--opt"]),false);
        const name=p.rest[0]||("vol_"+hex(6)); ensureVolume(st,name); out.line(name); return out; }
      if(sub==="rm"||sub==="remove"){
        r2.filter(x=>!x.startsWith("-")).forEach(nm=>{
          const v=st.volumes.find(x=>x.name===nm);
          if(!v){ out.err("Error response from daemon: get "+nm+": no such volume"); return; }
          const used=st.containers.find(c=>c.mounts.some(m=>m.source===nm));
          if(used){ out.err("Error response from daemon: remove "+nm+": volume is in use - ["+used.id+"]"); return; }
          st.volumes=st.volumes.filter(x=>x!==v); delete st.volStore[nm]; out.line(nm);
        });
        return out;
      }
      if(sub==="inspect"){ const v=st.volumes.find(x=>x.name===r2[0]); if(!v){out.err("Error: No such volume: "+r2[0]);return out;} JSON.stringify([inspectJson(st,v,"volume")],null,4).split("\n").forEach(l=>out.line(l)); return out; }
      if(sub==="prune"){
        const unused=st.volumes.filter(v=>!st.containers.some(c=>c.mounts.some(m=>m.source===v.name)));
        if(unused.length) out.line("Deleted Volumes:");
        unused.forEach(v=>{ out.line(v.name); delete st.volStore[v.name]; });
        st.volumes=st.volumes.filter(v=>!unused.includes(v));
        out.line("Total reclaimed space: "+fmtSize(unused.length*4*MB));
        return out;
      }
      out.err("docker volume: unknown command \""+(sub||"")+"\""); return out;
    }
    case "system": {
      const sub=rest[0], p=parseArgs(rest.slice(1).map(x=>x==="-f"?"--force":x),new Set(["--filter"]),false);
      if(sub==="df"){
        table(out,["TYPE","TOTAL","ACTIVE","SIZE","RECLAIMABLE"],[
          ["Images",String(st.images.length),String(new Set(st.containers.map(c=>c.imageId)).size),fmtSize(st.images.reduce((a,i)=>a+imgSize(i),0)),"—"],
          ["Containers",String(st.containers.length),String(st.containers.filter(c=>c.status==="running").length),fmtSize(st.containers.length*32*KB),"—"],
          ["Local Volumes",String(st.volumes.length),String(st.volumes.filter(v=>st.containers.some(c=>c.mounts.some(m=>m.source===v.name))).length),fmtSize(st.volumes.length*4*MB),"—"]]);
        return out;
      }
      if(sub==="prune"){
        let freed=0;
        const dead=st.containers.filter(c=>c.status!=="running"&&c.status!=="paused");
        if(dead.length){ out.line("Deleted Containers:"); dead.forEach(c=>{out.line(c.id); removeContainer(st,c); freed+=32*KB;}); }
        const nets=st.networks.filter(n=>!n.builtin && !st.containers.some(c=>c.networks[n.name]));
        if(nets.length){ out.line("Deleted Networks:"); nets.forEach(n=>{out.line(n.name); st.networks=st.networks.filter(x=>x!==n);}); }
        const used=new Set(st.containers.map(c=>c.imageId));
        const imgs=st.images.filter(i=>!used.has(i.id) && (p.has("--all")||i.repo==="<none>"));
        if(imgs.length){ out.line("Deleted Images:"); imgs.forEach(i=>{out.line("deleted: sha256:"+i.id); freed+=imgSize(i);}); st.images=st.images.filter(i=>!imgs.includes(i)); }
        out.line("Total reclaimed space: "+fmtSize(freed));
        return out;
      }
      out.err("docker system: unknown command"); return out;
    }
    case "compose": {
      const sub=rest[0], r2=rest.slice(1);
      if(sub==="up") { composeUp(st,r2,out); return out; }
      if(sub==="down"){ composeDown(st,r2,out); return out; }
      if(sub==="ps"){
        const proj=(st.cwd.split("/").pop()||"work").toLowerCase();
        const list=st.containers.filter(c=>c.composeProject===proj);
        if(!list.length){ out.dim("(нет контейнеров проекта)"); return out; }
        table(out,["NAME","IMAGE","COMMAND","SERVICE","STATUS","PORTS"],
          list.map(c=>[c.name,c.image,cmdText(c),c.composeService,statusText(c),portsText(c)]));
        return out;
      }
      if(sub==="logs"){
        const proj=(st.cwd.split("/").pop()||"work").toLowerCase();
        const only=r2.filter(x=>!x.startsWith("-"))[0];
        st.containers.filter(c=>c.composeProject===proj && (!only||c.composeService===only))
          .forEach(c=>c.logs.forEach(l=>out.line(c.composeService+"-1  | "+l)));
        return out;
      }
      if(sub==="build"){ const f=composeFile(st,null); if(!f){out.err("no configuration file provided");return out;}
        const doc=parseYaml(f.text); Object.entries(doc.services||{}).forEach(([svc,s])=>{
          if(!s.build) return; const ctx=typeof s.build==="string"?s.build:(s.build.context||".");
          out.line("Building "+svc); const bo=mkOut(); dockerBuild(st,[ctx,"--tag",s.image||((st.cwd.split("/").pop())+"-"+svc)],bo);
          bo.L.forEach(l=>out.raw("  "+l.t,l.cls==="err"?"err":"dim"));
        }); return out; }
      if(sub==="stop"||sub==="start"||sub==="restart"){
        const proj=(st.cwd.split("/").pop()||"work").toLowerCase();
        st.containers.filter(c=>c.composeProject===proj).forEach(c=>{
          if(sub!=="start") stopContainer(st,c);
          if(sub!=="stop") startContainer(st,c,mkOut(),false);
          out.line("Container "+c.name+"  "+(sub==="stop"?"Stopped":"Started"));
        });
        return out;
      }
      out.err("docker compose: unknown command \""+(sub||"")+"\""); return out;
    }
    default:
      out.err("docker: '"+cmd+"' is not a docker command.");
      out.dim("See 'docker --help' — или наберите help для списка команд эмулятора.");
      return out;
  }
}
function parseMem(s){
  const m=String(s).match(/^(\d+(?:\.\d+)?)\s*([kmg])?b?$/i);
  if(!m) return 512*MB;
  const n=parseFloat(m[1]), u=(m[2]||"").toLowerCase();
  return n*(u==="g"?GB:u==="m"?MB:u==="k"?KB:1);
}
function usage(out){
  out.line("Команды эмулятора Docker Yard:");
  out.dim("  образы     pull · build · images · rmi · tag · push · history · inspect");
  out.dim("  контейнеры run · create · start · stop · restart · kill · rm · ps · logs · exec · top · port · cp · stats");
  out.dim("  сети       network ls|create|rm|connect|disconnect|inspect|prune");
  out.dim("  тома       volume ls|create|rm|inspect|prune");
  out.dim("  compose    compose up|down|ps|logs|build");
  out.dim("  система    system df · system prune · version · info");
  out.dim("  оболочка   ls · cat · pwd · echo · curl · rm · mkdir · history");
  out.dim("  тренажёр   reset — вернуть задание к началу, clear — очистить экран");
}

/* автодополнение */
const COMPLETIONS = ["docker run","docker ps","docker ps -a","docker images","docker pull ","docker build -t ",
 "docker exec -it ","docker logs ","docker stop ","docker start ","docker rm ","docker rmi ","docker inspect ",
 "docker network ls","docker network create ","docker network connect ","docker volume ls","docker volume create ",
 "docker volume inspect ","docker compose up -d","docker compose down","docker compose ps","docker compose logs",
 "docker history ","docker stats","docker system prune","docker system df","docker port ","docker cp ","docker tag ",
 "docker push ","docker top ","docker restart ","docker version","docker info","curl http://localhost:","cat ","ls","help","reset","clear"];
