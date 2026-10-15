---
name: 3D scenes (three.js)
description: Tasteful real-time 3D on websites with three.js: a product or globe in the hero, glTF models, scroll-driven camera moves, with performance and accessibility handled. Use when 3D genuinely explains the product (travel routes, spaces, objects).
---
# 3D scenes with three.js

Use the `three` package (available; load models with `three/examples/jsm/loaders/GLTFLoader.js`, orbit with `three/examples/jsm/controls/OrbitControls.js`). 3D should show something real about the subject: routes on a globe for travel, a room for a hotel, a product you can turn. Never a floating abstract blob.

## A React component pattern
```jsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
export default function Globe({ className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 6);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.6, 64, 64), new THREE.MeshStandardMaterial({ color: '#f4f3f0', roughness: 0.9 }));
    scene.add(globe, new THREE.AmbientLight('#ffffff', 0.9), Object.assign(new THREE.DirectionalLight('#ffffff', 1.2), { position: new THREE.Vector3(3, 2, 4) }));
    const resize = () => { const { width, height } = el.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf, visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(el);
    const tick = () => { raf = requestAnimationFrame(tick); if (!visible) return; if (!reduce) globe.rotation.y += 0.0015; renderer.render(scene, camera); };
    tick();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, []);
  return <div ref={ref} className={className} role="img" aria-label="A globe showing your team's routes" />;
}
```
- Routes: build arcs with `THREE.QuadraticBezierCurve3` between lat/long points lifted off the surface, draw with `TubeGeometry` thin tubes, animate a dot along the curve with `curve.getPoint(t)`.
- Models: `new GLTFLoader().load(url, (g) => scene.add(g.scene))`; openly licensed models (Poly Haven, CC0) or your own; keep under 2 MB.

## Rules
- Always clean up (dispose renderer, geometries and materials, cancel the animation frame) in the effect cleanup.
- Pause rendering when off-screen; cap pixel ratio at 2; one 3D canvas per page.
- Never put essential text or buttons inside the canvas; give it an aria-label and a static fallback (an SVG or image) for reduced motion or when WebGL is unavailable (`try { new THREE.WebGLRenderer() } catch {}`).
- On phones, keep the scene smaller or swap it for the static fallback.
