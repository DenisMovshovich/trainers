import json, os, re, sys

ROOT = os.environ.get("REPO_PATH", sys.argv[1] if len(sys.argv) > 1 else ".")
SKIP = (".playwright-mcp", "obj", "bin")

def files():
    out = []
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP]
        for fn in fns:
            if fn == ".DS_Store": continue
            p = os.path.join(dp, fn)
            out.append(os.path.relpath(p, ROOT))
    return sorted(out)

MOD = r"(?:public|internal|private|protected|static|readonly|const|override|virtual|abstract|sealed|async|partial|new)"

def lead_comment(lines, i):
    """Собирает блок // комментариев непосредственно над строкой i."""
    buf = []
    j = i - 1
    while j >= 0:
        s = lines[j].strip()
        if s.startswith("//"):
            buf.append(s[2:].strip()); j -= 1
        elif s == "" and buf:
            break
        elif s == "":
            j -= 1
            if buf: break
        else:
            break
    return " ".join(reversed(buf))

def attrs_above(lines, i):
    """Собирает атрибуты [X] над строкой i."""
    out = []
    j = i - 1
    while j >= 0:
        s = lines[j].strip()
        if s.startswith("[") and s.endswith("]"):
            out.append(s); j -= 1
        elif s.startswith("//") or s == "":
            j -= 1
        else:
            break
    return list(reversed(out))

def logical(lines):
    """Склеивает физические строки в логические: продолжения по незакрытым скобкам и по хвостовому =>."""
    out, buf, start, depth = [], "", 0, 0
    for i, raw in enumerate(lines):
        s = raw.strip()
        if not buf:
            start = i
            if s.startswith("//") or s.startswith("[") or s == "":
                out.append((i, raw)); continue
        buf = (buf + " " + s).strip() if buf else s
        depth += buf.count("(") - buf.count(")") if not out or True else 0
        depth = buf.count("(") - buf.count(")")
        nxt = lines[i+1].strip() if i + 1 < len(lines) else ""
        if depth > 0 or buf.endswith("=>") or buf.endswith(",") or buf.endswith("&&") or buf.endswith("||") \
           or nxt.startswith("=>"):
            continue
        out.append((start, buf)); buf = ""
    if buf: out.append((start, buf))
    return out

def parse_cs(path, text):
    raw_lines = text.split("\n")
    pairs = logical(raw_lines)
    lines = [p[1] for p in pairs]
    origin = [p[0] for p in pairs]
    res = {"usings": [], "namespace": None, "classes": []}
    for ln in lines:
        m = re.match(r"\s*using\s+(static\s+)?([\w.]+)\s*;", ln)
        if m: res["usings"].append(m.group(2))
        m = re.match(r"\s*namespace\s+([\w.]+)\s*;?", ln)
        if m and not res["namespace"]: res["namespace"] = m.group(1)

    cur = None
    depth = 0
    for i, ln in enumerate(lines):
        opened = ln.count("{") - ln.count("}")
        m = re.match(r"\s*((?:%s\s+)*)(class|record|struct|interface)\s+(\w+)\s*(?::\s*([\w<>,.\s]+))?" % MOD, ln)
        if m:
            cur = {"name": m.group(3), "kind": m.group(2),
                   "mods": m.group(1).split(),
                   "base": (m.group(4) or "").strip().rstrip("{").strip() or None,
                   "attrs": attrs_above(lines, i), "doc": lead_comment(lines, i),
                   "line": origin[i] + 1, "members": []}
            cur["bodyDepth"] = depth + 1
            res["classes"].append(cur)
            depth += opened
            continue
        if cur is None:
            depth += opened
            continue

        s = ln.strip()
        if not s or s.startswith("//") or s.startswith("["):
            depth += opened
            continue

        # члены класса объявляются только на глубине тела класса; всё глубже — локальные переменные
        at_class_level = (depth == cur["bodyDepth"])
        if not at_class_level:
            depth += opened
            continue

        # свойство с телом-выражением:  public ILocator X => ...;
        m = re.match(r"((?:%s\s+)*)([\w<>\[\],.?]+)\s+(\w+)\s*(\([^)]*\))?\s*=>\s*(.+?);?\s*$" % MOD, s)
        if m and "=>" in s and not s.startswith("await"):
            mods = m.group(1).split()
            if mods:
                cur["members"].append({
                    "kind": "method" if m.group(4) else "prop",
                    "mods": mods, "type": m.group(2), "name": m.group(3),
                    "params": (m.group(4) or "").strip("()"),
                    "body": m.group(5).strip().rstrip(";"),
                    "attrs": attrs_above(lines, i), "doc": lead_comment(lines, i), "line": origin[i] + 1})
                depth += opened
                continue

        # обычное свойство:  public X Y { get; }
        m = re.match(r"((?:%s\s+)*)([\w<>\[\],.?]+)\s+(\w+)\s*\{\s*get" % MOD, s)
        if m and m.group(1).split():
            cur["members"].append({"kind": "prop", "mods": m.group(1).split(), "type": m.group(2),
                                   "name": m.group(3), "params": "", "body": "{ get; }",
                                   "attrs": attrs_above(lines, i), "doc": lead_comment(lines, i), "line": origin[i] + 1})
            depth += opened
            continue

        # метод с блоком:  public async Task X(...)
        m = re.match(r"((?:%s\s+)*)([\w<>\[\],.?]+)\s+(\w+)\s*\(([^)]*)\)\s*$" % MOD, s)
        if m and m.group(1).split():
            cur["members"].append({"kind": "method", "mods": m.group(1).split(), "type": m.group(2),
                                   "name": m.group(3), "params": m.group(4), "body": "{ … }",
                                   "attrs": attrs_above(lines, i), "doc": lead_comment(lines, i), "line": origin[i] + 1})
            depth += opened
            continue

        # конструктор
        m = re.match(r"((?:%s\s+)*)(%s)\s*\(([^)]*)\)\s*(?::\s*base\(([^)]*)\))?" % (MOD, cur["name"]), s)
        if m and m.group(1).split():
            cur["members"].append({"kind": "ctor", "mods": m.group(1).split(), "type": "", "name": cur["name"],
                                   "params": m.group(3), "body": ("base(" + m.group(4) + ")") if m.group(4) else "{ … }",
                                   "attrs": [], "doc": lead_comment(lines, i), "line": origin[i] + 1})
            depth += opened
            continue

        # поле:  private const int X = 1;   private HomePage _p = null!;
        m = re.match(r"((?:%s\s+)*)([\w<>\[\],.?]+)\s+(_?\w+)\s*=\s*(.+?);\s*$" % MOD, s)
        if m and m.group(1).split() and "(" not in m.group(3):
            cur["members"].append({"kind": "field", "mods": m.group(1).split(), "type": m.group(2),
                                   "name": m.group(3), "params": "", "body": m.group(4),
                                   "attrs": attrs_above(lines, i), "doc": lead_comment(lines, i), "line": origin[i] + 1})
            depth += opened
            continue
        m = re.match(r"((?:%s\s+)*)([\w<>\[\],.?]+)\s+(_?\w+)\s*;\s*$" % MOD, s)
        if m and m.group(1).split():
            cur["members"].append({"kind": "field", "mods": m.group(1).split(), "type": m.group(2),
                                   "name": m.group(3), "params": "", "body": "",
                                   "attrs": attrs_above(lines, i), "doc": lead_comment(lines, i), "line": origin[i] + 1})
            depth += opened
            continue
        depth += opened
    return res

out = {}
for rel in files():
    p = os.path.join(ROOT, rel)
    try:
        text = open(p, encoding="utf-8").read()
    except UnicodeDecodeError:
        text = open(p, encoding="utf-8", errors="replace").read()
    e = {"path": rel, "lines": text.count("\n") + 1, "bytes": len(text.encode("utf-8"))}
    if rel.endswith(".cs"):
        e.update(parse_cs(rel, text))
        e["tests"] = len(re.findall(r"^\s*\[Test\]", text, re.M))
        e["testcases"] = len(re.findall(r"^\s*\[TestCase", text, re.M))
        e["retries"] = len(re.findall(r"\[Retry\(", text))
        e["xray"] = re.findall(r'\[Property\("XrayTest",\s*"([^"]+)"\)\]', text)
        e["pages_used"] = sorted(set(re.findall(r"new (?:Pages\.)?(\w+Page)\(", text)))
    out[rel] = e

print(json.dumps(out, ensure_ascii=False))
