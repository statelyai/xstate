---
'xstate': patch
---

Ensure that "stop" transitions are called in machines:

```ts
const machine = createMachine({
  on: {
    'xstate.stop': {
      actions: () => {
        // do cleanup, etc...
        console.log('Machine actor was just stopped');
      }
    }
  }
});

const actor = createActor(machine).start();

actor.stop();
// Logs "Machine actor was just stopped"
```
