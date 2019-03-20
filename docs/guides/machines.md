# Machines (Statecharts)

A **state machine** is a finite set of [states](./statenodes.md) that can transition to each other deterministically due to events. A **statechart** is an extension of state machines; mainly, they can have:

- [Hierarchical](./hierarchical.md) (or nested) states
- [Orthogonal](./parallel.md) (or parallel) states
- [History](./history.md) states
- And more, as described in [Statecharts: a Visual Formalism for Complex Systems](http://www.inf.ed.ac.uk/teaching/courses/seoc/2005_2006/resources/statecharts.pdf).

## Configuration

State machines and statecharts alike are defined using the `Machine()` factory function:

```js
import { Machine } from 'xstate';

const lightMachine = Machine({
  // Machine identifier
  id: 'light',

  // Initial state
  initial: 'green',

  // Local context for entire machine
  context: {
    elapsed: 0,
    direction: 'east'
  },

  // State definitions
  states: {
    green: {
      /* ... */
    },
    yellow: {
      /* ... */
    },
    red: {
      /* ... */
    }
  }
});
```

The machine config is the same as the [state node config](./statenodes.md), with the addition of the following properties:

- `context` - represents the local "extended state" for all of the machine's nested states. See [the docs for context](./context.md) for more details.
- `strict` - if `true`, any events that are sent to the machine but not accepted (i.e., there doesn't exist any transitions in any state for the given event), an error will be thrown. Defaults to `false`.

## Options

Implementations for [actions](./actions.md), [activities](./activities.md), [guards](./guards.md), and [services](./communication.md) can be referenced in the machine config as a string, and then specified as an object in the 2nd argument to `Machine()`:

```js
const lightMachine = Machine(
  {
    id: 'light',
    initial: 'green',
    states: {
      green: {
        // action referenced via string
        onEntry: 'alertGreen'
      }
    }
  },
  {
    actions: {
      // action implementation
      alertGreen: (ctx, event) => {
        alert('Green!');
      }
    },
    activities: {
      /* ... */
    },
    guards: {
      /* ... */
    },
    services: {
      /* ... */
    }
  }
);
```

This object has 4 optional properties:

- `actions` - the mapping of action names to their implementation
- `activities` - the mapping of activity names to their implementation
- `guards` - the mapping of transition guard (`cond`) names to their implementation
- `services` - the mapping of invoked service (`src`) names to their implementation

## Extending Machines

Existing machines can be extended using `.withConfig()`, which takes the same object structure as above:

```js
const lightMachine = // (same as above example)

const noAlertLightMachine = lightMachine.withConfig({
  actions: {
    alertGreen: (ctx, event) => {
      console.log('green');
    }
  }
});
```

## Initial Context

As shown in the first example, the `context` is defined directly in the configuration itself. If you want to extend an existing machine with a different initial `context`, you can use `.withContext()` and pass in the custom `context`:

```js
const lightMachine = // (same as first example)

const testLightMachine = lightMachine.withContext({
  elapsed: 1000,
  direction: 'north'
});
```

::: warning
This will _not_ do a shallow merge of the original `context`, and will instead _replace_ the original `context` with the `context` provided to `.withContext(...)`. You can still "merge" contexts manually, by referencing `machine.context`:

```js
const testLightMachine = lightMachine.withContext({
  // merge with original context
  ...lightMachine.context,
  elapsed: 1000
});
```

:::
