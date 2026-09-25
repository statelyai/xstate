import {
  createActor,
  createMachine,
  createSystem,
  type EventRejection
} from '../src/index.ts';

const reported: unknown[] = [];

// mocked reportUnhandledError due to unknown issue with vitest and global error
// handlers not catching thrown errors
// see: https://github.com/vitest-dev/vitest/issues/6292
vi.mock('../src/reportUnhandledError.ts', () => {
  return {
    reportUnhandledError: (err: unknown) => {
      reported.push(err);
    }
  };
});

const machine = createMachine({});

function stoppedActor(options?: Parameters<typeof createActor>[1]) {
  const actor = createActor(machine, options).start();
  actor.stop();
  return actor;
}

describe('system.onRejectedEvent', () => {
  beforeEach(() => {
    reported.length = 0;
  });

  it('delivers a rejection to every listener in registration order', () => {
    const calls: string[] = [];
    const rejections: EventRejection[] = [];
    const actor = stoppedActor();

    actor.system.onRejectedEvent((rejection) => {
      calls.push('first');
      rejections.push(rejection);
    });
    actor.system.onRejectedEvent((rejection) => {
      calls.push('second');
      rejections.push(rejection);
    });

    actor.send({ type: 'PING' });

    expect(calls).toEqual(['first', 'second']);
    expect(rejections[0]).toBe(rejections[1]);
    expect(rejections[0]).toMatchObject({
      event: { type: 'PING' },
      targetRef: actor,
      eventOrigin: 'external',
      reason: 'stopped'
    });
  });

  it('stops delivering after unsubscribe', () => {
    const rejections: EventRejection[] = [];
    const actor = stoppedActor();

    const subscription = actor.system.onRejectedEvent((rejection) =>
      rejections.push(rejection)
    );
    actor.send({ type: 'ONE' });
    subscription.unsubscribe();
    actor.send({ type: 'TWO' });

    expect(rejections.map((r) => r.event.type)).toEqual(['ONE']);
  });

  it('keeps delivering to later listeners when one throws', () => {
    const error = new Error('listener failed');
    const rejections: EventRejection[] = [];
    const actor = stoppedActor();

    actor.system.onRejectedEvent(() => {
      throw error;
    });
    actor.system.onRejectedEvent((rejection) => rejections.push(rejection));

    actor.send({ type: 'PING' });

    expect(rejections).toHaveLength(1);
    expect(reported).toEqual([error]);
  });

  it('registers the createActor onRejectedEvent option as a listener', () => {
    const calls: string[] = [];
    const actor = stoppedActor({
      onRejectedEvent: () => calls.push('option')
    });
    actor.system.onRejectedEvent(() => calls.push('late'));

    actor.send({ type: 'PING' });

    expect(calls).toEqual(['option', 'late']);
  });

  it('is exposed on createSystem before the first actor exists', () => {
    const rejections: EventRejection[] = [];
    const system = createSystem();
    system.onRejectedEvent((rejection) => rejections.push(rejection));

    const actor = system.createActor(machine).start();
    actor.stop();
    actor.send({ type: 'PING' });

    expect(rejections.map((r) => r.event.type)).toEqual(['PING']);
  });
});
