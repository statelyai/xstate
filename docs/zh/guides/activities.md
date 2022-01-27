# 活动 Activities

活动是随时间发生的操作，可以启动和停止。 根据 Harel 的原始状态图论文：

> 活动总是花费非零时间，例如发出哔哔声、显示或执行冗长的计算。

例如，一个在活动时发出“哔哔”声的开关可以用 `'beeping'` 活动表示：

```js
const toggleMachine = createMachine(
  {
    id: 'toggle',
    initial: 'inactive',
    states: {
      inactive: {
        on: {
          TOGGLE: { target: 'active' }
        }
      },
      active: {
        // 只要状态机处于 'active' 状态， 'beeping' 活动就会发生
        activities: ['beeping'],
        on: {
          TOGGLE: { target: 'inactive' }
        }
      }
    }
  },
  {
    activities: {
      beeping: () => {
        // 开始 beeping activity
        const interval = setInterval(() => console.log('BEEP!'), 1000);

        // 返回一个函数，用于停止 beeping activity
        return () => clearInterval(interval);
      }
    }
  }
);
```

在 XState 中，活动是在状态节点的 `activities` 属性上指定的。 当一个状态节点进入时，解释器应该**开始**它的活动，当它退出时，它应该**停止**它的活动。

为了确定哪些活动当前处于活动状态，`State` 有一个 `activities` 属性，如果活动开始（活动），它是活动名称到 `true` 的映射，如果活动停止，则映射到 `false`。

```js
const lightMachine = createMachine({
  key: 'light',
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
      // 'activateCrosswalkLight' 活动在进入 'light.red' 状态时启动，并在退出时停止。
      activities: ['activateCrosswalkLight'],
      on: {
        TIMER: { target: 'green' }
      },
      states: {
        walk: {
          on: {
            PED_WAIT: { target: 'wait' }
          }
        },
        wait: {
          // 'blinkCrosswalkLight' 活动在进入 'light.red.wait' 状态时启动，并在退出它或其父状态时停止。
          activities: ['blinkCrosswalkLight'],
          on: {
            PED_STOP: { target: 'stop' }
          }
        },
        stop: {}
      }
    }
  }
});
```

在上面的状态机配置中，当进入 `'light.red'` 状态时，`'activateCrosswalkLight'` 将启动。 它还将执行一个特殊的 `'xstate.start'` 动作，让 [服务](./interpretation.md) 知道它应该启动活动：

```js
const redState = lightMachine.transition('yellow', { type: 'TIMER' });

redState.activities;
// => {
//   activateCrosswalkLight: true
// }

redState.actions;
// 'activateCrosswalkLight' 活动已启动
// => [
//   { type: 'xstate.start', activity: 'activateCrosswalkLight' }
// ]
```

在同一个父状态内转换将 _不_ 重新启动它的活动，尽管它可能会启动新的活动：

```js
const redWaitState = lightMachine.transition(redState, { type: 'PED_WAIT' });

redWaitState.activities;
// => {
//   activateCrosswalkLight: true,
//   blinkCrosswalkLight: true
// }

redWaitState.actions;
// 'blinkCrosswalkLight' 活动已启动
// 注意：“activateCrosswalkLight”活动不会重新启动
// => [
//   { type: 'xstate.start', activity: 'blinkCrosswalkLight' }
// ]
```

离开一个状态将停止其活动：

```js
const redStopState = lightMachine.transition(redWaitState, {
  type: 'PED_STOP'
});

redStopState.activities;
// 'blinkCrosswalkLight' 活动已停止
// => {
//   activateCrosswalkLight: true,
//   blinkCrosswalkLight: false
// }

redStopState.actions;
// 'blinkCrosswalkLight' 活动已停止
// => [
//   { type: 'xstate.stop', activity: 'blinkCrosswalkLight' }
// ]
```

任何停止的活动只会停止一次：

```js
const greenState = lightMachine.transition(redStopState, { type: 'TIMER' });

green.activities;
// 没有激活的活动
// => {
//   activateCrosswalkLight: false,
//   blinkCrosswalkLight: false
// }

green.actions;
// 'activateCrosswalkLight' 活动已停止
// 注意：'blinkCrosswalkLight' 活动不会再次停止
// => [
//   { type: 'xstate.stop', activity: 'activateCrosswalkLight' }
// ]
```

## 解释

在状态机选项中，活动的“开始”和“停止”行为可以在 `activities` 属性中定义。 这是通过以下方式完成的：

- 传入一个**启动**活动的函数（作为副作用）
- 从该函数返回另一个**停止**活动的函数（也作为副作用）。

例如，下面是一个将 `'BEEP!'` 打印到控制台每个 `context.interval` 的 `'beeping'` 活动是如何实现的：

```js
function createBeepingActivity(context, activity) {
  // 开始哔哔活动
  const interval = setInterval(() => {
    console.log('BEEP!');
  }, context.interval);

  // 返回一个停止哔哔活动的函数
  return () => clearInterval(interval);
}
```

活动创建者总是被赋予两个参数：

- 当前`context`
- 定义的 `activity`
  - 例如，`{ type: 'beeping' }`

然后，你可以将其传递到 `activities` 属性下的状态机选项（第二个参数）中：

```js
const toggleMachine = createMachine(
  {
    id: 'toggle',
    initial: 'inactive',
    context: {
      interval: 1000 // 每秒 beep
    },
    states: {
      inactive: {
        on: {
          TOGGLE: { target: 'active' }
        }
      },
      active: {
        activities: ['beeping'],
        on: {
          TOGGLE: { target: 'inactive' }
        }
      }
    }
  },
  {
    activities: {
      beeping: createBeepingActivity
    }
  }
);
```

使用 XState 的[解释（interpret）](./interpretation.md)，每次发生动作启动一个活动时，都会调用那个活动的创建者来启动该活动，并使用返回的“stopper”（如果返回）来停止 活动：

```js
import { interpret } from 'xstate';

// ... (以前的代码)

const service = interpret(toggleMachine);

service.start();

// 还没有 log

service.send({ type: 'TOGGLE' });

// => 'BEEP!'
// => 'BEEP!'
// => 'BEEP!'
// ...

service.send({ type: 'TOGGLE' });

// 没有更多的哔哔声！
```

## 重启 Activities

[恢复持久状态](./states.md#persisting-state) 时，默认情况下不会重新启动先前运行的活动。 这是为了防止不良和/或意外行为。 但是，可以通过在重新启动服务之前将 `start(...)` 操作添加到持久状态来手动启动活动：

```js
import { State, actions } from 'xstate';

// ...

const restoredState = State.create(somePersistedStateJSON);

// 选择要重启的活动
Object.keys(restoredState.activities).forEach((activityKey) => {
  if (restoredState.activities[activityKey]) {
    // 过滤活动，然后将 start() 动作添加到恢复状态
    restoredState.actions.push(actions.start(activityKey));
  }
});

// 这将启动 someService 并重新启动活动。
someService.start(restoredState);
```
