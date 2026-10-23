import { useState } from 'react';

// An image with a warm placeholder, so a slow or missing photo never leaves a hole.
export default function Photo({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={'photo overflow-hidden ' + className} role={failed ? 'img' : undefined} aria-label={failed ? alt : undefined}>
      {!failed && <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />}
    </div>
  );
}
