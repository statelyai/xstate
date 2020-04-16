# @xstate/immer

This package contains utilities for using [Immer](https://immerjs.github.io/immer/docs/introduction) with XState.

Included in `@xstate/immer`:

- `assign()` - an Immer action that allows you to immutably assign to machine `context` in a convenient way
- `createUpdater()` - a useful function that allows you to cohesively specify a context update event, assign action, and validator, all together. (See example below)

## Quick Start

1. Install `xstate` and `@xstate/immer`:

```bash
npm install xstate @xstate/immer
```

2. Import the Immer utilities:

```js
import { createMachine, interpret } from 'xstate';
import { assign, createUpdater } from '@xstate/immer';

const updateLevel = createUpdater('UPDATE_LEVEL', (ctx, level) => {
  ctx.level = level;
});

const toggleMachine = createMachine({
  id: 'toggle',
  context: {
    count: 0,
    level: 0
  },
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: {
          target: 'active',
          // Immutably update context the same "mutable"
          // way as you would do with Immer!
          actions: assign((ctx) => ctx.count++)
        },
        // Use the updater for more convenience:
        [updateLevel.type]: {
          actions: updateLevel.assign
        }
      }
    },
    active: {
      on: {
        TOGGLE: { target: 'inactive' }
      }
    }
  }
});

const toggleService = interpret(toggleMachine)
  .onTransition((state) => {
    console.log(state.context);
  })
  .start();

toggleService.send('TOGGLE');
// { count: 1, level: 0 }

toggleService.send(udpateLevel(9));
// { count: 1, level: 9 }

toggleService.send('TOGGLE');
// { count: 2, level: 9 }

toggleService.send(udpateLevel(-100));
// Notice how the level is not updated in 'inactive' state:
// { count: 2, level: 9 }
```
