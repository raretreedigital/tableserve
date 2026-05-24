#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  TableServe — start backend + frontend in one command
#  Usage:  ./dev.sh
#  Stop:   Ctrl+C
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_DIR="$(cd "$(dirname "$0")/table-serve-backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/table-serve-frontend" && pwd)"

# ── Resolve a working Node binary ─────────────────────────────────────────────
# Homebrew node breaks when icu4c is upgraded; fnm-managed node still works.
if command -v fnm &>/dev/null; then
  eval "$(fnm env 2>/dev/null)"
  fnm use default 2>/dev/null || true
fi

if ! node -e "" 2>/dev/null; then
  FNM_NODE=$(ls -1 "$HOME/.fnm/node-versions/"*/installation/bin/node 2>/dev/null | tail -1)
  if [ -n "$FNM_NODE" ]; then
    export PATH="$(dirname "$FNM_NODE"):$PATH"
  else
    echo "ERROR: node is broken. Fix with:  brew reinstall node"
    exit 1
  fi
fi

echo "→ Node:  $(node --version)  ($(which node))"
echo "→ Bun:   $(bun --version)   ($(which bun))"
echo ""

# ── Free ports before starting ────────────────────────────────────────────────
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 0.5

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "→ Stopping…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Start backend ──────────────────────────────────────────────────────────────
echo "→ Starting backend  (http://localhost:3000)"
cd "$BACKEND_DIR"
bun src/index.ts 2>&1 | grep -v '"code":"42701"' | grep -v 'already exists, skipping' &
BACKEND_PID=$!

# Wait until backend accepts connections (max 15s)
for i in $(seq 1 30); do
  curl -sf http://localhost:3000/api/superadmin/stats -o /dev/null 2>/dev/null && break
  sleep 0.5
done

# ── Start frontend ─────────────────────────────────────────────────────────────
echo "→ Starting frontend (http://localhost:5173)"
cd "$FRONTEND_DIR"
node node_modules/.bin/vite dev 2>&1 &
FRONTEND_PID=$!

echo ""
echo "┌──────────────────────────────────────────────────────┐"
echo "│  Backend      →  http://localhost:3000               │"
echo "│  Frontend     →  http://localhost:5173               │"
echo "│  Admin        →  http://localhost:5173/admin/login   │"
echo "│  Superadmin   →  http://localhost:5173/superadmin/login │"
echo "│                                                      │"
echo "│  Ctrl+C to stop everything                          │"
echo "└──────────────────────────────────────────────────────┘"
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"
