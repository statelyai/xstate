# state-schemas

## What it teaches

Per-state contracts declared in `setup({ states })`: a state can narrow the root context (`schemas.context`), require data when it is entered (`schemas.input`), and declare what it produces when it completes (`schemas.output`). The demo is a document review flow whose states each carry a different context shape, plus commented `@ts-expect-error` probes that `tsc` verifies.

## XState features used

- `setup({ states })` with per-state `schemas.context`, `schemas.input` and `schemas.output`
- state contracts as structural metadata (`type: 'compound'`, `initial`) that the machine config may omit
- transitions that must supply both the target's context refinement and its `input`
- `onDone` typed by the completing state's declared output
- `snapshot.getInputs()`
- `setup(...).createStateConfig(...)` to type-check state configs in isolation
- `toPromise` for the machine's output union

## Run it

```bash
pnpm install
pnpm start
```

The demo runs the flow twice, approving once and rejecting once, printing each state value, the state inputs from the snapshot, and the final output.

## What the contracts buy you

The root context declares `draft`, `reviewer`, `rejectionReason` and `publication` as optional. Each state then narrows only what it guarantees:

- in `reviewing`, `context.draft` and `context.reviewer` are `string`, and `input.deadline` is `number`
- in `rejected`, `context.rejectionReason` is `string`
- in `published`, `context.publication` is a `Publication`

Because the narrowing is part of the contract, the transitions that enter those states must supply it. Targeting `reviewing` without `input`, without the narrowed context fields, or with the wrong `input` type is a compile error — see the probe block in `src/main.ts`. The refinement applies inside the state's own functions (`entry`, `exit`, `on`, `after`, `output`, `invoke.input`); a snapshot observed from outside still has the root context type, so narrow with `snapshot.matches(...)` when you read it from the outside.

One sharp edge worth knowing: a top-level `schemas.output` is required for the machine's own output type. Declaring `output` on the two final states does not infer a union — without the setup-level `schemas.output`, `toPromise(actor)` resolves to `{}`.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream the actor to the [Stately Inspector](https://stately.ai/docs/inspector). The inspector is wired up in `src/main.ts`, which passes `inspect` to `createActor` and destroys the inspector when the demo ends. `@statelyai/sdk` sends machine definitions and snapshots to Stately's hosted relay; without `INSPECT`, the example runs offline and prints to stdout.
