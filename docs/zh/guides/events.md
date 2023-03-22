# 事件 Event

事件是导致状态机从当前 [状态](./states.md) [转换](./transitions.md) 到下一个状态的原因。 要了解更多信息，请阅读 [状态图简介中的事件部分](./introduction-to-state-machines-and-statecharts/index.md#transitions-and-events)。

## API

事件是具有 `type` 属性的对象，表示它是什么类型的事件：

```js
const timerEvent = {
  type: 'TIMER' // 约定是使用 CONST_CASE 作为事件名称
};
```

在 XState 中，只有 `type` 的事件可以由其字符串类型表示，作为速记：

```js
// 等于 { type: 'TIMER' }
const timerEvent = 'TIMER';
```

事件对象还可以有其他属性，代表与事件相关的数据：

```js
const keyDownEvent = {
  type: 'keydown',
  key: 'Enter'
};
```

## 发送事件 Send Event

正如 [转换向导](./transitions.md) 中所解释的，给定当前状态和事件，转换到定义的下一个状态，在其 `on: { ... }` 属性上定义。 这可以通过将事件传递给 [transition 方法](./transitions.md#machine-transition-method) 来观察：

```js
import { createMachine } from 'xstate';

const lightMachine = createMachine({
  /* ... */
});

const { initialState } = lightMachine;

nextState = lightMachine.transition(nextState, { type: 'TIMER' }); // 事件对象
console.log(nextState.value);
// => 'red'
```

许多原生事件，例如 DOM 事件，是兼容的，可以直接与 XState 一起使用，通过在 `type` 属性上指定事件类型：

```js
import { createMachine, interpret } from 'xstate';

const mouseMachine = createMachine({
  on: {
    mousemove: {
      actions: [
        (context, event) => {
          const { offsetX, offsetY } = event;
          console.log({ offsetX, offsetY });
        }
      ]
    }
  }
});
const mouseService = interpret(mouseMachine).start();

window.addEventListener('mousemove', (event) => {
  // 事件可以直接发送到服务
  mouseService.send(event);
});
```

## NULL 事件

::: warning
null 事件语法 `({ on: { '': ... } })` 将在第 5 版中弃用。应改用新的 [always](./transitions.md#eventless-always-transitions) 语法。
:::

NULL 事件是没有类型的事件，一旦进入状态就会立即发生。 在转换中，它由一个空字符串 (`''`) 表示：

```js
// 人为的例子
const skipMachine = createMachine({
  id: 'skip',
  initial: 'one',
  states: {
    one: {
      on: { CLICK: 'two' }
    },
    two: {
      // 一旦进入状态，null 事件 '' 总是发生立即转换为 'three'
      on: { '': 'three' }
    },
    three: {
      type: 'final'
    }
  }
});

const { initialState } = skipMachine;
const nextState = skipMachine.transition(initialState, { type: 'CLICK' });

console.log(nextState.value);
// => 'three'
```

<iframe src="https://stately.ai/viz/embed?gist=f8b1c6470371b13eb2838b84194ca428"></iframe>

null 事件有很多用例，尤其是在定义 [瞬间转换](./transitions.md#transient-transitions) 时，状态（可能是 [瞬间状态](./statenodes.md#transient-state-nodes) 的）立即根据 [条件](./guards.md) 确定下一个状态应该是什么：

```js
const isAdult = ({ age }) => age >= 18;
const isMinor = ({ age }) => age < 18;

const ageMachine = createMachine({
  id: 'age',
  context: { age: undefined }, // age 不知道
  initial: 'unknown',
  states: {
    unknown: {
      on: {
        // 当满足 cond 条件时，立即 转换。 否则，不会发生 转换
        '': [
          { target: 'adult', cond: isAdult },
          { target: 'child', cond: isMinor }
        ]
      }
    },
    adult: { type: 'final' },
    child: { type: 'final' }
  }
});

console.log(ageMachine.initialState.value);
// => 'unknown'

const personData = { age: 28 };

const personMachine = ageMachine.withContext(personData);

console.log(personMachine.initialState.value);
// => 'adult'
```

<iframe src="https://stately.ai/viz/embed?gist=2f9f2f4bd5dcd5ff262c7f2a7e9199aa"></iframe>
