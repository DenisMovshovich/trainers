let labs=0, checks=0, fails=0;
MODULES.forEach(m=>m.labs.forEach(l=>{
  labs++;
  const sh = newShell(); try{ l.setup && l.setup(sh); }catch(e){}
  const sol = SOL[l.id];
  if(!sol){ console.log("!! нет решения для "+l.id); fails++; return; }
  sol.forEach(src=>{
    sh.steps = 0;
    let r;
    try{ r = runProgram(sh, src); }catch(e){ r = {out:"", err:"СБОЙ: "+e.message+"\n", code:2}; }
    sh.log.push({cmd:src, out:r.out, err:r.err, code:r.code});
  });
  const bad=[];
  l.checks.forEach(c=>{ checks++; let ok=false, err=null;
    try{ ok = !!c.test(sh); }catch(e){ err = e.message; }
    if(!ok) bad.push(c.label.replace(/<[^>]+>/g,"")+(err?" [ошибка: "+err+"]":"")); });
  if(bad.length){
    fails++;
    console.log("\nЗАДАНИЕ "+m.n+" · "+l.id+" — не зачтено "+bad.length+"/"+l.checks.length);
    bad.forEach(b=>console.log("    · "+b));
    sh.log.slice(-8).forEach(e=>console.log("      $ "+e.cmd.split("\n")[0].slice(0,64)+"  ⇒ код "+e.code+
      (e.out?"  out:"+JSON.stringify(e.out.slice(0,60)):"")+(e.err?"  err:"+JSON.stringify(e.err.slice(0,60)):"")));
  }
}));
console.log("\n--- заданий: "+labs+", критериев: "+checks+", провалов: "+fails+" ---");
process.exit(fails?1:0);
