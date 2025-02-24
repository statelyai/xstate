# @xstate/store

## 3.2.0

### Minor Changes

- [#5200](https://github.com/statelyai/xstate/pull/5200) [`0332a16a42fb372eb614df74ff4cb7f003c31fc8`](https://github.com/statelyai/xstate/commit/0332a16a42fb372eb614df74ff4cb7f003c31fc8) Thanks [@{](https://github.com/{)! - Added selectors to @xstate/store that enable efficient state selection and subscription:

  - `store.select(selector)` function to create a "selector" entity where you can:
    - Get current value with `.get()`
    - Subscribe to changes with `.subscribe(callback)`
    - Only notify subscribers when selected value actually changes
    - Support custom equality functions for fine-grained control over updates via `store.select(selector, equalityFn)`

  ```ts
  const store = createStore({
    context: {
      position: { x: 0, y: 0 },
   name: 'John', age: 30 }
    },
    on: {
      positionUpdated: (
        context,
        event: { position: { x: number; y: number } }
      ) => ({
        ...context,
        position: event.position
      })
    }
  });

  const position = store.select((state) => state.context.position);

  position.get(); // { x: 0, y: 0 }

  position.subscribe((position) => {
    console.log(position);
  });

  store.trigger.positionUpdated({ x: 100, y: 200 });
  // Logs: { x: 100, y: 200 }
  ```

## 3.1.0

### Minor Changes

- [#5205](https://github.com/statelyai/xstate/pull/5205) [`65784aef746b6249a9c3d71d9e4a7c9b454698c8`](https://github.com/statelyai/xstate/commit/65784aef746b6249a9c3d71d9e4a7c9b454698c8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added `createStoreConfig` to create a store config from an object. This is an identity function that returns the config unchanged, but is useful for type inference.

  ```tsx
  const storeConfig = createStoreConfig({
    context: { count: 0 },
    on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
  });

  // Reusable store config:

  const store = createStore(storeConfig);

  // ...
  function Comp1() {
    const store = useStore(storeConfig);

    // ...
  }

  function Comp2() {
    const store = useStore(storeConfig);

    // ...
  }
  ```

- [#5205](https://github.com/statelyai/xstate/pull/5205) [`65784aef746b6249a9c3d71d9e4a7c9b454698c8`](https://github.com/statelyai/xstate/commit/65784aef746b6249a9c3d71d9e4a7c9b454698c8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - There is now a `useStore()` hook that allows you to create a local component store from a config object.

  ```tsx
  import { useStore, useSelector } from '@xstate/store/react';

  function Counter() {
    const store = useStore({
      context: {
        name: 'David',
        count: 0
      },
      on: {
        inc: (ctx, { by }: { by: number }) => ({
          ...ctx,
          count: ctx.count + by
        })
      }
    });
    const count = useSelector(store, (state) => state.count);

    return (
      <div>
        <div>Count: {count}</div>
        <button onClick={() => store.trigger.inc({ by: 1 })}>
          Increment by 1
        </button>
        <button onClick={() => store.trigger.inc({ by: 5 })}>
          Increment by 5
        </button>
      </div>
    );
  }
  ```

### Patch Changes

- [#5205](https://github.com/statelyai/xstate/pull/5205) [`65784aef746b6249a9c3d71d9e4a7c9b454698c8`](https://github.com/statelyai/xstate/commit/65784aef746b6249a9c3d71d9e4a7c9b454698c8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createStoreWithProducer(config)` function now accepts an `emits` object.

## 3.0.1

### Patch Changes

- [#5197](https://github.com/statelyai/xstate/pull/5197) [`5e05d5908093bfd3435dc2243e066e4e91b3ebc5`](https://github.com/statelyai/xstate/commit/5e05d5908093bfd3435dc2243e066e4e91b3ebc5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The emitted event type can no longer be accidentally overridden in the emitted event payload. See #5196 for the issue.

## 3.0.0

### Major Changes

- [#5175](https://github.com/statelyai/xstate/pull/5175) [`38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5`](https://github.com/statelyai/xstate/commit/38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createStore` function now only accepts a single configuration object argument. This is a breaking change that simplifies the API and aligns with the configuration pattern used throughout XState.

  ```ts
  // Before
  // createStore(
  //   {
  //     count: 0
  //   },
  //   {
  //     increment: (context) => ({ count: context.count + 1 })
  //   }
  // );

  // After
  createStore({
    context: {
      count: 0
    },
    on: {
      increment: (context) => ({ count: context.count + 1 })
    }
  });
  ```

- [#5175](https://github.com/statelyai/xstate/pull/5175) [`38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5`](https://github.com/statelyai/xstate/commit/38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now enqueue effects in state transitions.

  ```ts
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      incrementDelayed: (context, event, enq) => {
        enq.effect(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          store.send({ type: 'increment' });
        });

        return context;
      },
      increment: (context) => ({ count: context.count + 1 })
    }
  });
  ```

- [#5175](https://github.com/statelyai/xstate/pull/5175) [`38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5`](https://github.com/statelyai/xstate/commit/38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `fromStore(config)` function now only supports a single config object argument.

  ```ts
  const storeLogic = fromStore({
    context: (input: { initialCount: number }) => ({
      count: input.initialCount
    }),
    on: {
      inc: (ctx, ev: { by: number }) => ({
        ...ctx,
        count: ctx.count + ev.by
      })
    }
  });
  ```

- [#5175](https://github.com/statelyai/xstate/pull/5175) [`38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5`](https://github.com/statelyai/xstate/commit/38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createStoreWithProducer(…)` function now only accepts two arguments: a `producer` and a config (`{ context, on }`) object.

  ```ts
  // Before
  // createStoreWithProducer(
  //   producer,
  //   {
  //     count: 0
  //   },
  //   {
  //     increment: (context) => {
  //       context.count++;
  //     }
  //   }
  // );

  // After
  createStoreWithProducer(producer, {
    context: {
      count: 0
    },
    on: {
      increment: (context) => {
        context.count++;
      }
    }
  });
  ```

- [#5175](https://github.com/statelyai/xstate/pull/5175) [`38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5`](https://github.com/statelyai/xstate/commit/38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Only complete assigner functions that replace the `context` fully are supported. This is a breaking change that simplifies the API and provides more type safety.

  ```diff
  const store = createStore({
    context: {
      items: [],
      count: 0
    },
    on: {
  -   increment: { count: (context) => context.count + 1 }
  -   increment: (context) => ({ count: context.count + 1 })
  +   increment: (context) => ({ ...context, count: context.count + 1 })
    }
  })
  ```

- [#5175](https://github.com/statelyai/xstate/pull/5175) [`38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5`](https://github.com/statelyai/xstate/commit/38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Emitted event types are now specified in functions on the `emits` property of the store definition:

  ```ts
  const store = createStore({
    // …
    emits: {
      increased: (payload: { upBy: number }) => {
        // You can execute a side-effect here
        // or leave it empty
      }
    },
    on: {
      inc: (ctx, ev: { by: number }, enq) => {
        enq.emit.increased({ upBy: ev.by });

        // …
      }
    }
  });
  ```

### Minor Changes

- [#5175](https://github.com/statelyai/xstate/pull/5175) [`38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5`](https://github.com/statelyai/xstate/commit/38aa9f518ee2f9a5f481306a1dc68c0ad47d28d5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added `store.trigger` API for sending events with a fluent interface:

  ```ts
  const store = createStore({
    context: { count: 0 },
    on: {
      increment: (ctx, event: { by: number }) => ({
        count: ctx.count + event.by
      })
    }
  });

  // Instead of manually constructing event objects:
  store.send({ type: 'increment', by: 5 });

  // You can now use the fluent trigger API:
  store.trigger.increment({ by: 5 });
  ```

  The `trigger` API provides full type safety for event names and payloads, making it easier and safer to send events to the store.

## 2.6.2

### Patch Changes

- [#5136](https://github.com/statelyai/xstate/pull/5136) [`c051ff7ce7d09729ccc0630d684ef5168815f507`](https://github.com/statelyai/xstate/commit/c051ff7ce7d09729ccc0630d684ef5168815f507) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an accidental used reference of `xstate` types

## 2.6.1

### Patch Changes

- [#5109](https://github.com/statelyai/xstate/pull/5109) [`d67b71dd25d457a2a59f2c943db13f50fab7ec3d`](https://github.com/statelyai/xstate/commit/d67b71dd25d457a2a59f2c943db13f50fab7ec3d) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add React 19 as a peer dependency

## 2.6.0

### Minor Changes

- [#5079](https://github.com/statelyai/xstate/pull/5079) [`25963966c394fc904dc9b701a420b6e204ebe7f7`](https://github.com/statelyai/xstate/commit/25963966c394fc904dc9b701a420b6e204ebe7f7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createStoreWithProducer(…)` function now uses the new configuration API:

  ```ts
  import { createStoreWithProducer } from '@xstate/store';
  // DEPRECATED API
  // const store = createStoreWithProducer(
  //   producer,
  //   {
  //     count: 0
  //   },
  //   {
  //     inc: (context, event) => {
  //       context.count++;
  //     }
  //   }
  // );

  const store = createStoreWithProducer(producer, {
    context: {
      count: 0
    },
    on: {
      inc: (context, event) => {
        context.count++;
      }
    }
  });
  ```

## 2.5.0

### Minor Changes

- [#5085](https://github.com/statelyai/xstate/pull/5085) [`51437a4d036029ab4ff74cb52721178b3e525c48`](https://github.com/statelyai/xstate/commit/51437a4d036029ab4ff74cb52721178b3e525c48) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `shallowEqual` comparator has been added for selector comparison:

  ```tsx
  import { shallowEqual } from '@xstate/store';
  import { useSelector } from '@xstate/store/react';

  import { store } from './store';

  function MyComponent() {
    const state = useSelector(
      store,
      (s) => {
        return s.items.filter(/* ... */);
      },
      shallowEqual
    );

    // ...
  }
  ```

## 2.4.0

### Minor Changes

- [#5064](https://github.com/statelyai/xstate/pull/5064) [`84aca37d0b02cb9cd5a32c8fd09e487bd8fe2a47`](https://github.com/statelyai/xstate/commit/84aca37d0b02cb9cd5a32c8fd09e487bd8fe2a47) Thanks [@davidkpiano](https://github.com/davidkpiano)! - There is a new single-argument config API for `createStore(config)`:

  ```ts
  const store = createStore({
    // Types (optional)
    types: {
      emitted: {} as { type: 'incremented' }
    },

    // Context
    context: { count: 0 },

    // Transitions
    on: {
      inc: (context, event: { by: number }, enq) => {
        enq.emit({ type: 'incremented' });

        return { count: context.count + event.by };
      },
      dec: (context, event: { by: number }) => ({
        count: context.count - event.by
      })
    }
  });
  ```

- [#5064](https://github.com/statelyai/xstate/pull/5064) [`84aca37d0b02cb9cd5a32c8fd09e487bd8fe2a47`](https://github.com/statelyai/xstate/commit/84aca37d0b02cb9cd5a32c8fd09e487bd8fe2a47) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now emit events from a store:

  ```ts
  import { createStore } from '@xstate/store';

  const store = createStore({
    context: {
      count: 0
    },
    on: {
      increment: (context, event, { emit }) => {
        emit({ type: 'incremented' });
        return { count: context.count + 1 };
      }
    }
  });

  store.on('incremented', () => {
    console.log('incremented!');
  });
  ```

## 2.3.0

### Minor Changes

- [#5056](https://github.com/statelyai/xstate/pull/5056) [`8c35da9a72`](https://github.com/statelyai/xstate/commit/8c35da9a72bf067a275335d0391ce9ab85ed8a12) Thanks [@steveadams](https://github.com/steveadams)! - You can now use the xstate/store package with SolidJS.

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

## 2.2.1

### Patch Changes

- [`b740aafdb1`](https://github.com/statelyai/xstate/commit/b740aafdb12ed6577ba31d0e07653bf99ebaca76) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fixed some small issues from #5027 regarding XState types being imported

## 2.2.0

### Minor Changes

- [#5027](https://github.com/statelyai/xstate/pull/5027) [`758a78711d`](https://github.com/statelyai/xstate/commit/758a78711ddb35ce56951b551d48f9b6f54a37b5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now inspect XState stores using the `.inspect(inspector)` method:

  ```ts
  import { someStore } from './someStore';

  someStore.inspect((inspEv) => {
    console.log(inspEv);
    // logs "@xstate.event" events and "@xstate.snapshot" events
    // whenever an event is sent to the store
  });
  // The "@xstate.actor" event is immediately logged
  ```

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
