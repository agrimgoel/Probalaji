import http.server
import socketserver
import json
import urllib.request
import urllib.error
import datetime
import sys

# ═══════════════════════════════════════════════════════════════
#  PROBALAJI AI — server.py (Google Sheets Cloud Sync Edition)
#
#  SETUP: Paste your Google Apps Script Web App URL below.
#  Keep the " " quotes. Replace only the text inside them.
# ═══════════════════════════════════════════════════════════════

APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyLTO734OJ_9Z-qJkfztFEvtzk2hTDMhVaf5KbKwu_J3m0tzPl_rqAo6pJjhTLLX9RJWg/exec"   # ← Only change this line

PORT = 8080

# ───────────────────────────────────────────────────────────────
def call_sheets_api(payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        APPS_SCRIPT_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_all_warranties() -> list:
    req = urllib.request.Request(APPS_SCRIPT_URL, method="GET")
    with urllib.request.urlopen(req, timeout=20) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result.get("data", [])


# ───────────────────────────────────────────────────────────────
class BackupHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        if self.path.startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", "*")
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
    if "PASTE_YOUR" in APPS_SCRIPT_URL:
        print("=" * 58)
        print("  ERROR: Apps Script URL not set in server.py!")
        print("  Open server.py, find APPS_SCRIPT_URL and paste")
        print("  your Google Apps Script URL between the quotes.")
        print("=" * 58)
        sys.exit(1)

    print("=" * 58)
    print("  PROBALAJI AI — Cloud Sync Edition")
    print(f"  Port     : {PORT}")
    print(f"  Database : Google Sheets (live sync across all PCs)")
    print(f"  Web app  : http://localhost:{PORT}")
    print("=" * 58)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), BackupHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)
