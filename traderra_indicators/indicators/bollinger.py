"""
Bollinger Bands.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class BollingerBands(BaseIndicator):
    key = "bollinger"
    name = "Bollinger Bands"
    group = "Overlays"
    description = "Bollinger Bands with configurable period and standard deviations"

    params = [
        ParamDef("period", "int", 20, "Period", min=1, max=200),
        ParamDef("stddev", "float", 2.0, "Std Dev", step=0.1),
    ]

    colors = [
        ColorDef("bb_fill", "rgba(100,149,237,.08)", "Band Fill"),
        ColorDef("bb_upper", "rgba(100,149,237,.40)", "Upper Line"),
        ColorDef("bb_lower", "rgba(100,149,237,.40)", "Lower Line"),
    ]

    outputs = [
        OutputDef("band", keys=["upper", "middle", "lower"],
                  color_map={"upper": "bb_upper", "lower": "bb_lower", "fill": "bb_fill"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        period = self.p("period")
        stddev = self.p("stddev")
        mid = df["close"].rolling(period).mean()
        std = df["close"].rolling(period).std(ddof=0)  # population std to match JS
        upper = mid + std * stddev
        lower = mid - std * stddev

        def _ser(s):
            return [round(float(v), 4) if not np.isnan(v) else None for v in s]

        return {"upper": _ser(upper), "middle": _ser(mid), "lower": _ser(lower)}
