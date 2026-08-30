#!/bin/bash
set -e
cd "$(dirname "$0")"
OUT=../testing.html
OFF=../testing-offline.html
{
  cat 10_head.html
  cat 20_body.html
  cat 30_lib.js            # начинается с <script>
  echo
  cat 31_glossary.js
  echo
  cat 40_content_a.js 41_content_b.js 42_content_c.js 43_content_d.js 44_content_e.js
  echo '</script>'
  cat 50_app.js
  cat ../../tools/ui/90_ui.js
} > "$OUT"
{
  echo '<!doctype html>'; echo '<html lang="ru">'; echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1">'
  sed -n '1,/<\/style>/p' "$OUT"
  echo '</head>'; echo '<body>'
  sed '1,/<\/style>/d' "$OUT"
  echo '</body>'; echo '</html>'
} > "$OFF"
echo "собрано: $(wc -c < "$OUT") байт (артефакт), $(wc -c < "$OFF") байт (офлайн)"
