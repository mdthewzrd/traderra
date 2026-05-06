"""
Volume — Raw volume bars with SMA overlay.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class Volume(BaseIndicator):
    key = "vol"
    name = "Volume"
    group = "Volume"
    description = "Volume bars with optional SMA"

    params = [
        ParamDef("sma_len", "int", 0, "Volume SMA (0=off)", min=0, max=200),
    ]

    colors = [
        ColorDef("vol_up", "rgba(38,166,154,.5)", "Up Volume"),
        ColorDef("vol_dn", "rgba(239,83,80,.5)", "Down Volume"),
        ColorDef("vol_sma_color", "#D4AF37", "SMA Color", format="hex"),
    ]

    outputs = [
        OutputDef("histogram", keys=["up", "down"], color_map={"up": "vol_up", "down": "vol_dn"}),
        OutputDef("line", keys=["sma"], color_map={"sma": "vol_sma_color"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        closes = df["close"].values
        vols = df["volume"].fillna(0).values
        up = np.where(np.append(True, np.diff(closes) >= 0), vols, 0).tolist()
        down = np.where(np.append(True, np.diff(closes) >= 0), 0, vols).tolist()

        sma_len = self.p("sma_len")
        if sma_len > 0:
            sma = df["volume"].rolling(sma_len).mean()
            sma_list = [round(float(v), 2) if not np.isnan(v) else None for v in sma]
        else:
            sma_list = [None] * len(df)

        return {
            "up": [round(float(v), 2) for v in up],
            "down": [round(float(v), 2) for v in down],
            "sma": sma_list,
        }
