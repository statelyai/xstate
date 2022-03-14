# @xstate/server

<p align="center">
  <a href="https://xstate.js.org">
  <br />
  <img src="./xstate_server.png" alt="XState FSM" width="200"/>
  <br />
    <sub><strong>XState for Server/Functions</strong></sub>
  <br />
  <br />
  </a>
</p>

This package contains a minimal, 1kb implementation of [XState](https://github.com/statelyai/xstate) for **services** and **js** **promises**.

<!-- - [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-fsm/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md). -->
<br/>
<br/>

## Features

|                               | **@xstate/fsm** | [XState](https://github.com/statelyai/xstate) |
| ----------------------------- | :-------------: | :-------------------------------------------: |
| Finite states                 |       ✅        |                      ✅                       |
| Initial state                 |       ✅        |                      ✅                       |
| Transitions (object)          |       ❌        |                      ✅                       |
| Transitions (string target)   |       ✅        |                      ✅                       |
| Delayed transitions           |       ❌        |                      ✅                       |
| Eventless transitions         |       ✅        |                      ✅                       |
| Nested states                 |       ❌        |                      ✅                       |
| Parallel states               |       ❌        |                      ✅                       |
| History states                |       ❌        |                      ✅                       |
| Final states                  |       ❌        |                      ✅                       |
| Context                       |       ✅        |                      ✅                       |
| Entry actions                 |       ❌        |                      ✅                       |
| Exit actions                  |       ❌        |                      ✅                       |
| Transition actions            |       ✅        |                      ✅                       |
| Parameterized actions         |       ❌        |                      ✅                       |
| Transition guards             |       ✅        |                      ✅                       |
| Parameterized guards          |       ❌        |                      ✅                       |
| Spawned actors                |       ❌        |                      ✅                       |
| Invoked actors(promises only) |       ✅        |                      ✅                       |

<br/>
<br/>
If you want to use statechart features such as nested states, parallel states, history states, activities, invoked services, delayed transitions, transient transitions, etc. please use [`XState`](https://github.com/statelyai/xstate).
<br/>
<br/>
<br/>

## Quick start

<br/>
<br/>

### Installation

<br/>

```bash
npm i @xstate/server
yarn add @xstate/server
pnpm add @xstate/server
```

### Usage (machine)

<br/>

```ts
import { createMachine, serve } from '@xstate/server';

const machine = createMachine(
  {
    tsTypes: {
      args: {} as number,
      context: {} as { val: string }
    },
    context: { val: '' },
    initial: 'idle',
    states: {
      idle: {
        type: 'sync',
        transitions: [
          {
            target: 'prom'
          }
        ]
      },
      prom: {
        type: 'async',
        promise: 'prom',
        onDone: [
          {
            target: 'finish',
            actions: ['ok']
          }
        ],
        onError: [],
        timeout: '0'
      },
      finish: { type: 'final' }
    }
  },
  {
    promises: {
      prom: async () => true
    },
    actions: {
      ok: (ctx) => {
        ctx.val = 'true';
      }
    }
  }
);

// => 'inactive'
```

<br/>
<br/>

### Usage (serve)

<br/>

```ts
import { createMachine, interpret } from '@xstate/fsm';

const toggleMachine = createMachine({...});

//Serve infer the return type (the context is the return type of the function)
//Also it infers the fact that serve will be an async function or not
//Here before the states contain an async one,
//"service" will be an async function.
const service = serve(machine); // (args: number)=>Promise<{ val: string }>
(()=>await service(2))() // expected = { val: 'true' }
```
