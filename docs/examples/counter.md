# Counter

This counter app example demonstrates a counter that has a single `'active'` state and two possible events:

- `'INC'` - an intent to increment the current count by 1
- `'DEC'` - an intent to decrement the current count by 1

The `count` is [stored in `context`](../guides/context.md).

```js
import { createMachine, interpret, assign } from 'xstate';

const increment = (context) => context.count + 1;
const decrement = (context) => context.count - 1;

const counterMachine = createMachine({
  initial: 'active',
  context: {
    count: 0
  },
  states: {
    active: {
      on: {
        INC: { actions: assign({ count: increment }) },
        DEC: { actions: assign({ count: decrement }) }
      }
    }
  }
});

const counterService = interpret(counterMachine)
  .onTransition((state) => console.log(state.context.count))
  .start();
// => 0

counterService.send('INC');
// => 1

counterService.send('INC');
// => 2

counterService.send('DEC');
// => 1
```

## Modeling Min and Max

With [guards](../guides/guards.md), we can model min and max by preventing transitions on the `'DEC'` and `'INC'` events on certain values, respectively:

```js
// ...

const isNotMax = (context) => context.count < 10;
const isNotMin = (context) => context.count >= 0;

const counterMachine = createMachine({
  initial: 'active',
  context: {
    count: 0
  },
  states: {
    active: {
      on: {
        INC: {
          actions: assign({ count: increment }),
          cond: isNotMax
        },
        DEC: {
          actions: assign({ count: decrement }),
          cond: isNotMin
        }
      }
    }
  }
});

// ...

// assume context is { count: 9 }
counterService.send('INC');
// => 10

counterService.send('INC'); // no transition taken!
// => 10
```
