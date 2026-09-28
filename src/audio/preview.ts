import { SAMPLE_RATE } from './synth';

/** Plays the scene's key track in sync with the preview clock. */
export class AudioPreview {
  private ctx: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private data: Float32Array | null = null;
  private buffer: AudioBuffer | null = null;
  private startedAt = 0;
  private startOffset = 0;
  muted = false;

  setTrack(data: Float32Array | null) {
    if (data === this.data) return;
    this.data = data;
    this.buffer = null;
  }

  play(offset: number) {
    this.stop();
    if (this.muted || !this.data) return;
    this.ctx ??= new AudioContext({ sampleRate: SAMPLE_RATE });
    // Resolves only after a user gesture; sync() restarts playback once the context is running.
    void this.ctx.resume();
    if (!this.buffer) {
      this.buffer = this.ctx.createBuffer(1, this.data.length, SAMPLE_RATE);
      this.buffer.copyToChannel(this.data as Float32Array<ArrayBuffer>, 0);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.ctx.destination);
    src.start(0, Math.max(0, offset));
    this.src = src;
    this.startedAt = this.ctx.currentTime;
    this.startOffset = offset;
  }

  stop() {
    if (!this.src) return;
    this.src.stop();
    this.src.disconnect();
    this.src = null;
  }

  /** Called every preview frame while playing: restart if audio drifted (e.g. context was suspended). */
  sync(t: number) {
    if (this.muted || !this.data) return;
    if (!this.src || !this.ctx) return this.play(t);
    if (this.ctx.state !== 'running') return;
    const pos = this.startOffset + (this.ctx.currentTime - this.startedAt);
    if (Math.abs(pos - t) > 0.08) this.play(t);
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
