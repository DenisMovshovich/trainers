<script>
"use strict";
/* ============================================================
   Лексер подмножества C#
   ============================================================ */
class CsErr extends Error{ constructor(m, line){ super(m); this.line = line; } }
const cserr = (m, line) => { throw new CsErr(m, line); };

const KW = new Set([
 "using","namespace","class","struct","interface","enum","record",
 "public","private","protected","internal","static","readonly","const","abstract","virtual","override","sealed","partial","new",
 "void","int","long","double","decimal","float","bool","string","char","object","var","dynamic",
 "if","else","for","foreach","while","do","switch","case","default","break","continue","return","goto",
 "try","catch","finally","throw","using","lock",
 "true","false","null","this","base","is","as","in","out","ref","params",
 "get","set","value","async","await","yield","where","select","from","operator","typeof","nameof","checked","unchecked"
]);

const PUNCT = [
 "=>","??=","??","?.","++","--","+=","-=","*=","/=","%=","==","!=","<=",">=","&&","||","<<",">>",
 "{","}","(",")","[","]",";",",",".",":","?","+","-","*","/","%","=","<",">","!","&","|","^","~"
];

function lex(src){
  const t = []; let i = 0, line = 1;
  const push = (k, v) => t.push({k, v, line});
  while(i < src.length){
    const c = src[i];
    if(c === "\n"){ line++; i++; continue; }
    if(/\s/.test(c)){ i++; continue; }
    /* комментарии */
    if(c === "/" && src[i+1] === "/"){ while(i < src.length && src[i] !== "\n") i++; continue; }
    if(c === "/" && src[i+1] === "*"){
      i += 2;
      while(i < src.length && !(src[i] === "*" && src[i+1] === "/")){ if(src[i] === "\n") line++; i++; }
      i += 2; continue;
    }
    /* строка с интерполяцией */
    if(c === "$" && src[i+1] === '"'){
      i += 2; const parts = []; let cur = "";
      while(i < src.length && src[i] !== '"'){
        if(src[i] === "\\"){ cur += unesc(src[i+1]); i += 2; continue; }
        if(src[i] === "{"){
          if(src[i+1] === "{"){ cur += "{"; i += 2; continue; }
          parts.push({lit: cur}); cur = "";
          i++; let depth = 1, expr = "";
          while(i < src.length && depth > 0){
            if(src[i] === "{") depth++;
            if(src[i] === "}"){ depth--; if(!depth){ i++; break; } }
            expr += src[i++];
          }
          parts.push({expr});
          continue;
        }
        if(src[i] === "\n") line++;
        cur += src[i++];
      }
      if(src[i] !== '"') cserr("незакрытая строка", line);
      i++; parts.push({lit: cur});
      push("interp", parts); continue;
    }
    /* обычная строка */
    if(c === '"'){
      i++; let s = "";
      while(i < src.length && src[i] !== '"'){
        if(src[i] === "\\"){ s += unesc(src[i+1]); i += 2; continue; }
        if(src[i] === "\n") cserr("перенос строки внутри строкового литерала", line);
        s += src[i++];
      }
      if(src[i] !== '"') cserr("незакрытая строка", line);
      i++; push("str", s); continue;
    }
    /* символ */
    if(c === "'"){
      i++; let s = "";
      if(src[i] === "\\"){ s = unesc(src[i+1]); i += 2; } else s = src[i++];
      if(src[i] !== "'") cserr("незакрытый символьный литерал", line);
      i++; push("char", s); continue;
    }
    /* число */
    if(/[0-9]/.test(c)){
      let s = "";
      while(i < src.length && /[0-9_]/.test(src[i])) s += src[i++];
      let isReal = false;
      if(src[i] === "." && /[0-9]/.test(src[i+1] || "")){
        isReal = true; s += src[i++];
        while(i < src.length && /[0-9_]/.test(src[i])) s += src[i++];
      }
      let suf = "";
      while(i < src.length && /[dDfFmMlLuU]/.test(src[i])) suf += src[i++];
      s = s.replace(/_/g, "");
      if(/[dDfFmM]/.test(suf)) isReal = true;
      push("num", {v: Number(s), real: isReal});
      continue;
    }
    /* идентификатор */
    if(/[A-Za-z_@]/.test(c)){
      let s = "";
      if(c === "@") i++;
      while(i < src.length && /[A-Za-z0-9_]/.test(src[i])) s += src[i++];
      push(KW.has(s) ? "kw" : "id", s);
      continue;
    }
    /* знаки */
    let hit = null;
    for(const p of PUNCT) if(src.startsWith(p, i)){ hit = p; break; }
    if(hit){ push("op", hit); i += hit.length; continue; }
    cserr("непонятный символ «" + c + "»", line);
  }
  push("eof", null);
  return t;
}
function unesc(c){
  return {n:"\n", t:"\t", r:"\r", "0":"\0", '"':'"', "'":"'", "\\":"\\"}[c] !== undefined
    ? {n:"\n", t:"\t", r:"\r", "0":"\0", '"':'"', "'":"'", "\\":"\\"}[c] : c;
}
