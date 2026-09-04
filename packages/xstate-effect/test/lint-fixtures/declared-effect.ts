// Negative fixture: nothing here may be reported.
import { Effect } from 'effect';

declare const enq: any;
declare const enqueue: any;
declare const args: any;
declare const track: (value: string) => void;

export function declaredAction() {
  enq(args.actions.audit, args);
}

export function declaredSpawn() {
  enq.spawn(args.actors.leaf);
  enqueue.spawn(args.actors.leaf);
}

export function inlineActionWithoutEffect() {
  enq(() => {
    track('saved');
  });
}

export function inlineActionReturningNonEffect() {
  enqueue(() => Promise.resolve(Effect.succeed('ok')));
}
