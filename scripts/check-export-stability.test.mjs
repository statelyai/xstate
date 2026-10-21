import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStabilityTags } from './check-export-stability.mjs';

test('a single stability tag passes', () => {
  for (const tag of ['public', 'experimental', 'internal']) {
    assert.equal(checkStabilityTags(new Set([tag])).problem, undefined);
  }
  assert.equal(
    checkStabilityTags(new Set(['public', 'deprecated'])).problem,
    undefined
  );
});

test('conflicting stability tags fail', () => {
  const result = checkStabilityTags(new Set(['public', 'experimental']));
  assert.equal(
    result.problem,
    'conflicting stability tags: @public, @experimental'
  );
  assert.equal(result.stability, 'untagged');
});

test('missing tag and @deprecated pairing rules still apply', () => {
  assert.equal(checkStabilityTags(new Set()).problem, 'missing stability tag');
  assert.equal(
    checkStabilityTags(new Set(['deprecated'])).problem,
    '@deprecated without @public or @experimental'
  );
  assert.equal(
    checkStabilityTags(new Set(['internal', 'deprecated'])).problem,
    '@deprecated must pair with @public or @experimental'
  );
});
