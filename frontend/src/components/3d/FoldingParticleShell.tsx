import React, { useEffect, useRef, useState } from "react";

export interface FoldingParticleShellProps {
  /** Number of particles on the shell (default: 3200) */
  particleCount?: number;
  /** Radius of the 3D spherical shell in world space (default: 2.5) */
  shellRadius?: number;
  /** Folding oscillation speed multiplier (default: 0.8) */
  foldSpeed?: number;
  /** Global opacity multiplier (default: 0.65) */
  opacity?: number;
  /** Whether the shell responds to pointer movement and scroll (default: true) */
  interactive?: boolean;
  /** Color theme variant */
  colorVariant?: "obsidian-violet" | "iridescent-silver" | "electric-cyan";
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

// -------------------------------------------------------------
// Shaders for FoldingParticleShell: 3D Topological Morphing Lattice
// -------------------------------------------------------------
const VS_SOURCE = `
  attribute vec3 a_position;
  attribute float a_phase;
  attribute vec2 a_seed;
  attribute float a_size;

  uniform mat4 u_mvp;
  uniform mat4 u_model;
  uniform vec3 u_cameraPos;
  uniform float u_time;
  uniform float u_foldSpeed;
  uniform vec2 u_pointer;
  uniform float u_pointScale;
  uniform float u_dpr;

  varying float v_depth;
  varying float v_phase;
  varying vec3 v_worldPos;

  void main() {
    float t = u_time * u_foldSpeed;

    // Convert base Cartesian coordinate to spherical coordinates
    float r0 = length(a_position);
    float theta = atan(a_position.y, a_position.x);
    float phi = acos(clamp(a_position.z / (r0 + 0.0001), -1.0, 1.0));

    // Multi-harmonic 3D folding and unfolding wave function
    float fold1 = sin(3.0 * theta + t * 0.9 + a_phase) * cos(4.0 * phi + t * 0.4);
    float fold2 = cos(5.0 * phi - t * 0.7) * sin(2.0 * theta + a_seed.x * 6.28);
    float fold3 = sin(6.0 * theta + 3.0 * phi + t * 1.2) * 0.35;
    
    // Composite radial modulation
    float morphRadius = r0 * (1.0 + 0.24 * fold1 + 0.18 * fold2 + 0.10 * fold3);

    // Reconstruct deformed position
    vec3 deformedPos = vec3(
      morphRadius * sin(phi) * cos(theta),
      morphRadius * sin(phi) * sin(theta),
      morphRadius * cos(phi)
    );

    // Interactive pointer attractor warp in 3D
    vec3 pointerRay = vec3(u_pointer.x * 2.2, u_pointer.y * 2.2, 0.6);
    float distToPointer = length(deformedPos - pointerRay);
    float pointerInfluence = smoothstep(1.8, 0.0, distToPointer) * 0.28;
    deformedPos += normalize(deformedPos - pointerRay + 0.001) * pointerInfluence;

    // Transform through model matrix
    vec4 worldPos = u_model * vec4(deformedPos, 1.0);
    v_worldPos = worldPos.xyz;

    // Distance to camera for depth fog and attenuation
    float distToCam = length(u_cameraPos - worldPos.xyz);
    v_depth = distToCam;
    v_phase = a_phase + t;

    // Output clip space position
    vec4 clipPos = u_mvp * vec4(deformedPos, 1.0);
    gl_Position = clipPos;

    // Perspective point attenuation: close particles are larger and sharper
    float depthFactor = max(0.2, 4.5 / (distToCam + 0.001));
    float pulse = 0.85 + 0.35 * sin(a_phase * 2.0 + t * 1.5);
    gl_PointSize = clamp(a_size * u_pointScale * depthFactor * pulse * u_dpr, 1.5, 28.0);
  }
`;

const FS_SOURCE = `
  precision highp float;

  varying float v_depth;
  varying float v_phase;
  varying vec3 v_worldPos;

  uniform float u_opacity;
  uniform int u_colorVariant;

  void main() {
    // Distance from center of point sprite [0.0, 0.5]
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) {
      discard;
    }

    // Soft Gaussian edge profile with luminous dense center
    float core = smoothstep(0.18, 0.0, dist);
    float halo = smoothstep(0.5, 0.05, dist);

    // Color definitions for NEXORA theme
    vec3 silverHot = vec3(0.97, 0.96, 1.0);
    vec3 lavenderElectric = vec3(0.65, 0.54, 0.98);
    vec3 violetObsidian = vec3(0.33, 0.15, 0.66);
    vec3 softCyan = vec3(0.46, 0.86, 0.91);

    // Dynamic color gradation along folding phase
    float phaseShift = sin(v_phase * 0.8) * 0.5 + 0.5;
    vec3 particleColor;

    if (u_colorVariant == 1) {
      // Iridescent silver primary
      particleColor = mix(silverHot, lavenderElectric, phaseShift);
      particleColor = mix(particleColor, softCyan, 0.3 * sin(v_phase * 1.4));
    } else if (u_colorVariant == 2) {
      // Electric cyan primary
      particleColor = mix(softCyan, lavenderElectric, phaseShift);
      particleColor = mix(particleColor, silverHot, core * 0.8);
    } else {
      // Obsidian violet default
      vec3 outerBlend = mix(violetObsidian, lavenderElectric, phaseShift);
      particleColor = mix(outerBlend, softCyan, 0.25 * sin(v_phase * 0.7));
      particleColor = mix(particleColor, silverHot, core * 0.9);
    }

    // Depth extinction (fog): particles deep in the background fade gently
    float depthFade = smoothstep(6.8, 1.8, v_depth);

    // Overall alpha composition
    float alpha = halo * depthFade * u_opacity * (0.45 + core * 0.55);

    gl_FragColor = vec4(particleColor, alpha);
  }
`;

// Helper: 4x4 matrix helpers
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

// -------------------------------------------------------------
// Fibonacci Sphere Particle Shell Generator
// Generates an even distribution of points on a 3D sphere shell
// -------------------------------------------------------------
function generateShellParticles(count: number, baseRadius: number) {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const seeds = new Float32Array(count * 2);
  const sizes = new Float32Array(count);

  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * i / goldenRatio;
    const phi = Math.acos(1 - 2 * (i + 0.5) / count);

    // Subtle radius variation creates a multi-layered veil
    const r = baseRadius * (0.92 + 0.16 * Math.sin(i * 13.37));

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    phases[i] = (i / count) * Math.PI * 2.0;
    seeds[i * 2 + 0] = Math.sin(i * 1.618);
    seeds[i * 2 + 1] = Math.cos(i * 2.718);

    // Varying particle diameters (2.5px to 6.5px base)
    sizes[i] = 2.8 + 3.4 * (0.5 + 0.5 * Math.sin(i * 7.11));
  }

  return { positions, phases, seeds, sizes };
}

export function FoldingParticleShell({
  particleCount = 3200,
  shellRadius = 2.4,
  foldSpeed = 0.8,
  opacity = 0.65,
  interactive = true,
  colorVariant = "obsidian-violet",
  className = "",
  style = {},
}: FoldingParticleShellProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Smooth pointer and scroll tracking
  const stateRef = useRef({
    pointerX: 0,
    pointerY: 0,
    targetPointerX: 0,
    targetPointerY: 0,
    scrollY: 0,
    targetScrollY: 0,
  });

  const animFrameRef = useRef<number | null>(null);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    if (!interactive) return;

    const onPointerMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      stateRef.current.targetPointerX = (e.clientX / w) * 2 - 1;
      stateRef.current.targetPointerY = -((e.clientY / h) * 2 - 1);
    };

    const onScroll = () => {
      stateRef.current.targetScrollY = (window.scrollY || 0) * 0.0012;
    };

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, [interactive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
        console.error("FoldingParticleShell shader error:", gl.getShaderInfoLog(shader));
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
      console.error("FoldingParticleShell program link error:", gl.getProgramInfoLog(program));
      setWebglError(true);
      return;
    }

    // Attribute locations
    const aPos = gl.getAttribLocation(program, "a_position");
    const aPhase = gl.getAttribLocation(program, "a_phase");
    const aSeed = gl.getAttribLocation(program, "a_seed");
    const aSize = gl.getAttribLocation(program, "a_size");

    // Uniform locations
    const uMvp = gl.getUniformLocation(program, "u_mvp");
    const uModel = gl.getUniformLocation(program, "u_model");
    const uCameraPos = gl.getUniformLocation(program, "u_cameraPos");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uFoldSpeed = gl.getUniformLocation(program, "u_foldSpeed");
    const uPointer = gl.getUniformLocation(program, "u_pointer");
    const uPointScale = gl.getUniformLocation(program, "u_pointScale");
    const uDpr = gl.getUniformLocation(program, "u_dpr");
    const uOpacity = gl.getUniformLocation(program, "u_opacity");
    const uColorVariant = gl.getUniformLocation(program, "u_colorVariant");

    // Generate Shell Data
    const data = generateShellParticles(particleCount, shellRadius);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);

    const phaseBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, phaseBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.phases, gl.STATIC_DRAW);

    const seedBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.seeds, gl.STATIC_DRAW);

    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.sizes, gl.STATIC_DRAW);

    // Matrices
    const projMatrix = createMat4();
    const viewMatrix = createMat4();
    const modelMatrix = createMat4();
    const mvpMatrix = createMat4();
    const vpMatrix = createMat4();

    const cameraZ = 4.2;
    mat4Identity(viewMatrix);
    mat4Translate(viewMatrix, viewMatrix, [0, 0, -cameraZ]);

    // Retina & High-DPI Canvas Resizing
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

    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    resizeCanvas();

    // Enable Blending for glowing additive translucent particles
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive luminous blending
    gl.disable(gl.DEPTH_TEST);

    let startTime = performance.now();
    let rotX = 0.25;
    let rotY = 0.15;

    const variantCode = colorVariant === "iridescent-silver" ? 1 : colorVariant === "electric-cyan" ? 2 : 0;

    function render(timeMs: number) {
      if (!canvas || !gl || !program) return;
      resizeCanvas();

      const elapsedSec = (timeMs - startTime) * 0.001;
      const effectiveSpeed = prefersReducedMotion ? 0.1 : foldSpeed;

      // Pointer & Scroll smoothing
      const s = stateRef.current;
      s.pointerX += (s.targetPointerX - s.pointerX) * 0.05;
      s.pointerY += (s.targetPointerY - s.pointerY) * 0.05;
      s.scrollY += (s.targetScrollY - s.scrollY) * 0.05;

      // Compound 3D rotational drift
      rotX = 0.25 + s.pointerY * 0.35 + s.scrollY;
      rotY += 0.004 * effectiveSpeed + s.pointerX * 0.006;

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      const aspect = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
      mat4Perspective(projMatrix, (48 * Math.PI) / 180, aspect, 0.1, 100.0);
      mat4Multiply(vpMatrix, projMatrix, viewMatrix);

      mat4Identity(modelMatrix);
      mat4RotateX(modelMatrix, modelMatrix, rotX);
      mat4RotateY(modelMatrix, modelMatrix, rotY);

      mat4Multiply(mvpMatrix, vpMatrix, modelMatrix);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Uniforms
      gl.uniformMatrix4fv(uMvp, false, mvpMatrix);
      gl.uniformMatrix4fv(uModel, false, modelMatrix);
      gl.uniform3f(uCameraPos, 0, 0, cameraZ);
      gl.uniform1f(uTime, elapsedSec);
      gl.uniform1f(uFoldSpeed, effectiveSpeed);
      gl.uniform2f(uPointer, s.pointerX, s.pointerY);
      gl.uniform1f(uPointScale, 1.4);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uOpacity, opacity);
      gl.uniform1i(uColorVariant, variantCode);

      // Attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, phaseBuffer);
      gl.enableVertexAttribArray(aPhase);
      gl.vertexAttribPointer(aPhase, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
      gl.enableVertexAttribArray(aSeed);
      gl.vertexAttribPointer(aSeed, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.enableVertexAttribArray(aSize);
      gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0);

      // Draw all shell particles
      gl.drawArrays(gl.POINTS, 0, particleCount);

      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      resizeObserver.disconnect();
      if (gl) {
        gl.deleteBuffer(posBuffer);
        gl.deleteBuffer(phaseBuffer);
        gl.deleteBuffer(seedBuffer);
        gl.deleteBuffer(sizeBuffer);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(program);
      }
    };
  }, [particleCount, shellRadius, foldSpeed, opacity, colorVariant]);

  if (webglError) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`folding-particle-shell-container ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        ...style,
      }}
      aria-hidden="true"
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

export default FoldingParticleShell;
