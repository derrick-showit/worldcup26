import React, { useEffect, useRef, useState } from 'react';

/* Smooth odometer-style number tween (à la deximal.com).
   Animates from the previous value to the new value over ~400ms with an
   ease-out, using requestAnimationFrame. Cleans up on unmount. No deps.
   Formats with thousands separators (en-US) unless `format` is supplied. */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

export default function AnimatedNumber({ value, duration = 400, format, className, suffix }) {
  const target = Number.isFinite(+value) ? +value : 0;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) { setDisplay(to); return undefined; }
    startRef.current = 0;
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(p);
      const cur = from + (to - from) * eased;
      setDisplay(cur);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  // keep fromRef in sync if a tween was interrupted mid-flight
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const rounded = Math.round(display);
  const text = format ? format(rounded) : rounded.toLocaleString('en-US');
  return <span className={className}>{text}{suffix || ''}</span>;
}
