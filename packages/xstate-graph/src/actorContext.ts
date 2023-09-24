import { AnyActorContext, createEmptyActor } from 'xstate';

export function createMockActorContext(): AnyActorContext {
  const emptyActor = createEmptyActor();
  return {
    self: emptyActor,
    logger: console.log,
    id: '',
    sessionId: Math.random().toString(32).slice(2),
    defer: () => {},
    system: emptyActor,
    stopChild: () => {}
  };
}
