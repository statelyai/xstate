# pattern-long-running-approval

## What it teaches

How to model a workflow that waits on a human decision: it parks in a state indefinitely, sends reminders on a timer, and expires if nobody answers.

## XState features used

- event-driven transitions (`approve` / `reject`)
- delayed transitions for reminders and expiry
- `invoke` for notification and audit-log side effects
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The approver answers after the first reminder, so the run ends in `settled`.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
