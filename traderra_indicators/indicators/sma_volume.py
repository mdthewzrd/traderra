"""
SMA Volume — Simple moving average of volume.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class SMAVolume(BaseIndicator):
    key = "sma_vol"
    name = "SMA Volume"
    group = "Volume"
    description = "Simple moving average of volume bars"

    params = [
        ParamDef("period", "int", 20, "Period", min=1, max=200),
    ]

    colors = [
        ColorDef("vol_sma_color", "#D4AF37", "SMA Color", format="hex"),
    ]

    outputs = [
        OutputDef("line", keys=["values"], color_map={"values": "vol_sma_color"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        period = self.p("period")
        values = df["volume"].rolling(period).mean()
        return {"values": [round(float(v), 2) if not np.isnan(v) else None for v in values]}
