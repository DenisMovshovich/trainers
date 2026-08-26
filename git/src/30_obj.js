<script>
"use strict";
/* ============================================================
   Объектная модель git
   Хранилище адресуется содержимым: одинаковое содержимое —
   один и тот же объект. Отсюда и неизменяемость истории.
   ============================================================ */

class GitErr extends Error {
  constructor(msg, hint){ super(msg); this.hint = hint || ""; }
}
const gerr = (m, h) => { throw new GitErr(m, h); };

/* 40 шестнадцатеричных цифр. Не SHA-1, но ведёт себя так же:
   детерминированно, лавинообразно, коллизии практически исключены. */
function oid(s){
  let a = 0x811c9dc5, b = 0x01000193, c = 0x9e3779b9, d = 0x85ebca6b, e = 0xc2b2ae35;
  for(let i = 0; i < s.length; i++){
    const k = s.charCodeAt(i);
    a = Math.imul(a ^ k, 16777619) >>> 0;
    b = (Math.imul(b + k, 2654435761) ^ (a >>> 13)) >>> 0;
    c = (Math.imul(c ^ (k + i), 2246822519) + (b >>> 7)) >>> 0;
    d = (Math.imul(d + (k << 3), 3266489917) ^ (c >>> 11)) >>> 0;
    e = (Math.imul(e ^ (k * (i + 1)), 668265263) + (d >>> 5)) >>> 0;
  }
  /* добить лавину, иначе близкие строки дают близкие префиксы */
  for(let r = 0; r < 3; r++){
    a = (Math.imul(a ^ (e >>> 16), 2246822519)) >>> 0;
    b = (Math.imul(b ^ (a >>> 13), 3266489917)) >>> 0;
    c = (Math.imul(c ^ (b >>> 16), 668265263)) >>> 0;
    d = (Math.imul(d ^ (c >>> 13), 374761393)) >>> 0;
    e = (Math.imul(e ^ (d >>> 16), 2654435761)) >>> 0;
  }
  const h = n => ("00000000" + (n >>> 0).toString(16)).slice(-8);
  return h(a) + h(b) + h(c) + h(d) + h(e);
}
const short = id => String(id).slice(0, 7);

/* ── объекты ───────────────────────────────────────────── */
/* blob   {t:"blob", data}
   tree   {t:"tree", ents:[{name, type:"blob"|"tree", id}]}
   commit {t:"commit", tree, parents:[], msg, author, at}
   tag    {t:"tag", obj, name, msg}                            */

function store(R, o){
  const id = oid(serialize(o));
  if(!R.objects[id]) R.objects[id] = o;
  return id;
}
function serialize(o){
  if(o.t === "blob")   return "blob\0" + o.data;
  if(o.t === "tree")   return "tree\0" + o.ents.map(e => e.type + " " + e.name + " " + e.id).join("\n");
  if(o.t === "commit") return "commit\0" + o.tree + "\0" + o.parents.join(" ") + "\0" +
                              o.author + "\0" + o.at + "\0" + o.msg;
  if(o.t === "tag")    return "tag\0" + o.obj + "\0" + o.name + "\0" + o.msg;
  gerr("неизвестный тип объекта");
}
const obj = (R, id) => R.objects[id];
function blobId(R, data){ return store(R, {t:"blob", data}); }

/* Плоский набор путей → настоящее дерево деревьев.
   Именно так git и хранит каталоги: дерево ссылается на поддеревья. */
function buildTree(R, files){
  const build = (prefix) => {
    const ents = [], subdirs = {};
    for(const p in files){
      if(prefix && p.indexOf(prefix) !== 0) continue;
      const rest = prefix ? p.slice(prefix.length) : p;
      const i = rest.indexOf("/");
      if(i < 0) ents.push({name: rest, type: "blob", id: blobId(R, files[p])});
      else subdirs[rest.slice(0, i)] = true;
    }
    for(const d in subdirs)
      ents.push({name: d, type: "tree", id: build(prefix + d + "/")});
    ents.sort((x, y) => x.name < y.name ? -1 : x.name > y.name ? 1 : 0);
    return store(R, {t:"tree", ents});
  };
  return build("");
}
/* обратно: дерево → плоский набор путей */
function readTree(R, id, prefix, out){
  out = out || {}; prefix = prefix || "";
  const t = obj(R, id);
  if(!t) return out;
  for(const e of t.ents){
    if(e.type === "blob") out[prefix + e.name] = obj(R, e.id).data;
    else readTree(R, e.id, prefix + e.name + "/", out);
  }
  return out;
}
const commitFiles = (R, id) => id ? readTree(R, obj(R, id).tree) : {};

/* ── репозиторий ───────────────────────────────────────── */
function newRepo(name){
  return {
    name: name || "webapp",
    objects: {},                 /* id → объект */
    refs: {},                    /* "refs/heads/main" → id коммита */
    tags: {},                    /* имя → {id, annotated} */
    HEAD: {ref: "refs/heads/main", id: null},   /* ref — символическая ссылка, id — отсоединённая */
    index: {},                   /* путь → содержимое (упрощённо: индекс хранит blob'ы) */
    work: {},                    /* рабочая копия */
    ignore: [],                  /* строки .gitignore */
    reflog: {},                  /* "HEAD" | "refs/heads/main" → [{from, to, what}] */
    stash: [],
    remotes: {},                 /* "origin" → {repo, refs:{}} */
    upstream: {},                /* "main" → "origin/main" */
    now: 1700000000,             /* виртуальные часы: детерминированные хеши */
    author: "Автор <dev@example.com>",
    merging: null,               /* {into, from, conflicts:[]} */
    rebasing: null,
    initialized: false,
    ORIG_HEAD: null
  };
}

/* ── ссылки ────────────────────────────────────────────── */
const headRef = R => R.HEAD.ref;
const detached = R => !R.HEAD.ref;
function headId(R){ return R.HEAD.ref ? (R.refs[R.HEAD.ref] || null) : R.HEAD.id; }
function branchName(R){ return R.HEAD.ref ? R.HEAD.ref.replace("refs/heads/", "") : null; }
const branches = R => Object.keys(R.refs).filter(r => r.indexOf("refs/heads/") === 0)
                            .map(r => r.replace("refs/heads/", "")).sort();
const remoteRefs = R => Object.keys(R.refs).filter(r => r.indexOf("refs/remotes/") === 0)
                            .map(r => r.replace("refs/remotes/", "")).sort();

function logRef(R, name, from, to, what){
  (R.reflog[name] || (R.reflog[name] = [])).unshift({from, to, what});
}
function setRef(R, ref, id, what){
  const from = R.refs[ref] || null;
  R.refs[ref] = id;
  logRef(R, ref, from, id, what);
  if(R.HEAD.ref === ref) logRef(R, "HEAD", from, id, what);
}
function moveHead(R, id, what){
  if(R.HEAD.ref) setRef(R, R.HEAD.ref, id, what);
  else { const from = R.HEAD.id; R.HEAD.id = id; logRef(R, "HEAD", from, id, what); }
}

/* ── обход истории ─────────────────────────────────────── */
function ancestry(R, id){
  const seen = new Set(), out = [], q = id ? [id] : [];
  while(q.length){
    const c = q.shift();
    if(!c || seen.has(c)) continue;
    seen.add(c); out.push(c);
    const o = obj(R, c);
    if(o && o.parents) for(const p of o.parents) q.push(p);
  }
  return out;
}
/* коммиты в порядке «новые сверху»: по виртуальному времени */
function history(R, id){
  return ancestry(R, id).sort((a, b) => {
    const oa = obj(R, a), ob = obj(R, b);
    return ob.at - oa.at || (a < b ? 1 : -1);
  });
}
const isAncestor = (R, a, b) => !!a && ancestry(R, b).indexOf(a) >= 0;

function mergeBase(R, a, b){
  const A = new Set(ancestry(R, a));
  /* ближайший общий предок — самый поздний из общих */
  const common = ancestry(R, b).filter(c => A.has(c));
  if(!common.length) return null;
  common.sort((x, y) => obj(R, y).at - obj(R, x).at);
  return common[0];
}
