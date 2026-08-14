# agent-tool-loop

## What it teaches

The canonical agent loop — think, call a tool, observe, think again — as a statechart, with a bounded iteration budget instead of an unbounded `while` loop.

## XState features used

- `invoke` with `onDone` transition functions
- one state per tool, so the running tool is visible in the state value
- a named guard from `setup()` for the max-iteration stop
- `always` transitions, final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The mock model asks for three tools in turn (`search`, `calculator`, `weather`) and then returns a final answer, so the run shows three full loops.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
