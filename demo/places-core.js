/*
 * 자취 계약 내비 · 주변 장소 공용 규칙
 * 서버(/api/places)와 브라우저(서버가 실패했을 때 직접 요청) 양쪽에서 같은 분류 규칙을 쓴다.
 * 데이터: OpenStreetMap 기여자 (ODbL), Photon 검색 API (komoot)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JachwiPlaces = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SUB = {
    cafe: '카페', restaurant: '식당', fast_food: '분식·패스트푸드', food_court: '푸드코트', pharmacy: '약국', hospital: '병원', clinic: '의원', doctors: '의원', dentist: '치과',
    library: '도서관', police: '경찰', townhall: '행정복지센터·관공서', community_centre: '주민 시설', post_office: '우체국', convenience: '편의점', supermarket: '마트',
    laundry: '빨래방·세탁소', dry_cleaning: '세탁소', variety_store: '생활용품점', department_store: '백화점', mall: '쇼핑몰', marketplace: '시장', fitness_centre: '헬스장',
    sports_centre: '체육시설', swimming_pool: '수영장', park: '공원', bus_stop: '버스정류장', station: '역', studycafe: '스터디카페'
  };
  // 공개 서버 부담을 줄이려고 4묶음으로만 나눠 요청한다
  var GROUPS = [
    ['amenity:restaurant', 'amenity:fast_food', 'amenity:cafe'],
    ['amenity:pharmacy', 'amenity:hospital', 'amenity:clinic', 'amenity:doctors', 'amenity:dentist', 'amenity:police', 'amenity:townhall', 'amenity:community_centre', 'amenity:post_office', 'amenity:library'],
    ['shop:convenience', 'shop:supermarket', 'shop:laundry', 'shop:dry_cleaning', 'shop:variety_store', 'shop:department_store', 'shop:mall', 'amenity:marketplace', 'leisure:park', 'leisure:fitness_centre', 'leisure:sports_centre', 'leisure:swimming_pool'],
    ['railway:station', 'highway:bus_stop']
  ];
  function osmCat(t) {
    var a = t.amenity, s = t.shop, l = t.leisure, name = t['name:ko'] || t.name || '';
    if (a === 'cafe') return /스터디|study/i.test(name) ? ['study', 'studycafe'] : ['cafe', 'cafe'];
    if (a === 'restaurant' || a === 'fast_food' || a === 'food_court') return ['food', a];
    if (['pharmacy', 'hospital', 'clinic', 'doctors', 'dentist'].indexOf(a) >= 0) return ['medical', a];
    if (a === 'library') return ['study', a];
    if (a === 'police') return ['safety', a];
    if (['townhall', 'community_centre', 'post_office'].indexOf(a) >= 0) return ['public', a];
    if (a === 'marketplace') return ['life', a];
    if (['convenience', 'supermarket', 'laundry', 'dry_cleaning', 'variety_store', 'department_store', 'mall'].indexOf(s) >= 0) return ['life', s];
    if (['fitness_centre', 'sports_centre', 'swimming_pool'].indexOf(l) >= 0) return ['gym', l];
    if (l === 'park') return ['park', 'park'];
    if (t.highway === 'bus_stop') return ['transit', 'bus_stop'];
    if (t.railway === 'station' || t.station === 'subway') return ['transit', 'station'];
    return null;
  }
  function dist(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }
  function photonUrl(c, r, g, limit) {
    return 'https://photon.komoot.io/reverse?lat=' + c.lat + '&lon=' + c.lng + '&radius=' + (r / 1000) + '&limit=' + (limit || 80) + '&' + g.map(function (t) { return 'osm_tag=' + encodeURIComponent(t); }).join('&');
  }
  function fromPhoton(features) {
    var out = [];
    (features || []).forEach(function (f) {
      var pr = f.properties || {}, co = (f.geometry && f.geometry.coordinates) || [], t = { name: pr.name };
      t[pr.osm_key] = pr.osm_value;
      var cc = osmCat(t);
      if (!cc || !pr.name || co.length < 2) return;
      out.push({ id: 'osm-' + String(pr.osm_type || 'n').toLowerCase()[0] + pr.osm_id, src: 'osm', cat: cc[0], sub: SUB[cc[1]] || cc[1], name: String(pr.name).slice(0, 40), lat: +(+co[1]).toFixed(6), lng: +(+co[0]).toFixed(6), addr: [pr.street, pr.housenumber].filter(Boolean).join(' ').slice(0, 60), hours: '' });
    });
    return out;
  }
  // 같은 이름·분류가 60m 안에 또 있으면 하나만, 가까운 순서로
  function finish(items, c, r) {
    var seen = [];
    return items.map(function (p) { p.m = dist(c, p); return p; }).filter(function (p) { return p.m <= r; }).sort(function (a, b) { return a.m - b.m; })
      .filter(function (p) { if (seen.some(function (q) { return q.cat === p.cat && q.name === p.name && dist(p, q) < 60; })) return false; seen.push(p); return true; })
      .slice(0, 400);
  }
  return { SUB: SUB, GROUPS: GROUPS, osmCat: osmCat, dist: dist, photonUrl: photonUrl, fromPhoton: fromPhoton, finish: finish };
});
