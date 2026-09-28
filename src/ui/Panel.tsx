import { randomSeed, RESOLUTION_PRESETS, type Config } from '../config';
import { getTemplate, TEMPLATES } from '../scene/templates';
import { Field, Section, Segmented, Select, Slider, Toggle } from './controls';

type Update = (fn: (draft: Config) => void) => void;

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

const LENS_EFFECTS: { key: keyof Config['lens']; label: string; hint: string }[] = [
  { key: 'dof', label: '景深虚化', hint: '对焦在最新的词上' },
  { key: 'vignette', label: '暗角', hint: '' },
  { key: 'chroma', label: '色差', hint: '画面边缘红蓝分离' },
  { key: 'grain', label: '胶片颗粒', hint: '' },
];

export function Panel({ cfg, update, onReset }: { cfg: Config; update: Update; onReset: () => void }) {
  const { speed, cursor, output } = cfg;
  const anyAccel = speed.enMode === 'B' || speed.cnMode === 'B';

  return (
    <aside className="panel">
      <header className="panel-head">
        <h1>Input Focus</h1>
        <button className="link" onClick={onReset}>
          恢复默认
        </button>
      </header>

      <Section title="文案">
        <Field label="输入文字" hint="单行，支持中英混排">
          <textarea
            className="textarea"
            rows={3}
            value={cfg.text}
            onChange={(e) => update((d) => void (d.text = e.target.value.replace(/[\r\n]+/g, ' ')))}
          />
        </Field>
        <Field label="占位提示" hint="输入框为空时显示">
          <input className="input" value={cfg.placeholder} onChange={(e) => update((d) => void (d.placeholder = e.target.value))} />
        </Field>
        <button className="btn" onClick={() => update((d) => void (d.seed = randomSeed()))}>
          ↻ 换一种节奏
        </button>
        <Field label="文字出现方式">
          <Segmented
            value={cfg.charAnim.mode}
            options={[
              { value: 'none', label: '直接出现' },
              { value: 'fade', label: '淡入' },
              { value: 'rise', label: '淡入 + 上浮' },
            ]}
            onChange={(v) => update((d) => void (d.charAnim.mode = v))}
          />
        </Field>
        {cfg.charAnim.mode !== 'none' && (
          <Field label="动效时长">
            <Slider
              value={cfg.charAnim.duration}
              min={0.05}
              max={0.5}
              step={0.01}
              format={(v) => `${Math.round(v * 1000)} ms`}
              onChange={(v) => update((d) => void (d.charAnim.duration = v))}
            />
          </Field>
        )}
      </Section>

      <Section title="节奏">
        <Field label="英文">
          <Segmented
            value={speed.enMode}
            options={[
              { value: 'A', label: '逐字母 + 词间停顿' },
              { value: 'B', label: '加速' },
            ]}
            onChange={(v) => update((d) => void (d.speed.enMode = v))}
          />
        </Field>
        <Field label="中文">
          <Segmented
            value={speed.cnMode}
            options={[
              { value: 'A', label: '逐词 + 词间停顿' },
              { value: 'B', label: '逐字加速' },
            ]}
            onChange={(v) => update((d) => void (d.speed.cnMode = v))}
          />
        </Field>
        <Field label="整体速度">
          <Slider value={speed.global} min={0.25} max={3} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => update((d) => void (d.speed.global = v))} />
        </Field>
        <Field label={anyAccel ? '英文起始速度' : '英文速度'}>
          <Slider value={speed.wpm} min={30} max={150} step={5} format={(v) => `${v} WPM`} onChange={(v) => update((d) => void (d.speed.wpm = v))} />
        </Field>
        <Field label={anyAccel ? '中文起始速度' : '中文速度'}>
          <Slider value={speed.cpm} min={40} max={250} step={5} format={(v) => `${v} 字/分`} onChange={(v) => update((d) => void (d.speed.cpm = v))} />
        </Field>
        {speed.enMode === 'A' && (
          <Field label="英文词间停顿">
            <Slider value={speed.wordGap} min={1} max={5} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => update((d) => void (d.speed.wordGap = v))} />
          </Field>
        )}
        {anyAccel && (
          <div className="subgroup">
            <div className="subgroup-title">加速曲线</div>
            <Field label="曲线">
              <Segmented
                value={speed.accel.curve}
                options={[
                  { value: 's', label: 'S 形平滑' },
                  { value: 'easeIn', label: '缓入' },
                ]}
                onChange={(v) => update((d) => void (d.speed.accel.curve = v))}
              />
            </Field>
            <Field label="峰值倍数">
              <Slider value={speed.accel.peak} min={2} max={15} step={0.5} format={(v) => `${v}×`} onChange={(v) => update((d) => void (d.speed.accel.peak = v))} />
            </Field>
            {speed.accel.curve === 's' && (
              <Field label="加速段占比" hint="之后保持峰值">
                <Slider
                  value={speed.accel.portion}
                  min={0.3}
                  max={1}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => update((d) => void (d.speed.accel.portion = v))}
                />
              </Field>
            )}
            <Toggle label="轻微节奏抖动" checked={speed.accel.jitter} onChange={(v) => update((d) => void (d.speed.accel.jitter = v))} />
          </div>
        )}
      </Section>

      <Section title="光标">
        <Field label="开场闪烁次数">
          <Slider value={cursor.blinkCount} min={0} max={10} step={1} format={(v) => `${v} 次`} onChange={(v) => update((d) => void (d.cursor.blinkCount = v))} />
        </Field>
        <Field label="形状">
          <Select
            value={cursor.shape}
            options={[
              { value: 'thin', label: '细竖线' },
              { value: 'thick', label: '粗竖线' },
              { value: 'underline', label: '下划线' },
              { value: 'block', label: '实心方块' },
              { value: 'hollow', label: '空心方块' },
            ]}
            onChange={(v) => update((d) => void (d.cursor.shape = v))}
          />
        </Field>
        <Field label="闪烁方式">
          <Segmented
            value={cursor.blinkStyle}
            options={[
              { value: 'hard', label: '硬切' },
              { value: 'smooth', label: '柔和渐隐' },
            ]}
            onChange={(v) => update((d) => void (d.cursor.blinkStyle = v))}
          />
        </Field>
        <Field label="颜色">
          <div className="row">
            <Toggle label="跟随模板" checked={cursor.color === null} onChange={(v) => update((d) => void (d.cursor.color = v ? null : '#1a73e8'))} />
            {cursor.color !== null && (
              <input type="color" className="color" value={cursor.color} onChange={(e) => update((d) => void (d.cursor.color = e.target.value))} />
            )}
          </div>
        </Field>
      </Section>

      <Section title="模板">
        <Field label="输入框">
          <Select
            value={cfg.template.id}
            options={Object.values(TEMPLATES).map((t) => ({ value: t.id as Config['template']['id'], label: t.name }))}
            onChange={(v) => update((d) => void (d.template.id = v))}
          />
        </Field>
        {(cfg.template.id === 'claude-code' || cfg.template.id === 'codex') && (
          <Field label="模型" hint="可从列表选，也可直接输入">
            <input
              className="input"
              list={`models-${cfg.template.id}`}
              value={cfg.template.model[cfg.template.id]}
              onChange={(e) => update((d) => void (d.template.model[cfg.template.id as 'codex'] = e.target.value))}
            />
            <datalist id={`models-${cfg.template.id}`}>
              {getTemplate(cfg.template.id).modelPresets?.map((m) => <option key={m} value={m} />)}
            </datalist>
          </Field>
        )}
        <Field label={getTemplate(cfg.template.id).titleLabel} hint="留空则不显示">
          <input className="input" value={cfg.template.logoText} onChange={(e) => update((d) => void (d.template.logoText = e.target.value))} />
        </Field>
        <Field label="字号">
          <Slider
            value={cfg.template.fontScale}
            min={0.8}
            max={1.3}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update((d) => void (d.template.fontScale = v))}
          />
        </Field>
      </Section>

      <Section title="镜头">
        <Toggle
          label="开场全景，再推近到光标"
          checked={speed.openingWide}
          onChange={(v) => update((d) => void (d.speed.openingWide = v))}
        />
        <Field label="特写倍率" hint={speed.openingWide ? undefined : '开场即为此倍率'}>
          <Slider value={speed.closeUp} min={1.2} max={4} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => update((d) => void (d.speed.closeUp = v))} />
        </Field>
        <Field label="水平构图" hint="焦点在画面中的位置">
          <Slider
            value={speed.compositionX}
            min={0.2}
            max={0.8}
            step={0.01}
            format={(v) => (Math.abs(v - 0.5) < 0.005 ? '居中' : v < 0.5 ? `偏左 ${Math.round(v * 100)}%` : `偏右 ${Math.round(v * 100)}%`)}
            onChange={(v) => update((d) => void (d.speed.compositionX = v))}
          />
        </Field>
        <Field label="垂直构图" hint="输入框在画面中的高度">
          <Slider
            value={speed.compositionY}
            min={0.2}
            max={0.8}
            step={0.01}
            format={(v) => (Math.abs(v - 0.5) < 0.005 ? '居中' : v < 0.5 ? `偏上 ${Math.round(v * 100)}%` : `偏下 ${Math.round(v * 100)}%`)}
            onChange={(v) => update((d) => void (d.speed.compositionY = v))}
          />
        </Field>
        <Field label="跟随灵敏度">
          <Segmented
            value={speed.cameraSensitivity}
            options={[
              { value: 'slow', label: '慢' },
              { value: 'mid', label: '中' },
              { value: 'fast', label: '快' },
            ]}
            onChange={(v) => update((d) => void (d.speed.cameraSensitivity = v))}
          />
        </Field>
        <Field label="结尾停留">
          <Slider value={speed.tailHold} min={0} max={5} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(v) => update((d) => void (d.speed.tailHold = v))} />
        </Field>
        <Toggle label="结尾拉远，展示完整文案" checked={speed.pullback} onChange={(v) => update((d) => void (d.speed.pullback = v))} />
      </Section>

      <Section title="屏幕模拟">
        <Segmented
          value={cfg.screen.mode}
          options={[
            { value: 'none', label: '无' },
            { value: 'phone', label: '手机翻拍' },
            { value: 'crt', label: 'CRT' },
            { value: 'lcd', label: 'LCD 特写' },
          ]}
          onChange={(v) => update((d) => void (d.screen.mode = v))}
        />
        {cfg.screen.mode !== 'none' && (
          <Field label="强度">
            <Slider value={cfg.screen.strength} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.screen.strength = v))} />
          </Field>
        )}
        {cfg.screen.mode === 'lcd' && <div className="note">像素网格在镜头推近时才看得清，建议特写倍率 ≥ 2.5×</div>}
      </Section>

      <Section title="镜头质感">
        {LENS_EFFECTS.map(({ key, label, hint }) => (
          <div key={key} className="field">
            <Toggle label={label} checked={cfg.lens[key].enabled} onChange={(v) => update((d) => void (d.lens[key].enabled = v))} />
            {cfg.lens[key].enabled && (
              <>
                {hint && <div className="note">{hint}</div>}
                <Slider value={cfg.lens[key].amount} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.lens[key].amount = v))} />
              </>
            )}
          </div>
        ))}
      </Section>

      <Section title="键盘音效">
        <Toggle label="开启键盘音效" checked={cfg.audio.enabled} onChange={(v) => update((d) => void (d.audio.enabled = v))} />
        {cfg.audio.enabled && (
          <>
            <Field label="音色">
              <Segmented
                value={cfg.audio.profile}
                options={[
                  { value: 'mechanical', label: '机械键盘' },
                  { value: 'membrane', label: '薄膜键盘' },
                  { value: 'laptop', label: '笔记本' },
                ]}
                onChange={(v) => update((d) => void (d.audio.profile = v))}
              />
            </Field>
            <Field label="音量">
              <Slider value={cfg.audio.volume} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => void (d.audio.volume = v))} />
            </Field>
          </>
        )}
      </Section>

      <Section title="输出">
        <Field label="分辨率">
          <Select
            value={output.preset}
            options={RESOLUTION_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(v) =>
              update((d) => {
                d.output.preset = v;
                const p = RESOLUTION_PRESETS.find((x) => x.id === v);
                if (p && v !== 'custom') {
                  d.output.width = p.width;
                  d.output.height = p.height;
                }
              })
            }
          />
        </Field>
        {output.preset === 'custom' && (
          <div className="row">
            <input
              className="input num"
              type="number"
              value={output.width}
              onChange={(e) => update((d) => void (d.output.width = even(Number(e.target.value) || 2)))}
            />
            <span>×</span>
            <input
              className="input num"
              type="number"
              value={output.height}
              onChange={(e) => update((d) => void (d.output.height = even(Number(e.target.value) || 2)))}
            />
          </div>
        )}
        <Field label="帧率">
          <Segmented
            value={output.fps}
            options={[24, 30, 60].map((f) => ({ value: f, label: `${f} fps` }))}
            onChange={(v) => update((d) => void (d.output.fps = v))}
          />
        </Field>
        <Field label="画质">
          <Segmented
            value={output.quality}
            options={[
              { value: 'standard', label: '标准' },
              { value: 'high', label: '高' },
              { value: 'max', label: '极高' },
            ]}
            onChange={(v) => update((d) => void (d.output.quality = v))}
          />
        </Field>
      </Section>
    </aside>
  );
}
