---
'xstate': minor
---

Added exports for actor logic-specific `ActorRef` types: `CallbackActorRef`, `ObservableActorRef`, `PromiseActorRef`, and `TransitionActorRef`.

Each type represents `ActorRef` narrowed to the corresponding type of logic. This narrowed type is the type of the actor's `self` within its logic:

- `CallbackActorRef`: actor created by `fromCallback`

  ```ts
  import { fromCallback, createActor } from 'xstate';

  /** The type of events the actor receives. */
  type Event = { type: 'someEvent' } | { type: 'someOtherEvent' };
  /** The actor's input. */
  type Input = { name: string };

  const logic = fromCallback<Event, Input>(({ self, input, receive }) => {
    self;
    // ^? CallbackActorRef<Event, Input>

    receive((event) => {
      if (event.type === 'someEvent') {
        console.log(`${input.name}: received "someEvent" event`);
        // logs 'myActor: received "someEvent" event'
      }
    });
  });

  const actor = createActor(logic, { input: { name: 'myActor' } });
  //    ^? CallbackActorRef<Event, Input>
  ```

- `ObservableActorRef`: actor created by `fromObservable` and `fromEventObservable`

  ```ts
  import { fromObservable, createActor } from 'xstate';
  import { interval } from 'rxjs';

  /** The type observed by the actor's logic. */
  type Context = number;
  type Input = { period?: number };

  const logic = fromObservable<Context, Input>(({ input, self }) => {
    self;
    // ^? ObservableActorRef<Event, Input>
    return interval(input.period);
  });

  const actor = createActor(logic, { input: { period: 2_000 } });
  //    ^? ObservableActorRef<Event, Input>
  ```

- `PromiseActorRef`: actor created by `fromPromise`
- `TransitionActorRef`
