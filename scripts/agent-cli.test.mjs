import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(
  new URL('../packages/core/bin/xstate.js', import.meta.url)
);
const machine = {
  id: 'review',
  initial: 'pending',
  states: {
    pending: {
      on: { APPROVE: { target: 'approved' }, REJECT: { target: 'rejected' } }
    },
    approved: { type: 'final' },
    rejected: { type: 'final' }
  }
};

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'xstate-agent-'));
  const write = (name, value) => {
    const path = join(directory, `${name}.json`);
    writeFileSync(path, JSON.stringify(value));
    return path;
  };
  const invoke = (command, ...args) => {
    const result = spawnSync(
      process.execPath,
      [cli, command, ...args, '--json'],
      { cwd: directory, encoding: 'utf8' }
    );
    assert.equal(result.stderr, '');
    return { status: result.status, ...JSON.parse(result.stdout) };
  };
  try {
    run({ write, invoke });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('agent CLI reads the installed version and stable graph structure', () =>
  fixture(({ write, invoke }) => {
    const file = write('machine', machine);
    const inspection = invoke('inspect', file);
    assert.equal(inspection.ok, true);
    assert.equal(inspection.schemaVersion, 1);
    assert.equal(
      inspection.result.graph.analysis.transitionTargetsComplete,
      true
    );
    assert.equal(
      invoke('validate', file).result.runtimePayloadValidation,
      false
    );
    const docs = invoke('docs');
    assert.equal(docs.result.stability.xstateVersion, docs.xstateVersion);
    assert.ok(
      docs.result.stability.entries.some((entry) =>
        entry.exports.some((item) => item.name === 'createMachine')
      )
    );
  }));

test('agent CLI refuses code expressions and illegal definitions with structured errors', () =>
  fixture(({ write, invoke }) => {
    const code = write('code', {
      ...machine,
      context: { '@code': 'process.exit(42)', '@lang': 'js' }
    });
    const result = invoke('simulate', code, write('events', []));
    assert.equal(result.status, 1);
    assert.equal(result.error.code, 'EVALUATOR_REQUIRED');
    assert.deepEqual(result.error.details.paths, ['/context']);
    const invalid = write('invalid', {
      initial: 'missing',
      states: { idle: {} }
    });
    assert.equal(invoke('validate', invalid).error.code, 'INVALID_MACHINE');
    for (const value of [null, [], 42, 'machine']) {
      assert.equal(
        invoke('validate', write('invalid-root', value)).error.code,
        'INVALID_MACHINE'
      );
    }
  }));

test('simulation describes effects without executing them', () =>
  fixture(({ write, invoke }) => {
    const file = write('machine', {
      ...machine,
      states: {
        ...machine.states,
        pending: {
          ...machine.states.pending,
          entry: [{ type: '@xstate.log', args: ['must not print'] }]
        }
      }
    });
    const result = invoke(
      'simulate',
      file,
      write('events', [{ type: 'APPROVE' }])
    );
    assert.equal(result.ok, true);
    assert.equal(result.result.effectsExecuted, false);
    assert.equal(result.result.trace[0].effects.length, 1);
    assert.equal(result.result.trace[1].snapshot.value, 'approved');
  }));

test('model checks emit replayable counterexamples tied to the definition and version', () =>
  fixture(({ write, invoke }) => {
    const file = write('machine', machine);
    const checks = write('checks', {
      events: { APPROVE: [{}], REJECT: [{}] },
      never: ['#review.rejected']
    });
    const result = invoke('test', file, checks);
    assert.equal(result.status, 1);
    assert.equal(result.error.code, 'PROPERTY_VIOLATION');
    const counterexample = result.error.details.fixture;
    assert.deepEqual(counterexample.events, [{ type: 'REJECT' }]);
    const replay = invoke('replay', file, write('fixture', counterexample));
    assert.equal(replay.error.code, 'PROPERTY_VIOLATION');
    const changed = write('changed', {
      ...machine,
      description: 'changed model'
    });
    assert.equal(
      invoke('replay', changed, write('fixture', counterexample)).error.code,
      'FIXTURE_MISMATCH'
    );
    const passing = invoke(
      'test',
      file,
      write('passing', {
        events: [{ type: 'APPROVE' }],
        never: ['#review.rejected'],
        reachable: ['#review.approved']
      })
    );
    assert.equal(passing.result.proof, false);
    assert.equal(passing.result.passed, true);
    assert.equal(passing.result.eventMode, 'replaceDefaults');
    assert.equal(
      invoke(
        'test',
        file,
        write('limit', { never: ['#review.rejected'], limit: 0 })
      ).error.code,
      'INVALID_LIMIT'
    );
    assert.equal(
      invoke('test', file, write('typo', { never: ['#review.typo'] })).error
        .code,
      'INVALID_ASSERTION'
    );
  }));

test('structural diff explicitly leaves compatibility unchecked', () =>
  fixture(({ write, invoke }) => {
    const result = invoke(
      'diff',
      write('before', machine),
      write('after', { ...machine, description: 'Approval required' })
    );
    assert.deepEqual(result.result, {
      changed: true,
      compatibility: 'notChecked',
      changes: [{ op: 'add', path: '/description', after: 'Approval required' }]
    });
  }));
