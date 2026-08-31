# Task Vis

A time–distance chart you can edit. Forked out of the freight model's Flow page
so one flow can be worked on at a time.

Open `index.html`. There is no build step and nothing to install.

## What it draws

Time runs left to right, place runs top to bottom. So a **sloped bar is the
thing moving** and a **flat bar is the thing standing still** — which is the
point, because the waiting is what nobody can see in a list of steps.

A shaded band on a lane is that place's opening hours.

## The data structure

A flow is a set of **tasks**, the links between them, and the opening hours of
the places they happen in.

```js
{ id, name, place, icon, note,
  s,                      // starts: hours from midnight on day 0
  e,                      // stops:  hours from midnight on day 0
  after: [taskId, ...] }
```

**Every task carries the same fields**, which is why every row in the list is
the same grid and the columns line up down the page.

**Both times are typed, not solved.** `after` records what has to happen first
and is what the links are drawn from, but it does not push times about: **the
next start does not have to be the previous stop.** A gap between them is drawn
as a gap. An overlap — a task starting before the thing it comes after has
finished — is drawn as a red backwards link, because that is often the truth and
used to be inexpressible.

What a task *feeds* is those same `after` edges read backwards, so it is derived
and shown in the popover rather than typed; the two cannot drift apart.

Deleting a task closes the chain over the hole: whatever depended on it inherits
what it depended on.

## Opening hours belong to a place

Costco receiving is open 4 to 11 whether or not anything is driving towards it,
so hours are a property of the **place**, edited in the strip under the chart —
not of any task.

They **gate** the typed times without overriding them. A start or stop that
falls outside its place's hours is outlined in red, says which window it missed,
and is listed above the task list with one button to move every offender to the
next moment that door is open.

## State

Edits are kept in `localStorage` under `taskvis.flows.v3`. **Back to defaults**
restores the seeded flow.

## Not here

Quantities — pounds to Costco Kona, picked up at the gate, and off-island — live
in the freight model, not in this tool. This one has no data source; it is a
generic editor.
