# `@xstate/store`

XState Store is a library for **simple event-based state management**. If you want a state management library that allows you to update a store's state via events, `@xstate/store` is a great option. If you need more complex application logic needs, like state machines/statecharts, effects, communicating actors, and more, consider [using XState instead](https://github.com/statelyai/xstate).

- **Extremely simple**: transitions update state via events, just like Redux, Zustand, Pinia, etc.
- **Extremely small**: less than 1kb minified/gzipped
- **XState compatible**: use it with (or without) XState, or convert to XState machines when you need to handle more complex logic & effects.
- **Extra type-safe**: great typing out of the box, with strong inference and no awkwardness.

> [!NOTE]
> This readme is written for [TypeScript](#typescript) users. If you are a JavaScript user, just remove the types.

## Installation

```bash
# yarn add @xstate/store
# pnpm add @xstate/store
npm install @xstate/store
```

## Quick start

```ts
import { createStore } from '@xstate/store';

export const donutStore = createStore(
  { donuts: 0, favoriteFlavor: 'chocolate' },

  {
    addDonut: {
      donuts: (context) => context.donuts + 1
    },
    changeFlavor: {
      favoriteFlavor: (context, event: { flavor: string }) => event.flavor
    },
    eatAllDonuts: {
      donuts: 0
    }
  }
);

donutStore.subscribe((snapshot) => {
  console.log(snapshot.context);
});

donutStore.send({ type: 'addDonut' });
// => { donuts: 1, favoriteFlavor: 'chocolate' }

donutStore.send({
  type: 'changeFlavor',
  flavor: 'strawberry' // Strongly-typed!
});
// => { donuts: 1, favoriteFlavor: 'chocolate' }
```

## Usage with React

Import `useSelector` from `@xstate/store/react`. Select the data you want via `useSelector(…)` and send events using `store.send(eventObject)`:

```tsx
import { donutStore } from './donutStore.ts';
import { useSelector } from '@xstate/store/react';

function DonutCounter() {
  const donutCount = useSelector(donutStore, (state) => state.context.donuts);

  return (
    <div>
      <button onClick={() => donutStore.send({ type: 'addDonut' })}>
        Add donut ({donutCount})
      </button>
    </div>
  );
}
```

## Usage with Immer

XState Store makes it really easy to integrate with immutable update libraries like [Immer](https://github.com/immerjs/immer) or [Mutative](https://github.com/unadlib/mutative). Pass the `produce` function into `createStoreWithProducer(producer, …)`, and update `context` in transition functions using the convenient pseudo-mutative API:

```ts
import { createStoreWithProducer } from '@xstate/store';
import { produce } from 'immer'; // or { create } from 'mutative'

const donutStore = createStoreWithProducer(
  produce,
  {
    donuts: 0,
    favoriteFlavor: 'chocolate'
  },
  {
    addDonut: (context) => {
      context.donuts++; // "Mutation" (thanks to the producer)
    },
    changeFlavor: (context, event: { flavor: string }) => {
      context.favoriteFlavor = event.flavor;
    },
    eatAllDonuts: (context) => {
      context.donuts = 0;
    }
  }
);

// Everything else is the same!
```

## TypeScript

XState Store is written in TypeScript and provides full type safety, _without_ you having to specify generic type parameters. The `context` type is inferred from the initial context object, and the event types are inferred from the event object payloads you provide in the transition functions.

```ts
import { createStore } from '@xstate/store';

const donutStore = createStore(
  // Inferred as:
  // {
  //   donuts: number;
  //   favoriteFlavor: string;
  // }
  {
    donuts: 0,
    favoriteFlavor: 'chocolate'
  },
  {
    // Event inferred as:
    // {
    //   type: 'changeFlavor';
    //   flavor: string;
    // }
    changeFlavor: (context, event: { flavor: string }) => {
      context.favoriteFlavor = event.flavor;
    }
  }
);

donutStore.getSnapshot().context.favoriteFlavor; // string

donutStore.send({
  type: 'changeFlavor', // Strongly-typed from transition key
  flavor: 'strawberry' // Strongly-typed from { flavor: string }
});
```

If you want to make the `context` type more specific, you can strongly type the `context` outside of `createStore(…)` and pass it in:

```ts
import { createStore } from '@xstate/store';

interface DonutContext {
  donuts: number;
  favoriteFlavor: 'chocolate' | 'strawberry' | 'blueberry';
}

const donutContext: DonutContext = {
  donuts: 0,
  favoriteFlavor: 'chocolate'
};

const donutStore = createStore(donutContext, {
  // ... (transitions go here)
});
```
