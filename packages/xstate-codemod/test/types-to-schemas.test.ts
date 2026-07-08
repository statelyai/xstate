import { describe, expect, it } from 'vitest';
import { typesToSchemas } from '../src/transforms/types-to-schemas.ts';
import { applyTransform } from './helpers.ts';

describe('types-to-schemas', () => {
  it('converts context/input and a literal-union events map', () => {
    const input = `import { createMachine } from 'xstate';
createMachine({
  types: {} as {
    context: { count: number };
    events: { type: 'inc'; by: number } | { type: 'reset' };
    input: { start: number };
  }
});`;
    const { output, changed } = applyTransform(typesToSchemas, input);
    expect(changed).toBe(true);
    expect(output).toContain('schemas:');
    expect(output).toContain('context: types<{ count: number }>()');
    expect(output).toContain('input: types<{ start: number }>()');
    // events map: `type` prop stripped, keyed by event type.
    expect(output).toContain('"inc": types<{ by: number }>()');
    expect(output).toContain('"reset": types<{}>()');
    // `types` import added.
    expect(output).toContain('types');
  });

  it('adds the types import to the existing xstate import', () => {
    const input = `import { createMachine } from 'xstate';
createMachine({
  types: {} as { context: { a: number } }
});`;
    const { output } = applyTransform(typesToSchemas, input);
    expect(output).toMatch(/import \{[^}]*\btypes\b[^}]*\} from 'xstate'/);
  });

  it('leaves events in place with a TODO when the union is a type reference (not inline)', () => {
    const input = `import { createMachine } from 'xstate';
type Ev = { type: 'a' } | { type: 'b' };
createMachine({
  types: {} as { context: { a: number }; events: Ev }
});`;
    const { output, changed, notes } = applyTransform(typesToSchemas, input);
    expect(changed).toBe(true);
    expect(output).toContain('context: types<{ a: number }>()');
    expect(output).toContain('TODO(xstate-codemod): migrate events to schemas.events map');
    expect(notes.some((n) => n.includes("could not migrate 'events'"))).toBe(
      true
    );
  });

  it('leaves `types: {} as any` unchanged with a TODO note', () => {
    const input = `import { createMachine } from 'xstate';
createMachine({
  types: {} as any
});`;
    const { output, notes } = applyTransform(typesToSchemas, input);
    expect(output).toContain('TODO(xstate-codemod)');
    expect(notes.some((n) => n.includes("left 'types' unchanged"))).toBe(true);
  });

  it('does not touch a `types` property outside createMachine/setup (mustn\'t-touch case)', () => {
    const input = `const x = {
  types: {} as { context: { a: number } }
};`;
    const { output, changed } = applyTransform(typesToSchemas, input);
    expect(changed).toBe(false);
    expect(output).toContain('types: {} as { context: { a: number } }');
  });
});
