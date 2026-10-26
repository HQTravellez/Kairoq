// kairoq/hero3d: premium 3D hero scenes for landing pages, the kind usually only seen on Dribbble.
// Each recipe takes the app's own colours from its design tokens (--primary, --accent), lights
// itself like a studio, moves gently with the pointer and with scrolling, holds still for people
// who prefer reduced motion, and shows a plain fallback without WebGL (through kairoq/scene).
//
// <HeroObject object="suitcase" />      one crafted object on a pedestal (OBJECTS lists them, or src="/models/x.glb")
// <GlassShapes />                       glass and chrome shapes floating in the brand colours
// <DeviceMockup device="phone" screenshot="/uploads/app.png" />   the app's real screen on a device
// <ExplodedView object="laptop" />      the object comes apart as the page scrolls
// <Diorama objects={['house', 'house', 'tree']} />   a tiny isometric world
// <ScrollAssembly object="watch" />    pinned while the page scrolls: the object comes apart layer by
//                                       layer, holds with labels, then assembles again
//
// The objects are modelled in Blender (scripts/props/hero.py in Kairoq) and copied into every app
// that uses this module, under <app>/props/. Built on React Three Fiber 8 and drei 9 (MIT).
import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Float, Html, Lightformer, MeshTransmissionMaterial, RoundedBox, useGLTF } from '@react-three/drei';
import { Scene3D, prefersStill, themeColor } from 'kairoq/scene';
import { basename } from 'kairoq';

const h = React.createElement;

// ---------- the object library ----------
export const OBJECTS = {
  suitcase: 'hero-suitcase.glb', house: 'hero-house.glb', key: 'hero-key.glb', 'shopping-bag': 'hero-shopping-bag.glb',
  plane: 'hero-plane.glb', 'gift-box': 'hero-gift-box.glb', dumbbell: 'hero-dumbbell.glb', phone: 'hero-phone.glb',
  laptop: 'hero-laptop.glb', 'coffee-cup': 'espresso-cup.glb', 'espresso-machine': 'espresso-machine.glb', pizza: 'pizza.glb',
  'pizza-box': 'pizza-box.glb', oven: 'pizza-oven.glb', watch: 'hero-watch.glb',
};
const fileUrl = (file) => (basename || '') + '/props/' + file;
function urlOf(object, src) {
  if (src) return src;
  const file = OBJECTS[object];
  return file ? fileUrl(file) : null;
}

// The app's colours, read once from the design tokens (with sensible fallbacks).
export function useBrandColors(colors) {
  return useMemo(() => ({
    primary: colors?.primary || themeColor('primary', '#4f46e5'),
    accent: colors?.accent || themeColor('accent', '#f59e0b'),
    background: colors?.background || themeColor('background', '#ffffff'),
    muted: colors?.muted || themeColor('muted', '#f1f5f9'),
  }), [colors?.primary, colors?.accent, colors?.background, colors?.muted]);
}

// A copy of a model with its own materials: parts made of "brand" or "accent" take the app's
// colours, and a "Screen" shows an image. Scaled so its largest side is `size` units, standing on y=0.
function useModel(url, { colors, size = 1.4, screen } = {}) {
  const { scene } = useGLTF(url);
  const texture = useScreenTexture(screen);
  return useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.material = o.material.clone();
      const name = String(o.material.name || '').toLowerCase();
      if (name.startsWith('brand')) o.material.color = new THREE.Color(colors.primary);
      else if (name.startsWith('accent')) o.material.color = new THREE.Color(colors.accent);
      if (texture && /^screen/i.test(o.name)) o.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    });
    const box = new THREE.Box3().setFromObject(copy);
    const dims = box.getSize(new THREE.Vector3());
    const scale = size / Math.max(dims.x, dims.y, dims.z, 0.001);
    copy.scale.setScalar(scale);
    const centre = box.getCenter(new THREE.Vector3());
    copy.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
    const group = new THREE.Group();
    group.add(copy);
    return group;
  }, [scene, colors.primary, colors.accent, size, texture]);
}

function useScreenTexture(src) {
  return useMemo(() => {
    if (!src) return null;
    const t = new THREE.TextureLoader().load(src);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [src]);
}

// ---------- motion: pointer and scroll ----------
// The pointer anywhere on the page, from -1 to 1 (the canvas only sees it when hovered).
function usePointer() {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e) => { pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);
  return pointer;
}

// How far the scene has scrolled through the window: 0 when its top reaches the bottom of the
// screen, 1 when its bottom leaves the top.
export function useScrollProgress(ref) {
  const progress = useRef(0);
  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect(), vh = window.innerHeight || 1;
      progress.current = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [ref]);
  return progress;
}

// Turns and tilts its children: a slow turntable, a lean towards the pointer, a turn with scroll.
function Choreography({ children, spin = 0.25, tilt = 0.25, scrollTurn = 0.8, scroll, baseY = -0.5 }) {
  const group = useRef();
  const pointer = usePointer();
  const still = prefersStill();
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (still) { g.rotation.set(0, baseY, 0); return; }
    const t = state.clock.elapsedTime;
    const targetY = baseY + Math.sin(t * spin) * 0.35 + pointer.current.x * tilt + (scroll ? scroll.current * scrollTurn : 0);
    const targetX = pointer.current.y * tilt * 0.4;
    const k = 1 - Math.exp(-3 * Math.min(dt, 0.1));
    g.rotation.y += (targetY - g.rotation.y) * k;
    g.rotation.x += (targetX - g.rotation.x) * k;
  });
  return h('group', { ref: group }, children);
}

// ---------- light ----------
// Studio light built on the device (no download): a soft key, a rim and a fill, tinted with the brand.
const MOODS = {
  studio: { key: '#ffffff', rim: '#ffffff', fill: '#dfe6f0', intensity: 1, room: '#a7adb5' },
  sunset: { key: '#ffd2a6', rim: '#ff9a6b', fill: '#ffe9d6', intensity: 1.1, room: '#b39a8a' },
  neon: { key: '#ffffff', rim: null, fill: null, intensity: 1.3, room: '#3a3d4a' },
};
function Lighting({ mood = 'studio', colors }) {
  const m = MOODS[mood] || MOODS.studio;
  const rim = m.rim || colors.primary, fill = m.fill || colors.accent;
  return h(React.Fragment, null,
    h('ambientLight', { intensity: 0.25 }),
    h('directionalLight', { position: [3, 5, 4], intensity: 1.6 * m.intensity, color: m.key, castShadow: true, 'shadow-mapSize': [1024, 1024] }),
    h('directionalLight', { position: [-4, 2, -3], intensity: 0.9 * m.intensity, color: rim }),
    h(Environment, { resolution: 256, frames: 1 },
      // A soft studio room around everything, so chrome and glass reflect light instead of black.
      h('mesh', { scale: 60 }, h('sphereGeometry', { args: [1, 32, 16] }), h('meshBasicMaterial', { color: m.room || '#9aa0a8', side: THREE.BackSide })),
      h(Lightformer, { form: 'rect', intensity: 2 * m.intensity, color: m.key, position: [0, 5, 2], scale: [8, 3, 1], rotation: [Math.PI / 2, 0, 0] }),
      h(Lightformer, { form: 'rect', intensity: 1.4 * m.intensity, color: rim, position: [-5, 1.5, 1], scale: [3, 6, 1], rotation: [0, Math.PI / 2, 0] }),
      h(Lightformer, { form: 'rect', intensity: 1 * m.intensity, color: fill, position: [5, 1.5, 1], scale: [3, 6, 1], rotation: [0, -Math.PI / 2, 0] }),
      h(Lightformer, { form: 'ring', intensity: 0.8 * m.intensity, color: colors.primary, position: [0, 1, -6], scale: 4 })));
}

// Keeps a subject of the given size framed on wide and narrow screens.
function Frame({ height = 1.4, width = 1.6, centre = [0, 0.7, 0], from = [0.6, 0.45, 1], margin = 1.3 }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const byHeight = (height * margin) / 2 / Math.tan(fov / 2);
    const byWidth = (width * margin) / 2 / (Math.tan(fov / 2) * aspect);
    const d = Math.max(byHeight, byWidth);
    const dir = new THREE.Vector3(...from).normalize();
    camera.position.set(centre[0] + dir.x * d, centre[1] + dir.y * d, centre[2] + dir.z * d);
    camera.lookAt(...centre);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, height, width, centre[0], centre[1], centre[2]]);
  return null;
}

// The outer box: a section-sized stage that tracks its own scroll position.
function Stage({ children, className = '', style, alt, poster, height = 480, camera }) {
  const box = useRef(null);
  const scroll = useScrollProgress(box);
  return h('div', { ref: box, className, style: { width: '100%', height, position: 'relative', ...style } },
    h(Scene3D, { alt, poster, lights: false, camera: camera || { position: [0, 1, 4], fov: 32 }, dpr: [1, 1.75], style: { width: '100%', height: '100%', minHeight: 0 } },
      children(scroll)));
}

// ---------- HeroObject ----------
function Pedestal({ colors, radius = 0.85 }) {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colors.muted).lerp(new THREE.Color('#ffffff'), 0.35), roughness: 0.55, clearcoat: 0.3 }), [colors.muted]);
  return h('group', null,
    h('mesh', { position: [0, -0.06, 0], receiveShadow: true, material: mat }, h('cylinderGeometry', { args: [radius, radius * 1.02, 0.12, 96] })),
    h('mesh', { position: [0, -0.125, 0], material: mat }, h('cylinderGeometry', { args: [radius * 1.06, radius * 1.08, 0.03, 96] })));
}

function ObjectModel({ url, colors, size, screen }) {
  const model = useModel(url, { colors, size, screen });
  return h('primitive', { object: model });
}

// A stand-in shape in the brand colour while a model loads (or when it is missing).
function Placeholder({ colors, size = 1.2 }) {
  return h(RoundedBox, { args: [size * 0.6, size * 0.8, size * 0.6], radius: 0.12, smoothness: 6, position: [0, size * 0.4, 0] },
    h('meshPhysicalMaterial', { color: colors.primary, roughness: 0.3, clearcoat: 0.8 }));
}
class Safe extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function SafeModel(props) {
  const fallback = h(Placeholder, { colors: props.colors, size: props.size });
  if (!props.url) return fallback;
  return h(Safe, { fallback }, h(Suspense, { fallback }, h(ObjectModel, props)));
}

export function HeroObject({ object = 'gift-box', src, colors: colorsProp, mood = 'studio', pedestal = true, size = 1.4, className, style, height, alt }) {
  const colors = useBrandColors(colorsProp);
  const url = urlOf(object, src);
  return h(Stage, { className, style, height, alt: alt || 'A 3D ' + String(object).replace(/-/g, ' ') },
    (scroll) => h(React.Fragment, null,
      h(Lighting, { mood, colors }),
      h(Frame, { height: size + 0.45, width: size * 1.45, centre: [0, size * 0.42, 0], from: [0.55, 0.32, 1] }),
      h(Float, { speed: prefersStill() ? 0 : 1.4, rotationIntensity: 0.15, floatIntensity: 0.35, floatingRange: [0.02, 0.1] },
        h(Choreography, { scroll }, h(SafeModel, { url, colors, size }))),
      pedestal ? h(Pedestal, { colors, radius: size * 0.62 }) : null,
      h(ContactShadows, { position: [0, pedestal ? 0.001 : 0, 0], opacity: 0.45, scale: size * 3, blur: 2.6, far: size * 1.5, resolution: 512 })));
}

// ---------- GlassShapes ----------
const SHAPES = [
  { kind: 'torus', at: [-0.9, 0.95, 0], scale: 0.55, glass: true },
  { kind: 'sphere', at: [0.75, 1.25, -0.3], scale: 0.42, glass: false },
  { kind: 'capsule', at: [0.2, 0.55, 0.4], scale: 0.38, glass: true },
  { kind: 'box', at: [1.05, 0.4, 0.2], scale: 0.32, glass: false },
  { kind: 'knot', at: [-0.15, 1.5, -0.6], scale: 0.3, glass: true },
  { kind: 'sphere', at: [-1.2, 0.3, 0.3], scale: 0.22, glass: false },
];
function Shape({ kind, at, scale, material, glass, i }) {
  const geometry = useMemo(() => {
    if (kind === 'torus') return new THREE.TorusGeometry(1, 0.38, 48, 128);
    if (kind === 'capsule') return new THREE.CapsuleGeometry(0.55, 1, 16, 48);
    if (kind === 'box') return new THREE.BoxGeometry(1.3, 1.3, 1.3, 4, 4, 4).toNonIndexed();
    if (kind === 'knot') return new THREE.TorusKnotGeometry(0.8, 0.26, 200, 32);
    return new THREE.SphereGeometry(1, 64, 64);
  }, [kind]);
  const still = prefersStill();
  return h(Float, { speed: still ? 0 : 1 + (i % 3) * 0.4, rotationIntensity: still ? 0 : 0.8, floatIntensity: still ? 0 : 0.8 },
    kind === 'box'
      ? h(RoundedBox, { args: [1.3, 1.3, 1.3], radius: 0.28, smoothness: 6, position: at, scale, rotation: [i * 0.7, i * 0.4, 0], material, castShadow: true })
      : h('mesh', { geometry, position: at, scale, rotation: [i * 0.7, i * 0.4, 0], castShadow: true, ...(glass ? {} : { material }) },
        glass ? h(MeshTransmissionMaterial, { ...glass }) : null));
}

export function GlassShapes({ count = 5, colors: colorsProp, mood = 'studio', className, style, height, alt = 'Glass and chrome shapes in the brand colours' }) {
  const colors = useBrandColors(colorsProp);
  const materials = useMemo(() => ({
    glass: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colors.primary).lerp(new THREE.Color('#ffffff'), 0.55), transmission: 1, thickness: 1.2, roughness: 0.08, ior: 1.45, iridescence: 0.35, iridescenceIOR: 1.3, clearcoat: 1, attenuationColor: new THREE.Color(colors.primary), attenuationDistance: 1.4 }),
    solid: new THREE.MeshPhysicalMaterial({ color: colors.primary, roughness: 0.18, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e8eaee', metalness: 1, roughness: 0.2 }),
    accent: new THREE.MeshPhysicalMaterial({ color: colors.accent, roughness: 0.25, clearcoat: 1 }),
  }), [colors.primary, colors.accent]);
  // Glass refracts the shapes and light behind it (drei's transmission material); the others are
  // glossy solids in the brand colour, the accent colour and chrome.
  const glass = useMemo(() => ({ samples: 6, resolution: 512, thickness: 0.6, roughness: 0.05, chromaticAberration: 0.06, anisotropy: 0.2, distortion: 0.25, distortionScale: 0.4, temporalDistortion: 0.1, ior: 1.4, backside: true, background: new THREE.Color(colors.background), color: new THREE.Color(colors.primary).lerp(new THREE.Color('#ffffff'), 0.6) }), [colors.primary, colors.background]);
  const pick = (s, i) => (i === 1 ? materials.solid : i === 3 ? materials.accent : i === 5 ? materials.chrome : materials.accent);
  return h(Stage, { className, style, height, alt },
    (scroll) => h(React.Fragment, null,
      h(Lighting, { mood, colors }),
      h(Frame, { height: 2.1, width: 3.5, centre: [-0.05, 0.85, 0], from: [0, 0.25, 1] }),
      h(Choreography, { scroll, spin: 0.15, tilt: 0.35, scrollTurn: 1.2, baseY: 0 },
        SHAPES.slice(0, Math.max(2, Math.min(SHAPES.length, count))).map((s, i) => h(Shape, { key: i, ...s, i, material: pick(s, i), glass: s.glass && !prefersStill() ? glass : null })))));
}

// ---------- DeviceMockup ----------
export function DeviceMockup({ device = 'phone', screenshot, colors: colorsProp, mood = 'studio', className, style, height, alt }) {
  const colors = useBrandColors(colorsProp);
  const url = urlOf(device === 'laptop' ? 'laptop' : 'phone');
  const size = device === 'laptop' ? 1.6 : 1.4;
  return h(Stage, { className, style, height, alt: alt || 'The app on a ' + device },
    (scroll) => h(React.Fragment, null,
      h(Lighting, { mood, colors }),
      h(Frame, { height: size * (device === 'laptop' ? 0.72 : 1) + 0.1, width: size * (device === 'laptop' ? 1.05 : 0.6), centre: [0, size * (device === 'laptop' ? 0.32 : 0.5), 0], from: [0.18, 0.18, 1], margin: 1.15 }),
      h(Float, { speed: prefersStill() ? 0 : 1.2, rotationIntensity: 0.1, floatIntensity: 0.3 },
        h(Choreography, { scroll, spin: 0.2, tilt: 0.22, scrollTurn: 0.35, baseY: -0.22 }, h(SafeModel, { url, colors, size, screen: screenshot }))),
      h(ContactShadows, { position: [0, 0, 0], opacity: 0.4, scale: 4, blur: 2.8, far: 2, resolution: 512 })));
}

// ---------- ExplodedView ----------
// Every part moves out from the centre along its own direction as the section scrolls past.
function Exploding({ url, colors, size, scroll, amount }) {
  const model = useModel(url, { colors, size });
  const parts = useMemo(() => {
    const centre = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    const list = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      const dir = c.sub(centre);
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      list.push({ mesh: o, home: o.position.clone(), dir: dir.normalize() });
    });
    return list;
  }, [model]);
  const still = prefersStill();
  useFrame(() => {
    const p = still ? 0.5 : THREE.MathUtils.smoothstep(scroll.current, 0.2, 0.65);
    for (const { mesh, home, dir } of parts) {
      const local = dir.clone().multiplyScalar((amount * p) / (mesh.parent?.scale?.x || 1));
      mesh.position.copy(home).add(local);
    }
  });
  return h('primitive', { object: model });
}

export function ExplodedView({ object = 'gift-box', src, amount = 0.45, colors: colorsProp, mood = 'studio', className, style, height = 560, alt }) {
  const colors = useBrandColors(colorsProp);
  const url = urlOf(object, src);
  const size = 1.4;
  return h(Stage, { className, style, height, alt: alt || 'The ' + String(object).replace(/-/g, ' ') + ' taken apart' },
    (scroll) => h(React.Fragment, null,
      h(Lighting, { mood, colors }),
      h(Frame, { height: size + amount * 2, width: size + amount * 2.2, centre: [0, size * 0.5, 0] }),
      h(Choreography, { scroll, spin: 0.1, tilt: 0.2, scrollTurn: 0.6 },
        url ? h(Safe, { fallback: h(Placeholder, { colors, size }) }, h(Suspense, { fallback: h(Placeholder, { colors, size }) }, h(Exploding, { url, colors, size, scroll, amount }))) : h(Placeholder, { colors, size })),
      h(ContactShadows, { position: [0, -0.01, 0], opacity: 0.35, scale: 5, blur: 2.6, far: 3, resolution: 512 })));
}

// ---------- Diorama ----------
// A tiny world on a rounded island: library objects placed on a grid, with trees between them.
function Tree({ position, colors, scale = 1 }) {
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color('#6fa35a').lerp(new THREE.Color(colors.primary), 0.12), roughness: 0.8 }), [colors.primary]);
  const trunk = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.8 }), []);
  return h('group', { position, scale },
    h('mesh', { position: [0, 0.08, 0], material: trunk, castShadow: true }, h('cylinderGeometry', { args: [0.025, 0.035, 0.16, 12] })),
    h('mesh', { position: [0, 0.26, 0], material: leaf, castShadow: true }, h('icosahedronGeometry', { args: [0.14, 1] })));
}

export function Diorama({ objects = ['house', 'tree', 'house', 'tree'], colors: colorsProp, mood = 'sunset', className, style, height, alt = 'A tiny 3D world' }) {
  const colors = useBrandColors(colorsProp);
  const n = objects.length, cols = Math.ceil(Math.sqrt(n)), cell = 0.95;
  const islandSize = cols * cell + 0.5;
  const ground = useMemo(() => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colors.muted).lerp(new THREE.Color('#ffffff'), 0.3), roughness: 0.7 }), [colors.muted]);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.primary).lerp(new THREE.Color('#000000'), 0.25), roughness: 0.6 }), [colors.primary]);
  return h(Stage, { className, style, height, alt, camera: { position: [0, 2, 4], fov: 26 } },
    (scroll) => h(React.Fragment, null,
      h(Lighting, { mood, colors }),
      h(Frame, { height: islandSize * 0.6, width: islandSize * 1.2, centre: [0, 0.2, 0], from: [1, 0.85, 1] }),
      h(Choreography, { scroll, spin: 0.08, tilt: 0.15, scrollTurn: 0.6, baseY: 0 },
        h(RoundedBox, { args: [islandSize, 0.18, islandSize], radius: 0.08, smoothness: 4, position: [0, -0.09, 0], material: ground, receiveShadow: true }),
        h(RoundedBox, { args: [islandSize - 0.02, 0.32, islandSize - 0.02], radius: 0.08, smoothness: 4, position: [0, -0.3, 0], material: side }),
        objects.map((name, i) => {
          const x = ((i % cols) - (cols - 1) / 2) * cell, z = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * cell;
          if (name === 'tree') return h(TreeClump, { key: i, x, z, colors });
          return h('group', { key: i, position: [x, 0, z] }, h(SafeModel, { url: urlOf(name), colors, size: 0.75 }));
        }))));
}
function TreeClump({ x, z, colors }) {
  return h('group', { position: [x, 0, z] },
    h(Tree, { position: [-0.18, 0, -0.1], colors, scale: 1.2 }),
    h(Tree, { position: [0.15, 0, 0.12], colors }),
    h(Tree, { position: [0.2, 0, -0.22], colors, scale: 0.8 }));
}

// ---------- ScrollAssembly ----------
// A tall section whose scene stays pinned while the page scrolls through it. Parts are taken
// apart in layers: a part's name starting with a number ("03 Dial") is its layer, front to back;
// without numbers, parts are layered by how far forward they sit. The timeline: assembled, apart
// (one layer after another), a pause with labels, then back together.
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function apartAt(t, layer, layers) {
  const stagger = layers > 1 ? (layer / (layers - 1)) * 0.12 : 0;
  const out = ease((t - 0.12 - stagger) / 0.2);
  const back = ease((t - 0.68 - (0.12 - stagger)) / 0.2);
  return Math.max(0, out - back);
}
// "03_Hour_marker.001" (three.js turns spaces into _) reads as "Hour marker".
const labelOf = (name) => String(name || '').replace(/^\d+[\s_]*/, '').replace(/[._]\d+$/, '').replace(/_/g, ' ').trim();

function Assembly({ url, colors, size, progress, gap, labels, still }) {
  const model = useModel(url, { colors, size });
  const layers = useMemo(() => {
    const groups = new Map();
    const meshes = [];
    model.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const numbered = meshes.some((m) => /^\d+/.test(m.name) || /^\d+/.test(m.parent?.name || ''));
    for (const m of meshes) {
      const name = /^\d+/.test(m.name) ? m.name : m.parent?.name || m.name;
      const key = numbered ? Number((/^(\d+)/.exec(name) || [0, 99])[1]) : Math.round(-new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z * 20);
      if (!groups.has(key)) groups.set(key, { key, meshes: [], label: '', biggest: 0 });
      const g = groups.get(key);
      g.meshes.push({ mesh: m, home: m.position.clone() });
      // A layer is named after its biggest part (the dial, not one of its markers).
      const s3 = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      const v = s3.x * s3.y + s3.y * s3.z + s3.x * s3.z;
      if (v > g.biggest) { g.biggest = v; g.label = labelOf(name); }
    }
    return [...groups.values()].sort((a, b) => a.key - b.key);
  }, [model]);
  const labelRefs = useRef([]);
  const scale = model.children[0]?.scale?.x || 1;
  useFrame(() => {
    const t = still ? 0.5 : progress.current;
    const mid = (layers.length - 1) / 2;
    layers.forEach((layer, i) => {
      const a = still ? 1 : apartAt(t, i, layers.length);
      const dz = (mid - i) * gap * a / scale;
      for (const { mesh, home } of layer.meshes) mesh.position.set(home.x, home.y, home.z + dz);
      // A label shows only while its part is fully out.
      const el = labelRefs.current[i];
      if (el) el.style.opacity = String(ease((a - 0.85) / 0.15));
    });
  });
  const mid = (layers.length - 1) / 2;
  // Where each layer's label sits: just right of the part, at its height, where it ends up.
  const spots = useMemo(() => layers.map((layer) => {
    const box = new THREE.Box3();
    for (const { mesh } of layer.meshes) box.expandByObject(mesh);
    const c = box.getCenter(new THREE.Vector3());
    return [box.max.x + 0.06, c.y, c.z];
  }), [layers]);
  return h('group', null,
    h('primitive', { object: model }),
    layers.map((layer, i) => {
      // With labels given, only the parts they name are labelled; without, every layer is.
      const text = labels ? labels[layer.label] || labels[layer.key] : layer.label;
      if (!text) return null;
      const [x, y, z] = spots[i];
      return h(Html, { key: layer.key, position: [x, y, z + (mid - i) * gap], zIndexRange: [10, 0] },
        h('div', { ref: (el) => (labelRefs.current[i] = el), style: { opacity: 0, transform: 'translateY(-50%)', transition: 'opacity .25s', whiteSpace: 'nowrap', font: '500 13px/1.2 var(--font-sans, system-ui)', color: 'hsl(var(--foreground))', background: 'hsl(var(--background) / .9)', border: '1px solid hsl(var(--border))', borderRadius: 999, padding: '4px 10px', pointerEvents: 'none', boxShadow: '0 4px 14px rgb(0 0 0 / .08)' } }, text));
    }));
}

function AssemblyCamera({ progress, size, still }) {
  const { camera, size: view } = useThree();
  useFrame(() => {
    const t = still ? 0.5 : progress.current;
    const apart = ease((t - 0.1) / 0.3) * (1 - ease((t - 0.7) / 0.25));
    const angle = -0.25 - apart * 0.85;
    const aspect = view.width / Math.max(1, view.height);
    const d = (size * 2.6) / Math.min(1, aspect) + apart * size * 0.5;
    camera.position.set(Math.sin(angle) * d, size * 0.55 + apart * size * 0.15, Math.cos(angle) * d);
    camera.lookAt(0, size * 0.48, 0);
  });
  return null;
}

export function ScrollAssembly({ object = 'watch', src, screens = 3, gap = 0.16, labels, colors: colorsProp, mood = 'studio', className, style, alt, children }) {
  const colors = useBrandColors(colorsProp);
  const url = urlOf(object, src);
  const outer = useRef(null);
  const progress = useRef(0);
  const still = prefersStill();
  useEffect(() => {
    const update = () => {
      const el = outer.current;
      if (!el) return;
      const r = el.getBoundingClientRect(), vh = window.innerHeight || 1;
      progress.current = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);
  const size = 1.4;
  const scene = h(Scene3D, { alt: alt || 'The ' + String(object).replace(/-/g, ' ') + ' taken apart and put back together', lights: false, camera: { position: [0, 1, 4], fov: 30 }, style: { width: '100%', height: '100%', minHeight: 0 } },
    h(Lighting, { mood, colors }),
    h(AssemblyCamera, { progress, size, still }),
    h(Safe, { fallback: h(Placeholder, { colors, size }) }, h(Suspense, { fallback: null }, h(Assembly, { url, colors, size, progress, gap, labels, still }))),
    h(ContactShadows, { position: [0, -0.02, 0], opacity: 0.3, scale: 5, blur: 2.8, far: 3, resolution: 512 }));
  // Reduced motion: one ordinary-height section, shown taken apart with its labels.
  if (still) return h('div', { className, style: { position: 'relative', height: 560, ...style } }, scene, children || null);
  return h('div', { ref: outer, className, style: { position: 'relative', height: screens * 100 + 'vh', ...style }, 'data-kq-assembly': 'true' },
    h('div', { style: { position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' } }, scene, children || null));
}

// Preload the library objects a page names, so the hero appears quickly.
export function preloadObjects(names = []) {
  for (const n of names) { const u = urlOf(n); if (u) useGLTF.preload(u); }
}
