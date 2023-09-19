<p align="center">
  <a href="https://xstate.js.org">
  <br />

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/statelyai/public-assets/main/logos/xstate-logo-white-nobg.svg">
    <img alt="XState logotype" src="https://raw.githubusercontent.com/statelyai/public-assets/main/logos/xstate-logo-black-nobg.svg" width="200">
  </picture>
  <br />
    <sub><strong>JavaScript state machines and statecharts</strong></sub>
  <br />
  <br />
  </a>
</p>

[![npm version](https://badge.fury.io/js/xstate.svg)](https://badge.fury.io/js/xstate)
<img src="https://opencollective.com/xstate/tiers/backer/badge.svg?label=sponsors&color=brightgreen" />

JavaScript and TypeScript [finite state machines](https://en.wikipedia.org/wiki/Finite-state_machine) and [statecharts](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) for the modern web.

📖 [Read the documentation](https://stately.ai/docs/xstate)

💙 [Explore our catalogue of examples](https://xstate-catalogue.com/)

➡️ [Create state machines with the Stately Editor](https://stately.ai/editor)

🖥 [Download our VS Code extension](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode)

📑 Adheres to the [SCXML specification](https://www.w3.org/TR/scxml/)

💬 Chat on the [Stately Discord Community](https://discord.gg/xstate)

## Packages

- 🤖 `xstate` - Core finite state machine and statecharts library + interpreter
- [📉 `@xstate/graph`](https://github.com/statelyai/xstate/tree/main/packages/xstate-graph) - Graph traversal utilities for XState
- [⚛️ `@xstate/react`](https://github.com/statelyai/xstate/tree/main/packages/xstate-react) - React hooks and utilities for using XState in React applications
- [💚 `@xstate/vue`](https://github.com/statelyai/xstate/tree/main/packages/xstate-vue) - Vue composition functions and utilities for using XState in Vue applications
- [🎷 `@xstate/svelte`](https://github.com/statelyai/xstate/tree/main/packages/xstate-svelte) - Svelte utilities for using XState in Svelte applications
- [🥏 `@xstate/solid`](https://github.com/statelyai/xstate/tree/main/packages/xstate-solid) - Solid hooks and utilities for using XState in Solid applications
- [✅ `@xstate/test`](https://github.com/statelyai/xstate/tree/main/packages/xstate-test) - Model-Based-Testing utilities (using XState) for testing any software
- [🔍 `@xstate/inspect`](https://github.com/statelyai/xstate/tree/main/packages/xstate-inspect) - Inspection utilities for XState

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

[📉 See the visualization on stately.ai/viz](https://stately.ai/viz?gist=bbcb4379b36edea0458f597e5eec2f91)

<details>
<summary>See the code</summary>

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

</details>

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
- [Spectrum - Statecharts Community](https://spectrum.chat/statecharts) (For XState specific questions, please use the [GitHub Discussions](https://github.com/statelyai/xstate/discussions))

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

## SemVer Policy

We understand the importance of the public contract and do not intend to release any breaking changes to the **runtime** API in a minor or patch release. We consider this with any changes we make to the XState libraries and aim to minimize their effects on existing users.

### Breaking changes

XState executes much of the user logic itself. Therefore, almost any change to its behavior might be considered a breaking change. We recognize this as a potential problem but believe that treating every change as a breaking change is not practical. We do our best to implement new features thoughtfully to enable our users to implement their logic in a better, safer way.

Any change _could_ affect how existing XState machines behave if those machines are using particular configurations. We do not introduce behavior changes on a whim and aim to avoid making changes that affect most existing machines. But we reserve the right to make _some_ behavior changes in minor releases. Our best judgment of the situation will always dictate such changes. Please always read our release notes before deciding to upgrade.

### TypeScript changes

We also reserve a similar right to adjust declared TypeScript definitions or drop support for older versions of TypeScript in a minor release. The TypeScript language itself evolves quickly and often introduces breaking changes in its minor releases. Our team is also continuously learning how to leverage TypeScript more effectively - and the types improve as a result.

For these reasons, it is impractical for our team to be bound by decisions taken when an older version of TypeScript was its latest version or when we didn’t know how to declare our types in a better way. We won’t introduce declaration changes often - but we are more likely to do so than with runtime changes.

### Packages

Most of the packages in the XState family declare a peer dependency on XState itself. We’ll be cautious about maintaining compatibility with already-released packages when releasing a new version of XState, **but** each release of packages depending on XState will always adjust the declared peer dependency range to include the latest version of XState. For example, you should always be able to update `xstate` without `@xstate/react`. But when you update `@xstate/react`, we highly recommend updating `xstate` too.
