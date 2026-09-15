import path from 'node:path';
import ts from 'typescript';

it('emits exported machines with narrowed context and function transitions', () => {
  const program = ts.createProgram(
    [path.resolve(__dirname, 'fixtures/declarations/narrowed-context.ts')],
    {
      strict: true,
      declaration: true,
      emitDeclarationOnly: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      types: []
    }
  );
  const emitted: string[] = [];
  const result = program.emit(undefined, (fileName) => emitted.push(fileName));
  const fixture = program.getSourceFile(
    path.resolve(__dirname, 'fixtures/declarations/narrowed-context.ts')
  )!;
  const diagnostics = [
    ...program.getSyntacticDiagnostics(fixture),
    ...program.getSemanticDiagnostics(fixture),
    ...program.getDeclarationDiagnostics(fixture),
    ...result.diagnostics
  ];
  expect(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => '\n'
    })
  ).toBe('');
  expect(
    emitted.some((fileName) => fileName.endsWith('narrowed-context.d.ts'))
  ).toBe(true);
}, 30_000);
