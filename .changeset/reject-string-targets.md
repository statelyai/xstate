---
'xstate': major
---

Bare string transition values throw when the machine is created, in every build. This matches the types and `machineFromJSON`, which already rejected them. It covers `on`, `after`, `always`, `onDone`, `onError`, `onTimeout`, and invoke `onDone`/`onError`/`onSnapshot`/`onTimeout`. `initial` stays a string key, and `xstate/fsm` still accepts string targets.

```ts
// Throws: Transition for "GO" in state "idle" is the string "next". Use { target: 'next' }.
on: { GO: 'next' }

// Use
on: { GO: { target: 'next' } }
```

`xstate-codemod migrate` (the `string-targets` transform) rewrites these.
