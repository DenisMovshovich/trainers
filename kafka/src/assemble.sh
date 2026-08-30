#!/bin/bash
# Собирает kafka.html (исходник артефакта) и kafka-offline.html (автономная копия)
set -e
cd "$(dirname "$0")"
OUT=../kafka.html
OFF=../kafka-offline.html
{
  cat 10_head.html
  cat 20_body.html
  cat 30_cluster.js            # начинается с <script>
  echo
  cat 31_admin.js 32_client.js 33_cli.js
  echo
  cat 40_content_a.js 41_content_b.js 42_content_c.js 43_content_d.js
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
