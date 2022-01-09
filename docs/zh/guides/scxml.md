# SCXML

XState 与 [SCXML (状态图 XML：控制抽象的状态机符号) 规范](https://www.w3.org/TR/scxml/) 兼容。 此页面包含有关我们的 API 与 SCXML 规范相关的详细信息。

## 事件（Events）

SCXML 中的事件包含与事件源相关的信息，并且具有与 XState 中的事件对象不同的架构。 在内部，为了兼容性，事件对象被转换为 SCXML 事件。

SCXML 事件包括:

- `name` - 给出事件名称的字符串。 `name` 等价于 XState 事件的 `.type` 属性。
- `type` - 事件类型：`'platform'`、`'external'` 或 `'internal'`。
  - `platform` 事件由平台本身引发，例如错误事件。
  - `internal` 事件由 `raise(...)` 动作 或带有 `target: '_internal'` 的 `send(...)` 动作 引发。
  - `external` 事件描述所有其他事件。
- `sendid` - 触发 `send(...)` 动作的发送 ID。
- `origin` - 一个字符串，允许此事件的接收者`send(...)` 一个响应事件回源。
- `origintype` - 与 `origin` 一起使用
- `invokeid` - 触发子服务的调用的调用 ID。
- `data` - 发送实体选择包含在此事件中的任何数据。 `data` 相当于一个 XState 事件对象。

所有 XState 事件的 SCXML 事件形式存在于 动作 和 守卫 元对象的 `_event` 属性中，作为第三个参数：

```js {4-5,9-10}
// ...
{
  actions: {
    someAction: (context, event, { _event }) => {
      console.log(_event); // SCXML event
    };
  },
  guards: {
    someGuard: (context, event, { _event }) => {
      console.log(_event); // SCXML event
    }
  }
}
// ..
```

## 转换（Transitions）

在状态节点的 `on: { ... }` 属性上定义的事件-目标映射与 SCXML `<transition>` 元素同义：

```js
{
  green: {
    on: {
      TIMER: {
        target: '#yellow',
        cond: context => context.timeElapsed > 5000
      },
      POWER_OUTAGE: { target: '#red.flashing' }
    }
  },
  // ...
}
```

```xml
<state id="green">
  <transition
    event="TIMER"
    target="yellow"
    cond="timeElapsed > 5000"
  />
  <transition
    event="POWER_OUTAGE"
    target="red.flashing"
  />
</state>
```

- [https://www.w3.org/TR/scxml/#transition](https://www.w3.org/TR/scxml/#transition) - `<transition>` 的定义

## 守卫（Guards）

`cond` 属性等效于 SCXML `<transition>` 元素上的 `cond` 属性：

```js
{
  on: {
    e: {
      target: 'foo',
      cond: context => context.x === 1
    }
  }
}
```

```xml
<transition event="e" cond="x == 1" target="foo" />
```

类似地，`in` 属性等价于 `In()` 谓词：

```js
{
  on: {
    e: {
      target: 'cooking',
      in: '#closed'
    }
  }
}
```

```xml
<transition cond="In('closed')" target="cooking"/>
```

- [`cond` 属性的 SCXML 定义](https://www.w3.org/TR/scxml/#transition)
- [SCXML 条件表达式和支持 In() 谓词的要求](https://www.w3.org/TR/scxml/#ConditionalExpressions)
- [给定 SCXML 中的事件如何选择转换](https://www.w3.org/TR/scxml/#SelectingTransitions)

## 状态 ID

ID 对应于 SCXML 规范中 ID 的定义：

```js
{
  green: {
    id: 'lightGreen';
  }
}
```

```xml
<state id="lightGreen">
  <!-- ... -->
</state>
```

- [SCXML 规范所有 `id` 属性 _必须_ 是唯一的](https://www.w3.org/TR/scxml/#IDs)
- [`<state>` 中 `id` 属性的 SCXML 定义](https://www.w3.org/TR/scxml/#state)

## 动作（Actions）

转换中的可执行 action 等效于 SCXML `<script>` 元素。 `entry` 和 `exit` 属性分别等效于 `<onentry>` 和 `<onexit>` 元素。

```js
{
  start: {
    entry: 'showStartScreen',
    exit: 'logScreenChange',
    on: {
      STOP: {
        target: 'stop',
        actions: ['logStop', 'stopEverything']
      }
    }
  }
}
```

```xml
<state id="start">
  <onentry>
    <script>showStartScreen();</script>
  </onentry>
  <onexit>
    <script>logScreenChange();</script>
  </onexit>
  <transition event="STOP" target="stop">
    <script>logStop();</script>
    <script>stopEverything();</script>
  </transition>
</state>
```

- [`<script>` 元素的 SCXML 定义](https://www.w3.org/TR/scxml/#script)
- [`<onentry>` 元素的 SCXML 定义](https://www.w3.org/TR/scxml/#onentry)
- [`<onexit>` 元素的 SCXML 定义](https://www.w3.org/TR/scxml/#onexit)

## 调用（Invoke）

`invoke` 属性与 SCXML `<invoke>` 元素同义：

```js
// XState
{
  loading: {
    invoke: {
      src: 'someSource',
      id: 'someID',
      autoForward: true, // 目前仅适用于状态机！
      onDone: 'success',
      onError: 'failure'
    }
  }
}
```

```xml
<!-- SCXML -->
<state id="loading">
  <invoke id="someID" src="someSource" autoforward />
  <transition event="done.invoke.someID" target="success" />
  <transition event="error.platform" cond="_event.src === 'someID'" target="failure" />
</state>
```

- [`<invoke>` 的 SCXML 定义](https://www.w3.org/TR/scxml/#invoke)
