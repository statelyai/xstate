---
'@xstate/store': minor
---

The store now extends EventTarget, allowing for native DOM event handling capabilities while maintaining the existing `.on()` API. This change:

- Adds support for standard `.addEventListener(…)` and `.removeEventListener(…)` methods
- Simplifies internal event handling by leveraging native `EventTarget` functionality
- Maintains full backwards compatibility with existing `.on(…)` method

```ts
// ...
store.addEventListener('incremented', (event) => {
  console.log(event.detail);
});
```
