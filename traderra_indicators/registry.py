"""
Auto-discovers all indicator classes and registers them by key.
"""

from __future__ import annotations
from importlib import import_module
from pathlib import Path
from typing import Type

from .base import BaseIndicator

# Global registry: key -> indicator class
REGISTRY: dict[str, Type[BaseIndicator]] = {}


def register(cls: Type[BaseIndicator]) -> Type[BaseIndicator]:
    """Decorator to register an indicator class."""
    if cls.key:
        REGISTRY[cls.key] = cls
    return cls


def discover_indicators():
    """
    Auto-import all modules in the indicators/ subpackage.
    Each module should use @register on its indicator class.
    """
    pkg_dir = Path(__file__).parent / "indicators"
    if not pkg_dir.exists():
        return
    for py_file in sorted(pkg_dir.glob("*.py")):
        if py_file.name.startswith("_"):
            continue
        module_name = f".indicators.{py_file.stem}"
        try:
            import_module(module_name, package="traderra_indicators")
        except Exception as e:
            print(f"[traderra_indicators] Warning: failed to import {module_name}: {e}")


def get_schema_all() -> dict:
    """Return schemas for all registered indicators."""
    return {key: cls.schema() for key, cls in REGISTRY.items()}
