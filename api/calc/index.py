"""
POST /api/calc — Run indicator calculation.
Body: {"key": "pzones", "params": {...}, "data": [{t,o,h,l,c,v}, ...]}
"""
from http.server import BaseHTTPRequestHandler
from traderra_indicators import REGISTRY
import json
import pandas as pd


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length).decode())

        key = body.get("key", "")
        params = body.get("params", {})
        data = body.get("data", [])

        if key not in REGISTRY:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Unknown indicator: {key}"}).encode())
            return

        # Build DataFrame
        df = pd.DataFrame(data)
        col_map = {"t": "time", "o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"}
        df.rename(columns={k: v for k, v in col_map.items() if k in df.columns}, inplace=True)
        for col in ["open", "high", "low", "close", "volume"]:
            if col not in df.columns:
                df[col] = 0
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # Run calculation
        ind_cls = REGISTRY[key]
        ind = ind_cls(**params)
        result = ind.calc(df)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"key": key, "params": ind._values, "result": result}).encode())
