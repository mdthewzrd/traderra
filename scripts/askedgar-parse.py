#!/usr/bin/env python3
"""
AskEdgar reverse-engineering parser (Build 1).

Input:  the imported research reports CSV.
Output: a clean JSONL of (ticker, date, cited_cash, cited_burn, cited_runway,
        dilution_pct, risk_labels) + coverage + formula-verification stats.

Methodology (see BUILD2-NOTES.md):
  - Parse prose for cited numbers, anchored to the "Cash Need" section body.
  - POSITION-BASED figure assignment: find all $-figures in the body line,
    assign the nearest to "cash" token = cited_cash, nearest to "burn" = cited_burn.
    Handles varied phrasing: "Cash $3.8M", "$0.13M cash", "Cash just $0.2M".
  - Normalize annual burn -> quarterly (/4) where body says "annual burn".
  - VERIFY the documented formula (estimated_cash/quarterly_burn*3) on real data.
  - Where it verifies, the cited cash IS AskEdgar's estimated_cash -> diff vs raw
    XBRL to isolate their adjustment.

Run:  python3 scripts/askedgar-parse.py   (summary on stdout, writes JSONL)
"""
import csv, json, re

CSV_PATH = "/home/mdwzrd/.wzrd-pi-dev/uploads/1782653194528-0-imported_research_reports _2_ _1_.csv"
OUT_PATH = "/tmp/ae_extracted.jsonl"

# --- scale helpers ---
SCALE = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}
def to_num(raw, suffix):
    if raw is None: return None
    try: v = float(str(raw).replace(",", ""))
    except: return None
    return v * SCALE.get((suffix or "").upper(), 1)

# --- figures + tokens (position-based assignment) ---
RE_FIGURE = re.compile(r"\$\s*([\d,.]+)\s*([KMBT]?)", re.I)
RE_CASH_TOKEN = re.compile(r"\bcash(?:\s+position|)\b", re.I)
RE_BURN_TOKEN = re.compile(r"\b(?:quarterly|annual|monthly)?\s*(?:cash\s+)?burn(?:s|ing|rate)?\b", re.I)
RE_RUNWAY = re.compile(
    r"~?\s*(\d+(?:\.\d+)?)\s*(?:[-\u2013\u2011to]+\s*(\d+(?:\.\d+)?)\s*)?months?\s+(?:runway|of\s+cash|left|remaining)"
    r"|(?:runway\s+of|cash\s+for)\s+(\d+(?:\.\d+)?)\s*months?",
    re.I,
)
RE_DILPCT = re.compile(
    r"(~\u2248>?~?\s*)?(\d+(?:\.\d+)?)\s*%\s*(share\s+count\s+growth|dilution|over[- ]issuance|share\s+expansion|overhang|diluted)",
    re.I,
)

def _all_figures(scope):
    """Return list of (val, pos) for all $figures in scope."""
    out = []
    for m in RE_FIGURE.finditer(scope):
        val = to_num(m.group(1), m.group(2))
        if val is not None: out.append((val, m.start()))
    return out

def _nearest(token_re, scope, exclude_pos=None):
    """Nearest $figure to token, optionally excluding a position (avoid cash==burn)."""
    tok = token_re.search(scope)
    if not tok: return None
    tok_pos = tok.start()
    best = None
    for val, pos in _all_figures(scope):
        if exclude_pos is not None and abs(pos - exclude_pos) < 5: continue
        dist = abs(pos - tok_pos)
        if best is None or dist < best[1]:
            best = (val, dist, pos)
    return best

def extract(text):
    """Return dict of cited fields. Position-based figure assignment in Cash Need body."""
    out = {"cited_cash": None, "cited_burn": None, "cited_runway": None, "dilution_pct": None}
    # Scope to the Cash Need section body.
    m_sec = re.search(r"\*?\*?\s*Cash Need\b", text, re.I)
    if m_sec:
        body = text[m_sec.end(): m_sec.end() + 380]
        # cut at the next section header (**...** on its own line)
        m_next = re.search(r"\n\s*\*?\*?[A-Z][^\n]{1,40}\*?\*?\s*\n", body)
        if m_next: body = body[: m_next.start()]
    else:
        body = text[:400]
    # normalize dashes
    body = body.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-").replace("\u2248", "~")
    # cash: nearest $figure to "cash" token
    cf = _nearest(RE_CASH_TOKEN, body)
    cash_pos = cf[2] if cf else None
    if cf: out["cited_cash"] = cf[0]
    # burn: nearest $figure to "burn" token, excluding the cash figure position
    bf = _nearest(RE_BURN_TOKEN, body, exclude_pos=cash_pos)
    if bf:
        burn = bf[0]
        # if body says "annual burn" near the figure, normalize to quarterly (/4)
        burn_ctx = body[max(0, bf[2]-30): bf[2]+30]
        if re.search(r"\bannual\b", burn_ctx, re.I) or re.search(r"\b/\s*year\b", burn_ctx, re.I):
            burn = burn / 4.0
        out["cited_burn"] = burn
    # runway
    mr = RE_RUNWAY.search(body)
    if mr:
        v = mr.group(1) or mr.group(3)
        try: out["cited_runway"] = float(v)
        except: pass
    # dilution % is global, not scoped
    md = RE_DILPCT.search(text)
    if md:
        try: out["dilution_pct"] = float(md.group(2))
        except: pass
    return out

def main():
    rows = list(csv.DictReader(open(CSV_PATH)))
    extracted = []
    cov = {"cash": 0, "burn": 0, "runway": 0, "dilpct": 0, "all3": 0}
    for row in rows:
        try: d = json.loads(row["parsed_json"])
        except: d = {}
        ex = extract(row["raw_text"])
        rec = {
            "ticker": row["ticker"], "report_date": (row.get("report_date") or "")[:10],
            "cashBurnRisk": d.get("cashBurnRisk"), "dilutionRisk": d.get("dilutionRisk"),
            "offeringRisk": d.get("offeringRisk"),
            **ex,
        }
        extracted.append(rec)
        if ex["cited_cash"] is not None: cov["cash"] += 1
        if ex["cited_burn"] is not None: cov["burn"] += 1
        if ex["cited_runway"] is not None: cov["runway"] += 1
        if ex["dilution_pct"] is not None: cov["dilpct"] += 1
        if ex["cited_cash"] is not None and ex["cited_burn"] is not None and ex["cited_runway"] is not None:
            cov["all3"] += 1

    with open(OUT_PATH, "w") as fh:
        for r in extracted: fh.write(json.dumps(r) + "\n")

    # formula verification on rows with all 3
    ver = []
    for r in extracted:
        if None in (r["cited_cash"], r["cited_burn"], r["cited_runway"]): continue
        if r["cited_burn"] <= 0: continue
        recompute = r["cited_cash"] / r["cited_burn"] * 3
        ver.append({"ticker": r["ticker"], "cited": r["cited_runway"], "recompute": recompute,
                    "delta": abs(recompute - r["cited_runway"]), "cash": r["cited_cash"], "burn": r["cited_burn"]})

    print(f"===== BUILD 1 PARSE COVERAGE (n={len(rows)}) =====")
    for k, v in cov.items(): print(f"  {k:8}: {v:5} ({100*v/len(rows):.1f}%)")
    print(f"\n===== FORMULA VERIFICATION (rows with all 3: {len(ver)}) =====")
    if ver:
        within = [x for x in ver if x["delta"] <= 1.5]
        print(f"  cited_runway \u2248 cited_cash/cited_burn*3 within 1.5mo: {len(within)}/{len(ver)} ({100*len(within)/len(ver):.0f}%)")
        print(f"  sample (verified):")
        for x in within[:5]: print(f"    {x['ticker']:5} cash ${x['cash']/1e6:.2f}M burn ${x['burn']/1e6:.2f}M/qrtr \u2192 cited {x['cited']:.1f}mo vs recompute {x['recompute']:.1f}mo")
        bad = [x for x in ver if x["delta"] > 1.5]
        if bad:
            print(f"  OUTLIERS ({len(bad)}):")
            for x in bad[:5]: print(f"    {x['ticker']:5} cited {x['cited']:.1f}mo vs recompute {x['recompute']:.1f}mo (cash ${x['cash']/1e6:.2f}M burn ${x['burn']/1e6:.2f}M)")

if __name__ == "__main__":
    main()
