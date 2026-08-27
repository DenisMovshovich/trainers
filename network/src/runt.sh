#!/bin/bash
cd "$(dirname "$0")"
cat 30_net.js 31_http.js 32_curl.js 33_tools.js 35_extra.js 34_run.js _t.js | sed 's|^<script>$||; s|^</script>$||' > /tmp/_net_t.js
node /tmp/_net_t.js
