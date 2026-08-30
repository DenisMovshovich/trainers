#!/bin/bash
# Собирает k8s.html (исходник артефакта) и k8s-offline.html (автономная копия)
set -e
cd "$(dirname "$0")"
OUT=../k8s.html
OFF=../k8s-offline.html

{
  cat 10_head.html
  cat 20_body.html
  cat 30_yaml.js            # начинается с <script>
  echo
  cat 31_model.js 32_ctrl.js 33_kubectl.js 34_ops.js 35_run.js
  echo
  cat 40_content_a.js 41_content_b.js 42_content_c.js 43_content_d.js 44_content_e.js
  echo
  cat 50_app.js             # заканчивается </script>
  cat ../../tools/ui/90_ui.js   # общий слой интерфейса
} > "$OUT"

{
  echo '<!doctype html>'
  echo '<html lang="ru">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1">'
  sed -n '1,/<\/style>/p' "$OUT"
  echo '</head>'
  echo '<body>'
  sed '1,/<\/style>/d' "$OUT"
  echo '</body>'
  echo '</html>'
} > "$OFF"

echo "собрано: $(wc -c < "$OUT") байт (артефакт), $(wc -c < "$OFF") байт (офлайн)"
