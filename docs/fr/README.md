<p align="center">
  <a href="https://xstate.js.org">
  <br />
  <img src="https://user-images.githubusercontent.com/1093738/101672561-06aa7480-3a24-11eb-89d1-787fa7112138.png" alt="XState" width="150"/>
  <br />
    <sub><strong>Machines d'état et diagrammes d'état pour le Web moderne.</strong></sub>
  <br />
  <br />
  </a>
</p>

[![npm version](https://badge.fury.io/js/xstate.svg)](https://badge.fury.io/js/xstate)
<img src="https://opencollective.com/xstate/tiers/backer/badge.svg?label=sponsors&color=brightgreen" />

JavaScript et TypeScript [finite state machines](https://en.wikipedia.org/wiki/Finite-state_machine) and [statecharts](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) pour le Web moderne.

Vous débutez avec les machines d'état et les diagrammes d'état ? [Lire notre présentation](/guides/introduction-to-state-machines-and-statecharts/).

🖥 [Téléchargez notre extension VS Code](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode).

📑 Consulter [la specification SCXML](https://www.w3.org/TR/scxml/)

💬 Collaborez avec la Communauté Stately [sur Discord](https://discord.gg/KCtSX7Cdjh)

## Packages

- 🤖 `xstate` - Machine à états finis de base et bibliothèque de diagrammes d'états + interpréteur
- [📉 `@xstate/graph`](https://github.com/statelyai/xstate/tree/main/packages/xstate-graph) - Graph traversal utilities for XState
- [⚛️ `@xstate/react`](https://github.com/statelyai/xstate/tree/main/packages/xstate-react) - Hooks et utilitaires React pour utiliser XState dans les applications React
- [💚 `@xstate/vue`](https://github.com/statelyai/xstate/tree/main/packages/xstate-vue) - Fonctions et utilitaires de composition Vue.js pour utiliser XState dans les applications Vue.js
- [🎷 `@xstate/svelte`](https://github.com/statelyai/xstate/tree/main/packages/xstate-svelte) - Utilitaires Svelte pour utiliser XState dans les applications Svelte
- [✅ `@xstate/test`](https://github.com/statelyai/xstate/tree/main/packages/xstate-test) - Utilitaires de Test basés sur des modèles (utilisant XState) pour tester n'importe quel logiciel
- [🔍 `@xstate/inspect`](https://github.com/statelyai/xstate/tree/main/packages/xstate-inspect) - Utilitaires d'inspection pour XState

## Templates

Commencez par dupliquer l'un de ces modèles sur CodeSandbox :

- [Modèle XState](https://codesandbox.io/s/xstate-example-template-m4ckv) - sans framework
- [Modèle XState + TypeScript](https://codesandbox.io/s/xstate-typescript-template-s9kz8) - sans framework
- [Modèle XState + React](https://codesandbox.io/s/xstate-react-template-3t2tg)
- [Modèle XState + React + TypeScript](https://codesandbox.io/s/xstate-react-typescript-template-wjdvn)
- [Modèle XState + Vue](https://codesandbox.io/s/xstate-vue-template-composition-api-1n23l)
- [Modèle XState + Vue 3](https://codesandbox.io/s/xstate-vue-3-template-vrkk9)
- [Modèle XState + Svelte](https://codesandbox.io/s/xstate-svelte-template-jflv1)

## Démarrage ultra rapide

```bash
npm install xstate
```

```js
import { createMachine, interpret } from 'xstate';

// Définition de machine
// machine.transition(...) est une fonction pure utilisée par l'interpréteur.
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

// Instance de machine avec état interne
const toggleService = interpret(toggleMachine)
  .onTransition((state) => console.log(state.value))
  .start();
// => 'inactive'

toggleService.send({ type: 'TOGGLE' });
// => 'active'

toggleService.send({ type: 'TOGGLE' });
// => 'inactive'
```

## Exemple de promesse

[📉 Visualiser sur stately.ai/viz](https://stately.ai/viz?gist=bbcb4379b36edea0458f597e5eec2f91)

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

- [Visualiseur](#visualizer)
- [Pourquoi?](#why)
- [Machine à états finis](#finite-state-machines)
- [Machines avec états composés](#hierarchical-nested-state-machines)
- [Machines avec états parallèles](#parallel-state-machines)
- [États d'historique](#history-states)
- [Sponsors](#sponsors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Visualiseur

**[Visualisez, simulez et partagez vos diagrammes d'états dans XState Viz !](https://stately.ai/viz)**

<a href="https://stately.ai/viz"><img src="https://i.imgur.com/3pEB0B3.png" alt="Visualiseur Xstate" width="300" /></a>

## Pourquoi ?

Un diagramme d'état est un formalisme permettant de modéliser des systèmes réactifs avec état. Ceci est utile pour décrire de manière déclarative le _comportement_ de votre application, des composants individuels à la logique globale de l'application.

Lire [📽 les slides](http://slides.com/davidkhourshid/finite-state-machines) ([🎥 vidéo](https://www.youtube.com/watch?v=VU1NKX6Qkxc)) ou consultez ces ressources pour en savoir plus sur l'importance des machines à états finis et des diagrammes d'états dans les interfaces utilisateur :

- [Statecharts - A Visual Formalism for Complex Systems](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) par David Harel
- [The World of Statecharts](https://statecharts.github.io/) par Erik Mogensen
- [Pure UI](https://rauchg.com/2015/pure-ui) par Guillermo Rauch
- [Pure UI Control](https://medium.com/@asolove/pure-ui-control-ac8d1be97a8d) par Adam Solove
- [Spectrum - Statecharts Community](https://spectrum.chat/statecharts) (Pour les questions spécifiques à XState, veuillez utiliser les discussions sur [Github](https://github.com/statelyai/xstate/discussions))

## Machines à états finis

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

const nextState = lightMachine.transition(currentState, {
  type: 'TIMER'
}).value;

// => 'yellow'
```

## Machines avec des états composés

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

const nextState = lightMachine.transition(currentState, {
  type: 'TIMER'
}).value;
// => {
//   red: 'walk'
// }

lightMachine.transition('red.walk', { type: 'PED_TIMER' }).value;
// => {
//   red: 'wait'
// }
```

**Notation d'objet pour les états composés:**

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

## Machines avec des états parallèles

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

const boldState = wordMachine.transition('bold.off', {
  type: 'TOGGLE_BOLD'
}).value;

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

## États d'historique

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

## Sponsors

Un grand merci aux entreprises suivantes pour avoir parrainé `xstate`. Vous pouvez parrainer d'autres développements de `xstate` [sur OpenCollective](https://opencollective.com/xstate).

<a href="https://tipe.io" title="Tipe.io"><img src="https://cdn.tipe.io/tipe/tipe-logo.svg?w=240" style="background:#613DEF" alt="Tipe.io"/></a>
<a href="https://webflow.com" title="Webflow"><img src="https://uploads-ssl.webflow.com/583347ca8f6c7ee058111b3b/5b03bde0971fdd75d75b5591_webflow.png" height="100" /></a>
