import { Project, SourceFile } from 'ts-morph';
import type { Transform } from '../src/types.ts';

/**
 * Applies a transform to an in-memory source string and returns the resulting
 * text plus the transform result.
 */
export function applyTransform(
  transform: Transform,
  code: string,
  fileName = 'test.ts'
): { output: string; changed: boolean; notes: string[] } {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile: SourceFile = project.createSourceFile(fileName, code);
  const result = transform.apply(sourceFile);
  return {
    output: sourceFile.getFullText(),
    changed: result.changed,
    notes: result.notes
  };
}

/** Normalizes whitespace for lenient structural comparison. */
export function normalize(code: string): string {
  return code
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}
