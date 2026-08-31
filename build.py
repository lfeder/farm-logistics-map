"""Build index.html from legs.csv, reference.json, orders.json and viewer/.

Three files, split by how often they change rather than by what they describe:

    legs.csv        THE schedule. One row per leg of a journey. Pulled from the
                    Google Sheet named in reference.json when that is reachable,
                    and committed either way so the diff shows what changed and
                    the page has something to draw with no network.

                    The built page reads the sheet itself on every load, so a
                    schedule edit needs no build -- a refresh is enough. This
                    snapshot is the fallback, and running the build is how it
                    gets caught up.
    reference.json  Quasi-static and hand-edited: what a journey is, who is open
                    when, which boat goes where. Months between edits.
    orders.json     Pulled, not typed. Cases and pounds on order by destination,
                    and the pack line's case counts, copied out of the freight
                    model's data.json. Refresh it there, not here.

    python3 build.py

Reads the sheet over the network; needs no credentials.
"""
import csv
import io
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
ICONS = {"box", "truck", "plane", "ship", "depot", "store", "clock"}


def die(f, msg):
    sys.exit("%s: %s" % (f, msg))


def read(name, need):
    path = os.path.join(HERE, name)
    with open(path, newline="") as fh:
        rows = [r for r in csv.DictReader(fh)]
    if not rows:
        die(name, "no rows")
    missing = [c for c in need if c not in rows[0]]
    if missing:
        die(name, "missing column%s: %s" % ("" if len(missing) == 1 else "s", ", ".join(missing)))
    return rows


REF = json.load(open(os.path.join(HERE, "reference.json")))

# ── the sheet ────────────────────────────────────────────────────────────────
# legs.csv is the committed snapshot; the sheet is where it is edited. Pull on
# every build so the two cannot drift, fall back to the snapshot when the
# network is not there, and always write what was pulled so the change shows up
# in the diff rather than only on the screen.
SHEET_COLS = {"journey": "journey", "start day": "start_day", "branch": "branch",
              "leg": "leg", "start location": "start_location", "start dt": "start_dt",
              "end location": "end_location", "end dt": "end_dt",
              "icon": "icon", "note": "note"}


def pull_sheet(url):
    with urllib.request.urlopen(url, timeout=20) as fh:
        body = fh.read().decode("utf-8")
    rows = [r for r in csv.reader(io.StringIO(body))]
    # The sheet has its own margins: blank leading columns and blank rows above
    # the header. Find the header by looking for the row that names a journey.
    head_i = next((i for i, r in enumerate(rows)
                   if any((c or "").strip().lower() == "journey" for c in r)), None)
    if head_i is None:
        raise ValueError("no header row with a 'Journey' column")
    head = [(c or "").strip().lower() for c in rows[head_i]]
    keep = [(i, SHEET_COLS[h]) for i, h in enumerate(head) if h in SHEET_COLS]
    missing = [v for v in ("journey", "leg", "start_dt", "end_dt") if v not in [k[1] for k in keep]]
    if missing:
        raise ValueError("sheet is missing: " + ", ".join(missing))
    out = []
    for r in rows[head_i + 1:]:
        rec = {name: (r[i].strip() if i < len(r) and r[i] else "") for i, name in keep}
        if rec.get("journey") and rec.get("leg"):
            out.append(rec)
    return out


# A leg's icon is read off its name rather than typed, so the sheet stays four
# columns of schedule and a new leg picks up a sensible glyph on its own.
# Order matters: the first pattern that matches wins, so the specific ones come
# before the general. "Costco delivery clearance" is a clearance, not a delivery.
ICON_RULES = [
    (r"clearance|eligib|submission|paperwork", "depot"),
    (r"pack", "box"),
    (r"fl(y|ight)|aloha|air\b", "plane"),
    (r"sail|barge|boat", "ship"),
    (r"truck|deliver|pickup|haul|drive|load", "truck"),
    (r"receiv|store", "store"),
]


def icon_for(name):
    low = (name or "").lower()
    for pat, ic in ICON_RULES:
        if re.search(pat, low):
            return ic
    return "clock"


sheet_url = (REF.get("legs_sheet") or "").strip()
if sheet_url:
    try:
        pulled = pull_sheet(sheet_url)
        cols = ["journey", "start_day", "branch", "leg", "start_location",
                "start_dt", "end_location", "end_dt", "icon", "note"]
        for r in pulled:
            r["icon"] = r.get("icon") or icon_for(r.get("leg"))
        with open(os.path.join(HERE, "legs.csv"), "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            for r in pulled:
                w.writerow({c: r.get(c, "") for c in cols})
        print("pulled %d legs from the sheet" % len(pulled))
    except Exception as e:
        print("sheet unreachable (%s) — using the committed legs.csv" % e)


def hhmm(s, f, where):
    m = re.match(r"^(\d{1,2}):(\d{2})$", (s or "").strip())
    if not m:
        die(f, "%s: expected a time like 06:00, got %r" % (where, s))
    h, mn = int(m.group(1)), int(m.group(2))
    if h > 23 or mn > 59:
        die(f, "%s: %r is not a time" % (where, s))
    return h + mn / 60.0


def days_mask(spec, f, where):
    """'Mon-Fri', 'Sun-Sat', or 'Mon; Wed; Fri'."""
    mask = [0] * 7
    spec = (spec or "").strip()
    if not spec:
        die(f, "%s: no days given" % where)
    for part in re.split(r"[;,]", spec):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = [x.strip()[:3].title() for x in part.split("-", 1)]
            if a not in DOW or b not in DOW:
                die(f, "%s: %r is not a day range" % (where, part))
            i, j, k = DOW.index(a), DOW.index(b), DOW.index(a)
            while True:
                mask[k] = 1
                if k == j:
                    break
                k = (k + 1) % 7
        else:
            d = part[:3].title()
            if d not in DOW:
                die(f, "%s: %r is not a day" % (where, part))
            mask[DOW.index(d)] = 1
    return mask


# ── hours, keyed by place ────────────────────────────────────────────────────
# A window belongs to a place, and the place names in legs.csv are the same
# names, so there is one namespace and a leg's lane picks up its own hours.
hours, hours_order = {}, []
for r in REF.get("hours", []):
    p = (r.get("place") or "").strip()
    if not p:
        continue
    if p in hours:
        die("reference.json", "hours: %r appears twice" % p)
    hours[p] = {"place": p, "days": days_mask(r.get("days"), "reference.json", p),
                "open": hhmm(r.get("open"), "reference.json", p),
                "close": hhmm(r.get("close"), "reference.json", p),
                "lead": int(r.get("after_arrival") or 0),
                "note": (r.get("note") or "").strip()}
    hours_order.append(p)

sailings = []
for r in REF.get("sailings", []):
    if not (r.get("route") or "").strip():
        continue
    sailings.append({"route": r["route"].strip(), "departs": (r.get("departs") or "").strip(),
                     "arrives": (r.get("arrives") or "").strip(),
                     "connects": (r.get("connects") or "").strip(),
                     "note": (r.get("note") or "").strip()})

# ── what gets embedded ──────────────────────────────────────────────────────
# The schedule goes in as the CSV text it already is. The viewer turns rows
# into journeys, from the sheet when it can reach it and from this snapshot
# when it cannot, so those rules live in exactly one place and this file no
# longer has an opinion about them.
legs_text = open(os.path.join(HERE, "legs.csv")).read()

data = json.load(open(os.path.join(HERE, "orders.json")))
# journeys says what a journey IS -- where it delivers and what carries it --
# as against the sheet, which says when it runs. The picker in the viewer is
# built from whatever values turn up here.
ref = {"hours": [hours[p] for p in hours_order], "sailings": sailings,
       "journeys": REF.get("journeys", {})}

shell = open(os.path.join(HERE, "viewer", "index.html")).read()
out = (shell
       .replace("/*__LEGS__*/", json.dumps(legs_text))
       .replace("/*__SHEET__*/", json.dumps(sheet_url))
       .replace("/*__REF__*/", json.dumps(ref, separators=(",", ":")))
       .replace("/*__DATA__*/", json.dumps(data, separators=(",", ":")))
       .replace("<style>/*__CSS__*/</style>",
                "<style>\n%s\n</style>" % open(os.path.join(HERE, "viewer", "style.css")).read())
       .replace("/*__JS__*/", open(os.path.join(HERE, "viewer", "app.js")).read()))

path = os.path.join(HERE, "index.html")
with open(path, "w") as fh:
    fh.write(out)

print("%d places with hours, %d sailings" % (len(hours), len(sailings)))
print("%d order rows, %s to %s" % (len(data["sales"]), data["window"]["first"], data["window"]["last"]))
print("wrote %s (%.0f KB)" % (path, len(out) / 1024))
