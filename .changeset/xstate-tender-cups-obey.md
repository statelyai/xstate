---
'xstate': patch
---

Removed the ability to configure transitions using arrays:

```ts
createMachine({
  on: [{ event: 'FOO', target: '#id' }]
  // ...
});
```

Only regular object-based configs will be supported from now on:

```ts
createMachine({
  on: {
    FOO: '#id'
  }
  // ...
});
```
