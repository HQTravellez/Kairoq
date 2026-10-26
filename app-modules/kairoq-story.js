// kairoq/story: 3D "journey" scenes for generated apps (how something is made, step by step).
//
// <CoffeeJourney />  a ready scene: cup set under the machine, espresso poured, cup handed to a guest.
// <Story>            a storyboard player for your own steps; the props below are the building blocks.
// Props: EspressoMachine, Cup, PourStream, Steam, Counter, Hand (detailed, layered, real materials).
//
// Built on React Three Fiber 8 and drei 9 (MIT) through kairoq/scene's Scene3D, so it shows a
// still fallback without WebGL, only animates while on screen, holds still for people who prefer
// reduced motion, and marks itself as drawn for Kairoq's browser check.
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, RoundedBox, useGLTF } from '@react-three/drei';
import { Scene3D, prefersStill, themeColor } from 'kairoq/scene';
import { basename } from 'kairoq';

// ---------- Blender-made models ----------
// The props are modelled in Blender (scripts/props/ in Kairoq) and copied into every app that
// uses kairoq/story, under <app>/props/. While one loads, the code-built version stands in.
export const PROPS = {
  machine: 'espresso-machine.glb', cup: 'espresso-cup.glb',
  oven: 'pizza-oven.glb', pizza: 'pizza.glb', peel: 'pizza-peel.glb', box: 'pizza-box.glb',
};
const propUrl = (file) => (basename || '') + '/props/' + file;

// One Blender model. nodes: { name: ref } fills refs with named parts (a box's "Lid", a pizza's
// "Cheese") so the story can move or colour them; materials are copied so changes stay local.
function Model({ file, position, nodes }) {
  const { scene } = useGLTF(propUrl(file));
  const copy = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.castShadow = o.receiveShadow = true; } });
    return clone;
  }, [scene]);
  useLayoutEffect(() => {
    for (const [name, ref] of Object.entries(nodes || {})) ref.current = copy.getObjectByName(name) || null;
  }, [copy, nodes]);
  return h('primitive', { object: copy, position });
}

// The Blender model, with the code-built prop shown until it has loaded (or if it cannot load).
export function Prop({ file, fallback, position, nodes }) {
  return h(PropBoundary, { fallback }, h(Suspense, { fallback }, h(Model, { file, position, nodes })));
}
class PropBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const h = React.createElement;

// ---------- materials ----------
// One place for every surface, so the whole scene reads as one designed set.
export function useStoryMaterials(accent) {
  return useMemo(
    () => ({
      steel: new THREE.MeshPhysicalMaterial({ color: '#d4d7dc', metalness: 0.92, roughness: 0.28, clearcoat: 0.4 }),
      darkSteel: new THREE.MeshStandardMaterial({ color: '#2b2d31', metalness: 0.8, roughness: 0.38 }),
      grate: new THREE.MeshStandardMaterial({ color: '#17181b', metalness: 0.7, roughness: 0.5 }),
      accent: new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0.35, roughness: 0.32, clearcoat: 0.8 }),
      bakelite: new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.45 }),
      gaugeFace: new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.35 }),
      ceramic: new THREE.MeshPhysicalMaterial({ color: '#f7f4ef', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12 }),
      coffee: new THREE.MeshPhysicalMaterial({ color: '#2a170c', roughness: 0.15, clearcoat: 1 }),
      crema: new THREE.MeshStandardMaterial({ color: '#c08a52', roughness: 0.55 }),
      stream: new THREE.MeshStandardMaterial({ color: '#4a2a14', roughness: 0.2, transparent: true, opacity: 0.92 }),
      wood: new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.62, metalness: 0.02 }),
      woodEdge: new THREE.MeshStandardMaterial({ color: '#5b3b25', roughness: 0.7 }),
      skin: new THREE.MeshStandardMaterial({ color: '#d9a982', roughness: 0.62 }),
      sleeve: new THREE.MeshStandardMaterial({ color: '#33302c', roughness: 0.85 }),
    }),
    [accent]
  );
}

// ---------- props ----------
// The espresso machine: plinth, drip tray, body, branded panel, gauges, group head, portafilter,
// spouts, steam wand and cup rail. Its spouts sit at SPOUT (local coordinates).
export const SPOUT = [0, 0.47, 0.27];

export function EspressoMachine({ materials, position = [0, 0, 0] }) {
  const m = materials;
  return h(
    'group',
    { position },
    // Feet and plinth.
    ...[-0.5, 0.5].flatMap((x) =>
      [-0.25, 0.25].map((z) =>
        h('mesh', { key: x + ':' + z, position: [x, 0.02, z], material: m.darkSteel, castShadow: true }, h('cylinderGeometry', { args: [0.04, 0.05, 0.04, 20] }))
      )
    ),
    h(RoundedBox, { args: [1.22, 0.1, 0.78], radius: 0.03, position: [0, 0.09, 0], material: m.darkSteel, castShadow: true, receiveShadow: true }),
    // Drip tray with its grate bars.
    h('mesh', { position: [0, 0.155, 0.22], material: m.grate, receiveShadow: true }, h('boxGeometry', { args: [0.62, 0.03, 0.3] })),
    ...Array.from({ length: 9 }, (_, i) =>
      h('mesh', { key: 'bar' + i, position: [-0.26 + i * 0.065, 0.175, 0.22], material: m.steel }, h('boxGeometry', { args: [0.018, 0.012, 0.28] }))
    ),
    // Back column and upper body.
    h(RoundedBox, { args: [1.2, 0.56, 0.36], radius: 0.04, position: [0, 0.42, -0.2], material: m.steel, castShadow: true }),
    h(RoundedBox, { args: [1.24, 0.38, 0.78], radius: 0.06, position: [0, 0.89, 0], material: m.steel, castShadow: true }),
    // Branded front panel, gauges and knobs.
    h(RoundedBox, { args: [1.02, 0.2, 0.02], radius: 0.01, position: [0, 0.9, 0.395], material: m.accent }),
    ...[-0.32, 0.32].flatMap((x, i) => [
      h('mesh', { key: 'gauge' + i, position: [x, 0.9, 0.41], rotation: [Math.PI / 2, 0, 0], material: m.steel }, h('cylinderGeometry', { args: [0.075, 0.075, 0.02, 40] })),
      h('mesh', { key: 'face' + i, position: [x, 0.9, 0.421], rotation: [Math.PI / 2, 0, 0], material: m.gaugeFace }, h('cylinderGeometry', { args: [0.062, 0.062, 0.004, 40] })),
      h('mesh', { key: 'needle' + i, position: [x + 0.012, 0.912, 0.425], rotation: [0, 0, -0.8 + i * 0.5], material: m.bakelite }, h('boxGeometry', { args: [0.05, 0.006, 0.002] })),
    ]),
    // Cup warmer rail on top.
    h('mesh', { position: [0, 1.13, 0.3], rotation: [0, 0, Math.PI / 2], material: m.steel }, h('cylinderGeometry', { args: [0.012, 0.012, 1.1, 12] })),
    ...[-0.53, 0.53].map((x) => h('mesh', { key: 'post' + x, position: [x, 1.1, 0.3], material: m.steel }, h('cylinderGeometry', { args: [0.012, 0.012, 0.06, 12] }))),
    // Group head, portafilter with its handle, and the two spouts.
    h('mesh', { position: [0, 0.645, 0.25], material: m.steel, castShadow: true }, h('cylinderGeometry', { args: [0.1, 0.11, 0.1, 40] })),
    h('mesh', { position: [0, 0.565, 0.27], material: m.darkSteel, castShadow: true }, h('cylinderGeometry', { args: [0.09, 0.075, 0.06, 40] })),
    h('mesh', { position: [0, 0.57, 0.5], rotation: [Math.PI / 2 - 0.12, 0, 0], material: m.bakelite, castShadow: true }, h('capsuleGeometry', { args: [0.026, 0.3, 8, 16] })),
    ...[-0.025, 0.025].map((x) => h('mesh', { key: 'spout' + x, position: [x, 0.5, 0.27], material: m.steel }, h('cylinderGeometry', { args: [0.01, 0.014, 0.05, 12] }))),
    // Steam wand with its knob.
    h('mesh', { position: [0.47, 0.5, 0.3], rotation: [0, 0, 0.12], material: m.steel, castShadow: true }, h('cylinderGeometry', { args: [0.014, 0.014, 0.42, 16] })),
    h('mesh', { position: [0.47, 0.73, 0.33], material: m.bakelite }, h('sphereGeometry', { args: [0.035, 20, 20] }))
  );
}

// A cup on its saucer, turned from a profile; fill (0 to 1) raises the coffee, crema on top.
export function Cup({ materials, fill = 0, cupRef, coffeeRef, cremaRef, model = true }) {
  const m = materials;
  const cupGeometry = useMemo(() => {
    const outline = [[0, 0], [0.07, 0], [0.085, 0.01], [0.105, 0.11], [0.112, 0.13], [0.1, 0.13], [0.093, 0.12], [0.078, 0.02], [0, 0.02]];
    return new THREE.LatheGeometry(outline.map(([x, y]) => new THREE.Vector2(x, y)), 48);
  }, []);
  const saucerGeometry = useMemo(() => {
    const outline = [[0, 0], [0.15, 0], [0.18, 0.012], [0.19, 0.022], [0.17, 0.02], [0.1, 0.012], [0, 0.012]];
    return new THREE.LatheGeometry(outline.map(([x, y]) => new THREE.Vector2(x, y)), 48);
  }, []);
  const level = 0.025 + 0.085 * fill;
  // The cup and saucer: the Blender model, or the code-built shape while it loads.
  const shell = h('group', null,
    h('mesh', { geometry: saucerGeometry, material: m.ceramic, castShadow: true, receiveShadow: true }),
    h('mesh', { geometry: cupGeometry, material: m.ceramic, castShadow: true, position: [0, 0.012, 0] }),
    h('mesh', { position: [0.118, 0.082, 0], rotation: [0, 0, Math.PI / 2], material: m.ceramic, castShadow: true }, h('torusGeometry', { args: [0.03, 0.009, 12, 24, Math.PI] })));
  return h(
    'group',
    { ref: cupRef },
    model ? h(Prop, { file: PROPS.cup, fallback: shell }) : shell,
    // The coffee and crema stay live, so the cup can fill as the shot pours.
    h('group', { position: [0, 0.012, 0] },
      h('mesh', { ref: coffeeRef, position: [0, level / 2 + 0.01, 0], scale: [1, Math.max(0.001, fill), 1], material: m.coffee }, h('cylinderGeometry', { args: [0.082, 0.072, 0.09, 40] })),
      h('mesh', { ref: cremaRef, position: [0, level + 0.012, 0], rotation: [-Math.PI / 2, 0, 0], visible: fill > 0.6, material: m.crema }, h('circleGeometry', { args: [0.086, 40] }))
    )
  );
}

// The espresso pouring from the two spouts (height: spout to cup surface).
export function PourStream({ materials, height = 0.3, streamRef }) {
  return h(
    'group',
    { ref: streamRef },
    ...[-0.025, 0.025].map((x) =>
      h('mesh', { key: x, position: [x, -height / 2, 0], material: materials.stream }, h('cylinderGeometry', { args: [0.006, 0.009, height, 10] }))
    )
  );
}

// A soft round puff (radial gradient), drawn once and shared by every steam sprite.
let puffTexture = null;
function softPuff() {
  if (puffTexture) return puffTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  puffTexture = new THREE.CanvasTexture(canvas);
  return puffTexture;
}

// Soft steam rising from a cup; strength 0 to 1.
export function Steam({ strength = 1 }) {
  const puffs = useRef([]);
  const seeds = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ phase: i / 12, drift: (i % 3) - 1 })), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    puffs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = seeds[i], k = (t * 0.35 + s.phase) % 1;
      mesh.position.set(Math.sin(t + i) * 0.02 + s.drift * 0.02 * k, 0.05 + k * 0.42, Math.cos(t * 0.8 + i) * 0.015);
      mesh.scale.setScalar(0.06 + k * 0.2);
      mesh.material.opacity = 0.35 * strength * Math.sin(Math.PI * k);
    });
  });
  const map = useMemo(softPuff, []);
  return h('group', null, ...seeds.map((_, i) => h('sprite', { key: i, ref: (el) => (puffs.current[i] = el) }, h('spriteMaterial', { map, transparent: true, depthWrite: false, opacity: 0 }))));
}

// The counter: a wood top with a darker front edge.
export function Counter({ materials, width = 5.2, depth = 1.5 }) {
  return h(
    'group',
    null,
    h(RoundedBox, { args: [width, 0.08, depth], radius: 0.02, position: [0, -0.04, 0], material: materials.wood, receiveShadow: true }),
    // The front panel runs well below the frame, so the counter never looks like it floats.
    h('mesh', { position: [0, -1.08, depth / 2 - 0.02], material: materials.woodEdge, receiveShadow: true }, h('boxGeometry', { args: [width, 2, 0.04] }))
  );
}

// A stylised hand reaching in from the right, palm up, with a sleeve.
export function Hand({ materials, handRef, position = [0, 0, 0] }) {
  const m = materials;
  return h(
    'group',
    { ref: handRef, position, rotation: [0, 0, 0.08] },
    h('mesh', { position: [0.42, 0.02, 0], rotation: [0, 0, Math.PI / 2], material: m.sleeve, castShadow: true }, h('cylinderGeometry', { args: [0.085, 0.095, 0.5, 24] })),
    h('mesh', { position: [0.13, 0.01, 0], rotation: [0, 0, Math.PI / 2], material: m.skin, castShadow: true }, h('cylinderGeometry', { args: [0.055, 0.065, 0.12, 20] })),
    h(RoundedBox, { args: [0.2, 0.06, 0.17], radius: 0.028, position: [-0.04, 0, 0], material: m.skin, castShadow: true }),
    ...[-0.06, -0.02, 0.02, 0.06].map((z, i) =>
      h('mesh', { key: 'finger' + i, position: [-0.18 + Math.abs(z) * 0.4, 0.02, z], rotation: [0, 0, Math.PI / 2 - 0.35], material: m.skin, castShadow: true }, h('capsuleGeometry', { args: [0.017, 0.09 - Math.abs(z) * 0.3, 6, 12] }))
    ),
    h('mesh', { position: [-0.06, 0.03, 0.1], rotation: [0.9, 0, 0.6], material: m.skin, castShadow: true }, h('capsuleGeometry', { args: [0.019, 0.07, 6, 12] }))
  );
}

// ---------- the storyboard player ----------
// Progress runs from 0 (before the first step) to the number of steps: picking step i moves it
// smoothly to i + 1, so props animate in between. Going back to an earlier step starts the story
// again from the beginning instead of playing it backwards.
export function useStoryProgress(step) {
  const target = step + 1;
  const progress = useRef(0);
  const still = prefersStill();
  useFrame((_, dt) => {
    if (still) progress.current = target;
    else {
      if (target < progress.current - 0.5) progress.current = target - 1;
      progress.current = THREE.MathUtils.damp(progress.current, target, 2.6, Math.min(dt, 0.1));
    }
  });
  return progress;
}

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// Moves the camera smoothly: wide screens see the whole set (width in world units, centred);
// narrow ones stay closer and follow the action (follow: the x position to keep in view).
export function followCamera({ camera, size, look, dt, follow = 0, width = 4.7, narrowWidth = 2.6, height = 1.25, lookY = 0.42 }) {
  const aspect = size.width / Math.max(1, size.height);
  const wide = aspect > 1.15 && size.width >= 560;
  const view = wide ? width : narrowWidth;
  const distance = THREE.MathUtils.clamp(view / 2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect), 3.2, 9);
  const focusX = wide ? 0 : follow;
  const k = 1 - Math.exp(-4 * Math.min(dt, 0.1));
  camera.position.x += (focusX + 0.1 - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (distance - camera.position.z) * k;
  look.set(focusX, lookY, 0);
  camera.lookAt(look);
}

// Keeps the whole counter in view on wide and narrow screens.
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const distance = aspect < 0.9 ? 5.6 : aspect < 1.3 ? 4.4 : 3.6;
    camera.position.set(0.25, 1.35, distance);
    camera.lookAt(0, 0.45, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

// ---------- CoffeeJourney: the ready scene ----------
const COFFEE_STEPS = [
  { title: 'Set the cup', text: 'A warm cup goes under the group head.' },
  { title: 'Pull the shot', text: 'Espresso pours from the spouts and the crema settles.' },
  { title: 'Hand it over', text: 'The finished cup slides across the counter to the guest.' },
];
const MACHINE_X = -1.25, CUP_START = [-0.35, 0, 0.45], CUP_UNDER = [MACHINE_X, 0.17, 0.27], CUP_GUEST = [1.25, 0, 0.35];

function CoffeeScene({ step, accent }) {
  const materials = useStoryMaterials(accent);
  const progress = useStoryProgress(step);
  const cup = useRef(), coffee = useRef(), crema = useRef(), stream = useRef(), hand = useRef();
  const [steaming, setSteaming] = useState(false);
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    // 0 to 1: the cup slides under the machine; 1 to 2: the shot pours; 2 to 3: the cup goes to the guest.
    const p = progress.current;
    const toMachine = ease(p), fill = ease((p - 1) / 0.85), toGuest = ease(p - 2);
    if (cup.current) {
      // Step 1: slide from the cup stack onto the drip tray; step 3: glide in an arc to the guest.
      const x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(CUP_START[0], CUP_UNDER[0], toMachine), CUP_GUEST[0], toGuest);
      const y = THREE.MathUtils.lerp(THREE.MathUtils.lerp(CUP_START[1], CUP_UNDER[1], toMachine), CUP_GUEST[1], toGuest) + Math.sin(Math.PI * toGuest) * 0.12;
      const z = THREE.MathUtils.lerp(THREE.MathUtils.lerp(CUP_START[2], CUP_UNDER[2], toMachine), CUP_GUEST[2], toGuest);
      cup.current.position.set(x, y, z);
    }
    if (coffee.current) {
      coffee.current.scale.y = Math.max(0.001, fill);
      coffee.current.position.y = (0.025 + 0.085 * fill) / 2 + 0.01;
    }
    if (crema.current) {
      crema.current.visible = fill > 0.6;
      crema.current.position.y = 0.025 + 0.085 * fill + 0.012;
    }
    if (stream.current) stream.current.visible = p > 1.03 && p < 1.85;
    if (hand.current) hand.current.position.x = THREE.MathUtils.lerp(2.4, 1.55, ease((p - 1.9) / 0.9));
    // Camera: wide screens see the whole counter; narrow ones follow the cup (machine, then guest).
    followCamera({ camera, size, look, dt, follow: THREE.MathUtils.lerp(MACHINE_X + 0.35, CUP_GUEST[0] + 0.15, toGuest), width: 4.7 });
    const shouldSteam = p > 1.6;
    if (shouldSteam !== steaming) setSteaming(shouldSteam);
  });
  return h(
    React.Fragment,
    null,
    h('directionalLight', { position: [-2, 4, 3], intensity: 1.2, color: '#ffe4c4' }),
    h('pointLight', { position: [1.5, 1.8, 1.5], intensity: 6, color: '#ffb36b', distance: 6 }),
    h(Counter, { materials }),
    h(Prop, { file: PROPS.machine, position: [MACHINE_X, 0, 0], fallback: h(EspressoMachine, { materials, position: [MACHINE_X, 0, 0] }) }),
    h('group', { position: [MACHINE_X + SPOUT[0], SPOUT[1] - 0.025, SPOUT[2]] }, h(PourStream, { materials, height: 0.28, streamRef: stream })),
    // The cup stack waiting by the machine.
    h('group', { position: [-0.35, 0, -0.25] }, h(Cup, { materials, fill: 0 })),
    h('group', { position: [-0.1, 0, -0.3] }, h(Cup, { materials, fill: 0 })),
    h('group', { ref: cup }, h(Cup, { materials, coffeeRef: coffee, cremaRef: crema }), steaming ? h('group', { position: [0, 0.14, 0] }, h(Steam, {})) : null),
    h(Hand, { materials, handRef: hand, position: [2.3, 0.12, 0.35] }),
    h(ContactShadows, { position: [0, 0.002, 0], opacity: 0.45, scale: 6, blur: 2.4, far: 1.2, resolution: 512, color: '#1a0f08' })
  );
}

// ---------- pizza: from the oven to the customer ----------
function usePizzaMaterials() {
  return useMemo(
    () => ({
      dome: new THREE.MeshStandardMaterial({ color: '#b5653a', roughness: 0.92, side: THREE.DoubleSide }),
      brick: new THREE.MeshStandardMaterial({ color: '#8f4325', roughness: 0.95 }),
      stone: new THREE.MeshStandardMaterial({ color: '#6d6259', roughness: 0.9 }),
      soot: new THREE.MeshStandardMaterial({ color: '#140c08', roughness: 1 }),
      ember: new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 2.4, roughness: 0.6 }),
      log: new THREE.MeshStandardMaterial({ color: '#4a2c18', roughness: 0.95 }),
      peelWood: new THREE.MeshStandardMaterial({ color: '#a8743f', roughness: 0.7 }),
      dough: new THREE.MeshStandardMaterial({ color: '#e9c98f', roughness: 0.85 }),
      crust: new THREE.MeshStandardMaterial({ color: '#d9a35e', roughness: 0.8 }),
      sauce: new THREE.MeshStandardMaterial({ color: '#b3341c', roughness: 0.55 }),
      cheese: new THREE.MeshPhysicalMaterial({ color: '#f4e6b8', roughness: 0.45, clearcoat: 0.3 }),
      basil: new THREE.MeshStandardMaterial({ color: '#3d7a2a', roughness: 0.6 }),
      pepperoni: new THREE.MeshStandardMaterial({ color: '#9c2a1a', roughness: 0.5 }),
      cardboard: new THREE.MeshStandardMaterial({ color: '#c69a64', roughness: 0.9 }),
      cardboardInside: new THREE.MeshStandardMaterial({ color: '#e8d2ad', roughness: 0.95 }),
    }),
    []
  );
}

// A wood-fired dome oven: stone base, brick dome, arched mouth with a live fire inside.
const MOUTH = 0.46; // half the width of the mouth, as an angle around the dome
export function StoneOven({ pizzaMaterials, position = [0, 0, 0] }) {
  const m = pizzaMaterials;
  return h(
    'group',
    { position },
    h(RoundedBox, { args: [1.6, 0.36, 1.3], radius: 0.04, position: [0, 0.18, 0], material: m.stone, castShadow: true, receiveShadow: true }),
    // The dome, with the mouth cut out of its front so the fire and the pizza show inside:
    // the dome leaves a slot facing the front, and a patch closes the slot above the arch.
    h('mesh', { position: [0, 0.36, 0], material: m.dome, castShadow: true }, h('sphereGeometry', { args: [0.68, 48, 32, Math.PI / 2 + MOUTH, Math.PI * 2 - 2 * MOUTH, 0, Math.PI / 2] })),
    h('mesh', { position: [0, 0.36, 0], material: m.dome }, h('sphereGeometry', { args: [0.68, 16, 16, Math.PI / 2 - MOUTH, 2 * MOUTH, 0, 1.12] })),
    // Brick arch around the mouth, the oven floor inside, and the chimney.
    h('mesh', { position: [0, 0.36, 0.6], material: m.brick, castShadow: true }, h('torusGeometry', { args: [0.3, 0.06, 16, 40, Math.PI] })),
    h('mesh', { position: [0, 0.362, 0], rotation: [-Math.PI / 2, 0, 0], material: m.soot }, h('circleGeometry', { args: [0.66, 48] })),
    h('mesh', { position: [0, 1.05, -0.15], material: m.brick, castShadow: true }, h('cylinderGeometry', { args: [0.09, 0.11, 0.4, 20] })),
  );
}

// The fire inside the oven (glowing embers, logs and a flickering light), kept live in code so it
// can flicker, whichever oven model is showing.
export function OvenFire({ pizzaMaterials, position = [0, 0, 0], fireRef }) {
  const m = pizzaMaterials;
  return h(
    'group',
    { position },
    h('mesh', { position: [-0.18, 0.42, 0.05], material: m.ember }, h('sphereGeometry', { args: [0.13, 20, 16] })),
    h('mesh', { position: [0.05, 0.4, 0.0], material: m.ember }, h('sphereGeometry', { args: [0.1, 20, 16] })),
    h('mesh', { position: [-0.1, 0.39, 0.02], rotation: [0, 0.6, Math.PI / 2], material: m.log }, h('cylinderGeometry', { args: [0.035, 0.035, 0.32, 12] })),
    h('mesh', { position: [-0.05, 0.39, 0.08], rotation: [0, -0.5, Math.PI / 2], material: m.log }, h('cylinderGeometry', { args: [0.03, 0.03, 0.28, 12] })),
    h('pointLight', { ref: fireRef, position: [0, 0.5, 0.45], intensity: 4, color: '#ff8a3a', distance: 2.6 })
  );
}

// A pizza: dough, raised crust, sauce, cheese (baked 0 to 1 turns it golden), basil and pepperoni.
export function Pizza({ pizzaMaterials, pizzaRef, cheeseRef }) {
  const m = pizzaMaterials;
  const toppings = useMemo(
    () => [
      ...[0, 1.2, 2.4, 3.6, 4.8].map((a) => ({ kind: 'pepperoni', x: Math.cos(a) * 0.12, z: Math.sin(a) * 0.12 })),
      ...[0.6, 2.2, 3.9, 5.4].map((a) => ({ kind: 'basil', x: Math.cos(a) * 0.07, z: Math.sin(a) * 0.07, r: a })),
    ],
    []
  );
  return h(
    'group',
    { ref: pizzaRef },
    h('mesh', { position: [0, 0.01, 0], material: m.dough, castShadow: true }, h('cylinderGeometry', { args: [0.22, 0.22, 0.02, 48] })),
    h('mesh', { position: [0, 0.022, 0], rotation: [Math.PI / 2, 0, 0], material: m.crust, castShadow: true }, h('torusGeometry', { args: [0.205, 0.022, 12, 48] })),
    h('mesh', { position: [0, 0.022, 0], material: m.sauce }, h('cylinderGeometry', { args: [0.19, 0.19, 0.006, 48] })),
    h('mesh', { ref: cheeseRef, position: [0, 0.027, 0], material: m.cheese }, h('cylinderGeometry', { args: [0.175, 0.175, 0.006, 48] })),
    ...toppings.map((t, i) =>
      t.kind === 'pepperoni'
        ? h('mesh', { key: i, position: [t.x, 0.033, t.z], material: m.pepperoni }, h('cylinderGeometry', { args: [0.03, 0.03, 0.006, 24] }))
        : h('mesh', { key: i, position: [t.x, 0.034, t.z], rotation: [-Math.PI / 2, 0, t.r], scale: [1, 0.55, 1], material: m.basil }, h('circleGeometry', { args: [0.025, 16] }))
    )
  );
}

// A pizza peel: long wooden handle and a thin blade the pizza rides on.
export function Peel({ pizzaMaterials, materials, peelRef }) {
  return h(
    'group',
    { ref: peelRef },
    h(RoundedBox, { args: [0.48, 0.012, 0.5], radius: 0.005, position: [0, 0, 0], material: materials.steel, castShadow: true }),
    // The handle points towards the viewer, the way a pizzaiolo holds it at the oven mouth.
    h('mesh', { position: [0, 0.03, 0.6], rotation: [Math.PI / 2 - 0.08, 0, 0], material: pizzaMaterials.peelWood, castShadow: true }, h('cylinderGeometry', { args: [0.02, 0.022, 0.7, 12] }))
  );
}

// A takeaway pizza box whose lid closes (lidRef rotates about the back edge).
export function PizzaBox({ pizzaMaterials, boxRef, lidRef }) {
  const m = pizzaMaterials;
  const w = 0.52, d = 0.52, t = 0.008, wall = 0.06;
  return h(
    'group',
    { ref: boxRef },
    h('mesh', { position: [0, t / 2, 0], material: m.cardboardInside, receiveShadow: true, castShadow: true }, h('boxGeometry', { args: [w, t, d] })),
    ...[[0, wall / 2, d / 2, w, wall, t], [0, wall / 2, -d / 2, w, wall, t], [w / 2, wall / 2, 0, t, wall, d], [-w / 2, wall / 2, 0, t, wall, d]].map(([x, y, z, sx, sy, sz], i) =>
      h('mesh', { key: i, position: [x, y, z], material: m.cardboard, castShadow: true }, h('boxGeometry', { args: [sx, sy, sz] }))
    ),
    h('group', { ref: lidRef, position: [0, wall, -d / 2] }, h('mesh', { position: [0, 0, d / 2], material: m.cardboard, castShadow: true }, h('boxGeometry', { args: [w, t, d] })))
  );
}

const PIZZA_STEPS = [
  { title: 'Into the oven', text: 'The pizza slides off the peel onto the hot stone floor.' },
  { title: 'Bake in the fire', text: 'Ninety seconds by the flames: the crust puffs and the cheese turns golden.' },
  { title: 'Box it', text: 'Out on the peel, into the box, lid closed while it is hot.' },
  { title: 'Hand it over', text: 'The box slides across the counter to the customer.' },
];
const OVEN_X = -1.35, PIZZA_PREP = [0.15, 0.03, 0.45], PIZZA_IN = [OVEN_X, 0.39, 0.3], BOX_AT = [0.55, 0, 0.42], BOX_GUEST = [1.45, 0, 0.36], PEEL_REST = [-0.2, 0.03, -0.5];
const lerp3 = (out, a, b, t) => out.set(THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t), THREE.MathUtils.lerp(a[2], b[2], t));
const RAW = new THREE.Color('#f4e6b8'), BAKED = new THREE.Color('#e3a546');

function PizzaScene({ step }) {
  const materials = useStoryMaterials('#b08968');
  const pm = usePizzaMaterials();
  const progress = useStoryProgress(step);
  const pizza = useRef(), cheese = useRef(), peel = useRef(), box = useRef(), lid = useRef(), hand = useRef(), fire = useRef();
  const cheeseNode = useMemo(() => ({ Cheese: cheese }), []), lidNode = useMemo(() => ({ Lid: lid }), []);
  const [steaming, setSteaming] = useState(false);
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []), at = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    // 0-1 into the oven; 1-2 bake; 2-2.5 out on the peel; 2.5-3 into the box, lid closes; 3-4 to the customer.
    const p = progress.current, t = clock.getElapsedTime();
    const inOven = ease(p), bake = ease((p - 1) / 0.9), out = ease((p - 2) / 0.5), boxed = ease((p - 2.5) / 0.45), lidShut = ease((p - 2.7) / 0.3), toGuest = ease(p - 3);
    // The fire flickers, brighter while baking.
    if (fire.current) fire.current.intensity = (3.2 + Math.sin(t * 13) * 0.5 + Math.sin(t * 7.3) * 0.7) * (1 + 0.4 * Math.sin(Math.PI * bake));
    if (pizza.current) {
      if (p < 2) lerp3(at, PIZZA_PREP, PIZZA_IN, inOven);
      else if (p < 2.5) lerp3(at, PIZZA_IN, [BOX_AT[0] - 0.55, 0.12, BOX_AT[2]], out);
      else lerp3(at, [BOX_AT[0] - 0.55, 0.12, BOX_AT[2]], [BOX_AT[0], 0.012, BOX_AT[2]], boxed);
      if (p >= 3) lerp3(at, [BOX_AT[0], 0.012, BOX_AT[2]], [BOX_GUEST[0], 0.012, BOX_GUEST[2]], toGuest);
      pizza.current.position.copy(at);
      pizza.current.scale.setScalar(1 + 0.03 * bake);
    }
    if (cheese.current) cheese.current.material.color.copy(RAW).lerp(BAKED, bake);
    if (peel.current) {
      // The peel carries the pizza in and out; between trips it rests at the back.
      const carrying = p < 1 || (p >= 2 && p < 2.5);
      if (carrying) peel.current.position.set(at.x, at.y - 0.012, at.z);
      else peel.current.position.lerp(at.set(...PEEL_REST), 1 - Math.exp(-6 * Math.min(dt, 0.1)));
    }
    if (box.current) lerp3(box.current.position, BOX_AT, BOX_GUEST, toGuest);
    if (lid.current) lid.current.rotation.x = -Math.PI * 0.62 * (1 - lidShut);
    if (hand.current) hand.current.position.x = THREE.MathUtils.lerp(2.5, 1.85, ease((p - 2.9) / 0.9));
    const follow = p < 2.3 ? OVEN_X + 0.4 : THREE.MathUtils.lerp(BOX_AT[0], BOX_GUEST[0] + 0.15, toGuest);
    followCamera({ camera, size, look, dt, follow, width: 5, height: 1.45, lookY: 0.4 });
    const shouldSteam = p > 1.6 && p < 2.85;
    if (shouldSteam !== steaming) setSteaming(shouldSteam);
  });
  return h(
    React.Fragment,
    null,
    h('directionalLight', { position: [-2, 4, 3], intensity: 1.1, color: '#ffe0c0' }),
    h('pointLight', { position: [1.6, 1.8, 1.6], intensity: 5, color: '#ffb36b', distance: 6 }),
    h(Counter, { materials, width: 5.8 }),
    h(Prop, { file: PROPS.oven, position: [OVEN_X, 0, -0.1], fallback: h(StoneOven, { pizzaMaterials: pm, position: [OVEN_X, 0, -0.1] }) }),
    h(OvenFire, { pizzaMaterials: pm, position: [OVEN_X, 0, -0.1], fireRef: fire }),
    h('group', { ref: pizza }, h(Prop, { file: PROPS.pizza, nodes: cheeseNode, fallback: h(Pizza, { pizzaMaterials: pm, cheeseRef: cheese }) }), steaming ? h('group', { position: [0, 0.04, 0] }, h(Steam, { strength: 0.8 })) : null),
    h('group', { ref: peel }, h(Prop, { file: PROPS.peel, fallback: h(Peel, { pizzaMaterials: pm, materials }) })),
    h('group', { ref: box }, h(Prop, { file: PROPS.box, nodes: lidNode, fallback: h(PizzaBox, { pizzaMaterials: pm, lidRef: lid }) })),
    h(Hand, { materials, handRef: hand, position: [2.5, 0.12, 0.36] }),
    h(ContactShadows, { position: [0, 0.002, 0], opacity: 0.45, scale: 7, blur: 2.4, far: 1.2, resolution: 512, color: '#1a0f08' })
  );
}

// The step buttons and caption under the scene.
// On wide cards they float over the bottom of the scene; on narrow ones (phones) they sit below it,
// so the caption and buttons never cover the 3D.
function StoryControls({ steps, step, setStep, tone, below }) {
  const dark = tone === 'dark';
  // Below the scene the buttons follow the page's own text colour.
  const button = (active, onPage) => onPage ? {
    padding: '8px 14px', borderRadius: 999, cursor: 'pointer', font: (active ? '700' : '500') + ' 13px/1.2 inherit', color: 'inherit',
    border: (active ? '2px' : '1px') + ' solid currentColor', background: active ? 'rgba(127,127,127,.2)' : 'transparent', opacity: active ? 1 : 0.8,
  } : ({
    padding: '8px 14px', borderRadius: 999, cursor: 'pointer', font: '600 13px/1.2 inherit',
    border: '1px solid ' + (dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)'),
    background: active ? (dark ? '#fff' : '#111') : 'transparent',
    color: active ? (dark ? '#111' : '#fff') : dark ? '#fff' : '#111',
  });
  return h(
    'div',
    { style: below ? { padding: '14px 4px 2px', display: 'flex', flexDirection: 'column', gap: 10, color: 'inherit' } : { position: 'absolute', left: 16, right: 16, bottom: 14, display: 'flex', flexDirection: 'column', gap: 10, color: dark ? '#fff' : '#111' } },
    h('p', { style: { margin: 0, font: '400 14px/1.45 inherit', textShadow: dark && !below ? '0 1px 8px rgba(0,0,0,.6)' : 'none' }, 'aria-live': 'polite' },
      h('strong', null, steps[step].title + '. '), steps[step].text),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
      ...steps.map((s, i) => h('button', { key: i, type: 'button', style: button(i === step, below), onClick: () => setStep(i), 'aria-pressed': i === step }, i + 1 + '. ' + s.title)))
  );
}

// Story: the storyboard player for any journey. children(step, accent) returns the 3D scene for
// the current step; inside it, useStoryProgress(step) gives a smoothly moving progress to animate
// on. step / onStepChange make it controlled; otherwise it plays by itself (autoPlay) and loops.
export function Story({ steps, children, step: controlled, onStepChange, autoPlay = true, seconds = 3.5, accent, tone = 'dark', stage, controls = true, className = '', style, alt, camera }) {
  const [own, setOwn] = useState(0);
  const [touched, setTouched] = useState(false);
  const step = Math.max(0, Math.min(steps.length - 1, controlled ?? own));
  const setStep = (i) => { setTouched(true); onStepChange ? onStepChange(i) : setOwn(i); };
  useEffect(() => {
    if (!autoPlay || touched || controlled != null || prefersStill()) return;
    const timer = setInterval(() => setOwn((i) => (i + 1) % steps.length), seconds * 1000);
    return () => clearInterval(timer);
  }, [autoPlay, touched, controlled, seconds, steps.length]);
  const colour = accent || themeColor('primary', '#b08968');
  // Narrow cards (phones) put the caption and buttons under the scene instead of over it.
  const box = useRef(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 560));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const below = controls && narrow;
  const backdrop = stage || (tone === 'dark' ? 'radial-gradient(ellipse at 45% 35%,#3a2a1f 0%,#1d1612 60%,#120d0a 100%)' : 'radial-gradient(ellipse at 45% 35%,#fffaf3 0%,#f1e7da 60%,#e4d6c4 100%)');
  const scene = h(
    Scene3D,
    {
      alt: alt || 'An animated 3D story', lights: 'studio', stage: backdrop,
      style: { width: '100%', flex: 1, minHeight: below ? 260 : 360, borderRadius: 20 },
      camera: camera || { position: [0.25, 1.35, 3.6], fov: 36 },
      overlay: controls && !below ? h(StoryControls, { steps, step, setStep, tone }) : null,
    },
    h(FitCamera),
    h('group', { position: [0, controls && !below ? 0.12 : 0, 0] }, children(step, colour))
  );
  return h('div', { ref: box, className, style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', ...style } },
    scene, below ? h(StoryControls, { steps, step, setStep, tone, below: true }) : null);
}

// CoffeeJourney: the ready coffee story (machine, pour, hand-over). Same options as Story.
export function CoffeeJourney({ steps = COFFEE_STEPS, alt = 'An espresso being made and handed to a guest', ...options }) {
  return h(Story, { steps, alt, ...options }, (step, accent) => h(CoffeeScene, { step, accent }));
}

// PizzaJourney: the ready pizza story (into the oven, bake, box, hand over). Same options as Story.
export function PizzaJourney({ steps = PIZZA_STEPS, alt = 'A pizza baked in a wood-fired oven, boxed and handed to a customer', ...options }) {
  return h(Story, { steps, alt, ...options }, (step) => h(PizzaScene, { step }));
}

export default CoffeeJourney;
