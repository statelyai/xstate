# 分层状态节点 Hierarchical State Node

在状态图中，状态可以嵌套 _在其他状态中_ 。 这些嵌套状态称为 **复合状态**。 要了解更多信息，请阅读[状态图简介中的复合状态部分](./introduction-to-state-machines-and-statecharts/index.md#compound-states)。

## API

以下示例是具有嵌套状态的交通灯状态机：

```js
const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_COUNTDOWN: { target: 'wait' }
      }
    },
    wait: {
      on: {
        PED_COUNTDOWN: { target: 'stop' }
      }
    },
    stop: {},
    blinking: {}
  }
};

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
      on: {
        TIMER: { target: 'green' }
      },
      ...pedestrianStates
    }
  },
  on: {
    POWER_OUTAGE: { target: '.red.blinking' },
    POWER_RESTORED: { target: '.red' }
  }
});
```

<iframe src="https://stately.ai/viz/embed/?gist=e8af8924afe9352bf7d1e06f06407061"></iframe>

`'green'` 和 `'yellow'` 状态是 **简单的状态** ——它们没有子状态。 相比之下，`'red'` 状态是复合状态，因为它由 **子状态**（`pedestrianStates`）组成。

## 初始状态

当进入复合状态时，它的初始状态也立即进入。 在以下交通灯状态机示例中：

- `'red'` 状态已进入
- 由于 `'red'` 的初始状态为 `'walk'`，因此最终进入 `{ red: 'walk' }` 状态。

```js
console.log(lightMachine.transition('yellow', { type: 'TIMER' }).value);
// => {
//   red: 'walk'
// }
```

## 事件

当前状态不处理 `event` 时，该 `event` 将传播到其要处理的父状态。 在以下交通灯状态机示例中：

- `{ red: 'stop' }` 状态 _不_ 处理`'TIMER'` 事件
- `'TIMER'` 事件被发送到处理该事件的 `'red'` 父状态。

```js
console.log(lightMachine.transition({ red: 'stop' }, { type: 'TIMER' }).value);
// => 'green'
```

如果状态或其任何祖先（父）状态均未处理事件，则不会发生转换。 在 `strict` 模式下（在 [状态机配置](./machines.md#configuration) 中指定），这将引发错误。

```js
console.log(lightMachine.transition('green', { type: 'UNKNOWN' }).value);
// => 'green'
```
