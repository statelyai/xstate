# 并行状态节点 Parallel State Node

在状态图中，你可以将状态声明为 **并行状态**。 这意味着它的所有子状态将同时运行。 要了解更多信息，请参阅 [](./introduction-to-state-machines-and-statecharts/index.md#parallel-states) 中的部分。

## API

通过设置 `type: 'parallel'` 在状态机和/或任何嵌套复合状态上指定并行状态节点。

例如，下面的状态机允许 `upload` 和 `download` 复合状态同时处于活动状态。 想象一下，这代表一个可以同时下载和上传文件的应用程序：

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

并行状态节点的状态值表示为一个对象。 此对象状态值可用于进一步转换到并行状态节点中的不同状态：

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

复合状态节点可以包含并行状态节点。 嵌套状态节点的配置相同：

```js
const lightMachine = createMachine({
  // 不是并行状态机
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

    // 嵌套并行状态机
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
