let fp=0, total=0;
MODULES.forEach(m=>m.labs.forEach(l=>{
  const s=newServer(); try{l.setup&&l.setup(s);}catch(e){}
  l.checks.forEach(c=>{ total++; let ok=false; try{ok=!!c.test(s);}catch(e){}
    if(ok){ fp++; console.log("ЛОЖНОЕ СРАБАТЫВАНИЕ "+l.id+": "+c.label.replace(/<[^>]+>/g,"")); } });
}));
console.log("негативный контроль: "+fp+" ложных из "+total);
let bad=0, qn=0;
MODULES.forEach(m=>{
  m.quiz.forEach((q,i)=>{ qn++;
    if(!q.opts||q.opts.length!==4){console.log("не 4 варианта "+m.id+" q"+i);bad++;}
    if(typeof q.a!=="number"||q.a<0||q.a>3){console.log("плохой индекс "+m.id+" q"+i);bad++;}
    if(new Set(q.opts).size!==q.opts.length){console.log("дубли "+m.id+" q"+i);bad++;}
    if(!q.why||q.why.length<40){console.log("слабое пояснение "+m.id+" q"+i);bad++;} });
  m.labs.forEach(l=>{ if(!l.hint){console.log("нет подсказки "+l.id);bad++;} if(!l.checks.length){console.log("нет критериев "+l.id);bad++;} });
  ["<code>","</code>"].forEach(()=>{});
  const c1=(m.theory.match(/<code[ >]/g)||[]).length, c2=(m.theory.match(/<\/code>/g)||[]).length;
  if(c1!==c2){ console.log("несбалансированный <code> в модуле "+m.n+": "+c1+"/"+c2); bad++; }
  const p1=(m.theory.match(/<pre[ >]/g)||[]).length, p2=(m.theory.match(/<\/pre>/g)||[]).length;
  if(p1!==p2){ console.log("несбалансированный <pre> в модуле "+m.n+": "+p1+"/"+p2); bad++; }
  const s1=(m.theory.match(/<span[ >]/g)||[]).length, s2=(m.theory.match(/<\/span>/g)||[]).length;
  if(s1!==s2){ console.log("несбалансированный <span> в модуле "+m.n+": "+s1+"/"+s2); bad++; }
  const t1=(m.theory.match(/<table[ >]/g)||[]).length, t2=(m.theory.match(/<\/table>/g)||[]).length;
  if(t1!==t2){ console.log("несбалансированный <table> в модуле "+m.n); bad++; }
  const d1=(m.theory.match(/<div[ >]/g)||[]).length, d2=(m.theory.match(/<\/div>/g)||[]).length;
  if(d1!==d2){ console.log("несбалансированный <div> в модуле "+m.n+": "+d1+"/"+d2); bad++; }
});
console.log("модулей: "+MODULES.length+", вопросов: "+qn+", проблем целостности: "+bad);
const dist=[0,0,0,0]; MODULES.forEach(m=>m.quiz.forEach(q=>dist[q.a]++));
console.log("верные ответы до перемешивания A/B/C/D: "+dist.join(" / "));
