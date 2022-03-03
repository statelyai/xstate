# @xstate/inspect

## 0.6.3

### Patch Changes

- [#3089](https://github.com/statelyai/xstate/pull/3089) [`862697e29`](https://github.com/statelyai/xstate/commit/862697e2990934d46050580d7e09c749d09d8426) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility with Skypack by exporting some shared utilities from root entry of XState and consuming them directly in other packages (this avoids accessing those things using deep imports and thus it avoids creating those compatibility problems).

## 0.6.2

### Patch Changes

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 0.6.1

### Patch Changes

- [#2907](https://github.com/statelyai/xstate/pull/2907) [`3a8eb6574`](https://github.com/statelyai/xstate/commit/3a8eb6574db51c3d02c900561be87a48fd9a973c) Thanks [@rossng](https://github.com/rossng)! - Fix crash when sending circular state objects (#2373).

## 0.6.0

### Minor Changes

- [#2640](https://github.com/statelyai/xstate/pull/2640) [`c73dfd655`](https://github.com/statelyai/xstate/commit/c73dfd655525546e59f00d0be88b80ab71239427) Thanks [@davidkpiano](https://github.com/statelyai)! - A serializer can now be specified as an option for `inspect(...)` in the `.serialize` property. It should be a [replacer function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#the_replacer_parameter):

  ```js
  // ...

  inspect({
    // ...
    serialize: (key, value) => {
      if (value instanceof Map) {
        return 'map';
      }

      return value;
    }
  });

  // ...

  // Will be inspected as:
  // {
  //   type: 'EVENT_WITH_MAP',
  //   map: 'map'
  // }
  someService.send({
    type: 'EVENT_WITH_MAP',
    map: new Map()
  });
  ```

* [#2894](https://github.com/statelyai/xstate/pull/2894) [`8435c5b84`](https://github.com/statelyai/xstate/commit/8435c5b841e318c5d35dfea65242246dfb4b34f8) Thanks [@Andarist](https://github.com/Andarist)! - The package has been upgraded to be compatible with `ws@8.x`. The WS server created server-side has to be of a compatible version now.

## 0.5.2

### Patch Changes

- [#2827](https://github.com/statelyai/xstate/pull/2827) [`49de77085`](https://github.com/statelyai/xstate/commit/49de770856965b0acec846c1ff5c29463335aab0) Thanks [@erlendfh](https://github.com/erlendfh)! - Fixed a bug in `createWebsocketReceiver` so that it works as expected with a WebSocket connection.

## 0.5.1

### Patch Changes

- [#2728](https://github.com/statelyai/xstate/pull/2728) [`8171b3e12`](https://github.com/statelyai/xstate/commit/8171b3e127a289199bbcedb5cec839e9da0a1bb2) Thanks [@jacksteamdev](https://github.com/jacksteamdev)! - Fix server inspector to handle WebSocket messages as Buffer

## 0.5.0

### Minor Changes

- [`4f006ffc`](https://github.com/statelyai/xstate/commit/4f006ffc0d39854c77caf3c583bb0c9e058259af) [#2504](https://github.com/statelyai/xstate/pull/2504) Thanks [@Andarist](https://github.com/Andarist)! - `Inspector`'s `subscribe` callback will now get immediately called with the current state at the subscription time.

### Patch Changes

- [`e90b764e`](https://github.com/statelyai/xstate/commit/e90b764e4ead8bf11d273ee385a8c2db392251a4) [#2492](https://github.com/statelyai/xstate/pull/2492) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a minor issue with sometimes sending `undefined` state to the inspector which resulted in an error being thrown in it when resolving the received state. The problem was very minor as no functionality was broken because of it.

## 0.4.1

### Patch Changes

- [`d9282107`](https://github.com/statelyai/xstate/commit/d9282107b931b867d9cd297ede71b55fe11eb74d) [#1800](https://github.com/statelyai/xstate/pull/1800) Thanks [@davidkpiano](https://github.com/statelyai)! - Fixed a bug where services were not being registered by the inspect client, affecting the ability to send events to inspected services.

## 0.4.0

### Minor Changes

- [`63ba888e`](https://github.com/statelyai/xstate/commit/63ba888e19bd2b72f9aad2c9cd36cde297e0ffe5) [#1770](https://github.com/statelyai/xstate/pull/1770) Thanks [@davidkpiano](https://github.com/statelyai)! - It is now easier for developers to create their own XState inspectors, and even inspect services offline.

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

- [`a473205d`](https://github.com/statelyai/xstate/commit/a473205d214563033cd250094d2344113755bd8b) [#1699](https://github.com/statelyai/xstate/pull/1699) Thanks [@davidkpiano](https://github.com/statelyai)! - The `@xstate/inspect` tool now uses [`fast-safe-stringify`](https://www.npmjs.com/package/fast-safe-stringify) for internal JSON stringification of machines, states, and events when regular `JSON.stringify()` fails (e.g., due to circular structures).

## 0.2.0

### Minor Changes

- [`1725333a`](https://github.com/statelyai/xstate/commit/1725333a6edcc5c1e178228aa869c907d3907be5) [#1599](https://github.com/statelyai/xstate/pull/1599) Thanks [@davidkpiano](https://github.com/statelyai)! - The `@xstate/inspect` package is now built with Rollup which has fixed an issue with TypeScript compiler inserting references to `this` in the top-level scope of the output modules and thus making it harder for some tools (like Rollup) to re-bundle dist files as `this` in modules (as they are always in strict mode) is `undefined`.
