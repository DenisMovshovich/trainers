#!/bin/sh
set -e
cd "$(dirname "$0")"
cat 10_head.html 20_body.html 30_fs.js 31_lex.js 32_exec.js 33_run.js 34_cmds.js 35_utils.js \
    40_content_a.js 41_content_b.js 42_content_c.js 43_content_d.js 50_app.js ../../tools/ui/90_ui.js > ../bash.html
python3 - <<'PY'
src=open("../bash.html",encoding="utf-8").read()
i=src.index("</style>")+len("</style>")
out=('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
     '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
     '<meta name="description" content="Интерактивный тренажёр по bash: теория, тесты и практика в настоящей оболочке.">\n'
     + src[:i] + '\n</head>\n<body>' + src[i:] + '\n</body>\n</html>\n')
open("../bash-offline.html","w",encoding="utf-8").write(out)
PY
echo "артефакт:  $(wc -c < ../bash.html) байт"
echo "автономно: $(wc -c < ../bash-offline.html) байт"
