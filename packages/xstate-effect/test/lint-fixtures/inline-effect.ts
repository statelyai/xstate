// Positive fixture: every `enq`/`enqueue` call below must be reported.
import { Effect } from 'effect';
import { createEffectLogic, createEffectStreamLogic } from '../../src/index.ts';

declare const enq: any;
declare const enqueue: any;

export function inlineActionArrow() {
  enq(() => Effect.log('saved'));
}

export function inlineActionBlock() {
  enqueue(() => {
    return Effect.sync(() => {});
  });
}

export function inlineActionPromiseWrapped() {
  enqueue(() => Promise.resolve(Effect.succeed('ok')));
}

export function inlineSpawnEnq() {
  enq.spawn(createEffectLogic(Effect.succeed('inline')));
}

export function inlineSpawnEnqueue() {
  enqueue.spawn(createEffectStreamLogic(Effect.succeed('inline') as any));
}
