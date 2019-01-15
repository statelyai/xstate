# Events

An event is what causes a state machine to [transition](./transitions.md) from its current [state](./states.md) to its next state. All state transitions in a state machine are due to these events; state cannot change unless some stimulus (the event) causes it to change.

An event is an object with a `type` property, signifying what type of event it is:

```js
const timerEvent = {
  type: 'TIMER'
};
```

As shorthand, in XState, events that only have a `type` can be represented just by their string type:

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

## Sending Events

As explained in the [transitions guide](./transitions.md), a transition defines what the next state will be given the current state and the event, defined on its `on: { ... }` property. This can be observed by passing an event into the [transition method](./transitions.md#machine-transition-method):

```js
import { Machine } from 'xstate';

const lightMachine = Machine({
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

By specifying the event type on the `type` property, many native events, such as DOM events, are compatible and can be used directly with XState:

```js
import { Machine, interpret } from 'xstate';

const mouseMachine = Machine({
  /* ... */
});
const mouseService = interpret(mouseMachine).start();

window.addEventListener('mousemove', event => {
  // event can be sent directly to service
  mouseService.send(event);
});
```

## Null Events

A null event is an event that has no type, and occurs immediately once a state is entered. In transitions, it is represented by an empty string (`''`):

```js
// contrived example
const skipMachine = Machine({
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

There are many use cases for null events, especially when defining [transient transitions](./transitions.md#transient-transitions), where a (potentially [transient](./statenodes.md#transient-state-nodes)) state immediately determines what the next state should be based on [conditions](./guards.md):

```js
const ageMachine = Machine({
  id: 'age',
  context: { age: undefined }, // age unknown
  initial: 'unknown',
  states: {
    unknown: {
      on: {
        // immediately take transition that satisfies conditional guard.
        // otherwise, no transition occurs
        '': [
          { target: 'adult', cond: ctx => ctx && ctx.age >= 18 },
          { target: 'child', cond: ctx => ctx && ctx.age < 18 }
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
