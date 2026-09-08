import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSnapshotWriter } from './snapshotWriter.ts';

test('rapid writes preserve the newest complete snapshot and leave no temp files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'donut-writer-'));
  try {
    const filename = join(directory, 'state.json');
    const writer = createSnapshotWriter(filename);
    await Promise.all(
      Array.from({ length: 50 }, (_, count) => writer.write({ count }))
    );
    await writer.flush();
    assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), {
      count: 49
    });
    assert.deepEqual(await readdir(directory), ['state.json']);
    await writer.write({ count: 50 }).then(() => writer.write({ count: 51 }));
    await writer.flush();
    assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), {
      count: 51
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reports a failed write and recovers for later writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'donut-writer-'));
  try {
    const folder = join(directory, 'missing');
    const filename = join(folder, 'state.json');
    const writer = createSnapshotWriter(filename);
    const circular = { self: {} };
    circular.self = circular;
    await assert.rejects(writer.write(circular), TypeError);
    await assert.rejects(writer.write({ count: 1 }), { code: 'ENOENT' });
    await mkdir(folder);
    await writer.write({ count: 2 });
    assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), {
      count: 2
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
