# agent-eval-harness

## What it teaches

How to test an agent machine by model: generate every simple path through it with `xstate/graph`, then assert invariants at every step instead of hand-writing individual test cases.

## XState features used

- `createTestModel` from the `xstate/graph` subpath, with an `events` array supplying one sample payload per equivalence class
- `testModel.getSimplePaths({ toState })` to enumerate non-looping paths that end in a final state
- `path.steps` (each step holds the snapshot before its event) and `path.description`
- branching transition functions (the agent clarifies short questions)
- final states as path terminators

## Run it

```bash
pnpm install
pnpm start
```

The harness prints every generated path, any invariant violations, and state coverage. It exits non-zero if an invariant fails or a state is unreachable.

Model-based testing lives in core in v6: import from `xstate/graph`, not from a separate package. The same generators (`getSimplePaths`, `getShortestPaths`, `getPathsFromEvents`) are also exported standalone if you do not need a `TestModel`.

## Inspect it

The harness never starts an actor — it generates and walks paths — so there is nothing live to inspect. The printed paths are the output.
