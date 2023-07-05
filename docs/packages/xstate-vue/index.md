# @xstate/vue

The [@xstate/vue package](https://github.com/statelyai/xstate/tree/main/packages/xstate-vue) contains utilities for using [XState](https://github.com/statelyai/xstate) with [Vue](https://github.com/vuejs/vue).

[[toc]]

::: warning Vue 2 Notice:
If you're using Vue 2.x, please see [the Vue recipe](../../recipes/vue.html) instead, or use the [`xstate-vue2` package](https://github.com/ChrisShank/xstate-vue2) if you want to use the Vue Composition API.
:::

## Quick Start

1. Install `xstate` and `@xstate/vue`:

```bash
npm i xstate @xstate/vue
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/vue/dist/xstate-vue.min.js"></script>
```

By using the global variable `XStateVue`

or

```html
<script src="https://unpkg.com/@xstate/vue/dist/xstate-vue.fsm.min.js"></script>
```

By using the global variable `XStateVueFSM`

2. Import the `useMachine` composition function:

```vue
<template>
  <button @click="send({ type: 'TOGGLE' })">
    {{
      state.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'
    }}
  </button>
</template>

<script>
import { useMachine } from '@xstate/vue';
import { createMachine } from 'xstate';

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

export default {
  setup() {
    const { state, send } = useMachine(toggleMachine);
    return {
      state,
      send
    };
  }
};
</script>
```

## API

### `useActor(actorLogic, options?)`

A [Vue composition function](https://v3.vuejs.org/guide/composition-api-introduction.html) that interprets the given `machine` and starts a service that runs for the lifetime of the component.

**Arguments**

- `actorLogic` - Actor logic, such as a machine from `createMachine(...)` or promise logic from `fromPromise(...)`.
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options)

**Returns** `{ snapshot, send, actorRef }`:

- `snapshot` - Represents the current snapshot of the actor.
- `send` - A function that sends events to the running actorRef.
- `actorRef` - The created actorRef.

### `useMachine(machine, options?)`

Alias for `useActor(machine, options?)`

### `useActorRef(actorLogic, options?)`

A [Vue composition function](https://v3.vuejs.org/guide/composition-api-introduction.html) that returns the `actorRef` created from the `machine` with the `options`, if specified. It also sets up a subscription to the `actorRef` with the `observer`, if provided.

**Arguments**

- `actorLogic` - Actor logic, such as a machine from `createMachine(...)` or promise logic from `fromPromise(...)`.
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options)
- `observer` (optional) - an observer or listener that listens to state updates:
  - an observer (e.g., `{ next: (state) => {/* ... */} }`)
  - or a listener (e.g., `(state) => {/* ... */}`)

```js
import { useActorRef } from '@xstate/vue';
import { someMachine } from '../path/to/someMachine';
export default {
  setup() {
    const actorRef = useActorRef(someMachine);
    return actorRef;
  }
};
```

With options + listener:

```js
import { useActorRef } from '@xstate/vue';
import { someMachine } from '../path/to/someMachine';
export default {
  setup() {
    const actorRef = useActorRef(
      someMachine.provide({
        actions: {
          someAction: () => {
            // ...
          }
        }
      }),
      undefined,
      (state) => {
        // subscribes to state changes
        console.log(state.value);
      }
    );
    // ...
  }
};
```

### `useSelector(actorRef, selector, compare?, getSnapshot?)`

A [Vue composition function](https://v3.vuejs.org/guide/composition-api-introduction.html) that returns the selected value from the snapshot of an `actor`, such as a service. This hook will only cause a rerender if the selected value changes, as determined by the optional `compare` function.

_Since 0.6.0_

**Arguments**

- `actorRef` - an actor ref
- `selector` - a function that takes in an actor's "current state" (snapshot) as an argument and returns the desired selected value.
- `compare` (optional) - a function that determines if the current selected value is the same as the previous selected value.
- `getSnapshot` (optional) - a function that should return the latest emitted value from the `actor`.
  - Defaults to attempting to get the `actor.state`, or returning `undefined` if that does not exist. Will automatically pull the state from services.

```js
import { useSelector } from '@xstate/vue';

const selectCount = (state) => state.context.count;

export default {
  props: ['actorRef'],
  setup(props) {
    const count = useSelector(props.actorRef, selectCount);
    // ...
    return { count };
  }
};
```

With `compare` function:

```js
import { useSelector } from '@xstate/vue';

const selectUser = (state) => state.context.user;
const compareUser = (prevUser, nextUser) => prevUser.id === nextUser.id;

export default {
  props: ['actorRef'],
  setup(props) {
    const user = useSelector(props.actorRef, selectUser, compareUser);
    // ...
    return { user };
  }
};
```

With `useActorRef(...)`:

```js
import { useActorRef, useSelector } from '@xstate/vue';
import { someMachine } from '../path/to/someMachine';

const selectCount = (state) => state.context.count;

export default {
  setup() {
    const actorRef = useActorRef(someMachine);
    const count = useSelector(actorRef, selectCount);
    // ...
    return { count, actorRef };
  }
};
```

### `useMachine(machine)` with `@xstate/fsm`

A [Vue composition function](https://v3.vuejs.org/guide/composition-api-introduction.html) that interprets the given finite state `machine` from [`@xstate/fsm`] and starts a service that runs for the lifetime of the component.

This special `useMachine` hook is imported from `@xstate/vue/fsm`

**Arguments**

- `machine` - An [XState finite state machine (FSM)](https://xstate.js.org/docs/packages/xstate-fsm/).

**Returns** an object `{state, send, service}`:

- `state` - Represents the current state of the machine as an `@xstate/fsm` `StateMachine.State` object.
- `send` - A function that sends events to the running service.
- `service` - The created `@xstate/fsm` service.

**Example** (TODO)

## Configuring Machines

Existing machines can be configured by passing the machine options as the 2nd argument of `useMachine(machine, options)`.

Example: the `'fetchData'` service and `'notifySuccess'` action are both configurable:

```vue
<template>
  <template v-if="state.value === 'idle'">
    <button @click="send({ type: 'FETCH', query: 'something' })">
      Search for something
    </button>
  </template>

  <template v-else-if="state.value === 'loading'">
    <div>Searching...</div>
  </template>

  <template v-else-if="state.value === 'success'">
    <div>Success! {{ state.context.data }}</div>
  </template>

  <template v-else-if="state.value === 'failure'">
    <p>{{ state.context.error.message }}</p>
    <button @click="send('RETRY')">Retry</button>
  </template>
</template>

<script>
import { assign, createMachine } from 'xstate';
import { useMachine } from '@xstate/vue';

const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  context: {
    data: undefined,
    error: undefined
  },
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      invoke: {
        src: 'fetchData',
        onDone: {
          target: 'success',
          actions: assign({
            data: (_context, event) => event.data
          })
        },
        onError: {
          target: 'failure',
          actions: assign({
            error: (_context, event) => event.data
          })
        }
      }
    },
    success: {
      entry: 'notifySuccess',
      type: 'final'
    },
    failure: {
      on: {
        RETRY: 'loading'
      }
    }
  }
});

export default {
  props: {
    onResolve: {
      type: Function,
      default: () => {}
    }
  },
  setup(props) {
    const { state, send } = useMachine(fetchMachine, {
      actions: {
        notifySuccess: (ctx) => props.onResolve(ctx.data)
      },
      services: {
        fetchData: (_context, event) =>
          fetch(`some/api/${event.query}`).then((res) => res.json())
      }
    });
    return {
      state,
      send
    };
  }
};
</script>
```

## Matching States

For [hierarchical](https://xstate.js.org/docs/guides/hierarchical.html) and [parallel](https://xstate.js.org/docs/guides/parallel.html) machines, the state values will be objects, not strings. In this case, it's better to use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-getters):

```vue
<template>
  <div>
    <loader-idle v-if="state.matches('idle')" />
    <loader-loading-user v-if-else="state.matches({ loading: 'user' })" />
    <loader-loading-friends v-if-else="state.matches({ loading: 'friends' })" />
  </div>
</template>
```

## Persisted and Rehydrated State

You can persist and rehydrate state with `useMachine(...)` via `options.state`:

```vue
<script>
// Get the persisted state config object from somewhere, e.g. localStorage
const persistedState = JSON.parse(
  localStorage.getItem('some-persisted-state-key')
);

export default {
  setup() {
    const { snapshot, send } = useMachine(someMachine, {
      state: persistedState
    });

    // snapshot will initially be that persisted state, not the machine's initialState
    return { snapshot, send };
  }
};
</script>
```
