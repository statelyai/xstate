# @xstate/svelte

## 0.2.1

### Patch Changes

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 0.2.0

### Minor Changes

- [#2614](https://github.com/statelyai/xstate/pull/2614) [`0f77ec36d`](https://github.com/statelyai/xstate/commit/0f77ec36d55515beac3e1a51eb2d32bf17b94cde) Thanks [@DavKato](https://github.com/DavKato)! - Added new useSelector(actor, selector), which subscribes to actor and returns a svelte store that represents the selected state derived from selector(snapshot):

  ```svelte
  <script>
    // It won't be updated unless the selected value changed.
    const value = useSelector(service, (state) => state.context.value);
  </script>

  <p>{$value}</p>
  ```

## 0.1.1

### Patch Changes

- [`fe3e859f`](https://github.com/statelyai/xstate/commit/fe3e859f5c53813307bacad915bebc8d1f3a982c) [#2522](https://github.com/statelyai/xstate/pull/2522) Thanks [@farskid](https://github.com/farskid), [@Andarist](https://github.com/Andarist)! - Fixed an issue with actors not being spawned correctly by `useMachine` and `useInterpret` when they were defined a lazily evaluated context, like for example here:

  ```js
  createMachine({
    // lazy context
    context: () => ({
      ref: spawn(() => {})
    })
  });
  ```
