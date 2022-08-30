---
'xstate': minor
---

An action can now be defined as an "action group", which is an array of action `type` strings pointing to other actions that will be executed when the group is executed. This allows you to define named groups of actions that are executed together.

```js
const machine = createMachine(
  {
    on: {
      event: { actions: 'group' }
    }
  },
  {
    actions: {
      group: ['action1', 'action2'],
      action1: () => console.log('action 1'),
      action2: () => console.log('action 2')
    }
  }
);

const service = interpret(machine).start();

service.send(service, 'event'); // "action 1", "action 2"
```
