# 7guis-timer-react

## What it teaches

An invoked callback actor as a ticker whose lifetime is the running state: the timer stops by leaving that state, and changing the duration re-enters it with `reenter: true` to re-arm the ticker. This is [the 7GUIs timer task](https://eugenkiss.github.io/7guis/tasks#timer), part of [the 7GUIs benchmark suite](https://eugenkiss.github.io/7guis/tasks).

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events) and a standalone, args-first `guard`
- `createCallbackLogic` invoked only while the `running` state is active
- `always` (eventless) transition to `done` once the elapsed time reaches the duration
- Root-level `on` with `reenter: true` to restart the ticker on a duration change
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

Per the task spec, changing the duration never resets the elapsed time: raising it above the elapsed time resumes ticking, lowering it below falls straight through to `done`.
