import { Cause, Effect, Scope } from 'effect';
import { createAsyncLogic, createMachine } from 'xstate';
import { createEffectActor, waitFor } from './index.ts';

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) =>
  Effect.runPromise(Effect.scoped(effect));

const traffic = createMachine({
  context: { count: 0 },
  initial: 'running',
  states: {
    running: {
      after: { 5: { target: 'expired' } },
      on: {
        TICK: ({ context, self }, enq) => {
          if (context.count < 1500) enq.sendTo(self, { type: 'TICK' });
          return { context: { count: context.count + 1 } };
        }
      }
    },
    expired: {}
  }
});

const childTraffic = createMachine({
  context: { count: 0 },
  initial: 'running',
  states: {
    running: {
      after: { 5: { target: 'expired' } },
      initial: 'idle',
      states: {
        idle: { on: { TICK: { target: 'working' } } },
        working: {
          invoke: {
            src: createAsyncLogic({ run: () => Promise.resolve() }),
            onDone: ({ context }) => ({
              target: context.count < 1500 ? 'working' : 'idle',
              reenter: true,
              context: { count: context.count + 1 }
            })
          }
        }
      }
    },
    expired: {}
  }
});

describe('actor scheduling fairness', () => {
  it.each([
    { elapsed: 9, expectedOrder: [1, 2, 3, 'host'] },
    { elapsed: 10, expectedOrder: [1, 'host', 2, 3] }
  ])(
    'orders a short burst with $elapsed ms elapsed',
    async ({ elapsed, expectedOrder }) => {
      let now = 0;
      const hostClock = vi
        .spyOn(performance, 'now')
        .mockImplementation(() => now);
      try {
        const burst = createMachine({
          context: { count: 0 },
          on: {
            TICK: ({ context, self }, enq) => {
              if (context.count < 2) enq.sendTo(self, { type: 'TICK' });
              return { context: { count: context.count + 1 } };
            }
          }
        });
        await run(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(burst);
            const order: (number | 'host')[] = [];
            actor.subscribe((snapshot) => {
              order.push(snapshot.context.count);
              now = elapsed;
            });
            const hostTurn = new Promise<void>((resolve) => {
              setImmediate(() => {
                order.push('host');
                resolve();
              });
            });
            actor.send({ type: 'TICK' });
            yield* waitFor(actor, (state) => state.context.count === 3);
            yield* Effect.promise(() => hostTurn);
            expect(order).toEqual(expectedOrder);
          })
        );
      } finally {
        hostClock.mockRestore();
      }
    }
  );

  it('fires an after timer during continuous internal traffic', async () => {
    await run(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(traffic);
        actor.send({ type: 'TICK' });
        const snapshot = yield* waitFor(
          actor,
          (state) => state.matches('expired'),
          { timeout: '2 seconds' }
        );
        expect(snapshot.context.count).toBeGreaterThan(0);
        expect(
          snapshot.context.count,
          'after timer fired only after traffic ended'
        ).toBeLessThan(1501);
      })
    );
  });

  it.each([
    ['self-sends', traffic],
    ['child replies', childTraffic]
  ] as const)(
    'fires an after timer during %s with a frozen host clock',
    async (_description, machine) => {
      const now = vi.spyOn(performance, 'now').mockReturnValue(0);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        await run(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(machine);
            actor.send({ type: 'TICK' });
            yield* waitFor(actor, (state) => state.context.count > 0);
            // Make the after timer due on the next real host turn.
            const turn = setImmediate(() => vi.advanceTimersByTime(5));
            try {
              const snapshot = yield* waitFor(actor, (state) =>
                state.matches('expired')
              );
              expect(snapshot.context.count).toBeLessThan(1501);
            } finally {
              clearImmediate(turn);
            }
          })
        );
      } finally {
        vi.useRealTimers();
        now.mockRestore();
      }
    }
  );

  it('lets Effect.timeout fire during continuous internal traffic', async () => {
    const endless = createMachine({
      context: { count: 0 },
      on: {
        TICK: ({ context, self }, enq) => {
          if (context.count < 1500) enq.sendTo(self, { type: 'TICK' });
          return { context: { count: context.count + 1 } };
        }
      }
    });
    await run(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(endless);
        actor.send({ type: 'TICK' });
        const error = yield* Effect.flip(
          Effect.never.pipe(Effect.timeout('5 millis'))
        );
        expect(error).toBeInstanceOf(Cause.TimeoutError);
        expect(actor.getSnapshot().context.count).toBeGreaterThan(0);
        expect(
          actor.getSnapshot().context.count,
          'Effect.timeout fired only after traffic ended'
        ).toBeLessThan(1501);
      })
    );
  });
});
