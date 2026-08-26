/* ============================================================
   Визуализация состояния движка
   ============================================================ */
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const clip = (s,n) => { s=String(s); return s.length>n ? s.slice(0,n-1)+"…" : s; };

function vizMap(st){
  const W=440, PAD=12;
  const running = st.containers;
  if(!running.length && st.networks.filter(n=>!n.builtin).length===0 && !st.volumes.length)
    return '<div class="viz-empty">Схема пуста.<br>Запустите контейнер — например<br><b>docker run -d -p 8080:80 nginx:alpine</b></div>';

  const used = st.networks.filter(n=> n.builtin ? st.containers.some(c=>c.networks[n.name]) : true);
  const nets = used.length?used:[st.networks[0]];
  const CW=124, CH=58, CGAP=8, NPADX=10, NPADY=26, NGAP=10;
  let y=52, parts=[], boxes={};
  const perRow = Math.floor((W-2*PAD-2*NPADX+CGAP)/(CW+CGAP)) || 1;

  nets.forEach(net=>{
    const members = st.containers.filter(c=>c.networks[net.name]);
    const rows = Math.max(1, Math.ceil(members.length/perRow));
    const nh = NPADY + rows*CH + (rows-1)*CGAP + 10;
    const nx = PAD, nw = W-2*PAD;
    const dashed = net.builtin?'stroke-dasharray="3 3"':'';
    parts.push('<rect x="'+nx+'" y="'+y+'" width="'+nw+'" height="'+nh+'" rx="3" fill="var(--surface-3)" stroke="var(--accent-line)" stroke-width="1" '+dashed+'/>');
    parts.push('<text x="'+(nx+10)+'" y="'+(y+15)+'" font-family="var(--font-mono)" font-size="9.5" font-weight="700" fill="var(--accent)">'+esc(net.name)+'</text>');
    parts.push('<text x="'+(nx+nw-10)+'" y="'+(y+15)+'" text-anchor="end" font-family="var(--font-mono)" font-size="8.5" fill="var(--ink-3)">'+esc(net.driver+(net.subnet?" · "+net.subnet:""))+'</text>');
    if(!members.length){
      parts.push('<text x="'+(nx+nw/2)+'" y="'+(y+NPADY+16)+'" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="var(--ink-3)">нет контейнеров</text>');
    }
    members.forEach((c,i)=>{
      const r=Math.floor(i/perRow), col=i%perRow;
      const cx=nx+NPADX+col*(CW+CGAP), cy=y+NPADY+r*(CH+CGAP);
      boxes[c.id]={x:cx,y:cy,w:CW,h:CH};
      const st_ = c.status;
      const col_ = st_==="running"?"var(--ok)":(st_==="created"?"var(--warn)":"var(--ink-3)");
      parts.push('<rect x="'+cx+'" y="'+cy+'" width="'+CW+'" height="'+CH+'" rx="2" fill="var(--surface)" stroke="var(--line)"/>');
      parts.push('<rect x="'+cx+'" y="'+cy+'" width="3" height="'+CH+'" fill="'+col_+'"/>');
      parts.push('<text x="'+(cx+9)+'" y="'+(cy+15)+'" font-family="var(--font-mono)" font-size="9.5" font-weight="700" fill="var(--ink)">'+esc(clip(c.name,15))+'</text>');
      parts.push('<circle cx="'+(cx+CW-9)+'" cy="'+(cy+11)+'" r="3" fill="'+col_+'"/>');
      parts.push('<text x="'+(cx+9)+'" y="'+(cy+28)+'" font-family="var(--font-mono)" font-size="8.5" fill="var(--ink-2)">'+esc(clip(c.image,20))+'</text>');
      const ip=c.networks[net.name].ip||"—";
      parts.push('<text x="'+(cx+9)+'" y="'+(cy+40)+'" font-family="var(--font-mono)" font-size="8" fill="var(--ink-3)">'+esc(ip)+'</text>');
      const pt=c.ports.map(p=>":"+p.host+"→"+p.cont).join(" ");
      if(pt) parts.push('<text x="'+(cx+9)+'" y="'+(cy+51)+'" font-family="var(--font-mono)" font-size="8" font-weight="700" fill="var(--signal)">'+esc(clip(pt,17))+'</text>');
      else if(c.mounts.length) parts.push('<text x="'+(cx+9)+'" y="'+(cy+51)+'" font-family="var(--font-mono)" font-size="8" fill="var(--ink-3)">'+c.mounts.length+' mount</text>');
    });
    y+=nh+NGAP;
  });

  const vols=st.volumes;
  let volY=y;
  if(vols.length){
    const rowsH=Math.ceil(vols.length/2)*30+22;
    parts.push('<rect x="'+PAD+'" y="'+y+'" width="'+(W-2*PAD)+'" height="'+rowsH+'" rx="3" fill="none" stroke="var(--line)" stroke-dasharray="2 3"/>');
    parts.push('<text x="'+(PAD+10)+'" y="'+(y+15)+'" font-family="var(--font-mono)" font-size="9.5" font-weight="700" fill="var(--ink-3)">ТОМА</text>');
    vols.forEach((v,i)=>{
      const vx=PAD+10+(i%2)*((W-2*PAD-20)/2), vy=y+24+Math.floor(i/2)*30;
      const inUse=st.containers.filter(c=>c.mounts.some(m=>m.source===v.name));
      parts.push('<ellipse cx="'+(vx+9)+'" cy="'+(vy+5)+'" rx="8" ry="3" fill="var(--surface-2)" stroke="var(--line)"/>');
      parts.push('<path d="M'+(vx+1)+' '+(vy+5)+'v11a8 3 0 0 0 16 0V'+(vy+5)+'" fill="var(--surface-2)" stroke="var(--line)"/>');
      parts.push('<text x="'+(vx+24)+'" y="'+(vy+9)+'" font-family="var(--font-mono)" font-size="8.5" font-weight="700" fill="var(--ink)">'+esc(clip(v.name,20))+'</text>');
      parts.push('<text x="'+(vx+24)+'" y="'+(vy+20)+'" font-family="var(--font-mono)" font-size="8" fill="'+(inUse.length?"var(--ok)":"var(--ink-3)")+'">'+esc(inUse.length?clip(inUse.map(c=>c.name).join(","),22):"не используется")+'</text>');
    });
    volY=y+rowsH; y=volY+NGAP;
  }

  const pub=[];
  st.containers.filter(c=>c.status==="running").forEach(c=>c.ports.forEach(p=>pub.push({h:p.host,c:c.name,p:p.cont})));
  let head='<rect x="'+(PAD-5)+'" y="14" width="'+(W-2*PAD+10)+'" height="'+(y-24)+'" rx="4" fill="none" stroke="var(--line)" stroke-dasharray="5 4"/>'+
    '<text x="'+(PAD+3)+'" y="30" font-family="var(--font-mono)" font-size="9.5" font-weight="700" letter-spacing="1" fill="var(--ink-3)">ХОСТ · localhost</text>';
  if(pub.length){
    let px=W-PAD-4;
    pub.slice(0,4).reverse().forEach(p=>{
      const label=":"+p.h;
      const wpx=label.length*5.6+12;
      px-=wpx+5;
      head+='<rect x="'+px+'" y="9" width="'+wpx+'" height="15" rx="2" fill="var(--signal)"/>'+
            '<text x="'+(px+wpx/2)+'" y="20" text-anchor="middle" font-family="var(--font-mono)" font-size="8.5" font-weight="700" fill="var(--surface)">'+esc(label)+'</text>';
    });
  }
  const H=y+4;
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Схема состояния Docker">'+
    '<defs><pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0v16" fill="none" stroke="var(--grid)" stroke-width=".4" opacity=".5"/></pattern></defs>'+
    '<rect width="'+W+'" height="'+H+'" fill="url(#g)"/>'+head+parts.join("")+'</svg>';
}

function vizLayers(st){
  if(!st.images.length) return '<div class="viz-empty">Локальных образов нет.<br>Скачайте: <b>docker pull alpine:3.19</b><br>или соберите: <b>docker build -t app .</b></div>';
  const imgs = st.images.slice().reverse().slice(0,3);
  let html='<div style="padding:12px 14px">';
  imgs.forEach(img=>{
    const total=imgSize(img);
    const max=Math.max(...img.layers.map(l=>l.size),1);
    html+='<div style="margin-bottom:16px">';
    html+='<div style="display:flex;justify-content:space-between;align-items:baseline;font-family:var(--font-mono);font-size:11px;margin-bottom:7px">'+
      '<b style="color:var(--accent)">'+esc(img.repo+":"+img.tag)+'</b>'+
      '<span style="color:var(--ink-3)">'+img.layers.length+' сл. · '+fmtSize(total)+'</span></div>';
    img.layers.slice().reverse().forEach(l=>{
      const pct=Math.max(2, Math.round(l.size/max*100));
      const zero=l.size===0;
      html+='<div style="display:grid;grid-template-columns:1fr 54px;gap:8px;align-items:center;margin-bottom:3px">'+
        '<div style="position:relative;background:var(--surface-3);border:1px solid var(--line-soft);border-radius:2px;height:20px;overflow:hidden">'+
          '<div style="position:absolute;inset:0 auto 0 0;width:'+pct+'%;background:'+(zero?"var(--surface-2)":(l.base?"var(--accent-line)":"var(--accent-soft)"))+'"></div>'+
          '<div style="position:relative;font-family:var(--font-mono);font-size:8.5px;line-height:20px;padding:0 6px;white-space:nowrap;overflow:hidden;color:var(--ink-2)">'+
            esc(clip(l.cmd.replace("/bin/sh -c #(nop) ","").replace("/bin/sh -c ","RUN "),46))+'</div>'+
        '</div>'+
        '<div style="font-family:var(--font-mono);font-size:9px;text-align:right;color:'+(zero?"var(--ink-3)":"var(--ink)")+';font-variant-numeric:tabular-nums">'+fmtSize(l.size)+'</div>'+
      '</div>';
    });
    html+='</div>';
  });
  html+='<div style="font-family:var(--font-mono);font-size:9px;color:var(--ink-3);border-top:1px solid var(--line-soft);padding-top:8px">верх — последняя инструкция · слои только для чтения</div>';
  return html+'</div>';
}

function vizState(st){
  let h='<div class="card-body statelist">';
  const rows=(title,arr,f)=>{
    h+='<div class="grp">'+title+' ('+arr.length+')</div>';
    if(!arr.length){ h+='<div class="row" style="color:var(--ink-3)">—</div>'; return; }
    arr.forEach(x=>{ const [a,b]=f(x); h+='<div class="row"><span>'+esc(a)+'</span><span>'+esc(b)+'</span></div>'; });
  };
  rows("Контейнеры", st.containers, c=>[c.name, c.status+" · "+c.image+(portsText(c)?" · "+portsText(c):"")]);
  rows("Образы", st.images, i=>[i.repo+":"+i.tag, fmtSize(imgSize(i))+" · "+i.layers.length+" сл."]);
  rows("Сети", st.networks.filter(n=>!n.builtin||st.containers.some(c=>c.networks[n.name])), n=>[n.name, n.driver+" · "+st.containers.filter(c=>c.networks[n.name]).length+" конт."]);
  rows("Тома", st.volumes, v=>[v.name, Object.keys(st.volStore[v.name]||{}).length+" файлов"]);
  return h+'</div>';
}

function vizFiles(st){
  const keys=Object.keys(st.files).filter(k=>!k.endsWith("/.keep")).sort();
  if(!keys.length) return '<div class="viz-empty">Рабочий каталог пуст.</div>';
  let h='<div class="card-body fileview">';
  keys.forEach(k=>{
    h+='<div class="fname">'+esc(k.replace("/work/",""))+'</div><pre>'+esc(clip(String(st.files[k]),700))+'</pre>';
  });
  return h+'</div>';
}
