# 动作 Actions

动作，是即发即弃的 [作用](./effects.md)。 它们可以通过三种方式声明：

- `entry` 动作，进入状态时执行
- `exit` 动作，退出状态时执行
- 执行转换时，执行转换的动作

要了解更多信息，请阅读 [状态图简介中的动作](./introduction-to-state-machines-and-statecharts/index.md#actions)。

## API

可以像这样添加动作

```js {10-11,16-19,27-41}
const triggerMachine = createMachine(
  {
    id: 'trigger',
    initial: 'inactive',
    states: {
      inactive: {
        on: {
          TRIGGER: {
            target: 'active',
            // 转换 actions
            actions: ['activate', 'sendTelemetry']
          }
        }
      },
      active: {
        // 进入 actions
        entry: ['notifyActive', 'sendTelemetry'],
        // 退出 actions
        exit: ['notifyInactive', 'sendTelemetry'],
        on: {
          STOP: { target: 'inactive' }
        }
      }
    }
  },
  {
    actions: {
      // action 实现
      activate: (context, event) => {
        console.log('activating...');
      },
      notifyActive: (context, event) => {
        console.log('active!');
      },
      notifyInactive: (context, event) => {
        console.log('inactive!');
      },
      sendTelemetry: (context, event) => {
        console.log('time:', Date.now());
      }
    }
  }
);
```

<details>
  <summary>
    什么时候应该使用 转换 VS entry/exit 动作？
  </summary>

这取决于！ 它们的做的事不同：

- entry/exit 操作，意味着“在进入/退出此状态的任何转换上 **执行此 动作**”。 当 动作 只依赖于它所在的状态节点，而不依赖于上一个/下一个状态节点 或 事件时，使用进入/退出 动作

```js
// ...
{
  idle: {
    on: {
      LOAD: 'loading'
    }
  },
  loading: {
    // 每当进入“loading”状态时执行此 动作
    entry: 'fetchData'
  }
}
// ...
```

- 转换 动作 意味着“仅在此转换上 **执行此 动作**”。 当 动作 依赖于事件和它当前所处的状态节点时，使用转换 动作。

```js
// ...
{
  idle: {
    on: {
      LOAD: {
        target: 'loading',
        // 此 动作 仅在此转换时执行
        actions: 'fetchData'
    }
  },
  loading: {
    // ...
  }
}
// ...
```

</details>

::: tip
可以通过直接在状态机配置中指定 动作 函数来快速原型化 动作 实现：

```js {4}
// ...
TRIGGER: {
  target: 'active',
  actions: (context, event) => { console.log('activating...'); }
}
// ...
```

在状态机选项的 `actions` 属性中重构内联 动作 实现，可以更容易地调试、序列化、测试和准确地可视化 动作。

:::

## 声明动作

从 `machine.transition(...)` 返回的 `State` 实例有一个 `.actions` 属性，它是一个供 解释（interpret） 执行的 动作 对象数组：

```js {4-9}
const activeState = triggerMachine.transition('inactive', { type: 'TRIGGER' });

console.log(activeState.actions);
// [
//   { type: 'activate', exec: ... },
//   { type: 'sendTelemetry', exec: ... },
//   { type: 'notifyActive', exec: ... },
//   { type: 'sendTelemetry', exec: ... }
// ]
```

每个 动作 对象都有两个属性（以及其他可以指定的属性）：

- `type` - 动作 类型
- `exec` - 动作 执行函数

`exec` 函数有 3 个参数：

| 参数         | 类型         | 描述                                   |
| ------------ | ------------ | -------------------------------------- |
| `context`    | TContext     | 当前状态机的上下文                     |
| `event`      | event object | 导致转换的事件                         |
| `actionMeta` | meta object  | 包含有关 动作 的元数据的对象（见下文） |

`actionMeta` 对象包括以下属性：

| 参数     | 类型          | 描述                       |
| -------- | ------------- | -------------------------- |
| `action` | action object | 原始 动作 对象             |
| `state`  | State         | 转换后的已解析的状态机状态 |

解释（interpret）将调用带有 `currentState.context`、`event` 和状态机转换到的 `state` 的 `exec` 函数。 你可以自定义此 动作。 阅读 [执行 动作](./interpretation.md#executing-actions) 了解更多详情。

## 动作顺序

在执行状态图时，动作的顺序不一定重要（也就是说，它们不应该相互依赖）。 但是，`state.actions` 数组中的操作顺序是：

1. `exit` 动作 - 退出状态节点的所有退出 动作，从原子状态节点开始
2. 转换 `actions` - 在所选转换上定义的所有 动作
3. `entry` 动作 - 进入状态节点的所有进入 动作，从父状态开始

::: warning
在 XState 4.x 版中，`assign` 动作 具有优先权，并且在任何其他 动作 之前执行。 此行为将在第 5 版中修复，因为将按顺序调用 `assign` 操作。
:::

::: danger

此处记录的所有 动作 创建者都返回 **动作 对象**； 它是一个纯函数，它只返回一个 动作 对象，并 _不是_ 命令式的发送一个事件。 不要命令式的调用 动作 创建者； 因为 他们什么都不会做！

```js
// 🚫 不要这样做！
entry: () => {
  // 🚫 这将什么也不做； send() 不是命令式函数！
  send({ type: 'SOME_EVENT' });
};

console.log(send({ type: 'SOME_EVENT' }));
// => { type: 'xstate.send', event: { type: 'SOME_EVENT' } }

// ✅ 这样替换
entry: send({ type: 'SOME_EVENT' });
```

:::

## 发送动作（send action）

::: warning

The `send(...)` action creator is deprecated in favor of the `sendTo(...)` action creator:

```diff
-send({ type: 'EVENT' }, { to: 'someActor' });
+sendTo('someActor', { type: 'EVENT' });
```

For sending events to self, `raise(...)` should be used:

```diff
-send({ type: 'EVENT' });
+raise({ type: 'EVENT' });
```

The `send(...)` action creator will be removed in XState v5.0.

:::

`send(event)` 动作 创建者创建了一个特殊的“发送” 动作 对象，它告诉服务（即，[解释（interpret） 状态机](./interpretation.md)）将该事件发送给它自己。 它在外部事件队列中，将一个事件排入正在运行的服务中，这意味着该事件将在 解释（interpret） 的下一步“步骤”上发送。

| 参数       | 类型                                       | 描述                                    |
| ---------- | ------------------------------------------ | --------------------------------------- |
| `event`    | string or event object or event expression | 发送到指定`options.to`（或 self）的事件 |
| `options?` | send options (见下文)                      | 发送事件的选项。                        |

send `options` 参数是一个包含以下内容的对象：

| 参数     | 类型   | 描述                                                   |
| -------- | ------ | ------------------------------------------------------ |
| `id?`    | string | send ID (用于取消)                                     |
| `to?`    | string | 事件的目标（默认为 self）                              |
| `delay?` | number | 发送事件前的超时时间（毫秒），如果在超时前没有取消事件 |

::: warning
`send(...)` 函数是一个 **动作 创建者**； 它是一个纯函数，它只返回一个 动作 对象，并 _不会_ 命令式地发送一个事件。
:::

```js
import { createMachine, send } from 'xstate';

const lazyStubbornMachine = createMachine({
  id: 'stubborn',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: {
          target: 'active',
          // 再次向服务发送 TOGGLE 事件
          actions: send('TOGGLE')
        }
      }
    },
    active: {
      on: {
        TOGGLE: { target: 'inactive' }
      }
    }
  }
});

const nextState = lazyStubbornMachine.transition('inactive', {
  type: 'TOGGLE'
});

nextState.value;
// => 'active'
nextState.actions;
// => [{ type: 'xstate.send', event: { type: 'TOGGLE' }}]

// 该服务将继续向自己发送 { type: 'TOGGLE' } 事件。
```

传递给 `send(event)` 的 `event` 参数可以是：

- 一个字符串事件，例如 `send('TOGGLE')`
- 一个对象事件，例如 `send({ type: 'TOGGLE', payload: ... })`
- 一个事件表达式，它是一个函数，它接收触发 `send()` 动作 的当前 `context` 和 `event`，并返回一个事件对象：

```js
import { send } from 'xstate';

// 人为的例子 - 从 `context` 读取并发送动态创建的事件
const sendName = send((context, event) => ({
  type: 'NAME',
  name: context.user.name
}));

const machine = createMachine({
  // ...
  on: {
    TOGGLE: {
      actions: sendName
    }
  }
  //...
});
```

### 发送目标

从 `send(...)` 动作 创建者发送的事件，可以表示它应该发送到特定目标，例如 [调用 服务](./communication.md) 或 [创建 演员](./actors.md)。 这是通过在 `send(...)` 操作中指定 `{ to: ... }` 属性来完成的：

```js
// ...
invoke: {
  id: 'some-service-id',
  src: 'someService',
  // ...
},
// ...
// 表示向调用的服务发送 { type: 'SOME_EVENT' }
actions: send({ type: 'SOME_EVENT' }, { to: 'some-service-id' })
```

`to` 属性中的 target 也可以是一个 **target 表达式**，它是一个函数，它接受当前触发动作的 `context` 和 `event`，并返回一个字符串 target 或一个 [演员](./actors.md#spawning-actors):

```js
entry: assign({
  someActor: () => {
    return spawn(someMachine, 'some-actor-name');
  }
}),
  // ...

  // 发送 { type: 'SOME_EVENT' } 到 演员 引用
  {
    actions: send(
      { type: 'SOME_EVENT' },
      {
        to: (context) => context.someActor
      }
    )
  };
```

::: warning
同样，`send(...)` 函数是一个 动作 创建者，**不会命令式发送事件。** 相反，它返回一个 动作 对象，描述事件将发送到的位置：

```js
console.log(send({ type: 'SOME_EVENT' }, { to: 'child' }));
// logs:
// {
//   type: 'xstate.send',
//   to: 'child',
//   event: {
//     type: 'SOME_EVENT'
//   }
// }
```

:::

要从子状态机发送到父状态机，请使用 `sendParent(event)`（采用与 `send(...)` 相同的参数）。

## 升高动作（raise action）

`raise()` 动作 创建者在内部事件队列中，将一个事件排入状态图。 这意味着事件会在 解释（interpret） 的当前“步骤”上立即发送。

| 参数    | 类型                   | 描述         |
| ------- | ---------------------- | ------------ |
| `event` | string or event object | 要提升的事件 |

```js
import { createMachine, raise } from 'xstate';

const raiseActionDemo = createMachine({
  id: 'raisedmo',
  initial: 'entry',
  states: {
    entry: {
      on: {
        STEP: {
          target: 'middle'
        },
        RAISE: {
          target: 'middle',
          // 立即为“middle”调用 NEXT 事件
          actions: raise({ type: 'NEXT' })
        }
      }
    },
    middle: {
      on: {
        NEXT: { target: 'last' }
      }
    },
    last: {
      on: {
        RESET: { target: 'entry' }
      }
    }
  }
});
```

单击 [visualizer](https://stately.ai/viz?gist=fd763ff2c161b172f719891e2544d428) 中的“STEP”和“RAISE”事件以查看差异。

## 响应动作 （respond action） <Badge text="4.7+" />

`respond()` 动作 创建者创建一个 [`send()` 动作](#send-action)，该 动作 被发送到，触发响应的事件的服务。

这在内部使用 [SCXML 事件](./scxml.md#events) ，从事件中获取 `origin`，并将 `send()` 动作 的 `to` 设置为 `origin`。

| 参数       | 类型                                     | 描述                       |
| ---------- | ---------------------------------------- | -------------------------- |
| `event`    | string, event object, or send expression | 发送回发件人的事件         |
| `options?` | send options object                      | 传递到 `send()` 事件的选项 |

### 使用响应 action 的示例

这演示了一些父服务（`authClientMachine`）向调用的 `authServerMachine` 发送一个 `'CODE'` 事件，并且 `authServerMachine` 响应一个 `'TOKEN'` 事件。

```js
const authServerMachine = createMachine({
  initial: 'waitingForCode',
  states: {
    waitingForCode: {
      on: {
        CODE: {
          actions: respond({ type: 'TOKEN' }, { delay: 10 })
        }
      }
    }
  }
});

const authClientMachine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        AUTH: { target: 'authorizing' }
      }
    },
    authorizing: {
      invoke: {
        id: 'auth-server',
        src: authServerMachine
      },
      entry: send('CODE', { to: 'auth-server' }),
      on: {
        TOKEN: { target: 'authorized' }
      }
    },
    authorized: {
      type: 'final'
    }
  }
});
```

详情请参阅 [📖 发送响应](./actors.md#sending-responses)。

## 转发动作（forwardTo action） <Badge text="4.7+" />

`forwardTo()` 动作 创建者，创建一个 [`send()` 动作](#send-action)，通过其 ID 将最近的事件转发到指定的服务。

| 参数     | 类型                                    | 描述                           |
| -------- | --------------------------------------- | ------------------------------ |
| `target` | string or function that returns service | 要将最近事件发送到的目标服务。 |

### 使用 forwardTo 动作 的示例

```js
import { createMachine, forwardTo, interpret } from 'xstate';

function alertService(_, receive) {
  receive((event) => {
    if (event.type === 'ALERT') {
      alert(event.message);
    }
  });
}

const parentMachine = createMachine({
  id: 'parent',
  invoke: {
    id: 'alerter',
    src: () => alertService
  },
  on: {
    ALERT: { actions: forwardTo('alerter') }
  }
});

const parentService = interpret(parentMachine).start();

parentService.send({ type: 'ALERT', message: 'hello world' });
// => alerts "hello world"
```

## 错误升级动作（escalate action） <Badge text="4.7+" />

`escalate()` 动作 创建者，通过将错误发送到父状态机来升级错误。 这是作为状态机识别的特殊错误事件发送的。

| 参数        | 类型 | 描述                             |
| ----------- | ---- | -------------------------------- |
| `errorData` | any  | 要升高（send）到父级的错误数据。 |

### 使用 escalate 动作 的示例

```js
import { createMachine, actions } from 'xstate';
const { escalate } = actions;

const childMachine = createMachine({
  // ...
  // 这将被发送到调用这个孩子的父状态机
  entry: escalate({ message: 'This is some error' })
});

const parentMachine = createMachine({
  // ...
  invoke: {
    src: childMachine,
    onError: {
      actions: (context, event) => {
        console.log(event.data);
        //  {
        //    type: ...,
        //    data: {
        //      message: 'This is some error'
        //    }
        //  }
      }
    }
  }
});
```

## 日志动作（log action）

`log()` 动作 创建器是一种记录与当前状态 `context` 和/或 `event` 相关的任何内容的声明方式。 它需要两个可选参数：

| 参数     | 类型               | 描述                                                                               |
| -------- | ------------------ | ---------------------------------------------------------------------------------- |
| `expr?`  | string or function | 一个简单的字符串或一个函数，它以 `context` 和 `event` 作为参数并返回一个要记录的值 |
| `label?` | string             | 用于标记已记录消息的字符串                                                         |

```js {9,14-17,28-34}
import { createMachine, actions } from 'xstate';
const { log } = actions;

const loggingMachine = createMachine({
  id: 'logging',
  context: { count: 42 },
  initial: 'start',
  states: {
    start: {
      entry: log('started!'),
      on: {
        FINISH: {
          target: 'end',
          actions: log(
            (context, event) => `count: ${context.count}, event: ${event.type}`,
            'Finish label'
          )
        }
      }
    },
    end: {}
  }
});

const endState = loggingMachine.transition('start', { type: 'FINISH' });

endState.actions;
// [
//   {
//     type: 'xstate.log',
//     label: 'Finish label',
//     expr: (context, event) => ...
//   }
// ]

// interpreter 将根据当前状态上下文和事件记录 Action 的表达式。
```

没有任何参数，`log()` 是一个 动作，它记录一个具有 `context` 和 `event` 属性的对象，分别包含当前上下文和触发事件。

## 选择动作（choose action）

`choose()` 动作 创建者创建一个 动作，该 动作 指定应根据某些条件执行哪些 动作。

| 参数    | 类型  | 描述                                                                |
| ------- | ----- | ------------------------------------------------------------------- |
| `conds` | array | 当给定的 `cond` 为真时，包含要执行的 `actions` 的对象数组（见下文） |

**返回:**

一个特殊的 `"xstate.choose"` 动作 对象，它在内部进行判断以有条件地确定应该执行哪些动作对象。

`cond` 中的每个“条件动作”对象都具有以下属性：

- `actions` - 要执行的 动作 对象
- `cond?` - 执行这些 `actions` 的条件

::: warning
不要使用 `choose()` 动作 创建器来执行 动作，否则这些 动作 可能表示为通过 `entry`、`exit` 或 `actions` 在某些 状态/转换 中执行的非条件 动作。
:::

```js
import { actions } from 'xstate';

const { choose, log } = actions;

const maybeDoThese = choose([
  {
    cond: 'cond1',
    actions: [
      // 当“cond1”为真时
      log('cond1 chosen!')
    ]
  },
  {
    cond: 'cond2',
    actions: [
      // 当“cond1”为假且“cond2”为真时
      log((context, event) => {
        /* ... */
      }),
      log('another action')
    ]
  },
  {
    cond: (context, event) => {
      // 一些条件
      return false;
    },
    actions: [
      // 当“cond1”和“cond2”为假并且内联`cond`为真时
      (context, event) => {
        // 一些其他 action
      }
    ]
  },
  {
    actions: [
      log('fall-through action')
      // 当“cond1”、“cond2”和“cond3”为假时
    ]
  }
]);
```

这类似于 SCXML `<if>`、`<elseif>` 和 `<else>` 元素： [www.w3.org/TR/scxml/#if](https://www.w3.org/TR/scxml/#if)

## 纯动作（pure action）

`pure()` 动作 创建器是一个纯函数（因此得名），它根据触发 动作 的当前状态“上下文”和“事件”返回要执行的 动作 对象。 这允许你动态定义应执行哪些 动作

| 参数         | 类型     | 描述                                                                 |
| ------------ | -------- | -------------------------------------------------------------------- |
| `getActions` | function | 根据给定的 `context` 和 `event` 返回要执行的动作对象的函数（见下文） |

**返回:**

一个特殊的 `"xstate.pure"` 动作 对象，它将在内部判断 `get` 属性以确定应该执行的 动作 对象。

`getActions(context, event)` 参数:

| 参数      | 类型         | 描述                 |
| --------- | ------------ | -------------------- |
| `context` | object       | 当前状态的 `context` |
| `event`   | event object | 触发 动作 的事件对象 |

**返回:**

单个 动作 对象、一组 动作 对象或不代表任何 动作 对象的 `undefined`。

```js
import { createMachine, actions } from 'xstate';

const { pure } = actions;

// 动态地向每个调用的示例 actor 发送一个事件
const sendToAllSampleActors = pure((context, event) => {
  return context.sampleActors.map((sampleActor) => {
    return send('SOME_EVENT', { to: sampleActor });
  });
});
// => {
//   type: ActionTypes.Pure,
//   get: () => ... // 计算为 send() action 数组
// }

const machine = createMachine({
  // ...
  states: {
    active: {
      entry: sendToAllSampleActors
    }
  }
});
```

## 自转换动作

[自转换](./transitions.md#self-transitions) 是当状态转换到自身时，它 _可能_ 退出然后重新进入自身。 自转换可以是 **内部** 或 **外部** 转换：

- 内部转换将 _不_ 退出并重新进入自身，因此状态节点的“进入”和“退出”动作将不会再次执行。
  - 内部转换用 `{ internal: true }` 表示，或者将 `target` 保留为 `undefined`。
  - 将执行在转换的 `actions` 属性上定义的 动作。
- 外部转换 _将_ 退出并重新进入自身，因此状态节点的`entry` 和`exit` action 将再次执行。
  - 默认情况下，所有转换都是外部的。 为了明确起见，你可以使用 `{ internal: false }` 来指示它们。
  - 将执行在转换的 `actions` 属性上定义的 动作。

例如，这个计数器状态机，有一个带有内部和外部转换的 `'counting'` 状态：

```js {9-12}
const counterMachine = createMachine({
  id: 'counter',
  initial: 'counting',
  states: {
    counting: {
      entry: 'enterCounting',
      exit: 'exitCounting',
      on: {
        // 自转换
        INC: { actions: 'increment' }, // 内部（隐式）
        DEC: { target: 'counting', actions: 'decrement' }, // 外部
        DO_NOTHING: { internal: true, actions: 'logNothing' } // 内部（隐式）
      }
    }
  }
});

// 外部转换（退出+ 转换action +进入）
const stateA = counterMachine.transition('counting', { type: 'DEC' });
stateA.actions;
// ['exitCounting', 'decrement', 'enterCounting']

// 内部转换（转换动作）
const stateB = counterMachine.transition('counting', { type: 'DO_NOTHING' });
stateB.actions;
// ['logNothing']

const stateC = counterMachine.transition('counting', { type: 'INC' });
stateB.actions;
// ['increment']
```
