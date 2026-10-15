---
name: Product videos (Remotion)
description: Animated product videos made in React with Remotion and played inline with @remotion/player: hero demo loops, feature walkthroughs and social clips, without filming anything. Use when a page needs a product video or animated demo.
---
# Product videos with Remotion

Remotion turns React components into video. In a web app, write a composition and play it with `@remotion/player` (packages `remotion` and `@remotion/player`). Licensing: Remotion is free for individuals, non-profits and companies of up to 3 people; larger companies need a Remotion company license (remotion.pro). Mention this to the user when you add it.

## A composition
```jsx
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from 'remotion';
export function TripDemo() {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill className="bg-[#faf8f5] p-16 font-sans">
      <h2 style={{ opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }} className="text-6xl font-bold">Toronto → Calgary</h2>
      <Sequence from={30}><Row label="AC 115 · YYZ → YYC · 07:00" price="$412" /></Sequence>
      <Sequence from={55}><Row label="Hotel Arts · 2 nights" price="$398" /></Sequence>
    </AbsoluteFill>
  );
}
```
Use `interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })` for fades and `spring()` for movement. Tailwind classes work inside compositions.

## Playing it on a page
```jsx
import { Player } from '@remotion/player';
<Player component={TripDemo} durationInFrames={180} fps={30} compositionWidth={1280} compositionHeight={720}
  style={{ width: '100%', borderRadius: 24 }} autoPlay loop controls={false} acknowledgeRemotionLicense />
```
- Size it with an aspect-ratio wrapper; give it an accessible label and a short text alternative below.
- Keep loops short (4-8 s), show real product UI (not abstract shapes), and pause when off-screen for performance (`playerRef.current.pause()` from an IntersectionObserver).
- Respect reduced motion: show the last frame as a still (`initialFrame={durationInFrames-1}` and no autoPlay).

## Good uses
A hero loop of the product doing its main job; a 3-step "how it works" video; before/after transitions; animated charts for a launch post. Exporting MP4 files needs the Remotion renderer on a server and is not available inside a Kairoq app.
