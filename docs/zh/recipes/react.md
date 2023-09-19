# 与 React 一起使用

XState 可以与 React 一起使用：

- 协调本地状态
- 高效管理全局状态
- 使用其他 Hooks 的数据

在 [Stately](https://stately.ai), 我们喜欢这个组合。 它是我们创建内部应用程序的首选方式。

要寻求帮助，请查看 [我们 Discord 社区中的 `#react-help` 频道](https://discord.gg/vedXj62MfQ)。

## 本地状态

Using [React hooks](https://reactjs.org/hooks) are the easiest way to use state machines in your components. You can use the official [`@xstate/react`](https://github.com/statelyai/xstate/tree/main/packages/xstate-react) to give you useful hooks out of the box, such as `useMachine`.

```js
import { useMachine } from '@xstate/react';
import { toggleMachine } from '../path/to/toggleMachine';

function Toggle() {
  const [current, send] = useMachine(toggleMachine);

  return (
    <button onClick={() => send('TOGGLE')}>
      {current.matches('inactive') ? 'Off' : 'On'}
    </button>
  );
}
```

## 全局 State/React Context

Our recommended approach for managing global state with XState and React is to use [React Context](https://reactjs.org/docs/context.html).

> There are two versions of 'context': XState's [context](../guides/context.md) and React's context. It's a little confusing!

### Context Provider

React context can be a tricky tool to work with - if you pass in values which change too often, it can result in re-renders all the way down the tree. That means we need to pass in values which change as little as possible.

Luckily, XState gives us a first-class way to do that: `useInterpret`.

```js
import React, { createContext } from 'react';
import { useInterpret } from '@xstate/react';
import { authMachine } from './authMachine';

export const GlobalStateContext = createContext({});

export const GlobalStateProvider = (props) => {
  const authService = useInterpret(authMachine);

  return (
    <GlobalStateContext.Provider value={{ authService }}>
      {props.children}
    </GlobalStateContext.Provider>
  );
};
```

Using `useInterpret` returns a service, which is a static reference to the running machine which can be subscribed to. This value never changes, so we don't need to worry about wasted re-renders.

> For Typescript, you can create the context as `createContext({} as InterpreterFrom<typeof authMachine>);` to ensure strong typings.

### 利用 context

Further down the tree, you can subscribe to the service like this:

```js
import React, { useContext } from 'react';
import { GlobalStateContext } from './globalState';
import { useActor } from '@xstate/react';

export const SomeComponent = (props) => {
  const globalServices = useContext(GlobalStateContext);
  const [state] = useActor(globalServices.authService);

  return state.matches('loggedIn') ? 'Logged In' : 'Logged Out';
};
```

The `useActor` hook listens for whenever the service changes, and updates the state value.

### 提升性能

There's an issue with the implementation above - this will update the component for any change to the service. Tools like [Redux](https://redux.js.org) use [`selectors`](https://redux.js.org/usage/deriving-data-selectors) for deriving state. Selectors are functions which restrict which parts of the state can result in components re-rendering.

Fortunately, XState exposes the `useSelector` hook.

```js
import React, { useContext } from 'react';
import { GlobalStateContext } from './globalState';
import { useSelector } from '@xstate/react';

const loggedInSelector = (state) => {
  return state.matches('loggedIn');
};

export const SomeComponent = (props) => {
  const globalServices = useContext(GlobalStateContext);
  const isLoggedIn = useSelector(globalServices.authService, loggedInSelector);

  return isLoggedIn ? 'Logged In' : 'Logged Out';
};
```

If you need to send an event in the component that consumes a service, you can use the `service.send(...)` method directly:

```js
import React, { useContext } from 'react';
import { GlobalStateContext } from './globalState';
import { useSelector } from '@xstate/react';

const loggedInSelector = (state) => {
  return state.matches('loggedIn');
};

export const SomeComponent = (props) => {
  const globalServices = useContext(GlobalStateContext);
  const isLoggedIn = useSelector(globalServices.authService, loggedInSelector);
  // Get `send()` method from a service
  const { send } = globalServices.authService;

  return (
    <>
      {isLoggedIn && (
        <button type="button" onClick={() => send('LOG_OUT')}>
          Logout
        </button>
      )}
    </>
  );
};
```

This component will only re-render when `state.matches('loggedIn')` returns a different value. This is our recommended approach over `useActor` for when you want to optimise performance.

### 派发事件

For dispatching events to the global store, you can call a service's `send` function directly.

```js
import React, { useContext } from 'react';
import { GlobalStateContext } from './globalState';

export const SomeComponent = (props) => {
  const globalServices = useContext(GlobalStateContext);

  return (
    <button
      onClick={() => globalServices.authService.send({ type: 'LOG_OUT' })}
    >
      Log Out
    </button>
  );
};
```

Note that you don't need to call `useActor` for this, it's available right on the context.

## 其他 hooks

XState's `useMachine` and `useInterpret` hooks can be used alongside others. Two patterns are most common:

### 命名的 actions/services/guards

Let's imagine that when you navigate to a certain state, you want to leave the page and go somewhere else, via `react-router` or `next`. For now, we'll declare that action as a 'named' action - where we name it now and declare it later.

```js
import { createMachine } from 'xstate';

export const machine = createMachine({
  initial: 'toggledOff',
  states: {
    toggledOff: {
      on: {
        TOGGLE: 'toggledOn'
      }
    },
    toggledOn: {
      entry: ['goToOtherPage']
    }
  }
});
```

Inside your component, you can now _implement_ the named action. I've added `useHistory` from `react-router` as an example, but you can imagine this working with any hook or prop-based router.

```js
import { machine } from './machine';
import { useMachine } from '@xstate/react';
import { useHistory } from 'react-router';

const Component = () => {
  const history = useHistory();

  const [state, send] = useMachine(machine, {
    actions: {
      goToOtherPage: () => {
        history.push('/other-page');
      }
    }
  });

  return null;
};
```

This also works for services, guards, and delays.

> If you use this technique, any references you use inside `goToOtherPage` will be kept up to date each render. That means you don't need to worry about stale references.

### 使用 useEffect 同步数据

Sometimes, you want to outsource some functionality to another hook. This is especially common with data fetching hooks such as [`react-query`](https://react-query.tanstack.com/) and [`swr`](https://swr.vercel.app/). You don't want to have to re-build all your data fetching functionality in XState.

The best way to manage this is via `useEffect`.

```js
const Component = () => {
  const { data, error } = useSWR('/api/user', fetcher);

  const [state, send] = useMachine(machine);

  useEffect(() => {
    send({
      type: 'DATA_CHANGED',
      data,
      error
    });
  }, [data, error, send]);
};
```

This will send a `DATA_CHANGED` event whenever the result from `useSWR` changes, allowing you to react to it just like any other event. You could, for instance:

- Move into an `errored` state when the data returns an error
- Save the data to context

## Class 组件

- 如果你使用的是类组件，这里有一个不依赖于 hooks 的示例实现。
  `machine` 被 [interpreted](../guides/interpretation.md)，并且它的 `service` 实例被放置在组件实例上。
- 对于本地状态， `this.state.current` 将保存当前状态机状态。 你可以使用 `.current` 以外的属性名称。
- 当组件被挂载时，`service` 通过 `this.service.start()` 启动。
- 当组件卸载时，`service` 通过 `this.service.stop()` 停止。
- 事件通过 `this.service.send(event)` 发送到 `service`。

```jsx
import React from 'react';
import { interpret } from 'xstate';
import { toggleMachine } from '../path/to/toggleMachine';

class Toggle extends React.Component {
  state = {
    current: toggleMachine.initialState
  };

  service = interpret(toggleMachine).onTransition((current) =>
    this.setState({ current })
  );

  componentDidMount() {
    this.service.start();
  }

  componentWillUnmount() {
    this.service.stop();
  }

  render() {
    const { current } = this.state;
    const { send } = this.service;

    return (
      <button onClick={() => send('TOGGLE')}>
        {current.matches('inactive') ? 'Off' : 'On'}
      </button>
    );
  }
}
```
