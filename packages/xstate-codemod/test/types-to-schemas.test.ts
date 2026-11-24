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

  it('expands a same-file event union alias into an events map', () => {
    const input = `import { createMachine } from 'xstate';
type Inc = { type: 'inc'; by: number };
type Ev = Inc | { type: 'reset' };
createMachine({
  types: {} as { context: { a: number }; events: Ev }
});`;
    const { output, changed, sites } = applyTransform(typesToSchemas, input);
    expect(changed).toBe(true);
    expect(output).toContain('context: types<{ a: number }>()');
    expect(output).toContain('"inc": types<{ by: number }>()');
    expect(output).toContain('"reset": types<{}>()');
    expect(output).not.toMatch(/\btypes: /);
    expect(sites).toEqual([]);
  });

  it('writes `events: types<E>()` when the union cannot be expanded', () => {
    const input = `import { createMachine } from 'xstate';
import type { MyEvents } from './events';
type Generic<T> = { type: 'a'; value: T };
createMachine({
  types: {} as { context: { a: number }; events: MyEvents }
});
createMachine({
  types: {} as { events: Generic<string> | { type: 'b' } }
});`;
    const { output, changed, sites } = applyTransform(typesToSchemas, input);
    expect(changed).toBe(true);
    expect(output).toContain('context: types<{ a: number }>()');
    expect(output).toContain('events: types<MyEvents>()');
    expect(output).toContain(
      "events: types<Generic<string> | { type: 'b' }>()"
    );
    expect(output).not.toContain('TODO(xstate-codemod)');
    expect(output).not.toMatch(/\btypes: /);
    // Both fallbacks are reported: the entry loads but does not type-check.
    expect(sites).toHaveLength(2);
    for (const site of sites) {
      expect(site.api).toBe('types');
      expect(site.hint).toContain('does not type-check');
    }
  });

  it('converts the per-key `types: { context: {} as C, ... }` form in setup and createMachine', () => {
    const input = `import { createMachine, setup } from 'xstate';
type TimerEvent = { type: 'tick' } | { type: 'set'; count: number };
setup({
  types: {
    context: {} as { count: number },
    events: {} as
      | { type: 'trigger'; title: string }
      | { type: 'close' },
    input: {} as { start: number }
  }
});
createMachine({
  types: {
    context: {} as { a: number },
    events: {} as TimerEvent
  }
});`;
    const { output, changed, sites } = applyTransform(typesToSchemas, input);
    expect(changed).toBe(true);
    expect(output).toContain('context: types<{ count: number }>()');
    expect(output).toContain('"trigger": types<{ title: string }>()');
    expect(output).toContain('"close": types<{}>()');
    expect(output).toContain('input: types<{ start: number }>()');
    expect(output).toContain('context: types<{ a: number }>()');
    expect(output).toContain('"tick": types<{}>()');
    expect(output).toContain('"set": types<{ count: number }>()');
    expect(output).not.toMatch(/\btypes: /);
    expect(sites).toEqual([]);
    expectValidMigration(output);
  });

  it('builds an events map from a union with JSDoc between members', () => {
    const input = `import { createMachine } from 'xstate';
createMachine({
  types: {
    events: {} as
      /** Due. */
      | { type: 'refreshDue' }
      /** Refused. */
      | { accessToken: string; type: 'sessionRefused' }
  }
});`;
    const { output, sites } = applyTransform(typesToSchemas, input);
    expect(output).toContain('"refreshDue": types<{}>()');
    expect(output).toContain(
      '"sessionRefused": types<{ accessToken: string }>()'
    );
    expect(sites).toEqual([]);
    expectValidMigration(output);
  });

  it('reports `types` initializers it cannot read as a manual site', () => {
    const input = `import { createMachine } from 'xstate';
const machineTypes = {};
createMachine({
  types: machineTypes
});
createMachine({
  types: { context: {} as { a: number }, events: makeEvents() }
});`;
    const { output, changed, sites } = applyTransform(typesToSchemas, input);
    expect(changed).toBe(false);
    expect(output).toBe(input);
    expect(sites).toEqual([
      expect.objectContaining({ api: 'types', line: 4, column: 3 }),
      expect.objectContaining({ api: 'types', line: 7, column: 3 })
    ]);
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
    export function setup(config: unknown): unknown;
  }`
  );
  const source = project.createSourceFile('consumer.ts', output);
  expect(source.getPreEmitDiagnostics().map((d) => d.getMessageText())).toEqual(
    []
  );
}
