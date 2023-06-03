import {
  AnyActorLogic,
  AnyStateMachine,
  EventFromLogic,
  InternalStateFrom,
} from '.';

export function simulate<T extends AnyActorLogic>(
  actorLogic: T,
  options: { input?: any } = {}
) {
  const dummyActorContext: any = {
    self: {}
  };

  const sim = {
    transition: (
      state: InternalStateFrom<T> = actorLogic.getInitialState(
        dummyActorContext,
        options.input
      ),
      event: EventFromLogic<T>
    ): InternalStateFrom<T> => {
      return actorLogic.transition(state, event, dummyActorContext);
    },
    getInitialState: () => {
      return actorLogic.getInitialState(dummyActorContext, options.input);
    },
    microstep: (
      state: InternalStateFrom<T> = actorLogic.getInitialState(
        dummyActorContext,
        options.input
      ),
      event: EventFromLogic<T>
    ): Array<InternalStateFrom<T>> => {
      return (
        'microstep' in actorLogic
          ? (actorLogic as unknown as AnyStateMachine).microstep(
              state,
              event,
              dummyActorContext
            )
          : [sim.transition(state, event)]
      ) as Array<InternalStateFrom<T>>;
    }
  };

  return sim;
}
