/**
 * Resolves once the page's first contentful paint is on screen. Chart mounts,
 * data fetches and the tour start behind it so they don't compete with the
 * server-rendered page.
 *
 * Why not just "after load": Lighthouse's simulated LCP counts every request that
 * starts before the observed paint. Load and idle can both fire before Chrome's
 * first paint, so the 309 KB species index sometimes landed in the LCP path and
 * the metric flipped between 1.6 and 3.2 s. The first `largest-contentful-paint`
 * entry is the paint itself. Browsers without that entry type (Safari, Firefox)
 * fall back to load + a frame, with a 1.5 s ceiling either way.
 */
let ready: Promise<void> | null = null;

export const afterPaint = (): Promise<void> =>
  (ready ??= new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      requestAnimationFrame(() => setTimeout(resolve, 0));
    };
    setTimeout(go, 1500);
    if (PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
      new PerformanceObserver((list, obs) => {
        if (list.getEntries().length) { obs.disconnect(); go(); }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } else if (document.readyState === 'complete') go();
    else addEventListener('load', go, { once: true });
  }));
