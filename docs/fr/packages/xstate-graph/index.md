# @xstate/graph

The [@xstate/graph package](https://github.com/statelyai/xstate/tree/main/packages/xstate-graph) contains graph algorithms and utilities for XState machines.

## Quick Start

1. Install `xstate` and `@xstate/graph`:

```bash
npm install xstate @xstate/graph
```

2. Import the graph utilities. Example:

```js
import { createMachine } from 'xstate';
import { getSimplePaths } from '@xstate/graph';

const machine = createMachine(/* ... */);
const paths = getSimplePaths(machine);
```

## API

### `getShortestPaths(machine, options?)`

**Arguments**

- `machine` - the [`Machine`](https://xstate.js.org/docs/guides/machines.html) to traverse
- `options` (optional) - [options](#options) that customize how the algorithm will traverse the machine

Returns the [shortest paths (Dijkstra's algorithm)](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm) of a [machine](https://xstate.js.org/docs/guides/machines.html) from the initial state to every other state as a mapped object, where the:

- **key** is the stringified state
- **value** is an object with the properties:
  - `state` - the target [`State`](https://xstate.js.org/docs/guides/states.html)
  - `path` - the shortest path to get from the initial state to the target state

The `path` is an array of segments, where each segment is an object with the properties:

- `state` - the [`State`](https://xstate.js.org/docs/guides/states.html) of the segment
- `weight` - the total [weight](<https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)#Weighted_graph>) of the path
  - Currently, each transition from one state to another has a weight of 1. This will be customizable in the future.
- `event` - the event object that transitions the `machine` from the state to the next state in the path

Every path starts with the initial state.

The overall object structure looks like this:

```json5
{
  "<SERIALIZED STATE>": {
    "state": State { ... },
    "path": [
      {
        "state": State { ... },
        "event": { "type": "<event.type>", "<PROP>": "<event.PROP>" }
      },
      {
        "state": State { ... },
        "event": { "type": "<event.type>", "<PROP>": "<event.PROP>" }
      },
      ...
    ]
  },
  ...
}
```

**Example**

```js
import { createMachine } from 'xstate';
import { getShortestPaths } from '@xstate/graph';

const feedbackMachine = createMachine({
  id: 'feedback',
  initial: 'question',
  states: {
    question: {
      on: {
        CLICK_GOOD: 'thanks',
        CLICK_BAD: 'form',
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    form: {
      on: {
        SUBMIT: 'thanks',
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    thanks: {
      on: {
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    closed: {
      type: 'final'
    }
  }
});

const shortestPaths = getShortestPaths(feedbackMachine);

console.log(shortestPaths);
// => {
//   '"question"': {
//     state: State { value: 'question', context: undefined },
//     weight: 0,
//     path: []
//   },
//   '"thanks"': {
//     state: State { value: 'thanks', context: undefined },
//     weight: 1,
//     path: [
//       {
//         state: State { value: 'question', context: undefined },
//         event: { type: 'CLICK_GOOD' }
//       }
//     ]
//   },
//   '"form"': {
//     state: State { value: 'form', context: undefined },
//     weight: 1,
//     path: [
//       {
//         state: State { value: 'question', context: undefined },
//         event: { type: 'CLICK_BAD' }
//       }
//     ]
//   },
//   '"closed"': {
//     state: State { value: 'closed', context: undefined },
//     weight: 1,
//     path: [
//       {
//         state: State { value: 'question', context: undefined },
//         event: { type: 'CLOSE' }
//       }
//     ]
//   }
// };
```

### `getSimplePaths(machine, options?)`

**Arguments**

- `machine` - the [`Machine`](https://xstate.js.org/docs/guides/machines.html) to traverse
- `options` (optional) - [options](#options) that customize how the algorithm will traverse the machine

Returns the [simple paths](<https://en.wikipedia.org/wiki/Path_(graph_theory)#Definitions>) of a [machine](https://xstate.js.org/docs/guides/machines.html) as a mapped object, where the:

- **key** is the stringified state
- **value** is an object with the properties:
  - `state` - the target [`State`](https://xstate.js.org/docs/guides/states.html)
  - `paths` - the array of paths to get from the initial state to the target state

Each `path` in `paths` is an array of segments, where each segment of the path is an object with the properties:

- `state` - the [`State`](https://xstate.js.org/docs/guides/states.html) of the segment
- `event` - the event object that transitions the `machine` from the state to the next state in the path

Every path starts with the initial state.

The overall object structure looks like this:

```json5
{
  "<SERIALIZED STATE>": {
    "state": State { ... },
    "paths": [
      [
        {
          "state": State { ... },
          "event": { "type": "<event.type>", "<PROP>": "<event.PROP>" }
        },
        {
          "state": State { ... },
          "event": { "type": "<event.type>", "<PROP>": "<event.PROP>" }
        },
        ...
      ],
      ...
    ]
  },
  ...
}
```

**Example**

```js
import { createMachine } from 'xstate';
import { getSimplePaths } from '@xstate/graph';

const feedbackMachine = createMachine({
  id: 'feedback',
  initial: 'question',
  states: {
    question: {
      on: {
        CLICK_GOOD: 'thanks',
        CLICK_BAD: 'form',
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    form: {
      on: {
        SUBMIT: 'thanks',
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    thanks: {
      on: {
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    closed: {
      type: 'final'
    }
  }
});

const simplePaths = getSimplePaths(feedbackMachine);

console.log(simplePaths);
// => {
//   '"question"': {
//     state: { value: 'question', context: undefined },
//     paths: [[]]
//   },
//   '"thanks"': {
//     state: { value: 'thanks', context: undefined },
//     paths: [
//       [
//         {
//           state: { value: 'question', context: undefined },
//           event: { type: 'CLICK_GOOD' }
//         }
//       ],
//       [
//         {
//           state: { value: 'question', context: undefined },
//           event: { type: 'CLICK_BAD' }
//         },
//         {
//           state: { value: 'form', context: undefined },
//           event: { type: 'SUBMIT' }
//         }
//       ]
//     ]
//   },
//   '"closed"': {
//     state: { value: 'closed', context: undefined },
//     paths: [
//       [
//         {
//           state: { value: 'question', context: undefined },
//           event: { type: 'CLICK_GOOD' }
//         },
//         {
//           state: { value: 'thanks', context: undefined },
//           event: { type: 'CLOSE' }
//         }
//       ],
//       [
//         {
//           state: { value: 'question', context: undefined },
//           event: { type: 'CLICK_GOOD' }
//         },
//         {
//           state: { value: 'thanks', context: undefined },
//           event: { type: 'ESC' }
//         }
//       ],
//       ...
//     ]
//   },
//   ...
// };
```

### `getPathFromEvents(machine, events)`

**Arguments**

- `machine` - the [`Machine`](https://xstate.js.org/docs/guides/machines.html) to traverse
- `events` - the sequence of events to generate a path from

Returns a path object with the following keys:

- `state` - the target [`State`](https://xstate.js.org/docs/guides/states.html)
- `segments` - an array of objects with the following shape:
  - `state` - the [`State`](https://xstate.js.org/docs/guides/states.html) of the segment
  - `event` - the event object that transitions the `machine` from the state to the next state in the path

```js
import { createMachine } from 'xstate';
import { getSimplePaths } from '@xstate/graph';

const feedbackMachine = createMachine({
  id: 'feedback',
  initial: 'question',
  states: {
    question: {
      on: {
        CLICK_GOOD: 'thanks',
        CLICK_BAD: 'form',
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    form: {
      on: {
        SUBMIT: 'thanks',
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    thanks: {
      on: {
        CLOSE: 'closed',
        ESC: 'closed'
      }
    },
    closed: {
      type: 'final'
    }
  }
});

const path = getPathFromEvents(feedbackMachine, [
  { type: 'CLICK_GOOD' },
  { type: 'SUBMIT' },
  { type: 'CLOSE' }
]);

console.log(path);
// => {
//   state: { value: 'closed' },
//   segments: [
//     {
//       state: { value: 'question' },
//       event: { type: 'CLICK_GOOD' },
//     },
//     {
//       state: { value: 'form' },
//       event: { type: 'SUBMIT' },
//     },
//     {
//       state: { value: 'thanks' },
//       event: { type: 'CLOSE' },
//     },
//   ],
// }
```

### `toDirectedGraph(machine)`

Converts a `machine` to a directed graph structure.

| Argument  | Type                                           | Description                                          |
| --------- | ---------------------------------------------- | ---------------------------------------------------- |
| `machine` | XState Machine created by `createMachine(...)` | The machine to convert to a directed graph structure |

**Example**

```js
import { toDirectedGraph } from '@xstate/graph';

const machine = createMachine({/* ... */});

const digraph = toDirectedGraph(machine);

// returns an object with this structure:
{
  id: '...',
  stateNode: /* StateNode */,
  children: [
    { id: '...', children: [/* ... */], edges: [/* ... */] },
    { id: '...', /* ... */ },
    // ...
  ],
  edges: [
    { source: /* ... */, target: /* ... */, transition: /* ... */ }
    // ...
  ]
}
```

## Options

Options can be passed into `getShortestPaths` or `getSimplePaths` to customize how the graph represented by the machine should be traversed:

- `events` - a mapping of event types to an array of event objects to be used for those events
- `filter` - a function that determines whether a `state` should be traversed. If `false`, the traversal algorithm(s) will assume the state was "seen" and ignore traversing it.

**Examples**

In the below example, the `INC` event is expanded to include two possible events, with `value: 1` and `value: 2` as the payload. It also ensures that the `state.context.count <= 5`; otherwise, this machine would be traversed infinitely.

```js
const counterMachine = createMachine({
  id: 'counter',
  initial: 'active',
  context: { count: 0 },
  states: {
    active: {
      on: {
        INC: {
          actions: assign({ count: (ctx, e) => ctx.count + e.value })
        }
      }
    }
  }
});

const shortestPaths = getShortestPaths(counterMachine, {
  events: {
    INC: [
      { type: 'INC', value: 1 },
      { type: 'INC', value: 2 }
    ]
  },
  filter: (state) => state.context.count <= 5
});

console.log(shortestPaths);
// => {
//   '"active" | {"count":0}': {
//     state: { value: 'active', context: { count: 0 } },
//     weight: 0,
//     path: []
//   },
//   '"active" | {"count":1}': {
//     state: { value: 'active', context: { count: 1 } },
//     weight: 1,
//     path: [
//       {
//         state: { value: 'active', context: { count: 0 } },
//         event: { type: 'INC', value: 1 }
//       }
//     ]
//   },
//   '"active" | {"count":2}': {
//     state: { value: 'active', context: { count: 2 } },
//     weight: 1,
//     path: [
//       {
//         state: { value: 'active', context: { count: 0 } },
//         event: { type: 'INC', value: 2 }
//       }
//     ]
//   },
//   '"active" | {"count":3}': {
//     state: { value: 'active', context: { count: 3 } },
//     weight: 2,
//     path: [
//       {
//         state: { value: 'active', context: { count: 0 } },
//         event: { type: 'INC', value: 1 }
//       },
//       {
//         state: { value: 'active', context: { count: 1 } },
//         event: { type: 'INC', value: 2 }
//       }
//     ]
//   },
//   ...
// };
```
