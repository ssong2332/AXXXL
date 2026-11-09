// GET /api/config   화면이 쓰는 공개 설정
//  - KAKAOMAPSDK_KEY 환경변수(카카오 지도 JavaScript 키)가 있으면 내려준다. 없으면 null → 화면은 OpenStreetMap 지도를 쓴다.
//  - JavaScript 키는 원래 브라우저에 보이는 키다. 카카오 콘솔에 등록한 도메인에서만 지도가 열린다.
//  - REST·Admin 키 같은 다른 키는 여기서 내보내지 않는다.
'use strict';

module.exports = (req, res) => {
  const key = String(process.env.KAKAOMAPSDK_KEY || '').trim();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ kakaoMapKey: /^[0-9a-f]{32}$/.test(key) ? key : null });
};
