// 2D 평면 편집기. 집 데이터를 SVG로 그리고 꼭짓점·벽·물체의 포인터 조작을 콜백으로 넘긴다.
// 사용자 글자(물체 이름 등)는 textContent로만 넣는다.
import { bounds, itemOutside } from './geometry.js';
import { CATALOG, COMBO_SINK_RATIO } from './model.js';

const NS = 'http://www.w3.org/2000/svg';
const SNAP = 0.05;
const snap = (v) => Math.round(v / SNAP) * SNAP;
const pos = (v) => Math.max(0.01, v); // 작게 줄인 물체에서 음수 크기가 나오지 않게

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

const COLORS = {
  fridge: '#DCE3E8', sink: '#D7E6EE', induction: '#E4E1EC', gas: '#ECE3DA', washer: '#E3E8EC',
  combo: '#E6ECEA', bed: '#CFE7DC', desk: '#E9DCC9', wardrobe: '#E6E3DE', glass: '#BFE3F0',
};

export class Editor2D {
  constructor(container, cb) {
    this.container = container;
    this.cb = cb; // { onSelect, onDragStart, onVertexDrag, onItemDrag, onDragEnd }
    this.svg = el('svg', { class: 'plan', role: 'application', 'aria-label': '방 평면 편집 화면' }, container);
    this.drag = null;
    this.frozenView = null;
    this.svg.addEventListener('pointerdown', (e) => this.down(e));
    this.svg.addEventListener('pointermove', (e) => this.move(e));
    this.svg.addEventListener('pointerup', (e) => this.up(e));
    this.svg.addEventListener('pointercancel', (e) => this.up(e));
  }

  toWorld(e) {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = this.svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  down(e) {
    const t = e.target.closest('[data-kind]');
    if (!t) { this.cb.onSelect(null); return; }
    const kind = t.dataset.kind;
    if (kind === 'edge') { this.cb.onSelect({ kind: 'edge', index: Number(t.dataset.index) }); return; }
    if (kind === 'vertex' || kind === 'item') {
      e.preventDefault();
      this.svg.setPointerCapture(e.pointerId);
      const [wx, wy] = this.toWorld(e);
      this.frozenView = this.svg.getAttribute('viewBox');
      if (kind === 'vertex') {
        const index = Number(t.dataset.index);
        this.cb.onSelect({ kind: 'vertex', index });
        const p = this.house.shape.points[index];
        this.drag = { kind, index, offset: [p[0] - wx, p[1] - wy], moved: false, id: e.pointerId };
      } else {
        const id = t.dataset.id;
        this.cb.onSelect({ kind: 'item', id });
        const it = this.house.items.find((i) => i.id === id);
        this.drag = { kind, id, offset: [it.x - wx, it.y - wy], moved: false, id2: e.pointerId };
      }
      this.cb.onDragStart(this.drag);
    }
  }

  move(e) {
    if (!this.drag) return;
    const [wx, wy] = this.toWorld(e);
    const x = snap(wx + this.drag.offset[0]), y = snap(wy + this.drag.offset[1]);
    this.drag.moved = true;
    if (this.drag.kind === 'vertex') this.cb.onVertexDrag(this.drag.index, x, y);
    else this.cb.onItemDrag(this.drag.id, x, y);
  }

  up() {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    this.frozenView = null;
    this.cb.onDragEnd(d);
  }

  render(house, { mode, sel }) {
    this.house = house;
    const svg = this.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const pts = house.shape.points;
    const b = bounds(pts);
    const pad = 0.8;
    const vb = this.frozenView || `${(b.minX - pad).toFixed(3)} ${(b.minY - pad).toFixed(3)} ${(b.maxX - b.minX + pad * 2).toFixed(3)} ${(b.maxY - b.minY + pad * 2).toFixed(3)}`;
    svg.setAttribute('viewBox', vb);
    const [vx, vy, vw, vh] = vb.split(' ').map(Number);
    const pxPerM = (this.container.clientWidth || 600) / vw;
    const hitR = Math.max(0.18, 24 / pxPerM); // 화면에서 지름 48px 이상
    const fs = Math.max(0.14, 12 / pxPerM);

    // 50cm 격자
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'grid', width: 0.5, height: 0.5, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M 0.5 0 L 0 0 0 0.5', fill: 'none', stroke: '#DCE2DF', 'stroke-width': 0.01 }, pat);
    el('rect', { x: vx, y: vy, width: vw, height: vh, fill: 'url(#grid)' }, svg);

    const poly = pts.map((p) => p.join(',')).join(' ');
    el('polygon', { points: poly, class: 'room-floor' }, svg);
    el('polygon', { points: poly, class: 'room-wall', 'stroke-width': 0.1 }, svg);

    // 벽 길이 표시
    const labels = el('g', { class: 'dims', 'font-size': fs }, svg);
    pts.forEach((a, i) => {
      const c = pts[(i + 1) % pts.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const t = el('text', { x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, labels);
      t.textContent = `${len.toFixed(2)}m`;
    });

    // 물체
    const itemsG = el('g', { class: mode === 'items' ? 'items active' : 'items' }, svg);
    for (const it of house.items) this.drawItem(itemsG, it, sel?.kind === 'item' && sel.id === it.id, fs, itemOutside(pts, it));

    // 벽(선택용)과 꼭짓점은 모양 편집 단계에서만 조작
    if (mode === 'shape') {
      const edges = el('g', { class: 'edges' }, svg);
      pts.forEach((a, i) => {
        const c = pts[(i + 1) % pts.length];
        const selected = sel?.kind === 'edge' && sel.index === i;
        el('line', { x1: a[0], y1: a[1], x2: c[0], y2: c[1], class: selected ? 'edge selected' : 'edge', 'stroke-width': hitR, 'data-kind': 'edge', 'data-index': i }, edges);
      });
      const verts = el('g', { class: 'verts' }, svg);
      pts.forEach((p, i) => {
        const g = el('g', { 'data-kind': 'vertex', 'data-index': i, class: sel?.kind === 'vertex' && sel.index === i ? 'vertex selected' : 'vertex' }, verts);
        el('circle', { cx: p[0], cy: p[1], r: hitR, class: 'vertex-hit' }, g);
        el('circle', { cx: p[0], cy: p[1], r: Math.max(0.09, 8 / pxPerM), class: 'vertex-dot' }, g);
        const t = el('text', { x: p[0], y: p[1] - hitR * 1.05, 'text-anchor': 'middle', 'font-size': fs * 0.9, class: 'vertex-no' }, g);
        t.textContent = String(i + 1);
      });
    }
  }

  drawItem(parent, it, selected, fs, outside) {
    const g = el('g', { transform: `translate(${it.x} ${it.y}) rotate(${it.rot})`, 'data-kind': 'item', 'data-id': it.id, class: `item item-${it.type}${selected ? ' selected' : ''}${outside ? ' outside' : ''}` }, parent);
    const hw = it.w / 2, hd = it.d / 2;
    const base = el('rect', { x: -hw, y: -hd, width: it.w, height: it.d, fill: COLORS[it.type], class: 'item-body', 'stroke-width': 0.02 }, g);
    if (it.type === 'glass') {
      base.setAttribute('fill-opacity', '0.75');
      // 두께가 얇아 잡기 어려우므로 투명한 잡기 영역을 넓힌다
      el('rect', { x: -hw, y: -0.2, width: it.w, height: 0.4, fill: 'transparent' }, g);
    }
    if (it.type === 'combo') {
      const sinkW = it.w * COMBO_SINK_RATIO;
      el('rect', { x: -hw + 0.08, y: -hd + 0.08, width: pos(sinkW - 0.16), height: pos(it.d - 0.2), rx: 0.05, class: 'sink-basin' }, g);
      const cx = -hw + sinkW + (it.w - sinkW) / 2;
      el('rect', { x: -hw + sinkW + 0.04, y: -hd + 0.04, width: pos(it.w - sinkW - 0.08), height: pos(it.d - 0.08), class: 'cooktop-plate' }, g);
      el('circle', { cx: cx - (it.w - sinkW) * 0.2, cy: 0, r: Math.min(0.12, it.d * 0.2), class: 'burner' }, g);
      el('circle', { cx: cx + (it.w - sinkW) * 0.2, cy: 0, r: Math.min(0.1, it.d * 0.16), class: 'burner' }, g);
      // 쿡탑 아래 세탁기: 점선 테두리와 문(원)으로 표시
      el('rect', { x: -hw + sinkW + 0.02, y: -hd + 0.02, width: pos(it.w - sinkW - 0.04), height: pos(it.d - 0.04), class: 'washer-below' }, g);
      el('line', { x1: -hw, y1: hd, x2: hw, y2: hd, class: 'front-edge' }, g);
      const t1 = el('text', { x: -hw + sinkW / 2, y: hd - 0.05, 'text-anchor': 'middle', 'font-size': fs * 0.85, class: 'item-label' }, g);
      t1.textContent = '싱크대';
      const t2 = el('text', { x: cx, y: hd - 0.05, 'text-anchor': 'middle', 'font-size': fs * 0.85, class: 'item-label' }, g);
      t2.textContent = (it.cooktop === 'gas' ? '가스쿡탑' : '인덕션') + '·아래 세탁기';
      return;
    }
    if (['sink', 'induction', 'gas', 'washer', 'fridge'].includes(it.type)) {
      el('line', { x1: -hw, y1: hd, x2: hw, y2: hd, class: 'front-edge' }, g);
    }
    if (it.type === 'induction' || it.type === 'gas') {
      el('circle', { cx: -it.w * 0.2, cy: 0, r: Math.min(0.11, it.d * 0.2), class: 'burner' }, g);
      el('circle', { cx: it.w * 0.2, cy: 0, r: Math.min(0.09, it.d * 0.16), class: 'burner' }, g);
    }
    if (it.type === 'washer') el('circle', { cx: 0, cy: 0, r: Math.min(it.w, it.d) * 0.3, class: 'washer-door' }, g);
    if (it.type === 'sink') el('rect', { x: -hw + 0.1, y: -hd + 0.1, width: pos(it.w * 0.5), height: pos(it.d - 0.22), rx: 0.05, class: 'sink-basin' }, g);
    const label = el('text', { x: 0, y: it.type === 'glass' ? -0.1 : 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': fs, class: 'item-label' }, g);
    label.textContent = CATALOG[it.type].label;
  }
}
