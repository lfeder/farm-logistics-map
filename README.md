# Task Vis

A time–distance chart, defined in Markdown.

```
python3 build.py      # journeys.md + data.json -> index.html
open index.html
```

No dependencies, no network. `index.html` is self-contained and opens by
double-clicking.

## Where things live

Three files, split by how often they change.

| File | What it is |
|---|---|
| `legs.csv` | **The schedule.** One row per leg. The only thing you edit to change when something happens. |
| `reference.json` | Quasi-static, hand-edited: what a journey is, who is open when, which boat goes where. Months between edits. |
| `orders.json` | Pulled, not typed. Cases and pounds on order by destination, and the pack line's case counts. Copied out of the freight model's `data.json` — refresh it there. |
| `build.py` | Reads all three, writes `index.html`. |
| `viewer/` | The page: shell, stylesheet, app. |
| `index.html` | Built. Do not edit — `build.py` overwrites it. |

## The chart

Time runs left to right, place runs top to bottom. A **sloped bar is the thing
moving**; a **flat bar is the thing standing still**. That is the point, because
the waiting is what nobody can see in a list of steps. A shaded band is that
place's opening hours.

## legs.csv

```
journey,start_day,branch,leg,start_location,start_dt,end_location,end_dt,icon,note
Costco Kona Lettuce,0,1,Packing,PH,"Sun, 10:00",Cold Storage,"Sun, 18:00",box,
Costco Kona Lettuce,0,2,FS-incubate,Lab,"Sun, 14:00",Lab,"Sun, 20:00",clock,
```

A leg carries **where it starts as well as where it ends**, so its bar has a
real slope rather than one inferred from whatever came before it.

**start_day** groups the rows into variants: the same journey run on a Sunday
cut and on a Wednesday one, each its own picture, picked from the dropdown.

**branch** is what makes parallel work expressible. Branch 1 is the pallet;
branch 2 is the food-safety clock running beside it. Within a branch the rows
are in order, and that is the whole dependency story — there is no `after`
column because the file already says it.

Days are `Sun, 10:00` or `M 06:00` — any longer form of the weekday works. A
bare `S` is rejected: it could be either end of the week.

**The next start does not have to be the previous stop.** Leave a gap and the
gap is drawn; overlap two legs and the overlap is drawn.

The build refuses a file it cannot trust and says which row: a bad time, a day
that is not a day, an icon that is not an icon, a journey with no entry in
`reference.json`.

## Tabs

- **Flow** — the chart and the task list for one journey.
- **Orders** — the two pack days as a horizontal bar, then cases on order by
  case type and destination. Day 1 is a 6.5 h shift filled in a fixed order:
  all of Kona's LW, then as much off-island LW as still fits, then all the LF
  and all the trays. Day 2 is the off-island LW that did not fit. Pounds packed
  are shown for each day. The dashed line on the bar is the 6.5 h day, so a bar
  running past it is a day that does not fit. The table's first two rows are
  the minutes each column needs at the average window, and the biggest window
  each column has had.
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
