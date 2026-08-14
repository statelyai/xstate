# toggle-svelte

## What it teaches

The smallest possible `@xstate/svelte` app: a two-state toggle whose `on` state turns itself off after a delay, and a self-transition with `reenter: true` that restarts that delay.

## XState features used

- `setup()` with `delays`
- Delayed transitions (`after`)
- Self-transition with `reenter: true` to re-arm a delay
- `useActor` from `@xstate/svelte` (returns a Svelte store, read with `$snapshot`)

## Run it

```bash
pnpm install
pnpm dev
```

Type-check the Svelte components with `pnpm check`.

## Inspect it

`@statelyai/sdk` is wired up in `src/App.svelte`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
