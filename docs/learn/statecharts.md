---
title: Statecharts
description: Model nested, parallel and historical state.
---

Statecharts extend state machines with ways to organize complex states.

## Parent states

```ts
playing: {
  initial: 'normal',
  states: {
    normal: { on: { mute: { target: 'muted' } } },
    muted: { on: { unmute: { target: 'normal' } } }
  },
  on: { stop: { target: 'stopped' } }
}
```

The `stop` transition applies to every child of `playing`.

## Parallel states

```ts
active: {
  type: 'parallel',
  states: {
    playback: { initial: 'playing', states: { playing: {}, paused: {} } },
    volume: { initial: 'audible', states: { audible: {}, muted: {} } }
  }
}
```

## History states

```ts
history: { type: 'history', target: 'normal' }
```

Target the history state when returning to its parent. The default `target` is used when there is no recorded history.
