---
'xstate': patch
---

Fixed `reenter: true` incorrectly re-entering sibling parallel regions when a transition targets a child state within the same region.

Previously, when a compound state (e.g. `region1`) defined `reenter: true` on a transition targeting one of its own children (e.g. `.a`), the transition domain was incorrectly computed as the parallel root rather than `region1` itself. This caused all sibling parallel regions to exit and re-enter their entry actions, even though only `region1` was involved in the transition.

```ts
const machine = createMachine({
  type: 'parallel',
  states: {
    region1: {
      initial: 'a',
      states: { a: {}, b: {} },
      on: {
        REENTER: { target: '.a', reenter: true }
      }
    },
    region2: {
      // entry actions no longer fire incorrectly on REENTER
      entry: () => console.log('region2 entered'),
      initial: 'c',
      states: { c: {}, d: {} }
    }
  }
});
```

Fixes #5162
