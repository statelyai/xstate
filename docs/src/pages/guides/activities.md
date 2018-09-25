# Activities

An activity is an action that occurs over time, and can be started and stopped. According to Harel's original statecharts paper:

> An activity always takes a nonzero amount of time, like beeping, displaying, or executing lengthy computations.

In `xstate`, activities are specified on the `activities` property of a state node. When a state node is entered, an interpreter should **start** its activities, and when it is exited, it should **stop** its activities.

To determine which activities are currently active, the `State` instance returned from a `machine.transition(...)` call has an `activities` property, which is a mapping of activity names to `true` if the activity is started (active), and `false` if it is stopped.


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

In the above machine configuration, the `'activateCrosswalkLight'` will start when the `'light.red'` state is entered. It will also execute a special `'xstate.start'` action, letting the interpreter know that it should start the activity:

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
const greenState = lightMachine.transition(redStopState, 'PED_STOP');

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
