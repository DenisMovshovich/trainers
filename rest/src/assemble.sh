#!/bin/sh
set -e
cd "$(dirname "$0")"
cat 10_head.html 20_body.html 30_server.js 40_client.js \
    50_content_a.js 51_content_b.js 52_content_c.js 60_app.js > ../rest.html
python3 - <<'PY'
src=open("../rest.html",encoding="utf-8").read()
i=src.index("</style>")+len("</style>")
out=('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
     '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
     '<meta name="description" content="Интерактивный тренажёр по REST: теория, тесты и практика на эмуляторе HTTP-сервера.">\n'
     + src[:i] + '\n</head>\n<body>' + src[i:] + '\n</body>\n</html>\n')
open("../rest-offline.html","w",encoding="utf-8").write(out)
PY
echo "артефакт:  $(wc -c < ../rest.html) байт"
echo "автономно: $(wc -c < ../rest-offline.html) байт"
