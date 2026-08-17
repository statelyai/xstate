---
title: Parallel states
description: Keep independent regions of a state active at the same time.
---

A parallel state is active in all of its regions at once. Each child of a `type: 'parallel'` state is a region, and every region is entered when the parallel state is entered.

```ts
active: {
  type: 'parallel',
  states: {
    playback: {
      initial: 'stopped',
      states: { stopped: { on: { play: { target: 'playing' } } }, playing: {} }
    },
    volume: {
      initial: 'audible',
      states: { audible: { on: { mute: { target: 'muted' } } }, muted: {} }
    }
  }
}
```

Muting audio does not change playback, and pausing playback does not change volume. Modeling these as one flat state would require `playingMuted`, `stoppedMuted`, `playingAudible` and `stoppedAudible`. Parallel states avoid that combinatorial growth.

A parallel state has no `initial`. Each region that has child states must declare its own `initial`, or machine creation throws.

## State value

The state value of a parallel state is an object keyed by region.

```ts
actor.getSnapshot().value;
// { active: { playback: 'playing', volume: 'muted' } }
```

Nested parallel states nest further. A region with no child states appears as `{}` rather than a string.

`matches` is a prefix match, so a partial object matches while other regions are left unnamed.

```ts
snapshot.matches({ active: { playback: 'playing' } }); // true
snapshot.matches('active.playback.playing'); // true
```

> **Warning:** Because `matches` only checks the part you name, it cannot assert that nothing else is active. Compare `snapshot.value` when you need the whole configuration.

## One event, every region

An event is offered to every active region. A single event can move several regions in the same step.

```ts
active: {
  type: 'parallel',
  states: {
    playback: { initial: 'playing', states: { playing: { on: { interrupt: { target: 'paused' } } }, paused: {} } },
    volume: { initial: 'audible', states: { audible: { on: { interrupt: { target: 'muted' } } }, muted: {} } }
  }
}
// after `interrupt`: { playback: 'paused', volume: 'muted' }
```

Regions that do not handle the event are untouched, and an event no region handles changes nothing. A transition from one region into another exits only the target's region; the source region stays where it is.

## Completion

A parallel state completes only when every region has reached a [final state](final-states.md). Its `onDone` transition is then taken, with an output object keyed by region.

```ts
upload: {
  type: 'parallel',
  states: {
    transfer: {
      initial: 'sending',
      states: { sending: {}, sent: { type: 'final', output: { url: '/file.png' } } }
    },
    scan: {
      initial: 'scanning',
      states: { scanning: {}, scanned: { type: 'final', output: { safe: true } } }
    }
  },
  onDone: ({ event }) => ({
    target: 'ready',
    context: { url: event.output.transfer.url }
  })
}
```

Every region has a key in that object; regions whose final state declares no `output` contribute `undefined`.

## Targeting several regions at once

A transition can name one target per region by passing an array of targets.

```ts
on: {
  reset: { target: ['#player.active.playback.stopped', '#player.active.volume.audible'] }
}
```

Relative paths work the same way: `target: ['playback.stopped', 'volume.audible']`. Regions not named keep their current state.

The target set must be a legal configuration: the targets must be in different regions of a common parallel ancestor. Two targets in the same region throw at machine creation, not at send time.

## Cross-region conditions

Use `checkStateIn(...)` inside a [transition function](guards.md) to read another region.

```ts
import { checkStateIn } from 'xstate';

play: ({ self }) => {
  if (checkStateIn(self.getSnapshot(), { volume: 'muted' })) return;
  return { target: 'playing' };
}
```

`checkStateIn(snapshot, value)` accepts a state id (`'#muted'`), a path (`'volume.muted'`), or a state-value object. Keep these checks rare. Regions that constantly inspect each other are usually better modeled as a single region.

## Parallel regions or spawned actors

Use parallel regions when the concerns are part of the same unit of behavior, react to the same events, and complete together: playback and volume of one player, or the transfer and virus scan of one upload.

Use [spawned actors](spawn.md) when the concerns have independent lifetimes, arrive in unknown numbers, or own their own data: one actor per file in an upload queue, or per row in an editable table. Regions are fixed at design time; actors are created and stopped at runtime.

Common uses: a media player with independent playback, volume and subtitle regions; a checkout tracking payment authorization and address validation before it can proceed; a multi-step form tracking the current step alongside autosave status.

## TypeScript

Region keys are inferred from `states`, so `snapshot.value` and `matches` are typed against the real region structure and a misspelled region is a type error. `onDone` on a parallel state receives a done event whose `output` is an object keyed by region, with each region's final output type.

## Parallel states cheatsheet

```ts
// declaration
active: { type: 'parallel', states: { playback: { initial: 'stopped', states: {} }, volume: {} } }

// state value
snapshot.value; // { active: { playback: 'stopped', volume: 'audible' } }
snapshot.matches({ active: { volume: 'audible' } });

// completion
onDone: ({ event }) => ({ target: 'ready' }) // event.output === { region: output }

// multiple targets across regions
on: { reset: { target: ['playback.stopped', 'volume.audible'] } }

// cross-region condition
checkStateIn(self.getSnapshot(), 'volume.muted');
```
