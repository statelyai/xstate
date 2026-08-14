# booking-calendar-react

## What it teaches

A booking flow where a held slot expires on its own: async loading and confirmation, a time-to-live hold with a countdown, and a conflict path when the slot is taken before confirmation lands.

## XState features used

- `createAsyncLogic()` invoked for loading slots and confirming the booking, with `onDone` and `onError`
- `createCallbackLogic()` for the countdown ticker
- Delayed transitions (`after`) as the hold TTL
- A named guard called from a transition function
- Context for slots, the selection, and the error message

## How it works

- `loading` invokes `loadSlots` and moves to `selecting` with the results.
- `selecting` only accepts a `select` event for an available slot; the `isAvailable` guard fails for taken slots and the transition function returns `undefined`, so the event is ignored.
- `holding` reserves the slot. Its `after: { holdTime }` transition releases it back to `selecting` with an "expired" message, while the invoked ticker updates the visible countdown. `confirm` and `release` leave the state early, which cancels both.
- `confirming` invokes `bookSlot`. On success it goes to `booked` with the confirmation code; on a conflict it marks the slot taken and returns to `selecting` with the server's message. `slot-3` (10:30) always conflicts, so the error path is easy to reach.

The mock server lives in `src/api.ts`; there is no network dependency.

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/inspect` is wired up, so running the example opens the [Stately Inspector](https://stately.ai/registry/inspect) with the live actor.
