# xstate

## 5.0.0-beta.54

### Major Changes

- [#4535](https://github.com/statelyai/xstate/pull/4535) [`6a9fa1f11`](https://github.com/statelyai/xstate/commit/6a9fa1f11864e42a986822f407a136a92ae6567c) Thanks [@Andarist](https://github.com/Andarist)! - The `escalate()` action is removed. Just throw an error normally.

- [#4539](https://github.com/statelyai/xstate/pull/4539) [`a2a377f47`](https://github.com/statelyai/xstate/commit/a2a377f47ac8832dc099bab61281e4a0b6005542) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The error event (`type: 'xstate.error.*'`) now has the error data on the `event.error` instead of `event.data`:

  ```diff
  // ...
  invoke: {
    src: 'someSrc',
    onError: {
      actions: ({ event }) => {
  -     event.data;
  +     event.error;
      }
    }
  }
  ```

## 5.0.0-beta.53

### Minor Changes

- [#4533](https://github.com/statelyai/xstate/pull/4533) [`2495aa21d`](https://github.com/statelyai/xstate/commit/2495aa21d87f63d8aa543135a53420ee6cc97d51) Thanks [@Andarist](https://github.com/Andarist)! - The `state` option of `createActor(...)` has been renamed to `snapshot`:

  ```diff
  createActor(machine, {
  - state: someState
  + snapshot: someState
  })
  ```

  Likewise, the `.getPersistedState()` method has been renamed to `.getPersistedSnapshot()`:

  ```diff
  -actor.getPersistedState()
  +actor.getPersistedSnapshot()
  ```

## 5.0.0-beta.52

### Major Changes

- [#4531](https://github.com/statelyai/xstate/pull/4531) [`a5b198340`](https://github.com/statelyai/xstate/commit/a5b198340ea6225e21177852816c95fb054c21c7) Thanks [@Andarist](https://github.com/Andarist)! - The order of type parameters in `ActorRef` has been changed from from `ActorRef<TEvent, TSnapshot>` to `ActorRef<TSnapshot, TEvent>` for consistency with other types.

- [#4529](https://github.com/statelyai/xstate/pull/4529) [`43843ea26`](https://github.com/statelyai/xstate/commit/43843ea260e38c487fbbb9b56df291ded0d2c5a0) Thanks [@Andarist](https://github.com/Andarist)! - The `pure()` and `choose()` action creators have been removed, in favor of the more flexible `enqueueActions()` action creator:

  ```ts
  entry: [
    // pure(() => {
    //   return [
    //     'action1',
    //     'action2'
    //   ]
    // }),
    enqueueActions(({ enqueue }) => {
      enqueue('action1');
      enqueue('action2');
    })
  ];
  ```

  ```ts
  entry: [
    // choose([
    //   {
    //     guard: 'someGuard',
    //     actions: ['action1', 'action2']
    //   }
    // ]),
    enqueueActions(({ enqueue, check }) => {
      if (check('someGuard')) {
        enqueue('action1');
        enqueue('action2');
      }
    })
  ];
  ```

### Minor Changes

- [#4521](https://github.com/statelyai/xstate/pull/4521) [`355e89627`](https://github.com/statelyai/xstate/commit/355e896278ed05ded56afa2b66fbbed75d8d1c71) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The event type of internal `after` events changed from `xstate.after(1000)#some.state.id` to `xstate.after.1000.some.state.id` for consistency.

## 5.0.0-beta.51

### Minor Changes

- [#4429](https://github.com/statelyai/xstate/pull/4429) [`7bcc62cbc`](https://github.com/statelyai/xstate/commit/7bcc62cbcc29e9247c3fc442a59e693cb5eeb078) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The new `enqueueActions(...)` action creator can now be used to enqueue actions to be executed. This is a helpful alternative to the `pure(...)` and `choose(...)` action creators.

  ```ts
  const machine = createMachine({
    // ...
    entry: enqueueActions(({ context, event, enqueue, check }) => {
      // assign action
      enqueue.assign({
        count: context.count + 1
      });

      // Conditional actions (replaces choose(...))
      if (event.someOption) {
        enqueue.sendTo('someActor', { type: 'blah', thing: context.thing });

        // other actions
        enqueue('namedAction');
        // with params
        enqueue({ type: 'greet', params: { message: 'hello' } });
      } else {
        // inline
        enqueue(() => console.log('hello'));

        // even built-in actions
      }

      // Use check(...) to conditionally enqueue actions based on a guard
      if (check({ type: 'someGuard' })) {
        // ...
      }

      // no return
    })
  });
  ```

## 5.0.0-beta.50

### Major Changes

- [#4492](https://github.com/statelyai/xstate/pull/4492) [`63d923857`](https://github.com/statelyai/xstate/commit/63d923857592437dc174518ba02e061082f629cf) Thanks [@Andarist](https://github.com/Andarist)! - All errors caught while executing the actor should now consistently include the error in its `snapshot.error` and should be reported to the closest `error` listener.

### Patch Changes

- [#4523](https://github.com/statelyai/xstate/pull/4523) [`e21e3f959`](https://github.com/statelyai/xstate/commit/e21e3f959971efbe1add5646a0adef04cf913524) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with contextual parameters in input factories of input-less actors

## 5.0.0-beta.49

### Minor Changes

- [#4509](https://github.com/statelyai/xstate/pull/4509) [`560415283`](https://github.com/statelyai/xstate/commit/5604152835f099bbdfbe8d1734e7afbe93c50d72) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Refactor callback logic to not send self-event

- [#4498](https://github.com/statelyai/xstate/pull/4498) [`02e14f6`](https://github.com/statelyai/xstate/commit/02e14f66cfff88003a99902a91335aba8fc10801) Thanks [@Andarist](https://github.com/Andarist), [@davidkpiano](https://github.com/davidkpiano)! - State values and `snapshot.matches()` argument are now strongly-typed when using the `setup` API.

### Patch Changes

- [#4516](https://github.com/statelyai/xstate/pull/4516) [`daf532b2f`](https://github.com/statelyai/xstate/commit/daf532b2f2ec634ec9d7c0afe25bdf1b7adb54fd) Thanks [@Andarist](https://github.com/Andarist)! - Export all TS snapshot types to fix type portability errors that could be reported when generating declaration files for files depending on `xstate`.

## 5.0.0-beta.48

### Patch Changes

- [#4499](https://github.com/statelyai/xstate/pull/4499) [`c9908b7fb`](https://github.com/statelyai/xstate/commit/c9908b7fbc393999122388f5bf437511fe5cfadc) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fixed the `TActor` type passed down by `setup` in absence of provided actors.

## 5.0.0-beta.47

### Minor Changes

- [#4488](https://github.com/statelyai/xstate/pull/4488) [`9ca3c3dcf`](https://github.com/statelyai/xstate/commit/9ca3c3dcf25aba67aab5b6390766c273e9eba766) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `spawn(...)` action creator has been renamed to `spawnChild(...)` to avoid confusion.

  ```ts
  import { spawnChild, assign } from 'xstate';

  const childMachine = createMachine({
    on: {
      someEvent: {
        actions: [
          // spawnChild(...) instead of spawn(...)
          spawnChild('someSrc'),

          // spawn() is used inside of assign()
          assign({
            anotherRef: ({ spawn }) => spawn('anotherSrc')
          })
        ]
      }
    }
  });
  ```

- [#4488](https://github.com/statelyai/xstate/pull/4488) [`9ca3c3dcf`](https://github.com/statelyai/xstate/commit/9ca3c3dcf25aba67aab5b6390766c273e9eba766) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `stop(...)` action creator is renamed to `stopChild(...)`, to make it clear that only child actors may be stopped from the parent actor.

## 5.0.0-beta.46

### Major Changes

- [#4478](https://github.com/statelyai/xstate/pull/4478) [`384f0ffc7`](https://github.com/statelyai/xstate/commit/384f0ffc712a36846d97b58195eeaa71edbc67f5) Thanks [@Andarist](https://github.com/Andarist)! - Removed `MachineSnapshot['nextEvents']`.

### Minor Changes

- [#4480](https://github.com/statelyai/xstate/pull/4480) [`3e610a1f3`](https://github.com/statelyai/xstate/commit/3e610a1f3b2a56e58fd1f68fe41f5f7beed31fd8) Thanks [@Andarist](https://github.com/Andarist)! - Children IDs in combination with `setup` can now be typed using `types.children`:

  ```ts
  const machine = setup({
    types: {} as {
      children: {
        myId: 'actorKey';
      };
    },
    actors: {
      actorKey: child
    }
  }).createMachine({});

  const actorRef = createActor(machine).start();

  actorRef.getSnapshot().children.myId; // ActorRefFrom<typeof child> | undefined
  ```

### Patch Changes

- [#4491](https://github.com/statelyai/xstate/pull/4491) [`c0025c3ce`](https://github.com/statelyai/xstate/commit/c0025c3ceb9a18c7588dc303f71b3de9378258a5) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with actors deep in the tree failing to rehydrate.

## 5.0.0-beta.45

### Minor Changes

- [#4467](https://github.com/statelyai/xstate/pull/4467) [`3c71e537d`](https://github.com/statelyai/xstate/commit/3c71e537db724eee19ab857a9723f82e2ac5d8ca) Thanks [@Andarist](https://github.com/Andarist)! - The `state.configuration` property has been renamed to `state.nodes`.

  ```diff
  - state.configuration
  + state.nodes
  ```

- [#4467](https://github.com/statelyai/xstate/pull/4467) [`3c71e537d`](https://github.com/statelyai/xstate/commit/3c71e537db724eee19ab857a9723f82e2ac5d8ca) Thanks [@Andarist](https://github.com/Andarist)! - The `state.meta` getter has been replaced with `state.getMeta()` methods:

  ```diff
  - state.meta
  + state.getMeta()
  ```

- [#4353](https://github.com/statelyai/xstate/pull/4353) [`a3a11c84e`](https://github.com/statelyai/xstate/commit/a3a11c84e30c86afd63e47c77a46a61d926291d1) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now use the `setup({ ... }).createMachine({ ... })` function to setup implementations for `actors`, `actions`, `guards`, and `delays` that will be used in the created machine:

  ```ts
  import { setup, createMachine } from 'xstate';

  const fetchUser = fromPromise(async ({ input }) => {
    const response = await fetch(`/user/${input.id}`);
    const user = await response.json();
    return user;
  });

  const machine = setup({
    actors: {
      fetchUser
    },
    actions: {
      clearUser: assign({ user: undefined })
    },
    guards: {
      isUserAdmin: (_, params) => params.user.role === 'admin'
    }
  }).createMachine({
    // ...
    invoke: {
      // Strongly typed!
      src: 'fetchUser',
      input: ({ context }) => ({ id: context.userId }),
      onDone: {
        guard: {
          type: 'isUserAdmin',
          params: ({ context }) => ({ user: context.user })
        },
        target: 'success',
        actions: assign({ user: ({ event }) => event.output })
      },
      onError: {
        target: 'failure',
        actions: 'clearUser'
      }
    }
  });
  ```

### Patch Changes

- [#4476](https://github.com/statelyai/xstate/pull/4476) [`6777c328d`](https://github.com/statelyai/xstate/commit/6777c328dfcad0a6bd113ca9f2a201344911356e) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `onSnapshot` not working after rehydration.

## 5.0.0-beta.44

### Major Changes

- [#4448](https://github.com/statelyai/xstate/pull/4448) [`9c4353020`](https://github.com/statelyai/xstate/commit/9c435302042be8090e78dc75fe4a9288a64dbb11) Thanks [@Andarist](https://github.com/Andarist)! - `isState`/`isStateConfig` were replaced by `isMachineSnapshot`. Similarly, `AnyState` type was deprecated and it's replaced by `AnyMachineSnapshot` type.

### Patch Changes

- [#4463](https://github.com/statelyai/xstate/pull/4463) [`178deadac`](https://github.com/statelyai/xstate/commit/178deadac5dc29c1b7a749936622456d98294fa5) Thanks [@Andarist](https://github.com/Andarist)! - `invoke` and `spawn` will now require `input` to be provided if the used actor requires it.

- [#4464](https://github.com/statelyai/xstate/pull/4464) [`5278a9895`](https://github.com/statelyai/xstate/commit/5278a989573bc8a78bd89f5950654be6b1eaad49) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with not being able to target actors registered with `systemId` from within initial actions.

## 5.0.0-beta.43

### Major Changes

- [#4451](https://github.com/statelyai/xstate/pull/4451) [`21f18b54b`](https://github.com/statelyai/xstate/commit/21f18b54b6badec8a34e3349d2bf360e0648abf4) Thanks [@Andarist](https://github.com/Andarist)! - Removed the ability to configure `input` within the implementations object. You no longer can do this:

  ```ts
  createMachine(
    {
      invoke: {
        src: 'child'
      }
    },
    {
      actors: {
        child: {
          src: childMachine,
          input: 'foo'
        }
      }
    }
  );
  ```

  The `input` can only be provided within the config of the machine.

## 5.0.0-beta.42

### Major Changes

- [#4438](https://github.com/statelyai/xstate/pull/4438) [`7bbf41d7d`](https://github.com/statelyai/xstate/commit/7bbf41d7d17257d2b2a2675494f68cbae8dc19fd) Thanks [@Andarist](https://github.com/Andarist)! - Removed `State#toStrings` method.

- [#4443](https://github.com/statelyai/xstate/pull/4443) [`18862e53c`](https://github.com/statelyai/xstate/commit/18862e53cc24c38db6e21f5aecac501942db1d9d) Thanks [@Andarist](https://github.com/Andarist)! - `State` class has been removed and replaced by `MachineSnapshot` object. They largely have the same properties and methods. On of the main noticeable results of this change is that you can no longer check `state instanceof State`.

- [#4444](https://github.com/statelyai/xstate/pull/4444) [`d6e41a923`](https://github.com/statelyai/xstate/commit/d6e41a923bfaa9e39fdd60d4bbee661bd048dfaf) Thanks [@Andarist](https://github.com/Andarist)! - Removed `mapState` utility function.

### Minor Changes

- [#4440](https://github.com/statelyai/xstate/pull/4440) [`10d95393a`](https://github.com/statelyai/xstate/commit/10d95393a3bfdfab31a9670ae56751e7557a4a17) Thanks [@Andarist](https://github.com/Andarist)! - `State.from`, `StateMachine#createState` and `StateMachine#resolveStateValue` were removed. They largely served the same purpose as `StateMachine#resolveState` and this is the method that is still available and can be used instead of them.

## 5.0.0-beta.41

### Major Changes

- [#4423](https://github.com/statelyai/xstate/pull/4423) [`8fb984494`](https://github.com/statelyai/xstate/commit/8fb98449471a67ad4231c2ce18d88d511b1112f8) Thanks [@Andarist](https://github.com/Andarist)! - Removed `Interpreter['status']` from publicly available properties.

### Minor Changes

- [#4435](https://github.com/statelyai/xstate/pull/4435) [`37d879335`](https://github.com/statelyai/xstate/commit/37d879335c3c9ad1c28533bef4768ed0411fa0e8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The default `timeout` for `waitFor(...)` is now `Infinity` instead of 10 seconds.

## 5.0.0-beta.40

### Minor Changes

- [#4414](https://github.com/statelyai/xstate/pull/4414) [`26fbc6c85`](https://github.com/statelyai/xstate/commit/26fbc6c8598f8621ce0ba510390f536e41d773d7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - All inspector events (snapshot, event, actor) now have a common `actorRef` property. This makes it easier to discern which inspection event is for which actor:

  ```ts
  const actor = createActor(someMachine, {
    inspect: (event) => {
      // Was previously a type error
      if (event.actorRef === actor) {
        // This event is for the root actor
      }

      if (event.type === '@xstate.event') {
        // previously event.targetRef
        event.actorRef;
      }
    }
  });
  ```

  In the `'xstate.event'` event, the `actorRef` property is now the target actor (recipient of the event). Previously, this was the `event.targetRef` property (which is now removed).

### Patch Changes

- [#4425](https://github.com/statelyai/xstate/pull/4425) [`74baddc1b`](https://github.com/statelyai/xstate/commit/74baddc1b3881d9143f01c02e10c741d1d4cfef4) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with persisting children that got rehydrated.

## 5.0.0-beta.39

### Minor Changes

- [#4407](https://github.com/statelyai/xstate/pull/4407) [`c46a80015`](https://github.com/statelyai/xstate/commit/c46a80015a2332c39cb34dbbe2d32d13beeb9c45) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Internal: changed the actor context type from `ActorContext` to `ActorScope` to mitigate confusion.

### Patch Changes

- [#4404](https://github.com/statelyai/xstate/pull/4404) [`a91fdea06`](https://github.com/statelyai/xstate/commit/a91fdea0686ccef459b0f99ebc614903f38cbe30) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue that caused non-active children to be rehydrated.

- [#4368](https://github.com/statelyai/xstate/pull/4368) [`5393e82df`](https://github.com/statelyai/xstate/commit/5393e82df1445c29920f477bf2855d5a387317ed) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with parallel regions sometimes not being correctly reentered when taking transitions targeting other parallel regions.

## 5.0.0-beta.38

### Minor Changes

- [#4329](https://github.com/statelyai/xstate/pull/4329) [`41f5a7dc5`](https://github.com/statelyai/xstate/commit/41f5a7dc59a2cd946dff937664de2fa14780b007) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now `spawn(...)` actors directly outside of `assign(...)` action creators:

  ```ts
  import { createMachine, spawn } from 'xstate';

  const listenerMachine = createMachine({
    // ...
  });

  const parentMachine = createMachine({
    // ...
    on: {
      'listener.create': {
        entry: spawn(listenerMachine, { id: 'listener' })
      }
    }
    // ...
  });

  const actor = createActor(parentMachine).start();

  actor.send({ type: 'listener.create' });

  actor.getSnapshot().children.listener; // ActorRefFrom<typeof listenerMachine>
  ```

- [#4257](https://github.com/statelyai/xstate/pull/4257) [`531a63482`](https://github.com/statelyai/xstate/commit/531a634827c0a7a88f5c2720109e953d203e077a) Thanks [@Andarist](https://github.com/Andarist)! - Action parameters can now be directly accessed from the 2nd argument of the action implementation:

  ```ts
  const machine = createMachine(
    {
      // ...
      entry: {
        type: 'greet',
        params: { message: 'hello' }
      }
    },
    {
      actions: {
        greet: (_, params) => {
          params.message; // 'hello'
        }
      }
    }
  );
  ```

- [#4257](https://github.com/statelyai/xstate/pull/4257) [`531a63482`](https://github.com/statelyai/xstate/commit/531a634827c0a7a88f5c2720109e953d203e077a) Thanks [@Andarist](https://github.com/Andarist)! - Guard parameters can now be directly accessed from the 2nd argument of the guard implementation:

  ```ts
  const machine = createMachine(
    {
      // ...
      on: {
        EVENT: {
          guard: {
            type: 'isGreaterThan',
            params: { value: 10 }
          }
        }
      }
    },
    {
      guards: {
        isGreaterThan: (_, params) => {
          params.value; // 10
        }
      }
    }
  );
  ```

### Patch Changes

- [#4405](https://github.com/statelyai/xstate/pull/4405) [`a01169eb2`](https://github.com/statelyai/xstate/commit/a01169eb20db30724e7fb086d7b59837525ec406) Thanks [@Andarist](https://github.com/Andarist)! - Fixed crash on a `systemId` synchronous re-registration attempt that could happen, for example, when dealing with reentering transitions.

- [#4401](https://github.com/statelyai/xstate/pull/4401) [`eea74c594`](https://github.com/statelyai/xstate/commit/eea74c5943e9b2157934d260b793e06169099b41) Thanks [@Andarist](https://github.com/Andarist)! - Fixed the issue with stopped state machines not updating their snapshots with that information.

- [#4403](https://github.com/statelyai/xstate/pull/4403) [`3f84bba72`](https://github.com/statelyai/xstate/commit/3f84bba72145a98d0dbdf10630371351851f2346) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with rehydrated actors not registering themselves in the system.

## 5.0.0-beta.37

### Major Changes

- [#4234](https://github.com/statelyai/xstate/pull/4234) [`57814f46d`](https://github.com/statelyai/xstate/commit/57814f46dec425973d52e4b630752ee4824fd9a9) Thanks [@Andarist](https://github.com/Andarist)! - Atomic and parallel states should no longer be reentered when the transition target doesn't escape them. You can get the reentering behavior by configuring `reenter: true` for the transition.

### Patch Changes

- [#4387](https://github.com/statelyai/xstate/pull/4387) [`0be0ef015`](https://github.com/statelyai/xstate/commit/0be0ef015425c8ad46e1afb8c39d3679786b1b10) Thanks [@Andarist](https://github.com/Andarist)! - Added support to `stateIn` guard for checking a combination of an ID and a path, eg. `stateIn('#b.B1')`.

- [#4384](https://github.com/statelyai/xstate/pull/4384) [`e0bbe3397`](https://github.com/statelyai/xstate/commit/e0bbe339752980f7b84670faf6ca80529885c838) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue that caused parallel states with direct final children to be completed without all regions being in their final states.

## 4.38.3

### Patch Changes

- [#4380](https://github.com/statelyai/xstate/pull/4380) [`e9e065822`](https://github.com/statelyai/xstate/commit/e9e06582215abedf118cf2165e635eccb8e44251) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `exit` actions sometimes being called twice when a machine reaches its final state and leads its parent to stopping it at the same time.

## 5.0.0-beta.36

### Major Changes

- [#4372](https://github.com/statelyai/xstate/pull/4372) [`c19e6fb1e`](https://github.com/statelyai/xstate/commit/c19e6fb1e32ee84644d0029af0ac439b6137dd06) Thanks [@Andarist](https://github.com/Andarist)! - Removed `State['_internalQueue']`.

- [#4371](https://github.com/statelyai/xstate/pull/4371) [`8b3f6647c`](https://github.com/statelyai/xstate/commit/8b3f6647c70c7bf98c76284bf41c6fbad8e1a63d) Thanks [@Andarist](https://github.com/Andarist)! - Changed behavior of `always` transitions. Previously they were always selected after selecting any transition (including the `always` transitions). Because of that it was relatively easy to create an infinite loop using them.

  Now they are no longer selected if the preceeding transition doesn't change the state of a machine.

- [#4377](https://github.com/statelyai/xstate/pull/4377) [`14cb2ed0c`](https://github.com/statelyai/xstate/commit/14cb2ed0c211b199b7bb119686df800f729677d5) Thanks [@Andarist](https://github.com/Andarist)! - `exit` actions of all states are no longer called when the machine gets stopped externally. Note that they are still called when the machine reaches its final state.

### Patch Changes

- [#4376](https://github.com/statelyai/xstate/pull/4376) [`078eaaddd`](https://github.com/statelyai/xstate/commit/078eaaddd5eb6a9258ad6adfad6e3778e7f74f96) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with exit actions being called twice when machine reached its final state.

## 5.0.0-beta.35

### Major Changes

- [#4363](https://github.com/statelyai/xstate/pull/4363) [`3513280db`](https://github.com/statelyai/xstate/commit/3513280db56106f0113aac9dc3b9bb603853f085) Thanks [@Andarist](https://github.com/Andarist)! - Removed the ability to target deep descendants with the `initial` property.

- [#4363](https://github.com/statelyai/xstate/pull/4363) [`3513280db`](https://github.com/statelyai/xstate/commit/3513280db56106f0113aac9dc3b9bb603853f085) Thanks [@Andarist](https://github.com/Andarist)! - Removed the ability to target multiple descendants with the `initial` property.

- [#4216](https://github.com/statelyai/xstate/pull/4216) [`04cad53e0`](https://github.com/statelyai/xstate/commit/04cad53e07da2beb37520fb3c9e165fbf7b5bf86) Thanks [@Andarist](https://github.com/Andarist)! - Removed the ability to define delayed transitions using an array. Only object variant is supported now:

  ```ts
  createMachine({
    initial: 'a',
    states: {
      a: {
        after: {
          10000: 'b',
          noon: 'c'
        }
      }
      // ...
    }
  });
  ```

- [#3921](https://github.com/statelyai/xstate/pull/3921) [`0ca1b860c`](https://github.com/statelyai/xstate/commit/0ca1b860c99bac1e9187e3ca392ad3fbb0626b5d) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Spawned actors that have a referenced source (not inline) can be deeply persisted and restored:

  ```ts
  const machine = createMachine({
    context: ({ spawn }) => ({
      // This will be persisted
      ref: spawn('reducer', { id: 'child' })

      // This cannot be persisted:
      // ref: spawn(fromTransition((s) => s, { count: 42 }), { id: 'child' })
    })
  }).provide({
    actors: {
      reducer: fromTransition((s) => s, { count: 42 })
    }
  });
  ```

### Minor Changes

- [#4358](https://github.com/statelyai/xstate/pull/4358) [`03ac5c013`](https://github.com/statelyai/xstate/commit/03ac5c013507bcd899416ed0f3f849b939bf1bee) Thanks [@Andarist](https://github.com/Andarist)! - `xstate.done.state.*` events will now be generated recursively for all parallel states on the ancestors path.

### Patch Changes

- [#4361](https://github.com/statelyai/xstate/pull/4361) [`1a00b5a54`](https://github.com/statelyai/xstate/commit/1a00b5a54c3dc9b13afc187eac06d912411653cc) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a runtime crash related to machines with their root state's type being final (`createMachine({ type: 'final' })`).

- [#4357](https://github.com/statelyai/xstate/pull/4357) [`84c46c1ae`](https://github.com/statelyai/xstate/commit/84c46c1ae95cea34355245a12ca2471eca996337) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with not all actions of initial transitions resolving to the initial state of the machine itself being executed.

- [#4356](https://github.com/statelyai/xstate/pull/4356) [`81b6edafd`](https://github.com/statelyai/xstate/commit/81b6edafd6386d822c3b12c9e12e025ab4f843ad) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with actions of initial transitions being called too many times.

## 5.0.0-beta.34

### Patch Changes

- [#4351](https://github.com/statelyai/xstate/pull/4351) [`6f1818365`](https://github.com/statelyai/xstate/commit/6f1818365922749a50501a7475e0309fa4d229ca) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue that prevented `invoke.input` from seeing the context updated by the same-level `entry` actions.

- [#4344](https://github.com/statelyai/xstate/pull/4344) [`f9b17f1e9`](https://github.com/statelyai/xstate/commit/f9b17f1e9aa7fed15749af85c27004bc6ec9a24a) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Inspection events are now exported:

  ```ts
  import type {
    InspectedActorEvent,
    InspectedEventEvent,
    InspectedSnapshotEvent,
    InspectionEvent
  } from 'xstate';
  ```

## 5.0.0-beta.33

### Minor Changes

- [#4082](https://github.com/statelyai/xstate/pull/4082) [`13480c3a9`](https://github.com/statelyai/xstate/commit/13480c3a9183231ddf1c9c195f310a6d38c68c5b) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now inspect actor system updates using the `inspect` option in `createActor(logic, { inspect })`. The types of **inspection events** you can observe include:

  - `@xstate.actor` - An actor ref has been created in the system
  - `@xstate.event` - An event was sent from a source actor ref to a target actor ref in the system
  - `@xstate.snapshot` - An actor ref emitted a snapshot due to a received event

  ```ts
  import { createMachine } from 'xstate';

  const machine = createMachine({
    // ...
  });

  const actor = createActor(machine, {
    inspect: (inspectionEvent) => {
      if (inspectionEvent.type === '@xstate.actor') {
        console.log(inspectionEvent.actorRef);
      }

      if (inspectionEvent.type === '@xstate.event') {
        console.log(inspectionEvent.sourceRef);
        console.log(inspectionEvent.targetRef);
        console.log(inspectionEvent.event);
      }

      if (inspectionEvent.type === '@xstate.snapshot') {
        console.log(inspectionEvent.actorRef);
        console.log(inspectionEvent.event);
        console.log(inspectionEvent.snapshot);
      }
    }
  });
  ```

### Patch Changes

- [#4336](https://github.com/statelyai/xstate/pull/4336) [`17da18692`](https://github.com/statelyai/xstate/commit/17da18692ce33a1c7ab9e2dee8022ebc6c7899fc) Thanks [@Andarist](https://github.com/Andarist)! - Invoked actors will no longer be automatically started (added to `.children`) when those children are missing in the persisted state.

## 5.0.0-beta.32

### Patch Changes

- [#4335](https://github.com/statelyai/xstate/pull/4335) [`ba111c32c`](https://github.com/statelyai/xstate/commit/ba111c32c863ef07aaedc44111d404cef8bff3e4) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Composable (e.g. higher-order) logic should now work as expected for state machine logic, as well as all other types of logic.

- [#4330](https://github.com/statelyai/xstate/pull/4330) [`9f69d46a6`](https://github.com/statelyai/xstate/commit/9f69d46a645dfe8060180a34fcfe1a5c2ab08fa2) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with rehydrated actors not having their internal reference to the parent set correctly.

## 5.0.0-beta.31

### Major Changes

- [#4306](https://github.com/statelyai/xstate/pull/4306) [`30e3cb216`](https://github.com/statelyai/xstate/commit/30e3cb21633c0460e3ee4b9e7ea5c538b9ef1264) Thanks [@Andarist](https://github.com/Andarist)! - The final `output` of a state machine is now specified directly in the `output` property of the machine config:

  ```ts
  const machine = createMachine({
    initial: 'started',
    states: {
      started: {
        // ...
      },
      finished: {
        type: 'final'
        // moved to the top level
        //
        // output: {
        //   status: 200
        // }
      }
    },
    // This will be the final output of the machine
    // present on `snapshot.output` and in the done events received by the parent
    // when the machine reaches the top-level final state ("finished")
    output: {
      status: 200
    }
  });
  ```

### Minor Changes

- [#4172](https://github.com/statelyai/xstate/pull/4172) [`aeef5e2d0`](https://github.com/statelyai/xstate/commit/aeef5e2d0c31aeae702b5cb65e77a07fefb30325) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `onSnapshot: { ... }` transition object is now supported for invoked machines, observables, promises, and transition functions:

  ```ts
  const machine = createMachine({
    // ...
    invoke: [
      {
        src: createMachine({ ... }),
        onSnapshot: {
          actions: (context, event) => {
            event.snapshot; // machine state
          }
        }
      },
      {
        src: fromObservable(() => ...),
        onSnapshot: {
          actions: (context, event) => {
            event.snapshot; // observable value
          }
        }
      },
      {
        src: fromTransition((state, event) => { ... }, /* ... */),
        onSnapshot: {
          actions: (context, event) => {
            event.snapshot; // transition function return value
          }
        }
      }
    ]
  });
  ```

### Patch Changes

- [#4307](https://github.com/statelyai/xstate/pull/4307) [`0c7b3aa3d`](https://github.com/statelyai/xstate/commit/0c7b3aa3d37a5f4930472bb5fcd7b234a66d6416) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `input` of a callback actor created with `fromCallback(...)` will now be properly restored when the actor is persisted.

## 5.0.0-beta.30

### Major Changes

- [#4299](https://github.com/statelyai/xstate/pull/4299) [`bd9a1a599`](https://github.com/statelyai/xstate/commit/bd9a1a5997cab0f56d1bb18edba17a013cf87db9) Thanks [@Andarist](https://github.com/Andarist)! - All actor snapshots now have a consistent, predictable shape containing these common properties:

  - `status`: `'active' | 'done' | 'error' | 'stopped'`
  - `output`: The output data of the actor when it has reached `status: 'done'`
  - `error`: The error thrown by the actor when it has reached `status: 'error'`
  - `context`: The context of the actor

  This makes it easier to work with actors in a consistent way, and to inspect their snapshots.

  ```ts
  const promiseActor = fromPromise(async () => {
    return 42;
  });

  // Previously number | undefined
  // Now a snapshot object with { status, output, error, context }
  const promiseActorSnapshot = promiseActor.getSnapshot();

  if (promiseActorSnapshot.status === 'done') {
    console.log(promiseActorSnapshot.output); // 42
  }
  ```

## 5.0.0-beta.29

### Major Changes

- [#3282](https://github.com/statelyai/xstate/pull/3282) [`6ff9fc242`](https://github.com/statelyai/xstate/commit/6ff9fc2424022f3a01c2150dfe02e399751aef7f) Thanks [@Andarist](https://github.com/Andarist)! - Returning promises when creating a callback actor doesn't work anymore. Only cleanup functions can be returned now (or `undefined`).

- [#4281](https://github.com/statelyai/xstate/pull/4281) [`52b26fd30`](https://github.com/statelyai/xstate/commit/52b26fd303c01375c19c8efdb827aa1207a78f8b) Thanks [@Andarist](https://github.com/Andarist)! - Removed `deferEvents` from the actor options.

### Minor Changes

- [#4278](https://github.com/statelyai/xstate/pull/4278) [`f2d5ac047`](https://github.com/statelyai/xstate/commit/f2d5ac04753fc38c4f063d37a9e0320f162e755a) Thanks [@Andarist](https://github.com/Andarist)! - `self` provided to actions should now receive correct types for the snapshot and events.

## 5.0.0-beta.28

### Major Changes

- [#4270](https://github.com/statelyai/xstate/pull/4270) [`c8de2ce65`](https://github.com/statelyai/xstate/commit/c8de2ce65207df14035ef52d0b702c48fbb4ef39) Thanks [@Andarist](https://github.com/Andarist)! - All events automatically generated by XState will now be prefixed by `xstate.`. Naming scheme changed slightly as well, for example `done.invoke.*` events became `xstate.done.actor.*` events.

### Minor Changes

- [#4269](https://github.com/statelyai/xstate/pull/4269) [`2c916b835`](https://github.com/statelyai/xstate/commit/2c916b835d68274fbb3f4915a28b4cc798b94778) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Actor types are now exported from `xstate`:

  ```ts
  import {
    type CallbackActorLogic,
    type ObservableActorLogic,
    type PromiseActorLogic,
    type TransitionActorLogic
  } from 'xstate';
  ```

- [#4222](https://github.com/statelyai/xstate/pull/4222) [`41822f05e`](https://github.com/statelyai/xstate/commit/41822f05e46c2b439a69fac48872a4a6efe65739) Thanks [@Andarist](https://github.com/Andarist)! - `spawn` can now benefit from the actor types. Its arguments are strongly-typed based on them.

### Patch Changes

- [#4271](https://github.com/statelyai/xstate/pull/4271) [`b8118bf4c`](https://github.com/statelyai/xstate/commit/b8118bf4c8bec8adb6b4ba20ad8a356fd9675cea) Thanks [@Andarist](https://github.com/Andarist)! - Improved type safety of `spawn`ed inline actors when the actor types are not provided explicitly. It fixes an issue with an incompatible actor being assignable to a location accepting a different actor type (like a context property).

## 5.0.0-beta.27

### Major Changes

- [#4248](https://github.com/statelyai/xstate/pull/4248) [`d02226cd2`](https://github.com/statelyai/xstate/commit/d02226cd2faaee9f469d579906012737562d0fdf) Thanks [@Andarist](https://github.com/Andarist)! - Removed the ability to pass a string value directly to `invoke`. To migrate you should use the object version of `invoke`:

  ```diff
  -invoke: 'myActor'
  +invoke: { src: 'myActor' }
  ```

### Minor Changes

- [#4228](https://github.com/statelyai/xstate/pull/4228) [`824bee882`](https://github.com/statelyai/xstate/commit/824bee8820060b3cf09382f7a832f336d67a5fc7) Thanks [@Andarist](https://github.com/Andarist)! - Params of `actions` and `guards` can now be resolved dynamically

  ```ts
  createMachine({
    types: {} as {
      actions:
        | { type: 'greet'; params: { surname: string } }
        | { type: 'poke' };
    },
    entry: {
      type: 'greet',
      params: ({ context }) => ({
        surname: 'Doe'
      })
    }
  });
  ```

## 5.0.0-beta.26

### Minor Changes

- [#4220](https://github.com/statelyai/xstate/pull/4220) [`c67a3d3b0`](https://github.com/statelyai/xstate/commit/c67a3d3b0255b28f8da2a62ebdfe99d82b21b600) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Partial event descriptors are now type-safe:

  ```ts
  createMachine({
    types: {} as {
      events:
        | { type: 'mouse.click.up'; direction: 'up' }
        | { type: 'mouse.click.down'; direction: 'down' }
        | { type: 'mouse.move' }
        | { type: 'keypress' };
    },
    on: {
      'mouse.click.*': {
        actions: ({ event }) => {
          event.type;
          // 'mouse.click.up' | 'mouse.click.down'
          event.direction;
          // 'up' | 'down'
        }
      },
      'mouse.*': {
        actions: ({ event }) => {
          event.type;
          // 'mouse.click.up' | 'mouse.click.down' | 'mouse.move'
        }
      }
    }
  });
  ```

## 5.0.0-beta.25

### Minor Changes

- [#4213](https://github.com/statelyai/xstate/pull/4213) [`243d36fa8`](https://github.com/statelyai/xstate/commit/243d36fa81444dedda41885b284b87433bdd3b80) Thanks [@Andarist](https://github.com/Andarist)! - You can now define strict tags for machines:

  ```ts
  createMachine({
    types: {} as {
      tags: 'pending' | 'success' | 'error';
    }
    // ...
  });
  ```

- [#4209](https://github.com/statelyai/xstate/pull/4209) [`e658a37f4`](https://github.com/statelyai/xstate/commit/e658a37f49f2e30309ca34761e3bd82bf9c89cfd) Thanks [@Andarist](https://github.com/Andarist)! - Allow the `TGuard` type to flow into actions. Thanks to that `choose` can benefit from strongly-typed guards.

- [#4182](https://github.com/statelyai/xstate/pull/4182) [`d34f8b102`](https://github.com/statelyai/xstate/commit/d34f8b1024dbdfa98c86c57f461cc2fceba08d39) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now specify delay types for machines:

  ```ts
  createMachine({
    types: {} as {
      delays: 'one second' | 'one minute';
    }
    // ...
  });
  ```

## 5.0.0-beta.24

### Minor Changes

- [#4181](https://github.com/statelyai/xstate/pull/4181) [`70bd8d06f`](https://github.com/statelyai/xstate/commit/70bd8d06fd1422bc215a06bc4e19ae7dfe0184cc) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now specify guard types for machines:

  ```ts
  createMachine({
    types: {} as {
      guards:
        | {
            type: 'isGreaterThan';
            params: {
              count: number;
            };
          }
        | { type: 'plainGuard' };
    }
    // ...
  });
  ```

### Patch Changes

- [#4206](https://github.com/statelyai/xstate/pull/4206) [`e7b59493a`](https://github.com/statelyai/xstate/commit/e7b59493adad65570d5cb331296b4fa37ebec407) Thanks [@Andarist](https://github.com/Andarist)! - Fixed type-related issue that prevented guards `not('checkFoo')` from being used in machines.

- [#4210](https://github.com/statelyai/xstate/pull/4210) [`5d19c5a75`](https://github.com/statelyai/xstate/commit/5d19c5a755a4002dab0a82391314c090ddc3d654) Thanks [@Andarist](https://github.com/Andarist)! - Allow the types to flow from `pure` to `raise` that it returns. It now should properly raise errors on attempts to raise non-defined events and it should allow all defined events to be raised.

## 5.0.0-beta.23

### Minor Changes

- [#4180](https://github.com/statelyai/xstate/pull/4180) [`6b1646ba8`](https://github.com/statelyai/xstate/commit/6b1646ba898605021bdbbb8429417db7d967cf2a) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now specify action types for machines:

  ```ts
  createMachine({
    types: {} as {
      actions: { type: 'greet'; params: { name: string } };
    },
    entry: [
      {
        type: 'greet',
        params: {
          name: 'David'
        }
      },
      // @ts-expect-error
      { type: 'greet' },
      // @ts-expect-error
      { type: 'unknownAction' }
    ]
    // ...
  });
  ```

- [#4179](https://github.com/statelyai/xstate/pull/4179) [`2b7548579`](https://github.com/statelyai/xstate/commit/2b75485793a61703792764f8058ab6621a3ed442) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Output types can now be specified in the machine:

  ```ts
  const machine = createMachine({
    types: {} as {
      output: {
        result: 'pass' | 'fail';
        score: number;
      };
    }
    // ...
  });

  const actor = createActor(machine);

  // ...

  const snapshot = actor.getSnapshot();

  if (snapshot.output) {
    snapshot.output.result;
    // strongly typed as 'pass' | 'fail'
    snapshot.output.score;
    // strongly typed as number
  }
  ```

## 5.0.0-beta.22

### Major Changes

- [#4176](https://github.com/statelyai/xstate/pull/4176) [`2e176b0b9`](https://github.com/statelyai/xstate/commit/2e176b0b95eefddb7231f7dd40c18e3022ec9706) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `interpret(...)` function has been deprecated and renamed to `createActor(...)`:

  ```diff
  -import { interpret } from 'xstate';
  +import { createActor } from 'xstate';

  -const actor = interpret(machine);
  +const actor = createActor(machine);
  ```

## 5.0.0-beta.21

### Minor Changes

- [#4145](https://github.com/statelyai/xstate/pull/4145) [`5cc902531`](https://github.com/statelyai/xstate/commit/5cc902531477964cb614736ea628cbb3eb42309b) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Significant improvements to error handling have been made:

  - Actors will no longer crash when an error is thrown in an observer (`actor.subscribe(observer)`).
  - Errors will be handled by observer's `.error()` handler:
    ```ts
    actor.subscribe({
      error: (error) => {
        // handle error
      }
    });
    ```
  - If an observer does not have an error handler, the error will be thrown in a clear stack so bug tracking services can collect it.

- [#4054](https://github.com/statelyai/xstate/pull/4054) [`a24711181`](https://github.com/statelyai/xstate/commit/a247111814d16166c847032438382f89c5c286e8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Input types can now be specified for machines:

  ```ts
  const emailMachine = createMachine({
    types: {} as {
      input: {
        subject: string;
        message: string;
      };
    },
    context: ({ input }) => ({
      // Strongly-typed input!
      emailSubject: input.subject,
      emailBody: input.message.trim()
    })
  });

  const emailActor = interpret(emailMachine, {
    input: {
      // Strongly-typed input!
      subject: 'Hello, world!',
      message: 'This is a test.'
    }
  }).start();
  ```

## 5.0.0-beta.20

### Major Changes

- [#4036](https://github.com/statelyai/xstate/pull/4036) [`e2440f0b1`](https://github.com/statelyai/xstate/commit/e2440f0b1b5bdc00aca7f412721e7dc909af1f4c) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Actor types can now be specified in the `.types` property of `createMachine`:

  ```ts
  const fetcher = fromPromise(() => fetchUser());

  const machine = createMachine({
    types: {} as {
      actors: {
        src: 'fetchData'; // src name (inline behaviors ideally inferred)
        id: 'fetch1' | 'fetch2'; // possible ids (optional)
        logic: typeof fetcher;
      };
    },
    invoke: {
      src: 'fetchData', // strongly typed
      id: 'fetch2', // strongly typed
      onDone: {
        actions: ({ event }) => {
          event.output; // strongly typed as { result: string }
        }
      },
      input: { foo: 'hello' } // strongly typed
    }
  });
  ```

### Minor Changes

- [#4157](https://github.com/statelyai/xstate/pull/4157) [`31eb5f8a1`](https://github.com/statelyai/xstate/commit/31eb5f8a1bc9efdc857bb4650be7d6c0f5b20ed3) Thanks [@Valkendorm](https://github.com/Valkendorm)! - Merge `sendBack` and `receive` with other properties of `fromCallback` logic creator.

  ```ts
  const callbackLogic = fromCallback(({ input, system, self, sendBack, receive }) => { ... });
  ```

## 4.38.2

### Patch Changes

- [#4159](https://github.com/statelyai/xstate/pull/4159) [`8bfbb8531`](https://github.com/statelyai/xstate/commit/8bfbb85316d305dc33b00b6e6170652fa248b20b) Thanks [@Andarist](https://github.com/Andarist)! - The `cancel` action was added to the main export:

  ```ts
  import { cancel } from 'xstate';
  ```

## 5.0.0-beta.19

### Major Changes

- [#4049](https://github.com/statelyai/xstate/pull/4049) [`afc690046`](https://github.com/statelyai/xstate/commit/afc690046ce800965c132c0feda55edcf6489fc9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - If context types are specified in the machine config, the `context` property will now be required:

  ```ts
  // ❌ TS error
  createMachine({
    types: {} as {
      context: { count: number };
    }
    // Missing context property
  });

  // ✅ OK
  createMachine({
    types: {} as {
      context: { count: number };
    },
    context: {
      count: 0
    }
  });
  ```

### Minor Changes

- [#4117](https://github.com/statelyai/xstate/pull/4117) [`c7c3cb459`](https://github.com/statelyai/xstate/commit/c7c3cb4593c0e3e4943ec866d8d0729629271456) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Actor logic creators now have access to `self`:

  ```ts
  const promiseLogic = fromPromise(({ self }) => { ... });

  const observableLogic = fromObservable(({ self }) => { ... });

  const callbackLogic = fromCallback((sendBack, receive, { self }) => { ... });

  const transitionLogic = fromTransition((state, event, { self }) => { ... }, ...);
  ```

## 4.38.1

### Patch Changes

- [#4130](https://github.com/statelyai/xstate/pull/4130) [`e659fac5d`](https://github.com/statelyai/xstate/commit/e659fac5d82e283e1298122814763c59af9a2375) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `pure(...)` action creator is now properly typed so that it allows function actions:

  ```ts
  actions: pure(() => [
    // now allowed!
    (context, event) => { ... }
  ])
  ```

## 5.0.0-beta.18

### Patch Changes

- [#4138](https://github.com/statelyai/xstate/pull/4138) [`461e3983a`](https://github.com/statelyai/xstate/commit/461e3983a0e9d51c43a4b0e7370354b7dea24e5f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed missing `.mjs` proxy files for condition-based builds.

## 5.0.0-beta.17

### Major Changes

- [#4127](https://github.com/statelyai/xstate/pull/4127) [`cdaddc266`](https://github.com/statelyai/xstate/commit/cdaddc2667f9021cd9452206aab1227d5a5c229c) Thanks [@Andarist](https://github.com/Andarist)! - IDs for delayed events are no longer derived from event types so this won't work automatically:

  ```ts
  entry: raise({ type: 'TIMER' }, { delay: 200 });
  exit: cancel('TIMER');
  ```

  Please use explicit IDs:

  ```ts
  entry: raise({ type: 'TIMER' }, { delay: 200, id: 'myTimer' });
  exit: cancel('myTimer');
  ```

- [#4127](https://github.com/statelyai/xstate/pull/4127) [`cdaddc266`](https://github.com/statelyai/xstate/commit/cdaddc2667f9021cd9452206aab1227d5a5c229c) Thanks [@Andarist](https://github.com/Andarist)! - All builtin action creators (`assign`, `sendTo`, etc) are now returning _functions_. They exact shape of those is considered an implementation detail of XState and users are meant to only pass around the returned values.

### Patch Changes

- [#4123](https://github.com/statelyai/xstate/pull/4123) [`b13bfcb08`](https://github.com/statelyai/xstate/commit/b13bfcb081ba3c7216159b90999ddd90448024f1) Thanks [@Andarist](https://github.com/Andarist)! - Removed the ability to configure transitions using arrays:

  ```ts
  createMachine({
    on: [{ event: 'FOO', target: '#id' }]
    // ...
  });
  ```

  Only regular object-based configs will be supported from now on:

  ```ts
  createMachine({
    on: {
      FOO: '#id'
    }
    // ...
  });
  ```

## 5.0.0-beta.16

### Major Changes

- [#4119](https://github.com/statelyai/xstate/pull/4119) [`fd2280f4e`](https://github.com/statelyai/xstate/commit/fd2280f4ee2b8be4f8e079f492551aef488604fb) Thanks [@Andarist](https://github.com/Andarist)! - Removed the deprecated `send` action creator. Please use `sendTo` when sending events to other actors or `raise` when sending to itself.

## 5.0.0-beta.15

### Patch Changes

- [#4080](https://github.com/statelyai/xstate/pull/4080) [`94526df03`](https://github.com/statelyai/xstate/commit/94526df034bb83fa88d6751a317e9964f83f54cd) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `machine.options` property has been renamed to `machine.implementations`

- [#4078](https://github.com/statelyai/xstate/pull/4078) [`43fcdecf2`](https://github.com/statelyai/xstate/commit/43fcdecf27106370745404be0d9878dd69faf9a3) Thanks [@Andarist](https://github.com/Andarist)! - Fixed spawned actors cleanup when multiple actors were spawned without explicit IDs assigned to them.

- [#4083](https://github.com/statelyai/xstate/pull/4083) [`163528529`](https://github.com/statelyai/xstate/commit/163528529d7887b093b308c1f92911f025f437c7) Thanks [@Andarist](https://github.com/Andarist)! - Remove `State['changed']`. A new instance of `State` is being created if there are matching transitions for the received event. If there are no matching transitions then the current state is being returned.

- [#4064](https://github.com/statelyai/xstate/pull/4064) [`047897265`](https://github.com/statelyai/xstate/commit/04789726500e97d0a0a63681fc7abf66f97195b3) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Guard objects can now reference other guard objects:

  ```ts
  const machine = createMachine(
    {
      initial: 'home',
      states: {
        home: {
          on: {
            NEXT: {
              target: 'success',
              guard: 'hasSelection'
            }
          }
        },
        success: {}
      }
    },
    {
      guards: {
        // `hasSelection` is a guard object that references the `stateIn` guard
        hasSelection: stateIn('selected')
      }
    }
  );
  ```

## 4.38.0

### Minor Changes

- [#4098](https://github.com/statelyai/xstate/pull/4098) [`ae7691811`](https://github.com/statelyai/xstate/commit/ae7691811d0ac92294532ce1e5ede3898ecffbc7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `log`, `pure`, `choose`, and `stop` actions were added to the main export:

  ```ts
  import { log, pure, choose, stop } from 'xstate';
  ```

## 5.0.0-beta.14

### Major Changes

- [#4018](https://github.com/statelyai/xstate/pull/4018) [`c59bb6a72`](https://github.com/statelyai/xstate/commit/c59bb6a7231c8adff552e76fc1ca4af5b36de927) Thanks [@Andarist](https://github.com/Andarist)! - `machine.initialState` has been removed, you can use `machine.getInitialState(...)` instead

- [#4018](https://github.com/statelyai/xstate/pull/4018) [`c59bb6a72`](https://github.com/statelyai/xstate/commit/c59bb6a7231c8adff552e76fc1ca4af5b36de927) Thanks [@Andarist](https://github.com/Andarist)! - `machine.transition(...)` and `machine.getInitialState(...)` require now an `actorContext` argument

- [#4063](https://github.com/statelyai/xstate/pull/4063) [`e1f633ac9`](https://github.com/statelyai/xstate/commit/e1f633ac9f9998f5f2f07382eecd7defd6f6eba5) Thanks [@Andarist](https://github.com/Andarist)! - Removed `State['transitions']`.

- [#4018](https://github.com/statelyai/xstate/pull/4018) [`c59bb6a72`](https://github.com/statelyai/xstate/commit/c59bb6a7231c8adff552e76fc1ca4af5b36de927) Thanks [@Andarist](https://github.com/Andarist)! - `machine.transition` no longer accepts state values. You have to resolve the state value to a `State` before passing it to `machine.transition`

- [#4041](https://github.com/statelyai/xstate/pull/4041) [`50fe8cdd4`](https://github.com/statelyai/xstate/commit/50fe8cdd4114e77c104520f9c89d471cf2173dfb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Instances of "behavior" in the codebase have been replaced with "actor logic".

- [#4055](https://github.com/statelyai/xstate/pull/4055) [`eb7c8b387`](https://github.com/statelyai/xstate/commit/eb7c8b387930644bffadb2fa2fb8546aee09eb88) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `system` can now be accessed in all available actor logic creator functions:

  ```ts
  fromPromise(({ system }) => { ... });

  fromTransition((state, event, { system }) => { ... });

  fromObservable(({ system }) => { ... });

  fromEventObservable(({ system }) => { ... });

  fromCallback((sendBack, receive, { system }) => { ... });
  ```

- [#4062](https://github.com/statelyai/xstate/pull/4062) [`28603a07f`](https://github.com/statelyai/xstate/commit/28603a07ff8d8d8550927bebf5a0a0a9870bf172) Thanks [@Andarist](https://github.com/Andarist)! - Removed `State['event']`.

- [#4059](https://github.com/statelyai/xstate/pull/4059) [`bbea3bc4d`](https://github.com/statelyai/xstate/commit/bbea3bc4d39c36b642d15fe4116635d592a2c5a9) Thanks [@Andarist](https://github.com/Andarist)! - Removed `State['actions']`. Actions are considered to be a side-effect of a transition, things that happen in the moment and are not meant to be persisted beyond that.

## 5.0.0-beta.13

### Patch Changes

- [#4033](https://github.com/statelyai/xstate/pull/4033) [`9cb7cb51a`](https://github.com/statelyai/xstate/commit/9cb7cb51a0ce577d2de508aedf3773d4f80f9d46) Thanks [@Andarist](https://github.com/Andarist)! - Fixed generated TS declaration files to not include `.ts` extensions in the import/export statements.

## 5.0.0-beta.12

### Major Changes

- [#3990](https://github.com/statelyai/xstate/pull/3990) [`fe6db147a`](https://github.com/statelyai/xstate/commit/fe6db147a1d7c1555699ded8d37ed8cd46f7a982) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now add a `systemId` to spawned actors to reference them anywhere in the system.

  ```ts
  const machine = createMachine({
    // ...
    context: ({ spawn }) => ({
      actorRef: spawn(
        createMachine({
          // ...
        }),
        { systemId: 'actorRef' }
      )
    })
  });
  ```

- [#3991](https://github.com/statelyai/xstate/pull/3991) [`98db493e4`](https://github.com/statelyai/xstate/commit/98db493e44a1aaddc74615d600a01472266679a5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `actor.onDone(...)` method is removed. Use `actor.subscribe({ complete() {... } })` instead.

  ```diff
  - actor.onDone(() => { ... })
  + actor.subscribe({
  +  complete() {
  +    // ...
  +  }
  +})
  ```

## 5.0.0-beta.11

### Patch Changes

- [#4020](https://github.com/statelyai/xstate/pull/4020) [`7898731b5`](https://github.com/statelyai/xstate/commit/7898731b5738ce73a7441d528b5920c946d33b5f) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `fromEventObservable` actor logic creator now accepts `input`:

  ```ts
  const machine = createMachine({
    invoke: {
      src: fromEventObservable(({ input }) => /* ... */),
      input: {
        foo: 'bar'
      }
    }
  });
  ```

## 5.0.0-beta.10

### Major Changes

- [#3971](https://github.com/statelyai/xstate/pull/3971) [`d0ba42ca9`](https://github.com/statelyai/xstate/commit/d0ba42ca9f60e15fcb08d1b3ee33f5161dc44903) Thanks [@Andarist](https://github.com/Andarist)! - `_event` has been removed from all APIs and types. It was a wrapper structure containing the `event` that users were using directly.

## 5.0.0-beta.9

### Patch Changes

- [#3981](https://github.com/statelyai/xstate/pull/3981) [`a225a474c`](https://github.com/statelyai/xstate/commit/a225a474c7f8ff6f1ea2aa8535a5e58a36e26dc9) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with a referenced action responding to an initial raised event being called with init event

## 4.37.2

### Patch Changes

- [#3972](https://github.com/statelyai/xstate/pull/3972) [`2b9583a63`](https://github.com/statelyai/xstate/commit/2b9583a63c9089103365bad9419bd4a1edd43556) Thanks [@Andarist](https://github.com/Andarist)! - The "Some implementations missing" type-level error will now mention what implementations are missing.

## 5.0.0-beta.8

### Major Changes

- [#898](https://github.com/statelyai/xstate/pull/898) [`26986f417`](https://github.com/statelyai/xstate/commit/26986f4178d34ce3f74209e89006337cc1c10dbc) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Sending a string event to `actor.send('some string')` will now throw a proper error message.

- [#3957](https://github.com/statelyai/xstate/pull/3957) [`423c5ab72`](https://github.com/statelyai/xstate/commit/423c5ab72f1ad7f510f94a5b4b5f98e5e8540d0e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The machine `.schema` property is now `.types`:

  ```ts
  const machine = createMachine({
    // schema: { ... }
    types: {} as {
      context: { ... };
      events: { ... };
      // ...
    }
  });
  ```

  And the `.tsTypes` property is now `.types.typegen`:

  ```ts
  const machine = createMachine({
    // tsTypes: { ... }
    types: {} as {
      typegen: {};
      context: { ... };
      events: { ... };
      // ...
    }
  });
  ```

- [#3968](https://github.com/statelyai/xstate/pull/3968) [`eecb31b8f`](https://github.com/statelyai/xstate/commit/eecb31b8f43efc4580887ad850336ea74cfba537) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createEmptyActor()` function has been added to make it easier to create actors that do nothing ("empty" actors). This is useful for testing, or for some integrations such as `useActor(actor)` in `@xstate/react` that require an actor:

  ```jsx
  import { createEmptyActor } from 'xstate';

  const SomeComponent = (props) => {
    // props.actor may be undefined
    const [state, send] = useActor(props.actor ?? createEmptyActor());

    // ...
  };
  ```

- [#3966](https://github.com/statelyai/xstate/pull/3966) [`61db63bf4`](https://github.com/statelyai/xstate/commit/61db63bf44edf0efe4774ebdec29244d7d024381) Thanks [@davidkpiano](https://github.com/davidkpiano)! - You can now import the following from `xstate`:

  ```js
  import {
    // actions
    // sendTo (removed)
    pure,

    // interpret helpers
    waitFor,

    // actor functions
    fromPromise,
    fromObservable,
    fromCallback,
    fromEventObservable,
    fromTransition,

    // guard functions
    stateIn,
    not,
    and,
    or
  }
  ```

  The `send` action was removed from exports; use `sendTo(...)` or `raise(...)` instead.

### Patch Changes

- [#3959](https://github.com/statelyai/xstate/pull/3959) [`ead287257`](https://github.com/statelyai/xstate/commit/ead28725741c99c6282bd8ab1b7c12818bd66865) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Unresolved promises will now be properly persisted. The current behavior is to restart a promise that is unresolved.

## 5.0.0-beta.7

### Major Changes

- [#3900](https://github.com/statelyai/xstate/pull/3900) [`7d1a8ff09`](https://github.com/statelyai/xstate/commit/7d1a8ff097dc96526e4aba3700d34934133e6eeb) Thanks [@Andarist](https://github.com/Andarist)! - `external` property on transitions has been renamed to `reenter`

## 5.0.0-alpha.6

### Major Changes

- [#3952](https://github.com/statelyai/xstate/pull/3952) [`ec300837e`](https://github.com/statelyai/xstate/commit/ec300837e7665057b0edf8f3728319ca509ed801) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The output data on final states is now specified as `.output` instead of `.data`:

  ```diff
  const machine = createMachine({
    // ...
    states: {
      // ...
      success: {
  -     data: { message: 'Success!' }
  +     output: { message: 'Success!' }
      }
    }
  })
  ```

- [#2881](https://github.com/statelyai/xstate/pull/2881) [`2f45343c5`](https://github.com/statelyai/xstate/commit/2f45343c5a8984dd92ee6b2ee6fcf90efaee264f) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Target resolution improvements: targeting sibling nodes from the root is no longer valid, since the root node has no siblings:

  ```diff
  createMachine({
    id: 'direction',
    initial: 'left',
    states: {
      left: {},
      right: {}
    },
    on: {
  -   LEFT_CLICK: 'left',
  +   LEFT_CLICK: '.left'
    }
  });
  ```

## 5.0.0-alpha.5

### Major Changes

- [#3926](https://github.com/statelyai/xstate/pull/3926) [`f9f692b2b`](https://github.com/statelyai/xstate/commit/f9f692b2b7f51311a41d6de13037c61bbcb9b7c2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Restored state will no longer contain actions, since they are assumed to have already been executed. Actions will not be replayed.

  If you want to replay actions when restoring state, it is recommended to use an event sourcing approach.

## 5.0.0-alpha.4

### Major Changes

- [#3950](https://github.com/statelyai/xstate/pull/3950) [`e5ee0a1e8`](https://github.com/statelyai/xstate/commit/e5ee0a1e8da3487c405021901e0642f773a7e75e) Thanks [@Andarist](https://github.com/Andarist)! - Actions are no longer called with `state`

## 5.0.0-alpha.3

### Major Changes

- [#3939](https://github.com/statelyai/xstate/pull/3939) [`91bc6fdd5`](https://github.com/statelyai/xstate/commit/91bc6fdd505fb519dce5cb1b72760de43263de26) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Action/actor/delay/guard arguments are now consolidated into a single object argument. This is a breaking change for all of those things that are called with arguments.

  ```diff
  assign({
  - count: (context, event) => {
  + count: ({ context, event }) => {
      return context.count + event.value;
    }
  })
  ```

- [#3939](https://github.com/statelyai/xstate/pull/3939) [`91bc6fdd5`](https://github.com/statelyai/xstate/commit/91bc6fdd505fb519dce5cb1b72760de43263de26) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Guard arguments are now consolidated into a single object argument. This is a breaking change for all guards that are called with arguments.

  ```diff
  - guard: (context, event) => {
  + guard: ({ context, event }) => {
    return context.count + event.value > 10;
  }
  ```

## 5.0.0-alpha.2

### Major Changes

- [#3837](https://github.com/statelyai/xstate/pull/3837) [`61553600b`](https://github.com/statelyai/xstate/commit/61553600b5f32b501a26e3d69a224eeab8d940f7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Actors are now always part of a "system", which is a collection of actors that can communicate with each other. Systems are implicitly created, and can be used to get and set references to any actor in the system via the `key` prop:

  ```js
  const machine = createMachine({
    // ...
    invoke: {
      src: emailMachine,
      // Registers `emailMachine` as `emailer` on the system
      key: 'emailer'
    }
  });
  ```

  ```js
  const machine = createMachine({
    // ...
    entry: assign({
      emailer: (ctx, ev, { spawn }) => spawn(emailMachine, { key: 'emailer' })
    })
  });
  ```

  Any invoked/spawned actor that is part of a system will be able to reference that actor:

  ```js
  const anotherMachine = createMachine({
    // ...
    entry: sendTo(
      (ctx, ev, { system }) => {
        return system.get('emailer');
      },
      { type: 'SEND_EMAIL', subject: 'Hello', body: 'World' }
    )
  });
  ```

  Each top-level `interpret(...)` call creates a separate implicit system. In this example example, `actor1` and `actor2` are part of different systems and are unrelated:

  ```js
  // Implicit system
  const actor1 = interpret(machine).start();

  // Another implicit system
  const actor2 = interpret(machine).start();
  ```

- [#3911](https://github.com/statelyai/xstate/pull/3911) [`d638a0001`](https://github.com/statelyai/xstate/commit/d638a0001d3e073e8c8d0414003b42fba74ad04a) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `self` actor reference is now available in all action metas. This makes it easier to reference the "self" `ActorRef` so that actions such as `sendTo` can include it in the event payload:

  ```ts
  // Sender
  actions: sendTo('somewhere', (ctx, ev, { self }) => ({
    type: 'EVENT',
    ref: self
  })),

  // ...

  // Responder
  actions: sendTo((ctx, ev) => ev.ref, ...)
  ```

- [#3743](https://github.com/statelyai/xstate/pull/3743) [`30c561e94`](https://github.com/statelyai/xstate/commit/30c561e94f0dde770a2f73a656ba295f1686ef19) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Restoring persisted state is now done by passing the state into the `state: ...` property of the `interpret` options argument:

  ```diff
  -interpret(machine).start(state);
  +interpret(machine, { state }).start();
  ```

  The persisted state is obtained from an actor by calling `actor.getPersistedState()`:

  ```ts
  const actor = interpret(machine).start();

  const persistedState = actor.getPersistedState();

  // ...

  const restoredActor = interpret(machine, {
    state: persistedState
  }).start();
  ```

- [#3889](https://github.com/statelyai/xstate/pull/3889) [`b394cf188`](https://github.com/statelyai/xstate/commit/b394cf18885e687910c62f03192952081b1548a5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Autoforwarding events is no longer supported and the `autoForward` property has been removed.

  Instead of autoforwarding, events should be explicitly sent to actors:

  ```diff
  invoke: {
    id: 'child',
    src: 'someSrc',
  - autoForward: true
  },
  // ...
  on: {
    // ...
  + EVENT_TO_FORWARD: {
  +   actions: sendTo('child', (_, event) => event)
  + }
  }
  ```

- [#3815](https://github.com/statelyai/xstate/pull/3815) [`66bc88a68`](https://github.com/statelyai/xstate/commit/66bc88a687482132d179aafd0ac09d1e890e3b04) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `interpret(...)` function now accepts `input` in the second argument, which passes input data in the `"xstate.init"` event:

  ```js
  const greetMachine = createMachine({
    context: ({ input }) => ({
      greeting: `Hello ${input.name}!`
    }),
    entry: (_, event) => {
      event.type; // 'xstate.init'
      event.input; // { name: 'David' }
    }
    // ...
  });

  const actor = interpret(greetMachine, {
    // Pass input data to the machine
    input: { name: 'David' }
  }).start();
  ```

- [#3743](https://github.com/statelyai/xstate/pull/3743) [`30c561e94`](https://github.com/statelyai/xstate/commit/30c561e94f0dde770a2f73a656ba295f1686ef19) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Invoked actors can now be deeply persisted and restored. When the persisted state of an actor is obtained via `actor.getPersistedState()`, the states of all invoked actors are also persisted, if possible. This state can be restored by passing the persisted state into the `state: ...` property of the `interpret` options argument:

  ```diff
  -interpret(machine).start(state);
  +interpret(machine, { state }).start();
  ```

- [#3915](https://github.com/statelyai/xstate/pull/3915) [`9e18af130`](https://github.com/statelyai/xstate/commit/9e18af13057faf0671c77400d710de3433ebfde5) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `actor.onTransition(...)` method has been removed in favor of `.subscribe(...)`

  ```diff
   const actor = interpret(machine)
  -  .onTransition(...)
  -  .start();
  +actor.subscribe(...);
  +actor.start();
  ```

- [#3877](https://github.com/statelyai/xstate/pull/3877) [`1269470bd`](https://github.com/statelyai/xstate/commit/1269470bd9bf35d2020b36ddd47b722be5cd0ef6) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Observing an actor via `actor.subscribe(...)` no longer immediately receives the current snapshot. Instead, the current snapshot can be read from `actor.getSnapshot()`, and observers will receive snapshots only when a transition in the actor occurs.

  ```ts
  const actor = interpret(machine);
  actor.start();

  // Late subscription; will not receive the current snapshot
  actor.subscribe((state) => {
    // Only called when the actor transitions
    console.log(state);
  });

  // Instead, current snapshot can be read at any time
  console.log(actor.getSnapshot());
  ```

- [#3878](https://github.com/statelyai/xstate/pull/3878) [`bb9103714`](https://github.com/statelyai/xstate/commit/bb9103714c72aa4d60cfeef5b1c5a58b5720c2dc) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Actors can no longer be stopped directly by calling ~~`actor.stop()`~~. They can only be stopped from its parent internally (which might happen when you use `stop` action or automatically when a machine leaves the invoking state). The root actor can still be stopped since it has no parent.

- [#3884](https://github.com/statelyai/xstate/pull/3884) [`aa80811e5`](https://github.com/statelyai/xstate/commit/aa80811e508c574954b894317477a35a9e7a341e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Custom action objects and guard objects are now expected to put extra parameters on the `params` property:

  ```diff
  actions: {
    type: 'sendMessage',
  - message: 'hello'
  + params: {
  +   message: 'hello'
  + }
  }
  guard: {
    type: 'exists',
  - prop: 'user'
  + params: {
  +   prop: 'user'
  + }
  }
  ```

- [#3924](https://github.com/statelyai/xstate/pull/3924) [`c4e58c88d`](https://github.com/statelyai/xstate/commit/c4e58c88d04da0c2255431b2c6d6dd98b1f9ba2d) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `fromReducer(...)` function is now called `fromTransition(...)`.

- [#3890](https://github.com/statelyai/xstate/pull/3890) [`326937415`](https://github.com/statelyai/xstate/commit/326937415f20a7e1020832f09a1d30f3b379fd46) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `state._sessionid` property has been removed. It should be obtained directly from the actor: `actor.sessionId`.

- [#3756](https://github.com/statelyai/xstate/pull/3756) [`67d576190`](https://github.com/statelyai/xstate/commit/67d57619015803a6a7cf9f3b6dd98c10c064faff) Thanks [@Andarist](https://github.com/Andarist)! - All transitions became internal by default. The style of the `target` pattern (`.child`, `sibling`, `#id`) has now no effect on the transition type.

  Internal transitions don't reenter their source state when the target lies within it. You can still create external transitions (ones that reenter the source state under the mentioned circumstances) by explicitly setting `external: true` on the given transition.

## 4.37.1

### Patch Changes

- [#3913](https://github.com/statelyai/xstate/pull/3913) [`1c1874657`](https://github.com/statelyai/xstate/commit/1c187465797cd687f311d5a2e18c91738d17f194) Thanks [@Andarist](https://github.com/Andarist)! - Fixed `forwardTo`, `escalate` and `sendUpdate` to be compatible with required action types

## 4.37.0

### Minor Changes

- [#3835](https://github.com/statelyai/xstate/pull/3835) [`431472082`](https://github.com/statelyai/xstate/commit/431472082f8b644da9f519931207aa994052517f) Thanks [@with-heart](https://github.com/with-heart)! - The new `TagsFrom` helper type extracts the type of `tags` from a state machine when typegen is enabled:

  ```ts
  const machine = createMachine({
    // `tags` attached to machine via typegen
    tsTypes: {} as import('./machine.typegen').Typegen0,
    tags: ['a', 'b'],
    states: {
      idle: { tags: 'c' }
    }
  });

  type Tags = TagsFrom<typeof machine>; // 'a' | 'b' | 'c'
  ```

  If typegen is not enabled, `TagsFrom` returns `string`:

  ```ts
  const machine = createMachine({
    tags: ['a', 'b'],
    states: {
      idle: { tags: 'c' }
    }
  });

  type Tags = TagsFrom<typeof machine>; // string
  ```

### Patch Changes

- [#3855](https://github.com/statelyai/xstate/pull/3855) [`02012c2be`](https://github.com/statelyai/xstate/commit/02012c2be12f89aac43479b30571688496d8f1b3) Thanks [@Andarist](https://github.com/Andarist)! - Fixed event type narrowing in some of the builtin actions.

## 4.36.0

### Minor Changes

- [#3393](https://github.com/statelyai/xstate/pull/3393) [`430986cdf`](https://github.com/statelyai/xstate/commit/430986cdf9ae6919abc9219caeabbf695e96895a) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Deprecated `send()` action creator. Instead of that, you can use `sendTo()` to send events to other actors and `raise()` to send events to the "self" actor.

- [#3802](https://github.com/statelyai/xstate/pull/3802) [`8743ad0bd`](https://github.com/statelyai/xstate/commit/8743ad0bd6683029a17bec7e1c163ee9a221a276) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a class of inference problems for our builtin actions (`assign`, `sendTo`, etc).

- [#3694](https://github.com/statelyai/xstate/pull/3694) [`fd589055b`](https://github.com/statelyai/xstate/commit/fd589055bdd92df91bb354471d17b3cda703658f) Thanks [@Andarist](https://github.com/Andarist)! - All actions received a new generic: `TExpressionEvent`. To type things more correctly and allow TS to infer things better we need to distinguish between all events accepted by a machine (`TEvent`) and the event type that actions are "called" with (`TExpressionEvent`).

  It's best to rely on type inference so you shouldn't have to specify this generic manually all over the place.

### Patch Changes

- [#3818](https://github.com/statelyai/xstate/pull/3818) [`2d8d84fd8`](https://github.com/statelyai/xstate/commit/2d8d84fd839b520d73653dba9eba93c9c1cb2249) Thanks [@Andarist](https://github.com/Andarist)! - Fixed inference for `assign` using `PropertyAssigner`, like here:

  ```ts
  actions: assign({
    counter: 0,
    delta: (ctx, ev) => ev.delta
  });
  ```

## 4.35.4

### Patch Changes

- [#3801](https://github.com/statelyai/xstate/pull/3801) [`10d0ba76a`](https://github.com/statelyai/xstate/commit/10d0ba76a1e35e7a58d24496caa57da6c28f6c64) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with not clearing registered interpreters when their machines reached final states.

## 4.35.3

### Patch Changes

- [#3783](https://github.com/statelyai/xstate/pull/3783) [`b68f0e8bf`](https://github.com/statelyai/xstate/commit/b68f0e8bf0d097f5cb249bd3ddfd5553c1bcc028) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `EmittedFrom` sometimes not being able to infer the snapshot types from machines.

## 5.0.0-alpha.1

### Major Changes

- [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `interpreter.onStop(...)` method has been removed. Use an observer instead via `interpreter.subscribe({ complete() { ... } })` instead.

* [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `.send(...)` method on `interpreter.send(...)` now requires the first argument (the event to send) to be an _object_; that is, either:

  - an event object (e.g. `{ type: 'someEvent' }`)
  - an SCXML event object.

  The second argument (payload) is no longer supported, and should instead be included within the object:

  ```diff
  -actor.send('SOME_EVENT')
  +actor.send({ type: 'SOME_EVENT' })

  -actor.send('EVENT', { some: 'payload' })
  +actor.send({ type: 'EVENT', some: 'payload' })
  ```

- [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Reading the initial state from an actor via `actor.initialState` is removed. Use `actor.getInitialState()` instead.

* [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `matchState(...)` helper function is removed.

- [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `strict: true` option for machine config has been removed.

* [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `interpreter.onError(...)` method has been removed. Use `interpreter.subscribe({ error(err) => { ... } })` instead.

- [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `Interpreter['off']` method has been removed.

* [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `.nextState` method has been removed from the `Interpreter`. `State#can` can be used to check if sending a particular event would lead to a state change.

- [#3187](https://github.com/statelyai/xstate/pull/3187) [`c800dec47`](https://github.com/statelyai/xstate/commit/c800dec472da9fa9427fdb4b081406fadf68c6ad) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createModel()` function has been removed in favor of relying on strong types in the machine configuration.

* [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `sync` option has been removed from `invoke` and `spawn`.

### Minor Changes

- [#3727](https://github.com/statelyai/xstate/pull/3727) [`5fb3c683d`](https://github.com/statelyai/xstate/commit/5fb3c683d9a9bdc06637b3a13a5b575059aebadd) Thanks [@Andarist](https://github.com/Andarist)! - `exports` field has been added to the `package.json` manifest. It limits what files can be imported from a package - it's no longer possible to import from files that are not considered to be a part of the public API.

### Patch Changes

- [#3455](https://github.com/statelyai/xstate/pull/3455) [`ec39214c8`](https://github.com/statelyai/xstate/commit/ec39214c8eba11d75f6af72bae51ddb65ce003a0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fixed an issue with inline actions not being correctly executed when there was an equally named action provided through the `implementations` argument.

* [#3487](https://github.com/statelyai/xstate/pull/3487) [`1b6e3dfb8`](https://github.com/statelyai/xstate/commit/1b6e3dfb89bda2dde3f6d28a3404cbe4f5114ade) Thanks [@Andarist](https://github.com/Andarist), [@davidkpiano](https://github.com/davidkpiano)! - Make it impossible to exit a root state. For example, this means that root-level transitions specified as external transitions will no longer restart root-level invocations. See [#3072](https://github.com/statelyai/xstate/issues/3072) for more details.

- [#3389](https://github.com/statelyai/xstate/pull/3389) [`aa8f5d5fd`](https://github.com/statelyai/xstate/commit/aa8f5d5fdd3b87e0cef7b4ba2d315a0c9260810d) Thanks [@Andarist](https://github.com/Andarist)! - Fixed the declared signature of one of the `StateMachine`'s methods to avoid using a private name `this`. This makes it possible to emit correct `.d.ts` for the associated file.

* [#3374](https://github.com/statelyai/xstate/pull/3374) [`a990f0ed1`](https://github.com/statelyai/xstate/commit/a990f0ed19e3b69cbfaa7d36c1b5bcf4c36daea4) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with actors not being reinstantiated correctly when an actor with the same ID was first stopped and then invoked/spawned again in the same microstep.

- [#3390](https://github.com/statelyai/xstate/pull/3390) [`7abc41759`](https://github.com/statelyai/xstate/commit/7abc417592ff9ec239c82410d0ec17dc93f6ba00) Thanks [@Andarist](https://github.com/Andarist)! - Added back UMD builds. Please note that XState now comes with multiple entrypoints and you might need to load all of them (`XState`, `XStateActions`, `XStateGuards`, etc.). It's also worth mentioning that those bundles don't reference each other so they don't actually share any code and some code might be duplicated between them.

## 4.35.2

### Patch Changes

- [#3745](https://github.com/statelyai/xstate/pull/3745) [`8cc70d27e`](https://github.com/statelyai/xstate/commit/8cc70d27eb927b92603c9643a69351e6168073a6) Thanks [@viglucci](https://github.com/viglucci)! - Fix types to allow for string state name in service onDone/onError config

## 4.35.1

### Patch Changes

- [#3713](https://github.com/statelyai/xstate/pull/3713) [`96052976a`](https://github.com/statelyai/xstate/commit/96052976a0d498672b81d1b4e12f589c1e78dfad) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue that prevented events sent from the exit actions of the invoking state to be delivered to the invoked actor (when leaving that state).

## 4.35.0

### Minor Changes

- [#3607](https://github.com/statelyai/xstate/pull/3607) [`f95180510`](https://github.com/statelyai/xstate/commit/f951805103937205992f52ba7ae84a1b8d6b11c1) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createModel(...)` function is now marked as deprecated, as it will be removed in XState version 5. It is recommended to use [Typegen](https://stately.ai/blog/introducing-typescript-typegen-for-xstate) instead.

### Patch Changes

- [#3677](https://github.com/statelyai/xstate/pull/3677) [`a2ecf97ca`](https://github.com/statelyai/xstate/commit/a2ecf97cab7587946e947146c8bc3138393a55bf) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with targeted ancestors not being correctly exited when reented during external transitions.

- [#3623](https://github.com/statelyai/xstate/pull/3623) [`163c25562`](https://github.com/statelyai/xstate/commit/163c25562db20b335540d1342a38a4a12343a299) Thanks [@arromeo](https://github.com/arromeo)! - Fixed an issue with external transitions targeting ancestor states. In such a case, `entry` actions were incorrectly called on the states between the source state and the target state for states that were not reentered within this transition.

- [#3677](https://github.com/statelyai/xstate/pull/3677) [`a2ecf97ca`](https://github.com/statelyai/xstate/commit/a2ecf97cab7587946e947146c8bc3138393a55bf) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with the _active_ descendants of the targeted ancestor not being correctly reentered during external transitions.

- [#3545](https://github.com/statelyai/xstate/pull/3545) [`b9995f0`](https://github.com/statelyai/xstate/commit/b9995f0844bbbff0c813fee020935dfd7562184b) Thanks [@with-heart](https://github.com/with-heart)! - Updated `pure` action types to allow action `type` strings to be returned in the array.

  ```ts
  const machine = createMachine(
    {
      entry: ['doStuff']
    },
    {
      actions: {
        doStuff: pure(() => ['someAction']),
        someAction: () => console.log('executed by doStuff')
      }
    }
  );
  ```

  Returning action `type` strings were already handled by `xstate` and the types now correctly reflect that.

- [#3666](https://github.com/statelyai/xstate/pull/3666) [`5e0808eb4`](https://github.com/statelyai/xstate/commit/5e0808eb440f77b8404db6676401849053cfcfd8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The warning for the `predictableActionArguments` setting has been improved to only warn if it is absent. You can disable the warning by setting `predictableActionArguments: false`. It's still recommended to set it to `true` though.

## 4.34.0

### Minor Changes

- [#3588](https://github.com/statelyai/xstate/pull/3588) [`a4c8ead99`](https://github.com/statelyai/xstate/commit/a4c8ead9963f5e9097896ba0fdc1cdcc0acfd621) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The actions `raise` and `sendTo` can now be imported directly from `xstate`:

  ```js
  import { raise, sendTo } from 'xstate';

  // ...
  ```

### Patch Changes

- [#3599](https://github.com/statelyai/xstate/pull/3599) [`333f803f9`](https://github.com/statelyai/xstate/commit/333f803f96bae8ecb9a686160c0daca493f9979b) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a regression that has caused `machine.getInitialState(value)` to not follow always transitions correctly.

## 4.33.6

### Patch Changes

- [#3571](https://github.com/statelyai/xstate/pull/3571) [`6fdaae710`](https://github.com/statelyai/xstate/commit/6fdaae710e0c29e3d8ec4d694ba525d7bdb27484) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Reading state directly from ~~`someService.state`~~ is deprecated. Use `someService.getSnapshot()` instead.

- [#3555](https://github.com/statelyai/xstate/pull/3555) [`4c13b3faf`](https://github.com/statelyai/xstate/commit/4c13b3fafbdabeac6a773d0b73a63b705b3eb775) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `sendTo(actorName, event)` action creator now accepts a string `actorName`.

## 4.33.5

### Patch Changes

- [#3559](https://github.com/statelyai/xstate/pull/3559) [`ddbc9bc5c`](https://github.com/statelyai/xstate/commit/ddbc9bc5c5f0e1cc597468c5f8ae32c8931b368d) Thanks [@Andarist](https://github.com/Andarist)! - Fixed minor compatibility issues with TypeScript 4.8 in the codebase. This fixes the typechecking with TypeScript 4.8 in projects that don't use `skipLibCheck: true`.

- [#3563](https://github.com/statelyai/xstate/pull/3563) [`e3c7a9caf`](https://github.com/statelyai/xstate/commit/e3c7a9caf025e37d2e2106abff05628abbc8dd4a) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with not executing actions in response to received **batched** events when using `predictableActionArguments`.

- [#3520](https://github.com/statelyai/xstate/pull/3520) [`95a6a06d0`](https://github.com/statelyai/xstate/commit/95a6a06d0041d0201cf66ab8962fb8769187584b) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a runtime crash when sending multiple events as an array to a service. It is not recommended to use this feature though as it will be removed in the next major version.

## 4.33.4

### Patch Changes

- [#3549](https://github.com/statelyai/xstate/pull/3549) [`768c4e938`](https://github.com/statelyai/xstate/commit/768c4e938d1f33b570d56f6c7f1ef454714c4b34) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with not being able to send events to initially started child actors when using `predictableActionArguments`.

## 4.33.3

### Patch Changes

- [#3540](https://github.com/statelyai/xstate/pull/3540) [`121fad172`](https://github.com/statelyai/xstate/commit/121fad172560f26c9374582c65a48bbe540f5c6e) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue that caused `invoke`d actors to be created before resolving `assign` actions from `entry` of the same state when using `predictableActionArguments` flag.

- [#3541](https://github.com/statelyai/xstate/pull/3541) [`6c081ab87`](https://github.com/statelyai/xstate/commit/6c081ab87c4d344012ff72bae295de8f3ccdcca1) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with not being able to read the updated snapshot of a child when receiving and processing events from it and when using `predictableActionArguments` flag.

## 4.33.2

### Patch Changes

- [#3523](https://github.com/statelyai/xstate/pull/3523) [`129bcf927`](https://github.com/statelyai/xstate/commit/129bcf927e065d8d8a1a3425fa13b62c930a4727) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a regression that caused child actors not being correctly stopped when their parent reached a final state.

## 4.33.1

### Patch Changes

- [#3514](https://github.com/statelyai/xstate/pull/3514) [`b451f5789`](https://github.com/statelyai/xstate/commit/b451f5789fdfcfe05b9212e6754ae07ed0ee7cf3) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `.nextState(event)` calls accidentally executing actions in machines with `predictableActionArguments`.

## 4.33.0

### Minor Changes

- [#3289](https://github.com/statelyai/xstate/pull/3289) [`c0a147e25`](https://github.com/statelyai/xstate/commit/c0a147e256e9d32d2bbe4bc098839c9dee25213a) Thanks [@Andarist](https://github.com/Andarist)! - A new [`predictableActionArguments`](https://xstate.js.org/docs/guides/actions.html) feature flag has been added that allows you to opt into some fixed behaviors that will be the default in v5. With this flag:

  - XState will always call an action with the event directly responsible for the related transition,
  - you also automatically opt-into [`preserveActionOrder`](https://xstate.js.org/docs/guides/context.html#action-order).

  Please be aware that you might not able to use `state` from the `meta` argument when using this flag.

- [#3126](https://github.com/statelyai/xstate/pull/3126) [`37b751cb3`](https://github.com/statelyai/xstate/commit/37b751cb3c80073d6f559f0eba2ae3619a643e63) Thanks [@Andarist](https://github.com/Andarist)! - All `exit` actions in the machine will now be correctly resolved and executed when a machine gets stopped or reaches its top-level final state. Previously, the actions were not correctly resolved and that was leading to runtime errors.

  To implement this fix in a reliable way, a new internal event has been introduced: `{ type: 'xstate.stop' }` and when the machine stops its execution, all exit handlers of the current state (i.e. the active state nodes) will be called with that event. You should always assume that an exit handler might be called with that event.

### Patch Changes

- [#3178](https://github.com/statelyai/xstate/pull/3178) [`6badd2ba3`](https://github.com/statelyai/xstate/commit/6badd2ba3642391bee640aa4914003ad57f2e703) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added a dev-only error when `forwardTo` accidentally ends up trying to forward an event to an undefined actor. Such a situation indicates a logical error and risks an infinite loop.

- [#3453](https://github.com/statelyai/xstate/pull/3453) [`368ed9b1c`](https://github.com/statelyai/xstate/commit/368ed9b1cd0ea2df8cbf6662b352455afae7abfa) Thanks [@pixtron](https://github.com/pixtron)! - Call the `complete` callback of the subscribed `observer` when an interpreter gets stopped.

- [#3422](https://github.com/statelyai/xstate/pull/3422) [`e35493f59`](https://github.com/statelyai/xstate/commit/e35493f59d277ca57f0982417d5ba3bca0a352ed) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with parallel regions not always being correctly reentered on external transitions of the containing parallel state targeting another region within that parallel state.

- [#3447](https://github.com/statelyai/xstate/pull/3447) [`e93754d7a`](https://github.com/statelyai/xstate/commit/e93754d7a65d8c143bcb0070e8412ca4ebc9e523) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The types for `state.nextEvents` are now properly typed to the actual event types of the machine. Original PR: #1115 (Thanks @alexreardon!)

- [#3424](https://github.com/statelyai/xstate/pull/3424) [`88d540eb8`](https://github.com/statelyai/xstate/commit/88d540eb8e0b659c9621cc5c365bd626a000c1d7) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with targeted ancestors not being correctly reentered during external transitions.

## 5.0.0-alpha.0

### Major Changes

- [#1045](https://github.com/statelyai/xstate/pull/1045) [`7f3b84816`](https://github.com/statelyai/xstate/commit/7f3b84816564d951b6b29afdd7075256f1f59501) Thanks [@davidkpiano](https://github.com/davidkpiano)! - - The third argument of `machine.transition(state, event)` has been removed. The `context` should always be given as part of the `state`.

  - There is a new method: `machine.microstep(state, event)` which returns the resulting intermediate `State` object that represents a single microstep being taken when transitioning from `state` via the `event`. This is the `State` that does not take into account transient transitions nor raised events, and is useful for debugging.

  - The `state.events` property has been removed from the `State` object, and is replaced internally by `state._internalQueue`, which represents raised events to be processed in a macrostep loop. The `state._internalQueue` property should be considered internal (not used in normal development).

  - The `state.historyValue` property now more closely represents the original SCXML algorithm, and is a mapping of state node IDs to their historic descendent state nodes. This is used for resolving history states, and should be considered internal.

  - The `stateNode.isTransient` property is removed from `StateNode`.

  - The `.initial` property of a state node config object can now contain executable content (i.e., actions):

  ```js
  // ...
  initial: {
    target: 'someTarget',
    actions: [/* initial actions */]
  }
  ```

  - Assign actions (via `assign()`) will now be executed "in order", rather than automatically prioritized. They will be evaluated after previously defined actions are evaluated, and actions that read from `context` will have those intermediate values applied, rather than the final resolved value of all `assign()` actions taken, which was the previous behavior.

  This shouldn't change the behavior for most state machines. To maintain the previous behavior, ensure that `assign()` actions are defined before any other actions.

* [#1669](https://github.com/statelyai/xstate/pull/1669) [`969a2f4fc`](https://github.com/statelyai/xstate/commit/969a2f4fc0bc9147b9a52da25306e5c13b97f159) Thanks [@davidkpiano](https://github.com/davidkpiano)! - An error will be thrown if an `initial` state key is not specified for compound state nodes. For example:

  ```js
  const lightMachine = createMachine({
    id: 'light',
    initial: 'green',
    states: {
      green: {},
      yellow: {},
      red: {
        // Forgotten initial state:
        // initial: 'walk',
        states: {
          walk: {},
          wait: {}
        }
      }
    }
  });
  ```

  You will get the error:

  ```
  No initial state specified for state node "#light.red". Try adding { initial: "walk" } to the state config.
  ```

- [#2294](https://github.com/statelyai/xstate/pull/2294) [`c0a6dcafa`](https://github.com/statelyai/xstate/commit/c0a6dcafa1a11a5ff1660b57e0728675f155c292) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The machine's `context` is now restricted to an `object`. This was the most common usage, but now the typings prevent `context` from being anything but an object:

  ```ts
  const machine = createMachine({
    // This will produce the TS error:
    // "Type 'string' is not assignable to type 'object | undefined'"
    context: 'some string'
  });
  ```

  If `context` is `undefined`, it will now default to an empty object `{}`:

  ```ts
  const machine = createMachine({
    // No context
  });

  machine.initialState.context;
  // => {}
  ```

* [#1260](https://github.com/statelyai/xstate/pull/1260) [`172d6a7e1`](https://github.com/statelyai/xstate/commit/172d6a7e1e4ab0fa73485f76c52675be8a1f3362) Thanks [@davidkpiano](https://github.com/davidkpiano)! - All generic types containing `TContext` and `TEvent` will now follow the same, consistent order:

  1. `TContext`
  2. `TEvent`
  3. ... All other generic types, including `TStateSchema,`TTypestate`, etc.

  ```diff
  -const service = interpret<SomeCtx, SomeSchema, SomeEvent>(someMachine);
  +const service = interpret<SomeCtx, SomeEvent, SomeSchema>(someMachine);
  ```

- [#1808](https://github.com/statelyai/xstate/pull/1808) [`31bc73e05`](https://github.com/statelyai/xstate/commit/31bc73e05692f29301f5bb5cb4b87b90773e0ef2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Renamed `machine.withConfig(...)` to `machine.provide(...)`.

* [#878](https://github.com/statelyai/xstate/pull/878) [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6) Thanks [@Andarist](https://github.com/Andarist)! - Removed third parameter (context) from Machine's transition method. If you want to transition with a particular context value you should create appropriate `State` using `State.from`. So instead of this - `machine.transition('green', 'TIMER', { elapsed: 100 })`, you should do this - `machine.transition(State.from('green', { elapsed: 100 }), 'TIMER')`.

- [#1203](https://github.com/statelyai/xstate/pull/1203) [`145539c4c`](https://github.com/statelyai/xstate/commit/145539c4cfe1bde5aac247792622428e44342dd6) Thanks [@davidkpiano](https://github.com/davidkpiano)! - - The `execute` option for an interpreted service has been removed. If you don't want to execute actions, it's recommended that you don't hardcode implementation details into the base `machine` that will be interpreted, and extend the machine's `options.actions` instead. By default, the interpreter will execute all actions according to SCXML semantics (immediately upon transition).

  - Dev tools integration has been simplified, and Redux dev tools support is no longer the default. It can be included from `xstate/devTools/redux`:

  ```js
  import { interpret } from 'xstate';
  import { createReduxDevTools } from 'xstate/devTools/redux';

  const service = interpret(someMachine, {
    devTools: createReduxDevTools({
      // Redux Dev Tools options
    })
  });
  ```

  By default, dev tools are attached to the global `window.__xstate__` object:

  ```js
  const service = interpret(someMachine, {
    devTools: true // attaches via window.__xstate__.register(service)
  });
  ```

  And creating your own custom dev tools adapter is a function that takes in the `service`:

  ```js
  const myCustomDevTools = (service) => {
    console.log('Got a service!');

    service.subscribe((state) => {
      // ...
    });
  };

  const service = interpret(someMachine, {
    devTools: myCustomDevTools
  });
  ```

  - These handlers have been removed, as they are redundant and can all be accomplished with `.onTransition(...)` and/or `.subscribe(...)`:

    - `service.onEvent()`
    - `service.onSend()`
    - `service.onChange()`

  - The `service.send(...)` method no longer returns the next state. It is a `void` function (fire-and-forget).

  - The `service.sender(...)` method has been removed as redundant. Use `service.send(...)` instead.

* [#953](https://github.com/statelyai/xstate/pull/953) [`3de36bb24`](https://github.com/statelyai/xstate/commit/3de36bb24e8f59f54d571bf587407b1b6a9856e0) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Support for getters as a transition target (instead of referencing state nodes by ID or relative key) has been removed.

  The `Machine()` and `createMachine()` factory functions no longer support passing in `context` as a third argument.

  The `context` property in the machine configuration no longer accepts a function for determining context (which was introduced in 4.7). This might change as the API becomes finalized.

  The `activities` property was removed from `State` objects, as activities are now part of `invoke` declarations.

  The state nodes will not show the machine's `version` on them - the `version` property is only available on the root machine node.

  The `machine.withContext({...})` method now permits providing partial context, instead of the entire machine context.

- [#1443](https://github.com/statelyai/xstate/pull/1443) [`9e10660ec`](https://github.com/statelyai/xstate/commit/9e10660ec2f1e89cbb09a1094edb4f6b8a273a99) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `in: ...` property for transitions is removed and replaced with guards. It is recommended to use `stateIn()` and `not(stateIn())` guard creators instead:

  ```diff
  + import { stateIn } from 'xstate/guards';

  // ...
  on: {
    SOME_EVENT: {
      target: 'somewhere',
  -   in: '#someState'
  +   cond: stateIn('#someState')
    }
  }
  // ...
  ```

* [#1456](https://github.com/statelyai/xstate/pull/1456) [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175) Thanks [@davidkpiano](https://github.com/davidkpiano)! - There is now support for higher-level guards, which are guards that can compose other guards:

  - `and([guard1, guard2, /* ... */])` returns `true` if _all_ guards evaluate to truthy, otherwise `false`
  - `or([guard1, guard2, /* ... */])` returns `true` if _any_ guard evaluates to truthy, otherwise `false`
  - `not(guard1)` returns `true` if a single guard evaluates to `false`, otherwise `true`

  ```js
  import { and, or, not } from 'xstate/guards';

  const someMachine = createMachine({
    // ...
    on: {
      EVENT: {
        target: 'somewhere',
        guard: and([
          'stringGuard',
          or([{ type: 'anotherGuard' }, not(() => false)])
        ])
      }
    }
  });
  ```

- [#2824](https://github.com/statelyai/xstate/pull/2824) [`515cdc9c1`](https://github.com/statelyai/xstate/commit/515cdc9c148a3a1b558120c309080e9a21e876bc) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Actions and guards that follow eventless transitions will now receive the event that triggered the transition instead of a "null" event (`{ type: '' }`), which no longer exists:

  ```js
  // ...
  states: {
    a: {
      on: {
        SOME_EVENT: 'b'
      }
    },
    b: {
      always: 'c'
    },
    c: {
      entry: [(_, event) => {
        // event.type is now "SOME_EVENT", not ""
      }]
    }
  }
  // ...
  ```

* [#1240](https://github.com/statelyai/xstate/pull/1240) [`6043a1c28`](https://github.com/statelyai/xstate/commit/6043a1c28d21ff8cbabc420a6817a02a1a54fcc8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `in: '...'` transition property can now be replaced with `stateIn(...)` and `stateNotIn(...)` guards, imported from `xstate/guards`:

  ```diff
  import {
    createMachine,
  + stateIn
  } from 'xstate/guards';

  const machine = createMachine({
    // ...
    on: {
      SOME_EVENT: {
        target: 'anotherState',
  -     in: '#someState',
  +     cond: stateIn('#someState')
      }
    }
  })
  ```

  The `stateIn(...)` and `stateNotIn(...)` guards also can be used the same way as `state.matches(...)`:

  ```js
  // ...
  SOME_EVENT: {
    target: 'anotherState',
    cond: stateNotIn({ red: 'stop' })
  }
  ```

  ---

  An error will now be thrown if the `assign(...)` action is executed when the `context` is `undefined`. Previously, there was only a warning.

  ---

  The SCXML event `error.execution` will be raised if assignment in an `assign(...)` action fails.

  ---

  Error events raised by the machine will be _thrown_ if there are no error listeners registered on a service via `service.onError(...)`.

- [#2824](https://github.com/statelyai/xstate/pull/2824) [`6a6b2b869`](https://github.com/statelyai/xstate/commit/6a6b2b8691626112d1d9dbf23d0a0e80ff7130a8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Eventless transitions must now be specified in the `always: { ... }` object and not in the `on: { ... }` object:

  ```diff
  someState: {
    on: {
      // Will no longer work
  -   '': { target: 'anotherState' }
    },
  + always: { target: 'anotherState' }
  }
  ```

* [#2484](https://github.com/statelyai/xstate/pull/2484) [`0b49437b1`](https://github.com/statelyai/xstate/commit/0b49437b1be3e6d9bc61304711b83300cba88dc4) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Parameterized actions now require a `params` property:

  ```diff
  // ...
  entry: [
    {
      type: 'greet',
  -   message: 'Hello'
  +   params: { message: 'Hello' }
    }
  ]
  // ...
  ```

- [#987](https://github.com/statelyai/xstate/pull/987) [`0e24ea6d6`](https://github.com/statelyai/xstate/commit/0e24ea6d62a5c1a8b7e365f2252dc930d94997c4) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `internal` property will no longer have effect for transitions on atomic (leaf-node) state nodes. In SCXML, `internal` only applies to complex (compound and parallel) state nodes:

  > Determines whether the source state is exited in transitions whose target state is a descendant of the source state. [See 3.13 Selecting and Executing Transitions for details.](https://www.w3.org/TR/scxml/#SelectingTransitions)

  ```diff
  // ...
  green: {
    on: {
      NOTHING: {
  -     target: 'green',
  -     internal: true,
        actions: doSomething
      }
    }
  }
  ```

* [#987](https://github.com/statelyai/xstate/pull/987) [`04e89f90f`](https://github.com/statelyai/xstate/commit/04e89f90f97fe25a45b5908c45f25a513f0fd70f) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The history resolution algorithm has been refactored to closely match the SCXML algorithm, which changes the shape of `state.historyValue` to map history state node IDs to their most recently resolved target state nodes.

- [#2882](https://github.com/statelyai/xstate/pull/2882) [`0096d9f7a`](https://github.com/statelyai/xstate/commit/0096d9f7afda7546fc7b1d5fdd1546f55c32bfe4) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `state.history` property has been removed. This does not affect the machine "history" mechanism.

  Storing previous state should now be done explicitly:

  ```js
  let previousState;

  const service = interpret(someMachine)
    .onTransition((state) => {
      // previousState represents the last state here

      // ...

      // update the previous state at the end
      previousState = state;
    })
    .start();
  ```

* [#1456](https://github.com/statelyai/xstate/pull/1456) [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175) Thanks [@davidkpiano](https://github.com/davidkpiano)! - BREAKING: The `cond` property in transition config objects has been renamed to `guard`. This unifies terminology for guarded transitions and guard predicates (previously called "cond", or "conditional", predicates):

  ```diff
  someState: {
    on: {
      EVENT: {
        target: 'anotherState',
  -     cond: 'isValid'
  +     guard: 'isValid'
      }
    }
  }
  ```

- [#2060](https://github.com/statelyai/xstate/pull/2060) [`b200e0e0b`](https://github.com/statelyai/xstate/commit/b200e0e0b7123797086080b75abdfcf2fce45253) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `Machine()` function has been removed. Use the `createMachine()` function instead.

  ```diff
  -import { Machine } from 'xstate';
  +import { createMachine } from 'xstate';

  -const machine = Machine({
  +const machine = createMachine({
    // ...
  });
  ```

* [#3148](https://github.com/statelyai/xstate/pull/3148) [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `spawn` is no longer importable from `xstate`. Instead you get it in `assign` like this:

  ```js
  assign((ctx, ev, { spawn }) => {
    return {
      ...ctx,
      actorRef: spawn(promiseActor)
    };
  });
  ```

  In addition to that, you can now `spawn` actors defined in your implementations object, in the same way that you were already able to do that with `invoke`. To do that just reference the defined actor like this:

  ```js
  spawn('promiseActor');
  ```

- [#2869](https://github.com/statelyai/xstate/pull/2869) [`9437c3de9`](https://github.com/statelyai/xstate/commit/9437c3de912c2a38c04798cbb94f267a1e5db3f8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `service.batch(events)` method is no longer available.

* [#2191](https://github.com/statelyai/xstate/pull/2191) [`0038c7b1e`](https://github.com/statelyai/xstate/commit/0038c7b1e2050fe7262849aab8fdff4a7ce7cf92) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `StateSchema` type has been removed from all generic type signatures.

- [#3148](https://github.com/statelyai/xstate/pull/3148) [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `EmittedFrom` type helper has been renamed to `SnapshotFrom`.

* [#1163](https://github.com/statelyai/xstate/pull/1163) [`390eaaa52`](https://github.com/statelyai/xstate/commit/390eaaa523cb0dd243e39c6300e671606c1e45fc) Thanks [@davidkpiano](https://github.com/davidkpiano)! - **Breaking:** The `state.children` property is now a mapping of invoked actor IDs to their `ActorRef` instances.

  **Breaking:** The way that you interface with invoked/spawned actors is now through `ActorRef` instances. An `ActorRef` is an opaque reference to an `Actor`, which should be never referenced directly.

  **Breaking:** The `origin` of an `SCXML.Event` is no longer a string, but an `ActorRef` instance.

- [#3148](https://github.com/statelyai/xstate/pull/3148) [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `services` option passed as the second argument to `createMachine(config, options)` is renamed to `actors`. Each value in `actors` should be a function that takes in `context` and `event` and returns a [behavior](TODO: link) for an actor. The provided behavior creators are:

  - `fromMachine`
  - `fromPromise`
  - `fromCallback`
  - `fromObservable`
  - `fromEventObservable`

  ```diff
  import { createMachine } from 'xstate';
  +import { fromPromise } from 'xstate/actors';

  const machine = createMachine(
    {
      // ...
      invoke: {
        src: 'fetchFromAPI'
      }
    },
    {
  -   services: {
  +   actors: {
  -     fetchFromAPI: (context, event) => {
  +     fetchFromAPI: (context, event) => fromPromise(() => {
          // ... (return a promise)
        })
      }
    }
  );
  ```

* [#878](https://github.com/statelyai/xstate/pull/878) [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6) Thanks [@Andarist](https://github.com/Andarist)! - Support for compound string state values has been dropped from Machine's transition method. It's no longer allowed to call transition like this - `machine.transition('a.b', 'NEXT')`, instead it's required to use "state value" representation like this - `machine.transition({ a: 'b' }, 'NEXT')`.

- [#898](https://github.com/statelyai/xstate/pull/898) [`025a2d6a2`](https://github.com/statelyai/xstate/commit/025a2d6a295359a746bee6ffc2953ccc51a6aaad) Thanks [@davidkpiano](https://github.com/davidkpiano)! - - Breaking: activities removed (can be invoked)

  Since activities can be considered invoked services, they can be implemented as such. Activities are services that do not send any events back to the parent machine, nor do they receive any events, other than a "stop" signal when the parent changes to a state where the activity is no longer active. This is modeled the same way as a callback service is modeled.

* [#878](https://github.com/statelyai/xstate/pull/878) [`e09efc720`](https://github.com/statelyai/xstate/commit/e09efc720f05246b692d0fdf17cf5d8ac0344ee6) Thanks [@Andarist](https://github.com/Andarist)! - Removed previously deprecated config properties: `onEntry`, `onExit`, `parallel` and `forward`.

- [#2876](https://github.com/statelyai/xstate/pull/2876) [`c99bb43af`](https://github.com/statelyai/xstate/commit/c99bb43afec01ddee86fc746c346ea1aeeca687d) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Typings for `Typestate` have been removed. The reason for this is that types for typestates needed to be manually specified, which is unsound because it is possible to specify _impossible_ typestates; i.e., typings for a state's `value` and `context` that are impossible to achieve.

* [#2840](https://github.com/statelyai/xstate/pull/2840) [`fc5ca7b7f`](https://github.com/statelyai/xstate/commit/fc5ca7b7fcd2d7821ce2409743c50505529104e7) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Invoked/spawned actors are no longer available on `service.children` - they can only be accessed from `state.children`.

- [#1811](https://github.com/statelyai/xstate/pull/1811) [`5d16a7365`](https://github.com/statelyai/xstate/commit/5d16a73651e97dd0228c5215cb2452a4d9951118) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Prefix wildcard event descriptors are now supported. These are event descriptors ending with `".*"` which will match all events that start with the prefix (the partial event type before `".*"`):

  ```js
  // ...
  on: {
    'mouse.click': {/* ... */},
    // Matches events such as:
    // "pointer.move"
    // "pointer.move.out"
    // "pointer"
    'pointer.*': {/* ... */}
  }
  // ...
  ```

  Note: wildcards are only valid as the entire event type (`"*"`) or at the end of an event type, preceded by a period (`".*"`):

  - ✅ `"*"`
  - ✅ `"event.*"`
  - ✅ `"event.something.*"`
  - ❌ ~`"event.*.something"`~
  - ❌ ~`"event*"`~
  - ❌ ~`"event*.some*thing"`~
  - ❌ ~`"*.something"`~

* [#1456](https://github.com/statelyai/xstate/pull/1456) [`8fcbddd51`](https://github.com/statelyai/xstate/commit/8fcbddd51d66716ab1d326d934566a7664a4e175) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The interface for guard objects has changed. Notably, all guard parameters should be placed in the `params` property of the guard object:

  Example taken from [Custom Guards](https://xstate.js.org/docs/guides/guards.html#custom-guards):

  ```diff
  -cond: {
  +guard: {
  - name: 'searchValid', // `name` property no longer used
    type: 'searchValid',
  - minQueryLength: 3
  + params: {
  +   minQueryLength: 3
  + }
  }
  ```

- [#1054](https://github.com/statelyai/xstate/pull/1054) [`53a594e9a`](https://github.com/statelyai/xstate/commit/53a594e9a1b49ccb1121048a5784676f83950024) Thanks [@Andarist](https://github.com/Andarist)! - `Machine#transition` no longer handles invalid state values such as values containing non-existent state regions. If you rehydrate your machines and change machine's schema then you should migrate your data accordingly on your own.

* [#1002](https://github.com/statelyai/xstate/pull/1002) [`31a0d890f`](https://github.com/statelyai/xstate/commit/31a0d890f55d8f0b06772c9fd510b18302b76ebb) Thanks [@Andarist](https://github.com/Andarist)! - Removed support for `service.send(type, payload)`. We are using `send` API at multiple places and this was the only one supporting this shape of parameters. Additionally, it had not strict TS types and using it was unsafe (type-wise).

### Minor Changes

- [#3148](https://github.com/statelyai/xstate/pull/3148) [`7a68cbb61`](https://github.com/statelyai/xstate/commit/7a68cbb615afb6556c83868535dae67af366a117) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `onSnapshot` is now available for invoke configs. You can specify a transition there to be taken when a snapshot of an invoked actor gets updated. It works similarly to `onDone`/`onError`.

* [#1041](https://github.com/statelyai/xstate/pull/1041) [`b24e47b9e`](https://github.com/statelyai/xstate/commit/b24e47b9e7a59a5b0527d4386cea3af16c84ca7a) Thanks [@Andarist](https://github.com/Andarist)! - Support for specifying states deep in the hierarchy has been added for the `initial` property. It's also now possible to specify multiple states as initial ones - so you can enter multiple descendants which have to be **parallel** to each other. Keep also in mind that you can only target descendant states with the `initial` property - it's not possible to target states from another regions.

  Those are now possible:

  ```js
  {
    initial: '#some_id',
    initial: ['#some_id', '#another_id'],
    initial: { target: '#some_id' },
    initial: { target: ['#some_id', '#another_id'] },
  }
  ```

- [#1028](https://github.com/statelyai/xstate/pull/1028) [`0c6cfee9a`](https://github.com/statelyai/xstate/commit/0c6cfee9a6d603aa1756e3a6d0f76d4da1486caf) Thanks [@Andarist](https://github.com/Andarist)! - Added support for expressions to `cancel` action.

* [#898](https://github.com/statelyai/xstate/pull/898) [`c9cda27cb`](https://github.com/statelyai/xstate/commit/c9cda27cbe52b9c706ccb63b709d22d049be31e3) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added interop observable symbols to `ActorRef` so that actor refs are compatible with libraries like RxJS.

## 4.32.1

### Patch Changes

- [#3292](https://github.com/statelyai/xstate/pull/3292) [`16514e466`](https://github.com/statelyai/xstate/commit/16514e4663deba95731a84deaee94c17edec1e06) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue in the `EmittedFrom` type helper that could prevent it from inferring the desired type from some services.

## 4.32.0

### Minor Changes

- [#3234](https://github.com/statelyai/xstate/pull/3234) [`ce376b388`](https://github.com/statelyai/xstate/commit/ce376b3889ea900e67d20026517b87185377c32e) Thanks [@Andarist](https://github.com/Andarist)! - Added a `StateValueFrom` helper that can be used to extract valid state values from a machine. This might specifically be useful with typegen because typegenless `state.matches` accepts `any` anyway.

### Patch Changes

- [#3215](https://github.com/statelyai/xstate/pull/3215) [`44c66e74f`](https://github.com/statelyai/xstate/commit/44c66e74f9eafbb326979234e2bbe51e38dc3a86) Thanks [@tom-sherman](https://github.com/tom-sherman)! - Removing the timeout that's built in to `waitFor` is now supported by explicitly passing an `Infinity` value.

  Example usage:

  ```js
  import { waitFor } from 'xstate/lib/waitFor';

  // This will
  const loggedInState = await waitFor(
    loginService,
    (state) => state.hasTag('loggedIn'),
    { timeout: Infinity }
  );
  ```

  This fixes a bug that causes `waitFor` to reject with an error immediately due to the behaviour of `setTimeout`.

- [#3230](https://github.com/statelyai/xstate/pull/3230) [`780458c92`](https://github.com/statelyai/xstate/commit/780458c921d4525c7a00119c7eb43d4833978861) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with typegen types not being able to provide events that had a union of strings as their `type` (such as `{ type: 'INC' | 'DEC'; value: number; }`).

- [#3252](https://github.com/statelyai/xstate/pull/3252) [`a94dfd467`](https://github.com/statelyai/xstate/commit/a94dfd46772cacc59154c165f27122164f48625b) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `EventFrom` not being able to extract events that had a union of strings as their `type` (such as `{ type: 'INC' | 'DEC'; value: number; }`).

- [#3090](https://github.com/statelyai/xstate/pull/3090) [`c4f73ca13`](https://github.com/statelyai/xstate/commit/c4f73ca1356d106423c8b4ee34865f7e4f2d2bb6) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with action objects not receiving correct event types when used in the second argument to the `createMachine`.

- [#3238](https://github.com/statelyai/xstate/pull/3238) [`3df6335ef`](https://github.com/statelyai/xstate/commit/3df6335ef8db4edcf0a47d4c559716552ce4bbe8) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The typings for `sendTo(...)` have been fixed.

- [#3228](https://github.com/statelyai/xstate/pull/3228) [`fe5f0e6c9`](https://github.com/statelyai/xstate/commit/fe5f0e6c9bbb6ff740673889892301c8989eacfd) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with inline functions in the config object used as transition actions not having their argument types inferred.

- [#3252](https://github.com/statelyai/xstate/pull/3252) [`a94dfd467`](https://github.com/statelyai/xstate/commit/a94dfd46772cacc59154c165f27122164f48625b) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with default `TEvent` (`{ type: string }`) not being correctly provided to inline transition actions.

## 4.31.0

### Minor Changes

- [#3190](https://github.com/statelyai/xstate/pull/3190) [`fbf5ca0ad`](https://github.com/statelyai/xstate/commit/fbf5ca0adcafacbf170f5522eec64ac612bdeb47) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `waitFor(...)` helper function, which asynchronously _waits_ for an actor's emitted value to satisfy a `predicate` before a `timeout`, is now available.

  Example usage:

  ```js
  import { waitFor } from 'xstate/lib/waitFor';

  // ...
  const loginService = interpret(loginMachine).start();

  const loggedInState = await waitFor(loginService, (state) =>
    state.hasTag('loggedIn')
  );

  loggedInState.hasTag('loggedIn'); // true
  ```

- [#3200](https://github.com/statelyai/xstate/pull/3200) [`56c0a36`](https://github.com/statelyai/xstate/commit/56c0a36f222195d0b18edd7a72d5429a213b3808) Thanks [@Andarist](https://github.com/Andarist)! - Subscribing to a stopped interpreter will now always immediately emit its state and call a completion callback.

### Patch Changes

- [#3166](https://github.com/statelyai/xstate/pull/3166) [`be4c5c74d`](https://github.com/statelyai/xstate/commit/be4c5c74d400a1ca58befd306029c3ce77793e3e) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `state.tags` not having correct values when resolving micro transitions (taken in response to raised events). This was creating issues when checking tags in guards.

- [#3171](https://github.com/statelyai/xstate/pull/3171) [`14f8b4785`](https://github.com/statelyai/xstate/commit/14f8b4785599fb366ae2901c03c2a3202594499c) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `onDone` on parallel states not being "called" correctly when a parallel state had a history state defined directly on it.

- [#2939](https://github.com/statelyai/xstate/pull/2939) [`360e85462`](https://github.com/statelyai/xstate/commit/360e8546298c4a06b6d51d8f12c0563672dd7acf) Thanks [@Andarist](https://github.com/Andarist)! - Fixed issues with not disposing some cached internal values when stopping interpreters, which could have led to issues when starting such an interpreter again.

- [#3153](https://github.com/statelyai/xstate/pull/3153) [`b36ef9dda`](https://github.com/statelyai/xstate/commit/b36ef9dda560fca4c00428f48742fd9d2e325324) Thanks [@Andarist](https://github.com/Andarist)! - Made type displays (like in the IDE tooltips etc) more readable by using a type interface for the internal `ResolveTypegenMeta` type.

## 4.30.6

### Patch Changes

- [#3131](https://github.com/statelyai/xstate/pull/3131) [`d9a0bcfc9`](https://github.com/statelyai/xstate/commit/d9a0bcfc9be03e49726d6dc4a6bbce25239913a1) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with event type being inferred from too many places within `createMachine` call and possibly ending up as `any`/`AnyEventObject` for the entire machine.

- [#3133](https://github.com/statelyai/xstate/pull/3133) [`4feef9d47`](https://github.com/statelyai/xstate/commit/4feef9d47f81d1b28f2f898431eb4bd1c42d8368) Thanks [@fw6](https://github.com/fw6)! - Fixed compatibility with esoteric [Mini Program](https://developers.weixin.qq.com/miniprogram/en/dev/framework/app-service/) environment where `global` object was available but `global.console` wasn't.

- [#3140](https://github.com/statelyai/xstate/pull/3140) [`502ffe91a`](https://github.com/statelyai/xstate/commit/502ffe91a19579f5f747b76ce29d50de81e8b15c) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with interpreters started using a persisted state not being "resolved" in full. This could cause some things, such as `after` transitions, not being executed correctly after starting an interpreter like this.

- [#3147](https://github.com/statelyai/xstate/pull/3147) [`155539c85`](https://github.com/statelyai/xstate/commit/155539c8597b2f2783e8419c782922545d7e6424) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a TS inference issue causing some functions to infer the constraint type for the event type even though a `StateMachine` passed to the function was parametrized with a concrete type for the event. More information can be found [here](https://github.com/statelyai/xstate/issues/3141#issuecomment-1063995705).

- [#3146](https://github.com/statelyai/xstate/pull/3146) [`4cf89b5f9`](https://github.com/statelyai/xstate/commit/4cf89b5f9cf645f741164d23e3bc35dd7c5706f6) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility of `Interpreter` with older versions of TypeScript. This ensures that our interpreters can correctly be consumed by functions expecting `ActorRef` interface (like for example `useSelector`).

- [#3139](https://github.com/statelyai/xstate/pull/3139) [`7b45fda9e`](https://github.com/statelyai/xstate/commit/7b45fda9e1bd544b505c86ddcd6cf1f949007fef) Thanks [@Andarist](https://github.com/Andarist)! - `InterpreterFrom` and `ActorRefFrom` types used on machines with typegen data should now correctly return types with final/resolved typegen data. The "final" type here means a type that already encodes the information that all required implementations have been provided. Before this change this wouldn't typecheck correctly:

  ```ts
  const machine = createMachine({
    // this encodes that we still expect `myAction` to be provided
    tsTypes: {} as Typegen0
  });
  const service: InterpreterFrom<typeof machine> = machine.withConfig({
    actions: {
      myAction: () => {}
    }
  });
  ```

- [#3097](https://github.com/statelyai/xstate/pull/3097) [`c881c8ca9`](https://github.com/statelyai/xstate/commit/c881c8ca9baaf4928064a04d7034cd775a702bc2) Thanks [@davidkpiano](https://github.com/davidkpiano)! - State that is persisted and restored from `machine.resolveState(state)` will now have the correct `state.machine` value, so that `state.can(...)` and other methods will work as expected. See [#3096](https://github.com/statelyai/xstate/issues/3096) for more details.

## 4.30.5

### Patch Changes

- [#3118](https://github.com/statelyai/xstate/pull/3118) [`28e353081`](https://github.com/statelyai/xstate/commit/28e3530818e1d800eba7b6d821bde0c0048f0579) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a bundling issue that prevented the `keys()` export to be preserved in the previous release.

## 4.30.4

### Patch Changes

- [#3104](https://github.com/statelyai/xstate/pull/3104) [`3706c62f4`](https://github.com/statelyai/xstate/commit/3706c62f49daa5cf84172713a004eb26704342f5) Thanks [@Andarist](https://github.com/Andarist)! - Fixed `ContextFrom` helper type to work on typegened machines.

- [#3113](https://github.com/statelyai/xstate/pull/3113) [`144131bed`](https://github.com/statelyai/xstate/commit/144131beda5c00a15fbe0f58a3309eac81d940eb) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `keys()` utility function export, which was removed in [#3089](https://github.com/statelyai/xstate/issues/3089), is now added back, as older versions of XState libraries may depend on it still. See [#3106](https://github.com/statelyai/xstate/issues/3106) for more details.

- [#3104](https://github.com/statelyai/xstate/pull/3104) [`3706c62f4`](https://github.com/statelyai/xstate/commit/3706c62f49daa5cf84172713a004eb26704342f5) Thanks [@Andarist](https://github.com/Andarist)! - Fixed `EventFrom` helper type to work on machines.

## 4.30.3

### Patch Changes

- [#3088](https://github.com/statelyai/xstate/pull/3088) [`9f02271a3`](https://github.com/statelyai/xstate/commit/9f02271a3dd0b314a270f54d4de56af8daab31d1) Thanks [@Andarist](https://github.com/Andarist)! - Added some internal `@ts-ignore` comments to fix consuming projects that do not use `skipLibCheck`.

- [#3082](https://github.com/statelyai/xstate/pull/3082) [`8d3f2cfea`](https://github.com/statelyai/xstate/commit/8d3f2cfea7b57b6293fd862844400353e2a7451a) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with context type being inferred from too many places within `createMachine` call and possibly ending up as `any` for the entire machine.

- [#3027](https://github.com/statelyai/xstate/pull/3027) [`97ad964bd`](https://github.com/statelyai/xstate/commit/97ad964bd064ce48c28323052557336ed4def1a9) Thanks [@hedgepigdaniel](https://github.com/hedgepigdaniel)! - Fixed an issue with not being able to call `createMachine` in a generic context when the type for the context was generic and not concrete.

- [#3084](https://github.com/statelyai/xstate/pull/3084) [`50c271dc1`](https://github.com/statelyai/xstate/commit/50c271dc1a1a05b035364f8247aa4d80d613864f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with context type defined using `schema.context` being sometimes widened based on `config.context`. If both are given the `schema.context` should always take precedence and should represent the complete type of the context.

- [#3089](https://github.com/statelyai/xstate/pull/3089) [`862697e29`](https://github.com/statelyai/xstate/commit/862697e2990934d46050580d7e09c749d09d8426) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility with Skypack by exporting some shared utilities from root entry of XState and consuming them directly in other packages (this avoids accessing those things using deep imports and thus it avoids creating those compatibility problems).

- [#3087](https://github.com/statelyai/xstate/pull/3087) [`ae9579497`](https://github.com/statelyai/xstate/commit/ae95794971f765e3f984f4080f8a92236c53cd6c) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `ActorRefFrom` not resolving the typegen metadata from machine types given to it. This could sometimes result in types assignability problems, especially when using machine factories and `spawn`.

## 4.30.2

### Patch Changes

- [#3063](https://github.com/statelyai/xstate/pull/3063) [`c826559b4`](https://github.com/statelyai/xstate/commit/c826559b4c495f64c85dd79f1d1262ae9e7d15bf) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a type compatibility with Svelte's readables. It should be possible again to use XState interpreters directly as readables at the type-level.

- [#3051](https://github.com/statelyai/xstate/pull/3051) [`04091f29c`](https://github.com/statelyai/xstate/commit/04091f29cb80dd8e6c95e42668bd56f02f775973) Thanks [@Andarist](https://github.com/Andarist)! - Fixed type compatibility with functions accepting machines that were created before typegen was a thing in XState. This should make it possible to use the latest version of XState with `@xstate/vue`, `@xstate/react@^1` and some community packages.

  Note that this change doesn't make those functions to accept machines that have typegen information on them. For that the signatures of those functions would have to be adjusted.

- [#3077](https://github.com/statelyai/xstate/pull/3077) [`2c76ecac5`](https://github.com/statelyai/xstate/commit/2c76ecac5de73fbb3a2376a0f66802480ec9549f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with nested `state.matches` calls when the typegen was involved. The `state` ended up being `never` and thus not usable.

## 4.30.1

### Patch Changes

- [#3040](https://github.com/statelyai/xstate/pull/3040) [`18dc2b3e2`](https://github.com/statelyai/xstate/commit/18dc2b3e2c49527b2155063490bb7295f1f06043) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `AnyState` and `AnyStateMachine` types are now available, which can be used to express any state and state machine, respectively:

  ```ts
  import type { AnyState, AnyStateMachine } from 'xstate';

  // A function that takes in any state machine
  function visualizeMachine(machine: AnyStateMachine) {
    // (exercise left to reader)
  }

  function logState(state: AnyState) {
    // ...
  }
  ```

- [#3042](https://github.com/statelyai/xstate/pull/3042) [`e53396f08`](https://github.com/statelyai/xstate/commit/e53396f083091db26c117000ce6ec070914360e9) Thanks [@suerta-git](https://github.com/suerta-git)! - Added the `AnyStateConfig` type, which represents any `StateConfig<...>`:

  ```ts
  import type { AnyStateConfig } from 'xstate';
  import { State } from 'xstate';

  // Retrieving the state config from localStorage
  const stateConfig: AnyStateConfig = JSON.parse(
    localStorage.getItem('app-state')
  );

  // Use State.create() to restore state from config object with correct type
  const previousState = State.create(stateConfig);
  ```

## 4.30.0

### Minor Changes

- [#2965](https://github.com/statelyai/xstate/pull/2965) [`8b8f719c3`](https://github.com/statelyai/xstate/commit/8b8f719c36ab2c09fcd11b529cc6c9c89a06ad2e) Thanks [@satyasinha](https://github.com/satyasinha)! - All actions are now available in the `actions` variable when importing: `import { actions } from 'xstate'`

- [#2892](https://github.com/statelyai/xstate/pull/2892) [`02de3d44f`](https://github.com/statelyai/xstate/commit/02de3d44f8ca87b4dcb4153d3560da7d43ee9d0b) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Persisted state can now be easily restored to a state compatible with the machine without converting it to a `State` instance first:

  ```js
  // Persisting a state
  someService.subscribe((state) => {
    localStorage.setItem('some-state', JSON.stringify(state));
  });

  // Restoring a state
  const stateJson = localStorage.getItem('some-state');

  // No need to convert `stateJson` object to a state!
  const someService = interpret(someMachine).start(stateJson);
  ```

### Patch Changes

- [#3012](https://github.com/statelyai/xstate/pull/3012) [`ab431dcb8`](https://github.com/statelyai/xstate/commit/ab431dcb8bd67a3f0bcfc9b6ca31779bb15d14af) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with a reference to `@types/node` being inserted into XState's compiled output. This could cause unexpected issues in projects expecting APIs like `setTimeout` to be typed with browser compatibility in mind.

- [#3023](https://github.com/statelyai/xstate/pull/3023) [`642e9f5b8`](https://github.com/statelyai/xstate/commit/642e9f5b83dae79f016be8b657d25499077bbcda) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with states created using `machine.getInitialState` not being "resolved" in full. This could cause some things, such as `after` transitions, not being executed correctly after starting an interpreter using such state.

- [#2982](https://github.com/statelyai/xstate/pull/2982) [`a39145580`](https://github.com/statelyai/xstate/commit/a391455803171dcf03a1a0ec589f9dd603260d63) Thanks [@Andarist](https://github.com/Andarist)! - Marked all phantom properties on the `StateMachine` type as deprecated. This deprioritized them in IDEs so they don't popup as first suggestions during property access.

- [#2992](https://github.com/statelyai/xstate/pull/2992) [`22737adf2`](https://github.com/statelyai/xstate/commit/22737adf211971197f3809f406ac3bee54dc69f0) Thanks [@Andarist](https://github.com/Andarist), [@mattpocock](https://github.com/mattpocock)! - Fixed an issue with `state.context` becoming `any` after `state.matches` when typegen is used.

- [#2981](https://github.com/statelyai/xstate/pull/2981) [`edf60d67b`](https://github.com/statelyai/xstate/commit/edf60d67b3ca58eca96c7853410528c4e4abac7b) Thanks [@Andarist](https://github.com/Andarist)! - Moved an internal `@ts-ignore` to a JSDoc-style comment to fix consuming projects that do not use `skipLibCheck`. Regular inline and block comments are not preserved in the TypeScript's emit.

## 4.29.0

### Minor Changes

- [#2674](https://github.com/statelyai/xstate/pull/2674) [`1cd26811c`](https://github.com/statelyai/xstate/commit/1cd26811cea441366a082b0f77c7a6ffb135dc38) Thanks [@Andarist](https://github.com/Andarist)! - Using `config.schema` becomes the preferred way of "declaring" TypeScript generics with this release:

  ```js
  createMachine({
      schema: {
          context: {} as { count: number },
          events: {} as { type: 'INC' } | { type: 'DEC' }
      }
  })
  ```

  This allows us to leverage the inference algorithm better and unlocks some exciting possibilities for using XState in a more type-strict manner.

- [#2674](https://github.com/statelyai/xstate/pull/2674) [`1cd26811c`](https://github.com/statelyai/xstate/commit/1cd26811cea441366a082b0f77c7a6ffb135dc38) Thanks [@Andarist](https://github.com/Andarist), [@mattpocock](https://github.com/mattpocock)! - Added the ability to tighten TS declarations of machine with generated metadata. This opens several exciting doors to being able to use typegen seamlessly with XState to provide an amazing typing experience.

  With the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=statelyai.stately-vscode), you can specify a new attribute called `tsTypes: {}` in your machine definition:

  ```ts
  const machine = createMachine({
    tsTypes: {}
  });
  ```

  The extension will automatically add a type assertion to this property, which allows for type-safe access to a lot of XState's API's.

  ⚠️ This feature is in beta. Actions/services/guards/delays might currently get incorrectly annotated if they are called "in response" to always transitions or raised events. We are working on fixing this, both in XState and in the typegen.

### Patch Changes

- [#2962](https://github.com/statelyai/xstate/pull/2962) [`32520650b`](https://github.com/statelyai/xstate/commit/32520650b7d6b43e416b896054033432aaede5d5) Thanks [@mattpocock](https://github.com/mattpocock)! - Added `t()`, which can be used to provide types for `schema` attributes in machine configs:

  ```ts
  import { t, createMachine } from 'xstate';

  const machine = createMachine({
    schema: {
      context: t<{ value: number }>(),
      events: t<{ type: 'EVENT_1' } | { type: 'EVENT_2' }>()
    }
  });
  ```

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 4.28.1

### Patch Changes

- [#2943](https://github.com/statelyai/xstate/pull/2943) [`e9f3f07a1`](https://github.com/statelyai/xstate/commit/e9f3f07a1ee9fe97af7e8f532c5b3dd3c4f73cec) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an infinite loop when initially spawned actor (in an initial context) responded synchronously to its parent.

- [#2953](https://github.com/statelyai/xstate/pull/2953) [`90fa97008`](https://github.com/statelyai/xstate/commit/90fa97008970283f17a3f2f6aa9b1b7071593e80) Thanks [@Andarist](https://github.com/Andarist)! - Bring back the global type declaration for the `Symbol.observable` to fix consuming projects that do not use `skipLibCheck`.

- [#2903](https://github.com/statelyai/xstate/pull/2903) [`b6dde9075`](https://github.com/statelyai/xstate/commit/b6dde9075adb3bb3522b4b8f8eeb804d3221a527) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with exit actions being called in random order when stopping a machine. They should always be called in the reversed document order (the ones defined on children should be called before the ones defined on ancestors and the ones defined on states appearing later in the code should be called before the ones defined on their sibling states).

## 4.28.0

### Minor Changes

- [#2835](https://github.com/statelyai/xstate/pull/2835) [`029f7b75a`](https://github.com/statelyai/xstate/commit/029f7b75a22a8186e5e3983dfd980c52369ef09f) Thanks [@woutermont](https://github.com/woutermont)! - Added interop observable symbols to `ActorRef` so that actor refs are compatible with libraries like RxJS.

### Patch Changes

- [#2864](https://github.com/statelyai/xstate/pull/2864) [`4252ee212`](https://github.com/statelyai/xstate/commit/4252ee212e59fd074707b933c101662d47938849) Thanks [@davidkpiano](https://github.com/statelyai)! - Generated IDs for invocations that do not provide an `id` are now based on the state ID to avoid collisions:

  ```js
  createMachine({
    id: 'test',
    initial: 'p',
    states: {
      p: {
        type: 'parallel',
        states: {
          // Before this change, both invoke IDs would be 'someSource',
          // which is incorrect.
          a: {
            invoke: {
              src: 'someSource'
              // generated invoke ID: 'test.p.a:invocation[0]'
            }
          },
          b: {
            invoke: {
              src: 'someSource'
              // generated invoke ID: 'test.p.b:invocation[0]'
            }
          }
        }
      }
    }
  });
  ```

- [#2925](https://github.com/statelyai/xstate/pull/2925) [`239b4666a`](https://github.com/statelyai/xstate/commit/239b4666ac302d80c028fef47c6e8ab7e0ae2757) Thanks [@devanfarrell](https://github.com/devanfarrell)! - The `sendTo(actorRef, event)` action creator introduced in `4.27.0`, which was not accessible from the package exports, can now be used just like other actions:

  ```js
  import { actions } from 'xstate';

  const { sendTo } = actions;
  ```

## 4.27.0

### Minor Changes

- [#2800](https://github.com/statelyai/xstate/pull/2800) [`759a90155`](https://github.com/statelyai/xstate/commit/759a9015512bbf532d7044afe6a889c04dc7edf6) Thanks [@davidkpiano](https://github.com/statelyai)! - The `sendTo(actorRef, event)` action creator has been introduced. It allows you to specify the recipient actor ref of an event first, so that the event can be strongly typed against the events allowed to be received by the actor ref:

  ```ts
  // ...
  entry: sendTo(
    (ctx) => ctx.someActorRef,
    { type: 'EVENT_FOR_ACTOR' }
  ),
  // ...
  ```

### Patch Changes

- [#2804](https://github.com/statelyai/xstate/pull/2804) [`f3caecf5a`](https://github.com/statelyai/xstate/commit/f3caecf5ad384cfe2a843c26333aaa46a77ece68) Thanks [@davidkpiano](https://github.com/statelyai)! - The `state.can(...)` method no longer unnecessarily executes `assign()` actions and instead determines if a given event will change the state by reading transition data before evaluating actions.

- [#2856](https://github.com/statelyai/xstate/pull/2856) [`49c2e9094`](https://github.com/statelyai/xstate/commit/49c2e90945d369e2dfb2e4fc376b3f46714dce09) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with stopped children sometimes starting their own child actors. This could happen when the child was stopped synchronously (for example by its parent) when transitioning to an invoking state.

- [#2895](https://github.com/statelyai/xstate/pull/2895) [`df5ffce14`](https://github.com/statelyai/xstate/commit/df5ffce14908d0aa8056a56001039dfd260be1a4) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with some exit handlers being executed more than once when stopping a machine.

## 4.26.1

### Patch Changes

- [#2819](https://github.com/statelyai/xstate/pull/2819) [`0d51d33cd`](https://github.com/statelyai/xstate/commit/0d51d33cd6dc6ab876a5554788300282d03fa5d1) Thanks [@simonihmig](https://github.com/simonihmig)! - Support `globalThis` in `getGlobal()` for better compatibility

- [#2828](https://github.com/statelyai/xstate/pull/2828) [`c0ef3e8`](https://github.com/statelyai/xstate/commit/c0ef3e882c688e6beefb196a3293ec71b65625e3) Thanks [@davidkpiano](https://github.com/statelyai)! - XState is now compatible with TypeScript version 4.5.

## 4.26.0

### Minor Changes

- [#2672](https://github.com/statelyai/xstate/pull/2672) [`8e1d05d`](https://github.com/statelyai/xstate/commit/8e1d05dcafab0d1c8a63b07694b3f208850b0b4b) Thanks [@davidkpiano](https://github.com/statelyai)! - The `description` property is a new top-level property for state nodes and transitions, that lets you provide text descriptions:

  ```ts
  const machine = createMachine({
    // ...
    states: {
      active: {
        // ...
        description: 'The task is in progress',
        on: {
          DEACTIVATE: {
            // ...
            description: 'Deactivates the task'
          }
        }
      }
    }
  });
  ```

  Future Stately tooling will use the `description` to render automatically generated documentation, type hints, and enhancements to visual tools.

- [#2743](https://github.com/statelyai/xstate/pull/2743) [`e268bf34a`](https://github.com/statelyai/xstate/commit/e268bf34a0dfe442ef7b43ecf8ab5c8d81ac69fb) Thanks [@janovekj](https://github.com/janovekj)! - Add optional type parameter to narrow type returned by `EventFrom`. You can use it like this:

  ```ts
  type UpdateNameEvent = EventFrom<typeof userModel>;
  ```

### Patch Changes

- [#2738](https://github.com/statelyai/xstate/pull/2738) [`942fd90e0`](https://github.com/statelyai/xstate/commit/942fd90e0c7a942564dd9c2ffebb93d6c86698df) Thanks [@michelsciortino](https://github.com/michelsciortino)! - The `tags` property was missing from state's definitions. This is used when converting a state to a JSON string. Since this is how we serialize states within [`@xstate/inspect`](https://github.com/statelyai/xstate/tree/main/packages/xstate-inspect) this has caused inspected machines to miss the `tags` information.

- [#2740](https://github.com/statelyai/xstate/pull/2740) [`707cb981f`](https://github.com/statelyai/xstate/commit/707cb981fdb8a5c75cacb7e9bfa5c7e5a1cc1c88) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with tags being missed on a service state after starting that service using a state value, like this:

  ```js
  const service = interpret(machine).start('active');
  service.state.hasTag('foo'); // this should now return a correct result
  ```

- [#2691](https://github.com/statelyai/xstate/pull/2691) [`a72806035`](https://github.com/statelyai/xstate/commit/a728060353c9cb9bdb0cd37aacf793498a8750c8) Thanks [@davidkpiano](https://github.com/statelyai)! - Meta data can now be specified for `invoke` configs in the `invoke.meta` property:

  ```js
  const machine = createMachine({
    // ...
    invoke: {
      src: (ctx, e) => findUser(ctx.userId),
      meta: {
        summary: 'Finds user',
        updatedAt: '2021-09-...',
        version: '4.12.2'
        // other descriptive meta properties
      }
    }
  });
  ```

## 4.25.0

### Minor Changes

- [#2657](https://github.com/statelyai/xstate/pull/2657) [`72155c1b7`](https://github.com/statelyai/xstate/commit/72155c1b7887b94f2d8f7cb73a1af17a591cc74c) Thanks [@mattpocock](https://github.com/mattpocock)! - Removed the ability to pass a model as a generic to `createMachine`, in favour of `model.createMachine`. This lets us cut an overload from the definition of `createMachine`, meaning errors become more targeted and less cryptic.

  This means that this approach is no longer supported:

  ```ts
  const model = createModel({});

  const machine = createMachine<typeof model>();
  ```

  If you're using this approach, you should use `model.createMachine` instead:

  ```ts
  const model = createModel({});

  const machine = model.createMachine();
  ```

### Patch Changes

- [#2659](https://github.com/statelyai/xstate/pull/2659) [`7bfeb930d`](https://github.com/statelyai/xstate/commit/7bfeb930d65eb4443c300a2d28aeef3664fcafea) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a regression in the inline actions type inference in models without explicit action creators.

  ```js
  const model = createModel(
    { foo: 100 },
    {
      events: {
        BAR: () => ({})
      }
    }
  );

  model.createMachine({
    // `ctx` was of type `any`
    entry: (ctx) => {},
    exit: assign({
      // `ctx` was of type `unknown`
      foo: (ctx) => 42
    })
  });
  ```

## 4.24.1

### Patch Changes

- [#2649](https://github.com/statelyai/xstate/pull/2649) [`ad611007a`](https://github.com/statelyai/xstate/commit/ad611007a9111e8aefe9d22049ac99072588db9f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with functions used as inline actions not always receiving the correct arguments when used with `preserveActionOrder`.

## 4.24.0

### Minor Changes

- [#2546](https://github.com/statelyai/xstate/pull/2546) [`a4cfce18c`](https://github.com/statelyai/xstate/commit/a4cfce18c0c179faef15adf25a75b08903064e28) Thanks [@davidkpiano](https://github.com/statelyai)! - You can now know if an event will cause a state change by using the new `state.can(event)` method, which will return `true` if an interpreted machine will "change" the state when sent the `event`, or `false` otherwise:

  ```js
  const machine = createMachine({
    initial: 'inactive',
    states: {
      inactive: {
        on: {
          TOGGLE: 'active'
        }
      },
      active: {
        on: {
          DO_SOMETHING: { actions: ['something'] }
        }
      }
    }
  });

  const state = machine.initialState;

  state.can('TOGGLE'); // true
  state.can('DO_SOMETHING'); // false

  // Also takes in full event objects:
  state.can({
    type: 'DO_SOMETHING',
    data: 42
  }); // false
  ```

  A state is considered "changed" if any of the following are true:

  - its `state.value` changes
  - there are new `state.actions` to be executed
  - its `state.context` changes

  See [`state.changed` (documentation)](https://xstate.js.org/docs/guides/states.html#state-changed) for more details.

### Patch Changes

- [#2632](https://github.com/statelyai/xstate/pull/2632) [`f8cf5dfe0`](https://github.com/statelyai/xstate/commit/f8cf5dfe0bf20c8545208ed7b1ade619933004f9) Thanks [@davidkpiano](https://github.com/statelyai)! - A regression was fixed where actions were being typed as `never` if events were specified in `createModel(...)` but not actions:

  ```ts
  const model = createModel(
    {},
    {
      events: {}
    }
  );

  model.createMachine({
    // These actions will cause TS to not compile
    entry: 'someAction',
    exit: { type: 'someObjectAction' }
  });
  ```

## 4.23.4

### Patch Changes

- [#2606](https://github.com/statelyai/xstate/pull/2606) [`01e5d7984`](https://github.com/statelyai/xstate/commit/01e5d7984a5441a6980eacdb06d42c2a9398bdff) Thanks [@davidkpiano](https://github.com/statelyai)! - The following utility types were previously returning `never` in some unexpected cases, and are now working as expected:

  - `ContextFrom<T>`
  - `EventFrom<T>`
  - `EmittedFrom<T>`

## 4.23.3

### Patch Changes

- [#2587](https://github.com/statelyai/xstate/pull/2587) [`5aaa8445c`](https://github.com/statelyai/xstate/commit/5aaa8445c0041c6e9c47285c18e8b71cb2d805a7) Thanks [@Andarist](https://github.com/Andarist)! - Allow for guards to be always resolved from the implementations object. This allows a guard implementation to be updated in the running service by `@xstate/react`.

## 4.23.2

### Patch Changes

- [`6c3f15c9`](https://github.com/statelyai/xstate/commit/6c3f15c967c816d5d9d235466e1cb1d030deb4a8) [#2551](https://github.com/statelyai/xstate/pull/2551) Thanks [@mattpocock](https://github.com/mattpocock)! - Widened the \*From utility types to allow extracting from factory functions.

  This allows for:

  ```ts
  const makeMachine = () => createMachine({});

  type Interpreter = InterpreterFrom<typeof makeMachine>;
  type Actor = ActorRefFrom<typeof makeMachine>;
  type Context = ContextFrom<typeof makeMachine>;
  type Event = EventsFrom<typeof makeMachine>;
  ```

  This also works for models, behaviours, and other actor types.

  The previous method for doing this was a good bit more verbose:

  ```ts
  const makeMachine = () => createMachine({});

  type Interpreter = InterpreterFrom<ReturnType<typeof machine>>;
  ```

- [`413a4578`](https://github.com/statelyai/xstate/commit/413a4578cded21beffff822d1485a3725457b768) [#2491](https://github.com/statelyai/xstate/pull/2491) Thanks [@davidkpiano](https://github.com/statelyai)! - The custom `.toString()` method on action objects is now removed which improves performance in larger applications (see [#2488](https://github.com/statelyai/xstate/discussions/2488) for more context).

- [`5e1223cd`](https://github.com/statelyai/xstate/commit/5e1223cd58485045b192677753946df2c00eddf7) [#2422](https://github.com/statelyai/xstate/pull/2422) Thanks [@davidkpiano](https://github.com/statelyai)! - The `context` property has been removed from `StateNodeConfig`, as it has never been allowed, nor has it ever done anything. The previous typing was unsafe and allowed `context` to be specified on nested state nodes:

  ```ts
  createMachine({
    context: {
      /* ... */
    }, // ✅ This is allowed
    initial: 'inner',
    states: {
      inner: {
        context: {
          /* ... */
        } // ❌ This will no longer compile
      }
    }
  });
  ```

- [`5b70c2ff`](https://github.com/statelyai/xstate/commit/5b70c2ff21cc5d8c6cf1c13b6eb7bb12611a9835) [#2508](https://github.com/statelyai/xstate/pull/2508) Thanks [@davidkpiano](https://github.com/statelyai)! - A race condition occurred when a child service is immediately stopped and the parent service tried to remove it from its undefined state (during its own initialization). This has been fixed, and the race condition no longer occurs. See [this issue](https://github.com/statelyai/xstate/issues/2507) for details.

- [`5a9500d1`](https://github.com/statelyai/xstate/commit/5a9500d1cde9bf2300a85bc81529da83f2d08361) [#2522](https://github.com/statelyai/xstate/pull/2522) Thanks [@farskid](https://github.com/farskid), [@Andarist](https://github.com/Andarist)! - Adjusted TS type definitions of the `withContext` and `withConfig` methods so that they accept "lazy context" now.

  Example:

  ```js
  const copy = machine.withContext(() => ({
    ref: spawn(() => {})
  }));
  ```

- [`84f9fcae`](https://github.com/statelyai/xstate/commit/84f9fcae7d2b7f99800cc3bf18097ed45c48f0f5) [#2540](https://github.com/statelyai/xstate/pull/2540) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `state.hasTag('someTag')` crashing when the `state` was rehydrated.

- [`c17dd376`](https://github.com/statelyai/xstate/commit/c17dd37621a2ba46967926d550c70a35bba7024c) [#2496](https://github.com/statelyai/xstate/pull/2496) Thanks [@VanTanev](https://github.com/VanTanev)! - Add utility type `EmittedFrom<T>` that extracts `Emitted` type from any type which can emit data

## 4.23.1

### Patch Changes

- [`141c91cf`](https://github.com/statelyai/xstate/commit/141c91cffd1d7c1ec2e82186834cb977b72fb4d4) [#2436](https://github.com/statelyai/xstate/pull/2436) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue where, when using `model.createMachine`, state's context was incorrectly inferred as `any` after refinement with `.matches(...)`, e.g.

  ```ts
  // `state.context` became `any` erroneously
  if (state.matches('inactive')) {
    console.log(state.context.count);
  }
  ```

## 4.23.0

### Minor Changes

- [`7dc7ceb8`](https://github.com/statelyai/xstate/commit/7dc7ceb8707569b48ceb35069125763a701a0a58) [#2379](https://github.com/statelyai/xstate/pull/2379) Thanks [@davidkpiano](https://github.com/statelyai)! - There is a new `.preserveActionOrder` (default: `false`) setting in the machine configuration that preserves the order of actions when set to `true`. Normally, actions are executed in order _except_ for `assign(...)` actions, which are prioritized and executed first. When `.preserveActionOrder` is set to `true`, `assign(...)` actions will _not_ be prioritized, and will instead run in order. As a result, actions will capture the **intermediate `context` values** instead of the resulting `context` value from all `assign(...)` actions.

  ```ts
  // With `.preserveActionOrder: true`
  const machine = createMachine({
    context: { count: 0 },
    entry: [
      (ctx) => console.log(ctx.count), // 0
      assign({ count: (ctx) => ctx.count + 1 }),
      (ctx) => console.log(ctx.count), // 1
      assign({ count: (ctx) => ctx.count + 1 }),
      (ctx) => console.log(ctx.count) // 2
    ],
    preserveActionOrder: true
  });

  // With `.preserveActionOrder: false` (default)
  const machine = createMachine({
    context: { count: 0 },
    entry: [
      (ctx) => console.log(ctx.count), // 2
      assign({ count: (ctx) => ctx.count + 1 }),
      (ctx) => console.log(ctx.count), // 2
      assign({ count: (ctx) => ctx.count + 1 }),
      (ctx) => console.log(ctx.count) // 2
    ]
    // preserveActionOrder: false
  });
  ```

### Patch Changes

- [`4e305372`](https://github.com/statelyai/xstate/commit/4e30537266eb082ccd85f050c9372358247b4167) [#2361](https://github.com/statelyai/xstate/pull/2361) Thanks [@woutermont](https://github.com/woutermont)! - Add type for `Symbol.observable` to the `Interpreter` to improve the compatibility with RxJS.

- [`1def6cf6`](https://github.com/statelyai/xstate/commit/1def6cf6109867a87b4323ee83d20a9ee0c49d7b) [#2374](https://github.com/statelyai/xstate/pull/2374) Thanks [@davidkpiano](https://github.com/statelyai)! - Existing actors can now be identified in `spawn(...)` calls by providing an `id`. This allows them to be referenced by string:

  ```ts
  const machine = createMachine({
    context: () => ({
      someRef: spawn(someExistingRef, 'something')
    }),
    on: {
      SOME_EVENT: {
        actions: send('AN_EVENT', { to: 'something' })
      }
    }
  });
  ```

- [`da6861e3`](https://github.com/statelyai/xstate/commit/da6861e34a2b28bf6eeaa7c04a2d4cf9a90f93f1) [#2391](https://github.com/statelyai/xstate/pull/2391) Thanks [@davidkpiano](https://github.com/statelyai)! - There are two new helper types for extracting `context` and `event` types:

  - `ContextFrom<T>` which extracts the `context` from any type that uses context
  - `EventFrom<T>` which extracts the `event` type (which extends `EventObject`) from any type which uses events

## 4.22.0

### Minor Changes

- [`1b32aa0d`](https://github.com/statelyai/xstate/commit/1b32aa0d3a0eca11ffcb7ec9d710eb8828107aa0) [#2356](https://github.com/statelyai/xstate/pull/2356) Thanks [@davidkpiano](https://github.com/statelyai)! - The model created from `createModel(...)` now provides a `.createMachine(...)` method that does not require passing any generic type parameters:

  ```diff
  const model = createModel(/* ... */);

  -const machine = createMachine<typeof model>(/* ... */);
  +const machine = model.createMachine(/* ... */);
  ```

- [`432b60f7`](https://github.com/statelyai/xstate/commit/432b60f7bcbcee9510e0d86311abbfd75b1a674e) [#2280](https://github.com/statelyai/xstate/pull/2280) Thanks [@davidkpiano](https://github.com/statelyai)! - Actors can now be invoked/spawned from reducers using the `fromReducer(...)` behavior creator:

  ```ts
  import { fromReducer } from 'xstate/lib/behaviors';

  type CountEvent = { type: 'INC' } | { type: 'DEC' };

  const countReducer = (count: number, event: CountEvent): number => {
    if (event.type === 'INC') {
      return count + 1;
    } else if (event.type === 'DEC') {
      return count - 1;
    }

    return count;
  };

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
  ```

- [`f9bcea2c`](https://github.com/statelyai/xstate/commit/f9bcea2ce909ac59fcb165b352a7b51a8b29a56d) [#2366](https://github.com/statelyai/xstate/pull/2366) Thanks [@davidkpiano](https://github.com/statelyai)! - Actors can now be spawned directly in the initial `machine.context` using lazy initialization, avoiding the need for intermediate states and unsafe typings for immediately spawned actors:

  ```ts
  const machine = createMachine<{ ref: ActorRef<SomeEvent> }>({
    context: () => ({
      ref: spawn(anotherMachine, 'some-id') // spawn immediately!
    })
    // ...
  });
  ```

## 4.20.2

### Patch Changes

- [`1ef29e83`](https://github.com/statelyai/xstate/commit/1ef29e83e14331083279d50fd3a8907eb63793eb) [#2343](https://github.com/statelyai/xstate/pull/2343) Thanks [@davidkpiano](https://github.com/statelyai)! - Eventless ("always") transitions will no longer be ignored if an event is sent to a machine in a state that does not have any enabled transitions for that event.

## 4.20.1

### Patch Changes

- [`99bc5fb9`](https://github.com/statelyai/xstate/commit/99bc5fb9d1d7be35f4c767dcbbf5287755b306d0) [#2275](https://github.com/statelyai/xstate/pull/2275) Thanks [@davidkpiano](https://github.com/statelyai)! - The `SpawnedActorRef` TypeScript interface has been deprecated in favor of a unified `ActorRef` interface, which contains the following:

  ```ts
  interface ActorRef<TEvent extends EventObject, TEmitted = any>
    extends Subscribable<TEmitted> {
    send: (event: TEvent) => void;
    id: string;
    subscribe(observer: Observer<T>): Subscription;
    subscribe(
      next: (value: T) => void,
      error?: (error: any) => void,
      complete?: () => void
    ): Subscription;
    getSnapshot: () => TEmitted | undefined;
  }
  ```

  For simpler actor-ref-like objects, the `BaseActorRef<TEvent>` interface has been introduced.

  ```ts
  interface BaseActorRef<TEvent extends EventObject> {
    send: (event: TEvent) => void;
  }
  ```

- [`38e6a5e9`](https://github.com/statelyai/xstate/commit/38e6a5e98a1dd54b4f2ef96942180ec0add88f2b) [#2334](https://github.com/statelyai/xstate/pull/2334) Thanks [@davidkpiano](https://github.com/statelyai)! - When using a model type in `createMachine<typeof someModel>(...)`, TypeScript will no longer compile machines that are missing the `context` property in the machine configuration:

  ```ts
  const machine = createMachine<typeof someModel>({
    // missing context - will give a TS error!
    // context: someModel.initialContext,
    initial: 'somewhere',
    states: {
      somewhere: {}
    }
  });
  ```

- [`5f790ba5`](https://github.com/statelyai/xstate/commit/5f790ba5478cb733a59e3b0603e8976c11bcdd04) [#2320](https://github.com/statelyai/xstate/pull/2320) Thanks [@davidkpiano](https://github.com/statelyai)! - The typing for `InvokeCallback` have been improved for better event constraints when using the `sendBack` parameter of invoked callbacks:

  ```ts
  invoke: () => (sendBack, receive) => {
    // Will now be constrained to events that the parent machine can receive
    sendBack({ type: 'SOME_EVENT' });
  };
  ```

- [`2de3ec3e`](https://github.com/statelyai/xstate/commit/2de3ec3e994e0deb5a142aeac15e1eddeb18d1e1) [#2272](https://github.com/statelyai/xstate/pull/2272) Thanks [@davidkpiano](https://github.com/statelyai)! - The `state.meta` value is now calculated directly from `state.configuration`. This is most useful when starting a service from a persisted state:

  ```ts
    const machine = createMachine({
      id: 'test',
      initial: 'first',
      states: {
        first: {
          meta: {
            name: 'first state'
          }
        },
        second: {
          meta: {
            name: 'second state'
          }
        }
      }
    });

    const service = interpret(machine);

    service.start('second'); // `meta` will be computed

    // the state will have
    // meta: {
    //   'test.second': {
    //     name: 'second state'
    //   }
    // }
  });
  ```

## 4.20.0

### Minor Changes

- [`28059b9f`](https://github.com/statelyai/xstate/commit/28059b9f09926d683d80b7d816f5b703c0667a9f) [#2197](https://github.com/statelyai/xstate/pull/2197) Thanks [@davidkpiano](https://github.com/statelyai)! - All spawned and invoked actors now have a `.getSnapshot()` method, which allows you to retrieve the latest value emitted from that actor. That value may be `undefined` if no value has been emitted yet.

  ```js
  const machine = createMachine({
    context: {
      promiseRef: null
    },
    initial: 'pending',
    states: {
      pending: {
        entry: assign({
          promiseRef: () => spawn(fetch(/* ... */), 'some-promise')
        })
      }
    }
  });

  const service = interpret(machine)
    .onTransition((state) => {
      // Read promise value synchronously
      const resolvedValue = state.context.promiseRef?.getSnapshot();
      // => undefined (if promise not resolved yet)
      // => { ... } (resolved data)
    })
    .start();

  // ...
  ```

### Patch Changes

- [`4ef03465`](https://github.com/statelyai/xstate/commit/4ef03465869e27dc878ec600661c9253d90f74f0) [#2240](https://github.com/statelyai/xstate/pull/2240) Thanks [@VanTanev](https://github.com/VanTanev)! - Preserve StateMachine type when .withConfig() and .withContext() modifiers are used on a machine.

## 4.19.2

### Patch Changes

- [`18789aa9`](https://github.com/statelyai/xstate/commit/18789aa94669e48b71e2ae22e524d9bbe9dbfc63) [#2107](https://github.com/statelyai/xstate/pull/2107) Thanks [@woutermont](https://github.com/woutermont)! - This update restricts invoked `Subscribable`s to `EventObject`s,
  so that type inference can be done on which `Subscribable`s are
  allowed to be invoked. Existing `MachineConfig`s that invoke
  `Subscribable<any>`s that are not `Subscribable<EventObject>`s
  should be updated accordingly.

- [`38dcec1d`](https://github.com/statelyai/xstate/commit/38dcec1dad60c62cf8c47c88736651483276ff87) [#2149](https://github.com/statelyai/xstate/pull/2149) Thanks [@davidkpiano](https://github.com/statelyai)! - Invocations and entry actions for _combinatorial_ machines (machines with only a single root state) now behave predictably and will not re-execute upon targetless transitions.

## 4.19.1

### Patch Changes

- [`64ab1150`](https://github.com/statelyai/xstate/commit/64ab1150e0a383202f4af1d586b28e081009c929) [#2173](https://github.com/statelyai/xstate/pull/2173) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with tags not being set correctly after sending an event to a machine that didn't result in selecting any transitions.

## 4.19.0

### Minor Changes

- [`4f2f626d`](https://github.com/statelyai/xstate/commit/4f2f626dc84f45bb18ded6dd9aad3b6f6a2190b1) [#2143](https://github.com/statelyai/xstate/pull/2143) Thanks [@davidkpiano](https://github.com/statelyai)! - Tags can now be added to state node configs under the `.tags` property:

  ```js
  const machine = createMachine({
    initial: 'green',
    states: {
      green: {
        tags: 'go' // single tag
      },
      yellow: {
        tags: 'go'
      },
      red: {
        tags: ['stop', 'other'] // multiple tags
      }
    }
  });
  ```

  You can query whether a state has a tag via `state.hasTag(tag)`:

  ```js
  const canGo = state.hasTag('go');
  // => `true` if in 'green' or 'red' state
  ```

### Patch Changes

- [`a61d01ce`](https://github.com/statelyai/xstate/commit/a61d01cefab5734adf9bfb167291f5b0ba712684) [#2125](https://github.com/statelyai/xstate/pull/2125) Thanks [@VanTanev](https://github.com/VanTanev)! - In callback invokes, the types of `callback` and `onReceive` are properly scoped to the machine TEvent.

## 4.18.0

### Minor Changes

- [`d0939ec6`](https://github.com/statelyai/xstate/commit/d0939ec60161c34b053cecdaeb277606b5982375) [#2046](https://github.com/statelyai/xstate/pull/2046) Thanks [@SimeonC](https://github.com/SimeonC)! - Allow machines to communicate with the inspector even in production builds.

- [`e37fffef`](https://github.com/statelyai/xstate/commit/e37fffefb742f45765945c02727edfbd5e2f9d47) [#2079](https://github.com/statelyai/xstate/pull/2079) Thanks [@davidkpiano](https://github.com/statelyai)! - There is now support for "combinatorial machines" (state machines that only have one state):

  ```js
  const testMachine = createMachine({
    context: { value: 42 },
    on: {
      INC: {
        actions: assign({ value: (ctx) => ctx.value + 1 })
      }
    }
  });
  ```

  These machines omit the `initial` and `state` properties, as the entire machine is treated as a single state.

### Patch Changes

- [`6a9247d4`](https://github.com/statelyai/xstate/commit/6a9247d4d3a39e6c8c4724d3368a13fcdef10907) [#2102](https://github.com/statelyai/xstate/pull/2102) Thanks [@VanTanev](https://github.com/VanTanev)! - Provide a convenience type for getting the `Interpreter` type based on the `StateMachine` type by transferring all generic parameters onto it. It can be used like this: `InterpreterFrom<typeof machine>`

## 4.17.1

### Patch Changes

- [`33302814`](https://github.com/statelyai/xstate/commit/33302814c38587d0044afd2ae61a4ff4779416c6) [#2041](https://github.com/statelyai/xstate/pull/2041) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with creatorless models not being correctly matched by `createMachine`'s overload responsible for using model-induced types.

## 4.17.0

### Minor Changes

- [`7763db8d`](https://github.com/statelyai/xstate/commit/7763db8d3615321d03839b2bd31c9b118ddee50c) [#1977](https://github.com/statelyai/xstate/pull/1977) Thanks [@davidkpiano](https://github.com/statelyai)! - The `schema` property has been introduced to the machine config passed into `createMachine(machineConfig)`, which allows you to provide metadata for the following:

  - Context
  - Events
  - Actions
  - Guards
  - Services

  This metadata can be accessed as-is from `machine.schema`:

  ```js
  const machine = createMachine({
    schema: {
      // Example in JSON Schema (anything can be used)
      context: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'number' },
          baz: {
            type: 'object',
            properties: {
              one: { type: 'string' }
            }
          }
        }
      },
      events: {
        FOO: { type: 'object' },
        BAR: { type: 'object' }
      }
    }
    // ...
  });
  ```

  Additionally, the new `createSchema()` identity function allows any schema "metadata" to be represented by a specific type, which makes type inference easier without having to specify generic types:

  ```ts
  import { createSchema, createMachine } from 'xstate';

  // Both `context` and `events` are inferred in the rest of the machine!
  const machine = createMachine({
    schema: {
      context: createSchema<{ count: number }>(),
      // No arguments necessary
      events: createSchema<{ type: 'FOO' } | { type: 'BAR' }>()
    }
    // ...
  });
  ```

- [`5febfe83`](https://github.com/statelyai/xstate/commit/5febfe83a7e5e866c0a4523ea4f86a966af7c50f) [#1955](https://github.com/statelyai/xstate/pull/1955) Thanks [@davidkpiano](https://github.com/statelyai)! - Event creators can now be modeled inside of the 2nd argument of `createModel()`, and types for both `context` and `events` will be inferred properly in `createMachine()` when given the `typeof model` as the first generic parameter.

  ```ts
  import { createModel } from 'xstate/lib/model';

  const userModel = createModel(
    // initial context
    {
      name: 'David',
      age: 30
    },
    // creators (just events for now)
    {
      events: {
        updateName: (value: string) => ({ value }),
        updateAge: (value: number) => ({ value }),
        anotherEvent: () => ({}) // no payload
      }
    }
  );

  const machine = createMachine<typeof userModel>({
    context: userModel.initialContext,
    initial: 'active',
    states: {
      active: {
        on: {
          updateName: {
            /* ... */
          },
          updateAge: {
            /* ... */
          }
        }
      }
    }
  });

  const nextState = machine.transition(
    undefined,
    userModel.events.updateName('David')
  );
  ```

## 4.16.2

### Patch Changes

- [`4194ffe8`](https://github.com/statelyai/xstate/commit/4194ffe84cfe7910e2c183701e36bc5cac5c9bcc) [#1710](https://github.com/statelyai/xstate/pull/1710) Thanks [@davidkpiano](https://github.com/statelyai)! - Stopping an already stopped interpreter will no longer crash. See [#1697](https://github.com/statelyai/xstate/issues/1697) for details.

## 4.16.1

### Patch Changes

- [`af6b7c70`](https://github.com/statelyai/xstate/commit/af6b7c70015db29d84f79dfd29ea0dc221b8f3e6) [#1865](https://github.com/statelyai/xstate/pull/1865) Thanks [@Andarist](https://github.com/Andarist)! - Improved `.matches(value)` inference for typestates containing union types as values.

## 4.16.0

### Minor Changes

- [`d2e328f8`](https://github.com/statelyai/xstate/commit/d2e328f8efad7e8d3500d39976d1153a26e835a3) [#1439](https://github.com/statelyai/xstate/pull/1439) Thanks [@davidkpiano](https://github.com/statelyai)! - An opt-in `createModel()` helper has been introduced to make it easier to work with typed `context` and events.

  - `createModel(initialContext)` creates a `model` object
  - `model.initialContext` returns the `initialContext`
  - `model.assign(assigner, event?)` creates an `assign` action that is properly scoped to the `event` in TypeScript

  See https://github.com/statelyai/xstate/pull/1439 for more details.

  ```js
  import { createMachine } from 'xstate';
  import { createModel } from 'xstate/lib/model'; // opt-in, not part of main build

  interface UserContext {
    name: string;
    age: number;
  }

  type UserEvents =
    | { type: 'updateName'; value: string }
    | { type: 'updateAge'; value: number }

  const userModel = createModel<UserContext, UserEvents>({
    name: 'David',
    age: 30
  });

  const assignName = userModel.assign({
    name: (_, e) => e.value // correctly typed to `string`
  }, 'updateName'); // restrict to 'updateName' event

  const machine = createMachine<UserContext, UserEvents>({
    context: userModel.context,
    initial: 'active',
    states: {
      active: {
        on: {
          updateName: {
            actions: assignName
          }
        }
      }
    }
  });
  ```

## 4.15.4

### Patch Changes

- [`0cb8df9b`](https://github.com/statelyai/xstate/commit/0cb8df9b6c8cd01ada82afe967bf1015e24e75d9) [#1816](https://github.com/statelyai/xstate/pull/1816) Thanks [@Andarist](https://github.com/Andarist)! - `machine.resolveState(state)` calls should resolve to the correct value of `.done` property now.

## 4.15.3

### Patch Changes

- [`63ba888e`](https://github.com/statelyai/xstate/commit/63ba888e19bd2b72f9aad2c9cd36cde297e0ffe5) [#1770](https://github.com/statelyai/xstate/pull/1770) Thanks [@davidkpiano](https://github.com/statelyai)! - Instead of referencing `window` directly, XState now internally calls a `getGlobal()` function that will resolve to the proper `globalThis` value in all environments. This affects the dev tools code only.

## 4.15.2

### Patch Changes

- [`497c543d`](https://github.com/statelyai/xstate/commit/497c543d2980ea1a277b30b340a7bcd3dd0b3cb6) [#1766](https://github.com/statelyai/xstate/pull/1766) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with events received from callback actors not having the appropriate `_event.origin` set.

## 4.15.1

### Patch Changes

- [`8a8cfa32`](https://github.com/statelyai/xstate/commit/8a8cfa32d99aedf11f4af93ba56fa9ba68925c74) [#1704](https://github.com/statelyai/xstate/pull/1704) Thanks [@blimmer](https://github.com/blimmer)! - The default `clock` methods (`setTimeout` and `clearTimeout`) are now invoked properly with the global context preserved for those invocations which matter for some JS environments. More details can be found in the corresponding issue: [#1703](https://github.com/statelyai/xstate/issues/1703).

## 4.15.0

### Minor Changes

- [`6596d0ba`](https://github.com/statelyai/xstate/commit/6596d0ba163341fc43d214b48115536cb4815b68) [#1622](https://github.com/statelyai/xstate/pull/1622) Thanks [@davidkpiano](https://github.com/statelyai)! - Spawned/invoked actors and interpreters are now typed as extending `ActorRef` (e.g., `SpawnedActorRef`) rather than `Actor` or `Interpreter`. This unification of types should make it more straightforward to provide actor types:

  ```diff
  import {
  - Actor
  + ActorRef
  } from 'xstate';

  // ...

  interface SomeContext {
  - server?: Actor;
  + server?: ActorRef<ServerEvent>;
  }
  ```

  It's also easier to specify the type of a spawned/invoked machine with `ActorRefFrom`:

  ```diff
  import {
    createMachine,
  - Actor
  + ActorRefFrom
  } from 'xstate';

  const serverMachine = createMachine<ServerContext, ServerEvent>({
    // ...
  });

  interface SomeContext {
  - server?: Actor; // difficult to type
  + server?: ActorRefFrom<typeof serverMachine>;
  }
  ```

### Patch Changes

- [`75a91b07`](https://github.com/statelyai/xstate/commit/75a91b078a10a86f13edc9eec3ac1d6246607002) [#1692](https://github.com/statelyai/xstate/pull/1692) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with history state entering a wrong state if the most recent visit in its parent has been caused by a transient transition.

## 4.14.1

### Patch Changes

- [`02c76350`](https://github.com/statelyai/xstate/commit/02c763504da0808eeb281587981a5baf8ba884a1) [#1656](https://github.com/statelyai/xstate/pull/1656) Thanks [@Andarist](https://github.com/Andarist)! - Exit actions will now be properly called when a service gets canceled by calling its `stop` method.

## 4.14.0

### Minor Changes

- [`119db8fb`](https://github.com/statelyai/xstate/commit/119db8fbccd08f899e1275a502d8c4c51b5a130e) [#1577](https://github.com/statelyai/xstate/pull/1577) Thanks [@davidkpiano](https://github.com/statelyai)! - Expressions can now be used in the `stop()` action creator:

  ```js
  // ...
  actions: stop((context) => context.someActor);
  ```

### Patch Changes

- [`8c78e120`](https://github.com/statelyai/xstate/commit/8c78e1205a729d933e30db01cd4260d82352a9be) [#1570](https://github.com/statelyai/xstate/pull/1570) Thanks [@davidkpiano](https://github.com/statelyai)! - The return type of `spawn(machine)` will now be `Actor<State<TContext, TEvent>, TEvent>`, which is a supertype of `Interpreter<...>`.

- [`602687c2`](https://github.com/statelyai/xstate/commit/602687c235c56cca552c2d5a9d78adf224f522d8) [#1566](https://github.com/statelyai/xstate/pull/1566) Thanks [@davidkpiano](https://github.com/statelyai)! - Exit actions will now be properly called when an invoked machine reaches its final state. See [#1109](https://github.com/statelyai/xstate/issues/1109) for more details.

- [`6e44d02a`](https://github.com/statelyai/xstate/commit/6e44d02ad03af4041046120dd6c975e3b5b3772a) [#1553](https://github.com/statelyai/xstate/pull/1553) Thanks [@davidkpiano](https://github.com/statelyai)! - The `state.children` property now properly shows all spawned and invoked actors. See [#795](https://github.com/statelyai/xstate/issues/795) for more details.

- [`72b0880e`](https://github.com/statelyai/xstate/commit/72b0880e6444ae009adca72088872bb5c0760ce3) [#1504](https://github.com/statelyai/xstate/pull/1504) Thanks [@Andarist](https://github.com/Andarist)! - Added `status` property on the `Interpreter` - this can be used to differentiate not started, running and stopped interpreters. This property is best compared to values on the new `InterpreterStatus` export.

## 4.13.0

### Minor Changes

- [`f51614df`](https://github.com/statelyai/xstate/commit/f51614dff760cfe4511c0bc7cca3d022157c104c) [#1409](https://github.com/statelyai/xstate/pull/1409) Thanks [@jirutka](https://github.com/jirutka)! - Fix type `ExtractStateValue` so that it generates a type actually describing a `State.value`

### Patch Changes

- [`b1684ead`](https://github.com/statelyai/xstate/commit/b1684eadb1f859db5c733b8d403afc825c294948) [#1402](https://github.com/statelyai/xstate/pull/1402) Thanks [@Andarist](https://github.com/Andarist)! - Improved TypeScript type-checking performance a little bit by using distributive conditional type within `TransitionsConfigArray` declarations instead of a mapped type. Kudos to [@amcasey](https://github.com/amcasey), some discussion around this can be found [here](https://github.com/microsoft/TypeScript/issues/39826#issuecomment-675790689)

- [`ad3026d4`](https://github.com/statelyai/xstate/commit/ad3026d4309e9a1c719e09fd8c15cdfefce22055) [#1407](https://github.com/statelyai/xstate/pull/1407) Thanks [@tomenden](https://github.com/tomenden)! - Fixed an issue with not being able to run XState in Web Workers due to assuming that `window` or `global` object is available in the executing environment, but none of those are actually available in the Web Workers context.

- [`4e949ec8`](https://github.com/statelyai/xstate/commit/4e949ec856349062352562c825beb0654e528f81) [#1401](https://github.com/statelyai/xstate/pull/1401) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with spawned actors being spawned multiple times when they got spawned in an initial state of a child machine that is invoked in the initial state of a parent machine.

  <details>
  <summary>
  Illustrating example for curious readers.
  </summary>

  ```js
  const child = createMachine({
    initial: 'bar',
    context: {},
    states: {
      bar: {
        entry: assign({
          promise: () => {
            return spawn(() => Promise.resolve('answer'));
          }
        })
      }
    }
  });

  const parent = createMachine({
    initial: 'foo',
    states: {
      foo: {
        invoke: {
          src: child,
          onDone: 'end'
        }
      },
      end: { type: 'final' }
    }
  });

  interpret(parent).start();
  ```

  </details>

## 4.12.0

### Minor Changes

- [`b72e29dd`](https://github.com/statelyai/xstate/commit/b72e29dd728b4c1be4bdeaec93909b4e307db5cf) [#1354](https://github.com/statelyai/xstate/pull/1354) Thanks [@davidkpiano](https://github.com/statelyai)! - The `Action` type was simplified, and as a result, you should see better TypeScript performance.

- [`4dbabfe7`](https://github.com/statelyai/xstate/commit/4dbabfe7d5ba154e852b4d460a2434c6fc955726) [#1320](https://github.com/statelyai/xstate/pull/1320) Thanks [@davidkpiano](https://github.com/statelyai)! - The `invoke.src` property now accepts an object that describes the invoke source with its `type` and other related metadata. This can be read from the `services` option in the `meta.src` argument:

  ```js
  const machine = createMachine(
    {
      initial: 'searching',
      states: {
        searching: {
          invoke: {
            src: {
              type: 'search',
              endpoint: 'example.com'
            }
            // ...
          }
          // ...
        }
      }
    },
    {
      services: {
        search: (context, event, { src }) => {
          console.log(src);
          // => { endpoint: 'example.com' }
        }
      }
    }
  );
  ```

  Specifying a string for `invoke.src` will continue to work the same; e.g., if `src: 'search'` was specified, this would be the same as `src: { type: 'search' }`.

- [`8662e543`](https://github.com/statelyai/xstate/commit/8662e543393de7e2f8a6d92ff847043781d10f4d) [#1317](https://github.com/statelyai/xstate/pull/1317) Thanks [@Andarist](https://github.com/Andarist)! - All `TTypestate` type parameters default to `{ value: any; context: TContext }` now and the parametrized type is passed correctly between various types which results in more accurate types involving typestates.

### Patch Changes

- [`3ab3f25e`](https://github.com/statelyai/xstate/commit/3ab3f25ea297e4d770eef512e9583475c943845d) [#1285](https://github.com/statelyai/xstate/pull/1285) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with initial state of invoked machines being read without custom data passed to them which could lead to a crash when evaluating transient transitions for the initial state.

- [`a7da1451`](https://github.com/statelyai/xstate/commit/a7da14510fd1645ad041836b567771edb5b90827) [#1290](https://github.com/statelyai/xstate/pull/1290) Thanks [@davidkpiano](https://github.com/statelyai)! - The "Attempted to spawn an Actor [...] outside of a service. This will have no effect." warnings are now silenced for "lazily spawned" actors, which are actors that aren't immediately active until the function that creates them are called:

  ```js
  // ⚠️ "active" actor - will warn
  spawn(somePromise);

  // 🕐 "lazy" actor - won't warn
  spawn(() => somePromise);

  // 🕐 machines are also "lazy" - won't warn
  spawn(someMachine);
  ```

  It is recommended that all `spawn(...)`-ed actors are lazy, to avoid accidentally initializing them e.g., when reading `machine.initialState` or calculating otherwise pure transitions. In V5, this will be enforced.

- [`c1f3d260`](https://github.com/statelyai/xstate/commit/c1f3d26069ee70343f8045a48411e02a68f98cbd) [#1317](https://github.com/statelyai/xstate/pull/1317) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a type returned by a `raise` action - it's now `RaiseAction<TEvent> | SendAction<TContext, AnyEventObject, TEvent>` instead of `RaiseAction<TEvent> | SendAction<TContext, TEvent, TEvent>`. This makes it compatible in a broader range of scenarios.

- [`8270d5a7`](https://github.com/statelyai/xstate/commit/8270d5a76c71add3a5109e069bd85716b230b5d4) [#1372](https://github.com/statelyai/xstate/pull/1372) Thanks [@christianchown](https://github.com/christianchown)! - Narrowed the `ServiceConfig` type definition to use a specific event type to prevent compilation errors on strictly-typed `MachineOptions`.

- [`01e3e2dc`](https://github.com/statelyai/xstate/commit/01e3e2dcead63dce3eef5ab745395584efbf05fa) [#1320](https://github.com/statelyai/xstate/pull/1320) Thanks [@davidkpiano](https://github.com/statelyai)! - The JSON definition for `stateNode.invoke` objects will no longer include the `onDone` and `onError` transitions, since those transitions are already merged into the `transitions` array. This solves the issue of reviving a serialized machine from JSON, where before, the `onDone` and `onError` transitions for invocations were wrongly duplicated.

## 4.11.0

### Minor Changes

- [`36ed8d0a`](https://github.com/statelyai/xstate/commit/36ed8d0a3adf5b7fd187b0abe198220398e8b056) [#1262](https://github.com/statelyai/xstate/pull/1262) Thanks [@Andarist](https://github.com/Andarist)! - Improved type inference for `InvokeConfig['data']`. This has required renaming `data` property on `StateNode` instances to `doneData`. This property was never meant to be a part of the public API, so we don't consider this to be a breaking change.

- [`2c75ab82`](https://github.com/statelyai/xstate/commit/2c75ab822e49cb1a23c1e14eb7bd04548ab143eb) [#1219](https://github.com/statelyai/xstate/pull/1219) Thanks [@davidkpiano](https://github.com/statelyai)! - The resolved value of the `invoke.data` property is now available in the "invoke meta" object, which is passed as the 3rd argument to the service creator in `options.services`. This will work for all types of invoked services now, including promises, observables, and callbacks.

  ```js
  const machine = createMachine({
    initial: 'pending',
    context: {
      id: 42
    },
    states: {
      pending: {
        invoke: {
          src: 'fetchUser',
          data: {
            userId: (context) => context.id
          },
          onDone: 'success'
        }
      },
      success: {
        type: 'final'
      }
    }
  },
  {
    services: {
      fetchUser: (ctx, _, { data }) => {
        return fetch(`some/api/user/${data.userId}`)
          .then(response => response.json());
      }
    }
  }
  ```

- [`a6c78ae9`](https://github.com/statelyai/xstate/commit/a6c78ae960acba36b61a41a5d154ea59908010b0) [#1249](https://github.com/statelyai/xstate/pull/1249) Thanks [@davidkpiano](https://github.com/statelyai)! - New property introduced for eventless (transient) transitions: **`always`**, which indicates a transition that is always taken when in that state. Empty string transition configs for [transient transitions](https://xstate.js.org/docs/guides/transitions.html#transient-transitions) are deprecated in favor of `always`:

  ```diff
  // ...
  states: {
    playing: {
  +   always: [
  +     { target: 'win', cond: 'didPlayerWin' },
  +     { target: 'lose', cond: 'didPlayerLose' },
  +   ],
      on: {
        // ⚠️ Deprecation warning
  -     '': [
  -       { target: 'win', cond: 'didPlayerWin' },
  -       { target: 'lose', cond: 'didPlayerLose' },
  -     ]
      }
    }
  }
  // ...
  ```

  The old empty string syntax (`'': ...`) will continue to work until V5.

### Patch Changes

- [`36ed8d0a`](https://github.com/statelyai/xstate/commit/36ed8d0a3adf5b7fd187b0abe198220398e8b056) [#1262](https://github.com/statelyai/xstate/pull/1262) Thanks [@Andarist](https://github.com/Andarist)! - `StateMachine<any, any, any>` is no longer a part of the `InvokeConfig` type, but rather it creates a union with `InvokeConfig` in places where it is needed. This change shouldn't affect consumers' code.

## 4.10.0

### Minor Changes

- [`0133954`](https://github.com/statelyai/xstate/commit/013395463b955e950ab24cb4be51faf524b0de6e) [#1178](https://github.com/statelyai/xstate/pull/1178) Thanks [@davidkpiano](https://github.com/statelyai)! - The types for the `send()` and `sendParent()` action creators have been changed to fix the issue of only being able to send events that the machine can receive. In reality, a machine can and should send events to other actors that it might not be able to receive itself. See [#711](https://github.com/statelyai/xstate/issues/711) for more information.

- [`a1f1239`](https://github.com/statelyai/xstate/commit/a1f1239e20e05e338ed994d031e7ef6f2f09ad68) [#1189](https://github.com/statelyai/xstate/pull/1189) Thanks [@davidkpiano](https://github.com/statelyai)! - Previously, `state.matches(...)` was problematic because it was casting `state` to `never` if it didn't match the state value. This is now fixed by making the `Typestate` resolution more granular.

- [`dbc6a16`](https://github.com/statelyai/xstate/commit/dbc6a161c068a3e12dd12452b68a66fe3f4fb8eb) [#1183](https://github.com/statelyai/xstate/pull/1183) Thanks [@davidkpiano](https://github.com/statelyai)! - Actions from a restored state provided as a custom initial state to `interpret(machine).start(initialState)` are now executed properly. See #1174 for more information.

### Patch Changes

- [`a10d604`](https://github.com/statelyai/xstate/commit/a10d604a6afcf39048b02be5436acdd197f16c2b) [#1176](https://github.com/statelyai/xstate/pull/1176) Thanks [@itfarrier](https://github.com/itfarrier)! - Fix passing state schema into State generic

- [`326db72`](https://github.com/statelyai/xstate/commit/326db725e50f7678af162626c6c7491e4364ec07) [#1185](https://github.com/statelyai/xstate/pull/1185) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with invoked service not being correctly started if other service got stopped in a subsequent microstep (in response to raised or null event).

- [`c3a496e`](https://github.com/statelyai/xstate/commit/c3a496e1f92ec27db0643fd1ddc32d683db4e751) [#1160](https://github.com/statelyai/xstate/pull/1160) Thanks [@davidkpiano](https://github.com/statelyai)! - Delayed transitions defined using `after` were previously causing a circular dependency when the machine was converted using `.toJSON()`. This has now been fixed.

- [`e16e48e`](https://github.com/statelyai/xstate/commit/e16e48e05e6243a3eacca58a13d3e663cd641f55) [#1153](https://github.com/statelyai/xstate/pull/1153) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `choose` and `pure` not being able to use actions defined in options.

- [`d496ecb`](https://github.com/statelyai/xstate/commit/d496ecb11b26011f2382d1ce6c4433284a7b3e9b) [#1165](https://github.com/statelyai/xstate/pull/1165) Thanks [@davidkpiano](https://github.com/statelyai)! - XState will now warn if you define an `.onDone` transition on the root node. Root nodes which are "done" represent the machine being in its final state, and can no longer accept any events. This has been reported as confusing in [#1111](https://github.com/statelyai/xstate/issues/1111).

## 4.9.1

### Patch Changes

- [`8a97785`](https://github.com/statelyai/xstate/commit/8a97785055faaeb1b36040dd4dc04e3b90fa9ec2) [#1137](https://github.com/statelyai/xstate/pull/1137) Thanks [@davidkpiano](https://github.com/statelyai)! - Added docs for the `choose()` and `pure()` action creators, as well as exporting the `pure()` action creator in the `actions` object.

- [`e65dee9`](https://github.com/statelyai/xstate/commit/e65dee928fea60df1e9f83c82fed8102dfed0000) [#1131](https://github.com/statelyai/xstate/pull/1131) Thanks [@wKovacs64](https://github.com/wKovacs64)! - Include the new `choose` action in the `actions` export from the `xstate` core package. This was missed in v4.9.0.

## 4.9.0

### Minor Changes

- [`f3ff150`](https://github.com/statelyai/xstate/commit/f3ff150f7c50f402704d25cdc053b76836e447e3) [#1103](https://github.com/statelyai/xstate/pull/1103) Thanks [@davidkpiano](https://github.com/statelyai)! - Simplify the `TransitionConfigArray` and `TransitionConfigMap` types in order to fix excessively deep type instantiation TypeScript reports. This addresses [#1015](https://github.com/statelyai/xstate/issues/1015).

- [`6c47b66`](https://github.com/statelyai/xstate/commit/6c47b66c3289ff161dc96d9b246873f55c9e18f2) [#1076](https://github.com/statelyai/xstate/pull/1076) Thanks [@Andarist](https://github.com/Andarist)! - Added support for conditional actions. It's possible now to have actions executed based on conditions using following:

  ```js
  entry: [
    choose([
      { cond: (ctx) => ctx > 100, actions: raise('TOGGLE') },
      {
        cond: 'hasMagicBottle',
        actions: [assign((ctx) => ({ counter: ctx.counter + 1 }))]
      },
      { actions: ['fallbackAction'] }
    ])
  ];
  ```

  It works very similar to the if-else syntax where only the first matched condition is causing associated actions to be executed and the last ones can be unconditional (serving as a general fallback, just like else branch).

### Patch Changes

- [`1a129f0`](https://github.com/statelyai/xstate/commit/1a129f0f35995981c160d756a570df76396bfdbd) [#1073](https://github.com/statelyai/xstate/pull/1073) Thanks [@Andarist](https://github.com/Andarist)! - Cleanup internal structures upon receiving termination events from spawned actors.

- [`e88aa18`](https://github.com/statelyai/xstate/commit/e88aa18431629e1061b74dfd4a961b910e274e0b) [#1085](https://github.com/statelyai/xstate/pull/1085) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with data expressions of root's final nodes being called twice.

- [`88b17b2`](https://github.com/statelyai/xstate/commit/88b17b2476ff9a0fbe810df9d00db32c2241cd6e) [#1090](https://github.com/statelyai/xstate/pull/1090) Thanks [@rjdestigter](https://github.com/rjdestigter)! - This change carries forward the typestate type information encoded in the arguments of the following functions and assures that the return type also has the same typestate type information:

  - Cloned state machine returned by `.withConfig`.
  - `.state` getter defined for services.
  - `start` method of services.

- [`d5f622f`](https://github.com/statelyai/xstate/commit/d5f622f68f4065a2615b5a4a1caae6b508b4840e) [#1069](https://github.com/statelyai/xstate/pull/1069) Thanks [@davidkpiano](https://github.com/statelyai)! - Loosened event type for `SendAction<TContext, AnyEventObject>`

## 4.8.0

### Minor Changes

- [`55aa589`](https://github.com/statelyai/xstate/commit/55aa589648a9afbd153e8b8e74cbf2e0ebf573fb) [#960](https://github.com/statelyai/xstate/pull/960) Thanks [@davidkpiano](https://github.com/statelyai)! - The machine can now be safely JSON-serialized, using `JSON.stringify(machine)`. The shape of this serialization is defined in `machine.schema.json` and reflected in `machine.definition`.

  Note that `onEntry` and `onExit` have been deprecated in the definition in favor of `entry` and `exit`.

### Patch Changes

- [`1ae31c1`](https://github.com/statelyai/xstate/commit/1ae31c17dc81fb63e699b4b9bf1cf4ead023001d) [#1023](https://github.com/statelyai/xstate/pull/1023) Thanks [@Andarist](https://github.com/Andarist)! - Fixed memory leak - `State` objects had been retained in closures.

## 4.7.8

### Patch Changes

- [`520580b`](https://github.com/statelyai/xstate/commit/520580b4af597f7c83c329757ae972278c2d4494) [#967](https://github.com/statelyai/xstate/pull/967) Thanks [@andrewgordstewart](https://github.com/andrewgordstewart)! - Add context & event types to InvokeConfig

## 4.7.7

### Patch Changes

- [`c8db035`](https://github.com/statelyai/xstate/commit/c8db035b90a7ab4a557359d493d3dd7973dacbdd) [#936](https://github.com/statelyai/xstate/pull/936) Thanks [@davidkpiano](https://github.com/statelyai)! - The `escalate()` action can now take in an expression, which will be evaluated against the `context`, `event`, and `meta` to return the error data.

- [`2a3fea1`](https://github.com/statelyai/xstate/commit/2a3fea18dcd5be18880ad64007d44947cc327d0d) [#952](https://github.com/statelyai/xstate/pull/952) Thanks [@davidkpiano](https://github.com/statelyai)! - The typings for the raise() action have been fixed to allow any event to be raised. This typed behavior will be refined in version 5, to limit raised events to those that the machine accepts.

- [`f86d419`](https://github.com/statelyai/xstate/commit/f86d41979ed108e2ac4df63299fc16f798da69f7) [#957](https://github.com/statelyai/xstate/pull/957) Thanks [@Andarist](https://github.com/Andarist)! - Fixed memory leak - each created service has been registered in internal map but it was never removed from it. Registration has been moved to a point where Interpreter is being started and it's deregistered when it is being stopped.

## 4.7.6

### Patch Changes

- dae8818: Typestates are now propagated to interpreted services.

## 4.7.5

### Patch Changes

- 6b3d767: Fixed issue with delayed transitions scheduling a delayed event for each transition defined for a single delay.

## 4.7.4

### Patch Changes

- 9b043cd: The initial state is now cached inside of the service instance instead of the machine, which was the previous (faulty) strategy. This will prevent entry actions on initial states from being called more than once, which is important for ensuring that actors are not spawned more than once.

## 4.7.3

### Patch Changes

- 2b134eee: Fixed issue with events being forwarded to children after being processed by the current machine. Events are now always forwarded first.
- 2b134eee: Fixed issue with not being able to spawn an actor when processing an event batch.
