import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { applyToSourceFile } from '../src/runner.ts';

describe('migration output validation', () => {
  it('rejects malformed transformed output before it can be saved', () => {
    const source = new Project({
      useInMemoryFileSystem: true
    }).createSourceFile('consumer.ts', 'const value = 1;');
    expect(() =>
      applyToSourceFile(source, [
        {
          name: 'invalid',
          description: 'invalid fixture',
          apply: (file) => {
            file.replaceWithText(
              'type Payload = { first: number;; second: string };'
            );
            return { changed: true, notes: [] };
          }
        }
      ])
    ).toThrow('Refusing to write invalid migration output');
  });
});
