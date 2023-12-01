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

## Configuration

- `url` _(optional)_ - The endpoint that the Inspector sends events to. Default: https://stately.ai/viz?inspect
- `iframe` _(optional)_ - The iframe that loads the provided URL. If iframe is set to `false`, then a new tab is opened instead.
- `devTools` _(optional)_ - Allows custom implementation for lifecycle hooks.
- `serialize` _(optional)_ - A custom serializer for messages sent to the URL endpoint. Useful for sanitizing sensitive information, such as credentials, from leaving your application.
- `targetWindow` _(optional)_ - Provide a pre-existing window location that will be used instead of opening a new window etc. When using this option, you must still provide the `url` value due to security checks in browser APIs, and the `iframe` option is ignored in such a case.

### Examples

### Add a custom serializer to @xstate/inspector events and transitions messages

When is this useful?

- Remove sensitive items, such as `credentials`
- Add additional custom handling

```typescript
// Remove credentials from being forwarded
inspect({
  serialize: (key: string, value: any) => {
    return key === 'credentials' && typeof value === 'object' ? {} : value;
  }
});

// Add a custom local log
inspect({
  serialize: (key: string, value: any) => {
    if (key === 'ready') {
      console.log('Detected ready key');
    }
    return value;
  }
});
```

### Easily log all machine events and transitions

When is this useful?

- Allows you to quickly see all events and transitions for your machines
- No need to add manual `console.log` statements to your machine definitions

```typescript
// The URL and port of your local project (ex. Vite, Webpack, etc).
const url = 'http://127.0.0.1:5174/';

const inspector = inspect({
  url,
  iframe: undefined,
  targetWindow: window
});

// In the same window, subscribe to messages from @xstate/inspector
createWindowReceiver({}).subscribe(console.log);

// Start your machine, and all events generated are logged to the console
interpret(machine, { devTools: true }).start({});
```

### Send events to a separate, locally hosted tool

When is this useful?

- Forward messages to a custom endpoint, that you can then listen to and add custom handling for messages

```typescript
// In your client application
const url = 'http://127.0.0.1:8443/';
const targetWindow = window.open(url);

const inspector = inspect({
  // The URL must still be provided. This is used by postMessage, as it's
  // not possible to do targetWindow.location for security reasons
  url,
  targetWindow
});

// In the second, hosted application
createWindowReceiver({}).subscribe((event) => {
  if (event.type === 'service.register') {
    // Do something when a new machine is started
  } else if (event.type === 'service.stop') {
    // Do something when a machine enters a terminal state
  } else if (event.type === 'service.event') {
    // Do something when a machine receives an event
  } else if (event.type === 'service.state') {
    // Do something when a machine enters to a new state
    // Note: Does not handle transitional states.
  }
});
```
