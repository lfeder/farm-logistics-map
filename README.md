# Task Vis

A time–distance chart you can edit. Forked out of the freight model's Flow page
so one flow can be worked on at a time without the rest of that page's argument
around it.

Open `index.html`. There is no build step and nothing to install.

## What it draws

Time runs left to right, place runs top to bottom. So a **diagonal is the thing
moving** and a **flat run is the thing standing still** — which is the whole
point, because the waiting is what nobody can see in a list of steps.

A shaded band on a lane is a window somebody else controls: the hours they will
take it. A flat run that ends where a band begins is that window being shut.

## The data structure

A flow is a set of **tasks** and the links between them. Nothing else.

```js
{ id, name, place, icon, note,
  kind: 'at' | 'takes' | 'opens' | 'sails',
  after: [taskId, ...] }
```

Four kinds, which between them say everything the model knows about when
something happens:

| kind | means | fields |
|---|---|---|
| `at` | a clock time on day 0 | `at` |
| `takes` | N hours after its prereqs | `dur` |
| `opens` | waits until somebody will take it | `days`, `open`, `close`, `lead` |
| `sails` | waits for the next scheduled departure | `days`, `at` |

`place` is where the product is when the task ends, and those places are the
vertical axis. A task ending where its prereq ended is a wait; a task ending
somewhere else is a move.

**Dependencies are stored one way only.** A task lists what it comes `after`.
What it *feeds* is those same edges read backwards, so it is derived on the fly
and shown under each task rather than typed — the two can never drift apart.

A task starts when the **last** of its prereqs is done, which is what makes a
merge behave like a merge. Anything left unresolved is in a dependency circle or
points at a task that has been deleted; it is called out in red and left off the
chart rather than quietly dropped.

`lead` is worth knowing about: hours after arrival before the cargo can even be
collected. Set it to 24 on a `opens` task and the next-business-day rule falls
out on its own.

## State

Edits are kept in `localStorage` under `taskvis.flows.v1`. **Back to defaults**
restores the seeded flow.

## What it cannot do yet

Scheduling is **forward only**. Every task runs as early as its prereqs allow,
so a truck that will not be received until 4 AM still leaves at 9 PM and stands
outside the door all night. The realistic answer — leave as late as you can and
still make the window — needs a backward pass from the delivery, and there is no
kind for it. When it comes it should probably be a flag on `takes`
("as late as possible") rather than a fifth kind.
