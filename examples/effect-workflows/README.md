# effect-workflows

## What it teaches

Combine XState's approval, deadlines, cancellation and retry with Effect's services, streams and resource management. These are the complete examples used by the [XState Effect guides](../../packages/xstate-effect/docs/quick-start.md).

## XState features used

Parallel states, invoked actors, delayed transitions, typed input and events, emitted events, actor inspection and React subscriptions. Effect and its atom integration provide services, scoped resources and reactive consumers.

## Run it

<!-- scripts from package.json; workspace commands from ../../package.json -->

From the repository root:

```bash
pnpm install
pnpm --filter @xstate/example-effect-workflows start
pnpm typecheck:examples effect-workflows
pnpm --filter @xstate/example-effect-workflows test
```

The command runs `inspection.ts`, a local approval and publishing workflow. Services and streams are demos; no credentials or external APIs are needed.

## Inspect it

<!-- inspection.ts uses @statelyai/sdk only when INSPECT=1; its Effect scope destroys the inspector -->

```bash
INSPECT=1 pnpm --filter @xstate/example-effect-workflows start
```

`@statelyai/sdk` opens the Stately inspector and sends machine definitions, snapshots and events to its hosted relay. The demo subscribes before sending events and closes the inspector when its scope ends. Without the flag it runs locally.

## Examples

<!-- examples in src and their corresponding package documentation -->

- `approval.ts`: approval, deadlines, cancellation and explicit retry.
- `actor-service.ts`: an actor shared through a Layer and ManagedRuntime.
- `observe.ts`, `emitted.ts` and `inspection.ts`: state history, final output, reminders and visual inspection.
- `task.ts`, `latest-stream.ts` and `event-stream.ts`: tasks, upload progress and rollout health events.
- `matching.ts` and `parallel.ts`: exhaustive state matching and parallel regions.
- `actions.ts` and `provided-actions.ts`: runtime schema validation, background audits and service requirements after overrides.
- `resources.ts`: invocation cleanup and resources retained with `withActorScope`.
- `atoms.ts`, `input-atoms.ts`, `react.tsx` and `selector.tsx`: atom ownership, required input and React consumers.
- `clock.ts`, `retry.ts`, `supervision.ts` and `errors.ts`: deadlines, retries and typed failures.

Run individual `.ts` examples with `pnpm --filter @xstate/example-effect-workflows exec tsx src/clock.ts`. The React components are exercised by the React tests.

## Update an example

<!-- sync-docs.mjs copies annotated snippets into the package guides and README -->

Edit and format the source, then run `pnpm --filter @xstate/example-effect-workflows docs:sync`. Tests compare every guide's TypeScript block with its runnable source, verify documented results and cover approval expiry, retry, interruption, inspector cleanup and React interactions. The root Vitest configuration includes this suite.
