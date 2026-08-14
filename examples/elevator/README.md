# elevator

## What it teaches

Keeping a work queue in context while finite states model the physical situation: an elevator's doors and motion are states, the pending floor calls are data, and guarded transitions drop calls that are already satisfied.

## XState features used

- Context as a queue, updated from transition functions
- Guarded transitions (a transition function returning `undefined` leaves the event unhandled)
- Delayed transitions (`after`) for travel time and door auto-close
- An eventless `always` transition to start moving when work arrives
- A self-targeting transition that restarts its own timer

## How it works

- `doorsClosed` is the resting state. Its `always` transition sends the car to `moving` as soon as `queue` is non-empty.
- `moving` advances one floor per `travelTime` tick. If the next floor is the head of the queue it opens the doors and shifts the queue; otherwise it re-enters `moving`, which restarts the delay.
- `doorsOpen` closes on `closeDoors`, or on its own after `doorsCloseDelay`.
- `call` is accepted in every state, but `enqueueCall` returns `undefined` for the current floor and for floors already queued, so those calls are ignored.

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
