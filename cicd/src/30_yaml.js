<script>
"use strict";
/* ============================================================
   Разбор YAML — того подмножества, на котором пишут манифесты
   ============================================================ */
class CiErr extends Error {
  constructor(msg, hint){ super(msg); this.hint = hint || ""; }
}
const cierr = (m, h) => { throw new CiErr(m, h); };

function scalar(s){
  s = s.trim();
  if(s === "" ) return "";
  if(s === "null" || s === "~") return null;
  if(s === "true") return true;
  if(s === "false") return false;
  const q = s[0];
  if((q === '"' || q === "'") && s[s.length - 1] === q) return s.slice(1, -1);
  if(/^-?\d+$/.test(s)) return parseInt(s, 10);
  if(/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  /* инлайновый список [a, b] и словарь {a: 1} */
  if(s[0] === "[" && s[s.length - 1] === "]"){
    const body = s.slice(1, -1).trim();
    return body === "" ? [] : splitTop(body).map(scalar);
  }
  if(s[0] === "{" && s[s.length - 1] === "}"){
    const body = s.slice(1, -1).trim(), o = {};
    if(body) for(const part of splitTop(body)){
      const i = part.indexOf(":");
      if(i < 0) cierr("не разобрать «" + part + "»");
      o[scalar(part.slice(0, i))] = scalar(part.slice(i + 1));
    }
    return o;
  }
  return s;
}
/* разбить по запятым верхнего уровня */
function splitTop(s){
  const out = []; let d = 0, cur = "", q = null;
  for(const c of s){
    if(q){ cur += c; if(c === q) q = null; continue; }
    if(c === '"' || c === "'"){ q = c; cur += c; continue; }
    if(c === "[" || c === "{") d++;
    if(c === "]" || c === "}") d--;
    if(c === "," && d === 0){ out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if(cur.trim()) out.push(cur);
  return out.map(x => x.trim());
}

/* строки → массив {indent, text, dash, line} без пустых и комментариев */
function prep(src){
  const out = [];
  String(src).split("\n").forEach((raw, i) => {
    const noTab = raw.replace(/\t/g, "  ");
    const t = noTab.replace(/\s+#.*$/, "").replace(/^\s*#.*$/, "");
    if(!t.trim()) return;
    const indent = t.length - t.replace(/^ +/, "").length;
    let text = t.trim();
    let dash = false;
    if(text === "-" || text.indexOf("- ") === 0){ dash = true; text = text === "-" ? "" : text.slice(2).trim(); }
    out.push({indent, text, dash, line: i + 1});
  });
  return out;
}

function parseYaml(src){
  const docs = [];
  for(const chunk of String(src).split(/^---\s*$/m)){
    if(!chunk.trim()) continue;
    const rows = prep(chunk);
    if(!rows.length) continue;
    let p = 0;
    const val = parseBlock(rows, () => p, n => { p = n; }, rows[0].indent);
    docs.push(val);
    if(p < rows.length) cierr("не разобрана строка " + rows[p].line + ": «" + rows[p].text + "»");
  }
  return docs;
}

function parseBlock(rows, get, set, indent){
  const first = rows[get()];
  if(!first) return null;
  return first.dash ? parseList(rows, get, set, indent) : parseMap(rows, get, set, indent);
}

function parseList(rows, get, set, indent){
  const out = [];
  while(get() < rows.length){
    const r = rows[get()];
    if(r.indent < indent || !r.dash) break;
    if(r.indent > indent) cierr("странный отступ в строке " + r.line,
      "В YAML отступ значит вложенность. Элементы одного списка выравнивают по одному уровню.");
    set(get() + 1);
    if(r.text === ""){
      out.push(parseBlock(rows, get, set, rows[get()] ? rows[get()].indent : indent + 2));
      continue;
    }
    const c = r.text.indexOf(":");
    if(c > 0 && (r.text[c + 1] === " " || c === r.text.length - 1)){
      /* элемент списка — словарь, начинающийся на этой же строке */
      const item = {};
      const key = r.text.slice(0, c).trim();
      const rest = r.text.slice(c + 1).trim();
      const inner = indent + 2;
      if(rest) item[key] = scalar(rest);
      else item[key] = parseNested(rows, get, set, inner);
      /* остальные ключи того же элемента */
      while(get() < rows.length && rows[get()].indent >= inner && !rows[get()].dash){
        const q = rows[get()];
        if(q.indent > inner){ cierr("странный отступ в строке " + q.line); }
        const ci = q.text.indexOf(":");
        if(ci < 0) cierr("ожидалось «ключ: значение» в строке " + q.line);
        const k2 = q.text.slice(0, ci).trim(), v2 = q.text.slice(ci + 1).trim();
        set(get() + 1);
        item[k2] = v2 ? scalar(v2) : parseNested(rows, get, set, q.indent + 1);
      }
      out.push(item);
      continue;
    }
    out.push(scalar(r.text));
  }
  return out;
}

function parseMap(rows, get, set, indent){
  const out = {};
  while(get() < rows.length){
    const r = rows[get()];
    if(r.indent < indent) break;
    if(r.dash) break;
    if(r.indent > indent) cierr("странный отступ в строке " + r.line,
      "Лишние пробелы делают ключ вложенным в предыдущий. Проверьте выравнивание.");
    const c = r.text.indexOf(":");
    if(c < 0) cierr("ожидалось «ключ: значение» в строке " + r.line + ": «" + r.text + "»",
      "После имени ключа в YAML обязательно двоеточие и пробел.");
    const key = r.text.slice(0, c).trim();
    const rest = r.text.slice(c + 1).trim();
    set(get() + 1);
    out[key] = rest !== "" ? scalar(rest) : parseNested(rows, get, set, indent + 1);
  }
  return out;
}
/* вложенный блок: список или словарь с бо́льшим отступом */
function parseNested(rows, get, set, minIndent){
  const nxt = rows[get()];
  if(!nxt || nxt.indent < minIndent) return null;
  return parseBlock(rows, get, set, nxt.indent);
}

/* обратно в YAML — для kubectl get -o yaml */
function toYaml(v, ind){
  ind = ind || 0;
  const pad = " ".repeat(ind);
  if(v === null || v === undefined) return "null";
  if(Array.isArray(v)){
    if(!v.length) return "[]";
    return v.map(x => {
      if(x !== null && typeof x === "object"){
        const body = toYaml(x, ind + 2);
        return pad + "- " + body.slice(ind + 2).replace(/^\s+/, "");
      }
      return pad + "- " + fmtScalar(x);
    }).join("\n");
  }
  if(typeof v === "object"){
    const keys = Object.keys(v);
    if(!keys.length) return "{}";
    return keys.map(k => {
      const x = v[k];
      if(x !== null && typeof x === "object" && (Array.isArray(x) ? x.length : Object.keys(x).length))
        return pad + k + ":\n" + toYaml(x, ind + 2);
      if(x !== null && typeof x === "object") return pad + k + ": " + (Array.isArray(x) ? "[]" : "{}");
      return pad + k + ": " + fmtScalar(x);
    }).join("\n");
  }
  return pad + fmtScalar(v);
}
function fmtScalar(x){
  if(x === null || x === undefined) return "null";
  if(typeof x === "boolean") return x ? "true" : "false";
  if(typeof x === "number") return String(x);
  const s = String(x);
  if(s === "" || /^[\d.]+$|^(true|false|null|yes|no|on|off)$|[:#{}\[\],&*?|>'"%@`]|^\s|\s$/.test(s))
    return '"' + s.replace(/"/g, '\\"') + '"';
  return s;
}
