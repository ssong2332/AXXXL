/* 자취 계약 내비 — 승인된 규칙 (데이터만, 계산은 engine.js)
 * 시연판 값: 지원 사업 금액·조건은 예시 공고 기준이며 원문 대조 전이다 (demo/README.md "시연판의 한계").
 * 필수 ③(공고 검수)에서 승인된 규칙이 나오면 이 파일의 programs를 그 결과로 바꾼다.
 * 브라우저: window.JachwiRules / Node: require('./rules.js')
 */
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.JachwiRules = data;
})(typeof self !== 'undefined' ? self : this, {
  basis: '2026.10.28',
  seoulGu: ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],

  // 주택임대차(전월세) 신고: 보증금 6천만 원 초과 또는 월세 30만 원 초과, 계약일부터 30일 이내
  report: {
    depositOver: 6000, rentOver: 30, days: 30,
    src: '부동산 거래신고 등에 관한 법률 제6조의2', url: 'https://www.law.go.kr/법령/부동산거래신고등에관한법률', basis: '2026.10.28'
  },
  // 전입신고: 새 거주지로 옮긴 날부터 14일 이내
  movein: { days: 14, src: '주민등록법 제16조', url: 'https://www.law.go.kr/법령/주민등록법', basis: '2026.10.28' },
  // 갱신 거절·조건 변경 통지: 임차인은 만료 2개월 전까지
  renew: { monthsBefore: 2, src: '주택임대차보호법 제6조', url: 'https://www.law.go.kr/법령/주택임대차보호법', basis: '2026.10.28' },

  // status: open(모집 중) | closed(마감) | waiting(다음 공고 대기)
  // conds.type: age{min,max} | income{max} | deposit{max} | rent{max} | homeless | dup
  programs: [
    {
      id: 'rent', name: '서울시 청년월세 지원', org: '서울특별시', amountText: '월 최대 20만 원 · 최대 12개월',
      status: 'waiting', firstCome: false, select: '소득 낮은 순 선정', channel: '서울주거포털 온라인',
      url: 'https://housing.seoul.go.kr', basis: '2026.10.28',
      docs: ['임대차계약서 (확정일자 포함)', '최근 3개월 월세 이체 내역', '본인 명의 통장 사본', '주민등록등본', '건강보험료 납부확인서'],
      conds: [
        { type: 'age', min: 19, max: 39, label: '만 19~39세' },
        { type: 'income', max: 150, label: '기준 중위소득 150% 이하' },
        { type: 'deposit', max: 8000, label: '보증금 8,000만 원 이하' },
        { type: 'rent', max: 60, label: '월세 60만 원 이하' },
        { type: 'homeless', label: '무주택' },
        { type: 'dup', label: '국토교통부 청년월세 특별지원 등 유사 지원을 받고 있지 않음' }
      ]
    },
    {
      id: 'move', name: '청년 부동산 중개보수·이사비 지원', org: '서울특별시', amountText: '실비 · 최대 40만 원',
      status: 'open', firstCome: true, select: '선착순', channel: '서울주거포털 온라인',
      url: 'https://housing.seoul.go.kr', basis: '2026.10.28',
      docs: ['임대차계약서', '중개보수 영수증', '이사비 영수증', '주민등록등본'],
      conds: [
        { type: 'age', min: 19, max: 39, label: '만 19~39세' },
        { type: 'income', max: 150, label: '기준 중위소득 150% 이하' },
        { type: 'deposit', max: 20000, label: '임차보증금 2억 원 이하' },
        { type: 'homeless', label: '무주택' }
      ]
    }
  ]
});
