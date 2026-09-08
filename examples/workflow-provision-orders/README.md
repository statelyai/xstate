# Provision orders

Validate order fields and route each missing-field error to its matching handler. Unexpected service errors fail the actor instead of leaving it waiting.

Run `pnpm --filter @xstate/example-workflow-provision-orders start` from the repository root. `build` checks this Node example's TypeScript; it does not create a browser bundle. Run `pnpm build` at the root first to generate XState declarations.

Import `workflow` from `./workflow.ts` to use the machine without starting the demo. `main.ts` starts the executable demonstration. The demonstration uses simulated services and console output. Stop long-running demonstrations with Ctrl+C.

`workflow.test.ts` verifies behavior with a fake clock and, where needed, replacement actor implementations. The shared example test configuration runs these tests without executing `main.ts`.
