import { afterEach, expect, test, vi } from 'vitest';
import * as probe from './probe';
import { evaluateFiles, moveFiles } from './fileHandlers';

const { readDirectory, moveDirectory } = vi.hoisted(() => ({
  readDirectory: vi.fn(),
  moveDirectory: vi.fn()
}));
vi.mock('node:fs/promises', () => ({
  readdir: readDirectory,
  access: vi.fn()
}));
vi.mock('fs-extra', () => ({ move: moveDirectory }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test('continues after a corrupt file and accepts uppercase extensions', async () => {
  readDirectory.mockResolvedValue(['bad.mp4', 'good.MP4']);
  vi.spyOn(probe, 'readVideoStreams')
    .mockRejectedValueOnce(new Error('corrupt'))
    .mockResolvedValueOnce([{ width: 3840, height: 2160 }]);
  expect(await evaluateFiles(['/library/movie'], ['mp4'])).toEqual({
    dirsToMove: ['/library/movie/good.MP4'],
    dirsToReport: ['/library/movie/bad.mp4']
  });
});

test('moves each parent directory once and never overwrites the destination', async () => {
  moveDirectory.mockResolvedValue(undefined);
  expect(
    await moveFiles(
      ['/library/movie/one.mp4', '/library/movie/two.mp4'],
      '/large'
    )
  ).toEqual({ errors: [], processedFiles: ['/library/movie'] });
  expect(moveDirectory).toHaveBeenCalledExactlyOnceWith(
    '/library/movie',
    '/large/movie',
    { overwrite: false }
  );
});

test('reports destination collisions without deleting or retrying existing data', async () => {
  moveDirectory.mockRejectedValue(new Error('destination exists'));
  const result = await moveFiles(['/library/movie/video.mp4'], '/large');
  expect(result.errors).toMatchObject([
    { source: '/library/movie', destination: '/large/movie' }
  ]);
  expect(result.processedFiles).toEqual([]);
});
