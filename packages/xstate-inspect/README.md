# @xstate/inspect

This package contains inspection tools for XState.

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-inspect/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Templates

- [XState (Vanilla)](https://codesandbox.io/s/xstate-ts-viz-template-qzdvv)
- [XState + TypeScript](https://codesandbox.io/s/xstate-ts-viz-template-qzdvv)
- [XState + Vue](https://codesandbox.io/s/xstate-vue-viz-template-r5wd7)
- [XState + React](https://codesandbox.io/s/xstate-react-viz-template-5wq3q)

![Inspector running from CodeSandbox](/assets/inspector.png)

[Check out the XState + Vue Minute Timer + Viz example on CodeSandbox](https://codesandbox.io/s/xstate-vue-minute-timer-viz-1txmk)

## Installation

1. Install with npm or yarn:

```bash
npm install @xstate/inspect
# or yarn add @xstate/inspect
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/inspect/dist/xstate-inspect.umd.min.js"></script>
```

By using the global variable `XStateInspect`

2. Import it at the beginning of your project, before any other code is called:

```js
import { inspect } from '@xstate/inspect';

inspect({
  // options
  // url: 'https://stately.ai/viz?inspect', // (default)
  iframe: false // open in new window
});
```

3. Add `{ devTools: true }` to any interpreted machines you want to visualize:

```js
import { interpret } from 'xstate';
import { inspect } from '@xstate/inspect';
// ...

const service = interpret(someMachine, { devTools: true });
service.start();
```
