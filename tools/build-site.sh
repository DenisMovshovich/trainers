#!/bin/bash
# Собирает статический сайт docs/ из исходников каждого материала.
#
# Каталог docs/ — результат сборки, он не хранится в git: источник истины
# лежит в <материал>/src/. Поэтому дубликатов в истории не появляется,
# а рассинхрон между сайтом и исходниками невозможен в принципе.
#
#   ./tools/build-site.sh          пересобрать материалы и сайт
#   ./tools/build-site.sh --fast   только сайт, материалы не пересобирать
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
FAST=""; [ "$1" = "--fast" ] && FAST=1

# слаг → папка материала → имя автономного файла
MAP="
docker|docker|docker-offline.html
rest|rest|rest-offline.html
bash|bash|bash-offline.html
sql|sql|sql-offline.html
kafka|kafka|kafka-offline.html
testing|testing|testing-offline.html
dotnet|dotnet|dotnet-offline.html
anatomy|anatomy|anatomy-offline.html
"

rm -rf docs
mkdir -p docs
touch docs/.nojekyll          # иначе GitHub Pages прогоняет всё через Jekyll
cp site/index.html docs/index.html

echo "$MAP" | while IFS='|' read -r slug dir file; do
  [ -z "$slug" ] && continue
  if [ -z "$FAST" ]; then
    # пересобрать материал из его частей
    for s in "$dir/src/assemble.sh" "$dir/src/build.sh" "$dir/src/build/assemble.sh"; do
      if [ -x "$s" ] || [ -f "$s" ]; then
        ( cd "$(dirname "$s")" && sh "$(basename "$s")" >/dev/null )
        break
      fi
    done
  fi
  if [ ! -f "$dir/$file" ]; then
    echo "  ПРОПУЩЕН $slug — нет $dir/$file" >&2
    continue
  fi
  mkdir -p "docs/$slug"
  cp "$dir/$file" "docs/$slug/index.html"
  printf "  /%-10s ← %s\n" "$slug/" "$dir/$file"
done

echo
echo "сайт собран: $(find docs -name index.html | wc -l | tr -d ' ') страниц, $(du -sh docs | cut -f1)"
