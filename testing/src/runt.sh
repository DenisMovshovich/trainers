#!/bin/bash
cd "$(dirname "$0")"
cat 30_lib.js 31_glossary.js _t.js | sed 's|^<script>$||; s|^</script>$||' > /tmp/_qa_t.js
node /tmp/_qa_t.js
