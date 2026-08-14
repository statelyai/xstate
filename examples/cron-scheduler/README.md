# cron-scheduler

## What it teaches

How to run periodic tasks from a schedule table in context: a tick advances the scheduler, each due schedule gets its own task actor, and a schedule whose previous run is still active is skipped rather than overlapped.

## XState features used

- `after` as the scheduler tick
- `enq.spawn` with `enq.subscribeTo` for each run
- pause / resume states
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Five ticks drive three schedules. The scheduler pauses and resumes mid-run, and the long-running `nightly-report` is skipped once because its previous run has not finished.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
