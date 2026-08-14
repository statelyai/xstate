# audio-player-react

## What it teaches

A playlist is one machine, not one machine per track: the playing/paused states are top-level, and the current track index lives in context so that next, previous, select, shuffle, and auto-advance are all context updates on the same two states.

## XState features used

- `setup()` with `schemas`
- `invoke` of `createCallbackLogic` (playback clock) scoped to the `playing` state
- `always` (eventless) transition for auto-advance at the end of a track
- Machine-level `on` handlers shared by every state

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

const [state, send] = useActor(playlistMachine, {
  inspect: inspector.inspect
});
```

Then open https://stately.ai/registry/inspect.

## Notes

Playback is simulated with a one-second ticker; track durations are a few seconds so auto-advance is easy to watch. No audio files, no network.

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
