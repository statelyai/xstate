# @xstate/inspect

## 0.4.1

### Patch Changes

- [`d9282107`](https://github.com/davidkpiano/xstate/commit/d9282107b931b867d9cd297ede71b55fe11eb74d) [#1800](https://github.com/davidkpiano/xstate/pull/1800) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fixed a bug where services were not being registered by the inspect client, affecting the ability to send events to inspected services.

## 0.4.0

### Minor Changes

- [`63ba888e`](https://github.com/davidkpiano/xstate/commit/63ba888e19bd2b72f9aad2c9cd36cde297e0ffe5) [#1770](https://github.com/davidkpiano/xstate/pull/1770) Thanks [@davidkpiano](https://github.com/davidkpiano)! - It is now easier for developers to create their own XState inspectors, and even inspect services offline.

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

  windowReceiver.subscribe(event => {
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

## 0.3.0

### Minor Changes

- [`a473205d`](https://github.com/davidkpiano/xstate/commit/a473205d214563033cd250094d2344113755bd8b) [#1699](https://github.com/davidkpiano/xstate/pull/1699) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `@xstate/inspect` tool now uses [`fast-safe-stringify`](https://www.npmjs.com/package/fast-safe-stringify) for internal JSON stringification of machines, states, and events when regular `JSON.stringify()` fails (e.g., due to circular structures).

## 0.2.0

### Minor Changes

- [`1725333a`](https://github.com/davidkpiano/xstate/commit/1725333a6edcc5c1e178228aa869c907d3907be5) [#1599](https://github.com/davidkpiano/xstate/pull/1599) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `@xstate/inspect` package is now built with Rollup which has fixed an issue with TypeScript compiler inserting references to `this` in the top-level scope of the output modules and thus making it harder for some tools (like Rollup) to re-bundle dist files as `this` in modules (as they are always in strict mode) is `undefined`.
