<p align="center">
  <a href="https://xstate.js.org">
  <br />
  <img src="https://user-images.githubusercontent.com/1093738/101672561-06aa7480-3a24-11eb-89d1-787fa7112138.png" alt="XState" width="150"/>
  <br />
    <sub><strong>JavaScript 状态机和状态图</strong></sub>
  <br />
  <br />
  </a>
</p>

[![npm version](https://badge.fury.io/js/xstate.svg)](https://badge.fury.io/js/xstate)
<img src="https://opencollective.com/xstate/tiers/backer/badge.svg?label=sponsors&color=brightgreen" />

用于现代 Web 的 JavaScript 和 TypeScript 的 [有限状态机](https://en.wikipedia.org/wiki/Finite-state_machine) 和 [状态图](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) 。

还不了解状态机和状态图？ [阅读我们的介绍](/guides/introduction-to-state-machines-and-statecharts/)。

📑 遵守 [SCXML 规范](https://www.w3.org/TR/scxml/)

💬 在 [Stately Discord Community](https://discord.gg/KCtSX7Cdjh) 和我们交流

## 包

- 🤖 `xstate` - 有限状态机和状态图核心库 + 解释器
- [🔬 `@xstate/fsm`](https://github.com/statelyai/xstate/tree/main/packages/xstate-fsm) - 最小有限状态机库
- [📉 `@xstate/graph`](https://github.com/statelyai/xstate/tree/main/packages/xstate-graph) - XState 的图遍历实用工具包
- [⚛️ `@xstate/react`](https://github.com/statelyai/xstate/tree/main/packages/xstate-react) - 在 React 应用中使用 XState 的 React Hooks 和实用工具包
- [💚 `@xstate/vue`](https://github.com/statelyai/xstate/tree/main/packages/xstate-vue) - 用于在 Vue 应用中使用 XState 的 Vue 组合函数和实用工具包
- [🎷 `@xstate/svelte`](https://github.com/statelyai/xstate/tree/main/packages/xstate-svelte) - 用于在 Svelte 应用中使用 XState 的 Svelte 实用工具包
- [✅ `@xstate/test`](https://github.com/statelyai/xstate/tree/main/packages/xstate-test) - 基于模型测试的实用工具包（使用 XState）
- [🔍 `@xstate/inspect`](https://github.com/statelyai/xstate/tree/main/packages/xstate-inspect) - XState 的检查实用工具包

## 模板

首先在 CodeSandbox 上创建这些模板之一：

- [XState Template](https://codesandbox.io/s/xstate-example-template-m4ckv) - 没有框架
- [XState + TypeScript Template](https://codesandbox.io/s/xstate-typescript-template-s9kz8) - 没有框架
- [XState + React Template](https://codesandbox.io/s/xstate-react-template-3t2tg)
- [XState + React + TypeScript Template](https://codesandbox.io/s/xstate-react-typescript-template-wjdvn)
- [XState + Vue Template](https://codesandbox.io/s/xstate-vue-template-composition-api-1n23l)
- [XState + Vue 3 Template](https://codesandbox.io/s/xstate-vue-3-template-vrkk9)
- [XState + Svelte Template](https://codesandbox.io/s/xstate-svelte-template-jflv1)

## 超级快速上手

```bash
npm install xstate
```

```js
import { createMachine, interpret } from 'xstate';

// 无状态的状态机定义
// machine.transition(...) 是解释器使用的纯函数。
const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: { target: 'active' }
      }
    },
    active: {
      on: {
        TOGGLE: { target: 'inactive' }
      }
    }
  }
});

// 具有内部状态的状态机实例
const toggleService = interpret(toggleMachine)
  .onTransition((state) => console.log(state.value))
  .start();
// => 'inactive'

toggleService.send({ type: 'TOGGLE' });
// => 'active'

toggleService.send({ type: 'TOGGLE' });
// => 'inactive'
```

## Promise 示例

[📉 在 stately.ai/viz](https://stately.ai/viz?gist=bbcb4379b36edea0458f597e5eec2f91) 上查看可视化

```js
import { createMachine, interpret, assign } from 'xstate';

const fetchMachine = createMachine({
  id: 'Dog API',
  initial: 'idle',
  context: {
    dog: null
  },
  states: {
    idle: {
      on: {
        FETCH: { target: 'loading' }
      }
    },
    loading: {
      invoke: {
        id: 'fetchDog',
        src: (context, event) =>
          fetch('https://dog.ceo/api/breeds/image/random').then((data) =>
            data.json()
          ),
        onDone: {
          target: 'resolved',
          actions: assign({
            dog: (_, event) => event.data
          })
        },
        onError: {
          target: 'rejected'
        }
      },
      on: {
        CANCEL: { target: 'idle' }
      }
    },
    rejected: {
      on: {
        FETCH: { target: 'loading' }
      }
    },
    resolved: {
      type: 'final'
    }
  }
});

const dogService = interpret(fetchMachine)
  .onTransition((state) => console.log(state.value))
  .start();

dogService.send({ type: 'FETCH' });
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [可视化工具](#visualizer)
- [为什么?](#why)
- [有限状态机](#finite-state-machines)
- [分层（嵌套）状态机](#hierarchical-nested-state-machines)
- [并行状态机](#parallel-state-machines)
- [历史状态](#history-states)
- [赞助商](#sponsors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 可视化工具

**[在 XState Viz 中可视化、模拟和共享你的状态图！](https://stately.ai/viz)**

<a href="https://stately.ai/viz"><img src="https://i.imgur.com/3pEB0B3.png" alt="XState Visualizer" width="300" /></a>

## 为什么?

状态图是一种，用于对有状态的交互式系统，进行建模的方式。从单个组件到整个应用程序逻辑，这对于以声明方式描述应用的 _行为_ 非常有用。

阅读 [📽 幻灯片](http://slides.com/davidkhourshid/finite-state-machines) ([🎥 视频](https://www.youtube.com/watch?v=VU1NKX6Qkxc)) 或查看这些资源以了解有限状态机和状态图在 UI 中的重要性：

- [状态图 - 一个复杂系统的可视化表现](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) by David Harel
- [状态图的世界](https://statecharts.github.io/) by Erik Mogensen
- [纯 UI](https://rauchg.com/2015/pure-ui) by Guillermo Rauch
- [纯 UI 控制](https://medium.com/@asolove/pure-ui-control-ac8d1be97a8d) by Adam Solove
- [Spectrum - 状态图社区](https://spectrum.chat/statecharts) (对于 XState 特定问题，请使用 [GitHub 讨论](https://github.com/statelyai/xstate/discussions))

## 有限状态机

<img src="https://imgur.com/rqqmkJh.png" alt="Light Machine" width="300" />

```js
import { createMachine } from 'xstate';

const lightMachine = createMachine({
  id: 'light',
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
      }
    }
  }
});

const currentState = 'green';

const nextState = lightMachine.transition(currentState, { type: 'TIMER' })
  .value;

// => 'yellow'
```

## 分层（嵌套）状态机

<img src="https://imgur.com/GDZAeB9.png" alt="Hierarchical Light Machine" width="300" />

```js
import { createMachine } from 'xstate';

const pedestrianStates = {
  initial: 'walk',
  states: {
    walk: {
      on: {
        PED_TIMER: { target: 'wait' }
      }
    },
    wait: {
      on: {
        PED_TIMER: { target: 'stop' }
      }
    },
    stop: {}
  }
};

const lightMachine = createMachine({
  id: 'light',
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
  }
});

const currentState = 'yellow';

const nextState = lightMachine.transition(currentState, { type: 'TIMER' })
  .value;
// => {
//   red: 'walk'
// }

lightMachine.transition('red.walk', { type: 'PED_TIMER' }).value;
// => {
//   red: 'wait'
// }
```

**分层状态的对象符号：**

```js
// ...
const waitState = lightMachine.transition(
  { red: 'walk' },
  { type: 'PED_TIMER' }
).value;

// => { red: 'wait' }

lightMachine.transition(waitState, { type: 'PED_TIMER' }).value;

// => { red: 'stop' }

lightMachine.transition({ red: 'stop' }, { type: 'TIMER' }).value;

// => 'green'
```

## 并行状态机

<img src="https://imgur.com/GKd4HwR.png" width="300" alt="Parallel state machine" />

```js
import { createMachine } from 'xstate';

const wordMachine = createMachine({
  id: 'word',
  type: 'parallel',
  states: {
    bold: {
      initial: 'off',
      states: {
        on: {
          on: {
            TOGGLE_BOLD: { target: 'off' }
          }
        },
        off: {
          on: {
            TOGGLE_BOLD: { target: 'on' }
          }
        }
      }
    },
    underline: {
      initial: 'off',
      states: {
        on: {
          on: {
            TOGGLE_UNDERLINE: { target: 'off' }
          }
        },
        off: {
          on: {
            TOGGLE_UNDERLINE: { target: 'on' }
          }
        }
      }
    },
    italics: {
      initial: 'off',
      states: {
        on: {
          on: {
            TOGGLE_ITALICS: { target: 'off' }
          }
        },
        off: {
          on: {
            TOGGLE_ITALICS: { target: 'on' }
          }
        }
      }
    },
    list: {
      initial: 'none',
      states: {
        none: {
          on: {
            BULLETS: { target: 'bullets' },
            NUMBERS: { target: 'numbers' }
          }
        },
        bullets: {
          on: {
            NONE: { target: 'none' },
            NUMBERS: { target: 'numbers' }
          }
        },
        numbers: {
          on: {
            BULLETS: { target: 'bullets' },
            NONE: { target: 'none' }
          }
        }
      }
    }
  }
});

const boldState = wordMachine.transition('bold.off', { type: 'TOGGLE_BOLD' })
  .value;

// {
//   bold: 'on',
//   italics: 'off',
//   underline: 'off',
//   list: 'none'
// }

const nextState = wordMachine.transition(
  {
    bold: 'off',
    italics: 'off',
    underline: 'on',
    list: 'bullets'
  },
  { type: 'TOGGLE_ITALICS' }
).value;

// {
//   bold: 'off',
//   italics: 'on',
//   underline: 'on',
//   list: 'bullets'
// }
```

## 历史状态

<img src="https://imgur.com/I4QsQsz.png" width="300" alt="Machine with history state" />

```js
import { createMachine } from 'xstate';

const paymentMachine = createMachine({
  id: 'payment',
  initial: 'method',
  states: {
    method: {
      initial: 'cash',
      states: {
        cash: {
          on: {
            SWITCH_CHECK: { target: 'check' }
          }
        },
        check: {
          on: {
            SWITCH_CASH: { target: 'cash' }
          }
        },
        hist: { type: 'history' }
      },
      on: {
        NEXT: { target: 'review' }
      }
    },
    review: {
      on: {
        PREVIOUS: { target: 'method.hist' }
      }
    }
  }
});

const checkState = paymentMachine.transition('method.cash', {
  type: 'SWITCH_CHECK'
});

// => State {
//   value: { method: 'check' },
//   history: State { ... }
// }

const reviewState = paymentMachine.transition(checkState, { type: 'NEXT' });

// => State {
//   value: 'review',
//   history: State { ... }
// }

const previousState = paymentMachine.transition(reviewState, {
  type: 'PREVIOUS'
}).value;

// => { method: 'check' }
```

## 赞助商

非常感谢以下公司赞助 `xstate`。 你可以 [在 OpenCollective](https://opencollective.com/xstate) 上赞助来促进 `xstate` 开发。

<a href="https://tipe.io" title="Tipe.io"><img src="https://cdn.tipe.io/tipe/tipe-logo.svg?w=240" style="background:#613DEF" /></a>
<a href="https://webflow.com" title="Webflow"><img src="https://uploads-ssl.webflow.com/583347ca8f6c7ee058111b3b/5b03bde0971fdd75d75b5591_webflow.png" height="100" /></a>
