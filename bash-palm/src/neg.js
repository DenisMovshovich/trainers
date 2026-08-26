let fp=0, total=0;
MODULES.forEach(m=>m.labs.forEach(l=>{
  const sh=newShell(); try{l.setup&&l.setup(sh);}catch(e){}
  l.checks.forEach(c=>{ total++; let ok=false; try{ok=!!c.test(sh);}catch(e){}
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
  [["code",/<code[ >]/g,/<\/code>/g],["pre",/<pre[ >]/g,/<\/pre>/g],["span",/<span[ >]/g,/<\/span>/g],
   ["div",/<div[ >]/g,/<\/div>/g],["table",/<table[ >]/g,/<\/table>/g],["ul",/<ul[ >]/g,/<\/ul>/g],
   ["ol",/<ol[ >]/g,/<\/ol>/g],["li",/<li[ >]/g,/<\/li>/g],["p",/<p[ >]/g,/<\/p>/g],
   ["figure",/<figure[ >]/g,/<\/figure>/g],["svg",/<svg[ >]/g,/<\/svg>/g],["h2",/<h2[ >]/g,/<\/h2>/g]]
  .forEach(([n,o,c])=>{ const a=(m.theory.match(o)||[]).length, z=(m.theory.match(c)||[]).length;
    if(a!==z){ console.log("несбалансированный <"+n+"> в модуле "+m.n+": "+a+"/"+z); bad++; } });
});
console.log("модулей: "+MODULES.length+", вопросов: "+qn+", проблем целостности: "+bad);
const d=[0,0,0,0]; MODULES.forEach(m=>m.quiz.forEach(q=>d[q.a]++));
console.log("верные ответы до перемешивания A/B/C/D: "+d.join(" / "));
