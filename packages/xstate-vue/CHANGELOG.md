# @xstate/vue

## 2.0.0

### Patch Changes

- Updated dependencies [[`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf), [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf)]:
  - @xstate/fsm@2.0.0

## 1.0.0

### Major Changes

- [#3083](https://github.com/statelyai/xstate/pull/3083) [`bc592582a`](https://github.com/statelyai/xstate/commit/bc592582a8b486ca3a6277ca9a9c922590572346) Thanks [@Andarist](https://github.com/Andarist)! - The major version of this package had to be bumped to allow integrating with the typegen. This package will now require TS version 4.0 or greater.

  When using hooks from `@xstate/vue` it's recommended to skip providing explicit generics to them. Note that that generics list has changed since v1 and we now only accept a single generic, `TMachine`.

- [#3083](https://github.com/statelyai/xstate/pull/3083) [`bc592582a`](https://github.com/statelyai/xstate/commit/bc592582a8b486ca3a6277ca9a9c922590572346) Thanks [@Andarist](https://github.com/Andarist)! - Removed already deprecated `useService` from `@xstate/vue`. You can replace its usage with `useActor`.

### Patch Changes

- [#3089](https://github.com/statelyai/xstate/pull/3089) [`862697e29`](https://github.com/statelyai/xstate/commit/862697e2990934d46050580d7e09c749d09d8426) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility with Skypack by exporting some shared utilities from root entry of XState and consuming them directly in other packages (this avoids accessing those things using deep imports and thus it avoids creating those compatibility problems).

## 0.8.2

### Patch Changes

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 0.8.1

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

## 0.8.0

### Minor Changes

- [`b0801662`](https://github.com/statelyai/xstate/commit/b0801662de5df0217c6105650603a1f697b830c8) [#2392](https://github.com/statelyai/xstate/pull/2392) Thanks [@santicros](https://github.com/santicros)! - Just like `useInterpret(...)`, other types of actors can now be spawned from _behaviors_ using `useSpawn(...)`:

  ```vue
  <template>
    <div>
      Count: {{ count }}
      <button @click="send({ type: 'INC' })">Increment</button>
      <button @click="send({ type: 'DEC' })">Decrement</button>
    </div>
  </template>

  <script>
  import { fromReducer } from 'xstate/lib/behaviors';
  import { useActor, useSpawn } from '@xstate/vue';

  type CountEvent = { type: 'INC' } | { type: 'DEC' };

  const countBehavior = fromReducer(
    (count: number, event: CountEvent): number => {
      if (event.type === 'INC') {
        return count + 1;
      } else if (event.type === 'DEC') {
        return count - 1;
      }

      return count;
    },
    0 // initial state
  );

  const countMachine = createMachine({
    invoke: {
      id: 'count',
      src: () => fromReducer(countReducer, 0)
    },
    on: {
      INC: {
        actions: forwardTo('count')
      },
      DEC: {
        actions: forwardTo('count')
      }
    }
  });

  export default {
    setup() {
      const countActorRef = useSpawn(countBehavior);
      const { state: count, send } = useActor(countActorRef);

      return { count, send };
    }
  };
  </script>
  ```

## 0.7.0

### Minor Changes

- [`742a0bfa`](https://github.com/statelyai/xstate/commit/742a0bfa970c94957bf21904fc84b8031369e316) [#2335](https://github.com/statelyai/xstate/pull/2335) Thanks [@santicros](https://github.com/santicros)! - The `send` type returned in the object from `useActor(someService)` was an incorrect `never` type; this has been fixed.

  Also adds deprecation notice to `useService`.

## 0.6.0

### Minor Changes

- [`724baae7`](https://github.com/statelyai/xstate/commit/724baae76409a3dc6a5b03c47769918d600f478f) [#2230](https://github.com/statelyai/xstate/pull/2230) Thanks [@santicros](https://github.com/santicros)! - Added new composable `useSelector(actor, selector)`, which subscribes to actor and returns the selected state derived from selector(snapshot):

  ```js
  import { useSelector } from '@xstate/vue';

  export default {
    props: ['someActor'],
    setup(props) {
      const count = useSelector(
        props.someActor,
        (state) => state.context.count
      );
      // ...
      return { count };
    }
  };
  ```

## 0.5.0

### Minor Changes

- [`9f6a6e9e`](https://github.com/statelyai/xstate/commit/9f6a6e9ea8fdcbdffe0742343eb9c28da1aadb7f) [#1991](https://github.com/statelyai/xstate/pull/1991) Thanks [@santicros](https://github.com/santicros)! - Added new `useActor`, which is a composable that subscribes to emitted changes from an existing `actor`:

  ```js
  import { useActor } from '@xstate/vue';

  export default defineComponent({
    props: ['someSpawnedActor'],
    setup(props) {
      const { state, send } = useActor(props.someSpawnedActor);
      return { state, send };
    }
  });
  ```

- [`bfe42972`](https://github.com/statelyai/xstate/commit/bfe42972cf624b990a280244e12e5976e5bd3048) [#1991](https://github.com/statelyai/xstate/pull/1991) Thanks [@santicros](https://github.com/santicros)! - Fixed the UMD build by externalizing XState & Vue correctly.

- [`4346cabc`](https://github.com/statelyai/xstate/commit/4346cabc42963211b471f214056db4d4f7e85539) [#1991](https://github.com/statelyai/xstate/pull/1991) Thanks [@santicros](https://github.com/santicros)! - Added new `useInterpret`, which is a low-level composable that interprets the `machine` and returns the `service`:

  ```js
  import { useInterpret } from '@xstate/vue';
  import { someMachine } from '../path/to/someMachine';
  export default defineComponent({
    setup() {
      const state = ref();
      const service = useInterpret(machine, {}, (nextState) => {
        state.value = nextState.value;
      });
      return { service, state };
    }
  });
  ```

- [`012ef363`](https://github.com/statelyai/xstate/commit/012ef3635cc06d8e5199cb85326b4b372714ca89) [#1991](https://github.com/statelyai/xstate/pull/1991) Thanks [@santicros](https://github.com/santicros)! - Added a proper ESM file using the`"module"` field in the `package.json`. It helps bundlers to automatically pick this over a file authored using CommonJS and allows them to apply some optimizations easier.

## 0.4.0

### Minor Changes

- [`87d0acd9`](https://github.com/statelyai/xstate/commit/87d0acd9e9530079829ad30228558b18b77ea4a2) [#1629](https://github.com/statelyai/xstate/pull/1629) Thanks [@sarahdayan](https://github.com/sarahdayan)! - Added support for Vue 3 that has builtin support for the composition API. This means that this package will no longer work with [`@vue/composition-api`](https://github.com/vuejs/composition-api) package. If you are still using Vue 2 you should continue using `@xstate/vue@^0.3.0`.

## 0.3.0

### Minor Changes

- [`8662e543`](https://github.com/statelyai/xstate/commit/8662e543393de7e2f8a6d92ff847043781d10f4d) [#1317](https://github.com/statelyai/xstate/pull/1317) Thanks [@Andarist](https://github.com/Andarist)! - `useMachine` and `useService` cant be now parametrized with a `TTypestate` parameter which makes leveraging typestates possible on their returned values.

## 0.2.0

### Minor Changes

- [`65c13245`](https://github.com/statelyai/xstate/commit/65c132458cdc73b242f9c0b22e61ba9ba7780509) [#1253](https://github.com/statelyai/xstate/pull/1253) Thanks [@darrenjennings](https://github.com/darrenjennings)! - Upgraded package for compatibility with the newest `@vue/composition-api@^0.6.0`, which means that a peer dependency requirement has changed to this version, which is a **breaking change**. The only observable behavior change is that exposed refs are now **shallow**.

## 0.1.1

### Patch Changes

- [`c057f38`](https://github.com/statelyai/xstate/commit/c057f38aa20d06501fd7e5893eef0d6688e547eb) [#976](https://github.com/statelyai/xstate/pull/976) Thanks [@Andarist](https://github.com/Andarist)! - Fixed issue with `useMachine` crashing without providing optional `options` parameter.

- Updated dependencies [[`520580b`](https://github.com/statelyai/xstate/commit/520580b4af597f7c83c329757ae972278c2d4494)]:
  - xstate@4.7.8
