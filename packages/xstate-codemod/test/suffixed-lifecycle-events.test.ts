import { describe, expect, it } from 'vitest';
import { suffixedLifecycleEvents } from '../src/transforms/suffixed-lifecycle-events.ts';
import { applyTransform } from './helpers.ts';

const run = (input: string) =>
  applyTransform(suffixedLifecycleEvents, input, 'src/machine.ts');

describe('suffixed-lifecycle-events', () => {
  it('rewrites suffixed done/error/snapshot keys to category types with matches', () => {
    const { output, changed, sites } =
      run(`import { createMachine } from 'xstate';
const machine = createMachine({
  initial: 'loading',
  states: {
    loading: {
      invoke: { id: 'job', src: 'job' },
      on: {
        'xstate.done.actor.job': { target: 'done' },
        'xstate.error.actor.job': ({ event }) => ({ target: 'failed' }),
        'xstate.snapshot.job': { target: 'loading' }
      }
    },
    form: {
      on: { 'xstate.done.state.(machine).form.fields': { target: 'done' } }
    },
    done: {},
    failed: {}
  }
});`);
    expect(changed).toBe(true);
    expect(sites).toEqual([]);
    expect(output).toContain(
      `'xstate.done.actor': { matches: { actorId: 'job' }, target: 'done' }`
    );
    expect(output).toContain(
      `'xstate.error.actor': { matches: { actorId: 'job' }, to: ({ event }) => ({ target: 'failed' }) }`
    );
    expect(output).toContain(
      `'xstate.snapshot.actor': { matches: { actorId: 'job' }, target: 'loading' }`
    );
    expect(output).toContain(
      `'xstate.done.state': { matches: { stateId: 'form.fields' }, target: 'done' }`
    );
  });

  it('reports after keys, colliding keys and non-literal transitions', () => {
    const input = `import { createMachine } from 'xstate';
const toDone = { target: 'done' };
const machine = createMachine({
  initial: 'a',
  states: {
    a: {
      on: {
        'xstate.after.1000.a': { target: 'done' },
        'xstate.done.actor.one': { target: 'done' },
        'xstate.done.actor.two': { target: 'done' }
      }
    },
    b: {
      on: {
        'xstate.done.actor': { target: 'done' },
        'xstate.done.actor.three': { target: 'done' }
      }
    },
    c: { on: { 'xstate.error.actor.four': toDone } },
    done: {}
  }
});`;
    const { output, changed, sites } = run(input);
    expect(changed).toBe(false);
    expect(output).toBe(input);
    expect(sites.map((s) => s.api)).toEqual([
      'xstate.after.1000.a',
      'xstate.done.actor.one',
      'xstate.done.actor.two',
      'xstate.done.actor.three',
      'xstate.error.actor.four'
    ]);
    expect(sites[0]!.hint).toContain('`after: { <delay>: ... }`');
    expect(sites[1]!.hint).toContain("matches: { actorId: 'one' }");
  });

  it('reports suffixed type strings outside on keys', () => {
    const { changed, sites } = run(`import { createMachine } from 'xstate';
const machine = createMachine({
  on: {
    'xstate.done.actor.*': ({ event }) => {
      if (event.type === 'xstate.done.actor.job') return { target: '.a' };
    }
  },
  initial: 'a',
  states: { a: {} }
});`);
    expect(changed).toBe(false);
    expect(sites).toEqual([
      expect.objectContaining({
        api: 'xstate.done.actor.job',
        line: 5,
        hint: expect.stringContaining('never equals `event.type`')
      })
    ]);
  });

  it('leaves v6 keys, wildcards and files without xstate imports alone', () => {
    const v6 = `import { createMachine } from 'xstate';
const machine = createMachine({
  on: {
    'xstate.done.actor': { matches: { actorId: 'job' }, target: '.a' },
    'xstate.snapshot.actor': { target: '.a' },
    'xstate.error.actor.*': { target: '.a' }
  },
  initial: 'a',
  states: { a: {} }
});`;
    expect(run(v6)).toMatchObject({ changed: false, sites: [] });
    expect(run(`const type = 'xstate.done.actor.job';`)).toMatchObject({
      changed: false,
      sites: []
    });
  });
});
