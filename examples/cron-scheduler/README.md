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

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every tick, start, skip and completion to stdout.
