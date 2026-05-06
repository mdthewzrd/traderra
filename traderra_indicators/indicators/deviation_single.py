"""
Deviation Band Single — Dual-band lines from EMA ± ATR×mult.
Used for db_upper (two upper bands), db_low1/db_low2 (two lower bands).
Returns line1 and line2 arrays.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class DeviationSingle(BaseIndicator):
    key = "deviation_single"
    name = "Deviation Band Dual Line"
    group = "Overlays"
    description = "Dual deviation lines from EMA ± ATR×mult (for db_upper/db_low1/db_low2)"

    params = [
        ParamDef("ema_len", "int", 9, "EMA Length", min=1, max=500),
        ParamDef("mult1", "float", 1.0, "Inner Multiplier", step=0.1),
        ParamDef("mult2", "float", 0.5, "Outer Multiplier", step=0.1),
        ParamDef("side", "select", "upper", "Side", options=["upper", "lower"]),
    ]

    colors = [
        ColorDef("dev_color", "rgba(100,149,237,.50)", "Band Color"),
    ]

    outputs = [
        OutputDef("band", keys=["line1", "line2"], color_map={"line1": "dev_color", "line2": "dev_color", "fill": "dev_color"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        ema = df["close"].ewm(span=self.p("ema_len"), adjust=False).mean()

        # ATR via SMA of true range
        tr = pd.DataFrame({
            "hl": df["high"] - df["low"],
            "hc": (df["high"] - df["close"].shift(1)).abs(),
            "lc": (df["low"] - df["close"].shift(1)).abs(),
        }).max(axis=1)
        atr = tr.rolling(self.p("ema_len")).mean()

        mult1 = self.p("mult1")
        mult2 = self.p("mult2")

        if self.p("side") == "upper":
            line1 = ema + atr * mult1
            line2 = ema + atr * mult2
        else:
            line1 = ema - atr * mult1
            line2 = ema - atr * mult2

        def _ser(s):
            return [round(float(v), 4) if not (pd.isna(v) or np.isnan(v)) else None for v in s]

        return {"line1": _ser(line1), "line2": _ser(line2)}
