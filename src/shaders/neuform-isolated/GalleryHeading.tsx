/*!
 * Gallery Heading — ThreeUI Community
 * Source: https://threeui.com/component/gallery-heading
 * MIT License (c) Meng To / Design+Code
 *
 * An oversized headline ringed by twelve 4:3 plates — one flat colour each,
 * shaded by a procedural noise field rather than a gradient. The plates hold
 * still until the pointer arrives, then orbit.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VARIANTS } from './variants';
import type { GalleryConfig, GalleryVariant } from './variants';

const TAU = Math.PI * 2;
const TILE_COUNT = 12;
const RING_RADIUS = 7.12;
const TILE_WIDTH = 3.3;
const TILE_HEIGHT = TILE_WIDTH * 0.75; // 4:3
const CAM_ELEVATION = THREE.MathUtils.degToRad(60.5); // plate tilt
const CAM_DISTANCE = 26.5;
const CAM_FOV = 35;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uSeed;
  uniform float uScale;
  uniform float uContrast;

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
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int k = 0; k < 5; k++) {
      v += a * noise(p);
      p = p * 2.03 + 17.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // rounded corners in plate space (4:3)
    vec2 p = (vUv - 0.5) * vec2(1.0, 0.75);
    vec2 halfSize = vec2(0.5, 0.375);
    float r = 0.055;
    vec2 q = abs(p) - (halfSize - r);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    if (sd > 0.0) discard;

    // flat colour shaded by a procedural noise field
    float n = fbm(vUv * uScale + uSeed);
    float shade = mix(1.0 - uContrast, 1.0 + uContrast * 0.55, n);
    vec3 col = uColor * shade;

    // gentle paper falloff, darker at the bottom edge
    col *= mix(0.78, 1.06, smoothstep(0.0, 0.9, vUv.y));

    // back of the plate: darker, washed out
    if (!gl_FrontFacing) {
      col = mix(vec3(0.02, 0.025, 0.045), col * 0.25, 0.35);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function drawHeadline(canvas: HTMLCanvasElement, cfg: GalleryConfig) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const [line1, line2] = cfg.lines;
  const size1 = H * 0.092;
  const size2 = H * 0.118;

  ctx.fillStyle = cfg.dimColor;
  ctx.font = `600 ${size1}px ${cfg.fontFamily}`;
  ctx.fillText(line1, W / 2, H * 0.425);

  ctx.fillStyle = cfg.textColor;
  ctx.font = `${cfg.fontWeight} ${size2}px ${cfg.fontFamily}`;
  ctx.fillText(line2, W / 2, H * 0.565);
}

export interface GalleryHeadingProps {
  variant?: GalleryVariant;
  /** override the twelve plate colours (recommended: 12 entries) */
  palette?: string[];
  /** override the two headline lines */
  lines?: [string, string];
  /** override the page background */
  background?: string;
  className?: string;
}

export default function GalleryHeading({
  variant = 'rising-diagonal',
  palette,
  lines,
  background,
  className,
}: GalleryHeadingProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const base = VARIANTS[variant];
    const cfg: GalleryConfig = {
      ...base,
      palette: palette && palette.length ? palette : base.palette,
      lines: lines ?? base.lines,
      background: background ?? base.background,
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(hover: none)').matches;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(new THREE.Color(cfg.background), 1);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 400);
    camera.position.set(
      0,
      Math.sin(CAM_ELEVATION) * CAM_DISTANCE,
      Math.cos(CAM_ELEVATION) * CAM_DISTANCE
    );
    camera.lookAt(0, 0, 0);

    const ring = new THREE.Group();
    ring.rotation.z = THREE.MathUtils.degToRad(cfg.axisDeg);
    scene.add(ring);

    // ---- twelve plates ----
    const plateGeo = new THREE.PlaneGeometry(TILE_WIDTH, TILE_HEIGHT);
    const plates: THREE.Mesh[] = [];
    for (let i = 0; i < TILE_COUNT; i++) {
      const material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(cfg.palette[i % cfg.palette.length]) },
          uSeed: { value: (i * 7.13) % 11.7 },
          uScale: { value: cfg.noiseScale },
          uContrast: { value: cfg.noiseContrast },
        },
      });
      const plate = new THREE.Mesh(plateGeo, material);
      ring.add(plate);
      plates.push(plate);
    }

    // ---- headline (cutout plane so plates occlude it correctly) ----
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 2048;
    textCanvas.height = 1152;
    drawHeadline(textCanvas, cfg);
    const textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.colorSpace = THREE.SRGBColorSpace;
    textTexture.anisotropy = 4;

    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: false,
      alphaTest: 0.04,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), textMaterial);
    textPlane.quaternion.copy(camera.quaternion);
    scene.add(textPlane);

    const placePlates = (t: number) => {
      const phase = THREE.MathUtils.degToRad(cfg.phaseDeg);
      const tangent = new THREE.Vector3();
      const up = new THREE.Vector3(0, 0, 1);
      const normal = new THREE.Vector3();
      const basis = new THREE.Matrix4();
      for (let i = 0; i < TILE_COUNT; i++) {
        const psi = phase - (i * TAU) / TILE_COUNT + t;
        const cos = Math.cos(psi);
        const sin = Math.sin(psi);
        const plate = plates[i];
        plate.position.set(cos * RING_RADIUS, sin * RING_RADIUS, 0);
        tangent.set(-sin, cos, 0);
        normal.set(cos, sin, 0);
        basis.makeBasis(tangent, up, normal);
        plate.quaternion.setFromRotationMatrix(basis);
      }
    };

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // keep the headline proportional to the viewport at the ring centre
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const heightWorld = 2 * Math.tan(vFov / 2) * CAM_DISTANCE;
      const widthWorld = heightWorld * camera.aspect;
      const planeWidth = widthWorld;
      const planeHeight = widthWorld * (textCanvas.height / textCanvas.width);
      textPlane.scale.set(planeWidth, planeHeight, 1);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    // ---- motion: hold still until the pointer arrives ----
    const baseSpeed = TAU / cfg.revolveSeconds; // rad/s
    let speed = 0;
    let targetSpeed = 0;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;

    if (coarsePointer && !reduceMotion) targetSpeed = baseSpeed;

    const onEnter = () => {
      targetSpeed = baseSpeed;
    };
    const onLeave = () => {
      targetSpeed = coarsePointer && !reduceMotion ? baseSpeed : 0;
    };
    host.addEventListener('pointerenter', onEnter);
    host.addEventListener('pointerleave', onLeave);

    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      speed += (targetSpeed - speed) * Math.min(1, dt * 3.2);
      if (speed > 0.0002) elapsed += speed * cfg.spin * dt;
      placePlates(elapsed);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointerleave', onLeave);
      plateGeo.dispose();
      plates.forEach((plate) => (plate.material as THREE.ShaderMaterial).dispose());
      textTexture.dispose();
      textMaterial.dispose();
      (textPlane.geometry as THREE.BufferGeometry).dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [variant, palette, lines, background]);

  return <div ref={hostRef} className={className} aria-label="Gallery heading" />;
}
