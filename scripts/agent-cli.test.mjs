import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
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

function fixture(run, { generators = false } = {}) {
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
      { cwd: directory, encoding: 'utf8', timeout: 10000 }
    );
    assert.equal(result.stderr, '');
    return { status: result.status, ...JSON.parse(result.stdout) };
  };
  try {
    if (generators) {
      const testPackage = fileURLToPath(
        new URL('../packages/xstate-test', import.meta.url)
      );
      const modules = join(directory, 'node_modules');
      mkdirSync(join(modules, '@xstate'), { recursive: true });
      symlinkSync(testPackage, join(modules, '@xstate', 'test'), 'junction');
      for (const name of ['effect', 'fast-check']) {
        symlinkSync(
          join(testPackage, 'node_modules', name),
          join(modules, name),
          'junction'
        );
      }
    }
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

test('schema generation supplies seeded event examples and a replayable input', () =>
  fixture(
    ({ write, invoke }) => {
      const file = write('machine', {
        ...machine,
        schemas: {
          input: { const: 'account' },
          events: {
            APPROVE: {
              type: 'object',
              required: ['level'],
              properties: { level: { const: 2 } }
            },
            REJECT: { type: 'object', additionalProperties: false }
          }
        },
        states: {
          ...machine.states,
          pending: {
            on: {
              APPROVE: { matches: { level: 2 }, target: 'approved' },
              REJECT: { target: 'rejected' }
            }
          }
        }
      });
      const generate = { seed: 42, samplesPerEvent: 4 };
      const checks = write('checks', {
        generate,
        reachable: ['#review.approved']
      });
      const result = invoke('test', file, checks);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.result.proof, false);
      assert.equal(result.result.input, 'account');
      assert.deepEqual(result.result.generation, {
        ...generate,
        eventTypes: ['APPROVE', 'REJECT'],
        inputGenerated: true
      });
      assert.ok(
        result.result.representativeEvents.APPROVE.every(
          ({ level }) => level === 2
        )
      );
      assert.deepEqual(invoke('test', file, checks), result);

      const failure = invoke(
        'test',
        file,
        write('never', { generate, never: ['#review.approved'] })
      );
      assert.equal(failure.error.code, 'PROPERTY_VIOLATION');
      assert.equal(failure.error.details.fixture.events[0].level, 2);
      assert.equal(failure.error.details.fixture.input, 'account');
      fixture(({ write, invoke }) => {
        assert.equal(
          invoke(
            'replay',
            file,
            write('counterexample', failure.error.details.fixture)
          ).error.code,
          'PROPERTY_VIOLATION'
        );
      });
    },
    { generators: true }
  ));

test('explicit cases override generated cases and wildcard schemas fill concrete events', () =>
  fixture(
    ({ write, invoke }) => {
      const file = write('machine', {
        ...machine,
        schemas: {
          input: { not: {} },
          events: {
            APPROVE: { type: 'string', pattern: 'unsupported' },
            'review.*': {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              type: 'object',
              properties: { level: { const: 2 } },
              required: ['level'],
              additionalProperties: false
            }
          }
        },
        states: {
          ...machine.states,
          pending: {
            on: {
              APPROVE: { matches: { level: 1 }, target: 'approved' },
              'review.reject': { matches: { level: 2 }, target: 'rejected' }
            }
          }
        }
      });
      const result = invoke(
        'test',
        file,
        write('checks', {
          generate: {},
          input: 'fixed',
          events: { APPROVE: [{ level: 1 }] },
          reachable: ['#review.approved', '#review.rejected']
        })
      );
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.result.input, 'fixed');
      assert.deepEqual(result.result.generation.eventTypes, ['review.reject']);
      assert.deepEqual(result.result.representativeEvents, {
        'review.reject': [{ level: 2 }],
        APPROVE: [{ level: 1 }]
      });
    },
    { generators: true }
  ));

test('schema generation reports invalid options and missing project dependencies', () =>
  fixture(({ write, invoke }) => {
    const file = write('machine', machine);
    for (const options of [
      { generate: null },
      { generate: { samplesPerEvent: 101 } },
      { generate: { seed: 2147483648 } },
      { generate: {}, events: [] }
    ]) {
      const checks = write('checks', {
        ...options,
        reachable: ['#review.approved']
      });
      assert.equal(
        invoke('test', file, checks).error.code,
        'INVALID_GENERATION'
      );
    }
    const checks = write('checks', {
      generate: {},
      reachable: ['#review.approved']
    });
    assert.equal(
      invoke('test', file, checks).error.code,
      'SCHEMA_GENERATORS_REQUIRED'
    );
  }));

test('schema generation refuses unsupported constraints with the event path', () =>
  fixture(
    ({ write, invoke }) => {
      const file = write('machine', {
        ...machine,
        schemas: {
          events: {
            APPROVE: {
              type: 'object',
              properties: { reason: { type: 'string', pattern: 'a+' } }
            }
          }
        }
      });
      const checks = write('checks', {
        generate: {},
        reachable: ['#review.approved']
      });
      const result = invoke('test', file, checks);
      assert.equal(result.error.code, 'SCHEMA_GENERATION_FAILED');
      assert.deepEqual(result.error.details, {
        path: 'schemas.events.APPROVE'
      });
    },
    { generators: true }
  ));

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
