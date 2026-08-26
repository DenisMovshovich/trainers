#!/bin/sh
# Полная проверка без браузера: движок оболочки, решения заданий, негативный контроль.
set -e
cd "$(dirname "$0")"
sed '1d' 30_fs.js > /tmp/_fs.js
E="/tmp/_fs.js 31_lex.js 32_exec.js 33_run.js 34_cmds.js 35_utils.js"
C="40_content_a.js 41_content_b.js 42_content_c.js 43_content_d.js"
echo "── движок оболочки: основы"
cat $E shell-tests-1.js > /tmp/_a.js && node /tmp/_a.js | tail -2
echo "── движок оболочки: ловушки и надёжность"
cat $E shell-tests-2.js > /tmp/_b.js && node /tmp/_b.js | tail -2
echo "── решения всех заданий"
cat $E $C sol.js check.js > /tmp/_c.js && node /tmp/_c.js | tail -2
echo "── негативный контроль и целостность"
cat $E $C neg.js > /tmp/_d.js && node /tmp/_d.js | tail -3
