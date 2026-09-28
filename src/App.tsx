import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONFIG, mergeConfig, type Config } from './config';
import { ExportCancelled, exportMp4 } from './export/mp4';
import { download, stamp } from './lib/download';
import { buildScene } from './render';
import { Panel } from './ui/Panel';
import { Player } from './ui/Player';

const STORAGE_KEY = 'fast-input:config:v1';

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return mergeConfig(DEFAULT_CONFIG, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return DEFAULT_CONFIG;
}

export function App() {
  const [cfg, setCfg] = useState<Config>(loadConfig);
  const [fontsVersion, setFontsVersion] = useState(0);
  const [exporting, setExporting] = useState<{ progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const update = useCallback((fn: (d: Config) => void) => {
    setCfg((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
  }, [cfg]);

  // Text is measured once per scene, so re-measure after web fonts for the current text finish loading.
  useEffect(() => {
    let alive = true;
    document.fonts
      .load('16px "Noto Sans SC"', cfg.text)
      .catch(() => {})
      .then(() => document.fonts.ready)
      .then(() => alive && setFontsVersion((v) => v + 1));
    return () => {
      alive = false;
    };
  }, [cfg.text]);

  const scene = useMemo(() => buildScene(cfg), [cfg, fontsVersion]);

  const startExport = async () => {
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    setExporting({ progress: 0 });
    try {
      await document.fonts.ready;
      const { width, height, fps, quality } = cfg.output;
      const blob = await exportMp4(scene, { width, height, fps, quality }, (p) => setExporting({ progress: p }), ac.signal, setError);
      download(blob, `typing-${width}x${height}-${stamp()}.mp4`);
    } catch (e) {
      if (!(e instanceof ExportCancelled)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
      abortRef.current = null;
    }
  };

  const exportSlot = (
    <button className="btn primary" onClick={startExport} disabled={!!exporting || !cfg.text}>
      导出 MP4
    </button>
  );

  return (
    <div className="app">
      <Panel cfg={cfg} update={update} onReset={() => setCfg(DEFAULT_CONFIG)} />
      <Player scene={scene} exportSlot={exportSlot} />
      {exporting && (
        <div className="modal">
          <div className="modal-card">
            <div className="modal-title">正在导出 MP4…</div>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${exporting.progress * 100}%` }} />
            </div>
            <div className="modal-row">
              <span>{Math.round(exporting.progress * 100)}%</span>
              <button className="btn" onClick={() => abortRef.current?.abort()}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
}
