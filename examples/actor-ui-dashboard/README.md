# actor-ui-dashboard

## What it teaches

The shared [`_shared/actor-ui`](../_shared/actor-ui) dashboard as the default UI for headless machines: two machines with no UI code of their own, each driven and displayed by `mountActorUI`.

## XState features used

`setup()` with `schemas`, `invoke` with `createAsyncLogic`, transition functions with named guards, delayed transitions (`after`) for backoff, `createActor`, actor subscription (via the dashboard).

## How it works

`mountActorUI(actor, element, options)` subscribes to the actor and renders its state value, context, an event log, and a button per event type:

```ts
mountActorUI(orderActor, panel(), {
  title: 'orderMachine',
  events: ['addItem', 'checkout', 'retry', 'cancel']
});
```

`events` is passed explicitly because `machine.events` also contains internal types such as `xstate.done.actor`. Omit it to get a button for every type the machine declares.

Both machines — an order workflow and a trimmed copy of the `connection-manager` reconnect loop — are plain modules that import nothing from the DOM. Writing a backend workflow and pointing this dashboard at it is enough to drive and watch it during development.

## Run it

```bash
pnpm install
pnpm dev
```

Click `addItem` a few times, then `checkout`. Charges over $500 are declined, which puts the order machine into `declined` with `retry` and `cancel` available. The connection machine fails every third dial and backs off exponentially.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the dashboard's own event log and context view stand in for it.
