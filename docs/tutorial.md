---
title: 'Tutorial: build a media player'
description: Grow one machine from three states into a full media player with context, guards, async loading, statecharts, timers, emitted events and a UI.
---

In this tutorial you build one machine, part by part. Each part adds a single concept, ends with code you can run, and lists the expected output.

Start from [your first machine](your-first-machine.md), which introduced states, transitions and actors. Everything after Part 1 is new.

You need a TypeScript project with `xstate` and `zod` installed. Run each part with `tsx`, `vite-node`, or another runner. Parts 3 to 6 show only what changes; Part 7 lists the complete machine.

## Part 1: States and transitions

A media player is stopped, playing, or paused. Events move it between them.

```ts
import { createActor, createMachine } from 'xstate';

const playerMachine = createMachine({
  initial: 'stopped',
  states: {
    stopped: { on: { play: { target: 'playing' } } },
    playing: {
      on: { pause: { target: 'paused' }, stop: { target: 'stopped' } }
    },
    paused: {
      on: { play: { target: 'playing' }, stop: { target: 'stopped' } }
    }
  }
});

const player = createActor(playerMachine);

player.subscribe((snapshot) => console.log(snapshot.value));
player.start();

player.send({ type: 'play' });
player.send({ type: 'pause' });
player.send({ type: 'stop' });
```

**What you should see:** `stopped`, `playing`, `paused`, `stopped`.

Sending `pause` while stopped does nothing. A state only responds to the events it declares, so the machine cannot take a transition you did not define.

## Part 2: Context and events with data

States describe which mode the player is in. Context holds the data that goes with it: a playlist and the index of the current track.

Add `context`, and two new events for moving through the playlist. Declare event schemas so TypeScript knows the shape of every event, and so you get typed methods on `actor.trigger`.

```ts
import { z } from 'zod';
import { createActor, createMachine } from 'xstate';

const tracks = [
  { id: 't1', title: 'Bloom' },
  { id: 't2', title: 'Ember' },
  { id: 't3', title: 'Harbor' }
];

const playerMachine = createMachine({
  schemas: {
    events: {
      play: z.object({}),
      pause: z.object({}),
      stop: z.object({}),
      next: z.object({}),
      previous: z.object({})
    }
  },
  context: { tracks, index: 0 },
  initial: 'stopped',
  on: {
    next: ({ context }) => ({
      context: { ...context, index: context.index + 1 }
    }),
    previous: ({ context }) => ({
      context: { ...context, index: context.index - 1 }
    })
  },
  states: {
    // unchanged from Part 1
    stopped: { on: { play: { target: 'playing' } } },
    playing: {
      on: { pause: { target: 'paused' }, stop: { target: 'stopped' } }
    },
    paused: {
      on: { play: { target: 'playing' }, stop: { target: 'stopped' } }
    }
  }
});

const player = createActor(playerMachine).start();

player.trigger.play();
player.trigger.next();

console.log(player.getSnapshot().context.index); // 1
console.log(player.getSnapshot().value); // 'playing'
```

`next` and `previous` live in the machine's root `on`, so they work in every state. Put an event on the root when every state should handle it.

A transition can be a function. It receives `{ context, event }` and returns a partial description of what happens next: a `target`, a new `context`, or both. Here there is no `target`, so the player stays put and only the context changes.

`player.trigger.next()` is the typed shortcut for `player.send({ type: 'next' })`. It exists because you declared the event in `schemas.events`.

**What you should see:** index `1`, value `playing`.

## Part 3: Guarding behavior

Run `player.trigger.next()` four times and the index runs off the end of the playlist. A guard prevents that.

In XState v6 a guard is not a separate property. It is a condition inside the transition function: return `undefined` and the event is not handled at all, with no state change, no context change and no effects.

```ts
on: {
  next: ({ context }) => {
    if (context.index === context.tracks.length - 1) return;
    return { context: { ...context, index: context.index + 1 } };
  },
  previous: ({ context }) => {
    if (context.index === 0) return;
    return { context: { ...context, index: context.index - 1 } };
  }
}
```

The same technique branches to different targets. Return whichever transition you want:

```ts
play: ({ context }) => {
  if (context.tracks.length === 0) return { target: 'empty' };
  return { target: 'playing' };
}
```

There are no transition arrays and no `guard` property. One event maps to one transition function, and plain `if` statements decide what it does.

Swap the two handlers into Part 2's machine and run it:

```ts
player.trigger.next();
player.trigger.next();
player.trigger.next(); // ignored: already the last track
console.log(player.getSnapshot().context.index); // 2
player.trigger.previous();
console.log(player.getSnapshot().context.index); // 1
```

**What you should see:** `2`, then `1`. The third `next` is ignored.

## Part 4: Async work

A real player fetches track metadata before it can play. Async work belongs in an actor, not in a transition.

`createAsyncLogic(...)` wraps one async operation. It receives `input` and an `AbortSignal` that XState aborts when the actor stops, so a request for a track you skipped past is canceled.

```ts
const loadTrack = createAsyncLogic({
  run: async ({
    input,
    signal
  }: {
    input: { id: string };
    signal: AbortSignal;
  }) => {
    const response = await fetch(`/tracks/${input.id}`, { signal });
    if (!response.ok) throw new Error('Could not load track');
    return (await response.json()) as { duration: number };
  }
});
```

`invoke` runs that logic for the lifetime of a state. Add a `loading` state between `stopped` and `playing`, and an `error` state that offers `retry`. Add `duration: 0` to `context` and `retry: z.object({})` to `schemas.events`.

```ts
states: {
  stopped: { on: { play: { target: 'loading' } } },
  loading: {
    invoke: {
      src: loadTrack,
      input: ({ context }) => ({ id: context.tracks[context.index].id }),
      onDone: ({ context, event }) => ({
        target: 'playing',
        context: { ...context, duration: event.output.duration }
      }),
      onError: { target: 'error' }
    }
  },
  error: { on: { retry: { target: 'loading' } } },
  playing: {
    on: { pause: { target: 'paused' }, stop: { target: 'stopped' } }
  },
  paused: {
    on: { play: { target: 'playing' }, stop: { target: 'stopped' } }
  }
}
```

`onDone` receives the resolved value on `event.output`; `onError` receives the rejection on `event.error`. Invoke belongs to the state, not to the transition that led there: entering `loading` starts the request, leaving it stops the request.

Changing tracks should reload metadata, so point `next` and `previous` at `loading` too:

```ts
next: ({ context }) => {
  const index = context.index + 1;
  if (index === context.tracks.length) return;
  return { target: '.loading', context: { ...context, index, duration: 0 } };
}
```

The leading dot in `'.loading'` means "a child of the state this transition is defined on", which is the root here.

**What you should see:** subscribe to the actor and send `play`. The value logs `loading`, then `playing` with `context.duration` set. If the request fails, the value logs `error`, from which `player.trigger.retry()` tries again. Point the fetch at a URL that fails to see the error path.

## Part 5: Statecharts

`playing` and `paused` share a `stop` transition, and both mean "a track is loaded and active", so they belong under a common parent.

Nest them inside an `active` state and put `stop` on the parent. Any event handled by a parent is handled by all of its children.

Volume changes independently of playback. The player can be muted whether it is playing or paused, and muting should not disturb playback. Two independent concerns in one state means a **parallel** state: `active` becomes `type: 'parallel'` with a `playback` region and a `volume` region, both active at once.

Replace `playing` and `paused` with a single `active` state, and point the invoke's `onDone` at `'active'`. Add `mute` and `unmute` to `schemas.events`.

```ts
active: {
  type: 'parallel',
  on: { stop: { target: 'stopped' } },
  states: {
    playback: {
      initial: 'playing',
      states: {
        playing: { on: { pause: { target: 'paused' } } },
        paused: { on: { play: { target: 'playing' } } }
      }
    },
    volume: {
      initial: 'audible',
      states: {
        audible: { on: { mute: { target: 'muted' } } },
        muted: { on: { unmute: { target: 'audible' } } }
      }
    }
  }
}
```

A parallel state has no `initial` of its own. Every region is entered at once, and each region declares its own `initial`.

Run it and inspect the state value once loading finishes:

```ts
player.trigger.pause();
player.trigger.mute();

console.log(player.getSnapshot().value);
// { active: { playback: 'paused', volume: 'muted' } }
// prefix match: true
console.log(player.getSnapshot().matches({ active: { playback: 'paused' } }));
```

**What you should see:** a state value object with both regions. `matches(...)` is a prefix match, so you can ask about one region and ignore the other. `stop` still works from anywhere inside `active`, because it is declared on the parent.

## Part 6: Timers

Add a sleep timer: "stop the player in N milliseconds". Because a later event may cancel or replace it, this is a delayed event rather than an `after` transition.

`enq` is the enqueuer, the second argument of every transition function. It collects the effects a transition should run.

```ts
sleepAfter: ({ event }, enq) => {
  enq.cancel('sleep');
  enq.raise({ type: 'stop' }, { delay: event.delay, id: 'sleep' });
},
cancelSleep: (_, enq) => {
  enq.cancel('sleep');
}
```

`enq.raise(...)` sends an event back into this machine, and `{ id: 'sleep' }` gives the pending event a name so `enq.cancel('sleep')` can remove it. Canceling first means a second `sleepAfter` replaces the pending timer instead of stacking one on top of it.

Put both handlers in the root `on`, next to `next` and `previous`, and declare the events in `schemas.events`:

```ts
sleepAfter: z.object({ delay: z.number() }),
cancelSleep: z.object({})
```

Try it:

```ts
player.trigger.sleepAfter({ delay: 5_000 }); // stops 5 seconds later
player.trigger.cancelSleep(); // cancels the pending stop
```

**What you should see:** without the cancel, the state value drops to `'stopped'` after five seconds. With it, the player stays in `active`. `event.delay` is typed as a number because of the event schema.

For a timer tied to a state instead of an event, use `after: { 5_000: { target: 'stopped' } }`. It starts when the state is entered and is canceled when the state is exited. See [delays](delays.md).

## Part 7: Actors and emitted events

The machine should tell the outside world when the track changes so the UI can show a toast. That is not state; it is something that happened once. Emit an event.

Declare it in `schemas.emitted`, emit it with `enq.emit(...)` inside `next` and `previous`, and handle it with `actor.on(...)`. Put the emit after the guard, so a `next` at the end of the playlist emits nothing.

Here is the complete machine:

```ts
import { z } from 'zod';
import { createActor, createAsyncLogic, createMachine } from 'xstate';

const tracks = [
  { id: 't1', title: 'Bloom' },
  { id: 't2', title: 'Ember' },
  { id: 't3', title: 'Harbor' }
];

const loadTrack = createAsyncLogic({
  run: async ({
    input,
    signal
  }: {
    input: { id: string };
    signal: AbortSignal;
  }) => {
    const response = await fetch(`/tracks/${input.id}`, { signal });
    if (!response.ok) throw new Error('Could not load track');
    return (await response.json()) as { duration: number };
  }
});

export const playerMachine = createMachine({
  schemas: {
    events: {
      play: z.object({}),
      pause: z.object({}),
      stop: z.object({}),
      next: z.object({}),
      previous: z.object({}),
      retry: z.object({}),
      mute: z.object({}),
      unmute: z.object({}),
      sleepAfter: z.object({ delay: z.number() }),
      cancelSleep: z.object({})
    },
    emitted: {
      trackChanged: z.object({ title: z.string() })
    }
  },
  context: { tracks, index: 0, duration: 0 },
  initial: 'stopped',
  on: {
    next: ({ context }, enq) => {
      const index = context.index + 1;
      if (index === context.tracks.length) return;
      enq.emit({ type: 'trackChanged', title: context.tracks[index].title });
      return { target: '.loading', context: { ...context, index, duration: 0 } };
    },
    previous: ({ context }, enq) => {
      const index = context.index - 1;
      if (index < 0) return;
      enq.emit({ type: 'trackChanged', title: context.tracks[index].title });
      return { target: '.loading', context: { ...context, index, duration: 0 } };
    },
    sleepAfter: ({ event }, enq) => {
      enq.cancel('sleep');
      enq.raise({ type: 'stop' }, { delay: event.delay, id: 'sleep' });
    },
    cancelSleep: (_, enq) => {
      enq.cancel('sleep');
    }
  },
  states: {
    stopped: { on: { play: { target: 'loading' } } },
    loading: {
      invoke: {
        src: loadTrack,
        input: ({ context }) => ({ id: context.tracks[context.index].id }),
        onDone: ({ context, event }) => ({
          target: 'active',
          context: { ...context, duration: event.output.duration }
        }),
        onError: { target: 'error' }
      }
    },
    error: { on: { retry: { target: 'loading' } } },
    active: {
      type: 'parallel',
      on: { stop: { target: 'stopped' } },
      states: {
        playback: {
          initial: 'playing',
          states: {
            playing: { on: { pause: { target: 'paused' } } },
            paused: { on: { play: { target: 'playing' } } }
          }
        },
        volume: {
          initial: 'audible',
          states: {
            audible: { on: { mute: { target: 'muted' } } },
            muted: { on: { unmute: { target: 'audible' } } }
          }
        }
      }
    }
  }
});

const player = createActor(playerMachine).start();

player.on('trackChanged', (event) => {
  console.log(`Now playing: ${event.title}`);
});

player.trigger.play();
player.trigger.next();
```

**What you should see:** `Now playing: Ember` logged once, and no log at all when `next` is sent at the end of the playlist.

Use an emitted event when the outside world should react to something that happened. Use a snapshot when it should render the current state. See [emitted events](emitted-events.md).

## Part 8: Wire it to a UI

Nothing about the machine changes. A UI reads snapshots and sends events.

```html
<p id="status">stopped</p>
<p id="title">—</p>
<button id="play">Play</button> <button id="pause">Pause</button>
<button id="stop">Stop</button> <button id="previous">Previous</button>
<button id="next">Next</button> <button id="mute">Mute</button>
```

```ts
import { createActor } from 'xstate';
import { playerMachine } from './playerMachine';

const player = createActor(playerMachine).start();

const status = document.getElementById('status')!;
const title = document.getElementById('title')!;

const stateValue = player.select((snapshot) => JSON.stringify(snapshot.value));
const trackTitle = player.select(
  (snapshot) => snapshot.context.tracks[snapshot.context.index].title
);

status.textContent = stateValue.get();
stateValue.subscribe((value) => (status.textContent = value));

title.textContent = trackTitle.get();
trackTitle.subscribe((value) => (title.textContent = value));

const buttons = ['play', 'pause', 'stop', 'next', 'previous', 'mute'] as const;

for (const type of buttons) {
  document.getElementById(type)!.onclick = () => player.trigger[type]();
}

player.on('trackChanged', (event) => showToast(`Now playing: ${event.title}`));
```

`player.select(...)` returns a readable that notifies only when its value changes, so the title element is not touched when only playback state moves. Call `get()` for the initial render, since `subscribe(...)` does not replay the current value.

**What you should see:** clicking `Play` shows `"loading"` then `{"active":{"playback":"playing","volume":"audible"}}`. Clicking `Pause` updates the status but leaves the title alone. Buttons that the current state does not handle do nothing.

Frameworks work the same way, with a hook or store binding instead of manual subscriptions. See [frameworks](frameworks.md) for React, Vue, Svelte and Solid.

## What next?

You built one machine with context, guards, invoked async logic, hierarchy, parallel regions, delayed events, emitted events and a UI. From here:

- [Statecharts](statecharts.md) — nested, parallel and history states
- [Actors](actors.md) — spawning, communication and actor systems
- [Frameworks](frameworks.md) — bindings for React, Vue, Svelte and Solid
- [Testing](testing.md) — testing machines and the actors that run them
