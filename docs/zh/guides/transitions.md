# 转换 Transitions

转换定义了状态机如何对 [事件](./events.md) 做出响应。 要了解更多信息，请参阅 [状态图介绍](./introduction-to-state-machines-and-statecharts/index.md#transitions-and-events) 中的部分。

## API

状态转换在状态节点的 `on` 属性中定义，：

```js {11,14-16}
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        // 状态转换（简写）
        // 这相当于 { target: 'resolved' }
        RESOLVE: 'resolved',

        // 状态转换 (object)
        REJECT: {
          target: 'rejected'
        }
      }
    },
    resolved: {
      type: 'final'
    },
    rejected: {
      type: 'final'
    }
  }
});

const { initialState } = promiseMachine;

console.log(initialState.value);
// => 'pending'

const nextState = promiseMachine.transition(initialState, { type: 'RESOLVE' });

console.log(nextState.value);
// => 'resolved'
```

在上面的例子中，当状态机处于 `pending` 状态并且它接收到一个 `RESOLVE` 事件时，它会转换到 `resolved` 状态。

状态转换可以定义为：

- 一个字符串，例如 `RESOLVE: 'resolved'`
- 具有 `target` 属性的对象，例如 `RESOLVE: { target: 'resolved' }`,
- 转换对象数组，用于条件转换（请参阅 [守卫](./guards.md)）

## 状态机 `.transition` 方法

如上所示， `machine.transition(...)` 方法是一个纯函数，它接受两个参数：

- `state` - 要转换的 [状态](./states.md)
- `event` - 导致转换的 [事件](./events.md)

它返回一个新的 [`State` 实例](./states.md#state-definition)，这是采用当前状态和事件，启用的所有转换的结果。

```js {8}
const lightMachine = createMachine({
  /* ... */
});

const greenState = lightMachine.initialState;

// 根据当前状态和事件确定下一个状态
const yellowState = lightMachine.transition(greenState, { type: 'TIMER' });

console.log(yellowState.value);
// => 'yellow'
```

## 选择启用转换

**启用的转换** 是将根据当前状态和事件有条件地进行的转换。 当且仅当：

- 它在与当前状态值匹配的 [状态节点](./statenodes.md) 上定义
- 转换 [守卫](./guards.md)（`cond` 属性）得到条件满足（为 `true`）
- 它不会被更具体的 转换 所取代。

在 [分层状态机](./hierarchical.md) 中，转换的优先级取决于它们在树中的深度； 更深层次的转换更具体，因此具有更高的优先级。 这与 DOM 事件的工作方式类似：如果单击按钮，则直接在按钮上的单击事件处理程序比 `window` 上的单击事件处理程序更具体。

```js {10,21-22,27}
const wizardMachine = createMachine({
  id: 'wizard',
  initial: 'open',
  states: {
    open: {
      initial: 'step1',
      states: {
        step1: {
          on: {
            NEXT: { target: 'step2' }
          }
        },
        step2: {
          /* ... */
        },
        step3: {
          /* ... */
        }
      },
      on: {
        NEXT: { target: 'goodbye' },
        CLOSE: { target: 'closed' }
      }
    },
    goodbye: {
      on: {
        CLOSE: { target: 'closed' }
      }
    },
    closed: {
      type: 'final'
    }
  }
});

// { open: 'step1' }
const { initialState } = wizardMachine;

// 'open.step1' 上定义的 NEXT 转换取代了父'open'状态上定义的 NEXT 转换
const nextStepState = wizardMachine.transition(initialState, { type: 'NEXT' });
console.log(nextStepState.value);
// => { open: 'step2' }

// 'open.step1' 上没有 CLOSE 转换，因此事件被传递到父 'open' 状态，在那里它被定义
const closedState = wizardMachine.transition(initialState, { type: 'CLOSE' });
console.log(closedState.value);
// => 'closed'
```

## 事件描述符

事件描述符，是描述转换 将匹配的事件类型的字符串。 通常，这等效于发送到状态机的 `event` 对象上的 `event.type` 属性：

```js
// ...
{
  on: {
    // "CLICK"是事件描述符。
    // 此转换匹配具有 { type: 'CLICK' } 的事件
    CLICK: 'someState',
    // "SUBMIT"是事件描述符。
    // 此转换匹配具有 { type: 'SUBMIT' } 的事件
    SUBMIT: 'anotherState'
  }
}
// ...
```

其他事件描述符包括：

- [Null 事件描述](#transient-transitions) (`""`)，不匹配任何事件（即 "null" 事件），并表示进入状态后立即进行的转换
- [通配符事件描述](#wildcard-descriptors) (`"*"`) <Badge text="4.7+" />，如果事件没有被状态中的任何其他转换显式匹配，则匹配任何事件

## 自转换

自转换是当一个状态转换到自身时，它 _可以_ 退出然后重新进入自身。 自转换可以是 **内部** 或 **外部** 转换：

- **内部转换** 不会退出也不会重新进入自身，但可能会进入不同的子状态。
- **外部转换** 将退出并重新进入自身，也可能退出/进入子状态。

默认情况下，具有指定目标的所有转换都是外部的。

有关如何在自转换上执行进入/退出操作的更多详细信息，请参阅有关 [自转换的操作](./actions.md#actions-on-self-transitions)。

## 内部转换

内部转换是不退出其状态节点的转换。 内部转换是通过指定 [相对目标](./ids.md#relative-targets)（例如，`'.left'`）或通过在转换上显式设置 `{ internal: true }` 来创建的。 例如，考虑一台状态机将一段文本设置为对齐 `'left'`、 `'right'`、 `'center'`、或 `'justify'`：

```js {14-17}
import { createMachine } from 'xstate';

const wordMachine = createMachine({
  id: 'word',
  initial: 'left',
  states: {
    left: {},
    right: {},
    center: {},
    justify: {}
  },
  on: {
    // 内部转换
    LEFT_CLICK: '.left',
    RIGHT_CLICK: { target: '.right' }, // 同 '.right'
    CENTER_CLICK: { target: '.center', internal: true }, // 同 '.center'
    JUSTIFY_CLICK: { target: '.justify', internal: true } // 同 '.justify'
  }
});
```

上面的状态机将以 `'left'` 状态启动，并根据单击的内容在内部转换到其他子状态。 此外，由于转换是内部的，因此不会再次执行在父状态节点上定义的 `entry`, `exit` 或者任何其他的 `actions`。

具有 `{ target: undefined }` （或无 `target`）的转换也是内部转换：

```js {11-13}
const buttonMachine = createMachine({
  id: 'button',
  initial: 'inactive',
  states: {
    inactive: {
      on: { PUSH: 'active' }
    },
    active: {
      on: {
        // 无 target - 内部转换
        PUSH: {
          actions: 'logPushed'
        }
      }
    }
  }
});
```

**内部转换摘要：**

- `EVENT: '.foo'` - 内部转换到子状态
- `EVENT: { target: '.foo' }` - 内部转换到子状态（以`'.'`开头）
- `EVENT: undefined` - 禁止转换
- `EVENT: { actions: [ ... ] }` - 内部自转换
- `EVENT: { actions: [ ... ], internal: true }` - 内部自转换，同上
- `EVENT: { target: undefined, actions: [ ... ] }` - 内部自转换，同上

## 外部转换

外部转换 _将_ 退出并重新进入定义转换的状态节点。 在上面的例子中，父级 `word` 状态节点（根状态节点），将在其转换时执行 `exit` 和 `entry` 动作。

默认情况下，转换是外部的，但任何转换都可以通过在转换上显式设置 `{ internal: false }` 来实现。

```js {4-7}
// ...
on: {
  // 外部转换
  LEFT_CLICK: 'word.left',
  RIGHT_CLICK: 'word.right',
  CENTER_CLICK: { target: '.center', internal: false }, // 同 'word.center'
  JUSTIFY_CLICK: { target: 'word.justify', internal: false } // 同 'word.justify'
}
// ...
```

上面的每个转换都是外部的，并且将执行父状态的 `exit` 和 `entry` 操作。

**外部转换摘要：**

- `EVENT: { target: 'foo' }` - 所有对兄弟状态的转换都是外部转换
- `EVENT: { target: '#someTarget' }` - 到其他节点的所有转换都是外部转换
- `EVENT: { target: 'same.foo' }` - 外部转换到自己的子级节点（相当于`{ target: '.foo', internal: false }`）
- `EVENT: { target: '.foo', internal: false }` - 外部转换到子节点
  - 否则这将是一个内部转换
- `EVENT: { actions: [ ... ], internal: false }` - 外部自转换
- `EVENT: { target: undefined, actions: [ ... ], internal: false }` - 外部自转换，同上

## 瞬间转换

::: warning
空字符串语法 (`{ on: { '': ... } }`) 将在第 5 版中弃用。应该首选 4.11+ 版中新的 `always` 语法。请参阅下面关于 [无事件转换](#eventless-always-transitions) 的部分，它与瞬间转换相同。
:::

瞬间转换是由 [null 事件](./events.md#null-events) 触发的转换。 换句话说，只要满足任何条件，就会 _立即_ 进行转换（即，没有触发事件）：

```js {14-17}
const gameMachine = createMachine(
  {
    id: 'game',
    initial: 'playing',
    context: {
      points: 0
    },
    states: {
      playing: {
        on: {
          // 瞬间转换 如果满足条件，将在（重新）进入 'playing' 状态后立即转换为 'win' 或 'lose'。
          '': [
            { target: 'win', cond: 'didPlayerWin' },
            { target: 'lose', cond: 'didPlayerLose' }
          ],
          // 自转换
          AWARD_POINTS: {
            actions: assign({
              points: 100
            })
          }
        }
      },
      win: { type: 'final' },
      lose: { type: 'final' }
    }
  },
  {
    guards: {
      didPlayerWin: (context, event) => {
        // 检查玩家是否赢了
        return context.points > 99;
      },
      didPlayerLose: (context, event) => {
        // 检查玩家是否输了
        return context.points < 0;
      }
    }
  }
);

const gameService = interpret(gameMachine)
  .onTransition((state) => console.log(state.value))
  .start();

// 仍处于 'playing' 状态，因为不满足瞬间转换条件
// => 'playing'

// 当发送“AWARD_POINTS”时，会发生自我转换到“PLAYING”。
// 由于满足“didPlayerWin”条件，因此会进行到“win”的瞬间转换。
gameService.send({ type: 'AWARD_POINTS' });
// => 'win'
```

就像转换一样，可以将瞬间转换指定为单个转换（例如，`'': 'someTarget'`）或条件转换数组。 如果没有满足瞬间转换的条件转换，则状态机保持相同状态。

对于每次内部或外部转换，始终 "sent" 空事件。

## 无事件 ("Always") 转换 <Badge text="4.11+" />

无事件转换，是当状态机处于定义的状态，并且其 `cond` 守卫为 `true` 时 **始终进行** 的转换。 他们被检查：

- 立即进入状态节点
- 每次状态机接收到一个可操作的事件（无论该事件是触发内部转换还是外部转换）

无事件转换在状态节点的 `always` 属性上定义：

```js {14-17}
const gameMachine = createMachine(
  {
    id: 'game',
    initial: 'playing',
    context: {
      points: 0
    },
    states: {
      playing: {
        // 无事件转换
        // 如果条件满足，将在进入 'playing' 状态或接收到 AWARD_POINTS 事件后立即转换为 'win' 或 'lose'。
        always: [
          { target: 'win', cond: 'didPlayerWin' },
          { target: 'lose', cond: 'didPlayerLose' }
        ],
        on: {
          // 自转换
          AWARD_POINTS: {
            actions: assign({
              points: 100
            })
          }
        }
      },
      win: { type: 'final' },
      lose: { type: 'final' }
    }
  },
  {
    guards: {
      didPlayerWin: (context, event) => {
        // 检测玩家是否赢了
        return context.points > 99;
      },
      didPlayerLose: (context, event) => {
        // 检测玩家是否输了
        return context.points < 0;
      }
    }
  }
);

const gameService = interpret(gameMachine)
  .onTransition((state) => console.log(state.value))
  .start();

// 仍处于 'playing' 状态，因为不满足瞬间转换条件
// => 'playing'

// 当发送“AWARD_POINTS”时，会发生自我转换到“PLAYING”。
// 由于满足“didPlayerWin”条件，因此会进行到“win”的瞬间转换。
gameService.send({ type: 'AWARD_POINTS' });
// => 'win'
```

### 无事件 vs. 通配符转换

- [通配符转换](#wildcard-descriptors) 在进入状态节点时不被检查。 无事件转换是，在做任何其他事情之前（甚至在进入动作的守卫判断之前）的转换。
- 无事件转换的重新判断，由任何可操作的事件触发。 通配符转换的重新判断，仅由与显式事件描述符不匹配的事件触发。

::: warning

如果误用无事件转换，则有可能创建无限循环。
无事件转换应该使用 `target`、`cond` + `target`、`cond` + `actions` 或 `cond` + `target` + `actions` 来定义。 目标（如果已声明）应与当前状态节点不同。 没有 `target` 和 `cond` 的无事件转换将导致无限循环。 如果 `cond` 守卫不断返回 `true`，则带有 `cond` 和 `actions` 的转换可能会陷入无限循环。
:::

::: tip

当检查无事件转换时，它们的守卫会被重复判断，直到它们都返回 false，或者验证了具有目标的转换。 在此过程中，每当某个守卫判断为 `true` 时，其关联的操作将被执行一次。 因此，在单个微任务期间，可能会多次执行一些没有目标的转换。这与普通转换形成对比，在普通转换中，最多只能进行一个转换。

:::

## 禁止转换

在 XState 中，“禁止”转换是一种指定不应随指定事件发生状态转换的转换。 也就是说，在禁止转换上不应发生任何事情，并且该事件不应由父状态节点处理。

通过将 `target` 明确指定为 `undefined` 来进行禁止转换。 这与将其指定为没有操作的内部转换相同：

```js {3}
on: {
  // 禁止转换
  LOG: undefined,
  // same thing as...
  LOG: {
    actions: []
  }
}
```

例如，我们模拟所有事件都可以记录 log 数据，只在 userInfoPage 下不可以：

```js {15}
const formMachine = createMachine({
  id: 'form',
  initial: 'firstPage',
  states: {
    firstPage: {
      /* ... */
    },
    secondPage: {
      /* ... */
    },
    userInfoPage: {
      on: {
        // 明确禁止 LOG 事件执行任何操作或将任何转换，转换为任何其他状态
        LOG: undefined
      }
    }
  },
  on: {
    LOG: {
      actions: 'logTelemetry'
    }
  }
});
```

::: tip

请注意，在分层嵌套状态链中定义具有相同事件名称的多个转换时，将只采用最内部的转换。 在上面的例子中，这就是为什么一旦状态机到达 `userInfoPage` 状态，父 `LOG` 事件中定义的 `logTelemetry` 动作就不会执行。

:::

## 多个目标

基于单个事件的转换可以有多个目标状态节点。 这是不常见的，只有在状态节点合法时才有效； 例如，在复合状态节点中，转换到两个兄弟状态节点是非法的，因为（非并行）状态机在任何给定时间只能处于一种状态。

多个目标在 `target: [...]` 中被指定为一个数组，其中数组中的每个目标都是一个状态节点的相对键或 ID，就像单个目标一样。

```js {23}
const settingsMachine = createMachine({
  id: 'settings',
  type: 'parallel',
  states: {
    mode: {
      initial: 'active',
      states: {
        inactive: {},
        pending: {},
        active: {}
      }
    },
    status: {
      initial: 'enabled',
      states: {
        disabled: {},
        enabled: {}
      }
    }
  },
  on: {
    // 多目标
    DEACTIVATE: {
      target: ['.mode.inactive', '.status.disabled']
    }
  }
});
```

## 通配描述符 <Badge text="4.7+" />

使用通配符事件描述符 (`"*"`) 指定的转换由任何事件激活。 这意味着 _任何事件_ 都将匹配具有 `on: { "*": ... }` 的转换，并且如果守卫通过，则将采用该转换。

除非在数组中指定转换，否则将始终选择显式事件描述符而不是通配符事件描述符。 在这种情况下，转换的顺序决定了选择哪个转换。

```js {3,8}
// 对于 SOME_EVENT，将显式转换到“here”
on: {
  "*": "elsewhere",
  "SOME_EVENT": "here"
}

// 对于 SOME_EVENT，将采用通配符转换为“elsewhere”
on: [
  { event: "*", target: "elsewhere" },
  { event: "SOME_EVENT", target: "here" },
]
```

::: tip

通配符描述符的行为方式与 [瞬间转换](#transient-transitions)（具有空事件描述符）_不同_。 每当状态处于活动状态时都会立即进行瞬态转换，而通配符转换仍然需要将某些事件发送到其状态才能触发。

:::

**示例:**

```js {7,8}
const quietMachine = createMachine({
  id: 'quiet',
  initial: 'idle',
  states: {
    idle: {
      on: {
        WHISPER: undefined,
        // 在除 WHISPER 之外的任何事件中，转换到 'disturbed' 状态
        '*': 'disturbed'
      }
    },
    disturbed: {}
  }
});

quietMachine.transition(quietMachine.initialState, { type: 'WHISPER' });
// => State { value: 'idle' }

quietMachine.transition(quietMachine.initialState, { type: 'SOME_EVENT' });
// => State { value: 'disturbed' }
```

## FAQ

### 如何在转换中执行 if/else 逻辑？

有时，你会想说：

- 如果 _something_ 是真的，就进入这个状态
- 如果 _something else_ 为真，则转到此状态
- 否则，进入这个状态

你可以使用 [守卫转换](./guards.md#guarded-transitions) 来实现这一点。

### 我如何转换到 _任何_ 状态？

你可以通过为该状态提供自定义 ID 并使用 `target: '#customId'` 来转换到 _任何_ 状态。 你可以在此处阅读有关 [自定义 ID 的完整文档](./ids.md#custom-ids)。

这允许你从子状态转换到父级的兄弟状态，例如在本例中的 `CANCEL` 和 `done` 事件中：

<iframe src="https://stately.ai/viz/embed/835aee58-1c36-41d3-bb02-b56ceb06072e?mode=viz&panel=code&readOnly=1&showOriginalLink=1&controls=0&pan=0&zoom=0"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
