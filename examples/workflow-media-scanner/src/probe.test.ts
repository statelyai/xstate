import { expect, test, vi } from 'vitest';
import { readVideoStreams } from './probe';

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: run }));

test('finds video streams after audio and passes paths as arguments without a shell', async () => {
  run.mockImplementation((_file, _args, _options, callback) =>
    callback(
      null,
      JSON.stringify({
        streams: [
          { codec_type: 'audio' },
          { codec_type: 'video', width: 3840, height: 2160 }
        ]
      })
    )
  );
  const filename = '/media/a movie;$(not-a-command).mp4';
  expect(await readVideoStreams(filename)).toEqual([
    { codec_type: 'video', width: 3840, height: 2160 }
  ]);
  expect(run).toHaveBeenCalledWith(
    'ffprobe',
    ['-v', 'error', '-show_streams', '-of', 'json', '-i', filename],
    expect.objectContaining({ encoding: 'utf8' }),
    expect.any(Function)
  );
});

test('rejects failed subprocesses and malformed output instead of throwing from callbacks', async () => {
  run.mockImplementationOnce((_file, _args, _options, callback) =>
    callback(new Error('ffprobe failed'), '')
  );
  await expect(readVideoStreams('bad.mp4')).rejects.toThrow('ffprobe failed');
  run.mockImplementationOnce((_file, _args, _options, callback) =>
    callback(null, 'invalid JSON')
  );
  await expect(readVideoStreams('bad.mp4')).rejects.toBeInstanceOf(SyntaxError);
  run.mockImplementationOnce((_file, _args, _options, callback) =>
    callback(null, '{}')
  );
  await expect(readVideoStreams('bad.mp4')).rejects.toThrow('streams array');
});
