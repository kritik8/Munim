"use client";
import { useEffect, useRef } from "react";

const VS_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FS_SOURCE = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(13.7, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

float bayer4(vec2 p) {
  float x = mod(p.x, 4.0);
  float y = mod(p.y, 4.0);
  if (y < 1.0) {
    if (x < 1.0) return 0.0;
    if (x < 2.0) return 8.0;
    if (x < 3.0) return 2.0;
    return 10.0;
  }
  if (y < 2.0) {
    if (x < 1.0) return 12.0;
    if (x < 2.0) return 4.0;
    if (x < 3.0) return 14.0;
    return 6.0;
  }
  if (y < 3.0) {
    if (x < 1.0) return 3.0;
    if (x < 2.0) return 11.0;
    if (x < 3.0) return 1.0;
    return 9.0;
  }
  if (x < 1.0) return 15.0;
  if (x < 2.0) return 7.0;
  if (x < 3.0) return 13.0;
  return 5.0;
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / 2.0);
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

  vec2 warp = vec2(
    fbm(p * 1.35 + vec2(u_time * 0.42, 1.7)),
    fbm(p * 1.35 + vec2(4.3, -u_time * 0.34))
  );
  float broadClouds = fbm(p * 1.45 + warp * 1.7 + vec2(u_time * 0.14, 0.0));
  float fluid = fbm(p * 1.95 + warp * 2.35 + vec2(-u_time * 0.2, u_time * 0.08));
  float veins = 0.5 + 0.5 * sin(fluid * 6.0 + warp.x * 2.5 + p.y * 1.4);
  float signal = clamp(fluid * 0.56 + broadClouds * 0.36 + veins * 0.08, 0.0, 1.0);

  vec3 deep = vec3(0.25, 0.01, 0.06);   // deep dark wine / dark crimson
  vec3 mid = vec3(0.76, 0.00, 0.18);    // rich deep scarlet red
  vec3 bright = vec3(1.0, 0.14, 0.30);  // glowing hot crimson highlight
  vec3 color = mix(deep, mid, smoothstep(0.12, 0.76, signal));
  color = mix(color, bright, smoothstep(0.48, 0.92, signal));

  float dotShade = mix(0.72, 1.0, bayer4(cell) / 15.0);
  color *= dotShade;

  float fromTop = 1.0 - uv.y;
  float alpha = 1.0 - smoothstep(0.22, 0.86, fromTop);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[FluidHero] Shader compile failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function FluidHeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });

    if (!gl) return;

    const vs = createShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[FluidHero] Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Full-screen quad positions (6 vertices)
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");

    let animId: number | null = null;
    const startTime = performance.now();
    const prefersReducedMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const container = canvas.parentElement || canvas;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(container.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round((canvas.clientHeight || 480) * pixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = (time: number) => {
      if (document.visibilityState !== "visible") {
        animId = requestAnimationFrame(render);
        return;
      }

      resize();

      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      const elapsed = prefersReducedMotion ? 0 : (time - startTime) * 0.00002;
      gl.uniform1f(timeLocation, elapsed);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    // Ready signal
    resize();
    render(performance.now());
    canvas.dataset.ready = "true";

    const handleResize = () => resize();
    window.addEventListener("resize", handleResize);

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <>
      <div className="fluid-hero__fallback" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="fluid-hero__canvas"
        aria-hidden="true"
      />
    </>
  );
}

