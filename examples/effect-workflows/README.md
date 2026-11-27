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

<!-- inspection.ts and custom-actions.ts use @statelyai/sdk only when INSPECT=1; their Effect scopes destroy the inspector -->

```bash
INSPECT=1 pnpm --filter @xstate/example-effect-workflows start
INSPECT=1 pnpm --filter @xstate/example-effect-workflows exec tsx src/custom-actions.ts
```

`@statelyai/sdk` opens the Stately inspector and sends machine definitions, snapshots and events to its hosted relay. Both `src/inspection.ts` and `src/custom-actions.ts` subscribe and wait for the inspector before sending events, then close it when their scopes end. Without the flag they run locally.

## Examples

<!-- examples in src and their corresponding package documentation -->

- `approval.ts`: approval, deadlines, cancellation and explicit retry.
- `actor-service.ts`: an actor shared through a Layer and ManagedRuntime.
- `observe.ts`, `emitted.ts` and `inspection.ts`: state history, final output, reminders and visual inspection.
- `task.ts`, `latest-stream.ts` and `event-stream.ts`: tasks, upload progress and rollout health events.
- `matching.ts` and `parallel.ts`: exhaustive state matching and parallel regions.
- `actions.ts`, `custom-actions.ts` and `provided-actions.ts`: runtime schema validation, typed action arguments, background audits and service requirements after overrides.
- `resources.ts`: invocation cleanup and resources retained with `withActorScope`.
- `atoms.ts`, `input-atoms.ts`, `react.tsx` and `selector.tsx`: atom ownership, required input and React consumers.
- `clock.ts`, `retry.ts`, `supervision.ts`, `errors.ts` and `failure-cause.ts`: deadlines, retries, typed failures and Cause inspection.
- `boundaries.ts`: decode external input and events before synchronous validation.
- `persistence.ts` and `persistence-codec.ts`: causal event receipts and schema-backed snapshots with rich values.
- `cluster.ts`: a checkpoint-backed workflow hosted by an Effect Cluster entity.

Run individual `.ts` examples with `pnpm --filter @xstate/example-effect-workflows exec tsx src/clock.ts`. The React components are exercised by the React tests.

## Effect Cluster workflow

`ClusterWorkflow` exposes `Start(requestId)` and `Get()`. Each entity runs
one job, invokes an Effect, and waits one second before completing. The
entity uses `xstate/durable` for transitions, checkpoints, and restored timer
delays.

Supply a `WorkflowStore` that commits the checkpoint and accepted request ID
in one compare-and-swap write. The entity saves the active invocation before
starting its Effect. The same start request returns the current state
without applying another transition. A different request ID is rejected.

After a runner restart, the first request to the entity restores the job.
An interrupted Effect can run again. The Effect receives the same job ID
on every attempt, so an external service can use it as an idempotency key.
Restoring a waiting job uses the original timer deadline. An overdue timer
fires after the entity is reactivated. This example uses runner-local
timers and requires a request to reactivate a job after a restart.

The integration test uses Effect Cluster's in-process `TestRunner` and a
temporary file for workflow checkpoints. It replaces the runner during an
invocation and again while a timer is pending. Run it from the repository
root.

```bash
pnpm exec vitest run examples/effect-workflows/test/cluster.test.ts
```

## Update an example

<!-- sync-docs.mjs copies annotated snippets into the package guides and README -->

Edit and format the source, then run `pnpm --filter @xstate/example-effect-workflows docs:sync`. Tests compare every guide's TypeScript block with its runnable source, verify documented results and cover approval expiry, retry, interruption, inspector cleanup and React interactions. The root Vitest configuration includes this suite.
