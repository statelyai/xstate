# 7guis-temperature-react

## What it teaches

Two-way derived state: a single machine keeps the Celsius and Fahrenheit fields in sync, so each event recomputes both values from one input. This is [the 7GUIs temperature converter task](https://eugenkiss.github.io/7guis/tasks#temp), part of [the 7GUIs benchmark suite](https://eugenkiss.github.io/7guis/tasks).

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events)
- Machine-level `on` transition functions returning `{ context }`
- `useActor` from `@xstate/react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

The context values are typed `number | string` so an emptied input can round-trip as `''` and clear the other field instead of rendering `NaN`.

## [Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/main/examples/7guis-temperature-react)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/examples/7guis-temperature-react)
