import { afterEach, expect, test, vi } from 'vitest';
import type { Collection } from 'mongodb';
import { createMachine, waitFor } from 'xstate';
import { creditCheckMachine } from './machine';
import * as services from './services/machineLogicService';
import {
  collections,
  getDurableActor,
  closeDurableActors,
  WorkflowNotFoundError
} from './services/actorService';

const machine = createMachine({
  context: { count: 0 },
  on: { INC: ({ context }) => ({ context: { count: context.count + 1 } }) }
});
afterEach(async () => {
  await closeDurableActors();
  collections.machineStates = undefined;
  vi.restoreAllMocks();
});

test('shares live workflow actors and persists captured snapshots in order', async () => {
  const saved: unknown[] = [];
  const replaceOne = vi.fn((_filter: unknown, document: unknown) => {
    saved.push(document);
    return Promise.resolve({ acknowledged: true });
  });
  collections.machineStates = { replaceOne } as unknown as Collection;
  const durable = await getDurableActor({ machine });
  const again = await Promise.all([
    getDurableActor({ machine, workflowId: durable.workflowId }),
    getDurableActor({ machine, workflowId: durable.workflowId })
  ]);
  expect(again[0].actor).toBe(durable.actor);
  expect(again[1].actor).toBe(durable.actor);
  durable.actor.send({ type: 'INC' });
  durable.actor.send({ type: 'INC' });
  await durable.flush();
  expect(saved).toMatchObject([
    { persistedState: { context: { count: 0 } } },
    { persistedState: { context: { count: 1 } } },
    { persistedState: { context: { count: 2 } } }
  ]);
});

test('fails missing workflows and unacknowledged initial persistence', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  collections.machineStates = {
    findOne: vi.fn().mockResolvedValue(null),
    replaceOne: vi.fn().mockResolvedValue({ acknowledged: false })
  } as unknown as Collection;
  await expect(
    getDurableActor({ machine, workflowId: 'missing' })
  ).rejects.toBeInstanceOf(WorkflowNotFoundError);
  await expect(getDurableActor({ machine })).rejects.toThrow(
    'not acknowledged'
  );
});

test('does not acknowledge actor failures as successful persistence', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  collections.machineStates = {
    replaceOne: vi.fn().mockResolvedValue({ acknowledged: true })
  } as unknown as Collection;
  const broken = createMachine({
    on: {
      FAIL: () => {
        throw new Error('workflow failed');
      }
    }
  });
  const durable = await getDurableActor({ machine: broken });
  durable.actor.send({ type: 'FAIL' });
  await expect(durable.flush()).rejects.toThrow('workflow failed');
  await Promise.resolve();
  await closeDurableActors();
});

test('evicts completed actors only after persistence and restores without repeating effects', async () => {
  let document: unknown;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const findOne = vi.fn(() => Promise.resolve(document));
  const replaceOne = vi.fn(
    (_filter: unknown, saved: { persistedState: { status: string } }) => {
      const ready =
        saved.persistedState.status === 'done' ? blocked : Promise.resolve();
      return ready.then(() => {
        document = saved;
        return { acknowledged: true };
      });
    }
  );
  collections.machineStates = { findOne, replaceOne } as unknown as Collection;
  const completed = vi.fn();
  const finite = createMachine({
    initial: 'active',
    states: {
      active: { on: { FINISH: { target: 'done' } } },
      done: {
        type: 'final',
        entry: (_args, enq) => {
          enq(completed);
        }
      }
    }
  });
  const durable = await getDurableActor({ machine: finite });
  durable.actor.send({ type: 'FINISH' });
  const duringSave = await getDurableActor({
    machine: finite,
    workflowId: durable.workflowId
  });
  expect(duringSave.actor).toBe(durable.actor);
  expect(findOne).not.toHaveBeenCalled();
  release();
  await durable.flush();
  await Promise.resolve();
  const restored = await getDurableActor({
    machine: finite,
    workflowId: durable.workflowId
  });
  expect(restored.actor).not.toBe(durable.actor);
  expect(restored.actor.getSnapshot().status).toBe('done');
  expect(findOne).toHaveBeenCalledExactlyOnceWith({
    workflowId: durable.workflowId
  });
  expect(completed).toHaveBeenCalledTimes(1);
});

test('completes and evicts the actual credit workflow without rerunning restored effects', async () => {
  let document: unknown;
  const findOne = vi.fn(() => Promise.resolve(document));
  const replaceOne = vi.fn((_filter: unknown, saved: unknown) => {
    document = saved;
    return Promise.resolve({ acknowledged: true });
  });
  collections.machineStates = { findOne, replaceOne } as unknown as Collection;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(services, 'checkReportsTable').mockImplementation(
    ({ ssn, bureauName }) =>
      Promise.resolve({ ssn, bureauName, creditScore: 650 })
  );
  vi.spyOn(services, 'generateInterestRate').mockResolvedValue(5);
  const saveProfile = vi
    .spyOn(services, 'saveCreditProfile')
    .mockResolvedValue(undefined);
  const durable = await getDurableActor({ machine: creditCheckMachine });
  durable.actor.send({
    type: 'Submit',
    SSN: '123456789',
    firstName: 'Ada',
    lastName: 'Lovelace'
  });
  await waitFor(durable.actor, (snapshot) => snapshot.status === 'done');
  await durable.flush();
  await Promise.resolve();
  const restored = await getDurableActor({
    machine: creditCheckMachine,
    workflowId: durable.workflowId
  });
  expect(restored.actor).not.toBe(durable.actor);
  expect(restored.actor.getSnapshot().status).toBe('done');
  expect(findOne).toHaveBeenCalledExactlyOnceWith({
    workflowId: durable.workflowId
  });
  expect(saveProfile).toHaveBeenCalledTimes(1);
});
