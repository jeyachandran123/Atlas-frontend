"use client";

import { useEffect, useRef } from "react";
import { ORB_FRAGMENT, ORB_VERTEX } from "@/components/chat/voice-agent/orb-shaders";

export type OrbState =
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "reconnecting"
  | "ended";

export interface OrbLevels {
  mic: number;
  output: number;
}

interface Pose {
  amplitude: number;
  frequency: number;
  ridge: number;
  speed: number;
  spin: number;
  gather: number;
  dim: number;
}

/** How each state holds itself before the voices move it. */
const POSES: Record<OrbState, Pose> = {
  connecting:   { amplitude: 0.14, frequency: 0.85, ridge: 0.4,  speed: 0.3,  spin: 0.1,  gather: 1,    dim: 0.8 },
  listening:    { amplitude: 0.21, frequency: 0.92, ridge: 0.62, speed: 0.34, spin: 0.08, gather: 1,    dim: 1 },
  thinking:     { amplitude: 0.22, frequency: 1.12, ridge: 0.64, speed: 1.05, spin: 0.46, gather: 1,    dim: 0.92 },
  speaking:     { amplitude: 0.25, frequency: 1.0,  ridge: 0.72, speed: 0.62, spin: 0.14, gather: 1,    dim: 1.08 },
  muted:        { amplitude: 0.05, frequency: 0.7,  ridge: 0.14, speed: 0.14, spin: 0.04, gather: 1,    dim: 0.5 },
  reconnecting: { amplitude: 0.09, frequency: 0.8,  ridge: 0.24, speed: 0.3,  spin: 0.12, gather: 0.74, dim: 0.66 },
  ended:        { amplitude: 0.06, frequency: 1,    ridge: 0.2,  speed: 0.2,  spin: 0.08, gather: 0,    dim: 0.6 },
};

/** Rows per cube face. A step down is taken if the frame rate can't hold. */
const DENSITY_STEPS = [66, 54, 42] as const;
const SLOW_FRAME_MS = 24;
const FRAMES_TO_JUDGE = 90;
/** The orb's resting diameter as a share of the canvas, matching the vertex shader. */
const ORB_SHARE = 0.46;

function buildSphere(rows: number): { positions: Float32Array; seeds: Float32Array; count: number } {
  const count = rows * rows * 6;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let i = 0;
  // A grid on each cube face, spread evenly by tan so the rows don't bunch at corners.
  const faces: ((u: number, v: number) => [number, number, number])[] = [
    (u, v) => [1, v, -u], (u, v) => [-1, v, u],
    (u, v) => [u, 1, -v], (u, v) => [u, -1, v],
    (u, v) => [u, v, 1],  (u, v) => [-u, v, -1],
  ];
  for (const face of faces) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < rows; c++) {
        const u = Math.tan(((c + 0.5) / rows - 0.5) * (Math.PI / 2));
        const v = Math.tan(((r + 0.5) / rows - 0.5) * (Math.PI / 2));
        const [x, y, z] = face(u, v);
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        // A fixed scatter, not a random one: the orb gathers the same way each time.
        seeds[i] = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        i++;
      }
    }
  }
  return { positions, seeds, count };
}

function parseColor(value: string): [number, number, number] {
  const text = value.trim();
  if (text.startsWith("#")) {
    const hex = text.length === 4
      ? [...text.slice(1)].map((c) => c + c).join("")
      : text.slice(1, 7);
    return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
  }
  const parts = text.match(/[\d.]+/g)?.slice(0, 3).map((n) => Number(n) / 255);
  return parts?.length === 3 ? (parts as [number, number, number]) : [0.4, 0.45, 0.95];
}

/** Colours come from the theme, so the orb belongs to the app in dark and light. */
function themeColors(element: Element) {
  const css = getComputedStyle(element);
  return {
    a: parseColor(css.getPropertyValue("--info")),
    b: parseColor(css.getPropertyValue("--accent-bright")),
    c: parseColor(css.getPropertyValue("--accent-2")),
  };
}

function compile(gl: WebGL2RenderingContext): WebGLProgram | null {
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vertex = shader(gl.VERTEX_SHADER, ORB_VERTEX);
  const fragment = shader(gl.FRAGMENT_SHADER, ORB_FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function ease(current: number, target: number, dt: number, rate: number): number {
  return current + (target - current) * (1 - Math.exp(-dt * rate));
}

/**
 * The voice orb. `state` and `levels` are read every frame without re-rendering
 * React, so the voices can move it sixty times a second.
 */
export function Orb({
  state,
  levels,
  className,
}: {
  state: OrbState;
  levels?: () => OrbLevels;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const read = () => levelsRef.current?.() ?? { mic: 0, output: 0 };
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true });
    const program = gl ? compile(gl) : null;
    return gl && program
      ? runWebGL(canvas, gl, program, stateRef, read, reduced)
      : runCanvasFallback(canvas, stateRef, read, reduced);
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

function runWebGL(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  stateRef: { current: OrbState },
  read: () => OrbLevels,
  reduced: boolean,
): () => void {
  gl.useProgram(program);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    phase: uniform("uPhase"), amplitude: uniform("uAmplitude"), frequency: uniform("uFrequency"),
    ridge: uniform("uRidge"), spin: uniform("uSpin"), gather: uniform("uGather"),
    pointSize: uniform("uPointSize"), dim: uniform("uDim"),
    shake: uniform("uShake"), pulse: uniform("uPulse"),
    a: uniform("uColorA"), b: uniform("uColorB"), c: uniform("uColorC"),
  };

  const positionBuffer = gl.createBuffer();
  const seedBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  // A small orb shows fewer rows, or its dots run together into a solid sheet.
  const startSize = Math.min(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
  const startOrb = startSize * ORB_SHARE;
  let density = startOrb < 250 ? 2 : startOrb < 330 ? 1 : 0;
  let count = 0;

  const loadGeometry = () => {
    const sphere = buildSphere(DENSITY_STEPS[density]!);
    count = sphere.count;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.seeds, gl.STATIC_DRAW);
    const seed = gl.getAttribLocation(program, "aSeed");
    gl.enableVertexAttribArray(seed);
    gl.vertexAttribPointer(seed, 1, gl.FLOAT, false, 0, 0);
  };
  loadGeometry();

  gl.enable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);

  const applyTheme = () => {
    const theme = themeColors(canvas);
    gl.uniform3fv(u.a, theme.a);
    gl.uniform3fv(u.b, theme.b);
    gl.uniform3fv(u.c, theme.c);
  };
  // Laid over each other, not added up: added light burned every ridge to white,
  // while the reference's ridges stay blue. This also works on a light page.
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  applyTheme();
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  let cssSize = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    cssSize = Math.min(rect.width, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const live = { ...POSES[stateRef.current], gather: 0 };
  let phase = 0;
  let spin = 0.6;
  let mic = 0;
  let output = 0;
  let shake = 0;
  let pulse = 1;
  // The soft halo behind the orb reads this, so it swells with the voice too.
  const glow = canvas.parentElement ?? canvas;
  let last = performance.now();
  let frame = 0;
  let slowFrames = 0;
  let judged = 0;
  let lost = false;

  const onLost = (event: Event) => { event.preventDefault(); lost = true; };
  canvas.addEventListener("webglcontextlost", onLost);

  const render = (now: number) => {
    frame = requestAnimationFrame(render);
    if (lost || document.hidden) { last = now; return; }
    const elapsed = now - last;
    // Capped only to survive a long stall: a slow machine must still gather on time.
    // A frame's timestamp can precede the clock read before it. A negative step would
    // push a level below zero, and Math.pow would turn that into a NaN that never leaves.
    const dt = Math.max(0, Math.min(elapsed / 1000, 0.25));
    last = now;

    const current = read();
    // Quick to rise, slow to fall: the orb answers a voice at once and settles gently.
    mic = ease(mic, current.mic, dt, current.mic > mic ? 22 : 5);
    output = ease(output, current.output, dt, current.output > output ? 26 : 6);

    const state = stateRef.current;
    const pose = POSES[state];
    // Compressed, so ordinary speech moves the orb plainly, not only a loud voice.
    const heard = state === "listening" ? Math.pow(mic, 0.6) : 0;
    const said = state === "speaking" ? Math.pow(output, 0.6) : 0;
    const voice = Math.max(heard, said);
    const motion = reduced ? 0.12 : 1;

    live.amplitude = ease(live.amplitude, (pose.amplitude + heard * 0.13 + said * 0.15) * (reduced ? 0.6 : 1), dt, 9);
    live.frequency = ease(live.frequency, pose.frequency, dt, 1.6);
    live.ridge = ease(live.ridge, pose.ridge + voice * 0.12, dt, 5);
    live.speed = ease(live.speed, (pose.speed + heard * 1.2 + said * 1.5) * motion, dt, 6);
    live.spin = ease(live.spin, pose.spin * motion, dt, 2);
    live.gather = ease(live.gather, pose.gather, dt, state === "ended" ? 5 : 3);
    live.dim = ease(live.dim, pose.dim + voice * (reduced ? 0.3 : 0.14), dt, 6);
    shake = ease(shake, reduced ? 0 : heard * 0.026 + said * 0.032, dt, 16);
    // A quiet breath at rest, then a swell with each syllable.
    const breath = reduced ? 0 : Math.sin(now / 900) * 0.012;
    pulse = ease(pulse, 1 + breath + (reduced ? 0 : voice * 0.075), dt, 18);
    glow.style.setProperty("--orb-energy", voice.toFixed(3));

    phase += dt * live.speed;
    spin += dt * live.spin;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.phase, phase);
    gl.uniform1f(u.amplitude, live.amplitude);
    gl.uniform1f(u.frequency, live.frequency);
    gl.uniform1f(u.ridge, live.ridge);
    gl.uniform1f(u.spin, spin);
    gl.uniform1f(u.gather, live.gather);
    gl.uniform1f(u.dim, live.dim);
    gl.uniform1f(u.shake, shake);
    gl.uniform1f(u.pulse, pulse);
    const dpr = canvas.width / Math.max(canvas.getBoundingClientRect().width, 1);
    gl.uniform1f(u.pointSize, Math.max(1.4, ((cssSize * ORB_SHARE) / 312) * 2.5) * dpr);
    gl.drawArrays(gl.POINTS, 0, count);

    if (elapsed > SLOW_FRAME_MS) slowFrames++;
    if (++judged >= FRAMES_TO_JUDGE) {
      if (slowFrames > FRAMES_TO_JUDGE * 0.4 && density < DENSITY_STEPS.length - 1) {
        density++;
        loadGeometry();
      }
      judged = 0;
      slowFrames = 0;
    }
  };
  frame = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(frame);
    themeObserver.disconnect();
    resizeObserver.disconnect();
    canvas.removeEventListener("webglcontextlost", onLost);
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(seedBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };
}

/** No WebGL2: fewer dots on a plain canvas. Same colours, same states, same voices. */
function runCanvasFallback(
  canvas: HTMLCanvasElement,
  stateRef: { current: OrbState },
  read: () => OrbLevels,
  reduced: boolean,
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  const sphere = buildSphere(22);
  let frame = 0;
  let phase = 0;
  let amplitude = 0.1;
  let last = performance.now();

  const render = (now: number) => {
    frame = requestAnimationFrame(render);
    if (document.hidden) { last = now; return; }
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const pose = POSES[stateRef.current];
    const level = read();
    const voice = stateRef.current === "listening" ? level.mic : stateRef.current === "speaking" ? level.output : 0;
    amplitude = ease(amplitude, pose.amplitude + voice * 0.3, dt, 5);
    phase += dt * (reduced ? 0.04 : pose.speed + voice);
    const theme = themeColors(canvas);
    const cos = Math.cos(phase * 0.5);
    const sin = Math.sin(phase * 0.5);
    const radius = Math.min(canvas.width, canvas.height) * 0.3;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < sphere.count; i++) {
      const px = sphere.positions[i * 3]!;
      const py = sphere.positions[i * 3 + 1]!;
      const pz = sphere.positions[i * 3 + 2]!;
      const length = Math.hypot(px, py, pz);
      const x = px / length, y = py / length, z = pz / length;
      const swell = 1 + amplitude * Math.sin(x * 3 + phase) * Math.cos(y * 4 - phase * 0.7);
      const rx = (x * cos + z * sin) * swell;
      const rz = (-x * sin + z * cos) * swell;
      const depth = (rz + 1.2) / 2.4;
      if (depth < 0.25) continue;
      const tone = Math.min(1, Math.max(0, 0.2 + y * 0.72));
      const from = tone < 0.5 ? theme.a : theme.b;
      const to = tone < 0.5 ? theme.b : theme.c;
      const mix = tone < 0.5 ? tone * 2 : (tone - 0.5) * 2;
      const channel = (n: 0 | 1 | 2) => Math.round((from[n] + (to[n] - from[n]) * mix) * 255);
      ctx.fillStyle = `rgba(${channel(0)},${channel(1)},${channel(2)},${depth * pose.dim})`;
      ctx.beginPath();
      ctx.arc(canvas.width / 2 + rx * radius, canvas.height / 2 + y * swell * radius, dpr * (0.5 + depth), 0, Math.PI * 2);
      ctx.fill();
    }
  };
  frame = requestAnimationFrame(render);
  return () => cancelAnimationFrame(frame);
}
