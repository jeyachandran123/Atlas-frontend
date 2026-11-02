/**
 * The orb's form lives here. Dots sit on a grid wrapped round a sphere, so they
 * keep the visible rows of the reference image; ridged noise pushes the surface
 * into folds, and rows crowd together wherever a fold turns away from the viewer.
 * Doing this per vertex on the GPU is what keeps tens of thousands of dots smooth.
 */

export const ORB_VERTEX = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in float aSeed;

uniform float uPhase;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uRidge;
uniform float uSpin;
uniform float uGather;
uniform float uPointSize;
uniform float uDim;
uniform float uShake;
uniform float uPulse;

out float vTone;
out float vLight;

// Simplex noise, Ian McEwan & Ashima Arts (MIT).
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// The surface: broad swells, warped, with sharp ridges where folds meet.
float field(vec3 p) {
  vec3 q = p * uFrequency;
  float warp = snoise(q * 0.65 + vec3(0.0, uPhase * 0.28, 3.1));
  float swell = snoise(q + vec3(warp * 0.7, uPhase * 0.2, -uPhase * 0.12));
  float n = snoise(q * 0.8 + vec3(7.3, warp * 0.7, uPhase * 0.16));
  // A rounded crest: sqrt(n*n + k) instead of abs(n), so folds roll rather than crumple.
  float crease = 1.0 - sqrt(n * n + 0.035);
  return swell * 0.7 + (crease * crease - 0.4) * uRidge;
}

// The big folds breathe; this finer, faster layer is what makes the surface shiver
// with a voice, and it is zero when nobody is speaking.
vec3 surface(vec3 p) {
  float shiver = uShake * snoise(p * 2.3 + vec3(uPhase * 2.4, -uPhase * 1.9, uPhase * 1.3));
  return p * (1.0 + uAmplitude * field(p) + shiver);
}

mat3 rotation(float spin) {
  float cy = cos(spin), sy = sin(spin);
  float tilt = 0.34;
  float cx = cos(tilt), sx = sin(tilt);
  return mat3(cy, sx * sy, -cx * sy, 0.0, cx, sx, sy, -sx * cy, cx * cy);
}

void main() {
  vec3 p = normalize(aPosition);
  vec3 axis = abs(p.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t = normalize(cross(axis, p));
  vec3 b = cross(p, t);
  const float e = 0.018;

  vec3 here = surface(p);
  vec3 alongT = surface(normalize(p + t * e));
  vec3 alongB = surface(normalize(p + b * e));
  vec3 normal = normalize(cross(alongT - here, alongB - here));
  if (dot(normal, here) < 0.0) normal = -normal;

  mat3 model = rotation(uSpin);
  vec3 world = model * here * uPulse;
  vec3 facing = model * normal;

  // While the orb gathers, dots spiral in from a loose cloud, each at its own pace.
  // The cloud stays inside the canvas and starts invisible, so no canvas edge ever shows.
  float pace = clamp(uGather * 1.6 - aSeed * 0.6, 0.0, 1.0);
  pace = pace * pace * (3.0 - 2.0 * pace);
  vec3 scattered = rotation(uSpin + (1.0 - pace) * 1.7) * (p * (1.0 + aSeed * 0.62));
  world = mix(scattered, world, pace);

  float camera = 3.6;
  float perspective = camera / (camera - world.z);
  gl_Position = vec4(world.xy * perspective * 0.46, 0.0, 1.0);

  float edge = 1.0 - clamp(facing.z, 0.0, 1.0);
  float front = smoothstep(-0.12, 0.2, world.z + facing.z * 0.5);
  float rim = pow(edge, 1.6);
  gl_PointSize = uPointSize * perspective * (0.74 + rim * 0.16 + front * 0.22);

  // Blue at the crown, into violet along the underside, as in the reference.
  vTone = clamp(0.2 - world.y * 0.72 + (length(here) - 1.0) * 0.3, 0.0, 1.0);
  // Dots thin out at the very edge, so the silhouette dissolves instead of forming a band.
  float dissolve = 1.0 - smoothstep(0.8, 1.0, edge) * 0.72;
  vLight = mix(0.2, 0.8, front) * dissolve * uDim * pace;
}
`;

export const ORB_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

in float vTone;
in float vLight;

uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

out vec4 outColor;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float dot_ = 1.0 - smoothstep(0.62, 1.0, d);
  if (dot_ <= 0.0) discard;
  vec3 color = vTone < 0.5
    ? mix(uColorA, uColorB, vTone * 2.0)
    : mix(uColorB, uColorC, (vTone - 0.5) * 2.0);
  float alpha = dot_ * clamp(vLight, 0.0, 1.0);
  outColor = vec4(color * alpha, alpha);
}
`;
