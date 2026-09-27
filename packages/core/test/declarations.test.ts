import path from 'node:path';
import ts from 'typescript';

const FIXTURES = [
  'narrowed-context',
  'strict-targets',
  'registered-child-parent'
] as const;

const COMPILER_OPTIONS: ts.CompilerOptions = {
  strict: true,
  declaration: true,
  emitDeclarationOnly: true,
  allowImportingTsExtensions: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  types: []
};

const fixturePath = (name: string) =>
  path.resolve(__dirname, `fixtures/declarations/${name}.ts`);

const indexPath = path.resolve(__dirname, '../src/index.ts');

function emitFixture(name: string) {
  const file = fixturePath(name);
  const program = ts.createProgram([file, indexPath], COMPILER_OPTIONS);
  const emitted = new Map<string, string>();
  const result = program.emit(undefined, (fileName, contents) =>
    emitted.set(fileName, contents)
  );
  const source = program.getSourceFile(file)!;
  const diagnostics = [
    ...program.getSyntacticDiagnostics(source),
    ...program.getSemanticDiagnostics(source),
    ...program.getDeclarationDiagnostics(source),
    ...result.diagnostics
  ];
  return { program, file, emitted, diagnostics };
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getCanonicalFileName: (fileName) => fileName,
    getNewLine: () => '\n'
  });
}

/** Every xstate type the emitted declaration names, by the module it came from. */
function referencedTypes(declaration: string) {
  const referenced = new Map<string, Set<string>>();
  const add = (specifier: string, name: string) => {
    if (!referenced.has(specifier)) referenced.set(specifier, new Set());
    referenced.get(specifier)!.add(name);
  };
  for (const match of declaration.matchAll(/import\("([^"]+)"\)\.(\w+)/g)) {
    add(match[1], match[2]);
  }
  for (const match of declaration.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g
  )) {
    for (const entry of match[1].split(',')) {
      const name = entry.trim().split(/\s+as\s+/)[0];
      if (name) add(match[2], name);
    }
  }
  return referenced;
}

describe.each(FIXTURES)(
  'declaration emit (%s)',
  (name) => {
    const { program, file, emitted, diagnostics } = emitFixture(name);
    const declaration = [...emitted].find(([fileName]) =>
      fileName.endsWith(`${name}.d.ts`)
    )?.[1];

    it('emits without diagnostics', () => {
      expect(formatDiagnostics(diagnostics)).toBe('');
      expect(declaration).toBeDefined();
      if (name === 'registered-child-parent') {
        expect(Buffer.byteLength(declaration!)).toBeLessThan(500_000);
        expect(declaration!.match(/readonly c0: \{/g)).toHaveLength(1);
      }
    });

    // A consumer importing 'xstate' can only name what the package entry point
    // exports. Emit that reaches into an internal module (a private marker
    // interface, a helper type declared but never re-exported) compiles here and
    // fails there with TS2742/TS4023, so every name emit reaches for must be
    // public — not merely exported from the module it lives in.
    it('names only types the package entry point exports', () => {
      if (!declaration) return;
      const checker = program.getTypeChecker();
      const resolve = (symbol: ts.Symbol) =>
        symbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol;
      const indexSymbol = checker.getSymbolAtLocation(
        program.getSourceFile(indexPath)!
      )!;
      const publicSymbols = new Set(
        checker.getExportsOfModule(indexSymbol).map(resolve)
      );

      const privateNames: string[] = [];
      for (const [specifier, names] of referencedTypes(declaration)) {
        const source = program.getSourceFile(
          path.resolve(path.dirname(file), specifier)
        );
        if (!source) continue; // not one of ours (node builtins, zod, …)
        const moduleSymbol = checker.getSymbolAtLocation(source);
        if (!moduleSymbol) continue;
        const exports = new Map(
          checker
            .getExportsOfModule(moduleSymbol)
            .map((symbol) => [symbol.getName(), symbol])
        );
        for (const referenced of names) {
          const symbol = exports.get(referenced);
          if (!symbol || !publicSymbols.has(resolve(symbol))) {
            privateNames.push(`${path.basename(specifier)} → ${referenced}`);
          }
        }
      }

      expect(privateNames).toEqual([]);
    });

    if (name === 'registered-child-parent') {
      it('preserves types in the emitted declaration', () => {
        const consumerFile = fixturePath('registered-child-consumer');
        const declarationFile = [...emitted.keys()].find((fileName) =>
          fileName.endsWith('registered-child-parent.d.ts')
        )!;
        const host = ts.createCompilerHost({
          ...COMPILER_OPTIONS,
          noEmit: true
        });
        const readFile = host.readFile.bind(host);
        const fileExists = host.fileExists.bind(host);
        host.readFile = (fileName) =>
          fileName === file
            ? undefined
            : (emitted.get(fileName) ?? readFile(fileName));
        host.fileExists = (fileName) =>
          fileName !== file && (emitted.has(fileName) || fileExists(fileName));
        const consumerProgram = ts.createProgram(
          [consumerFile],
          { ...COMPILER_OPTIONS, emitDeclarationOnly: false, noEmit: true },
          host
        );
        expect(consumerProgram.getSourceFile(declarationFile)).toBeDefined();
        expect(consumerProgram.getSourceFile(file)).toBeUndefined();
        expect(
          formatDiagnostics(ts.getPreEmitDiagnostics(consumerProgram))
        ).toBe('');
      });
    }
  },
  30_000
);

it('emits a registered child across many invoked states', () => {
  const count = 30;
  const eventKeys = Array.from({ length: count * 8 }, (_, i) => `e${i}`);
  const file = fixturePath('many-invoked-states');
  const source = `
import { setup, types } from '../../../src/index.ts';
import { childMachine } from './registered-child.ts';

const parentSetup = setup({
  schemas: {
    context: types<{ token: string }>(),
    events: { ${eventKeys.map((key) => `${key}: types<{ value: string }>()`).join(',')} }
  },
  actors: { child: childMachine }
});

${Array.from(
  { length: count },
  (_, i) =>
    `const p${i} = parentSetup.createStateConfig({
    invoke: {
      src: 'child',
      input: ({ context }) => ({ token: context.token })
    },
    on: { ${eventKeys
      .slice(i * 8, (i + 1) * 8)
      .map((key) => `${key}: { target: 'p${(i + 1) % count}' }`)
      .join(',')} }
  });`
).join('\n')}

export const parentMachine = parentSetup.createMachine({
  context: { token: '' },
  initial: 'p0',
  states: { ${Array.from({ length: count }, (_, i) => `p${i}`).join(',')} }
});
`;
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (fileName) =>
    fileName === file ? source : readFile(fileName);
  host.fileExists = (fileName) => fileName === file || fileExists(fileName);
  const program = ts.createProgram([file, indexPath], COMPILER_OPTIONS, host);
  let declaration = '';
  const emitResult = program.emit(undefined, (fileName, contents) => {
    if (fileName.endsWith('many-invoked-states.d.ts')) {
      declaration = contents;
    }
  });
  const diagnostics = [
    ...ts.getPreEmitDiagnostics(program),
    ...emitResult.diagnostics
  ].filter((diagnostic) => diagnostic.file?.fileName === file);
  expect(formatDiagnostics(diagnostics)).toBe('');
  expect(Buffer.byteLength(declaration)).toBeLessThan(100_000);
  expect(declaration.match(/readonly p0: \{/g)).toHaveLength(1);
}, 30_000);
