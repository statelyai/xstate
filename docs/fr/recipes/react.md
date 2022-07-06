# Usage with React

XState can be used with React to:

- Coordinate local state
- Manage global state performantly
- Consume data from other hooks

At [Stately](https://stately.ai), we love this combo. It's our go-to stack for creating internal applications.

To ask for help, check out the [`#react-help` channel in our Discord community](https://discord.gg/vedXj62MfQ).

## Local state

Using [React hooks](https://reactjs.org/hooks) are the easiest way to use state machines in your components. You can use the official [`@xstate/react`](https://github.com/statelyai/xstate/tree/main/packages/xstate-react) to give you useful hooks out of the box, such as `useMachine`.

```js
import { useMachine } from '@xstate/react';
import { toggleMachine } from '../path/to/toggleMachine';

function Toggle() {
  const [current, send] = useMachine(toggleMachine);

  return (
    <button onClick={() => send('TOGGLE')}>
      {current.matches('inactive') ? 'Off' : 'On'}
    </button>
  );
}
```

## Global State/React Context

Our recommended approach for managing global state with XState and React is to use [React Context](https://reactjs.org/docs/context.html).

> There are two versions of 'context': XState's [context](../guides/context.md) and React's context. It's a little confusing!

### Context Provider

React context can be a tricky tool to work with - if you pass in values which change too often, it can result in re-renders all the way down the tree. That means we need to pass in values which change as little as possible.

Luckily, XState gives us a first-class way to do that: `useInterpret`.

```js
import React, { createContext } from 'react';
import { useInterpret } from '@xstate/react';
import { authMachine } from './authMachine';

export const GlobalStateContext = createContext({});

export const GlobalStateProvider = (props) => {
  const authService = useInterpret(authMachine);

  return (
    <GlobalStateContext.Provider value={{ authService }}>
      {props.children}
    </GlobalStateContext.Provider>
  );
};
```

Using `useInterpret` returns a service, which is a static reference to the running machine which can be subscribed to. This value never changes, so we don't need to worry about wasted re-renders.

> For Typescript, you can create the context as `createContext({ authService: {} as InterpreterFrom<typeof authMachine> });` to ensure strong typings.

### Utilizing context

Further down the tree, you can subscribe to the service like this:

```js
import React, { useContext } from 'react';
import { GlobalStateContext } from './globalState';
import { useActor } from '@xstate/react';

export const SomeComponent = (props) => {
  const globalServices = useContext(GlobalStateContext);
  const [state] = useActor(globalServices.authService);

  return state.matches('loggedIn') ? 'Logged In' : 'Logged Out';
};
```

The `useActor` hook listens for whenever the service changes, and updates the state value.

### Improving Performance

There's an issue with the implementation above - this will update the component for any change to the service. Tools like [Redux](https://redux.js.org) use [`selectors`](https://redux.js.org/usage/deriving-data-selectors) for deriving state. Selectors are functions which restrict which parts of the state can result in components re-rendering.

Fortunately, XState exposes the `useSelector` hook.

```js
import React, { useContext } from 'react';
import { GlobalStateContext } from './globalState';
import { useSelector } from '@xstate/react';

const loggedInSelector = (state) => {
  return state.matches('loggedIn');
};

export const SomeComponent = (props) => {
  const globalServices = useContext(GlobalStateContext);
  const isLoggedIn = useSelector(globalServices.authService, loggedInSelector);

  return isLoggedIn ? 'Logged In' : 'Logged Out';
};
```

If you need to send an event in the component that consumes a service, you can use the `service.send(...)` method directly:

```js
import React, { useContext } from 'react';
import { GlobalStateContext } from './globalState';
import { useSelector } from '@xstate/react';

const loggedInSelector = (state) => {
  return state.matches('loggedIn');
};

export const SomeComponent = (props) => {
  const globalServices = useContext(GlobalStateContext);
  const isLoggedIn = useSelector(globalServices.authService, loggedInSelector);
  // Get `send()` method from a service
  const { send } = globalServices.authService;

  return (
    <>
      {isLoggedIn && (
        <button type="button" onClick={() => send('LOG_OUT')}>
          Logout
        </button>
      )}
    </>
  );
};
```

This component will only re-render when `state.matches('loggedIn')` returns a different value. This is our recommended approach over `useActor` for when you want to optimise performance.

### Dispatching events

For dispatching events to the global store, you can call a service's `send` function directly.

```js
import React, { useContext } from 'react';
import { GlobalStateContext } from './globalState';

export const SomeComponent = (props) => {
  const globalServices = useContext(GlobalStateContext);

  return (
    <button onClick={() => globalServices.authService.send('LOG_OUT')}>
      Log Out
    </button>
  );
};
```

Note that you don't need to call `useActor` for this, it's available right on the context.

## Other hooks

XState's `useMachine` and `useInterpret` hooks can be used alongside others. Two patterns are most common:

### Named actions/services/guards

Let's imagine that when you navigate to a certain state, you want to leave the page and go somewhere else, via `react-router` or `next`. For now, we'll declare that action as a 'named' action - where we name it now and declare it later.

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

Inside your component, you can now _implement_ the named action. I've added `useHistory` from `react-router` as an example, but you can imagine this working with any hook or prop-based router.

```js
import { machine } from './machine';
import { useMachine } from '@xstate/react';
import { useHistory } from 'react-router';

const Component = () => {
  const history = useHistory();

  const [state, send] = useMachine(machine, {
    actions: {
      goToOtherPage: () => {
        history.push('/other-page');
      }
    }
  });

  return null;
};
```

This also works for services, guards, and delays.

> If you use this technique, any references you use inside `goToOtherPage` will be kept up to date each render. That means you don't need to worry about stale references.

### Syncing data with useEffect

Sometimes, you want to outsource some functionality to another hook. This is especially common with data fetching hooks such as [`react-query`](https://react-query.tanstack.com/) and [`swr`](https://swr.vercel.app/). You don't want to have to re-build all your data fetching functionality in XState.

The best way to manage this is via `useEffect`.

```js
const Component = () => {
  const { data, error } = useSWR('/api/user', fetcher);

  const [state, send] = useMachine(machine);

  useEffect(() => {
    send({
      type: 'DATA_CHANGED',
      data,
      error
    });
  }, [data, error, send]);
};
```

This will send a `DATA_CHANGED` event whenever the result from `useSWR` changes, allowing you to react to it just like any other event. You could, for instance:

- Move into an `errored` state when the data returns an error
- Save the data to context

## Class components

If you're using class components, here's an example implementation that doesn't rely on hooks.

- The `machine` is [interpreted](../guides/interpretation.md) and its `service` instance is placed on the component instance.
- For local state, `this.state.current` will hold the current machine state. You can use a property name other than `.current`.
- When the component is mounted, the `service` is started via `this.service.start()`.
- When the component will unmount, the `service` is stopped via `this.service.stop()`.
- Events are sent to the `service` via `this.service.send(event)`.

```jsx
import React from 'react';
import { interpret } from 'xstate';
import { toggleMachine } from '../path/to/toggleMachine';

class Toggle extends React.Component {
  state = {
    current: toggleMachine.initialState
  };

  service = interpret(toggleMachine).onTransition((current) =>
    this.setState({ current })
  );

  componentDidMount() {
    this.service.start();
  }

  componentWillUnmount() {
    this.service.stop();
  }

  render() {
    const { current } = this.state;
    const { send } = this.service;

    return (
      <button onClick={() => send('TOGGLE')}>
        {current.matches('inactive') ? 'Off' : 'On'}
      </button>
    );
  }
}
```
