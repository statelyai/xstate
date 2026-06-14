import { describe, it, expect } from 'vitest';
import { transformSource } from '../src/transforms.js';

describe('xstate migrate — Tier A transforms', () => {
  it('renames interpret → createActor (import + references)', () => {
    const { code, changed } = transformSource(
      'a.ts',
      [
        `import { interpret, createMachine } from 'xstate';`,
        `const m = createMachine({});`,
        `const actor = interpret(m);`
      ].join('\n')
    );
    expect(changed).toBe(true);
    expect(code).toContain('createActor');
    expect(code).not.toMatch(/\binterpret\b/);
    expect(code).toMatch(/from ['"]xstate['"]/);
  });

  it('renames the from* actor logic creators', () => {
    const { code } = transformSource(
      'a.ts',
      [
        `import { fromCallback, fromObservable, fromEventObservable, fromTransition } from 'xstate';`,
        `const a = fromCallback(() => {});`,
        `const b = fromObservable(() => x$);`,
        `const c = fromEventObservable(() => y$);`,
        `const d = fromTransition((s) => s, 0);`
      ].join('\n')
    );
    expect(code).toContain('createCallbackLogic(');
    expect(code).toContain('createObservableLogic(');
    expect(code).toContain('createEventObservableLogic(');
    expect(code).toContain('createTransitionLogic(');
    expect(code).not.toMatch(
      /\bfromCallback\b|\bfromObservable\b|\bfromTransition\b/
    );
  });

  it('renames Interpreter type → Actor', () => {
    const { code } = transformSource(
      'a.ts',
      [
        `import { Interpreter } from 'xstate';`,
        `let x: Interpreter<any>;`
      ].join('\n')
    );
    expect(code).toContain('Actor<any>');
    expect(code).not.toMatch(/\bInterpreter\b/);
  });

  it('does NOT rename `fromPromise` (Tier B shape change, not a rename)', () => {
    const { code } = transformSource(
      'a.ts',
      [
        `import { fromPromise } from 'xstate';`,
        `const p = fromPromise(fn);`
      ].join('\n')
    );
    expect(code).toContain('fromPromise');
    expect(code).not.toContain('createAsyncLogic');
  });

  it('leaves same-named locals from non-xstate sources alone', () => {
    const src = [
      `import { interpret } from './my-local-interpreter';`,
      `const r = interpret('data');`
    ].join('\n');
    const { code, changed } = transformSource('a.ts', src);
    expect(changed).toBe(false);
    expect(code).toContain('interpret');
  });

  it('renames imports from framework packages too', () => {
    const { code } = transformSource(
      'a.ts',
      [
        `import { fromTransition } from '@xstate/react';`,
        `const l = fromTransition((s) => s, 0);`
      ].join('\n')
    );
    expect(code).toContain('createTransitionLogic');
  });

  it('is a no-op when nothing matches', () => {
    const src = `import { createMachine, createActor } from 'xstate';\nconst m = createMachine({});`;
    const { changed } = transformSource('a.ts', src);
    expect(changed).toBe(false);
  });

  it('flags aliased imports instead of silently breaking them', () => {
    const { notes } = transformSource(
      'a.ts',
      `import { interpret as start } from 'xstate';\nconst a = start(m);`
    );
    expect(notes.join('\n')).toContain('aliased import');
  });
});
