---
title: History states
description: Return a parent state to the child that was active when it was left.
---

A history state is a pseudostate that remembers which child of its parent was active when the parent was exited. Targeting it re-enters that child instead of the parent's `initial` child.

```ts
player: {
  initial: 'stopped',
  states: {
    stopped: {},
    playing: {},
    paused: {},
    hist: { type: 'history', target: 'stopped' }
  },
  on: { disconnect: { target: 'offline' } }
},
offline: {
  on: { reconnect: { target: 'player.hist' } }
}
```

Disconnecting while `playing` and then reconnecting returns to `playing`. Reconnecting before the player was ever left uses the default `target`.

## The default target is required

Every history state must declare a non-empty `target`. A machine with a history state and no target throws when it is created:

```
History state "(machine).player.hist" must declare a non-empty `target`.
```

> **Warning:** The default target is used whenever nothing has been recorded, including an internal self-transition to `.hist` before the parent has ever been exited. A history state does not keep the currently active child.

## Shallow and deep

History is shallow by default. A shallow history state records only the direct children of its parent that were active; their own descendants restart at their `initial` states.

```ts
form: {
  initial: 'details',
  states: {
    details: { initial: 'name', states: { name: {}, address: {} } },
    payment: {},
    hist: { type: 'history', target: 'details' },
    deepHist: { type: 'history', history: 'deep', target: 'details' }
  }
}
```

Leaving from `details.address` and returning through `form.hist` lands on `details.name`, because the recorded child is `details`, whose `initial` is `name`. Returning through `form.deepHist` lands on `details.address`, because deep history records the active atomic descendants.

`history: 'deep'`, `history: 'shallow'` and `history: true` (equivalent to shallow) are all accepted. A node with a `history` property is a history state whether or not `type: 'history'` is also written.

## Targeting a history state

A history state is targeted like any other state: by relative key, by dotted path, by `#id`, or by a leading dot for a transition inside the same parent.

```ts
on: {
  reconnect: { target: 'player.hist' },
  restore: { target: '#playerHistory' },
  restart: { target: '.hist' }
}
```

## What gets recorded

The parent's active configuration is captured during the exit phase, before exit actions run, and stored on the snapshot as `historyValue`, keyed by the history state's full id. Entering the history state replays those nodes.

Re-entering a parent through a history state still runs the parent's `entry` actions and restarts any actors it invokes. Put once-only work on a child state if you need it to run only on the first entry.

## History in parallel states

A history state can live directly on a [parallel](parallel-states.md) state, with a multi-target default that names one state per region:

```ts
active: {
  type: 'parallel',
  states: {
    playback: { initial: 'stopped', states: { stopped: {}, playing: {} } },
    volume: { initial: 'audible', states: { audible: {}, muted: {} } },
    hist: { type: 'history', history: 'deep', target: ['playback.stopped', 'volume.audible'] }
  }
}
```

Shallow history on a parallel state only records each region's root, so every region restarts at its own `initial`. Use `history: 'deep'`, or give each region its own history state and target them together, to restore nested region state.

Multi-target defaults must form a legal configuration: the targets must live in different regions of a common parallel ancestor, or machine creation throws.

## Persistence

`historyValue` is part of the persisted snapshot, serialized as state ids.

```ts
const persisted = actor.getPersistedSnapshot();
// persisted.historyValue === { '(machine).player.hist': [{ id: '(machine).player.playing' }] }

const restored = createActor(machine, { snapshot: persisted }).start();
restored.send({ type: 'reconnect' }); // back to 'playing'
```

Entries whose ids no longer resolve are dropped with a development warning, and the history state falls back to its default target. Renaming or restructuring states invalidates recorded history. See [persistence](persistence.md).

Use history states when a user leaves a multi-step form and returns to the step they were on, when a media player reconnects to its previous playback mode, or when a settings dialog reopens on its last panel.

## TypeScript

`target` on a history state is `string | string[]` and is checked against the machine's state paths, so an unknown default target is a type error as well as a runtime error. `snapshot.historyValue` is `Record<string, StateNode[]>` on a live snapshot and `Record<string, { id: string }[]>` once persisted.

History defaults can be declared in `setup(...)` when the state topology is
known there. The machine config can then omit `type` and `target`; the setup
contract supplies them to the state node and the same target validation still
applies:

```ts
const playerSetup = setup({
  states: {
    player: {
      type: 'compound',
      initial: 'stopped',
      states: {
        stopped: {},
        hist: { type: 'history', target: 'stopped' }
      }
    }
  }
});

playerSetup.createMachine({
  initial: 'player',
  states: { player: { states: { stopped: {}, hist: {} } } }
});
```

History defaults have no `input` field. A setup history target therefore cannot
be a state with required input. Target a compound or parallel state instead;
its normal initial transitions must provide input for any newly entered child
states. When history has a remembered configuration, the existing state inputs
are restored with that configuration.

## History states cheatsheet

```ts
// shallow (default), default target required
hist: { type: 'history', target: 'stopped' }

// deep
deepHist: { type: 'history', history: 'deep', target: 'details' }

// targeting
on: { reconnect: { target: 'player.hist' } }
on: { restore: { target: '#playerHistory' } }

// parallel default across regions
hist: { type: 'history', history: 'deep', target: ['playback.stopped', 'volume.audible'] }
```
