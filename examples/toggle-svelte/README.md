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

`@statelyai/inspect` is wired up in `src/App.svelte`. Running `pnpm dev` opens the [Stately Inspector](https://stately.ai/registry/inspect) in a new tab, where you can watch the state change and the `autoOff` delay fire.
