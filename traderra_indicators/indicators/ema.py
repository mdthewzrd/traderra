"""
Exponential Moving Average.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class EMA(BaseIndicator):
    key = "ema"
    name = "EMA"
    group = "MA"
    description = "Exponential Moving Average"

    params = [
        ParamDef("period", "int", 9, "Period", min=1, max=500),
    ]

    colors = [
        ColorDef("ema_color", "#D4AF37", "EMA Color", format="hex"),
    ]

    outputs = [
        OutputDef("line", keys=["values"], color_map={"values": "ema_color"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        period = self.p("period")
        values = df["close"].ewm(span=period, adjust=False).mean()
        return {"values": [round(float(v), 4) if not np.isnan(v) else None for v in values]}


@register
class SMA(BaseIndicator):
    key = "sma"
    name = "SMA"
    group = "MA"
    description = "Simple Moving Average"

    params = [
        ParamDef("period", "int", 20, "Period", min=1, max=500),
    ]

    colors = [
        ColorDef("sma_color", "#5a9ae6", "SMA Color", format="hex"),
    ]

    outputs = [
        OutputDef("line", keys=["values"], color_map={"values": "sma_color"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        period = self.p("period")
        values = df["close"].rolling(period).mean()
        return {"values": [round(float(v), 4) if not np.isnan(v) else None for v in values]}
