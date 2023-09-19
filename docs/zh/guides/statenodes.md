# 状态节点

状态机包含状态节点（如下所述），它们共同描述状态机可以处于的 [整体状态](./states.md)。在下一节描述的 `fetchMachine` 中，有 **状态节点**，例如：

```js
// ...
{
  states: {
    // 状态节点
    idle: {
      on: {
        FETCH: {
          target: 'pending';
        }
      }
    }
  }
}
```

以及整体 **状态**，即 `machine.transition()` 函数的返回值或 `service.onTransition()` 的回调值：

```js
const nextState = fetchMachine.transition('pending', { type: 'FULFILL' });
// State {
//   value: { success: 'items' },
//   actions: [],
//   context: undefined,
//   ...
// }
```

## 什么是状态节点？

在 XState 中，**状态节点** 指定状态配置。 它们是在状态机的 `states` 属性上定义的。 同样，子状态节点在状态节点的 `states` 属性上分层定义。

从 `machine.transition(state, event)` 确定的状态，表示状态节点的组合。 例如，在下面的状态机中，有一个 `success` 状态节点和一个 `items` 子状态节点。 状态值 `{ success: 'items' }` 表示这些状态节点的组合。

```js
const fetchMachine = createMachine({
  id: 'fetch',

  // 初始 state
  initial: 'idle',

  // States
  states: {
    idle: {
      on: {
        FETCH: { target: 'pending' }
      }
    },
    pending: {
      on: {
        FULFILL: { target: 'success' },
        REJECT: { target: 'failure' }
      }
    },
    success: {
      // 初始子 state
      initial: 'items',

      // 子 states
      states: {
        items: {
          on: {
            'ITEM.CLICK': { target: 'item' }
          }
        },
        item: {
          on: {
            BACK: { target: 'items' }
          }
        }
      }
    },
    failure: {
      on: {
        RETRY: { target: 'pending' }
      }
    }
  }
});
```

<iframe src="https://stately.ai/viz/embed/?gist=932f6d193fa9d51afe31b236acf291c9"></iframe>

## 状态节点类型

有五种不同类型的状态节点：

- **atomic** 原子状态节点没有子状态。 （即，它是一个叶节点。）
- **compound** 复合状态节点包含一个或多个子 `states`，并有一个 `initial` 状态，这是这些子状态之一的 key。
- **parallel** 并行状态节点包含两个或多个子 `states`，并且没有初始状态，因为它表示同时处于其所有子状态。
- **final** 最终状态节点是代表抽象“终端”状态的叶节点。
- **history** 历史状态节点是一个抽象节点，表示解析到其父节点最近的浅或深历史状态。

可以在状态节点上显式定义状态节点类型：

```js
const machine = createMachine({
  id: 'fetch',
  initial: 'idle',
  states: {
    idle: {
      type: 'atomic',
      on: {
        FETCH: { target: 'pending' }
      }
    },
    pending: {
      type: 'parallel',
      states: {
        resource1: {
          type: 'compound',
          initial: 'pending',
          states: {
            pending: {
              on: {
                'FULFILL.resource1': { target: 'success' }
              }
            },
            success: {
              type: 'final'
            }
          }
        },
        resource2: {
          type: 'compound',
          initial: 'pending',
          states: {
            pending: {
              on: {
                'FULFILL.resource2': { target: 'success' }
              }
            },
            success: {
              type: 'final'
            }
          }
        }
      },
      onDone: 'success'
    },
    success: {
      type: 'compound',
      initial: 'items',
      states: {
        items: {
          on: {
            'ITEM.CLICK': { target: 'item' }
          }
        },
        item: {
          on: {
            BACK: { target: 'items' }
          }
        },
        hist: {
          type: 'history',
          history: 'shallow'
        }
      }
    }
  }
});
```

<iframe src="https://stately.ai/viz/embed/?gist=75cc77b35e98744e8d10902147feb313"></iframe>

将 `type` 明确指定为 `'atomic'`、`'compound'`、`'parallel'`、`'history'`、或 `'final'` 有助于 TypeScript 中的分析和类型检查。 但是，它只需要 parallel、history 和 final 状态。

## 瞬间状态节点

一个瞬间状态节点是一个“直通”状态节点，它会立即转换到另一个状态节点； 也就是说，状态机不会停留在瞬间状态。 瞬间状态节点可用于，根据条件确定状态机应该从先前状态真正进入哪个状态。 它们与 UML 中的 [选择伪状态](https://www.uml-diagrams.org/state-machine-diagrams.html#choice-pseudostate) 最相似。

定义瞬间状态节点的最佳方法是，使用无事件状态和 `always` 转换。 这是一个转换，其中第一个为 true 的条件会立即被采用。

例如，这个状态机的初始瞬间状态解析为 `'morning'`、`'afternoon'` 右 `'evening'`，具体取决于时间（隐藏实现细节）：

```js{9-15}
const timeOfDayMachine = createMachine({
  id: 'timeOfDay',
  initial: 'unknown',
  context: {
    time: undefined
  },
  states: {
    // 瞬时 state
    unknown: {
      always: [
        { target: 'morning', cond: 'isBeforeNoon' },
        { target: 'afternoon', cond: 'isBeforeSix' },
        { target: 'evening' }
      ]
    },
    morning: {},
    afternoon: {},
    evening: {}
  }
}, {
  guards: {
    isBeforeNoon: // ...
    isBeforeSix: // ...
  }
});

const timeOfDayService = interpret(timeOfDayMachine.withContext({ time: Date.now() }))
  .onTransition(state => console.log(state.value))
  .start();

// => 'morning' (假设时间在中午之前)
```

<iframe src="https://stately.ai/viz/embed/?gist=ca6a3f84f585c3e9cd6aadc3ae00b886"></iframe>

## 状态节点元数据

元数据，是描述任何 [状态节点](./statenodes.md) 相关属性的静态数据，可以在状态节点的 `.meta` 属性上指定：

```js {19-21,24-26,32-34,37-39,42-44}
const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  states: {
    idle: {
      on: {
        FETCH: { target: 'loading' }
      }
    },
    loading: {
      after: {
        3000: { target: 'failure.timeout' }
      },
      on: {
        RESOLVE: { target: 'success' },
        REJECT: { target: 'failure' },
        TIMEOUT: { target: 'failure.timeout' } // 手动超时
      },
      meta: {
        message: 'Loading...'
      }
    },
    success: {
      meta: {
        message: 'The request succeeded!'
      }
    },
    failure: {
      initial: 'rejection',
      states: {
        rejection: {
          meta: {
            message: 'The request failed.'
          }
        },
        timeout: {
          meta: {
            message: 'The request timed out.'
          }
        }
      },
      meta: {
        alert: 'Uh oh.'
      }
    }
  }
});
```

状态机的当前状态，收集所有状态节点的 `.meta` 数据，由状态值表示，并将它们放在一个对象上，其中：

- key 是 [状态节点 ID](./ids.md)
- value 是状态节点 `.meta` 的值

有关用法和更多信息，请参阅状 [状态元数据](./states.md#state-meta-data)。

## 标签 Tags

状态节点可以有 **tags**，这些标签是帮助描述状态节点的字符串术语。 标签是可用于对不同状态节点进行分类的元数据。 例如，你可以使用 `"loading"` 标签来表示哪些状态节点代表正在加载数据的状态，并使用 `state.hasTag(tag)` 确定一个状态是否包含那些标记的状态节点：

```js {10,14}
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        FETCH: 'loadingUser'
      }
    },
    loadingUser: {
      tags: ['loading']
      // ...
    },
    loadingFriends: {
      tags: ['loading']
      // ...
    },
    editing: {
      // ...
    }
  }
});

machine.initialState.hasTag('loading');
// => false

machine.transition(machine.initialState, { type: 'FETCH' }).hasTag('loading');
// => true
```
