import { afterEach, expect, test, vi } from 'vitest';
import { createActor, waitFor } from 'xstate';
import * as handlers from './src/fileHandlers';
import { mediaScannerMachine } from './src/mediaScannerMachine';

const actors: Array<{ stop(): void }> = [];
afterEach(() => {
  actors.splice(0).forEach((actor) => actor.stop());
  vi.restoreAllMocks();
});

test('scans, evaluates and moves selected directories, then resets for a later run', async () => {
  vi.spyOn(handlers, 'scanDirectories').mockResolvedValue(['/media/movie']);
  vi.spyOn(handlers, 'checkFilePermissions').mockResolvedValue({
    dirsToEvaluate: ['/media/movie'],
    dirsToReport: []
  });
  vi.spyOn(handlers, 'evaluateFiles').mockResolvedValue({
    dirsToMove: ['/media/movie/video.mp4'],
    dirsToReport: []
  });
  vi.spyOn(handlers, 'moveFiles').mockResolvedValue({
    errors: [],
    processedFiles: ['/media/movie']
  });
  const actor = createActor(mediaScannerMachine, {
    input: { basePath: '/media', destinationPath: '/large' }
  }).start();
  actors.push(actor);
  actor.send({ type: 'START_SCAN' });
  await waitFor(
    actor,
    (snapshot) =>
      snapshot.matches('idle') && snapshot.context.processedFiles.length === 1
  );
  expect(actor.getSnapshot().context.processedFiles).toEqual(['/media/movie']);
  actor.send({ type: 'START_SCAN' });
  expect(actor.getSnapshot().context.processedFiles).toEqual([]);
});

test('reports inaccessible paths and partial move failures and permits restarting', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(handlers, 'scanDirectories').mockResolvedValue(['/media/movie']);
  const permissions = vi
    .spyOn(handlers, 'checkFilePermissions')
    .mockRejectedValue(new handlers.PermissionError(['/media/movie']));
  vi.spyOn(handlers, 'evaluateFiles').mockResolvedValue({
    dirsToMove: ['/media/movie/video.mp4'],
    dirsToReport: []
  });
  vi.spyOn(handlers, 'moveFiles').mockResolvedValue({
    errors: [
      {
        source: '/media/movie',
        destination: '/large/movie',
        error: new Error('exists')
      }
    ],
    processedFiles: []
  });
  const actor = createActor(mediaScannerMachine, {
    input: { basePath: '/media', destinationPath: '/large' }
  }).start();
  actors.push(actor);
  actor.send({ type: 'START_SCAN' });
  await waitFor(actor, (snapshot) => snapshot.matches('ReportingErrors'));
  expect(actor.getSnapshot().context.dirsToReport).toEqual(['/media/movie']);
  actor.send({ type: 'RESTART' });
  permissions.mockResolvedValue({
    dirsToEvaluate: ['/media/movie'],
    dirsToReport: []
  });
  actor.send({ type: 'START_SCAN' });
  await waitFor(actor, (snapshot) => snapshot.matches('ReportingErrors'));
  expect(actor.getSnapshot().context.dirsToReport).toEqual(['/media/movie']);
});
