# Usage with React

The most straightforward way of using XState with React is through local component state. The machine used should always be decoupled from implementation details; e.g., it should never know that it is in React (or Vue, or Angular, etc.):

```js
import { Machine } from 'xstate';

// This machine is completely decoupled from React
export const toggleMachine = Machine({
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
```

## Hooks

Using [React hooks](https://reactjs.org/hooks) makes it easier to use state machines with function components. You can either use the official [`@xstate/react`](https://github.com/davidkpiano/xstate/tree/master/packages/xstate-react) package, a community solution like [`use-machine` by Carlos Galarza](https://github.com/carloslfu/use-machine/), or implement your own hook to interpret and use XState machines:

```js
// import { useMachine } from '../path/to/useMachine';
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

## Class components

- The `machine` is [interpreted](../guides/interpretation.md) and its `service` instance is placed on the component instance.
- For local state, `this.state.current` will hold the current machine state. You can use a property name other than `.current`.
- When the component is mounted, the `service` is started via `this.service.start()`.
- When the component will unmount, the `service` is stopped via `this.service.stop()`.
- Events are sent to the `service` via `this.service.send(event)`.

```jsx
import React from 'react';
import { Machine, interpret } from 'xstate';
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
