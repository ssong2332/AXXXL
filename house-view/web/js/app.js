// 집 보기 시연판 화면 제어. 데이터는 메모리에만 두고, 사용자가 고를 때만 JSON으로 내보낸다.
// 사용자 글자는 textContent·value로만 넣고 innerHTML을 쓰지 않는다.
import {
  sampleHouses, createHouse, draftShape, areaNotes, makeItem, toM2, checkAreaInput, exportData, parseImport, clampSize,
  AREA_KINDS, AREA_SCOPES, PRESETS, CATALOG, CHECK_ITEMS, CHECK_STATUS, DRAFT_NOTICE, IMPORT_MAX_BYTES,
} from './model.js';
import { PYEONG_M2, polygonArea, validatePolygon, scaleToArea, centroid, pointInPolygon, bounds, itemOutside, itemsOverlap, itemCorners, nearestOnSegment } from './geometry.js';
import { Editor2D } from './editor2d.js';
import { MediaStore, MEDIA_RULES, formatBytes } from './media.js';

// ---------- 작은 DOM 도우미 ----------
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'value') e.value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}
const $ = (id) => document.getElementById(id);
const fmt = (v, n = 2) => (Math.round(v * 10 ** n) / 10 ** n).toFixed(n);
const r3 = (v) => Math.round(v * 1000) / 1000;
// 빈 칸·글자는 0이 아니라 NaN으로 본다.
const readNum = (s) => (String(s).trim() === '' ? NaN : Number(s));

// ---------- 상태 ----------
const state = {
  houses: sampleHouses(),
  activeId: null,
  step: 'shape',
  view: '2d',
  sel: null,
  history: new Map(),
};
state.activeId = state.houses[0].id;
const media = new MediaStore();
let view3d = null;
let dragBefore = null;

const house = () => state.houses.find((x) => x.id === state.activeId);
const STEPS = [['shape', '평수·방 모양'], ['items', '옵션 배치'], ['record', '사진·현장 기록'], ['compare', '집 비교']];

// 되돌리기는 면적·모양·물체만 대상으로 한다(글 메모는 제외).
function snap(hs) { return JSON.stringify({ area: hs.area, shape: hs.shape, items: hs.items }); }
function pushHistory(hs = house()) {
  state.dirty = true;
  const list = state.history.get(hs.id) || [];
  list.push(snap(hs));
  if (list.length > 60) list.shift();
  state.history.set(hs.id, list);
}
function undo() {
  const hs = house();
  const list = state.history.get(hs.id) || [];
  if (!list.length) { toast('되돌릴 작업이 없어요.'); return; }
  Object.assign(hs, JSON.parse(list.pop()));
  if (state.sel?.kind === 'item' && !hs.items.some((i) => i.id === state.sel.id)) state.sel = null;
  if ((state.sel?.kind === 'vertex' || state.sel?.kind === 'edge') && state.sel.index >= hs.shape.points.length) state.sel = null;
  toast('한 단계 되돌렸어요.');
  renderAll();
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
}

function confirmDlg(title, body, okLabel = '확인') {
  const d = $('confirmDlg');
  $('confirmTitle').textContent = title;
  $('confirmBody').textContent = body;
  $('confirmOk').textContent = okLabel;
  d.returnValue = '';
  d.showModal();
  return new Promise((res) => d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true }));
}

// ---------- 도형 적용 ----------
function roundPts(pts) { return pts.map(([x, y]) => [r3(x), r3(y)]); }

// 새 꼭짓점 목록을 검사해서 적용한다. 실패하면 아무것도 바꾸지 않고 false.
function applyShape(hs, pts, { history = true } = {}) {
  const cand = roundPts(hs.shape.keepArea ? scaleToArea(pts, hs.shape.targetM2) : pts);
  const err = validatePolygon(cand);
  if (err) { toast(`바꾸지 않았어요: ${err}`); return false; }
  if (history) pushHistory(hs);
  hs.shape.points = cand;
  return true;
}

function interiorPoint(pts) {
  const [cx, cy] = centroid(pts);
  if (pointInPolygon(pts, cx, cy)) return [cx, cy];
  const b = bounds(pts);
  let best = null, bd = Infinity;
  for (let x = b.minX + 0.25; x < b.maxX; x += 0.25) {
    for (let y = b.minY + 0.25; y < b.maxY; y += 0.25) {
      if (!pointInPolygon(pts, x, y)) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
  }
  return best || [cx, cy];
}

// ---------- 2D 편집기 ----------
const editor = new Editor2D($('planHost'), {
  onSelect(sel) {
    if (sel && sel.kind === 'item' && state.step !== 'items') return;
    state.sel = sel;
    renderPanel();
    render2D();
  },
  onDragStart(d) {
    const hs = house();
    dragBefore = snap(hs);
    if (d.kind === 'vertex' && state.step !== 'shape') d.cancel = true;
  },
  onVertexDrag(i, x, y) {
    const hs = house();
    hs.shape.points[i] = [r3(x), r3(y)];
    render2D();
  },
  onItemDrag(id, x, y) {
    const it = house().items.find((i) => i.id === id);
    if (!it) return;
    it.x = r3(x); it.y = r3(y);
    render2D();
  },
  onDragEnd(d) {
    const hs = house();
    if (!d.moved) { dragBefore = null; renderAll(); return; }
    const before = JSON.parse(dragBefore);
    if (d.kind === 'vertex') {
      const moved = hs.shape.points.map((p) => [...p]);
      hs.shape.points = before.shape.points; // 검사 전 원래대로
      if (applyShape(hs, moved, { history: false })) {
        const list = state.history.get(hs.id) || [];
        list.push(dragBefore);
        state.history.set(hs.id, list);
        if (hs.shape.keepArea) toast('손을 떼면 입력 면적에 맞게 전체 크기를 다시 맞춰요.');
        hs.shape.preset = 'custom';
      }
    } else {
      const list = state.history.get(hs.id) || [];
      list.push(dragBefore);
      state.history.set(hs.id, list);
    }
    dragBefore = null;
    renderAll();
  },
});

// ---------- 화면 그리기 ----------
function renderAll() {
  renderHouseSelect();
  renderSteps();
  renderPanel();
  renderWork();
}

function renderHouseSelect() {
  const s = $('houseSelect');
  s.replaceChildren(...state.houses.map((x) => h('option', { value: x.id, text: x.name + (x.sample ? ' (가상 샘플)' : ''), selected: x.id === state.activeId })));
}

function renderSteps() {
  $('steps').replaceChildren(...STEPS.map(([k, label], i) => h('button', {
    type: 'button', class: 'step', 'aria-current': state.step === k ? 'step' : null, 'aria-label': `${i + 1}단계 ${label}`, 'data-step': k,
    onclick: () => { state.step = k; state.sel = null; renderAll(); },
  }, h('b', { text: `0${i + 1}` }), h('span', { text: label }))));
}

function renderWork() {
  const wide = state.step === 'compare';
  $('layout').classList.toggle('wide', wide);
  $('work').hidden = wide;
  if (wide) { view3d?.stop(); return; }
  const is3d = state.view === '3d';
  $('view2d').setAttribute('aria-pressed', String(!is3d));
  $('view3d').setAttribute('aria-pressed', String(is3d));
  $('planHost').hidden = is3d;
  $('threeHost').hidden = !is3d;
  $('reset3d').hidden = !is3d;
  $('zoomIn3d').hidden = !is3d;
  $('zoomOut3d').hidden = !is3d;
  $('lowWalls').hidden = !is3d;
  $('stageTag').textContent = is3d ? `화면 시점만 돌아가요. 실제 방위는 바뀌지 않아요 · 벽 높이 ${view3d?.lowWalls ? '1m로 낮춰 보는 중' : '2.3m 가정'}` : '배치용 초안 · 격자 한 칸 50cm';
  if (is3d) {
    if (!view3d) return; // 아직 불러오는 중
    view3d.update(house());
    view3d.start();
  } else {
    view3d?.stop();
    render2D();
  }
  renderWarnings();
}

function render2D() {
  editor.render(house(), { mode: state.step === 'shape' ? 'shape' : state.step === 'items' ? 'items' : 'view', sel: state.sel });
}

function itemWarnings(hs) {
  const out = [];
  const outside = hs.items.filter((it) => itemOutside(hs.shape.points, it));
  if (outside.length) out.push(['warn', `방 밖으로 나간 물체가 있어요: ${outside.map((i) => CATALOG[i.type].label).join(', ')}. 위치는 그대로 뒀어요.`]);
  const pairs = [];
  for (let i = 0; i < hs.items.length; i++) {
    for (let j = i + 1; j < hs.items.length; j++) {
      if (itemsOverlap(hs.items[i], hs.items[j])) pairs.push(`${CATALOG[hs.items[i].type].label}·${CATALOG[hs.items[j].type].label}`);
    }
  }
  if (pairs.length) out.push(['', `참고: 겹쳐 보이는 물체가 있어요(${pairs.slice(0, 4).join(', ')}${pairs.length > 4 ? ' 외' : ''}). 실제 설치 가능 여부는 현장에서 확인해 주세요.`]);
  return out;
}

function renderWarnings() {
  const hs = house();
  const notes = itemWarnings(hs);
  if (!hs.shape.keepArea) {
    const a = polygonArea(hs.shape.points);
    notes.push(['', `자유 수정 중이에요. 그린 도형 면적 ${fmt(a, 1)}㎡ · 처음 입력한 면적 ${fmt(hs.shape.targetM2, 1)}㎡`]);
  }
  $('warnings').replaceChildren(...notes.map(([k, t]) => h('div', { class: `note ${k}`, text: t })));
}

// ---------- 단계별 왼쪽 패널 ----------
function renderPanel() {
  const panel = $('panel');
  const hs = house();
  const head = h('div', { class: 'card' },
    h('div', { class: 'row' }, h('h2', { text: hs.name }), hs.sample ? h('span', { class: 'badge sample', text: '가상 샘플' }) : null),
  );
  let body = [];
  if (state.step === 'shape') body = shapePanel(hs);
  else if (state.step === 'items') body = itemsPanel(hs);
  else if (state.step === 'record') body = recordPanel(hs);
  else body = comparePanel();
  panel.replaceChildren(...(state.step === 'compare' ? body : [head, ...body]));
}

// 아직 "초안 만들기"를 누르지 않은 면적 입력. 패널을 다시 그려도 잃지 않게 따로 둔다.
let pendingArea = null;

function shapePanel(hs) {
  const a = hs.area;
  if (pendingArea?.houseId !== hs.id) pendingArea = { houseId: hs.id, value: String(a.value), unit: a.unit };
  let unit = pendingArea.unit;
  const valueIn = h('input', { type: 'number', inputmode: 'decimal', min: '0.1', step: '0.1', value: pendingArea.value, id: 'areaValue', 'aria-label': '들은 면적 숫자' });
  const conv = h('p', { class: 'hint', id: 'areaConv' });
  const updateConv = () => {
    pendingArea.value = valueIn.value;
    pendingArea.unit = unit;
    const v = readNum(valueIn.value);
    const err = checkAreaInput(v, unit);
    conv.textContent = err || (unit === 'py' ? `약 ${fmt(v * PYEONG_M2, 1)}㎡ (1평 = 400/121㎡로 환산)` : `약 ${fmt(v / PYEONG_M2, 1)}평`);
  };
  valueIn.addEventListener('input', updateConv);
  const unitSeg = h('div', { class: 'seg', role: 'group', 'aria-label': '면적 단위' });
  const drawUnits = () => unitSeg.replaceChildren(...[['py', '평'], ['m2', '㎡']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(unit === k), onclick: () => { unit = k; drawUnits(); updateConv(); } }, l)));
  drawUnits();
  updateConv();
  const sel = (id, opts, cur, onchange) => h('select', { id, onchange }, ...Object.entries(opts).map(([k, l]) => h('option', { value: k, text: l, selected: k === cur })));
  const nameIn = h('input', { type: 'text', maxlength: '40', value: hs.name, id: 'houseName', onchange: (e) => { hs.name = e.target.value.trim().slice(0, 40) || '이름 없는 집'; renderHouseSelect(); renderPanel(); } });

  const start = h('div', { class: 'card' },
    h('h2', { text: '1. 들은 면적으로 시작해요' }),
    h('p', { class: 'hint', text: '가로·세로 치수를 몰라도 돼요. 들은 면적으로 배치용 초안을 만들고, 모양은 다음에 고쳐요.' }),
    h('label', { class: 'field' }, '집 별명', nameIn),
    h('div', { class: 'field' }, h('span', { text: '들은 면적' }), h('div', { class: 'row' }, h('div', { style: 'flex:1 1 120px' }, valueIn), unitSeg)),
    conv,
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, '면적 종류', sel('areaKind', AREA_KINDS, a.kind, (e) => { a.kind = e.target.value; renderPanel(); })),
      h('label', { class: 'field' }, '대상 범위', sel('areaScope', AREA_SCOPES, a.scope, (e) => { a.scope = e.target.value; renderPanel(); }))),
    h('button', {
      class: 'btn primary', type: 'button', id: 'makeDraft',
      onclick: () => {
        const v = readNum(valueIn.value);
        const err = checkAreaInput(v, unit);
        if (err) { toast(err); valueIn.focus(); return; }
        const m2 = toM2(v, unit);
        const pts = draftShape(hs.shape.preset in PRESETS ? hs.shape.preset : 'rect', m2);
        pushHistory(hs);
        hs.area.value = v; hs.area.unit = unit;
        pendingArea = null;
        hs.shape.targetM2 = r3(m2);
        hs.shape.points = pts;
        if (!(hs.shape.preset in PRESETS)) hs.shape.preset = 'rect';
        state.sel = null;
        toast('입력한 면적으로 초안을 다시 만들었어요. 물체 위치는 그대로예요.');
        renderAll();
      },
    }, '이 면적으로 초안 만들기'),
    ...areaNotes(a).map((t, i) => h('div', { class: i === 0 ? 'note' : 'note warn', text: t })),
  );

  const area = polygonArea(hs.shape.points);
  const selText = state.sel?.kind === 'vertex' ? `꼭짓점 ${state.sel.index + 1}을 골랐어요.` : state.sel?.kind === 'edge' ? `벽 ${state.sel.index + 1}(꼭짓점 ${state.sel.index + 1}→${(state.sel.index + 1) % hs.shape.points.length + 1})을 골랐어요.` : '평면에서 꼭짓점이나 벽을 눌러 고르세요. 꼭짓점은 끌어서 옮길 수 있어요.';
  const vSel = state.sel?.kind === 'vertex';
  const moveVertex = (dx, dy) => {
    const pts = hs.shape.points.map((p) => [...p]);
    pts[state.sel.index] = [pts[state.sel.index][0] + dx, pts[state.sel.index][1] + dy];
    if (applyShape(hs, pts)) { hs.shape.preset = 'custom'; renderAll(); }
  };
  const shapeCard = h('div', { class: 'card' },
    h('h2', { text: '2. 방 모양을 고쳐요' }),
    h('div', { class: 'grid2' }, ...Object.entries(PRESETS).map(([k, p]) => h('button', {
      type: 'button', class: 'btn', 'aria-pressed': String(hs.shape.preset === k), 'data-preset': k,
      onclick: () => {
        pushHistory(hs);
        hs.shape.preset = k;
        hs.shape.points = draftShape(k, hs.shape.keepArea ? hs.shape.targetM2 : polygonArea(hs.shape.points));
        state.sel = null;
        renderAll();
      },
    }, p.label))),
    h('label', { class: 'row', style: 'min-height:44px' },
      h('input', {
        type: 'checkbox', id: 'keepArea', checked: hs.shape.keepArea, style: 'width:22px;height:22px;accent-color:#0A7F5C',
        onchange: (e) => {
          pushHistory(hs);
          hs.shape.keepArea = e.target.checked;
          if (hs.shape.keepArea) hs.shape.points = roundPts(scaleToArea(hs.shape.points, hs.shape.targetM2));
          renderAll();
        },
      }),
      h('span', { text: '면적 유지 — 모양을 바꿔도 입력 면적에 맞춰 크기를 조정해요' })),
    h('p', { class: 'hint', text: hs.shape.keepArea ? '면적 유지는 계산상의 가정이에요. 실제로 잰 값으로 고친 것이 아니에요.' : '자유 수정 중이에요. 그린 도형의 면적을 따로 보여 줘요.' }),
    h('div', { class: 'stat' }, h('span', { text: '입력 면적(목표)' }), h('b', { text: `${fmt(hs.shape.targetM2, 1)}㎡` })),
    h('div', { class: 'stat' }, h('span', { text: '지금 도형 면적' }), h('b', { id: 'shapeArea', text: `${fmt(area, 1)}㎡` })),
    h('p', { class: 'note', id: 'selInfo', text: selText }),
    h('div', { class: 'row' },
      h('button', {
        type: 'button', class: 'btn', id: 'addPoint', disabled: !state.sel || (state.sel.kind !== 'edge' && state.sel.kind !== 'vertex'),
        onclick: () => {
          const n = hs.shape.points.length;
          const i = state.sel.index;
          const a1 = hs.shape.points[i], b1 = hs.shape.points[(i + 1) % n];
          const pts = hs.shape.points.map((p) => [...p]);
          pts.splice(i + 1, 0, [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2]);
          if (applyShape(hs, pts)) { hs.shape.preset = 'custom'; state.sel = { kind: 'vertex', index: i + 1 }; toast('벽 가운데에 점을 넣었어요. 끌어서 옮겨 보세요.'); renderAll(); }
        },
      }, '벽에 점 추가'),
      h('button', {
        type: 'button', class: 'btn danger', id: 'deletePoint', disabled: !vSel || hs.shape.points.length <= 3,
        onclick: () => {
          const pts = hs.shape.points.filter((_, k) => k !== state.sel.index);
          if (applyShape(hs, pts)) { hs.shape.preset = 'custom'; state.sel = null; renderAll(); }
        },
      }, '점 삭제')),
    vSel ? h('div', { class: 'row' }, h('span', { class: 'hint', text: '끌기 어려우면 10cm씩 옮겨요' }), movePad(moveVertex, 'vertex')) : null,
    h('details', { class: 'more' }, h('summary', { text: '상세 설정 · 꼭짓점 좌표(m)' }),
      h('div', { class: 'vtable' }, h('b', { text: '#' }), h('b', { text: 'x' }), h('b', { text: 'y' }),
        ...hs.shape.points.flatMap((p, i) => [
          h('span', { text: String(i + 1) }),
          ...[0, 1].map((k) => h('input', {
            class: 'num', type: 'number', step: '0.05', value: String(p[k]), 'aria-label': `꼭짓점 ${i + 1} ${k ? 'y' : 'x'}`,
            onchange: (e) => {
              const v = readNum(e.target.value);
              const pts = hs.shape.points.map((q) => [...q]);
              pts[i][k] = v;
              if (!Number.isFinite(v) || !applyShape(hs, pts)) { e.target.value = String(p[k]); return; }
              hs.shape.preset = 'custom';
              renderAll();
            },
          })),
        ])),
      h('p', { class: 'hint', text: '면적 유지가 켜져 있으면 숫자를 바꾼 뒤 전체 크기가 다시 맞춰져요.' })),
  );

  const danger = state.houses.length > 1 ? h('div', { class: 'card' },
    h('button', {
      type: 'button', class: 'btn danger', id: 'deleteHouse',
      onclick: async () => {
        if (!(await confirmDlg('이 집을 지울까요?', `"${hs.name}"의 모양·물체·기록과 불러온 사진·영상이 이 화면에서 사라져요.`, '지우기'))) return;
        media.dropHouse(hs.id);
        state.history.delete(hs.id);
        state.houses = state.houses.filter((x) => x.id !== hs.id);
        state.activeId = state.houses[0].id;
        state.sel = null;
        renderAll();
      },
    }, '이 집 지우기')) : null;
  return [start, shapeCard, danger];
}

function movePad(fn, name) {
  const s = 0.1;
  const b = (cls, label, dx, dy, path) => h('button', { type: 'button', class: `btn icon-btn ${cls}`, 'aria-label': label, 'data-move': `${name}-${cls}`, onclick: () => fn(dx, dy) }, svgIcon(path));
  return h('div', { class: 'pad' },
    b('up', '위로 10cm', 0, -s, 'M12 19V5M6 11l6-6 6 6'),
    b('left', '왼쪽으로 10cm', -s, 0, 'M19 12H5M11 6l-6 6 6 6'),
    b('down', '아래로 10cm', 0, s, 'M12 5v14M6 13l6 6 6-6'),
    b('right', '오른쪽으로 10cm', s, 0, 'M5 12h14M13 6l6 6-6 6'));
}
function svgIcon(d) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) s.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  s.append(p);
  return s;
}

function itemsPanel(hs) {
  const groups = [['kitchen', '주방·가전'], ['combo', '결합 주방'], ['furniture', '가구'], ['partition', '공간 구분']];
  const addCard = h('div', { class: 'card' },
    h('h2', { text: '옵션·가구를 놓아요' }),
    h('p', { class: 'hint', text: '크기는 흔한 예시값이에요. 놓은 뒤 끌어서 옮기고, 아래에서 돌리거나 크기를 바꿔요.' }),
    ...groups.map(([g, label]) => h('div', { class: 'field' }, h('span', { text: label }),
      h('div', { class: 'catalog' }, ...Object.entries(CATALOG).filter(([, c]) => c.group === g).map(([type, c]) => h('button', {
        type: 'button', class: 'btn', 'data-add': type,
        onclick: () => {
          const [x, y] = interiorPoint(hs.shape.points);
          pushHistory(hs);
          const it = makeItem(type, Math.round(x / 0.05) * 0.05, Math.round(y / 0.05) * 0.05);
          hs.items.push(it);
          state.sel = { kind: 'item', id: it.id };
          toast(`${c.label}을(를) 방 가운데에 놓았어요. 끌어서 옮겨 보세요.`);
          renderAll();
          // 휴대폰에서는 목록 아래에 있어도 바로 배치 화면으로 올려 준다.
          if (window.matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => $('work').scrollIntoView({ block: 'start' }));
        },
      }, c.label))))),
  );

  const it = state.sel?.kind === 'item' ? hs.items.find((i) => i.id === state.sel.id) : null;
  let selCard;
  if (!it) {
    selCard = h('div', { class: 'card' }, h('h2', { text: '고른 물체' }), h('p', { class: 'hint', text: '평면에서 물체를 누르거나 아래 목록에서 골라요.' }));
  } else {
    const c = CATALOG[it.type];
    const change = (fn) => { pushHistory(hs); fn(); renderAll(); };
    const isGlass = it.type === 'glass';
    const outside = itemOutside(hs.shape.points, it);
    const sizeBtn = (key, delta, label) => h('button', { type: 'button', class: 'btn', 'data-size': `${key}${delta > 0 ? '+' : '-'}`, onclick: () => change(() => { it[key] = r3(clampSize(it.type, key, it[key] + delta)); }) }, label);
    selCard = h('div', { class: 'card', id: 'selectedItem' },
      h('div', { class: 'row' }, h('h2', { text: c.label }), outside ? h('span', { class: 'badge warn', text: '방 밖' }) : null),
      c.note ? h('p', { class: 'hint', text: c.note }) : null,
      it.type === 'combo' ? h('div', { class: 'row' }, h('span', { text: '쿡탑' }), h('div', { class: 'seg', role: 'group', 'aria-label': '쿡탑 종류' },
        ...[['induction', '인덕션'], ['gas', '가스']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(it.cooktop === k), onclick: () => change(() => { it.cooktop = k; }) }, l)))) : null,
      h('div', { class: 'row' }, h('span', { class: 'hint', text: '옮기기' }), movePad((dx, dy) => change(() => { it.x = r3(it.x + dx); it.y = r3(it.y + dy); }), 'item')),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', 'data-rot': '-15', onclick: () => change(() => { it.rot = (it.rot - 15 + 360) % 360; }) }, '왼쪽 15°'),
        h('button', { type: 'button', class: 'btn', 'data-rot': '15', onclick: () => change(() => { it.rot = (it.rot + 15) % 360; }) }, '오른쪽 15°'),
        h('button', { type: 'button', class: 'btn', 'data-rot': '90', onclick: () => change(() => { it.rot = (it.rot + 90) % 360; }) }, '90° 돌리기')),
      h('div', { class: 'row' },
        sizeBtn('w', -0.1, isGlass ? '길이 −10cm' : '폭 −10cm'), sizeBtn('w', 0.1, isGlass ? '길이 +10cm' : '폭 +10cm'),
        isGlass ? null : sizeBtn('d', -0.1, '깊이 −10cm'), isGlass ? null : sizeBtn('d', 0.1, '깊이 +10cm')),
      h('p', { class: 'hint', text: `지금 ${isGlass ? '길이' : '폭'} ${fmt(it.w)}m${isGlass ? '' : ` · 깊이 ${fmt(it.d)}m`} · 높이 ${fmt(it.h)}m · ${Math.round(it.rot)}°` }),
      h('button', { type: 'button', class: 'btn danger', id: 'deleteItem', onclick: () => change(() => { hs.items = hs.items.filter((x) => x.id !== it.id); state.sel = null; }) }, '이 물체 지우기'),
      h('details', { class: 'more' }, h('summary', { text: '상세 설정 · 정확한 치수를 알 때' }),
        h('div', { class: 'grid2' }, ...[['x', '가로 위치 x(m)'], ['y', '세로 위치 y(m)'], ['rot', '회전(°)'], ['w', isGlass ? '길이(m)' : '폭(m)'], ['d', isGlass ? '두께(m)' : '깊이(m)'], ['h', '높이(m)']].map(([k, l]) => h('label', { class: 'field' }, l,
          h('input', {
            type: 'number', step: k === 'rot' ? '1' : '0.01', value: String(it[k]), 'data-field': k,
            onchange: (e) => {
              const v = readNum(e.target.value);
              if (!Number.isFinite(v)) { e.target.value = String(it[k]); toast('숫자를 넣어 주세요.'); return; }
              change(() => {
                if (k === 'rot') it.rot = ((v % 360) + 360) % 360;
                else if (k === 'x' || k === 'y') it[k] = r3(Math.max(-200, Math.min(200, v)));
                else it[k] = r3(clampSize(it.type, k, v));
              });
            },
          })))),
        isGlass ? h('p', { class: 'hint', text: '유리 분리문은 공간 구분을 보여 주는 표시예요. 실제 시공이나 문 여닫이 가능 여부를 확인한 것이 아니에요.' }) : null),
    );
  }

  const listCard = h('div', { class: 'card' }, h('h3', { text: `놓은 물체 ${hs.items.length}개` }),
    hs.items.length ? h('div', { class: 'row' }, ...hs.items.map((x) => h('button', {
      type: 'button', class: 'btn', 'aria-pressed': String(state.sel?.id === x.id),
      onclick: () => { state.sel = { kind: 'item', id: x.id }; renderPanel(); render2D(); },
    }, CATALOG[x.type].label))) : h('p', { class: 'hint', text: '아직 없어요.' }));
  return [selCard, addCard, listCard];
}

function recordPanel(hs) {
  const files = h('input', {
    type: 'file', id: 'mediaInput', multiple: true, accept: [...MEDIA_RULES.image.types, ...MEDIA_RULES.video.types].join(','), class: 'sr',
    onchange: (e) => {
      const rejected = media.add(hs.id, [...e.target.files]);
      e.target.value = '';
      if (rejected.length) toast(`넣지 못한 파일 ${rejected.length}개: ${rejected.slice(0, 3).map(([n, why]) => `${n} (${why})`).join(', ')}`);
      renderPanel();
    },
  });
  const list = media.list(hs.id);
  const privacy = h('div', { class: 'card' },
    h('h2', { text: '사진·영상 (선택)' }),
    h('div', { class: 'note warn', text: '남이 사는 집이에요. 찍기 전에 집주인·세입자에게 촬영해도 되는지 물어봐 주세요. 얼굴, 우편물, 계약서, 사진 액자가 찍히지 않게 조심해 주세요.' }),
    h('p', { class: 'hint', text: '이 시연판은 얼굴·글자 자동 가림과 위치정보(EXIF) 제거를 하지 않아요. 파일은 이 브라우저 안에서만 미리 보고 어디로도 보내지 않아요. JSON 저장에도 들어가지 않아요.' }),
    h('p', { class: 'hint', text: '사진·영상으로 방 구조를 자동으로 그려 주는 기능은 아직 없어요. 지금은 옆에 띄워 놓고 모양을 직접 고치는 참고 자료예요.' }),
    h('label', { class: 'btn primary', for: 'mediaInput', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); files.click(); } } }, '사진·영상 고르기'), files,
    h('p', { class: 'hint', text: `${MEDIA_RULES.image.label} · ${MEDIA_RULES.video.label} · 한 집에 ${MEDIA_RULES.perHouse}개까지` }),
    list.length ? h('div', { class: 'media-grid', id: 'mediaGrid' }, ...list.map((m) => h('div', { class: 'media-card', 'data-media': m.kind },
      m.kind === 'image'
        ? h('img', { src: m.url, alt: m.name, onclick: () => openViewer(m), style: 'cursor:zoom-in' })
        : h('video', { src: m.url, controls: true, preload: 'metadata', playsinline: true, onerror: () => toast(`${m.name}: 이 브라우저에서 재생할 수 없는 형식이에요.`) }),
      h('div', { class: 'meta', text: `${m.name} · ${formatBytes(m.size)}` }),
      h('div', { class: 'row' },
        m.kind === 'image' ? h('button', { type: 'button', class: 'btn subtle', onclick: () => openViewer(m) }, '크게') : null,
        h('button', { type: 'button', class: 'btn subtle danger', 'data-remove-media': m.id, onclick: () => { media.remove(hs.id, m.id); renderPanel(); } }, '삭제'))))) : h('p', { class: 'hint', id: 'mediaEmpty', text: '이 집에는 아직 사진·영상이 없어요. 없어도 다음 단계로 갈 수 있어요.' }),
  );

  const checks = h('div', { class: 'card' },
    h('h2', { text: '현장 체크' }),
    h('p', { class: 'hint', text: '처음에는 모두 "확인 못 함"이에요. 보지 않은 항목은 문제없다는 뜻이 아니에요.' }),
    ...CHECK_ITEMS.map(([k, label]) => {
      const c = hs.checks[k];
      return h('div', { class: 'check', 'data-check': k },
        h('div', { class: 'check-head' }, h('b', { text: label }),
          h('div', { class: 'seg', role: 'group', 'aria-label': `${label} 확인 상태` }, ...['ok', 'doubt', 'unchecked'].map((s) => h('button', {
            type: 'button', 'aria-pressed': String(c.status === s), 'data-status': s,
            onclick: () => { c.status = s; renderPanel(); },
          }, CHECK_STATUS[s])))),
        h('input', { type: 'text', class: 'num', maxlength: '300', placeholder: '짧은 메모', value: c.note, 'aria-label': `${label} 메모`, oninput: (e) => { c.note = e.target.value; } }));
    }),
  );
  const notes = h('div', { class: 'card' },
    h('label', { class: 'field' }, '중개사·집주인에게 물어볼 것', h('textarea', { id: 'questions', maxlength: '2000', value: hs.questions, oninput: (e) => { hs.questions = e.target.value; } })),
    h('label', { class: 'field' }, '자유 메모', h('textarea', { id: 'memo', maxlength: '2000', value: hs.memo, oninput: (e) => { hs.memo = e.target.value; } })),
  );
  return [privacy, checks, notes];
}

let viewerScale = 1;
function openViewer(m) {
  viewerScale = 1;
  $('viewerTitle').textContent = m.name;
  const img = h('img', { src: m.url, alt: m.name, id: 'viewerImg' });
  img.addEventListener('load', () => applyZoom(), { once: true });
  $('viewerStage').replaceChildren(img);
  $('viewerDlg').showModal();
}
function applyZoom() {
  const img = $('viewerImg');
  if (!img) return;
  const base = Math.min(($('viewerStage').clientWidth || 600) / (img.naturalWidth || 1), 1);
  img.style.width = `${Math.round((img.naturalWidth || 600) * base * viewerScale)}px`;
}

function comparePanel() {
  const hs = state.houses;
  const kinds = new Set(hs.map((x) => `${x.area.kind}/${x.area.scope}`));
  const mixed = kinds.size > 1 || hs.some((x) => x.area.kind !== 'exclusive');
  const label = (t) => CATALOG[t].label;
  const rows = [
    ['구분', (x) => (x.sample ? '가상 샘플' : '직접 추가')],
    ['들은 면적', (x) => `${x.area.value}${x.area.unit === 'py' ? '평' : '㎡'} (약 ${fmt(toM2(x.area.value, x.area.unit), 1)}㎡)`],
    ['면적 기준', (x) => `${AREA_KINDS[x.area.kind]} · ${AREA_SCOPES[x.area.scope]}`],
    ['방 모양 초안', (x) => `${PRESETS[x.shape.preset]?.label || '직접 고친 모양'} · 꼭짓점 ${x.shape.points.length}개\n그린 면적 ${fmt(polygonArea(x.shape.points), 1)}㎡ (${x.shape.keepArea ? '면적 유지' : '자유 수정'})`],
    ['주방·가전', (x) => x.items.filter((i) => CATALOG[i.type].group === 'kitchen').map((i) => label(i.type)).join(', ') || '없음'],
    ['결합 주방', (x) => { const c = x.items.filter((i) => i.type === 'combo'); return c.length ? c.map((i) => `있음 (${i.cooktop === 'gas' ? '가스' : '인덕션'} + 아래 세탁기)`).join('\n') : '없음'; }],
    ['유리 분리문', (x) => { const g = x.items.filter((i) => i.type === 'glass'); return g.length ? `${g.length}개 (길이 ${g.map((i) => fmt(i.w, 1) + 'm').join(', ')})` : '없음'; }],
    ['가구', (x) => x.items.filter((i) => CATALOG[i.type].group === 'furniture').map((i) => label(i.type)).join(', ') || '없음'],
    ['사진·영상', (x) => { const c = media.counts(x.id); return `사진 ${c.image}장 · 영상 ${c.video}개`; }],
    ['현장 체크', (x) => {
      const v = Object.values(x.checks);
      const n = (s) => v.filter((c) => c.status === s).length;
      return `확인함 ${n('ok')} · 의문 있음 ${n('doubt')} · 확인 못 함 ${n('unchecked')}`;
    }],
    ['의문·미확인 항목', (x) => CHECK_ITEMS.filter(([k]) => x.checks[k].status !== 'ok').map(([k, l]) => `${l}: ${CHECK_STATUS[x.checks[k].status]}${x.checks[k].note ? ` (${x.checks[k].note})` : ''}`).join('\n') || '없음'],
    ['물어볼 것', (x) => x.questions || '—'],
    ['메모', (x) => x.memo || '—'],
  ];
  const table = h('table', { class: 'compare', id: 'compareTable' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: '항목' }), ...hs.map((x) => h('th', { scope: 'col', text: x.name })))),
    h('tbody', {}, ...rows.map(([name, fn]) => h('tr', {}, h('th', { scope: 'row', text: name }), ...hs.map((x) => h('td', { text: fn(x) }))))));
  return [h('div', { class: 'card' },
    h('h2', { text: `집 비교 · ${hs.length}채` }),
    h('p', { class: 'hint', text: '이 표는 순위·추천·안전 점수를 만들지 않아요. 고른 기록을 나란히 놓기만 해요.' }),
    mixed ? h('div', { class: 'note warn', id: 'mixedWarn', text: '면적 기준(전용·공급·들은 평수·모름, 집 전체·방 하나)이 서로 다르거나 확실하지 않아요. 면적 숫자를 그대로 비교하지 마세요.' }) : null,
    h('div', { class: 'compare-wrap' }, table))];
}

// ---------- 상단·공통 이벤트 ----------
$('houseSelect').addEventListener('change', (e) => { state.activeId = e.target.value; state.sel = null; renderAll(); });
$('addHouse').addEventListener('click', () => {
  const n = state.houses.length + 1;
  const hs = createHouse({ name: `새 집 ${n}`, value: 6, unit: 'py', kind: 'unknown', scope: 'unknown' });
  state.houses.push(hs);
  state.activeId = hs.id;
  state.step = 'shape';
  state.sel = null;
  renderAll();
  toast('새 집을 만들었어요. 들은 면적을 넣고 "이 면적으로 초안 만들기"를 눌러 주세요.');
  $('houseName')?.focus();
});
$('view2d').addEventListener('click', () => { state.view = '2d'; renderWork(); });
$('view3d').addEventListener('click', async () => {
  state.view = '3d';
  if (!view3d) {
    try {
      const { View3D } = await import('./view3d.js');
      view3d = new View3D($('threeHost'));
    } catch (err) {
      console.error(err);
      toast('3D 보기를 불러오지 못했어요. 2D로 계속 쓸 수 있어요.');
      state.view = '2d';
    }
  }
  renderWork();
});
$('reset3d').addEventListener('click', () => view3d?.resetView());
$('zoomIn3d').addEventListener('click', () => view3d?.zoom(0.8));
$('zoomOut3d').addEventListener('click', () => view3d?.zoom(1.25));
$('lowWalls').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(on));
  view3d?.setLowWalls(on);
  renderWork();
});
$('undoBtn').addEventListener('click', undo);
$('zoomIn').addEventListener('click', () => { viewerScale = Math.min(4, viewerScale * 1.4); applyZoom(); });
$('zoomOut').addEventListener('click', () => { viewerScale = Math.max(0.5, viewerScale / 1.4); applyZoom(); });
$('viewerClose').addEventListener('click', () => $('viewerDlg').close());

// 저장: 공유 페이지에서는 파일 내려받기가 막힐 수 있어 내용을 보여 주고 복사도 할 수 있게 한다.
$('exportJson').addEventListener('click', () => {
  $('exportText').value = JSON.stringify(exportData(state.houses), null, 2);
  $('exportDlg').showModal();
});
$('copyJson').addEventListener('click', async () => {
  const ta = $('exportText');
  try { await navigator.clipboard.writeText(ta.value); toast('복사했어요. 사진·영상 파일은 들어 있지 않아요.'); } catch {
    ta.focus(); ta.select();
    toast('자동 복사가 막혔어요. 선택된 내용을 Ctrl+C로 복사해 주세요.');
  }
});
$('downloadJson').addEventListener('click', () => {
  const blob = new Blob([$('exportText').value], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `집보기_기록_${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('파일 저장을 요청했어요. 내려받기가 안 되면 "복사"를 써 주세요.');
});
$('exportClose').addEventListener('click', () => $('exportDlg').close());
$('importJson').addEventListener('click', () => { $('importText').value = ''; $('importDlg').showModal(); });
$('importClose').addEventListener('click', () => $('importDlg').close());
$('pickJsonFile').addEventListener('click', () => $('importFile').click());
$('importPasted').addEventListener('click', async () => {
  const text = $('importText').value.trim();
  if (!text) { toast('붙여 넣은 내용이 없어요.'); return; }
  $('importDlg').close();
  await importText(text);
});
$('importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  $('importDlg').close();
  if (f.size > IMPORT_MAX_BYTES) { toast('불러오지 않았어요: 파일이 2MB보다 커요. 지금 작업은 그대로예요.'); return; }
  await importText(await f.text());
});

async function importText(text) {
  let houses;
  try { houses = parseImport(text); } catch (err) { toast(`불러오지 않았어요: ${err.message} 지금 작업은 그대로예요.`); return false; }
  const ok = await confirmDlg('지금 작업을 바꿀까요?', `불러온 파일의 집 ${houses.length}채로 바꿔요. 지금 화면의 기록은 사라지고, 사진·영상은 다시 골라야 해요.`, '바꾸기');
  if (!ok) { toast('불러오기를 취소했어요.'); return false; }
  media.clearAll();
  state.houses = houses;
  state.activeId = houses[0].id;
  state.history.clear();
  state.sel = null;
  renderAll();
  toast('불러왔어요. 사진·영상은 집마다 다시 골라 주세요.');
  return true;
}

// 키보드: 고른 물체를 화살표로 10cm, Delete로 삭제
$('stage').tabIndex = 0;
$('stage').addEventListener('keydown', (e) => {
  const hs = house();
  const it = state.sel?.kind === 'item' ? hs.items.find((i) => i.id === state.sel.id) : null;
  if (!it || state.step !== 'items') return;
  const d = { ArrowUp: [0, -0.1], ArrowDown: [0, 0.1], ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0] }[e.key];
  if (d) { e.preventDefault(); pushHistory(hs); it.x = r3(it.x + d[0]); it.y = r3(it.y + d[1]); renderAll(); }
  if (e.key === 'Delete') { pushHistory(hs); hs.items = hs.items.filter((x) => x.id !== it.id); state.sel = null; renderAll(); }
});
window.addEventListener('resize', () => { if (state.view === '2d' && state.step !== 'compare') render2D(); });
// 고친 내용이 있으면 새로고침·닫기 전에 브라우저가 한 번 묻게 한다.
document.addEventListener('input', () => { state.dirty = true; });
document.addEventListener('click', (e) => { if (e.target.closest('[data-status]')) state.dirty = true; });
window.addEventListener('beforeunload', (e) => { if (state.dirty) e.preventDefault(); });

renderAll();

// 검사용 읽기 창구(화면 동작에는 쓰지 않음)
window.__houseApp = {
  state, media, importText, undo,
  get view3d() { return view3d; },
  itemCorners, polygonArea, DRAFT_NOTICE,
};
