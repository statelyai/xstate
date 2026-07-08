import { describe, expect, it } from 'vitest';
import { stringTargets } from '../src/transforms/string-targets.ts';
import { applyTransform, normalize } from './helpers.ts';

describe('string-targets', () => {
  it('wraps on/onDone/onError/always/after string transitions', () => {
    const input = `import { createMachine } from 'xstate';
createMachine({
  initial: 'a',
  states: {
    a: {
      on: { EVT: 'b' },
      onDone: 'done',
      onError: 'err',
      always: 'c',
      after: { 1000: 'b' }
    },
    b: {},
    c: {},
    done: {},
    err: {}
  }
});`;
    const { output, changed } = applyTransform(stringTargets, input);
    expect(changed).toBe(true);
    expect(output).toContain("on: { EVT: { target: 'b' } }");
    expect(output).toContain("onDone: { target: 'done' }");
    expect(output).toContain("onError: { target: 'err' }");
    expect(output).toContain("always: { target: 'c' }");
    expect(output).toContain("after: { 1000: { target: 'b' } }");
  });

  it('does not touch initial or existing target', () => {
    const input = `import { createMachine } from 'xstate';
createMachine({
  initial: 'a',
  states: {
    a: { on: { EVT: { target: 'b', actions: [] } } },
    b: {}
  }
});`;
    const { output, changed } = applyTransform(stringTargets, input);
    expect(changed).toBe(false);
    expect(output).toContain("initial: 'a'");
    expect(output).toContain("target: 'b'");
  });

  it('handles arrays of string transitions', () => {
    const input = `import { createMachine } from 'xstate';
createMachine({
  states: {
    a: { on: { EVT: ['b', 'c'] } }
  }
});`;
    const { output, changed } = applyTransform(stringTargets, input);
    expect(changed).toBe(true);
    expect(output).toContain("[{ target: 'b' }, { target: 'c' }]");
  });

  it('works with setup(...).createMachine(...) form', () => {
    const input = `import { setup } from 'xstate';
setup({}).createMachine({
  states: { a: { on: { EVT: 'b' } }, b: {} }
});`;
    const { output, changed } = applyTransform(stringTargets, input);
    expect(changed).toBe(true);
    expect(output).toContain("on: { EVT: { target: 'b' } }");
  });

  it('does not touch a plain object not passed to createMachine (mustn\'t-touch case)', () => {
    const input = `const config = {
  states: { a: { on: { EVT: 'b' } } }
};
someOtherFn({ on: { EVT: 'b' } });`;
    const { output, changed } = applyTransform(stringTargets, input);
    expect(changed).toBe(false);
    expect(normalize(output)).toBe(normalize(input));
  });

  it('wraps onDone/onError string transitions inside invoke (object and array form)', () => {
    const input = `import { createMachine } from 'xstate';
createMachine({
  initial: 'a',
  states: {
    a: {
      invoke: { src: 'loader', onDone: 'b', onError: 'c' }
    },
    b: {
      invoke: [
        { src: 'one', onDone: 'c' },
        { src: 'two', onError: 'a' }
      ]
    },
    c: {}
  }
});`;
    const { output, changed } = applyTransform(stringTargets, input);
    expect(changed).toBe(true);
    expect(output).toContain("onDone: { target: 'b' }");
    expect(output).toContain("onError: { target: 'c' }");
    expect(output).toContain("onDone: { target: 'c' }");
    expect(output).toContain("onError: { target: 'a' }");
  });
});
