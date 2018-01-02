# XState

[![Travis](https://img.shields.io/travis/davidkpiano/xstate.svg?style=flat-square)]()
[![npm](https://img.shields.io/npm/v/xstate.svg?style=flat-square)]()

Simple, stateless JavaScript [finite state machines](https://en.wikipedia.org/wiki/Finite-state_machine) and [statecharts](http://www.inf.ed.ac.uk/teaching/courses/seoc/2005_2006/resources/statecharts.pdf).

## Why?
Read [the slides](http://slides.com/davidkhourshid/finite-state-machines) ([video](https://www.youtube.com/watch?v=VU1NKX6Qkxc)) or check out these resources for learning about the importance of finite state machines and statecharts in user interfaces:

- [Statecharts - A Visual Formalism for Complex Systems](http://www.inf.ed.ac.uk/teaching/courses/seoc/2005_2006/resources/statecharts.pdf) by David Harel
- [Pure UI](https://rauchg.com/2015/pure-ui) by Guillermo Rauch
- [Pure UI Control](https://medium.com/@asolove/pure-ui-control-ac8d1be97a8d) by Adam Solove

## Roadmap for V2
- Full documentation
- Non-trivial, real-life examples for React, Vue, Angular, and no frameworks
- Guard functions for actions
- `onEnter`, `onTransition`, and `onExit` hooks
- SCXML/SCION support
- Automatic test generation
- Simple event emitter integration
- More analytics/optimization utilities
- Tutorials, tutorials, tutorials

## Visualizing state machines and statecharts
The JSON-based notation used here to declaratively represent finite state machines and statecharts can be copy-pasted here: https://codepen.io/davidkpiano/pen/ayWKJO/ which will generate interactive state transition diagrams.

## Getting Started
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
  .toString(); // toString() only works for non-parallel machines

// => 'red.walk' 

lightMachine
  .transition('red.walk', 'PED_TIMER')
  .toString();

// => 'red.wait'
```

**Object notation for hierarchical states:**

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
//   history: { $current: { method: 'cash' }, ... }
// }

const reviewState = paymentMachine
  .transition(checkState, 'NEXT');

// => State {
//   value: 'review',
//   history: { $current: { method: 'check' }, ... }
// }

const previousState = paymentMachine
  .transition(reviewState, 'PREVIOUS')
  .value;

// => { method: 'check' }
```

More code examples coming soon!

## Examples
- [Simple Finite State Machine with Vue](https://codepen.io/BrockReece/pen/EvdwpJ)

```js
import React, { Component } from 'react'
import { Machine } from 'xstate'

const ROOT_URL = `https://api.github.com/users`
const myMachine = Machine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        CLICK: 'loading'
      }
    },
    loading: {
      on: {
        RESOLVE: 'data',
        REJECT: 'error'
      }
    },
    data: {
      on: {
        CLICK: 'loading'
      }
    },
    error: {
      on: {
        CLICK: 'loading'
      }
    }
  }
})

class App extends Component {
  state = {
    data: {},
    dataState: 'idle',
    input: ''
  }

  searchRepositories = async () => {
    try {
      const data = await fetch(`${ROOT_URL}/${this.state.input}`).then(response => response.json())
      this.setState(({ data }), this.transition('RESOLVE'))

    } catch (error) {
      this.transition('REJECT')
    }
  }

  commands = {
    loading: this.searchRepositories
  }
  transition = action => {
    const { dataState } = this.state

    const newState = myMachine.transition(dataState, action).value
    const command = this.commands[newState]

    this.setState(
      {
        dataState: newState
      },
      command
    )
  }

  render() {
    const { data, dataState } = this.state
    const buttonText = {
      idle: 'Fetch Github',
      loading: 'Loading...',
      error: 'Github fail. Retry?',
      data: 'Fetch Again?'
    }[dataState]
    return (
      <div>
        <input
          type="text"
          value={this.state.input}
          onChange={e => this.setState({ input: e.target.value })}
        />
        <button
          onClick={() => this.transition('CLICK')}
          disabled={dataState === 'loading'}
        >
          {buttonText}
        </button>
        {data && <div>{JSON.stringify(data, null, 2)}</div>}
        {dataState === 'error' && <h1>Error!!!</h1>}
      </div>
    )
  }
}

export default App
```
