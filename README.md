# Task Vis

A time–distance chart, defined in a Google Sheet.

```
python3 build.py      # sheet + reference.json + orders.json -> index.html
open index.html
```

**A schedule edit needs no build.** The page reads the sheet on every load, so
editing the sheet and refreshing the browser is the whole loop. The build is
for changing the page itself, and for refreshing `legs.csv` — the snapshot the
page falls back to when the sheet cannot be read.

## Where things live

Three files, split by how often they change.

| File | What it is |
|---|---|
| the Google Sheet | **The schedule.** One row per leg. The only thing you edit to change when something happens. Its URL is `legs_sheet` in `reference.json`. |
| `legs.csv` | The snapshot of that sheet, rewritten by every build. Committed, so the diff shows what changed and the page still draws with no network. |
| `reference.json` | Quasi-static, hand-edited: what a journey is, who is open when, which boat goes where. Months between edits. |
| `orders.json` | Pulled, not typed. Cases and pounds on order by destination, and the pack line's case counts. Copied out of the freight model's `data.json` — refresh it there. |
| `build.py` | Pulls the sheet, then writes `index.html`. |
| `viewer/` | The page: shell, stylesheet, app. |
| `index.html` | Built. Do not edit — `build.py` overwrites it. |

## The chart

Time runs left to right, place runs top to bottom. A **sloped bar is the thing
moving**; a **flat bar is the thing standing still**. That is the point, because
the waiting is what nobody can see in a list of steps. Faint lines every four
hours give a leg something to be measured against.

## How the chart places labels

Not per-leg tweaks — one rule set, applied to every leg the same way.

**Hours.** A leg's start hour prints to the left of its start dot; its stop hour
prints to the right of its stop dot. One label per moment: a leg's stop is
usually the next one's start, in the same place at the same minute, and that
gets one label, not two on top of each other.

**Names.** Each name tries these anchors in order and takes the first that hits
nothing already placed:

1. centred on the bar, above it
2. centred, below
3. two thirds along, above / below
4. nine tenths along, above / below
5. one third along, above / below

The list is the preference, so a leg with room around it always lands centred on
its own bar and only a crowded one walks down. **Every anchor is a point on the
leg**, so a name can never drift into a lane it does not belong to, however
crowded the chart gets — a label a lane out of place reads as belonging to the
wrong leg, which is worse than a collision.

Add legs, rename places, change times: the placement follows without anything
being positioned by hand.

**Legs are not named on the chart.** A leg's name is the same word on every
journey — Packing, BOL, Drayage — so on a busy week it said nothing while
filling the picture. What is worth saying is which thread this is, and that is
said once, in the thread's own colour, where the thread starts: `140 · Air`,
`Oahu · Barge`. The leg names are in the task list underneath.

## legs.csv

```
crop,fob,transport,start_day,branch,leg,start_location,start_dt,end_location,end_dt,icon,note
Lettuce,140,Air,0,1,Packing,PH,"Sun, 10:00",Storage,"Sun, 14:00",box,
Lettuce,140,Air,0,2,Hypercell,Lab,"Sun, 14:00",Lab,"Sun, 21:00",clock,
```

A leg carries **where it starts as well as where it ends**, so its bar has a
real slope rather than one inferred from whatever came before it.

**crop, fob and transport name the journey; start_day says which run of it
this is.** Those four columns group the rows into pictures, and they are also
the picker: one toggle each, in that order. A toggle with one answer is not a
question and is not drawn — which is why there is no crop toggle while we only
grow lettuce, and no transport toggle on a destination reached one way.

`transport` is the clearance regime as much as the vehicle. **Air** means the
product goes the moment test-and-hold clears, which for a customer collecting
at our dock is the same thing. **Barge** is the old, longer hold. Comparing
the two on one destination is the point of the toggle.

**branch** is what makes parallel work expressible. Branch 1 is the pallet;
branch 2 is the food-safety clock running beside it. Within a branch the rows
are in order, and that is the whole dependency story — there is no `after`
column because the file already says it.

**Branch 2 is not written in the sheet.** Test and hold is the same chain on
every journey, so it lives once in `reference.json` under `hold` and is grown
onto every journey from the moment packing ends. Branch 2 rows in the sheet are
ignored. Change a stage's length there and it changes everywhere, which is the
point.

Each stage is a **lane**, and `hours` is how long it takes to reach that stage
from the one before it — so the chain draws as a staircase whose steps are the
waits. A generated leg is named after the stage it arrives at, and a leg named
after the place it arrives at is not labelled on the chart: the lane already
says it.

Days are `Sun, 10:00` or `M 06:00` — any longer form of the weekday works. A
bare `S` is rejected: it could be either end of the week.

**The next start does not have to be the previous stop.** Leave a gap and the
gap is drawn; overlap two legs and the overlap is drawn.

The reader refuses a sheet it cannot trust and says which row: a bad time, a
day that is not a day, a header that names no journey. It then draws the
committed `legs.csv` instead and prints the reason above the chart, so a typo
in the sheet cannot blank the page and cannot hide either.

## Tabs

- **Flow** — the chart and the task list for one journey.
- **Orders** — the two pack days as a horizontal bar, then cases on order by
  case type and destination. Day 1 is a 6.5 h shift filled in a fixed order:
  all of Kona's LW, then as much off-island LW as still fits, then all the LF
  and all the trays. Day 2 is the off-island LW that did not fit. Pounds packed
  are shown for each day. The dashed line on the bar is the 6.5 h day, so a bar
  running past it is a day that does not fit. The table's first row is the
  minutes each column needs at the average window.
- **Hours** — everybody's clock, whether or not the journey on screen goes
  through them: the farm, Aloha Air's Kona counter, Young Brothers at Kawaihae,
  Honolulu and Kahului, HFA at both ends, Costco Kona receiving and the
  off-island docks — plus the Young Brothers sailing schedule and which boat
  connects to which. Set in the `# Hours` and `# Sailings` tables at the top of
  `journeys.md`.

Hours **gate** the written times without overriding them: a start or stop
outside its place's hours is printed in red in the task list and named above it.

## Not here

This is a viewer. Editing a journey means editing the sheet. Interactive
editing was tried and taken back out — the builder was becoming the product.

Turning rows into journeys happens once, in `viewer/app.js`, because the page
does it at load time. `build.py` does not do it again in Python; two copies of
those rules would drift.

Honolulu to Nawiliwili is in `sailings.csv` from the Young Brothers cargo sheet:
departs Monday and Thursday, arrives Tuesday and Friday. The Kauai leg is not
modelled by any journey yet.
