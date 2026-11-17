import {
  runOnHost,
  createJournal
} from '../../../examples/durable-execution/src/host.ts';
import { createMachine, types } from '../src/index.ts';

const machine = createMachine({
  schemas: {
    events: { REPLACE: types<{}>() },
    internalEvents: { EXPIRE: types<{}>() }
  },
  initial: 'waiting',
  states: {
    waiting: {
      entry: (_, enq) =>
        enq.raise({ type: 'EXPIRE' }, { id: 'shared', delay: 100 }),
      on: {
        REPLACE: (_, enq) => {
          enq.cancel('shared');
          enq.raise({ type: 'EXPIRE' }, { id: 'shared', delay: 100 });
        },
        EXPIRE: { target: 'done' }
      }
    },
    done: { type: 'final' }
  }
});

it('cancels the logical timer in the durable host example', async () => {
  const logs: string[] = [];
  const result = await runOnHost({
    logic: machine,
    executionId: 'replacement',
    journal: createJournal(),
    events: [{ type: 'REPLACE' }],
    log: (line) => logs.push(line)
  });
  expect(result.status).toBe('done');
  expect(
    logs.filter((line) => line.includes('host: firing timer'))
  ).toHaveLength(1);
});

it('preserves the checkpointed occurrence in the durable host example', async () => {
  const journal = createJournal();
  const crashed = await runOnHost({
    logic: machine,
    executionId: 'restore',
    journal,
    events: [],
    crashAfterTransitions: 1,
    log: () => {}
  });
  expect(crashed.status).toBe('crashed');
  const logs: string[] = [];
  const resumed = await runOnHost({
    logic: machine,
    executionId: 'restore',
    journal,
    events: [],
    resume: crashed.checkpoint,
    log: (line) => logs.push(line)
  });
  expect(resumed.status).toBe('done');
  expect(logs.find((line) => line.includes('host: firing timer'))).toContain(
    '"occurrence":0'
  );
});
