import { Effect, Latch } from 'effect';
import { TestClock } from 'effect/testing';
import { createEffectActor, send, waitFor } from '@xstate/effect';
import { approvalMachine, Deployments } from '../src/approval.ts';

it('expires an unanswered approval without calling the deployment service', async () => {
  const deploy = vi.fn(() => Effect.succeed('url'));
  const program = Effect.gen(function* () {
    const actor = yield* createEffectActor(approvalMachine, {
      input: { release: 'v2' }
    });
    yield* TestClock.adjust('30 seconds');
    const snapshot = yield* waitFor(actor, (s) => s.matches('expired'));
    expect(snapshot.status).toBe('done');
  });
  await Effect.runPromise(
    program.pipe(
      Effect.scoped,
      Effect.provideService(Deployments, { deploy }),
      Effect.provide(TestClock.layer())
    )
  );
  expect(deploy).not.toHaveBeenCalled();
});

it('cancels a running deployment and interrupts its Effect', async () => {
  let interrupted = false;
  const started = Latch.makeUnsafe();
  const program = Effect.gen(function* () {
    const actor = yield* createEffectActor(approvalMachine, {
      input: { release: 'v2' }
    });
    yield* send(actor, { type: 'APPROVE' });
    yield* started.await;
    yield* send(actor, { type: 'CANCEL' });
    yield* waitFor(actor, (s) => s.matches('cancelled'));
  });
  await Effect.runPromise(
    program.pipe(
      Effect.scoped,
      Effect.provideService(Deployments, {
        deploy: () =>
          Effect.gen(function* () {
            yield* started.open;
            return yield* Effect.never;
          }).pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted = true;
              })
            )
          )
      })
    )
  );
  expect(interrupted).toBe(true);
});

it('waits for an explicit retry after deployment fails', async () => {
  let attempts = 0;
  const program = Effect.gen(function* () {
    const actor = yield* createEffectActor(approvalMachine, {
      input: { release: 'v2' }
    });
    yield* send(actor, { type: 'APPROVE' });
    yield* waitFor(actor, (s) => s.matches('failed'));
    expect(attempts).toBe(1);
    yield* send(actor, { type: 'APPROVE' });
    yield* send(actor, { type: 'RETRY' });
    const done = yield* waitFor(actor, (s) => s.matches('deployed'));
    expect(done.context.url).toBe('https://example.com/v2');
  });
  await Effect.runPromise(
    program.pipe(
      Effect.scoped,
      Effect.provideService(Deployments, {
        deploy: (release) =>
          Effect.suspend(() => {
            attempts++;
            return attempts === 1
              ? Effect.fail(new Error('Unavailable'))
              : Effect.succeed(`https://example.com/${release}`);
          })
      })
    )
  );
  expect(attempts).toBe(2);
});

it('closing the enclosing scope interrupts active work', async () => {
  let interrupted = false;
  const started = Latch.makeUnsafe();
  const program = Effect.gen(function* () {
    const actor = yield* createEffectActor(approvalMachine, {
      input: { release: 'v2' }
    });
    yield* send(actor, { type: 'APPROVE' });
    yield* started.await;
    return actor;
  });
  const actor = await Effect.runPromise(
    program.pipe(
      Effect.scoped,
      Effect.provideService(Deployments, {
        deploy: () =>
          Effect.gen(function* () {
            yield* started.open;
            return yield* Effect.never;
          }).pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted = true;
              })
            )
          )
      })
    )
  );
  expect(actor.getSnapshot().status).toBe('stopped');
  expect(interrupted).toBe(true);
});
