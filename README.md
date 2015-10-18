# Estado
Simple, stateless JavaScript finite-state machines.

**What is it?** Estado is a tiny, framework-agnostic JS library for representing [finite-state machines](https://en.wikipedia.org/wiki/Finite-state_machine) and hierarchical state machines, or [Harel statecharts](https://en.wikipedia.org/wiki/State_diagram#Harel_statechart). Its main use is as a pure (extended) transition function of the form `(state, signal) -> state`.

## Getting Started
1. Install via NPM: `npm install estado --save`
2. Import the state machine creator into your project:

```js
import { machine } from 'estado';

let lightMachine = machine({
  states: [
    {
      id: 'green',
      initial: true,
      transitions: [
        {
          event: 'TIMER',
          target: 'yellow'
        }
      ]
    },
    {
      id: 'yellow',
      transitions: [
        {
          event: 'TIMER',
          target: 'red'
        }
      ]
    },
    {
      id: 'red',
      transitions: [
        {
          event: 'TIMER',
          target: 'green'
        }
      ]
    }
  ]
});

// Pure, stateless transition functions
let currentState = lightMachine.transition('green', 'TIMER');
// => 'yellow'

let newState = lightMachine.transition(currentState, 'TIMER');
// => 'red'

// Initial state
let initialState = lightMachine.transition();
// => 'green'
```

## State Machine Schema
The state machine is always represented as a plain JavaScript object, or as JSON. The schema is closely aligned with [SCION-CORE](https://github.com/jbeard4/SCION-CORE#statecharts-model-schema), which itself is a plain JavaScript object representation of [State Chart XML](http://www.w3.org/TR/scxml/), a W3C recommendation.

There are a few small differences, though, in order to keep the schema as side-effect-free as possible:

- There is neither an `onEntry` nor an `onExit` property for state - these are unwanted side-effects.
- Each state can have a `states` property for nested states (replaces `substates` in SCION-CORE)
- There is no `$type` property.
- Each state can have an `initial: Boolean` property
- Each state can have a `final: Boolean` property
- The `history` state property has not been implemented yet.

### State Schema
```js
{
  id: 'green', // (string) state ID
  initial: true, // (boolean) is initial state? (default: false)
  final: false, // (boolean) is final/accepting state? (default: false)
  states: [...], // (States[]) array of nested States (default: [])
  transitions: [...] // (Transitions[]) array of Transitions (default: [])
}
```

_Note:_ A **machine** has the same schema as a **state**, as machines are just abstract states.

### Transition Schema
```js
{
  event: 'TIMER', // (string) name/type of event
  target: 'yellow', // (string) target state
  cond: (Signal) => { ... } // (function -> boolean) condition function (default: () => true)
}
```

### Signal Schema
```js
{
  type: 'TIMER' // (string) name/type of signal event
}
```

Signals can contain any arbitrary data.

