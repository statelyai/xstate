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

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
