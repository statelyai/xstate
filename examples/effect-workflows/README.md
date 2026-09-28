# XState Effect workflows

Complete examples used by the [XState Effect guides](../../packages/xstate-effect/docs/quick-start.md). Services and streams are local demos; no credentials or external APIs are needed.

## Run and verify

<!-- scripts from package.json; workspace commands from ../../package.json -->

From the repository root:

```bash
pnpm install
pnpm --filter @xstate/example-effect-workflows start
pnpm typecheck:examples effect-workflows
pnpm --filter @xstate/example-effect-workflows test
```

## Examples

<!-- examples in src and their corresponding package documentation -->

- `approval.ts`: approval, deadlines, cancellation and explicit retry.
- `actor-service.ts`: an actor shared through a Layer and ManagedRuntime.
- `observe.ts` and `emitted.ts`: state history, final output and reminders.
- `task.ts`, `latest-stream.ts` and `event-stream.ts`: tasks, upload progress and rollout health events.
- `matching.ts` and `parallel.ts`: exhaustive state matching and parallel regions.
- `actions.ts`: runtime schema validation and background audit work.
- `atoms.ts`, `react.tsx` and `selector.tsx`: atom ownership and React consumers.
- `clock.ts`, `retry.ts`, `supervision.ts` and `errors.ts`: deadlines, retries and typed failures.

Run individual `.ts` examples with `pnpm --filter @xstate/example-effect-workflows exec tsx src/clock.ts`. The React components are exercised by the React tests.

## Update an example

<!-- sync-docs.mjs copies annotated snippets into the package guides and README -->

Edit the runnable source, format it, then update its documentation snippets:

```bash
pnpm --filter @xstate/example-effect-workflows docs:sync
```

Tests compare every guide's TypeScript block with its runnable source. They also check documented results, approval expiry, failure and retry, interruption, and React interactions. The root Vitest configuration includes this suite.
