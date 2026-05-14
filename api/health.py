"""
GET /api/health — Health check.
"""
from http.server import BaseHTTPRequestHandler
from traderra_indicators import REGISTRY
import json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "indicators": len(REGISTRY)}).encode())
