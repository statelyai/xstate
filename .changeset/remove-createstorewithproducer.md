---
'@xstate/store': major
---

Remove `createStoreWithProducer`. Use `(ctx, ev) => produce(ctx, draft => …)` in `createStore` event handlers instead.
