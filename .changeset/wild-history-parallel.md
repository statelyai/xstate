---
'xstate': patch
---

Fixed a bug where targeting a history state that is a direct child of a `parallel` state would silently do nothing when that parallel state had not been visited yet and the history state had no default target. The machine now enters the parallel state's initial configuration, matching the behavior of history states inside compound states.

```ts
const machine = createMachine({
  initial: 'off',
  states: {
    off: { on: { GO: 'on.hist' } },
    on: {
      type: 'parallel',
      states: {
        regA: { initial: 'a1', states: { a1: {}, a2: {} } },
        regB: { initial: 'b1', states: { b1: {}, b2: {} } },
        hist: { type: 'history', history: 'deep' }
      }
    }
  }
});

const actor = createActor(machine).start();
actor.send({ type: 'GO' });
actor.getSnapshot().value; // { on: { regA: 'a1', regB: 'b1' } }
```
