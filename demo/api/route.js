// GET /api/route?sx=경도&sy=위도&ex=경도&ey=위도&en=장소이름   집 → 장소 도보 경로 (카카오맵 REST API 도보 경로 조회)
//  - KAKAOREST_API_KEY(또는 KAKAO_REST_KEY) 환경변수의 REST API 키는 서버에서만 쓴다. 화면에는 내려주지 않는다.
//  - 화면에 필요한 것만 돌려준다: 거리(m)·시간(초)·카카오맵 길찾기 링크·경로 좌표([위도, 경도]).
//  - 좌표는 저장하지 않는다. 같은 요청은 하루 동안 Vercel 캐시를 쓴다.
'use strict';

function simplify(d) {
  const route = d && d.status === 'OK' ? d.route : null;
  if (!route) return { ok: false, status: (d && (d.status || d.errorType)) || 'ERROR' };
  const pts = [];
  (route.legs || []).forEach((leg) => (leg.steps || []).forEach((st) => ((st.path && st.path.points) || []).forEach(([x, y]) => {
    const p = [+(+y).toFixed(6), +(+x).toFixed(6)], last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  })));
  const prop = route.properties || {};
  return { ok: pts.length > 1, distance: prop.totalDistance, time: prop.totalTime, url: prop.landingUrl, points: pts };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const n = (k) => +req.query[k];
  const sx = n('sx'), sy = n('sy'), ex = n('ex'), ey = n('ey');
  if (![sy, ey].every((v) => v > 33 && v < 39) || ![sx, ex].every((v) => v > 124 && v < 132)) return res.status(400).json({ ok: false, error: '대한민국 안의 좌표만 찾을 수 있어요.' });
  const key = String(process.env.KAKAOREST_API_KEY || process.env.KAKAO_REST_KEY || '').trim();
  if (!key) return res.status(200).json({ ok: false, status: 'NO_KEY' });
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    // s_name·e_name 은 카카오맵 길찾기 링크(url)에 출발·도착 이름으로 나온다
    const en = String(req.query.en || '').replace(/[,/]/g, ' ').slice(0, 40) || '도착';
    const qs = new URLSearchParams({ start_x: sx.toFixed(6), start_y: sy.toFixed(6), end_x: ex.toFixed(6), end_y: ey.toFixed(6), s_name: '우리 집', e_name: en });
    const r = await fetch('https://dapi.kakao.com/v2/routing/walk?' + qs, { headers: { Authorization: 'KakaoAK ' + key }, signal: ctl.signal });
    const out = simplify(await r.json());
    if (out.ok) res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ ok: false, status: 'UPSTREAM_ERROR' });
  } finally { clearTimeout(t); }
};
