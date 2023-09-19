# 解释（Interpreting） 状态机

虽然具有纯`.transition()` 函数的状态机/状态图对于灵活性、纯度和可测试性很有用，但为了使其在实际应用程序中有任何用处，需要：

- 跟踪当前状态，并坚持下去
- 执行副作用
- 处理延迟的转换和事件
- 与外部服务沟通

**解释** 负责 _解释_ 状态机/状态图并执行上述所有操作 - 即在运行时环境中解析和执行它。 状态图的解释的、运行的实例称为**服务**。

## 解释（Interpreter） <Badge text="4.0+" />

提供了一个可选的解释，你可以使用它来运行状态图。 解释处理：

- 状态转换
- 执行动作（副作用）
- 取消的延迟事件
- 活动（正在进行的行动）
- 调用/生成子状态图服务
- 支持状态转换、上下文更改、事件等的多个监听器。
- 和更多！

```js
import { createMachine, interpret } from 'xstate';

const machine = createMachine(/* machine config */);

// 解释状态机，并在发生转换时添加一个监听器。
const service = interpret(machine).onTransition((state) => {
  console.log(state.value);
});

// 启动服务
service.start();

// 发送事件
service.send({ type: 'SOME_EVENT' });

// 当你不再使用该服务时，请停止该服务。
service.stop();
```

## 发送事件

通过调用 `service.send(event)` 将事件发送到正在运行的服务。 有 3 种方式可以发送事件：

```js {5,8,12}
service.start();

service.send({ type: 'CLICK', x: 40, y: 21 });
```

- 作为事件对象（例如，`.send({ type: 'CLICK', x: 40, y: 21 })`）
  - 事件对象必须有一个 `type: ...` 字符串属性。

::: warning
如果服务未初始化（即，如果尚未调用`service.start()`），则事件将**延迟**，直到服务启动。 这意味着在调用 `service.start()` 之前不会处理事件，然后它们将被顺序处理。

这种行为可以通过在 [服务选项](#options) 中设置 `{ deferEvents: false }` 来改变。 当 `deferEvents` 为 `false` 时，向未初始化的服务发送事件将引发错误。
:::

## 批量发送事件

通过使用一组事件调用`service.send(events)`，可以将多个事件作为一个组或“批处理”发送到正在运行的服务：

```js
service.send([
  // 字符串事件
  'CLICK',
  'CLICK',
  'ANOTHER_EVENT',
  // 事件对象
  { type: 'CLICK', x: 40, y: 21 },
  { type: 'KEYDOWN', key: 'Escape' }
]);
```

这将立即安排要按顺序处理的所有批处理事件。 由于每个事件都会导致可能需要执行操作的状态转换，因此中间状态中的操作会被推迟，直到所有事件都被处理完毕，然后以创建它们的状态（而不是结束状态）执行它们。

这意味着结束状态（在处理完所有事件之后）将有一个 `.actions` 数组，其中包含来自中间状态 _所有_ 的累积动作。 这些动作中的每一个都将绑定到它们各自的中间状态。

::: warning

只有一种状态——**结束状态**（即，处理所有事件后的结果状态）——将被发送到`.onTransition(...)` 监听器。 这使得批处理事件成为性能的优化方法。

:::

::: tip

批处理事件对于 [事件源](https://martinfowler.com/eaaDev/EventSourcing.html) 方法很有用。 通过将批处理事件发送到服务以达到相同的状态，可以存储事件日志并稍后重放。

:::

## 转换

状态转换的监听器通过`.onTransition(...)` 方法注册，该方法采用状态监听器。 每次发生状态转换（包括初始状态）时都会调用状态监听器，使用当前 [`state` 实例](./states.md)：

```js
// 解释状态机
const service = interpret(machine);

// 添加一个状态监听器，每当发生状态转换时都会调用它。
service.onTransition((state) => {
  console.log(state.value);
});

service.start();
```

::: tip

如果你只想在状态更改时调用 `.onTransition(...)` 处理程序（即，当 `state.value` 更改时，`state.context` 更改，或者有新的 `state.actions`)，使用 [`state.changed`](https://xstate.js.org/docs/guides/states.html#state-changed)：

```js {2}
service.onTransition((state) => {
  if (state.changed) {
    console.log(state.value);
  }
});
```

::: tip
`.onTransition()` 回调不会在无事件（“always”）转换或其他微任务之间运行。 它只在宏任务上运行。
微任务是宏任务之间的中间转换。
:::

## 开始和停止

可以使用`.start()` 和`.stop()` 来初始化（即启动）和停止服务。 调用 `.start()` 将立即将服务转换到其初始状态。 调用 `.stop()` 将从服务中删除所有监听器，并进行任何监听器清理（如果适用）。

```js
const service = interpret(machine);

// 启动状态机
service.start();

// 停止状态机
service.stop();

// 重启状态机
service.start();
```

通过将 `state` 传递给 `service.start(state)`，可以从特定的 [状态](./states.md) 启动服务。 这在从先前保存的状态重新混合服务时很有用。

```js
// 从指定状态启动服务，而不是从状态机的初始状态启动。
service.start(previousState);
```

## 执行动作

[动作 (副作用)](./actions.md) 默认情况下，在状态转换时立即执行。 这可以通过设置 `{ execute: false }` 选项来配置（参见示例）。 在 `state` 上指定的每个动作对象可能有一个 `.exec` 属性，该属性被状态的 `context` 和 `event` 对象调用。

可以通过调用`service.execute(state)` 手动执行操作。 当你想要控制执行操作的时间时，这很有用：

```js
const service = interpret(machine, {
  execute: false // 不要对状态转换执行操作
});

service.onTransition((state) => {
  // 在下一动画帧而不是立即执行动作
  requestAnimationFrame(() => service.execute(state));
});

service.start();
```

## 选项

以下选项可以作为第二个参数传递给解释（`interpret(machine, options)`）：

- `execute` (boolean) - 表示是否应在转换时执行状态操作。 默认为 `true`。
  - 请参阅 [执行操作](#executing-actions) 以自定义此行为。
- `deferEvents` (boolean) <Badge text="4.4+"/> - 表示发送到未初始化服务的事件（即在调用 `service.start()` 之前）是否应该推迟到服务初始化。 默认为 `true`。
  - 如果为 `false`，则发送到未初始化服务的事件将引发错误。
- `devTools` (boolean) - 表示事件是否应该发送到 [Redux DevTools 扩展](https://github.com/zalmoxisus/redux-devtools-extension)。 默认为`false`。
- `logger` - 指定用于`log(...)` 操作的记录器。 默认为原生 `console.log` 方法。
- `clock` - 指定[延迟操作的时钟接口](./delays.md#interpretation)。 默认为原生 `setTimeout` 和 `clearTimeout` 函数。

## 自定义 解释（Interpreters）

你可以使用任何解释器（或创建你自己的解释器）来运行你的状态机/状态图。 这是一个示例最小实现，它演示了解释的灵活程度（尽管有大量的样板）：

```js
const machine = createMachine(/* 状态机配置 */);

// 跟踪当前状态，从初始状态开始
let currentState = machine.initialState;

// 跟踪 监听
const listeners = new Set();

// 有一种发送/调度事件的方法
function send(event) {
  // 记住：machine.transition() 是一个纯函数
  currentState = machine.transition(currentState, event);

  // 获取要执行的副作用操作
  const { actions } = currentState;

  actions.forEach((action) => {
    // 如果动作是可执行的，执行它
    typeof action.exec === 'function' && action.exec();
  });

  // 通知 监听器
  listeners.forEach((listener) => listener(currentState));
}

function listen(listener) {
  listeners.add(listener);
}

function unlisten(listener) {
  listeners.delete(listener);
}

// 现在你可以监听和发送事件以更新状态
listen((state) => {
  console.log(state.value);
});

send('SOME_EVENT');
```

## 笔记

- `interpret` 函数从 4.3+ 开始直接从 `xstate` 导出（即 `import { interpret } from 'xstate'`）。 对于以前的版本，它是从 `'xstate/lib/interpreter'` 导入的。
- 大多数解释器方法都可以链式调用：

```js
const service = interpret(machine)
  .onTransition((state) => console.log(state))
  .onDone(() => console.log('done'))
  .start(); // 返回已启动的服务
```

- 不要直接从动作中调用`service.send(...)`。 这会阻碍测试、可视化和分析。 而是 [使用`invoke`](./communication.md)。
