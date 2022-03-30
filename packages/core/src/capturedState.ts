import { ActionTypes, ActorRef } from './types';
import { start, toActivityDefinition } from './actions';
import { createDeferredActor } from './Actor';

export const CapturedState = {
  current: {
    actorRef: undefined as ActorRef<any, any> | undefined,
    spawns: [] as any[]
  }
};

export function captureSpawn(
  deferred: ReturnType<typeof createDeferredActor>,
  entity: any
) {
  const name = deferred.actorRef.id;
  CapturedState.current.spawns.push(
    start(
      toActivityDefinition({
        id: name,
        type: ActionTypes.Spawn,
        deferred,
        entity
      })
    )
  );
}

export function flushSpawns() {
  const { current } = CapturedState;
  const flushed = current.spawns;
  current.spawns = [];
  return flushed;
}
