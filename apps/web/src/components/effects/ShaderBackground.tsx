'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks';
import styles from './ShaderBackground.module.css';

/**
 * Lightweight WebGL gradient-mesh shader for the hero background.
 *
 * Three brand-color blobs drift over a near-white field with value noise and
 * film grain. Honors the device's constraints:
 * - antialiased context, DPR capped at 2
 * - anisotropic filtering on the grain texture when the extension exists
 * - pauses when off-screen (IntersectionObserver) or tab hidden
 * - not mounted at all under prefers-reduced-motion (CSS gradient fallback)
 * - WebGL unavailable → silently keeps the CSS fallback
 */

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uGrain;

// Brand palette
const vec3 BG     = vec3(0.973, 0.980, 0.988); // near-white #F8FAFC
const vec3 BLUE   = vec3(0.145, 0.388, 0.922); // #2563EB
const vec3 GREEN  = vec3(0.063, 0.725, 0.506); // #10B981
const vec3 PURPLE = vec3(0.545, 0.361, 0.965); // #8B5CF6

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float blob(vec2 uv, vec2 center, float radius) {
  float d = length(uv - center);
  return smoothstep(radius, 0.0, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime * 0.05;

  // Slow domain warp for an organic feel
  float warp = noise(p * 2.0 + t) * 0.12;
  vec2 q = p + warp;

  // Drifting blobs
  vec2 c1 = vec2(0.25 * aspect + 0.12 * sin(t * 1.3), 0.72 + 0.08 * cos(t * 1.1));
  vec2 c2 = vec2(0.78 * aspect + 0.10 * cos(t * 0.9), 0.30 + 0.10 * sin(t * 1.4));
  vec2 c3 = vec2(0.55 * aspect + 0.14 * sin(t * 0.7), 0.85 + 0.06 * cos(t * 0.8));

  float b1 = blob(q, c1, 0.55);
  float b2 = blob(q, c2, 0.50);
  float b3 = blob(q, c3, 0.45);

  vec3 col = BG;
  col = mix(col, BLUE,   b1 * 0.16);
  col = mix(col, GREEN,  b2 * 0.10);
  col = mix(col, PURPLE, b3 * 0.12);

  // Fine film grain from the anisotropic-filtered texture
  float g = texture2D(uGrain, uv * uRes / 256.0).r;
  col += (g - 0.5) * 0.018;

  gl_FragColor = vec4(col, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
    });
    if (!gl) return; // CSS fallback stays

    // === Program ===
    const vert = createShader(gl, gl.VERTEX_SHADER, VERT);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Shader link failed:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // Fullscreen triangle
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'uRes');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uGrain = gl.getUniformLocation(program, 'uGrain');

    // === Grain texture (with anisotropic filtering where supported) ===
    const SIZE = 256;
    const grainData = new Uint8Array(SIZE * SIZE);
    let seed = 1;
    for (let i = 0; i < grainData.length; i++) {
      // xorshift - deterministic grain, no Math.random in render path
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      grainData[i] = (seed >>> 0) % 256;
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, SIZE, SIZE, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, grainData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const aniso =
      gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if (aniso) {
      const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, max));
    }
    gl.uniform1i(uGrain, 0);

    // === Sizing (DPR-capped for battery) ===
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // === Render loop, paused off-screen / hidden tab ===
    let rafId = 0;
    let running = true;
    let visible = true;
    const start = performance.now();

    const render = () => {
      if (!running || !visible) return;
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafId = requestAnimationFrame(render);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && running) {
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(render);
        }
      },
      { threshold: 0 }
    );
    observer.observe(canvas);

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running && visible) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      running = false;
      cancelAnimationFrame(rafId);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    rafId = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [reducedMotion]);

  // Reduced motion: pure CSS gradient, no canvas at all
  if (reducedMotion) {
    return <div className={styles.fallback} aria-hidden="true" />;
  }

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
