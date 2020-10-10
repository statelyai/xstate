# `@xstate/inspect`

Inspection tools for XState.

- [XState (Vanilla)](https://codesandbox.io/s/xstate-ts-viz-template-qzdvv)
- [XState + TypeScript](https://codesandbox.io/s/xstate-ts-viz-template-qzdvv)
- [XState + Vue](https://codesandbox.io/s/xstate-vue-viz-template-r5wd7)
- [XState + React](https://codesandbox.io/s/xstate-react-viz-template-5wq3q)

![Inspector running from CodeSandbox](https://buttondown.s3.us-west-2.amazonaws.com/images/4c8c0db4-b4d5-408f-8684-57e94ff46c86.png)

[See CodeSandbox example here](https://codesandbox.io/s/xstate-vue-minute-timer-viz-1txmk)

## Installation

1. Install with npm or yarn:

```bash
npm install @xstate/inspect
# or yarn add @xstate/inspect
```

2. Import it at the beginning of your project, before any other code is called:

```js
import { inspect } from '@xstate/inspect';

inspect({
  // options
  // url: 'https://statecharts.io/inspect', // (default)
  iframe: false // open in new window
});
```

3. Add `{ devTools: true }` to any interpreted machines you want to visualize:

```js
import { interpret } from 'xstate';
import { inspect } from '@xstate/inspect';
// ...

const service = interpret(someMachine, { devTools: true });
```

## Inspect Options

```js
// defaults
inspect({
  iframe: () => document.querySelector('iframe[data-xstate]'),
  url: 'https://statecharts.io/inspect'
});

// the above is the same as this:
inspect();
```

**Arguments:** the `options` object passed to `inspect(options)` with the following optional properties:

- `iframe` (function or iframe `Element` or `false`) - resolves to the `iframe` element to display the inspector in. If this is set to `iframe: false`, then a popup window will be used instead.

  ⚠️ Note: you might need to allow popups to display the inspector in a popup window, as they might be blocked by the browser by default.

  By default, the inspector will look for an `<iframe data-xstate>` element anywhere in the document. If you want to target a custom iframe, specify it eagerly or lazily:

  ```js
  // eager
  inspect({
    iframe: document.querySelector('iframe.some-xstate-iframe')
  });
  ```

  ```js
  // lazy
  inspect({
    iframe: () => document.querySelector('iframe.some-xstate-iframe')
  });
  ```

- `url` (string) - the URL of the inspector to connect to. By default, the inspector is running on `http://statecharts.io/inspect`.

**Returns:** an inspector object with the following properties:

- `disconnect` (function) - a function that disconnects the inspector and cleans up any listeners.
