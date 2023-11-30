# @xstate/vue

## 3.0.0-beta.6

### Major Changes

- [#4288](https://github.com/statelyai/xstate/pull/4288) [`cfdf754f8`](https://github.com/statelyai/xstate/commit/cfdf754f89b65da2eff7521fa894e151e8a30de4) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `useMachine(machine)` hook now returns `{ snapshot, send, actorRef }` instead of `{ state, send, service }`:

  ```diff
  const {
  - state,
  + snapshot,
    send,
  - service
  + actorRef
  } = useMachine(machine);
  ```

### Minor Changes

- [#4288](https://github.com/statelyai/xstate/pull/4288) [`cfdf754f8`](https://github.com/statelyai/xstate/commit/cfdf754f89b65da2eff7521fa894e151e8a30de4) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `useInterpret(machine)` and `useSpawn(machine)` hooks have been removed; use the `useActorRef(machine)` hook instead.

## 3.0.0-beta.5

### Major Changes

- [#4265](https://github.com/statelyai/xstate/pull/4265) [`1153b3f9a`](https://github.com/statelyai/xstate/commit/1153b3f9a95b4d76ff5408be8bd03a66f884b9cb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - FSM-related functions have been removed.

## 3.0.0-beta.4

### Patch Changes

- [#4138](https://github.com/statelyai/xstate/pull/4138) [`461e3983a`](https://github.com/statelyai/xstate/commit/461e3983a0e9d51c43a4b0e7370354b7dea24e5f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed missing `.mjs` proxy files for condition-based builds.

## 3.0.0-beta.3

### Major Changes

- [#4041](https://github.com/statelyai/xstate/pull/4041) [`50fe8cdd4`](https://github.com/statelyai/xstate/commit/50fe8cdd4114e77c104520f9c89d471cf2173dfb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Instances of "behavior" in the codebase have been replaced with "actor logic".

## 3.0.0-beta.2

## 3.0.0-alpha.1

### Minor Changes

- [#3727](https://github.com/statelyai/xstate/pull/3727) [`5fb3c683d`](https://github.com/statelyai/xstate/commit/5fb3c683d9a9bdc06637b3a13a5b575059aebadd) Thanks [@Andarist](https://github.com/Andarist)! - `exports` field has been added to the `package.json` manifest. It limits what files can be imported from a package - it's no longer possible to import from files that are not considered to be a part of the public API.

### Patch Changes

- Updated dependencies [[`5fb3c683d`](https://github.com/statelyai/xstate/commit/5fb3c683d9a9bdc06637b3a13a5b575059aebadd), [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0)]:
  - @xstate/fsm@3.0.0-alpha.0

## 3.0.0-alpha.0

### Major Changes

- [#3148](https://github.com/statelyai/xstate/pull/3148) [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Removed `getSnapshot` parameter from composables. It is expected that the received `actorRef` has to have a `getSnapshot` method on it that can be used internally.

### Patch Changes

- Updated dependencies [[`7f3b84816`](https://github.com/statelyai/xstate/commit/7f3b84816564d951b6b29afdd7075256f1f59501), [`969a2f4fc`](https://github.com/statelyai/xstate/commit/969a2f4fc0bc9147b9a52da25306e5c13b97f159), [`c0a6dcafa`](https://github.com/statelyai/xstate/commit/c0a6dcafa1a11a5ff1660b57e0728675f155c292), [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117), [`172d6a7e1`](https://github.com/statelyai/xstate/commit/172d6a7e1e4ab0fa73485f76c52675be8a1f3362), [`31bc73e05`](https://github.com/statelyai/xstate/commit/31bc73e05692f29301f5bb5cb4b87b90773e0ef2), [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6), [`145539c4c`](https://github.com/statelyai/xstate/commit/145539c4cfe1bde5aac247792622428e44342dd6), [`3de36bb24`](https://github.com/statelyai/xstate/commit/3de36bb24e8f59f54d571bf587407b1b6a9856e0), [`9e10660ec`](https://github.com/statelyai/xstate/commit/9e10660ec2f1e89cbb09a1094edb4f6b8a273a99), [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175), [`515cdc9c1`](https://github.com/statelyai/xstate/commit/515cdc9c148a3a1b558120c309080e9a21e876bc), [`6043a1c28`](https://github.com/statelyai/xstate/commit/6043a1c28d21ff8cbabc420a6817a02a1a54fcc8), [`6a6b2b869`](https://github.com/statelyai/xstate/commit/6a6b2b8691626112d1d9dbf23d0a0e80ff7130a8), [`0b49437b1`](https://github.com/statelyai/xstate/commit/0b49437b1be3e6d9bc61304711b83300cba88dc4), [`0e24ea6d6`](https://github.com/statelyai/xstate/commit/0e24ea6d62a5c1a8b7e365f2252dc930d94997c4), [`04e89f90f`](https://github.com/statelyai/xstate/commit/04e89f90f97fe25a45b5908c45f25a513f0fd70f), [`0096d9f7a`](https://github.com/statelyai/xstate/commit/0096d9f7afda7546fc7b1d5fdd1546f55c32bfe4), [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175), [`b200e0e0b`](https://github.com/statelyai/xstate/commit/b200e0e0b7123797086080b75abdfcf2fce45253), [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117), [`9437c3de9`](https://github.com/statelyai/xstate/commit/9437c3de912c2a38c04798cbb94f267a1e5db3f8), [`0038c7b1e`](https://github.com/statelyai/xstate/commit/0038c7b1e2050fe7262849aab8fdff4a7ce7cf92), [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117), [`b24e47b9e`](https://github.com/statelyai/xstate/commit/b24e47b9e7a59a5b0527d4386cea3af16c84ca7a), [`390eaaa52`](https://github.com/statelyai/xstate/commit/390eaaa523cb0dd243e39c6300e671606c1e45fc), [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117), [`0c6cfee9a`](https://github.com/statelyai/xstate/commit/0c6cfee9a6d603aa1756e3a6d0f76d4da1486caf), [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6), [`025a2d6a2`](https://github.com/statelyai/xstate/commit/025a2d6a295359a746bee6ffc2953ccc51a6aaad), [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6), [`c99bb43af`](https://github.com/statelyai/xstate/commit/c99bb43afec01ddee86fc746c346ea1aeeca687d), [`fc5ca7b7f`](https://github.com/statelyai/xstate/commit/fc5ca7b7fcd2d7821ce2409743c50505529104e7), [`c9cda27cb`](https://github.com/statelyai/xstate/commit/c9cda27cbe52b9c706ccb63b709d22d049be31e3), [`5d16a7365`](https://github.com/statelyai/xstate/commit/5d16a73651e97dd0228c5215cb2452a4d9951118), [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175), [`53a594e9a`](https://github.com/statelyai/xstate/commit/53a594e9a1b49ccb1121048a5784676f83950024), [`31a0d890f`](https://github.com/statelyai/xstate/commit/31a0d890f55d8f0b06772c9fd510b18302b76ebb)]:
  - xstate@5.0.0-alpha.0

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
