import { ActionTypes, InvokeActionObject, ActorRef } from './types.ts';

export const CapturedState = {
  current: {
    actorRef: undefined as ActorRef<any, any> | undefined,
    spawns: [] as InvokeActionObject[]
  }
};

export function captureSpawn(actorRef: ActorRef<any, any>, name: string) {
  CapturedState.current.spawns.push({
    type: ActionTypes.Invoke,
    params: {
      src: actorRef,
      ref: actorRef,
      id: name,
      meta: undefined
    }
  });

  return actorRef;
}

export function flushSpawns() {
  const { current } = CapturedState;
  const flushed = current.spawns;
  current.spawns = [];
  return flushed;
}
