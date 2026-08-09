import { Cause, Context, Effect, Exit, Layer } from 'effect';
import { setup } from 'xstate';
import {
  EffectActorDefect,
  fromEffect,
  runActor,
  spawnActor,
  type EffectActorArgs
} from '../src/index.ts';

const UserRepository = Context.Service<{
  getUser: (id: string) => string;
}>('test/UserRepository');

class UserError {
  readonly _tag = 'UserError';
  constructor(readonly message: string) {}
}

describe('@xstate/effect', () => {
  it('runs an Effect actor with Layer requirements and XState inspection', async () => {
    const inspections: string[] = [];
    const logic = fromEffect(({ input }: EffectActorArgs<{ id: string }>) =>
      Effect.gen(function* () {
        const repository = yield* UserRepository;
        return repository.getUser(input.id);
      })
    );

    const output = await Effect.runPromise(
      runActor(logic, {
        input: { id: '42' },
        inspect: (event) => inspections.push(event.type)
      }).pipe(
        Effect.provide(
          Layer.succeed(UserRepository, {
            getUser: (id) => `user:${id}`
          })
        )
      )
    );

    expect(output).toBe('user:42');
    expect(inspections).toContain('@xstate.actor');
    expect(inspections).toContain('@xstate.transition');
  });

  it('preserves checked Effect failures', async () => {
    const error = new UserError('not found');
    const logic = fromEffect(() => Effect.fail(error));
    const exit = await Effect.runPromiseExit(runActor(logic));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.squash(exit.cause)).toBe(error);
    }
  });

  it('retains defects as causes', async () => {
    const defect = new Error('broken');
    const logic = fromEffect(() => Effect.die(defect));
    const exit = await Effect.runPromiseExit(runActor(logic));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.squash(exit.cause)).toBe(defect);
    }
  });

  it('interrupts the Fiber and awaits its finalizer when the scope closes', async () => {
    let finalizers = 0;
    const logic = fromEffect(() =>
      Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            finalizers++;
          })
        )
      )
    );

    await Effect.runPromise(
      Effect.scoped(spawnActor(logic).pipe(Effect.asVoid))
    );

    expect(finalizers).toBe(1);
  });

  it('interrupts an invoked Effect actor on state exit', async () => {
    let finalizers = 0;
    const worker = fromEffect(() =>
      Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            finalizers++;
          })
        )
      )
    );
    const machine = setup({ actors: { worker } }).createMachine({
      initial: 'working',
      states: {
        working: {
          invoke: { src: 'worker' },
          on: { CANCEL: { target: 'cancelled' } }
        },
        cancelled: { type: 'final' }
      }
    });

    await Effect.runPromise(
      Effect.scoped(
        spawnActor(machine).pipe(
          Effect.tap((actor) =>
            Effect.sync(() => actor.send({ type: 'CANCEL' }))
          ),
          Effect.asVoid
        )
      )
    );

    expect(finalizers).toBe(1);
  });

  it('exports the defect wrapper for parent-machine error handling', () => {
    const cause = Cause.die('broken');
    expect(new EffectActorDefect(cause).cause).toBe(cause);
  });
});
