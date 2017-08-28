# XState
Simple, stateless JavaScript [finite state machines](https://en.wikipedia.org/wiki/Finite-state_machine) and [statecharts](http://www.inf.ed.ac.uk/teaching/courses/seoc/2005_2006/resources/statecharts.pdf).

## Why?
Read [the slides](http://slides.com/davidkhourshid/finite-state-machines) (video coming soon!) or check out these resources for learning about the importance of finite state machines and statecharts in user interfaces:

- [Statecharts - A Visual Formalism for Complex Systems](http://www.inf.ed.ac.uk/teaching/courses/seoc/2005_2006/resources/statecharts.pdf) by David Harel
- [Pure UI](https://rauchg.com/2015/pure-ui) by Guillermo Rauch
- [Pure UI Control](https://medium.com/@asolove/pure-ui-control-ac8d1be97a8d) by Adam Solove

## Visualizing state machines and statecharts
The JSON-based notation used here to declaratively represent finite state machines and statecharts can be copy-pasted here: https://codepen.io/davidkpiano/pen/ayWKJO/ which will generate interactive state transition diagrams.

## Getting Started
1. `npm install xstate --save`
2. `import { Machine } from 'xstate';`

## Finite State Machines

```js
import { Machine } from 'xstate';

const lightMachine = Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow',
      }
    },
    yellow: {
      on: {
        TIMER: 'red',
      }
    },
    red: {
      on: {
        TIMER: 'green',
      }
    }
  }
});

const currentState = 'green';

const nextState = lightMachine
  .transition(currentState, 'TIMER')
  .value;

// => 'yellow'
```

## Hierarchical (Nested) State Machines

```js
import { Machine } from 'xstate';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_TIMER: 'wait'
      }
    },
    wait: {
      on: {
        PED_TIMER: 'stop'
      }
    },
    stop: {}
  }
};

const lightMachine = Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      on: {
        TIMER: 'green'
      },
      ...pedestrianStates
    }
  }
});

const currentState = 'yellow';

const nextState = lightMachine
  .transition(currentState, 'TIMER')
  .toString(); // toString() only works for non-parallel machines

// => 'red.walk' 

lightMachine
  .transition('red.walk', 'PED_TIMER')
  .toString();

// => 'red.wait'
```

** Object notation for hierarchical states: **

```js
// ...
const waitState = lightMachine
  .transition('red.walk', 'PED_TIMER')
  .value;

// => { red: 'wait' }

lightMachine
  .transition(waitState, 'PED_TIMER')
  .value;

// => { red: 'stop' }

lightMachine
  .transition('red.stop', 'TIMER')
  .value;

// => 'green'
```

More examples coming soon!
