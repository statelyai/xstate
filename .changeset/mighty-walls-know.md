---
'@xstate/store': patch
---

Initial release of `@xstate/store`

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
