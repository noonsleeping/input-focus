import type { Config, ScreenMode } from '../config';
import { DOF_FRAGMENT, FINISH_FRAGMENT, FRAGMENT, VERTEX } from './shader';

const MODE_ID: Record<ScreenMode, number> = { none: 0, phone: 1, crt: 2, lcd: 3 };

export interface FxParams {
  screen: Config['screen'];
  lens: Config['lens'];
  zoom: number;
  cx: number;
  cy: number;
  closeZoom: number;
  /** lens focus point in output px */
  focus: [number, number];
  time: number;
}

/** Whether a frame needs the GL pass at all. */
export function needsPostFx(cfg: Pick<Config, 'screen' | 'lens'>): boolean {
  const screenOn = cfg.screen.mode !== 'none' && cfg.screen.strength > 0;
  return screenOn || Object.values(cfg.lens).some((l) => l.enabled && l.amount > 0);
}

interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
  return sh;
}

function makeTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/**
 * WebGL2 post-processing chain: [screen simulation] → [depth of field] → finish (aberration, vignette, grain).
 * Disabled passes are skipped; intermediate results ping-pong between two framebuffers.
 */
export class PostFx {
  readonly canvas = document.createElement('canvas');
  private gl: WebGL2RenderingContext;
  private screen: Program;
  private dof: Program;
  private finish: Program;
  private sceneTex: WebGLTexture;
  private targets: Target[] = [];
  private size = [0, 0];

  constructor() {
    const gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
    if (!gl) throw new Error('当前浏览器不支持 WebGL2，无法使用屏幕模拟和镜头效果');
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const link = (fs: string, uniforms: string[]): Program => {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
      const u: Program['u'] = {};
      for (const name of uniforms) u[name] = gl.getUniformLocation(prog, name);
      return { prog, u };
    };
    this.screen = link(FRAGMENT, ['uScene', 'uRes', 'uZoom', 'uCam', 'uRef', 'uCloseZoom', 'uTime', 'uMode', 'uStrength']);
    this.dof = link(DOF_FRAGMENT, ['uSrc', 'uRes', 'uRef', 'uTime', 'uFocus', 'uAmount']);
    this.finish = link(FINISH_FRAGMENT, ['uSrc', 'uRes', 'uRef', 'uTime', 'uChroma', 'uVignette', 'uGrain']);

    // Fullscreen triangle at attribute location 0 (shared by all programs)
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.sceneTex = makeTexture(gl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  private resize(W: number, H: number) {
    if (this.size[0] === W && this.size[1] === H) return;
    const { gl } = this;
    this.canvas.width = W;
    this.canvas.height = H;
    for (const t of this.targets) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    this.targets = [0, 1].map(() => {
      const tex = makeTexture(gl);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.size = [W, H];
  }

  render(source: HTMLCanvasElement, W: number, H: number, p: FxParams): HTMLCanvasElement {
    const { gl } = this;
    this.resize(W, H);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    const ref = Math.min(W, H) / 1080;
    let src = this.sceneTex;
    let next = 0;
    const pass = ({ prog, u }: Program, setUniforms: (u: Program['u']) => void, toCanvas = false) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, toCanvas ? null : this.targets[next].fbo);
      gl.useProgram(prog);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform1i(u.uScene ?? u.uSrc, 0);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform1f(u.uRef, ref);
      gl.uniform1f(u.uTime, p.time);
      setUniforms(u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!toCanvas) {
        src = this.targets[next].tex;
        next ^= 1;
      }
    };

    const { screen, lens } = p;
    const amt = (l: Config['lens']['dof']) => (l.enabled ? l.amount : 0);

    if (screen.mode !== 'none' && screen.strength > 0) {
      pass(this.screen, (u) => {
        gl.uniform1f(u.uZoom, p.zoom);
        gl.uniform2f(u.uCam, p.cx, p.cy);
        gl.uniform1f(u.uCloseZoom, p.closeZoom);
        gl.uniform1i(u.uMode, MODE_ID[screen.mode]);
        gl.uniform1f(u.uStrength, screen.strength);
      });
    }
    if (amt(lens.dof) > 0) {
      pass(this.dof, (u) => {
        gl.uniform2f(u.uFocus, p.focus[0], p.focus[1]);
        gl.uniform1f(u.uAmount, amt(lens.dof));
      });
    }
    pass(
      this.finish,
      (u) => {
        gl.uniform1f(u.uChroma, amt(lens.chroma));
        gl.uniform1f(u.uVignette, amt(lens.vignette));
        gl.uniform1f(u.uGrain, amt(lens.grain));
      },
      true,
    );
    return this.canvas;
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
