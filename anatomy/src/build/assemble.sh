#!/bin/sh
set -e
cd "$(dirname "$0")"
{ cat 10_head.html 20_body.html; echo '<script>'; echo '"use strict";';
  cat 30_model.js 40_notes.js 50_decode.js 60_views.js 70_app.js; } > ../../anatomy.html
python3 - <<'PY'
src=open("../../anatomy.html",encoding="utf-8").read()
i=src.index("</style>")+len("</style>")
out=('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
     '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
     '<meta name="description" content="Разбор набора UI-автотестов на C# и Playwright: каждый файл, класс, свойство и метод.">\n'
     + src[:i] + '\n</head>\n<body>' + src[i:] + '\n</body>\n</html>\n')
open("../../anatomy-offline.html","w",encoding="utf-8").write(out)
PY
echo "артефакт:  $(wc -c < ../../anatomy.html) байт"
echo "автономно: $(wc -c < ../../anatomy-offline.html) байт"
