# video-player-react

## What it teaches

Modeling media playback as nested states: playback (`playing` / `paused`) lives inside `ready`, buffering interrupts playback and returns to it on its own, and `ended` is reachable only by an `always` transition on the playhead.

## XState features used

- `setup()` with `schemas`, `actors`, and `delays`
- Nested (hierarchical) states with a parent-level `SEEK` handler
- `invoke` of `createAsyncLogic` (metadata load) and `createCallbackLogic` (playback clock)
- `always` (eventless) transition to `ended`
- Delayed transition (`after`) out of `buffering`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Playback is simulated with a one-second `createCallbackLogic` ticker rather than a real `<video>` element, so the example stays offline and needs no media asset. The states and transitions map one-to-one onto the media events a real element emits (`loadedmetadata`, `playing`, `waiting`, `seeked`, `ended`).

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
