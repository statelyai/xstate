# 演员 Actors <Badge text="4.6+"/>

[:rocket: 快速参考](#快速参考)

[[toc]]

[演员（Actor）模型](https://en.wikipedia.org/wiki/Actor_model) 是一种基于消息的计算的数学模型，它简化了多个“实体”（或“演员”）相互通信的方式。 演员通过相互发送消息（事件）来进行通信。 演员 的本地状态是私有的，除非它希望通过将其作为事件发送来与另一个 演员 共享。

当一个 演员 收到一个事件时，会发生三件事：

- 有限数量的消息可以 **sent** 给其他 演员
- 可以创建（或 **spawned**）有限数量的新演员
- 演员 的本地状态可能会改变（由其 **behavior** 决定）

状态机和状态图与 演员 模型配合得很好，因为它们是基于事件的行为和逻辑模型。 请记住：当状态机因事件而转换时，下一个状态包含：

- 下一个 `value` 和 `context`（ 演员 的本地状态）
- 要执行的下一个 `actions` （可能是新生成的 演员 或发送给其他 演员 的消息）

演员 可以是 _创建的_ 或 [_调用的_](./communication.md)。 创建的 演员 与调用的 演员 有两个主要区别：

- 他们可以在任何时候被 _创建_（通过 `assign(...)` 操作中的 `spawn(...)`）
- 他们可以随时 _停止_（通过`stop(...)`动作）

## 演员 API

演员 XState 中实现）具有以下接口：

- 一个 `id` 属性，它在本地系统中唯一标识角色
- 一个 `.send(...)` 方法，用于向这个 演员 发送事件
- 一个`.getSnapshot()`方法，同步返回演员的最后 _触发值_。

他们可能有可选的方法：

- 一个 `.stop()` 方法，它停止 演员 并执行任何必要的清理
- [Observable](https://github.com/tc39/proposal-observable) 的 演员 的`.subscribe(...)` 方法。

所有现有的调用服务模式都适合这个接口：

- [调用 promises](./communication.md#invoking-promises) 是忽略任何接收到的事件并最多将一个事件发送回父级的演员
- [调用 callbacks](./communication.md#invoking-callbacks) 是可以向父级发送事件的演员
  (第一个 `callback` 参数), 接收事件（第二个 `onReceive` 参数），并对它们采取动作
- [调用 machines](./communication.md#invoking-machines) 是可以将事件发送到父级（`sendParent(...)` 动作）或它引用的其他演员（`send(...)` 动作）、接收事件、对它们采取行动（状态转换和动作）的 演员 )，产生新的 演员（`spawn(...)` 函数），并停止 演员。
- [调用 observables](./communication.md#invoking-observables) 是其发出的值表示要发送回父级的事件的 演员。

::: tip 什么是触发的值？

演员的 **触发值** 是订阅者在 演员 的`.subscribe(...)` 方法中收到的值。

- 对于 service，发出当前状态。
- 对于 promise，发出 resolve 的值（如果未实现，则为“未定义”）。
- 对于 observables，发出最新发出的值。
- 对于 callback，不会发出任何内容。

:::

## 创建演员

就像在基于 演员 模型的语言中一样 [Akka](https://doc.akka.io/docs/akka/current/guide/introduction.html) 或 [Erlang](http://www.erlang.org/docs)，演员 在`context` 中产生并被引用（作为`assign(...)` 操作的结果）。

1. 从`'xstate'`导入`spawn`函数
2. 在`assign(...)` 动作中，使用`spawn(...)` 创建一个新的 演员 引用

`spawn(...)` 函数通过提供 1 或 2 个参数来创建 **演员 引用**：

- `entity` - 代表 演员 动作（反应）的值或状态机。 `entity` 的可能类型：
  - [Machine](./communication.md#invoking-machines)
  - [Promise](./communication.md#invoking-promises)
  - [Callback](./communication.md#invoking-callbacks)
  - [Observable](./communication.md#invoking-observables)
- `name` （可选） - 唯一标识 演员 的字符串。 这对于所有生成的 演员 和调用的服务应该是唯一的。

或者，`spawn` 接受一个选项对象作为第二个参数，它可能包含以下选项：

- `name` （可选） - 唯一标识演员的字符串。 这对于所有生成的演员和调用的服务应该是唯一的。
- `autoForward` - （可选）`true` 如果发送到这台状态机的所有事件也应该发送（或 _转发_）到被调用的子节点（默认情况下为 `false`）
- `sync` - (可选) `true` 如果这台状态机应该自动订阅产生的子状态机的状态，状态将在子状态机 ref 上存储为 `.state`

```js {13-14}
import { createMachine, spawn } from 'xstate';
import { todoMachine } from './todoMachine';

const todosMachine = createMachine({
  // ...
  on: {
    'NEW_TODO.ADD': {
      actions: assign({
        todos: (context, event) => [
          ...context.todos,
          {
            todo: event.todo,
            // 添加一个具有唯一名称的新 todoMachine actor
            ref: spawn(todoMachine, `todo-${event.id}`)
          }
        ]
      })
    }
    // ...
  }
});
```

如果你没有为 `spawn(...)` 提供 `name` 参数，将会自动生成一个唯一的名称。 此名称将是不确定的 ⚠️。

::: tip
将 `const actorRef = spawn(someMachine)` 视为 `context` 中的一个普通值。 你可以根据你的逻辑要求将此 `actorRef` 放置在 `context` 内的任何位置。 只要它在`assign(...)` 中的赋值函数内，它就会被限定在它产生的服务范围内。
:::

::: warning
不要在赋值函数之外调用 `spawn(...)`。 这将产生一个没有效果的孤儿演员（没有父级）。

```js
// ❌ 永远不要在外部调用 spawn(...)
const someActorRef = spawn(someMachine);

// ❌ spawn(...) 不是action创建者
{
  actions: spawn(someMachine);
}

// ❌ 不要在赋值函数之外赋值 spawn(...)
{
  actions: assign({
    // 记住：这是在服务启动之前立即调用的
    someActorRef: spawn(someMachine)
  });
}

// ✅ 在赋值函数中分配 spawn(...)
{
  actions: assign({
    someActorRef: () => spawn(someMachine)
  });
}
```

:::

可以生成不同类型的值作为演员。

## 发送事件到演员

使用 [`send()` 动作](./actions.md#send-action)，事件可以通过 [目标表达式](./actions.md#send-targets) 发送给演员：

```js {13}
const machine = createMachine({
  // ...
  states: {
    active: {
      entry: assign({
        someRef: () => spawn(someMachine)
      }),
      on: {
        SOME_EVENT: {
          // 使用目标表达式将事件发送到演员引用
          actions: send({ type: 'PING' }, { to: (context) => context.someRef })
        }
      }
    }
  }
});
```

::: tip
如果你为 `spawn(...)` 提供了一个唯一的 `name` 参数，你可以在目标表达式中引用它：

```js
const loginMachine = createMachine({
  // ...
  entry: assign({
    formRef: () => spawn(formMachine, 'form')
  }),
  states: {
    idle: {
      on: {
        LOGIN: {
          actions: send({ type: 'SUBMIT' }, { to: 'form' })
        }
      }
    }
  }
});
```

:::

## 停止演员

使用 `stop(...)` 动作创建器停止演员：

```js
const someMachine = createMachine({
  // ...
  entry: [
    // 通过引用停止一个actor
    stop((context) => context.someActorRef),
    // 通过 ID 停止 actor
    stop('some-actor')
  ]
});
```

## 创建 Promises

就像 [invoking promises](./communication.md#invoking-promises) 一样，promise 可以作为 演员 生成。 发送回状态机的事件将是一个 `'xstate.done.actor.<ID>'` 操作，promise 响应作为有效负载中的 `data` 属性：

```js {11}
// Returns a promise
const fetchData = (query) => {
  return fetch(`http://example.com?query=${event.query}`).then((data) =>
    data.json()
  );
};

// ...
{
  actions: assign({
    ref: (_, event) => spawn(fetchData(event.query))
  });
}
// ...
```

::: warning
不建议生成 promise 演员，因为 [调用 promises](./communication.md#invoking-promises) 是一种更好的模式，因为它们依赖于状态（自我取消）并且具有更可预测的行为。
:::

## 创建 Callbacks

就像 [调用 callbacks](./communication.md#invoking-callbacks) 一样，回调可以作为 演员 产生。 这个例子模拟了一个 定时计数 演员，它每秒增加自己的计数，但也可以对 `{ type: 'INC' }` 事件做出反应。

```js {22}
const counterInterval = (callback, receive) => {
  let count = 0;

  const intervalId = setInterval(() => {
    callback({ type: 'COUNT.UPDATE', count });
    count++;
  }, 1000);

  receive(event => {
    if (event.type === 'INC') {
      count++;
    }
  });

  return () => { clearInterval(intervalId); }
}

const machine = createMachine({
  // ...
  {
    actions: assign({
      counterRef: () => spawn(counterInterval)
    })
  }
  // ...
});
```

然后可以将事件发送给演员：

```js {5-7}
const machine = createMachine({
  // ...
  on: {
    'COUNTER.INC': {
      actions: send({ type: 'INC' }, { to: (context) => context.counterRef })
    }
  }
  // ...
});
```

## 创建 Observables

就像 [调用 observables](./communication.md#invoking-observables) 一样，observables 可以作为 演员 生成：

```js {22}
import { interval } from 'rxjs';
import { map } from 'rxjs/operators';

const createCounterObservable = (ms) => interval(ms)
  .pipe(map(count => ({ type: 'COUNT.UPDATE', count })))

const machine = createMachine({
  context: { ms: 1000 },
  // ...
  {
    actions: assign({
      counterRef: ({ ms }) => spawn(createCounterObservable(ms))
    })
  }
  // ...
  on: {
    'COUNT.UPDATE': { /* ... */ }
  }
});
```

## 创建状态机

状态机是使用 演员 的最有效方式，因为它们提供了最多的功能。 生成状态机就像 [调用 状态机](./communication.md#invoking-machines)，其中一个 `machine` 被传递到 `spawn(machine)`：

```js {13,26,30-32}
const remoteMachine = createMachine({
  id: 'remote',
  initial: 'offline',
  states: {
    offline: {
      on: {
        WAKE: 'online'
      }
    },
    online: {
      after: {
        1000: {
          actions: sendParent({ type: 'REMOTE.ONLINE' })
        }
      }
    }
  }
});

const parentMachine = createMachine({
  id: 'parent',
  initial: 'waiting',
  context: {
    localOne: null
  },
  states: {
    waiting: {
      entry: assign({
        localOne: () => spawn(remoteMachine)
      }),
      on: {
        'LOCAL.WAKE': {
          actions: send({ type: 'WAKE' }, { to: (context) => context.localOne })
        },
        'REMOTE.ONLINE': { target: 'connected' }
      }
    },
    connected: {}
  }
});

const parentService = interpret(parentMachine)
  .onTransition((state) => console.log(state.value))
  .start();

parentService.send({ type: 'LOCAL.WAKE' });
// => 'waiting'
// ... after 1000ms
// => 'connected'
```

## 同步和读取 State <Badge text="4.6.1+"/>

演员 模型的主要原则之一是， 演员 状态是 _私有的_ 和 _本地的_，它永远不会共享，除非 演员 选择通过消息传递来共享它。 坚持使用这个模型，演员 可以在其状态发生变化时，通过向其发送具有最新状态的特殊“更新”事件，来 _通知_ 其父级。 换句话说，父演员 可以订阅其子演员 的状态。

为此，请将 `{ sync: true }` 设置为 `spawn(...)` 的选项：

```js {4}
// ...
{
  actions: assign({
    // 每当其状态发生变化时，Actor 都会向父级发送更新事件
    someRef: () => spawn(todoMachine, { sync: true })
  });
}
// ...
```

这将自动为状态机订阅生成的子状态机的状态，该状态会保持更新并可通过 `getSnapshot()` 访问：

```js
someService.onTransition((state) => {
  const { someRef } = state.context;

  console.log(someRef.getSnapshot());
  // => State {
  //   value: ...,
  //   context: ...
  // }
});
```

::: warning
默认情况下，`sync` 设置为 `false`。 当禁用`sync`时，永远不要读取演员的`.state`； 否则，你最终将引用陈旧的状态。
:::

## 发送更新 <Badge text="4.7+" />

对于不与父级同步的 演员，演员 可以通过 `sendUpdate()` 向其父状态机发送显式事件：

```js
import { createMachine, sendUpdate } from 'xstate';

const childMachine = createMachine({
  // ...
  on: {
    SOME_EVENT: {
      actions: [
        // ...
        // 创建一个将更新事件发送给父级的操作
        sendUpdate()
      ]
    }
  }
});
```

::: tip
更喜欢显式地向父级发送事件（`sendUpdate()`），而不是订阅每个状态更改。 与生成的状态机同步可能会导致“闲聊”事件日志，因为来自子级的每次更新都会导致从子级发送到父级的新“xstate.update”事件。
:::

## 快速参考

**导入 `spawn`** 并创建演员:

```js
import { spawn } from 'xstate';
```

在 `assign` 动作中 **创建演员** ：

```js
// ...
{
  actions: assign({
    someRef: (context, event) => spawn(someMachine)
  });
}
// ...
```

**创建不同类型** 的演员：

```js
// ...
{
  actions: assign({
    // 来自 promise
    promiseRef: (context, event) =>
      spawn(
        new Promise((resolve, reject) => {
          // ...
        }),
        'my-promise'
      ),

    // 来自callback
    callbackRef: (context, event) =>
      spawn((callback, receive) => {
        // 发送到父级
        callback('SOME_EVENT');

        // 接收父级
        receive((event) => {
          // 处理 event
        });

        // 处理
        return () => {
          /* 在这里做清理 */
        };
      }),

    // 来自 observable
    observableRef: (context, event) => spawn(someEvent$),

    // 来自machine
    machineRef: (context, event) =>
      spawn(
        createMachine({
          // ...
        })
      )
  });
}
// ...
```

与 演员 **同步状态**:

```js
// ...
{
  actions: assign({
    someRef: () => spawn(someMachine, { sync: true })
  });
}
// ...
```

从 演员 那里 **获取快照**：<Badge text="4.20.0+"/>

```js
service.onTransition((state) => {
  const { someRef } = state.context;

  someRef.getSnapshot();
  // => State { ... }
});
```

使用 `send` 动作创建者**向演员发送事件**：

```js
// ...
{
  actions: send(
    { type: 'SOME_EVENT' },
    {
      to: (context) => context.someRef
    }
  );
}
// ...
```

使用 `send` 表达式 **将带有数据的事件发送给演员**：

```js
// ...
{
  actions: send((context, event) => ({ ...event, type: 'SOME_EVENT' }), {
    to: (context) => context.someRef
  });
}
// ...
```

使用 `sendParent` 动作创建者**将事件从演员**发送到父级：

```js
// ...
{
  actions: sendParent({ type: 'ANOTHER_EVENT' });
}
// ...
```

使用 `sendParent` 表达式**将带有数据的事件从演员**发送到父级：

```js
// ...
{
  actions: sendParent((context, event) => ({
    ...context,
    type: 'ANOTHER_EVENT'
  }));
}
// ...
```

从 `context` **查看演员** ：

```js
someService.onTransition((state) => {
  const { someRef } = state.context;

  console.log(someRef);
  // => { id: ..., send: ... }
});
```
