#!/usr/bin/env bash
set -euo pipefail

# Login helper. It never handles a password: login is completed manually in a
# Chrome window, then cookies are read through Chrome DevTools Protocol and
# copied to the dedicated VM. Requires Python package websocket-client.
VM_NAME="${VM_NAME:-xhs-mcp-vm}"
RESOURCE_GROUP="${RESOURCE_GROUP:-XHS-MCP-RG}"
CDP_PORT="${CDP_PORT:-9222}"
COOKIE_DEST="${COOKIE_DEST:-/opt/xhs-mcp/data/cookies.json}"
TMP_COOKIE="$(mktemp -t xhs-cookies.XXXXXX.json)"
trap 'rm -f "$TMP_COOKIE"' EXIT

command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
python3 - "$CDP_PORT" "$TMP_COOKIE" <<'PY'
import json, sys, time, urllib.request
port, output = sys.argv[1:]
try:
    import websocket
except ImportError:
    raise SystemExit("Install dependency first: python3 -m pip install --user websocket-client")
tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=5))
tab = next((t for t in tabs if t.get("type") == "page"), None)
if not tab: raise SystemExit("No Chrome tab found; start Chrome with --remote-debugging-port=9222")
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=10)
ws.send(json.dumps({"id": 1, "method": "Network.getAllCookies"}))
while True:
    msg = json.loads(ws.recv())
    if msg.get("id") == 1: break
cookies = [c for c in msg.get("result", {}).get("cookies", []) if "xiaohongshu.com" in c.get("domain", "")]
if not cookies: raise SystemExit("No Xiaohongshu cookies found; finish login in the browser first")
with open(output, "w") as f: json.dump(cookies, f)
print(f"Captured {len(cookies)} Xiaohongshu cookies (values omitted)")
PY

chmod 600 "$TMP_COOKIE"
COOKIE_B64="$(base64 < "$TMP_COOKIE" | tr -d '\n')"
az vm run-command invoke -g "$RESOURCE_GROUP" -n "$VM_NAME" --command-id RunShellScript \
  --scripts "install -d -m 700 \"$(dirname "$COOKIE_DEST")\"; echo '$COOKIE_B64' | base64 -d > \"$COOKIE_DEST\"; chmod 600 \"$COOKIE_DEST\"; systemctl restart xiaohongshu-mcp" \
  --no-wait -o none
echo "Cookie transfer submitted; verify the MCP login before resuming scraping."
