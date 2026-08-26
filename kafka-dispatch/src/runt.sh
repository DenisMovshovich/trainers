#!/bin/bash
cd "$(dirname "$0")"
cat 30_cluster.js 31_admin.js 32_client.js 33_cli.js _t.js | sed 's|^<script>$||; s|^</script>$||' > /tmp/_kaf_t.js
node /tmp/_kaf_t.js
