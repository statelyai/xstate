# Parallel State Nodes

A parallel state node represents multiple _orthogonal_ child state nodes; that is, a parallel state is in _all_ of its child states at the same time. The key word here is **parallel** (or orthogonal) - the states are not directly dependent on each other, and no transitions should exist between parallel state nodes.

A parallel state node is specified on the machine and/or any nested compound state by setting `type: 'parallel'`.

For example, the machine below allows the `upload` and `download` compound states to be simultaneously active. Imagine that this represents an application where you can download and upload files at the same time:

```js
const fileMachine = Machine({
  id: 'file',
  type: 'parallel',
  states: {
    upload: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            INIT_UPLOAD: 'pending'
          }
        },
        pending: {
          on: {
            UPLOAD_COMPLETE: 'success'
          }
        },
        success: {}
      }
    },
    download: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            INIT_DOWNLOAD: 'pending'
          }
        },
        pending: {
          on: {
            DOWNLOAD_COMPLETE: 'success'
          }
        },
        success: {}
      }
    }
  }
});

console.log(fileMachine.initialState.value);
// => {
//   upload: 'idle',
//   download: 'idle'
// }
```

A parallel state node's state value is represented as an object, since objects naturally represent orthogonality via separate keys and values. This object state value can be used to further transition to different states in a parallel state node:

```js
console.log(
  fileMachine.transition(
    {
      upload: 'pending',
      download: 'idle'
    },
    'UPLOAD_COMPLETE'
  ).value
);
// => {
//   upload: 'success',
//   download: 'idle'
// }
```

A compound state node can contain parallel state nodes. The configuration is the same for nested state nodes:

```js
const lightMachine = Machine({
  // not a parallel machine
  id: 'light',
  initial: 'green',
  states: {
    green: {
      on: { TIMER: 'yellow' }
    },
    yellow: {
      on: { TIMER: 'red' }
    },

    // nested parallel machine
    red: {
      type: 'parallel',
      states: {
        walkSign: {
          initial: 'solid',
          states: {
            solid: {
              on: { COUNTDOWN: 'flashing' }
            },
            flashing: {
              on: { STOP_COUNTDOWN: 'solid' }
            }
          }
        },
        pedestrian: {
          initial: 'walk',
          states: {
            walk: {
              on: { COUNTDOWN: 'wait' }
            },
            wait: {
              on: { STOP_COUNTDOWN: 'stop' }
            },
            stop: {
              type: 'final'
            }
          }
        }
      }
    }
  }
});

console.log(lightMachine.transition('yellow', 'TIMER').value);
// {
//   red: {
//     walkSign: 'solid',
//     pedestrian: 'walk'
//   }
// }
```
