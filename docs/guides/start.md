# Getting Started

## Our first machine

Suppose we want to model a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) as a state machine. First, install XState using NPM or Yarn:

```bash
npm install xstate --save
```

> If you're using VSCode, you should install our [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode) to allow you to visualize the machine you're building as you go.

Then, in your project, import `createMachine`, which is a function that creates a state machine.

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine(/* ... */);
```

We'll pass the [machine configuration](./machines.md#configuration) to `createMachine`. We'll need to provide the:

- `id` - to identify the machine
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

Then, we need to add [transitions](./transitions.md) to the state nodes.

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        RESOLVE: { target: 'resolved' },
        REJECT: { target: 'rejected' }
      }
    },
    resolved: {},
    rejected: {}
  }
});
```

We'll also need to mark the `resolved` and `rejected` state nodes as [final state nodes](./final.md) since the promise machine terminates running once it reaches those states:

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        RESOLVE: { target: 'resolved' },
        REJECT: { target: 'rejected' }
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

Our machine is now ready to be visualized. You can copy/paste the code above and [visualize it on Stately Viz](https://stately.ai/viz). Here's how it'll look:

<iframe src="https://stately.ai/viz/embed/68548871-eecb-479b-b92a-b261e7d89671?mode=viz&panel=code&readOnly=1&showOriginalLink=1&controls=0&pan=0&zoom=0"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

## Running our machine

How we run our machine depends on where we're planning to use it.

### In Node/Vanilla JS

To [interpret](./interpretation.md) the machine and make it run, we need to add an interpreter. This creates a service:

```js
import { createMachine, interpret } from 'xstate';

const promiseMachine = createMachine({
  /* ... */
});

const promiseService = interpret(promiseMachine).onTransition((state) =>
  console.log(state.value)
);

// Start the service
promiseService.start();
// => 'pending'

promiseService.send({ type: 'RESOLVE' });
// => 'resolved'
```

### In React

If we wanted to use our machine inside a React component, we could use the [useMachine](../packages/xstate-react/index.md#api) hook:

> You'll need to install `@xstate/react`

```tsx
import { useMachine } from '@xstate/react';

const Component = () => {
  const [state, send] = useMachine(promiseMachine);

  return (
    <div>
      {/** You can listen to what state the service is in */}
      {state.matches('pending') && <p>Loading...</p>}
      {state.matches('rejected') && <p>Promise Rejected</p>}
      {state.matches('resolved') && <p>Promise Resolved</p>}
      <div>
        {/** You can send events to the running service */}
        <button onClick={() => send('RESOLVE')}>Resolve</button>
        <button onClick={() => send('REJECT')}>Reject</button>
      </div>
    </div>
  );
};
```
