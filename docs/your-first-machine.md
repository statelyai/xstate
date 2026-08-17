---
title: Your first machine
description: Build a media player state machine and run it as an actor.
---

This machine describes a media player that can be stopped, playing or paused.

## Define the states

```ts
import { createMachine } from 'xstate';

const playerMachine = createMachine({
  initial: 'stopped',
  states: {
    stopped: {},
    playing: {},
    paused: {}
  }
});
```

`initial` tells the machine where to start. The keys inside `states` name every possible state.

## Add events and transitions

```ts
const playerMachine = createMachine({
  initial: 'stopped',
  states: {
    stopped: { on: { play: { target: 'playing' } } },
    playing: {
      on: {
        pause: { target: 'paused' },
        stop: { target: 'stopped' }
      }
    },
    paused: {
      on: {
        play: { target: 'playing' },
        stop: { target: 'stopped' }
      }
    }
  }
});
```

The `on` property maps events to transitions. A transition's `target` is the next state.

## Run the machine

A machine contains logic. An actor runs that logic.

```ts
import { createActor } from 'xstate';

const player = createActor(playerMachine);

player.subscribe((snapshot) => {
  console.log(snapshot.value);
});

player.start(); // 'stopped'
player.send({ type: 'play' }); // 'playing'
player.send({ type: 'pause' }); // 'paused'
```

`subscribe(...)` observes snapshots. `start()` starts the actor. `send(...)` sends an event to it.

## Check the current state

```ts
const snapshot = player.getSnapshot();

snapshot.matches('paused'); // true
snapshot.value; // 'paused'
```

Use `matches(...)` when checking a state. It also works with nested and parallel state values.
