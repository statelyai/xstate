import { afterEach, expect, test, vi } from 'vitest';
import { createActor, waitFor } from 'xstate';
import type { Collection } from 'mongodb';
import { collections } from './services/actorService';
import { creditCheckMachine } from './machine';
import * as services from './services/machineLogicService';

const actors: Array<{ stop(): void }> = [];
afterEach(() => {
  actors.splice(0).forEach((actor) => actor.stop());
  vi.restoreAllMocks();
  collections.creditReports = undefined;
  collections.creditProfiles = undefined;
});
const credentials = {
  SSN: '123456789',
  firstName: 'Ada',
  lastName: 'Lovelace'
};

test('reuses existing bureau reports and saves the fetched bureau score and final profile', async () => {
  vi.spyOn(services, 'checkReportsTable').mockImplementation(
    ({ ssn, bureauName }) =>
      Promise.resolve(
        bureauName === 'GavUnion'
          ? null
          : {
              ssn,
              bureauName,
              creditScore: bureauName === 'EquiGavin' ? 620 : 710
            }
      )
  );
  const bureau = vi
    .spyOn(services, 'checkBureauService')
    .mockResolvedValue(530);
  const saveReport = vi
    .spyOn(services, 'saveCreditReport')
    .mockResolvedValue(undefined);
  const saveProfile = vi
    .spyOn(services, 'saveCreditProfile')
    .mockResolvedValue(undefined);
  vi.spyOn(services, 'generateInterestRate').mockResolvedValue(5);
  const actor = createActor(creditCheckMachine).start();
  actors.push(actor);
  actor.send({ type: 'Submit', ...credentials });
  const snapshot = await waitFor(
    actor,
    (state) => state.context.InterestRateOptions.length > 0
  );
  expect(snapshot.status).toBe('done');
  expect(bureau).toHaveBeenCalledExactlyOnceWith({
    ssn: credentials.SSN,
    bureauName: 'GavUnion'
  });
  expect(saveReport).toHaveBeenCalledExactlyOnceWith({
    ssn: credentials.SSN,
    bureauName: 'GavUnion',
    creditScore: 530
  });
  expect(snapshot.context).toMatchObject({
    EquiGavinScore: 620,
    GavUnionScore: 530,
    GavperianScore: 710,
    MiddleScore: 620,
    InterestRateOptions: [5]
  });
  expect(saveProfile).toHaveBeenCalledWith(
    expect.objectContaining({ MiddleScore: 620, InterestRateOptions: [5] })
  );
});

test('invalid credentials and a failed bureau write return a retryable error', async () => {
  const actor = createActor(creditCheckMachine).start();
  actors.push(actor);
  actor.send({ type: 'Submit', ...credentials, SSN: 'bad' });
  await waitFor(actor, (state) => Boolean(state.context.ErrorMessage));
  expect(
    actor.getSnapshot().matches({ creditCheck: 'Entering Information' })
  ).toBe(true);
  vi.spyOn(services, 'checkReportsTable').mockResolvedValue(null);
  vi.spyOn(services, 'checkBureauService').mockResolvedValue(650);
  vi.spyOn(services, 'saveCreditReport').mockRejectedValue(
    new Error('storage unavailable')
  );
  actor.send({ type: 'Submit', ...credentials });
  await waitFor(
    actor,
    (state) =>
      state.context.ErrorMessage === 'Failed to retrieve credit scores.'
  );
  expect(
    actor.getSnapshot().matches({ creditCheck: 'Entering Information' })
  ).toBe(true);
});

test('middle score uses numeric ordering without mutating its input', async () => {
  const scores = [900, 80, 700];
  expect(await services.determineMiddleScore(scores)).toBe(700);
  expect(scores).toEqual([900, 80, 700]);
  await expect(services.determineMiddleScore([300])).rejects.toThrow(
    'three finite'
  );
});

test('does not silently accept missing or unacknowledged report persistence', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const report = {
    ssn: credentials.SSN,
    bureauName: 'GavUnion',
    creditScore: 650
  };
  await expect(services.saveCreditReport(report)).rejects.toThrow(
    'not initialized'
  );
  collections.creditReports = {
    replaceOne: vi.fn().mockResolvedValue({ acknowledged: false })
  } as unknown as Collection;
  await expect(services.saveCreditReport(report)).rejects.toThrow(
    'not acknowledged'
  );
});

test('replaces profiles by the same uppercase SSN stored in the document', async () => {
  const replaceOne = vi.fn().mockResolvedValue({ acknowledged: true });
  collections.creditProfiles = { replaceOne } as unknown as Collection;
  const profile = {
    SSN: credentials.SSN,
    FirstName: credentials.firstName,
    LastName: credentials.lastName,
    GavUnionScore: 620,
    EquiGavinScore: 650,
    GavperianScore: 700,
    MiddleScore: 650,
    InterestRateOptions: [5],
    ErrorMessage: ''
  };
  await services.saveCreditProfile(profile);
  expect(replaceOne).toHaveBeenCalledExactlyOnceWith(
    { SSN: credentials.SSN },
    profile,
    { upsert: true }
  );
});
