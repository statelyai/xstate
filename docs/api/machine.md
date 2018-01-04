# Machine

A machine in xstate represents a hierarchical state machine, or statechart. The `Machine(...)` function creates these machines.

## `Machine(config)`

**Arguments:**
- `config`: `MachineConfig | ParallelMachineConfig`

**Returns:** `StandardMachine | ParallelMachine`

**Usage:** There's two types of machines that can be returned. A `StandardMachine` has an `initial` state set:

```js
const standardMachine = Machine({
  initial: 'green',
  states: {
    green: { on: { TIMER: 'yellow' } },
    yellow: { on: { TIMER: 'red' } },
    red: { on: { TIMER: 'green' } },
  }
});

standardMachine.initialState;
// => 'green'
```

Whereas a `ParallelMachine` has no initial state (since all of its child states are entered simultaneously) and has `parallel: true` set in its config:

```js
const parallelMachine = Machine({
  parallel: true,
  states: {
    northSouthLight: {
      initial: 'green',
      states: {
        green: { on: { TIMER: 'yellow' } },
        yellow: { on: { TIMER: 'red' } },
        red: { on: { TIMER: 'green' } },
      }
    },
    eastWestLight: {
      initial: 'red',
      states: {
        green: { on: { TIMER: 'yellow' } },
        yellow: { on: { TIMER: 'red' } },
        red: { on: { TIMER: 'green' } },
      }
    }
  }
});

parallelMachine.initialState;
// => {
//   northSouthLight: 'green',
//   eastWestLight: 'red'
// }
```

## `Machine.standard(config)`

**Arguments:**
- `config`: `MachineConfig`

**Returns:** `StandardMachine`

**Usage:** Convenience function for TypeScript usage. Use this or `Machine.parallel` for better type checking.

```js
const standardMachine = Machine.standard({
  // ... standard machine config (see above)
});
```

## `Machine.parallel(config)`

**Arguments:**
- `config`: `ParallelMachineConfig`

**Returns:** `ParallelMachine`

**Usage:** Convenience function for TypeScript usage. Use this or `Machine.standard` for better type checking.

```js
const parallelMachine = Machine.parallel({
  // ... parallel machine config (see above)
});
```
