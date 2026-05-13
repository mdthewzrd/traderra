"""
MDR Scanner — Multi-Day Runner Detection
Scans US equities for stocks with multi-day momentum runs.
Criteria: 2+ consecutive days of 20%+ gains with increasing volume.
"""

import requests
import os
import json
from datetime import datetime, timedelta


def get_trading_dates(start, end):
    """Generate weekday dates between start and end."""
    dates = []
    d = datetime.strptime(start, "%Y-%m-%d")
    end_d = datetime.strptime(end, "%Y-%m-%d")
    while d <= end_d:
        if d.weekday() < 5:
            dates.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
    return dates


def fetch_grouped_daily(date, api_key):
    """Fetch grouped daily bars for all tickers on a given date."""
    url = f"https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/{date}?adjusted=true&apiKey={api_key}"
    r = requests.get(url, timeout=30)
    if r.status_code != 200:
        return {}
    data = r.json()
    if not data.get("results"):
        return {}
    return {
        b["T"]: {
            "date": date,
            "open": b["o"], "high": b["h"], "low": b["l"], "close": b["c"],
            "volume": b["v"], "vwap": b.get("vw", b["c"]),
        }
        for b in data["results"]
        if b.get("T") and len(b["T"]) <= 5 and "." not in b["T"]
    }


def scan(from_date, to_date, filter_mode):
    """Run MDR scan across date range."""
    api_key = os.environ.get("POLYGON_API_KEY")
    if not api_key:
        raise ValueError("No POLYGON_API_KEY found in environment")

    dates = get_trading_dates(from_date, to_date)
    if len(dates) < 3:
        return []

    # Fetch grouped daily bars for each date
    day_maps = {}
    for i, date in enumerate(dates):
        print(f"Fetching {date} ({i+1}/{len(dates)})...")
        bars = fetch_grouped_daily(date, api_key)
        day_maps[date] = bars
        import time
        time.sleep(0.25)  # Rate limit

    # Scan for multi-day runners
    results = []
    for i in range(len(dates) - 1):
        date = dates[i]
        prev_date = dates[i - 1] if i > 0 else None
        next_date = dates[i + 1] if i < len(dates) - 1 else None

        day_bars = day_maps.get(date, {})
        prev_bars = day_maps.get(prev_date, {}) if prev_date else {}

        for ticker, bar in day_bars.items():
            if bar["close"] < 1.0 or bar["volume"] < 100000:
                continue

            # Dollar volume filter
            dol_vol = bar["close"] * bar["volume"]

            # Day change
            prev = prev_bars.get(ticker)
            if not prev:
                continue

            day_change = ((bar["close"] - prev["close"]) / prev["close"]) * 100

            # Only look at big movers (20%+)
            if day_change < 20:
                continue

            # Check if this is part of a multi-day run (previous day also up big)
            prev_prev_date = dates[i - 2] if i >= 2 else None
            prev_prev_bars = day_maps.get(prev_prev_date, {}) if prev_prev_date else {}
            prev_prev = prev_prev_bars.get(ticker)

            prev_day_change = 0
            consecutive_days = 1
            if prev_prev:
                prev_day_change = ((prev["close"] - prev_prev["close"]) / prev_prev["close"]) * 100
                if prev_day_change >= 15:
                    consecutive_days = 2

            # Volume surge check
            avg_vol = prev["volume"] if prev else bar["volume"]
            vol_surge = bar["volume"] / avg_vol if avg_vol > 0 else 1

            results.append({
                "ticker": ticker,
                "date": date,
                "close": round(bar["close"], 2),
                "open": round(bar["open"], 2),
                "high": round(bar["high"], 2),
                "low": round(bar["low"], 2),
                "volume": bar["volume"],
                "d1DolVol": round(dol_vol),
                "dayChange": round(day_change, 1),
                "prevDayChange": round(prev_day_change, 1),
                "consecutiveDays": consecutive_days,
                "volSurge": round(vol_surge, 1),
                "prevClose": round(prev["close"], 2),
            })

    # Sort by dollar volume (hottest first)
    results.sort(key=lambda x: x["d1DolVol"], reverse=True)
    print(f"Found {len(results)} MDR candidates")
    return results[:100]


results = scan(SCAN_FROM, SCAN_TO, SCAN_FILTER_MODE)
