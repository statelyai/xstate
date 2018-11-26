# Delayed events and transitions

Transitions can automatically take place after a delay. This is represented in a state definition in the `after` property, which maps millisecond delays to their transitions:

```js
const lightDelayMachine = Machine({
  id: 'lightDelay',
  initial: 'green',
  states: {
    green: {
      after: {
        // after 1 second, transition to yellow
        1000: 'yellow'
      }
    },
    yellow: {
      after: {
        // after 0.5 seconds, transition to red
        500: 'red'
      }
    },
    red: {
      after: {
        // after 2 seconds, transition to green
        2000: 'green'
      }
    }
  }
});
```

You can specify delayed transitions in the same way that you specify them on the `on: ...` property. They can be explicit:

```js
// ...
states: {
  green: {
    after: {
      1000: { target: 'yellow' }
    }
  }
}
// ...
```

They can be also be conditional for a single delay:

```js
// ...
states: {
  green: {
    after: {
      1000: [
        { target: 'yellow', cond: 'trafficIsLight' },
        { target: 'green' } // reenter 'green' state
      ]
    }
  }
}
// ...
```

Or they can be conditional for multiple delays. The first selected delayed transition will be taken, which will prevent later transitions from being taken. In this example, if the `'trafficIsLight'` condition is `true`, then the later `2000: 'yellow'` transition will not be taken:

```js
// ...
states: {
  green: {
    after: {
      1000: { target: 'yellow', cond: 'trafficIsLight' },
      2000: 'yellow' // always transition to 'yellow' after 2 seconds
    }
  }
}
// ...
```

Conditional delayed transitions can also be specified as an array:

```js
// ...
states: {
  green: {
    after: [
      { delay: 1000, target: 'yellow', cond: 'trafficIsLight' },
      { delay: 2000, target: 'yellow' }
    ];
  }
}
// ...
```

## Delayed events

If you just want to send an event after a delay, you can specify the `delay` as an option in the second argument of the `send(...)` action creator:

```js
import { actions } from 'xstate';
const { send } = actions;

// action to send the 'TIMER' event after 1 second
const sendTimerAfter1Second = send('TIMER', { delay: 1000 });
```

You can also prevent those delayed events from being sent by cancelling them. This is done with the `cancel(...)` action creator:

```js
import { actions } from 'xstate';
const { send, cancel } = actions;

// action to send the 'TIMER' event after 1 second
const sendTimerAfter1Second = send('TIMER', {
  delay: 1000,
  id: 'oneSecondTimer' // give the event a unique ID
});

const cancelTimer = cancel('oneSecondTimer'); // pass the ID of event to cancel

const toggleMachine = Machine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      onEntry: sendTimerAfter1Second,
      on: {
        TIMER: 'active'
        CANCEL: { actions: cancelTimer }
      }
    },
    active: {}
  }
});

// if the CANCEL event is sent before 1 second, the TIMER event will be canceled.
```

## Interpretation

With the XState [interpreter](./interpretation.md), delayed actions will use the native`setTimeout` and `clearTimeout` functions:

```js
import { interpret } from 'xstate/lib/interpreter';

const service = interpret(lightDelayMachine).onTransition(state =>
  console.log(state.value)
);

service.start();
// => 'green'

// (after 1 second)

// => 'yellow'
```

For testing, the XState interpreter provides a `SimulatedClock`:

```js
import { interpret, SimulatedClock } from 'xstate/lib/interpreter';

const service = interpret(lightDelayMachine, {
  clock: new SimulatedClock()
}).onTransition(state => console.log(state.value));

service.start();
// => 'green'

// move the SimulatedClock forward by 1 second
service.clock.increment(1000);
// => 'yellow'
```

You can create your own "clock" to provide to the interpreter. The clock interface is an object with two functions/methods:

- `setTimeout` - same arguments as `window.setTimeout(fn, timeout)`
- `clearTimeout` - same arguments as `window.clearTimeout(id)`

## Behind the scenes

The `after: ...` property does not introduce anything new to statechart semantics. Instead, it creates normal transitions that look like this:

```js
// ...
states: {
  green: {
    onEntry: [
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
        cond: 'traffcIsLight'
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

## Notes
