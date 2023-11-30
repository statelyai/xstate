<p align="center">
  <a href="https://stately.ai/docs">
  <br />

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/statelyai/public-assets/main/logos/xstate-logo-white-nobg.svg">
    <img alt="XState logotype" src="https://raw.githubusercontent.com/statelyai/public-assets/main/logos/xstate-logo-black-nobg.svg" width="200">
  </picture>
  <br />
    <sub><strong>Actor-based state management & orchestration</strong></sub>
  <br />
  <br />
  </a>
</p>

[![npm version](https://badge.fury.io/js/xstate.svg)](https://badge.fury.io/js/xstate)
<img src="https://opencollective.com/xstate/tiers/backer/badge.svg?label=sponsors&color=brightgreen" />

XState is a state management and orchestration solution for JavaScript and TypeScript apps. It has _zero_ dependencies, and is useful for frontend and backend application logic.

It uses event-driven programming, state machines, statecharts, and the actor model to handle complex logic in predictable, robust, and visual ways. XState provides a powerful and flexible way to manage application and workflow state by allowing developers to model logic as actors and state machines.

### ✨ Create state machines visually → [state.new](https://state.new)

> [!NOTE]
> ℹ️ This is the branch for **XState v5 beta** and related packages. View the XState v4 branch [here](https://github.com/statelyai/xstate/tree/main).

---

📖 [Read the documentation](https://stately.ai/docs)

➡️ [Create state machines with the Stately Editor](https://stately.ai/editor)

🖥 [Download our VS Code extension](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode)

📑 Inspired by the [SCXML specification](https://www.w3.org/TR/scxml/)

💬 Chat on the [Stately Discord Community](https://discord.gg/xstate)

## Packages

| Package                                                                                       | Description                                                                  |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 🤖 `xstate`                                                                                   | Core finite state machine and statecharts library + interpreter              |
| [📉 `@xstate/graph`](https://github.com/statelyai/xstate/tree/next/packages/xstate-graph)     | Graph traversal utilities for XState                                         |
| [⚛️ `@xstate/react`](https://github.com/statelyai/xstate/tree/next/packages/xstate-react)     | React hooks and utilities for using XState in React applications             |
| [💚 `@xstate/vue`](https://github.com/statelyai/xstate/tree/next/packages/xstate-vue)         | Vue composition functions and utilities for using XState in Vue applications |
| [🎷 `@xstate/svelte`](https://github.com/statelyai/xstate/tree/next/packages/xstate-svelte)   | Svelte utilities for using XState in Svelte applications                     |
| [🥏 `@xstate/solid`](https://github.com/statelyai/xstate/tree/next/packages/xstate-solid)     | Solid hooks and utilities for using XState in Solid applications             |
| [✅ `@xstate/test`](https://github.com/statelyai/xstate/tree/next/packages/xstate-test)       | Model-Based-Testing utilities (using XState) for testing any software        |
| [🔍 `@xstate/inspect`](https://github.com/statelyai/xstate/tree/next/packages/xstate-inspect) | Inspection utilities for XState                                              |

## Templates

Get started by forking one of these templates on CodeSandbox:

- [XState Template](https://codesandbox.io/p/devbox/github/statelyai/xstate/tree/next/templates/vanilla-ts) - TypeScript, no framework
- [XState + React Template](https://codesandbox.io/p/devbox/github/statelyai/xstate/tree/next/templates/react-ts) - TypeScript

## Super quick start

```bash
npm install xstate
```

```js
import { createMachine, createActor, assign } from 'xstate';

// State machine
const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  context: {
    count: 0
  },
  states: {
    inactive: {
      on: {
        TOGGLE: { target: 'active' }
      }
    },
    active: {
      entry: assign({ count: ({ context }) => context.count + 1 }),
      on: {
        TOGGLE: { target: 'inactive' }
      }
    }
  }
});

// Actor (instance of the machine logic, like a store)
const toggleActor = createActor(toggleMachine);
toggleActor.subscribe((state) => console.log(state.value, state.context));
toggleActor.start();
// => logs 'inactive', { count: 0 }

toggleActor.send({ type: 'TOGGLE' });
// => logs 'active', { count: 1 }

toggleActor.send({ type: 'TOGGLE' });
// => logs 'inactive', { count: 1 }
```

## Stately Studio

**[Visualize, simulate, inspect, and share your statecharts in XState Viz](https://stately.ai/viz)**

<a href="https://stately.ai/viz" title="XState Viz">
  <img src="https://user-images.githubusercontent.com/1093738/131729181-5db835fc-77e7-4740-b03f-46bd0093baa1.png" alt="XState Viz" width="400" />
</a>

**[state.new](https://state.new)**

## Why?

Statecharts are a formalism for modeling stateful, reactive systems. This is useful for declaratively describing the _behavior_ of your application, from the individual components to the overall application logic.

Read [📽 the slides](http://slides.com/davidkhourshid/finite-state-machines) ([🎥 video](https://www.youtube.com/watch?v=VU1NKX6Qkxc)) or check out these resources for learning about the importance of finite state machines and statecharts in user interfaces:

- [Statecharts - A Visual Formalism for Complex Systems](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) by David Harel
- [The World of Statecharts](https://statecharts.github.io/) by Erik Mogensen
- [Pure UI](https://rauchg.com/2015/pure-ui) by Guillermo Rauch
- [Pure UI Control](https://medium.com/@asolove/pure-ui-control-ac8d1be97a8d) by Adam Solove
- [Spectrum - Statecharts Community](https://spectrum.chat/statecharts) (For XState specific questions, please use the [GitHub Discussions](https://github.com/statelyai/xstate/discussions))

## Finite State Machines

<table>
<thead><tr><th>Code</th><th>Statechart</th></tr></thead>
<tbody>
<tr>
<td>

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

const nextState = lightMachine.transition(currentState, {
  type: 'TIMER'
}).value;

// => 'yellow'
```

<table>
<thead><tr><th>Code</th><th>Statechart</th></tr></thead>
<tbody>
<tr>
<td>

</td>
<td>

</td>
</tr>
</tbody>
</table>

</td>
<td>

<a href="https://stately.ai/viz/2ac5915f-789a-493f-86d3-a8ec079773f4" title="Finite states">
  <img src="https://github.com/statelyai/xstate/assets/1093738/36d4b6b5-e3d0-4c19-9f41-2e3425ceac88" alt="Finite states" width="400" />
  <br />
  <small>Open in Stately Viz</small>
</a>
<br />

</td>
</tbody>
</table>

## Hierarchical (Nested) State Machines

<table>
<thead><tr><th>Code</th><th>Statechart</th></tr></thead>
<tbody>
<tr>
<td>

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

const nextState = lightMachine.transition(currentState, {
  type: 'TIMER'
}).value;
// => {
//   red: 'walk'
// }

lightMachine.transition('red.walk', { type: 'PED_TIMER' }).value;
// => {
//   red: 'wait'
// }
```

</td>
<td>
<a href="https://stately.ai/viz/d3aeda4f-7f8e-44df-bdf9-dd3cdafb3312" title="Hierarchical states">
  <img src="https://github.com/statelyai/xstate/assets/1093738/32b0692b-1c29-4469-b5e3-03146e3ef249" alt="Hierarchical states" width="400" />
  <br />
  <small>Open in Stately Viz</small>
</a>
<br />
</td>
</tr>
</tbody>
</table>

## Parallel State Machines

<table>
<thead><tr><th>Code</th><th>Statechart</th></tr></thead>
<tbody>
<tr>
<td>

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

const boldState = wordMachine.transition('bold.off', {
  type: 'TOGGLE_BOLD'
}).value;

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
  { type: 'TOGGLE_ITALICS' }
).value;

// {
//   bold: 'off',
//   italics: 'on',
//   underline: 'on',
//   list: 'bullets'
// }
```

</td>
<td>
<a href="https://stately.ai/viz/9eb9c189-254d-4c87-827a-fab0c2f71508" title="Parallel states">
  <img src="https://github.com/statelyai/xstate/assets/1093738/3b1989c0-f4a9-4653-baf2-4df3a40e91a6" alt="Parallel states" width="400" />
  <br />
  <small>Open in Stately Viz</small>
</a>
</td>
</tr>
</tbody>
</table>

## History States

<table>
<thead><tr><th>Code</th><th>Statechart</th></tr></thead>
<tbody>
<tr>
<td>

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

const checkState = paymentMachine.transition('method.cash', {
  type: 'SWITCH_CHECK'
});

// => State {
//   value: { method: 'check' },
//   history: State { ... }
// }

const reviewState = paymentMachine.transition(checkState, { type: 'NEXT' });

// => State {
//   value: 'review',
//   history: State { ... }
// }

const previousState = paymentMachine.transition(reviewState, {
  type: 'PREVIOUS'
}).value;

// => { method: 'check' }
```

</td>
<td>
<a href="https://stately.ai/viz/33fd92e1-f9e6-49e6-bdeb-cef9e60195ec" title="History states">
  <img src="https://github.com/statelyai/xstate/assets/1093738/1be5c495-d560-4660-94f2-5341efbf7128" alt="History state" width="400" />
  <br />
  <small>Open in Stately Viz</small>
</a>
</td>
</tr>
</tbody>
</table>

## Sponsors

Special thanks to the sponsors who support this open-source project:

<a href="https://transloadit.com/?utm_source=xstate&utm_medium=referral&utm_campaign=sponsorship&utm_content=github">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://assets.transloadit.com/assets/images/sponsorships/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://assets.transloadit.com/assets/images/sponsorships/logo-default.svg">
    <img src="https://assets.transloadit.com/assets/images/sponsorships/logo-default.svg" alt="Transloadit Logo">
  </picture>
</a>

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
