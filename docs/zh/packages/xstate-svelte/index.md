# @xstate/svelte

The [@xstate/svelte package](https://github.com/statelyai/xstate/tree/main/packages/xstate-svelte) contains utilities for using [XState](https://github.com/statelyai/xstate) with [Svelte](https://github.com/sveltejs/svelte).

## Quick Start

1. Install `xstate` and `@xstate/svelte`:

```bash
npm i xstate @xstate/svelte
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/svelte/dist/xstate-svelte.min.js"></script>
```

By using the global variable `XStateSvelte`

or

```html
<script src="https://unpkg.com/@xstate/svelte/dist/xstate-svelte.fsm.min.js"></script>
```

By using the global variable `XStateSvelteFSM`

2. Import `useMachine`

```svelte
<script>
  import { useMachine } from '@xstate/svelte';
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

  const { state, send } = useMachine(toggleMachine);
</script>

<button on:click={() => send('TOGGLE')}>
  {$state.value === 'inactive'
    ? 'Click to activate'
    : 'Active! Click to deactivate'}
</button>
```

## API

### `useMachine(machine, options?)`

A function that interprets the given `machine` and starts a service that runs for the lifetime of the component.

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html).
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) OR one of the following Machine Config options: `guards`, `actions`, `activities`, `services`, `delays`, `immediate`, `context`, or `state`.

**Returns** `{ state, send, service}`:

- `state` - A [Svelte store](https://svelte.dev/docs#svelte_store) representing the current state of the machine as an XState `State` object. You should reference the store value by prefixing with `$` i.e. `$state`.
- `send` - A function that sends events to the running service.
- `service` - The created service.

### `useMachine(machine)` with `@xstate/fsm`

A function that interprets the given finite state `machine` from [`@xstate/fsm`] and starts a service that runs for the lifetime of the component.

This special `useMachine` hook is imported from `@xstate/svelte/lib/fsm`

**Arguments**

- `machine` - An [XState finite state machine (FSM)](https://xstate.js.org/docs/packages/xstate-fsm/).

**Returns** an object `{state, send, service}`:

- `state` - A [Svelte store](https://svelte.dev/docs#svelte_store) representing the current state of the machine as an `@xstate/fsm` `StateMachine.State` object. You should reference the store value by prefixing with `$` i.e. `$state`.
- `send` - A function that sends events to the running service.
- `service` - The created `@xstate/fsm` service.

**Example**

```svelte
<script>
  import { useMachine } from '@xstate/svelte/lib/fsm';
  import { createMachine, assign } from '@xstate/fsm';

  const fetchMachine = createMachine({
    id: 'fetch',
    initial: 'idle',
    context: {
      data: undefined
    },
    states: {
      idle: {
        on: { FETCH: 'loading' }
      },
      loading: {
        entry: ['load'],
        on: {
          RESOLVE: {
            target: 'success',
            actions: assign({
              data: (context, event) => event.data
            })
          }
        }
      },
      success: {}
    }
  });

  const onFetch = () => new Promise((res) => res('some data'));

  const { state, send } = useMachine(fetchMachine, {
    actions: {
      load: () => {
        onFetch().then((res) => {
          send({ type: 'RESOLVE', data: res });
        });
      }
    }
  });
</script>

{#if $state.value === 'idle'}
  <button on:click={() => send('FETCH')}>Fetch</button>
{:else if $state.value === 'loading'}
  <div>Loading...</div>
{:else if $state.value === 'success'}
  <div>
    Success! Data: <div data-testid="data">{$state.context.data}</div>
  </div>
{/if}
```

### `useSelector(actor, selector, compare?, getSnapshot?)`

A function that returns [Svelte store](https://svelte.dev/docs#svelte_store) representing the selected value from the snapshot of an `actor`, such as a service. The store will only be updated when the selected value changes, as determined by the optional `compare` function.

**Arguments**

- `actor` - a service or an actor-like object that contains `.send(...)` and `.subscribe(...)` methods.
- `selector` - a function that takes in an actor's "current state" (snapshot) as an argument and returns the desired selected value.
- `compare` (optional) - a function that determines if the current selected value is the same as the previous selected value.

**Example**

```svelte
<script lang="ts">
  import { interpret } from 'xstate';
  import { createModel } from 'xstate/lib/model';
  import { useSelector } from '../src';

  const model = createModel(
    {
      count: 0,
      anotherCount: 0
    },
    {
      events: {
        INCREMENT: () => ({}),
        INCREMENT_ANOTHER: () => ({})
      }
    }
  );

  const machine = model.createMachine({
    initial: 'idle',
    context: model.initialContext,
    states: {
      idle: {
        on: {
          INCREMENT: {
            actions: model.assign({ count: ({ count }) => count + 1 })
          },
          INCREMENT_ANOTHER: {
            actions: model.assign({
              anotherCount: ({ anotherCount }) => anotherCount + 1
            })
          }
        }
      }
    }
  });

  const service = interpret(machine).start();

  const count = useSelector(service, (state) => state.context.count);

  let withSelector = 0;
  $: $count && withSelector++;
  let withoutSelector = 0;
  $: $service.context.count && withoutSelector++;
</script>

<button data-testid="count" on:click={() => service.send('INCREMENT')}
  >Increment count</button
>
<button data-testid="another" on:click={() => service.send('INCREMENT_ANOTHER')}
  >Increment another count</button
>

<div data-testid="withSelector">{withSelector}</div>
<div data-testid="withoutSelector">{withoutSelector}</div>
```

## Configuring Machines

Existing machines can be configured by passing the machine options as the 2nd argument of `useMachine(machine, options)`.

Example: the `'fetchData'` service and `'notifySuccess'` action are both configurable:

```svelte
<script>
  import { useMachine } from '@xstate/svelte';
  import { createMachine, assign } from 'xstate';

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
              data: (_, event) => event.data
            })
          },
          onError: {
            target: 'failure',
            actions: assign({
              error: (_, event) => event.data
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

  const onResolve = (data) => {
    // Do something with data
  };

  const { state, send } = useMachine(fetchMachine, {
    actions: {
      notifySuccess: (context) => onResolve(context.data)
    },
    services: {
      fetchData: (_, event) =>
        fetch(`some/api/${event.query}`).then((res) => res.json())
    }
  });
</script>

{#if $state.value === 'idle'}
  <button on:click={() => send('FETCH', { query: 'something' })}>
    Search for something
  </button>
{:else if $state.value === 'loading'}
  <div>Searching...</div>
{:else if $state.value === 'success'}
  <div>Success! Data: {$state.context.data}</div>
{:else if $state.value === 'failure'}
  <p>{$state.context.error.message}</p>
  <button on:click={() => send('RETRY')}>Retry</button>
{/if}
```

## Matching States

When using [hierarchical](https://xstate.js.org/docs/guides/hierarchical.html) and [parallel](https://xstate.js.org/docs/guides/parallel.html) machines, the state values will be objects, not strings. In this case, it is best to use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-properties).

```svelte
{#if $state.matches('idle')}
  //
{:else if $state.matches({ loading: 'user' })}
  //
{:else if $state.matches({ loading: 'friends' })}
  //
{/if}
```

## Persisted and Rehydrated State

You can persist and rehydrate state with `useMachine(...)` via `options.state`:

```js
// Get the persisted state config object from somewhere, e.g. localStorage

const persistedState = JSON.parse(
  localStorage.getItem('some-persisted-state-key')
);

const { state, send } = useMachine(someMachine, {
  state: persistedState
});

// state will initially be that persisted state, not the machine's initialState
```

## Services

`XState` services implement the [Svelte store contract](https://svelte.dev/docs#Store_contract). Existing services and spawned actors can therefore be accessed directly and subscriptions are handled automatically by prefixing the service name with `$`.

**Example**

```js
// service.js

import { createMachine, interpret } from 'xstate';

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

export const toggleService = interpret(toggleMachine).start();
```

```svelte
// App.svelte

<script>
  import { toggleService } from './service';
</script>

<button on:click={() => toggleService.send('TOGGLE')}>
  {$toggleService.value === 'inactive'
    ? 'Click to activate'
    : 'Active! Click to deactivate'}
</button>
```
