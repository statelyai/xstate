<p align="center">
  <a href="https://xstate.js.org">
  <br />
  <img src="https://user-images.githubusercontent.com/1093738/101672561-06aa7480-3a24-11eb-89d1-787fa7112138.png" alt="XState" width="150"/>
  <br />
    <sub><strong>Конечные автоматы и диаграммы состояний для современного Интернета.</strong></sub>
  <br />
  <br />
  </a>
</p>

[![npm version](https://badge.fury.io/js/xstate.svg)](https://badge.fury.io/js/xstate)
<img src="https://opencollective.com/xstate/tiers/backer/badge.svg?label=sponsors&color=brightgreen" />

JavaScript и TypeScript [конечные автоматы](https://en.wikipedia.org/wiki/Finite-state_machine) и [диаграммы состояний](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) для современного интернета.

Новичок в конечных автоматах и диаграмах состояний? [Прочтите наше введение](/guides/introduction-to-state-machines-and-statecharts/).

🖥 [Скачать наше VS Code расширение](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode).

📑 Соответствует [SCXML спецификации](https://www.w3.org/TR/scxml/)

💬 Чат в [Stately Discord сообществе](https://discord.gg/KCtSX7Cdjh)

## Пакеты

- 🤖 `xstate` - Базовая библиотека конечных автоматов и диаграмм состояний + интерпретатор
- [🔬 `@xstate/fsm`](https://github.com/statelyai/xstate/tree/main/packages/xstate-fsm) - Минимальная библиотека конечных автоматов
- [📉 `@xstate/graph`](https://github.com/statelyai/xstate/tree/main/packages/xstate-graph) - Утилиты обхода графа для XState
- [⚛️ `@xstate/react`](https://github.com/statelyai/xstate/tree/main/packages/xstate-react) - React xуки и утилиты для использования XState в приложениях React
- [💚 `@xstate/vue`](https://github.com/statelyai/xstate/tree/main/packages/xstate-vue) - Функции композиции и утилиты Vue для использования XState в приложениях Vue
- [🎷 `@xstate/svelte`](https://github.com/statelyai/xstate/tree/main/packages/xstate-svelte) - Утилиты Svelte для использования XState в приложениях Svelte
- [✅ `@xstate/test`](https://github.com/statelyai/xstate/tree/main/packages/xstate-test) - Утилиты Model-Based-Testing (с использованием XState) для тестирования любого программного обеспечения
- [🔍 `@xstate/inspect`](https://github.com/statelyai/xstate/tree/main/packages/xstate-inspect) - Утилиты разработчика (проверки) для XState

## Шаблоны

Начните с создания форка одного из этих шаблонов на CodeSandbox:

- [XState Template](https://codesandbox.io/s/xstate-example-template-m4ckv) - без фреймворков
- [XState + TypeScript Template](https://codesandbox.io/s/xstate-typescript-template-s9kz8) - без фреймворков
- [XState + React Template](https://codesandbox.io/s/xstate-react-template-3t2tg)
- [XState + React + TypeScript Template](https://codesandbox.io/s/xstate-react-typescript-template-wjdvn)
- [XState + Vue Template](https://codesandbox.io/s/xstate-vue-template-composition-api-1n23l)
- [XState + Vue 3 Template](https://codesandbox.io/s/xstate-vue-3-template-vrkk9)
- [XState + Svelte Template](https://codesandbox.io/s/xstate-svelte-template-jflv1)

## Супер быстрый старт

```bash
npm install xstate
```

```js
import { createMachine, interpret } from 'xstate';

// Stateless machine definition
// machine.transition(...) is a pure function used by the interpreter.
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

// Machine instance with internal state
const toggleService = interpret(toggleMachine)
  .onTransition((state) => console.log(state.value))
  .start();
// => 'inactive'

toggleService.send({ type: 'TOGGLE' });
// => 'active'

toggleService.send({ type: 'TOGGLE' });
// => 'inactive'
```

## Пример с промисами

[📉 Визуализация на stately.ai/viz](https://stately.ai/viz?gist=bbcb4379b36edea0458f597e5eec2f91)

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

- [Visualizer](#visualizer)
- [Why?](#why)
- [Finite State Machines](#finite-state-machines)
- [Hierarchical (Nested) State Machines](#hierarchical-nested-state-machines)
- [Parallel State Machines](#parallel-state-machines)
- [History States](#history-states)
- [Sponsors](#sponsors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Визуализатор

**[Визуализируйте, моделируйте и делитесь своими диаграммами состояний в XState Viz!](https://stately.ai/viz)**

<a href="https://stately.ai/viz"><img src="https://i.imgur.com/3pEB0B3.png" alt="XState Visualizer" width="300" /></a>

## Почему?

**Диаграммы состояний** - это формализм для моделирования реактивных систем с отслеживанием состояния. Это полезно для декларативного описания _поведения_ вашего приложения, от отдельных компонентов до общей логики приложения.

Смотрите [📽 слайды](http://slides.com/davidkhourshid/finite-state-machines) ([🎥 видео](https://www.youtube.com/watch?v=VU1NKX6Qkxc)) ли ознакомьтесь с этими ресурсами, чтобы узнать о важности конечных автоматов и диаграмм состояний в пользовательских интерфейсах:

- [Statecharts - A Visual Formalism for Complex Systems](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) by David Harel
- [The World of Statecharts](https://statecharts.github.io/) автор Erik Mogensen
- [Pure UI](https://rauchg.com/2015/pure-ui) автор Guillermo Rauch
- [Pure UI Control](https://medium.com/@asolove/pure-ui-control-ac8d1be97a8d) автор Adam Solove
- [Spectrum - Statecharts Community](https://spectrum.chat/statecharts) (Для вопросов, связанных с XState, используйте [GitHub Discussions](https://github.com/statelyai/xstate/discussions))

## Конечные автоматы

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

## Иерархические (вложенные) конечные автоматы

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

**Объектная нотация для иерархических состояний:**

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

## Параллельные конечные автоматы

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

## История состояний

<img src="https://imgur.com/I4QsQsz.png" width="300" alt="Конечный автомат с историей состояний" />

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

## Спонсоры

Huge thanks to the following companies for sponsoring `xstate`. You can sponsor further `xstate` development [on OpenCollective](https://opencollective.com/xstate).

<a href="https://tipe.io" title="Tipe.io"><img src="https://cdn.tipe.io/tipe/tipe-logo.svg?w=240" style="background:#613DEF" /></a>
<a href="https://webflow.com" title="Webflow"><img src="https://uploads-ssl.webflow.com/583347ca8f6c7ee058111b3b/5b03bde0971fdd75d75b5591_webflow.png" height="100" /></a>
