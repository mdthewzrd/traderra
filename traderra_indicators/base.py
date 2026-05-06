"""
Base classes for the Traderra indicator framework.

Every indicator is a class that declares its params, colors, and outputs
as class-level attributes, then implements calc(df) -> dict.

The schema() classmethod auto-generates a JSON description for the browser
to build its settings UI dynamically.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class ParamDef:
    """Declares a single indicator parameter (number, toggle, or select)."""
    key: str
    type: Literal["int", "float", "bool", "select"]
    default: Any
    label: str
    min: float | None = None
    max: float | None = None
    step: float | None = None
    options: list[str] | None = None  # for type='select'

    def to_schema(self) -> dict:
        d: dict[str, Any] = {
            "key": self.key, "type": self.type, "default": self.default,
            "label": self.label,
        }
        if self.min is not None: d["min"] = self.min
        if self.max is not None: d["max"] = self.max
        if self.step is not None: d["step"] = self.step
        if self.options is not None: d["options"] = self.options
        return d


@dataclass
class ColorDef:
    """Declares a single color setting (hex or rgba with opacity)."""
    key: str
    default: str
    label: str
    format: Literal["hex", "rgba"] = "rgba"

    def to_schema(self) -> dict:
        return {"key": self.key, "default": self.default, "label": self.label, "format": self.format}


@dataclass
class OutputDef:
    """Declares what the indicator outputs (line, band, zone, hline, histogram)."""
    type: Literal["line", "band", "zone", "hline", "histogram"]
    keys: list[str] = field(default_factory=list)
    color_map: dict[str, str] = field(default_factory=dict)  # key -> color_key
    labels: list[str] = field(default_factory=list)

    def to_schema(self) -> dict:
        d: dict[str, Any] = {"type": self.type, "keys": self.keys}
        if self.color_map: d["colorMap"] = self.color_map
        if self.labels: d["labels"] = self.labels
        return d


class BaseIndicator:
    """
    Base class for all indicators. Subclass and override:
      - key, name, group (required)
      - params: list[ParamDef]
      - colors: list[ColorDef]
      - outputs: list[OutputDef]
      - calc(df) -> dict (required)
    """
    key: str = ""
    name: str = ""
    group: str = ""
    description: str = ""
    params: list[ParamDef] = []
    colors: list[ColorDef] = []
    outputs: list[OutputDef] = []

    def __init__(self, **kwargs):
        self._values: dict[str, Any] = {}
        for p in self.params:
            val = kwargs.get(p.key, p.default)
            # Type coercion
            if p.type == "int": val = int(val)
            elif p.type == "float": val = float(val)
            elif p.type == "bool": val = bool(val) if not isinstance(val, (int, float)) else bool(val)
            self._values[p.key] = val

    def p(self, key: str) -> Any:
        """Get a parameter value by key."""
        return self._values[key]

    def calc(self, df) -> dict:
        """
        Run the indicator calculation.
        
        Args:
            df: pandas DataFrame with columns: open, high, low, close, volume, time
            
        Returns:
            dict with keys matching the output definitions.
            For backtesting, also accessible as a plain dict.
        """
        raise NotImplementedError(f"{self.__class__.__name__}.calc() not implemented")

    def signals(self, df) -> dict:
        """
        Optional: return trading signals derived from the indicator.
        Override in subclasses for backtesting integration.
        """
        return {}

    # ── Schema generation ──

    @classmethod
    def schema(cls) -> dict:
        """Auto-generate JSON schema for browser settings UI."""
        return {
            "key": cls.key,
            "name": cls.name,
            "group": cls.group,
            "description": cls.description,
            "params": [p.to_schema() for p in cls.params],
            "colors": [c.to_schema() for c in cls.colors],
            "outputs": [o.to_schema() for o in cls.outputs],
        }

    def __repr__(self):
        return f"{self.__class__.__name__}({self._values})"
