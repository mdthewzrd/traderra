#!/usr/bin/env python3
"""
Parity Test — verifies JS and Python indicator calculations match.
Run: python3 tests/test_parity.py

Tests that Python indicators produce the same results as JS calc functions
for a given OHLCV dataset. Since JS runs in the browser, we compute both
in Python using the same math and compare.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
import numpy as np
import pandas as pd
from traderra_indicators import REGISTRY

def make_test_data(n=500, seed=42):
    """Generate realistic OHLCV test data."""
    np.random.seed(seed)
    base = 150 + np.cumsum(np.random.randn(n) * 0.8)
    opens = base + np.random.randn(n) * 0.3
    closes = base + np.random.randn(n) * 0.3
    highs = np.maximum(opens, closes) + abs(np.random.randn(n)) * 0.4
    lows = np.minimum(opens, closes) - abs(np.random.randn(n)) * 0.4
    volumes = np.random.randint(5000, 50000, n).astype(float)
    return pd.DataFrame({
        'time': range(n), 'open': opens, 'high': highs,
        'low': lows, 'close': closes, 'volume': volumes
    })

# ── JS-equivalent calculations in Python ──

def js_ema(data, period):
    """Match JS calcEMA exactly."""
    k = 2 / (period + 1)
    ema = None
    out = []
    for b in data:
        c = b['close']
        ema = c if ema is None else c * k + ema * (1 - k)
        out.append(round(ema, 4))
    return out

def js_sma(data, period):
    """Match JS calcSMA exactly."""
    out = []
    s = 0
    for i, b in enumerate(data):
        s += b['close']
        if i >= period:
            s -= data[i - period]['close']
        out.append(round(s / period, 4) if i >= period - 1 else None)
    return out

def js_atr_sma(data, period):
    """Match JS calcATRSMA exactly."""
    trs = []
    for i, b in enumerate(data):
        pc = data[i-1]['close'] if i > 0 else b['open']
        trs.append(max(b['high'] - b['low'], abs(b['high'] - pc), abs(b['low'] - pc)))
    out = []
    for i in range(len(trs)):
        if i < period - 1:
            out.append(None)
        else:
            s = sum(trs[i-period+1:i+1])
            out.append(round(s / period, 4))
    return out

def js_bollinger(data, period, mult):
    """Match JS calcBollinger exactly."""
    sma = js_sma(data, period)
    upper, lower = [], []
    for i in range(len(data)):
        if sma[i] is None:
            upper.append(None); lower.append(None)
            continue
        ss = sum((data[j]['close'] - sma[i]) ** 2 for j in range(i - period + 1, i + 1))
        std = (ss / period) ** 0.5
        upper.append(round(sma[i] + std * mult, 4))
        lower.append(round(sma[i] - std * mult, 4))
    return {'upper': upper, 'middle': sma, 'lower': lower}


def compare_arrays(js_arr, py_arr, label, tol=0.05):
    """Compare two arrays, skipping leading None values."""
    errors = 0
    max_diff = 0
    compared = 0
    for i in range(len(js_arr)):
        jv = js_arr[i] if i < len(js_arr) else None
        pv = py_arr[i] if i < len(py_arr) else None
        if jv is None or pv is None:
            continue
        diff = abs(jv - pv)
        max_diff = max(max_diff, diff)
        if diff > tol:
            errors += 1
            if errors <= 3:
                print(f"  MISMATCH @{i}: JS={jv} PY={pv} diff={diff:.4f}")
        compared += 1
    status = "✅" if errors == 0 else f"❌ ({errors}/{compared} mismatches)"
    print(f"  {label}: {status} (max_diff={max_diff:.4f}, compared={compared})")
    return errors == 0


def run_tests():
    df = make_test_data()
    data = df.to_dict('records')
    all_pass = True

    # ── Test 1: EMA parity ──
    print("\n=== EMA Parity ===")
    for period in [9, 20, 50, 200]:
        js = js_ema(data, period)
        ind = REGISTRY['ema'](period=period)
        py_result = ind.calc(df)
        py = py_result['values']
        ok = compare_arrays(js, py, f'EMA({period})')
        all_pass = all_pass and ok

    # ── Test 2: SMA parity ──
    print("\n=== SMA Parity ===")
    for period in [20, 50]:
        js = js_sma(data, period)
        ind = REGISTRY['sma'](period=period)
        py_result = ind.calc(df)
        py = py_result['values']
        ok = compare_arrays(js, py, f'SMA({period})')
        all_pass = all_pass and ok

    # ── Test 3: Bollinger Bands parity ──
    print("\n=== Bollinger Bands Parity ===")
    js_bb = js_bollinger(data, 20, 2)
    ind = REGISTRY['bollinger'](period=20, stddev=2)
    py_bb = ind.calc(df)
    ok = compare_arrays(js_bb['upper'], py_bb['upper'], 'BB Upper')
    all_pass = all_pass and ok
    ok = compare_arrays(js_bb['lower'], py_bb['lower'], 'BB Lower')
    all_pass = all_pass and ok

    # ── Test 4: EMA Band parity ──
    print("\n=== EMA Band Parity ===")
    js_e9 = js_ema(data, 9)
    js_e20 = js_ema(data, 20)
    ind = REGISTRY['ema_band'](fast=9, slow=20)
    py_result = ind.calc(df)
    ok = compare_arrays(js_e9, py_result['upper'], 'Band Upper (EMA9)')
    all_pass = all_pass and ok
    ok = compare_arrays(js_e20, py_result['lower'], 'Band Lower (EMA20)')
    all_pass = all_pass and ok

    # ── Test 5: Deviation Bands parity ──
    print("\n=== Deviation Bands Parity ===")
    js_e9 = js_ema(data, 9)
    js_e20 = js_ema(data, 20)
    js_atr9 = js_atr_sma(data, 9)
    js_atr20 = js_atr_sma(data, 20)
    ind = REGISTRY['deviation'](fast=9, slow=20, up_low=0.5, up_high=1.0, dn_low=2.0, dn_high=2.4)
    py_result = ind.calc(df)
    
    # JS computes: up1 = fastEMA + fastATR * upLow
    js_up1 = [round(js_e9[i] + (js_atr9[i] or 0) * 0.5, 4) if js_e9[i] is not None else None for i in range(len(data))]
    ok = compare_arrays(js_up1, py_result['up1'], 'Dev Up1')
    all_pass = all_pass and ok

    # ── Test 6: PDC parity ──
    print("\n=== PDC Parity ===")
    ind = REGISTRY['pdc']()
    py_result = ind.calc(df)
    print(f"  PDC value: {py_result.get('value')} (expected: last bar's prior close)")
    print(f"  ✅ PDC computed (value check is manual)")

    # ── Test 7: Volume parity ──
    print("\n=== Volume Parity ===")
    ind = REGISTRY['vol'](sma_len=20)
    py_result = ind.calc(df)
    print(f"  Volume up bars: {len(py_result['up'])}")
    print(f"  Volume down bars: {len(py_result['down'])}")
    print(f"  Volume SMA: {len(py_result['sma'])}")
    assert len(py_result['up']) == len(data), "Volume length mismatch"
    print(f"  ✅ Volume arrays match data length")

    # ── Summary ──
    print(f"\n{'='*50}")
    if all_pass:
        print("✅ ALL PARITY TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED — see mismatches above")
    return all_pass


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
