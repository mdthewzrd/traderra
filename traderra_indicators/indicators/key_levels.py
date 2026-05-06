"""
Key Levels — Bjorgum-style supply/demand zones.

Exact port of the TradingView Pine Script indicator logic:
- Heikin-Ashi source pivots
- ATR-based zone width
- Bar-by-bar color flip (support/resistance)
- Zone chain (each ends where next begins)
- Overlapping zone merge (align)

Settings match TradingView defaults:
  Look Left=66, Look Right=33, ATR=66, Source=HA, nPiv=1, Wait Confirmed=On
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class KeyLevels(BaseIndicator):
    key = "pzones"
    name = "Key Levels"
    group = "Overlays"
    description = "Bjorgum-style supply/demand zones with historical color tracking"

    params = [
        ParamDef("left", "int", 66, "Look Left", min=2, max=200),
        ParamDef("right", "int", 33, "Look Right", min=1, max=100),
        ParamDef("nPiv", "int", 1, "Number of Pivots", min=1, max=20),
        ParamDef("atrLen", "int", 66, "ATR Length", min=5, max=200),
        ParamDef("mult", "float", 0.6, "Zone Width x ATR", step=0.1),
        ParamDef("per", "float", 1.0, "Max Zone %", step=0.1),
        ParamDef("source", "select", "HA", "Source", options=["HA", "HA Body", "OHLC"]),
        ParamDef("align", "bool", True, "Align Zones"),
        ParamDef("extend_right", "bool", True, "Extend Right"),
        ParamDef("show_labels", "bool", False, "Show Price Labels"),
        ParamDef("offset", "int", 30, "Label Offset", min=0, max=100),
        ParamDef("wait_confirm", "bool", True, "Wait For Confirmed Bar"),
    ]

    colors = [
        ColorDef("pz_sup_fill", "rgba(34,197,94,.08)", "Support Fill"),
        ColorDef("pz_sup_line", "rgba(34,197,94,.35)", "Support Line"),
        ColorDef("pz_sup_label", "#26a69a", "Support Label", format="hex"),
        ColorDef("pz_res_fill", "rgba(239,68,68,.08)", "Resistance Fill"),
        ColorDef("pz_res_line", "rgba(239,68,68,.35)", "Resistance Line"),
        ColorDef("pz_res_label", "#ef5350", "Resistance Label", format="hex"),
    ]

    outputs = [
        OutputDef(
            "zone",
            keys=["idx", "top", "bottom", "endIdx", "bullish", "barColors"],
            labels=["zones"],
        )
    ]

    # ── Main computation ──

    def calc(self, df: pd.DataFrame) -> dict:
        if len(df) < 100:
            return {"zones": []}

        left = self.p("left")
        right = self.p("right")
        atr_len = self.p("atrLen")
        mult = self.p("mult")
        per = self.p("per")
        source = self.p("source")

        # 1. Heikin-Ashi candles
        ha = self._heikin_ashi(df)

        # 2. ATR (SMA of true range)
        atr = self._atr(df, atr_len)

        # 3. Source selection
        if source == "HA":
            src_h = ha["high"].values
            src_l = ha["low"].values
        elif source == "HA Body":
            src_h = np.maximum(ha["close"].values, ha["open"].values)
            src_l = np.minimum(ha["close"].values, ha["open"].values)
        else:  # OHLC
            src_h = df["high"].values
            src_l = df["low"].values

        # 4. Pivot detection
        piv_h, piv_l = self._find_pivots(src_h, src_l, left, right)

        # 5. Build zones
        zones = self._build_zones(piv_h, piv_l, atr.values, mult, per, len(df))

        # 6. Bar-by-bar color tracking
        zones = self._track_colors(zones, df["high"].values, df["low"].values)

        # 7. Merge overlapping
        if self.p("align"):
            zones = self._merge_zones(zones)

        # Serialize
        result = []
        for z in zones:
            bc = {str(k): v for k, v in z.get("barColors", {}).items() if v is not None}
            result.append({
                "idx": int(z["idx"]),
                "top": round(float(z["top"]), 4),
                "bottom": round(float(z["bottom"]), 4),
                "endIdx": int(z["endIdx"]),
                "bullish": bool(z["bullish"]),
                "barColors": bc,
            })
        return {"zones": result}

    # ── Signal generation for backtesting ──

    def signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Returns DataFrame with zone break events.
        Columns: bar, zone_idx, type (support_break|resistance_break), price, zone_top, zone_bottom
        """
        result = self.calc(df)
        rows = []
        for z in result["zones"]:
            sorted_bars = sorted(z.get("barColors", {}).items(), key=lambda x: int(x[0]))
            prev_bull = None
            for bar_str, bull in sorted_bars:
                bi = int(bar_str)
                if prev_bull is not None and prev_bull != bull:
                    rows.append({
                        "bar": bi,
                        "zone_idx": z["idx"],
                        "zone_top": z["top"],
                        "zone_bottom": z["bottom"],
                        "type": "support_break" if bull else "resistance_break",
                        "price": float(df["close"].iloc[bi]),
                    })
                prev_bull = bull
        return pd.DataFrame(rows) if rows else pd.DataFrame(
            columns=["bar", "zone_idx", "zone_top", "zone_bottom", "type", "price"]
        )

    # ── Heikin-Ashi ──

    @staticmethod
    def _heikin_ashi(df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        ha_close = (df["open"].values + df["high"].values + df["low"].values + df["close"].values) / 4
        ha_open = np.empty(n)
        ha_open[0] = df["open"].values[0]
        for i in range(1, n):
            ha_open[i] = (ha_open[i - 1] + ha_close[i - 1]) / 2
        ha_high = np.maximum(df["high"].values, np.maximum(ha_open, ha_close))
        ha_low = np.minimum(df["low"].values, np.minimum(ha_open, ha_close))
        return pd.DataFrame({"open": ha_open, "high": ha_high, "low": ha_low, "close": ha_close})

    # ── ATR ──

    @staticmethod
    def _atr(df: pd.DataFrame, length: int) -> pd.Series:
        prev_close = df["close"].shift(1)
        tr = np.maximum(
            df["high"] - df["low"],
            np.maximum(
                (df["high"] - prev_close).abs(),
                (df["low"] - prev_close).abs(),
            ),
        )
        return tr.rolling(length).mean().fillna(0)

    # ── Pivot detection ──

    @staticmethod
    def _find_pivots(
        src_h: np.ndarray, src_l: np.ndarray, left: int, right: int
    ) -> tuple[list, list]:
        n = len(src_h)
        piv_h: list[float | None] = [None] * n
        piv_l: list[float | None] = [None] * n

        for i in range(left, n - right):
            # Pivot high: src_h[i] must be strictly highest in [i-left..i+right]
            is_high = True
            for j in range(i - left, i):
                if src_h[j] >= src_h[i]:
                    is_high = False
                    break
            if is_high:
                for j in range(i + 1, i + right + 1):
                    if src_h[j] >= src_h[i]:
                        is_high = False
                        break
            if is_high:
                piv_h[i] = float(src_h[i])

            # Pivot low: src_l[i] must be strictly lowest
            is_low = True
            for j in range(i - left, i):
                if src_l[j] <= src_l[i]:
                    is_low = False
                    break
            if is_low:
                for j in range(i + 1, i + right + 1):
                    if src_l[j] <= src_l[i]:
                        is_low = False
                        break
            if is_low:
                piv_l[i] = float(src_l[i])

        return piv_h, piv_l

    # ── Zone building ──

    @staticmethod
    def _build_zones(
        piv_h: list, piv_l: list, atr: np.ndarray,
        mult: float, per: float, data_len: int,
    ) -> list[dict]:
        high_zones: list[dict] = []
        low_zones: list[dict] = []

        for i in range(len(piv_h)):
            a = float(atr[i]) if i < len(atr) else 0
            if piv_h[i] is not None:
                band = min(a * mult, piv_h[i] * per / 100) / 2
                high_zones.append({
                    "idx": i, "top": piv_h[i] + band,
                    "bottom": piv_h[i] - band,
                    "bullish": False, "endIdx": data_len - 1,
                })
            if piv_l[i] is not None:
                band = min(a * mult, piv_l[i] * per / 100) / 2
                low_zones.append({
                    "idx": i, "top": piv_l[i] + band,
                    "bottom": piv_l[i] - band,
                    "bullish": True, "endIdx": data_len - 1,
                })

        # Chain: each zone ends where the next same-type zone begins
        for i in range(len(high_zones) - 1):
            high_zones[i]["endIdx"] = high_zones[i + 1]["idx"] - 1
        for i in range(len(low_zones) - 1):
            low_zones[i]["endIdx"] = low_zones[i + 1]["idx"] - 1

        return high_zones + low_zones

    # ── Bar-by-bar color tracking ──

    @staticmethod
    def _track_colors(zones: list[dict], highs: np.ndarray, lows: np.ndarray) -> list[dict]:
        for z in zones:
            bar_colors: dict[int, bool] = {}
            cur_bull = z["bullish"]
            end = min(z["endIdx"] + 1, len(highs))
            for bi in range(z["idx"], end):
                hi = float(highs[bi])
                lo = float(lows[bi])
                if hi > z["top"] and lo < z["bottom"]:
                    pass  # engulfed — no change
                elif hi > z["top"]:
                    cur_bull = True  # broke above → support
                elif lo < z["bottom"]:
                    cur_bull = False  # broke below → resistance
                bar_colors[bi] = cur_bull
            z["barColors"] = bar_colors
            z["bullish"] = cur_bull
        return zones

    # ── Merge overlapping zones ──

    @staticmethod
    def _merge_zones(zones: list[dict]) -> list[dict]:
        zones = sorted(zones, key=lambda z: z["idx"])
        merged: list[dict] = []
        for z in zones:
            found = False
            for m in merged:
                if z["top"] > m["bottom"] and z["bottom"] < m["top"]:
                    m["top"] = max(m["top"], z["top"])
                    m["bottom"] = min(m["bottom"], z["bottom"])
                    m["idx"] = min(m["idx"], z["idx"])
                    m["endIdx"] = max(m["endIdx"], z["endIdx"])
                    m["barColors"].update(z.get("barColors", {}))
                    found = True
                    break
            if not found:
                merged.append(dict(z))
        return merged
