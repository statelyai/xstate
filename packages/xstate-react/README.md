# @xstate/react

This package contains utilities for using [XState](https://github.com/statelyai/xstate) with [React](https://github.com/facebook/react/).

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-react/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Quick start

1. Install `xstate` and `@xstate/react`:

```bash
npm i xstate @xstate/react
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/react/dist/xstate-react.umd.min.js"></script>
```

By using the global variable `XStateReact`

or

```html
<script src="https://unpkg.com/@xstate/react/dist/xstate-react-fsm.umd.min.js"></script>
```

By using the global variable `XStateReactFSM`

2. Import the `useMachine` hook:

```js
import { useMachine } from '@xstate/react';
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

export const Toggler = () => {
  const [state, send] = useMachine(toggleMachine);

  return (
    <button onClick={() => send('TOGGLE')}>
      {state.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'}
    </button>
  );
};
```
