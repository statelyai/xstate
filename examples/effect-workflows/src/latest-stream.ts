import { Effect, Option, Stream } from 'effect';
import { createEffectActor, fromEffectStream, snapshots } from '@xstate/effect';

// Demo upload progress. Replace with your upload SDK's progress stream.
const uploadProgress = fromEffectStream(Stream.make(0, 25, 60, 100));

const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(uploadProgress);
  return yield* snapshots(actor).pipe(
    Stream.filter((s) => s.context !== undefined),
    Stream.map((s) => s.context),
    Stream.runLast,
    Effect.map(Option.getOrThrow)
  );
});

export const result = await Effect.runPromise(Effect.scoped(program));
console.log(result); // 100
