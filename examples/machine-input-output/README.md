# machine-input-output

## What it teaches

How values enter a machine as `input` and leave it as the `output` of a final state, and how a parent reads a child's output from `event.output` in `invoke.onDone`. The parent runs the same child machine three times with different input and compares the results.

## XState features used

- `schemas.input` and `schemas.output` with `types<T>()`
- `context` as a function of `input`
- final state `output`
- `invoke` of a child machine with `input`, read back in `onDone`
- a guard that validates input before it is used
- `toPromise` to await the root actor's output

## Run it

```bash
pnpm install
pnpm start
```

The first run quotes a valid principal against three loan offers and prints the cheapest. The second run passes an out-of-range principal, which the `validating` state rejects into a final state whose output carries the error.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints each quote and the final output to stdout.
