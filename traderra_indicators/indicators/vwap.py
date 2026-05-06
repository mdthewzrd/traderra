"""
VWAP — Volume Weighted Average Price.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from ..base import BaseIndicator, ParamDef, ColorDef, OutputDef
from ..registry import register


@register
class VWAP(BaseIndicator):
    key = "vwap"
    name = "VWAP"
    group = "Overlays"
    description = "Volume Weighted Average Price (resets daily)"

    params = [
        ParamDef("anchor", "select", "daily", "Anchor", options=["daily", "weekly", "monthly", "session"]),
    ]

    colors = [
        ColorDef("vwap_color", "#e879f9", "VWAP Color", format="hex"),
    ]

    outputs = [
        OutputDef("line", keys=["values"], color_map={"values": "vwap_color"}),
    ]

    def calc(self, df: pd.DataFrame) -> dict:
        anchor = self.p("anchor")
        typ = (df["high"] + df["low"] + df["close"]) / 3
        vol = df["volume"].fillna(0)

        # Cumsum with reset at anchor boundaries
        if "time" in df.columns:
            times = pd.to_datetime(df["time"], unit="ms")
        else:
            times = pd.to_datetime(df.index)

        if anchor == "daily":
            groups = times.dt.date
        elif anchor == "weekly":
            groups = times.dt.isocalendar().week.astype(str) + "-" + times.dt.isocalendar().year.astype(str)
        elif anchor == "monthly":
            groups = times.dt.to_period("M")
        else:
            groups = times.dt.date  # session = daily for now

        cum_vol = vol.groupby(groups).cumsum()
        cum_tp_vol = (typ * vol).groupby(groups).cumsum()
        vwap = np.where(cum_vol > 0, cum_tp_vol / cum_vol, np.nan)

        return {"values": [round(float(v), 4) if not np.isnan(v) else None for v in vwap]}
