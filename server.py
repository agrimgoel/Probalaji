import http.server
import socketserver
import json
import urllib.request
import urllib.error
import urllib.parse
import datetime
import sys
import socket

# ═══════════════════════════════════════════════════════════════
#  PROBALAJI AI — server.py (Google Sheets Cloud Sync Edition)
#
#  SETUP: Paste your Google Apps Script Web App URL below.
#  Keep the " " quotes. Replace only the text inside them.
# ═══════════════════════════════════════════════════════════════

APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyLTO734OJ_9Z-qJkfztFEvtzk2hTDMhVaf5KbKwu_J3m0tzPl_rqAo6pJjhTLLX9RJWg/exec"   # ← Only change this line

PORT = 8080


def get_lan_ip():
    """Get the local network IP address (so phones can connect)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# ───────────────────────────────────────────────────────────────
# Google Apps Script returns a 302 redirect — we must follow it.
# urllib does NOT follow redirects for POST by default, so we
# build a custom opener that keeps the method on redirect.
class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Follow redirect but preserve POST body and method."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        data = req.data
        new_req = urllib.request.Request(
            newurl,
            data=data,
            headers={k: v for k, v in req.headers.items()},
            method=req.get_method()
        )
        return new_req

_opener = urllib.request.build_opener(_NoRedirectHandler)


def call_sheets_api(payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        APPS_SCRIPT_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with _opener.open(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            print(f"[Sheets API] POST response: {raw[:200]}")
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[Sheets API] HTTP {e.code} error: {body[:300]}")
        raise


def get_all_warranties() -> list:
    req = urllib.request.Request(APPS_SCRIPT_URL, method="GET")
    try:
        with _opener.open(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            result = json.loads(raw)
            # Apps Script may return {data: [...]} or just [...]
            if isinstance(result, list):
                return result
            return result.get("data", [])
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[Sheets GET] HTTP {e.code} error: {body[:300]}")
        raise


# ───────────────────────────────────────────────────────────────
class BackupHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        # Allow any device on the network to access this server
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ── GET Endpoints ──────────────────────────────────────────
    def do_GET(self):
        if self.path == "/api/warranties":
            try:
                records = get_all_warranties()
                self._json(200, records)
            except Exception as e:
                self._error(500, f"Failed to fetch from Google Sheets: {e}")

        elif self.path == "/api/excel-path":
            self._json(200, {"path": "☁️ Google Sheets Cloud Database (Synced across all PCs)"})

        elif self.path == "/api/open-excel":
            self._json(200, {
                "status": "info",
                "message": "Data is stored in Google Sheets. Open your Google Sheet to view all records."
            })

        else:
            super().do_GET()

    # ── POST Endpoints ─────────────────────────────────────────
    def do_POST(self):
        if self.path == "/api/warranty":
            try:
                record = self._body()
                if not record.get("serial") or not record.get("name"):
                    self._error(400, "Missing required fields: serial or name.")
                    return
                record["action"] = "add"
                if "cardGiven" not in record:
                    record["cardGiven"] = "No"
                result = call_sheets_api(record)
                self._json(200, result)
            except Exception as e:
                self._error(500, f"Failed to save warranty: {e}")

        elif self.path == "/api/warranty/card-given":
            try:
                body = self._body()
                if not body.get("serial"):
                    self._error(400, "Missing serial number.")
                    return
                body["action"] = "card-given"
                result = call_sheets_api(body)
                self._json(200, result)
            except Exception as e:
                self._error(500, f"Failed to update card status: {e}")

        else:
            self.send_response(404)
            self.end_headers()

    # ── Helpers ────────────────────────────────────────────────
    def _body(self):
        length = int(self.headers["Content-Length"])
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _json(self, code, data):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, code, message):
        self._json(code, {"status": "error", "message": message})

    def log_message(self, fmt, *args):
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {fmt % args}")


# ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Force UTF-8 output on Windows (avoids emoji encoding errors)
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    if "PASTE_YOUR" in APPS_SCRIPT_URL:
        print("=" * 62)
        print("  ERROR: Apps Script URL not set in server.py!")
        print("  Open server.py, find APPS_SCRIPT_URL and paste")
        print("  your Google Apps Script URL between the quotes.")
        print("=" * 62)
        sys.exit(1)

    lan_ip = get_lan_ip()

    print("=" * 62)
    print("  PROBALAJI AI -- Cloud Sync Edition")
    print("=" * 62)
    print(f"  Database  : Google Sheets (ALL devices see same data)")
    print(f"")
    print(f"  [LAPTOP]  Open: http://localhost:{PORT}")
    print(f"  [PHONE]   Open: http://{lan_ip}:{PORT}")
    print(f"")
    print(f"  ** Share the PHONE URL with any phone/tablet on")
    print(f"     the same Wi-Fi to register or check warranty! **")
    print("=" * 62)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), BackupHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)
