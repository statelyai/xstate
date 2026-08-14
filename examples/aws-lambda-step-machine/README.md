# aws-lambda-step-machine

## What it teaches

How to run a long-lived workflow on stateless AWS Lambda: each invocation restores a persisted actor from storage, applies one event, persists the new snapshot, and responds. The workflow's memory lives in the snapshot, not in the function.

## XState features used

- `getPersistedSnapshot()` and `createActor(machine, { snapshot })`
- guards in a transition function (small expenses skip review)
- final states
- `snapshot.can()` to report the events the workflow will accept next

## Run it

```bash
pnpm install
pnpm start
```

`pnpm start` invokes the handler function directly three times against one in-memory store — the offline equivalent of three Lambda invocations hitting the same DynamoDB row. No AWS credentials or emulator needed.

Output:

```
submit -> "inReview" {"amount":480,"approver":null,...,"next":["approve","reject"]}
approve -> "approved" {...,"approver":"dana","next":["pay"]}
pay -> "paid" {...,"next":[]}
```

`src/storage.ts` defines the `SnapshotStore` interface the handler depends on. The in-memory adapter is implemented; a DynamoDB adapter is sketched in a comment so the example stays runnable offline. To deploy, swap the store in `src/handler.ts` and point your function at the exported `handler`.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the local harness prints each invocation's resulting state, context, and accepted events.
