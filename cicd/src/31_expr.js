
/* ============================================================
   Выражения ${{ … }} и контексты
   ============================================================ */
/* Контекст запуска: github, env, matrix, needs, steps, secrets, runner, job */
function lookup(ctx, path){
  const parts = String(path).split(".");
  let v = ctx;
  for(const p of parts){
    if(v === null || v === undefined) return undefined;
    v = v[p];
  }
  return v;
}

/* Небольшой разборщик: литералы, пути, ==, !=, &&, ||, !, скобки, вызовы функций */
function evalExpr(src, ctx){
  const s = String(src);
  let i = 0;
  const ws = () => { while(i < s.length && /\s/.test(s[i])) i++; };
  const peek = () => { ws(); return s[i]; };
  const eat = t => { ws(); if(s.slice(i, i + t.length) === t){ i += t.length; return true; } return false; };

  function primary(){
    ws();
    if(eat("(")){ const v = or(); if(!eat(")")) cierr("не закрыта скобка в выражении: " + s); return v; }
    if(eat("!")) return !truth(primary());
    if(s[i] === "'"){
      i++; let out = "";
      while(i < s.length && s[i] !== "'") out += s[i++];
      i++;
      return out;
    }
    const num = /^-?\d+(?:\.\d+)?/.exec(s.slice(i));
    if(num){ i += num[0].length; return parseFloat(num[0]); }
    const m = /^[A-Za-z_][A-Za-z0-9_.\-]*/.exec(s.slice(i));
    if(!m) cierr("не понимаю выражение: " + s.slice(i));
    const word = m[0];
    i += word.length;
    ws();
    if(s[i] === "("){                       /* вызов функции */
      i++;
      const args = [];
      if(peek() !== ")") do { args.push(or()); } while(eat(","));
      if(!eat(")")) cierr("не закрыта скобка вызова: " + word);
      return callFn(word, args, ctx);
    }
    if(word === "true") return true;
    if(word === "false") return false;
    if(word === "null") return null;
    if(/^\d+$/.test(word)) return parseInt(word, 10);
    const v = lookup(ctx, word);
    return v === undefined ? "" : v;
  }
  function cmp(){
    let a = primary();
    ws();
    if(eat("==")) return eqv(a, primary());
    if(eat("!=")) return !eqv(a, primary());
    return a;
  }
  function and(){ let a = cmp(); while(eat("&&")){ const b = cmp(); a = truth(a) ? b : a; if(!truth(a)) return false; } return a; }
  function or(){ let a = and(); while(eat("||")){ const b = and(); if(!truth(a)) a = b; } return a; }

  const v = or();
  ws();
  if(i < s.length) cierr("лишнее в выражении после «" + s.slice(0, i) + "»: " + s.slice(i));
  return v;
}
const truth = v => !(v === false || v === "" || v === 0 || v === null || v === undefined);
const eqv = (a, b) => String(a) === String(b) || (truth(a) === truth(b) && (a === b));

function callFn(name, args, ctx){
  const n = name.toLowerCase();
  if(n === "success") return ctx.job.status !== "failure";
  if(n === "failure") return ctx.job.status === "failure";
  if(n === "always") return true;
  if(n === "cancelled") return false;
  if(n === "contains") return String(args[0]).indexOf(String(args[1])) >= 0;
  if(n === "startswith") return String(args[0]).indexOf(String(args[1])) === 0;
  if(n === "endswith") return String(args[0]).slice(-String(args[1]).length) === String(args[1]);
  if(n === "format"){
    let out = String(args[0]);
    for(let k = 1; k < args.length; k++) out = out.split("{" + (k - 1) + "}").join(String(args[k]));
    return out;
  }
  if(n === "join") return [].concat(args[0]).join(args[1] === undefined ? "," : String(args[1]));
  if(n === "tojson") return JSON.stringify(args[0]);
  if(n === "hashfiles"){
    /* хеш от содержимого перечисленных файлов — основа ключа кеша */
    const R = ctx.__run;
    let h = 2166136261;
    for(const pat of args){
      for(const f of matchFiles(R, String(pat))){
        const t = R.files[f] || "";
        for(let k = 0; k < t.length; k++){ h ^= t.charCodeAt(k); h = Math.imul(h, 16777619); }
      }
    }
    return (h >>> 0).toString(16).padStart(8, "0").repeat(2);
  }
  cierr("нет функции «" + name + "»",
    "Есть: success, failure, always, cancelled, contains, startsWith, endsWith, format, join, toJSON, hashFiles.");
}
function matchFiles(R, pat){
  /* ** — любая глубина, * — в пределах одного уровня */
  const parts = String(pat).split("**").map(p =>
    p.replace(/[.+^${}()|[\]\\]/g, m => "\\" + m).replace(/\*/g, "[^/]*"));
  const re = new RegExp("^" + parts.join(".*") + "$");
  return Object.keys(R.files || {}).filter(f => re.test(f)).sort();
}

/* Подстановка ${{ … }} в строку. Если выражение — вся строка, сохраняем тип. */
function interp(v, ctx){
  if(typeof v !== "string") return v;
  const whole = /^\s*\$\{\{([\s\S]+?)\}\}\s*$/.exec(v);
  if(whole) return evalExpr(whole[1], ctx);
  return v.replace(/\$\{\{([\s\S]+?)\}\}/g, (_, e) => {
    const r = evalExpr(e, ctx);
    return r === null || r === undefined ? "" : String(r);
  });
}
function interpDeep(o, ctx){
  if(Array.isArray(o)) return o.map(x => interpDeep(x, ctx));
  if(o && typeof o === "object"){
    const out = {};
    for(const k in o) out[k] = interpDeep(o[k], ctx);
    return out;
  }
  return interp(o, ctx);
}
