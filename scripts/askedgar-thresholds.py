#!/usr/bin/env python3
"""
AskEdgar classifier threshold optimizer (Build 1c).

Fits optimal low/medium/high thresholds for the 2 tractable classifiers:
  cashBurnRisk  ← cited_runway        (286 rows)
  dilutionRisk  ← dilution_pct        (69 rows)

Reports best thresholds + accuracy + confusion matrix. These thresholds become
the clone: apply them to OUR computed features (runway, YoY share growth).
"""
import csv, json, re, statistics
from collections import Counter, defaultdict

CSV_PATH = "/home/mdwzrd/.wzrd-pi-dev/uploads/1782653194528-0-imported_research_reports _2_ _1_.csv"

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

RE_DILPCT = re.compile(r"(\d+(?:\.\d+)?)\s*%\s*(share\s+count\s+growth|dilution|over[- ]issuance|share\s+expansion|overhang|diluted)", re.I)

rows = []
for r in csv.DictReader(open(CSV_PATH)):
    try: d = json.loads(r["parsed_json"])
    except: d = {}
    t = r["raw_text"]
    rw = runway(t)
    md = RE_DILPCT.search(t)
    dil = float(md.group(1)) if md else None
    rows.append({"cashBurnRisk": d.get("cashBurnRisk"), "dilutionRisk": d.get("dilutionRisk"),
                 "runway": rw, "dilpct": dil})

def optimize(label, feature, inverse=False):
    """inverse=True means LOWER feature = higher risk (runway). Else higher=high risk."""
    data = [(r[feature], r[label]) for r in rows if r[feature] is not None and r[label]]
    if len(data) < 20: return f"\n===== {label} ← {feature}: too few rows ({len(data)}) ====="
    # sort by feature value; sweep two thresholds
    best = None
    cands = sorted(set(v for v, _ in data))
    for i in range(1, len(cands)):
        for j in range(i + 1, len(cands)):
            lo_t, hi_t = cands[i], cands[j]  # feature <= lo_t → class A; lo_t< <=hi_t → B; >hi_t → C
            correct = 0
            for v, lbl in data:
                if inverse:
                    pred = "high" if v <= lo_t else ("medium" if v <= hi_t else "low")
                else:
                    pred = "low" if v <= lo_t else ("medium" if v <= hi_t else "high")
                if pred == lbl: correct += 1
            acc = correct / len(data)
            if best is None or acc > best[0]:
                best = (acc, lo_t, hi_t)
    acc, lo_t, hi_t = best
    # confusion matrix at best
    cm = Counter()
    for v, lbl in data:
        if inverse:
            pred = "high" if v <= lo_t else ("medium" if v <= hi_t else "low")
        else:
            pred = "low" if v <= lo_t else ("medium" if v <= hi_t else "high")
        cm[(lbl, pred)] += 1
    out = [f"\n===== {label} ← {feature}  (n={len(data)}, {'inverse' if inverse else ''}) =====",
           f"  BEST thresholds: {'≤'+f'{lo_t:.1f}'+'→high' if inverse else '≤'+f'{lo_t:.1f}'+'→low'}  |  "
           f"{'≤'+f'{hi_t:.1f}'+'→medium' if inverse else '≤'+f'{hi_t:.1f}'+'→medium'}  |  "
           f"rest→{'low' if inverse else 'high'}",
           f"  accuracy: {acc*100:.1f}%",
           f"  confusion (true\\pred):"]
    for tl in ("low", "medium", "high"):
        out.append(f"    true={tl:7} | low={cm[(tl,'low')]:3} medium={cm[(tl,'medium')]:3} high={cm[(tl,'high')]:3}")
    return "\n".join(out)

print(optimize("cashBurnRisk", "runway", inverse=True))
print(optimize("dilutionRisk", "dilpct", inverse=False))

# Also: how many dilutionRisk rows have NO dilpct? (coverage gap)
tot_dr = sum(1 for r in rows if r["dilutionRisk"])
with_dr = sum(1 for r in rows if r["dilutionRisk"] and r["dilpct"] is not None)
print(f"\n[dilutionRisk coverage: {with_dr}/{tot_dr} have a parsed % — the rest need structured share-growth]")
