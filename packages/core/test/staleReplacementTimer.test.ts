import { restoreActor } from '../src/persist/index.ts';
import { test } from 'vitest';
import {
  createActor,
  createMachine,
  initialTransition,
  transition,
  type ActorSystemRuntime,
  SimulatedClock,
  types,
  type TimerKey,
  type AnyActor
} from '../src/index.ts';

function run(
  replacementId: string,
  fireWhileQueued: boolean,
  delivery: 'raise' | 'sendTo' = 'raise',
  restored = false
) {
  const clock = new SimulatedClock();
  let actor: AnyActor;
  const machine = createMachine({
    schemas: {
      context: types<{ expired: string[] }>(),
      events: {
        START: types<{ id: string; label: string }>(),
        CANCEL: types<{}>(),
        REPLACE: types<{}>()
      },
      internalEvents: { EXPIRE: types<{ label: string }>() }
    },
    context: { expired: [] },
    on: {
      START: ({ event }, enq) => {
        const expired: { type: 'EXPIRE'; label: string } = {
          type: 'EXPIRE',
          label: event.label
        };
        const options = { id: event.id, delay: 100 };
        if (delivery === 'raise') enq.raise(expired, options);
        else enq.sendTo(actor, expired, options);
      },
      CANCEL: (_, enq) => enq.cancel('shared'),
      EXPIRE: ({ context, event }) => ({
        context: { expired: [...context.expired, event.label] }
      }),
      REPLACE: (_, enq) =>
        enq(() => {
          // A running action keeps the actor's mailbox busy. The real native
          // scheduler callback queues its notification behind these two sends.
          actor.send({ type: 'CANCEL' });
          actor.send({
            type: 'START',
            id: replacementId,
            label: 'replacement'
          });
          if (fireWhileQueued) clock.increment(100);
        })
    }
  });
  actor = createActor(machine, { clock }).start();
  try {
    actor.send({ type: 'START', id: 'shared', label: 'original' });
    if (restored) {
      const persisted = actor.getPersistedSnapshot();
      actor.stop();
      actor = restoreActor(machine, persisted, { clock }).start();
    }
    actor.send({ type: 'REPLACE' });
    const beforeDeadline = [...actor.getSnapshot().context.expired];
    clock.increment(99);
    expect(actor.getSnapshot().context.expired).toEqual(beforeDeadline);
    clock.increment(1);
    expect(actor.getSnapshot().context.expired).toEqual(['replacement']);
    return beforeDeadline;
  } finally {
    actor.stop();
  }
}

test('control: cancelling before firing permits reuse of the id', () => {
  expect(run('shared', false)).toEqual([]);
});

test('control: a queued notification cannot fire a different id', () => {
  expect(run('different', true)).toEqual([]);
});

test('a queued notification must not fire a replacement with the same id', () => {
  expect(run('shared', true)).toEqual([]);
});

test('a queued delayed send cannot fire a replacement early', () => {
  expect(run('shared', true, 'sendTo')).toEqual([]);
});

test('a stale built-in firing cannot consume a same-tick reentry timer', () => {
  const scheduled: TimerKey[] = [];
  const machine = createMachine({
    initial: 'waiting',
    states: {
      waiting: {
        after: { 100: { target: 'done' } },
        on: { RESTART: { target: 'waiting', reenter: true } }
      },
      done: {}
    }
  });
  const runtime: Partial<ActorSystemRuntime> = {
    scheduleTimer: (_source, key) => {
      scheduled.push(key);
    },
    cancelTimer: () => {}
  };
  const [initial, initialEffects] = initialTransition(machine);
  initialEffects.forEach((effect) => effect.exec(runtime));
  const [restarted, restartEffects] = transition(machine, initial, {
    type: 'RESTART'
  });
  restartEffects.forEach((effect) => effect.exec(runtime));
  expect(scheduled).toHaveLength(2);
  expect(scheduled[0].occurrence).not.toBe(scheduled[1].occurrence);
  const [ignored] = transition(machine, restarted, {
    type: 'xstate.timer',
    ...scheduled[0]
  });
  expect(ignored.value).toBe('waiting');
  const [completed] = transition(machine, ignored, {
    type: 'xstate.timer',
    ...scheduled[1]
  });
  expect(completed.value).toBe('done');
});

test('a restored native timer cannot fire a replacement raise early', () => {
  expect(run('shared', true, 'raise', true)).toEqual([]);
});

test('a restored native timer cannot fire a replacement send early', () => {
  expect(run('shared', true, 'sendTo', true)).toEqual([]);
});
