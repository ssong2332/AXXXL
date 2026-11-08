// 임시 진단용 (확인 후 삭제)
module.exports = async (req, res) => {
  const q = '[out:json][timeout:10];node(around:300,37.481,126.928)[amenity=cafe];out 5;';
  const UA = { 'User-Agent': 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app)' };
  const variants = [
    ['nchc GET', 'https://overpass.nchc.org.tw/api/interpreter?data=' + encodeURIComponent(q), { headers: UA }],
    ['osmch GET', 'https://overpass.osm.ch/api/interpreter?data=' + encodeURIComponent(q), { headers: UA }],
    ['z.overpass GET', 'https://z.overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), { headers: UA }],
    ['lz4.overpass GET', 'https://lz4.overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), { headers: UA }],
    ['photon reverse tag', 'https://photon.komoot.io/reverse?lat=37.481&lon=126.928&radius=0.8&limit=20&osm_tag=amenity:cafe', { headers: UA }],
    ['photon search', 'https://photon.komoot.io/api/?q=%EC%B9%B4%ED%8E%98&lat=37.481&lon=126.928&limit=10&osm_tag=amenity:cafe&location_bias_scale=0.9&zoom=16', { headers: UA }],
    ['nominatim bounded', 'https://nominatim.openstreetmap.org/search?format=jsonv2&q=%5Bcafe%5D&viewbox=126.918,37.488,126.938,37.474&bounded=1&limit=20', { headers: UA }]
  ];

  const out = await Promise.all(variants.map(async ([name, url, init]) => {
    const t0 = Date.now(); const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 12000);
    try { const r = await fetch(url, Object.assign({ signal: ctl.signal }, init)); const txt = await r.text(); return { name, status: r.status, ms: Date.now() - t0, body: txt.slice(0, 160) }; }
    catch (e) { return { name, error: String(e && e.name || e), ms: Date.now() - t0 }; } finally { clearTimeout(tm); }
  }));
  res.status(200).json(out);
};
