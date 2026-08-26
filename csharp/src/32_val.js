/* ============================================================
   Значения, копирование, окружение
   ============================================================ */
let __oid = 0;
const VInt   = v => ({t:"int",    v: Math.trunc(v)});
const VDbl   = v => ({t:"double", v});
const VBool  = v => ({t:"bool",   v: !!v});
const VStr   = v => ({t:"string", v: String(v)});
const VChar  = v => ({t:"char",   v: String(v)});
const VNull  = () => ({t:"null",  v:null});
const VList  = (items, et) => ({t:"list", items: items || [], et: et || null, id: ++__oid});
const VArr   = (items, et) => ({t:"array", items: items || [], et: et || null, id: ++__oid});
const VDict  = (m)     => ({t:"dict", map: m || new Map(), id: ++__oid});
const VObj   = (cls)   => ({t:"obj", cls, f:Object.create(null), id: ++__oid});
const VStruct= (cls)   => ({t:"struct", cls, f:Object.create(null)});
const VFn    = (ps, body, env, isExpr, self) => ({t:"fn", ps, body, env, isExpr, self});

const isNum = v => v.t === "int" || v.t === "double";
const isRef = v => ["obj","list","array","dict","fn","seq","task"].includes(v.t);

/* Значимые типы копируются при присваивании и передаче — ссылочные нет.
   Это ровно то различие, ради которого написан весь тренажёр. */
function cp(v){
  if(!v) return v;
  if(v.t === "struct"){
    const n = VStruct(v.cls);
    for(const k in v.f) n.f[k] = cp(v.f[k]);
    return n;
  }
  return v;
}

function fmt(v){
  if(!v) return "null";
  switch(v.t){
    case "null": return "";
    case "bool": return v.v ? "True" : "False";
    case "int": return String(v.v);
    case "double": {
      if(Number.isInteger(v.v)) return String(v.v);
      return String(Math.round(v.v * 1e10) / 1e10);
    }
    case "string": case "char": return v.v;
    case "list": return "System.Collections.Generic.List`1[" + (v.et || "T") + "]";
    case "array": return (v.et || "System.Object") + "[]";
    case "dict": return "System.Collections.Generic.Dictionary`2";
    case "seq": return "System.Linq.Enumerable+WhereSelectEnumerableIterator`2";
    case "task": return "System.Threading.Tasks.Task";
    case "fn": return "System.Func";
    case "struct": case "obj": {
      const ts = v.cls && v.cls.members && v.cls.members.find(m => m.k === "method" && m.name === "ToString" && m.body);
      return ts ? "<ToString>" : (v.cls ? v.cls.name : "object");
    }
  }
  return String(v.v);
}

class Env {
  constructor(parent){ this.m = new Map(); this.parent = parent; }
  has(n){ return this.m.has(n) || (this.parent ? this.parent.has(n) : false); }
  get(n){
    if(this.m.has(n)) return this.m.get(n);
    if(this.parent) return this.parent.get(n);
    return undefined;
  }
  set(n, v){
    if(this.m.has(n)){ this.m.set(n, v); return true; }
    if(this.parent && this.parent.set(n, v)) return true;
    return false;
  }
  def(n, v){ this.m.set(n, v); }
  /* объявленный (статический) тип переменной: по нему выбирается скрытый через new метод */
  defType(n, t){ (this.st || (this.st = new Map())).set(n, t); }
  getType(n){
    if(this.st && this.st.has(n)) return this.st.get(n);
    if(this.m.has(n)) return undefined;          /* объявлена здесь без типа — дальше не идём */
    return this.parent ? this.parent.getType(n) : undefined;
  }
}

/* исключение уровня C#, а не JS */
class CsThrow { constructor(val){ this.val = val; } }
const BRK = {sig:"break"}, CNT = {sig:"continue"};
class Ret { constructor(v){ this.v = v; } }
