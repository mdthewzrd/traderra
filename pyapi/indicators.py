"""
GET /api/indicators — Returns JSON schemas for all registered indicators.
"""
from http.server import BaseHTTPRequestHandler
from traderra_indicators import REGISTRY
import json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        schemas = {key: cls.schema() for key, cls in REGISTRY.items()}
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "public, s-maxage=3600")
        self.end_headers()
        self.wfile.write(json.dumps(schemas).encode())
