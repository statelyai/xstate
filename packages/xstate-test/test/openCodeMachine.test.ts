import { describe, expect, it } from 'vitest';
import type { SnapshotFrom } from 'xstate';
import {
  ModelTestFailureError,
  replayTest,
  testPaths,
  type TestFixture
} from '../src/index.ts';
import { createCodeModeDriver } from './openCodeDriver.ts';
import { codeModeCases, codeModeMachine } from './openCodeMachine.ts';
import { checkCodeMode, observe } from './openCodeSpec.ts';

type CodeModeSnapshot = SnapshotFrom<typeof codeModeMachine>;

const sut = {
  create: () => createCodeModeDriver(),
  projectModel: (snapshot: CodeModeSnapshot) => observe(snapshot.context)
};

describe('OpenCode with an XState machine', () => {
  it('runs the full protocol against the driver', async () => {
    const { coverage, results } = await testPaths(codeModeMachine, {
      cases: codeModeCases,
      invariant: ({ snapshot }) => checkCodeMode(snapshot.context),
      sut
    });

    expect(coverage.exploration.pathGenerator).toBe('edges');
    expect(coverage.eventTypes.covered).toEqual(
      expect.arrayContaining(['ctrlB', 'tick10s', 'approve', 'reject', 'esc'])
    );
    expect(
      results.some(
        ({ path }) =>
          path.state.context.scripts.length === 2 &&
          path.state.context.scripts.every(
            (script) => script.kind === 'background'
          )
      )
    ).toBe(true);
  });

  it.each(['ctrlB', 'tick10s'])(
    'detects a broken %s handoff',
    async (trigger) => {
      await expect(
        testPaths(codeModeMachine, {
          cases: codeModeCases,
          sut: {
            ...sut,
            create: () => {
              const driver = createCodeModeDriver();
              return {
                ...driver,
                send: (event) => {
                  if (event.type !== trigger) {
                    return driver.send(event);
                  }
                }
              };
            }
          }
        }).then(() => 'passed')
      ).rejects.toMatchObject({
        trace: {
          events: [
            { type: 'init', fullCodemode: true },
            { type: 'startExecute' },
            { type: trigger }
          ],
          finalObservation: {
            sut: {
              model: expect.objectContaining({ backgroundJobs: [0] }),
              observed: expect.objectContaining({ backgroundJobs: [] })
            }
          }
        }
      });
    }
  );

  it('ignores premature approval when the probe is enabled', async () => {
    const options = {
      cases: codeModeCases,
      checkUnhandled: {
        approve: ({ snapshot, event }) => {
          const script = snapshot.context.scripts[event.script];
          return script?.kind === 'foreground' && script.progress === 'running';
        }
      },
      sut
    } satisfies Parameters<typeof testPaths<typeof codeModeMachine>>[1];

    const { results } = await testPaths(codeModeMachine, options);
    expect(
      results.some(({ path }) => {
        const last = path.steps.at(-1);
        return (
          last?.event.type === 'approve' &&
          last.state.context.scripts[last.event.script]?.kind ===
            'foreground' &&
          path.steps.at(-2)?.event.type === 'startExecute'
        );
      })
    ).toBe(true);

    await expect(
      testPaths(codeModeMachine, {
        ...options,
        sut: {
          ...sut,
          create: () => {
            const driver = createCodeModeDriver();
            return {
              ...driver,
              send: (event) => {
                if (
                  event.type === 'approve' &&
                  !driver.read().pendingPermissions.includes(event.script)
                ) {
                  return driver.send({
                    type: 'finishScript',
                    script: event.script
                  });
                }
                return driver.send(event);
              }
            };
          }
        }
      }).then(() => 'passed')
    ).rejects.toMatchObject({
      trace: {
        events: [
          { type: 'init', fullCodemode: true },
          { type: 'startExecute' },
          { type: 'approve', script: 0 }
        ],
        finalObservation: {
          sut: {
            model: expect.objectContaining({
              toolResults: [{ status: 'running' }]
            }),
            observed: expect.objectContaining({
              toolResults: [{ status: 'completed', value: 'ok' }]
            })
          }
        }
      }
    });
  });

  it('replays a duplicate notice against the faulty and fixed drivers', async () => {
    const faulty = {
      ...sut,
      create: () => createCodeModeDriver({ duplicateNotice: true })
    };
    const failure = await testPaths(codeModeMachine, {
      cases: codeModeCases,
      sut: faulty
    }).catch((error: unknown) => error);
    if (!(failure instanceof ModelTestFailureError) || !failure.fixture) {
      throw new Error('Expected a duplicate notice failure with a fixture');
    }
    const fixture: TestFixture = JSON.parse(JSON.stringify(failure.fixture));
    const notice = { script: 0, output: 'ok' };
    const disagreement = {
      trace: {
        finalObservation: {
          sut: {
            model: expect.objectContaining({ deliveredNotices: [notice] }),
            observed: expect.objectContaining({
              deliveredNotices: [notice, notice]
            })
          }
        }
      }
    };
    expect(failure).toMatchObject(disagreement);
    await expect(
      replayTest(codeModeMachine, fixture, { sut: faulty })
    ).rejects.toMatchObject(disagreement);
    await expect(
      replayTest(codeModeMachine, fixture, { sut, expect: 'pass' })
    ).resolves.toMatchObject({
      finalObservation: {
        sut: {
          observed: expect.objectContaining({ deliveredNotices: [notice] })
        }
      }
    });
  });
});
