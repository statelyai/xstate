# Repeating car vitals checks

<!-- sync:workflow.ts -->

`CarTurnedOnEvent` invokes a child that runs four checks concurrently. The child waits for every reading, returns its typed output, and the parent stores `lastReadings` before waiting one second for the next round. `CarTurnedOffEvent` cancels outstanding checks or the repeat delay. A failed sensor propagates an error and cancels sibling checks.

<!-- sync:main.ts -->

These checks simulate local work using abortable timers; they contact no vehicle or external service. From the repository root, install dependencies and run `pnpm build`, then `pnpm --dir examples/workflow-car-vitals start`. The demo turns the car on, runs for six seconds, turns it off, and stops the actor. Typecheck with `pnpm --dir examples/workflow-car-vitals build`.

`workflow.test.ts` controls each check independently and verifies output aggregation, repetition, cancellation, and failure. It runs through root `pnpm check:examples`. The example uses the workspace XState v6 alpha and static `types<T>()` schemas.
