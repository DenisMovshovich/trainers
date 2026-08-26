/* ============================================================
   Лексер: слово = строка + маска кавычек той же длины
   n — вне кавычек, d — в двойных, s — в одинарных или после \
   ============================================================ */
class ShErr extends Error {}

const OPS3 = ["2>>","<<<"];
const OPS2 = ["&&","||",">>","2>","&>","<<",";;"];
const OPS1 = [";","|","(",")","<",">","\n"];

function balanced(src, i, open, close){
  let d = 0;
  for(let j = i; j < src.length; j++){
    const c = src[j];
    if(c === "\\"){ j++; continue; }
    if(c === "'" ){ const e = src.indexOf("'", j+1); if(e < 0) throw new ShErr("незакрытая одинарная кавычка"); j = e; continue; }
    if(c === '"' ){ let k = j+1; while(k < src.length && src[k] !== '"'){ if(src[k]==="\\") k++; k++; } j = k; continue; }
    if(src.startsWith(open, j)){ d++; j += open.length - 1; continue; }
    if(src.startsWith(close, j)){ d--; if(d === 0) return j + close.length; j += close.length - 1; continue; }
  }
  throw new ShErr("не закрыто: " + open);
}

function tokenize(src){
  const toks = [];
  let i = 0, s = "", q = "", started = false;
  let hadQ = false;
  const flush = ()=>{ if(started){ toks.push({t:"w", s, q, qq: hadQ}); s = ""; q = ""; started = false; hadQ = false; } };
  const add = (txt, mark)=>{ started = true; s += txt; q += mark.repeat(txt.length); };

  while(i < src.length){
    const c = src[i];

    if(c === "#" && !started && (i === 0 || /\s/.test(src[i-1]))){
      while(i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if(c === "\\"){
      if(src[i+1] === "\n"){ i += 2; continue; }
      add(src[i+1] === undefined ? "\\" : src[i+1], "s"); i += 2; continue;
    }
    if(c === "'"){
      const e = src.indexOf("'", i+1);
      if(e < 0) throw new ShErr("незакрытая одинарная кавычка");
      add(src.slice(i+1, e), "s"); started = true; hadQ = true; i = e + 1; continue;
    }
    if(c === '"'){
      let j = i + 1;
      started = true; hadQ = true;
      while(j < src.length && src[j] !== '"'){
        if(src[j] === "\\" && '"\\$`'.includes(src[j+1])){ add(src[j+1], "s"); j += 2; continue; }
        if(src[j] === "$" && src[j+1] === "("){ const e = balanced(src, j+1, "(", ")"); add(src.slice(j, e), "d"); j = e; continue; }
        add(src[j], "d"); j++;
      }
      if(j >= src.length) throw new ShErr("незакрытая двойная кавычка");
      i = j + 1; continue;
    }
    if(c === "$" && src[i+1] === "("){
      if(src[i+2] === "("){ const e = balanced(src, i+2, "(", ")"); add(src.slice(i, e+1), "n"); i = e + 1; continue; }
      const e = balanced(src, i+1, "(", ")"); add(src.slice(i, e), "n"); i = e; continue;
    }
    if(c === "`"){
      const e = src.indexOf("`", i+1);
      if(e < 0) throw new ShErr("незакрытая обратная кавычка");
      add("$(" + src.slice(i+1, e) + ")", "n"); i = e + 1; continue;
    }
    if(c === "$" && src[i+1] === "{"){
      const e = balanced(src, i+1, "{", "}"); add(src.slice(i, e), "n"); i = e; continue;
    }
    if(c === " " || c === "\t"){ flush(); i++; continue; }

    if(c === "2" && src.startsWith("2>&1", i)){ flush(); toks.push({t:"o", v:"2>&1"}); i += 4; continue; }
    if(src.startsWith(">&2", i)){ flush(); toks.push({t:"o", v:">&2"}); i += 3; continue; }
    const three = OPS3.find(o=>src.startsWith(o, i));
    if(three){ flush(); toks.push({t:"o", v:three}); i += three.length; continue; }
    const two = OPS2.find(o=>src.startsWith(o, i));
    if(two){ flush(); toks.push({t:"o", v:two}); i += two.length; continue; }
    if(OPS1.includes(c)){
      flush(); toks.push({t:"o", v:c}); i++; continue;
    }
    add(c, "n"); i++;
  }
  flush();
  return toks;
}

/* ============================================================
   Парсер
   ============================================================ */
const RESERVED = ["if","then","elif","else","fi","for","while","until","do","done","case","esac","in","function","{","}","!"];

function parse(src){
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = v => toks[p] && toks[p].t === "o" && toks[p].v === v;
  const isWord = v => toks[p] && toks[p].t === "w" && toks[p].q.indexOf("s") < 0 && toks[p].q.indexOf("d") < 0 && toks[p].s === v;
  const eatSep = () => { let n = 0; while(isOp(";") || isOp("\n")){ p++; n++; } return n; };
  const expectWord = v => { if(!isWord(v)) throw new ShErr("ожидалось «" + v + "»"); p++; };

  function parseList(stop){
    const items = [];
    eatSep();
    while(p < toks.length){
      if(stop && stop.some(w=>isWord(w))) break;
      if(isOp(")") || isOp(";;")) break;
      const a = parseAndOr();
      if(!a) break;
      items.push(a);
      if(!eatSep()) break;
    }
    return {k:"list", items};
  }
  function parseAndOr(){
    let left = parsePipeline();
    if(!left) return null;
    while(isOp("&&") || isOp("||")){
      const op = toks[p].v; p++;
      while(isOp("\n")) p++;
      const right = parsePipeline();
      if(!right) throw new ShErr("нет команды после " + op);
      left = {k:"andor", op, left, right};
    }
    return left;
  }
  function parsePipeline(){
    let neg = false;
    if(isWord("!")){ neg = true; p++; }
    const cmds = [parseCommand()];
    if(!cmds[0]) return null;
    while(isOp("|")){
      p++;
      while(isOp("\n")) p++;
      const c = parseCommand();
      if(!c) throw new ShErr("нет команды после |");
      cmds.push(c);
    }
    return cmds.length === 1 && !neg ? cmds[0] : {k:"pipe", cmds, neg};
  }
  function parseRedirs(node){
    for(;;){
      const t = peek();
      if(!t || t.t !== "o") break;
      const v = t.v;
      if(v === "2>&1"){ node.redirs.push({op:"2>&1"}); p++; continue; }
      if(v === ">&2"){ node.redirs.push({op:">&2"}); p++; continue; }
      if([">",">>","<","2>","2>>","&>","<<","<<<"].includes(v)){
        p++;
        const w = peek();
        if(!w || w.t !== "w") throw new ShErr("нет цели перенаправления после " + v);
        p++;
        node.redirs.push({op:v, target:w});
        continue;
      }
      break;
    }
  }
  function parseCommand(){
    while(isOp("\n")) p++;
    const t = peek();
    if(!t) return null;

    if(t.t === "w" && t.q.indexOf("s") < 0){
      const w = t.s;
      if(w === "if") return parseIf();
      if(w === "for") return parseFor();
      if(w === "while" || w === "until") return parseWhile(w);
      if(w === "case") return parseCase();
      if(w === "function"){ p++; return parseFuncBody(toks[p++].s); }
      if(w === "{"){ p++; const b = parseList(["}"]); expectWord("}"); const n = {k:"group", body:b, redirs:[]}; parseRedirs(n); return n; }
      if(RESERVED.includes(w) && w !== "!") return null;
      if(toks[p+1] && toks[p+1].t === "o" && toks[p+1].v === "(" && toks[p+2] && toks[p+2].t === "o" && toks[p+2].v === ")"){
        p += 3; return parseFuncBody(w);
      }
    }
    if(t.t === "o" && t.v === "("){
      p++; const b = parseList(); if(!isOp(")")) throw new ShErr("нет закрывающей скобки"); p++;
      const n = {k:"subshell", body:b, redirs:[]}; parseRedirs(n); return n;
    }
    if(t.t !== "w") return null;

    const node = {k:"cmd", words:[], assigns:[], redirs:[]};
    let leading = true;
    for(;;){
      const c = peek();
      if(!c) break;
      if(c.t === "o"){
        if([">",">>","<","2>","2>>","&>","2>&1",">&2","<<","<<<"].includes(c.v)){ parseRedirs(node); continue; }
        break;
      }
      const m = c.q[0] !== "s" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(c.s);
      if(leading && m){ node.assigns.push(c); p++; continue; }
      leading = false;
      node.words.push(c); p++;
    }
    if(!node.words.length && !node.assigns.length && !node.redirs.length) return null;
    return node;
  }
  function parseFuncBody(name){
    while(isOp("\n")) p++;
    if(!isWord("{")) throw new ShErr("тело функции должно начинаться с {");
    p++;
    const body = parseList(["}"]);
    expectWord("}");
    return {k:"func", name, body};
  }
  function parseIf(){
    p++;
    const cond = parseList(["then"]);
    expectWord("then");
    const then = parseList(["elif","else","fi"]);
    const node = {k:"if", cond, then, elifs:[], else:null, redirs:[]};
    while(isWord("elif")){
      p++;
      const c = parseList(["then"]);
      expectWord("then");
      const b = parseList(["elif","else","fi"]);
      node.elifs.push({cond:c, body:b});
    }
    if(isWord("else")){ p++; node.else = parseList(["fi"]); }
    expectWord("fi");
    parseRedirs(node);
    return node;
  }
  function parseFor(){
    p++;
    const nameTok = peek();
    if(!nameTok || nameTok.t !== "w") throw new ShErr("после for нужно имя переменной");
    const name = nameTok.s; p++;
    let items = null;
    if(isWord("in")){
      p++; items = [];
      while(peek() && peek().t === "w" && !isWord("do")){ items.push(toks[p]); p++; }
    }
    eatSep();
    expectWord("do");
    const body = parseList(["done"]);
    expectWord("done");
    const node = {k:"for", name, items, body, redirs:[]};
    parseRedirs(node);
    return node;
  }
  function parseWhile(kind){
    p++;
    const cond = parseList(["do"]);
    expectWord("do");
    const body = parseList(["done"]);
    expectWord("done");
    const node = {k:"while", until: kind === "until", cond, body, redirs:[]};
    parseRedirs(node);
    return node;
  }
  function parseCase(){
    p++;
    const subj = peek(); if(!subj || subj.t !== "w") throw new ShErr("после case нужно слово");
    p++;
    eatSep(); expectWord("in"); eatSep();
    const clauses = [];
    while(!isWord("esac")){
      if(p >= toks.length) throw new ShErr("не закрыт case");
      const pats = [];
      if(isOp("(")) p++;
      for(;;){
        const w = peek();
        if(!w || w.t !== "w") throw new ShErr("ожидался образец в case");
        pats.push(w); p++;
        if(peek() && peek().t === "o" && peek().v === "|"){ p++; continue; }
        break;
      }
      if(!isOp(")")) throw new ShErr("ожидалась ) после образца");
      p++;
      const body = parseList(["esac"]);
      if(isOp(";;")) p++;
      eatSep();
      clauses.push({pats, body});
    }
    expectWord("esac");
    const node = {k:"case", subj, clauses, redirs:[]};
    parseRedirs(node);
    return node;
  }

  const prog = parseList();
  if(p < toks.length){
    const t = toks[p];
    throw new ShErr("не разобрано у «" + (t.t === "w" ? t.s : t.v) + "»");
  }
  return prog;
}
