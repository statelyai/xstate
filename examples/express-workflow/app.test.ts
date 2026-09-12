import { afterEach, expect, test } from 'vitest';
import type { Server } from 'node:http';
import { createWorkflowApp } from './app';

let server: Server;
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
});

test('persists requests, validates events and isolates inherited object keys', async () => {
  server = createWorkflowApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing TCP address');
  const base = `http://127.0.0.1:${address.port}/workflows`;
  const created = await fetch(base, { method: 'POST' }).then((response) =>
    response.json()
  );
  if (
    !created ||
    typeof created !== 'object' ||
    !('workflowId' in created) ||
    typeof created.workflowId !== 'string'
  )
    throw new Error('Missing workflow ID');
  const url = `${base}/${created.workflowId}`;
  for (let i = 0; i < 3; i++) {
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'TIMER' })
        })
      ).status
    ).toBe(200);
  }
  expect(await fetch(url).then((response) => response.json())).toMatchObject({
    value: 'green',
    context: { cycles: 1 }
  });
  expect(
    (
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
    ).status
  ).toBe(400);
  for (const id of ['__proto__', 'constructor', 'missing']) {
    expect((await fetch(`${base}/${id}`)).status).toBe(404);
    expect((await fetch(`${base}/${id}`, { method: 'POST' })).status).toBe(404);
  }
});
