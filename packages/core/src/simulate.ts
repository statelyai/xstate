import type {
  AnyActorContext,
  AnyActorLogic,
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
      state: InternalStateFrom<T>,
      event: EventFromLogic<T>
    ): InternalStateFrom<T> => {
      return actorLogic.transition(state, event, dummyActorContext);
    },
    getInitialState: (input = options.input) => {
      return actorLogic.getInitialState(dummyActorContext, input);
    },
    actorContext: dummyActorContext
  };

  return sim;
}
