import { afterEach, expect, test, vi } from 'vitest';
import type { Collection } from 'mongodb';
import type { Server } from 'node:http';
import { createCreditCheckApp } from './app';
import { collections, closeDurableActors } from './services/actorService';

let server: Server | undefined;
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve()))
    );
  await closeDurableActors();
  collections.machineStates = undefined;
  vi.restoreAllMocks();
});

test('returns one error response for invalid events, unknown workflows and failed database reads', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const findOne = vi.fn().mockResolvedValue(null);
  collections.machineStates = { findOne } as unknown as Collection;
  server = createCreditCheckApp().listen(0);
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing TCP address');
  const url = `http://127.0.0.1:${address.port}/workflows/missing`;
  expect(
    (
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
    ).status
  ).toBe(400);
  const result = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'Submit',
      SSN: '123456789',
      firstName: 'Ada',
      lastName: 'Lovelace'
    })
  });
  expect(result.status).toBe(404);
  expect(await result.text()).toContain('Workflow not found');
  expect((await fetch(url)).status).toBe(404);
  findOne.mockRejectedValueOnce(new Error('offline'));
  expect((await fetch(url)).status).toBe(500);
});
