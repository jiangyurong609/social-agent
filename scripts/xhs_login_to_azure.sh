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
if ! python3 -c 'import websocket' >/dev/null 2>&1; then
  VENV="${TMPDIR:-/tmp}/xhs-login-venv"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" -q install websocket-client
  PYTHON="$VENV/bin/python"
else
  PYTHON=python3
fi
if ! curl -fsS "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1; then
  open -na "Google Chrome" --args --remote-debugging-port="$CDP_PORT" --remote-allow-origins='*' --user-data-dir="$PWD/.xhs-login-profile" https://www.xiaohongshu.com
  echo "Chrome opened. Complete Xiaohongshu login in that window; waiting up to 5 minutes."
fi
$PYTHON - "$CDP_PORT" "$TMP_COOKIE" <<'PY'
import json, sys, time, urllib.request
port, output = sys.argv[1:]
try:
    import websocket
except ImportError:
    raise SystemExit("Install dependency first: python3 -m pip install --user websocket-client")
deadline = time.time() + 300
tabs = []
while time.time() < deadline:
    try:
        tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=5))
        if tabs: break
    except Exception: pass
    time.sleep(2)
tab = next((t for t in tabs if t.get("type") == "page"), None)
if not tab: raise SystemExit("No Chrome tab found; start Chrome with --remote-debugging-port=9222")
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=10)
cookies = []
for request_id in range(1, 151):
    ws.send(json.dumps({"id": request_id, "method": "Network.getAllCookies"}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == request_id: break
    cookies = [c for c in msg.get("result", {}).get("cookies", []) if "xiaohongshu.com" in c.get("domain", "")]
    if any(c.get("name") in ("web_session", "id_token") for c in cookies): break
    time.sleep(2)
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
