---
'xstate': minor
---

You can now inspect microsteps (`@xstate.microstep`) and actions (`@xstate.action`):

```ts
const machine = createMachine({
  initial: 'a',
  states: {
    a: {
      on: {
        event: 'b'
      }
    },
    b: {
      entry: 'someAction',
      always: 'c'
    },
    c: {}
  }
});

const actor = createActor(machine, {
  inspect: (inspEvent) => {
    if (inspEvent.type === '@xstate.microstep') {
      console.log(inspEvent.snapshot);
      // logs:
      // { value: 'a', … }
      // { value: 'b', … }
      // { value: 'c', … }

      console.log(inspEvent.event);
      // logs:
      // { type: 'event', … }
    } else if (inspEvent.type === '@xstate.action') {
      console.log(inspEvent.action);
      // logs:
      // { type: 'someAction', … }
    }
  }
});

actor.start();

actor.send({ type: 'event' });
```
