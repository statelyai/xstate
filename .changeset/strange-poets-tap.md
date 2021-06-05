---
'xstate': patch
---

The `state.meta` value is now calculated directly from `state.configuration`. This is most useful when starting a service from a persisted state:

```ts
  const machine = createMachine({
    id: 'test',
    initial: 'first',
    states: {
      first: {
        meta: {
          name: 'first state'
        }
      },
      second: {
        meta: {
          name: 'second state'
        }
      }
    }
  });

  const service = interpret(machine);

  service.start('second'); // `meta` will be computed

  // the state will have
  // meta: {
  //   'test.second': {
  //     name: 'second state'
  //   }
  // }
});
```
