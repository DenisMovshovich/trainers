/* ---------------- сборка образа ---------------- */
function runSize(cmd){
  const c=cmd.toLowerCase();
  if(/apt-get\s+install|apt\s+install/.test(c)) return 180*MB;
  if(/apk\s+add/.test(c)) return /--no-cache/.test(c)?9*MB:14*MB;
  if(/npm\s+(ci|install|i)\b/.test(c)) return /--production|--omit=dev/.test(c)?42*MB:96*MB;
  if(/yarn\s+install/.test(c)) return 90*MB;
  if(/pip\s+install/.test(c)) return 38*MB;
  if(/go\s+mod\s+download/.test(c)) return 22*MB;
  if(/go\s+build/.test(c)) return 6*MB;
  if(/adduser|useradd|addgroup|groupadd/.test(c)) return 4*KB;
  if(/^\s*rm\s+-rf/.test(c)) return 0;
  if(/mkdir|chown|chmod|^ln\s|touch/.test(c)) return 8*KB;
  if(/curl|wget/.test(c)) return 12*MB;
  return 1*MB;
}
function ignoreMatch(pattern, path){
  const p=pattern.replace(/^\.\//,"").replace(/\/$/,"");
  if(!p) return false;
  if(p.includes("*")){
    const rx=new RegExp("^"+p.split("*").map(s=>s.replace(/[.+?^${}()|[\]\\]/g,"\\$&")).join("[^/]*")+"$");
    return rx.test(path) || rx.test(path.split("/").pop());
  }
  return path===p || path.startsWith(p+"/");
}
function ctxFiles(st, base){
  base = base.replace(/\/$/,"");
  const ign = String(st.files[base+"/.dockerignore"]||"").split("\n").map(s=>s.trim()).filter(s=>s&&!s.startsWith("#"));
  const map={};
  Object.keys(st.files).forEach(k=>{
    if(k!==base && !k.startsWith(base+"/")) return;
    const rel = k.slice(base.length+1);
    if(!rel) return;
    if(ign.some(p=>ignoreMatch(p,rel))) return;
    map[rel]=st.files[k];
  });
  return map;
}
function newStage(base, name){
  const cfgOf = b => ({cmd:(b.config.cmd||[]).slice(), entrypoint:b.config.entrypoint?b.config.entrypoint.slice():null,
    env:Object.assign({},b.config.env), workdir:b.config.workdir||"/", user:b.config.user||"root",
    exposed:(b.config.exposed||[]).slice(), volumes:(b.config.volumes||[]).slice(),
    health:b.config.health?Object.assign({},b.config.health):null, labels:Object.assign({},b.config.labels||{})});
  return {
    name, fs: base?Object.assign({},base.fs):{},
    config: base?cfgOf(base):{cmd:[],entrypoint:null,env:{},workdir:"/",user:"root",exposed:[],volumes:[],health:null,labels:{}},
    layers: base?base.layers.slice():[],
    kind: base?base.kind:"shell",
    serve: base&&base.serve?Object.assign({},base.serve):null,
    users: base?(base.users||["root"]).slice():["root"],
    baseLogs: base?(base.baseLogs||[]).slice():[],
    needsEnv: base?(base.needsEnv||[]).slice():[]
  };
}
function dockerBuild(st, argv, out){
  argv = argv.map(x=> x==="-t"?"--tag" : x);
  const p = parseArgs(argv, new Set(["--tag","--file","--target","--build-arg","--label","--platform","--progress","--cache-from","--output","--network"]), false);
  const ctxArg = p.rest[0];
  if(!ctxArg){ out.err("\"docker build\" requires exactly 1 argument."); out.dim("Usage:  docker build [OPTIONS] PATH"); return null; }
  const ctxPath = normPath(ctxArg, st.cwd);
  const dfPath = normPath(p.one("--file")||(ctxPath+"/Dockerfile"), st.cwd);
  const df = st.files[dfPath];
  if(df===undefined){ out.err("ERROR: failed to solve: failed to read dockerfile: open "+dfPath+": no such file or directory"); return null; }
  const ctx = ctxFiles(st, ctxPath);
  const ctxSize = Object.values(ctx).reduce((a,v)=>a+String(v).length,0);
  out.line("Sending build context to Docker daemon  "+fmtSize(Math.max(2048,ctxSize)));

  const rawLines = String(df).split("\n");
  const instrs=[]; let buf="";
  rawLines.forEach(l=>{
    const t=l.replace(/\s+$/,"");
    if(!t.trim() || /^\s*#/.test(t)){ if(!buf) return; }
    if(buf){ buf += " " + t.replace(/\\$/,"").trim(); }
    else buf = t.trim();
    if(/\\$/.test(t)) { buf = buf.replace(/\\$/,"").trim(); return; }
    if(buf.trim()) instrs.push(buf.trim());
    buf="";
  });
  if(buf.trim()) instrs.push(buf.trim());

  const buildArgs={};
  p.all("--build-arg").forEach(a=>{ if(typeof a!=="string")return; const i=a.indexOf("="); if(i>-1) buildArgs[a.slice(0,i)]=a.slice(i+1); });

  const stages={}; const order=[];
  let cur=null, curName=null;
  const total=instrs.length;
  let cacheBroken=false;

  const expand = s => s.replace(/\$\{?(\w+)\}?/g,(m,k)=> (cur&&cur.config.env[k])||buildArgs[k]||m);

  for(let n=0;n<instrs.length;n++){
    const raw=instrs[n];
    const sp=raw.indexOf(" ");
    const verb=(sp>-1?raw.slice(0,sp):raw).toUpperCase();
    let rest=(sp>-1?raw.slice(sp+1):"").trim();
    out.line("Step "+(n+1)+"/"+total+" : "+verb+" "+rest);

    if(verb==="FROM"){
      const m=rest.match(/^(\S+)(?:\s+[Aa][Ss]\s+(\S+))?$/);
      const ref=expand(m?m[1]:rest), asName=m&&m[2]?m[2]:null;
      let base=null;
      if(ref!=="scratch"){
        if(stages[ref]) base=stages[ref];
        else {
          base=findImage(st,ref);
          if(!base){
            const rp=refParse(ref);
            if(!REGISTRY[rp.full]){ out.err("ERROR: failed to solve: "+ref+": not found"); return null; }
            base=pullImage(st,ref,out);
          }
        }
      }
      cur=newStage(ref==="scratch"?null:base, asName||String(Object.keys(stages).length));
      curName=asName||String(Object.keys(stages).length);
      stages[curName]=cur; if(asName) stages[asName]=cur;
      order.push(curName);
      cur.parentKey = "from:"+ref;
      out.dim(" ---> "+(base?base.id?base.id.slice(0,12):hex(12):hex(12)));
      continue;
    }
    if(!cur){ out.err("Error response from daemon: dockerfile parse error: no FROM"); return null; }

    const parentId = cur.layers.length?cur.layers[cur.layers.length-1].id:"scratch";
    let extra="";
    if(verb==="COPY"||verb==="ADD"){
      const parts=tokenize(rest);
      const fromFlag=parts.find(x=>x.startsWith("--from="));
      const files=parts.filter(x=>!x.startsWith("--"));
      const src=files.slice(0,-1), dst=files[files.length-1];
      const srcMap = fromFlag ? (stages[fromFlag.slice(7)]||{fs:{}}).fs : ctx;
      const picked = pickSources(srcMap, src, !!fromFlag);
      extra = hash32(Object.keys(picked).sort().map(k=>k+":"+String(picked[k]).length+":"+hash32(String(picked[k]))).join("|"));
    }
    const key = hash32(parentId+"|"+raw+"|"+extra);
    const cached = st.buildCache[key];
    let layerId;
    if(cached && !cacheBroken){
      out.dim(" ---> Using cache");
      layerId = cached.id;
      applyInstr(st, cur, verb, rest, ctx, stages, out, expand, buildArgs, true);
      cur.layers.push({id:layerId, cmd:cached.cmd, size:cached.size});
      out.dim(" ---> "+layerId.slice(0,12));
      continue;
    }
    cacheBroken=true;
    const res = applyInstr(st, cur, verb, rest, ctx, stages, out, expand, buildArgs, false);
    if(res && res.error){ out.err(res.error); return null; }
    layerId=hex(32);
    const size = res && res.size!==undefined ? res.size : 0;
    const lcmd = verb==="RUN" ? "/bin/sh -c "+rest : "/bin/sh -c #(nop) "+verb+" "+rest;
    cur.layers.push({id:layerId, cmd:lcmd, size});
    st.buildCache[key]={id:layerId, cmd:lcmd, size};
    out.dim(" ---> "+layerId.slice(0,12));
  }

  const targetName=p.one("--target");
  const finalStage = targetName ? stages[targetName] : cur;
  if(!finalStage){ out.err("ERROR: failed to solve: target stage \""+targetName+"\" could not be found"); return null; }
  const id = finalStage.layers.length ? finalStage.layers[finalStage.layers.length-1].id : hex(32);
  let img = st.images.find(x=>x.built && x.id===id);
  if(!img){
    img={
      id, repo:"<none>", tag:"<none>", digest:"sha256:"+hex(12), created:Date.now(),
      layers:finalStage.layers.slice(), config:finalStage.config, fs:finalStage.fs,
      kind:finalStage.kind, serve:finalStage.serve, baseLogs:finalStage.baseLogs,
      needsEnv:finalStage.needsEnv, users:finalStage.users, built:true
    };
    if(!img.serve && (img.config.cmd||[]).some(x=>/node|python|gunicorn|serve/.test(x))) img.serve={type:"app"};
    if(!img.serve && (img.config.entrypoint||[]).some(x=>/node|python|gunicorn/.test(x))) img.serve={type:"app"};
    st.images.push(img);
  }
  out.ok("Successfully built "+id.slice(0,12));
  const tags=p.all("--tag").filter(x=>typeof x==="string");
  if(!tags.length) out.dim("(образ без тега — он появится в docker images как <none>:<none>)");
  tags.forEach((t,i)=>{
    const r=refParse(t);
    const dup=st.images.find(x=>x.repo===r.repo&&x.tag===r.tag);
    if(dup && dup!==img){ dup.repo="<none>"; dup.tag="<none>"; }
    if(i===0){ img.repo=r.repo; img.tag=r.tag; }
    else st.images.push(Object.assign({},img,{repo:r.repo, tag:r.tag}));
    out.ok("Successfully tagged "+r.full);
  });
  return img;
}
function pickSources(map, srcs, fromStage){
  const picked={};
  srcs.forEach(s=>{
    let sp = s.replace(/^\.\//,"");
    if(fromStage) sp = sp.replace(/^\//,"");
    if(sp==="."||sp===""){ Object.keys(map).forEach(k=>picked[k]=map[k]); return; }
    if(sp.includes("*")){
      const rx=new RegExp("^"+sp.split("*").map(x=>x.replace(/[.+?^${}()|[\]\\]/g,"\\$&")).join("[^/]*")+"$");
      Object.keys(map).forEach(k=>{ const kk=fromStage?k.replace(/^\//,""):k; if(rx.test(kk)||rx.test(kk.split("/").pop())) picked[kk]=map[k]; });
      return;
    }
    let hit=false;
    Object.keys(map).forEach(k=>{
      const kk=fromStage?k.replace(/^\//,""):k;
      if(kk===sp){ picked[kk]=map[k]; hit=true; }
      else if(kk.startsWith(sp.replace(/\/$/,"")+"/")){ picked[kk]=map[k]; hit=true; }
    });
    if(!hit) picked["__missing__"+sp]=undefined;
  });
  return picked;
}
function applyInstr(st, stg, verb, rest, ctx, stages, out, expand, buildArgs, cacheHit){
  const wd = stg.config.workdir||"/";
  switch(verb){
    case "WORKDIR": stg.config.workdir = normPath(expand(rest), wd); return {size:0};
    case "ENV": {
      const m=rest.match(/^(\w+)\s+(.+)$/);
      if(m && !rest.includes("=")) stg.config.env[m[1]]=expand(m[2]).replace(/^["']|["']$/g,"");
      else tokenize(rest).forEach(kv=>{ const i=kv.indexOf("="); if(i>-1) stg.config.env[kv.slice(0,i)]=expand(kv.slice(i+1)); });
      return {size:0};
    }
    case "ARG": { const i=rest.indexOf("="); const k=i>-1?rest.slice(0,i):rest.trim(); if(buildArgs[k]===undefined && i>-1) buildArgs[k]=rest.slice(i+1); return {size:0}; }
    case "LABEL": { tokenize(rest).forEach(kv=>{ const i=kv.indexOf("="); if(i>-1) stg.config.labels[kv.slice(0,i)]=kv.slice(i+1); }); return {size:0}; }
    case "EXPOSE": { tokenize(expand(rest)).forEach(pp=>{ const v=pp.includes("/")?pp:pp+"/tcp"; if(!stg.config.exposed.includes(v)) stg.config.exposed.push(v); }); return {size:0}; }
    case "USER": { stg.config.user=expand(rest).trim(); return {size:0}; }
    case "VOLUME": { const v=rest.startsWith("[")?JSON.parse(rest.replace(/'/g,'"')):[rest]; v.forEach(x=>stg.config.volumes.push(x)); return {size:0}; }
    case "CMD": { stg.config.cmd = rest.startsWith("[")?safeJson(rest):["/bin/sh","-c",rest]; return {size:0}; }
    case "ENTRYPOINT": { stg.config.entrypoint = rest.startsWith("[")?safeJson(rest):["/bin/sh","-c",rest]; return {size:0}; }
    case "HEALTHCHECK": {
      if(/^NONE$/i.test(rest.trim())){ stg.config.health=null; return {size:0}; }
      const ci=rest.toUpperCase().indexOf("CMD");
      stg.config.health={test:["CMD-SHELL", ci>-1?rest.slice(ci+3).trim():rest], opts:rest.slice(0,ci>-1?ci:0).trim()};
      return {size:0};
    }
    case "STOPSIGNAL": case "SHELL": case "ONBUILD": case "MAINTAINER": return {size:0};
    case "RUN": {
      if(!cacheHit){
        const cmd=expand(rest);
        if(/adduser|useradd|addgroup|groupadd/.test(cmd)){
          const m=cmd.match(/(?:adduser|useradd)\s+(?:-[^\s]+\s+)*(\S+)/);
          if(m) stg.users.push(m[1]);
        }
        const redir=cmd.match(/>\s*(\S+)/);
        if(redir) stg.fs[normPath(redir[1],wd)]="(generated)";
        const gob=cmd.match(/go\s+build[^&|]*-o\s+(\S+)/);
        if(gob) stg.fs[normPath(gob[1],wd)]="<binary>";
        if(/npm\s+(ci|install|i)\b/.test(cmd)) stg.fs[normPath("node_modules",wd)+"/.package-lock.json"]="{}";
        if(/pip\s+install/.test(cmd)) stg.fs["/usr/local/lib/python3.12/site-packages/flask/__init__.py"]="# flask";
        if(/mkdir\s+(-p\s+)?(\S+)/.test(cmd)){ const mm=cmd.match(/mkdir\s+(?:-p\s+)?(\S+)/); stg.fs[normPath(mm[1],wd)+"/.keep"]=""; }
      }
      return {size:runSize(rest)};
    }
    case "COPY": case "ADD": {
      const parts=tokenize(rest);
      const fromFlag=parts.find(x=>x.startsWith("--from="));
      const chown=parts.find(x=>x.startsWith("--chown="));
      const files=parts.filter(x=>!x.startsWith("--")).map(expand);
      if(files.length<2) return {error:"COPY requires at least two arguments"};
      const dstRaw=files[files.length-1], srcs=files.slice(0,-1);
      const srcStage = fromFlag ? stages[fromFlag.slice(7)] : null;
      if(fromFlag && !srcStage) return {error:"ERROR: failed to solve: invalid --from flag: stage \""+fromFlag.slice(7)+"\" not found"};
      const map = srcStage ? srcStage.fs : ctx;
      const picked = pickSources(map, srcs, !!srcStage);
      const missing=Object.keys(picked).filter(k=>k.startsWith("__missing__"));
      if(missing.length) return {error:"ERROR: failed to solve: failed to compute cache key: \""+missing[0].slice(11)+"\": not found"};
      let size=0;
      const dst = normPath(dstRaw, wd);
      const multi = Object.keys(picked).length>1 || srcs[0]==="." || srcs[0].includes("*") || dstRaw.endsWith("/");
      Object.keys(picked).forEach(k=>{
        const content=picked[k]; size+=String(content).length;
        const target = multi ? normPath(dst+"/"+k.split("/").pop().replace(/^$/,k), "/") : dst;
        const full = multi ? normPath(dst+"/"+k,"/") : dst;
        if(!cacheHit) stg.fs[full]=content;
        else stg.fs[full]=content;
      });
      return {size:Math.max(size, 1024)};
    }
    default: return {error:"Dockerfile parse error: unknown instruction: "+verb};
  }
}
function safeJson(s){ try{ return JSON.parse(s.replace(/'/g,'"')); }catch(e){ return s.replace(/[[\]"']/g,"").split(",").map(x=>x.trim()); } }

/* ---------------- YAML (упрощённый) ---------------- */
function parseYaml(text){
  const lines=[];
  String(text).replace(/\t/g,"  ").split("\n").forEach(l=>{
    if(/^\s*#/.test(l)) return;
    const s=l.replace(/\s+#\s.*$/,"");
    if(!s.trim()) return;
    lines.push({indent:s.match(/^ */)[0].length, text:s.trim()});
  });
  let idx=0;
  function val(s){
    if(s==="") return null;
    if(/^".*"$/.test(s)||/^'.*'$/.test(s)) return s.slice(1,-1);
    if(s==="true") return true; if(s==="false") return false;
    if(/^-?\d+$/.test(s)) return +s;
    if(/^\[.*\]$/.test(s)) return s.slice(1,-1).split(",").map(x=>val(x.trim())).filter(x=>x!==null&&x!=="");
    return s;
  }
  function block(indent){
    if(idx>=lines.length) return null;
    if(lines[idx].text.startsWith("- ")){
      const arr=[];
      while(idx<lines.length && lines[idx].indent===indent && lines[idx].text.startsWith("- ")){
        arr.push(val(lines[idx].text.slice(2).trim())); idx++;
      }
      return arr;
    }
    const obj={};
    while(idx<lines.length && lines[idx].indent===indent){
      const m=lines[idx].text.match(/^([^:]+):\s*(.*)$/);
      if(!m){ idx++; continue; }
      const k=m[1].trim().replace(/^["']|["']$/g,""), v=m[2].trim();
      if(v===""){ idx++;
        if(idx<lines.length && lines[idx].indent>indent) obj[k]=block(lines[idx].indent);
        else obj[k]={};
      } else { obj[k]=val(v); idx++; }
    }
    return obj;
  }
  return block(lines.length?lines[0].indent:0)||{};
}

/* ---------------- docker compose ---------------- */
function composeFile(st, p){
  const cands = p ? [normPath(p,st.cwd)] : [st.cwd+"/docker-compose.yml", st.cwd+"/compose.yaml", st.cwd+"/docker-compose.yaml", st.cwd+"/compose.yml"];
  for(const c of cands) if(st.files[c]!==undefined) return {path:c, text:st.files[c]};
  return null;
}
function composeUp(st, argv, out){
  const p=parseArgs(argv, new Set(["--file","--project-name","--scale","--timeout"]), false);
  const f=composeFile(st, p.one("--file"));
  if(!f){ out.err("no configuration file provided: not found"); out.dim("Ожидается docker-compose.yml в текущем каталоге."); return; }
  let doc; try{ doc=parseYaml(f.text); }catch(e){ out.err("yaml: "+e.message); return; }
  const services=doc.services||{};
  const project=(p.one("--project-name")||st.cwd.split("/").pop()||"work").toLowerCase();
  const netName=project+"_default";
  let net=netByName(st,netName);
  if(!net){ net={id:hex(12), name:netName, driver:"bridge", subnet:"172."+(st.netSeq++)+".0.0/16", next:2, compose:project}; st.networks.push(net); out.line("Network "+netName+"  Created"); }
  if(doc.volumes) Object.keys(doc.volumes).forEach(v=>{ const vn=project+"_"+v; if(!st.volumes.find(x=>x.name===vn)){ ensureVolume(st,vn); out.line("Volume \""+vn+"\"  Created"); } });

  const names=Object.keys(services);
  const done=new Set(); const order=[];
  const visit=(n,seen)=>{
    if(done.has(n)||seen.has(n)) return; seen.add(n);
    const dep=services[n]&&services[n].depends_on;
    const deps = Array.isArray(dep)?dep:(dep?Object.keys(dep):[]);
    deps.forEach(d=>{ if(services[d]) visit(d,seen); });
    done.add(n); order.push(n);
  };
  names.forEach(n=>visit(n,new Set()));

  const detach = p.has("--detach");
  order.forEach(svc=>{
    const s=services[svc]||{};
    const cname=project+"-"+svc+"-1";
    const exist=st.containers.find(c=>c.name===cname);
    if(exist && exist.status==="running"){ out.line("Container "+cname+"  Running"); return; }
    if(exist) removeContainer(st,exist);
    let ref=s.image;
    if(s.build){
      const bctx = typeof s.build==="string"? s.build : (s.build.context||".");
      const bdf  = typeof s.build==="object" && s.build.dockerfile ? s.build.dockerfile : null;
      const tag = s.image || (project+"-"+svc);
      out.line("Building "+svc);
      const bargs=[bctx,"--tag",tag]; if(bdf) bargs.push("--file", normPath(bctx+"/"+bdf,st.cwd));
      if(typeof s.build==="object" && s.build.target) bargs.push("--target", s.build.target);
      const bo=mkOut(); const img=dockerBuild(st,bargs,bo);
      bo.L.forEach(l=>out.raw("  "+l.t, l.cls==="err"?"err":"dim"));
      if(!img) { out.err("failed to build "+svc); return; }
      ref=tag;
    }
    if(!ref){ out.err("service \""+svc+"\" has neither an image nor a build context specified"); return; }
    const args=[];
    args.push("--name", cname, "--network", netName, "--network-alias", svc, "--detach");
    (toArr(s.ports)).forEach(x=>args.push("--publish", String(x)));
    (toArr(s.volumes)).forEach(x=>{
      let v=String(x); const parts=v.split(":");
      if(parts[0] && !parts[0].startsWith("/") && !parts[0].startsWith(".") && doc.volumes && Object.prototype.hasOwnProperty.call(doc.volumes,parts[0])) parts[0]=project+"_"+parts[0];
      args.push("--volume", parts.join(":"));
    });
    if(Array.isArray(s.environment)) s.environment.forEach(e=>args.push("--env", String(e)));
    else if(s.environment && typeof s.environment==="object") Object.entries(s.environment).forEach(([k,v])=>args.push("--env", k+"="+v));
    if(s.user) args.push("--user", String(s.user));
    if(s.restart) args.push("--restart", String(s.restart));
    if(s.working_dir) args.push("--workdir", String(s.working_dir));
    if(s.read_only) args.push("--read-only");
    if(s.mem_limit) args.push("--memory", String(s.mem_limit));
    if(s.healthcheck && s.healthcheck.test){
      const t=Array.isArray(s.healthcheck.test)?s.healthcheck.test.filter(x=>x!=="CMD"&&x!=="CMD-SHELL").join(" "):String(s.healthcheck.test);
      args.push("--health-cmd", t);
    }
    args.push(ref);
    if(s.command) tokenize(String(s.command)).forEach(x=>args.push(x));
    const o2=mkOut();
    const c=createContainer(st,args,o2,true);
    if(!c){ o2.L.forEach(l=>out.raw(l.t,l.cls)); return; }
    c.composeService=svc; c.composeProject=project;
    c.labels["com.docker.compose.project"]=project;
    c.labels["com.docker.compose.service"]=svc;
    st.composeUpCount=(st.composeUpCount||0)+1;
    out.line("Container "+cname+"  Started");
  });
  if(!detach) out.dim("(запущено; используйте docker compose up -d, чтобы не занимать терминал)");
}
function toArr(x){ if(x==null) return []; return Array.isArray(x)?x:[x]; }
function composeDown(st, argv, out){
  const p=parseArgs(argv, new Set(["--file","--project-name","--timeout"]), false);
  const project=(p.one("--project-name")||st.cwd.split("/").pop()||"work").toLowerCase();
  const cs=st.containers.filter(c=>c.composeProject===project);
  if(!cs.length){ out.dim("Нет запущенных сервисов проекта "+project); }
  cs.forEach(c=>{ out.line("Container "+c.name+"  Removed"); removeContainer(st,c); });
  const net=st.networks.find(n=>n.name===project+"_default");
  if(net){ st.networks=st.networks.filter(n=>n!==net); out.line("Network "+net.name+"  Removed"); }
  if(p.has("--volumes")||p.has("-v")){
    st.volumes.filter(v=>v.name.startsWith(project+"_")).forEach(v=>{ out.line("Volume "+v.name+"  Removed"); delete st.volStore[v.name]; });
    st.volumes=st.volumes.filter(v=>!v.name.startsWith(project+"_"));
  }
}
