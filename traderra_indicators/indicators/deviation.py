"""
Deviation Bands — EMA + ATR based (matches Pine Script / JS drawDevBand).
Upper = fastEMA + (mult × fastATR), Lower = slowEMA - (mult × slowATR)
Returns two band pairs: upper (line1/line2) and lower (line1/line2).
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class DeviationBands(BaseIndicator):
    key = "deviation"
    name = "Deviation Bands"
    group = "Overlays"
    description = "EMA + ATR deviation bands (upper = fastEMA + mult×fastATR, lower = slowEMA - mult×slowATR)"

    params = [
        ParamDef("fast", "int", 9, "Fast EMA Length", min=1, max=500),
        ParamDef("slow", "int", 20, "Slow EMA Length", min=1, max=500),
        ParamDef("up_low", "float", 0.5, "Upper Band Low Mult", step=0.1),
        ParamDef("up_high", "float", 1.0, "Upper Band High Mult", step=0.1),
        ParamDef("dn_low", "float", 2.0, "Lower Band Low Mult", step=0.1),
        ParamDef("dn_high", "float", 2.4, "Lower Band High Mult", step=0.1),
    ]

    colors = [
        ColorDef("up_fill", "rgba(239,68,68,.15)", "Upper Fill"),
        ColorDef("up_line", "rgba(239,68,68,.40)", "Upper Line"),
        ColorDef("dn_fill", "rgba(34,197,94,.15)", "Lower Fill"),
        ColorDef("dn_line", "rgba(34,197,94,.40)", "Lower Line"),
    ]

    outputs = [
        OutputDef("upper_band", keys=["up1", "up2"], color_map={"up1": "up_line", "up2": "up_line", "fill": "up_fill"}),
        OutputDef("lower_band", keys=["dn1", "dn2"], color_map={"dn1": "dn_line", "dn2": "dn_line", "fill": "dn_fill"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        fast_ema = df["close"].ewm(span=self.p("fast"), adjust=False).mean()
        slow_ema = df["close"].ewm(span=self.p("slow"), adjust=False).mean()

        # ATR via SMA of true range (matches JS calcATRSMA)
        tr = pd.DataFrame({
            "hl": df["high"] - df["low"],
            "hc": (df["high"] - df["close"].shift(1)).abs(),
            "lc": (df["low"] - df["close"].shift(1)).abs(),
        }).max(axis=1)
        fast_atr = tr.rolling(self.p("fast")).mean()
        slow_atr = tr.rolling(self.p("slow")).mean()

        up_low = self.p("up_low")
        up_high = self.p("up_high")
        dn_low = self.p("dn_low")
        dn_high = self.p("dn_high")

        # Upper: fastEMA + mult × fastATR
        up1 = fast_ema + fast_atr * up_low
        up2 = fast_ema + fast_atr * up_high

        # Lower: slowEMA - mult × slowATR
        dn1 = slow_ema - slow_atr * dn_low
        dn2 = slow_ema - slow_atr * dn_high

        def _ser(s):
            return [round(float(v), 4) if not (pd.isna(v) or np.isnan(v)) else None for v in s]

        return {
            "up1": _ser(up1), "up2": _ser(up2),
            "dn1": _ser(dn1), "dn2": _ser(dn2),
        }
