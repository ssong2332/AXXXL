// 3D 보기. 2D와 같은 집 데이터를 쓰고, 평면 (x, y)를 3D (x, 높이, z=y)로 옮긴다.
// 2D 회전 rot(도, 화면 기준 시계 방향)은 3D에서 rotation.y = -rot 이다.
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { bounds, centroid } from './geometry.js';
import { COMBO_SINK_RATIO } from './model.js';

const WALL_H = 2.3, WALL_LOW = 1.0, WALL_T = 0.1;
const COLORS = {
  fridge: 0xDCE3E8, sink: 0xD7E6EE, induction: 0xE4E1EC, gas: 0xECE3DA, washer: 0xE8ECEF,
  combo: 0xE6ECEA, bed: 0xA9D1BF, desk: 0xC8A57E, wardrobe: 0xE6E3DE,
};

export class View3D {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '3D 보기. 끌어서 돌리고, 휠이나 두 손가락으로 확대·축소해요.');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xEEF2F0);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.screenSpacePanning = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 40;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2bd, 2.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(-4, 8, 6);
    this.scene.add(dir);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.lowWalls = false;
    this.itemObjects = new Map();
    this.running = false;
    new ResizeObserver(() => this.resize()).observe(host);
  }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
  stop() { this.running = false; }

  clear() {
    this.root.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    this.root.clear();
    this.itemObjects.clear();
  }

  update(house) {
    const first = !this.house || this.house.id !== house.id;
    this.house = house;
    this.clear();
    const pts = house.shape.points;
    // 바닥
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: 0xE8DCC8, side: THREE.DoubleSide }));
    floor.rotation.x = Math.PI / 2; // (x, y, 0) → (x, 0, y)
    floor.name = 'floor';
    this.root.add(floor);
    const grid = new THREE.GridHelper(40, 80, 0xC9D1CD, 0xDCE2DF);
    grid.position.y = -0.005;
    this.root.add(grid);
    // 벽: 변마다 얇은 상자
    const wallH = this.lowWalls ? WALL_LOW : WALL_H;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF6F4F0 });
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len + WALL_T, wallH, WALL_T), wallMat);
      wall.position.set((a[0] + b[0]) / 2, wallH / 2, (a[1] + b[1]) / 2);
      wall.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      wall.name = 'wall';
      this.root.add(wall);
    });
    for (const it of house.items) {
      const g = this.buildItem(it);
      g.position.set(it.x, 0, it.y);
      g.rotation.y = (-it.rot * Math.PI) / 180;
      g.userData.itemId = it.id;
      this.root.add(g);
      this.itemObjects.set(it.id, g);
    }
    if (first) this.resetView();
  }

  setLowWalls(on) { this.lowWalls = on; if (this.house) this.update(this.house); }

  resetView() {
    if (!this.house) return;
    const pts = this.house.shape.points;
    const b = bounds(pts);
    const [cx, cy] = centroid(pts);
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    this.controls.target.set(cx, 0.6, cy);
    this.camera.position.set(cx + span * 0.35, span * 1.15 + 2, cy + span * 1.1 + 1);
    // 끌기 후 남은 관성(회전·이동·확대)이 초기화한 시점을 다시 밀지 않게 지운다. three r170 OrbitControls 내부 값.
    this.controls._sphericalDelta?.set(0, 0, 0);
    this.controls._panOffset?.set(0, 0, 0);
    if ('_scale' in this.controls) this.controls._scale = 1;
    this.controls.update();
  }

  // 버튼으로 확대·축소(휠·두 손가락이 어려운 사람용). factor < 1 이면 가까이
  zoom(factor) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const len = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, off.length() * factor));
    this.camera.position.copy(this.controls.target).add(off.setLength(len));
    this.controls.update();
  }

  box(w, h, d, color, y = h / 2, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, ...opts }));
    m.position.y = y;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x8A939B }));
    m.add(edges);
    return m;
  }

  buildItem(it) {
    const g = new THREE.Group();
    const { w, d, h } = it;
    if (it.type === 'glass') {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x9FD3E6, transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.1 }));
      pane.position.y = h / 2;
      pane.name = 'glass-pane';
      g.add(pane);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(pane.geometry), new THREE.LineBasicMaterial({ color: 0x2F5D6E }));
      frame.position.y = h / 2;
      g.add(frame);
      const mullion = this.box(0.03, h, d + 0.01, 0x2F5D6E);
      g.add(mullion);
      return g;
    }
    if (it.type === 'combo') {
      const sinkW = w * COMBO_SINK_RATIO, cookW = w - sinkW;
      const sinkPart = this.box(sinkW, h, d, COLORS.combo);
      sinkPart.position.x = -w / 2 + sinkW / 2;
      g.add(sinkPart);
      const basin = this.box(sinkW - 0.16, 0.02, d - 0.2, 0x9DB8C7, h + 0.005);
      basin.position.x = sinkPart.position.x;
      g.add(basin);
      // 쿡탑 아래 세탁기 칸: 다른 색 몸체 + 앞면 원형 문
      const washer = this.box(cookW, h - 0.04, d, 0xF4F6F8, (h - 0.04) / 2);
      washer.position.x = w / 2 - cookW / 2;
      washer.name = 'combo-washer';
      g.add(washer);
      const door = new THREE.Mesh(new THREE.TorusGeometry(Math.min(cookW, h) * 0.28, 0.025, 8, 32), new THREE.MeshStandardMaterial({ color: 0x2563EB }));
      door.position.set(washer.position.x, (h - 0.04) * 0.45, d / 2 + 0.01);
      g.add(door);
      const cooktop = this.box(cookW, 0.04, d, 0x2F3438, h - 0.02);
      cooktop.position.x = washer.position.x;
      cooktop.name = 'combo-cooktop';
      g.add(cooktop);
      for (const s of [-0.22, 0.22]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(0.1, d * 0.18), 0.012, 6, 24), new THREE.MeshStandardMaterial({ color: it.cooktop === 'gas' ? 0x9CA3AF : 0xE8B4A0 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(washer.position.x + s * cookW, h + 0.005, 0);
        g.add(ring);
      }
      return g;
    }
    const body = this.box(w, h, d, COLORS[it.type] ?? 0xdddddd);
    body.name = 'body';
    g.add(body);
    if (it.type === 'induction' || it.type === 'gas') {
      const top = this.box(w, 0.03, d, 0x2F3438, h + 0.015);
      g.add(top);
    }
    if (it.type === 'washer') {
      const door = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, h) * 0.3, 0.025, 8, 32), new THREE.MeshStandardMaterial({ color: 0x2563EB }));
      door.position.set(0, h * 0.5, d / 2 + 0.01);
      g.add(door);
    }
    if (it.type === 'bed') {
      const pillow = this.box(w - 0.2, 0.1, 0.35, 0xF7F8F9, h + 0.05);
      pillow.position.z = -d / 2 + 0.25;
      g.add(pillow);
    }
    return g;
  }

  // 검증용: 물체 바닥 네 꼭짓점의 세계 좌표 (x, z)
  footprint(id) {
    const g = this.itemObjects.get(id);
    const it = this.house?.items.find((i) => i.id === id);
    if (!g || !it) return null;
    g.updateMatrixWorld(true);
    return [[-it.w / 2, -it.d / 2], [it.w / 2, -it.d / 2], [it.w / 2, it.d / 2], [-it.w / 2, it.d / 2]].map(([x, z]) => {
      const v = new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld);
      return [v.x, v.z];
    });
  }

  // 검증용: 바닥 도형 꼭짓점의 세계 좌표 (x, z)
  floorPoints() {
    const floor = this.root.getObjectByName('floor');
    if (!floor) return null;
    floor.updateMatrixWorld(true);
    return this.house.shape.points.map(([x, y]) => {
      const v = new THREE.Vector3(x, y, 0).applyMatrix4(floor.matrixWorld);
      return [v.x, v.z];
    });
  }
}
