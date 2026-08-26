#!/bin/sh
# Полная проверка без браузера: сервер, решения заданий, негативный контроль, целостность.
set -e
cd "$(dirname "$0")"
sed '1d' 30_server.js > /tmp/_srv.js
echo "── тесты эмулятора сервера"
cat /tmp/_srv.js server-tests.js > /tmp/_a.js 2>/dev/null || true
sed 's|eval(fs.readFileSync("_srv.js","utf8").replace(/^"use strict";/,""));||' server-tests.js > /tmp/_st.js
cat /tmp/_srv.js /tmp/_st.js > /tmp/_a.js && node /tmp/_a.js | tail -2
echo
echo "── решения всех заданий"
cat /tmp/_srv.js 40_client.js 50_content_a.js 51_content_b.js 52_content_c.js sol.js check.js > /tmp/_b.js
node /tmp/_b.js | tail -3
echo
echo "── негативный контроль и целостность"
cat /tmp/_srv.js 40_client.js 50_content_a.js 51_content_b.js 52_content_c.js neg.js > /tmp/_c.js
node /tmp/_c.js | tail -4
