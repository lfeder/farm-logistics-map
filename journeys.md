# Journeys

Every journey on the chart is defined here and nowhere else. Edit this file and
run `python3 build.py`.

Two kinds of day appear below and they mean different things:

- In **Hours**, days are real weekdays. Costco receiving is shut on a Sunday
  whatever day we cut on.
- In **Tasks**, days are offsets from the cut: `D0` is the day the journey
  starts, `D1` is the day after. That way the same journey can be read against
  a Sunday cut or a Wednesday one without rewriting it.

A task runs from its start to its stop. **The next start does not have to be
the previous stop** — leave a gap and the gap is drawn; start something before
the thing it follows has finished and the overlap is drawn too.

`After` is what has to happen first. It is only used to draw the links and to
work out where a task begins on the chart; it does not move any times.

# Hours

Everyone whose door this product waits at, whether or not the journey below
goes through them. Days here are real weekdays: Costco receiving is shut on a
Sunday whatever day we cut on.

**After arrival** is how long the cargo sits before it can even be collected.
Set it to 24 h and the next-business-day rule falls out on its own — it is why
HFA collects Thursday off a Wednesday boat and Monday off a Saturday one.

| Party | Days | Open | Close | After arrival | Note |
|---|---|---|---|---|---|
| Our farm, packhouse | Sun-Sat | 06:00 | 19:00 | | Nobody is here to load a truck outside these hours. |
| Aloha Air Cargo, Kona counter | Sun-Fri | 06:00 | 17:00 | | Six days. The counter is dark Saturday. |
| Young Brothers, Kawaihae | Mon-Fri | 07:00 | 16:00 | | Cargo acceptance ahead of the sailing. |
| Young Brothers, Honolulu | Mon-Sat | 07:00 | 15:00 | 24 | Available the next business day after arrival. |
| Young Brothers, Kahului | Mon-Sat | 07:00 | 15:00 | 24 | Available the next business day after arrival. |
| HFA, Honolulu | Mon-Fri | 06:00 | 15:00 | | Collects, then runs the route. |
| HFA, Kahului | Mon-Fri | 06:00 | 15:00 | | Collects, then runs the route. |
| Costco Kona receiving | Mon-Sat | 04:00 | 11:00 | | The only gate on-island. |
| Off-island customer receiving | Mon-Sat | 05:00 | 12:00 | | The back door at the other end. |

# Sailings

Young Brothers, and which boat connects to which. A Kawaihae sailing does not
reach Maui or Kauai on its own — it lands in Honolulu and waits for the next
inter-island boat, which is where the day goes.

| Route | Departs | Arrives | Connects | Note |
|---|---|---|---|---|
| Kawaihae to Honolulu | Tue 18:00 | Wed 06:00 | | |
| Kawaihae to Honolulu | Fri 18:00 | Sat 06:00 | | |
| Honolulu to Kahului | Wed 16:00 | Thu 06:00 | the Tuesday sailing | Maui is level with Oahu off this one. |
| Honolulu to Kahului | Mon 16:00 | Tue 06:00 | the Friday sailing | Maui falls a day behind Oahu off this one. |
| Honolulu to Nawiliwili | ? | ? | | **Not confirmed.** Kauai ships every week in the order history and this leg is not written down anywhere. |

---

## Lettuce → Costco Kona

Our own box truck. No carrier at all, so the only thing between packing and the
customer is who is awake.

- Cut days: Sun, Mon, Wed, Thu

### Hours

| Place       | Days    | Open  | Close |
|-------------|---------|-------|-------|
| Packhouse   | Sun-Sat | 06:00 | 19:00 |
| Costco Kona | Mon-Sat | 04:00 | 11:00 |

### Tasks

| Task               | Place       | Starts    | Stops     | After              | Icon  | Note |
|--------------------|-------------|-----------|-----------|--------------------|-------|------|
| Packing            | Packhouse   | D0 10:00  | D0 18:00  |                    | box   | Ends at 6 PM, which is the clock everything else answers to. |
| Waits for the crew | Packhouse   | D0 18:00  | D1 06:00  | Packing            | clock | Nobody is at the packhouse overnight, so it stands here until six. |
| Load the truck     | Packhouse   | D1 06:00  | D1 07:00  | Waits for the crew | truck | A box truck cannot stand loaded overnight, so it is loaded right before it drives. |
| Drive to Kona      | Costco Kona | D1 07:00  | D1 09:00  | Load the truck     | truck | |
| Costco receiving   | Costco Kona | D1 09:00  | D1 09:30  | Drive to Kona      | store | Inside the 4-11 window, so it goes straight in. |
