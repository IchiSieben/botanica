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
}

export interface Tree3DHandle {
  select(id: string | null): void;
  resize(): void;
  dispose(): void;
}

interface Placed { node: TreeNode; pos: THREE.Vector3; depth: number }

const RING_STEP = 34;
const JITTER = 6;

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
  const meshes = new Map<string, THREE.Mesh>();
  const colorOf = (n: TreeNode) => {
    const isGroup = n.meta.rank === 'kingdom' || GROUP_RANKS.has(n.meta.rank);
    return new THREE.Color(isGroup ? T.muted : n.itemStyle?.color ?? T.muted);
  };
  for (const p of placed) {
    const size = p.depth === 0 ? 6 : 1.4 + 3.2 * Math.sqrt(Math.max(0, p.node.value) / maxV);
    const geo = new THREE.SphereGeometry(size, 12, 12);
    geoms.push(geo);
    const mat = new THREE.MeshStandardMaterial({ color: colorOf(p.node), roughness: 0.6, metalness: 0.1 });
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
      const line = new THREE.Line(lgeo, lmat);
      group.add(line);
    }
  }

  const bbox = new THREE.Box3().setFromObject(group);
  const size = bbox.getSize(new THREE.Vector3());
  const dist = Math.max(60, size.length() * 0.8);
  camera.position.set(dist * 0.6, dist * 0.5, dist * 0.6);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 20;
  controls.maxDistance = dist * 4;

  let selectedId: string | null = null;
  const applyHighlight = () => {
    for (const [id, mesh] of meshes) {
      const on = id === selectedId;
      (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(on ? T.accent : 0x000000);
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.9 : 0;
      mesh.scale.setScalar(on ? 1.6 : 1);
    }
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = 0;
  renderer.domElement.addEventListener('pointerdown', () => { downAt = Date.now(); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    // A drag-to-orbit must not also fire a click.
    if (Date.now() - downAt > 220) return;
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
    if (!hit) return;
    const p = byId.get(hit.object.userData.id as string);
    if (p && p.node.meta.rank !== 'kingdom' && !GROUP_RANKS.has(p.node.meta.rank)) T.onSelect(p.node);
  });

  // Render on demand: a frame only while the camera moves (drag, zoom, damping) or after a
  // select/resize. A still scene costs nothing and does not compete with input.
  let raf = 0;
  const frame = () => {
    raf = 0;
    const moving = controls.update(); // true while damping is still settling
    renderer.render(scene, camera);
    if (moving) request();
  };
  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
  controls.addEventListener('change', request);
  request();

  return {
    select(id) {
      selectedId = id;
      applyHighlight();
      request();
      const p = id && byId.get(id);
      if (p) {
        const target = p.pos.clone();
        const dir = camera.position.clone().sub(controls.target).normalize();
        camera.position.copy(target.clone().add(dir.multiplyScalar(Math.max(40, dist * 0.35))));
        controls.target.copy(target);
      }
    },
    resize() {
      camera.aspect = w() / h();
      camera.updateProjectionMatrix();
      renderer.setSize(w(), h());
      request();
    },
    dispose() {
      cancelAnimationFrame(raf);
      controls.removeEventListener('change', request);
      controls.dispose();
      for (const g of geoms) g.dispose();
      for (const mesh of meshes.values()) (mesh.material as THREE.Material).dispose();
      for (const m of lineMats) m.dispose();
      // Browsers cap live WebGL contexts (~16): release this one now, not at GC.
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
