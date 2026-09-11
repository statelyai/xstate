import { createMachine, initialTransition, types } from '../../index.ts';
import {
  PropertyTestFailure,
  propertyTest,
  replayPropertyTest,
  type PortablePropertyReplayFixture
} from '../index.ts';
import { constant, randomAdapter } from './propertyTestAdapter.ts';

const counterMachine = createMachine({
  id: 'counter',
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{ value: number }>() }
  },
  context: { count: 0 },
  on: {
    INC: ({ context, event }) => ({
      context: { count: context.count + event.value }
    })
  }
});

const failingInvariant = ({ snapshot }: { snapshot: any }) => {
  expect(snapshot.context.count).toBeLessThan(5);
};

/**
 * A hand-written `formatVersion: 1` fixture, mirroring what
 * `normalizeFixtureTimeline` migrates into a v2 timeline.
 */
const legacyFixture = {
  formatVersion: 1,
  machine: { id: 'counter' },
  start: { type: 'input', input: undefined },
  prefixEvents: [],
  events: [{ type: 'INC', value: 5 }],
  failedAt: 1
} as const;

describe('replayPropertyTest', () => {
  it('replays a v2 fixture produced by a failing property test', async () => {
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(counterMachine, {
        adapter: randomAdapter({ seed: 1, numRuns: 5, maxCommands: 2 }),
        events: { INC: constant({ value: 5 }) },
        invariant: failingInvariant
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }
    expect(failure.fixture).toMatchObject({ formatVersion: 2 });

    const replayed = (await replayPropertyTest(
      counterMachine,
      failure.fixture!,
      { invariant: failingInvariant }
    ).catch((error) => error)) as PropertyTestFailure;

    expect(replayed).toBeInstanceOf(PropertyTestFailure);
    expect(replayed.trace.steps).toHaveLength(failure.trace.steps.length);
  });

  it('migrates a formatVersion 1 fixture', async () => {
    const replayed = (await replayPropertyTest(counterMachine, legacyFixture, {
      invariant: failingInvariant
    }).catch((error) => error)) as PropertyTestFailure;

    expect(replayed).toBeInstanceOf(PropertyTestFailure);
    expect(replayed.trace.steps).toHaveLength(1);
    expect(replayed.trace.steps[0].phase).toBe('generated');
    expect(replayed.trace.steps[0].event).toEqual({ type: 'INC', value: 5 });
  });

  it('migrates prefix events from a formatVersion 1 fixture', async () => {
    const replayed = (await replayPropertyTest(
      counterMachine,
      {
        ...legacyFixture,
        prefixEvents: [{ type: 'INC', value: 3 }],
        events: [{ type: 'INC', value: 3 }],
        failedAt: 2
      },
      { invariant: failingInvariant }
    ).catch((error) => error)) as PropertyTestFailure;

    expect(replayed).toBeInstanceOf(PropertyTestFailure);
    expect(replayed.trace.prefixEvents).toEqual([{ type: 'INC', value: 3 }]);
    expect(replayed.trace.events).toEqual([{ type: 'INC', value: 3 }]);
  });

  it('rejects a fixture recorded against another machine id', async () => {
    await expect(
      replayPropertyTest(
        counterMachine,
        { ...legacyFixture, machine: { id: 'other' } },
        { invariant: () => {} }
      )
    ).rejects.toThrow(
      'Property replay fixture targets machine "other", received "counter"'
    );
  });

  it('rejects a fixture recorded against another machine version', async () => {
    await expect(
      replayPropertyTest(
        counterMachine,
        { ...legacyFixture, machine: { id: 'counter', version: '2.0.0' } },
        { invariant: () => {} }
      )
    ).rejects.toThrow(
      'Property replay fixture targets machine version "2.0.0", received "(unversioned)"'
    );
  });

  it('requires `restoreSnapshot` when the fixture starts from a snapshot', async () => {
    const [snapshot] = initialTransition(counterMachine);
    const fixture: PortablePropertyReplayFixture = {
      formatVersion: 2,
      machine: { id: 'counter' },
      start: { type: 'snapshot', snapshot: snapshot.toJSON() },
      timeline: [],
      failedAt: 0
    };

    await expect(
      replayPropertyTest(counterMachine, fixture, { invariant: () => {} })
    ).rejects.toThrow(
      'Property replay fixture contains a snapshot but no restoreSnapshot function was provided'
    );
  });

  it('throws when the replay does not reproduce the recorded failure', async () => {
    await expect(
      replayPropertyTest(counterMachine, legacyFixture, {
        invariant: () => {}
      })
    ).rejects.toThrow(
      'Property replay did not reproduce the recorded failure at step 1'
    );
  });
});
