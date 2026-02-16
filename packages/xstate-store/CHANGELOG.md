# @xstate/store

## 3.16.0

### Minor Changes

- [#5467](https://github.com/statelyai/xstate/pull/5467) [`d54cc47`](https://github.com/statelyai/xstate/commit/d54cc4760513ba05e9c0fc7a4a783d0c47a882f2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add wildcard `'*'` support for `store.on('*', …)` to listen to all emitted events. The handler receives the union of all emitted event types.

  ```ts
  const store = createStore({
    context: { count: 0 },
    emits: {
      increased: (_: { upBy: number }) => {},
      decreased: (_: { downBy: number }) => {}
    },
    on: {
      inc: (ctx, _, enq) => {
        enq.emit.increased({ upBy: 1 });
        return { ...ctx, count: ctx.count + 1 };
      }
    }
  });

  store.on('*', (ev) => {
    // ev:
    // | { type: 'increased'; upBy: number }
    // | { type: 'decreased'; downBy: number }
  });
  ```

## 3.15.0

### Minor Changes

- [#5441](https://github.com/statelyai/xstate/pull/5441) [`6ba9538`](https://github.com/statelyai/xstate/commit/6ba9538e05022c9aad9e4a4f089a87aaed54c06a) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added new framework adapter packages for `@xstate/store` and deprecated:
  - `@xstate/store/react` (use `@xstate/store-react` instead)
  - `@xstate/store/solid` (use `@xstate/store-solid` instead)

  ```diff
  - import { useSelector } from '@xstate/store/react';
  + import { useSelector } from '@xstate/store-react';
  ```

  ```diff
  - import { useSelector } from '@xstate/store/solid';
  + import { useSelector } from '@xstate/store-solid';
  ```

## 3.14.1

### Patch Changes

- [#5437](https://github.com/statelyai/xstate/pull/5437) [`ae93af1`](https://github.com/statelyai/xstate/commit/ae93af1a9813c9e7f6ad5eb34fe0f087c147e890) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Update the internal atom implementation (alien-signals)

## 3.14.0

### Minor Changes

- [#5427](https://github.com/statelyai/xstate/pull/5427) [`77ec4ad`](https://github.com/statelyai/xstate/commit/77ec4ad34e3f7e7109a41edd13353bec640cd1a7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `.with()` method for store extensions.

  ```ts
  import { createStore } from '@xstate/store';
  import { undoRedo } from '@xstate/store/undo';

  const store = createStore({
    context: { count: 0 },
    on: {
      inc: (ctx) => ({ count: ctx.count + 1 }),
      dec: (ctx) => ({ count: ctx.count - 1 })
    }
  }).with(undoRedo());

  store.trigger.inc(); // count = 1

  // Added from the undoRedo extension
  store.trigger.undo(); // count = 0
  store.trigger.redo(); // count = 1
  ```

## 3.13.0

### Minor Changes

- [#5415](https://github.com/statelyai/xstate/pull/5415) [`068f2a7`](https://github.com/statelyai/xstate/commit/068f2a7932343a3a7d418fa87e172a9de9f5e6cb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add snapshot-based undo/redo strategy to `undoRedo(…)`:

  ```ts
  // Snapshot strategy (faster undo/redo, more memory)
  undoRedo(config, {
    strategy: 'snapshot',
    historyLimit: 10
  });
  ```

## 3.12.0

### Minor Changes

- [#5410](https://github.com/statelyai/xstate/pull/5410) [`45d97de`](https://github.com/statelyai/xstate/commit/45d97de0a174b274aea69d02e27a59b224c2b855) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix go-to-definition for triggers

- [#5414](https://github.com/statelyai/xstate/pull/5414) [`524a207`](https://github.com/statelyai/xstate/commit/524a207e20ee07560170817052763ad7f3c71d66) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Computed atoms can now access their previous value via an optional second parameter:

  ```ts
  const count = createAtom(1);
  const double = createAtom<number>((_, prev) => count.get() + (prev ?? 0));
  ```

## 3.11.2

### Patch Changes

- [#5401](https://github.com/statelyai/xstate/pull/5401) [`d345e1f`](https://github.com/statelyai/xstate/commit/d345e1fa497c2196e296512937ed52e1c76fd6be) Thanks [@davidkpiano](https://github.com/davidkpiano)! - - Fix type inference for emitted event types when using `undoRedo`.

## 3.11.1

### Patch Changes

- [#5395](https://github.com/statelyai/xstate/pull/5395) [`8408430`](https://github.com/statelyai/xstate/commit/84084304a1daf19593e8a1c4b13fb73b901a06e8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix redo logic bug where redo would apply too many events when no transaction grouping is used

## 3.11.0

### Minor Changes

- [#5393](https://github.com/statelyai/xstate/pull/5393) [`6d00d3f`](https://github.com/statelyai/xstate/commit/6d00d3fd3cdb27b3bb19557cc9ee84f85bd38fe8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `snapshot` parameter to `getTransactionId` function.

  ```ts
  const store = createStore(
    undo(
      {
        // ...
      },
      {
        getTransactionId: (event, snapshot) =>
          snapshot.context.currentTransactionId
      }
    )
  );
  ```

- [#5392](https://github.com/statelyai/xstate/pull/5392) [`5854b52`](https://github.com/statelyai/xstate/commit/5854b52c3fa1915f7f4620f144482d164af535e8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added an overload to `useSelector` that allows you to select the entire snapshot:

  ```ts
  // No selector provided, return the entire snapshot
  const snapshot = useSelector(store);
  ```

- [#5393](https://github.com/statelyai/xstate/pull/5393) [`6d00d3f`](https://github.com/statelyai/xstate/commit/6d00d3fd3cdb27b3bb19557cc9ee84f85bd38fe8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `skipEvent` option to `undoRedo()` to exclude certain events from undo/redo history.

  ```ts
  const store = createStore(
    undoRedo(
      {
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 }),
          log: (ctx) => ctx // No state change
        }
      },
      {
        skipEvent: (event, snapshot) => event.type === 'log'
      }
    )
  );
  ```

## 3.10.0

### Minor Changes

- [#5323](https://github.com/statelyai/xstate/pull/5323) [`cb08332`](https://github.com/statelyai/xstate/commit/cb0833241cb2c0d2a908c413e79fc07b3d7a5fd9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added support for effect-only transitions that don't trigger state updates. Now, when a transition returns the same state but includes effects, subscribers won't be notified of a state change, but the effects will still be executed. This helps prevent unnecessary re-renders while maintaining side effect functionality.

  ```ts
  it('should not trigger update if the snapshot is the same even if there are effects', () => {
    const store = createStore({
      context: { count: 0 },
      on: {
        doNothing: (ctx, _, enq) => {
          enq.effect(() => {
            // …
          });
          return ctx; // Context is the same, so no update is triggered
          // This is the same as not returning anything (void)
        }
      }
    });

    const spy = vi.fn();
    store.subscribe(spy);

    store.trigger.doNothing();
    store.trigger.doNothing();

    expect(spy).toHaveBeenCalledTimes(0);
  });
  ```

## 3.9.3

### Patch Changes

- [#5383](https://github.com/statelyai/xstate/pull/5383) [`4b6a513`](https://github.com/statelyai/xstate/commit/4b6a513ebd7ee1ab067856be4b431651b491cba5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix: `trigger` methods now work when passed directly as event handlers, even for events with no payload. Before, the React `event.type` would overwrite the intended event type.

## 3.9.2

### Patch Changes

- [#5361](https://github.com/statelyai/xstate/pull/5361) [`7f8d90a`](https://github.com/statelyai/xstate/commit/7f8d90a5a6e851ade55e94a9569f746aaebc160a) Thanks [@johnsoncodehk](https://github.com/johnsoncodehk)! - Synchronize the alien-signals algorithm to 2.0.7.

  This is primarily to fix the severe performance degradation discovered in vuejs/core: vuejs/core#13654

## 3.9.1

### Patch Changes

- [#5359](https://github.com/statelyai/xstate/pull/5359) [`3f4bffc`](https://github.com/statelyai/xstate/commit/3f4bffc3dc9e4797207617f8166d5b8aac8d64ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix `createStoreHook` to create a single shared store instance across all components. Previously, the implementation was creating independent store instances, but now multiple components using the same hook will share state as expected.

## 3.9.0

### Minor Changes

- [#5354](https://github.com/statelyai/xstate/pull/5354) [`515cc31`](https://github.com/statelyai/xstate/commit/515cc31063f04a7cd238006a485ae9368a8c1278) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `createStoreHook(…)` function for React. Creates a store hook that returns `[selectedValue, store]` instead of managing store instances manually.

  ```tsx
  const useCountStore = createStoreHook({
    context: { count: 0 },
    on: {
      inc: (ctx, event: { by: number }) => ({
        ...ctx,
        count: ctx.count + event.by
      })
    }
  });

  // Usage
  const [count, store] = useCountStore((s) => s.context.count);
  store.trigger.inc({ by: 3 });

  // Usage (no selector)
  const [snapshot, store] = useCountStore();
  ```

## 3.8.5

### Patch Changes

- [#5347](https://github.com/statelyai/xstate/pull/5347) [`4dff4e9`](https://github.com/statelyai/xstate/commit/4dff4e94d6aa547f0b1ae37e51e96281a252d236) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix TypeScript error localization in `createStore(…)` overloads

  Previously, TS errors in transitions would appear on the `createStore` call itself rather than on the specific transition.

## 3.8.4

### Patch Changes

- [#5337](https://github.com/statelyai/xstate/pull/5337) [`b64a6c9`](https://github.com/statelyai/xstate/commit/b64a6c925d87bce6246d35e562bdda6907e2e33f) Thanks [@flbn](https://github.com/flbn)! - chore: add missing EventFromStoreConfig, EmitsFromStoreConfig, ContextFromStoreConfig types from @xstate/store exports

## 3.8.3

### Patch Changes

- [#5334](https://github.com/statelyai/xstate/pull/5334) [`c4adf25`](https://github.com/statelyai/xstate/commit/c4adf25331faeb15004d449b35799c53bd069b1b) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createStore` function now supports explicit generic type parameters for better type control when needed. This allows you to specify the exact types for context, events, and emitted events instead of relying solely on type inference if desired.

  ```ts
  type CoffeeContext = {
    beans: number;
    cups: number;
  };

  type CoffeeEvents =
    | { type: 'addBeans'; amount: number }
    | { type: 'brewCup' };

  type CoffeeEmitted =
    | { type: 'beansAdded'; amount: number }
    | { type: 'cupBrewed' };

  const coffeeStore = createStore<CoffeeContext, CoffeeEvents, CoffeeEmitted>({
    context: {
      beans: 0,
      cups: 0
    },
    on: {
      addBeans: (ctx, event, enq) => {
        enq.emit.beansAdded({ amount: event.amount });
        return { ...ctx, beans: ctx.beans + event.amount };
      },
      brewCup: (ctx, _, enq) => {
        if (ctx.beans > 0) {
          enq.emit.cupBrewed();
          return { ...ctx, beans: ctx.beans - 1, cups: ctx.cups + 1 };
        }

        return ctx;
      }
    }
  });
  ```

## 3.8.2

### Patch Changes

- [#5329](https://github.com/statelyai/xstate/pull/5329) [`8a27bc4`](https://github.com/statelyai/xstate/commit/8a27bc43f975b03dc82a7e381a3956af49fb0633) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix: `createAsyncAtom` now properly propagates status updates after promise resolves/rejects.

## 3.8.1

### Patch Changes

- [#5326](https://github.com/statelyai/xstate/pull/5326) [`68ab6fb`](https://github.com/statelyai/xstate/commit/68ab6fb72d20c5bd2eb8d1d6249dc3046da79010) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The XState Store undo/redo package can now be imported as `@xstate/store/undo`.

  ```ts
  import { createStore } from '@xstate/store';
  import { undoRedo } from '@xstate/store/undo';

  const store = createStore(
    undoRedo({
      context: {
        count: 0
      },
      on: {
        // ...
      }
    })
  );

  // ...
  ```

## 3.8.0

### Minor Changes

- [#5305](https://github.com/statelyai/xstate/pull/5305) [`725530f`](https://github.com/statelyai/xstate/commit/725530fd462c4300319fad82efc545ff44cf3e22) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added undo/redo functionality to XState Store via the `undoRedo` higher-order store logic:
  - Adds `undo` and `redo` events to stores
  - Supports grouping related events into transactions using `transactionId`
  - Maintains event history for precise state reconstruction
  - Automatically clears redo stack when new events occur

  ```ts
  import { createStore } from '@xstate/store';
  import { undoRedo } from '@xstate/store/undo';

  const store = createStore(
    undoRedo({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 }),
        dec: (ctx) => ({ count: ctx.count - 1 })
      }
    })
  );

  store.trigger.inc();
  // count: 1
  store.trigger.inc();
  // count: 2
  store.trigger.undo();
  // count: 1
  store.trigger.undo();
  // count: 0
  store.trigger.redo();
  // count: 1
  store.trigger.redo();
  // count: 2
  ```

## 3.7.1

### Patch Changes

- [#5307](https://github.com/statelyai/xstate/pull/5307) [`b269485`](https://github.com/statelyai/xstate/commit/b269485e47b95fa57bbc75e34352f107ef2c37c3) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix the types for `useAtom` to accept `ReadonlyAtom` values.

## 3.7.0

### Minor Changes

- [#5302](https://github.com/statelyai/xstate/pull/5302) [`809d8b5`](https://github.com/statelyai/xstate/commit/809d8b53869ac7d664ec1b1d634eb8286a0d4cd2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `useAtom` hook is now available for reading the value of an atom or selecting a value from the atom.

  ```tsx
  const atom = createAtom(0);

  const Component = () => {
    const count = useAtom(atom);

    return (
      <>
        <div onClick={() => atom.set((c) => c + 1)}>{count}</div>
        <button onClick={() => atom.set(0)}>Reset</button>
      </>
    );
  };
  ```

  With selectors:

  ```tsx
  const atom = createAtom({ count: 0 });

  const Component = () => {
    const count = useAtom(atom, (s) => s.count);

    return <div>{count}</div>;
  };
  ```

## 3.6.2

### Patch Changes

- [#5280](https://github.com/statelyai/xstate/pull/5280) [`d8a3456bc82af5e4d176990093ba4e649e7ce286`](https://github.com/statelyai/xstate/commit/d8a3456bc82af5e4d176990093ba4e649e7ce286) Thanks [@johnsoncodehk](https://github.com/johnsoncodehk)! - Synchronize the [`alien-signals`](https://github.com/stackblitz/alien-signals/) algorithm to 2.0.4

## 3.6.1

### Patch Changes

- [#5282](https://github.com/statelyai/xstate/pull/5282) [`42b1565cfdd6635754a4de63800d63ca74886a70`](https://github.com/statelyai/xstate/commit/42b1565cfdd6635754a4de63800d63ca74886a70) Thanks [@lucioreyli](https://github.com/lucioreyli)! - Add missing `createAsyncAtom` export

## 3.6.0

### Minor Changes

- [#5266](https://github.com/statelyai/xstate/pull/5266) [`42bfd0a30d74e1c5820728220a00db692023f1f8`](https://github.com/statelyai/xstate/commit/42bfd0a30d74e1c5820728220a00db692023f1f8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added async atoms:

  ```typescript
  const atom = createAsyncAtom(async () => {
    const response = await fetch(`/api/something`);
    return response.json();
  });

  atom.subscribe((state) => {
    // Status can be 'pending', 'done', or 'error'
    if (state.status === 'done') {
      console.log(state.data);
    }
  });
  ```

## 3.5.1

### Patch Changes

- [#5261](https://github.com/statelyai/xstate/pull/5261) [`986c5c86e15efe6d219bd6a0bb2130917c1db50e`](https://github.com/statelyai/xstate/commit/986c5c86e15efe6d219bd6a0bb2130917c1db50e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Reduced the bundle size for the atom implementation

## 3.5.0

### Minor Changes

- [#5250](https://github.com/statelyai/xstate/pull/5250) [`a1bffb55b2029bde82e542d5936c51d961909a37`](https://github.com/statelyai/xstate/commit/a1bffb55b2029bde82e542d5936c51d961909a37) Thanks [@davidkpiano](https://github.com/davidkpiano)! - - Improved atom architecture with better dependency management (the diamond problem is solved!)
  - Optimized recomputation logic to prevent unnecessary updates
  - Added support for custom equality functions through `compare` option in `createAtom`, allowing fine-grained control over when atoms update:

    ```ts
    const coordinateAtom = createAtom(
      { x: 0, y: 0 },
      {
        // only update when x and y change
        compare: (prev, next) => prev.x === next.x && prev.y === next.y
      }
    );
    ```

## 3.4.3

### Patch Changes

- [#5230](https://github.com/statelyai/xstate/pull/5230) [`86e6b58dd18337202df8e319a42f85523d5d0d30`](https://github.com/statelyai/xstate/commit/86e6b58dd18337202df8e319a42f85523d5d0d30) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The types for emitting events with no payload have been fixed so that the following code works:

  ```ts
  const store = createStore({
    emits: {
      incremented: () => {}
    },
    on: {
      inc: (ctx, ev, enq) => {
        // No payload is expected
        enq.emit.incremented();
      }
    }
  });
  ```

  Previously, this would have been an error because the `incremented` event was expected to have a payload.

## 3.4.2

### Patch Changes

- [#5247](https://github.com/statelyai/xstate/pull/5247) [`e8891030162214acc751a9f79a5d57ec916565ee`](https://github.com/statelyai/xstate/commit/e8891030162214acc751a9f79a5d57ec916565ee) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fix type inference for discriminated union event types in the `trigger` and the `emit` object. Previously, using `Omit` with union types would incorrectly combine event types, breaking type inference for discriminated unions. This has been fixed by introducing a `DistributiveOmit` type that correctly preserves the relationship between discriminated properties.

## 3.4.1

### Patch Changes

- [#5237](https://github.com/statelyai/xstate/pull/5237) [`c68b39025179dd52fdaddb5599a606c5546dc214`](https://github.com/statelyai/xstate/commit/c68b39025179dd52fdaddb5599a606c5546dc214) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fixed a bug where conditional atoms were not properly unsubscribed when no longer needed.

## 3.4.0

### Minor Changes

- [#5221](https://github.com/statelyai/xstate/pull/5221) [`4635d3d8d3debcfeef5cddd78613e32891c10eac`](https://github.com/statelyai/xstate/commit/4635d3d8d3debcfeef5cddd78613e32891c10eac) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added `createAtom()` for creating reactive atoms that can be combined with other atoms and stores:
  - Create simple atoms with initial values:

    ```ts
    import { createAtom } from '@xstate/store';

    const countAtom = createAtom(0);
    countAtom.get(); // 0
    countAtom.set(1); // or use setter function: (prev) => prev + 1
    ```

  - Subscribe to atom changes:

    ```ts
    countAtom.subscribe((value) => console.log(value));
    ```

  - Combine multiple atoms:

    ```ts
    const nameAtom = createAtom('hello');
    const countAtom = createAtom(3);
    const combinedAtom = createAtom((read) =>
      read(nameAtom).repeat(read(countAtom))
    );
    combinedAtom.get(); // "hellohellohello"
    ```

  - Seamlessly combine atoms with stores:

    ```ts
    const countAtom = createAtom(0);
    const nameStore = createStore({
      context: { name: 'David' }
      // ... store config
    });

    const combinedAtom = createAtom(
      (read) => read(nameStore).context.name + ` ${read(countAtom)}`
    );
    combinedAtom.get(); // "David 0"
    ```

  Atoms automatically update when their dependencies change, making it easy to create derived state from both atoms and stores.

## 3.3.0

### Minor Changes

- [#5215](https://github.com/statelyai/xstate/pull/5215) [`13279166ed9fa3d3626a2129bd257f6cd663fd0e`](https://github.com/statelyai/xstate/commit/13279166ed9fa3d3626a2129bd257f6cd663fd0e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added `store.transition(state, event)` method that returns the next state and effects for a given state and event as a tuple, without actually updating the store. This is useful for computing state changes before committing them, or controlling the execution of effects.

  Example:

  ```ts
  const [nextState, effects] = store.transition(store.getSnapshot(), {
    type: 'increment',
    by: 1
  });
  ```

## 3.2.1

### Patch Changes

- [#5223](https://github.com/statelyai/xstate/pull/5223) [`9e1de554c4ebf49997b717fada540951d01f511c`](https://github.com/statelyai/xstate/commit/9e1de554c4ebf49997b717fada540951d01f511c) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added React 19 as a peer dependency.

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
