import { describe, expect, it } from 'vitest';
import { reportIdPathTargets } from '../src/transforms/report-id-path-targets.ts';
import { applyTransform } from './helpers.ts';

describe('report-id-path-targets', () => {
  it('reports an id followed by a path and never mutates', () => {
    const input = `import { createMachine } from 'xstate';
const machine = createMachine({
  id: 'shop',
  initial: 'idle',
  states: {
    idle: { on: { NEXT: { target: '#flow.step.review' } } },
    wizard: {
      id: 'flow',
      initial: 'step',
      states: { step: { initial: 'review', states: { review: {} } } }
    }
  }
});`;
    const { output, changed, notes } = applyTransform(
      reportIdPathTargets,
      input,
      'src/machine.ts'
    );

    expect(changed).toBe(false);
    expect(output).toBe(input);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/machine\.ts:6:\d+/);
    expect(notes[0]).toContain("'#flow.step.review'");
    expect(notes[0]).toContain('exact state id');
  });

  it('does not report whole explicit or implicit ids', () => {
    const input = `import { createMachine } from 'xstate';
const machine = createMachine({
  id: 'shop',
  initial: 'idle',
  states: {
    idle: {
      on: {
        IMPLICIT: { target: '#shop.wizard.step' },
        EXPLICIT: { target: '#flow' },
        DOTTED: { target: '#my.id' },
        BARE: '#shop.idle'
      }
    },
    wizard: { id: 'flow', initial: 'step', states: { step: {} } },
    other: { id: 'my.id' }
  }
});`;
    const { notes } = applyTransform(reportIdPathTargets, input);
    expect(notes).toEqual([]);
  });

  it('reports unverifiable targets, bare transitions and matches arguments', () => {
    const input = `import { createMachine } from 'xstate';
const machine = createMachine(config);
const other = createMachine({
  initial: 'a',
  states: {
    a: {
      on: { GO: '#elsewhere.child', MANY: { target: ['#x.y'] } },
      after: { 100: '#late.child' },
      always: { target: '#always.child' }
    }
  }
});
snapshot.matches('#flow.step');
stateIn('#flow.step');`;
    const { notes } = applyTransform(reportIdPathTargets, input);
    const joined = notes.join('\n');
    expect(notes).toHaveLength(6);
    for (const target of [
      '#elsewhere.child',
      '#x.y',
      '#late.child',
      '#always.child',
      '#flow.step'
    ]) {
      expect(joined).toContain(`'${target}'`);
    }
  });

  it('ignores `#` strings that are not targets or dotless ids', () => {
    const input = `const color = '#fff.a';
const machine = createMachine({
  initial: 'a',
  states: { a: { on: { GO: { target: '#a' } } } }
});
snapshot.matches('#a');`;
    const { notes } = applyTransform(reportIdPathTargets, input);
    expect(notes).toEqual([]);
  });

  it('scopes known ids to the machine config that contains the target', () => {
    const input = `import { createMachine } from 'xstate';
const first = createMachine({
  id: 'first',
  initial: 'idle',
  states: {
    idle: { on: { GO: { target: '#flow.step' } } },
    wizard: { id: 'flow', initial: 'step', states: { step: {} } }
  }
});
const second = createMachine({
  initial: 'a',
  invoke: { id: 'flow.child', src: 'child' },
  states: {
    a: {
      invoke: { id: 'flow.step', src: 'child' },
      on: { GO: { target: '#flow.child' } }
    },
    b: { id: 'flow.step' }
  }
});`;
    const { notes } = applyTransform(reportIdPathTargets, input);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatch(/:6:\d+/);
    expect(notes[0]).toContain("'#flow.step'");
    expect(notes[1]).toContain("'#flow.child'");
  });

  it('reports matches arguments outside a machine config', () => {
    const input = `const machine = createMachine({
  id: 'shop',
  initial: 'idle',
  states: { idle: {} }
});
machine.getInitialSnapshot().matches('#shop.idle');`;
    const { notes } = applyTransform(reportIdPathTargets, input);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("'#shop.idle'");
  });

  it('scans static template literals', () => {
    const input = `const machine = createMachine({
  initial: 'a',
  states: {
    a: {
      on: { GO: { target: \`#flow.step\` }, BARE: \`#x.y\` },
      after: { 100: \`#late.child\` }
    }
  }
});
snapshot.matches(\`#flow.step\`);
stateIn(\`#flow.step\`);`;
    const { notes } = applyTransform(reportIdPathTargets, input);
    expect(notes).toHaveLength(5);
  });
});
