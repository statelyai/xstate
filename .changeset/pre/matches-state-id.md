---
'xstate': minor
---

`snapshot.matches('#id')` is true while the state node with that `id` is active. This replaces the removed `checkStateIn(snapshot, '#id')`.

```ts
const machine = createMachine({
  initial: 'editing',
  states: {
    editing: {
      initial: 'draft',
      states: { draft: { id: 'draft' }, review: {} }
    },
    done: {}
  }
});

const snapshot = createActor(machine).start().getSnapshot();
snapshot.matches('#draft'); // true
snapshot.matches('#nope'); // type error: not a state id of this machine
```

When the machine's state ids are statically known, only those ids are accepted. Unlike state-value checks, an `#id` check does not narrow `context`. The `@xstate.stateIn` JSON guard uses the same check.
