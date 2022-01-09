# 上下文 Context

[:rocket: 快速参考](#快速参考)

虽然 _有限_ 状态在有限状态机和状态图中是明确定义的，但表示 _定量数据_（例如，任意字符串、数字、对象等）可能是无限的状态被表示为 [扩展状态](https://en.wikipedia.org/wiki/UML_state_machine#Extended_states)。 这使得状态图对于现实生活中的应用程序更有用。

在 XState 中，扩展状态被称为 **上下文（context）**。 下面是如何使用`context`来模拟填充一杯水的示例：

```js
import { createMachine, assign } from 'xstate';

// 增加上下文量的动作
const addWater = assign({
  amount: (context, event) => context.amount + 1
});

// 警卫检查玻璃是否已满
function glassIsFull(context, event) {
  return context.amount >= 10;
}

const glassMachine = createMachine(
  {
    id: 'glass',
    // 状态图的初始上下文（扩展状态）
    context: {
      amount: 0
    },
    initial: 'empty',
    states: {
      empty: {
        on: {
          FILL: {
            target: 'filling',
            actions: 'addWater'
          }
        }
      },
      filling: {
        // 瞬态过渡
        always: {
          target: 'full',
          cond: 'glassIsFull'
        },
        on: {
          FILL: {
            target: 'filling',
            actions: 'addWater'
          }
        }
      },
      full: {}
    }
  },
  {
    actions: { addWater },
    guards: { glassIsFull }
  }
);
```

当前上下文在 `State` 上被引用为 `state.context`：

```js
const nextState = glassMachine.transition(glassMachine.initialState, {
  type: 'FILL'
});

nextState.context;
// => { amount: 1 }
```

## 初始化 Context

初始上下文在 `Machine` 的 `context` 属性上指定：

```js
const counterMachine = createMachine({
  id: 'counter',
  // 初始 context
  context: {
    count: 0,
    message: 'Currently empty',
    user: {
      name: 'David'
    },
    allowedToIncrement: true
    // ... 等等。
  },
  states: {
    // ...
  }
});
```

对于动态`context`（即初始值是从外部检索或提供的`context`），你可以使用状态机工厂函数，使用提供的上下文值创建状态机（实现可能会有所不同）：

```js
const createCounterMachine = (count, time) => {
  return createMachine({
    id: 'counter',
    // 从函数参数提供的值
    context: {
      count,
      time
    }
    // ...
  });
};

const counterMachine = createCounterMachine(42, Date.now());
```

或者对于现有状态机，应该使用`machine.withContext(...)`：

```js
const counterMachine = createMachine({
  /* ... */
});

// 动态检索
const someContext = { count: 42, time: Date.now() };

const dynamicCounterMachine = counterMachine.withContext(someContext);
```

可以从状态机的初始状态，检索状态机的初始上下文：

```js
dynamicCounterMachine.initialState.context;
// => { count: 42, time: 1543687816981 }
```

这比直接访问 `machine.context` 更可取，因为初始状态是通过初始 `assign(...)` 操作和瞬态转换（如果有）计算的。

## 分配（assign）动作

`assign()` 操作用于更新状态机的 `context`。 它采用上下文“分配器”，它表示应如何分配当前上下文中的值。

| 参数       | 类型               | 描述                                                    |
| ---------- | ------------------ | ------------------------------------------------------- |
| `assigner` | object or function | 将值分配给 `context` 的对象分配器或函数分配器（见下文） |

“assigner” 可以是一个对象（推荐）：

```js
import { createMachine, assign } from 'xstate';
// 示例：属性分配器 assigner

// ...
  actions: assign({
    // 通过事件值增加当前计数
    count: (context, event) => context.count + event.value,

    // 为消息分配静态值（不需要函数）
    message: 'Count changed'
  }),
// ...
```

或者它可以是一个返回更新状态的函数：

```js
// 示例：上下文 assigner

// ...

  // 返回部分（或全部）更新的上下文
  actions: assign((context, event) => {
    return {
      count: context.count + event.value,
      message: 'Count changed'
    }
  }),
// ...
```

上面的属性分配器和上下文分配器函数签名都给出了 3 个参数：`context`、`event` 和 `meta`：

| 参数                         | 类型        | 描述                           |
| ---------------------------- | ----------- | ------------------------------ |
| `context`                    | TContext    | 状态机的当前上下文（扩展状态） |
| `event`                      | EventObject | 触发`assign`动作的事件         |
| `meta` <Badge text="4.7+" /> | AssignMeta  | 带有元数据的对象（见下文）     |

`meta` 对象包含：

- `state` - 正常转换中的当前状态（初始状态转换为 `undefined`）
- `action` - 分配动作

::: warning
`assign(...)` 函数是一个**动作创建者**； 它是一个纯函数，它只返回一个动作对象并且 _不_ 命令式地对上下文进行赋值。
:::

## 动作顺序

自定义动作，始终指向转换中的 _下一个状态_ 执行。 当状态转换具有`assign(...)`动作时，这些动作总是被批处理和计算 _首个_ 执行，以确定下一个状态。 这是因为状态是有限状态和扩展状态（上下文）的组合。

例如，在此计数器状态机中，自定义操作将无法按预期工作：

```js
const counterMachine = createMachine({
  id: 'counter',
  context: { count: 0 },
  initial: 'active',
  states: {
    active: {
      on: {
        INC_TWICE: {
          actions: [
            (context) => console.log(`Before: ${context.count}`),
            assign({ count: (context) => context.count + 1 }), // count === 1
            assign({ count: (context) => context.count + 1 }), // count === 2
            (context) => console.log(`After: ${context.count}`)
          ]
        }
      }
    }
  }
});

interpret(counterMachine).start().send({ type: 'INC_TWICE' });
// => "Before: 2"
// => "After: 2"
```

这是因为两个 `assign(...)` 动作总是是按顺序批处理并首先执行（在微任务中），所以下一个状态 `context` 是 `{ count: 2 }`，它被传递给两个自定义操作。 另一种思考这种转变的方式是阅读它：

> 当处于 `active` 状态并且发生 `INC_TWICE` 事件时，下一个状态是更新了 `context.count` 的 `active` 状态， _然后_ 在该状态上执行这些自定义操作。

重构它以获得所需结果的一个好方法是使用显式 _上一个_ 值对 `context` 进行建模，如果需要的话：

```js
const counterMachine = createMachine({
  id: 'counter',
  context: { count: 0, prevCount: undefined },
  initial: 'active',
  states: {
    active: {
      on: {
        INC_TWICE: {
          actions: [
            (context) => console.log(`Before: ${context.prevCount}`),
            assign({
              count: (context) => context.count + 1,
              prevCount: (context) => context.count
            }), // count === 1, prevCount === 0
            assign({ count: (context) => context.count + 1 }), // count === 2
            (context) => console.log(`After: ${context.count}`)
          ]
        }
      }
    }
  }
});

interpret(counterMachine).start().send({ type: 'INC_TWICE' });
// => "Before: 0"
// => "After: 2"
```

这样做的好处是：

1. 扩展状态（上下文）被更明确地建模
2. 没有隐含的中间状态，防止难以捕捉的错误
3. 动作顺序更加独立（“Before”日志甚至可以在“After”日志之后！）
4. 促进测试和检查状态

## 注意

- 🚫 永远不要在外部改变状态机的“上下文”。 任何事情的发生都是有原因的，并且每个上下文更改都应该由于事件而明确发生。
- 更喜欢`assign({ ... })` 的对象语法。 这使得未来的分析工具可以预测属性是 _如何_ 改变的。
- 动作可以堆叠，并按顺序运行：

```js
// ...
  actions: [
    assign({ count: 3 }), // context.count === 3
    assign({ count: context => context.count * 2 }) // context.count === 6
  ],
// ...
```

- 就像 `actions` 一样，最好将 `assign()` 操作表示为字符串或函数，然后在状态机选项中引用它们：

```js {5}
const countMachine = createMachine({
  initial: 'start',
  context: { count: 0 }
  states: {
    start: {
      entry: 'increment'
    }
  }
}, {
  actions: {
    increment: assign({ count: context => context.count + 1 }),
    decrement: assign({ count: context => context.count - 1 })
  }
});
```

或者作为命名函数（与上面相同的结果）：

```js {9}
const increment = assign({ count: context => context.count + 1 });
const decrement = assign({ count: context => context.count - 1 });

const countMachine = createMachine({
  initial: 'start',
  context: { count: 0 }
  states: {
    start: {
      // 命名函数
      entry: increment
    }
  }
});
```

- 理想情况下，`context` 应该可以表示为一个普通的 JavaScript 对象； 即，它应该可以序列化为 JSON。
- 由于引发了 `assign()` 动作，所以在执行其他动作之前更新上下文。 这意味着同一步骤中的其他操作将获得 _更新的_ `context`，而不是执行 `assign()` 操作之前的内容。 你不应该依赖状态的行动顺序，但请记住这一点。 有关更多详细信息，请参阅 [操作顺序](#action-order)。

## TypeScript

为了正确的类型推断，将上下文类型作为第一个类型参数添加到 `createMachine<TContext, ...>`：

```ts
interface CounterContext {
  count: number;
  user?: {
    name: string;
  };
}

const machine = createMachine<CounterContext>({
  // ...
  context: {
    count: 0,
    user: undefined
  }
  // ...
});
```

如果适用，你还可以使用 `typeof ...` 作为速记：

```ts
const context = {
  count: 0,
  user: { name: '' }
};

const machine = createMachine<typeof context>({
  // ...
  context
  // ...
});
```

在大多数情况下，`assign(...)` 动作中`context` 和`event` 的类型将根据传递给`createMachine<TContext, TEvent>` 的类型参数自动推断：

```ts
interface CounterContext {
  count: number;
}

const machine = createMachine<CounterContext>({
  // ...
  context: {
    count: 0
  },
  // ...
  {
    on: {
      INCREMENT: {
        // 大多数情况下自动推断
        actions: assign({
          count: (context) => {
            // context: { count: number }
            return context.count + 1;
          }
        })
      }
    }
  }
});
```

然而，TypeScript 的推断并不完美，所以负责任的做法是将上下文和事件作为泛型添加到 `assign<Context, Event>(...)` 中：

```ts {3}
// ...
on: {
  INCREMENT: {
    // 泛型保证正确的推理
    actions: assign<CounterContext, CounterEvent>({
      count: (context) => {
        // context: { count: number }
        return context.count + 1;
      }
    });
  }
}
// ...
```

## 快速参考

**设置初始上下文**

```js
const machine = createMachine({
  // ...
  context: {
    count: 0,
    user: undefined
    // ...
  }
});
```

**设置动态初始上下文**

```js
const createSomeMachine = (count, user) => {
  return createMachine({
    // ...
    // 从参数提供； 你的实施可能会有所不同
    context: {
      count,
      user
      // ...
    }
  });
};
```

**设置自定义初始上下文**

```js
const machine = createMachine({
  // ...
  // 从参数提供； 你的实施可能会有所不同
  context: {
    count: 0,
    user: undefined
    // ...
  }
});

const myMachine = machine.withContext({
  count: 10,
  user: {
    name: 'David'
  }
});
```

**分配给上下文**

```js
const machine = createMachine({
  // ...
  context: {
    count: 0,
    user: undefined
    // ...
  },
  // ...
  on: {
    INCREMENT: {
      actions: assign({
        count: (context, event) => context.count + 1
      })
    }
  }
});
```

**分配（静态）**

```js
// ...
actions: assign({
  counter: 42
}),
// ...
```

**分配（属性）**

```js
// ...
actions: assign({
  counter: (context, event) => {
    return context.count + event.value;
  }
}),
// ...
```

**分配 (上下文)**

```js
// ...
actions: assign((context, event) => {
  return {
    counter: context.count + event.value,
    time: event.time,
    // ...
  }
}),
// ...
```

**分配 (多个)**

```js
// ...
// 假设 context.count === 1
actions: [
  // 将 context.count 分配给 1 + 1 = 2
  assign({ count: (context) => context.count + 1 }),
  // 将 context.count 分配给 2 * 3 = 6
  assign({ count: (context) => context.count * 3 })
],
// ...
```
