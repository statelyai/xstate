---
'xstate': minor
---

An action can now be defined as an "action group" which is an array of actions that will be executed when the group action is executed. This allows you to define named groups of actions that are executed together.

```js
const machine = createMachine(
  {
    context: { value: '' },
    on: {
      valueUpdated: { actions: 'updateValue' }
    }
  },
  {
    actions: {
      updateValue: [
        assign({
          value: (_context, event) => event.value
        }),
        'capitalizeValue',
        (context) => console.log(`Value: ${context.value}`)
      ],
      capitalizeValue: assign({
        value: (context) => context.value.toUpperCase()
      })
    }
  }
);

const service = interpret(machine).start();

service.send({ type: 'valueUpdated', value: 'hello' }); // logs "Value: HELLO"
```
