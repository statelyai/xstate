# onboarding-tour-react

## What it teaches

A step-by-step product tour driven by one machine: it checks persisted state on
start, auto-advances through steps on a delay, and can be paused, stepped
manually, or skipped.

## XState features used

- `setup()` with `schemas` and `delays`
- Transition functions that return `undefined` to block a transition (no guards)
- Eventless `always` transitions for the persistence check and step advance
- Nested states (`running.playing` / `running.paused`)
- Delayed transitions (`after`) for auto-advance
- Actions for the `localStorage` side effect

## Run it

```bash
pnpm install
pnpm dev
```

The tour highlights one mock element at a time and moves on every four seconds.
**Pause** hands control to you; **Skip tour** or finishing the last step writes
a completion flag to `localStorage`, so a reload shows no tour. **Reset tour**
clears the flag and restarts the machine.

## Inspect it

This example does not bundle an inspector. To watch the actor live, add
[`@statelyai/sdk`](https://stately.ai/docs/inspector) and pass it to the
hook:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const [state, send] = useActor(tourMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

No network calls; the only persistence is a single `localStorage` flag. Built
against the XState v6 alpha in this repo (`xstate: workspace:*`).
