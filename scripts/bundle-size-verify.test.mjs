import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyBundle } from './bundle-size-verify.mjs';

test('verification checks output and export behavior, not just a zero exit code', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bundle-verify-test-'));
  try {
    verifyBundle({
      name: 'valid',
      directory,
      code: 'console.log({count: 1}); export function factory() {}',
      expectedLogs: [[{ count: 1 }]],
      exports: ['factory']
    });
    assert.throws(
      () =>
        verifyBundle({
          name: 'wrong-output',
          directory,
          code: 'console.log(2)',
          expectedLogs: [[1]]
        }),
      /failed verification/
    );
    assert.throws(
      () =>
        verifyBundle({
          name: 'wrong-export',
          directory,
          code: 'export const factory = 1',
          expectedLogs: [],
          exports: ['factory']
        }),
      /failed verification/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
