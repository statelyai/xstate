# 延迟事件 和 转换

可以使用状态图以声明方式处理延迟和超时。 要了解更多信息，请参阅我们的 [状态图简介](./introduction-to-state-machines-and-statecharts/index.md#delayed-transitions) 中的部分。

## 延迟转换

可以在延迟后自动进行转换。 这在 `after` 属性中的状态定义中表示，它将毫秒延迟映射到它们的转换：

```js
const lightDelayMachine = createMachine({
  id: 'lightDelay',
  initial: 'green',
  states: {
    green: {
      after: {
        // 1 秒后，过渡到 yellow
        1000: { target: 'yellow' }
      }
    },
    yellow: {
      after: {
        // 0.5 秒后，过渡到 red
        500: { target: 'red' }
      }
    },
    red: {
      after: {
        // 2 秒后，过渡到 green
        2000: { target: 'green' }
      }
    }
  }
});
```

延迟转换的指定方式与你在 `on: ...` 属性上指定它们的方式相同。 它们可以是明确的：

```js
// ...
states: {
  green: {
    after: {
      1000: { target: 'yellow' }
    }
  }
}
// ...
```

延迟转换也可以是关于单个延迟值的条件：

```js
// ...
states: {
  green: {
    after: {
      1000: [
        { target: 'yellow', cond: 'trafficIsLight' },
        { target: 'green' } // 重新进入 'green' 状态
      ]
    }
  }
}
// ...
```

或者延迟转换可以是多个延迟的条件。 将采用第一个选定的延迟转换，这将防止采用后面的转换。 在以下示例中，如果 `'trafficIsLight'` 条件为 `true`，则不会采用后面的 `2000: 'yellow'` 转换：

```js
// ...
states: {
  green: {
    after: {
      1000: { target: 'yellow', cond: 'trafficIsLight' },
      2000: { target: 'yellow' } // 始终在 2 秒后转换为“yellow”
    }
  }
}
// ...
```

条件延迟转换也可以指定为数组：

```js
// ...
states: {
  green: {
    after: [
      { delay: 1000, target: 'yellow', cond: 'trafficIsLight' },
      { delay: 2000, target: 'yellow' }
    ];
  }
}
// ...
```

### 转换的延迟表达式 <Badge text="4.4+" />

在 `after: { ... }` 属性上指定的延迟转换可以具有动态延迟，由字符串延迟引用指定：

```js
const lightDelayMachine = createMachine(
  {
    id: 'lightDelay',
    initial: 'green',
    context: {
      trafficLevel: 'low'
    },
    states: {
      green: {
        after: {
          // 1 秒后，过渡到 yellow
          LIGHT_DELAY: { target: 'yellow' }
        }
      },
      yellow: {
        after: {
          YELLOW_LIGHT_DELAY: { target: 'red' }
        }
      }
      // ...
    }
  },
  {
    // 此处配置的字符串延迟
    delays: {
      LIGHT_DELAY: (context, event) => {
        return context.trafficLevel === 'low' ? 1000 : 3000;
      },
      YELLOW_LIGHT_DELAY: 500 // 静态值
    }
  }
);
```

或者直接通过函数，就像条件延迟转换一样：

```js
// ...
green: {
  after: [
    {
      delay: (context, event) => {
        return context.trafficLevel === 'low' ? 1000 : 3000;
      },
      target: 'yellow'
    }
  ]
},
// ...
```

但是，更喜欢使用字符串延迟引用，就像第一个示例一样，或者在 `delay` 属性中：

```js
// ...
green: {
  after: [
    {
      delay: 'LIGHT_DELAY',
      target: 'yellow'
    }
  ]
},
// ...
```

## 延迟事件

如果你只想在延迟后发送事件，你可以在 `send(...)` 动作创建器的第二个参数中指定 `delay` 作为选项：

```js
import { actions } from 'xstate';
const { send } = actions;

// 1 秒后发送 'TIMER' 事件的动作
const sendTimerAfter1Second = send({ type: 'TIMER' }, { delay: 1000 });
```

你还可以通过取消这些延迟事件来防止它们被发送。 这是通过`cancel(...)`动作创建器完成的：

```js
import { actions } from 'xstate';
const { send, cancel } = actions;

// 1 秒后发送 'TIMER' 事件的动作
const sendTimerAfter1Second = send(
  { type: 'TIMER' },
  {
    delay: 1000,
    id: 'oneSecondTimer' // 给事件一个唯一的 ID
  }
);

const cancelTimer = cancel('oneSecondTimer'); // 传递事件的ID来取消

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      entry: sendTimerAfter1Second,
      on: {
        TIMER: { target: 'active' },
        CANCEL: { actions: cancelTimer }
      }
    },
    active: {}
  }
});

// 如果 CANCEL 事件在 1 秒之前发送，则 TIMER 事件将被取消。
```

## 延迟表达式 <Badge text="4.3+" />

`delay` 选项也可以作为延迟表达式求值，它是一个函数，它接收触发 `send()` 动作的当前 `context` 和 `event`，并返回已解决的 `delay`（以毫秒为单位） )：

```js
const dynamicDelayMachine = createMachine({
  id: 'dynamicDelay',
  context: {
    initialDelay: 1000
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        ACTIVATE: { target: 'pending' }
      }
    },
    pending: {
      entry: send(
        { type: 'FINISH' },
        {
          // 延迟由自定义 event.wait 属性确定
          delay: (context, event) => context.initialDelay + event.wait || 0
        }
      ),
      on: {
        FINISH: { target: 'finished' }
      }
    },
    finished: { type: 'final' }
  }
});

const dynamicDelayService = interpret(dynamicDelayMachine);
dynamicDelayService.subscribe({ complete: () => console.log('done!') });
dynamicDelayService.start();

dynamicDelayService.send({
  type: 'ACTIVATE',
  // 任意属性
  wait: 2000
});

// 3000 毫秒（1000 + 2000）后，控制台将记录：
// => 'done!'
```

## 解释

使用 XState [解释](./interpretation.md)，延迟动作将使用原生`setTimeout` 和 `clearTimeout` 函数：

```js
import { interpret } from 'xstate';

const service = interpret(lightDelayMachine).onTransition((state) =>
  console.log(state.value)
);

service.start();
// => 'green'

// (1 秒之后)

// => 'yellow'
```

为了测试，XState 解释提供了一个 `SimulatedClock`：

```js
import { interpret } from 'xstate';
// import { SimulatedClock } from 'xstate/lib/interpreter'; // < 4.6.0
import { SimulatedClock } from 'xstate/lib/SimulatedClock'; // >= 4.6.0

const service = interpret(lightDelayMachine, {
  clock: new SimulatedClock()
}).onTransition((state) => console.log(state.value));

service.start();
// => 'green'

// 将 SimulatedClock 向前移动 1 秒
service.clock.increment(1000);
// => 'yellow'
```

你可以创建自己的“时钟”以提供给解释。 时钟接口是一个具有两个函数/方法的对象：

- `setTimeout` - 与 `window.setTimeout(fn, timeout)` 相同的参数
- `clearTimeout` - 与 `window.clearTimeout(id)` 相同的参数

## 幕后花絮

`after: ...` 属性不会为状态图语义引入任何新内容。 相反，它会创建如下所示的正常转换：

```js
// ...
states: {
  green: {
    entry: [
      send({ type: after(1000, 'light.green') }, { delay: 1000 }),
      send({ type: after(2000, 'light.green') }, { delay: 2000 })
    ],
    onExit: [
      cancel(after(1000, 'light.green')),
      cancel(after(2000, 'light.green'))
    ],
    on: {
      [after(1000, 'light.green')]: {
        target: 'yellow',
        cond: 'trafficIsLight'
      },
      [after(2000, 'light.green')]: {
        target: 'yellow'
      }
    }
  }
}
// ...
```

解释后的状态图将在 `delay` 之后 `send(...)` `after(...)` 事件，退出状态节点，则将 `cancel(...)` 那些延迟的 `send(...)` 事件。
