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

This example does not bundle an inspector. To watch the actors live, add [`@statelyai/inspect`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const uploadsRef = useActorRef(uploadsMachine, { inspect: inspector.inspect });
```

Spawned children appear alongside the parent. Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
