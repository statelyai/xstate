# Periodic events and transitions

Intervals can be handled declaratively with statecharts. To learn more, see the section in our [introduction to statecharts](./introduction-to-state-machines-and-statecharts/index.md#delayed-transitions).

## Periodic transitions

Events or transitions can be taken automatically every period of time. This is represented in a state definition in the `every` property, which maps millisecond periods to their transitions:

```js
const lightPeriodsMachine = createMachine({
  id: 'lightPeriod',
  initial: 'green',
  context: {
    timeSpentInGreen: 0,
    timeSpentInYellow: 0
  },
  states: {
    green: {
      every: {
        // every 1 second, timeSpentInGreen will be increased by 1 second
        1000: {
          actions: assign({
            timeSpentInGreen: (context) => context.timeSpentInGreen + 1
          })
        }
      },
      on: {
        GO_TO_YELLOW: 'yellow'
      }
    },
    yellow: {
      every: {
        // every 0.5 seconds, timeSpentInYellow will be increased by 0.5 seconds
        500: {
          actions: assign({
            timeSpentInYellow: (context) => context.timeSpentInYellow + 0.5
          })
        }
      }
    }
  }
});
```

Periodic events and transitions can be specified in the same way that you specify them on the `on: ...` property. They can be explicit:

```js
// ...
states: {
  green: {
    every: {
      1000: { actions: doSomeAction }
    }
  }
}
// ...
```

Periodic events can also be conditional with regard to a single interval value:

```js
// ...
states: {
  green: {
    every: {
      1000: [
        { actions: doSomething, cond: 'trafficIsLight' },
        { actions: doAnotherThing },
      ]
    }
  }
}
// ...
```

### Periodic expressions on transitions <Badge text="4.4+" />

Periodic events specified on the `every: { ... }` property can have dynamic priods, specified either by a string interval reference:

```js
const lightDelayMachine = createMachine(
  {
    id: 'lightDelay',
    initial: 'green',
    context: {
      trafficLevel: 'low'
    },
    states: {
      green: {
        every: {
          // after 1 second, transition to yellow
          LIGHT_DELAY: { actions: doSomething }
        }
      },
      yellow: {
        after: {
          YELLOW_LIGHT_DELAY: { actions: doTheYellowThing }
        }
      }
      // ...
    }
  },
  {
    // String delays configured here
    intervals: {
      LIGHT_DELAY: (context, event) => {
        return context.trafficLevel === 'low' ? 1000 : 3000;
      },
      YELLOW_LIGHT_DELAY: 500 // static value
    }
  }
);
```

Or directly by a function, just like conditional periodic events:

```js
// ...
green: {
  every: [
    {
      priod: (context, event) => {
        return context.trafficLevel === 'low' ? 1000 : 3000;
      },
      target: 'yellow'
    }
  ]
},
// ...
```

However, prefer using string interval references, just like the first example, or in the `interval` property:

```js
// ...
green: {
  after: [
    {
      interval: 'LIGHT_DELAY',
      actions: doSomeAction
    }
  ]
},
// ...
```

## Periodic events

If you just want to send an event every period of time, you can specify the `interval` as an option in the second argument of the `send(...)` action creator:

```js
import { actions } from 'xstate';
const { send } = actions;

// action to send the 'TIMER' event every 1 second
const sendTimerEvery1Second = send({ type: 'TIMER' }, { interval: 1000 });
```

You can also prevent those delayed events from being sent by canceling them. This is done with the `cancel(...)` action creator:

```js
import { actions } from 'xstate';
const { send, cancel } = actions;

// action to send the 'TIMER' event every 1 second
const sendTimerAfter1Second = send(
  { type: 'TIMER' },
  {
    interval: 1000,
    id: 'oneSecondInterval' // give the event a unique ID
  }
);

const cancelTimer = cancel('oneSecondInterval'); // pass the ID of event to cancel

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

// when the CANCEL event is sent, the TIMER event will be canceled.
```

## Interpretation

With the XState [interpreter](./interpretation.md), periodic actions will use the native`setInterval` and `clearInterval` functions.

## Behind the scenes

The `every: ...` property does not introduce anything new to statechart semantics. Instead, it creates normal transitions that look like this:

```js
// ...
states: {
  green: {
    entry: [
      send(every(1000, 'light.green'), { interval: 1000 }),
      send(every(2000, 'light.green'), { interval: 2000 })
    ],
    onExit: [
      cancel(every(1000, 'light.green')),
      cancel(every(2000, 'light.green'))
    ],
    on: {
      [every(1000, 'light.green')]: {
        target: 'yellow',
        cond: 'trafficIsLight'
      },
      [every(2000, 'light.green')]: {
        target: 'yellow'
      }
    }
  }
}
// ...
```

The interpreted statechart will `send(...)` the `every(...)` events recurrently every `interval`, unless the state node is exited, which will `cancel(...)` those periodic `send(...)` events.
