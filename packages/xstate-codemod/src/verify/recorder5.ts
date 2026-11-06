import { normalizeEvent, normalizeId, toJson } from './normalize.ts';
import type { Recorder, Stats, StepRecord } from './types.ts';

const empty = (): StepRecord => ({
  processed: [],
  sent: [],
  emitted: [],
  actions: []
});

/**
 * v5 inspection: `@xstate.snapshot` (one per processed event), `@xstate.event`
 * (relays; `sourceRef` → `actorRef`), `@xstate.actor`, `@xstate.action`.
 */
export function createRecorder5(stats: Stats): Recorder {
  let root: unknown;
  let bucket = empty();
  const registry = new Map<unknown, string>();
  return {
    setRoot: (ref) => {
      root = ref;
    },
    inspect(e) {
      switch (e.type) {
        case '@xstate.actor':
          registry.set(
            e.actorRef,
            typeof e.actorRef.src === 'string' ? e.actorRef.src : '(inline)'
          );
          break;
        case '@xstate.snapshot':
          if (e.actorRef === root && e.event.type !== 'xstate.init') {
            bucket.processed.push(normalizeEvent(e.event, stats));
          }
          break;
        case '@xstate.event':
          if (
            e.sourceRef === root &&
            e.actorRef !== root &&
            e.event.type !== 'xstate.init' &&
            e.event.type !== 'xstate.stop'
          ) {
            bucket.sent.push({
              to: normalizeId(e.actorRef.id),
              event: normalizeEvent(e.event, stats)
            });
          }
          break;
        case '@xstate.action':
          if (e.actorRef === root && !e.action.type.startsWith('xstate.')) {
            bucket.actions.push({
              type: e.action.type,
              params: toJson(e.action.params, stats) ?? null
            });
          }
          break;
      }
    },
    emit(event) {
      bucket.emitted.push(normalizeEvent(event, stats));
    },
    srcOf: (ref) => registry.get(ref) ?? '(inline)',
    take() {
      const taken = bucket;
      bucket = empty();
      return taken;
    }
  };
}
