---
'xstate': minor
---

New property introduced for eventless (transient) transitions: **`always`**, which indicates a transition that is always taken when in that state. Empty string transition configs for [transient transitions](https://xstate.js.org/docs/guides/transitions.html#transient-transitions) are deprecated in favor of `always`:

```diff
// ...
states: {
  playing: {
+   always: [
+     { target: 'win', cond: 'didPlayerWin' },
+     { target: 'lose', cond: 'didPlayerLose' },
+   ],
    on: {
      // ⚠️ Deprecation warning
-     '': [
-       { target: 'win', cond: 'didPlayerWin' },
-       { target: 'lose', cond: 'didPlayerLose' },
-     ]
    }
  }
}
// ...
```

The old empty string syntax (`'': ...`) will continue to work until V5.
