# `@xstate/inspect`

[@xstate/inspect package](https://github.com/statelyai/xstate/tree/main/packages/xstate-inspect) 包含 XState 的检查工具。

- [XState (Vanilla)](https://codesandbox.io/s/xstate-ts-viz-template-qzdvv)
- [XState + TypeScript](https://codesandbox.io/s/xstate-ts-viz-template-qzdvv)
- [XState + Vue](https://codesandbox.io/s/xstate-vue-viz-template-r5wd7)
- [XState + React](https://codesandbox.io/s/xstate-react-viz-template-5wq3q)

[请参阅此处的 CodeSandbox 示例](https://codesandbox.io/s/xstate-vue-minute-timer-viz-1txmk)

## 安装

1. npm or yarn:

```bash
npm install @xstate/inspect
# or yarn add @xstate/inspect
```

2. 在项目开始时导入它，在调用任何其他代码之前：

```js
import { inspect } from '@xstate/inspect';

inspect({
  // options
  // url: 'https://stately.ai/viz?inspect', // (default)
  iframe: false // 打开新窗口
});
```

3. 将 `{ devTools: true }` 添加到你想要可视化的任何 interprete 状态机：

```js
import { interpret } from 'xstate';
import { inspect } from '@xstate/inspect';
// ...

const service = interpret(someMachine, { devTools: true });
```

## Inspect 选项

```js
// 默认
inspect({
  iframe: () => document.querySelector('iframe[data-xstate]'),
  url: 'https://stately.ai/viz?inspect'
});

// 同上
inspect();
```

**参数：** 传递给 `inspect(options)` 的 `options` 对象具有以下可选属性：

- `iframe`（函数或 iframe `Element` 或 `false`） - 解析为 `iframe` 元素以在其中显示检查器。如果将其设置为 `iframe: false`，则将使用弹出窗口。

  ⚠️ 注意：你可能需要允许弹出窗口在弹出窗口中显示检查器，因为默认情况下它们可能会被浏览器阻止。

  默认情况下，检查器将在文档中的任何位置查找 `<iframe data-xstate>` 元素。 如果要定位自定义 iframe，请急切或懒惰地指定它：

  ```js
  // 准确的
  inspect({
    iframe: document.querySelector('iframe.some-xstate-iframe')
  });
  ```

  ```js
  // 懒散的
  inspect({
    iframe: () => document.querySelector('iframe.some-xstate-iframe')
  });
  ```

- `url` (string) - 要连接到的检查器的 URL。 默认情况下，检查器在 `https://stately.ai/viz?inspect` 上运行。

**返回:** 具有以下属性的检查器对象：

- `disconnect` (function) - 一个断开检查器并清除所有监听器的函数。

## 实施

你可以通过创建 **receiver** 来实现自己的检查器。 **receiver** 是从源（如父窗口或 WebSocket 连接）接收检查器事件的参与者：

- `"service.register"`

  ```ts
  {
    type: 'service.register';
    machine: AnyStateMachine;
    state: AnyState;
    id: string;
    sessionId: string;
    parent?: string;
    source?: string;
  }
  ```

- `"service.stop"`

  ```ts
  {
    type: 'service.stop';
    sessionId: string;
  }
  ```

- `"service.state"`

  ```ts
  {
    type: 'service.state';
    state: AnyState;
    sessionId: string;
  }
  ```

- `"service.event"`

  ```ts
  {
    type: 'service.event';
    event: SCXML.Event<any>;
    sessionId: string;
  }
  ```

要监听来自受检查源的事件，请使用适当的 `create*Receiver(...)` 函数创建一个接收器； 例如：

```js
import { createWindowReceiver } from '@xstate/inspect';

const windowReceiver = createWindowReceiver(/* options? */);

windowReceiver.subscribe((event) => {
  // 在这里，你将收到“service.*”事件
  console.log(event);
});
```

你还可以向接收器发送事件：

```js
// ...

// 这会将事件发送到被检查的服务
windowReceiver.send({
  type: 'xstate.event',
  event: JSON.stringify({ type: 'someEvent' }),
  service: /* 此事件发送到的服务的会话 ID */
});
```

典型的检查工作流程如下：

1. 客户端上的 `inspect(/* ... */)` 调用打开检查器（例如，在单独的窗口中，或创建 WebSocket 连接）
2. 接收方向客户端发送`"xstate.inspecting"`事件
3. 客户端向接收者发送`"service.register"`事件
4. 监听接收器的检查器（通过 `receiver.subscribe(...)`）通过它的 `event.sessionId` 注册状态机（`event.machine`）
5. 状态机可视化渲染，其当前状态（`event.state`）高亮显示
6. 当源端的服务接收到事件并改变状态时，它会分别向接收者发送`"service.event"`和`"service.state"`事件
7. 检查员可以使用这些事件来突出显示当前状态并保留发送到该服务的事件日志
8. 当服务停止时，一个`"service.stop"`事件被发送到带有`event.sessionId`的接收者，以识别停止的服务。

## FAQs

- 如何在 NextJS 应用程序中运行检查器？

  确保检查器代码仅在客户端上运行，而不是在服务器上运行：

  ```js
  if (typeof window !== 'undefined') {
    inspect({
      /* options */
    });
  }
  ```
