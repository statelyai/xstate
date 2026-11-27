import { fileURLToPath } from 'node:url';
import { Project, ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { createActor, setup, types } from 'xstate';
import { applyToSourceFile } from '../src/runner.ts';
import { transforms } from '../src/transforms/index.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));

const input = `import { assign, setup } from 'xstate';
export const counterMachine = setup({
  types: {
    context: {} as { count: number },
    events: {} as { type: 'add'; by: number }
  },
  actions: {
    add: assign(({ context, event }) => ({ count: context.count + event.by }))
  }
}).createMachine({
  context: { count: 0 },
  on: { add: { actions: 'add' } }
});`;

describe('named assign migration', () => {
  it.each([
    { code: input, count: 3 },
    {
      code: input.replace("actions: 'add'", "actions: ['add', 'add']"),
      count: 6
    },
    {
      code: input
        .replace('export const', 'const increment = 1;\nexport const')
        .replace(
          'assign(({ context, event }) => ({ count: context.count + event.by }))',
          'assign({ count: ({ context, event }) => context.count + event.by + increment })'
        ),
      count: 4
    },
    {
      code: input
        .replace('export const', 'const reset = { count: 5 };\nexport const')
        .replace(
          'assign(({ context, event }) => ({ count: context.count + event.by }))',
          'assign(reset)'
        ),
      count: 5
    }
  ])('generates strict TypeScript for the real v6 API', ({ code, count }) => {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        allowImportingTsExtensions: true,
        target: ts.ScriptTarget.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        module: ts.ModuleKind.ESNext,
        baseUrl: root,
        paths: { xstate: ['packages/core/src/index.ts'] }
      }
    });
    const source = project.createSourceFile(`${root}.scratch/counter.ts`, code);
    const report = applyToSourceFile(source, transforms);
    expect(report.perTransform.flatMap((t) => t.sites)).toEqual([]);
    expect(
      source.getPreEmitDiagnostics().map((d) => d.getMessageText())
    ).toEqual([]);
    expect(source.getFullText()).not.toContain('args.actions.add');
    const executable = ts
      .transpile(source.getFullText(), {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext
      })
      .replace(/^import .*?;$/gm, '')
      .replace('export const', 'const');
    const machine = new Function(
      'setup',
      'types',
      `${executable}; return counterMachine;`
    )(setup, types);
    const actor = createActor(machine).start();
    const event = { type: 'add', by: 3 };
    actor.send(event);
    expect(actor.getSnapshot().context).toEqual({ count });
    actor.stop();
    expect(applyToSourceFile(source, transforms).changed).toBe(false);
  });

  it('reports unsupported named assignments instead of claiming a clean migration', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile(
      'counter.ts',
      input.replace(
        '({ context, event }) => ({ count: context.count + event.by })',
        '({ context, event }, params) => ({ count: context.count + event.by + params.extra })'
      )
    );
    const report = applyToSourceFile(source, transforms);
    expect(report.perTransform.flatMap((t) => t.sites)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ api: 'assign' }),
        expect.objectContaining({ api: 'actions' })
      ])
    );
    expect(source.getFullText()).toContain('assign(');
  });
});
