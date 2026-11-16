// GET /api/config   화면이 쓰는 공개 설정
//  - KAKAOMAPSDK_KEY 환경변수(카카오 지도 JavaScript 키)가 있으면 내려준다. 없으면 null → 화면은 OpenStreetMap 지도를 쓴다.
//  - JavaScript 키는 원래 브라우저에 보이는 키다. 카카오 콘솔에 등록한 도메인에서만 지도가 열린다.
//  - SUPABASE_URL·SUPABASE_PUBLISHABLE_KEY가 있으면 로그인(선택)을 켠다. 없으면 null → 로그인 버튼이 안 보인다.
//    publishable(anon) 키는 브라우저에 보이는 키다. 남의 기록은 DB 권한(RLS)이 막는다.
//  - REST·Admin 키, Supabase service_role·secret 키 같은 다른 키는 여기서 내보내지 않는다.
'use strict';

function supabase(env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)) return null;
  // sb_publishable_… 또는 예전 anon JWT(role이 anon인 것만)
  let ok = /^sb_publishable_[\w-]{20,}$/.test(key);
  if (!ok && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) {
    try { ok = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; } catch (e) { ok = false; }
  }
  return ok ? { url, key } : null;
}

module.exports = (req, res) => {
  const key = String(process.env.KAKAOMAPSDK_KEY || '').trim();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ kakaoMapKey: /^[0-9a-f]{32}$/.test(key) ? key : null, supabase: supabase(process.env) });
};
module.exports.supabase = supabase;
