<script>
"use strict";
/* ============================================================
   Эмулятор REST-сервера api.example.com
   ============================================================ */
const HOST = "https://api.example.com";
const hex = n => Array.from({length:n},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("");

const REASON = {
 200:"OK",201:"Created",202:"Accepted",204:"No Content",301:"Moved Permanently",302:"Found",
 304:"Not Modified",400:"Bad Request",401:"Unauthorized",403:"Forbidden",404:"Not Found",
 405:"Method Not Allowed",406:"Not Acceptable",409:"Conflict",410:"Gone",412:"Precondition Failed",
 415:"Unsupported Media Type",422:"Unprocessable Content",429:"Too Many Requests",
 500:"Internal Server Error",503:"Service Unavailable"
};

function newServer(){
  return {
    users:[
      {id:1,name:"Ada Lovelace",email:"ada@example.com",role:"admin",createdAt:"2026-01-04"},
      {id:2,name:"Grace Hopper",email:"grace@example.com",role:"admin",createdAt:"2026-02-11"},
      {id:3,name:"Alan Turing",email:"alan@example.com",role:"user",createdAt:"2026-03-02"},
      {id:4,name:"Barbara Liskov",email:"barbara@example.com",role:"user",createdAt:"2026-04-19"}
    ],
    posts:[
      {id:1,userId:1,title:"On analytical engines",published:true},
      {id:2,userId:2,title:"Compilers are possible",published:true},
      {id:3,userId:3,title:"Computable numbers",published:false}
    ],
    orders:[],
    seq:{users:4,posts:3,orders:0},
    ver:{}, tokens:{}, idem:{},
    rate:{n:0,limit:0,reset:0},
    creds:{"demo":"secret"},
    log:[]
  };
}
const verKey = (kind,id) => kind+":"+id;
function bump(s,kind,id){ const k=verKey(kind,id); s.ver[k]=(s.ver[k]||1)+1; return s.ver[k]; }
function etagOf(s,kind,id){ const k=verKey(kind,id); s.ver[k]=s.ver[k]||1; return '"'+kind.slice(0,1)+id+"-v"+s.ver[k]+'"'; }

/* ---------------- разбор строки запроса ---------------- */
function tokenizeCmd(line){
  const t=[]; let cur="", q=null;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){ if(c===q) q=null; else cur+=c; continue; }
    if(c==='"'||c==="'"){ q=c; if(cur==="") cur=""; continue; }
    if(c===" "||c==="\t"){ if(cur!==""){t.push(cur);cur="";} continue; }
    cur+=c;
  }
  if(cur!=="") t.push(cur);
  return t;
}
const METHODS = ["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"];

function parseRequest(line){
  const t = tokenizeCmd(line.trim());
  if(!t.length) return {error:"пустой запрос"};
  let i = 0;
  if(t[0].toLowerCase()==="curl") i = 1;
  const req = {method:null, path:null, headers:{}, body:null, showHeaders:false};
  const setH = (k,v)=>{ req.headers[k.trim()] = String(v).trim(); };

  for(; i<t.length; i++){
    const a = t[i];
    if(a==="-X"||a==="--request"){ req.method = (t[++i]||"").toUpperCase(); continue; }
    if(a==="-H"||a==="--header"){ const h=t[++i]||""; const c=h.indexOf(":"); if(c>0) setH(h.slice(0,c), h.slice(c+1)); continue; }
    if(a==="-d"||a==="--data"||a==="--data-raw"||a==="--json"){
      req.body = t[++i];
      if(a==="--json" && !req.headers["Content-Type"]) setH("Content-Type","application/json");
      if(!req.method) req.method = "POST";
      continue;
    }
    if(a==="-u"||a==="--user"){ req.headers["Authorization"] = "Basic "+btoa(t[++i]||""); continue; }
    if(a==="-i"||a==="--include"){ req.showHeaders = true; continue; }
    if(a==="-I"||a==="--head"){ req.method = "HEAD"; continue; }
    if(a==="-s"||a==="-v"||a==="-L") continue;
    if(a.startsWith("-")) return {error:"неизвестный флаг "+a};
    const up = a.toUpperCase();
    if(METHODS.includes(up) && !req.path && !req.method){ req.method = up; continue; }
    if(!req.path){ req.path = a; continue; }
    if(req.body===null){ req.body = a; continue; }
  }
  if(!req.path) return {error:"не указан путь, например /users"};
  if(!req.method) req.method = req.body!==null ? "POST" : "GET";
  req.path = req.path.replace(/^https?:\/\/[^/]+/,"");
  if(!req.path.startsWith("/")) req.path = "/"+req.path;
  const qi = req.path.indexOf("?");
  req.query = {};
  if(qi>-1){
    req.path.slice(qi+1).split("&").forEach(p=>{
      if(!p) return; const [k,v] = p.split("=");
      req.query[decodeURIComponent(k)] = decodeURIComponent((v||"").replace(/\+/g," "));
    });
    req.path = req.path.slice(0,qi);
  }
  if(req.path.length>1) req.path = req.path.replace(/\/+$/,"");
  return req;
}

/* ---------------- помощники ответа ---------------- */
function res(status, body, headers){
  const h = Object.assign({}, headers||{});
  const out = {status, headers:h, body:body===undefined?null:body};
  if(out.body!==null && !h["Content-Type"]) h["Content-Type"] = "application/json";
  return out;
}
function problem(status, title, detail, extra){
  return res(status, Object.assign({type:"https://api.example.com/probs/"+title.toLowerCase().replace(/\s+/g,"-"),
    title, status, detail}, extra||{}), {"Content-Type":"application/problem+json"});
}
function wantsJson(req){
  const a = req.headers["Accept"] || req.headers["accept"];
  if(!a) return true;
  return /application\/json|application\/\*|\*\/\*|\+json/i.test(a);
}
function jsonBody(req){
  if(req.body===null) return {ok:true, value:null};
  try{ return {ok:true, value: JSON.parse(req.body)}; }
  catch(e){ return {ok:false}; }
}
function auth(s, req){
  const a = req.headers["Authorization"] || req.headers["authorization"];
  if(!a) return {ok:false, why:"missing"};
  const m = a.match(/^Bearer\s+(\S+)$/i);
  if(!m) return {ok:false, why:"scheme"};
  const t = s.tokens[m[1]];
  if(!t) return {ok:false, why:"invalid"};
  return {ok:true, token:t};
}
const isWrite = m => ["POST","PUT","PATCH","DELETE"].includes(m);

/* ---------------- маршрутизация ---------------- */
function handle(s, req){
  const r = route(s, req);
  if(!r.headers["Date"]) r.headers["Date"] = new Date().toUTCString();
  if(r.body!==null && r.body!==undefined && r.status!==304 && req.method!=="HEAD"){
    r.headers["Content-Length"] = String(JSON.stringify(r.body,null,2).length);
  }
  s.log.push({req, res:r});
  return r;
}

function route(s, req){
  const p = req.path, m = req.method;

  /* ограничение частоты — включается заданием */
  if(s.rate.limit>0){
    const now = Date.now();
    if(now > s.rate.reset){ s.rate.n = 0; s.rate.reset = now + 60000; }
    s.rate.n++;
    if(s.rate.n > s.rate.limit){
      const wait = Math.max(1, Math.ceil((s.rate.reset-now)/1000));
      return res(429, {error:"rate_limit_exceeded", detail:"Слишком много запросов. Повторите позже."},
        {"Retry-After":String(wait),"X-RateLimit-Limit":String(s.rate.limit),
         "X-RateLimit-Remaining":"0","X-RateLimit-Reset":String(Math.ceil(s.rate.reset/1000)),
         "Content-Type":"application/json"});
    }
  }

  if(!wantsJson(req))
    return problem(406,"Not Acceptable","Сервер отдаёт только application/json, а в Accept запрошено другое.",
      {supported:["application/json"]});

  /* устаревший путь в единственном числе — учебный редирект */
  const legacy = p.match(/^\/user\/(\d+)$/);
  if(legacy) return res(301, null, {"Location":"/users/"+legacy[1]});

  if(p==="/") return res(200, {users:HOST+"/users", posts:HOST+"/posts", orders:HOST+"/orders", token:HOST+"/auth/token"});

  if(p==="/auth/token"){
    if(m==="OPTIONS") return res(204,null,{"Allow":"POST, OPTIONS"});
    if(m!=="POST") return res(405,{error:"method_not_allowed"},{"Allow":"POST, OPTIONS"});
    const b = jsonBody(req);
    if(!b.ok) return problem(400,"Malformed JSON","Тело запроса не является корректным JSON.");
    const {username,password,scope} = b.value||{};
    if(!username||!password) return problem(422,"Validation Failed","Нужны поля username и password.",
      {errors:[{field:"username",code:"required"},{field:"password",code:"required"}]});
    if(s.creds[username]!==password)
      return res(401,{error:"invalid_credentials"},{"WWW-Authenticate":'Bearer realm="api", error="invalid_credentials"',"Content-Type":"application/json"});
    const tok = "tok_"+hex(16);
    s.tokens[tok] = {sub:username, scopes:(scope||"read write").split(/[ ,]+/)};
    return res(200,{access_token:tok, token_type:"Bearer", expires_in:3600, scope:(scope||"read write")});
  }

  const mUsers = p==="/users";
  const mUser = p.match(/^\/users\/(\d+)$/);
  const mUserPosts = p.match(/^\/users\/(\d+)\/posts$/);
  const mPosts = p==="/posts";
  const mPost = p.match(/^\/posts\/(\d+)$/);
  const mOrders = p==="/orders";
  const mOrder = p.match(/^\/orders\/(\d+)$/);

  if(!(mUsers||mUser||mUserPosts||mPosts||mPost||mOrders||mOrder))
    return problem(404,"Not Found","Ресурс "+p+" не существует.");

  /* допустимость метода — свойство ресурса, а не вызывающего: 405 проверяется до 401 */
  let allow = null, whyNot = null;
  if(mUsers||mPosts||mOrders){ allow = "GET, POST, HEAD, OPTIONS"; whyNot = "Метод "+m+" неприменим к коллекции целиком."; }
  else if(mUser||mPost||mOrder){
    allow = "GET, PUT, PATCH, DELETE, HEAD, OPTIONS";
    whyNot = m==="POST"
      ? "POST создаёт ресурс в коллекции, а не поверх существующего. Используйте PUT или PATCH."
      : "Метод "+m+" здесь не поддерживается.";
  }
  else if(mUserPosts){ allow = "GET, HEAD, OPTIONS"; whyNot = "Вложенная коллекция доступна только для чтения."; }
  if(allow && !allow.split(", ").includes(m))
    return res(405, {error:"method_not_allowed", detail:whyNot}, {"Allow":allow, "Content-Type":"application/json"});

  /* авторизация нужна только для изменяющих методов */
  if(isWrite(m)){
    const a = auth(s,req);
    if(!a.ok)
      return res(401,{error:"unauthorized", detail:"Изменяющие методы требуют токен. Получите его: POST /auth/token"},
        {"WWW-Authenticate":'Bearer realm="api"',"Content-Type":"application/json"});
    if(!a.token.scopes.includes("write"))
      return problem(403,"Forbidden","Токен выдан только на чтение: в нём нет области write.",{required_scope:"write"});
  }

  /* тело обязано быть JSON и объявлено правильным типом */
  if(["POST","PUT","PATCH"].includes(m)){
    const ct = req.headers["Content-Type"] || req.headers["content-type"] || "";
    if(req.body===null) return problem(400,"Missing Body","Метод "+m+" требует тело запроса.");
    if(!/^application\/(json|merge-patch\+json)/.test(ct))
      return problem(415,"Unsupported Media Type",
        "Ожидается Content-Type: application/json, получено «"+(ct||"ничего")+"».",{supported:["application/json"]});
    const b = jsonBody(req);
    if(!b.ok) return problem(400,"Malformed JSON","Тело запроса не является корректным JSON.");
  }

  if(mUsers) return collection(s, req, "users");
  if(mUser) return item(s, req, "users", +mUser[1]);
  if(mUserPosts){
    const uid = +mUserPosts[1];
    if(!s.users.some(u=>u.id===uid)) return problem(404,"Not Found","Пользователь "+uid+" не существует.");
    if(m!=="GET"&&m!=="HEAD"&&m!=="OPTIONS") return res(405,{error:"method_not_allowed"},{"Allow":"GET, HEAD, OPTIONS"});
    if(m==="OPTIONS") return res(204,null,{"Allow":"GET, HEAD, OPTIONS"});
    return res(200, s.posts.filter(x=>x.userId===uid));
  }
  if(mPosts) return collection(s, req, "posts");
  if(mPost) return item(s, req, "posts", +mPost[1]);
  if(mOrders) return orders(s, req);
  if(mOrder) return item(s, req, "orders", +mOrder[1]);
  return problem(404,"Not Found","Ресурс "+p+" не существует.");
}

/* ---------------- коллекции ---------------- */
const ALLOW_COLL = "GET, POST, HEAD, OPTIONS";
function collection(s, req, kind){
  const m = req.method;
  if(m==="OPTIONS") return res(204,null,{"Allow":ALLOW_COLL});
  if(m==="PUT"||m==="PATCH"||m==="DELETE")
    return res(405,{error:"method_not_allowed", detail:"Метод "+m+" неприменим к коллекции целиком."},{"Allow":ALLOW_COLL,"Content-Type":"application/json"});

  if(m==="GET"||m==="HEAD"){
    let list = s[kind].slice();
    const q = req.query;
    if(q.role) list = list.filter(x=>x.role===q.role);
    if(q.published!==undefined) list = list.filter(x=>String(x.published)===q.published);
    if(q.userId) list = list.filter(x=>String(x.userId)===q.userId);
    if(q.q) list = list.filter(x=>JSON.stringify(x).toLowerCase().includes(q.q.toLowerCase()));
    if(q.sort){
      const desc = q.sort.startsWith("-"), f = q.sort.replace(/^-/,"");
      list.sort((a,b)=>{ const A=a[f], B=b[f]; if(A===B) return 0; return (A>B?1:-1)*(desc?-1:1); });
    }
    const total = list.length;
    let limit = q.limit!==undefined ? parseInt(q.limit,10) : 20;
    let page = q.page!==undefined ? parseInt(q.page,10) : 1;
    if(Number.isNaN(limit)||limit<1) return problem(400,"Invalid Parameter","Параметр limit должен быть целым числом больше нуля.",{parameter:"limit"});
    if(limit>100) return problem(400,"Invalid Parameter","Параметр limit не может превышать 100.",{parameter:"limit",max:100});
    if(Number.isNaN(page)||page<1) return problem(400,"Invalid Parameter","Параметр page должен быть целым числом больше нуля.",{parameter:"page"});
    const pages = Math.max(1, Math.ceil(total/limit));
    const slice = list.slice((page-1)*limit, page*limit);
    const h = {"X-Total-Count":String(total),"Cache-Control":"public, max-age=60"};
    const base = HOST+"/"+kind;
    const qs = n => { const c = Object.assign({}, q, {page:String(n), limit:String(limit)});
      return base+"?"+Object.keys(c).map(k=>k+"="+encodeURIComponent(c[k])).join("&"); };
    const links = [];
    if(page<pages) links.push('<'+qs(page+1)+'>; rel="next"');
    if(page>1) links.push('<'+qs(page-1)+'>; rel="prev"');
    links.push('<'+qs(1)+'>; rel="first"', '<'+qs(pages)+'>; rel="last"');
    h["Link"] = links.join(", ");
    return res(200, m==="HEAD"?null:slice, h);
  }

  /* POST — создание */
  const b = JSON.parse(req.body);
  if(kind==="users"){
    const errs = [];
    if(!b.name) errs.push({field:"name",code:"required",detail:"Имя обязательно."});
    if(!b.email) errs.push({field:"email",code:"required",detail:"Почта обязательна."});
    else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) errs.push({field:"email",code:"invalid_format",detail:"Не похоже на адрес почты."});
    if(b.role && !["admin","user"].includes(b.role)) errs.push({field:"role",code:"invalid_value",detail:"Допустимо admin или user."});
    if(errs.length) return problem(422,"Validation Failed","Тело запроса не прошло проверку.",{errors:errs});
    if(s.users.some(u=>u.email.toLowerCase()===String(b.email).toLowerCase()))
      return problem(409,"Conflict","Пользователь с такой почтой уже существует.",{field:"email",value:b.email});
    const id = ++s.seq.users;
    const u = {id, name:b.name, email:b.email, role:b.role||"user", createdAt:new Date().toISOString().slice(0,10)};
    s.users.push(u);
    return res(201, u, {"Location":HOST+"/users/"+id, "ETag":etagOf(s,"users",id)});
  }
  if(kind==="posts"){
    const errs = [];
    if(!b.title) errs.push({field:"title",code:"required"});
    if(b.userId===undefined) errs.push({field:"userId",code:"required"});
    else if(!s.users.some(u=>u.id===b.userId)) errs.push({field:"userId",code:"not_found",detail:"Такого пользователя нет."});
    if(errs.length) return problem(422,"Validation Failed","Тело запроса не прошло проверку.",{errors:errs});
    const id = ++s.seq.posts;
    const post = {id, userId:b.userId, title:b.title, published:!!b.published};
    s.posts.push(post);
    return res(201, post, {"Location":HOST+"/posts/"+id, "ETag":etagOf(s,"posts",id)});
  }
  return problem(404,"Not Found","Неизвестная коллекция.");
}

/* ---------------- заказы: идемпотентность ---------------- */
function orders(s, req){
  const m = req.method;
  if(m==="OPTIONS") return res(204,null,{"Allow":ALLOW_COLL});
  if(m==="GET"||m==="HEAD") return res(200, m==="HEAD"?null:s.orders, {"X-Total-Count":String(s.orders.length)});
  if(m!=="POST") return res(405,{error:"method_not_allowed"},{"Allow":ALLOW_COLL,"Content-Type":"application/json"});

  const key = req.headers["Idempotency-Key"] || req.headers["idempotency-key"];
  if(key && s.idem[key]){
    const saved = s.idem[key];
    return res(saved.status, saved.body, Object.assign({}, saved.headers, {"Idempotency-Replayed":"true"}));
  }
  const b = JSON.parse(req.body);
  const errs = [];
  if(!b.item) errs.push({field:"item",code:"required"});
  if(b.amount===undefined) errs.push({field:"amount",code:"required"});
  else if(typeof b.amount!=="number"||b.amount<=0) errs.push({field:"amount",code:"invalid_value",detail:"Должно быть положительным числом."});
  if(errs.length) return problem(422,"Validation Failed","Тело запроса не прошло проверку.",{errors:errs});
  const id = ++s.seq.orders;
  const order = {id, item:b.item, amount:b.amount, status:"created"};
  s.orders.push(order);
  const out = res(201, order, {"Location":HOST+"/orders/"+id, "ETag":etagOf(s,"orders",id)});
  if(key) s.idem[key] = {status:out.status, body:out.body, headers:Object.assign({},out.headers)};
  return out;
}

/* ---------------- отдельный ресурс ---------------- */
function item(s, req, kind, id){
  const m = req.method;
  const list = s[kind];
  const idx = list.findIndex(x=>x.id===id);
  const ALLOW = "GET, PUT, PATCH, DELETE, HEAD, OPTIONS";
  if(m==="OPTIONS") return res(204,null,{"Allow":ALLOW});
  if(m==="POST") return res(405,{error:"method_not_allowed",
    detail:"POST создаёт ресурс в коллекции, а не поверх существующего. Используйте PUT или PATCH."},
    {"Allow":ALLOW,"Content-Type":"application/json"});
  if(idx<0) return problem(404,"Not Found","Ресурс /"+kind+"/"+id+" не найден.");

  const obj = list[idx];
  const etag = etagOf(s,kind,id);

  if(m==="GET"||m==="HEAD"){
    const inm = req.headers["If-None-Match"] || req.headers["if-none-match"];
    if(inm && inm.split(",").map(x=>x.trim()).includes(etag))
      return res(304, null, {"ETag":etag,"Cache-Control":"private, max-age=30"});
    return res(200, m==="HEAD"?null:obj, {"ETag":etag,"Cache-Control":"private, max-age=30"});
  }

  const im = req.headers["If-Match"] || req.headers["if-match"];
  if(im && !im.split(",").map(x=>x.trim()).includes(etag) && im.trim()!=="*")
    return problem(412,"Precondition Failed","Ресурс изменился с момента чтения: ETag теперь "+etag+".",{current_etag:etag});

  if(m==="DELETE"){
    list.splice(idx,1);
    return res(204, null, {});
  }

  const b = JSON.parse(req.body);
  if(m==="PUT"){
    if(kind==="users"){
      const errs=[];
      if(!b.name) errs.push({field:"name",code:"required",detail:"PUT заменяет ресурс целиком — обязательны все поля."});
      if(!b.email) errs.push({field:"email",code:"required",detail:"PUT заменяет ресурс целиком — обязательны все поля."});
      else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) errs.push({field:"email",code:"invalid_format"});
      if(errs.length) return problem(422,"Validation Failed","Тело запроса не прошло проверку.",{errors:errs});
      if(s.users.some(u=>u.id!==id && u.email.toLowerCase()===String(b.email).toLowerCase()))
        return problem(409,"Conflict","Пользователь с такой почтой уже существует.",{field:"email"});
      list[idx] = {id, name:b.name, email:b.email, role:b.role||"user", createdAt:obj.createdAt};
    } else {
      list[idx] = Object.assign({}, b, {id});
    }
    bump(s,kind,id);
    return res(200, list[idx], {"ETag":etagOf(s,kind,id)});
  }
  if(m==="PATCH"){
    if(b.email!==undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email))
      return problem(422,"Validation Failed","Тело запроса не прошло проверку.",{errors:[{field:"email",code:"invalid_format"}]});
    if(b.email!==undefined && s.users.some(u=>u.id!==id && u.email && u.email.toLowerCase()===String(b.email).toLowerCase()))
      return problem(409,"Conflict","Пользователь с такой почтой уже существует.",{field:"email"});
    Object.keys(b).forEach(k=>{ if(k==="id") return; if(b[k]===null) delete obj[k]; else obj[k]=b[k]; });
    bump(s,kind,id);
    return res(200, obj, {"ETag":etagOf(s,kind,id)});
  }
  return res(405,{error:"method_not_allowed"},{"Allow":ALLOW,"Content-Type":"application/json"});
}
