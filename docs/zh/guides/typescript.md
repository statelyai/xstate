## 使用 TypeScript

由于 XState 是用 [TypeScript](https://www.typescriptlang.org/) 编写的，也建议你在编写状态图的时候使用它。 下面是一个轻型状态机示例：

```typescript
// 状态机处理的事件
type LightEvent =
  | { type: 'TIMER' }
  | { type: 'POWER_OUTAGE' }
  | { type: 'PED_COUNTDOWN'; duration: number };

// 状态机的上下文（扩展状态）
interface LightContext {
  elapsed: number;
}

const lightMachine = createMachine<LightContext, LightEvent>({
  key: 'light',
  initial: 'green',
  context: { elapsed: 0 },
  states: {
    green: {
      on: {
        TIMER: { target: 'yellow' },
        POWER_OUTAGE: { target: 'red' }
      }
    },
    yellow: {
      on: {
        TIMER: { target: 'red' },
        POWER_OUTAGE: { target: 'red' }
      }
    },
    red: {
      on: {
        TIMER: { target: 'green' },
        POWER_OUTAGE: { target: 'red' }
      },
      initial: 'walk',
      states: {
        walk: {
          on: {
            PED_COUNTDOWN: { target: 'wait' }
          }
        },
        wait: {
          on: {
            PED_COUNTDOWN: {
              target: 'stop',
              cond: (context, event) => {
                return event.duration === 0 && context.elapsed > 0;
              }
            }
          }
        },
        stop: {
          // 瞬态过渡
          always: {
            target: '#light.green'
          }
        }
      }
    }
  }
});
```

提供上下文和事件作为 `createMachine()` 函数的通用参数有很多优点：

- 上下文类型/接口（`TContext`）被传递给动作、守卫、服务等。 它也被传递到深度嵌套的状态。
- 事件类型 (`TEvent`) 确保在转换配置中只使用指定的事件（和内置的 XState 特定事件）。 提供的事件对象形状也传递给动作、守卫和服务。
- 你发送到状态机的事件将是强类型的，让你对接收的有效数据形态更有信心。

## 配置对象

`MachineConfig<TContext, any, TEvent>` 的通用类型与 `createMachine<TContext, TEvent>` 的通用类型相同。 当你定义 `createMachine(...)` 函数的状态机配置对象 _外_ 时，这很有用，并有助于防止 [推理错误](https://github.com/statelyai/xstate/issues/310)：

```ts
import { MachineConfig } from 'xstate';

const myMachineConfig: MachineConfig<TContext, any, TEvent> = {
  id: 'controller',
  initial: 'stopped',
  states: {
    stopped: {
      /* ... */
    },
    started: {
      /* ... */
    }
  }
  // ...
};
```

## 类型状态 <Badge text="4.7+" />

类型状态是一个概念，它根据状态 `value` 缩小整体状态 `context` 的形状。 这有助于防止不可能的状态并缩小 `context` 在给定状态下的范围，而不必编写过多的断言。

`Typestate` 是一个由两个属性组成的接口：

- `value` - 类型状态的状态值（复合状态应该使用对象语法引用；例如，`{ idle: 'error' }` 而不是 `"idle.error"`）
- `context` - 当状态与给定的 `value` 匹配时，类型状态的缩小上下文

状态机的类型状态在 `createMachine<TContext, TEvent, TTypestate>` 中被指定为第三个泛型类型。

**示例:**

```ts
import { createMachine, interpret } from 'xstate';

interface User {
  name: string;
}

interface UserContext {
  user?: User;
  error?: string;
}

type UserEvent =
  | { type: 'FETCH'; id: string }
  | { type: 'RESOLVE'; user: User }
  | { type: 'REJECT'; error: string };

type UserTypestate =
  | {
      value: 'idle';
      context: UserContext & {
        user: undefined;
        error: undefined;
      };
    }
  | {
      value: 'loading';
      context: UserContext;
    }
  | {
      value: 'success';
      context: UserContext & { user: User; error: undefined };
    }
  | {
      value: 'failure';
      context: UserContext & { user: undefined; error: string };
    };

const userMachine = createMachine<UserContext, UserEvent, UserTypestate>({
  id: 'user',
  initial: 'idle',
  states: {
    idle: {
      /* ... */
    },
    loading: {
      /* ... */
    },
    success: {
      /* ... */
    },
    failure: {
      /* ... */
    }
  }
});

const userService = interpret(userMachine);

userService.subscribe((state) => {
  if (state.matches('success')) {
    // 从 UserState 类型状态，将定义 `user`
    state.context.user.name;
  }
});
```

::: warning
复合状态应该对所有父状态值进行显式建模，以避免在测试子状态时出现类型错误。

```typescript
type State =
  /* ... */
  | {
      value: 'parent';
      context: Context;
    }
  | {
      value: { parent: 'child' };
      context: Context;
    };
/* ... */
```

如果两个状态具有相同的上下文类型，则可以通过对值使用类型联合来合并它们的声明。

```typescript
type State =
  /* ... */
  {
    value: 'parent' | { parent: 'child' };
    context: Context;
  };
/* ... */
```

:::

## 故障排除

XState 和 TypeScript 存在一些已知的限制。 我们喜欢 TypeScript，我们不断地努力使其在 XState 中获得更好的体验。

以下是一些已知问题，所有这些问题都可以解决：

### 状态机选项中的事件

当你使用 `createMachine` 时，你可以将实现传递给配置中的命名 动作/服务/守卫。 例如：

```ts
interface Context {}

type Event =
  | { type: 'EVENT_WITH_FLAG'; flag: boolean }
  | {
      type: 'EVENT_WITHOUT_FLAG';
    };

createMachine<Context, Event>(
  {
    on: {
      EVENT_WITH_FLAG: {
        actions: 'consoleLogData'
      }
    }
  },
  {
    actions: {
      consoleLogData: (context, event) => {
        // 这将在 .flag 处出错
        console.log(event.flag);
      }
    }
  }
);
```

这个错误的原因是因为在 `consoleLogData` 函数内部，我们不知道是哪个事件导致它被触发。 管理这个最简洁的方法是自己断言事件类型。

```ts
createMachine<Context, Event>(machine, {
  actions: {
    consoleLogData: (context, event) => {
      if (event.type !== 'EVENT_WITH_FLAG') return
      // .flag 不再有错误！
      console.log(event.flag);
    };
  }
})
```

有时也可以内联动作实现。

```ts
createMachine<Context, Event>({
  on: {
    EVENT_WITH_FLAG: {
      actions: (context, event) => {
        // 不再出错，因为我们知道哪个事件负责调用这个动作
        console.log(event.flag);
      }
    }
  }
});
```

这种方法并不适用于所有情况。 动作失去了它的名字，所以在可视化器中看起来不太好。 这也意味着如果操作在多个位置重复，你需要将其复制粘贴到所有需要的位置。

### 进入动作中的事件类型

内联输入动作中的事件。 考虑这个例子：

```ts
interface Context {}

type Event =
  | { type: 'EVENT_WITH_FLAG'; flag: boolean }
  | {
      type: 'EVENT_WITHOUT_FLAG';
    };

createMachine<Context, Event>({
  initial: 'state1',
  states: {
    state1: {
      on: {
        EVENT_WITH_FLAG: {
          target: 'state2'
        }
      }
    },
    state2: {
      entry: [
        (context, event) => {
          // 这将在 .flag 处出错
          console.log(event.flag);
        }
      ]
    }
  }
});
```

在这里，我们不知道是什么事件导致了 `state2` 上的 `entry` 动作。 解决此问题的唯一方法是执行与上述类似的技巧：

```ts
entry: [
  (context, event) => {
    if (event.type !== 'EVENT_WITH_FLAG') return;
    // .flag 不再有错误！
    console.log(event.flag);
  }
];
```

### 状态机选项中的 `onDone`/`onError` 事件

基于 Promise 的服务的结果很难在 XState 中安全地输入。 例如，这样的状态机：

```ts
interface Data {
  flag: boolean;
}

interface Context {}

type Event = {
  // 在此处添加以显示 TS 错误
  type: 'UNUSED_EVENT';
};

createMachine<Context, Event>(
  {
    invoke: {
      src: async () => {
        const data: Data = {
          flag: true
        };
        return data;
      },
      onDone: {
        actions: 'consoleLogData'
      },
      onError: {
        actions: 'consoleLogError'
      }
    }
  },
  {
    actions: {
      consoleLogData: (context, event) => {
        // 此行出错 - 数据不存在！
        console.log(event.data.flag);
      },
      consoleLogError: (context, event) => {
        // 此行出错 - 数据不存在！
        console.log(event.data);
      }
    }
  }
);
```

令人沮丧的是，解决此问题的最佳方法是将 `event` 转换为 `any` 并根据我们知道的内容重新分配它：

```ts
import { DoneInvokeEvent, ErrorPlatformEvent } from 'xstate'

actions: {
  consoleLogData: (context, _event: any) => {
    const event: DoneInvokeEvent<Data> = _event;
    console.log(event.data.flag);
  },
  consoleLogError: (context, _event: any) => {
    const event: ErrorPlatformEvent = _event;
    // Event.data 通常是 `Error` 类型
    console.log(event.data.message);
  }
}
```

### 分配行为异常

在 `strict: true` 模式下运行时，分配操作有时会表现得非常奇怪。

```ts
interface Context {
  something: boolean;
}

createMachine<Context>({
  context: {
    something: true
  },
  entry: [
    // 输入 'AssignAction<{ something: false; }, AnyEventObject>' 不可分配给类型 'string'。
    assign(() => {
      return {
        something: false
      };
    }),
    // 输入 'AssignAction<{ something: false; }, AnyEventObject>' 不可分配给类型 'string'。
    assign({
      something: false
    }),
    // 输入 'AssignAction<{ something: false; }, AnyEventObject>' 不可分配给类型 'string'。
    assign({
      something: () => false
    })
  ]
});
```

看起来你尝试的任何方法都不起作用，所有语法都有问题。 修复很奇怪，但始终如一。 将未使用的 `context` 参数添加到 assign 函数的第一个参数。

```ts
entry: [
  // 没有更多的错误！
  assign((context) => {
    return {
      something: false,
    };
  }),
  // 没有更多的错误！
  assign({
    something: (context) => false,
  }),
  // 不幸的是，此技术不适用于此语法
  // assign({
  //   something: false
  // }),
],
```

这是一个需要修复的严重错误，涉及将我们的代码库移动到严格模式，但我们计划在 V5 中进行。

### `keyofStringsOnly`

如果你看到此错误：

```

输入错误：输入'string | number' 不满足约束 'string'。
'number' 类型不能分配给 'string' 类型。 TS2344
```

确保你的 tsconfig 文件不包含 `"keyofStringsOnly": true,`。
