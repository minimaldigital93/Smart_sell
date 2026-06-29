#!/usr/bin/env bash
#
# Smart_sell deploy script (run on the Mac mini, NOT on smart_sell_dev).
# Pulls the latest code you pushed from smart_sell_dev, rebuilds the
# production .next output, and restarts the launchd server.
#
#   cd ~/Smart_sell && ./deploy.sh
#
set -euo pipefail

SERVICE="com.minimaldigital.smartsell"
PORT=3000
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "==> Deploying from: $APP_DIR"

# Refuse to deploy with modified TRACKED files — they would block git pull
# and the Mac mini is a deploy target, not a place to edit code.
# Untracked files (deploy.sh, logs/, etc.) are fine and don't block a pull.
if [[ -n "$(git status --porcelain -uno)" ]]; then
  echo "ERROR: tracked files have local changes. Commit/stash on smart_sell_dev instead:" >&2
  git status --short -uno >&2
  exit 1
fi

echo "==> git pull"
git pull --ff-only

echo "==> npm install (skips work if deps unchanged)"
npm install

echo "==> npm run build"
npm run build

echo "==> restarting $SERVICE"
launchctl kickstart -k "gui/$(id -u)/$SERVICE"

# Give next start a moment, then health-check.
echo "==> waiting for server on http://127.0.0.1:$PORT ..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT"; then
    echo "==> ✅ Deploy complete — server is up."
    exit 0
  fi
  sleep 1
done

echo "ERROR: server did not respond on port $PORT after 30s. Recent errors:" >&2
tail -n 30 "$APP_DIR/logs/smartsell.err.log" >&2 || true
exit 1
