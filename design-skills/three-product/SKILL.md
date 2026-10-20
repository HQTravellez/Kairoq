---
name: 3D product, built in code
description: A real product (a cake, a bottle, a chair, a ring, a shoe) rebuilt as a code-only three.js model that turns in the hero or on a product page, built pass by pass from a reference photo and checked against it. Use when the owner wants to show one physical product in 3D and has a photo of it.
---
# 3D product, built in code

The method is adapted from img2threejs (github.com/img2threejs/img2threejs, Apache License 2.0): reconstruction by code, not photogrammetry or downloaded models. One photo cannot show the hidden sides, so say in "message" that the model is an approximation of the photo, never a scan.

## Before any code
1. **Check the photo can work.** One clear object, mostly visible, not a crowd or a scene. If the photo is a whole room or a person, use a photograph instead and say why.
2. **List what makes it this product** (its identity features): the silhouette, the proportions (height to width), the 3 to 5 details people recognise (a label band, a handle, a stitched seam, a layer of icing, the gem setting). These decide whether the model is right; the rest is finish.
3. **Plan the parts as a hierarchy:** a root group, then each part as its own mesh with its own material and a pivot where it would move (a lid, a door, a wheel), so it can animate later.

## Build pass by pass
Write the model in one component (`src/components/ProductModel.jsx`), as plain three.js primitives and shapes: `LatheGeometry` for anything turned (bottles, cups, cakes, vases), `ExtrudeGeometry` from a `Shape` for flat profiles (logos, a phone, a chocolate bar), `TubeGeometry` along a curve for handles and straps, boxes with bevels (`RoundedBoxGeometry` from `three/examples/jsm/geometries/RoundedBoxGeometry.js`) for furniture and packaging, small instanced meshes for repeated details (seeds, studs, stitches).
1. **Blockout:** the overall silhouette and proportions only, in one flat colour. Compare with the photo: if the outline is wrong, nothing else matters.
2. **Structure:** the main parts in the right places and sizes.
3. **Form:** the curves, bevels and the identity details.
4. **Materials:** `MeshStandardMaterial` / `MeshPhysicalMaterial` with colours sampled from the photo; roughness and metalness to match (glass: `transmission`, glaze: low roughness, fabric: high roughness). A label or print is a `CanvasTexture` drawn in code with the product's real name, never a fake brand.
5. **Lighting:** a soft key light, a fill and a rim light, a soft contact shadow under the product (`ShadowMaterial` on a plane), on the page's background colour.
6. **Interaction:** a slow turn (pauses on hover, stops with `prefers-reduced-motion`), drag to rotate with `OrbitControls` (zoom and pan off), and the model framed so it never clips at any width.
7. **Optimise:** merge static parts, keep under about 50k triangles, `setPixelRatio(Math.min(devicePixelRatio, 2))`, render only while visible (IntersectionObserver), dispose everything on unmount.

After each pass compare the result with the photo (Kairoq's design review takes screenshots). A pass fails if an identity feature is wrong, even when the whole looks close.

## On the page
- Lazy-load the component (`React.lazy`) and show the product photo until the model is ready, and instead of it when WebGL is not available.
- The model sits in a fixed-ratio frame (for example 4:5 on a phone, 1:1 on desktop) with the product's name, price and the main action beside or under it; the 3D never replaces the real photos in the gallery.
- Keep it to one 3D object per page.
