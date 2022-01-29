# 历史 History

历史[状态节点](./statenodes.md) 是一种特殊的状态节点，当它到达时，告诉状态机转到该区域的最后一个状态值。 有两种类型的历史状态：

- `'shallow'`, 仅指定顶级历史值，或
- `'deep'`, 它指定顶级和所有子级历史值。

## 历史状态配置

历史状态的配置与原子状态节点相同，但有一些额外的属性：

- `type: 'history'` 指定这是一个历史状态节点
- `history` ('shallow' | 'deep') - 无论历史是 shallow 还是 deep 的。 默认为 'shallow'。
- `target` (StateValue) - 如果不存在历史记录，则为默认目标。 默认为父节点的初始状态值。

考虑以下（人为的）状态图：

```js
const fanMachine = createMachine({
  id: 'fan',
  initial: 'fanOff',
  states: {
    fanOff: {
      on: {
        // 转换到历史状态
        POWER: { target: 'fanOn.hist' },
        HIGH_POWER: { target: 'fanOn.highPowerHist' }
      }
    },
    fanOn: {
      initial: 'first',
      states: {
        first: {
          on: {
            SWITCH: { target: 'second' }
          }
        },
        second: {
          on: {
            SWITCH: { target: 'third' }
          }
        },
        third: {},

        // 浅历史状态
        hist: {
          type: 'history',
          history: 'shallow' // optional; default is 'shallow'
        },

        // 默认的浅历史状态
        highPowerHist: {
          type: 'history',
          target: 'third'
        }
      },
      on: {
        POWER: { target: 'fanOff' }
      }
    }
  }
});
```

在上面的状态机中，从事件 `'POWER'` 上的 `'fanOff'` 转换到 `'fanOn.hist'` 状态，该状态被定义为浅历史状态。 这意味着状态机应该转换到 `'fanOn'` 态以及 `'fanOn'` 的前一个子状态。 默认情况下，如果没有历史状态，`'fanOn'` 将进入它的初始状态，`'first'`。

```js
const firstState = fanMachine.transition(fanMachine.initialState, {
  type: 'POWER'
});
console.log(firstState.value);
// 由于没有历史记录，因此转换到 'fanOn' 的初始状态
// => {
//   fanOn: 'first'
// }

const secondState = fanMachine.transition(firstState, { type: 'SWITCH' });
console.log(secondState.value);
// => {
//   fanOn: 'second'
// }

const thirdState = fanMachine.transition(secondState, { type: 'POWER' });
console.log(thirdState.value);
// => 'fanOff'

console.log(thirdState.history);
// => State {
//   value: { fanOn: 'second' },
//   actions: []
// }

const fourthState = fanMachine.transition(thirdState, { type: 'POWER' });
console.log(fourthState.value);
// 从历史转换为 'fanOn.second'
// => {
//   fanOn: 'second'
// }
```

指定了 `target` 后，如果定义历史状态的 state 区域不存在历史，则默认情况下它将进入 `target` 状态：

```js
const firstState = fanMachine.transition(fanMachine.initialState, {
  type: 'HIGH_POWER'
});
console.log(firstState.value);
// 由于没有历史记录，因此转换到 'fanOn.third' 的目标状态
// => {
//   fanOn: 'third'
// }
```

## 注意

- 历史状态可以直接从 `state.history` 上的 `State` 实例访问，但这很少是必要的。
