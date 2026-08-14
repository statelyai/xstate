# agent-eval-harness

## What it teaches

How to test an agent machine by model: enumerate every simple path through it, then assert invariants at every step instead of hand-writing individual test cases.

## XState features used

- `machine.getInitialSnapshot()` and `machine.transition()` as a pure, actor-free API
- `snapshot.nodes` and `stateNode.ownEvents` for introspecting which events a state handles
- branching transition functions (the agent clarifies short questions)
- final states as path terminators

## Run it

```bash
pnpm install
pnpm start
```

The harness prints every enumerated path, any invariant violations, and state coverage. It exits non-zero if an invariant fails or a state is unreachable.

`@xstate/graph` has no v6-compatible package in this repo, so `getSimplePaths` is hand-rolled here as a breadth-first walk over `machine.transition` — about 30 lines, and it shows exactly what path generation needs from the machine.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. The harness never starts an actor, so there is nothing live to inspect; the printed paths are the output.
