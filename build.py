"""Build index.html from the CSVs, data.json and viewer/.

A journey is a set of legs and nothing else, so the thing you edit to change a
schedule is a spreadsheet:

    journeys.csv   one row per journey: its name, its cut days, a note
    legs.csv       one row per leg: where it is, when it starts, when it stops
    hours.csv      one row per place: the hours somebody will take it
    sailings.csv   one row per boat: when it goes and what it connects to

    python3 build.py

Touches no network and needs no credentials. data.json is copied out of the
freight model; refresh it there.
"""
import csv
import json
import os
import re
import sys

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


# Su M T W Th F Sa, and the longer forms. A bare S is not accepted: it could be
# either end of the week and a schedule is not the place to guess.
DAY_WORDS = {"su": 0, "sun": 0, "sunday": 0,
             "m": 1, "mo": 1, "mon": 1, "monday": 1,
             "t": 2, "tu": 2, "tue": 2, "tues": 2, "tuesday": 2,
             "w": 3, "we": 3, "wed": 3, "wednesday": 3,
             "th": 4, "thu": 4, "thur": 4, "thurs": 4, "thursday": 4,
             "f": 5, "fr": 5, "fri": 5, "friday": 5,
             "sa": 6, "sat": 6, "saturday": 6}


def day_time(s, f, where):
    """'M 06:00' -> (weekday index, hour of day)."""
    m = re.match(r"^([A-Za-z]+)\s+(\d{1,2}:\d{2})$", (s or "").strip())
    if not m:
        die(f, "%s: expected a day and a time like 'M 06:00', got %r" % (where, s))
    w = m.group(1).lower()
    if w == "s":
        die(f, "%s: 'S' could be Sunday or Saturday — write Su or Sa" % where)
    if w not in DAY_WORDS:
        die(f, "%s: %r is not a day" % (where, m.group(1)))
    return DAY_WORDS[w], hhmm(m.group(2), f, where)


def after(dw, hod, floor):
    """The first hour at or after `floor` that lands on that weekday at that
    time, counting from the journey's own first day. A journey that runs Sunday
    to Friday is five days long, not five days minus a modulo."""
    base = int(floor // 24) * 24
    for i in range(0, 60):
        h = base + i * 24 + hod
        if h >= floor - 1e-9 and ((ANCHOR_IDX + int(h // 24)) % 7) == dw:
            return h
    return floor


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "flow"


# ── hours, keyed by place ────────────────────────────────────────────────────
# A window belongs to a place, and the place name in legs.csv is the same name,
# so there is one namespace and a leg's lane picks up its own hours.
hours = {}
hours_order = []
for r in read("hours.csv", ["place", "days", "open", "close"]):
    p = (r["place"] or "").strip()
    if not p:
        continue
    if p in hours:
        die("hours.csv", "%r appears twice" % p)
    hours[p] = {"place": p, "days": days_mask(r["days"], "hours.csv", p),
                "open": hhmm(r["open"], "hours.csv", p),
                "close": hhmm(r["close"], "hours.csv", p),
                "lead": int(re.sub(r"[^0-9]", "", r.get("after_arrival") or "") or 0),
                "note": (r.get("note") or "").strip()}
    hours_order.append(p)

sailings = []
for r in read("sailings.csv", ["route", "departs", "arrives"]):
    if not (r["route"] or "").strip():
        continue
    sailings.append({"route": r["route"].strip(), "departs": (r["departs"] or "").strip(),
                     "arrives": (r["arrives"] or "").strip(),
                     "connects": (r.get("connects") or "").strip(),
                     "note": (r.get("note") or "").strip()})

# ── journeys and their legs ──────────────────────────────────────────────────
flows, by_name = [], {}
for r in read("journeys.csv", ["journey"]):
    nm = (r["journey"] or "").strip()
    if not nm:
        continue
    f = {"id": slug(nm), "name": nm, "note": (r.get("note") or "").strip(), "tasks": []}
    flows.append(f)
    by_name[nm] = f

for r in read("legs.csv", ["journey", "leg", "place", "starts", "stops"]):
    jn = (r["journey"] or "").strip()
    if not jn and not (r["leg"] or "").strip():
        continue
    if jn not in by_name:
        die("legs.csv", "%r is not a journey in journeys.csv" % jn)
    f = by_name[jn]
    where = "%s / %s" % (jn, r["leg"])
    icon = (r.get("icon") or "clock").strip().lower() or "clock"
    if icon not in ICONS:
        die("legs.csv", "%s: %r is not an icon (%s)" % (where, icon, ", ".join(sorted(ICONS))))
    f["tasks"].append({"id": "t%d" % len(f["tasks"]), "name": r["leg"].strip(),
                       "place": (r["place"] or "Somewhere").strip(),
                       "_s": day_time(r["starts"], "legs.csv", where),
                       "_e": day_time(r["stops"], "legs.csv", where),
                       "icon": icon, "note": (r.get("note") or "").strip(),
                       "_after": r.get("after") or ""})

for f in flows:
    if not f["tasks"]:
        die("legs.csv", "%r has no legs" % f["name"])
    # The first leg sets the week. Every time after it is the next occurrence of
    # its weekday, walking forward, so a journey that crosses a Sunday keeps
    # going instead of wrapping back to the start.
    ANCHOR_IDX = f["tasks"][0]["_s"][0]
    f["anchor"] = DOW[ANCHOR_IDX]
    globals()["ANCHOR_IDX"] = ANCHOR_IDX
    floor = 0.0
    for t in f["tasks"]:
        t["s"] = after(t["_s"][0], t["_s"][1], floor)
        t["e"] = after(t["_e"][0], t["_e"][1], t["s"])
        floor = t["s"]
        del t["_s"], t["_e"]
    # Prereqs are written by name, because a column of ids is unreadable.
    ids = {t["name"]: t["id"] for t in f["tasks"]}
    for t in f["tasks"]:
        out = []
        for nm in [x.strip() for x in re.split(r"[;,]", t.pop("_after")) if x.strip()]:
            if nm not in ids:
                die("legs.csv", "%s: %r comes after %r, which is not a leg of that journey"
                    % (f["name"], t["name"], nm))
            out.append(ids[nm])
        t["after"] = out
    # Each place a leg lands in picks up its own hours, if anybody wrote them.
    f["windows"] = {}
    for t in f["tasks"]:
        if t["place"] in hours:
            w = hours[t["place"]]
            f["windows"][t["place"]] = {"days": w["days"], "open": w["open"], "close": w["close"]}

data = json.load(open(os.path.join(HERE, "data.json")))
ref = {"hours": [hours[p] for p in hours_order], "sailings": sailings}

shell = open(os.path.join(HERE, "viewer", "index.html")).read()
out = (shell
       .replace("/*__FLOWS__*/", json.dumps(flows, separators=(",", ":")))
       .replace("/*__REF__*/", json.dumps(ref, separators=(",", ":")))
       .replace("/*__DATA__*/", json.dumps(data, separators=(",", ":")))
       .replace("<style>/*__CSS__*/</style>",
                "<style>\n%s\n</style>" % open(os.path.join(HERE, "viewer", "style.css")).read())
       .replace("/*__JS__*/", open(os.path.join(HERE, "viewer", "app.js")).read()))

path = os.path.join(HERE, "index.html")
with open(path, "w") as fh:
    fh.write(out)

for f in flows:
    unknown = sorted({t["place"] for t in f["tasks"]} - set(hours))
    print("%-28s %2d legs from %s, %d places%s"
          % (f["name"], len(f["tasks"]), f["anchor"], len(f["windows"]),
             "" if not unknown else "  (no hours for: %s)" % ", ".join(unknown)))
print("%d places with hours, %d sailings" % (len(hours), len(sailings)))
print("%d order rows, %s to %s" % (len(data["sales"]), data["window"]["first"], data["window"]["last"]))
print("wrote %s (%.0f KB)" % (path, len(out) / 1024))
