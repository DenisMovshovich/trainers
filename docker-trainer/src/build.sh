#!/bin/sh
# Пересобрать тренажёр из частей.
#   ../docker-yard.html          — исходник для публикации артефактом (без doctype/head/body,
#                                  их добавляет публикация; этот путь менять нельзя,
#                                  иначе артефакт получит новый URL)
#   ../docker-yard-offline.html  — автономный документ для локального открытия в браузере
set -e
cd "$(dirname "$0")"

cat 10_head.html 20_body.html 30_engine.js 31_engine2.js 32_engine3.js \
    33_engine4.js 40_viz.js 50_content_a.js 51_content_b.js 52_content_c.js 60_app.js \
    > ../docker-yard.html

python3 - <<'PY'
src = open("../docker-yard.html", encoding="utf-8").read()
i = src.index("</style>") + len("</style>")
out = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
       '<meta name="description" content="Интерактивный тренажёр Docker: теория, тесты и практика в эмуляторе движка.">\n'
       + src[:i] + '\n</head>\n<body>' + src[i:] + '\n</body>\n</html>\n')
open("../docker-yard-offline.html", "w", encoding="utf-8").write(out)
PY

echo "артефакт:  $(wc -c < ../docker-yard.html) байт"
echo "автономно: $(wc -c < ../docker-yard-offline.html) байт"
