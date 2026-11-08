// 임시 진단용 (확인 후 삭제)
module.exports = async (req, res) => {
  const q = '[out:json][timeout:10];node(around:300,37.481,126.928)[amenity=cafe];out 5;';
  const variants = [
    ['de POST ua', 'https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app)', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }],
    ['de GET ua', 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), { headers: { 'User-Agent': 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app)' } }],
    ['de GET noua', 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), {}],
    ['de GET browserish', 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; jachwi-navi/0.2; +https://jachwi-navi.vercel.app)', 'Accept': '*/*', 'Referer': 'https://jachwi-navi.vercel.app/' } }],
    ['fr GET', 'https://overpass.openstreetmap.fr/api/interpreter?data=' + encodeURIComponent(q), { headers: { 'User-Agent': 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app)' } }],
    ['coffee GET', 'https://overpass.private.coffee/api/interpreter?data=' + encodeURIComponent(q), { headers: { 'User-Agent': 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app)' } }],
    ['mailru GET', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=' + encodeURIComponent(q), { headers: { 'User-Agent': 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app)' } }],
    ['nominatim', 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=kr&limit=1&q=' + encodeURIComponent('신림역'), { headers: { 'User-Agent': 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app)' } }]
  ];
  const out = await Promise.all(variants.map(async ([name, url, init]) => {
    const t0 = Date.now(); const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 12000);
    try { const r = await fetch(url, Object.assign({ signal: ctl.signal }, init)); const txt = await r.text(); return { name, status: r.status, ms: Date.now() - t0, body: txt.slice(0, 160) }; }
    catch (e) { return { name, error: String(e && e.name || e), ms: Date.now() - t0 }; } finally { clearTimeout(tm); }
  }));
  res.status(200).json(out);
};
