"""
Prior Day Close — Horizontal line at yesterday's close.
"""
from __future__ import annotations
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class PriorDayClose(BaseIndicator):
    key = "pdc"
    name = "Prior Day Close"
    group = "Overlays"
    description = "Horizontal line at previous day's closing price"

    params = []

    colors = [
        ColorDef("pdc_color", "#787878", "PDC Color", format="hex"),
    ]

    outputs = [
        OutputDef("hline", keys=["value"], color_map={"value": "pdc_color"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        # Find the last complete trading day's close
        if "time" in df.columns:
            times = pd.to_datetime(df["time"], unit="ms")
        else:
            times = pd.to_datetime(df.index)

        dates = times.dt.date.unique()
        if len(dates) < 2:
            return {"value": None}

        prev_date = dates[-2]  # second to last date
        prev_bars = df[times.dt.date == prev_date]
        if len(prev_bars) == 0:
            return {"value": None}

        return {"value": round(float(prev_bars["close"].iloc[-1]), 4)}
