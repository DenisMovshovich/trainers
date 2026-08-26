#!/bin/bash
cd "$(dirname "$0")"
cat 30_obj.js 31_diff.js 32_cmd.js 33_hist.js 34_remote.js 35_run.js 36_more.js _t.js | sed 's|^<script>$||; s|^</script>$||' > /tmp/_git_t.js
node /tmp/_git_t.js
