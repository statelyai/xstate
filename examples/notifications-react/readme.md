# notifications-react

## What it teaches

An actor per toast: each notification is spawned as its own machine that owns its auto-dismiss timer and pause/resume states, while the parent keeps a queue and only spawns a new toast when a visible slot frees up.

## XState features used

- `enq.spawn` for one child actor per toast, typed as `ActorFromLogic<typeof toastMachine>`
- `enq.subscribeTo(child, { done })` to map a child's final `output` into a parent event
- Delayed transition (`after`) with a `paused` state, so re-entering `showing` restarts the delay
- Final state `output`
- `useActor` and `useSelector` from `@xstate/react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

This example does not bundle an inspector. To watch the actors live, add [`@statelyai/inspect`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const [state, send] = useActor(notificationsMachine, {
  inspect: inspector.inspect
});
```

Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
