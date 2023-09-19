# @xstate/immer

<p align="center">
  <a href="https://xstate.js.org">
  <br />
  <img src="https://user-images.githubusercontent.com/1093738/79572515-1509e180-808b-11ea-92aa-10958521aa68.png" alt="XState Immer" width="200"/>
  <br />
    <sub><strong>XState with Immer</strong></sub>
  <br />
  <br />
  </a>
</p>

This package contains utilities for using [Immer](https://immerjs.github.io/immer/docs/introduction) with [XState](https://github.com/statelyai/xstate).

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-immer/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Quick start

Included in `@xstate/immer`:

- `assign()` - an Immer action that allows you to immutably assign to machine `context` in a convenient way
- `createUpdater()` - a useful function that allows you to cohesively define a context update event event creator and assign action, all together. ([See an example](#createupdatereventtype-recipe) below)

1. Install `immer`, `xstate`, `@xstate/immer`:

```bash
npm install immer xstate @xstate/immer
```

**Note:** You don't need to `import` anything from `immer`; it is a peer-dependency of `@xstate/immer`, so it must be installed.

2. Import the Immer utilities:

```js
import { createMachine, interpret } from 'xstate';
import { assign, createUpdater } from '@xstate/immer';

const levelUpdater = createUpdater('UPDATE_LEVEL', (ctx, { input }) => {
  ctx.level = input;
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
        }
      }
    },
    active: {
      on: {
        TOGGLE: {
          target: 'inactive'
        },
        // Use the updater for more convenience:
        [levelUpdater.type]: {
          actions: levelUpdater.action
        }
      }
    }
  }
});

const toggleService = interpret(toggleMachine)
  .onTransition((state) => {
    console.log(state.context);
  })
  .start();

toggleService.send({ type: 'TOGGLE' });
// { count: 1, level: 0 }

toggleService.send(levelUpdater.update(9));
// { count: 1, level: 9 }

toggleService.send({ type: 'TOGGLE' });
// { count: 2, level: 9 }

toggleService.send(levelUpdater.update(-100));
// Notice how the level is not updated in 'inactive' state:
// { count: 2, level: 9 }
```
