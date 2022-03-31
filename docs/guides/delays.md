# Delayed events and transitions

Delays and timeouts can be handled declaratively with statecharts. To learn more, see the section in our [introduction to statecharts](./introduction-to-state-machines-and-statecharts/index.md#delayed-transitions).

## Delayed events

If you just want to send an event after a delay, you can specify the `delay` as an option in the second argument of the `send(...)` action creator:

```js
import { actions } from 'xstate';
const { send } = actions;

// action to send the 'TIMER' event after 1 second
const sendTimerAfter1Second = send({ type: 'TIMER' }, { delay: 1000 });
```

You can also prevent those delayed events from being sent by canceling them. This is done with the `cancel(...)` action creator:

```js
import { actions } from 'xstate';
const { send, cancel } = actions;

// action to send the 'TIMER' event after 1 second
const sendTimerAfter1Second = send(
  { type: 'TIMER' },
  {
    delay: 1000,
    id: 'oneSecondTimer' // give the event a unique ID
  }
);

const cancelTimer = cancel('oneSecondTimer'); // pass the ID of event to cancel

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      entry: sendTimerAfter1Second,
      on: {
        TIMER: { target: 'active' },
        CANCEL: { actions: cancelTimer }
      }
    },
    active: {}
  }
});

// if the CANCEL event is sent before 1 second, the TIMER event will be canceled.
```

## Delay Expressions <Badge text="4.3+" />

The `delay` option can also be evaluated as a delay expression, which is a function that takes in the current `context` and `event` that triggered the `send()` action, and returns the resolved `delay` (in milliseconds):

```js
const dynamicDelayMachine = createMachine({
  id: 'dynamicDelay',
  context: {
    initialDelay: 1000
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        ACTIVATE: { target: 'pending' }
      }
    },
    pending: {
      entry: send(
        { type: 'FINISH' },
        {
          // delay determined from custom event.wait property
          delay: (context, event) => context.initialDelay + event.wait || 0
        }
      ),
      on: {
        FINISH: { target: 'finished' }
      }
    },
    finished: { type: 'final' }
  }
});

const dynamicDelayService = interpret(dynamicDelayMachine)
  .onDone(() => console.log('done!'))
  .start();

dynamicDelayService.send({
  type: 'ACTIVATE',
  // arbitrary property
  wait: 2000
});

// after 3000ms (1000 + 2000), console will log:
// => 'done!'
```

## Interpretation

With the XState [interpreter](./interpretation.md), delayed actions will use the native`setTimeout` and `clearTimeout` functions:

```js
import { interpret } from 'xstate';

const service = interpret(lightDelayMachine).onTransition((state) =>
  console.log(state.value)
);

service.start();
// => 'green'

// (after 1 second)

// => 'yellow'
```

For testing, the XState interpreter provides a `SimulatedClock`:

```js
import { interpret } from 'xstate';
// import { SimulatedClock } from 'xstate/lib/interpreter'; // < 4.6.0
import { SimulatedClock } from 'xstate/lib/SimulatedClock'; // >= 4.6.0

const service = interpret(lightDelayMachine, {
  clock: new SimulatedClock()
}).onTransition((state) => console.log(state.value));

service.start();
// => 'green'

// move the SimulatedClock forward by 1 second
service.clock.increment(1000);
// => 'yellow'
```

You can create your own “clock” to provide to the interpreter. The clock interface is an object with two functions/methods:

- `setTimeout` - same arguments as `window.setTimeout(fn, timeout)`
- `clearTimeout` - same arguments as `window.clearTimeout(id)`

## Behind the scenes

The `after: ...` property does not introduce anything new to statechart semantics. Instead, it creates normal transitions that look like this:

```js
// ...
states: {
  green: {
    entry: [
      send(after(1000, 'light.green'), { delay: 1000 }),
      send(after(2000, 'light.green'), { delay: 2000 })
    ],
    onExit: [
      cancel(after(1000, 'light.green')),
      cancel(after(2000, 'light.green'))
    ],
    on: {
      [after(1000, 'light.green')]: {
        target: 'yellow',
        cond: 'trafficIsLight'
      },
      [after(2000, 'light.green')]: {
        target: 'yellow'
      }
    }
  }
}
// ...
```

The interpreted statechart will `send(...)` the `after(...)` events after their `delay`, unless the state node is exited, which will `cancel(...)` those delayed `send(...)` events.
