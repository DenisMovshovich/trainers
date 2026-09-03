#!/bin/bash
cd "$(dirname "$0")"
cat 30_fs.js 31_sys.js 32_sh.js 33_core.js 34_text.js 35_admin.js 36_net.js 37_run.js _t.js \
  | sed 's|^<script>$||; s|^</script>$||' > /tmp/_ubuntu_t.js
node /tmp/_ubuntu_t.js
