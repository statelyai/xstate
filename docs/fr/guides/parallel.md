# Parallel State Nodes

In statecharts, you can declare a state as a **parallel state**. This means that all its child states will run _at the same time_. To learn more, see the section in our [introduction to statecharts](./introduction-to-state-machines-and-statecharts/index.md#parallel-states).

## API

A parallel state node is specified on the machine and/or any nested compound state by setting `type: 'parallel'`.

For example, the machine below allows the `upload` and `download` compound states to be simultaneously active. Imagine that this represents an application where you can download and upload files at the same time:

```js {3,5,21}
const fileMachine = createMachine({
  id: 'file',
  type: 'parallel',
  states: {
    upload: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            INIT_UPLOAD: { target: 'pending' }
          }
        },
        pending: {
          on: {
            UPLOAD_COMPLETE: { target: 'success' }
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
            INIT_DOWNLOAD: { target: 'pending' }
          }
        },
        pending: {
          on: {
            DOWNLOAD_COMPLETE: { target: 'success' }
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

<iframe src="https://stately.ai/viz/embed/?gist=ef808b0400ececa786ec17e20d62c1e0"></iframe>

A parallel state node's state value is represented as an object. This object state value can be used to further transition to different states in a parallel state node:

```js
console.log(
  fileMachine.transition(
    {
      upload: 'pending',
      download: 'idle'
    },
    { type: 'UPLOAD_COMPLETE' }
  ).value
);
// => {
//   upload: 'success',
//   download: 'idle'
// }
```

A compound state node can contain parallel state nodes. The configuration is the same for nested state nodes:

```js
const lightMachine = createMachine({
  // not a parallel machine
  id: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: { target: 'yellow' }
      }
    },
    yellow: {
      on: {
        TIMER: { target: 'red' }
      }
    },

    // nested parallel machine
    red: {
      type: 'parallel',
      states: {
        walkSign: {
          initial: 'solid',
          states: {
            solid: {
              on: {
                COUNTDOWN: { target: 'flashing' }
              }
            },
            flashing: {
              on: {
                STOP_COUNTDOWN: { target: 'solid' }
              }
            }
          }
        },
        pedestrian: {
          initial: 'walk',
          states: {
            walk: {
              on: {
                COUNTDOWN: { target: 'wait' }
              }
            },
            wait: {
              on: {
                STOP_COUNTDOWN: { target: 'stop' }
              }
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

console.log(lightMachine.transition('yellow', { type: 'TIMER' }).value);
// {
//   red: {
//     walkSign: 'solid',
//     pedestrian: 'walk'
//   }
// }
```

<iframe src="https://stately.ai/viz/embed/?gist=3887dee1e2bb6e84c3b5a42c056984ad"></iframe>

<!-- TODO - maybe add something about onDone in a parallel state? -->
