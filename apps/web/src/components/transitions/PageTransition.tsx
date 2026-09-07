'use client';

import type { ReactNode } from 'react';
import support from '@/styles/daifugoSupport.module.css';

const SHELL = 'relative z-10 min-h-dvh';

/**
 * Stable stacking wrapper over the live scene.
 *
 * Menu hops must not put transform, opacity, filter, or will-change on this
 * full-viewport shell. Windows DComp paints a newly promoted overlay black
 * for a frame — once when the layer is created, and again when it drops.
 * Table routes arrive under the wipe; they do not need a wrapper animation.
 */
export function PageTransition({ children, route = '' }: { children: ReactNode; route?: string }) {
  const path = route.replace(/\/$/, '');
  const secondary =
    path === '/profile' ||
    path === '/join' ||
    path.startsWith('/join/') ||
    path === '/daifugo/create';
  return (
    <div
      className={`${SHELL}${secondary ? ` ${support.shell} ${support.surface}` : ''}`}
      data-daifugo-support={secondary || undefined}
    >
      {children}
    </div>
  );
}

export default PageTransition;
