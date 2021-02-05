# Getting Started

Suppose we want to model a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) as a state machine. First, install XState using NPM or Yarn:

```bash
npm install xstate --save
```

Then, in your project, import `createMachine`, which is a factory function that creates a state machine or statechart:

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine(/* ... */);
```

We'll pass the [machine configuration](./machines.md#configuration) inside of `createMachine(...)`. Since this is a [hierarchical machine](./hierarchical.md), we need to provide the:

- `id` - to identify the machine and set the base string for its child state node IDs
- `initial` - to specify the initial state node this machine should be in
- `states` - to define each of the child states:

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {},
    resolved: {},
    rejected: {}
  }
});
```

Then, we need to add [transitions](./transitions.md) to the state nodes and mark the `resolved` and `rejected` state nodes as [final state nodes](./final.md) since the promise machine terminates running once it reaches those states:

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        RESOLVE: 'resolved',
        REJECT: 'rejected'
      }
    },
    resolved: {
      type: 'final'
    },
    rejected: {
      type: 'final'
    }
  }
});
```

To [interpret](./interpretation.md) the machine and make it run, we need to add an interpreter. This creates a service:

```js
import { createMachine, interpret } from 'xstate';

const promiseMachine = createMachine({
  /* ... */
});

const promiseService = interpret(promiseMachine).onTransition(state =>
  console.log(state.value)
);

// Start the service
promiseService.start();
// => 'pending'

promiseService.send('RESOLVE');
// => 'resolved'
```

You can also visualize the code by changing `createMachine` to `Machine` and copy-pasting it into [the XState Viz](https://xstate.js.org/viz):

::: tip Why do I have to change `createMachine` to `Machine`? The Xstate Viz uses an older version of Xstate. We're going to update it soon; for now just know that `createMachine` is the way to go, but you'll have to swap it out for `Machine` to use some of the tooling.
:::

<iframe src="https://xstate.js.org/viz/?gist=9e4476d6312ac1bb29938d6c5e7f8f84&embed=1"></iframe>
