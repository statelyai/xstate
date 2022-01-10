# @xstate/solid

This package contains utilities for using [XState](https://github.com/statelyai/xstate) with [SolidJS](https://github.com/solidjs/solid).

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-solid/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Quick Start

1. Install `xstate` and `@xstate/solid`:

```bash
npm i xstate @xstate/solid
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/solid/dist/xstate-solid.umd.min.js"></script>
```

By using the global variable `XStateSolid`

or

```html
<script src="https://unpkg.com/@xstate/solid/dist/xstate-solid-fsm.umd.min.js"></script>
```

By using the global variable `XStateSolidFSM`

2. Import the `useMachine` hook:

```js
import { useMachine } from '@xstate/solid';
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
    <button onclick={() => send('TOGGLE')}>
      {state.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'}
    </button>
  );
};
```
