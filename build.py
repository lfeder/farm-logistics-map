"""Build index.html from journeys.md, data.json and viewer/.

The journeys are defined in Markdown and nowhere else, so the thing you edit to
change a schedule is a table a person can read. This turns that file plus the
order history into one self-contained page that opens by double-clicking.

    python3 build.py

Touches no network and needs no credentials. data.json is copied out of the
freight model; refresh it there.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
ICONS = {"box", "truck", "plane", "ship", "depot", "store", "clock"}


def die(msg):
    sys.exit("journeys.md: " + msg)


def rows(block):
    """The cells of a Markdown table, header and rule dropped."""
    out = []
    for line in block:
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if all(set(c) <= set("-: ") for c in cells):     # the rule under the header
            continue
        out.append(cells)
    return out[1:] if out else []


def hhmm(s, where):
    m = re.match(r"^(\d{1,2}):(\d{2})$", s.strip())
    if not m:
        die("%s: expected a time like 06:00, got %r" % (where, s))
    h, mn = int(m.group(1)), int(m.group(2))
    if h > 23 or mn > 59:
        die("%s: %r is not a time" % (where, s))
    return h + mn / 60.0


def days_mask(spec, where):
    """'Mon-Fri', 'Sun-Sat', or 'Mon, Wed, Fri'."""
    mask = [0] * 7
    spec = spec.strip()
    if not spec:
        die("%s: no days given" % where)
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = [x.strip()[:3].title() for x in part.split("-", 1)]
            if a not in DOW or b not in DOW:
                die("%s: %r is not a day range" % (where, part))
            i, j = DOW.index(a), DOW.index(b)
            k = i
            while True:
                mask[k] = 1
                if k == j:
                    break
                k = (k + 1) % 7
        else:
            d = part[:3].title()
            if d not in DOW:
                die("%s: %r is not a day" % (where, part))
            mask[DOW.index(d)] = 1
    return mask


def offset_time(s, where):
    """'D1 06:00' -> 30.0 hours from midnight on day 0."""
    m = re.match(r"^[Dd](\d+)\s+(\d{1,2}:\d{2})$", s.strip())
    if not m:
        die("%s: expected a time like 'D1 06:00', got %r" % (where, s))
    return int(m.group(1)) * 24 + hhmm(m.group(2), where)


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "flow"


def parse(md):
    """journeys.md -> the list of flows the viewer reads."""
    # Everything before the first '## ' is the preamble, which is for humans.
    chunks = re.split(r"\n(?=## )", md)
    flows = []
    for chunk in chunks[1:]:
        lines = chunk.split("\n")
        name = lines[0][3:].strip()
        note_lines, cut_days, section, hours, tasks = [], [], None, [], []
        buf = []
        for line in lines[1:]:
            if line.startswith("### "):
                if section == "hours":
                    hours = rows(buf)
                elif section == "tasks":
                    tasks = rows(buf)
                section, buf = line[4:].strip().lower(), []
                continue
            if section is None:
                m = re.match(r"^\s*-\s*Cut days:\s*(.+)$", line, re.I)
                if m:
                    cut_days = [d.strip()[:3].title() for d in m.group(1).split(",")]
                elif line.strip() and not line.startswith("---"):
                    note_lines.append(line.strip())
            else:
                buf.append(line)
        if section == "hours":
            hours = rows(buf)
        elif section == "tasks":
            tasks = rows(buf)

        where = "%s / Hours" % name
        windows = {}
        for r in hours:
            if len(r) < 4:
                die("%s: a row needs Place, Days, Open, Close" % where)
            windows[r[0]] = {"days": days_mask(r[1], where),
                             "open": hhmm(r[2], where), "close": hhmm(r[3], where)}

        where = "%s / Tasks" % name
        out_tasks, by_name = [], {}
        for r in tasks:
            r = r + [""] * (7 - len(r))
            if not r[0]:
                continue
            icon = r[5].strip().lower() or "clock"
            if icon not in ICONS:
                die("%s: %r is not an icon (%s)" % (where, icon, ", ".join(sorted(ICONS))))
            t = {"id": "t%d" % len(out_tasks), "name": r[0], "place": r[1] or "Somewhere",
                 "s": offset_time(r[2], where + " / " + r[0]),
                 "e": offset_time(r[3], where + " / " + r[0]),
                 "icon": icon, "note": r[6], "_after": r[4]}
            by_name[r[0]] = t["id"]
            out_tasks.append(t)
        # Prereqs are written by name, because a table of ids is unreadable.
        for t in out_tasks:
            ids = []
            for nm in [x.strip() for x in t.pop("_after").split(",") if x.strip()]:
                if nm not in by_name:
                    die("%s: %r comes after %r, which is not a task here"
                        % (where, t["name"], nm))
                ids.append(by_name[nm])
            t["after"] = ids
        if not out_tasks:
            die("%s has no tasks" % name)
        flows.append({"id": slug(name), "name": name, "note": " ".join(note_lines),
                      "days": cut_days or ["Sun"], "windows": windows, "tasks": out_tasks})
    if not flows:
        die("no journeys found — each one is a '## ' heading")
    return flows


md = open(os.path.join(HERE, "journeys.md")).read()
flows = parse(md)
data = json.load(open(os.path.join(HERE, "data.json")))

shell = open(os.path.join(HERE, "viewer", "index.html")).read()
out = (shell
       .replace("/*__FLOWS__*/", json.dumps(flows, separators=(",", ":")))
       .replace("/*__DATA__*/", json.dumps(data, separators=(",", ":")))
       .replace("<style>/*__CSS__*/</style>",
                "<style>\n%s\n</style>" % open(os.path.join(HERE, "viewer", "style.css")).read())
       .replace("/*__JS__*/", open(os.path.join(HERE, "viewer", "app.js")).read()))

path = os.path.join(HERE, "index.html")
with open(path, "w") as fh:
    fh.write(out)

print("%d journeys: %s" % (len(flows), ", ".join(f["name"] for f in flows)))
for f in flows:
    print("  %-28s %2d tasks, %d places" % (f["name"], len(f["tasks"]), len(f["windows"])))
print("%d order rows, %s to %s" % (len(data["sales"]), data["window"]["first"], data["window"]["last"]))
print("wrote %s (%.0f KB)" % (path, len(out) / 1024))
