# settings-persistence-react

## What it teaches

Persisting machine context to `localStorage` on every change, hydrating it back
on start, and tracking an external source of truth — the OS colour scheme — with
a long-running callback actor.

## XState features used

- `setup()` with `schemas` and `actors`
- Lazy context initializer (`context: () => ...`) for synchronous hydration
- `createCallbackLogic` subscribed to a `matchMedia` change listener
- Root-level `invoke` for an actor that lives as long as the machine
- Enqueued side effects (`enq(persist, next)`) for writes and DOM updates

Hydration uses a lazy context initializer rather than a `loading` state that
invokes an async read. Reading `localStorage` is synchronous, so an async read
would add a state the UI has to render for zero benefit. Reach for the `loading`
state when the stored settings come from the network or IndexedDB.

## Run it

```bash
pnpm install
pnpm dev
```

Change the theme, density, or reduced-motion preference and reload the page —
the machine starts from what you left. With **system** selected, switch your OS
between light and dark while the page is open; the callback actor sends a
`systemThemeChanged` event and the effective theme, written to
`document.documentElement.dataset.theme`, follows.

## Inspect it

This example does not bundle an inspector. To watch the actor live, add
[`@statelyai/sdk`](https://stately.ai/docs/inspector) and pass it to the
hook:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const [state, send] = useActor(settingsMachine, {
  inspect: inspector.inspect
});
```

Then open https://stately.ai/registry/inspect.

## Notes

`localStorage` and `matchMedia` access is guarded, so a first run with empty
storage — or a browser that blocks storage — falls back to the defaults. Built
against the XState v6 alpha in this repo (`xstate: workspace:*`).
