# Context (Extended State)

While _finite_ states are well-defined in finite state machines and statecharts, state that represents _quantitative data_ (e.g., arbitrary strings, numbers, objects, etc.) that can be potentially infinite is represented as [extended state](https://en.wikipedia.org/wiki/UML_state_machine#Extended_states) instead. This makes statecharts much more useful for real-life applications.

In XState, extended state is known as **context**. Below is an example of how `context` is used to simulate filling a glass of water:

```js
import { Machine, assign } from 'xstate';

// Action to increment the context amount
const addWater = assign({
  amount: (ctx, event) => ctx.amount + 1
});

// Guard to check if the glass is full
function glassIsFull(ctx, event) {
  return ctx.amount >= 10;
}

const glassMachine = Machine(
  {
    id: 'glass',
    // the initial context (extended state) of the statechart
    context: {
      amount: 0
    },
    initial: 'empty',
    states: {
      empty: {
        on: {
          FILL: {
            target: 'filling',
            actions: 'addWater'
          }
        }
      },
      filling: {
        on: {
          // Transient transition
          '': {
            target: 'full',
            cond: 'glassIsFull'
          },
          FILL: {
            target: 'filling',
            actions: 'addWater'
          }
        }
      },
      full: {}
    }
  },
  {
    actions: { addWater },
    guards: { glassIsFull }
  }
);
```

The current context is referenced on the `State` as `state.context`:

```js
const nextState = glassMachine.transition(glassMachine.initialState, 'FILL');

nextState.context;
// => { count: 1 }
```

## Initial context

The initial context is specified on the `context` property of the `Machine`:

```js
const counterMachine = Machine({
  id: 'counter',
  // initial context
  context: {
    count: 0,
    message: 'Currently empty',
    user: {
      name: 'David'
    },
    allowedToIncrement: true
    // ... etc.
  },
  states: {
    // ...
  }
});
```

For dynamic `context` (that is, `context` whose initial value is retrieved or provided externally), you can either provide the context in the third argument of `Machine(...)` (for new machines):

```js
// retrieved dynamically
const someContext = { count: 42, time: Date.now() };

const counterMachine = Machine(
  {
    id: 'counter'
    // ...
  },
  {
    actions: {
      /* ... */
    }
    // ... machine options
  },
  someContext
); // provide dynamic context as 3rd argument
```

Or for existing machines, `machine.withContext(...)` should be used:

```js
const counterMachine = Machine({
  /* ... */
});

// retrieved dynamically
const someContext = { count: 42, time: Date.now() };

const dynamicCounterMachine = counterMachine.withContext(someContext);
```

The initial context of a machine can be retrieved from its initial state:

```js
dynamicCounterMachine.initialState.context;
// => { count: 42, time: 1543687816981 }
```

## Updating context with `assign`

The `assign()` action is used to update the machine's `context`. It takes the context "updater", which represents how the current context should be updated.

The "updater" can be an object (recommended):

```js
import { Machine, assign } from 'xstate';
// example: property updater

// ...
  actions: assign({
    // increment the current count by the event value
    count: (ctx, event) => ctx.count + event.value,

    // update the message statically (no function needed)
    message: 'Count changed'
  }),
// ...
```

Or it can be a function that returns the updated state:

```js
// example: context updater

// ...

  // return a partial (or full) updated context
  actions: assign((ctx, event) => ({
    count: ctx.count + event.value,
    message: 'Count changed'
  })),
// ...
```

Both the property updater and context updater function signatures above are given two arguments:

- `context` (TContext): the current context (extended state) of the machine
- `event` (EventObject): the event that caused the `assign` action

## Action order

Custom actions are always executed with regard to the _next state_ in the transition. When a state transition has `assign(...)` actions, those actions are always batched and computed _first_, to determine the next state. This is because a state is a combination of the finite state and the extended state (context).

For example, in this counter machine, the custom actions will not work as expected:

```js
const counterMachine = Machine({
  id: 'counter',
  context: { count: 0 },
  initial: 'active',
  states: {
    active: {
      on: {
        INC: {
          actions: [
            ctx => console.log(`Before: ${ctx.count}`),
            assign({ count: ctx => ctx + 1 }), // count === 1
            assign({ count: ctx => ctx + 1 }), // count === 2
            ctx => console.log(`After: ${ctx.count}`)
          ]
        }
      }
    }
  }
});

interpret(counterMachine).send('INC');
// => "Before: 2"
// => "After: 2"
```

This is because both `assign(...)` actions are batched in order, so the next state `context` is `{ count: 2 }`, which is passed to both custom actions. Another way of thinking about this transition is reading it like:

> When in the `active` state and the `INC` event occurs, the next state is the `active` state with `context.count` updated, and these custom actions are executed on that state.

A good way to refactor this to get the desired result is modeling the `context` with explicit _previous_ values, if those are needed:

```js
const counterMachine = Machine({
  id: 'counter',
  context: { count: 0, prevCount: undefined },
  initial: 'active',
  states: {
    active: {
      on: {
        INC: {
          actions: [
            ctx => console.log(`Before: ${ctx.prevCount}`),
            assign({
              count: ctx => ctx + 1,
              prevCount: ctx => ctx.count
            }), // count === 1, prevCount === 0
            assign({ count: ctx => ctx + 1 }), // count === 2
            ctx => console.log(`After: ${ctx.count}`)
          ]
        }
      }
    }
  }
});

interpret(counterMachine).send('INC');
// => "Before: 0"
// => "After: 2"
```

The benefits of this are:

1. The extended state (context) is modeled more explicitly
2. There are no implicit intermediate states, preventing hard-to-catch bugs
3. The action order is more independent (the "Before" log can even go after the "After" log!)
4. Testing and examining state is easier.

## Notes

- 🚫 Never mutate the machine's `context` externally. Everything happens for a reason, and every context change should happen explicitly due to an event.
- Prefer the object syntax of `assign({ ... })`. This makes it possible for future analysis tools to predict _how_ certain properties can change declaratively.
- Assignments can be stacked, and will run sequentially:

```js
// ...
  actions: [
    assign({ count: 3 }), // ctx.count === 3
    assign({ count: ctx => ctx.count * 2 }) // ctx.count === 6
  ],
// ...
```

- Just like with `actions`, it's best to represent `assign()` actions as strings, and then reference them in the machine options:

```js
const countMachine = Machine({
  initial: 'start',
  context: { count: 0 }
  states: {
    start: {
      onEntry: 'increment'
    }
  }
}, {
  actions: {
    increment: assign({ count: ctx => ctx.count + 1 }),
    decrement: assign({ count: ctx => ctx.count - 1 })
  }
});
```

- Ideally, the `context` should be representable as a plain JavaScript object; i.e., it should be serializable as JSON.
- Since `assign()` actions are _raised_, the context is updated before other actions are executed. This means that other actions within the same step will get the _updated_ `context` rather than what it was before the `assign()` action was executed. You shouldn't rely on action order for your states, but keep this in mind.
