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
| `journeys.md` | **The journeys.** The only place a schedule is defined. |
| `data.json` | Orders by destination, copied out of the freight model. |
| `build.py` | Parses the Markdown, folds in the data, writes `index.html`. |
| `viewer/` | The page: shell, stylesheet, app. |
| `index.html` | Built. Do not edit — `build.py` overwrites it. |

## The chart

Time runs left to right, place runs top to bottom. A **sloped bar is the thing
moving**; a **flat bar is the thing standing still**. That is the point, because
the waiting is what nobody can see in a list of steps. A shaded band is that
place's opening hours.

## Defining a journey

Each `## ` heading is a journey. Two kinds of day appear and they mean
different things:

- In **Hours**, days are real weekdays. Costco receiving is shut on a Sunday
  whatever day we cut on.
- In **Tasks**, days are offsets from the cut — `D0` is the day the journey
  starts, `D1` the day after — so the same journey reads against a Sunday cut
  or a Wednesday one without being rewritten.

A task runs from its start to its stop. **The next start does not have to be
the previous stop.** Leave a gap and the gap is drawn; start something before
the thing it follows has finished and the overlap is drawn as a red backwards
link, because two things happening at once is usually the truth.

`After` is written by name, because a table of ids is unreadable. It draws the
links and decides where a task begins on the chart; it does not move any times.

The build refuses a file it cannot trust: a bad time, a day that is not a day,
an icon that is not an icon, or an `After` naming a task that is not there. It
does **not** refuse a stop before its start — that is a question about the
schedule, not the syntax, so the viewer flags it in red instead.

## Tabs

- **Flow** — the chart and the task list for one journey.
- **Orders** — pounds invoiced by how the order leaves the farm: Costco Kona on
  our own trucks, picked up at the gate under FOB Farm, or off-island on a boat.
  Copied from the freight model; refresh it there.
- **Hours** — every place's opening hours, per journey.

Hours **gate** the written times without overriding them: a start or stop
outside its place's hours is printed in red in the task list and named above it.

## Not here

This is a viewer. Editing a journey means editing `journeys.md` and running the
build. Interactive editing was tried and taken back out — the builder was
becoming the product.
