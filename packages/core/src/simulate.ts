import {
  AnyActorContext,
  AnyActorLogic,
  AnyStateMachine,
  EventFromLogic,
  InternalStateFrom
} from '.';
import { createEmptyActor } from './actors';

function createMockActorContext(): AnyActorContext {
  const emptyActor = createEmptyActor();
  return {
    self: emptyActor,
    logger: console.log,
    id: 'root_test',
    sessionId: Math.random().toString(32).slice(2),
    defer: () => {},
    system: emptyActor,
    stopChild: () => {}
  };
}

export function simulate<T extends AnyActorLogic>(
  actorLogic: T,
  options: { input?: any } = {}
) {
  const dummyActorContext = createMockActorContext();

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
