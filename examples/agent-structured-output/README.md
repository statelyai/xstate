# agent-structured-output

## What it teaches

How to run a generate → validate → repair loop: output that fails its zod schema goes back to the model with the validation errors as feedback, up to three attempts before the machine fails.

## XState features used

- `invoke` with `createAsyncLogic` for the generation call
- an `always` transition that validates and branches
- attempt counting in context, with a bounded repair loop
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

`zod` is a dependency because the schema is the subject of this example: it both validates the output and produces the error messages fed back to the model.

The generation call is mocked with a deterministic `createAsyncLogic` actor so the demo runs offline. Swap its `run` body for a real client call that returns parsed JSON — the machine only sees `raw: unknown`.

The demo runs the loop twice: once where the third attempt is valid, and once where every attempt is invalid and the machine ends in `failed`.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints each attempt and validation error to stdout.
