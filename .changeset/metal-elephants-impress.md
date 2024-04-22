---
'xstate': minor
---

Meta objects for state nodes and transitions can now be specified in `setup({ types: … })`:

```ts
const machine = setup({
  types: {
    meta: {} as {
      layout: string;
    }
  }
}).createMachine({
  initial: 'home',
  states: {
    home: {
      meta: {
        layout: 'full'
      }
    }
  }
});

const actor = createActor(machine).start();

actor.getSnapshot().getMeta().home;
// => { layout: 'full' }
// if in "home" state
```
