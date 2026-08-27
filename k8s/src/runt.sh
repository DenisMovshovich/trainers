#!/bin/bash
cd "$(dirname "$0")"
cat 30_yaml.js 31_model.js 32_ctrl.js 33_kubectl.js 34_ops.js 35_run.js _t.js | sed 's|^<script>$||; s|^</script>$||' > /tmp/_k8s_t.js
node /tmp/_k8s_t.js
