---
'xstate': major
---

Parameterized actions now require a `params` property:

```diff
// ...
entry: [
  {
    type: 'greet',
-   message: 'Hello'
+   params: { message: 'Hello' }
  }
]
// ...
```
