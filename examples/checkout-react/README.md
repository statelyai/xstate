# checkout-react

## What it teaches

A linear checkout flow — cart, shipping, payment, confirmation — where the
transition functions themselves decide whether a step may advance, and a failed
charge lands in a recoverable `declined` state.

## XState features used

- `setup()` with `schemas` and `actors`
- Transition functions that return `undefined` to block a transition, replacing
  the `guard` key from earlier versions
- `createAsyncLogic` for the mock card charge
- `invoke` with `onDone` / `onError` transition functions
- A final state (`done`)

## Run it

```bash
pnpm install
pnpm dev
```

Add items to the cart, then step through shipping and payment. An empty cart or
an incomplete shipping form blocks **Continue**. Any card number of 12 or more
digits is accepted; one ending in `0000` is declined and drops you into the
`declined` state, where you can retry with another card or go back to the cart.

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

The payment processor is mocked with a delayed promise; no network calls are
made. Built against the XState v6 alpha in this repo (`xstate: workspace:*`).
