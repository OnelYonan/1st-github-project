#!/usr/bin/env bash
# Runs every Business Hub test. Needs Node + Playwright and Python 3.
#   bash tests/run-all.sh
set -u
cd "$(dirname "$0")/.."
python3 -m http.server 8765 >/dev/null 2>&1 & WEB=$!
node tests/mock-pay-server.mjs >/dev/null 2>&1 & PAY=$!
trap 'kill $WEB $PAY 2>/dev/null' EXIT
sleep 1
fail=0
for t in smoke stripe commission photos safety connect iphone-audit; do
  echo "── $t"
  out=$(node "tests/$t.js" 2>&1); code=$?
  echo "$out" | grep -E "FAIL|✗|Error|passed|off-screen" | tail -6
  [ $code -ne 0 ] && fail=1
  [ "$t" = iphone-audit ] && ! echo "$out" | grep -q "^0 of" && fail=1
done
[ $fail -eq 0 ] && echo "ALL TESTS PASSED" || { echo "SOME TESTS FAILED"; exit 1; }
