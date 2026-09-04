// Positive fixture: every `enq`/`enqueue` call below must be reported.
import { Effect } from 'effect';
import { fromEffect, fromEffectStream } from '../../src/index.ts';

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

export function inlineSpawnEnq() {
  enq.spawn(fromEffect(Effect.succeed('inline')));
}

export function inlineSpawnEnqueue() {
  enqueue.spawn(fromEffectStream(Effect.succeed('inline') as any));
}
