import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseTagMismatches } from './check-release-tags.mjs';

test('release gate rejects missing, stale and wrong-major tags', () => {
  assert.deepEqual(
    releaseTagMismatches(
      {
        xstate: '6.0.0-beta.0',
        '@xstate/test': '2.0.0-beta.0',
        '@xstate/react': '7.0.0-beta.0'
      },
      { xstate: '5.0.0-beta.54', '@xstate/test': '1.0.0-beta.5' }
    ),
    [
      { name: 'xstate', expected: '6.0.0-beta.0', observed: '5.0.0-beta.54' },
      {
        name: '@xstate/test',
        expected: '2.0.0-beta.0',
        observed: '1.0.0-beta.5'
      },
      { name: '@xstate/react', expected: '7.0.0-beta.0', observed: null }
    ]
  );
});

test('release gate accepts exactly the coordinated versions', () => {
  assert.deepEqual(
    releaseTagMismatches(
      { xstate: '6.0.0-beta.0' },
      { xstate: '6.0.0-beta.0' }
    ),
    []
  );
});
