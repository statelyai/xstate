# Creating Machines

## createMachine

You can create a state machine with `createMachine`:

```js
import { createMachine } from 'xstate';

const lightMachine = createMachine({
  // The initial state of the machine
  initial: 'green',

  // The states the machine can be in
  states: {
    green: {
      on: {
        NEXT: {
          target: 'yellow'
        }
      }
    },
    yellow: {
      on: {
        NEXT: {
          target: 'red'
        }
      }
    },
    red: {}
  }
});
```

This will create a machine with this structure:

<iframe src="https://stately.ai/viz/embed/bcea02db-db69-4c7d-a86c-78a500456195?mode=viz&panel=code&readOnly=1&showOriginalLink=1&controls=0&pan=0&zoom=0"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

Creating a machine in this way won't _do_ anything yet. It's just a blueprint for things the machine _can_ do.

To make the machine _do_ something, we'll need to [interpret](./interpreting-machines.md) it. But we'll get to that later.

## Implementations

The machine above is not terribly useful. It can transition from `green` to `yellow` to `red`, but it can't react to anything outside of itself.

This is where [actions](./actions.md), [delays](./delays.md), [guards](./guards.md), and [services](./communication.md) come in. You can use these in XState to either react to outside stimulus, or

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
    activities: {
      /* ... */
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
- `activities` - the mapping of activity names to their implementation
- `delays` - the mapping of delay names to their implementation
- `guards` - the mapping of transition guard (`cond`) names to their implementation
- `services` - the mapping of invoked service (`src`) names to their implementation

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
