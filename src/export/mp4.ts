import {
  AudioBufferSource,
  BufferTarget,
  canEncodeAudio,
  CanvasSource,
  canEncodeVideo,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
} from 'mediabunny';
import type { Quality } from '../config';
import { SAMPLE_RATE } from '../audio/synth';
import { FrameRenderer, type Scene } from '../render';

const QUALITY = { standard: QUALITY_MEDIUM, high: QUALITY_HIGH, max: QUALITY_VERY_HIGH } as const;

export class ExportCancelled extends Error {
  constructor() {
    super('导出已取消');
  }
}

export async function exportMp4(
  scene: Scene,
  opts: { width: number; height: number; fps: number; quality: Quality },
  onProgress: (p: number) => void,
  signal: AbortSignal,
  onWarning: (msg: string) => void = () => {},
): Promise<Blob> {
  const { width, height, fps } = opts;
  const quality = QUALITY[opts.quality];
  if (!(await canEncodeVideo('avc', { width, height, quality }))) {
    throw new Error(`当前浏览器无法以 ${width}×${height} 编码 H.264，请换用更低分辨率或最新版 Chrome / Edge。`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, { codec: 'avc', quality, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (scene.audio) {
    const audioCodec = (await canEncodeAudio('aac', { numberOfChannels: 1, sampleRate: SAMPLE_RATE, quality: QUALITY_HIGH }))
      ? 'aac'
      : (await canEncodeAudio('opus', { numberOfChannels: 1, sampleRate: SAMPLE_RATE, quality: QUALITY_HIGH }))
        ? 'opus'
        : null;
    if (audioCodec) {
      if (audioCodec === 'opus') onWarning('浏览器不支持 AAC 编码，音轨改用 Opus（部分播放器如 QuickTime 可能没有声音）');
      audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH });
      output.addAudioTrack(audioSource);
    } else {
      onWarning('浏览器不支持音频编码，本次导出不含键盘音效');
    }
  }

  await output.start();

  const renderer = new FrameRenderer();
  const frames = Math.max(1, Math.round(scene.timeline.duration * fps));
  let audioDone: Promise<void> = Promise.resolve();
  try {
    if (audioSource && scene.audio) {
      // Trim to the video length so the tracks end together. Fed concurrently with video so the
      // muxer can interleave without either track waiting on the other.
      const pcm = scene.audio.subarray(0, Math.round((frames / fps) * SAMPLE_RATE));
      const buf = new AudioBuffer({ length: pcm.length, numberOfChannels: 1, sampleRate: SAMPLE_RATE });
      buf.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
      const src = audioSource;
      audioDone = src.add(buf).then(() => src.close());
    }
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new ExportCancelled();
      renderer.draw(ctx, width, height, scene, i / fps);
      await source.add(i / fps, 1 / fps);
      onProgress((i + 1) / frames);
    }
    await audioDone;
    await output.finalize();
  } catch (e) {
    audioDone.catch(() => {});
    await output.cancel().catch(() => {});
    throw e;
  } finally {
    renderer.dispose();
  }
  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}
