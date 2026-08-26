let labs=0, checks=0, fails=0;
MODULES.forEach(m=>m.labs.forEach(l=>{
  labs++;
  const s = newServer(); try{ l.setup && l.setup(s); }catch(e){}
  const send = line => { const q = parseRequest(line); if(q.error){ console.log("  ПАРСЕР: "+q.error+" ← "+line); fails++; return {status:0,headers:{},body:null}; } return handle(s,q); };
  const sol = SOL[l.id];
  if(!sol){ console.log("!! нет решения для "+l.id); fails++; return; }
  try{ sol(send); }catch(e){ console.log("!! решение "+l.id+" упало: "+e.message); fails++; }
  const bad=[];
  l.checks.forEach(c=>{ checks++; let ok=false,err=null; try{ ok=!!c.test(s); }catch(e){ err=e.message; }
    if(!ok) bad.push(c.label.replace(/<[^>]+>/g,"")+(err?" [ошибка: "+err+"]":"")); });
  if(bad.length){ fails++; console.log("\nЗАДАНИЕ "+m.n+" · "+l.id+" — не зачтено "+bad.length+"/"+l.checks.length);
    bad.forEach(b=>console.log("    · "+b));
    s.log.slice(-9).forEach(e=>console.log("      "+e.req.method+" "+e.req.path+" -> "+e.res.status)); }
  try{ renderState(s); s.log.forEach(e=>renderExchange(e.req,e.res)); }catch(e){ fails++; console.log("!! отрисовка "+l.id+": "+e.message); }
}));
console.log("\n--- заданий: "+labs+", критериев: "+checks+", провалов: "+fails+" ---");
process.exit(fails?1:0);
