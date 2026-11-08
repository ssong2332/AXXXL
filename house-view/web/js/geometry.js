// 평면 도형 계산. 단위는 미터, 좌표는 화면과 같이 x 오른쪽 · y 아래쪽.

export const PYEONG_M2 = 400 / 121; // 1평 = 400/121㎡ (약 3.3058㎡)

export const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const c = x1 * y2 - x2 * y1;
    a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  if (Math.abs(a) < 1e-12) {
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

function orient(a, b, c) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return Math.abs(v) < 1e-12 ? 0 : Math.sign(v);
}
function onSeg(a, b, p) {
  return Math.min(a[0], b[0]) - 1e-12 <= p[0] && p[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    Math.min(a[1], b[1]) - 1e-12 <= p[1] && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}
export function segmentsIntersect(a, b, c, d) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(a, b, c)) return true;
  if (o2 === 0 && onSeg(a, b, d)) return true;
  if (o3 === 0 && onSeg(c, d, a)) return true;
  if (o4 === 0 && onSeg(c, d, b)) return true;
  return false;
}

// 저장해도 되는 도형인지 검사한다. 문제가 있으면 이유를 돌려준다.
export function validatePolygon(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return '꼭짓점이 3개보다 적어요.';
  if (pts.length > 40) return '꼭짓점이 너무 많아요(최대 40개).';
  for (const p of pts) {
    if (!Array.isArray(p) || p.length !== 2 || !isFiniteNum(p[0]) || !isFiniteNum(p[1])) return '좌표에 숫자가 아닌 값이 있어요.';
    if (Math.abs(p[0]) > 200 || Math.abs(p[1]) > 200) return '좌표가 너무 멀리 있어요.';
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) return '두 꼭짓점이 5cm보다 가까워요.';
  }
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // 이웃한 변
      if (segmentsIntersect(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return '벽이 서로 엇갈려요(자기 교차).';
    }
  }
  if (polygonArea(pts) < 0.5) return '면적이 0.5㎡보다 작아요.';
  return null;
}

// 무게중심을 기준으로 늘리거나 줄여서 목표 면적에 맞춘다.
export function scaleToArea(pts, target) {
  const a = polygonArea(pts);
  if (!(a > 0) || !(target > 0)) return pts.map((p) => [...p]);
  const r = Math.sqrt(target / a);
  const [cx, cy] = centroid(pts);
  return pts.map(([x, y]) => [cx + (x - cx) * r, cy + (y - cy) * r]);
}

export function translate(pts, dx, dy) {
  return pts.map(([x, y]) => [x + dx, y + dy]);
}

export function bounds(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function pointInPolygon(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// 물체(회전된 직사각형)의 네 꼭짓점. rot는 도(°), 화면 기준 시계 방향.
export function itemCorners(it) {
  const t = (it.rot * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const hw = it.w / 2, hd = it.d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]);
}

export function itemOutside(room, it) {
  // 벽에 딱 붙인 물체는 방 안으로 본다(1cm 여유).
  const corners = itemCorners({ ...it, w: Math.max(it.w - 0.02, 0.005), d: Math.max(it.d - 0.02, 0.005) });
  if (corners.some(([x, y]) => !pointInPolygon(room, x, y))) return true;
  // 꼭짓점은 안에 있어도 벽이 물체를 가로지르는 경우(ㄱ자 안쪽 모서리)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < room.length; j++) {
      if (segmentsIntersect(corners[i], corners[(i + 1) % 4], room[j], room[(j + 1) % room.length])) return true;
    }
  }
  return false;
}

// 분리축 검사로 두 물체가 겹치는지 본다(맞닿기만 한 경우는 겹침 아님).
export function itemsOverlap(a, b) {
  const pa = itemCorners(a), pb = itemCorners(b);
  for (const poly of [pa, pb]) {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % 4];
      const nx = y1 - y2, ny = x2 - x1;
      const proj = (p) => p.map(([x, y]) => x * nx + y * ny);
      const A = proj(pa), B = proj(pb);
      if (Math.max(...A) <= Math.min(...B) + 1e-6 || Math.max(...B) <= Math.min(...A) + 1e-6) return false;
    }
  }
  return true;
}

// 변 위에서 가장 가까운 점과 거리
export function nearestOnSegment(a, b, p) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { point: q, t, dist: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}
