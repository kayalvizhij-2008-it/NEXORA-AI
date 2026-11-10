import React, { useEffect, useRef, useState, useCallback } from "react";

export interface CorollaGleamProps {
  /** Size in pixels (width and height) or CSS string */
  size?: number | string;
  /** Overall intensity of the gleaming effect (0.1 to 2.5) */
  intensity?: number;
  /** Speed multiplier for rotation and breathing animations */
  speed?: number;
  /** Primary accent hue shift (in radians or normalized 0-1) */
  hueShift?: number;
  /** Whether the component responds to cursor / pointer movement */
  interactive?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Optional aria-label */
  "aria-label"?: string;
}

// -------------------------------------------------------------
// Shaders for CorollaGleam: 3D Iridescent Fluted Glass Ring
// -------------------------------------------------------------
const VS_SOURCE = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  attribute vec2 a_uv;

  uniform mat4 u_mvp;
  uniform mat4 u_model;
  uniform mat3 u_normalMatrix;
  uniform float u_time;
  uniform float u_intensity;

  varying vec3 v_worldPos;
  varying vec3 v_normal;
  varying vec2 v_uv;
  varying vec3 v_viewDir;

  void main() {
    // Subtle organic petal breathing modulation
    float harmonic = sin(u_time * 1.8 + a_uv.x * 6.28318 * 4.0) * 0.025 * u_intensity;
    vec3 animatedPos = a_position + a_normal * harmonic;

    vec4 worldPos = u_model * vec4(animatedPos, 1.0);
    v_worldPos = worldPos.xyz;
    v_normal = normalize(u_normalMatrix * a_normal);
    v_uv = a_uv;
    
    // Camera is at (0, 0, 3.8) in view space
    v_viewDir = normalize(vec3(0.0, 0.0, 3.8) - worldPos.xyz);
    
    gl_Position = u_mvp * vec4(animatedPos, 1.0);
  }
`;

const FS_SOURCE = `
  precision highp float;

  varying vec3 v_worldPos;
  varying vec3 v_normal;
  varying vec2 v_uv;
  varying vec3 v_viewDir;

  uniform float u_time;
  uniform float u_intensity;
  uniform float u_hueShift;

  // Palette generator for iridescent dispersion
  vec3 iridescentPalette(float t) {
    // NEXORA Palette: Obsidian (#09090F), Deep Violet (#5427A8), Lavender (#A78BFA),
    // Silver (#D9D6E8), Soft Cyan (#75DCE8)
    vec3 a = vec3(0.72, 0.68, 0.88); // base brightness (lavender silver)
    vec3 b = vec3(0.45, 0.35, 0.55); // contrast amplitude
    vec3 c = vec3(1.0, 1.0, 1.2);    // frequency
    vec3 d = vec3(0.15, 0.45, 0.75); // phase shifts for spectral dispersion
    return a + b * cos(6.28318 * (c * t + d + u_hueShift));
  }

  void main() {
    vec3 N = normalize(v_normal);
    // Double-sided lighting: flip normal if viewing backface
    if (!gl_FrontFacing) {
      N = -N;
    }
    vec3 V = normalize(v_viewDir);
    
    // Primary light source: angled top-right key light
    vec3 L1 = normalize(vec3(1.2, 1.5, 2.0));
    // Secondary rim light: cyan bottom-left backlight
    vec3 L2 = normalize(vec3(-1.5, -1.0, -1.2));

    // View angle and Fresnel factor
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.2);

    // Physical thin-film optical path difference for iridescence
    float filmThickness = 480.0 + 260.0 * sin(v_uv.x * 6.28318 * 3.0 + u_time * 0.7);
    float cosThetaT = sqrt(max(0.001, 1.0 - (1.0 - NdotV * NdotV) / (1.52 * 1.52)));
    float opd = 2.0 * 1.52 * filmThickness * cosThetaT * 0.002;
    vec3 iridColor = iridescentPalette(opd);

    // Specular Blinn-Phong highlights
    vec3 H1 = normalize(L1 + V);
    float NdotH1 = max(dot(N, H1), 0.0);
    float spec1 = pow(NdotH1, 48.0) * 1.8;
    float sharpGleam = pow(NdotH1, 160.0) * 3.2; // intense glistening diamond spark

    vec3 H2 = normalize(L2 + V);
    float NdotH2 = max(dot(N, H2), 0.0);
    float spec2 = pow(NdotH2, 28.0) * 0.9;

    // Deep obsidian & violet glass core
    vec3 glassDeep = vec3(0.08, 0.05, 0.16);
    vec3 electricLavender = vec3(0.65, 0.54, 0.98);
    vec3 softCyan = vec3(0.46, 0.86, 0.91);
    vec3 pureSilver = vec3(0.95, 0.94, 1.0);

    // Diffuse lighting
    float diff1 = max(dot(N, L1), 0.0) * 0.65;
    float diff2 = max(dot(N, L2), 0.0) * 0.35;

    // Combine glass volume with iridescent skin
    vec3 color = glassDeep * (diff1 + diff2 + 0.3);
    color += iridColor * (0.6 + 0.7 * fresnel);
    color += softCyan * spec2 * 0.6;
    color += pureSilver * (spec1 + sharpGleam) * u_intensity;
    color += electricLavender * fresnel * 0.85 * u_intensity;

    // Caustic interior glow
    float internalGlow = pow(1.0 - NdotV, 1.4) * (0.4 + 0.3 * sin(u_time * 2.0 + v_uv.y * 12.0));
    color += electricLavender * internalGlow * 0.45;

    // Alpha transparency with enhanced edge opacity
    float alpha = clamp(0.55 + fresnel * 0.4 + (spec1 + sharpGleam) * 0.35, 0.0, 1.0);

    gl_FragColor = vec4(color * u_intensity, alpha);
  }
`;

// Helper: 4x4 matrix arithmetic
function createMat4(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function mat4Perspective(out: Float32Array, fovyRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovyRad / 2);
  const nf = 1 / (near - far);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  return out;
}

function mat4Multiply(out: Float32Array, a: Float32Array, b: Float32Array): Float32Array {
  for (let i = 0; i < 4; i++) {
    const ai0 = a[i], ai1 = a[i + 4], ai2 = a[i + 8], ai3 = a[i + 12];
    out[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
    out[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
    out[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
    out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
  }
  return out;
}

function mat4Identity(out: Float32Array): Float32Array {
  for (let i = 0; i < 16; i++) out[i] = i % 5 === 0 ? 1 : 0;
  return out;
}

function mat4Translate(out: Float32Array, a: Float32Array, v: [number, number, number]): Float32Array {
  const x = v[0], y = v[1], z = v[2];
  if (a !== out) {
    for (let i = 0; i < 12; i++) out[i] = a[i];
  }
  out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
  out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
  out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
  out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  return out;
}

function mat4RotateX(out: Float32Array, a: Float32Array, rad: number): Float32Array {
  const s = Math.sin(rad), c = Math.cos(rad);
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  if (a !== out) {
    out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
    out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
  }
  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}

function mat4RotateY(out: Float32Array, a: Float32Array, rad: number): Float32Array {
  const s = Math.sin(rad), c = Math.cos(rad);
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  if (a !== out) {
    out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
    out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
  }
  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}

function mat4RotateZ(out: Float32Array, a: Float32Array, rad: number): Float32Array {
  const s = Math.sin(rad), c = Math.cos(rad);
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  if (a !== out) {
    out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
    out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
  }
  out[0] = a00 * c + a10 * s;
  out[1] = a01 * c + a11 * s;
  out[2] = a02 * c + a12 * s;
  out[3] = a03 * c + a13 * s;
  out[4] = a10 * c - a00 * s;
  out[5] = a11 * c - a01 * s;
  out[6] = a12 * c - a02 * s;
  out[7] = a13 * c - a03 * s;
  return out;
}

function mat3NormalFromMat4(out: Float32Array, a: Float32Array): Float32Array {
  const a00 = a[0], a01 = a[1], a02 = a[2];
  const a10 = a[4], a11 = a[5], a12 = a[6];
  const a20 = a[8], a21 = a[9], a22 = a[10];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  const det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) {
    out.fill(0);
    return out;
  }
  const idet = 1.0 / det;

  out[0] = b01 * idet;
  out[1] = (-a22 * a01 + a02 * a21) * idet;
  out[2] = (a12 * a01 - a02 * a11) * idet;
  out[3] = b11 * idet;
  out[4] = (a22 * a00 - a02 * a20) * idet;
  out[5] = (-a12 * a00 + a02 * a10) * idet;
  out[6] = b21 * idet;
  out[7] = (-a21 * a00 + a01 * a20) * idet;
  out[8] = (a11 * a00 - a01 * a10) * idet;
  return out;
}

// -------------------------------------------------------------
// Parametric 3D Corolla Ring Geometry Generator
// Produces a fluted, petal-scalloped glass torus ring
// -------------------------------------------------------------
function generateCorollaGeometry(uSegments = 72, vSegments = 32) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const R = 1.25;         // Major ring radius
  const r0 = 0.36;        // Base minor tube radius
  const petals = 6.0;     // Number of corolla petal flutes
  const petalAmp = 0.12;  // Flute amplitude
  const undulateAmp = 0.15; // Vertical wave along perimeter

  const delta = 0.001;

  function evaluatePoint(u: number, v: number): [number, number, number] {
    const angleU = u * Math.PI * 2.0;
    const angleV = v * Math.PI * 2.0;

    // Harmonic petal contour
    const r = r0 + petalAmp * Math.cos(petals * angleU) + (petalAmp * 0.4) * Math.cos(petals * 2.0 * angleU);
    const zOffset = undulateAmp * Math.sin(petals * angleU);

    const x = (R + r * Math.cos(angleV)) * Math.cos(angleU);
    const y = (R + r * Math.cos(angleV)) * Math.sin(angleU);
    const z = r * Math.sin(angleV) + zOffset;
    return [x, y, z];
  }

  for (let i = 0; i <= uSegments; i++) {
    const u = i / uSegments;
    for (let j = 0; j <= vSegments; j++) {
      const v = j / vSegments;

      const p = evaluatePoint(u, v);
      positions.push(p[0], p[1], p[2]);
      uvs.push(u, v);

      // Numerical normal via tangent vectors
      const pu = evaluatePoint(u + delta, v);
      const pv = evaluatePoint(u, v + delta);

      const du: [number, number, number] = [(pu[0] - p[0]) / delta, (pu[1] - p[1]) / delta, (pu[2] - p[2]) / delta];
      const dv: [number, number, number] = [(pv[0] - p[0]) / delta, (pv[1] - p[1]) / delta, (pv[2] - p[2]) / delta];

      // Cross product du x dv
      let nx = du[1] * dv[2] - du[2] * dv[1];
      let ny = du[2] * dv[0] - du[0] * dv[2];
      let nz = du[0] * dv[1] - du[1] * dv[0];
      const len = Math.hypot(nx, ny, nz) || 1.0;
      normals.push(nx / len, ny / len, nz / len);
    }
  }

  for (let i = 0; i < uSegments; i++) {
    for (let j = 0; j < vSegments; j++) {
      const a = i * (vSegments + 1) + j;
      const b = (i + 1) * (vSegments + 1) + j;
      const c = (i + 1) * (vSegments + 1) + (j + 1);
      const d = i * (vSegments + 1) + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

export function CorollaGleam({
  size = 320,
  intensity = 1.0,
  speed = 1.0,
  hueShift = 0.0,
  interactive = true,
  className = "",
  style = {},
  "aria-label": ariaLabel = "NEXORA CorollaGleam 3D iridescent visual",
}: CorollaGleamProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pointer smoothing state
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, isHovered: false });
  const animFrameRef = useRef<number | null>(null);
  const glResourcesRef = useRef<{
    gl: WebGLRenderingContext | null;
    program: WebGLProgram | null;
    posBuffer: WebGLBuffer | null;
    normBuffer: WebGLBuffer | null;
    uvBuffer: WebGLBuffer | null;
    idxBuffer: WebGLBuffer | null;
    indexCount: number;
  } | null>(null);

  const [webglError, setWebglError] = useState(false);

  // Dimension formatting
  const sizeStyle: React.CSSProperties = typeof size === "number"
    ? { width: `${size}px`, height: `${size}px` }
    : { width: size, height: size };

  // Pointer move handlers
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Normalized to [-1, 1]
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));
    mouseRef.current.targetX = nx;
    mouseRef.current.targetY = ny;
    mouseRef.current.isHovered = true;
  }, [interactive]);

  const handlePointerLeave = useCallback(() => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
    mouseRef.current.isHovered = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Detect reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Initialize WebGL context
    const gl = (canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    }) || canvas.getContext("experimental-webgl", {
      alpha: true,
      antialias: true,
    })) as WebGLRenderingContext | null;

    if (!gl) {
      setWebglError(true);
      return;
    }

    // Compile Shaders
    function compileShader(type: number, source: string): WebGLShader | null {
      if (!gl) return null;
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("CorollaGleam shader error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) {
      setWebglError(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebglError(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("CorollaGleam program link error:", gl.getProgramInfoLog(program));
      setWebglError(true);
      return;
    }

    // Attribute locations
    const aPos = gl.getAttribLocation(program, "a_position");
    const aNorm = gl.getAttribLocation(program, "a_normal");
    const aUv = gl.getAttribLocation(program, "a_uv");

    // Uniform locations
    const uMvp = gl.getUniformLocation(program, "u_mvp");
    const uModel = gl.getUniformLocation(program, "u_model");
    const uNormalMatrix = gl.getUniformLocation(program, "u_normalMatrix");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uIntensity = gl.getUniformLocation(program, "u_intensity");
    const uHueShift = gl.getUniformLocation(program, "u_hueShift");

    // Build geometry buffers
    const geom = generateCorollaGeometry(80, 36);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geom.positions, gl.STATIC_DRAW);

    const normBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geom.normals, gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geom.uvs, gl.STATIC_DRAW);

    const idxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.indices, gl.STATIC_DRAW);

    glResourcesRef.current = {
      gl,
      program,
      posBuffer,
      normBuffer,
      uvBuffer,
      idxBuffer,
      indexCount: geom.indices.length,
    };

    // Matrices
    const projMatrix = createMat4();
    const viewMatrix = createMat4();
    const modelMatrix = createMat4();
    const mvpMatrix = createMat4();
    const vpMatrix = createMat4();
    const normalMatrix = new Float32Array(9);

    // Camera view setup (camera at 0, 0, 3.8 looking at origin)
    mat4Identity(viewMatrix);
    mat4Translate(viewMatrix, viewMatrix, [0, 0, -3.8]);

    // Handle high-DPI resize
    function resizeCanvas() {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = Math.floor(canvas.clientWidth * dpr);
      const displayHeight = Math.floor(canvas.clientHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    resizeCanvas();

    // WebGL state flags
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let startTime = performance.now();
    let rotX = 0.45;
    let rotY = 0.35;
    let rotZ = 0.0;

    // Render loop
    function render(timeMs: number) {
      if (!canvas || !gl || !program) return;
      resizeCanvas();

      const elapsedSec = (timeMs - startTime) * 0.001;
      const effectiveSpeed = prefersReducedMotion ? 0.08 : speed;

      // Pointer lerp smoothing
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.07;
      m.y += (m.targetY - m.y) * 0.07;

      // Continuous 3D rotation with pointer influence
      rotX = 0.42 + m.y * 0.45 + Math.sin(elapsedSec * 0.5 * effectiveSpeed) * 0.12;
      rotY += 0.012 * effectiveSpeed + m.x * 0.015;
      rotZ = elapsedSec * 0.18 * effectiveSpeed;

      // Clear viewport
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(program);

      // Setup Perspective Projection
      const aspect = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
      mat4Perspective(projMatrix, (42 * Math.PI) / 180, aspect, 0.1, 100.0);
      mat4Multiply(vpMatrix, projMatrix, viewMatrix);

      // Model matrix: rotation & slight scale
      mat4Identity(modelMatrix);
      mat4RotateX(modelMatrix, modelMatrix, rotX);
      mat4RotateY(modelMatrix, modelMatrix, rotY);
      mat4RotateZ(modelMatrix, modelMatrix, rotZ);

      // Model-View-Projection
      mat4Multiply(mvpMatrix, vpMatrix, modelMatrix);

      // Normal matrix (inverse transpose 3x3)
      mat3NormalFromMat4(normalMatrix, modelMatrix);

      // Send uniforms
      gl.uniformMatrix4fv(uMvp, false, mvpMatrix);
      gl.uniformMatrix4fv(uModel, false, modelMatrix);
      gl.uniformMatrix3fv(uNormalMatrix, false, normalMatrix);
      gl.uniform1f(uTime, elapsedSec * effectiveSpeed);
      gl.uniform1f(uIntensity, intensity);
      gl.uniform1f(uHueShift, hueShift);

      // Bind attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
      gl.enableVertexAttribArray(aNorm);
      gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);

      // Draw fluted corolla ring
      gl.drawElements(gl.TRIANGLES, geom.indices.length, gl.UNSIGNED_SHORT, 0);

      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);

    // Cleanup resources on unmount
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      resizeObserver.disconnect();
      if (gl) {
        gl.deleteBuffer(posBuffer);
        gl.deleteBuffer(normBuffer);
        gl.deleteBuffer(uvBuffer);
        gl.deleteBuffer(idxBuffer);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(program);
      }
    };
  }, [intensity, speed, hueShift, interactive]);

  if (webglError) {
    // Elegant fallback in case WebGL is unavailable on a client system
    return (
      <div
        className={`corolla-gleam-fallback ${className}`}
        style={{ ...sizeStyle, display: "grid", placeItems: "center", ...style }}
        aria-label={ariaLabel}
      >
        <div className="corolla-fallback-ring" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`corolla-gleam-container ${className}`}
      style={{
        position: "relative",
        display: "inline-block",
        overflow: "hidden",
        ...sizeStyle,
        ...style,
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      role="img"
      aria-label={ariaLabel}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default CorollaGleam;
