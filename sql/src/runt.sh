#!/bin/bash
cd "$(dirname "$0")"
cat 30_db.js 31_parse.js 32_exec.js 33_run.js _t.js | sed 's|^<script>$||; s|^</script>$||' > /tmp/_eng_t.js
node /tmp/_eng_t.js
