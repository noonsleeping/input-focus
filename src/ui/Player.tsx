import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AudioPreview } from '../audio/preview';
import { download, stamp } from '../lib/download';
import { FrameRenderer, type Scene } from '../render';

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

export function Player({ scene, exportSlot }: { scene: Scene; exportSlot: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  const timeRef = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loop, setLoop] = useState(true);
  const [muted, setMuted] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const rendererRef = useRef<FrameRenderer | null>(null);
  const audioRef = useRef<AudioPreview | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const audio = () => (audioRef.current ??= new AudioPreview());

  const { width: outW, height: outH } = scene.cfg.output;
  const aspect = outW / outH;
  const duration = scene.timeline.duration;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const renderer = (rendererRef.current ??= new FrameRenderer());
    renderer.draw(canvas.getContext('2d')!, canvas.width, canvas.height, sceneRef.current, timeRef.current);
  }, []);

  useEffect(
    () => () => {
      rendererRef.current?.dispose();
      audioRef.current?.dispose();
    },
    [],
  );

  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the canvas to the stage while keeping the output aspect ratio.
  const dispW = Math.max(1, Math.min(box.w, box.h * aspect));
  const dispH = dispW / aspect;
  const dpr = window.devicePixelRatio || 1;
  const pxW = Math.max(2, Math.round(Math.min(dispW * dpr, outW)));
  const pxH = Math.max(2, Math.round(pxW / aspect));

  useEffect(() => {
    sceneRef.current = scene;
    timeRef.current = Math.min(timeRef.current, scene.timeline.duration);
    setTime(timeRef.current);
    draw();
  }, [scene, pxW, pxH, draw]);

  useEffect(() => {
    audio().setTrack(scene.audio);
    if (playingRef.current) audio().play(timeRef.current);
  }, [scene]);

  useEffect(() => {
    if (!playing) return;
    audio().play(timeRef.current);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dur = sceneRef.current.timeline.duration;
      let t = timeRef.current + (now - last) / 1000;
      last = now;
      let wrapped = false;
      if (t >= dur) {
        if (loop) {
          t = 0;
          wrapped = true;
        } else {
          t = dur;
          setPlaying(false);
        }
      }
      timeRef.current = t;
      if (wrapped) audio().play(0);
      else audio().sync(t);
      setTime(t);
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio().stop();
    };
  }, [playing, loop, draw]);

  // Render the frame under the playhead at full output resolution (with all effects) and save it as PNG.
  // Pauses first: the preview then shows exactly the saved frame, and PNG encoding (~1 s at 1080p)
  // doesn't compete with playback on the main thread.
  const [savingFrame, setSavingFrame] = useState(false);
  const downloadFrame = async () => {
    setPlaying(false);
    setSavingFrame(true);
    const renderer = new FrameRenderer();
    try {
      await document.fonts.ready;
      const t = timeRef.current;
      const c = document.createElement('canvas');
      c.width = outW;
      c.height = outH;
      renderer.draw(c.getContext('2d', { alpha: false })!, outW, outH, sceneRef.current, t);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
      if (blob) download(blob, `frame-${outW}x${outH}-${t.toFixed(2)}s-${stamp()}.png`);
    } finally {
      renderer.dispose();
      setSavingFrame(false);
    }
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    audio().muted = m;
    if (m) audio().stop();
    else if (playing) audio().play(timeRef.current);
  };

  const togglePlay = () => {
    if (!playing && timeRef.current >= duration) timeRef.current = 0;
    setPlaying(!playing);
  };

  const seek = (t: number) => {
    if (playingRef.current) audio().play(t);
    timeRef.current = t;
    setTime(t);
    draw();
  };

  return (
    <main className="stage">
      <div className="stage-canvas" ref={wrapRef}>
        <canvas ref={canvasRef} width={pxW} height={pxH} style={{ width: dispW, height: dispH }} />
      </div>
      <div className="transport">
        <button className="icon-btn" onClick={togglePlay} title={playing ? '暂停' : '播放'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon-btn" onClick={() => seek(0)} title="回到开头">
          ⏮
        </button>
        <input
          className="scrubber"
          type="range"
          min={0}
          max={duration}
          step={0.001}
          value={time}
          onChange={(e) => {
            setPlaying(false);
            seek(Number(e.target.value));
          }}
        />
        <span className="time">
          {fmt(time)} / {fmt(duration)}
        </span>
        <button
          className="icon-btn"
          onClick={toggleMute}
          disabled={!scene.audio}
          title={!scene.audio ? '键盘音效已关闭' : muted ? '取消静音' : '预览静音'}
        >
          {muted || !scene.audio ? '🔇' : '🔊'}
        </button>
        <label className="loop">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          循环
        </label>
        <button className="btn" onClick={downloadFrame} disabled={savingFrame} title="以输出分辨率保存当前画面">
          {savingFrame ? '保存中…' : '下载当前帧'}
        </button>
        {exportSlot}
      </div>
    </main>
  );
}
