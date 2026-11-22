import { describe, expect, it } from 'vitest';
import {
  createTestModel,
  ModelTestFailureError,
  type TestFixture
} from '../src/paths.ts';
import { createCodeModeDriver } from './openCodeDriver.ts';
import { createCodeModeModel } from './openCodeModel.ts';

describe('standalone test models', () => {
  it('executes exact choices with shared destinations and self-loops', async () => {
    const ids = [0, 9, 20, 70, 99];
    const model = createTestModel({
      initial: () => -1,
      choices: (state) =>
        (state === -1 ? ids : [100]).map((id) => ({ type: 'select', id })),
      step: () => 0,
      observe: (state) => state
    });

    const reached: number[] = [];
    await model.test({
      sut: () => {
        let selected = -1;
        return {
          send: (event) => {
            selected = 0;
            reached.push(event.id);
          },
          read: () => selected
        };
      }
    });

    expect(reached).toEqual([...ids, ids[0], 100]);
  });

  it('checks the two-script model with and without a healthy driver', async () => {
    const model = createCodeModeModel();
    const { results } = await model.test();
    expect(
      results.some(
        ({ path }) =>
          path.state.context.scripts.every(
            (script) => script.kind === 'background'
          ) && path.state.context.scripts.length === 2
      )
    ).toBe(true);
    const { coverage } = await model.test({ sut: createCodeModeDriver });
    expect(coverage.sutComparisons).toBeGreaterThan(0);
  });

  it.each(['ctrlB', 'tick10s'])(
    'catches a missing %s handoff',
    async (trigger) => {
      const model = createCodeModeModel();

      await expect(
        model.test({
          sut: () => {
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
        })
      ).rejects.toMatchObject({
        summary: expect.stringContaining('observation diverged'),
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

  it('catches two foreground blockers without a driver', async () => {
    await expect(
      createCodeModeModel({ allowTwoForeground: true }).test()
    ).rejects.toMatchObject({
      message: expect.stringContaining('codemode.single-foreground-blocker'),
      trace: {
        events: [
          { type: 'init', fullCodemode: true },
          { type: 'startExecute' },
          { type: 'startExecute' }
        ]
      }
    });
  });

  it('replays a duplicate notice from a JSON fixture', async () => {
    const model = createCodeModeModel();
    const sut = () => createCodeModeDriver({ duplicateNotice: true });
    const failure = await model.test({ sut }).catch((error: unknown) => error);
    if (!(failure instanceof ModelTestFailureError) || !failure.fixture) {
      throw new Error('Expected an observation failure with a replay fixture', {
        cause: failure
      });
    }

    const notice = { script: 0, output: 'ok' };
    const disagreement = {
      summary: expect.stringContaining('observation diverged'),
      trace: {
        events: [
          { type: 'init', fullCodemode: true },
          { type: 'startExecute' },
          { type: 'tick10s' },
          { type: 'finishScript', script: 0 }
        ],
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

    const fixture: TestFixture = JSON.parse(JSON.stringify(failure.fixture));
    await expect(model.replay(fixture, { sut })).rejects.toMatchObject(
      disagreement
    );
    await expect(
      model.replay(fixture, { sut: createCodeModeDriver, expect: 'pass' })
    ).resolves.toMatchObject({
      finalObservation: {
        sut: {
          observed: expect.objectContaining({ deliveredNotices: [notice] })
        }
      }
    });
  });
});
