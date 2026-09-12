# form-wizard-svelte

## What it teaches

A three-step form where each step validates itself: the `next` transition is a function that returns a target only when the current step is valid, so an invalid step cannot advance.

## XState features used

- `setup()` with `schemas` and `types<T>()`
- Transition functions that block by returning nothing (v6 has no `guard` key)
- Root-level `on` handlers for field updates shared by every step
- `snapshot.can(...)` to disable the Back button
- `useActor` from `@xstate/svelte`

## Run it

```bash
pnpm install
pnpm dev
```

Type-check the Svelte components with `pnpm check`.

## Inspect it

`@statelyai/sdk` is wired up in `src/App.svelte`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
