#!/bin/bash
cd "$(dirname "$0")"
cat 30_yaml.js 31_expr.js 32_runner.js 33_engine.js 34_cli.js 35_disp.js _t.js | sed 's|^<script>$||; s|^</script>$||' > /tmp/_ci_t.js
node /tmp/_ci_t.js
