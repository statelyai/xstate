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

XState checks active leaves in the order they are defined. Each leaf searches for an enabled transition on itself and then on its ancestors. This applies to both event and `always` transitions. If multiple leaves select the same ancestor transition, it runs once.

When a leaf selects an ancestor transition and another leaf selects a region transition, both can run if they exit no states in common. For example, a parent `CANCEL` transition can leave the parallel state while a region's targetless `CANCEL` handler runs its action. When the transitions would exit any of the same states, the descendant transition takes precedence over the ancestor transition.

A region can transition between its child states while the other regions stay active.

## Transitions between regions

A transition whose source and target are in different regions exits and reenters their common parallel state. The exit domain extends to the nearest compound ancestor, which can enclose more than one parallel state. Untargeted regions restart at their initial states. Exit and entry handlers run again, and invoked actors in exited states stop.

### Move one region and preserve the others

In earlier v6 betas, the following cross-region target moved `right` to `y` and left `left` in `b`. It now reenters the parallel state, so `left` restarts at `a`.

```ts
// left.states.b
b: { on: { CROSS: { target: '#y' } } }

// right.states.y
y: { id: 'y' }
```

To preserve `left`, raise an event from a targetless transition in `b` and handle it inside `right`.

```ts
active: {
  type: 'parallel',
  states: {
    left: {
      initial: 'a',
      states: {
        a: { on: { ADVANCE: { target: 'b' } } },
        b: { on: { CROSS: (_, enq) => enq.raise({ type: 'right.activate' }) } }
      }
    },
    right: {
      initial: 'x',
      states: {
        x: { on: { 'right.activate': { target: 'y' } } },
        y: {}
      }
    }
  }
}
```

After `ADVANCE` and `CROSS`, `left` stays in `b` and `right` moves to `y` in a later microstep of the same macrostep. If `right` should react regardless of the active state in `left`, handle `CROSS` directly in `right.x`.

### Advance regions in sequence

In earlier v6 betas, these handlers let two `NEXT` events show `value2` and then `value3`. The direct targets now produce overlapping exit sets when both handlers are enabled, so only one transition can run.

```ts
// value1.states.x
x: { on: { NEXT: { target: '#question-flow.value2.shown' } } }

// value2.states.shown
shown: { on: { NEXT: { target: '#question-flow.value3.shown' } } }
```

Give each step its own event and let each receiving region select its local transition.

```ts
// value1.states.x
x: { on: { NEXT: (_, enq) => enq.raise({ type: 'SHOW_SECOND' }) } }

// value2.states
hidden: { on: { SHOW_SECOND: { target: 'shown' } } },
shown: { on: { CONTINUE: (_, enq) => enq.raise({ type: 'SHOW_THIRD' }) } }

// value3.states.hidden
hidden: { on: { SHOW_THIRD: { target: 'shown' } } }
```

Send `NEXT` for the first step and `CONTINUE` for the second. Both receiving regions end in `shown`. If multiple regions should move in the same microstep, give each region a local transition on the same event as in [One event, every region](#one-event-every-region).

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

Relative paths work the same way: `target: ['playback.stopped', 'volume.audible']`. Unnamed regions keep their current state when they stay active. If the transition exits and reenters the parallel state, unnamed regions restart at their initial states.

The target set must be a legal configuration: the targets must be in different regions of a common parallel ancestor. Two targets in the same region throw at machine creation, not at send time.

With typed setup state schemas, one `input` value is shared by every target in
the set and must contain the fields required by each target. Inputs for
descendants entered through a composite or parallel state's normal `initial`
transitions remain declared on those initial transitions.

## Cross-region conditions

Use `self.getSnapshot().matches(...)` inside a [transition function](guards.md) to read another region.

```ts
play: ({ self }) => {
  if (self.getSnapshot().matches({ volume: 'muted' })) return;
  return { target: 'playing' };
}
```

`matches(value)` accepts a path (`'volume.muted'`) or a state-value object. Keep these checks rare. Regions that constantly inspect each other are usually better modeled as a single region.

## Parallel regions or spawned actors

Use parallel regions when the concerns are part of the same unit of behavior, react to the same events, and complete together: playback and volume of one player, or the transfer and virus scan of one upload.

Use [spawned actors](spawn.md) when the concerns have independent lifetimes, arrive in unknown numbers, or own their own data: one actor per file in an upload queue, or per row in an editable table. Regions are fixed at design time; actors are created and stopped at runtime.

Common uses: a media player with independent playback, volume and subtitle regions; a checkout tracking payment authorization and address validation before it can proceed; a multi-step form tracking the current step alongside autosave status.

## TypeScript

Region keys are inferred from `states`, so `snapshot.value` and `matches` are typed against the real region structure and a misspelled region is a type error. `onDone` on a parallel state receives a done event whose `output` is an object keyed by region. With `setup({ states })`, declare the aggregate explicitly with the parallel state's `schemas.output` when the region contract needs to be available before the machine config is written.

You can declare the parallel shape in `setup(...)` and fill in behavior in
`createMachine(...)`:

```ts
const playerSetup = setup({
  states: {
    active: {
      type: 'parallel',
      states: { playback: {}, volume: {} }
    }
  }
});

playerSetup.createMachine({
  initial: 'active',
  states: {
    active: {
      states: {
        playback: { initial: 'playing', states: { playing: {} } },
        volume: { initial: 'audible', states: { audible: {} } }
      }
    }
  }
});
```

The setup contract supplies `type: 'parallel'`, so `active` cannot define an
`initial` state and its state value is typed as an object of regions.

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
self.getSnapshot().matches('volume.muted');
```
