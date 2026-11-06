import { normalizeEvent, normalizeId, toJson } from './normalize.ts';
import type { Recorder, Stats, StepRecord } from './types.ts';

/** Action params can hold whole `args` objects; record only their top levels. */
const ACTION_PARAMS_DEPTH = 4;

const empty = (): StepRecord => ({
  processed: [],
  sent: [],
  emitted: [],
  actions: []
});

/**
 * v6 inspection: `@xstate.actor` (`id`, `src`, `parentRef`) and
 * `@xstate.transition` (`event`, `snapshot`, `actions[]`, `sent[]`).
 */
export function createRecorder6(stats: Stats): Recorder {
  let root: unknown;
  let rootSnapshot: any;
  let bucket = empty();
  const registry = new Map<unknown, string>();

  // Delayed raises arrive as `xstate.timer` keyed by `{ event }`, `{ seq }` or
  // `{ id }`; resolve them against the timers of the snapshot that scheduled
  // them so the trace shows the delivered event, as in v5. A delayed send to
  // another actor shows up in that firing transition's `sent` instead.
  function onTimer(event: any): void {
    if (event.event) {
      bucket.processed.push(normalizeEvent(event.event, stats));
      return;
    }
    const timer = rootSnapshot?.timers?.find((t: any) =>
      event.id !== undefined ? t.id === event.id : t.seq === event.seq
    );
    if (timer && (timer.target === 'self' || timer.target === root)) {
      bucket.processed.push(normalizeEvent(timer.event, stats));
    }
  }

  return {
    setRoot: (ref) => {
      root = ref;
    },
    inspect(e) {
      if (e.type === '@xstate.actor') {
        registry.set(
          e.actorRef,
          typeof e.src === 'string' ? e.src : '(inline)'
        );
        return;
      }
      if (e.type !== '@xstate.transition' || e.actorRef !== root) return;
      const type: string = e.event.type;
      if (type === 'xstate.timer') onTimer(e.event);
      else if (type !== 'xstate.init')
        bucket.processed.push(normalizeEvent(e.event, stats));
      for (const action of e.actions) {
        if (
          action.type.startsWith('xstate.') ||
          action.type.startsWith('@xstate.')
        )
          continue;
        bucket.actions.push({
          type: action.type,
          params:
            toJson(action.params, stats, undefined, ACTION_PARAMS_DEPTH) ?? null
        });
      }
      for (const sent of e.sent) {
        // v5 reports a delayed send when it is delivered; so does the timer's
        // firing transition here.
        if (sent.targetRef === root || sent.delay !== undefined) continue;
        bucket.sent.push({
          to: normalizeId(sent.targetId),
          event: normalizeEvent(sent.event, stats)
        });
      }
      rootSnapshot = e.snapshot;
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
