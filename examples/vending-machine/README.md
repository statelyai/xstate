# vending-machine

## What it teaches

Guarding a transition on data in context: coins accumulate credit, and a selection only dispenses when the item is in stock and the credit covers its price.

## XState features used

- Named `guards` in `setup()`, called from a transition function
- Context updates for credit, stock, and change
- Delayed transitions (`after`) for dispensing and returning change
- Entry actions

## How it works

- `idle` accepts coins and selections. The `select` transition function calls the `inStock` and `canAfford` guards itself and picks one of three results: a "sold out" message, an "add more" message, or a move to `dispensing` with credit deducted and stock decremented.
- `dispensing` waits `dispenseTime`, then goes to `returningChange` if credit is left over, or straight back to `idle`.
- `returningChange` moves the remaining credit into `change` in an entry action, then returns to `idle` after `changeTime`.
- `refund` is ignored when there is no credit — the transition function returns `undefined`.

Gum starts with zero stock so the sold-out path is reachable without emptying the machine first.

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/inspect` is wired up, so running the example opens the [Stately Inspector](https://stately.ai/registry/inspect) with the live actor.
