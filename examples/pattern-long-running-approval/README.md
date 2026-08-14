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

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints reminders, the decision and the final outcome to stdout.
