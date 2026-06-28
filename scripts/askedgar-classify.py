#!/usr/bin/env python3
"""
AskEdgar classifier clone (Build 1b).

Goal: reproduce AskEdgar's 3 risk labels (cashBurnRisk, dilutionRisk,
offeringRisk = low/medium/high) from features extractable at scale.

Features per row:
  - cited_runway     (from prose, 24% coverage)  → cashBurnRisk driver
  - offering_signal  (count of offering/ATM/SEPA/warrant mentions in prose)
  - dilution_signal  (count of dilution/rsplit/share-growth mentions)
  - toxic_signal     (count of "substantial doubt"/going concern/bankruptcy)

Method: for each label, show the feature distribution per class and fit
thresholds that best separate low/medium/high. Report accuracy of the fit.
"""
import csv, json, re, statistics
from collections import defaultdict

CSV_PATH = "/home/mdwzrd/.wzrd-pi-dev/uploads/1782653194528-0-imported_research_reports _2_ _1_.csv"

# reuse the runway extractor
RE_RUNWAY = re.compile(
    r"(~?\s*(\d+(?:\.\d+)?)\s*(?:[-–to]+\s*(\d+(?:\.\d+)?)\s*)?months?\s+(?:runway|of\s+cash|left|remaining))"
    r"|(?:runway\s+of|cash\s+for)\s*(\d+(?:\.\d+)?)\s*months?", re.I)
def runway(text):
    m_sec = re.search(r"\*?\*?\s*Cash Need\b(.{0,600})", text, re.I | re.S)
    scope = m_sec.group(1) if m_sec else text
    m = RE_RUNWAY.search(scope)
    if not m: return None
    try: return float(m.group(2) or m.group(4))
    except: return None

# mention-count signals (whole text)
def count(text, pattern): return len(re.findall(pattern, text, re.I))
SIG = {
    "offering": r"\boffering\b|\batm\b|at-the-market|registered direct|best efforts|underwrit|prospectus supplement|424[ Bb]",
    "warrant": r"\bwarrants?\b|\bwarrant exerc",
    "sepa": r"standby equity|equity line|SEPA|stock purchase agreement|purchase agreement",
    "convertible": r"\bconvertible\b|note conver",
    "rsplit": r"reverse split|reverse-split|1-for-\d+",
    "dilution": r"\bdilution\b|dilut\w+|share count (?:growth|increase|expansion)|over[- ]issu",
    "toxic": r"substantial doubt|going concern|bankrupt|insolven|default",
}

rows = []
for r in csv.DictReader(open(CSV_PATH)):
    try: d = json.loads(r["parsed_json"])
    except: d = {}
    t = r["raw_text"]
    rec = {
        "ticker": r["ticker"],
        "cashBurnRisk": d.get("cashBurnRisk"),
        "dilutionRisk": d.get("dilutionRisk"),
        "offeringRisk": d.get("offeringRisk"),
        "runway": runway(t),
    }
    for k, pat in SIG.items(): rec[k] = count(t, pat)
    rec["offering_signal"] = rec["offering"] + rec["warrant"] + rec["sepa"] + rec["convertible"]
    rows.append(rec)

def fit(label, feature, max_buckets=12):
    """Show feature distribution per class + suggest thresholds."""
    by = defaultdict(list)
    for r in rows:
        v = r[feature]; lbl = r[label]
        if lbl is None or v is None: continue
        by[lbl].append(v)
    if not by: return None
    print(f"\n===== {label} vs {feature} (n={sum(len(v) for v in by.values())}) =====")
    stats = {}
    for cls in ("low", "medium", "high"):
        if cls not in by: continue
        arr = sorted(by[cls])
        stats[cls] = arr
        med = statistics.median(arr)
        print(f"  {cls:7} n={len(arr):4} | median={med:>8.1f} | p10={arr[len(arr)//10]:>8.1f} | p90={arr[int(len(arr)*0.9)]:>8.1f}")
    return stats

# --- cashBurnRisk: driven by runway (lower runway = higher risk) ---
fit("cashBurnRisk", "runway")

# --- dilutionRisk: driven by dilution/rsplit/offering signals ---
fit("dilutionRisk", "dilution")
fit("dilutionRisk", "rsplit")
fit("dilutionRisk", "offering_signal")

# --- offeringRisk: driven by offering/warrant/sepa signals ---
fit("offeringRisk", "offering")
fit("offeringRisk", "offering_signal")
fit("offeringRisk", "sepa")

# --- toxic signal sanity (should skew high-risk) ---
fit("cashBurnRisk", "toxic")
