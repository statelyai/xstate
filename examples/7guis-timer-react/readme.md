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

This example does not bundle an inspector. To watch the actor live, add [`@statelyai/sdk`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const [state, send] = useActor(timerMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

Per the task spec, changing the duration never resets the elapsed time: raising it above the elapsed time resumes ticking, lowering it below falls straight through to `done`.
