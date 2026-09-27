/**
 * 3D view of the taxonomy tree (v3.1 item 2, optional): a free-orbit spatial
 * layout of the same TreeNode hierarchy the linear and sunburst views draw,
 * so a viewer can fly around the whole tree instead of reading it flat.
 *
 * This PORTS THE APPROACH of Armonía Viva's galaxy viewer
 * (MusicTheory/src/modules/galaxy + src/engine/galaxy.ts: an orbit-controlled
 * Three.js scene where clusters sit on rings and a click resolves through a
 * raycaster) — rewritten from scratch for this data, in vanilla Three.js, not
 * React Three Fiber (there is no other R3F/React anywhere in this app; pulling
 * it in for one view would cost a second rendering paradigm for ~200 lines of
 * code an imperative scene does directly). No code is shared between the two
 * repos. See HANDOFF "3D tree: port decision (v3.1)" for what was and was not
 * ported and the lazy chunk's size.
 *
 * Layout: nodes sit on concentric rings, one ring per tree depth (kingdom at
 * the centre). A node's angular slice is proportional to its species count —
 * the same rule as the sunburst, in 3D so depth reads as distance from centre
 * instead of ring thickness. A small per-node vertical jitter (hashed from its
 * id, so it is stable across renders) turns the rings into a loose "galaxy"
 * instead of flat disks.
 *
 * Loaded only via `import('./tree-3d')` (scripts/tree.ts), never from the
 * page's initial bundle: this file (and the `three` it imports) is the whole
 * lazy chunk.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GROUP_RANKS, type TreeNode } from '../lib/tree-model';

export interface Tree3DTokens {
  fg: string;
  muted: string;
  accent: string;
  surface: string;
  onSelect: (node: TreeNode) => void;
  /** Tooltip text for a node ("Orchidaceae · 1,234 species"), localized by the caller. */
  describe: (node: TreeNode) => string;
}

export interface Tree3DHandle {
  /** Light a node and its branch (ancestors + descendants), dim the rest; null clears. */
  select(id: string | null): void;
  /** Nothing lit, camera back on the whole tree. */
  home(): void;
  /** Client-space position of a node's centre (the B5 gate clicks through it). */
  project(id: string): { x: number; y: number } | null;
  resize(): void;
  dispose(): void;
}

interface Placed { node: TreeNode; pos: THREE.Vector3; depth: number }

const RING_STEP = 34;
const JITTER = 6;
/** Nodes whose name is always drawn: the largest by species (v3.2 B5). */
const LABELS = 10;

/** Stable 0..1 hash of a string (no crypto needed: just deterministic jitter). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/** Places every node on its depth ring, angle proportional to cumulative
 *  species among its siblings — same rule the sunburst uses for arc angle. */
function layout(root: TreeNode): Placed[] {
  const out: Placed[] = [];
  const walk = (n: TreeNode, depth: number, a0: number, a1: number) => {
    const mid = (a0 + a1) / 2;
    const r = depth * RING_STEP;
    const jitter = (hash01(n.id) - 0.5) * JITTER * (depth || 1);
    out.push({
      node: n, depth,
      pos: new THREE.Vector3(r * Math.cos(mid), jitter, r * Math.sin(mid)),
    });
    const kids = n.children ?? [];
    if (!kids.length) return;
    const total = Math.max(1, kids.reduce((s, c) => s + Math.max(1, c.value), 0));
    let a = a0;
    for (const c of kids) {
      const span = ((a1 - a0) * Math.max(1, c.value)) / total;
      walk(c, depth + 1, a, a + span);
      a += span;
    }
  };
  walk(root, 0, 0, Math.PI * 2);
  return out;
}

export function mountTree3D(el: HTMLElement, root: TreeNode, T: Tree3DTokens): Tree3DHandle {
  const w = () => Math.max(1, el.clientWidth);
  const h = () => Math.max(1, el.clientHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, w() / h(), 1, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w(), h());
  el.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const point = new THREE.PointLight(0xffffff, 0.6);
  point.position.set(200, 200, 200);
  scene.add(point);

  const placed = layout(root);
  const maxV = Math.max(1, ...placed.filter((p) => p.depth > 0).map((p) => p.node.value));
  const byId = new Map(placed.map((p) => [p.node.id, p]));
  const group = new THREE.Group();
  scene.add(group);

  const geoms: THREE.BufferGeometry[] = [];
  const lineMats: THREE.Material[] = [];
  /** The branch line from each node up to its parent, keyed by the child's id. */
  const lineOf = new Map<string, THREE.LineBasicMaterial>();
  const meshes = new Map<string, THREE.Mesh>();
  const colorOf = (n: TreeNode) => {
    const isGroup = n.meta.rank === 'kingdom' || GROUP_RANKS.has(n.meta.rank);
    return new THREE.Color(isGroup ? T.muted : n.itemStyle?.color ?? T.muted);
  };
  for (const p of placed) {
    const size = p.depth === 0 ? 6 : 1.4 + 3.2 * Math.sqrt(Math.max(0, p.node.value) / maxV);
    const geo = new THREE.SphereGeometry(size, 12, 12);
    geoms.push(geo);
    const mat = new THREE.MeshStandardMaterial({ color: colorOf(p.node), roughness: 0.6, metalness: 0.1, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(p.pos);
    mesh.userData.id = p.node.id;
    group.add(mesh);
    meshes.set(p.node.id, mesh);
    // Faint line to the parent: reads as branches without drawing a full graph.
    const parentId = p.node.id.slice(0, p.node.id.lastIndexOf('/'));
    const parent = byId.get(parentId);
    if (parent) {
      const lgeo = new THREE.BufferGeometry().setFromPoints([parent.pos, p.pos]);
      geoms.push(lgeo);
      const lmat = new THREE.LineBasicMaterial({ color: T.muted, transparent: true, opacity: 0.25 });
      lineMats.push(lmat);
      lineOf.set(p.node.id, lmat);
      const line = new THREE.Line(lgeo, lmat);
      group.add(line);
    }
  }

  const bbox = new THREE.Box3().setFromObject(group);
  const size = bbox.getSize(new THREE.Vector3());
  const dist = Math.max(60, size.length() * 0.8);
  const HOME = new THREE.Vector3(dist * 0.6, dist * 0.5, dist * 0.6);
  camera.position.copy(HOME);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 20;
  controls.maxDistance = dist * 4;

  // ---- DOM overlay (v3.2 B5): names that are always on for the largest nodes, plus a
  // hover/tap tooltip. Text in the DOM, not in WebGL: crisp, themeable, no font atlas.
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const overlay = document.createElement('div');
  overlay.className = 't3-overlay';
  overlay.setAttribute('aria-hidden', 'true'); // the side panels carry the same facts accessibly
  el.appendChild(overlay);
  const tip = document.createElement('div');
  tip.className = 't3-tip';
  tip.hidden = true;
  overlay.appendChild(tip);
  const labels = new Map<string, HTMLSpanElement>();
  for (const p of placed.filter((q) => q.depth > 0).sort((a, b) => b.node.value - a.node.value).slice(0, LABELS)) {
    const span = document.createElement('span');
    span.className = 't3-label';
    span.textContent = p.node.name;
    overlay.appendChild(span);
    labels.set(p.node.id, span);
  }
  let selLabel: HTMLSpanElement | null = null;
  let tipFor: Placed | null = null;
  const v = new THREE.Vector3();
  // Canvas size read once per frame, not per label: each label write would otherwise force a
  // style recalculation for the next read.
  let W = w(), H = h();
  const place = (span: HTMLElement, pos: THREE.Vector3, dy: number) => {
    v.copy(pos).project(camera);
    const off = v.z > 1 || Math.abs(v.x) > 1.02 || Math.abs(v.y) > 1.02;
    span.style.visibility = off ? 'hidden' : '';
    if (!off) span.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H + dy}px) translate(-50%, -100%)`;
  };
  const placeOverlay = () => {
    W = w(); H = h();
    for (const [id, span] of labels) place(span, byId.get(id)!.pos, -8);
    if (selLabel && selectedId) place(selLabel, byId.get(selectedId)!.pos, -8);
    if (tipFor) place(tip, tipFor.pos, -18);
  };

  let selectedId: string | null = null;
  /** The node, its ancestors and every descendant. Ids are paths ("Plantae/…/Orchidaceae"). */
  const branchOf = (id: string): Set<string> => {
    const set = new Set<string>();
    for (let a = id; a; a = a.includes('/') ? a.slice(0, a.lastIndexOf('/')) : '') set.add(a);
    for (const other of byId.keys()) if (other.startsWith(`${id}/`)) set.add(other);
    return set;
  };
  const applyHighlight = () => {
    const lit = selectedId ? branchOf(selectedId) : null;
    for (const [id, mesh] of meshes) {
      const on = id === selectedId;
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.emissive.set(on ? T.accent : 0x000000);
      m.emissiveIntensity = on ? 0.9 : 0;
      m.opacity = !lit || lit.has(id) ? 1 : 0.12;
      m.depthWrite = m.opacity === 1; // dimmed spheres must not hide lit ones behind them
      mesh.scale.setScalar(on ? 1.6 : 1);
    }
    for (const [id, m] of lineOf) m.opacity = !lit ? 0.25 : lit.has(id) ? 0.85 : 0.04;
    for (const [id, span] of labels) {
      span.classList.toggle('dim', !!lit && !lit.has(id));
      span.classList.toggle('sel', id === selectedId);
    }
    selLabel?.remove();
    selLabel = null;
    const p = selectedId ? byId.get(selectedId) : null;
    if (p && !labels.has(p.node.id)) {
      selLabel = document.createElement('span');
      selLabel.className = 't3-label sel';
      selLabel.textContent = p.node.name;
      overlay.appendChild(selLabel);
    }
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  /** Dimmed nodes stay pickable: clicking one moves the light to its branch. */
  const hitAt = (x: number, y: number): Placed | null => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((x - r.left) / r.width) * 2 - 1;
    pointer.y = -((y - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
    return hit ? byId.get(hit.object.userData.id as string) ?? null : null;
  };
  const showTip = (p: Placed | null) => {
    tipFor = p;
    renderer.domElement.style.cursor = p ? 'pointer' : '';
    tip.hidden = !p;
    if (!p) return;
    tip.textContent = T.describe(p.node);
    place(tip, p.pos, -18);
  };
  let hoverRaf = 0;
  let lastMove: PointerEvent | null = null;
  renderer.domElement.addEventListener('pointermove', (e) => {
    // Mouse only, and not while orbiting: a touch drag must not pop tooltips.
    if (e.pointerType !== 'mouse' || e.buttons) return;
    lastMove = e;
    hoverRaf ||= requestAnimationFrame(() => {
      hoverRaf = 0;
      if (lastMove) showTip(hitAt(lastMove.clientX, lastMove.clientY));
    });
  });
  renderer.domElement.addEventListener('pointerleave', () => showTip(null));
  let downAt = 0;
  renderer.domElement.addEventListener('pointerdown', () => { downAt = Date.now(); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    // A drag-to-orbit must not also fire a click.
    if (Date.now() - downAt > 220) return;
    const p = hitAt(e.clientX, e.clientY);
    showTip(p); // a tap names the node too: touch has no hover
    if (!p) return;
    const rank = p.node.meta.rank;
    // Orders and families select through the page store, exactly like the linear tree:
    // the side panels follow and the store calls select() back, which lights the branch.
    if (rank !== 'kingdom' && !GROUP_RANKS.has(rank)) { T.onSelect(p.node); return; }
    // Kingdom clears; a group rank (class, clade…) only lights its branch.
    selectedId = rank === 'kingdom' ? null : p.node.id;
    applyHighlight();
    request();
  });

  // Render on demand: a frame only while the camera moves (drag, zoom, damping) or after a
  // select/resize. A still scene costs nothing and does not compete with input.
  let raf = 0;
  const frame = () => {
    raf = 0;
    const moving = controls.update(); // true while damping is still settling
    renderer.render(scene, camera);
    placeOverlay();
    if (moving) request();
  };
  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
  controls.addEventListener('change', request);
  request();

  return {
    select(id) {
      selectedId = id && byId.has(id) ? id : null;
      applyHighlight();
      request();
      const p = selectedId && byId.get(selectedId);
      if (p) {
        const target = p.pos.clone();
        const dir = camera.position.clone().sub(controls.target).normalize();
        camera.position.copy(target.clone().add(dir.multiplyScalar(Math.max(40, dist * 0.35))));
        controls.target.copy(target);
      }
    },
    home() {
      selectedId = null;
      applyHighlight();
      showTip(null);
      camera.position.copy(HOME);
      controls.target.set(0, 0, 0);
      request();
    },
    project(id) {
      const p = byId.get(id);
      if (!p) return null;
      v.copy(p.pos).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    resize() {
      camera.aspect = w() / h();
      camera.updateProjectionMatrix();
      renderer.setSize(w(), h());
      request();
    },
    dispose() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(hoverRaf);
      controls.removeEventListener('change', request);
      controls.dispose();
      for (const g of geoms) g.dispose();
      for (const mesh of meshes.values()) (mesh.material as THREE.Material).dispose();
      for (const m of lineMats) m.dispose();
      // Browsers cap live WebGL contexts (~16): release this one now, not at GC.
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
      overlay.remove();
    },
  };
}
