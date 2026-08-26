/* решения всех заданий: функция получает send(строка) → ответ */
const TOK = s => "POST /auth/token -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"secret\"}'";
const SOL = {
"1a": send=>{ send("GET /users"); send("GET /users/1"); send("HEAD /users/1"); send("OPTIONS /users"); },
"1b": send=>{ send("GET /"); send("GET /users/999"); send("GET /widgets"); },
"2a": send=>{ send("GET /users"); send("GET /users/2"); send("GET /users/1/posts"); send("GET /posts"); send("GET /getUsers"); },
"3a": send=>{
  const t = send(TOK()).body.access_token;
  const A = "-H 'Content-Type: application/json' -H 'Authorization: Bearer "+t+"'";
  send("PUT /users/3 "+A+" -d '{\"name\":\"Alan Turing\",\"email\":\"alan@example.com\",\"role\":\"user\"}'");
  send("PUT /users/3 "+A+" -d '{\"name\":\"Alan Turing\",\"email\":\"alan@example.com\",\"role\":\"user\"}'");
  send("POST /users "+A+" -d '{\"name\":\"Kim One\",\"email\":\"kim1@example.com\"}'");
  send("POST /users "+A+" -d '{\"name\":\"Kim Two\",\"email\":\"kim2@example.com\"}'");
},
"3b": send=>{ send("PUT /users"); send("POST /users/1"); send("OPTIONS /users/1"); },
"4a": send=>{ send("GET /users"); send("GET /users/999"); send("DELETE /users"); send("GET /users -H 'Accept: application/xml'"); send("GET /user/1"); },
"4b": send=>{
  send("POST /users -H 'Content-Type: application/json' -d '{\"name\":\"A\",\"email\":\"a@b.co\"}'");
  const ro = send("POST /auth/token -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"secret\",\"scope\":\"read\"}'").body.access_token;
  send("POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+ro+"' -d '{\"name\":\"A\",\"email\":\"a@b.co\"}'");
  const t = send(TOK()).body.access_token;
  send("POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+t+"' -d '{\"name\":\"A\",\"email\":\"a@b.co\"}'");
},
"5a": send=>{
  send("GET /users -H 'Accept: application/xml'");
  const t = send(TOK()).body.access_token;
  send("POST /users -H 'Authorization: Bearer "+t+"' -d '{\"name\":\"Kim\",\"email\":\"kim@example.com\"}'");
  send("POST /users -H 'Content-Type: application/json' -H 'Authorization: Bearer "+t+"' -d '{\"name\":\"Kim\",\"email\":\"kim@example.com\"}'");
  send("GET /users -H 'Accept: */*'");
},
"6a": send=>{ send("GET /users?role=admin"); send("GET /users?q=turing"); send("GET /users?sort=-name");
  send("GET /users/1/posts"); send("GET /posts?userId=1"); send("GET /users?role=ghost"); },
"7a": send=>{ send("GET /users?limit=2"); send("GET /users?limit=2&page=2"); send("GET /users?limit=2&page=99");
  send("GET /users?limit=500"); send("GET /users?limit=abc"); },
"8a": send=>{
  const t = send(TOK()).body.access_token;
  const A = "-H 'Content-Type: application/json' -H 'Authorization: Bearer "+t+"'";
  send("POST /users "+A+" -d '{oops'");
  send("POST /users "+A+" -d '{}'");
  send("POST /users "+A+" -d '{\"name\":\"Kim\",\"email\":\"nope\"}'");
  send("POST /users "+A+" -d '{\"name\":\"Kim\",\"email\":\"kim@example.com\"}'");
  send("POST /users "+A+" -d '{\"name\":\"Kim2\",\"email\":\"kim@example.com\"}'");
},
"9a": send=>{
  send("PATCH /users/2 -H 'Content-Type: application/json' -d '{\"role\":\"user\"}'");
  send("POST /auth/token -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"wrong\"}'");
  const t = send(TOK()).body.access_token;
  send("PATCH /users/2 -H 'Content-Type: application/json' -H 'Authorization: Bearer "+t+"' -d '{\"role\":\"user\"}'");
},
"10a": send=>{
  const e = send("GET /users/1").headers.ETag;
  send("GET /users/1 -H 'If-None-Match: "+e+"'");
  send("GET /users/1 -H 'If-None-Match: \"nope\"'");
},
"10b": send=>{
  const t = send(TOK()).body.access_token;
  const A = "-H 'Content-Type: application/json' -H 'Authorization: Bearer "+t+"'";
  const e1 = send("GET /users/2").headers.ETag;
  send("PATCH /users/2 "+A+" -d '{\"role\":\"user\"}'");
  send("PATCH /users/2 "+A+" -H 'If-Match: "+e1+"' -d '{\"role\":\"admin\"}'");
  const e2 = send("GET /users/2").headers.ETag;
  send("PATCH /users/2 "+A+" -H 'If-Match: "+e2+"' -d '{\"role\":\"admin\"}'");
},
"11a": send=>{
  const t = send(TOK()).body.access_token;
  const A = "-H 'Content-Type: application/json' -H 'Authorization: Bearer "+t+"'";
  send("POST /orders "+A+" -d '{\"item\":\"desk\",\"amount\":2}'");
  send("POST /orders "+A+" -d '{\"item\":\"desk\",\"amount\":2}'");
  send("POST /orders "+A+" -H 'Idempotency-Key: k1' -d '{\"item\":\"chair\",\"amount\":1}'");
  send("POST /orders "+A+" -H 'Idempotency-Key: k1' -d '{\"item\":\"chair\",\"amount\":1}'");
},
"11b": send=>{ for(let i=0;i<7;i++) send("GET /users"); },
"12a": send=>{
  const t = send(TOK()).body.access_token;
  const A = "-H 'Content-Type: application/json' -H 'Authorization: Bearer "+t+"'";
  const c = send("POST /users "+A+" -d '{\"name\":\"Cycle User\",\"email\":\"cycle@example.com\"}'");
  const loc = c.headers.Location.replace(/^https?:\/\/[^/]+/,"");
  const e1 = send("GET "+loc).headers.ETag;
  send("GET "+loc+" -H 'If-None-Match: "+e1+"'");
  send("PATCH "+loc+" "+A+" -H 'If-Match: "+e1+"' -d '{\"role\":\"admin\"}'");
  const e2 = send("GET "+loc).headers.ETag;
  if(e1===e2) console.log("   ! ETag не изменился после PATCH");
  send("DELETE "+loc+" -H 'Authorization: Bearer "+t+"'");
  send("GET "+loc);
}
};
