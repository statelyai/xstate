import { execFile } from 'node:child_process';

export type VideoStream = { width: number; height: number };

/** Reject subprocess and malformed-output failures through the same promise. */
export async function readVideoStreams(
  filename: string,
  signal?: AbortSignal
): Promise<VideoStream[]> {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-show_streams', '-of', 'json', '-i', filename],
      { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 30000, signal },
      (error, output) => {
        if (error)
          reject(
            error instanceof Error
              ? error
              : new Error('ffprobe failed', { cause: error })
          );
        else resolve(output);
      }
    );
  });
  const metadata: unknown = JSON.parse(stdout);
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('streams' in metadata) ||
    !Array.isArray(metadata.streams)
  ) {
    throw new Error('ffprobe output must contain a streams array');
  }
  return metadata.streams.filter(
    (stream): stream is VideoStream =>
      Boolean(stream) &&
      typeof stream === 'object' &&
      stream.codec_type === 'video' &&
      typeof stream.width === 'number' &&
      typeof stream.height === 'number' &&
      Number.isFinite(stream.width) &&
      Number.isFinite(stream.height)
  );
}
