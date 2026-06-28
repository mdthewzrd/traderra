#!/usr/bin/env python3
"""
Export AskEdgar research reports CSV → normalized JSONL for DB import.
Handles CSV quoting/newlines correctly (raw_text is multiline).
Cleans: strips leading "** " from industry, uppercases ticker.
"""
import csv, json

CSV_PATH = "/home/mdwzrd/.wzrd-pi-dev/uploads/1782653194528-0-imported_research_reports _2_ _1_.csv"
OUT = "/tmp/ae_reports.jsonl"

SCALE = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}

def clean_industry(s):
    if not s: return None
    return s.lstrip("* ").strip() or None

def to_num(v):
    """Coerce JSON field to a clean number. Handles None, number, '1.2M', '1.2 B', '1,234'."""
    if v is None: return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if not s or s.lower() in ("null", "none", "n/a"):
        return None
    # optional scale suffix with or without space (112 M, 1.2B, 5 K)
    import re
    m = re.match(r"^([\d.]+)\s*([KMBT]?)\s*$", s, re.I)
    if m:
        try: return float(m.group(1)) * (SCALE.get(m.group(2).upper(), 1) if m.group(2) else 1)
        except: return None
    try: return float(s)
    except: return None

n = 0
skipped = 0
with open(CSV_PATH) as fh, open(OUT, "w") as out:
    for row in csv.DictReader(fh):
        try: pj = json.loads(row.get("parsed_json") or "{}")
        except: pj = {}
        rd = (row.get("report_date") or row.get("created_at") or "")[:10]
        if not rd:
            skipped += 1
            continue
        # validate date isn't garbage
        y = rd.split("-")
        if len(y) != 3 or not (len(y[0]) == 4 and y[0].isdigit()):
            skipped += 1
            continue
        rec = {
            "id": "ae-" + row["id"],
            "ticker": (row.get("ticker") or "").upper(),
            "reportDate": rd,
            "source": "askedgar",
            "sourceRef": row.get("discord_message_id") or None,
            "price": to_num(pj.get("price")),
            "marketCap": to_num(pj.get("marketCap")),
            "floatShares": to_num(pj.get("floatShares")),
            "outstandingShares": to_num(pj.get("outstandingShares")),
            "gainPercent": to_num(pj.get("gainPercent")),
            "industry": clean_industry(pj.get("industry")),
            "cashBurnRisk": pj.get("cashBurnRisk"),
            "dilutionRisk": pj.get("dilutionRisk"),
            "offeringRisk": pj.get("offeringRisk"),
            "scamRisk": pj.get("scamRisk"),
            "rawText": row.get("raw_text") or "",
            "parsedJson": pj,
        }
        out.write(json.dumps(rec) + "\n")
        n += 1
print(f"exported {n} reports ({skipped} skipped for bad date) → {OUT}")
