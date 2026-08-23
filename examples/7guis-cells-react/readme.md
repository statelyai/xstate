# 7guis-cells-react

## What it teaches

A machine holding both a data model and per-cell editing state, where one commit recomputes derived values across a dependency graph. This is [the 7GUIs cells task](https://eugenkiss.github.io/7guis/tasks#cells), part of [the 7GUIs benchmark suite](https://eugenkiss.github.io/7guis/tasks).

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events) and a standalone, args-first guard (a type predicate, so the transition function narrows `editing`)
- `idle` / `editing` states modelling the edit lifecycle (`edit`, `draft`, `commit`, `cancel`)
- Transition functions returning `{ target, context }`
- `useActor` from `@xstate/react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

This example does not bundle an inspector. To watch the actor live, add [`@statelyai/sdk`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const [state, send] = useActor(cellsMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

Dependency tracking lives in `src/formula.ts`: `evaluateAll` resolves each formula depth-first through its references, memoising results, so a cell is computed only after everything it depends on — a topological pass. A `visiting` set detects cycles and reports `#CYCLE`.

**Scope cuts.** The task allows 26x100 cells; this grid is A-H by 1-15 for legibility. The formula language is cell references, numbers, `+ - * /`, parentheses, unary minus, and `SUM(A1:B3)` — no other functions, no string values in formulas, no relative-reference rewriting on copy. Non-numeric cell text displays as typed and counts as `0` inside a formula. A malformed formula renders `#ERR`.
