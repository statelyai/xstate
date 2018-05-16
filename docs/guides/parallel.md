# Parallel Machines

A parallel machine represents multiple _orthogonal_ states; that is, a parallel machine can be in more than one (parallel) state at the same time. The key word here is **parallel** (or orthogonal) - the states are not directly dependent on each other, and no transitions exist between parallel states.

A parallel machine is specified on the machine and/or any nested compound state by setting `parallel: true` (don't forget to omit the `initial` property, too!).

For example, the machine below allows the `upload` and `download` compound states to be simultaneously active. Imagine that this represents an application where you can download and upload files at the same time:

```js
const parallelMachine = Machine({
  parallel: true,
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

console.log(parallelMachine.initialState.value);
// => {
//   upload: 'idle',
//   download: 'idle'
// }
```

A parallel machine's state value is represented as an object, since objects naturally represent orthogonality via separate keys and values. This object state value can be used to further transition to different states in a parallel machine:

```js
console.log(parallelMachine.transition({
  upload: 'pending',
  download: 'idle'
}, 'UPLOAD_COMPLETE').value);
// => {
//   upload: 'success',
//   download: 'idle'
// }
```

A compound state can be parallel. The configuration is the exact same for nested compound states:

```js
const lightMachine = Machine({
  // not a parallel machine
  initial: 'green',
  states: {
    green: {
      on: { TIMER: 'yellow' },
    },
    yellow: {
      on: { TIMER: 'red' },
    },
    
    // nested parallel machine
    red: {
      parallel: true,
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
            stop: {}
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
