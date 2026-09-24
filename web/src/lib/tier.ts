/**
 * Quality tier, ported from Landing/src/lib/tier.ts (same thresholds, same
 * `ic7.tier` override key, same `data-tier` attribute on <html>).
 *
 *   0  reduce, (update: slow), save-data, <= 2 cores   static, no transitions
 *   1  touch, or <= 4 cores, or <= 4 GB                CSS motion only
 *   2  desktop pointer, >= 4 cores                     view transitions
 *   3  >= 8 cores, >= 8 GB, WebGPU                     (same as 2 here)
 */
export type Tier = 0 | 1 | 2 | 3;
export const TIER_KEY = 'ic7.tier';

export function detectTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean }; gpu?: unknown };
  const mq = (q: string) => matchMedia(q).matches;
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 8;
  if (mq('(prefers-reduced-motion: reduce)') || mq('(update: slow)') || nav.connection?.saveData || cores <= 2) return 0;
  if (mq('(pointer: coarse)') || !mq('(hover: hover)') || cores <= 4 || mem <= 4) return 1;
  if (cores >= 8 && mem >= 8 && 'gpu' in nav) return 3;
  return 2;
}

export function applyTier(): Tier {
  let tier: Tier = detectTier();
  try {
    const v = localStorage.getItem(TIER_KEY);
    if (v && /^[0-3]$/.test(v)) tier = Number(v) as Tier;
  } catch { /* storage blocked: keep the detected tier */ }
  document.documentElement.dataset.tier = String(tier);
  return tier;
}
