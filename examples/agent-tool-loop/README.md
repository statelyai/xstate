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

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every state, model decision, tool call and observation to stdout.
