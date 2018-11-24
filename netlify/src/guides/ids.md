# Identifying State Nodes

State nodes can be targeted via unique identifiers, instead of by relative identifiers. This can simplify the creation of complex statecharts.

To specify an ID for a state node, provide a unique string identifier as its `id` property, e.g., `id: 'greenLight'`.

To target a state node by its ID, prepend the `'#'` symbol to its string ID, e.g., `TIMER: '#greenLight'`.

```js
const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      // custom identifier
      id: 'greenLight',
      on: {
        // target state node by its ID
        TIMER: '#yellowLight'
      }
    },
    yellow: {
      id: 'yellowLight',
      on: {
        TIMER: '#redLight'
      }
    },
    red: {
      id: 'redLight',
      on: {
        // relative targets will still work
        TIMER: 'green'
      }
    }
  }
});
```

By default, a state node's `id` is its delimited full path. You can use this default `id` to specify a state node:

```js
const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      // default ID: 'light.green'
      on: {
        // can target state nodes by their default ID
        TIMER: '#light.yellow'
      }
    },
    yellow: { on: { TIMER: 'red' } },
    red: { on: { TIMER: 'green' } }
  }
});
```

**Notes:**

- IDs are always recommended for the root state node.
- IDs are useful for SCXML compatibility, and conversion to/from SCXML will make use of IDs extensively.
- Make sure that all IDs are unique in order to prevent naming conflicts. This is naturally enforced by the automatically generated IDs.
