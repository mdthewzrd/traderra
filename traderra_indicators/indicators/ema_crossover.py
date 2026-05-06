"""
EMA Crossover — Two EMAs plotted together (e.g. EMA 40/60).
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class EMACrossover(BaseIndicator):
    key = "ema_cross"
    name = "EMA Crossover"
    group = "MA"
    description = "Two EMAs for crossover signals"

    params = [
        ParamDef("fast", "int", 40, "Fast Period", min=1, max=500),
        ParamDef("slow", "int", 60, "Slow Period", min=1, max=500),
    ]

    colors = [
        ColorDef("ema_fast_color", "#22c55e", "Fast EMA", format="hex"),
        ColorDef("ema_slow_color", "#ef5350", "Slow EMA", format="hex"),
    ]

    outputs = [
        OutputDef("line", keys=["fast", "slow"],
                  color_map={"fast": "ema_fast_color", "slow": "ema_slow_color"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        fast = df["close"].ewm(span=self.p("fast"), adjust=False).mean()
        slow = df["close"].ewm(span=self.p("slow"), adjust=False).mean()

        def _ser(s):
            return [round(float(v), 4) if not np.isnan(v) else None for v in s]

        return {"fast": _ser(fast), "slow": _ser(slow)}
