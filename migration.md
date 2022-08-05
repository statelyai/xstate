# XState Version 3.x to 4 Migration Guide

## State Node Types

State nodes now have a `type: ...` property that defines the type of the node. There's 5 types:

- `type: 'parallel'` (required) for parallel state nodes
- `type: 'history'` (required) for history state nodes
- `type: 'final'` (required) for final state nodes
- `type: 'compound'` (optional) for compound/nested state nodes
- `type: 'atomic'` (optional) for atomic state nodes

Only `'parallel'`, `'history'`, and `'final'` are required for those state nodes. This replaces previous syntax:

```diff
- parallel: true,
+ type: 'parallel'

- history: true,
+ type: 'history',
+ history: 'deep', // 'shallow' by default
```

## Machine Configuration

IDs are recommended on the root state node (machine):

```js
const machine = createMachine({
  id: 'light', // add this property!
  initial: 'green',
  states: {
    /* ... */
  }
});
```

This may become a strict-mode requirement in future versions.

## States Configuration

The single nested object syntax will no longer work:

```js
const machine = createMachine({
  // ...
  states: {
    green: {
      on: {
        TIMER: {
          // ⚠️ deprecated in v4
          yellow: { actions: ['doSomething'] }
        }
      }
    }
  }
});
```

You now specify the transition as an object (or an array of objects) instead:

```js
const machine = createMachine({
  // ...
  states: {
    green: {
      on: {
        // ✅ will work in v4
        TIMER: {
          target: 'yellow',
          actions: 'doSomething' // notice: array not necessary anymore!
        }
      }
    }
  }
});
```

Of course, string targets still work as expected:

```js
const machine = createMachine({
  // ...
  states: {
    green: {
      on: {
        // ✅ still works in v4
        TIMER: 'yellow'
      }
    }
  }
});
```

## Optional Arrays

For developer convenience, every property that expects one or more entries now _optionally_ takes an array:

```js
{
  // This still works
  onEntry: ['someEntryAction'],
  onExit: [{ type: 'someExitAction' }],

  // But you can do this instead, if you prefer:
  onEntry: 'someEntryAction',
  onExit: { type: 'someExitAction' }
}
```

That's about it!
