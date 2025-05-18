import { AnyActorScope, createEmptyActor } from '../src';

export function createMockActorScope(): AnyActorScope {
  const emptyActor = createEmptyActor();
  return {
    self: emptyActor,
    logger: console.log,
    id: '',
    sessionId: Math.random().toString(32).slice(2),
    defer: () => {},
    system: emptyActor.system, // TODO: mock system?
    stopChild: () => {},
    emit: () => {},
    actionExecutor: () => {}
  };
}
