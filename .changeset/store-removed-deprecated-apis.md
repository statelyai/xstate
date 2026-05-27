---
'@xstate/store': major
---

Remove deprecated Store APIs.

The deprecated config-wrapping form of `undoRedo(...)` was removed. Use the extension form instead:

```ts
const store = createStore({
  context: { count: 0 },
  on: {
    inc: (context) => ({ count: context.count + 1 })
  }
}).with(undoRedo());
```

Computed atoms now receive only the previous value. Read other atoms directly with `.get()`:

```diff
-const doubled = createAtom((read) => read(countAtom) * 2);
+const doubled = createAtom(() => countAtom.get() * 2);
-const accumulated = createAtom((read, prev) => read(countAtom) + (prev ?? 0));
+const accumulated = createAtom((prev) => countAtom.get() + (prev ?? 0));
```
