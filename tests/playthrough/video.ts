import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type VideoSegment = { name: string; startMs: number; endMs: number };

/**
 * Cuts each segment out of `videoFile` into `<outDir>/<name>.webm` with the system `ffmpeg`.
 * Returns the clips written. Without `ffmpeg` on PATH it returns nothing; the full video and the
 * segment timestamps are still attached to the test report.
 */
export async function cutVideoSegments(videoFile: string, segments: VideoSegment[], outDir: string): Promise<string[]> {
  try {
    await run('ffmpeg', ['-version']);
  } catch {
    console.warn('[playthrough] ffmpeg not found; skipping cutscene clips (full video is attached).');
    return [];
  }
  const clips: string[] = [];
  for (const s of segments) {
    const out = path.join(outDir, `${s.name}.webm`);
    // Small lead-in so the clip starts just before the triggering click.
    const start = Math.max(0, s.startMs - 500) / 1000;
    const duration = (s.endMs - s.startMs + 1000) / 1000;
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-ss', start.toFixed(2), '-i', videoFile, '-t', duration.toFixed(2),
      '-c:v', 'libvpx', '-b:v', '1M', '-deadline', 'realtime', '-cpu-used', '8', '-an',
      out,
    ]);
    clips.push(out);
  }
  return clips;
}
