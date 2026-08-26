const fs=require("fs");
eval(fs.readFileSync("_srv.js","utf8").replace(/^"use strict";/,""));
let pass=0, fail=0;
function T(name, line, expect, s, mut){
  const req = parseRequest(line);
  if(req.error){ console.log("✗ "+name+" — парсер: "+req.error); fail++; return null; }
  const r = handle(s, req);
  const got = {status:r.status};
  let ok = true, why=[];
  if(expect.status!==undefined && r.status!==expect.status){ ok=false; why.push("статус "+r.status+" вместо "+expect.status); }
  if(expect.hdr) Object.entries(expect.hdr).forEach(([k,v])=>{
    const h=r.headers[k]; if(v===true){ if(!h){ok=false;why.push("нет заголовка "+k);} }
    else if(!h || !String(h).includes(v)){ ok=false; why.push(k+"="+h+" вместо "+v); }});
  if(expect.noHdr) expect.noHdr.forEach(k=>{ if(r.headers[k]){ok=false;why.push("лишний заголовок "+k);} });
  if(expect.body) { const bs=JSON.stringify(r.body); if(!bs.includes(expect.body)){ok=false;why.push("в теле нет «"+expect.body+"»: "+String(bs).slice(0,90));} }
  if(expect.nullBody && r.body!==null){ ok=false; why.push("тело должно быть пустым"); }
  if(expect.check && !expect.check(r,s)){ ok=false; why.push("своя проверка не прошла"); }
  if(ok){pass++;} else {fail++; console.log("✗ "+name+" → "+why.join("; "));}
  if(mut) mut(r);
  return r;
}
let s = newServer();

console.log("── базовое чтение");
T("GET коллекции","GET /users",{status:200,hdr:{"X-Total-Count":"4","Link":'rel="last"'},body:"Ada"},s);
T("GET элемента","GET /users/1",{status:200,hdr:{"ETag":true,"Cache-Control":"max-age"},body:"ada@example.com"},s);
T("GET несуществующего","GET /users/99",{status:404,hdr:{"Content-Type":"problem+json"},body:"не найден"},s);
T("неизвестный путь","GET /widgets",{status:404},s);
T("корень","GET /",{status:200,body:"/users"},s);

console.log("── методы");
T("HEAD без тела","HEAD /users/1",{status:200,nullBody:true,hdr:{"ETag":true}},s);
T("OPTIONS коллекции","OPTIONS /users",{status:204,hdr:{"Allow":"POST"},nullBody:true},s);
T("PUT на коллекцию → 405","PUT /users -H 'Content-Type: application/json' -d '{}'",{status:405,hdr:{"Allow":"GET"}},s);
T("POST на элемент → 405","POST /users/1 -H 'Content-Type: application/json' -d '{}'",{status:405,hdr:{"Allow":"PUT"}},s);
T("301 со старого пути","GET /user/3",{status:301,hdr:{"Location":"/users/3"}},s);

console.log("── согласование содержимого");
T("Accept: xml → 406","GET /users -H 'Accept: application/xml'",{status:406,body:"application/json"},s);
T("Accept: */* → ок","GET /users -H 'Accept: */*'",{status:200},s);

console.log("── авторизация");
T("запись без токена → 401","POST /users -H 'Content-Type: application/json' -d '{\"name\":\"X\",\"email\":\"x@y.z\"}'",
  {status:401,hdr:{"WWW-Authenticate":"Bearer"}},s);
T("токен: неверный пароль","POST /auth/token -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"nope\"}'",
  {status:401,hdr:{"WWW-Authenticate":"invalid_credentials"}},s);
let TOK=null;
T("токен: успех","POST /auth/token -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"secret\"}'",
  {status:200,body:"access_token"},s,r=>{TOK=r.body.access_token;});
let ROTOK=null;
T("токен только на чтение","POST /auth/token -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"secret\",\"scope\":\"read\"}'",
  {status:200},s,r=>{ROTOK=r.body.access_token;});
T("read-токен на запись → 403","POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+ROTOK+"' -d '{\"name\":\"X\",\"email\":\"x@y.z\"}'",
  {status:403,body:"write"},s);

console.log("── создание и валидация");
T("нет Content-Type → 415","POST /users -H 'Authorization: Bearer "+TOK+"' -d '{\"name\":\"X\",\"email\":\"x@y.z\"}'",{status:415},s);
T("битый JSON → 400","POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{oops'",{status:400},s);
T("нет полей → 422","POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{}'",
  {status:422,hdr:{"Content-Type":"problem+json"},body:"required"},s);
T("плохая почта → 422","POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{\"name\":\"X\",\"email\":\"nope\"}'",
  {status:422,body:"invalid_format"},s);
T("создание → 201 + Location","POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{\"name\":\"Ann\",\"email\":\"ann@example.com\"}'",
  {status:201,hdr:{"Location":"/users/5","ETag":true},body:"Ann"},s);
T("дубль почты → 409","POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{\"name\":\"Ann2\",\"email\":\"ann@example.com\"}'",
  {status:409,body:"Conflict"},s);

console.log("── обновление");
T("PUT без всех полей → 422","PUT /users/5 -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{\"name\":\"Only\"}'",
  {status:422,body:"целиком"},s);
T("PUT целиком → 200","PUT /users/5 -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{\"name\":\"Ann Lee\",\"email\":\"ann@example.com\",\"role\":\"admin\"}'",
  {status:200,body:"Ann Lee",check:r=>r.body.role==="admin"},s);
T("PATCH частично → 200","PATCH /users/5 -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{\"role\":\"user\"}'",
  {status:200,check:(r)=>r.body.role==="user"&&r.body.name==="Ann Lee"},s);

console.log("── условные запросы");
let et=null;
T("читаем ETag","GET /users/5",{status:200},s,r=>{et=r.headers.ETag;});
T("If-None-Match совпал → 304","GET /users/5 -H 'If-None-Match: "+et+"'",{status:304,nullBody:true},s);
T("If-None-Match не совпал → 200","GET /users/5 -H 'If-None-Match: \"nope\"'",{status:200},s);
T("If-Match устарел → 412","PATCH /users/5 -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -H 'If-Match: \"u5-v1\"' -d '{\"role\":\"admin\"}'",
  {status:412,body:"current_etag"},s);
T("If-Match актуален → 200","PATCH /users/5 -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -H 'If-Match: "+et+"' -d '{\"role\":\"admin\"}'",
  {status:200},s);

console.log("── удаление");
T("DELETE → 204","DELETE /users/5 -H 'Authorization: Bearer "+TOK+"'",{status:204,nullBody:true},s);
T("повторный DELETE → 404","DELETE /users/5 -H 'Authorization: Bearer "+TOK+"'",{status:404},s);

console.log("── выборка и пагинация");
T("фильтр по роли","GET /users?role=admin",{status:200,check:r=>r.body.every(u=>u.role==="admin")},s);
T("поиск","GET /users?q=turing",{status:200,check:r=>r.body.length===1&&r.body[0].name.includes("Turing")},s);
T("сортировка по убыванию","GET /users?sort=-name",{status:200,check:r=>r.body[0].name==="Grace Hopper"},s);
T("страница 2","GET /users?limit=2&page=2",{status:200,hdr:{"Link":'rel="prev"'},check:r=>r.body.length===2},s);
T("limit>100 → 400","GET /users?limit=500",{status:400,body:"limit"},s);
T("limit=abc → 400","GET /users?limit=abc",{status:400},s);
T("вложенная коллекция","GET /users/1/posts",{status:200,check:r=>r.body.length===1},s);
T("посты несуществующего → 404","GET /users/99/posts",{status:404},s);

console.log("── идемпотентность");
T("заказ без ключа","POST /orders -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{\"item\":\"desk\",\"amount\":2}'",{status:201},s);
T("заказ с ключом","POST /orders -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -H 'Idempotency-Key: k1' -d '{\"item\":\"chair\",\"amount\":1}'",{status:201},s);
T("повтор с тем же ключом","POST /orders -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -H 'Idempotency-Key: k1' -d '{\"item\":\"chair\",\"amount\":1}'",
  {status:201,hdr:{"Idempotency-Replayed":"true"},check:(r,st)=>st.orders.length===2},s);
T("повтор без ключа создаёт второй","POST /orders -H 'Content-Type: application/json' -H 'Authorization: Bearer "+TOK+"' -d '{\"item\":\"desk\",\"amount\":2}'",
  {status:201,check:(r,st)=>st.orders.length===3},s);

console.log("── ограничение частоты");
let s2=newServer(); s2.rate.limit=3;
T("1-й","GET /users",{status:200},s2); T("2-й","GET /users",{status:200},s2); T("3-й","GET /users",{status:200},s2);
T("4-й → 429","GET /users",{status:429,hdr:{"Retry-After":true,"X-RateLimit-Limit":"3"}},s2);

console.log("\nитог: "+pass+" пройдено, "+fail+" провалено");
process.exit(fail?1:0);
