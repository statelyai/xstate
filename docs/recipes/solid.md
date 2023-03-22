# Usage with SolidJS

XState can be used with SolidJS to:

- Coordinate local state
- Manage global state
- Consume data from other hooks
- etc.

## Local state

```js
import { useMachine } from '@xstate/solid';
import { toggleMachine } from '../path/to/toggleMachine';

function Toggle() {
  const [current, send] = useMachine(toggleMachine);

  return (
    <button onClick={() => send({ type: 'TOGGLE' })}>
      {current.matches('inactive') ? 'Off' : 'On'}
    </button>
  );
}
```

## Global State in Context

### Context Provider

You can store a machine or service in [SolidJS context](https://www.solidjs.com/docs/latest/api#createcontext) to make them available throughout the component tree. Because @xstate/solid produces machines, actors, and services with SolidJS' fine-grained reactivity, you can access machine context and methods (e.g. `matches` or `can`) without worrying about wasted re-renders

```js
import { createContext } from 'solid-js';
import { useMachine } from '@xstate/solid';
import { authMachine } from './auth.machine';

export const GlobalStateContext = createContext({});

export const GlobalStateProvider = (props) => {
  const authService = useMachine(authMachine);

  return (
    <GlobalStateContext.Provider value={{ authService }}>
      {props.children}
    </GlobalStateContext.Provider>
  );
};
```

> For Typescript 4.7+, you can create the context as `createContext({ authService: {} as ReturnType<typeof useMachine<typeof authMachine>> });` to ensure strong typings.

### Utilizing context

Further down the tree, you can subscribe to the service like this:

```js
import { useContext } from 'solid-js';
import { GlobalStateContext } from './globalState';

export const SomeComponent = (props) => {
  const {
    authService: [state]
  } = useContext(GlobalStateContext);
  return <>{state.matches('loggedIn') ? 'Logged In' : 'Logged Out'}</>;
};
```

The `useActor` hook listens for whenever the service changes, and updates the state value.

### Dispatching events

For dispatching events to the global store, you can call a service's `send` function directly.

```js
import { useContext } from 'solid-js';
import { GlobalStateContext } from './globalState';

export const SomeComponent = (props) => {
  const {
    authService: [, send]
  } = useContext(GlobalStateContext);
  return <button onClick={() => send({ type: 'LOG_OUT' })}>Log Out</button>;
};
```

### Named actions/services/guards

Let's imagine that when you navigate to a certain state, you want to leave the page and go somewhere else, via `solid-app-router`. For now, we'll declare that action as a 'named' action - where we name it now and declare it later.

```js
import { createMachine } from 'xstate';

export const machine = createMachine({
  initial: 'toggledOff',
  states: {
    toggledOff: {
      on: {
        TOGGLE: 'toggledOn'
      }
    },
    toggledOn: {
      entry: ['goToOtherPage']
    }
  }
});
```

Inside your component, you can now _implement_ the named action. I've added `useNavigate` from `solid-app-router` as an example, but you can imagine this working with any hook or prop-based router.

```js
import { machine } from './machine';
import { useMachine } from '@xstate/solid';
import { useNavigate } from 'solid-app-router';

const Component = () => {
  const navigate = useNavigate();

  const [state, send] = useMachine(machine, {
    actions: {
      goToOtherPage: () => {
        navigate('/other-page');
      }
    }
  });

  return null;
};
```

This also works for services, guards, and delays.

> If you use this technique, any references you use inside `goToOtherPage` will be kept up to date each render. That means you don't need to worry about stale references.

### Syncing data with createEffect

Sometimes, you want to outsource some functionality to another hook.

The best way to manage this is via `createEffect`.

```js
import { createResource, createEffect } from 'solid-js';
import { useMachine } from '@xstate/solid';

const Component = () => {
  const [result, { mutate, refetch }] = createResource(() =>
    fetch('/api/user').then((r) => r.json())
  );
  const [state, send] = useMachine(machine);

  createEffect(() => {
    send({
      type: 'DATA_CHANGED',
      data: result(),
      error: result.error
    });
  });

  return null;
};
```

This will send a `DATA_CHANGED` event whenever the result from `createResource` changes, allowing you to react to it just like any other event. You could, for instance:

- Move into an `errored` state when the data returns an error
- Save the data to context
