# 状态 State

状态是系统（例如应用）在特定时间点的抽象表示。 要了解更多信息，请阅读 [状态图简介中的状态部分](./introduction-to-state-machines-and-statecharts/index.md#states)。

## API

状态机的当前状态由一个 `State` 实例表示：

```js {13-18,21-26}
const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      /* ... */
    }
    // ...
  }
});

console.log(lightMachine.initialState);
// State {
//   value: 'green',
//   actions: [],
//   context: undefined,
//   // ...
// }

console.log(lightMachine.transition('yellow', { type: 'TIMER' }));
// State {
//   value: { red: 'walk' },
//   actions: [],
//   context: undefined,
//   // ...
// }
```

## State 定义

`State` 对象实例是 JSON 可序列化的，并具有以下属性：

- `value` - 当前状态的值。(例如， `{red: 'walk'}`)
- `context` - 当前状态的 [context](./context.md)
- `event` - 触发转换到此状态的事件对象
- `actions` - 要执行的 [动作](./actions.md) 数组
- `activities` - 如果 [活动](./activities.md) 开始，则活动映射到 `true`，如果活动停止，则映射到 `false`。
- `history` - 上一个 `State` 实例
- `meta` - 在 [状态节点](./statenodes.md) 的元属性上定义的任何静态元数据
- `done` - 状态是否表示最终状态

`State` 对象还包含其他属性，例如 `historyValue`、`events`、`tree` 和其他通常不相关并在内部使用的属性。

## State 方法和属性

你可以使用一些有用的方法和属性来获得更好的开发体验：

### `state.matches(parentStateValue)`

`state.matches(parentStateValue)` 方法确定当前 `state.value` 是否是给定 `parentStateValue` 的子集。 该方法确定父状态值是否“匹配”状态值。 例如，假设当前 `state.value` 是 `{ red: 'stop' }`：

```js
console.log(state.value);
// => { red: 'stop' }

console.log(state.matches('red'));
// => true

console.log(state.matches('red.stop'));
// => true

console.log(state.matches({ red: 'stop' }));
// => true

console.log(state.matches('green'));
// => false
```

::: tip
如果要匹配多个状态中的一个，可以在状态值数组上使用 [`.some()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some) 来完成此操作：

```js
const isMatch = [{ customer: 'deposit' }, { customer: 'withdrawal' }].some(
  state.matches
);
```

:::

### `state.nextEvents`

`state.nextEvents` 指定将导致从当前状态转换的下一个事件：

```js
const { initialState } = lightMachine;

console.log(initialState.nextEvents);
// => ['TIMER', 'EMERGENCY']
```

`state.nextEvents` 在确定可以采取哪些下一个事件，以及在 UI 中表示这些潜在事件（例如启用/禁用某些按钮）方面很有用。

### `state.changed`

`state.changed` 指定此 `state` 是否已从先前状态更改。 在以下情况下，状态被视为“已更改”：

- 它的值不等于它之前的值，或者：
- 它有任何新动作（副作用）要执行。

初始状态（没有历史记录）将返回 `undefined`。

```js
const { initialState } = lightMachine;

console.log(initialState.changed);
// => undefined

const nextState = lightMachine.transition(initialState, { type: 'TIMER' });

console.log(nextState.changed);
// => true

const unchangedState = lightMachine.transition(nextState, {
  type: 'UNKNOWN_EVENT'
});

console.log(unchangedState.changed);
// => false
```

### `state.done`

`state.done` 指定 `state` 是否为“[最终状态](./final.md)” - 最终状态是指示其状态机已达到其最终状态，并且不能再转换到任何其他状态的状态。

```js
const answeringMachine = createMachine({
  initial: 'unanswered',
  states: {
    unanswered: {
      on: {
        ANSWER: { target: 'answered' }
      }
    },
    answered: {
      type: 'final'
    }
  }
});

const { initialState } = answeringMachine;
initialState.done; // false

const answeredState = answeringMachine.transition(initialState, {
  type: 'ANSWER'
});
answeredState.done; // true
```

### `state.toStrings()`

`state.toStrings()` 方法返回表示所有状态值路径的字符串数组。 例如，假设当前 `state.value` 是 `{ red: 'stop' }`：

```js
console.log(state.value);
// => { red: 'stop' }

console.log(state.toStrings());
// => ['red', 'red.stop']
```

`state.toStrings()` 方法对于表示基于字符串的环境中的当前状态非常有用，例如在 CSS 类或数据属性中。

### `state.children`

`state.children` 是将生成的 服务/演员 ID 映射到其实例的对象。 详情 [📖 参考服务](./communication.md#referencing-services)。

#### 使用 `state.children` 示例

```js
const machine = createMachine({
  // ...
  invoke: [
    { id: 'notifier', src: createNotifier },
    { id: 'logger', src: createLogger }
  ]
  // ...
});

const service = invoke(machine)
  .onTransition((state) => {
    state.children.notifier; // service 来自 createNotifier()
    state.children.logger; // service 来自 createLogger()
  })
  .start();
```

### `state.hasTag(tag)`

_从 4.19.0 开始_

`state.hasTag(tag)` 方法，当前状态配置是否具有给定标签的状态节点。

```js {5,8,11}
const machine = createMachine({
  initial: 'green',
  states: {
    green: {
      tags: 'go' // 单标签
    },
    yellow: {
      tags: 'go'
    },
    red: {
      tags: ['stop', 'other'] // 多标签
    }
  }
});
```

例如，如果上面的状态机处于 `green` 或 `yellow` 状态，而不是直接使用 `state.matches('green') || state.matches('yellow')`，可以使用 `state.hasTag('go')`：

```js
const canGo = state.hasTag('go');
// => 如果在 'green' 或 'yellow' 状态，返回 `true`
```

### `state.can(event)`

_从 4.25.0 开始_

`state.can(event)` 方法确定一个 `event` 在发送到解释的(interpret)状态机时，是否会导致状态改变。 如果状态因发送 `event` 而改变，该方法将返回 `true`； 否则该方法将返回 `false`：

```js
const machine = createMachine({
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: 'active'
      }
    },
    active: {
      on: {
        DO_SOMETHING: { actions: ['something'] }
      }
    }
  }
});

const inactiveState = machine.initialState;

inactiveState.can({ type: 'TOGGLE' }); // true
inactiveState.can({ type: 'DO_SOMETHING' }); // false

inactiveState.can({
  type: 'DO_SOMETHING',
  data: 42
}); // false

const activeState = machine.transition(inactiveState, { type: 'TOGGLE' });

activeState.can({ type: 'TOGGLE' }); // false
activeState.can({ type: 'DO_SOMETHING' }); // true, 因为一个 action 将被执行
```

如果 [`state.changed`](#state-changed) 为 `true`，并且以下任何一项为 `true`，则状态被视为“changed”：

- `state.value` 改变
- 有新的 `state.actions` 需要执行
- `state.context` 改变

## 持久化 State

如前所述，可以通过将 `State` 对象序列化为字符串 JSON 格式来持久化它：

```js
const jsonState = JSON.stringify(currentState);

// 例如: 持久化到 localStorage
try {
  localStorage.setItem('app-state', jsonState);
} catch (e) {
  // 不能保存 localStorage
}
```

可以使用静态 `State.create(...)` 方法恢复状态：

```js
import { State, interpret } from 'xstate';
import { myMachine } from '../path/to/myMachine';

// 从 localStorage 检索状态定义，如果 localStorage 为空，则使用状态机的初始状态
const stateDefinition =
  JSON.parse(localStorage.getItem('app-state')) || myMachine.initialState;

// 使用 State.create() 从普通对象恢复状态
const previousState = State.create(stateDefinition);
```

然后，你可以通过将 `State` 传递到已解释的服务的 `.start(...)` 方法，来从此状态解释状态机：

```js
// ...

// 这将在指定的状态启动 service
const service = interpret(myMachine).start(previousState);
```

这还将维护和恢复以前的 [历史状态](./history.md)，并确保 `.events` 和 `.nextEvents` 代表正确的值。

::: warning
XState 尚不支持持久化生成的 [演员（actors）](./actors.md)
:::

## State 元数据

元数据，是描述任何 [状态节点](./statenodes.md) 相关属性的静态数据，可以在状态节点的 `.meta` 属性上指定：

```js {17-19,22-24,30-32,35-37,40-42}
const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  states: {
    idle: {
      on: { FETCH: { target: 'loading' } }
    },
    loading: {
      after: {
        3000: 'failure.timeout'
      },
      on: {
        RESOLVE: { target: 'success' },
        REJECT: { target: 'failure' },
        TIMEOUT: { target: 'failure.timeout' } // 手动超时
      },
      meta: {
        message: 'Loading...'
      }
    },
    success: {
      meta: {
        message: 'The request succeeded!'
      }
    },
    failure: {
      initial: 'rejection',
      states: {
        rejection: {
          meta: {
            message: 'The request failed.'
          }
        },
        timeout: {
          meta: {
            message: 'The request timed out.'
          }
        }
      },
      meta: {
        alert: 'Uh oh.'
      }
    }
  }
});
```

状态机的当前状态，收集所有状态节点的 `.meta` 数据，由状态值表示，并将它们放在一个对象上，其中：

- key 是 [状态节点 ID](./ids.md)
- value 是状态节点 `.meta` 的值

例如，如果上述状态机处于 `failure.timeout` 状态（由 ID 为 `“failure”` 和 `“failure.timeout”` 的两个状态节点表示），则 `.meta` 属性将组合所有 `.meta` 值，如下所示：

```js {4-11}
const failureTimeoutState = fetchMachine.transition('loading', {
  type: 'TIMEOUT'
});

console.log(failureTimeoutState.meta);
// => {
//   failure: {
//     alert: 'Uh oh.'
//   },
//   'failure.timeout': {
//     message: 'The request timed out.'
//   }
// }
```

::: tip 提示：聚合元数据
你如何处理元数据取决于你。 理想情况下，元数据应 _仅_ 包含 JSON 可序列化值。 考虑以不同方式合并/聚合元数据。 例如，以下函数丢弃状态节点 ID key（如果它们不相关）并合并元数据：

```js
function mergeMeta(meta) {
  return Object.keys(meta).reduce((acc, key) => {
    const value = meta[key];

    // 假设每个元值都是一个对象
    Object.assign(acc, value);

    return acc;
  }, {});
}

const failureTimeoutState = fetchMachine.transition('loading', {
  type: 'TIMEOUT'
});

console.log(mergeMeta(failureTimeoutState.meta));
// => {
//   alert: 'Uh oh.',
//   message: 'The request timed out.'
// }
```

:::

## 笔记

- 你永远不必手动创建 `State` 实例。 将 `State` 视为仅来自 `machine.transition(...)` 或 `service.onTransition(...)` 的只读对象。
- `state.history` 不会保留其历史记录以防止内存泄漏。`state.history.history === undefined`。
  否则，你最终会创建一个巨大的链表并重新发明区块链，而我们并不这样做。
  - 此行为可能会在未来版本中进行配置。
