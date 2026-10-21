# agent-eval-harness

## What it teaches

How to test an agent machine by model: generate every simple path through it with `xstate/graph`, then assert invariants at every step instead of hand-writing individual test cases.

## XState features used

- `getSimplePaths(machine, { events, toState })` from the `xstate/graph` subpath, with an `events` array supplying one sample payload per equivalence class, to enumerate non-looping paths that end in a final state
- `path.steps` (each step holds the snapshot after its event) and `path.state`
- branching transition functions (the agent clarifies short questions)
- final states as path terminators

## Run it

```bash
pnpm install
pnpm start
```

The harness prints every generated path, any invariant violations, and state coverage. It exits non-zero if an invariant fails or a state is unreachable.

This harness checks the model only. To drive a separate implementation with the same paths and compare it with the model after every step, use `testPaths()` from `@xstate/test`.

## Inspect it

The harness never starts an actor — it generates and walks paths — so there is nothing live to inspect. The printed paths are the output.
