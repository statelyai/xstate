# @xstate/store

## 0.0.4

### Patch Changes

- [#4890](https://github.com/statelyai/xstate/pull/4890) [`6d92b7770`](https://github.com/statelyai/xstate/commit/6d92b77704750498f669487da185eb005a080034) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `context` type for `createStoreWithProducer(producer, context, transitions)` will now be properly inferred.

  ```ts
  const store = createStoreWithProducer(
    produce,
    {
      count: 0
    },
    {
      // ...
    }
  );

  store.getSnapshot().context;
  // BEFORE: StoreContext
  // NOW: { count: number }
  ```

## 0.0.3

### Patch Changes

- [#4842](https://github.com/statelyai/xstate/pull/4842) [`3a57f4c69`](https://github.com/statelyai/xstate/commit/3a57f4c69b746546dd104989dcf8664c9fbe2f80) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update README.md

- [#4839](https://github.com/statelyai/xstate/pull/4839) [`4a22edb90`](https://github.com/statelyai/xstate/commit/4a22edb904c1f2517db41e09030d0e9993891796) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update JS docs

## 0.0.2

### Patch Changes

- [#4752](https://github.com/statelyai/xstate/pull/4752) [`8a32374e7`](https://github.com/statelyai/xstate/commit/8a32374e79b191dd3bfbab41a15d1b1b4adfd131) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Initial release of `@xstate/store`

  ```ts
  import { createStore } from '@xstate/store';

  const store = createStore(
    // initial context
    { count: 0, greeting: 'hello' },
    // transitions
    {
      inc: {
        count: (context) => context.count + 1
      },
      updateBoth: {
        count: () => 42,
        greeting: 'hi'
      }
    }
  );

  store.send({
    type: 'inc'
  });

  console.log(store.getSnapshot());
  // Logs:
  // {
  //   status: 'active',
  //   context: {
  //     count: 1,
  //     greeting: 'hello'
  //   }
  // }
  ```
