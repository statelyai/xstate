# Estado
Simple, stateless JavaScript finite-state machines.

**What is it?** Estado is a tiny, framework-agnostic JS library for representing [finite-state machines](https://en.wikipedia.org/wiki/Finite-state_machine) and hierarchical state machines, or [Harel statecharts](https://en.wikipedia.org/wiki/State_diagram#Harel_statechart). Its main use is as a pure (extended) transition function of the form `(state, signal) -> state`.

## Getting Started
1. Install via NPM: `npm install estado --save`
2. Import the state machine creator into your project:

```js
import { machine } from 'estado';

let lightMachine = machine`
  green -> yellow (TIMER)
  yellow -> red (TIMER)
  red -> green (TIMER)
`;

// Pure, stateless transition functions
let currentState = lightMachine.transition('green', 'TIMER');
// => 'yellow'

let newState = lightMachine.transition(currentState, 'TIMER');
// => 'red'

// Initial state
let initialState = lightMachine.transition();
// => 'green'
```

## The Estado language
Estado allows you to parse an easy-to-learn DSL for declaratively writing finite state machines.

**States**
A state is just an alphanumeric string (underscores are allowed) without quotes or spaces: `some_valid_state`. Final states are appended with an exclamation point: `someFinalState!`.

By default, the first state declared in a state group is an initial state.

**Transitions**
A transition (edge) between states is denoted with an arrow: `->`. A state can transition to itself with a reverse arrow: `<-`. In the example below, `state1` transitions to `state2` on the `FOO` event. `state2` transitions to itself on the `BAR` event.

```
state1 -> state2 (FOO)
state2 <- (BAR)
```

**Signals**
A signal is also an alphanumeric string (underscores allowed), just like states. They are contained in parentheses after a transition: `state1 -> state2 (SOME_EVENT)`, or after a self-transition: `state3 -< (AN_EVENT)`. Signals are optional (but encouraged for proper state machine design).

**Nested States**
States can be hierarchical (nested) by including them inside brackets after a state declaration. They can be deeply nested an infinite amount of levels. This is useful for implementing statecharts.

```
state1 {
  nestedState1 -> nestedState2 (FOO)
  nestedState2!
} -> state2 (BAR)
  -> state3 (BAZ)
state2!
state3!
```

**Formatting / Best Practices**
- Indent transitions on a new line for each transition.
- Always declare all states used in the state machine (be explicit!)
- Keep signals on the same line as their transition.
- Indent nested states on a new line for each nested state.

## API

#### machine(data, options = {})
Creates a new `Machine()` instance with the specified data (see the schema above) and options (optional).

- `data`: (object | string) The definition of the state machine.
- `options`: (object) Machine-specific options:
  - `deterministic`: (boolean) Specifies whether the machine is deterministic or nondeterministic (default: `true`)

#### Machine.transition(state = null, signal = null)
Returns the next state, given a current state and a signal. If no state nor signal is provided, the initial state is returned.

_Note:_ This is a pure function, and does not maintain internal state.

- `state`: (string) The current state ID.
- `signal`: (string | Signal) The signal that triggers the transition from the `state` to the next state.

**Example:**
```js
lightMachine.transition();
// => 'green'

lightMachine.transition('green', 'TIMER');
// => 'yellow'

lightMachine.transition('yellow', { type: 'TIMER' });
// => 'red'

lightMachine.transition('yellow');
// => 'yellow'
```
