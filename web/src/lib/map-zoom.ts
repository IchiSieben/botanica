/**
 * Zoom and pan for the explorer map (brief v3 item 7).
 *
 * The SVG sits in `layer`, inside `vp` (overflow: hidden). Zoom and pan are one CSS
 * `translate() scale()` on the layer, origin top-left: the compositor moves pixels, the
 * SVG's viewBox is never rewritten per frame. `will-change` is set only while a gesture
 * runs (class `gesture`), so the map is re-rastered sharp once it stops.
 *
 * Strokes: `vector-effect: non-scaling-stroke` undoes the viewBox scale but NOT a CSS
 * transform on an HTML ancestor (checked in Chromium: at 5x the borders were 5x thick).
 * So the settled scale is also written to `--z` on the viewport and explorer.css divides
 * stroke widths by it. It is written when a gesture settles, not per frame, so a pinch
 * or drag stays compositor-only and the strokes snap back once.
 *
 * Input:
 * - buttons (zoomIn / zoomOut / reset), keys + = − 0 while focus is inside the map;
 * - wheel with Ctrl/Cmd (also a trackpad pinch), or a plain wheel only while the map has
 *   focus: the page's own scroll is never hijacked;
 * - two-finger pinch; one-pointer drag pans once zoomed.
 * A press that moves less than 6 px is a tap: the click goes through and selects the
 * department. Past 6 px it is a drag and the click that follows is swallowed.
 */
export interface MapZoom {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  /** Re-clamp after the viewport changed size (fullscreen, resize). */
  refit(): void;
  readonly scale: number;
}

const DRAG_PX = 6;
const MAX = 8;
const STEP = 1.5;

export function mapZoom(vp: HTMLElement, layer: HTMLElement, onChange?: (k: number) => void): MapZoom {
  let k = 1, x = 0, y = 0;
  let idle: number | undefined;

  const clamp = () => {
    const w = vp.clientWidth, h = vp.clientHeight;
    k = Math.min(MAX, Math.max(1, k));
    x = Math.min(0, Math.max(w * (1 - k), x));
    y = Math.min(0, Math.max(h * (1 - k), y));
  };
  const settle = () => vp.style.setProperty('--z', String(k));
  const apply = () => {
    clamp();
    layer.style.transform = k === 1 ? '' : `translate(${x}px, ${y}px) scale(${k})`;
    vp.classList.toggle('zoomed', k > 1);
    vp.dataset.scale = k.toFixed(3);
    if (!vp.classList.contains('gesture')) settle();
    onChange?.(k);
  };
  /** Mark a gesture: `will-change` while it lasts, dropped 150 ms after the last input. */
  const busy = () => {
    vp.classList.add('gesture');
    clearTimeout(idle);
    idle = window.setTimeout(() => { vp.classList.remove('gesture'); settle(); }, 150);
  };
  /** Zoom by `f` keeping the point (cx, cy) of the viewport fixed. */
  const zoomAt = (cx: number, cy: number, f: number) => {
    const nk = Math.min(MAX, Math.max(1, k * f));
    if (nk === k) return;
    x = cx - (cx - x) * (nk / k);
    y = cy - (cy - y) * (nk / k);
    k = nk;
    if (k < 1.01) { k = 1; x = 0; y = 0; }
    apply();
  };
  const center = (f: number) => zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, f);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = vp.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  // ---- wheel ----
  vp.addEventListener('wheel', (e) => {
    const focused = vp.contains(document.activeElement);
    if (!(e.ctrlKey || e.metaKey || focused)) return; // let the page scroll
    e.preventDefault();
    busy();
    const [cx, cy] = local(e);
    // deltaMode 1 = lines (Firefox): ~16 px per line.
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(cx, cy, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)));
  }, { passive: false });

  // ---- keys ----
  vp.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === '+' || e.key === '=') center(STEP);
    else if (e.key === '-' || e.key === '_') center(1 / STEP);
    else if (e.key === '0') { k = 1; x = 0; y = 0; apply(); }
    else return;
    e.preventDefault();
  });

  // ---- pointers: drag to pan, pinch to zoom ----
  const pts = new Map<number, { x: number; y: number }>();
  let start: { id: number; x: number; y: number; tx: number; ty: number } | null = null;
  let dragging = false;
  let swallow = false;
  let pinch: { d: number; k: number } | null = null;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const mid = () => { const [a, b] = [...pts.values()]; return local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }); };

  vp.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swallow = false;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) start = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: x, ty: y };
    else if (pts.size === 2) {
      pinch = { d: dist(), k };
      start = null;
      dragging = false;
      for (const id of pts.keys()) { try { vp.setPointerCapture(id); } catch { /* already released */ } }
    }
  });
  vp.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pinch && pts.size === 2) {
      busy();
      const [cx, cy] = mid();
      zoomAt(cx, cy, (pinch.k * (dist() / pinch.d)) / k);
      return;
    }
    if (!start || start.id !== e.pointerId || k === 1) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!dragging) {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      // Capture only now: capturing on pointerdown would retarget a plain tap's click
      // to the viewport and the department under the finger would not be selected.
      dragging = true;
      vp.classList.add('dragging');
      try { vp.setPointerCapture(e.pointerId); } catch { /* pointer gone */ }
    }
    busy();
    x = start.tx + dx;
    y = start.ty + dy;
    apply();
  });
  const end = (e: PointerEvent) => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size < 2) pinch = null;
    if (dragging && (!start || start.id === e.pointerId)) {
      dragging = false;
      swallow = true;
      vp.classList.remove('dragging');
    }
    if (!pts.size) start = null;
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);
  // The click that ends a drag or a pinch is not a selection.
  vp.addEventListener('click', (e) => {
    if (!swallow) return;
    swallow = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  addEventListener('resize', () => apply());

  return {
    zoomIn: () => center(STEP),
    zoomOut: () => center(1 / STEP),
    reset: () => { k = 1; x = 0; y = 0; apply(); },
    refit: () => apply(),
    get scale() { return k; },
  };
}
