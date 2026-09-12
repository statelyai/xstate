import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import {
  PropertyTestFailure,
  propertyTest,
  type PropertySut
} from 'xstate/graph';
import {
  fastCheckAdapter,
  getCurrentScheduler,
  withScheduledSut,
  type FastCheckSchedulerReport
} from '../src/index.ts';

const counterMachine = createMachine({
  id: 'counter',
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{}>() }
  },
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } })
  }
});

/**
 * A counter whose write is committed on a scheduler task instead of inline, so
 * a read may or may not observe the write depending on the ordering the
 * scheduler picks.
 */
const racyCounterSut: PropertySut<any, any> = {
  create: () => {
    const scheduler = getCurrentScheduler();
    let committed = 0;
    let pending = 0;
    return {
      send: (event) => {
        if (event.type !== 'INC') {
          return;
        }
        pending += 1;
        const next = pending;
        const commit = scheduler
          ? scheduler.schedule(Promise.resolve(), 'commit')
          : Promise.resolve();
        void commit.then(() => {
          committed = next;
        });
      },
      read: () => committed
    };
  },
  projectModel: (snapshot) => snapshot.context.count
};

describe('scheduled property runs', () => {
  it('finds an ordering where the SUT read races the write', async () => {
    let failure: PropertyTestFailure | undefined;
    try {
      await propertyTest(counterMachine, {
        adapter: fastCheckAdapter({
          seed: 7,
          numRuns: 50,
          maxCommands: 6,
          scheduler: true
        }),
        events: { INC: fc.constant({}) },
        sut: withScheduledSut(racyCounterSut),
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    const report = (
      failure!.replay?.data as { scheduler: FastCheckSchedulerReport }
    ).scheduler;
    expect(report.ordering.length).toBeGreaterThan(0);
    expect(report.tasks.some((task) => task.label === 'commit')).toBe(true);
    expect(report.tasks.every((task) => typeof task.taskId === 'number')).toBe(
      true
    );
  });

  it('reports the schedule of the failing run, not of a later passing one', async () => {
    let failure: PropertyTestFailure | undefined;
    try {
      await propertyTest(counterMachine, {
        adapter: fastCheckAdapter({
          seed: 7,
          numRuns: 50,
          maxCommands: 6,
          scheduler: true
        }),
        events: { INC: fc.constant({}) },
        sut: withScheduledSut(racyCounterSut),
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    const report = (
      failure!.replay?.data as { scheduler: FastCheckSchedulerReport }
    ).scheduler;
    const sentEvents = failure!.trace.timeline.filter(
      (entry) => entry.kind === 'event'
    ).length;
    // One `commit` task per `INC` the counterexample sent: a report captured
    // from a later, passing shrink candidate would not line up.
    expect(report.tasks.filter((task) => task.label === 'commit').length).toBe(
      sentEvents
    );
  });

  it('passes for a SUT that commits before resolving', async () => {
    await propertyTest(counterMachine, {
      adapter: fastCheckAdapter({
        seed: 7,
        numRuns: 25,
        maxCommands: 6,
        scheduler: true
      }),
      events: { INC: fc.constant({}) },
      sut: withScheduledSut({
        create: () => {
          let count = 0;
          return {
            send: (event) => {
              if (event.type === 'INC') {
                count += 1;
              }
            },
            read: () => count
          };
        },
        projectModel: (snapshot: any) => snapshot.context.count
      }),
      invariant: () => {}
    });
  });

  it('leaves runs unscheduled when the option is off', async () => {
    let observed: unknown;
    await propertyTest(counterMachine, {
      adapter: fastCheckAdapter({ seed: 7, numRuns: 5, maxCommands: 3 }),
      events: { INC: fc.constant({}) },
      sut: withScheduledSut({
        create: () => {
          observed = getCurrentScheduler();
          let count = 0;
          return {
            send: (event) => {
              if (event.type === 'INC') {
                count += 1;
              }
            },
            read: () => count
          };
        },
        projectModel: (snapshot: any) => snapshot.context.count
      }),
      invariant: () => {}
    });
    expect(observed).toBeUndefined();
  });
});
