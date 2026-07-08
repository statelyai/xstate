import { describe, expect, it } from 'vitest';
import { renameImports } from '../src/transforms/rename-imports.ts';
import { applyTransform, normalize } from './helpers.ts';

describe('rename-imports', () => {
  it('renames interpret → createActor including usages', () => {
    const input = `import { interpret } from 'xstate';
const actor = interpret(machine);
interpret(other).start();`;
    const { output, changed } = applyTransform(renameImports, input);
    expect(changed).toBe(true);
    expect(normalize(output)).toBe(
      normalize(`import { createActor } from 'xstate';
const actor = createActor(machine);
createActor(other).start();`)
    );
  });

  it('renames the Interpreter type and its usages', () => {
    const input = `import { Interpreter } from 'xstate';
let a: Interpreter;`;
    const { output, changed } = applyTransform(renameImports, input);
    expect(changed).toBe(true);
    expect(output).toContain(`import { Interpreter } from 'xstate';`.replace(
      'Interpreter',
      'Actor'
    ));
    expect(output).toContain('let a: Actor;');
  });

  it('renames the actor-logic creators', () => {
    const input = `import { fromCallback, fromObservable, fromEventObservable } from 'xstate';
const a = fromCallback(cb);
const b = fromObservable(obs);
const c = fromEventObservable(obs2);`;
    const { output, changed } = applyTransform(renameImports, input);
    expect(changed).toBe(true);
    expect(output).toContain(
      `import { createCallbackLogic, createObservableLogic, createEventObservableLogic } from 'xstate';`
    );
    expect(output).toContain('const a = createCallbackLogic(cb);');
    expect(output).toContain('const b = createObservableLogic(obs);');
    expect(output).toContain('const c = createEventObservableLogic(obs2);');
  });

  it('preserves aliases (renames the source binding, keeps the alias)', () => {
    const input = `import { interpret as run } from 'xstate';
const a = run(machine);`;
    const { output, changed } = applyTransform(renameImports, input);
    expect(changed).toBe(true);
    expect(output).toContain(`import { createActor as run } from 'xstate';`);
    // Alias usages are untouched.
    expect(output).toContain('const a = run(machine);');
  });

  it('does not touch non-xstate imports (mustn\'t-touch case)', () => {
    const input = `import { interpret } from 'some-other-lib';
const x = interpret(thing);`;
    const { output, changed } = applyTransform(renameImports, input);
    expect(changed).toBe(false);
    expect(normalize(output)).toBe(normalize(input));
  });
});
