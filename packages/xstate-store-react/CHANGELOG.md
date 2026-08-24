# @xstate/store-react

## 2.0.1-alpha.0

### Patch Changes

- [#5543](https://github.com/statelyai/xstate/pull/5543) [`52970ea`](https://github.com/statelyai/xstate/commit/52970ea75489305fd7bf1223f9b413770cd6d925) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `compare` function passed to `useSelector` is now typed as `(a: T, b: T)` instead of `(a: T | undefined, b: T)`, so the previous value is no longer typed as possibly `undefined`.

- Updated dependencies [[`52970ea`](https://github.com/statelyai/xstate/commit/52970ea75489305fd7bf1223f9b413770cd6d925)]:
  - @xstate/store@4.3.0-alpha.0

## 2.0.0

### Major Changes

- [#5512](https://github.com/statelyai/xstate/pull/5512) [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Modernize Store v4 package entrypoints.

  Use framework-specific packages such as `@xstate/store-react` and `@xstate/store-solid` instead of `@xstate/store/react` or `@xstate/store/solid`. The Store packages now publish ESM package entrypoints.

- [#5512](https://github.com/statelyai/xstate/pull/5512) [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add `createStoreLogic(...)` for reusable store definitions, and support creating stores from logic in framework hooks.

  ```ts
  const counterLogic = createStoreLogic({
    context: (input: { initialCount: number }) => ({
      count: input.initialCount
    }),
    on: {
      inc: (context) => ({ count: context.count + 1 })
    }
  });

  const store = useStore(counterLogic, { initialCount: 0 });
  ```

  If a store logic requires input, the input argument is also required:

  ```ts
  useStore(counterLogic, { initialCount: 0 });
  ```

  Framework hooks also preserve schema-derived context, event, and emitted event types when creating stores from config objects.

### Minor Changes

- [#5512](https://github.com/statelyai/xstate/pull/5512) [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Add reusable atom configs and framework atom-state helpers.

  `createAtomConfig(...)` creates an inert atom definition that can be instantiated with its `createAtom(...)` method or React/Preact/Vue/Solid's `useAtomState(...)`. These helpers return the current framework-native value and live atom instance, and also work with existing atom instances.

  ```ts
  const countConfig = createAtomConfig((input: { initialCount: number }) => {
    return input.initialCount;
  });

  function Counter() {
    const [count, countAtom] = useAtomState(countConfig, { initialCount: 0 });

    return (
      <button onClick={() => countAtom.set((count) => count + 1)}>
        {count}
      </button>
    );
  }
  ```

### Patch Changes

- Updated dependencies [[`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69), [`063416d`](https://github.com/statelyai/xstate/commit/063416db859581b91fd661ae1a89b75a37fffa69)]:
  - @xstate/store@4.0.0

## 1.0.1

### Patch Changes

- [`d6498eb`](https://github.com/statelyai/xstate/commit/d6498eb8e98100e4977e036904a04714089571e4) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added README.md

## 1.0.0

### Major Changes

- [#5441](https://github.com/statelyai/xstate/pull/5441) [`6ba9538`](https://github.com/statelyai/xstate/commit/6ba9538e05022c9aad9e4a4f089a87aaed54c06a) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Initial release for `@xstate/store-react`.

### Patch Changes

- Updated dependencies [[`6ba9538`](https://github.com/statelyai/xstate/commit/6ba9538e05022c9aad9e4a4f089a87aaed54c06a)]:
  - @xstate/store@3.15.0
