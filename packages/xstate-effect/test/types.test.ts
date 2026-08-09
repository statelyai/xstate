import { Context, Effect } from 'effect';
import { setup } from 'xstate';
import {
  type EffectActorError,
  fromEffect,
  runActor,
  type EffectActorArgs,
  type RequirementsFrom
} from '../src/index.ts';

const Repository = Context.Service<{ get: (id: string) => string }>(
  'types/Repository'
);

class RepositoryError {
  readonly _tag = 'RepositoryError';
}

it('preserves A, E, and R at the runner boundary', () => {
  const worker = fromEffect(({ input }: EffectActorArgs<{ id: string }>) =>
    Effect.gen(function* () {
      const repository = yield* Repository;
      if (!input.id) {
        return yield* Effect.fail(new RepositoryError());
      }
      return repository.get(input.id);
    })
  );
  const program = runActor(worker, { input: { id: '42' } });

  expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<string>();
  expectTypeOf<Effect.Error<typeof program>>().toEqualTypeOf<RepositoryError>();
  expectTypeOf<Effect.Services<typeof program>>().toEqualTypeOf<
    typeof Repository.Service
  >();
});

it('collects requirements from Effect actors provided to a machine', () => {
  const worker = fromEffect(() =>
    Effect.gen(function* () {
      const repository = yield* Repository;
      return repository.get('42');
    })
  );
  const machine = setup({ actors: { worker } }).createMachine({
    invoke: { src: 'worker' }
  });

  expectTypeOf<RequirementsFrom<typeof machine>>().toEqualTypeOf<
    typeof Repository.Service
  >();
  expectTypeOf<
    Effect.Services<ReturnType<typeof runActor<typeof machine>>>
  >().toEqualTypeOf<typeof Repository.Service>();
});

it('types an invoked Effect actor error locally', () => {
  const worker = fromEffect(() => Effect.fail(new RepositoryError()));

  setup({ actors: { worker } }).createMachine({
    invoke: {
      src: 'worker',
      onError: ({ event }) => {
        expectTypeOf(event.error).toEqualTypeOf<
          EffectActorError<RepositoryError>
        >();
      }
    }
  });
});
