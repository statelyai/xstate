# Reusable payment confirmation functions

<!-- sync:workflow.ts -->

The parent forwards `PaymentReceivedEvent` to its payment-confirmation child. The child passes the account ID and amount to a funds check, selects a success or insufficient-funds notification, and sends `ConfirmationCompletedEvent` to its parent. The parent records that payment and completes after the child finishes. Stopping the parent aborts outstanding child work.

<!-- sync:main.ts -->

Funds checks and notifications are local timer simulations: no payment is processed and no email is sent. From the repository root, install dependencies and run `pnpm build`, then `pnpm --dir examples/workflow-reusing-functions start`. Typecheck with `pnpm --dir examples/workflow-reusing-functions build`.

`workflow.test.ts` injects deterministic services to verify both branches, account/customer propagation, parent completion, and cancellation. It runs through root `pnpm check:examples`. The example uses the workspace XState v6 alpha and static `types<T>()` schemas.
