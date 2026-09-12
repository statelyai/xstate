# Book lending

Check book availability, handle hold or cancellation responses, and notify the lender after checkout.

Run `pnpm --filter @xstate/example-workflow-book-lending start` from the repository root. `build` checks this Node example's TypeScript; it does not create a browser bundle. Run `pnpm build` at the root first to generate XState declarations.

Import `workflow` from `./workflow.ts` to use the machine without starting the demo. `main.ts` starts the executable demonstration. The demonstration uses simulated services and console output. Stop long-running demonstrations with Ctrl+C.

`workflow.test.ts` verifies behavior with a fake clock and, where needed, replacement actor implementations. The shared example test configuration runs these tests without executing `main.ts`.
