#!/bin/bash
cd "$(dirname "$0")"
cat 30_lex.js 31_parse.js 32_val.js 33_eval.js 34_run.js _t.js | sed 's|^<script>$||; s|^</script>$||' > /tmp/_cs_t.js
node /tmp/_cs_t.js
