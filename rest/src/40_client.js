/* ============================================================
   Клиент: отрисовка обмена в сыром виде HTTP
   ============================================================ */
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const cls = st => st>=500?"c5":st>=400?"c4":st>=300?"c3":st>=200?"c2":"c1";

function hiJson(v){
  if(v===null||v===undefined) return "";
  const s = esc(JSON.stringify(v,null,2));
  return s.replace(/&quot;([^&]*?)&quot;(\s*:)/g,'<span class="h">&quot;$1&quot;</span>$2')
          .replace(/:\s*(&quot;[^&]*?&quot;)/g,': <span class="s">$1</span>')
          .replace(/:\s*(true|false|null|-?\d+(?:\.\d+)?)/g,': <span class="m">$1</span>');
}
const HDR_ORDER = ["Host","Accept","Content-Type","Authorization","If-None-Match","If-Match","Idempotency-Key","Content-Length"];
function hdrLines(h, order){
  const keys = Object.keys(h);
  keys.sort((a,b)=>{
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if(ia>-1&&ib>-1) return ia-ib;
    if(ia>-1) return -1; if(ib>-1) return 1;
    return a.localeCompare(b);
  });
  return keys.map(k=>'<span class="h">'+esc(k)+'</span>: '+esc(h[k])).join("\n");
}
function renderExchange(req, r){
  const q = Object.keys(req.query||{}).length
    ? "?"+Object.entries(req.query).map(([k,v])=>k+"="+encodeURIComponent(v)).join("&") : "";
  const reqH = Object.assign({Host:"api.example.com"}, req.headers);
  if(req.body!==null && req.body!==undefined && !reqH["Content-Length"]) reqH["Content-Length"] = String(req.body.length);
  let out = '<div class="ex '+cls(r.status)+'">';
  out += '<div class="lbl">запрос</div><pre><span class="m">'+esc(req.method)+'</span> '+esc(req.path+q)+' HTTP/1.1\n'+
         hdrLines(reqH, HDR_ORDER);
  if(req.body!==null && req.body!==undefined){
    let b = req.body;
    try{ b = JSON.stringify(JSON.parse(req.body),null,2); }catch(e){}
    out += '\n\n'+ (()=>{ try{ return hiJson(JSON.parse(req.body)); }catch(e){ return esc(b); } })();
  }
  out += '</pre>';
  out += '<div class="rl"><span class="lbl" style="margin:0">ответ</span>'+
         '<span class="code">HTTP/1.1 '+r.status+' '+esc(REASON[r.status]||"")+'</span></div>';
  out += '<pre>'+hdrLines(r.headers, ["Content-Type","Location","ETag","Allow","WWW-Authenticate","Retry-After","Link","X-Total-Count","Cache-Control"]);
  if(r.body!==null && r.body!==undefined && r.status!==304 && req.method!=="HEAD") out += '\n\n'+hiJson(r.body);
  else out += '\n\n<span class="c">(тело пустое)</span>';
  out += '</pre></div>';
  return out;
}

/* ---------------- состояние сервера ---------------- */
function renderState(s){
  let h = "";
  const grp = (title, rows) => {
    h += '<div class="g">'+esc(title)+' ('+rows.length+')</div>';
    if(!rows.length){ h += '<div class="row" style="color:var(--ink3)">—</div>'; return; }
    rows.forEach(([a,b])=>{ h += '<div class="row"><b>'+esc(a)+'</b><span>'+esc(b)+'</span></div>'; });
  };
  grp("Пользователи", s.users.map(u=>["#"+u.id, u.name+" · "+u.email+" · "+u.role]));
  grp("Посты", s.posts.map(p=>["#"+p.id, p.title+" · автор "+p.userId+(p.published?"":" · черновик")]));
  grp("Заказы", s.orders.map(o=>["#"+o.id, o.item+" × "+o.amount]));
  const toks = Object.entries(s.tokens);
  grp("Токены", toks.map(([t,v])=>[t.slice(0,10)+"…", v.sub+" · "+v.scopes.join(" ")]));
  if(s.rate.limit>0) grp("Лимит", [["частота", s.rate.n+" / "+s.rate.limit+" в минуту"]]);
  return h;
}

/* ---------------- автодополнение ---------------- */
const SUGGEST = [
 "GET /","GET /users","GET /users?limit=2","GET /users?limit=2&page=2","GET /users?role=admin",
 "GET /users?sort=-name","GET /users?q=ada","GET /users/1","GET /users/1/posts","GET /posts","GET /orders",
 "HEAD /users/1","OPTIONS /users",
 "POST /auth/token -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"secret\"}'",
 "POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer TOKEN' -d '{\"name\":\"Ann\",\"email\":\"ann@example.com\"}'",
 "PUT /users/1 -H 'Content-Type: application/json' -H 'Authorization: Bearer TOKEN' -d '{\"name\":\"Ada\",\"email\":\"ada@example.com\",\"role\":\"admin\"}'",
 "PATCH /users/1 -H 'Content-Type: application/json' -H 'Authorization: Bearer TOKEN' -d '{\"role\":\"user\"}'",
 "DELETE /users/4 -H 'Authorization: Bearer TOKEN'",
 "POST /orders -H 'Content-Type: application/json' -H 'Authorization: Bearer TOKEN' -H 'Idempotency-Key: k1' -d '{\"item\":\"desk\",\"amount\":2}'",
 "GET /users/1 -H 'If-None-Match: \"u1-v1\"'",
 "GET /users -H 'Accept: application/xml'",
 "help","clear","reset"
];

/* ---------------- помощники для проверок заданий ---------------- */
const L = s => s.log;
const last = s => s.log[s.log.length-1];
function did(s, pred){ return s.log.some(e=>pred(e.req, e.res)); }
function didStatus(s, method, rx, status){
  return did(s,(q,r)=> q.method===method && rx.test(q.path) && r.status===status);
}
function hasHeader(q, name){
  const k = Object.keys(q.headers).find(x=>x.toLowerCase()===name.toLowerCase());
  return k ? q.headers[k] : null;
}
