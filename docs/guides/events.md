# Events

An event is what causes a state machine to [transition](./transitions.md) from its current [state](./states.md) to its next state. To learn more, read [the events section in our introduction to statecharts](./introduction-to-state-machines-and-statecharts/index.md#transitions-and-events).

## API

An event is an object with a `type` property, signifying what type of event it is:

```js
const timerEvent = {
  type: 'TIMER' // the convention is to use CONST_CASE for event names
};
```

In XState, events that only have a `type` can be represented by just their string type, as a shorthand:

```js
// equivalent to { type: 'TIMER' }
const timerEvent = 'TIMER';
```

Event objects can also have other properties, which represent data associated with the event:

```js
const keyDownEvent = {
  type: 'keydown',
  key: 'Enter'
};
```

## Sending events

As explained in the [transitions guide](./transitions.md), a transition defines what the next state will be, given the current state and the event, defined on its `on: { ... }` property. This can be observed by passing an event into the [transition method](./transitions.md#machine-transition-method):

```js
import { createMachine } from 'xstate';

const lightMachine = createMachine({
  /* ... */
});

const { initialState } = lightMachine;

let nextState = lightMachine.transition(initialState, 'TIMER'); // string event
console.log(nextState.value);
// => 'yellow'

nextState = lightMachine.transition(nextState, { type: 'TIMER' }); // event object
console.log(nextState.value);
// => 'red'
```

Many native events, such as DOM events, are compatible and can be used directly with XState, by specifying the event type on the `type` property:

```js
import { createMachine, interpret } from 'xstate';

const mouseMachine = createMachine({
  on: {
    mousemove: {
      actions: [
        (context, event) => {
          const { offsetX, offsetY } = event;
          console.log({ offsetX, offsetY });
        }
      ]
    }
  }
});
const mouseService = interpret(mouseMachine).start();

window.addEventListener('mousemove', (event) => {
  // event can be sent directly to service
  mouseService.send(event);
});
```

## Null events

::: warning
The null event syntax `({ on: { '': ... } })` will be deprecated in version 5. The new [always](./transitions.md#eventless-always-transitions) syntax should be used instead.
:::

A null event is an event that has no type, and occurs immediately once a state is entered. In transitions, it is represented by an empty string (`''`):

```js
// contrived example
const skipMachine = createMachine({
  id: 'skip',
  initial: 'one',
  states: {
    one: {
      on: { CLICK: 'two' }
    },
    two: {
      // null event '' always occurs once state is entered
      // immediately take the transition to 'three'
      on: { '': 'three' }
    },
    three: {
      type: 'final'
    }
  }
});

const { initialState } = skipMachine;
const nextState = skipMachine.transition(initialState, 'CLICK');

console.log(nextState.value);
// => 'three'
```

<iframe src="https://stately.ai/viz/embed?gist=f8b1c6470371b13eb2838b84194ca428"></iframe>

There are many use cases for null events, especially when defining [transient transitions](./transitions.md#transient-transitions), where a (potentially [transient](./statenodes.md#transient-state-nodes)) state immediately determines what the next state should be based on [conditions](./guards.md):

```js
const isAdult = ({ age }) => age >= 18;
const isMinor = ({ age }) => age < 18;

const ageMachine = createMachine({
  id: 'age',
  context: { age: undefined }, // age unknown
  initial: 'unknown',
  states: {
    unknown: {
      on: {
        // immediately take transition that satisfies conditional guard.
        // otherwise, no transition occurs
        '': [
          { target: 'adult', cond: isAdult },
          { target: 'child', cond: isMinor }
        ]
      }
    },
    adult: { type: 'final' },
    child: { type: 'final' }
  }
});

console.log(ageMachine.initialState.value);
// => 'unknown'

const personData = { age: 28 };

const personMachine = ageMachine.withContext(personData);

console.log(personMachine.initialState.value);
// => 'adult'
```

<iframe src="https://stately.ai/viz/embed?gist=2f9f2f4bd5dcd5ff262c7f2a7e9199aa"></iframe>
