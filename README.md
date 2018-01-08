# xstate

[![Travis](https://img.shields.io/travis/davidkpiano/xstate.svg?style=flat-square)]()
[![npm](https://img.shields.io/npm/v/xstate.svg?style=flat-square)]()

Functional, stateless JavaScript [finite state machines](https://en.wikipedia.org/wiki/Finite-state_machine) and [statecharts](http://www.inf.ed.ac.uk/teaching/courses/seoc/2005_2006/resources/statecharts.pdf).

📖 [Read the documentation!](http://davidkpiano.github.io/xstate/docs)

## Why?
In short, statecharts are a formalism for modeling stateful, reactive systems. This is useful for declaratively describing the _behavior_ of your application, from the individual components to the overall application logic.

Read [📽 the slides](http://slides.com/davidkhourshid/finite-state-machines) ([🎥 video](https://www.youtube.com/watch?v=VU1NKX6Qkxc)) or check out these resources for learning about the importance of finite state machines and statecharts in user interfaces:

- [Statecharts - A Visual Formalism for Complex Systems](http://www.inf.ed.ac.uk/teaching/courses/seoc/2005_2006/resources/statecharts.pdf) by David Harel
- [The World of Statecharts](https://statecharts.github.io/) by Erik Mogensen
- [Pure UI](https://rauchg.com/2015/pure-ui) by Guillermo Rauch
- [Pure UI Control](https://medium.com/@asolove/pure-ui-control-ac8d1be97a8d) by Adam Solove

## Installation
1. `npm install xstate --save`
2. `import { Machine } from 'xstate';`

## Finite State Machines

<img src="http://i.imgur.com/KNUL5X8.png" alt="Light Machine" width="300" />

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

<img src="http://imgur.com/OuZ1nn8.png" alt="Hierarchical Light Machine" width="300" />

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
  .value;
// => {
//   red: 'walk'
// }

lightMachine
  .transition('red.walk', 'PED_TIMER')
  .value;
// => {
//   red: 'wait'
// }
```

**Object notation for hierarchical states:**

```js
// ...
const waitState = lightMachine
  .transition({ red: 'walk' }, 'PED_TIMER')
  .value;

// => { red: 'wait' }

lightMachine
  .transition(waitState, 'PED_TIMER')
  .value;

// => { red: 'stop' }

lightMachine
  .transition({ red: 'stop' }, 'TIMER')
  .value;

// => 'green'
```

## Parallel States

```js
const wordMachine = Machine({
  parallel: true,
  states: {
    bold: {
      initial: 'off',
      states: {
        on: {
          on: { TOGGLE_BOLD: 'off' }
        },
        off: {
          on: { TOGGLE_BOLD: 'on' }
        }
      }
    },
    underline: {
      initial: 'off',
      states: {
        on: {
          on: { TOGGLE_UNDERLINE: 'off' }
        },
        off: {
          on: { TOGGLE_UNDERLINE: 'on' }
        }
      }
    },
    italics: {
      initial: 'off',
      states: {
        on: {
          on: { TOGGLE_ITALICS: 'off' }
        },
        off: {
          on: { TOGGLE_ITALICS: 'on' }
        }
      }
    },
    list: {
      initial: 'none',
      states: {
        none: {
          on: { BULLETS: 'bullets', NUMBERS: 'numbers' }
        },
        bullets: {
          on: { NONE: 'none', NUMBERS: 'numbers' }
        },
        numbers: {
          on: { BULLETS: 'bullets', NONE: 'none' }
        }
      }
    }
  }
});

const boldState = wordMachine
  .transition('bold.off', 'TOGGLE_BOLD')
  .value;

// {
//   bold: 'on',
//   italics: 'off',
//   underline: 'off',
//   list: 'none'
// }

const nextState = wordMachine
  .transition({
    bold: 'off',
    italics: 'off',
    underline: 'on',
    list: 'bullets'
  }, 'TOGGLE_ITALICS')
  .value;

// {
//   bold: 'off',
//   italics: 'on',
//   underline: 'on',
//   list: 'bullets'
// }
```

## History States

To provide full flexibility, history states are more arbitrarily defined than the original statechart specification. To go to a history state, use the special key `$history`.

<img src="http://imgur.com/sjTlr6j.png" width="300" alt="Payment Machine" />

```js
const paymentMachine = Machine({
  initial: 'method',
  states: {
    method: {
      initial: 'cash',
      states: {
        cash: { on: { SWITCH_CHECK: 'check' } },
        check: { on: { SWITCH_CASH: 'cash' } }
      },
      on: { NEXT: 'review' }
    },
    review: {
      on: { PREVIOUS: 'method.$history' }
    }
  }
});

const checkState = paymentMachine
  .transition('method.cash', 'SWITCH_CHECK');

// => State {
//   value: { method: 'check' },
//   history: State { ... }
// }

const reviewState = paymentMachine
  .transition(checkState, 'NEXT');

// => State {
//   value: 'review',
//   history: State { ... }
// }

const previousState = paymentMachine
  .transition(reviewState, 'PREVIOUS')
  .value;

// => { method: 'check' }
```
