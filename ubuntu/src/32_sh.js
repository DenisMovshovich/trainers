/* ============================================================
   Оболочка: разбор строки, подстановки, конвейеры, коды возврата
   ============================================================ */
/* лексер: возвращает слова с пометкой, были ли кавычки (для подстановок и шаблонов) */
function lex(line){
  const words = [];
  let cur = "", quoted = false, has = false, q = null;
  const flush = () => { if(has || cur !== ""){ words.push({t: cur, q: quoted}); cur = ""; quoted = false; has = false; } };
  for(let i = 0; i < line.length; i++){
    const c = line[i];
    if(q){
      if(c === q){ q = null; continue; }
      if(q === "'" && c === "$"){ cur += "\u0000"; continue; }
      if(q === "'" && c === "~"){ cur += "\u0001"; continue; }
      if(q === '"' && c === "\\" && /[$"\\`]/.test(line[i + 1] || "")){ cur += line[++i]; continue; }
      cur += c; continue;
    }
    if(c === "'" || c === '"'){ q = c; quoted = true; has = true; continue; }
    if(c === "\\"){ if(i + 1 < line.length){ cur += line[++i]; quoted = true; has = true; } continue; }
    if(/\s/.test(c)){ flush(); continue; }
    if(c === "|" && line[i + 1] === "|"){ flush(); words.push({t: "||", op: 1}); i++; continue; }
    if(c === "&" && line[i + 1] === "&"){ flush(); words.push({t: "&&", op: 1}); i++; continue; }
    if(c === "|"){ flush(); words.push({t: "|", op: 1}); continue; }
    if(c === ";"){ flush(); words.push({t: ";", op: 1}); continue; }
    if(c === ">" && line[i + 1] === ">"){ flush(); words.push({t: ">>", op: 1}); i++; continue; }
    if(c === ">"){ flush(); words.push({t: ">", op: 1}); continue; }
    if(c === "<"){ flush(); words.push({t: "<", op: 1}); continue; }
    if(c === "2" && line[i + 1] === ">" && line[i + 2] === "&" && line[i + 3] === "1"){
      flush(); words.push({t: "2>&1", op: 1}); i += 3; continue;
    }
    if(c === "2" && line[i + 1] === ">"){ flush(); words.push({t: "2>", op: 1}); i++; continue; }
    cur += c; has = true;
  }
  if(q) serr("незакрытая кавычка " + q, "Закройте кавычку — оболочка ждёт продолжения строки.");
  flush();
  return words;
}

/* подстановка переменных и домашнего каталога */
function expand(S, w){
  if(w.q === "'") return w.t;
  let s = w.t;
  s = s.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, n) => S.env[n] === undefined ? "" : S.env[n]);
  s = s.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (m, n) => S.env[n] === undefined ? "" : S.env[n]);
  s = s.replace(/\$\?/g, String(S.lastCode));
  if(!w.q && s[0] === "~" && (s.length === 1 || s[1] === "/")) s = homeOf(S, S.who.name) + s.slice(1);
  return s.replace(/\u0000/g, "$").replace(/\u0001/g, "~");
}
/* раскрытие шаблонов имён: * ? [..] — только если что-то нашлось */
function globify(S, pat, who){
  if(!/[*?\[]/.test(pat)) return [pat];
  const d = /\//.test(pat) ? dirName(pat) : ".";
  const base = baseName(pat);
  let items;
  try{ items = listDir(S, d, {who}); }catch(e){ return [pat]; }
  const re = new RegExp("^" + base.replace(/[.+^${}()|\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")
    .replace(/\[!([^\]]+)\]/g, "[^$1]") + "$");
  const hit = items.filter(x => re.test(x.name) && (base[0] === "." || x.name[0] !== "."))
                   .map(x => (/\//.test(pat) ? (d === "/" ? "" : d) + "/" : "") + x.name);
  return hit.length ? hit.sort() : [pat];
}

/* разбор ключей: -a -la --long --opt=v --opt v */
function parseArgv(argv, spec){
  spec = spec || {};
  const flags = {}, opts = {}, args = [];
  let noMore = false;
  for(let i = 0; i < argv.length; i++){
    const t = argv[i];
    if(noMore){ args.push(t); continue; }
    if(t === "--"){ noMore = true; continue; }
    if(t.length > 2 && t.slice(0, 2) === "--"){
      const body = t.slice(2), eq = body.indexOf("=");
      if(eq > 0){ opts[body.slice(0, eq)] = body.slice(eq + 1); continue; }
      if(spec[body] && argv[i + 1] !== undefined){ opts[body] = argv[++i]; continue; }
      flags[body] = true; continue;
    }
    if(t[0] === "-" && t.length > 1 && t !== "-"){
      const letters = t.slice(1);
      for(let k = 0; k < letters.length; k++){
        const c = letters[k];
        if(spec[c]){
          if(k < letters.length - 1){ opts[c] = letters.slice(k + 1); k = letters.length; }
          else if(argv[i + 1] !== undefined) opts[c] = argv[++i];
          else flags[c] = true;
        } else flags[c] = true;
      }
      continue;
    }
    args.push(t);
  }
  return {flags, opts, args, argv};
}

/* ── исполнение ──────────────────────────────────────── */
/* одна команда: слова уже раскрыты, перенаправления вынуты */
function runOne(S, words, stdin){
  const redir = {out: null, app: false, err: null, errToOut: false, in: null};
  const argv = [];
  for(let i = 0; i < words.length; i++){
    const w = words[i];
    if(w.op){
      const target = words[++i];
      if(w.t === "2>&1"){ redir.errToOut = true; i--; continue; }
      if(!target || target.op) serr("syntax error near unexpected token `newline'");
      if(w.t === ">"){ redir.out = target.t; redir.app = false; }
      else if(w.t === ">>"){ redir.out = target.t; redir.app = true; }
      else if(w.t === "2>"){ redir.err = target.t; }
      else if(w.t === "<"){ redir.in = target.t; }
      continue;
    }
    argv.push(w.t);
  }
  if(!argv.length){
    if(redir.out) writeFile(S, redir.out, "", {});   /* > файл — создание пустого */
    return {out: [], code: 0};
  }
  let input = stdin;
  if(redir.in) input = readFile(S, redir.in).split("\n").filter((l, i, a) => !(i === a.length - 1 && l === ""));

  /* sudo снимается здесь, до вызова команды: перенаправление остаётся за
     вызывающим — ровно поэтому «sudo echo x > /root/f» и не работает */
  let sudoPrev = null;
  if(argv[0] === "sudo"){
    if(!canSudo(S, S.who.name))
      return {out: [], code: 1,
              err: S.who.name + " is not in the sudoers file.  This incident will be reported.",
              hint: "Право на sudo даёт членство в группе sudo: sudo usermod -aG sudo " + S.who.name + " — но выполнить это должен тот, у кого право уже есть."};
    let i = 1, as = "root", shellOnly = false;
    while(i < argv.length){
      if(argv[i] === "-u" || argv[i] === "--user"){ as = argv[i + 1]; i += 2; continue; }
      if(argv[i] === "-i" || argv[i] === "-s"){ shellOnly = true; i++; continue; }
      if(argv[i] === "-H" || argv[i] === "-E" || argv[i] === "-n"){ i++; continue; }
      break;
    }
    if(!S.users[as]) return {out: [], code: 1, err: "sudo: unknown user: " + as};
    const rest = argv.slice(i);
    if(!rest.length || shellOnly && !rest.length){
      S.stack.push({who: S.who, cwd: S.cwd});
      S.who = whoOf(S, as);
      S.cwd = homeOf(S, as);
      return {out: ["теперь вы " + as + "; вернуться назад — exit"], code: 0};
    }
    sudoPrev = S.who;
    S.who = whoOf(S, as);
    argv.splice(0, i);
  }
  const name = argv[0];
  const fn = CMDS[name];
  let r;
  if(!fn){
    if(/\//.test(name)){
      let node = null;
      try{ node = statPath(S, name).node; }catch(e){ node = null; }
      if(!node) r = {out: [], err: "bash: " + name + ": No such file or directory", code: 127};
      else if(!permitted(node, S.who, "x"))
        r = {out: [], err: "bash: " + name + ": Permission denied", code: 126,
             hint: "Файл есть, но не помечен как исполняемый. Нужен бит x: chmod +x " + name + "."};
      else r = runScript(S, node, argv);
    } else {
      r = {out: [], err: name + ": command not found", code: 127,
           hint: pkgKnown(S, name) ? ("Команда есть в пакете " + name + " — его нужно установить: sudo apt install " + name + ".")
                                   : "Наберите help, чтобы увидеть список доступных команд."};
    }
  } else {
    const a = parseArgv(argv.slice(1), SPEC[name] || {});
    a.name = name; a.stdin = input || [];
    try{ r = fn(S, a) || {out: [], code: 0}; }
    catch(e){
      if(!(e instanceof SysErr)) throw e;
      r = {out: [], err: name + ": " + e.message, hint: e.hint || "", code: 1};
    }
  }
  if(sudoPrev) S.who = sudoPrev;      /* файл открывает оболочка, а не sudo */
  r.out = r.out || [];
  if(r.code === undefined) r.code = r.err ? 1 : 0;

  if(redir.errToOut && r.err){ r.out = r.out.concat([r.err]); r.err = null; }
  if(redir.err && r.err){ writeFile(S, redir.err, r.err + "\n", {}); r.err = null; }
  if(redir.out){
    const text = r.out.length ? r.out.join("\n") + "\n" : "";
    if(redir.app){
      let old = "";
      try{ old = readFile(S, redir.out); }catch(e){ old = ""; }
      writeFile(S, redir.out, old + text, {});
    } else writeFile(S, redir.out, text, {});
    r.out = [];
  }
  return r;
}
/* исполняемый файл: сценарий оболочки со строкой #! или без неё */
function runScript(S, node, argv){
  const lines = String(node.content).split("\n");
  const out = [];
  let code = 0;
  const saved = S.env.__depth || 0;
  if(saved > 4) return {out: [], err: "слишком глубокая вложенность сценариев", code: 1};
  S.env.__depth = saved + 1;
  for(let i = 0; i < lines.length; i++){
    const l = lines[i];
    if(!l.trim() || /^\s*#/.test(l)) continue;
    let sub;
    try{ sub = runLine(S, l.replace(/\$1/g, argv[1] === undefined ? "" : argv[1])); }
    catch(e){ sub = {out: [], err: e.message, code: 1}; }
    out.push.apply(out, sub.out || []);
    if(sub.err) out.push(sub.err);
    code = sub.code === undefined ? 0 : sub.code;
  }
  S.env.__depth = saved;
  return {out, code};
}

/* конвейер и списки: ;  &&  ||  | */
function runLine(S, line){
  const words = lex(line);
  /* присваивание переменной без команды: NAME=value */
  if(words.length === 1 && !words[0].op && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0].t)){
    const eq = words[0].t.indexOf("=");
    S.env[words[0].t.slice(0, eq)] = expand(S, {t: words[0].t.slice(eq + 1), q: words[0].q});
    return {out: [], code: 0};
  }
  const segs = [];
  let cur = [], join = null;
  for(const w of words){
    if(w.op && (w.t === ";" || w.t === "&&" || w.t === "||")){
      segs.push({words: cur, join}); cur = []; join = w.t === ";" ? null : w.t; continue;
    }
    cur.push(w);
  }
  segs.push({words: cur, join});

  let last = {out: [], code: 0}, lastHint = "";
  const acc = [], errAcc = [];
  for(const seg of segs){
    if(!seg.words.length) continue;
    if(seg.join === "&&" && last.code !== 0) continue;
    if(seg.join === "||" && last.code === 0) continue;
    /* конвейер */
    const stages = [[]];
    for(const w of seg.words){
      if(w.op && w.t === "|"){ stages.push([]); continue; }
      stages[stages.length - 1].push(w);
    }
    let stdin = null;
    let r = {out: [], code: 0};
    for(let si = 0; si < stages.length; si++){
      const expanded = [];
      for(const w of stages[si]){
        if(w.op){ expanded.push(w); continue; }
        const s = expand(S, w);
        if(w.q || !/[*?\[]/.test(s)) expanded.push({t: s});
        else for(const g of globify(S, s, S.who)) expanded.push({t: g});
      }
      r = runOne(S, expanded, stdin);
      S.lastCode = r.code;
      if(si < stages.length - 1){
        if(r.err){ errAcc.push(r.err); if(r.hint) lastHint = r.hint; r.err = null; }
        stdin = r.out; r.out = [];
      }
    }
    acc.push.apply(acc, r.out);
    if(r.err){ errAcc.push(r.err); if(r.hint) lastHint = r.hint; }
    last = r;
  }
  return {out: acc, code: last.code, clear: last.clear,
          err: errAcc.length ? errAcc.join("\n") : null,
          hint: errAcc.length ? lastHint : last.hint};
}
