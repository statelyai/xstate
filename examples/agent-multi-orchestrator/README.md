# agent-multi-orchestrator

## What it teaches

How one orchestrator machine coordinates several agent actors: it spawns research, write, and review workers, hands work to them in sequence, aggregates their results, and degrades gracefully when one worker fails.

## XState features used

- `enq.spawn` for child agent actors
- `enq.sendTo` for hand-offs and `enq.emit` + `enq.listen` for results
- `emitted` schemas in `setup()`
- `onError` inside a worker, so a failure arrives at the parent as an ordinary event

## Run it

```bash
pnpm install
pnpm start
```

The review worker is scripted to fail, so the run ends with a degraded (unreviewed) deliverable rather than an error.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every orchestrator state and worker message to stdout.
