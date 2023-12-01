---
'xstate': major
---

Custom action objects and guard objects are now expected to put extra parameters on the `params` property:

```diff
actions: {
  type: 'sendMessage',
- message: 'hello'
+ params: {
+   message: 'hello'
+ }
}
guard: {
  type: 'exists',
- prop: 'user'
+ params: {
+   prop: 'user'
+ }
}
```
