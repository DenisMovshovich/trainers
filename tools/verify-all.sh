#!/bin/bash
# Прогоняет проверки всех материалов подряд и печатает сводку.
#
# Браузерные проверки требуют playwright-core:
#   npm i -D playwright-core && npx playwright install chromium
# Пути не зашиты — при необходимости переопределите:
#   PLAYWRIGHT_CORE=/путь/к/playwright-core/index.mjs
#   CHROMIUM_PATH=/путь/к/chrome-headless-shell
set -u
cd "$(dirname "$0")/.."
fail=0

for d in docker rest bash sql kafka testing csharp git dotnet anatomy; do
  [ -d "$d" ] || continue
  printf "\n\033[1m═══ %s\033[0m\n" "$d"
  ran=0
  if [ -f "$d/src/verify.sh" ]; then
    sh "$d/src/verify.sh" 2>&1 | sed 's/^/  /' || fail=1
    ran=1
  else
    # нет общего сценария — прогоняем то, что есть
    [ -f "$d/src/runt.sh" ]     && { sh "$d/src/runt.sh"    2>&1 | tail -2 | sed 's/^/  /'; ran=1; }
    [ -f "$d/src/check.js" ]    && { node "$d/src/check.js" 2>&1 | head -3 | sed 's/^/  /'; ran=1; }
    for s in "$d/src/assemble.sh" "$d/src/build.sh" "$d/src/build/assemble.sh"; do
      [ -f "$s" ] && { ( cd "$(dirname "$s")" && sh "$(basename "$s")" ) | sed 's/^/  /'; ran=1; break; }
    done
    [ -f "$d/src/browser.mjs" ] && { node "$d/src/browser.mjs" 2>&1 | tail -2 | sed 's/^/  /' || fail=1; ran=1; }
  fi
  [ "$ran" = 0 ] && echo "  проверок нет"
done

printf "\n\033[1m═══ сайт\033[0m\n"
./tools/build-site.sh | sed 's/^/  /' || fail=1

printf "\n%s\n" "$([ $fail = 0 ] && echo 'ИТОГ: всё прошло' || echo 'ИТОГ: были ошибки — см. выше')"
exit $fail
