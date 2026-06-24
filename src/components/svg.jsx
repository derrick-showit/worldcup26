import React from 'react';

// Inline OWC trophy logo SVG (from owc-trophy.svg, <?xml?> stripped, classes scoped).
export function LogoSvg() {
  return (
    <svg className="hdr-trophy" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60.98 121.89" aria-label="Opepen World Cup">
      <defs><style>{`.owctrophy .cls-1{fill:none}.owctrophy .cls-2{fill:#8e6019}.owctrophy .cls-3{fill:#2b5b48}.owctrophy .cls-4{fill:#b18336}.owctrophy .cls-5{fill:#e3ca86}.owctrophy .cls-6{fill:#a7792b}.owctrophy .cls-7{fill:#014127}.owctrophy .cls-8{fill:#9b6c2c}.owctrophy .cls-9{fill:#472808}`}</style></defs>
      <g className="owctrophy">
        <polygon className="cls-1" points="52.02 52.02 30.51 73.53 52.02 52.02 52.02 52.02" />
        <path className="cls-1" d="M8.92,52.02c-1.32-1.32-2.48-2.72-3.51-4.2,1.03,1.48,2.19,2.88,3.51,4.2l21.55,21.55.04-.04-.04.04-21.55-21.55Z" />
        <polygon className="cls-1" points="30.51 30.51 30.51 30.51 30.51 30.51 30.51 30.51" />
        <path className="cls-1" d="M3.61,44.86c-.12-.21-.23-.43-.34-.65.11.22.22.43.34.65Z" />
        <path className="cls-1" d="M5.04,47.26c-.12-.18-.23-.36-.35-.54.11.18.23.36.35.54Z" />
        <path className="cls-4" d="M52.02,52.02l-21.51,21.51v17.89h30.47V30.51h-.04c0,7.79-2.98,15.57-8.92,21.51l.04.04-.04-.04h0Z" />
        <rect className="cls-7" x="30.51" y="91.42" width="30.47" height="30.47" />
        <path className="cls-8" d="M30.51,73.57v-.04l-.04.04-21.55-21.55c-1.32-1.32-2.48-2.72-3.51-4.2-.13-.18-.25-.37-.38-.56-.12-.18-.23-.36-.35-.54-.39-.61-.75-1.23-1.08-1.86-.12-.21-.23-.43-.34-.65-.89-1.77-1.61-3.61-2.13-5.49-.62-2.21-.99-4.48-1.1-6.76v59.44h30.47v-17.85Z" />
        <rect className="cls-3" x=".04" y="91.42" width="30.47" height="30.47" />
        <path className="cls-5" d="M52.06,8.96s-.02-.03-.04-.04h0c-11.9-11.9-31.19-11.9-43.09,0l21.58,21.58,21.55-21.55Z" />
        <polygon className="cls-6" points="30.51 30.51 30.43 30.51 8.92 52.02 30.47 73.57 30.51 73.53 52.02 52.02 52.02 52.02 52.02 52.02 30.51 30.51 30.51 30.51" />
        <path className="cls-2" d="M1.13,38.73c.53,1.88,1.24,3.72,2.13,5.49.11.22.22.43.34.65.34.63.7,1.25,1.08,1.86.11.18.23.36.35.54.12.19.25.37.38.56,1.03,1.48,2.19,2.88,3.51,4.2l21.51-21.51h.07S8.92,8.93,8.92,8.93h0C2.59,15.26-.37,23.68.04,31.97H.04c.11,2.28.48,4.55,1.1,6.76Z" />
        <path className="cls-2" d="M5.41,47.82c-.13-.18-.25-.37-.38-.56.12.19.25.37.38.56Z" />
        <path className="cls-2" d="M4.69,46.72c-.39-.61-.75-1.23-1.08-1.86.34.63.7,1.25,1.08,1.86Z" />
        <path className="cls-2" d="M3.27,44.22c-.89-1.77-1.61-3.61-2.13-5.49.53,1.88,1.24,3.72,2.13,5.49Z" />
        <path className="cls-2" d="M.04,31.97H.04c.11,2.28.48,4.55,1.1,6.76-.62-2.21-.99-4.48-1.1-6.76Z" />
        <path className="cls-9" d="M30.51,30.51l21.51,21.51c5.94-5.94,8.92-13.72,8.92-21.51,0-7.79-2.95-15.59-8.89-21.55l-21.55,21.55h0Z" />
      </g>
    </svg>
  );
}

export function XLogo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline-block' }}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ===== FIELD MARKINGS (public/field-2.svg, inlined) =====
   field-2 viewBox is 0 0 1491.5 663.44 — an 18×8 grid in its own units that
   INCLUDES the goal boxes (~82.8 units = one logical cell on each side).
   The inner 16 columns map onto the 1600×800 play area; the goal boxes stick
   out exactly one 100px cell on each side. In the board CSS this overlay is
   positioned at x:-100 spanning 1800×800 (i.e. left:-6.25%; width:112.5%).
   Aspect 1491.5/663.44 ≈ 2.248 ≈ 1800/800 = 2.25 — close enough to align. */
export function FieldSvg() {
  return (
    <svg className="field-svg" viewBox="0 0 1491.5 663.44" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="var(--pitch)" strokeWidth="2" strokeMiterlimit="10">
        <polyline points="83.31 414.53 .5 414.53 .5 248.92 83.31 248.92" />
        <polyline points="1408.19 248.92 1491 248.92 1491 414.53 1408.19 414.53" />
        <rect x="83.31" y=".5" width="662.44" height="662.44" />
        <rect x="745.75" y=".5" width="662.44" height="662.44" />
        <circle cx="745.75" cy="331.72" r="165.61" />
        <polyline points="83.31 166.11 248.92 166.11 248.92 497.33 83.31 497.33" />
        <polyline points="1408.19 497.33 1242.58 497.33 1242.58 166.11 1408.19 166.11" />
        <path d="M248.92,331.72v82.81h0c45.73,0,82.81-37.07,82.81-82.81h0c0-45.73-37.07-82.81-82.81-82.81h0" />
        <path d="M1242.58,248.92h0c-45.73,0-82.81,37.07-82.81,82.81h0c0,45.73,37.07,82.81,82.81,82.81h0" />
      </g>
    </svg>
  );
}

/* Kept for backwards-compat (older callers); now aliases the new field. */
export function PitchSvg() { return <FieldSvg />; }
