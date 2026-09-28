export const VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * Screen simulation. Coordinates:
 *  - px:   output pixels, origin top-left
 *  - ref:  "reference pixels" (1080-line frame) so preview and export look identical at any resolution
 *  - page: page (CSS) pixels of the simulated screen — grids defined here zoom and pan with the camera
 */
export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uZoom;       // output px per page px
uniform vec2 uCam;         // page point at frame center
uniform float uRef;        // output px per reference px
uniform float uCloseZoom;  // output px per page px in the close-up shot
uniform float uTime;
uniform int uMode;         // 1 phone, 2 crt, 3 lcd
uniform float uStrength;

out vec4 outColor;

const float TAU = 6.28318530718;

vec3 tex(vec2 px) {
  vec2 uv = clamp(px / uRes, vec2(0.0), vec2(1.0));
  return texture(uScene, vec2(uv.x, 1.0 - uv.y)).rgb;
}

vec2 toPage(vec2 px) { return (px - 0.5 * uRes) / uZoom + uCam; }
vec2 fromPage(vec2 page) { return (page - uCam) * uZoom + 0.5 * uRes; }

float hash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// RGB stripe sub-pixel mask of a display with the given pixel pitch (page px).
// Returns the per-channel mask and fades to flat when the grid is too small to resolve.
vec3 subpixelMask(vec2 page, float pitch, out float vis) {
  float cellRef = pitch * uZoom / uRef;          // one display pixel, in reference px
  // fade by reference size (same look at any resolution) and by actual pixels (never alias)
  vis = smoothstep(2.5, 6.0, cellRef) * smoothstep(3.0, 6.0, pitch * uZoom);
  vec2 f = fract(page / pitch);
  float aa = 1.0 / max(cellRef, 1e-3);            // one ref px in cell units
  vec3 m;
  for (int c = 0; c < 3; c++) {
    float center = (float(c) + 0.5) / 3.0;
    float d = abs(f.x - center);
    m[c] = 1.0 - smoothstep(0.13 - aa, 0.13 + aa, d);
  }
  float row = 1.0 - smoothstep(0.86 - aa, 0.86 + aa, f.y);
  return m * row;
}

// Scene averaged over one display pixel (3x3 taps) — how a real display would show our vector render.
vec3 pixelAverage(vec2 page, float pitch) {
  vec2 cell = (floor(page / pitch) + 0.5) * pitch;
  vec3 acc = vec3(0.0);
  for (int i = -1; i <= 1; i++)
    for (int j = -1; j <= 1; j++)
      acc += tex(fromPage(cell + vec2(float(i), float(j)) * pitch / 3.0));
  return acc / 9.0;
}

vec3 phone(vec2 px) {
  vec3 col = tex(px);
  vec2 page = toPage(px);
  float s = uStrength;

  // Faint sub-pixel structure
  float vis;
  vec3 mask = subpixelMask(page, 1.0, vis);
  col = mix(col, col * mask * 2.6, 0.18 * s * vis);

  // Moiré: interference between the screen's pixel grid and the phone sensor grid.
  // The virtual sensor is tuned so bands are wide at close-up; they swim when zooming and drift when panning.
  vec2 p = (px - 0.5 * uRes) / uRef;
  float r2 = dot(p, p) / (1080.0 * 1080.0);
  vec2 w = p * (1.0 + 0.1 * r2);                  // lens distortion of the screen image curves the bands
  w.x *= 1.0 + 0.00015 * w.y;                     // slight keystone (phone not perfectly parallel)
  float pitchRef = uZoom / uRef;                  // display pixel pitch (1 page px) in ref px
  float fs = 1.0 / pitchRef;
  float fc = (uRef / uCloseZoom) * 1.03;          // sensor grating, 3% off the close-up screen frequency
  vec2 drift = uCam * 0.03;                       // bands drift slowly as the camera pans

  float a1 = 0.026, a2 = -0.041;                  // screen vs sensor rotation for columns / rows
  vec2 d1 = vec2(cos(a1), sin(a1)), d2 = vec2(-sin(a2), cos(a2));

  // The screen frequency beats against the nearest sensor harmonics. Blending the two nearest
  // keeps the pattern continuous while zooming (each fades out before it is swapped).
  vec3 m = vec3(0.0);
  float h0 = max(1.0, floor(fs / fc));
  for (int h = 0; h < 2; h++) {
    float mh = h0 + float(h);
    float beat = abs(fs - mh * fc) + 0.03 * fs;   // approx band frequency (cycles per ref px)
    float amp = smoothstep(0.12, 0.03, beat) * inversesqrt(mh); // fine bands get blurred away by the lens
    // screen grating seen through the lens (w) vs the undistorted sensor grid (p)
    float ph1 = TAU * (fs * dot(w, d1) - mh * fc * p.x + drift.x);
    float ph2 = TAU * (fs * dot(w, d2) - mh * fc * p.y + drift.y);
    for (int c = 0; c < 3; c++) {
      float off = float(c) * 1.1;                 // RGB sub-pixels are offset → soft rainbow fringes
      m[c] += amp * (0.6 * cos(ph1 + off) + 0.4 * cos(ph2 + off * 0.7));
    }
  }
  col *= 1.0 + s * 0.14 * m;

  // Camera look: lifted blacks, cool cast, sensor noise, vignette
  col = mix(col, 1.0 - (1.0 - col) * 0.86, 0.6 * s);
  col *= mix(vec3(1.0), vec3(0.95, 1.0, 1.07), s);
  float n = hash(vec3(floor(p), floor(uTime * 30.0))) - 0.5;
  col += n * 0.06 * s;
  col *= 1.0 - s * 0.3 * r2 * 1.4;
  return col;
}

vec3 crt(vec2 px) {
  float s = uStrength;
  // Barrel distortion of the tube
  vec2 uv = px / uRes;
  vec2 cc = uv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec2 ca = cc * vec2(aspect, 1.0);
  float k = 0.045 * s;
  cc *= 1.0 + k * dot(ca, ca);
  vec2 q = (cc * 0.5 + 0.5) * uRes;
  vec2 edge = min(cc + 1.0, 1.0 - cc);
  float inside = smoothstep(0.0, 0.015, min(edge.x, edge.y));

  // Convergence error + phosphor glow
  float conv = 0.7 * s * uRef;
  vec3 col = vec3(tex(q + vec2(conv, 0.0)).r, tex(q).g, tex(q - vec2(conv, 0.0)).b);
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * TAU / 8.0;
    glow += tex(q + vec2(cos(a), sin(a)) * 4.0 * uRef);
    glow += tex(q + vec2(cos(a + 0.4), sin(a + 0.4)) * 9.0 * uRef);
  }
  glow /= 16.0;
  col = col + glow * glow * 0.35 * s;

  // Scanlines live on the screen (one per page px); when too fine, fall back to frame-space lines
  vec2 page = toPage(q);
  float lineRef = uZoom / uRef;
  float pageVis = smoothstep(2.5, 5.0, lineRef);
  float lPage = 0.5 + 0.5 * cos(TAU * page.y);
  float lFrame = 0.5 + 0.5 * cos(TAU * q.y / (3.0 * uRef));
  float line = mix(lFrame, lPage, pageVis);
  // lines thinner than ~2 output px would alias into false moiré, so flatten them to their mean
  float lineAA = mix(smoothstep(1.8, 3.0, 3.0 * uRef), smoothstep(2.0, 4.0, uZoom), pageVis);
  col *= mix(1.0, mix(0.85, 0.55 + 0.6 * line, lineAA), 0.8 * s);

  // Aperture grille
  float vis;
  vec3 mask = subpixelMask(page, 1.0, vis);
  col *= mix(vec3(1.0), mix(vec3(0.84), 0.45 + mask * 1.3, vis), 0.5 * s);

  // Flicker (7 Hz — slow enough not to alias at 24 fps), vignette, warm phosphor tint
  col *= 1.0 + 0.02 * s * sin(uTime * TAU * 7.0);
  vec2 v = uv - 0.5;
  col *= 1.0 - s * 0.9 * dot(v, v);
  col *= mix(vec3(1.0), vec3(1.03, 1.0, 0.94), s);
  return col * inside;
}

vec3 lcd(vec2 px) {
  float s = uStrength;
  vec2 page = toPage(px);
  float vis;
  vec3 mask = subpixelMask(page, 1.0, vis);
  vec3 base = mix(tex(px), pixelAverage(page, 1.0), vis);
  // Lit sub-pixels are brighter than the average; gaps are dark
  vec3 lit = base * mask * 2.7;
  vec3 col = mix(base, lit, s * vis);
  // Macro-lens look: slight vignette
  vec2 v = px / uRes - 0.5;
  col *= 1.0 - s * 0.35 * dot(v, v);
  return col;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 col;
  if (uMode == 1) col = phone(px);
  else if (uMode == 2) col = crt(px);
  else if (uMode == 3) col = lcd(px);
  else col = tex(px);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/** Shared helpers for the lens passes (same pixel/texture conventions as the screen pass). */
const LENS_COMMON = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uRes;
uniform float uRef;
uniform float uTime;
out vec4 outColor;
const float TAU = 6.28318530718;
vec3 tex(vec2 px) {
  vec2 uv = clamp(px / uRes, vec2(0.0), vec2(1.0));
  return texture(uSrc, vec2(uv.x, 1.0 - uv.y)).rgb;
}
vec2 pixel() { return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); }
float hash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
`;

/**
 * Depth of field focused on the latest word. Blur grows with distance from the focus point,
 * mostly vertically (the camera looks along the text line), using a golden-angle disc gather.
 */
export const DOF_FRAGMENT = LENS_COMMON + /* glsl */ `
uniform vec2 uFocus;    // output px
uniform float uAmount;

void main() {
  vec2 px = pixel();
  vec2 d = (px - uFocus) / uRef;
  d.x *= 0.4;
  float r = uAmount * 16.0 * smoothstep(30.0, 460.0, length(d)) * uRef;
  if (r < 0.5) {
    outColor = vec4(tex(px), 1.0);
    return;
  }
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 40; i++) {
    float fi = float(i) + 0.5;
    float rr = sqrt(fi / 40.0) * r;
    float a = fi * 2.39996323;
    acc += tex(px + vec2(cos(a), sin(a)) * rr);
  }
  outColor = vec4(acc / 40.0, 1.0);
}
`;

/** Final lens pass: chromatic aberration, vignette, film grain. All-zero amounts = plain copy. */
export const FINISH_FRAGMENT = LENS_COMMON + /* glsl */ `
uniform float uChroma;
uniform float uVignette;
uniform float uGrain;

void main() {
  vec2 px = pixel();
  vec2 c = (px - 0.5 * uRes) / (0.5 * uRes);           // -1..1 across the frame

  // Lateral chromatic aberration: red/blue split grows toward the edges
  vec2 off = c * dot(c, c) * uChroma * 5.0 * uRef;
  vec3 col = vec3(tex(px + off).r, tex(px).g, tex(px - off).b);

  // Vignette
  float v = smoothstep(0.35, 1.45, length(c));
  col *= 1.0 - uVignette * 0.55 * v * v;

  // Film grain: per-frame luminance noise, strongest in mid-tones
  float n = hash(vec3(floor(px / (1.4 * uRef)), floor(uTime * 30.0))) - 0.5;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += n * uGrain * 0.16 * (0.35 + 0.65 * (1.0 - abs(lum * 2.0 - 1.0)));

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
