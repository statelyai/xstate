# 入门

## 我们的第一个状态机

假设我们使用 [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) 创建状态机。首先，使用 NPM 或 Yarn 安装 XState：

```bash
npm install xstate --save
```

> 如果你正在使用 VSCode，你应该安装我们的 [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode)，以便你可以随时可视化你正在构建的状态机。

然后，在你的项目中，导入 `createMachine`，这是一个创建状态机的函数。

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine(/* ... */);
```

我们将 [状态机配置](./machines.md#configuration) 传递到 `createMachine`。我们需要提供：

- `id` - 去标识状态机
- `initial` - 指定这台状态机应该处于的初始状态节点
- `states` - 定义每个子状态：

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {},
    resolved: {},
    rejected: {}
  }
});
```

然后，我们需要向状态节点添加 [转换（transitions）](./transitions.md)。

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        RESOLVE: { target: 'resolved' },
        REJECT: { target: 'rejected' }
      }
    },
    resolved: {},
    rejected: {}
  }
});
```

我们还需要将 `resolved` 和 `rejected` 的状态节点标记为 [最终状态节点](./final.md)，因为 promise 状态机一旦达到这些状态就会终止运行：

```js
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        RESOLVE: { target: 'resolved' },
        REJECT: { target: 'rejected' }
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
```

我们的状态机现在可以进行可视化了。你可以复制/粘贴上面的代码并在 [Stately Viz 可视化它](https://stately.ai/viz)。看起来这样：

<iframe src="https://stately.ai/viz/embed/68548871-eecb-479b-b92a-b261e7d89671?mode=viz&panel=code&readOnly=1&showOriginalLink=1&controls=0&pan=0&zoom=0"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

## 运行我们的状态机

我们如何运行我们的状态机，取决于我们计划在哪里使用它。

### 在 Node/Vanilla JS

为了 [解释（interpret）](./interpretation.md) 状态机并使其运行，我们需要添加一个解释器。这将创建一个服务：

```js
import { createMachine, interpret } from 'xstate';

const promiseMachine = createMachine({
  /* ... */
});

const promiseService = interpret(promiseMachine).onTransition((state) =>
  console.log(state.value)
);

// 开启 service
promiseService.start();
// => 'pending'

promiseService.send({ type: 'RESOLVE' });
// => 'resolved'
```

### 在 React

如果我们想在 React 组件中使用我们的状态机，我们可以使用 [useMachine](../packages/xstate-react/index.md#api) Hook：

> 你需要安装 `@xstate/react`

```tsx
import { useMachine } from '@xstate/react';

const Component = () => {
  const [state, send] = useMachine(promiseMachine);

  return (
    <div>
      {/** 你可以监听 service 处于什么状态 */}
      {state.matches('pending') && <p>Loading...</p>}
      {state.matches('rejected') && <p>Promise Rejected</p>}
      {state.matches('resolved') && <p>Promise Resolved</p>}
      <div>
        {/** 你可以发送事件到运行的 service 中 */}
        <button onClick={() => send('RESOLVE')}>Resolve</button>
        <button onClick={() => send('REJECT')}>Reject</button>
      </div>
    </div>
  );
};
```
