# 守卫（Guarded）转换

很多时候，你会希望状态之间的转换仅在满足状态（有限或扩展）或事件的某些条件时发生。 例如，假设你正在为搜索表单创建一台状态机，并且你只希望在以下情况下允许搜索：

- 允许用户搜索（本例中为`.canSearch`）
- 搜索事件`query` 不为空。

这是“守卫转换”的一个很好的用例，这是一种仅在某些条件（`cond`）通过时才会发生的转换。 带有条件的转换称为**守卫转换**。

## 守卫 (条件函数)

在转换的 `.cond` 属性上指定的 **条件函数**（也称为 **守卫**），作为具有 `{ type: '...' }` 属性的字符串或条件对象 , 并接受 3 个参数：

| 参数       | 类型   | 描述                           |
| ---------- | ------ | ------------------------------ |
| `context`  | object | [状态机 context](./context.md) |
| `event`    | object | 触发条件的事件                 |
| `condMeta` | object | 元数据（见下文）               |

`condMeta` 对象包括以下属性：

- `cond` - 原始条件对象
- `state` - 转换前的当前状态机状态
- `_event` - SCXML 事件

**返回**

`true` 或 `false`，决定是否允许进行转换。

```js {15-16,30-34}
const searchValid = (context, event) => {
  return context.canSearch && event.query && event.query.length > 0;
};

const searchMachine = createMachine(
  {
    id: 'search',
    initial: 'idle',
    context: {
      canSearch: true
    },
    states: {
      idle: {
        on: {
          SEARCH: [
            {
              target: 'searching',
              // 仅当守卫 (cond) 判断为真时才过渡到“搜索”
              cond: searchValid // 或 { type: 'searchValid' }
            },
            { target: '.invalid' }
          ]
        },
        initial: 'normal',
        states: {
          normal: {},
          invalid: {}
        }
      },
      searching: {
        entry: 'executeSearch'
        // ...
      },
      searchError: {
        // ...
      }
    }
  },
  {
    guards: {
      searchValid // 可选，如果实现没有改变
    }
  }
);
```

单击 _EVENTS_ 选项卡并发送一个类似`{ "type": "SEARCH", "query": "something" }` 的事件，如下所示：

<iframe src="https://stately.ai/viz/embed/?gist=09af23963bfa1767ce3900f2ae730029&tab=events"></iframe>

如果 `cond` 守卫返回 `false`，则不会选择转换，并且不会从该状态节点发生转换。 如果子状态中的所有转换都有判断为 `false` 的守卫，并阻止它们被选择，则 `event` 将传播到父状态 并在那里处理。

`context` 的使用示例：

```js
import { interpret } from 'xstate';

const searchService = interpret(searchMachine)
  .onTransition((state) => console.log(state.value))
  .start();

searchService.send({ type: 'SEARCH', query: '' });
// => 'idle'

searchService.send({ type: 'SEARCH', query: 'something' });
// => 'searching'
```

::: tip
通过直接在状态机配置中指定内联的守卫 `cond` 函数，可以快速构建守卫实现的原型：

```js {4}
// ...
SEARCH: {
  target: 'searching',
  cond: (context, event) => context.canSearch && event.query && event.query.length > 0
}
// ...
```

在状态机选项的 `guards` 属性中重构内联 守卫，实现可以更容易地调试、序列化、测试和准确地可视化的守卫。

:::

## 序列化守卫

守卫 可以（并且应该）被序列化为字符串或具有 `{ type: '...' }` 属性的对象。 守卫的实现细节在状态机选项的`guards`属性上指定，其中`key`是守卫`type`（指定为字符串或对象），值是一个接受三个参数的函数：

- `context` - 当前状态机 context
- `event` - 触发（潜在）转换的事件
- `guardMeta` - 一个包含有关守卫和转换的元数据的对象，包括：
  - `cond` - 原始 `cond` 对象
  - `state` - 转换前的，当前状态机 state

重构上面的例子：

```js {9-11,19-23}
const searchMachine = createMachine(
  {
    // ...
    states: {
      idle: {
        on: {
          SEARCH: {
            target: 'searching',
            // 'searchValid' 守卫实现细节在状态机配置中指定
            cond: 'searchValid' // 或 { type: 'searchValid' }
          }
        }
      }
      // ...
    }
  },
  {
    guards: {
      searchValid: (context, event) => {
        return context.canSearch && event.query && event.query.length > 0;
      }
    }
  }
);
```

## 自定义守卫 <Badge text="4.4+"/>

有时，最好不仅序列化 JSON 中的状态转换，还序列化 守卫 逻辑。 这是将守卫序列化为对象的有用之处，因为对象可能包含相关数据：

```js {9-13,21-30}
const searchMachine = createMachine(
  {
    // ...
    states: {
      idle: {
        on: {
          SEARCH: {
            target: 'searching',
            // 自定义 guard 对象
            cond: {
              type: 'searchValid',
              minQueryLength: 3
            }
          }
        }
      }
      // ...
    }
  },
  {
    guards: {
      searchValid: (context, event, { cond }) => {
        // cond === { type: 'searchValid', minQueryLength: 3 }
        return (
          context.canSearch &&
          event.query &&
          event.query.length > cond.minQueryLength
        );
      }
    }
  }
);
```

## 多个守卫

如果你想在某些情况下将单个事件转换到不同的状态，你可以提供一组条件转换。 每个转换都将按顺序进行测试，并且将采用第一个 `cond` 保护判断为 `true` 的转换。

例如，你可以建模一扇门，它监听 `OPEN` 事件，如果你是管理员则进入 `'opened'` 状态，或者如果 `alert` 为真 则进入 `'closed.error'` 状态 ，否则进入 `'closed.idle'` 状态。

```js {25-27}
import { createMachine, actions, interpret, assign } from 'xstate';

const doorMachine = createMachine(
  {
    id: 'door',
    initial: 'closed',
    context: {
      level: 'user',
      alert: false // 发生入侵时发出警报
    },
    states: {
      closed: {
        initial: 'idle',
        states: {
          idle: {},
          error: {}
        },
        on: {
          SET_ADMIN: {
            actions: assign({ level: 'admin' })
          },
          SET_ALARM: {
            actions: assign({ alert: true })
          },
          OPEN: [
            // 一次测试一个转换。
            // 将进行第一个有效转换。
            { target: 'opened', cond: 'isAdmin' },
            { target: '.error', cond: 'shouldAlert' },
            { target: '.idle' }
          ]
        }
      },
      opened: {
        on: {
          CLOSE: { target: 'closed' }
        }
      }
    }
  },
  {
    guards: {
      isAdmin: (context) => context.level === 'admin',
      shouldAlert: (context) => context.alert === true
    }
  }
);

const doorService = interpret(doorMachine)
  .onTransition((state) => console.log(state.value))
  .start();
// => { closed: 'idle' }

doorService.send({ type: 'OPEN' });
// => { closed: 'idle' }

doorService.send({ type: 'SET_ALARM' });
// => { closed: 'idle' }
// (状态不会改变，但上下文会改变)

doorService.send({ type: 'OPEN' });
// => { closed: 'error' }

doorService.send({ type: 'SET_ADMIN' });
// => { closed: 'error' }
// (状态不会改变，但上下文会改变)

doorService.send({ type: 'OPEN' });
// => 'opened'
// (因为 context.isAdmin === true)
```

<iframe src="https://stately.ai/viz/embed/?gist=8526f72c3041b38f7d7ba808c812df06"></iframe>

::: warning
`cond` 函数必须始终是只引用 `context` 和 `event` 参数的**纯函数**。
:::

::: tip
_不要_ 过度使用保护条件。 如果某事可以分散地表示为两个或多个单独的事件，而不是单个事件上的多个 `conds` ，最好避免多个 `conds` ，建议使用多种类型的事件代替。
:::

## "状态内" 守卫

`in` 属性将状态 ID 作为参数，并且当且仅当该状态节点在当前状态下处于活动状态时才返回 `true`。 例如，我们可以为交通灯状态机添加一个守卫：

```js {24}
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
      initial: 'walk',
      states: {
        walk: {
          /* ... */
        },
        wait: {
          /* ... */
        },
        stop: {
          /* ... */
        }
      },
      on: {
        TIMER: [
          {
            target: 'green',
            in: '#light.red.stop'
          }
        ]
      }
    }
  }
});
```

当一个 `in` 状态 守卫与其他 `cond` 守卫在同一个转换中存在时，_所有_ 守卫必须判断为 `true` 才能进行转换。

::: tip
使用“处于状态”的守卫通常表明状态机可以以不需要使用的方式进行重构。 尽可能避免“处于状态”的警卫。
:::
