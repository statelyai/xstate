---
'xstate': patch
---

The "Attempted to spawn an Actor [...] outside of a service. This will have no effect." warnings are now silenced for "lazily spawned" actors, which are actors that aren't immediately active until the function that creates them are called:

```js
// ⚠️ "active" actor - will warn
spawn(somePromise);

// 🕐 "lazy" actor - won't warn
spawn(() => somePromise);

// 🕐 machines are also "lazy" - won't warn
spawn(someMachine);
```

It is recommended that all `spawn(...)`-ed actors are lazy, to avoid accidentally initializing them e.g., when reading `machine.initialState` or calculating otherwise pure transitions. In V5, this will be enforced.
