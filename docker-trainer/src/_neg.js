/* негативный контроль: без команд критерии не должны засчитываться */
let falsePositives=0, total=0;
MODULES.forEach(m=>m.labs.forEach(l=>{
  const st=newState(); try{l.setup&&l.setup(st);}catch(e){}
  l.checks.forEach(ch=>{ total++; let ok=false; try{ok=!!ch.test(st,st.history);}catch(e){}
    if(ok){ falsePositives++; console.log("ЛОЖНОЕ СРАБАТЫВАНИЕ "+l.id+": "+ch.label.replace(/<[^>]+>/g,"")); } });
}));
console.log("негативный контроль: "+falsePositives+" ложных из "+total);

/* целостность тестов */
let bad=0, qn=0;
MODULES.forEach(m=>{
  if(!m.quiz.length) { console.log("нет теста: "+m.id); bad++; }
  m.quiz.forEach((q,i)=>{
    qn++;
    if(!q.opts||q.opts.length!==4){ console.log("не 4 варианта: "+m.id+" q"+i); bad++; }
    if(typeof q.a!=="number"||q.a<0||q.a>3){ console.log("плохой индекс ответа: "+m.id+" q"+i); bad++; }
    if(!q.why||q.why.length<40){ console.log("слабое объяснение: "+m.id+" q"+i); bad++; }
    if(new Set(q.opts).size!==q.opts.length){ console.log("дубли вариантов: "+m.id+" q"+i); bad++; }
  });
  m.labs.forEach(l=>{ if(!l.hint){ console.log("нет подсказки: "+l.id); bad++; } if(!l.checks.length){console.log("нет критериев: "+l.id); bad++;} });
});
console.log("модулей: "+MODULES.length+", вопросов: "+qn+", проблем целостности: "+bad);

/* распределение правильных ответов — не должно быть перекоса на один вариант */
const dist=[0,0,0,0]; MODULES.forEach(m=>m.quiz.forEach(q=>dist[q.a]++));
console.log("распределение верных ответов A/B/C/D: "+dist.join(" / "));
