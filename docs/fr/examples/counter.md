# Compteur

Cet exemple d'application de compteur montre un compteur qui a un seul état (`'active'`) et deux événements possibles :

- `'INC'` - incrémenter le nombre actuel de 1
- `'DEC'` - décrémenter le nombre actuel de 1

La valeur de la variable `count` est stocké dans le [`contexte`](../guides/context.md).

```js
import { createMachine, interpret, assign } from 'xstate';

const increment = (context) => context.count + 1;
const decrement = (context) => context.count - 1;

const counterMachine = createMachine({
  initial: 'active',
  context: {
    count: 0
  },
  states: {
    active: {
      on: {
        INC: { actions: assign({ count: increment }) },
        DEC: { actions: assign({ count: decrement }) }
      }
    }
  }
});

const counterService = interpret(counterMachine)
  .onTransition((state) => console.log(state.context.count))
  .start();
// => 0

counterService.send({ type: 'INC' });
// => 1

counterService.send({ type: 'INC' });
// => 2

counterService.send({ type: 'DEC' });
// => 1
```

## Modélisation Min et Max

Avec les [protections](../guides/guards.md), nous pouvons introduire un minimum et un maximum en empêchant les transitions sur les événements `'DEC'` et `'INC'` sur certaines valeurs, respectivement :

```js
// ...

const isNotMax = (context) => context.count < 10;
const isNotMin = (context) => context.count >= 0;

const counterMachine = createMachine({
  initial: 'active',
  context: {
    count: 0
  },
  states: {
    active: {
      on: {
        INC: {
          actions: assign({ count: increment }),
          cond: isNotMax
        },
        DEC: {
          actions: assign({ count: decrement }),
          cond: isNotMin
        }
      }
    }
  }
});

// ...

// Supposons que le valeur du contexte était { count: 9 }
counterService.send({ type: 'INC' });
// => 10

counterService.send({ type: 'INC' }); // Pas de transition !
// => 10
```
