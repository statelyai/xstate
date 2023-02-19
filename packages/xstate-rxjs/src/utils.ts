import { ActorRef, Interpreter } from 'xstate';

export function getServiceSnapshot<
  TService extends Interpreter<any, any, any, any>
>(service: TService): TService['state'] {
  return service.status !== 0
    ? service.getSnapshot()
    : service.machine.initialState;
}

export function isService(
  actor: any
): actor is Interpreter<any, any, any, any> {
  return 'state' in actor && 'machine' in actor;
}
export function isActorWithState<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { state: any } {
  return 'state' in actorRef;
}

export function defaultGetSnapshot<TEmitted>(
  actorRef: ActorRef<any, TEmitted>
): TEmitted {
  return 'getSnapshot' in actorRef
    ? isService(actorRef)
      ? getServiceSnapshot(actorRef as any)
      : actorRef.getSnapshot()
    : isActorWithState(actorRef)
    ? actorRef.state
    : undefined;
}
