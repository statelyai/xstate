# @xstate/rxjs

This package contains utilities for using [XState](https://github.com/statelyai/xstate) with [RxJS](https://github.com/ReactiveX/rxjs).

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-rxjs/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Quick start

1. Install `xstate` and `@xstate/rxjs`:

```bash
npm i xstate @xstate/rxjs
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/rxjs/dist/xstate-rxjs.umd.min.js"></script>
```

By using the global variable `XStateRxJS`

or

```html
<script src="https://unpkg.com/@xstate/rxjs/dist/xstate-rxjs-fsm.umd.min.js"></script>
```

By using the global variable `XStateRxJSFSM`

1. Import the `fromMachine` hook:

```js
import { fromMachine } from '@xstate/rxjs';
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

const { state$, send } = fromMachine(toggleMachine);

const subscription = state$.subscribe((state) => {
  console.log(state.value);
});

// 1. state.value === 'inactive'
send('TOGGLE');
// 2. state.value === 'active'

subscription.unsubscribe();
```
