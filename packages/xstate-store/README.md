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

export const donutStore = createStore({
  context: {
    donuts: 0,
    favoriteFlavor: 'chocolate'
  },
  on: {
    addDonut: (context) => ({
      ...context,
      donuts: context.donuts + 1
    }),
    changeFlavor: (context, event: { flavor: string }) => ({
      ...context,
      favoriteFlavor: event.flavor
    }),
    eatAllDonuts: (context) => ({
      ...context,
      donuts: 0
    })
  }
});

donutStore.subscribe((snapshot) => {
  console.log(snapshot.context);
});

// Equivalent to
// donutStore.send({ type: 'addDonut' });
donutStore.trigger.addDonut();
// => { donuts: 1, favoriteFlavor: 'chocolate' }

// donutStore.send({
//   type: 'changeFlavor',
//   flavor: 'strawberry' // Strongly-typed!
// });
donutStore.trigger.changeFlavor({ flavor: 'strawberry' });
// => { donuts: 1, favoriteFlavor: 'strawberry' }
```

<details>
<summary>Note: Deprecated <code>createStore(context, transitions)</code> API

</summary>

The previous version of `createStore` took two arguments: an initial context and an object of event handlers. This API is still supported but deprecated. Here's an example of the old usage:

```ts
import { createStore } from '@xstate/store';

const donutStore = createStore(
  {
    donuts: 0,
    favoriteFlavor: 'chocolate'
  },
  {
    addDonut: (context) => ({ ...context, donuts: context.donuts + 1 }),
    changeFlavor: (context, event: { flavor: string }) => ({
      ...context,
      favoriteFlavor: event.flavor
    }),
    eatAllDonuts: (context) => ({ ...context, donuts: 0 })
  }
);
```

We recommend using the new API for better type inference and more explicit configuration.

</details>

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

## Usage with SolidJS

Import `useSelector` from `@xstate/store/solid`. Select the data you want via `useSelector(…)` and send events using `store.send(eventObject)`:

```tsx
import { donutStore } from './donutStore.ts';
import { useSelector } from '@xstate/store/solid';

function DonutCounter() {
  const donutCount = useSelector(donutStore, (state) => state.context.donuts);

  return (
    <div>
      <button onClick={() => donutStore.send({ type: 'addDonut' })}>
        Add donut ({donutCount()})
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

const donutStore = createStoreWithProducer(produce, {
  context: {
    donuts: 0,
    favoriteFlavor: 'chocolate'
  },
  on: {
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
});

// Everything else is the same!
```

## TypeScript

XState Store is written in TypeScript and provides full type safety, _without_ you having to specify generic type parameters. The `context` type is inferred from the initial context object, and the event types are inferred from the event object payloads you provide in the transition functions.

```ts
import { createStore } from '@xstate/store';

const donutStore = createStore({
  // Context inferred as:
  // {
  //   donuts: number;
  //   favoriteFlavor: string;
  // }
  context: {
    donuts: 0,
    favoriteFlavor: 'chocolate'
  },
  on: {
    // Event inferred as:
    // {
    //   type: 'changeFlavor';
    //   flavor: string;
    // }
    changeFlavor: (context, event: { flavor: string }) => {
      context.favoriteFlavor = event.flavor;
    }
  }
});

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

const donutStore = createStore({
  context: donutContext,
  on: {
    // ... (transitions go here)
  }
});
```

## Effects and Side Effects

You can enqueue effects in state transitions using the `enqueue` argument:

```ts
import { createStore } from '@xstate/store';

const store = createStore({
  context: { count: 0 },
  on: {
    incrementDelayed: (context, event, enqueue) => {
      enqueue.effect(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        store.send({ type: 'increment' });
      });

      return context;
    },
    increment: (context) => ({
      ...context,
      count: context.count + 1
    })
  }
});
```

## Emitting Events

You can emit events from transitions by defining them in the `emits` property and using `enqueue.emit`:

```ts
import { createStore } from '@xstate/store';

const store = createStore({
  context: { count: 0 },
  emits: {
    increased: (payload: { by: number }) => {
      // Optional side effects can go here
    }
  },
  on: {
    inc: (context, event: { by: number }, enqueue) => {
      enqueue.emit.increased({ by: event.by });

      return {
        ...context,
        count: context.count + event.by
      };
    }
  }
});

// Listen for emitted events
store.on('increased', (event) => {
  console.log(`Count increased by ${event.by}`);
});
```
