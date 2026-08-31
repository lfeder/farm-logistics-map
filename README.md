# Task Vis

A time–distance chart, defined in Markdown.

```
python3 build.py      # journeys.md + data.json -> index.html
open index.html
```

No dependencies, no network. `index.html` is self-contained and opens by
double-clicking.

## Where things live

| File | What it is |
|---|---|
| `journeys.csv` | One row per journey: its name and a note. |
| `legs.csv` | **One row per leg.** Where it is, when it starts, when it stops. |
| `hours.csv` | One row per place: the hours somebody will take it. |
| `sailings.csv` | One row per boat: when it goes and what it connects to. |
| `data.json` | Orders by destination, copied out of the freight model. |
| `build.py` | Reads the CSVs, folds in the data, writes `index.html`. |
| `viewer/` | The page: shell, stylesheet, app. |
| `index.html` | Built. Do not edit — `build.py` overwrites it. |

## The chart

Time runs left to right, place runs top to bottom. A **sloped bar is the thing
moving**; a **flat bar is the thing standing still**. That is the point, because
the waiting is what nobody can see in a list of steps. A shaded band is that
place's opening hours.

## legs.csv

```
journey,leg,place,starts,stops,after,icon,note
Lettuce → Costco Kona,Load the truck,Hawaii Farming,M 06:00,M 07:00,Waits for the crew,truck,...
```

Days are written as `Su M T W Th F Sa`, or any longer form of the same
(`Mon`, `Thurs`, `Saturday`). A bare `S` is rejected — it could be either end of
the week, and a schedule is not the place to guess.

The first leg sets the week; every time after it is the next occurrence of that
weekday walking forward, so a journey running Sunday to Friday is five days
long rather than five days minus a wrap-around.

A leg runs from its start to its stop. **The next start does not have to be the
previous stop.** Leave a gap and the gap is drawn; start something before the
thing it follows has finished and the overlap is drawn as a red backwards link,
because two things happening at once is usually the truth.

`after` is written by name, semicolon-separated for more than one. It draws the
links and decides where a leg begins on the chart; it does not move any times.

`place` is the same namespace as `hours.csv`, so a leg landing in a place picks
up that place's opening hours for its lane.

The build refuses a file it cannot trust and says which row: a bad time, a day
that is not a day, an icon that is not an icon, an `after` naming a leg that is
not there, a journey that is not in `journeys.csv`. It does **not** refuse a
stop before its start — that is a question about the schedule, not the syntax,
so the viewer flags it in red instead.

## Tabs

- **Flow** — the chart and the task list for one journey.
- **Orders** — cases and pounds invoiced by how the order leaves the farm:
  Costco Kona on our own trucks, picked up at the gate under FOB Farm, or
  off-island on a boat. Both units on every line, cases and pounds, because the
  orders arrive in cases and the harvest is weighed. Copied from the freight
  model; refresh it there.
- **Hours** — everybody's clock, whether or not the journey on screen goes
  through them: the farm, Aloha Air's Kona counter, Young Brothers at Kawaihae,
  Honolulu and Kahului, HFA at both ends, Costco Kona receiving and the
  off-island docks — plus the Young Brothers sailing schedule and which boat
  connects to which. Set in the `# Hours` and `# Sailings` tables at the top of
  `journeys.md`.

Hours **gate** the written times without overriding them: a start or stop
outside its place's hours is printed in red in the task list and named above it.

## Not here

This is a viewer. Editing a journey means editing `legs.csv` and running the
build. Interactive editing was tried and taken back out — the builder was
becoming the product.

Honolulu to Nawiliwili is in `sailings.csv` from the Young Brothers cargo sheet:
departs Monday and Thursday, arrives Tuesday and Friday. The Kauai leg is not
modelled by any journey yet.
