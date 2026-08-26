#!/bin/bash
# Собирает grossbuh.html (исходник артефакта) и grossbuh-offline.html (автономная копия)
set -e
cd "$(dirname "$0")"
OUT=../sql.html
OFF=../sql-offline.html

{
  cat 10_head.html
  cat 20_body.html
  cat 30_db.js            # начинается с <script>
  echo
  cat 31_parse.js 32_exec.js 33_run.js
  echo
  cat 40_content_a.js 41_content_b.js 42_content_c.js 43_content_d.js
  echo '</script>'
  cat 50_app.js
} > "$OUT"

{
  echo '<!doctype html>'
  echo '<html lang="ru">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1">'
  cat "$OUT" | sed -n '1,/<\/style>/p'
  echo '</head>'
  echo '<body>'
  cat "$OUT" | sed '1,/<\/style>/d'
  echo '</body>'
  echo '</html>'
} > "$OFF"

echo "собрано: $(wc -c < "$OUT") байт (артефакт), $(wc -c < "$OFF") байт (офлайн)"
