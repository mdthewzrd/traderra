"""
EMA Band — EMA-based envelope band (EMA ± offset).
Used for band_9_20 and band_72_89.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class EMABand(BaseIndicator):
    key = "ema_band"
    name = "EMA Band"
    group = "MA"
    description = "EMA envelope band (fast EMA with slow EMA as boundary)"

    params = [
        ParamDef("fast", "int", 9, "Fast EMA", min=1, max=500),
        ParamDef("slow", "int", 20, "Slow EMA", min=1, max=500),
    ]

    colors = [
        ColorDef("band_fill", "rgba(212,175,55,.08)", "Band Fill"),
        ColorDef("band_upper", "rgba(212,175,55,.40)", "Upper Line"),
        ColorDef("band_lower", "rgba(212,175,55,.40)", "Lower Line"),
    ]

    outputs = [
        OutputDef("band", keys=["upper", "middle", "lower"],
                  color_map={"upper": "band_upper", "lower": "band_lower", "fill": "band_fill"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        fast_ema = df["close"].ewm(span=self.p("fast"), adjust=False).mean()
        slow_ema = df["close"].ewm(span=self.p("slow"), adjust=False).mean()

        def _ser(s):
            return [round(float(v), 4) if not np.isnan(v) else None for v in s]

        return {"upper": _ser(fast_ema), "middle": _ser(slow_ema), "lower": _ser(slow_ema)}
