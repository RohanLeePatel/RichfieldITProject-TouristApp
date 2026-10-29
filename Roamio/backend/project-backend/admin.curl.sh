#!/usr/bin/env bash
# Usage: EMAIL=you@example.com PASSWORD=secret ./admin.curl.sh   (or TOKEN=<jwt> ./admin.curl.sh)
BASE=${BASE:-http://localhost:3000}

if [ -z "$TOKEN" ]; then
  TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log(j.accessToken||j.token||j.data?.accessToken||"")})')
fi
[ -z "$TOKEN" ] && { echo "No token: check EMAIL/PASSWORD or pass TOKEN" >&2; exit 1; }

for path in config/tracking health/services analytics/overview; do
  echo "== GET /api/admin/$path"
  curl -s -w '\nHTTP %{http_code}\n' "$BASE/api/admin/$path" -H "Authorization: Bearer $TOKEN"
done
echo "== no token (expect 401)"
curl -s -w '\nHTTP %{http_code}\n' "$BASE/api/admin/health/services"
