#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Cần Node.js 24 LTS để chạy Touchline."
  read -k 1 "?Nhấn phím bất kỳ để đóng."
  exit 1
fi
if curl -fsS http://127.0.0.1:4179/api/health >/dev/null 2>&1; then
  open http://127.0.0.1:4179
else
  if [[ ! -f dist/index.html ]]; then
    npm install || exit 1
    npm run build || exit 1
  fi
  (sleep 1; open http://127.0.0.1:4179) &
  node server.mjs
fi
