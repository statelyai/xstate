import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exampleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = resolve(exampleRoot, '../../packages/xstate-effect/docs');

describe('published Effect examples', () => {
  for (const page of readdirSync(docs).filter((name) => name.endsWith('.md'))) {
    const source = readFileSync(resolve(docs, page), 'utf8');
    it(`${page} uses the package title`, () => {
      expect(source).toMatch(/^title: "XState Effect: /m);
    });
    const blocks = [
      ...source.matchAll(
        /<!-- example from examples\/effect-workflows\/src\/(.+?) -->\s+```tsx?\n([\s\S]*?)\n```/g
      )
    ];
    it(`${page} has complete checked examples`, () => {
      const fences = [...source.matchAll(/^```tsx?$/gm)];
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks).toHaveLength(fences.length);
      for (const [, name, code] of blocks) {
        const example = readFileSync(
          resolve(exampleRoot, 'src', name),
          'utf8'
        ).trim();
        expect(code).toBe(example);
        expect(code).toMatch(/^import /);
      }
    });
  }
});

it('keeps the package README examples in sync', () => {
  const source = readFileSync(resolve(docs, '../README.md'), 'utf8');
  const blocks = [
    ...source.matchAll(
      /<!-- example from examples\/effect-workflows\/src\/(.+?) -->\s+```tsx?\n([\s\S]*?)\n```/g
    )
  ];
  expect(blocks).toHaveLength([...source.matchAll(/^```tsx?$/gm)].length);
  for (const [, name, code] of blocks) {
    expect(code).toBe(
      readFileSync(resolve(exampleRoot, 'src', name), 'utf8').trim()
    );
  }
});

describe('runnable examples', () => {
  const cases = [
    ['approval', 'https://example.com/v1.2.0'],
    ['clock', 'expired'],
    [
      'observe',
      { history: ['pending', 'approved'], output: { approved: true } }
    ],
    ['emitted', [{ type: 'reminder', message: 'Review pending' }]],
    ['task', { total: 2 }],
    ['latest-stream', 100],
    ['event-stream', 'rollback requested'],
    ['matching', ['Waiting for review', 'Approved by Ada']],
    ['parallel', 'Build in progress'],
    ['actions', 'approved'],
    ['retry', 'published'],
    ['supervision', 'complete'],
    ['errors', 'Release needs approval'],
    ['atoms', 'approved']
  ] as const;

  it.each(cases)(
    '%s produces its documented result',
    async (name, expected) => {
      const example = await import(`../src/${name}.ts`);
      expect(example.result).toEqual(expected);
    }
  );

  it('shares an actor through a Layer and disposes its runtime', async () => {
    const log = vi.spyOn(console, 'log');
    try {
      await import('../src/actor-service.ts');
      expect(log).toHaveBeenCalledWith('approved');
    } finally {
      log.mockRestore();
    }
  });
});
