import { Data, Effect } from 'effect';
import { createEffectActor, fromEffect, join } from '@xstate/effect';

class PublishFailed extends Data.TaggedError('PublishFailed')<{
  readonly reason: string;
}> {}

const publish = fromEffect(
  Effect.fail(new PublishFailed({ reason: 'Release needs approval' }))
);

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(publish);
  return yield* join(actor).pipe(
    Effect.catchTag('PublishFailed', (error) => Effect.succeed(error.reason))
  );
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 'Release needs approval'
