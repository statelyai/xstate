# 模型 Models

::: warning

The `createModel(...)` function is deprecated and will be removed in XState version 5. It is recommended to use [Typegen](https://stately.ai/blog/introducing-typescript-typegen-for-xstate) instead.

:::

在 XState 中，你可以使用 `createModel(...)` 在外部对状态机的 `context` 和 `events` 进行建模。 这提供了一种强类型`context` 和`events` 的便捷方式，以及未来事件创建、分配和其他实现细节的帮助。

使用 `createModel(...)` 是 _完全可选的_，旨在改善开发人员体验。 使用它的主要原因是：

- 以强类型的方式分离和组织 `context` 和 `events`
- 使用`assign(...)` 防止打字错误
- 指定事件创建者以更轻松、更安全地创建事件
- 可能与其他状态机共享模型
- 未来的开发者体验改进，例如指定 actions、guards 等。

## `createModel(...)`

`createModel(...)` 函数需要

| 参数              | 类型   | 描述                         |
| ----------------- | ------ | ---------------------------- |
| `initialContext`  | object | `context` 初始值             |
| `creators` (可选) | object | 一个包含各种事件创建者的对象 |

`creators` 对象包括以下属性：

| 参数     | 类型   | 描述                 |
| -------- | ------ | -------------------- |
| `events` | object | 包含事件创建者的对象 |

`creators.events` 对象的 key 是事件类型，value 是接受任意数量参数，并返回事件数据的函数。

## 模型 context

由于模型定义了状态机的 `context`，因此可以在状态机定义中使用模型的 `model.initialContext` 来设置其初始 `context`，并使用`model.assign`更新状态机的 `context`。

`model.assign` 函数被输入到模型 `context` 的形态，使其成为 `assign` 操作方便且类型安全的替代品。

```js
import { createModel } from 'xstate/lib/model';

const userModel = createModel({
  name: 'Someone',
  age: 0
});

// ...

const machine = userModel.createMachine({
  context: userModel.initialContext,
  // ...
  entry: userModel.assign({ name: '' })
});
```

## 模型 events

在模型中对状态机事件建模有两个好处：

- 可以通过调用`model.events.eventName(...)`来创建事件
- 为状态机定义提供类型信息，为动作定义提供特定于事件的类型安全

```ts
import { createModel } from 'xstate/lib/model';

const userModel = createModel(
  // 初始 context
  {
    name: 'David',
    age: 30
  },
  {
    // 创建事件
    events: {
      updateName: (value) => ({ value }),
      updateAge: (value) => ({ value }),
      anotherEvent: () => ({}) // 没有内容
    }
  }
);

const machine = userModel.createMachine(
  {
    context: userModel.initialContext,
    initial: 'active',
    states: {
      active: {
        on: {
          updateName: {
            actions: userModel.assign({
              name: (_, event) => event.value
            })
          },
          updateAge: {
            actions: 'assignAge'
          }
        }
      }
    }
  },
  {
    actions: {
      assignAge: userModel.assign({
        age: (_, event) => event.value // 推断
      })
    }
  }
);

// 这会发送以下事件：
// {
//   type: 'updateName',
//   value: 'David'
// }
const nextState = machine.transition(
  undefined,
  userModel.events.updateName('David')
);
```

## TypeScript

`createModel(...)` 函数推断以下类型：

- `context` 从 `createModel(initialContext, creators)` 中的第一个参数推断
- `events` 从 `createModel(initialContext, creators)` 中的 `creators.events` 推断

```ts
import { createModel } from 'xstate/lib/model';

const userModel = createModel(
  {
    name: 'David', // 推断为 `string`
    age: 30, // 推断为 `number`
    friends: [] as string[] // explicit type
  },
  {
    events: {
      updateName: (value: string) => ({ value }),
      updateAge: (value: number) => ({ value }),
      anotherEvent: () => ({}) // 没有内容
    }
  }
);

// Context 推断为:
// {
//   name: string;
//   age: number;
//   friends: string[];
// }

// Events 推断为:
// | { type: 'updateName'; value: string; }
// | { type: 'updateAge'; value: number; }
// | { type: 'anotherEvent'; }
```

### 从 model 创建一个状态机

不应在 `createMachine<TContext, TEvent>(...)` 中将 `context` 和 `event` 的类型显式指定为类型参数，而应该使用 `model.createMachine(...)` 方法：

```ts {0}
const machine = userModel.createMachine({
  context: userModel.initialContext,
  initial: 'active',
  states: {
    active: {
      on: {
        updateName: {
          actions: userModel.assign({
            name: (_, event) => event.value // 推断
          })
        }
      }
    }
  }
});
```

### 缩小分配事件类型

当在`options.actions`中引用`assign()`动作时，你可以在`model.assign(assignments, eventType)`的第二个参数中缩小该动作接受的事件类型：

```ts
const assignAge = userModel.assign(
  {
    //  `event.type` 仅限于 "updateAge"
    age: (_, event) => event.value // 推断为 `number`
  },
  'updateAge' // 限制“assignAge”操作允许的`event`
);

const machine = userModel.createMachine({
  context: userModel.initialContext,
  initial: 'active',
  states: {
    active: {
      on: {
        updateAge: {
          actions: assignAge
        }
      }
    }
  }
});
```

::: warning
分配具有缩小事件类型的动作 _不能_ 放置在`createMachine(configuration, options)`中状态机选项的`actions：{...}`属性内。 这是因为在 `options.actions` 中的操作应该被假定为可能接收 _任何_ 事件，即使状态机配置另有建议。
:::

### 从模型中提取类型

_从 4.22.1 开始_

你可以使用 `ContextFrom<T>` 和 `EventFrom<T>` 类型，从模型中提取 `context` 和 `event` 类型：

```ts {1,15-16}
import { ContextFrom, EventFrom } from 'xstate';
import { createModel } from 'xstate/lib/model';

const someModel = createModel(
  {
    /* ... */
  },
  {
    events: {
      /* ... */
    }
  }
);

type SomeContext = ContextFrom<typeof someModel>;
type SomeEvent = EventFrom<typeof someModel>;
```
