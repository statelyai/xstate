# 7guis-counter-react

## What it teaches

The smallest possible machine with context: a single event whose transition function returns updated context. This is [the 7GUIs counter task](https://eugenkiss.github.io/7guis/tasks#counter).

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events)
- Machine-level `on` transition function returning `{ context }`
- `useActor` from `@xstate/react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

This example does not bundle an inspector. To watch the actor live, add [`@statelyai/inspect`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const [state, send] = useActor(counterMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
