#!/bin/sh
# Пересобрать конспект из частей.
#   ../dotnet.html          — исходник для публикации артефактом
#                                      (без doctype/head/body — их добавляет публикация;
#                                       путь менять нельзя, иначе артефакт получит новый URL)
#   ../dotnet-offline.html  — автономный документ для локального открытия
set -e
cd "$(dirname "$0")"

cat 10_head.html 20_body.html 30_data_a.js 31_data_b.js 32_data_c.js 33_data_d.js \
    34_data_e.js 35_data_f.js 36_data_g.js 37_data_iv.js 40_app.js 45_widgets.js 50_ui.js \
  > ../dotnet.html

python3 - <<'PY'
src = open("../dotnet.html", encoding="utf-8").read()
i = src.index("</style>") + len("</style>")
out = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
       '<meta name="description" content="Интерактивный конспект по работе с .NET-проектами на примере Acme.WebAutomation.">\n'
       + src[:i] + '\n</head>\n<body>' + src[i:] + '\n</body>\n</html>\n')
open("../dotnet-offline.html", "w", encoding="utf-8").write(out)
PY

echo "артефакт:  $(wc -c < ../dotnet.html) байт"
echo "автономно: $(wc -c < ../dotnet-offline.html) байт"
