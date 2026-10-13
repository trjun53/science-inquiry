// 2022 개정 과학과 교육과정 기반 단원 목록
// - 초등: 성취기준(js/standards.js)과 교과서(지도서)별 단원·차시 데이터(js/textbooks.js)를 사용
//   · 영역 번호·학기 배치는 교과서 데이터와 일치 (학년별 앞 4개 영역 = 1학기, 뒤 4개 영역 = 2학기)
//   · 추천 센서·센서 탐구 예시는 실험 템플릿(js/experiments.js)을 따름. 학년 범위를 고려하되,
//     산과 염기의 pH 센서와 전기의 이용의 전압·전류 센서는 수업 요구에 따라 허용함
// - 중·고: 대표 단원명 (검정 교과서마다 단원명·학기 배치가 다를 수 있어 '직접 입력'도 지원)

const FIELDS = {
  phy: { name: '물리학', color: '#2563eb' },
  chem: { name: '화학', color: '#db2777' },
  bio: { name: '생명과학', color: '#059669' },
  earth: { name: '지구과학', color: '#b45309' },
  conv: { name: '융합·교양', color: '#7c3aed' },
};

// [성취기준 영역, 영역 번호, 단원명, 분야, 추천 센서, 센서 탐구 예시 질문(해당 학년 범위 안)]
const ELEM_UNITS = [
  ['4과01', 1, '힘과 우리 생활', 'phy', ['force'], [
    '무거운 물체와 가벼운 물체를 끌어당길 때 드는 힘의 크기는 어떻게 다를까?',
    '지레를 사용할 때와 직접 들 때, 물체를 들어 올리는 데 드는 힘의 크기는 어떻게 다를까?',
    '빗면의 기울기에 따라 물체를 끌어 올리는 데 드는 힘의 크기는 어떻게 달라질까?']],
  ['4과02', 2, '동물의 생활', 'bio', [], []],
  ['4과03', 3, '식물의 생활', 'bio', [], []],
  ['4과04', 4, '생물의 한살이', 'bio', ['temp', 'light'], [
    '따뜻한 곳과 차가운 곳 중 어디에 둔 씨가 더 잘 싹틀까? (두 곳의 온도를 센서로 확인)',
    '햇빛을 받는 곳과 받지 못하는 곳(빛 센서로 확인)에서 식물이 자라는 정도는 어떻게 다를까?']],
  ['4과05', 5, '물체와 물질', 'chem', [], []],
  ['4과06', 6, '지구와 바다', 'earth', [], []],
  ['4과07', 7, '소리의 성질', 'phy', ['sound'], [
    '소리굽쇠를 세게 칠 때와 약하게 칠 때 소리의 크기는 어떻게 다를까?',
    '소리가 전달되는 물질(공기·물·나무)에 따라 들리는 소리의 크기는 어떻게 다를까?',
    '소리를 막는 물질(스펀지·천·종이)에 따라 소리의 크기는 얼마나 줄어들까?']],
  ['4과08', 8, '감염병과 건강한 생활', 'conv', [], []],
  ['4과09', 9, '자석의 이용', 'phy', ['magnetic'], [
    '막대자석의 어느 부분에서 자석의 힘이 가장 셀까?',
    '자석에서 멀어질수록 자석의 힘의 세기는 어떻게 달라질까?']],
  ['4과10', 10, '물의 상태 변화', 'chem', ['force'], [
    '물이 얼기 전과 언 뒤의 무게는 어떻게 다를까?',
    '얼음이 녹기 전과 녹은 뒤의 무게는 어떻게 다를까?']],
  ['4과11', 11, '땅의 변화', 'earth', [], []],
  ['4과12', 12, '다양한 생물과 우리 생활', 'bio', [], []],
  ['4과13', 13, '밤하늘 관찰', 'earth', [], []],
  ['4과14', 14, '생물과 환경', 'bio', ['light'], [
    '장소(나무 그늘·운동장·화단)에 따라 비생물 요소인 햇빛의 세기는 어떻게 다를까?']],
  ['4과15', 15, '여러 가지 기체', 'chem', ['pressure', 'force', 'temp'], [
    '주사기 피스톤을 누를수록 주사기 속 공기의 압력은 어떻게 달라질까?',
    '공기를 넣기 전과 넣은 뒤 공(페트병)의 무게는 어떻게 다를까?',
    '물의 온도(센서로 측정)에 따라 플라스틱 병에 씌운 고무풍선의 크기는 어떻게 달라질까?']],
  ['4과16', 16, '기후변화와 우리 생활', 'conv', [], []],
  ['6과01', 1, '지층과 화석', 'earth', [], []],
  ['6과02', 2, '빛의 성질', 'phy', ['light'], [
    '빛이 통과하는 물질(유리·셀로판지·종이)에 따라 통과한 빛의 세기는 어떻게 다를까?',
    '볼록 렌즈로 햇빛을 모으면 빛이 모인 곳의 밝기는 어떻게 달라질까?']],
  ['6과03', 3, '용해와 용액', 'chem', ['temp', 'force'], [
    '물의 온도에 따라 물에 녹는 백반의 양은 어떻게 달라질까?',
    '설탕이 물에 녹기 전과 녹은 뒤의 무게는 어떻게 다를까?']],
  ['6과04', 4, '우리 몸의 구조와 기능', 'bio', ['co2'], [
    '들이마시는 공기와 내쉬는 숨 속 이산화 탄소 농도는 어떻게 다를까?',
    '운동하기 전과 운동한 뒤에 내쉬는 숨 속 이산화 탄소 농도는 어떻게 다를까?']],
  ['6과05', 5, '혼합물의 분리', 'chem', [], []],
  ['6과06', 6, '날씨와 우리 생활', 'earth', ['temp', 'humidity', 'pressure'], [
    '하루 동안 시간에 따라 기온과 습도는 어떻게 변할까?',
    '차가운 컵 표면에 이슬이 맺힐 때 컵 주변의 온도와 습도는 어떻게 변할까?']],
  ['6과07', 7, '열과 우리 생활', 'phy', ['temp'], [
    '온도가 다른 두 물을 맞닿게 하면 시간에 따라 두 물의 온도는 어떻게 변할까?',
    '컵을 감싸는 물질(솜·알루미늄 포일·뽁뽁이)에 따라 따뜻한 물이 식는 정도는 어떻게 다를까?']],
  ['6과08', 8, '자원과 에너지', 'conv', [], []],
  ['6과09', 9, '산과 염기', 'chem', [], []],
  ['6과10', 10, '물체의 운동', 'phy', ['motion'], [
    '빗면의 기울기에 따라 굴러 내려가는 수레의 속력은 어떻게 달라질까?',
    '공을 놓는 높이에 따라 굴러 내려온 공의 속력은 어떻게 달라질까?']],
  ['6과11', 11, '식물의 구조와 기능', 'bio', ['humidity', 'co2'], [
    '잎이 있는 식물과 잎을 딴 식물에 비닐을 씌우면 비닐 속 습도 변화는 어떻게 다를까?',
    '빛을 받은 식물이 든 용기 속 이산화 탄소 농도는 시간에 따라 어떻게 변할까?']],
  ['6과12', 12, '지구의 운동', 'earth', [], []],
  ['6과13', 13, '계절의 변화', 'earth', ['light', 'temp'], [
    '전등을 비추는 각도(태양 고도)에 따라 같은 넓이가 받는 빛의 세기는 어떻게 달라질까?',
    '하루 동안 태양 고도가 달라짐에 따라 기온은 어떻게 변할까?']],
  ['6과14', 14, '물질의 연소', 'chem', ['o2', 'co2', 'temp'], [
    '초가 타는 동안 집기병 속 산소와 이산화 탄소 농도는 어떻게 변할까?',
    '집기병의 크기에 따라 초가 타는 시간과 집기병 속 산소 농도 변화는 어떻게 달라질까?']],
  ['6과15', 15, '전기의 이용', 'phy', ['light', 'magnetic'], [
    '전지 한 개를 연결할 때와 두 개를 직렬연결할 때 전구의 밝기는 어떻게 다를까?',
    '전지의 개수에 따라 전자석의 세기는 어떻게 달라질까?']],
  ['6과16', 16, '과학과 나의 진로', 'conv', [], []],
].map(([std, no, name, field, sensors, examples]) => ({ std, no, name, field, sensors, examples }));

// 단원별 추천 센서와 센서 탐구 예시는 실험 템플릿(js/experiments.js)에서 가져옴
ELEM_UNITS.forEach(u => {
  const ex = experimentsFor(u.std);
  u.sensors = [...new Set(ex.flatMap(e => e.sensors))];
  u.examples = ex.map(e => e.question);
});

// 차시명과 맞는 실험 템플릿의 센서를 차시의 센서로 표시
function lessonSensors(std, title) {
  return [...new Set(experimentsForLesson(std, title).flatMap(e => e.sensors))];
}
// 차시명과 가장 가까운 성취기준을 찾음 (낱말 겹침 정도)
// 낱말 겹침만으로는 동점이 나거나 헷갈리는 차시를 바로잡는 핵심어 (그 단원의 성취기준일 때만 적용)
const STD_HINTS = [
  [/단열/, '6과07-04'],
  [/질병/, '6과04-03'],
  [/(소화|순환|호흡|배설) ?기관/, '6과04-02'],
  [/생태계|피해/, '6과14-04'],
  [/생성되는 물질|생기는 물질|연소 후|연소 전과 후/, '6과14-03'],
  [/갯벌|밀물|썰물|^(?!.*지형).*바닷물의 높이/, '4과06-03'],
  [/물 부족|물을 얻/, '4과10-03'],
  [/진로|직업/, '6과16-02'],
  [/불을 붙|발화/, '6과14-02'],
];
// 1) 핵심어 → 2) 낱말 겹침(2개 이상) → 3) 연결된 센서 실험의 성취기준 → 4) 조사를 뗀 낱말로 다시 비교
function matchStandard(std, title) {
  const hint = STD_HINTS.find(([re, code]) => re.test(title) && standardsFor(std).some(s => s.code === code));
  if (hint) return hint[1];
  const byWords = matchStandardByWords(std, title);
  if (byWords) return byWords;
  const exp = typeof experimentsForLesson === 'function' ? experimentsForLesson(std, title)[0] : null;
  const byExp = exp ? experimentStandard(exp) : '';
  if (byExp) return byExp;
  return matchStandardByStems(std, title) || fallbackStandard(std, title);
}

// 위 방법으로 찾지 못한 차시만: 단원별 주제어로 성취기준을 정함 (이미 연결된 차시에는 쓰지 않음)
const STD_FALLBACK = [
  [/움직여|밀거나|당기/, '4과01-01'], [/무게|무거운|오르락/, '4과01-02'],
  [/주변.*동물|동물.*찾/, '4과02-01'], [/(사막|극지방|높은 산|물에|땅에|하늘|강|바다).*(동물|사는)/, '4과02-02'],
  [/주변.*식물/, '4과03-01'], [/(사막|높은 산|들이나|강이나|연못|물에).*(식물|사는)|부레옥잠|선인장|식물원/, '4과03-02'],
  [/배추흰나비|사육/, '4과04-01'], [/식물의 한살이|한해살이|여러해살이/, '4과04-03'],
  [/물체|재료/, '4과05-01'],
  [/공기/, '4과06-01'],
  [/소리를 내/, '4과07-01'],
  [/경험/, '4과08-01'], [/걸리는지|감염 과정/, '4과08-02'], [/마스크|예방/, '4과08-03'],
  [/붙을까|붙는/, '4과09-01'], [/나침반|가리키는|자석과 자석|고리 자석/, '4과09-02'],
  [/물 발자국|물이 부족|물의 중요성/, '4과10-03'], [/사라진 물|증발|물방울|차가운 물체/, '4과10-02'],
  [/현무암|화강암/, '4과11-03'], [/화산/, '4과11-02'], [/흙 언덕|깎이|쌓이/, '4과11-01'],
  [/버섯|곰팡이|해캄|짚신벌레|세균/, '4과12-01'],
  [/별과 행성|별/, '4과13-03'],
  [/생태계|양분을 얻/, '4과14-01'],
  [/해수면|피해/, '4과16-02'], [/기온|기후/, '4과16-01'],
  [/지층/, '6과01-01'],
  [/빛이 없/, '6과02-01'],
  [/노폐물|배설/, '6과04-02'],
  [/물에 넣/, '6과03-01'],
  [/소금과 모래|용해되는/, '6과05-02'], [/혼합물/, '6과05-01'],
  [/바람/, '6과06-03'], [/날씨|기상/, '6과06-01'],
  [/꽃|뿌리|줄기/, '6과11-02'],
  [/해시계/, '6과13-01'],
  [/섞/, '6과14-01'], [/온도가 연소/, '6과14-02'], [/이산화 탄소/, '6과14-04'],
  [/전기가 잘 흐르/, '6과15-01'], [/전자석/, '6과15-03'],
];
function fallbackStandard(std, title) {
  const codes = standardsFor(std).map(s => s.code);
  const hit = STD_FALLBACK.find(([re, code]) => codes.includes(code) && re.test(title));
  return hit ? hit[1] : '';
}

function matchStandardByWords(std, title) {
  const words = s => new Set((s.match(/[가-힣]{2,}/g) || []).map(w => w.slice(0, 2)));
  const t = words(title);
  let best = null, bestScore = 0;
  for (const s of standardsFor(std)) {
    const w = words(s.text);
    let score = 0;
    t.forEach(x => { if (w.has(x)) score++; });
    if (score > bestScore) { bestScore = score; best = s.code; }
  }
  return bestScore >= 2 ? best : '';
}

// 센서 실험의 성취기준: 그 실험이 연결된 여러 교과서 차시들이 가장 많이 가리키는 성취기준
const expStdCache = {};
function experimentStandard(exp) {
  if (exp.id in expStdCache) return expStdCache[exp.id];
  const count = {};
  if (typeof TEXTBOOK_UNITS !== 'undefined') {
    TEXTBOOK_UNITS.filter(u => u[5] === exp.std).forEach(u => u[7].forEach(t => {
      const e = experimentsForLesson(u[5], t)[0];
      if (!e || e.id !== exp.id) return;
      const hint = STD_HINTS.find(([re, code]) => re.test(t) && code.startsWith(exp.std));
      const code = hint ? hint[1] : matchStandardByWords(u[5], t);
      if (code) count[code] = (count[code] || 0) + 1;
    }));
  }
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return (expStdCache[exp.id] = best ? best[0] : '');
}

// '빛은·빛을', '물에는' 같은 조사를 떼고, 어느 차시에나 나오는 낱말('알아보기', '설명하기' 등)은 빼고 비교
const STD_PARTICLE = /(에서는|에서|에는|에게|으로|부터|까지|이나|이고|이며|처럼|보다|하고|은|는|이|가|을|를|의|에|과|와|도|로|만)$/;
const STD_STOP = new Set(['알아', '보기', '설명', '하기', '알기', '우리', '여러', '가지', '어떻', '어떤', '무엇', '있음', '있다', '있는', '있어', '통해', '대해', '이야', '다른', '같은', '그리', '느끼']);
function stdStems(s) {
  const out = new Set();
  (s.match(/[가-힣]+/g) || []).forEach(w => {
    const tok = (w.length > 1 ? w.replace(STD_PARTICLE, '') : w).slice(0, 2);
    if (tok && !STD_STOP.has(tok)) out.add(tok);
  });
  return out;
}
function matchStandardByStems(std, title) {
  const t = stdStems(title);
  const scored = standardsFor(std).map(s => {
    const w = stdStems(s.text);
    let n = 0;
    t.forEach(x => { if (w.has(x)) n++; });
    return { code: s.code, n };
  });
  const best = scored.reduce((a, b) => (b.n > a.n ? b : a), { code: '', n: 0 });
  if (best.n >= 2) return best.code;
  // 핵심어가 하나만 겹쳐도 그 성취기준 하나와만 겹치면 연결
  return best.n === 1 && scored.filter(s => s.n === 1).length === 1 ? best.code : '';
}

// 성취기준 자료가 없는 단원(중·고, 직접 입력)에 쓰는 탐구 수업 기본 차시 구성
const DEFAULT_LESSONS = ['단원 도입과 탐구 질문 만들기', '핵심 개념 알아보기', '디지털 센서 탐구 실험 설계하기',
  '디지털 센서로 측정하기', '측정 결과 분석하고 결론 내리기', '탐구 결과 발표와 단원 정리'];

// 초등 교과서 데이터: 학년·학기에 해당하는 출판사 목록과 단원
const gradeNum = g => Number(String(g).replace(/[^0-9]/g, ''));
function publishersFor(grade, semester) {
  if (typeof TEXTBOOK_UNITS === 'undefined') return [];
  const g = gradeNum(grade), s = gradeNum(semester);
  return [...new Set(TEXTBOOK_UNITS.filter(r => r[0] === g && r[1] === s).map(r => r[2]))];
}
function textbookUnits(grade, semester, pub) {
  const g = gradeNum(grade), s = gradeNum(semester);
  return TEXTBOOK_UNITS.filter(r => r[0] === g && r[1] === s && r[2] === pub)
    .map(r => ({ order: r[3], name: r[4], std: r[5], kind: r[6], items: r[7] }))
    .map(u => ({ ...u, info: ELEM_UNITS.find(e => e.std === u.std) }))
    .sort((a, b) => (a.order || a.info.no) - (b.order || b.info.no));
}
function textbookUnit(grade, semester, pub, std) {
  return textbookUnits(grade, semester, pub).find(u => u.std === std) || null;
}

// 차시 목록: 초등은 선택한 교과서 지도서 기준, 그 밖에는 기본 구성
function lessonsFor(tb) {
  if (tb) {
    return tb.items
      .filter(t => !/^([^,]{1,12}, ){2,}[^,]{1,12}$/.test(t)) // '용해, 용액, 용매…' 같은 낱말 나열 제외
      .map((title, i) => ({ no: i + 1, title, std: matchStandard(tb.std, title), sensors: lessonSensors(tb.std, title),
        exp: (experimentsForLesson(tb.std, title)[0] || {}).id || '' }));
  }
  return DEFAULT_LESSONS.map((title, i) => ({ no: i + 1, title, std: '', sensors: [], exp: '' }));
}

function elemSemesters(prefix, from, to) {
  const units = ELEM_UNITS.filter(u => u.std.startsWith(prefix) && u.no >= from && u.no <= to);
  return [{ group: '과학', units }];
}

const CURRICULUM = {
  '초등학교': {
    '3학년': { '1학기': elemSemesters('4과', 1, 4), '2학기': elemSemesters('4과', 5, 8) },
    '4학년': { '1학기': elemSemesters('4과', 9, 12), '2학기': elemSemesters('4과', 13, 16) },
    '5학년': { '1학기': elemSemesters('6과', 1, 4), '2학기': elemSemesters('6과', 5, 8) },
    '6학년': { '1학기': elemSemesters('6과', 9, 12), '2학기': elemSemesters('6과', 13, 16) },
  },
  '중학교': {
    '1학년': {
      '1학기': [{ group: '과학', units: ['과학과 인류의 지속가능한 삶', '생물의 구성과 다양성', '열', '물질의 상태 변화'] }],
      '2학기': [{ group: '과학', units: ['힘의 작용', '기체의 성질', '태양계'] }],
    },
    '2학년': {
      '1학기': [{ group: '과학', units: ['물질의 구성', '전기와 자기', '식물과 에너지', '지권의 변화'] }],
      '2학기': [{ group: '과학', units: ['동물과 에너지', '물질의 특성', '빛과 파동', '수권과 해수의 순환'] }],
    },
    '3학년': {
      '1학기': [{ group: '과학', units: ['대기와 날씨', '화학 반응의 규칙과 에너지 변화', '자극과 반응', '운동과 에너지'] }],
      '2학기': [{ group: '과학', units: ['생식과 유전', '에너지 전환과 보존', '별과 우주', '과학기술과 인류 문명', '재해·재난과 안전'] }],
    },
  },
  '고등학교': {
    '1학년': {
      '1학기': [
        { group: '통합과학1', units: ['과학의 기초', '물질과 규칙성', '시스템과 상호작용'] },
        { group: '과학탐구실험1', units: ['과학의 본성과 역사 속의 과학 탐구', '생활 속의 과학 탐구'] },
      ],
      '2학기': [
        { group: '통합과학2', units: ['변화와 다양성', '환경과 에너지', '과학과 미래 사회'] },
        { group: '과학탐구실험2', units: ['생활 속의 과학 탐구', '미래 사회 문제 해결 과학 탐구'] },
      ],
    },
    '2학년': {
      '1학기': [
        { group: '물리학', units: ['힘과 에너지', '전기와 자기', '빛과 물질'] },
        { group: '화학', units: ['화학의 언어', '물질의 구조와 성질', '화학 평형', '역동적인 화학 반응'] },
        { group: '생명과학', units: ['생명 시스템의 구성', '항상성과 몸의 기능', '생물의 다양성과 생태계'] },
        { group: '지구과학', units: ['지구의 형성과 역동성', '지구 시스템의 상호작용', '우주의 구조와 진화'] },
      ],
      '2학기': [
        { group: '역학과 에너지', units: ['시공간과 운동', '열과 에너지', '탄성파와 소리'] },
        { group: '물질과 에너지', units: ['물질의 상태', '용액', '화학 변화와 에너지'] },
        { group: '세포와 물질대사', units: ['세포의 구조와 기능', '효소와 물질대사', '세포 호흡과 광합성'] },
        { group: '지구시스템과학', units: ['지구시스템의 구성', '지권의 변동', '해양과 대기의 상호작용'] },
      ],
    },
    '3학년': {
      '1학기': [
        { group: '전자기와 양자', units: ['전자기장', '빛과 정보통신', '양자와 미시세계'] },
        { group: '화학 반응의 세계', units: ['산·염기 반응', '산화·환원 반응', '반응 속도'] },
        { group: '생물의 유전', units: ['유전자와 형질 발현', '유전자 기술과 활용'] },
        { group: '행성우주과학', units: ['천체 관측', '태양계 천체', '우리은하와 우주'] },
      ],
      '2학기': [
        { group: '기후변화와 환경생태', units: ['기후변화와 지구 환경', '생태계와 환경 변화'] },
        { group: '융합과학 탐구', units: ['융합과학 탐구의 이해', '융합과학 탐구 프로젝트'] },
        { group: '과학의 역사와 문화', units: ['과학의 발전과 문화', '현대 과학과 사회'] },
      ],
    },
  },
};

// 측정 가능한 물리량(센서 종류)
const SENSOR_TYPES = {
  temp:         { name: '온도',           unit: '°C' },
  voltage:      { name: '전압',           unit: 'V' },
  current:      { name: '전류',           unit: 'A' },
  force:        { name: '힘',             unit: 'N' },
  motion:       { name: '위치(운동)',     unit: 'm' },
  accel:        { name: '가속도',         unit: 'm/s²' },
  ph:           { name: 'pH',             unit: 'pH' },
  co2:          { name: '이산화 탄소',    unit: 'ppm' },
  o2:           { name: '산소',           unit: '%' },
  light:        { name: '빛의 세기',      unit: 'lx' },
  sound:        { name: '소리 크기',      unit: 'dB' },
  pressure:     { name: '기체 압력',      unit: 'kPa' },
  humidity:     { name: '습도',           unit: '%' },
  magnetic:     { name: '자기장',         unit: 'mT' },
  conductivity: { name: '전기 전도도',    unit: 'µS/cm' },
  heartrate:    { name: '심박수',         unit: 'bpm' },
};

// 중·고 단원명 키워드 → 추천 센서
const SENSOR_RULES = [
  [/온도|열|상태 변화|물의 상태|연소|에너지 전환|열과 에너지|화학 변화와 에너지|반응열/, ['temp']],
  [/전기|자기|전자기|회로/, ['voltage', 'current', 'magnetic']],
  [/자석/, ['magnetic']],
  [/힘|무게|운동|역학|시공간/, ['force', 'motion', 'accel']],
  [/산과 염기|산·염기|용액|용해|화학 평형|화학 반응|산화|물질의 특성|물질과 규칙성/, ['ph', 'conductivity', 'temp']],
  [/식물|광합성|호흡|생물과 환경|생태|물질대사|동물과 에너지|생명 시스템|기후/, ['co2', 'o2', 'light', 'temp']],
  [/기체|대기|날씨|기압/, ['pressure', 'temp', 'humidity']],
  [/빛|그림자|렌즈|거울|태양|계절|천체|별/, ['light', 'temp']],
  [/소리|파동|탄성파/, ['sound']],
  [/몸|자극과 반응|항상성/, ['temp', 'co2', 'force']],
  [/환경|지속가능|미래|생활 속|탐구/, ['temp', 'light', 'co2', 'humidity']],
];

const EXAMPLE_QUESTIONS = {
  temp: '물의 양에 따라 같은 시간 동안 가열한 물의 온도 변화는 어떻게 달라질까?',
  voltage: '전지의 연결 방법(직렬·병렬)에 따라 전구에 걸리는 전압은 어떻게 달라질까?',
  current: '전선의 길이에 따라 회로에 흐르는 전류의 세기는 어떻게 달라질까?',
  force: '매단 물체의 질량에 따라 용수철이 당기는 힘의 크기는 어떻게 달라질까?',
  motion: '빗면의 기울기에 따라 수레의 위치 변화(속력)는 어떻게 달라질까?',
  accel: '수레에 작용하는 힘의 크기에 따라 가속도는 어떻게 달라질까?',
  ph: '산성 용액에 염기성 용액을 조금씩 넣을 때 pH는 어떻게 변할까?',
  co2: '빛의 세기에 따라 식물이 든 용기 속 이산화 탄소 농도 변화는 어떻게 달라질까?',
  o2: '빛을 비춘 시간에 따라 수생 식물 주변의 산소 농도는 어떻게 달라질까?',
  light: '광원으로부터의 거리에 따라 빛의 세기는 어떻게 달라질까?',
  sound: '소리굽쇠를 치는 세기에 따라 소리의 크기는 어떻게 달라질까?',
  pressure: '주사기 속 기체의 부피를 줄이면 압력은 어떻게 달라질까?',
  humidity: '젖은 수건을 널어 둔 방과 그렇지 않은 방의 습도 변화는 어떻게 다를까?',
  magnetic: '자석으로부터의 거리에 따라 자기장의 세기는 어떻게 달라질까?',
  conductivity: '물에 녹인 소금의 양에 따라 전기 전도도는 어떻게 달라질까?',
};

function standardsFor(prefix) {
  if (typeof SC_STANDARDS === 'undefined') return [];
  return SC_STANDARDS.filter(s => s[0].startsWith(prefix + '-')).map(([code, text, note]) => ({ code, text, note }));
}
function findStandard(code) {
  const s = (typeof SC_STANDARDS !== 'undefined' ? SC_STANDARDS : []).find(x => x[0] === code);
  return s ? { code: s[0], text: s[1], note: s[2] } : null;
}

// 중·고·직접 입력 단원의 추천 센서 (초등은 ELEM_UNITS의 sensors 사용)
function recommendSensorsByName(unitName) {
  const set = [];
  for (const [re, keys] of SENSOR_RULES) {
    if (re.test(unitName || '')) keys.forEach(k => { if (!set.includes(k)) set.push(k); });
  }
  return set.length ? set.slice(0, 4) : ['temp', 'light'];
}
