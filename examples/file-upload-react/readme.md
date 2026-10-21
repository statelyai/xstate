# file-upload-react

## What it teaches

One actor per file: the parent machine spawns an upload actor for each selected file, and each actor owns its own progress, cancellation, and retry. The parent never drives an upload; it only aggregates the statuses its children report.

## XState features used

- `enq.spawn()` with spawned actors stored as `ActorFromLogic<typeof uploadMachine>[]` in context
- `enq.subscribeTo()` to map each child's snapshot into a parent event
- `createCallbackLogic` for the simulated progress transport
- `useActorRef` + `useSelector` for the parent summary and for each child row

## Run it

```bash
pnpm install
pnpm dev
```

Use "Add sample files" or a real file picker. Every third file fails partway through so `RETRY` is reachable; `CANCEL` stops any in-flight upload.

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
