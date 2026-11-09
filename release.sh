#!/bin/sh
set -e
git checkout main
git pull
npm i && npm run format && npm test
git add . && git commit -m "autoformat" || true
npm version "$1"
git push origin "v$1"
git push
echo "done."
