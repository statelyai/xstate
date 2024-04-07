# @xstate/store

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
