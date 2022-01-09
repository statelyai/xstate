# 最终状态

在状态图中，你可以将状态声明为 **最终状态**。 最终状态表示其父状态为“完成”。 要了解更多信息，请阅读我们对 [状态图的介绍中的最后状态部分](./introduction-to-state-machines-and-statecharts/index.md#final-state)。

## API

要指示状态节点是最终节点，请将其 `type` 属性设置为 `'final'`：

```js
const lightMachine = createMachine({
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
    red: {
      type: 'parallel',
      states: {
        crosswalkNorth: {
          initial: 'walk',
          states: {
            walk: {
              on: {
                PED_WAIT: { target: 'wait' }
              }
            },
            wait: {
              on: {
                PED_STOP: { target: 'stop' }
              }
            },
            stop: {
              // 'stop' 是 crosswalkNorth' 的最终状态节点
              type: 'final'
            }
          },
          onDone: {
            actions: 'stopCrosswalkNorth'
          }
        },
        crosswalkEast: {
          initial: 'walk',
          states: {
            walk: {
              on: {
                PED_WAIT: { target: 'wait' }
              }
            },
            wait: {
              on: {
                PED_STOP: { target: 'stop' }
              }
            },
            stop: {
              type: 'final'
            }
          },
          onDone: {
            // 'stop' 是 'crosswalkEast' 的最终状态节点
            actions: 'stopCrosswalkEast'
          }
        }
      },
      onDone: 'green'
    }
  }
});
```

在复合状态中，到达最终子状态节点（使用 `{ type: 'final' }`）将在内部引发该复合状态节点的 `done(...)` 事件（例如，`"done.state. light.crosswalkEast"`)。 使用 `onDone` 相当于为此事件定义一个转换。

## 并行状态

当并行状态节点中的每个子状态节点都 _完成_ 时，父并行状态节点也 _完成_。 当到达每个子复合节点中的每个最终状态节点时，将为并行状态节点引发 `done(...)` 事件。

这在建模并行任务时非常有用。 例如，下面有一个购物机，其中 `user` 和 `items` 表示 `cart` 状态的两个并行任务：

```js
const shoppingMachine = createMachine({
  id: 'shopping',
  initial: 'cart',
  states: {
    cart: {
      type: 'parallel',
      states: {
        user: {
          initial: 'pending',
          states: {
            pending: {
              entry: 'getUser',
              on: {
                RESOLVE_USER: { target: 'success' },
                REJECT_USER: { target: 'failure' }
              }
            },
            success: { type: 'final' },
            failure: {}
          }
        },
        items: {
          initial: 'pending',
          states: {
            pending: {
              entry: 'getItems',
              on: {
                RESOLVE_ITEMS: { target: 'success' },
                REJECT_ITEMS: { target: 'failure' }
              }
            },
            success: { type: 'final' },
            failure: {}
          }
        }
      },
      onDone: 'confirm'
    },
    confirm: {
      // ...
    }
  }
});
```

`onDone` 转换只会在 `'cart'` 的所有子状态（例如，`'user'` 和 `'items'`）都处于它们的最终状态时发生。 在购物机的情况下，一旦到达`'shopping.cart.user.success'`和`'shopping.cart.items.success'`状态节点，状态机将从`'cart'`过渡到 `'confirm'` 状态。

::: warning

不能在状态机的根节点上定义 `onDone` 转换。 这是因为 `onDone` 是对 `'done.state.*'` 事件的转换，当状态机达到最终状态时，它不能再接受任何事件。

:::

## 笔记

- 最终状态节点仅指示其直接父节点已 _完成_。 它不会影响任何更高父节点的 _完成_ 状态，除非在其所有子复合状态节点 _完成_ 时。
- 到达最终子状态的并行状态在其所有同级完成之前不会停止接收事件。 最后的子状态仍然可以通过事件退出。
- 最终状态节点不能有任何子节点。 它们是原子状态节点。
- 你可以在最终状态节点上指定 `entry` 和 `exit` 动作。
