// GET /api/lh?sido=경기도                        LH 임대주택 공고 중 내 시도에서 지금 공고·접수 중인 것
// GET /api/lh?pan=공고ID&spl=..&ccr=..&ais=..      한 공고의 공급 정보(주택형·임대 조건)
//  - 한국토지주택공사 분양임대공고문 조회, 분양임대공고별 공급정보 조회. 키는 DATA_GO_KR_KEY.
'use strict';

const O = require('./_open.js');
const REGIONS = require('../data/regions.js');
const SIDO = REGIONS.map((r) => r[0]);
const LIVE = /공고중|접수중/;

function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function rowsOf(j, name) { let out = []; (Array.isArray(j) ? j : []).forEach((d) => { if (d && Array.isArray(d[name])) out = out.concat(d[name]); }); return out; }
function lhUrl(u) { return /^https:\/\/apply\.lh\.or\.kr\//.test(String(u || '')) ? u : 'https://apply.lh.or.kr'; }

async function loadList(key) {
  const to = new Date(), from = new Date(Date.now() - 90 * 864e5);
  const j = await O.getJson('https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=' + key + '&PG_SZ=500&PAGE=1&UPP_AIS_TP_CD=06&PAN_ST_DT=' + ymd(from) + '&PAN_ED_DT=' + ymd(to), 20000);
  return rowsOf(j, 'dsList').filter((r) => LIVE.test(r.PAN_SS || '')).map((r) => ({
    id: String(r.PAN_ID || ''), name: String(r.PAN_NM || '').slice(0, 120), type: r.AIS_TP_CD_NM || '', sido: r.CNP_CD_NM || '', state: r.PAN_SS || '',
    posted: String(r.PAN_NT_ST_DT || ''), close: String(r.CLSG_DT || ''), url: lhUrl(r.DTL_URL), spl: r.SPL_INF_TP_CD || '', ccr: r.CCR_CNNT_SYS_DS_CD || '', ais: r.AIS_TP_CD || ''
  }));
}
async function loadSupply(q, key) {
  const j = await O.getJson('https://apis.data.go.kr/B552555/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1?serviceKey=' + key + '&SPL_INF_TP_CD=' + q.spl + '&CCR_CNNT_SYS_DS_CD=' + q.ccr + '&PAN_ID=' + q.pan + '&UPP_AIS_TP_CD=06' + (q.ais ? '&AIS_TP_CD=' + q.ais : ''), 20000);
  // 공고 유형에 따라 dsList01~09 중 하나에 표가 들어 있고, 열 이름은 같은 번호의 ...Nm 에 있다
  let names = {}, rows = [];
  for (let n = 1; n <= 9 && !rows.length; n++) { rows = rowsOf(j, 'dsList0' + n); names = rowsOf(j, 'dsList0' + n + 'Nm')[0] || {}; }
  const ORDER = ['BZDT_NM', 'HTY_NM', 'RSDN_DDO_AR', 'SIL_HSH_CNT', 'LS_GMY', 'MM_RFE', 'ELY_DSU_AMT', 'SIL_AMT'];
  const cols = Object.keys(names).filter((k) => names[k] && rows.some((r) => r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== ''))
    .sort((a, b) => (ORDER.indexOf(a) < 0 ? 99 : ORDER.indexOf(a)) - (ORDER.indexOf(b) < 0 ? 99 : ORDER.indexOf(b))).slice(0, 6);
  return { cols: cols.map((k) => String(names[k])), rows: rows.slice(0, 30).map((r) => cols.map((k) => String(r[k] === null || r[k] === undefined ? '' : r[k]).slice(0, 60))) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = O.portalKey();
  if (!key) return O.send(res, 200, { ok: false, reason: 'nokey' });
  if (O.limited(req, 'lh', 60, 60000)) return O.send(res, 429, { ok: false, error: '잠시 뒤 다시 시도해 주세요.' });
  try {
    if (req.query.pan) {
      const q = { pan: String(req.query.pan), spl: String(req.query.spl || ''), ccr: String(req.query.ccr || ''), ais: String(req.query.ais || '') };
      if (!/^\d{6,20}$/.test(q.pan) || !/^\d{2,3}$/.test(q.spl) || !/^\d{2}$/.test(q.ccr) || !/^\d{0,2}$/.test(q.ais)) return O.send(res, 400, { ok: false, error: '공고를 다시 골라 주세요.' });
      const s = await O.cached('lh:spl:' + q.pan + ':' + q.spl + ':' + q.ccr, 6 * 3600e3, () => loadSupply(q, key));
      return O.send(res, 200, { ok: true, supply: s.value }, 'public, s-maxage=3600');
    }
    const sido = String(req.query.sido || '');
    if (SIDO.indexOf(sido) < 0) return O.send(res, 400, { ok: false, error: '지역을 다시 골라 주세요.' });
    const c = await O.cached('lh:list', 3 * 3600e3, () => loadList(key));
    return O.send(res, 200, { ok: true, sido, items: c.value.filter((x) => x.sido === sido), elsewhere: c.value.filter((x) => x.sido !== sido).length, fetchedAt: O.iso(c.at), stale: c.stale, source: 'LH 분양임대공고 (한국토지주택공사)' }, 'public, s-maxage=1800');
  } catch (e) {
    return O.send(res, 502, { ok: false, reason: 'upstream', error: 'LH 공고를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.' });
  }
};
