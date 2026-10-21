---
title: Quick start
description: Create and run your first XState state machine.
---

XState helps you model how software responds to events. This example models a media player with three states.

## Install XState

```bash
npm install xstate@alpha
```

## Create a state machine

```ts
import { createActor, createMachine } from 'xstate';

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

const player = createActor(playerMachine).start();

player.send({ type: 'pause' });
console.log(player.getSnapshot().value); // 'stopped'

player.send({ type: 'play' });
console.log(player.getSnapshot().value); // 'playing'
```

The first `pause` event does not change the state. The `stopped` state does not define what should happen for that event. The player can only follow the transitions you define.

The machine describes the behavior. `createActor(...)` creates a running actor from that behavior. You can send events to the actor and read its current snapshot.

## What next?

- [Learn why state machines are useful](why-state-machines.md).
- [Build your first machine step by step](your-first-machine.md).
- [Choose between XState and XState Store](choose-xstate.md).
