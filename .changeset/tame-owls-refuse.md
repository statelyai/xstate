---
'@xstate/inspect': minor
---

It is now easier for developers to create their own XState inspectors, and even inspect services offline.

A **receiver** is an actor that receives inspector events from a source, such as `"service.register"`, `"service.state"`, `"service.event"`, etc. This update includes two receivers:

- `createWindowReceiver` - listens to inspector events from a parent window (for both popup and iframe scenarios)
- 🚧 `createWebSocketReceiver` (experimental) - listens to inspector events from a WebSocket server

Here's how it works:

**Application (browser) code**

```js
import { inspect } from '@xstate/inspect';

inspect(/* options */);

// ...

interpret(someMachine, { devTools: true }).start();
```

**Inspector code**

```js
import { createWindowReceiver } from '@xstate/inspect';

const windowReceiver = createWindowReceiver(/* options? */);

windowReceiver.subscribe((event) => {
  // here, you will receive events like:
  // { type: "service.register", machine: ..., state: ..., sessionId: ... }
  console.log(event);
});
```

The events you will receive are `ParsedReceiverEvent` types:

```ts
export type ParsedReceiverEvent =
  | {
      type: 'service.register';
      machine: StateMachine<any, any, any>;
      state: State<any, any>;
      id: string;
      sessionId: string;
      parent?: string;
      source?: string;
    }
  | { type: 'service.stop'; sessionId: string }
  | {
      type: 'service.state';
      state: State<any, any>;
      sessionId: string;
    }
  | { type: 'service.event'; event: SCXML.Event<any>; sessionId: string };
```

Given these events, you can visualize the service machines and their states and events however you'd like.
