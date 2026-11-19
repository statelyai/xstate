import { Clock, Effect } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';
import { createMachine, types } from 'xstate';
import { createEffectActor, sendAndAwait } from './index.ts';

const machine = createMachine({
  schemas: {
    context: types<{ expired: string[] }>(),
    events: {
      START: types<{ id: string; label: string }>(),
      CANCEL: types<{}>()
    },
    internalEvents: { EXPIRE: types<{ label: string }>() }
  },
  context: { expired: [] },
  on: {
    START: ({ event }, enq) => {
      enq.raise(
        { type: 'EXPIRE', label: event.label },
        { id: event.id, delay: 100 }
      );
    },
    CANCEL: (_, enq) => enq.cancel('shared'),
    EXPIRE: ({ context, event }) => ({
      context: { expired: [...context.expired, event.label] }
    })
  }
});

function replaceAtExpiry(replacementId: string, beforeFiring = false) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const clock = yield* Clock.Clock;
      let beforeExpiry: (() => void) | undefined;
      const timerClock: Clock.Clock = Object.create(clock);
      timerClock.sleep = (duration) =>
        Effect.tap(clock.sleep(duration), () =>
          Effect.sync(() => {
            const enqueue = beforeExpiry;
            beforeExpiry = undefined;
            enqueue?.();
          })
        );
      const actor = yield* createEffectActor(machine).pipe(
        Effect.provideService(Clock.Clock, timerClock)
      );
      yield* sendAndAwait(actor, {
        type: 'START',
        id: 'shared',
        label: 'original'
      });
      const order: string[] = [];
      actor.inspect((inspection) => {
        if (inspection.type === '@xstate.transition')
          order.push(inspection.event.type);
      });
      // Enqueue both commands before the real Effect timer offers its firing.
      beforeExpiry = () => {
        actor.send({ type: 'CANCEL' });
        actor.send({ type: 'START', id: replacementId, label: 'replacement' });
      };
      if (beforeFiring) {
        beforeExpiry = undefined;
        yield* sendAndAwait(actor, { type: 'CANCEL' });
        yield* sendAndAwait(actor, {
          type: 'START',
          id: replacementId,
          label: 'replacement'
        });
      } else {
        yield* TestClock.adjust(100);
      }
      const firstDeadline = [...order];
      const afterReplacement = actor.getSnapshot().context.expired;
      yield* TestClock.adjust(99);
      const beforeDeadline = actor.getSnapshot().context.expired;
      yield* TestClock.adjust(1);
      return {
        firstDeadline,
        afterReplacement,
        beforeDeadline,
        atDeadline: actor.getSnapshot().context.expired
      };
    }).pipe(Effect.scoped, Effect.provide(TestClock.layer()))
  );
}

describe('queued Effect timer firings', () => {
  const expected = {
    firstDeadline: ['CANCEL', 'START', 'xstate.timer'],
    afterReplacement: [],
    beforeDeadline: [],
    atDeadline: ['replacement']
  };

  it('cancels before firing and permits reuse of the ID', async () => {
    const { firstDeadline: _, ...timing } = await replaceAtExpiry(
      'shared',
      true
    );
    expect(timing).toEqual({
      afterReplacement: [],
      beforeDeadline: [],
      atDeadline: ['replacement']
    });
  });

  it('ignores a queued firing when the replacement has a different ID', async () => {
    expect(await replaceAtExpiry('different')).toEqual(expected);
  });

  it('ignores a queued firing when the replacement reuses the ID', async () => {
    const { firstDeadline: _, ...timing } = await replaceAtExpiry('shared');
    expect(timing).toEqual({
      afterReplacement: [],
      beforeDeadline: [],
      atDeadline: ['replacement']
    });
  });
});
