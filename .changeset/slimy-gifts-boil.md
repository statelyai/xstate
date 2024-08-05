---
'@xstate/store': minor
---

Added the `EventFromStore` utility type which extracts the type of events from a store:

```ts
import { createStore, type EventFromStore } from '@xstate/store';

const store = createStore(
  { count: 0 },
  {
    add: (context, event: { addend: number }) => ({
      count: context.count + event.addend
    }),
    multiply: (context, event: { multiplier: number }) => ({
      count: context.count * event.multiplier
    })
  }
);

type StoreEvent = EventFromStore<typeof store>;
//   ^? { type: 'add'; addend: number } | { type: 'multiply'; multiplier: number }
```

---

`EventFromStore` allows us to create our own utility types which operate on a store's event types.

For example, we could create a type `EventByType` which extracts the specific type of store event where `Type` matches the event's `type` property:

```ts
import { type EventFromStore, type Store } from '@xstate/store';

/**
 * Extract the event where `Type` matches the event's `type` from the given
 * `Store`.
 */
type EventByType<
  TStore extends Store<any, any>,
  // creates a type-safe relationship between `Type` and the `type` keys of the
  // store's events
  Type extends EventFromStore<TStore>['type']
> = Extract<EventFromStore<TStore>, { type: Type }>;
```

Here's how the type works with the `store` we defined in the first example:

```ts
// we get autocomplete listing the store's event `type` values on the second
// type parameter
type AddEvent = EventByType<typeof store, 'add'>;
//   ^? { type: 'add'; addend: number }

type MultiplyEvent = EventByType<typeof store, 'multiply'>;
//   ^? { type: 'multiply'; multiplier: number }

// the second type parameter is type-safe, meaning we get a type error if the
// value isn't a valid event `type`
type DivideEvent = EventByType<typeof store, 'divide'>;
// Type '"divide"' does not satisfy the constraint '"add" | "multiply"'.ts(2344)
```

Building on that, we could create a type `EventInputByType` to extract a specific event's "input" type (the event type without the `type` property):

```ts
import { type EventFromStore, type Store } from '@xstate/store';

/**
 * Extract a specific store event's "input" type (the event type without the
 * `type` property).
 */
type EventInputByType<
  TStore extends Store<any, any>,
  Type extends EventFromStore<TStore>['type']
> = Omit<EventByType<TStore, Type>, 'type'>;
```

And here's how `EventInputByType` works with our example `store`:

```ts
type AddInput = EventInputByType<typeof store, 'add'>;
//   ^? { addend: number }

type MultiplyInput = EventInputByType<typeof store, 'multiply'>;
//   ^? { multiplier: number }

type DivideInput = EventInputByType<typeof store, 'divide'>;
// Type '"divide"' does not satisfy the constraint '"add" | "multiply"'.ts(2344)
```

Putting it all together, we can use `EventInputByType` to create a type-safe transition function for each of our store's defined events:

```ts
import { createStore, type EventFromStore, type Store } from '@xstate/store';

/**
 * Extract the event where `Type` matches the event's `type` from the given
 * `Store`.
 */
type EventByType<
  TStore extends Store<any, any>,
  Type extends EventFromStore<TStore>['type']
> = Extract<EventFromStore<TStore>, { type: Type }>;

/**
 * Extract a specific store event's "input" type (the event type without the
 * `type` property).
 */
type EventInputByType<
  TStore extends Store<any, any>,
  Type extends EventFromStore<TStore>['type']
> = Omit<EventByType<TStore, Type>, 'type'>;

const store = createStore(
  { count: 0 },
  {
    add: (context, event: { addend: number }) => ({
      count: context.count + event.addend
    }),
    multiply: (context, event: { multiplier: number }) => ({
      count: context.count * event.multiplier
    })
  }
);

const add = (input: EventInputByType<typeof store, 'add'>) =>
  store.send({ type: 'add', addend: input.addend });

add({ addend: 1 }); // sends { type: 'add', addend: 1 }

const multiply = (input: EventInputByType<typeof store, 'multiply'>) =>
  store.send({ type: 'multiply', multiplier: input.multiplier });

multiply({ multiplier: 2 }); // sends { type: 'multiply', multiplier: 2 }
```

Happy typing!
