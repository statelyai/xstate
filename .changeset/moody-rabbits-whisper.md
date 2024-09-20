---
'@xstate/store': minor
---

The `createStoreWithProducer(…)` function now uses the new configuration API:

```ts
import { createStoreWithProducer } from '@xstate/store';
// DEPRECATED API
// const store = createStoreWithProducer(
//   producer,
//   {
//     count: 0
//   },
//   {
//     inc: (context, event) => {
//       context.count++;
//     }
//   }
// );

const store = createStoreWithProducer(producer, {
  context: {
    count: 0
  },
  on: {
    inc: (context, event) => {
      context.count++;
    }
  }
});
```
