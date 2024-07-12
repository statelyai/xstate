---
'xstate': minor
---

Added exports for actor logic-specific `ActorRef` types: `CallbackActorRef`, `ObservableActorRef`, `PromiseActorRef`, and `TransitionActorRef`.

Each type represents `ActorRef` narrowed to the corresponding type of logic (the type of `self` within the actor's logic):

- `CallbackActorRef`: actor created by [ `fromCallback`](https://stately.ai/docs/actors#fromcallback)

  ```ts
  import { fromCallback, createActor } from 'xstate';

  /** The events the actor receives. */
  type Event = { type: 'someEvent' };
  /** The actor's input. */
  type Input = { name: string };

  /** Actor logic that logs whenever it receives an event of type `someEvent`. */
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

- `ObservableActorRef`: actor created by [`fromObservable`](https://stately.ai/docs/actors#fromobservable) and [`fromEventObservable`](https://stately.ai/docs/actors#fromeventobservable)

  ```ts
  import { fromObservable, createActor } from 'xstate';
  import { interval } from 'rxjs';

  /** The type of the value observed by the actor's logic. */
  type Context = number;
  /** The actor's input. */
  type Input = { period?: number };

  /**
   * Actor logic that observes a number incremented every `input.period`
   * milliseconds (default: 1_000).
   */
  const logic = fromObservable<Context, Input>(({ input, self }) => {
    self;
    // ^? ObservableActorRef<Event, Input>

    return interval(input.period ?? 1_000);
  });

  const actor = createActor(logic, { input: { period: 2_000 } });
  //    ^? ObservableActorRef<Event, Input>
  ```

- `PromiseActorRef`: actor created by [`fromPromise`](https://stately.ai/docs/actors#actors-as-promises)

  ```ts
  import { fromPromise, createActor } from 'xstate';

  /** The actor's resolved output. */
  type Output = string;
  /** The actor's input. */
  type Input = { message: string };

  /** Actor logic that fetches the url of an image of a cat saying `input.message`. */
  const logic = fromPromise<Output, Input>(async ({ input, self }) => {
    self;
    // ^? PromiseActorRef<Output, Input>

    const data = await fetch(`https://cataas.com/cat/says/${input.message}`);
    const url = await data.json();
    return url;
  });

  const actor = createActor(logic, { input: { message: 'hello world' } });
  //    ^? PromiseActorRef<Output, Input>
  ```

- `TransitionActorRef`: actor created by [`fromTransition`](https://stately.ai/docs/actors#fromtransition)

  ```ts
  import { fromTransition, createActor, type AnyActorSystem } from 'xstate';

  /** The actor's stored context. */
  type Context = {
    /** The current count. */
    count: number;
    /** The amount to increase `count` by. */
    step: number;
  };
  /** The events the actor receives. */
  type Event = { type: 'increment' };
  /** The actor's input. */
  type Input = { step?: number };

  /**
   * Actor logic that increments `count` by `step` when it receives an event of
   * type `increment`.
   */
  const logic = fromTransition<Context, Event, AnyActorSystem, Input>(
    (state, event, actorScope) => {
      actorScope.self;
      //         ^? TransitionActorRef<Context, Event>

      if (event.type === 'increment') {
        return {
          ...state,
          count: state.count + state.step
        };
      }
      return state;
    },
    ({ input, self }) => {
      self;
      // ^? TransitionActorRef<Context, Event>

      return {
        count: 0,
        step: input.step ?? 1
      };
    }
  );

  const actor = createActor(logic, { input: { step: 10 } });
  //    ^? TransitionActorRef<Context, Event>
  ```
