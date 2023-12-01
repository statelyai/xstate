---
'xstate': major
---

Removed the ability to pass a string value directly to `invoke`. To migrate you should use the object version of `invoke`:

```diff
-invoke: 'myActor'
+invoke: { src: 'myActor' }
```
