# router-sync-react

## What it teaches

Keeping machine state and the URL in sync with the History API alone — no router
dependency. Navigation events push history entries, `popstate` events push the
browser's back and forward moves back into the machine, and the initial state is
derived from the current pathname.

## XState features used

- `setup()` with `schemas` and `actors`
- `createCallbackLogic` wrapping a `popstate` listener
- Root-level `invoke` for an actor that lives as long as the machine
- Root-level `on` handlers with relative targets (`.about`, `.item`)
- Enqueued side effects (`enq(pushPath, path)`) for `history.pushState`
- Deep-link hydration via a computed `initial` state and `context`

Four routes: `/`, `/about`, `/items/:id`, and everything else as `notFound`.
Only `navigate` pushes history; `popped` never does, or back and forward would
pile new entries onto the stack.

## Run it

```bash
pnpm install
pnpm dev
```

Click through the nav, then use the browser's back and forward buttons. Reload
on `/items/beta` to see deep-link hydration.

## Inspect it

This example does not bundle an inspector. To watch the actor live, add
[`@statelyai/inspect`](https://stately.ai/docs/inspector) and pass it to the
hook:

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const [state, send] = useActor(routerMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

Deep links only work because the dev server falls back to `index.html` for
unknown paths — Vite's default SPA behaviour. A static host without that
rewrite returns 404 for `/items/beta`, so configure the fallback before
deploying. Routes are kept shallow for the same reason. Built against the XState
v6 alpha in this repo (`xstate: workspace:*`).
