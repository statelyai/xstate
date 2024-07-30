---
'xstate': minor
---

The state value typings for setup state machine actors (`setup({}).createMachine({ ... })`) have been improved to represent the actual expected state values.

```ts
const machine = setup({}).createMachine({
  initial: 'green',
  states: {
    green: {},
    yellow: {},
    red: {
      initial: 'walk',
      states: {
        walk: {},
        wait: {},
        stop: {}
      }
    },
    emergency: {
      type: 'parallel',
      states: {
        main: {
          initial: 'blinking',
          states: {
            blinking: {}
          }
        },
        cross: {
          initial: 'blinking',
          states: {
            blinking: {}
          }
        }
      }
    }
  }
});

const actor = createActor(machine).start();

const stateValue = actor.getSnapshot().value;

if (stateValue === 'green') {
  // ...
} else if (stateValue === 'yellow') {
  // ...
} else if ('red' in stateValue) {
  stateValue;
  // {
  //   red: "walk" | "wait" | "stop";
  // }
} else {
  stateValue;
  // {
  //   emergency: {
  //     main: "blinking";
  //     cross: "blinking";
  //   };
  // }
}
```
