# Machines

A state machine is a finite set of states that can transition to each other deterministically due to events. To learn more, read our [introduction to statecharts](./introduction-to-state-machines-and-statecharts/index.md).

## Configuration

State machines and statecharts alike are defined using the `createMachine()` factory function:

```js
import { createMachine } from 'xstate';

const lightMachine = createMachine({
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

The machine config is the same as the [state node config](./statenodes.md), with the addition of the context property:

- `context` - represents the local "extended state" for all of the machine's nested states. See [the docs for context](./context.md) for more details.

## Options

Implementations for [actions](./actions.md), [delays](./delays.md), [guards](./guards.md), and [services](./communication.md) can be referenced in the machine config as a string, and then specified as an object in the 2nd argument to `createMachine()`:

```js
const lightMachine = createMachine(
  {
    id: 'light',
    initial: 'green',
    states: {
      green: {
        // action referenced via string
        entry: 'alertGreen'
      }
    }
  },
  {
    actions: {
      // action implementation
      alertGreen: (context, event) => {
        alert('Green!');
      }
    },
    delays: {
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

This object has 5 optional properties:

- `actions` - the mapping of action names to their implementation
- `delays` - the mapping of delay names to their implementation
- `guards` - the mapping of transition guard (`cond`) names to their implementation
- `services` - the mapping of invoked service (`src`) names to their implementation
- `activities` (deprecated) - the mapping of activity names to their implementation

## Extending Machines

Existing machines can be extended using `.withConfig()`, which takes the same object structure as above:

```js
const lightMachine = // (same as above example)

const noAlertLightMachine = lightMachine.withConfig({
  actions: {
    alertGreen: (context, event) => {
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
