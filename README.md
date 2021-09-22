<p align="center">
  <a href="https://xstate.js.org">
  <br />
  <img src="https://user-images.githubusercontent.com/1093738/101672561-06aa7480-3a24-11eb-89d1-787fa7112138.png" alt="XState" width="150"/>
  <br />
    <sub><strong>JavaScript state machines and statecharts</strong></sub>
  <br />
  <br />
  </a>
</p>

[![npm version](https://badge.fury.io/js/xstate.svg)](https://badge.fury.io/js/xstate)
<img src="https://opencollective.com/xstate/tiers/backer/badge.svg?label=sponsors&color=brightgreen" />

JavaScript and TypeScript [finite state machines](https://en.wikipedia.org/wiki/Finite-state_machine) and [statecharts](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) for the modern web.

📖 [Read the documentation](https://xstate.js.org/docs)

💙 [Explore our catalogue of examples](https://xstate-catalogue.com/)

📑 Adheres to the [SCXML specification](https://www.w3.org/TR/scxml/)

💬 Chat on the [Stately Discord Community](https://discord.gg/KCtSX7Cdjh)

## Packages

- 🤖 `xstate` - Core finite state machine and statecharts library + interpreter
- [🔬 `@xstate/fsm`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-fsm) - Minimal finite state machine library
- [📉 `@xstate/graph`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-graph) - Graph traversal utilities for XState
- [⚛️ `@xstate/react`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-react) - React hooks and utilities for using XState in React applications
- [💚 `@xstate/vue`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-vue) - Vue composition functions and utilities for using XState in Vue applications
- [🎷 `@xstate/svelte`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-svelte) - Svelte utilities for using XState in Svelte applications
- [✅ `@xstate/test`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-test) - Model-Based-Testing utilities (using XState) for testing any software
- [🔍 `@xstate/inspect`](https://github.com/davidkpiano/xstate/tree/main/packages/xstate-inspect) - Inspection utilities for XState

## Templates

Get started by forking one of these templates on CodeSandbox:

- [XState Template](https://codesandbox.io/s/xstate-example-template-m4ckv) - no framework
- [XState + TypeScript Template](https://codesandbox.io/s/xstate-typescript-template-s9kz8) - no framework
- [XState + React Template](https://codesandbox.io/s/xstate-react-template-3t2tg)
- [XState + React + TypeScript Template](https://codesandbox.io/s/xstate-react-typescript-template-wjdvn)
- [XState + Vue Template](https://codesandbox.io/s/xstate-vue-template-composition-api-1n23l)
- [XState + Vue 3 Template](https://codesandbox.io/s/xstate-vue-3-template-vrkk9)
- [XState + Svelte Template](https://codesandbox.io/s/xstate-svelte-template-jflv1)

## Super quick start

```bash
npm install xstate
```

```js
import { createMachine, interpret } from 'xstate';

// Stateless machine definition
// machine.transition(...) is a pure function used by the interpreter.
const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
});

// Machine instance with internal state
const toggleService = interpret(toggleMachine)
  .onTransition((state) => console.log(state.value))
  .start();
// => 'inactive'

toggleService.send('TOGGLE');
// => 'active'

toggleService.send('TOGGLE');
// => 'inactive'
```

## Promise example

[📉 See the visualization on xstate.js.org/viz](https://xstate.js.org/viz/?gist=bbcb4379b36edea0458f597e5eec2f91)

```js
import { createMachine, interpret, assign } from 'xstate';

const fetchMachine = createMachine({
  id: 'Dog API',
  initial: 'idle',
  context: {
    dog: null
  },
  states: {
    idle: {
      on: {
        FETCH: 'loading'
      }
    },
    loading: {
      invoke: {
        id: 'fetchDog',
        src: (context, event) =>
          fetch('https://dog.ceo/api/breeds/image/random').then((data) =>
            data.json()
          ),
        onDone: {
          target: 'resolved',
          actions: assign({
            dog: (_, event) => event.data
          })
        },
        onError: 'rejected'
      },
      on: {
        CANCEL: 'idle'
      }
    },
    resolved: {
      type: 'final'
    },
    rejected: {
      on: {
        FETCH: 'loading'
      }
    }
  }
});

const dogService = interpret(fetchMachine)
  .onTransition((state) => console.log(state.value))
  .start();

dogService.send('FETCH');
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Visualizer](#visualizer)
- [Why?](#why)
- [Finite State Machines](#finite-state-machines)
- [Hierarchical (Nested) State Machines](#hierarchical-nested-state-machines)
- [Parallel State Machines](#parallel-state-machines)
- [History States](#history-states)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Visualizer

**[Visualize, simulate, inspect, and share your statecharts in XState Viz](https://stately.ai/viz)**

<a href="https://stately.ai/viz" title="XState Viz">
  <img src="https://user-images.githubusercontent.com/1093738/131729181-5db835fc-77e7-4740-b03f-46bd0093baa1.png" alt="XState Viz" width="400" />
</a>

**[stately.ai/viz](https://stately.ai/viz)**

## Why?

Statecharts are a formalism for modeling stateful, reactive systems. This is useful for declaratively describing the _behavior_ of your application, from the individual components to the overall application logic.

Read [📽 the slides](http://slides.com/davidkhourshid/finite-state-machines) ([🎥 video](https://www.youtube.com/watch?v=VU1NKX6Qkxc)) or check out these resources for learning about the importance of finite state machines and statecharts in user interfaces:

- [Statecharts - A Visual Formalism for Complex Systems](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) by David Harel
- [The World of Statecharts](https://statecharts.github.io/) by Erik Mogensen
- [Pure UI](https://rauchg.com/2015/pure-ui) by Guillermo Rauch
- [Pure UI Control](https://medium.com/@asolove/pure-ui-control-ac8d1be97a8d) by Adam Solove
- [Spectrum - Statecharts Community](https://spectrum.chat/statecharts) (For XState specific questions, please use the [GitHub Discussions](https://github.com/davidkpiano/xstate/discussions))

## Finite State Machines

<a href="https://stately.ai/viz/2ac5915f-789a-493f-86d3-a8ec079773f4" title="Finite states">
  <img src="https://user-images.githubusercontent.com/1093738/131727631-916d28a7-1a40-45ed-8636-c0c0fc1c3889.gif" alt="Finite states" width="400" />
  <br />
  <small>Open in Stately Viz</small>
</a>
<br />


```js
import { createMachine } from 'xstate';

const lightMachine = createMachine({
  id: 'light',
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
      }
    }
  }
});

const currentState = 'green';

const nextState = lightMachine.transition(currentState, 'TIMER').value;

// => 'yellow'
```

## Hierarchical (Nested) State Machines

<a href="https://stately.ai/viz/d3aeda4f-7f8e-44df-bdf9-dd3cdafb3312" title="Hierarchical states">
  <img src="https://user-images.githubusercontent.com/1093738/131727794-86b63c76-5ee0-4d73-b84c-6992a1f0814e.gif" alt="Hierarchical states" width="400" />
  <br />
  <small>Open in Stately Viz</small>
</a>
<br />


```js
import { createMachine } from 'xstate';

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

const lightMachine = createMachine({
  id: 'light',
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

const nextState = lightMachine.transition(currentState, 'TIMER').value;
// => {
//   red: 'walk'
// }

lightMachine.transition('red.walk', 'PED_TIMER').value;
// => {
//   red: 'wait'
// }
```

**Object notation for hierarchical states:**

```js
// ...
const waitState = lightMachine.transition({ red: 'walk' }, 'PED_TIMER').value;

// => { red: 'wait' }

lightMachine.transition(waitState, 'PED_TIMER').value;

// => { red: 'stop' }

lightMachine.transition({ red: 'stop' }, 'TIMER').value;

// => 'green'
```

## Parallel State Machines

<a href="https://stately.ai/viz/9eb9c189-254d-4c87-827a-fab0c2f71508" title="Parallel states">
  <img src="https://user-images.githubusercontent.com/1093738/131727915-23da4b4b-5e7e-46ea-9c56-5093e37e60e6.gif" alt="Parallel states" width="400" />
  <br />
  <small>Open in Stately Viz</small>
</a>
<br />


```js
const wordMachine = createMachine({
  id: 'word',
  type: 'parallel',
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

const boldState = wordMachine.transition('bold.off', 'TOGGLE_BOLD').value;

// {
//   bold: 'on',
//   italics: 'off',
//   underline: 'off',
//   list: 'none'
// }

const nextState = wordMachine.transition(
  {
    bold: 'off',
    italics: 'off',
    underline: 'on',
    list: 'bullets'
  },
  'TOGGLE_ITALICS'
).value;

// {
//   bold: 'off',
//   italics: 'on',
//   underline: 'on',
//   list: 'bullets'
// }
```

## History States

<a href="https://stately.ai/viz/33fd92e1-f9e6-49e6-bdeb-cef9e60195ec" title="History states">
  <img src="https://user-images.githubusercontent.com/1093738/131728111-819cc824-9881-4ecf-948a-00c1162cd9e9.gif" alt="History state" width="400" />
  <br />
  <small>Open in Stately Viz</small>
</a>
<br />


```js
const paymentMachine = createMachine({
  id: 'payment',
  initial: 'method',
  states: {
    method: {
      initial: 'cash',
      states: {
        cash: { on: { SWITCH_CHECK: 'check' } },
        check: { on: { SWITCH_CASH: 'cash' } },
        hist: { type: 'history' }
      },
      on: { NEXT: 'review' }
    },
    review: {
      on: { PREVIOUS: 'method.hist' }
    }
  }
});

const checkState = paymentMachine.transition('method.cash', 'SWITCH_CHECK');

// => State {
//   value: { method: 'check' },
//   history: State { ... }
// }

const reviewState = paymentMachine.transition(checkState, 'NEXT');

// => State {
//   value: 'review',
//   history: State { ... }
// }

const previousState = paymentMachine.transition(reviewState, 'PREVIOUS').value;

// => { method: 'check' }
```
