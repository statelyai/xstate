# history-states

## What it teaches

How history pseudo-states restore where a region was when it was last exited: shallow history restores the last tab, deep history restores the last tab *and* its last sub-section.

## XState features used

- history states (`type: 'history'`) with `history: 'shallow'` and `history: 'deep'`
- the SCXML default `target`, which XState v6 requires on every history state
- nested compound states
- transition functions returning relative targets (`.${event.tab}`)

## Run it

```bash
pnpm install
pnpm dev
```

Open the **Advanced** tab, pick the **Experiments** sub-section, close the panel, then reopen it three ways:

| Reopen with | Lands on |
| --- | --- |
| Open (initial tab) | `open.general` |
| Open (shallow history) | `open.advanced.network` — the tab is remembered, the sub-section is not |
| Open (deep history) | `open.advanced.experiments` — the whole configuration is remembered |

## Inspect it

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
