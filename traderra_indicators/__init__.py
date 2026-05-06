"""
Traderra Indicators — Declarative Python indicator framework.

Single source of truth: params, colors, computation, and output schema
all live in one Python class. Auto-generates JSON schemas for the browser,
pure pandas/numpy for backtesting.

Usage:
    from traderra_indicators import KeyLevels, EMA
    import pandas as pd

    # Standalone (backtesting)
    df = pd.read_csv("SPY_1d.csv")
    kl = KeyLevels(look_left=66, look_right=33)
    result = kl.calc(df)

    # Schema for browser
    schema = KeyLevels.schema()
"""

from .base import BaseIndicator, ParamDef, ColorDef, OutputDef
from .registry import REGISTRY, discover_indicators

# Auto-discover all indicators in the indicators/ subpackage
discover_indicators()

__all__ = [
    "BaseIndicator", "ParamDef", "ColorDef", "OutputDef",
    "REGISTRY", "discover_indicators",
]
