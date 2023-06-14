---
'xstate': major
---

Guard objects can now reference other guard objects:

```ts
const machine = createMachine(
  {
    initial: 'home',
    states: {
      home: {
        on: {
          NEXT: {
            target: 'success',
            guard: 'hasSelection'
          }
        }
      },
      success: {}
    }
  },
  {
    guards: {
      // `hasSelection` is a guard object that references the `stateIn` guard
      hasSelection: stateIn('selected')
    }
  }
);
```
