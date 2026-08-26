/* ============================================================
   Внешние утилиты
   ============================================================ */
const CMD = {};

CMD.ls = (sh, a, io)=>{
  const {f, rest} = flags(a);
  let targets = rest.length ? rest : ["."];
  let code = 0;
  const missing = targets.filter(t=>!exists(sh, normPath(t, sh.cwd)));
  missing.forEach(t=>{ io.err.write("ls: " + t + ": Нет такого файла или каталога\n"); code = 2; });
  targets = targets.filter(t=>exists(sh, normPath(t, sh.cwd)));
  const plainFiles = targets.filter(t=>!isDir(sh, normPath(t, sh.cwd)));
  const dirTargets = targets.filter(t=>isDir(sh, normPath(t, sh.cwd)));
  const oneCol = !!f["1"] || !io.out.tty;
  if(plainFiles.length && !f.l && !oneCol) io.out.write(plainFiles.join("  ") + "\n");
  if(plainFiles.length && !f.l && oneCol) plainFiles.forEach(n=>io.out.write(n + "\n"));
  targets = f.l ? plainFiles.concat(dirTargets) : dirTargets;
  const many = dirTargets.length > 1 || (dirTargets.length && plainFiles.length);
  targets.forEach((t,ti)=>{
    const p = normPath(t, sh.cwd);
    if(!exists(sh,p)){ io.err.write("ls: " + t + ": Нет такого файла или каталога\n"); code = 2; return; }
    let names;
    if(isDir(sh,p)){
      names = children(sh,p);
      if(!f.a) names = names.filter(n=>!n.startsWith("."));
      if(many) io.out.write((ti?"\n":"") + t + ":\n");
    } else names = [t];
    if(f.r) names = names.slice().reverse();
    if(f.l){
      names.forEach(n=>{
        const full = isDir(sh,p) ? normPath(p + "/" + n, sh.cwd) : p;
        const nd = sh.fs[full];
        const size = nd.t === "d" ? 4096 : nd.c.length;
        const perm = (nd.t === "d" ? "d" : "-") + modeStr(nd.m);
        io.out.write(perm + " 1 user user " + String(size).padStart(6) + " авг 19 12:00 " + n + (nd.t === "d" ? "/" : "") + "\n");
      });
    } else if(oneCol) names.forEach(n=>io.out.write(n + "\n"));
    else if(names.length) io.out.write(names.map(n=>{
      const full = isDir(sh,p) ? normPath(p + "/" + n, sh.cwd) : p;
      return n + (isDir(sh, full) ? "/" : "");
    }).join("  ") + "\n");
  });
  return code;
};
function modeStr(m){
  const map = ["---","--x","-w-","-wx","r--","r-x","rw-","rwx"];
  return m.split("").map(d=>map[+d]).join("");
}
CMD.cat = (sh, a, io)=>{
  const {f, rest} = flags(a);
  let n = 0;
  return eachInput(sh, io, rest, txt=>{
    if(f.n) lines(txt).forEach(l=>io.out.write(String(++n).padStart(6) + "\t" + l + "\n"));
    else io.out.write(txt);
  });
};
CMD.head = (sh, a, io)=>{
  let n = 10, rest = [];
  for(let i = 0; i < a.length; i++){
    if(a[i] === "-n"){ n = parseInt(a[++i],10); continue; }
    if(/^-\d+$/.test(a[i])){ n = -parseInt(a[i],10); continue; }
    rest.push(a[i]);
  }
  return eachInput(sh, io, rest, (txt,name,many)=>{
    if(many) io.out.write("==> " + name + " <==\n");
    io.out.write(unlines(lines(txt).slice(0, n)));
  });
};
CMD.tail = (sh, a, io)=>{
  let n = 10, rest = [];
  for(let i = 0; i < a.length; i++){
    if(a[i] === "-n"){ n = parseInt(a[++i],10); continue; }
    if(/^-\d+$/.test(a[i])){ n = -parseInt(a[i],10); continue; }
    if(a[i] === "-f") continue;
    rest.push(a[i]);
  }
  return eachInput(sh, io, rest, (txt,name,many)=>{
    if(many) io.out.write("==> " + name + " <==\n");
    io.out.write(unlines(lines(txt).slice(-n)));
  });
};
CMD.wc = (sh, a, io)=>{
  const {f, rest} = flags(a);
  const any = f.l || f.w || f.c;
  let tl = 0, tw = 0, tc = 0, files = 0;
  const code = eachInput(sh, io, rest, (txt,name)=>{
    const L = lines(txt).length, W = (txt.match(/\S+/g)||[]).length, C = txt.length;
    tl += L; tw += W; tc += C; files++;
    const cols = [];
    if(!any || f.l) cols.push(String(L));
    if(!any || f.w) cols.push(String(W));
    if(!any || f.c) cols.push(String(C));
    io.out.write(cols.join(" ") + (name !== "-" ? " " + name : "") + "\n");
  });
  if(files > 1) io.out.write([tl,tw,tc].join(" ") + " итого\n");
  return code;
};
CMD.grep = (sh, a, io)=>{
  let pat = null, files = [], f = {};
  for(let i = 0; i < a.length; i++){
    const x = a[i];
    if(x === "-e"){ pat = a[++i]; continue; }
    if(x[0] === "-" && x.length > 1 && !/^-\d/.test(x)){ x.slice(1).split("").forEach(c=>f[c] = true); continue; }
    if(pat === null){ pat = x; continue; }
    files.push(x);
  }
  if(pat === null){ io.err.write("grep: нужен образец\n"); return 2; }
  let re;
  try{ re = new RegExp(f.F ? pat.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") : (f.w ? "\\b(?:" + pat + ")\\b" : pat), f.i ? "i" : ""); }
  catch(e){ io.err.write("grep: неверное регулярное выражение\n"); return 2; }
  let found = 0, count = 0;
  let targets = files;
  if(f.r){
    targets = [];
    (files.length ? files : ["."]).forEach(t=>{
      const p = normPath(t, sh.cwd);
      if(isFile(sh,p)) targets.push(t);
      else Object.keys(sh.fs).filter(k=>k.startsWith(p === "/" ? "/" : p + "/") && sh.fs[k].t === "f")
             .forEach(k=>targets.push(k.startsWith(sh.cwd + "/") ? k.slice(sh.cwd.length+1) : k));
    });
  }
  const many = targets.length > 1;
  const code = eachInput(sh, io, targets, (txt,name)=>{
    let c = 0;
    lines(txt).forEach((l,i)=>{
      const hit = re.test(l);
      if(f.v ? !hit : hit){
        c++; found++;
        if(f.c || f.l || f.q) return;
        let pre = "";
        if(many || f.H) pre += name + ":";
        if(f.n) pre += (i+1) + ":";
        if(f.o){ const m = l.match(new RegExp(re.source, re.flags + "g")); (m||[]).forEach(x=>io.out.write(pre + x + "\n")); }
        else io.out.write(pre + l + "\n");
      }
    });
    if(f.q) return;
    if(f.l){ if(c) io.out.write(name + "\n"); return; }
    if(f.c){ count += c; io.out.write((many ? name + ":" : "") + c + "\n"); }
  });
  if(code) return 2;
  return found ? 0 : 1;
};
CMD.sort = (sh, a, io)=>{
  const {f, rest} = flags(a);
  let key = null, sep = null, files = [];
  for(let i = 0; i < a.length; i++){
    if(a[i] === "-k"){ key = parseInt(a[++i],10); continue; }
    if(a[i] === "-t"){ sep = a[++i]; continue; }
    if(a[i][0] === "-" ) continue;
    files.push(a[i]);
  }
  let all = [];
  const code = eachInput(sh, io, files, txt=>{ all = all.concat(lines(txt)); });
  const val = l => { if(key === null) return l; const parts = sep ? l.split(sep) : l.trim().split(/\s+/); return parts[key-1] === undefined ? "" : parts[key-1]; };
  all.sort((x,y)=>{
    const A = val(x), B = val(y);
    if(f.n) return (parseFloat(A)||0) - (parseFloat(B)||0);
    return A.localeCompare(B, "ru");
  });
  if(f.r) all.reverse();
  if(f.u) all = all.filter((x,i)=>i === 0 || val(all[i-1]) !== val(x));
  io.out.write(unlines(all));
  return code;
};
CMD.uniq = (sh, a, io)=>{
  const {f, rest} = flags(a);
  return eachInput(sh, io, rest, txt=>{
    const L = lines(txt), out = [];
    let i = 0;
    while(i < L.length){
      let j = i;
      while(j + 1 < L.length && L[j+1] === L[i]) j++;
      const n = j - i + 1;
      if(f.d && n < 2){ i = j + 1; continue; }
      if(f.u && n > 1){ i = j + 1; continue; }
      out.push(f.c ? String(n).padStart(7) + " " + L[i] : L[i]);
      i = j + 1;
    }
    io.out.write(unlines(out));
  });
};
CMD.cut = (sh, a, io)=>{
  let d = "\t", fl = null, ch = null, files = [];
  for(let i = 0; i < a.length; i++){
    const x = a[i];
    if(x === "-d"){ d = a[++i]; continue; }
    if(x.startsWith("-d")){ d = x.slice(2); continue; }
    if(x === "-f"){ fl = a[++i]; continue; }
    if(x.startsWith("-f")){ fl = x.slice(2); continue; }
    if(x === "-c"){ ch = a[++i]; continue; }
    if(x.startsWith("-c")){ ch = x.slice(2); continue; }
    files.push(x);
  }
  const nums = spec => { const out = []; (spec||"").split(",").forEach(part=>{
      const m = part.match(/^(\d*)-(\d*)$/);
      if(m){ const a1 = m[1] ? +m[1] : 1, b1 = m[2] ? +m[2] : 99; for(let i = a1; i <= b1; i++) out.push(i); }
      else if(part) out.push(+part); }); return out; };
  return eachInput(sh, io, files, txt=>{
    lines(txt).forEach(l=>{
      if(ch){ const idx = nums(ch); io.out.write(idx.map(i=>l[i-1] || "").join("") + "\n"); return; }
      const parts = l.split(d);
      if(parts.length === 1 && d !== " "){ io.out.write(l + "\n"); return; }
      io.out.write(nums(fl).map(i=>parts[i-1] === undefined ? "" : parts[i-1]).join(d) + "\n");
    });
  });
};
CMD.tr = (sh, a, io)=>{
  const {f, rest} = flags(a);
  const expand = s => s.replace(/(\w)-(\w)/g, (m,x,y)=>{ let r = ""; for(let c = x.charCodeAt(0); c <= y.charCodeAt(0); c++) r += String.fromCharCode(c); return r; })
                       .replace(/\\n/g,"\n").replace(/\\t/g,"\t");
  const A = expand(rest[0] || ""), B = expand(rest[1] || "");
  const txt = io.in.rest();
  let out = "";
  for(const ch of txt){
    const i = A.indexOf(ch);
    if(f.d){ if(i >= 0) continue; out += ch; continue; }
    out += i >= 0 ? (B[i] !== undefined ? B[i] : B[B.length-1] || ch) : ch;
  }
  if(f.s) out = out.replace(new RegExp("([" + (B || A).replace(/[.*+?^${}()|[\]\\-]/g,"\\$&") + "])\\1+","g"), "$1");
  io.out.write(out);
  return 0;
};
CMD.sed = (sh, a, io)=>{
  const {f, rest} = flags(a);
  let script = null, files = [];
  for(let i = 0; i < a.length; i++){
    if(a[i] === "-n" || a[i] === "-E" || a[i] === "-r") continue;
    if(a[i] === "-e"){ script = a[++i]; continue; }
    if(script === null){ script = a[i]; continue; }
    files.push(a[i]);
  }
  if(script === null){ io.err.write("sed: нужен скрипт\n"); return 1; }
  const progs = script.split(";").map(s=>s.trim()).filter(Boolean);
  return eachInput(sh, io, files, txt=>{
    lines(txt).forEach((l, idx)=>{
      let line = l, printed = false, deleted = false;
      progs.forEach(pr=>{
        let m;
        if((m = pr.match(/^s(.)([\s\S]*?)\1([\s\S]*?)\1([gip0-9]*)$/))){
          const g = m[4].includes("g"), ci = m[4].includes("i");
          const re = new RegExp(m[2], g ? "g" + (ci?"i":"") : (ci?"i":""));
          const rep = m[3].replace(/\\t/g,"\t").replace(/\\n/g,"\n").replace(/\\(\d)/g,"$$$1");
          line = line.replace(re, rep);
          if(m[4].includes("p")){ io.out.write(line + "\n"); printed = true; }
          return;
        }
        if((m = pr.match(/^(\d+)?d$/))){ if(!m[1] || +m[1] === idx+1) deleted = true; return; }
        if((m = pr.match(/^\/([\s\S]*)\/d$/))){ if(new RegExp(m[1]).test(line)) deleted = true; return; }
        if((m = pr.match(/^(\d+)?p$/))){ if(!m[1] || +m[1] === idx+1){ io.out.write(line + "\n"); printed = true; } return; }
        if((m = pr.match(/^\/([\s\S]*)\/p$/))){ if(new RegExp(m[1]).test(line)){ io.out.write(line + "\n"); printed = true; } return; }
      });
      if(deleted) return;
      if(!f.n && !printed) io.out.write(line + "\n");
    });
  });
};
CMD.awk = (sh, a, io)=>{
  let FS = null, prog = null, files = [];
  for(let i = 0; i < a.length; i++){
    if(a[i] === "-F"){ FS = a[++i]; continue; }
    if(a[i].startsWith("-F")){ FS = a[i].slice(2); continue; }
    if(prog === null){ prog = a[i]; continue; }
    files.push(a[i]);
  }
  if(prog === null){ io.err.write("awk: нужна программа\n"); return 1; }
  const rules = [];
  const body = prog.trim();
  const rx = /(BEGIN|END|\/[^\/]*\/|\$\d+\s*[=!<>]+\s*[^{]+|NR\s*[=!<>]+\s*\d+)?\s*\{([\s\S]*?)\}/g;
  let m;
  while((m = rx.exec(body))) rules.push({cond: (m[1]||"").trim(), act: m[2].trim()});
  if(!rules.length) rules.push({cond:"", act: body});
  let NR = 0;
  const run = (act, F, line)=>{
    act.split(";").map(s=>s.trim()).filter(Boolean).forEach(st=>{
      const p = st.match(/^print\s*([\s\S]*)$/);
      if(!p){ return; }
      const arg = p[1].trim();
      if(!arg){ io.out.write(line + "\n"); return; }
      const parts = arg.split(",").map(x=>x.trim());
      io.out.write(parts.map(x=>{
        if(x === "$0") return line;
        let mm = x.match(/^\$(\d+)$/);
        if(mm) return F[+mm[1]-1] === undefined ? "" : F[+mm[1]-1];
        if(x === "NR") return String(NR);
        if(x === "NF") return String(F.length);
        mm = x.match(/^"([\s\S]*)"$/);
        if(mm) return mm[1];
        return x;
      }).join(" ") + "\n");
    });
  };
  rules.filter(r=>r.cond === "BEGIN").forEach(r=>run(r.act, [], ""));
  const code = eachInput(sh, io, files, txt=>{
    lines(txt).forEach(line=>{
      NR++;
      const F = FS ? line.split(FS) : line.trim().split(/\s+/);
      rules.forEach(r=>{
        if(r.cond === "BEGIN" || r.cond === "END") return;
        if(!r.cond){ run(r.act, F, line); return; }
        let mm;
        if((mm = r.cond.match(/^\/([\s\S]*)\/$/))){ if(new RegExp(mm[1]).test(line)) run(r.act, F, line); return; }
        if((mm = r.cond.match(/^\$(\d+)\s*(==|!=|>|<|>=|<=)\s*([\s\S]+)$/))){
          const L = F[+mm[1]-1] === undefined ? "" : F[+mm[1]-1];
          let R = mm[3].trim().replace(/^"|"$/g,"");
          const nl = parseFloat(L), nr = parseFloat(R);
          const num = !Number.isNaN(nl) && !Number.isNaN(nr);
          const ok = ({"==":num?nl===nr:L===R,"!=":num?nl!==nr:L!==R,">":num?nl>nr:L>R,"<":num?nl<nr:L<R,">=":num?nl>=nr:L>=R,"<=":num?nl<=nr:L<=R})[mm[2]];
          if(ok) run(r.act, F, line);
          return;
        }
        if((mm = r.cond.match(/^NR\s*(==|>|<|>=|<=|!=)\s*(\d+)$/))){
          const ok = ({"==":NR===+mm[2],"!=":NR!==+mm[2],">":NR>+mm[2],"<":NR<+mm[2],">=":NR>=+mm[2],"<=":NR<=+mm[2]})[mm[1]];
          if(ok) run(r.act, F, line);
        }
      });
    });
  });
  rules.filter(r=>r.cond === "END").forEach(r=>run(r.act, [], ""));
  return code;
};
CMD.find = (sh, a, io)=>{
  const roots = [];
  let i = 0;
  while(i < a.length && a[i][0] !== "-"){ roots.push(a[i]); i++; }
  if(!roots.length) roots.push(".");
  let name = null, type = null, maxdepth = 99, exec = null;
  for(; i < a.length; i++){
    if(a[i] === "-name"){ name = a[++i]; continue; }
    if(a[i] === "-type"){ type = a[++i]; continue; }
    if(a[i] === "-maxdepth"){ maxdepth = parseInt(a[++i],10); continue; }
    if(a[i] === "-exec"){ exec = []; i++; while(i < a.length && a[i] !== ";" && a[i] !== "\;"){ exec.push(a[i]); i++; } continue; }
  }
  const re = name ? patToRe(name, true) : null;
  const found = [];
  roots.forEach(root=>{
    const rp = normPath(root, sh.cwd);
    if(!exists(sh,rp)){ io.err.write("find: '" + root + "': Нет такого файла или каталога\n"); return; }
    const walk = (p, disp, d)=>{
      const node = sh.fs[p];
      const base = p.split("/").pop() || "/";
      const okT = !type || (type === "f" ? node.t === "f" : node.t === "d");
      const okN = !re || re.test(base);
      if(okT && okN) found.push(disp);
      if(node.t === "d" && d < maxdepth)
        children(sh,p).forEach(n=>walk(normPath(p + "/" + n, sh.cwd), disp === "/" ? "/" + n : disp + "/" + n, d + 1));
    };
    walk(rp, root, 0);
  });
  found.sort();
  if(exec){ found.forEach(fp=>{ const line = exec.map(x=>x === "{}" ? fp : x).join(" ");
    const r = runProgram(sh, line); io.out.write(r.out); io.err.write(r.err); }); return 0; }
  found.forEach(x=>io.out.write(x + "\n"));
  return 0;
};
CMD.xargs = (sh, a, io)=>{
  let repl = null, n = 0, cmd = [];
  for(let i = 0; i < a.length; i++){
    if(a[i] === "-I"){ repl = a[++i]; continue; }
    if(a[i].startsWith("-I") && a[i].length > 2){ repl = a[i].slice(2); continue; }
    if(a[i] === "-n"){ n = parseInt(a[++i],10); continue; }
    if(a[i] === "-0" || a[i] === "-r") continue;
    cmd = a.slice(i); break;
  }
  if(!cmd.length) cmd = ["echo"];
  const items = (io.in.rest().match(/\S+/g) || []);
  const quote = s => /[^\w./@%^,:=+-]/.test(s) ? "'" + s.replace(/'/g,"'\\''") + "'" : s;
  const runLine = line => { const r = runProgram(sh, line); io.out.write(r.out); io.err.write(r.err); return r.code; };
  let code = 0;
  if(repl){ items.forEach(it=>{ code = runLine(cmd.map(c=>c.split(repl).join(quote(it))).join(" ")) || code; }); return code; }
  if(n){ for(let i = 0; i < items.length; i += n) code = runLine(cmd.join(" ") + " " + items.slice(i,i+n).map(quote).join(" ")) || code; return code; }
  if(!items.length) return 0;
  return runLine(cmd.join(" ") + " " + items.map(quote).join(" "));
};
CMD.tee = (sh, a, io)=>{
  const {f, rest} = flags(a);
  const txt = io.in.rest();
  rest.forEach(t=>{
    const p = normPath(t, sh.cwd);
    const prev = f.a && isFile(sh,p) ? readFile(sh,p) : "";
    if(!writeFile(sh, p, prev + txt)) io.err.write("tee: " + t + ": не удалось записать\n");
  });
  io.out.write(txt);
  return 0;
};
CMD.touch = (sh, a, io)=>{ let c = 0; a.forEach(t=>{ const p = normPath(t, sh.cwd);
  if(exists(sh,p)) return; if(!writeFile(sh,p,"")){ io.err.write("touch: не удалось создать " + t + "\n"); c = 1; } }); return c; };
CMD.mkdir = (sh, a, io)=>{
  const {f, rest} = flags(a); let c = 0;
  rest.forEach(t=>{ const p = normPath(t, sh.cwd);
    if(exists(sh,p)){ if(!f.p){ io.err.write("mkdir: невозможно создать каталог «" + t + "»: Файл существует\n"); c = 1; } return; }
    const parent = p.slice(0, p.lastIndexOf("/")) || "/";
    if(!isDir(sh,parent) && !f.p){ io.err.write("mkdir: невозможно создать каталог «" + t + "»: Нет такого файла или каталога\n"); c = 1; return; }
    if(f.p) mkdirp(sh,p); else sh.fs[p] = {t:"d", m:"755"}; });
  return c;
};
CMD.rmdir = (sh, a, io)=>{ let c = 0; a.forEach(t=>{ const p = normPath(t, sh.cwd);
  if(!isDir(sh,p)){ io.err.write("rmdir: " + t + ": Нет такого каталога\n"); c = 1; return; }
  if(children(sh,p).length){ io.err.write("rmdir: " + t + ": Каталог не пуст\n"); c = 1; return; } delete sh.fs[p]; }); return c; };
CMD.rm = (sh, a, io)=>{
  const {f, rest} = flags(a); let c = 0;
  rest.forEach(t=>{
    const p = normPath(t, sh.cwd);
    if(!exists(sh,p)){ if(!f.f){ io.err.write("rm: невозможно удалить «" + t + "»: Нет такого файла или каталога\n"); c = 1; } return; }
    if(isDir(sh,p) && !(f.r || f.R)){ io.err.write("rm: невозможно удалить «" + t + "»: Это каталог\n"); c = 1; return; }
    rmPath(sh,p);
  });
  return c;
};
CMD.cp = (sh, a, io)=>{
  const {f, rest} = flags(a);
  if(rest.length < 2){ io.err.write("cp: пропущен операнд\n"); return 1; }
  const dst = rest.pop(); const dp = normPath(dst, sh.cwd); let c = 0;
  rest.forEach(src=>{
    const sp = normPath(src, sh.cwd);
    if(!exists(sh,sp)){ io.err.write("cp: " + src + ": Нет такого файла или каталога\n"); c = 1; return; }
    if(isDir(sh,sp) && !(f.r || f.R)){ io.err.write("cp: -r не указан; пропускается каталог «" + src + "»\n"); c = 1; return; }
    const target = isDir(sh,dp) ? normPath(dp + "/" + sp.split("/").pop(), sh.cwd) : dp;
    copyPath(sh, sp, target);
  });
  return c;
};
CMD.mv = (sh, a, io)=>{
  const {f, rest} = flags(a);
  if(rest.length < 2){ io.err.write("mv: пропущен операнд\n"); return 1; }
  const dst = rest.pop(); const dp = normPath(dst, sh.cwd); let c = 0;
  rest.forEach(src=>{
    const sp = normPath(src, sh.cwd);
    if(!exists(sh,sp)){ io.err.write("mv: " + src + ": Нет такого файла или каталога\n"); c = 1; return; }
    const target = isDir(sh,dp) ? normPath(dp + "/" + sp.split("/").pop(), sh.cwd) : dp;
    movePath(sh, sp, target);
  });
  return c;
};
CMD.chmod = (sh, a, io)=>{
  const {f, rest} = flags(a);
  const mode = rest[0]; let c = 0;
  rest.slice(1).forEach(t=>{
    const p = normPath(t, sh.cwd);
    if(!exists(sh,p)){ io.err.write("chmod: " + t + ": Нет такого файла\n"); c = 1; return; }
    if(/^\d{3}$/.test(mode)) sh.fs[p].m = mode;
    else if(/^[ugoa]*\+x$/.test(mode)) sh.fs[p].m = String(+sh.fs[p].m[0] | 1) + sh.fs[p].m.slice(1);
    else if(/^[ugoa]*-x$/.test(mode)) sh.fs[p].m = String(+sh.fs[p].m[0] & ~1) + sh.fs[p].m.slice(1);
    else { io.err.write("chmod: неверный режим: " + mode + "\n"); c = 1; }
  });
  return c;
};
CMD.stat = (sh, a, io)=>{ let c = 0; a.forEach(t=>{ const p = normPath(t, sh.cwd);
  if(!exists(sh,p)){ io.err.write("stat: " + t + ": Нет такого файла\n"); c = 1; return; }
  const n = sh.fs[p];
  io.out.write("  Файл: " + t + "\n  Размер: " + (n.t === "d" ? 4096 : n.c.length) +
    "\tТип: " + (n.t === "d" ? "каталог" : "обычный файл") + "\n  Доступ: (0" + n.m + "/" +
    (n.t === "d" ? "d" : "-") + modeStr(n.m) + ")\n"); }); return c; };
CMD.basename = (sh, a, io)=>{ let b = (a[0]||"").replace(/\/+$/,"").split("/").pop();
  if(a[1] && b.endsWith(a[1])) b = b.slice(0, -a[1].length); io.out.write(b + "\n"); return 0; };
CMD.dirname = (sh, a, io)=>{ const p = (a[0]||"").replace(/\/+$/,""); const i = p.lastIndexOf("/");
  io.out.write((i > 0 ? p.slice(0,i) : i === 0 ? "/" : ".") + "\n"); return 0; };
CMD.seq = (sh, a, io)=>{
  let from = 1, step = 1, to;
  if(a.length === 1) to = +a[0];
  else if(a.length === 2){ from = +a[0]; to = +a[1]; }
  else { from = +a[0]; step = +a[1]; to = +a[2]; }
  if(!step) return 1;
  for(let v = from; step > 0 ? v <= to : v >= to; v += step) io.out.write(v + "\n");
  return 0;
};
CMD.rev = (sh, a, io)=> eachInput(sh, io, a, txt=>lines(txt).forEach(l=>io.out.write([...l].reverse().join("") + "\n")));
CMD.nl = (sh, a, io)=>{ let n = 0; return eachInput(sh, io, a, txt=>lines(txt).forEach(l=>io.out.write(String(++n).padStart(6) + "\t" + l + "\n"))); };
CMD.whoami = (sh,a,io)=>{ io.out.write(sh.env.USER + "\n"); return 0; };
CMD.id = (sh,a,io)=>{ io.out.write("uid=1000(" + sh.env.USER + ") gid=1000(" + sh.env.USER + ") groups=1000(" + sh.env.USER + ")\n"); return 0; };
CMD.hostname = (sh,a,io)=>{ io.out.write(sh.env.HOSTNAME + "\n"); return 0; };
CMD.env = (sh,a,io)=>{ Object.keys(sh.env).sort().forEach(k=>io.out.write(k + "=" + sh.env[k] + "\n")); return 0; };
CMD.printenv = CMD.env;
CMD.date = (sh,a,io)=>{ io.out.write("Ср авг 19 12:00:00 UTC 2026\n"); return 0; };
CMD.sleep = ()=>0;
CMD.clear = ()=>0;
CMD.which = (sh,a,io)=>{ let c = 0; a.forEach(x=>{ if(CMD[x]) io.out.write("/usr/bin/" + x + "\n");
  else if(BUILTIN[x]) io.out.write(x + ": встроенная команда оболочки\n"); else c = 1; }); return c; };
CMD.file = (sh,a,io)=>{ let c = 0; a.forEach(t=>{ const p = normPath(t, sh.cwd);
  if(!exists(sh,p)){ io.err.write("file: " + t + ": Нет такого файла\n"); c = 1; return; }
  io.out.write(t + ": " + (isDir(sh,p) ? "directory" : (readFile(sh,p).startsWith("#!") ? "shell script, ASCII text executable" : "ASCII text")) + "\n"); }); return c; };
CMD.tree = (sh, a, io)=>{
  const root = normPath(a[0] || ".", sh.cwd);
  if(!isDir(sh,root)){ io.err.write("tree: " + (a[0]||".") + ": Не каталог\n"); return 1; }
  io.out.write((a[0] || ".") + "\n");
  let dirs = 0, files = 0;
  const walk = (p, pre)=>{
    const ns = children(sh,p).filter(n=>!n.startsWith("."));
    ns.forEach((n,i)=>{
      const last = i === ns.length - 1;
      const full = normPath(p + "/" + n, sh.cwd);
      io.out.write(pre + (last ? "└── " : "├── ") + n + "\n");
      if(isDir(sh,full)){ dirs++; walk(full, pre + (last ? "    " : "│   ")); } else files++;
    });
  };
  walk(root, "");
  io.out.write("\n" + dirs + " каталогов, " + files + " файлов\n");
  return 0;
};
CMD.man = (sh, a, io)=>{
  const t = a[0];
  const H = {
    ls:"ls [-l -a -1 -r] [ПУТЬ…] — список содержимого каталога",
    grep:"grep [-i -v -n -c -r -w -o] ОБРАЗЕЦ [ФАЙЛ…] — строки, подходящие под образец",
    sort:"sort [-n -r -u] [-k N] [-t СИМВОЛ] [ФАЙЛ…] — сортировка строк",
    cut:"cut -d СИМВОЛ -f СПИСОК [ФАЙЛ…] — выбор полей из строки",
    sed:"sed [-n] 's/что/на что/g' [ФАЙЛ…] — потоковая замена и удаление строк",
    awk:"awk [-F РАЗД] 'условие { print $1 }' [ФАЙЛ…] — обработка по полям",
    find:"find ПУТЬ [-name ОБРАЗЕЦ] [-type f|d] [-maxdepth N] — поиск файлов",
    test:"test ВЫРАЖЕНИЕ или [ ВЫРАЖЕНИЕ ] — проверка условий, код возврата 0 = истина"
  };
  if(!t){ io.out.write("Доступные команды:\n  " + Object.keys(CMD).concat(Object.keys(BUILTIN)).sort().join("  ") + "\n"); return 0; }
  io.out.write((H[t] || (CMD[t] || BUILTIN[t] ? t + " — команда доступна в этом эмуляторе" : "нет справки по «" + t + "»")) + "\n");
  return H[t] || CMD[t] || BUILTIN[t] ? 0 : 1;
};
