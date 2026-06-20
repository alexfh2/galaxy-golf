import { useMemo } from 'react';
import h1 from '@/assets/hero-pool/hero-13-28-12_2.jpg.asset.json';
import h2 from '@/assets/hero-pool/hero-13-28-13_1.jpg.asset.json';
import h3 from '@/assets/hero-pool/hero-13-28-13_2.jpg.asset.json';
import h4 from '@/assets/hero-pool/hero-13-28-13_5.jpg.asset.json';
import h5 from '@/assets/hero-pool/hero-13-28-13_6.jpg.asset.json';
import h6 from '@/assets/hero-pool/hero-13-28-13_7.jpg.asset.json';
import h7 from '@/assets/hero-pool/hero-13-28-13_8.jpg.asset.json';
import h8 from '@/assets/hero-pool/hero-13-28-13_9.jpg.asset.json';
import h9 from '@/assets/hero-pool/hero-13-28-13_10.jpg.asset.json';
import h10 from '@/assets/hero-pool/hero-13-31-35_1.jpg.asset.json';

export const HERO_POOL: string[] = [
  h1.url, h2.url, h3.url, h4.url, h5.url,
  h6.url, h7.url, h8.url, h9.url, h10.url,
];

/**
 * Returns a random hero image URL. Stable for the lifetime of the
 * component that calls it (chosen once on mount via useMemo).
 * Optional `key` lets callers force a different selection per page.
 */
export function useRandomHero(key?: string): string {
  return useMemo(() => {
    const idx = Math.floor(Math.random() * HERO_POOL.length);
    return HERO_POOL[idx];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
