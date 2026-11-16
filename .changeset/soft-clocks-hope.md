---
"xstate": patch
---

Preserve declared emitted-event names and payloads on machine callback `self` arguments, including context initialization and typed child input.

```ts
const machine = setup({
  schemas: {
    emitted: { progress: types<{ percent: number }>() }
  }
}).createMachine({
  entry: ({ self }) => {
    self.on('progress', (event) => {
      console.log(event.percent); // number
    });
    // @ts-expect-error Unknown emitted-event type.
    self.on('unknown', () => {});
  }
});
```
