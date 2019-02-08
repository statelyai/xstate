# Activities

An activity is an action that occurs over time, and can be started and stopped. According to Harel's original statecharts paper:

> An activity always takes a nonzero amount of time, like beeping, displaying, or executing lengthy computations.

For example, a toggle that "beeps" when active can be represented by a `'beeping'` activity:

```js
const toggleMachine = Machine(
  {
    id: 'toggle',
    initial: 'inactive',
    states: {
      inactive: {
        on: { TOGGLE: 'active' }
      },
      active: {
        // The 'beeping' activity will take place as long as
        // the machine is in the 'active' state
        activities: ['beeping'],
        on: { TOGGLE: 'inactive' }
      }
    }
  },
  {
    activities: {
      beeping: () => {
        // Start the beeping activity
        const interval = setInterval(() => console.log('BEEP!'), 1000);

        // Return a function that stops the beeping activity
        return () => clearInterval(interval);
      }
    }
  }
);
```

In XState, activities are specified on the `activities` property of a state node. When a state node is entered, an interpreter should **start** its activities, and when it is exited, it should **stop** its activities.

To determine which activities are currently active, the `State` has an `activities` property, which is a mapping of activity names to `true` if the activity is started (active), and `false` if it is stopped.

```js
const lightMachine = Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      initial: 'walk',
      // the 'activateCrosswalkLight' activity is started upon entering
      // the 'light.red' state, and stopped upon exiting it.
      activities: ['activateCrosswalkLight'],
      on: {
        TIMER: 'green'
      },
      states: {
        walk: { on: { PED_WAIT: 'wait' } },
        wait: {
          // the 'blinkCrosswalkLight' activity is started upon entering
          // the 'light.red.wait' state, and stopped upon exiting it
          // or its parent state.
          activities: ['blinkCrosswalkLight'],
          on: { PED_STOP: 'stop' }
        },
        stop: {}
      }
    }
  }
});
```

In the above machine configuration, the `'activateCrosswalkLight'` will start when the `'light.red'` state is entered. It will also execute a special `'xstate.start'` action, letting the [service](./interpretation.md) know that it should start the activity:

```js
const redState = lightMachine.transition('yellow', 'TIMER');

redState.activities;
// => {
//   activateCrosswalkLight: true
// }

redState.actions;
// The 'activateCrosswalkLight' activity is started
// => [
//   { type: 'xstate.start', activity: 'activateCrosswalkLight' }
// ]
```

Transitioning within the same parent state will _not_ restart its activities, although it might start new activities:

```js
const redWaitState = lightMachine.transition(redState, 'PED_WAIT');

redWaitState.activities;
// => {
//   activateCrosswalkLight: true,
//   blinkCrosswalkLight: true
// }

redWaitState.actions;
// The 'blinkCrosswalkLight' activity is started
// Note: the 'activateCrosswalkLight' activity is not restarted
// => [
//   { type: 'xstate.start', activity: 'blinkCrosswalkLight' }
// ]
```

Leaving a state will stop its activities:

```js
const redStopState = lightMachine.transition(redWaitState, 'PED_STOP');

redStopState.activities;
// The 'blinkCrosswalkLight' activity is stopped
// => {
//   activateCrosswalkLight: true,
//   blinkCrosswalkLight: false
// }

redStopState.actions;
// The 'blinkCrosswalkLight' activity is stopped
// => [
//   { type: 'xstate.stop', activity: 'blinkCrosswalkLight' }
// ]
```

And any stopped activities will be stopped only once:

```js
const greenState = lightMachine.transition(redStopState, 'TIMER');

green.activities;
// No active activities
// => {
//   activateCrosswalkLight: false,
//   blinkCrosswalkLight: false
// }

green.actions;
// The 'activateCrosswalkLight' activity is stopped
// Note: the 'blinkCrosswalkLight' activity is not stopped again
// => [
//   { type: 'xstate.stop', activity: 'activateCrosswalkLight' }
// ]
```

## Interpretation

(since 4.0) In the machine options, the "start" and "stop" behavior of the activity can be defined in the `activities` property. This is done by:

- Passing in a function that **starts** the activity (as a side-effect)
- From that function, returning another function that **stops** the activity (also as a side-effect).

For example, here's how a `'beeping'` activity that logs `'BEEP!'` to the console every `ctx.interval` would be implemented:

```js
function createBeepingActivity(ctx, activity) {
  // Start the beeping activity
  const interval = setInterval(() => {
    console.log('BEEP!');
  }, ctx.interval);

  // Return a function that stops the beeping activity
  return () => clearInterval(interval);
}
```

The activity creator is always given two arguments:

- the current `context`
- the defined `activity`
  - e.g., `{ type: 'beeping' }`

Then you would pass this into the machine options (second argument) under the `activities` property:

```js
const toggleMachine = Machine(
  {
    id: 'toggle',
    initial: 'inactive',
    context: {
      interval: 1000 // beep every second
    },
    states: {
      inactive: {
        on: { TOGGLE: 'active' }
      },
      active: {
        activities: ['beeping'],
        on: { TOGGLE: 'inactive' }
      }
    }
  },
  {
    activities: {
      beeping: createBeepingActivity
    }
  }
);
```

Using XState's [interpreter](./interpretation.md), every time an action occurs to start an activity, it will call that activity creator to start the activity, and use the returned "stopper" (if it is returned) to stop the activity:

```js
import { interpret } from 'xstate';

// ... (previous code)

const service = interpret(toggleMachine);

service.start();

// nothing logged yet

service.send('TOGGLE');

// => 'BEEP!'
// => 'BEEP!'
// => 'BEEP!'
// ...

service.send('TOGGLE');

// no more beeps!
```
