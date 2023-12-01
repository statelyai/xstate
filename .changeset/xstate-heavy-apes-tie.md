---
'xstate': major
---

Target resolution improvements: targeting sibling nodes from the root is no longer valid, since the root node has no siblings:

```diff
createMachine({
  id: 'direction',
  initial: 'left',
  states: {
    left: {},
    right: {}
  },
  on: {
-   LEFT_CLICK: 'left',
+   LEFT_CLICK: '.left'
  }
});
```
