// 집 데이터 구조, 샘플, 물체 목록, JSON 내보내기·가져오기 검증.
import { PYEONG_M2, isFiniteNum, polygonArea, scaleToArea, translate, bounds, validatePolygon, centroid } from './geometry.js';

export const APP_ID = 'jachwi-house-view';
export const DATA_VERSION = 1;
export const DRAFT_NOTICE = '입력한 면적으로 만든 배치용 초안이에요. 실제 방 모양과 치수는 다를 수 있어요.';

export const AREA_KINDS = {
  exclusive: '전용면적',
  supply: '공급면적',
  heard: '실평수라고 들음',
  unknown: '잘 모르겠음',
};
export const AREA_SCOPES = { whole: '집 전체', room: '방 하나', unknown: '잘 모르겠음' };
export const AREA_LIMITS = { min: 0.5, max: 300 }; // ㎡

// 모양 후보. 비율만 정해 두고 입력 면적에 맞춰 늘린다.
export const PRESETS = {
  rect: { label: '직사각형', pts: [[0, 0], [1.3, 0], [1.3, 1], [0, 1]] },
  long: { label: '길쭉한 직사각형', pts: [[0, 0], [2.2, 0], [2.2, 1], [0, 1]] },
  ell: { label: 'ㄱ자', pts: [[0, 0], [1.4, 0], [1.4, 1.1], [0.8, 1.1], [0.8, 0.5], [0, 0.5]] },
  notch: { label: '한쪽이 들어간 모양', pts: [[0, 0], [1.3, 0], [1.3, 1], [0.45, 1], [0.45, 0.7], [0, 0.7]] },
};

// 크기는 흔히 보이는 예시값이에요. 정확한 치수는 상세 설정에서 바꾼다.
export const CATALOG = {
  fridge: { label: '냉장고', group: 'kitchen', w: 0.6, d: 0.7, h: 1.7 },
  sink: { label: '싱크대', group: 'kitchen', w: 1.0, d: 0.6, h: 0.85 },
  induction: { label: '인덕션', group: 'kitchen', w: 0.6, d: 0.6, h: 0.85 },
  gas: { label: '가스쿡탑', group: 'kitchen', w: 0.6, d: 0.6, h: 0.85 },
  washer: { label: '세탁기', group: 'kitchen', w: 0.6, d: 0.6, h: 0.85 },
  combo: { label: '결합 주방', group: 'combo', w: 1.8, d: 0.6, h: 0.85, note: '싱크대 + 쿡탑 + 쿡탑 아래 세탁기' },
  bed: { label: '침대', group: 'furniture', w: 1.1, d: 2.0, h: 0.45 },
  desk: { label: '책상', group: 'furniture', w: 1.2, d: 0.6, h: 0.74 },
  wardrobe: { label: '옷장', group: 'furniture', w: 0.9, d: 0.6, h: 1.9 },
  glass: { label: '유리 분리문', group: 'partition', w: 1.6, d: 0.05, h: 2.1 },
};
export const SIZE_LIMITS = { w: [0.2, 5], d: [0.03, 3], h: [0.1, 3] };
export const COMBO_SINK_RATIO = 0.55; // 결합 주방에서 싱크대가 차지하는 폭 비율

export const CHECK_ITEMS = [
  ['water', '수압·배수'],
  ['damp', '냄새·습기 흔적'],
  ['noise', '소음'],
  ['window', '창 방향'],
  ['floor', '층·반지하 여부'],
  ['options', '옵션 상태'],
];
export const CHECK_STATUS = { unchecked: '확인 못 함', ok: '확인함', doubt: '의문 있음' };

export const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round3 = (v) => Math.round(v * 1000) / 1000;

export function toM2(value, unit) {
  return unit === 'py' ? value * PYEONG_M2 : value;
}

export function checkAreaInput(value, unit) {
  if (!isFiniteNum(value) || value <= 0) return '0보다 큰 숫자를 넣어 주세요.';
  const m2 = toM2(value, unit);
  if (m2 < AREA_LIMITS.min || m2 > AREA_LIMITS.max) return `${AREA_LIMITS.min}㎡~${AREA_LIMITS.max}㎡ 사이로 넣어 주세요.`;
  return null;
}

// 모양 후보를 목표 면적으로 늘리고 왼쪽 위가 (0.3, 0.3)에 오게 놓는다.
export function draftShape(presetKey, m2) {
  const base = PRESETS[presetKey]?.pts || PRESETS.rect.pts;
  const scaled = scaleToArea(base, m2);
  const b = bounds(scaled);
  return translate(scaled, 0.3 - b.minX, 0.3 - b.minY).map(([x, y]) => [round3(x), round3(y)]);
}

export function areaNotes(area) {
  const notes = [DRAFT_NOTICE];
  if (area.kind === 'supply') notes.push('공급면적은 계단·복도 같은 공용 부분이 더해진 값이라 실제 실내 바닥보다 넓어요. 초안은 입력값을 그대로 썼어요.');
  if (area.kind === 'heard' || area.kind === 'unknown') notes.push('어떤 기준의 면적인지 확실하지 않아요. 실제 바닥면적이라고 보지 마세요.');
  if (area.scope === 'whole') notes.push('집 전체 면적이라면 주방·욕실·현관이 함께 들어 있을 수 있어요. 초안은 한 공간으로 그렸어요.');
  if (area.scope === 'unknown') notes.push('집 전체인지 방 하나인지 모르는 면적이에요.');
  return notes;
}

export function makeItem(type, x, y, extra = {}) {
  const c = CATALOG[type];
  const it = { id: newId(), type, x: round3(x), y: round3(y), rot: 0, w: c.w, d: c.d, h: c.h };
  if (type === 'combo') it.cooktop = extra.cooktop === 'gas' ? 'gas' : 'induction';
  return it;
}

export function emptyChecks() {
  return Object.fromEntries(CHECK_ITEMS.map(([k]) => [k, { status: 'unchecked', note: '' }]));
}

export function createHouse({ name, value, unit = 'py', kind = 'unknown', scope = 'unknown', preset = 'rect', sample = false }) {
  const m2 = toM2(value, unit);
  return {
    id: newId(), name, sample,
    area: { value, unit, kind, scope },
    shape: { preset, keepArea: true, targetM2: round3(m2), points: draftShape(preset, m2) },
    items: [],
    checks: emptyChecks(),
    questions: '',
    memo: '',
  };
}

// 실제 주소·사진이 없는 가상 샘플 두 채
export function sampleHouses() {
  const a = createHouse({ name: '샘플 A · 원룸', value: 7, unit: 'py', kind: 'exclusive', scope: 'whole', preset: 'rect', sample: true });
  const pa = a.shape.points; // 약 23.1㎡, 대략 5.5m × 4.2m
  const ba = bounds(pa);
  a.items.push(
    { ...makeItem('combo', ba.minX + 1.05, ba.minY + 0.3), rot: 0 },
    makeItem('fridge', ba.minX + 2.3, ba.minY + 0.35),
    { ...makeItem('glass', ba.minX + 2.85, ba.minY + 1.3), rot: 90, w: 2.0 },
    makeItem('bed', ba.maxX - 0.6, ba.maxY - 1.05),
    makeItem('desk', ba.maxX - 2.0, ba.maxY - 0.3),
  );
  a.checks.water = { status: 'ok', note: '샤워기 수압 보통' };
  a.checks.window = { status: 'doubt', note: '창이 남쪽이라고 들었는데 나침반으로 못 봄' };
  a.questions = '관리비에 인터넷이 포함되는지\n입주 전 도배 가능 여부';
  a.memo = '가상 샘플이에요. 실제 집이 아니에요.';

  const b = createHouse({ name: '샘플 B · ㄱ자 원룸', value: 6, unit: 'py', kind: 'heard', scope: 'unknown', preset: 'ell', sample: true });
  const bb = bounds(b.shape.points);
  b.items.push(
    makeItem('sink', bb.minX + 0.7, bb.minY + 0.3),
    makeItem('induction', bb.minX + 1.5, bb.minY + 0.3),
    makeItem('washer', bb.minX + 2.1, bb.minY + 0.3),
    { ...makeItem('bed', bb.maxX - 0.6, bb.maxY - 1.05) },
  );
  b.checks.damp = { status: 'doubt', note: '화장실 천장 모서리에 얼룩' };
  b.checks.floor = { status: 'ok', note: '2층' };
  b.questions = '얼룩이 누수 흔적인지';
  b.memo = '가상 샘플이에요. 실제 집이 아니에요.';
  return [a, b];
}

export function shapeArea(house) {
  return polygonArea(house.shape.points);
}

export { centroid };

// ---------- JSON 내보내기 · 가져오기 ----------

export function exportData(houses) {
  return {
    app: APP_ID,
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    note: '사진·영상 파일은 들어 있지 않아요. 불러온 뒤 다시 선택해야 해요.',
    houses: houses.map((h) => ({
      id: h.id, name: h.name, sample: !!h.sample,
      area: { ...h.area }, shape: { ...h.shape, points: h.shape.points.map((p) => [...p]) },
      items: h.items.map((it) => ({ ...it })), checks: structuredClone(h.checks),
      questions: h.questions, memo: h.memo,
    })),
  };
}

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const TEXT_MAX = { name: 40, note: 300, questions: 2000, memo: 2000 };

function str(v, max, field) {
  if (typeof v !== 'string') throw new Error(`${field} 값이 글자가 아니에요.`);
  if (v.length > max) throw new Error(`${field}가 ${max}자를 넘어요.`);
  return v;
}
function num(v, lo, hi, field) {
  if (!isFiniteNum(v) || v < lo || v > hi) throw new Error(`${field} 값이 허용 범위(${lo}~${hi})를 벗어났어요.`);
  return v;
}
function oneOf(v, allowed, field) {
  if (!Object.prototype.hasOwnProperty.call(allowed, v)) throw new Error(`${field} 값 "${String(v).slice(0, 20)}"은(는) 쓸 수 없는 값이에요.`);
  return v;
}

// 통과하면 새 집 목록을, 실패하면 예외를 던진다. 기존 작업은 호출한 쪽에서 그대로 둔다.
export function parseImport(text) {
  if (typeof text !== 'string') throw new Error('파일을 읽지 못했어요.');
  if (text.length > IMPORT_MAX_BYTES) throw new Error('파일이 2MB보다 커요.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON 형식이 아니에요.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON 최상위가 객체가 아니에요.');
  if (data.app !== APP_ID) throw new Error('이 시연판에서 내보낸 파일이 아니에요.');
  if (data.version !== DATA_VERSION) throw new Error(`지원하지 않는 버전이에요(${String(data.version).slice(0, 10)}).`);
  if (!Array.isArray(data.houses) || data.houses.length < 1 || data.houses.length > 20) throw new Error('집은 1~20채여야 해요.');
  const seen = new Set();
  return data.houses.map((h, i) => {
    const at = `${i + 1}번째 집의 `;
    if (!h || typeof h !== 'object') throw new Error(at + '형식이 잘못됐어요.');
    let id = typeof h.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(h.id) && !seen.has(h.id) ? h.id : newId();
    seen.add(id);
    const name = str(h.name, TEXT_MAX.name, at + '이름').trim() || `집 ${i + 1}`;
    const a = h.area || {};
    const unit = a.unit === 'm2' ? 'm2' : a.unit === 'py' ? 'py' : (() => { throw new Error(at + '면적 단위가 잘못됐어요.'); })();
    const value = num(a.value, 0.01, 1000, at + '면적');
    const areaErr = (() => { const m2 = toM2(value, unit); return m2 < AREA_LIMITS.min || m2 > AREA_LIMITS.max; })();
    if (areaErr) throw new Error(at + '면적이 허용 범위를 벗어났어요.');
    const area = { value, unit, kind: oneOf(a.kind, AREA_KINDS, at + '면적 종류'), scope: oneOf(a.scope, AREA_SCOPES, at + '대상 범위') };
    const s = h.shape || {};
    const points = Array.isArray(s.points) ? s.points.map((p) => (Array.isArray(p) ? [p[0], p[1]] : p)) : null;
    const polyErr = validatePolygon(points);
    if (polyErr) throw new Error(at + '방 모양: ' + polyErr);
    const shape = {
      preset: Object.prototype.hasOwnProperty.call(PRESETS, s.preset) ? s.preset : 'custom',
      keepArea: !!s.keepArea,
      targetM2: num(s.targetM2, AREA_LIMITS.min, AREA_LIMITS.max, at + '목표 면적'),
      points,
    };
    if (!Array.isArray(h.items) || h.items.length > 60) throw new Error(at + '물체 목록이 잘못됐어요(최대 60개).');
    const items = h.items.map((it, k) => {
      const f = `${at}${k + 1}번째 물체의 `;
      if (!it || typeof it !== 'object') throw new Error(f + '형식이 잘못됐어요.');
      const type = oneOf(it.type, CATALOG, f + '종류');
      const out = {
        id: typeof it.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(it.id) ? it.id : newId(),
        type,
        x: num(it.x, -200, 200, f + 'x'), y: num(it.y, -200, 200, f + 'y'),
        rot: num(it.rot, -3600, 3600, f + '회전') % 360,
        w: num(it.w, SIZE_LIMITS.w[0], SIZE_LIMITS.w[1], f + '폭'),
        d: num(it.d, SIZE_LIMITS.d[0], SIZE_LIMITS.d[1], f + '깊이'),
        h: num(it.h, SIZE_LIMITS.h[0], SIZE_LIMITS.h[1], f + '높이'),
      };
      if (type === 'combo') out.cooktop = it.cooktop === 'gas' ? 'gas' : 'induction';
      return out;
    });
    const checks = emptyChecks();
    if (h.checks && typeof h.checks === 'object') {
      for (const [k] of CHECK_ITEMS) {
        const c = h.checks[k];
        if (c === undefined) continue;
        checks[k] = { status: oneOf(c?.status, CHECK_STATUS, at + '현장 체크 상태'), note: str(c.note ?? '', TEXT_MAX.note, at + '현장 메모') };
      }
    }
    return {
      id, name, sample: !!h.sample, area, shape, items, checks,
      questions: str(h.questions ?? '', TEXT_MAX.questions, at + '질문'),
      memo: str(h.memo ?? '', TEXT_MAX.memo, at + '메모'),
    };
  });
}

export function clampSize(type, key, v) {
  const [lo, hi] = SIZE_LIMITS[key];
  if (type === 'glass' && key === 'd') return clamp(v, 0.03, 0.2);
  return clamp(v, lo, hi);
}
