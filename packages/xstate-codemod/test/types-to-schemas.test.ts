import { Project } from 'ts-morph';
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
    expect(output).toContain(
      'TODO(xstate-codemod): migrate events to schemas.events map'
    );
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

  it("does not touch a `types` property outside createMachine/setup (mustn't-touch case)", () => {
    const input = `const x = {
  types: {} as { context: { a: number } }
};`;
    const { output, changed } = applyTransform(typesToSchemas, input);
    expect(changed).toBe(false);
    expect(output).toContain('types: {} as { context: { a: number } }');
  });
});

it.each([';', ',', '\n'])(
  'generates valid multi-field payloads separated by %j',
  (separator) => {
    const { output } = applyTransform(
      typesToSchemas,
      `import { createMachine } from 'xstate';
createMachine({ types: {} as { events: { type: 'update'${separator} first: number${separator} second: string${separator} } } });`
    );
    expectValidMigration(output);
  }
);

it.each([
  "import * as X from 'xstate'; X.createMachine",
  "import type { AnyActorRef } from 'xstate'; import { createMachine } from 'xstate'; createMachine",
  "import { createMachine, types as schema } from 'xstate'; createMachine",
  "import { createMachine, type types } from 'xstate'; createMachine",
  "import { createMachine } from 'xstate'; const types = 123; createMachine",
  "import { createMachine, types } from 'xstate'; function configure(types: number) { return createMachine"
])('uses a valid runtime helper binding: %s', (prefix) => {
  const { output } = applyTransform(
    typesToSchemas,
    `${prefix}({ types: {} as { context: { count: number } } });${prefix.includes('function configure') ? '}' : ''}`
  );
  expectValidMigration(output);
});

it('preserves escaped event discriminants', () => {
  const { output } = applyTransform(
    typesToSchemas,
    `import { createMachine } from 'xstate'; createMachine({ types: {} as { events: { type: 'say\\'hi' } } });`
  );
  expect(output).toContain(`"say'hi":`);
  expectValidMigration(output);
});

function expectValidMigration(output: string) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { strict: true, noUnusedLocals: false }
  });
  project.createSourceFile(
    'xstate.d.ts',
    `declare module 'xstate' {
    export type AnyActorRef = unknown;
    export function types<T>(): T;
    export function createMachine(config: unknown): unknown;
  }`
  );
  const source = project.createSourceFile('consumer.ts', output);
  expect(source.getPreEmitDiagnostics().map((d) => d.getMessageText())).toEqual(
    []
  );
}
