# @xstate/store

## 2.1.0

### Minor Changes

- [#5020](https://github.com/statelyai/xstate/pull/5020) [`e974797b0`](https://github.com/statelyai/xstate/commit/e974797b0b8d4e8f5929cc01b674a5ff92fa2115) Thanks [@with-heart](https://github.com/with-heart)! - Added the `EventFromStore` utility type which extracts the type of events from a store:

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

  ***

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

## 2.0.0

### Major Changes

- [#5000](https://github.com/statelyai/xstate/pull/5000) [`eeadb7121`](https://github.com/statelyai/xstate/commit/eeadb7121e8523cf34fe3a299731ca085152c65d) Thanks [@TkDodo](https://github.com/TkDodo)! - - Replace `use-sync-external-store/shim` with `useSyncExternalStore` from React.
  - Do not memoize `getSnapshot` in `useSyncExternalStore`.
  - Implement `getServerSnapshot` in `useSyncExternalStore`.
  - Expect `store` to always be defined in `useSelector`
  - Update React types to v18 and testing library to v16.

## 1.0.0

### Major Changes

- [#4921](https://github.com/statelyai/xstate/pull/4921) [`f73366504`](https://github.com/statelyai/xstate/commit/f73366504684266e4a1c7c997896b310ec2e7f29) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Release `@xstate/store` version 1.0

## 0.0.5

### Patch Changes

- [#4918](https://github.com/statelyai/xstate/pull/4918) [`3323c85a6`](https://github.com/statelyai/xstate/commit/3323c85a6159d63fc73e83985ef46796f3582d90) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Types are now exported:

  ```ts
  import type { SnapshotFromStore } from '@xstate/store';

  // ...
  ```

## 0.0.4

### Patch Changes

- [#4890](https://github.com/statelyai/xstate/pull/4890) [`6d92b7770`](https://github.com/statelyai/xstate/commit/6d92b77704750498f669487da185eb005a080034) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `context` type for `createStoreWithProducer(producer, context, transitions)` will now be properly inferred.

  ```ts
  const store = createStoreWithProducer(
    produce,
    {
      count: 0
    },
    {
      // ...
    }
  );

  store.getSnapshot().context;
  // BEFORE: StoreContext
  // NOW: { count: number }
  ```

## 0.0.3

### Patch Changes

- [#4842](https://github.com/statelyai/xstate/pull/4842) [`3a57f4c69`](https://github.com/statelyai/xstate/commit/3a57f4c69b746546dd104989dcf8664c9fbe2f80) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update README.md

- [#4839](https://github.com/statelyai/xstate/pull/4839) [`4a22edb90`](https://github.com/statelyai/xstate/commit/4a22edb904c1f2517db41e09030d0e9993891796) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update JS docs

## 0.0.2

### Patch Changes

- [#4752](https://github.com/statelyai/xstate/pull/4752) [`8a32374e7`](https://github.com/statelyai/xstate/commit/8a32374e79b191dd3bfbab41a15d1b1b4adfd131) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Initial release of `@xstate/store`

  ```ts
  import { createStore } from '@xstate/store';

  const store = createStore(
    // initial context
    { count: 0, greeting: 'hello' },
    // transitions
    {
      inc: {
        count: (context) => context.count + 1
      },
      updateBoth: {
        count: () => 42,
        greeting: 'hi'
      }
    }
  );

  store.send({
    type: 'inc'
  });

  console.log(store.getSnapshot());
  // Logs:
  // {
  //   status: 'active',
  //   context: {
  //     count: 1,
  //     greeting: 'hello'
  //   }
  // }
  ```
