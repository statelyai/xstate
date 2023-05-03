---
'xstate': major
---

Actions can now be implemented as an _action group_.

An _action group_ is a named array of actions. When the action group is executed, each action in the group is executed in order:

```js
import { createMachine, interpret, log } from 'xstate';

const machine = createMachine(
  {
    // reference the action group by name (`someGroup`)
    entry: 'someGroup'
  },
  {
    actions: {
      // executes `action1`, then `action2`
      someGroup: ['action1', 'action2'],
      action1: log('action1'),
      action2: log('action2')
    }
  }
);

interpret(machine).start(); // logs "action1", then "action2"
```

Action groups allow us to avoid error-prone repetition of actions, instead defining the group once and reusing it anywhere—like a single source of truth for the algorithm the group represents:

```diff
 const machine = createMachine(
   {
     context: { count: 0 },
     on: {
-      // increment count, then print it
-      incrementClick: { actions: ['incrementCount', 'printCount'] },
+       incrementClick: { actions: 'increment' },
-      // increment count, then print it
-      // oops! we accidentally put the actions in the wrong order
-      tick: { actions: ['printCount', 'incrementCount'] },
+      tick: { actions: 'increment' }
     }
   },
   {
     actions: {
+      // increment count, then print it. single source of truth for the `increment` algorithm
+      increment: ['incrementCount', 'printCount'],
       incrementCount: assign({
         count: ({ context }) => context.count + 1
       }),
       printCount: log(({ context }) => `Count: ${context.count}`)
     }
   }
 );
```

Action groups can reference other action groups by name. The referenced group's actions will be executed in order from the point of reference—like spreading the referenced group's actions in the group:

```js
const machine = createMachine(
  {
    entry: 'initialize'
  },
  {
    actions: {
      // executes `load` group actions, then `listen` group actions
      initialize: ['load', 'listen'],
      load: ['loadConfig', 'loadData'],
      listen: ['startApp', 'listenOnPort']
    }
  }
);

interpret(machine).start();
// actions: (load) loadConfig -> loadData -> (listen) startApp -> listenOnPort
```

With a mix of actions, action groups, and action group references, we can compose our algorithms in flexible and reusable ways:

```js
import { assign, createMachine, log } from 'xstate';

const machine = createMachine(
  {
    entry: 'initialize',
    exit: 'terminate',
    on: {
      timeout: { actions: 'reconnect' },
      reload: { actions: 'reload' }
    }
  },
  {
    actions: {
      initialize: ['load', 'connect'],
      terminate: ['disconnect', 'save', 'exitProgram'],
      reconnect: ['disconnect', 'connect'],
      reload: ['disconnect', 'save', 'initialize']
    }
  }
);
```
