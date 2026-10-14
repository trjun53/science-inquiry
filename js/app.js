// 디지털 센서 기반 과학 탐구 - 메인 앱
const STORE_KEY = 'sci-inquiry-report-v1';
// 0번(수업 선택)은 첫 화면이라 상단 단계 표시에서 제외하고, 1~7번만 단계로 보여 줌
const STEPS = [
  { key: 'setup', title: '수업 선택' },
  { key: 'predict', title: '예상하기' },
  { key: 'design', title: '실험 설계 및 준비' },
  { key: 'connect', title: '센서 연결' },
  { key: 'measure', title: '실험 및 측정' },
  { key: 'analysis', title: '데이터 분석' },
  { key: 'conclusion', title: '결론 및 피드백' },
  { key: 'report', title: '보고서 작성' },
];
const STEP = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));
const BRANDS = [
  { key: 'pasco', name: 'PASCO', sub: '파스코 무선 센서', mark: 'P', color: '#0067b1', badge: '자동 인식' },
  { key: 'vernier', name: 'Vernier', sub: '버니어 Go Direct', mark: 'V', color: '#d1342f', badge: '자동 인식' },
  { key: 'sciencecube', name: '사이언스큐브', sub: 'ScienceCube', mark: 'S', color: '#0f9d58', badge: '자동 인식' },
  { key: 'easymaker', name: '이지메이커', sub: 'EasyMaker', mark: 'E', color: '#f08c00', badge: '범용 BLE' },
  { key: 'sim', name: '가상 센서', sub: '센서 없이 연습', mark: '∿', color: '#64748b', badge: '시뮬레이션' },
  { key: 'csv', name: '파일 가져오기', sub: '센서 앱 CSV', mark: '⇪', color: '#475569', badge: 'CSV' },
];
const BRAND_TIPS = {
  vernier: ['센서의 전원 버튼을 눌러 빨간 LED가 깜빡이는지 확인하세요.', '목록에서 GDX-로 시작하는 이름(예: GDX-TMP 0F1…)을 선택합니다.', '센서 안에 여러 채널이 있으면 자동으로 표시되고, 연결되면 실시간 값이 바로 보입니다. Graphical Analysis 등 다른 앱에 연결되어 있으면 목록에 나타나지 않으니 먼저 끊으세요.'],
  pasco: ['센서 전원을 켜고 초록/파란 LED가 깜빡이는지 확인하세요.', '목록에서 센서 본체에 적힌 6자리 ID(예: 123-456)가 포함된 이름을 선택합니다.', '연결되면 센서 종류를 자동으로 알아내고 실시간 값이 바로 표시됩니다. SPARKvue 등 다른 앱이나 다른 컴퓨터에 연결되어 있으면 먼저 끊으세요.'],
  sciencecube: ['센서 전원을 켜고 "모바일 모드"로 바꿔 주세요. (PC 모드에서는 블루투스 목록에 나타나지 않아요)', '목록에서 SC:TEMP, SC:PRESS처럼 SC:로 시작하는 이름을 선택합니다. 사이언스큐브 앱이나 태블릿·휴대폰에 연결되어 있으면 보이지 않으니 먼저 끊으세요.', '연결되면 센서 종류를 자동으로 알아내고 실시간 값이 바로 표시됩니다. "페어링이 필요하다"는 안내가 나오면 Windows 설정 > 블루투스에서 센서를 먼저 추가하세요.'],
  easymaker: ['보드에 전원을 연결하고 BLE 시리얼 코드가 업로드되어 있는지 확인하세요.', '보드는 "23.5" 또는 "23.5,45.1" 형태로 한 줄씩 보내면 됩니다.', 'Nordic UART, HM-10(FFE0), ESP32 예제 UUID를 자동으로 찾습니다.'],
  sim: ['실제 센서 없이 측정 흐름을 연습하는 가상 센서입니다.', '실험 설계에서 고른 측정 센서 종류에 맞는 그럴듯한 데이터가 만들어집니다.'],
  csv: ['SPARKvue, Graphical Analysis, 사이언스큐브 앱 등에서 내보낸 CSV 파일을 불러옵니다.', '첫 열(또는 "시간/Time" 열)을 시간으로, 나머지 열을 측정값으로 인식합니다.'],
};
const SAFETY_ITEMS = ['보안경·실험복 착용', '가열 기구 사용 시 화상 주의', '전기 회로는 전원을 끈 뒤 연결', '화학 약품은 냄새를 손으로 바람을 일으켜 맡기', '센서는 물기·충격에 주의', '실험 후 정리 정돈과 손 씻기'];
const QUESTION_CHECKS = [
  ['testable', '실험으로 확인할 수 있는 질문인가요?'],
  ['variables', '다르게 할 것과 측정 결과가 드러나나요?'],
  ['sensor', '디지털 센서로 측정할 수 있는 값인가요?'],
  ['safe', '안전하게, 수업 시간 안에 할 수 있나요?'],
];

const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const newState = () => ({
  step: 0,
  meta: { level: '', grade: '', semester: '', publisher: '', std: '', group: '', unit: '', customUnit: '', standards: [], lessonNo: 0, lesson: '', customLesson: '', topic: '', name: '', date: today(), members: {} },
  expId: '',
  question: { observation: '', pre: {}, preReason: '', qIv: '', qDv: '', question: '', hypothesis: '', checks: {} },
  design: { iv: '', ivLevels: '', dv: '', sensor: '', controls: [''], materials: '', procedure: [''], intervalSec: 1, durationSec: 60, measureMode: 'auto', manualX: '', safety: {}, safetyItems: [], safetyNote: '', appliedExp: '', sensorAlias: ['', ''] },
  data: { runs: [] },
  chat: [],
  result: { channel: '', channel2: '', axisRanges: {}, hidden: {}, analysis: '', verdict: '', conclusion: '', error: '', reflection: '', ai: null },
  group: { mode: 'solo', code: '', nick: '', role: '' }, // 모둠 탐구 연결 정보 (이 기기 전용, 모둠원과 공유하지 않음)
});

let state = load();
const ui = { brand: '', runLabel: '', raw: [], preview: {}, liveQueued: false, activeRunId: null, timer: null, csvMsg: '',
  slot: 0, slots: [{ brand: '', cfg: null, raw: [], csvMsg: '' }, { brand: '', cfg: null, raw: [], csvMsg: '' }] };
// 센서 1·2를 하나처럼 묶은 드라이버. 연결 화면은 ui.slot 자리의 드라이버(sd())를 다룸
const driver = new MultiDriver();
const sd = () => driver.slots[ui.slot];
// 센서 이름(별칭): "뜨거운 물", "차가운 물"처럼 정하면 측정 항목 이름에 쓰임
const sensorAlias = i => ((state.design.sensorAlias || [])[i] || '');
driver.aliasOf = sensorAlias;

/* ───────── 저장 ───────── */
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.meta) {
      const st = deepMerge(newState(), s);
      // 예전에 줄바꿈으로 저장된 준비물은 쉼표로 이어 붙임
      if (st.design.materials) st.design.materials = st.design.materials.split(/\s*\n+\s*/).filter(Boolean).join(', ');
      return st;
    }
  } catch (e) { /* ignore */ }
  return newState();
}
function deepMerge(base, over) {
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) deepMerge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}
let saveTimer = null;
function save(now) {
  clearTimeout(saveTimer);
  const doSave = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); setSaved(true); }
    catch (e) { setSaved(false); }
  };
  if (now) doSave(); else saveTimer = setTimeout(doSave, 400);
  if (typeof groupSchedule === 'function') groupSchedule();
}
function setSaved(ok) {
  const el = document.getElementById('saveState');
  if (el) el.textContent = ok ? '자동 저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '저장 공간 부족';
}

/* ───────── 유틸 ───────── */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');
const uid = () => Math.random().toString(36).slice(2, 9);
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, val) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] = o[k] ?? (isNaN(k) ? {} : [])), obj);
  target[last] = val;
}
const unitName = () => state.meta.customUnit.trim() || state.meta.unit;
const fmt = (v, d = 3) => (v === null || v === undefined || !isFinite(v) ? '-' : Number(v.toFixed(d)).toString());
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
}
function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const field = (label, path, opts = {}) => {
  const v = getPath(state, path) ?? '';
  const ph = esc(opts.placeholder || '');
  const input = opts.textarea
    ? `<textarea data-bind="${path}" rows="${opts.rows || 3}" placeholder="${ph}">${esc(v)}</textarea>`
    : `<input type="${opts.type || 'text'}" data-bind="${path}" value="${esc(v)}" placeholder="${ph}" ${opts.attrs || ''}>`;
  return `<label class="field ${opts.cls || ''}"><span>${label}${opts.hint ? `<small>${opts.hint}</small>` : ''}</span>${input}</label>`;
};

/* ───────── 렌더링 ───────── */
function render() {
  renderHeader();
  renderStepper();
  const view = $('#view');
  if (!STEPS[state.step]) state.step = 0;
  const step = STEPS[state.step].key;
  view.innerHTML = ({ setup: viewSetup, predict: viewQuestion, design: viewDesign, connect: viewConnect, measure: viewMeasure, analysis: viewAnalysis, conclusion: viewConclusion, report: viewReportPage })[step]();
  view.dataset.step = step;
  $('#stepper').hidden = state.step === 0;
  renderChat();
  renderNav();
  afterRender(step);
  window.scrollTo({ top: 0 });
}

function renderHeader() {
  const m = state.meta;
  const ctx = unitName() ? [m.level, m.grade, m.semester, (m.group && m.group !== '과학' ? `[${m.group}] ` : '') + unitName(), lessonLabel()].filter(Boolean).join(' · ') : '수업을 선택하세요';
  $('#context').textContent = ctx;
}

function renderStepper() {
  $('#stepper').innerHTML = STEPS.slice(1).map((s, k) => {
    const i = k + 1;
    return `
    <button class="step ${i === state.step ? 'active' : ''} ${i < state.step ? 'done' : ''}" data-action="goto" data-step="${i}" ${!unitName() ? 'disabled' : ''}>
      <span class="num">${i < state.step ? '✓' : i}</span><span class="label">${s.title}</span>
    </button>`;
  }).join('');
}

function renderNav() {
  const s = state.step;
  const prevLabel = s === 1 ? '← 수업 선택' : '← 이전';
  $('#nav').innerHTML = `
    ${s === 0 ? '<span></span>' : `<button class="btn ghost" data-action="prev">${prevLabel}</button>`}
    <span id="saveState" class="muted small"></span>
    ${s < STEPS.length - 1 ? `<button class="btn primary" data-action="next">${s === 0 ? '탐구 시작하기' : '다음: ' + STEPS[s + 1].title} →</button>` : '<span></span>'}`;
}

/* 0. 수업 선택 (첫 화면) */
const isElem = () => state.meta.level === '초등학교';
function viewSetup() {
  const m = state.meta;
  const levels = Object.keys(CURRICULUM);
  const grades = m.level ? Object.keys(CURRICULUM[m.level]) : [];
  const sems = m.level && m.grade && CURRICULUM[m.level][m.grade] ? Object.keys(CURRICULUM[m.level][m.grade]) : [];
  const groups = sems.includes(m.semester) ? CURRICULUM[m.level][m.grade][m.semester] : [];
  const choice = (action, items, current, cls = '') => items.map(v => `<button class="chip-btn ${cls} ${v === current ? 'on' : ''}" data-action="${action}" data-value="${esc(v)}">${esc(v)}</button>`).join('');
  const custom = m.customUnit.trim();
  const unitBtn = (group, u, no, std) => {
    const info = std && ELEM_UNITS.find(e => e.std === std);
    const on = !custom && (std ? m.std === std : (m.unit === u && m.group === group));
    const f = info && FIELDS[info.field];
    const sensorCount = info && info.sensors.length;
    return `<button class="unit-btn ${on ? 'on' : ''}" data-action="setUnit" data-group="${esc(group)}" data-value="${esc(u)}" data-std="${std || ''}">
      <span class="unit-no">${no}</span>
      <span class="unit-text"><span class="unit-name">${esc(u)}</span>
      ${f ? `<span class="unit-meta"><i style="background:${f.color}"></i>${f.name}${sensorCount ? ' · <b class="has-sensor">센서 탐구</b>' : ''}</span>` : ''}</span>
    </button>`;
  };
  // 4. 교과서: 초등은 출판사별 지도서 자료가 있음
  let pubHtml = '<span class="muted">학기를 먼저 선택하세요</span>';
  if (m.semester && isElem()) {
    pubHtml = `<div class="chips">${publishersFor(m.grade, m.semester).map(p => `<button class="chip-btn ${m.publisher === p ? 'on' : ''}" data-action="setPublisher" data-value="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
  } else if (m.semester) {
    pubHtml = '<span class="muted">중·고등학교는 교과서별 자료가 없어요. 바로 단원을 고르세요.</span>';
  }
  const unitsReady = m.semester && (!isElem() || m.publisher);
  let unitsHtml = `<span class="muted">${m.semester && isElem() ? '교과서를 먼저 선택하세요' : '학기를 먼저 선택하세요'}</span>`;
  if (unitsReady && isElem()) {
    unitsHtml = textbookUnits(m.grade, m.semester, m.publisher).map((u, i) => unitBtn('과학', u.name, u.order || i + 1, u.std)).join('');
  } else if (unitsReady) {
    unitsHtml = groups.map(g => `
      ${groups.length > 1 || g.group !== '과학' ? `<div class="unit-group">${esc(g.group)}</div>` : ''}
      ${g.units.map((u, i) => unitBtn(g.group, u, i + 1, '')).join('')}`).join('');
  }

  return `
  <section class="hero">
    <h1>디지털 센서 기반 과학 탐구</h1>
    <p>수업을 고르고 예상하기 → 실험 설계 및 준비 → 센서 연결 → 실험 및 측정 → 데이터 분석 → 결론 → 보고서 작성 순서로 탐구해요.</p>
  </section>
  <div class="setup-grid">
    <section class="card">
      <div class="sel-row"><h3><b>1</b> 학교급</h3><div class="chips">${choice('setLevel', levels, m.level, 'lg')}</div></div>
      <div class="sel-row ${m.level ? '' : 'disabled'}"><h3><b>2</b> 학년</h3><div class="chips">${m.level ? choice('setGrade', grades, m.grade) : '<span class="muted">학교급을 먼저 선택하세요</span>'}</div></div>
      <div class="sel-row ${m.grade ? '' : 'disabled'}"><h3><b>3</b> 학기</h3><div class="chips">${m.grade ? choice('setSemester', sems, m.semester) : '<span class="muted">학년을 먼저 선택하세요</span>'}</div></div>
      <div class="sel-row ${m.semester ? '' : 'disabled'}"><h3><b>4</b> 교과서</h3>${pubHtml}</div>
      <div class="sel-row ${unitsReady ? '' : 'disabled'}"><h3><b>5</b> 단원</h3>
        <div class="units">
          ${unitsHtml}
          ${unitsReady ? `<label class="field custom-unit"><span>목록에 없나요? 단원명 직접 입력</span><input data-bind="meta.customUnit" value="${esc(m.customUnit)}" placeholder="예: 2. 전기와 자기"></label>` : ''}
        </div>
      </div>
      <div class="sel-row ${unitName() ? '' : 'disabled'}"><h3><b>6</b> 차시</h3>
        <div id="lessonBox">${unitName() ? lessonPicker() : '<span class="muted">단원을 먼저 선택하세요</span>'}</div>
      </div>
      <div class="sel-row"><h3><b>7</b> 탐구 방식</h3>
        <div id="groupBox">${groupBoxHtml()}</div>
      </div>
      <p class="note">${isElem()
        ? '※ 초등은 2022 개정 교육과정 성취기준과 교과서별 지도서 자료(source 폴더)를 바탕으로 합니다. 센서 표시와 탐구 예시는 해당 학년 교육과정 범위 안의 활동만 골랐어요.'
        : '※ 2022 개정 교육과정 기준 단원입니다. 검정 교과서마다 단원명·학기 배치가 다를 수 있어요.'}</p>
    </section>
    <aside class="card unit-panel" id="unitPanel">${unitPanel()}</aside>
  </div>`;
}

/* 5. 차시 선택 */
const NO_LESSON = { standards: [], lessonNo: 0, lesson: '', customLesson: '' };
const lessonLabel = () => {
  const m = state.meta;
  if (m.customLesson && m.customLesson.trim()) return m.customLesson.trim();
  return m.lesson ? `${m.lessonNo}${currentTextbook() && currentTextbook().kind === 'goals' ? '번 활동' : '차시'} · ${m.lesson}` : '';
};
const currentTextbook = () => (unitInfo() && state.meta.publisher ? textbookUnit(state.meta.grade, state.meta.semester, state.meta.publisher, state.meta.std) : null);
function lessonPicker() {
  const m = state.meta;
  const info = unitInfo();
  const tb = currentTextbook();
  const customInput = `<label class="field custom-unit"><span>차시명을 직접 입력</span><input data-bind="meta.customLesson" value="${esc(m.customLesson || '')}" placeholder="예: 5/9차시 전자석의 세기 비교하기"></label>`;
  if (info && !tb) {
    return `<p class="muted">4번에서 <b>교과서</b>를 고르면 그 교과서 지도서의 차시가 나타나요.</p>${customInput}`;
  }
  const lessons = lessonsFor(tb);
  const custom = (m.customLesson || '').trim();
  const isGoals = tb && tb.kind === 'goals';
  const sensorN = lessons.filter(l => l.sensors.length).length;
  return `
    <div class="lessons">${lessons.map(l => `
      <button class="lesson-btn ${!custom && m.lesson === l.title ? 'on' : ''} ${l.sensors.length ? 'sensor' : ''}" data-action="setLesson" data-no="${l.no}" data-value="${esc(l.title)}" data-std="${l.std}" data-sensor="${l.sensors[0] || ''}" data-exp="${l.exp}">
        <span class="les-no">${l.no}<small>${isGoals ? '활동' : '차시'}</small></span>
        <span class="les-title">${esc(l.title)}</span>
        <span class="les-tags">${l.sensors.map(s => `<span class="les-sensor">${SENSOR_TYPES[s].name} 센서</span>`).join('')}${l.std ? `<span class="les-std">${l.std}</span>` : ''}</span>
      </button>`).join('')}</div>
    <p class="muted small les-help">${tb
      ? `${esc(m.publisher)} 지도서의 ${isGoals ? '단원 학습 목표(차시명 대신 학습 활동으로 정리된 자료)' : '차시명'}입니다. ${sensorN ? `<b class="les-sensor-inline">센서</b> 표시가 있는 ${sensorN}개 차시는 이 학년 교육과정 범위 안에서 디지털 센서로 탐구할 수 있어요.` : '이 단원은 관찰·조사·모형 중심이라 센서 탐구 차시가 없어요.'} 성취기준 코드는 차시명과 가장 가까운 것을 자동으로 연결했어요.`
      : '성취기준 자료가 없는 단원이라 디지털 센서 탐구 수업의 기본 차시 구성을 보여 줘요.'}</p>
    ${customInput}`;
}

/* 첫 화면 오른쪽: 선택한 단원 정보 */
const unitInfo = () => (isElem() && !state.meta.customUnit.trim() && state.meta.std ? ELEM_UNITS.find(u => u.std === state.meta.std) || null : null);
const recSensors = () => (unitInfo() ? unitInfo().sensors.slice() : (isElem() ? [] : recommendSensorsByName(unitName())));
function exampleQuestions() {
  const info = unitInfo();
  if (info) return experimentsFor(info.std).map(e => ({ q: e.question, sensor: e.sensors[0], exp: e.id }));
  if (isElem()) return [];
  return recSensors().map(k => ({ q: EXAMPLE_QUESTIONS[k], sensor: k, exp: '' }));
}

/* 실험 템플릿: 선택한 차시·예시에 맞는 실험 */
const currentExperiment = () => {
  const e = findExperiment(state.expId);
  return e && unitInfo() && e.std === unitInfo().std ? e : null;
};
// 실험을 고르면 탐구 질문·변인·준비물·실험 과정·안전 수칙을 그 실험 내용으로 채움
function applyExperiment(id, quiet) {
  const e = findExperiment(id);
  state.expId = e ? e.id : '';
  if (!e || state.design.appliedExp === e.id) return;
  const d = state.design;
  Object.assign(d, {
    iv: e.iv, ivLevels: e.levels, dv: e.dv, sensor: e.sensors[0],
    controls: e.controls.slice(), materials: e.materials.join(', '), procedure: e.steps.slice(),
    safetyItems: e.safety.slice(), safety: {}, intervalSec: e.interval, durationSec: e.duration, appliedExp: e.id,
  });
  // 탐구 질문은 학생이 직접 쓰도록 비워 둠
  ui.runLabel = '';
  if (!quiet) toast(`'${e.title}' 실험으로 바꿨어요. 실험 설계가 이 실험 내용으로 채워졌어요.`);
}
function unitPanel() {
  const m = state.meta;
  if (!unitName()) {
    return `<h3>단원 정보</h3>
      <ol class="guide-steps">
        <li><b>학교급</b>과 <b>학년</b>을 고르세요.</li>
        <li><b>학기</b>를 고르면 그 학기 단원이 나타나요. 초등은 <b>교과서</b>도 골라 주세요.</li>
        <li><b>단원</b>을 고르면 성취기준, 추천 센서, 센서 탐구 예시가 여기에 표시돼요.</li>
      </ol>`;
  }
  const info = unitInfo();
  const f = info && FIELDS[info.field];
  const rec = recSensors();
  const stds = info ? standardsFor(info.std) : [];
  const picked = m.standards || [];
  const examples = exampleQuestions();
  return `
    <div class="up-head">
      <div class="muted small">${esc([m.level, m.grade, m.semester, info && m.publisher].filter(Boolean).join(' · '))}</div>
      <h3>${info ? `<span class="up-no">${info.no}</span>` : ''}${esc(unitName())}</h3>
      ${f ? `<span class="field-chip" style="--c:${f.color}">${f.name}</span>` : ''}
    </div>
    ${stds.length ? `
      <div class="up-sec"><div class="up-label">성취기준 <small>이번 차시에 해당하는 것을 골라요 (보고서에 들어가요)</small></div>
        <div class="std-list">${stds.map(s => `
          <div class="std ${picked.includes(s.code) ? 'on' : ''}">
            <label><input type="checkbox" data-action="toggleStd" value="${s.code}" ${picked.includes(s.code) ? 'checked' : ''}>
            <span><span class="std-code">[${s.code}]</span> ${esc(s.text)}</span></label>
            ${s.note ? `<details class="std-note"><summary>해설</summary>${esc(s.note)}</details>` : ''}
          </div>`).join('')}</div>
      </div>` : `<p class="note">${info ? '' : '중·고등학교와 직접 입력한 단원은 성취기준 자료가 없어 단원명만 사용합니다.'}</p>`}
    <div class="up-sec"><div class="up-label">추천 센서${info ? ' <small>이 학년 교육과정 범위 안에서 쓸 수 있는 센서</small>' : ''}</div>
      ${rec.length ? `<div class="tags">${rec.map(k => `<span class="tag">${SENSOR_TYPES[k].name} <em>${SENSOR_TYPES[k].unit}</em></span>`).join('')}</div>`
        : '<p class="muted small">관찰·조사·모형 중심 단원이라 이 학년 범위에서 알맞은 센서 탐구가 없어요. 필요하면 실험 설계에서 센서를 직접 골라 주세요.</p>'}
    </div>
    ${examples.length ? `<div class="up-sec"><div class="up-label">센서 탐구 예시 <small>누르면 이 질문으로 예상하기를 시작해요</small></div>
      <div class="examples">${examples.map(e => `<button class="example" data-action="startWithExample" data-value="${esc(e.q)}" data-sensor="${e.sensor}" data-exp="${e.exp}">${e.sensor ? `<span class="tag">${SENSOR_TYPES[e.sensor].name}</span>` : ''}${esc(e.q)}</button>`).join('')}</div></div>` : ''}`;
}

/* 1. 예상하기 */
// 그래프 모양 선택지 그림 (실험 전 예상용)
const GRAPH_SHAPES = {
  up: ['M24 150 L276 34'], down: ['M24 34 L276 150'], flat: ['M24 96 L276 96'], flatHigh: ['M24 70 L276 70'],
  upCurve: ['M24 152 C150 152 230 120 276 26'], rise: ['M24 152 C70 60 130 46 276 42'], fall: ['M24 32 C70 128 130 140 276 146'],
  riseFall: ['M24 146 C100 20 190 20 276 140'], sCurve: ['M24 148 L110 138 C140 132 146 46 170 40 L276 30'],
  steps: ['M24 142 L104 142 L104 104 L188 104 L188 58 L276 58'], valley: ['M24 34 C110 170 190 170 276 34'],
  pulse: ['M24 148 L92 148 L92 52 L196 52 L196 148 L276 148'],
  converge: ['M24 34 C90 84 150 92 276 96', 'M24 150 C90 112 150 104 276 102'],
  parallel: ['M24 52 L276 52', 'M24 140 L276 140'], diverge: ['M24 94 L276 32', 'M24 100 L276 156'],
  lag: ['M24 150 C66 58 140 44 276 40', 'M24 150 C120 150 170 72 276 62'],
  split: ['M24 150 C80 70 150 52 276 46', 'M24 150 L276 144'], together: ['M24 150 C80 76 150 58 276 52', 'M24 158 C80 84 150 66 276 60'],
};
// axes = [가로축 이름, 세로축 이름] — 있으면 축 끝에 화살표와 이름을 표시
function graphSvg(shape, axes) {
  const paths = GRAPH_SHAPES[shape] || GRAPH_SHAPES.flat;
  const colors = paths.length > 1 ? ['#e11d48', '#2563eb'] : ['#0d9488'];
  const lines = paths.map((d, i) => `<path d="${d}" fill="none" stroke="${colors[i]}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  if (!axes) {
    return `<svg viewBox="0 0 300 180" class="gsvg" aria-hidden="true">
      <path d="M22 12 L22 164 L292 164" fill="none" stroke="#94a3b8" stroke-width="5"/>${lines}</svg>`;
  }
  const [xName, yName] = axes;
  return `<svg viewBox="-40 -14 340 216" class="gsvg" role="img" aria-label="가로축 ${esc(xName)}, 세로축 ${esc(yName)}">
    <path d="M22 168 L22 4 M292 164 L18 164" fill="none" stroke="#94a3b8" stroke-width="5"/>
    <path d="M12 14 L22 -2 L32 14 Z M282 154 L298 164 L282 174 Z" fill="#94a3b8"/>
    ${lines}
    <text x="-14" y="86" transform="rotate(-90 -14 86)" text-anchor="middle" class="ax">${esc(yName)}</text>
    <text x="157" y="196" text-anchor="middle" class="ax">${esc(xName)}</text>
  </svg>`;
}
function preQuestionsHtml(exp) {
  const ans = state.question.pre[exp.id] || {};
  let gi = 0;
  return exp.pre.map((p, qi) => {
    const axes = p.graph ? ((PRE_AXES[exp.id] || [])[gi++] || null) : null;
    return `
    <div class="pre-q">
      <h4>예상 ${qi + 1}. ${esc(p.q)}</h4>
      ${axes ? `<p class="axis-hint">가로축(→): <b>${esc(axes[0])}</b> · 세로축(↑): <b>${esc(axes[1])}</b></p>` : ''}
      ${p.graph
        ? `<div class="g-opts">${p.graph.map(([shape, label], oi) => `
            <button class="g-opt ${ans[qi] === oi ? 'on' : ''}" data-action="pickPre" data-q="${qi}" data-o="${oi}">${graphSvg(shape, axes)}<span>${esc(label)}</span></button>`).join('')}</div>`
        : `<div class="t-opts">${p.opts.map((o, oi) => `
            <button class="t-opt ${ans[qi] === oi ? 'on' : ''}" data-action="pickPre" data-q="${qi}" data-o="${oi}"><i></i><span>${esc(o)}</span></button>`).join('')}</div>`}
    </div>`;
  }).join('');
}
// 보고서·결론에서 쓰는 예상 답 요약
function preAnswers(exp) {
  if (!exp) return [];
  const ans = state.question.pre[exp.id] || {};
  return exp.pre.map((p, qi) => ({ q: p.q, a: ans[qi] === undefined ? '' : (p.graph ? p.graph[ans[qi]][1] : p.opts[ans[qi]]), shape: p.graph && ans[qi] !== undefined ? p.graph[ans[qi]][0] : '' }));
}

function viewQuestion() {
  const examples = exampleQuestions();
  const stds = (state.meta.standards || []).map(findStandard).filter(Boolean);
  const q = state.question;
  const exp = currentExperiment();
  const exps = unitInfo() ? experimentsFor(unitInfo().std) : [];
  const expPicker = exps.length ? `
    <div class="exp-picker"><span class="muted small">이 단원의 센서 실험</span>
      <div class="chips">${exps.map(e => `<button class="chip-btn sm ${exp && exp.id === e.id ? 'on' : ''}" data-action="pickExperiment" data-exp="${e.id}">${esc(e.title)}</button>`).join('')}</div></div>` : '';
  const first = exp ? `
      <section class="card pre-card">
        <h3>① 실험 전에 예상해 볼까요?</h3>
        <p class="muted pre-lead">${esc(exp.title)} — 실험하기 전에 먼저 생각해 보고 골라 보세요.</p>
        ${preQuestionsHtml(exp)}
        ${field('그렇게 예상한 까닭을 써 보세요.', 'question.preReason', { textarea: true, rows: 3 })}
        <div class="pre-note">정답은 실험을 마친 뒤에 스스로 확인하게 됩니다. 지금은 자유롭게 예상해 보세요.</div>
      </section>`
    : `<section class="card">
        <h3>① 관찰과 궁금한 점</h3>
        ${exps.length ? '<p class="muted small">위에서 실험을 고르면 실험 전 예상 질문이 나타나요.</p>' : ''}
        ${field('무엇을 관찰했나요? 무엇이 궁금한가요?', 'question.observation', { textarea: true, rows: 3, placeholder: '예: 냄비에 물을 많이 넣으면 끓는 데 더 오래 걸리는 것 같았다.' })}
      </section>`;
  return `
  <section class="page-head"><h2>예상하기</h2><p>실험하기 전에 결과를 예상해 보고, 탐구 질문과 나의 예상(가설)을 세워요.</p>
    ${lessonLabel() ? `<div class="qbanner">이번 차시: ${esc(lessonLabel())}</div>` : ''}${expPicker}</section>
  <div class="two-col">
    <div>
      ${first}
      <section class="card">
        <h3>② 탐구 질문 만들기</h3>
        <div class="builder">
          <input data-bind="question.qIv" value="${esc(q.qIv || '')}" placeholder="무엇을 다르게 할까요?">
          <span>에 따라</span>
          <input data-bind="question.qDv" value="${esc(q.qDv || '')}" placeholder="무엇을 측정할까요?">
          <span>은(는) 어떻게 달라질까?</span>
          <button class="btn small" data-action="buildQuestion">문장 만들기</button>
        </div>
        ${field('나의 탐구 질문', 'question.question', { textarea: true, rows: 2, placeholder: '빈칸을 채워 [문장 만들기]를 누르거나, 직접 써 보세요.' })}
        ${examples.length && !exp ? `<div class="muted small">이 단원의 센서 탐구 예시 (누르면 입력됩니다)</div>
        <div class="examples">${examples.map(e => `<button class="example" data-action="useExample" data-value="${esc(e.q)}" data-sensor="${e.sensor}" data-exp="${e.exp}">${e.sensor ? `<span class="tag">${SENSOR_TYPES[e.sensor].name}</span>` : ''}${esc(e.q)}</button>`).join('')}</div>` : ''}
      </section>
      <section class="card">
        <h3>③ 결과 예상하기 (가설)</h3>
        ${field('나의 예상', 'question.hypothesis', { textarea: true, rows: 3, hint: '“만약 ~한다면, ~할 것이다. 왜냐하면 ~이기 때문이다.”', placeholder: '예: 물의 양이 많을수록 같은 시간 동안 온도가 적게 올라갈 것이다. 왜냐하면 데워야 할 물이 많기 때문이다.' })}
      </section>
    </div>
    <aside class="card side">
      ${stds.length ? `<h3>이번 차시 성취기준</h3><div class="std-mini">${stds.map(s => `<p><b>[${s.code}]</b> ${esc(s.text)}</p>`).join('')}</div>` : ''}
      <h3>좋은 탐구 질문 점검</h3>
      <div class="checklist">${QUESTION_CHECKS.map(([k, t]) => `<label class="check"><input type="checkbox" data-bind="question.checks.${k}" ${state.question.checks[k] ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
      <div class="tipbox"><strong>도움말</strong><p>“왜?”로 묻는 질문보다 “~에 따라 ~은 어떻게 달라질까?”처럼 <b>측정할 수 있는</b> 질문이 탐구하기 좋아요.</p></div>
    </aside>
  </div>`;
}

/* 2. 실험 설계 및 준비 */
const safetyList = () => (state.design.safetyItems && state.design.safetyItems.length ? state.design.safetyItems : SAFETY_ITEMS);
function viewDesign() {
  const d = state.design;
  const rec = recSensors();
  const keys = [...rec, ...Object.keys(SENSOR_TYPES).filter(k => !rec.includes(k))];
  const exp = currentExperiment();
  const list = (arrPath, placeholder, numbered) => {
    const arr = getPath(state, arrPath);
    return `<div class="dyn-list">${arr.map((v, i) => `
      <div class="dyn-row">${numbered ? `<span class="idx">${i + 1}</span>` : '<span class="dot"></span>'}
        ${numbered ? `<textarea rows="1" class="auto" data-bind="${arrPath}.${i}" placeholder="${esc(placeholder)}">${esc(v)}</textarea>` : `<input data-bind="${arrPath}.${i}" value="${esc(v)}" placeholder="${esc(placeholder)}">`}
        ${numbered ? `<button class="icon-btn" title="위로" data-action="moveItem" data-path="${arrPath}" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>` : ''}
        <button class="icon-btn" title="삭제" data-action="removeItem" data-path="${arrPath}" data-i="${i}">✕</button>
      </div>`).join('')}
      <button class="btn small ghost" data-action="addItem" data-path="${arrPath}">+ 추가</button></div>`;
  };
  const safety = safetyList();
  return `
  <section class="page-head"><h2>실험 설계 및 준비</h2><p>무엇을 다르게 하고 무엇을 같게 할지 정하고, 준비물과 실험 과정을 확인해요.</p>
    ${state.question.question ? `<div class="qbanner">탐구 질문: ${esc(state.question.question)}</div>` : ''}
    ${exp ? `<p class="muted small src-note">‘${esc(exp.title)}’ 실험 내용으로 채웠어요. 준비물과 실험 과정은 교과서 실험을 바탕으로 정리했고, 센서 연결부터 측정까지의 과정은 디지털 센서용으로 새로 썼어요. 우리 반에 맞게 고쳐 써도 돼요.</p>` : ''}${supportBanner()}</section>
  <div class="two-col">
    <div>
      <section class="card">
        <h3>① 실험 조건 정하기</h3>
        <div class="var-grid">
          <div class="var iv">${field('다르게 할 것 <em>(조작 변인)</em>', 'design.iv', { placeholder: '예: 물의 양' })}
            ${field('다르게 할 조건', 'design.ivLevels', { placeholder: '예: 50 mL, 100 mL, 150 mL', hint: '쉼표로 구분 → 측정할 때 조건 이름으로 사용' })}</div>
          <div class="var dv">${field('측정 결과 <em>(종속 변인)</em>', 'design.dv', { placeholder: '예: 3분 동안의 온도 변화' })}
            <label class="field"><span>측정에 사용할 센서</span>
              <select data-bind="design.sensor"><option value="">선택하세요</option>
                ${keys.map(k => `<option value="${k}" ${d.sensor === k ? 'selected' : ''}>${SENSOR_TYPES[k].name} (${SENSOR_TYPES[k].unit})${rec.includes(k) ? ' · 추천' : ''}</option>`).join('')}
              </select></label></div>
          <div class="var cv"><span class="lbl">같게 할 것 <em>(통제 변인)</em></span>${list('design.controls', '예: 가열 장치의 세기', false)}</div>
        </div>
      </section>
      <section class="card">
        <h3>② 준비물</h3>
        ${field('', 'design.materials', { textarea: true, rows: 3, placeholder: '예: 비커(250 mL) 3개, 핫플레이트, 온도 센서, 눈금실린더, 스탠드' })}
      </section>
      <section class="card">
        <h3>③ 실험 과정 <small class="muted">센서 연결부터 측정까지 포함</small></h3>
        ${list('design.procedure', '실험 순서를 한 단계씩 적어요', true)}
      </section>
    </div>
    <aside>
      <section class="card side">
        <h3>④ 안전 점검</h3>
        ${exp ? '<p class="muted small">이 실험에서 꼭 지켜야 할 안전 수칙이에요. 확인하면 체크하세요.</p>' : ''}
        <div class="checklist">${safety.map((t, i) => `<label class="check"><input type="checkbox" data-bind="design.safety.s${i}" ${d.safety['s' + i] ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>
        ${field('그 밖의 유의사항', 'design.safetyNote', { textarea: true, rows: 2 })}
      </section>
    </aside>
  </div>`;
}
const expectN = () => {
  const d = state.design;
  return d.durationSec > 0 && d.intervalSec > 0 ? Math.floor(d.durationSec / d.intervalSec) + 1 : '∞';
};

/* 3. 센서 연결 */
function viewConnect() {
  const support = 'bluetooth' in navigator;
  const sensorName = state.design.sensor && SENSOR_TYPES[state.design.sensor] ? SENSOR_TYPES[state.design.sensor].name : '';
  return `
  <section class="page-head"><h2>센서 연결</h2><p>사용할 디지털 센서를 블루투스로 연결하고, 값이 잘 들어오는지 확인해요.</p>
    ${sensorName ? `<div class="qbanner">실험 설계에서 고른 센서: ${esc(sensorName)} 센서</div>` : ''}</section>
  ${!support && !['sim', 'csv'].includes(ui.brand) ? `<div class="alert">이 브라우저는 Web Bluetooth를 지원하지 않습니다. <b>PC·크롬북·안드로이드의 Chrome 또는 Edge</b>에서 접속하세요. (iPad/iPhone은 Bluefy 브라우저 앱 사용) — 센서 없이 연습하려면 <b>가상 센서</b>를 선택하세요.</div>` : ''}
  ${support && !window.isSecureContext ? `<div class="alert">블루투스는 <b>https://</b> 또는 <b>localhost</b> 주소에서만 동작합니다. start-server.bat로 실행하거나 https로 배포하세요.</div>` : ''}
  <div class="slot-tabs">${[0, 1].map(i => slotTab(i)).join('')}
    <p class="muted small">센서를 2개 연결하면 측정 그래프에서 두 값을 왼쪽·오른쪽 세로축(y축 2개)으로 함께 볼 수 있어요.</p></div>
  <div class="sensor-layout">
    <section class="card">
      <h3>① 센서 ${ui.slot + 1}의 제조사 선택</h3>
      <div class="brands">${BRANDS.filter(b => !(ui.slot === 1 && b.key === 'csv')).map(b => `
        <button class="brand ${ui.brand === b.key ? 'on' : ''}" data-action="pickBrand" data-value="${b.key}" ${driver && driver.measuring ? 'disabled' : ''}>
          <span class="mark" style="background:${b.color}">${b.mark}</span>
          <span class="bname">${b.name}</span><span class="bsub">${b.sub}</span>
          <span class="bbadge">${b.badge}</span>
        </button>`).join('')}</div>
    </section>
    <section class="card">
      <h3>② 센서 ${ui.slot + 1} 연결하고 값 확인하기</h3>
      <div id="brandPanel">${brandPanel()}</div>
      <div id="liveTiles" class="tiles"></div>
    </section>
  </div>`;
}

/* 4. 실험 및 측정 */
function viewMeasure() {
  const levels = ivLevels();
  const runs = state.data.runs;
  if (!ui.runLabel) ui.runLabel = levels[runs.length] || levels[0] || `시행 ${runs.length + 1}`;
  const manual = state.design.measureMode === 'manual';
  const support = !!observeExp();
  return `
  <section class="page-head"><h2>실험 및 측정</h2><p>${support ? '실험하면서 관찰한 결과를 기록하고, 센서로 실험 조건을 확인해요.' : '실험 조건을 바꿔 가며 센서로 데이터를 측정해요. 조건마다 한 번씩 측정하면 데이터 분석에서 비교할 수 있어요.'}</p>
    ${state.question.question ? `<div class="qbanner">탐구 질문: ${esc(state.question.question)}</div>` : ''}${supportBanner()}</section>
  ${support ? obsCard(true, '① 관찰 결과 기록 (주요 결과)') : ''}
  <div id="connBar">${connBar()}</div>
  <div class="measure-layout">
    <section class="card">
      <h3>${support ? '② 조건 확인 측정 (센서)' : '① 측정하기'}</h3>
      <div class="mode-switch">
        <button class="mode-btn ${manual ? '' : 'on'}" data-action="setMode" data-value="auto"><b>⏱ 자동 측정</b><small>정해진 간격으로 계속 기록해요</small></button>
        <button class="mode-btn ${manual ? 'on' : ''}" data-action="setMode" data-value="manual"><b>✋ 수동 기록</b><small>[값 기록] 버튼을 누를 때만 기록해요</small></button>
      </div>
      <div class="measure-bar">
        <label class="field"><span>측정 조건 이름</span>
          <input id="runLabel" list="levelList" value="${esc(ui.runLabel)}" placeholder="예: 물 100 mL">
          <datalist id="levelList">${levels.map(l => `<option value="${esc(l)}">`).join('')}</datalist></label>
        ${manual
          ? field('가로축 이름', 'design.manualX', { placeholder: '예: 거리 (cm) · 비우면 기록 번호', cls: 'mid' })
          : `${field('간격(초)', 'design.intervalSec', { type: 'number', attrs: 'min="0.01" step="0.1"', cls: 'narrow' })}
             ${field('시간(초)', 'design.durationSec', { type: 'number', attrs: 'min="0" step="1"', cls: 'narrow' })}`}
        <div class="measure-btns">
          <button class="btn primary big" id="btnStart" data-action="startMeasure">● ${manual ? '기록 시작' : '측정 시작'}</button>
          <button class="btn danger big" id="btnStop" data-action="stopMeasure">■ ${manual ? '기록 끝내기' : '정지'}</button>
        </div>
      </div>
      ${manual ? `
      <div class="record-bar">
        <label class="field"><span>이번 기록의 가로축 값 또는 메모 <small>숫자를 쓰면 그래프 가로축 값이 돼요. Enter로도 기록돼요.</small></span>
          <input id="recX" placeholder="예: 2 (비우면 기록 번호)" autocomplete="off"></label>
        <button class="btn record big" id="btnRecord" data-action="recordValue">📌 값 기록</button>
        <button class="btn ghost" id="btnUndo" data-action="undoRecord">마지막 기록 지우기</button>
      </div>` : ''}
      <div id="liveTiles" class="tiles"></div>
      <div class="chart-wrap"><canvas id="liveChart"></canvas></div>${axisSetBox('liveChart')}
      ${manual ? '<div id="manualList" class="manual-list"></div>' : '<div class="progress"><div id="progBar"></div></div>'}
    </section>
  </div>
  <section class="card">
    <div class="card-head"><h3>${support ? '③ 센서 측정 기록' : '② 측정 기록'} <span class="count">${runs.length}</span></h3>
      <div><button class="btn small ghost" data-action="exportCsv" ${runs.length ? '' : 'disabled'}>CSV 내려받기</button></div></div>
    <div id="runList">${runList()}</div>
  </section>`;
}

// 실험 및 측정 화면 위쪽: 연결 상태
function connBar() {
  const ok = driver && driver.connected;
  return ok
    ? `<div class="conn-bar ok"><span>● <b>${esc(driver.deviceName)}</b> 연결됨 · 측정 채널: ${esc(driver.channels.filter(c => c.enabled).map(c => c.name).join(', ') || '없음')}</span>
        <button class="btn small ghost" data-action="goto" data-step="${STEP.connect}">센서 연결 바꾸기</button></div>`
    : `<div class="conn-bar"><span>○ 센서가 연결되지 않았어요. 먼저 센서를 연결하세요. (CSV로 가져온 데이터는 아래 측정 기록에 있어요)</span>
        <button class="btn small primary" data-action="goto" data-step="${STEP.connect}">센서 연결하러 가기</button></div>`;
}

function ivLevels() {
  return (state.design.ivLevels || '').split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
}

function slotTab(i) {
  const d = driver.slots[i];
  const on = d && d.connected;
  const brand = BRANDS.find(b => b.key === (i === ui.slot ? ui.brand : ui.slots[i].brand));
  const sub = on ? `● ${d.deviceName}` : brand ? `${brand.name} · 연결 안 됨` : (i === 0 ? '연결 안 됨' : '추가로 연결 (선택)');
  return `<button class="slot-tab ${i === ui.slot ? 'on' : ''} ${on ? 'ok' : ''}" data-action="pickSlot" data-i="${i}"><b>센서 ${i + 1}</b><span>${esc(sub)}</span></button>`;
}
// 연결 화면에서 센서 1·2 자리 바꾸기 (자리마다 제조사·설정·원시 데이터를 따로 기억)
function switchSlot(n) {
  if (n === ui.slot) return;
  Object.assign(ui.slots[ui.slot], { brand: ui.brand, cfg: ui.cfg, raw: ui.raw, csvMsg: ui.csvMsg });
  ui.slot = n;
  Object.assign(ui, ui.slots[n]);
  render();
}

function brandPanel() {
  if (!ui.brand) return '<p class="muted center pad">위에서 사용할 센서 제조사를 선택하세요.</p>';
  const tips = BRAND_TIPS[ui.brand] || [];
  const tipHtml = `<ol class="tips">${tips.map(t => `<li>${t}</li>`).join('')}</ol>`;
  if (ui.brand === 'csv') {
    return `${tipHtml}
      <label class="file-drop"><input type="file" accept=".csv,.txt" data-action="importCsv"><span>CSV 파일 선택</span></label>
      ${ui.csvMsg ? `<p class="small">${esc(ui.csvMsg)}</p>` : ''}`;
  }
  const cur = sd();
  const connected = cur && cur.connected && cur.brand === ui.brand;
  const simExp = ui.brand === 'sim' && currentExperiment() && typeof EXP_SIM !== 'undefined' && EXP_SIM[currentExperiment().id] ? currentExperiment() : null;
  const simSel = simExp ? `
    <div class="tipbox" style="margin:0 0 12px"><strong>‘${esc(simExp.title)}’ 실험용 가상 데이터</strong>
      <p>측정 조건 이름을 실험 설계의 조건(${esc(simExp.levels)})으로 고르면, 그 조건에서 실제로 나올 법한 값이 나와요.</p></div>`
    : ui.brand === 'sim' ? `
    <label class="field"><span>가상 센서 종류</span><select data-action="simSensor">
      ${Object.keys(SENSOR_TYPES).map(k => `<option value="${k}" ${(state.design.sensor || 'temp') === k ? 'selected' : ''}>${SENSOR_TYPES[k].name}</option>`).join('')}
    </select></label>` : '';
  const preset = BRAND_PRESETS[ui.brand];
  return `
    ${tipHtml}
    ${simSel}
    <div class="conn-row">
      ${connected
        ? `<span class="status ok" id="connStatus">● ${esc(cur.deviceName)} 연결됨</span><button class="btn small ghost" data-action="disconnect">연결 해제</button>`
        : `<span class="status" id="connStatus">○ 연결 안 됨</span><button class="btn primary" data-action="connect">${ui.brand === 'sim' ? '가상 센서 켜기' : '블루투스로 연결'}</button>`}
    </div>
    <label class="field alias-field"><span>센서 ${ui.slot + 1} 이름 <small>(선택) 예: 뜨거운 물, 차가운 물 — 그래프와 표에 이 이름으로 표시돼요</small></span>
      <input data-alias="${ui.slot}" value="${esc(sensorAlias(ui.slot))}" maxlength="20" placeholder="센서 ${ui.slot + 1}" ${driver.measuring ? 'disabled' : ''}></label>
    <div id="channelBox">${channelBox()}</div>
    ${preset ? `<p class="note">${esc(preset.note)}</p>${decoderPanel()}` : ''}`;
}

function channelBox() {
  const cur = sd();
  if (!cur || !cur.connected || cur.brand !== ui.brand) return '';
  if (!cur.channels.length) return '<p class="muted small">채널 정보를 기다리는 중…</p>';
  const shown = c => (driver.channels.find(x => x.id === ui.slot * 100 + c.id) || c).name;
  return `<div class="channels"><div class="muted small">측정 채널 <span class="slot-badge">센서 ${ui.slot + 1}</span></div>${cur.channels.map((c, i) => `
    <label class="check"><input type="checkbox" data-action="toggleChannel" data-i="${i}" ${c.enabled ? 'checked' : ''} ${driver.measuring ? 'disabled' : ''}>
    <span>${esc(shown(c))} ${c.unit ? `<em>(${esc(c.unit)})</em>` : ''}</span></label>`).join('')}</div>`;
}

/* 범용 BLE: 데이터 해석 설정 */
function getBrandConfig(brand) {
  const preset = BRAND_PRESETS[brand];
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('sensor-config-' + brand)); } catch (e) { /* ignore */ }
  const base = { namePrefixes: preset.namePrefixes.slice(), extraServices: '', showAll: false, decoder: JSON.parse(JSON.stringify(preset.decoder)) };
  return saved ? deepMerge(base, saved) : base;
}
function saveBrandConfig(brand, cfg) {
  localStorage.setItem('sensor-config-' + brand, JSON.stringify({ namePrefixes: cfg.namePrefixes, extraServices: cfg.extraServices, showAll: cfg.showAll, decoder: cfg.decoder }));
}
function decoderPanel() {
  const cfg = ui.cfg;
  const d = cfg.decoder;
  const cur = sd();
  const chars = cur && cur.chars && cur.brand === ui.brand ? cur.chars : [];
  const bin = d.format === 'binary';
  const types = ['uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'float32', 'fixed16_16'];
  return `
  <details class="adv" ${ui.advOpen ? 'open' : ''} data-adv>
    <summary>데이터 해석 설정 (교사용)</summary>
    <div class="adv-body" id="decoderForm">
      <div class="grid2">
        <label class="field"><span>기기 이름 필터 <small>쉼표 구분, 비우면 모든 기기</small></span><input data-cfg="namePrefixes" value="${esc(cfg.namePrefixes.join(', '))}"></label>
        <label class="field"><span>추가 서비스 UUID <small>쉼표 구분</small></span><input data-cfg="extraServices" value="${esc(cfg.extraServices)}" placeholder="예: 0000ffe0-0000-1000-8000-00805f9b34fb"></label>
      </div>
      <label class="check"><input type="checkbox" data-cfg="showAll" ${cfg.showAll ? 'checked' : ''}><span>연결할 때 모든 블루투스 기기 표시</span></label>
      <div class="grid2">
        <label class="field"><span>데이터 형식</span><select data-cfg="format">
          <option value="text" ${!bin ? 'selected' : ''}>텍스트 숫자 (예: 23.5,45.1)</option>
          <option value="binary" ${bin ? 'selected' : ''}>바이너리 (바이트 위치 지정)</option></select></label>
        <label class="field"><span>수신 특성 <small>비우면 모든 알림 특성</small></span><input data-cfg="listen" list="charList" value="${esc(d.listen)}"></label>
      </div>
      <datalist id="charList">${chars.map(c => `<option value="${c.uuid}">${[c.notify && '알림', c.write && '쓰기', c.read && '읽기'].filter(Boolean).join('/')} · 서비스 ${shortUuid(c.service)}</option>`).join('')}</datalist>
      <div class="table-scroll"><table class="mini ${bin ? 'bin' : ''}"><thead><tr><th>채널 이름</th><th>단위</th>${bin ? '<th>바이트 위치</th><th>형식</th><th>LE</th>' : ''}<th>배율</th><th>더할 값</th><th></th></tr></thead>
        <tbody>${d.fields.map((f, i) => `<tr>
          <td><input data-fld="${i}.name" value="${esc(f.name)}"></td>
          <td><input data-fld="${i}.unit" value="${esc(f.unit)}" class="w60"></td>
          ${bin ? `<td><input data-fld="${i}.offset" type="number" min="0" value="${f.offset ?? 0}" class="w60"></td>
          <td><select data-fld="${i}.type">${types.map(t => `<option ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
          <td><input type="checkbox" data-fld="${i}.le" ${f.le !== false ? 'checked' : ''}></td>` : ''}
          <td><input data-fld="${i}.scale" type="number" step="any" value="${f.scale ?? 1}" class="w60"></td>
          <td><input data-fld="${i}.add" type="number" step="any" value="${f.add ?? 0}" class="w60"></td>
          <td><button class="icon-btn" data-action="delField" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>
      <button class="btn small ghost" data-action="addField">+ 채널 추가</button>
      <div class="cmd-grid">
        <span>측정 시작 명령</span><input data-cfg="startChar" list="charList" value="${esc(d.startChar)}" placeholder="쓰기 특성 UUID (비우면 자동)"><input data-cfg="startHex" value="${esc(d.startHex)}" placeholder="HEX 예: 01 00">
        <span>측정 정지 명령</span><input data-cfg="stopChar" list="charList" value="${esc(d.stopChar)}" placeholder="쓰기 특성 UUID"><input data-cfg="stopHex" value="${esc(d.stopHex)}" placeholder="HEX">
        <span>값 요청(측정 간격마다)</span><input data-cfg="pollChar" list="charList" value="${esc(d.pollChar)}" placeholder="쓰기 특성 UUID"><input data-cfg="pollHex" value="${esc(d.pollHex)}" placeholder="HEX">
      </div>
      <div class="row-end"><button class="btn small ghost" data-action="resetConfig">기본값으로</button><button class="btn small primary" data-action="saveConfig">설정 저장·적용</button></div>
      <div class="raw-head"><strong>원시 데이터</strong><span class="muted small">센서가 보내는 바이트를 그대로 보여 줍니다 (최근 30개)</span></div>
      <pre id="rawLog" class="raw">${rawText()}</pre>
    </div>
  </details>`;
}
const rawText = () => ui.raw.length ? ui.raw.join('\n') : '연결하면 수신 데이터가 여기에 표시됩니다.';

function runList() {
  const runs = state.data.runs;
  if (!runs.length) return '<p class="muted center pad">아직 측정한 데이터가 없습니다.</p>';
  return `<table class="data"><thead><tr><th>#</th><th>조건</th><th>센서</th><th>측정 항목</th><th>데이터 수</th><th>측정 시간</th><th></th></tr></thead><tbody>
    ${runs.map((r, i) => {
      const last = r.rows.length ? r.rows[r.rows.length - 1][0] : 0;
      const live = r.id === ui.activeRunId && driver && driver.measuring;
      return `<tr class="${live ? 'live' : ''}"><td>${i + 1}</td>
        <td><input class="inline" data-run="${r.id}" value="${esc(r.label)}"></td>
        <td>${esc(r.device || r.brand)}${r.by ? `<br><small class="muted">${esc(r.by)} 측정</small>` : ''}</td>
        <td>${r.channels.map(c => esc(c.name) + (c.unit ? ` (${esc(c.unit)})` : '')).join(', ')}</td>
        <td>${r.rows.length}${live ? ' <span class="rec">REC</span>' : ''}</td><td>${r.mode === 'manual' ? `수동 ${r.rows.length}회` : `${fmt(last, 1)} s`}</td>
        <td><button class="icon-btn" title="그래프 보기" data-action="showRun" data-id="${r.id}">📈</button><button class="icon-btn" title="삭제" data-action="deleteRun" data-id="${r.id}" ${live ? 'disabled' : ''}>✕</button></td></tr>`;
    }).join('')}</tbody></table>`;
}

/* 5. 데이터 분석 */
function channelKeys() {
  const keys = [];
  state.data.runs.forEach(r => r.channels.forEach(c => { const k = `${c.name}|${c.unit}`; if (!keys.includes(k)) keys.push(k); }));
  return keys;
}
function seriesFor(key, includeHidden) {
  return state.data.runs.map((r, i) => {
    const idx = r.channels.findIndex(c => `${c.name}|${c.unit}` === key);
    if (idx < 0 || (!includeHidden && state.result.hidden[r.id])) return null;
    return { name: r.label, color: PLOT_COLORS[i % PLOT_COLORS.length], run: r, points: r.rows.map(row => [row[0], row[idx + 1] ?? null]) };
  }).filter(Boolean);
}
function currentKey2() {
  const keys = channelKeys();
  if (state.result.channel2 && (!keys.includes(state.result.channel2) || state.result.channel2 === currentKey())) state.result.channel2 = '';
  return state.result.channel2 || '';
}
function axisPicker(keys, key) {
  const key2 = currentKey2();
  const opt = (k, sel) => { const [n, u] = k.split('|'); return `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(n)}${u ? ` (${esc(u)})` : ''}</option>`; };
  const same = key2 && key2.split('|')[1] === key.split('|')[1];
  return `<div class="axis-pick">
      <label class="inline-field">${same ? 'y축' : '왼쪽 y축'} <select data-action="pickChannel">${keys.map(k => opt(k, key)).join('')}</select></label>
      ${keys.length > 1 ? `<label class="inline-field">${same ? '함께 볼 항목(같은 축)' : '오른쪽 y축'} <select data-action="pickChannel2"><option value="">(사용 안 함)</option>${keys.filter(k => k !== key).map(k => opt(k, key2)).join('')}</select></label>` : ''}
    </div>`;
}
function statsBoxHtml(forReport) {
  const k2 = currentKey2();
  const name = k => { const [n, u] = k.split('|'); return `${esc(n)}${u ? ` (${esc(u)})` : ''}`; };
  const same = k2 && k2.split('|')[1] === currentKey().split('|')[1];
  return k2 ? `<h4 class="axis-h">${same ? '' : '왼쪽 y축: '}${name(currentKey())}</h4>${statsTable(currentKey(), forReport)}<h4 class="axis-h">${same ? '' : '오른쪽 y축: '}${name(k2)}</h4>${statsTable(k2, forReport)}`
    : statsTable(currentKey(), forReport);
}
// 왼쪽 축 항목(실선)과 오른쪽 축 항목(점선)을 한 그래프에
function dualSeries() {
  const key = currentKey(), key2 = currentKey2();
  const nm = k => k.split('|')[0];
  const left = seriesFor(key, false);
  if (!key2) return { series: left, yLabel: axisName(key), y2Label: '' };
  // 단위가 같으면(예: 온도 2개) 같은 눈금에서 비교하도록 한 축에 겹쳐 그림
  const same = key.split('|')[1] === key2.split('|')[1];
  const right = seriesFor(key2, false).map(s => ({ ...s, axis: same ? 'left' : 'right', dash: true, name: `${s.name} · ${nm(key2)}` }));
  const series = [...left.map(s => ({ ...s, name: `${s.name} · ${nm(key)}` })), ...right];
  if (same) { const u = key.split('|')[1]; return { series, yLabel: `${nm(key)}, ${nm(key2)}${u ? ` (${u})` : ''}`, y2Label: '', same }; }
  return { series, yLabel: axisName(key), y2Label: axisName(key2) };
}
const axisName = k => { const [n, u] = k.split('|'); return `${n}${u ? ` (${u})` : ''}`; };
function currentKey() {
  const keys = channelKeys();
  if (!keys.includes(state.result.channel)) state.result.channel = keys[0] || '';
  return state.result.channel;
}
function statsTable(key, forReport) {
  const series = seriesFor(key, false);
  if (!series.length) return '<p class="muted">측정 데이터가 없습니다.</p>';
  const unit = key.split('|')[1];
  const ax = xAxisFor(series);
  const rateNote = ax.manual ? '<br><small>(가로축 1만큼 변할 때)</small>' : (unit ? `<br><small>(${esc(unit)}/s)</small>` : '');
  return `<table class="data stats"><thead><tr><th>조건</th><th>데이터 수</th><th>처음값</th><th>마지막값</th><th>최솟값</th><th>최댓값</th><th>평균</th><th>변화량</th><th>평균 변화율${rateNote}</th></tr></thead><tbody>
    ${series.map(s => { const st = runStats(s.points); return st ? `<tr><td>${forReport ? '' : `<span class="swatch" style="background:${s.color}"></span>`}${esc(s.name)}</td><td>${st.n}</td><td>${fmt(st.first)}</td><td>${fmt(st.last)}</td><td>${fmt(st.min)}</td><td>${fmt(st.max)}</td><td>${fmt(st.mean)}</td><td>${fmt(st.change)}</td><td>${fmt(st.slope, 4)}</td></tr>` : ''; }).join('')}
  </tbody></table>`;
}
function viewAnalysis() {
  const keys = channelKeys();
  const key = currentKey();
  const r = state.result;
  const support = !!observeExp();
  return `
  <section class="page-head"><h2>데이터 분석</h2><p>${support ? '관찰 결과를 표와 그래프로 비교하고, 센서 데이터로 조건이 제대로 달랐는지 확인해요.' : '조건별 그래프를 겹쳐 보고 표의 값을 비교해, 데이터에서 알 수 있는 사실을 정리해요.'}</p>
    ${state.question.question ? `<div class="qbanner">탐구 질문: ${esc(state.question.question)}</div>` : ''}${supportBanner()}</section>
  ${support ? obsCard(false, '① 주요 결과: 관찰 결과') : ''}
  <section class="card">
    ${support ? '<p class="muted small" style="margin-top:0">아래는 실험 조건을 확인하는 센서 데이터예요.</p>' : ''}
    ${keys.length ? `
    <div class="card-head"><h3>${support ? '② 조건 확인 데이터 (센서)' : '① 그래프로 비교하기'}</h3>
      ${axisPicker(keys, key)}</div>
    <div class="run-toggles">${state.data.runs.map((run, i) => `<label class="check pill"><input type="checkbox" data-action="toggleRun" data-id="${run.id}" ${r.hidden[run.id] ? '' : 'checked'}><span class="swatch" style="background:${PLOT_COLORS[i % PLOT_COLORS.length]}"></span>${esc(run.label)}</label>`).join('')}</div>
    <div class="chart-wrap ${support ? '' : 'tall'}"><canvas id="resultChart"></canvas></div>${axisSetBox('resultChart')}
    <h3>${support ? '센서 데이터 요약' : '② 데이터 요약'}</h3>
    <div class="table-scroll" id="statsBox">${statsBoxHtml()}</div>`
    : `<p class="muted center pad">아직 ${support ? '센서 ' : ''}측정 데이터가 없습니다. <button class="btn small" data-action="goto" data-step="${STEP.measure}">실험 및 측정하러 가기</button></p>`}
  </section>
  <section class="card">
    <h3>③ 결과 해석</h3>
    ${field(support ? '관찰 결과에서 알 수 있는 사실 (센서로 확인한 조건도 함께)' : '그래프와 표에서 알 수 있는 사실', 'result.analysis', { textarea: true, rows: 5,
      placeholder: support ? '예: 따뜻한 곳(약 24 °C)에 둔 씨는 3일째부터 싹이 텄고, 냉장고(약 4 °C)에 둔 씨는 7일 동안 거의 싹이 트지 않았다.' : '예: 물의 양이 50 mL일 때 3분 동안 온도가 약 38 °C 올랐고, 150 mL일 때는 약 14 °C 올랐다. 물의 양이 많을수록 온도 변화량이 작았다.' })}
    ${state.question.hypothesis ? `<div class="tipbox"><strong>나의 예상</strong><p>${nl2br(state.question.hypothesis)}</p></div>` : ''}
  </section>`;
}

/* 6. 결론 */
function viewConclusion() {
  const r = state.result;
  const keys = channelKeys();
  const key = currentKey();
  const exp = currentExperiment();
  const answers = preAnswers(exp).filter(a => a.a);
  return `
  <section class="page-head"><h2>결론 및 피드백</h2><p>측정 그래프를 다시 보며 예상이 맞았는지 판단하고 탐구 질문에 대한 답을 쓴 뒤, AI 선생님의 피드백을 받아요.</p>
    ${state.question.question ? `<div class="qbanner">탐구 질문: ${esc(state.question.question)}</div>` : ''}</section>
  ${observeExp() ? obsCard(false, '① 관찰 결과 다시 보기 (주요 결과)') : ''}
  <section class="card">
    ${keys.length ? `
    <div class="card-head"><h3>${observeExp() ? '조건 확인 데이터 (센서)' : '① 측정 결과 다시 보기'}</h3>
      ${axisPicker(keys, key)}</div>
    <div class="chart-wrap"><canvas id="conclusionChart"></canvas></div>${axisSetBox('conclusionChart')}
    <div class="table-scroll" id="statsBox">${statsBoxHtml()}</div>`
    : `<p class="muted center pad">아직 측정 데이터가 없습니다. <button class="btn small" data-action="goto" data-step="${STEP.measure}">실험 및 측정하러 가기</button></p>`}
  </section>
  <div class="two-col even">
    <section class="card">
      <h3>② 결론 내리기</h3>
      ${answers.length || state.question.hypothesis ? `<div class="tipbox" style="margin:0 0 14px"><strong>실험 전 나의 예상</strong>
        ${answers.map(a => `<p class="pre-recap">${a.shape ? `<span class="mini-g">${graphSvg(a.shape)}</span>` : ''}<span><b>${esc(a.q)}</b><br>→ ${esc(a.a)}</span></p>`).join('')}
        ${state.question.hypothesis ? `<p><b>가설</b> ${nl2br(state.question.hypothesis)}</p>` : ''}</div>` : ''}
      <div class="field"><span>나의 예상(가설)은 어떻게 되었나요?</span>
        <div class="seg">${['맞았어요(지지됨)', '일부만 맞았어요', '맞지 않았어요'].map(v => `<label><input type="radio" name="verdict" data-bind="result.verdict" value="${v}" ${r.verdict === v ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
      ${field('결론', 'result.conclusion', { textarea: true, rows: 4, placeholder: '탐구 질문에 대한 답을 그래프의 증거(데이터)와 함께 써요.' })}
    </section>
    <section class="card">
      <h3>③ 평가와 성찰</h3>
      ${field('오차의 원인과 개선 방법', 'result.error', { textarea: true, rows: 4, placeholder: '예: 센서를 비커 바닥에 닿게 둔 경우가 있었다. 센서 위치를 일정하게 고정하면 좋겠다.' })}
      ${field('새롭게 알게 된 점 · 더 탐구하고 싶은 점', 'result.reflection', { textarea: true, rows: 4 })}
    </section>
  </div>
  ${aiCard('conclusion')}`;
}

/* 7. 보고서 작성 */
function viewReportPage() {
  return `
  <section class="page-head"><h2>보고서 작성</h2><p>지금까지의 탐구 과정이 보고서로 정리되었어요. [결론 및 피드백] 단계에서 받은 피드백은 보고서 마지막에 들어가요. 확인한 뒤 인쇄하거나 PDF로 저장하세요.</p></section>
  <div id="reportBox">${viewReport()}</div>`;
}
function chartImage(key, w = 760, h = 340) {
  const c = document.createElement('canvas');
  const [n, u] = key.split('|');
  const series = seriesFor(key, false);
  const ax = xAxisFor(series);
  const yLabel = `${n}${u ? ` (${u})` : ''}`;
  drawPlot(c, series, { width: w, height: h, background: '#ffffff', xLabel: ax.label, xMinZero: !ax.manual, yLabel, yRange: axisRange(yLabel) });
  return c.toDataURL('image/png');
}
function viewReport() {
  const m = state.meta, q = state.question, d = state.design, r = state.result;
  const info = unitInfo();
  const exp = currentExperiment();
  const stds = info ? (m.standards || []).map(findStandard).filter(Boolean) : [];
  const keys = channelKeys();
  const safety = safetyList().filter((_, i) => d.safety['s' + i]);
  const devices = [...new Set(state.data.runs.map(x => x.device || x.brand))];
  const sensorName = d.sensor && SENSOR_TYPES[d.sensor] ? `${SENSOR_TYPES[d.sensor].name} 센서` : '';
  const answers = preAnswers(exp).filter(a => a.a);
  const blank = s => (s && String(s).trim() ? nl2br(s) : '<span class="blank">(작성하지 않음)</span>');
  return `
  <div class="report-actions no-print">
    <button class="btn primary" data-action="print">인쇄 / PDF로 저장</button>
    <button class="btn ghost" data-action="saveJson">보고서 파일 저장(.json)</button>
    <button class="btn ghost" data-action="exportCsv" ${state.data.runs.length ? '' : 'disabled'}>측정 데이터 CSV</button>
  </div>
  <article id="report" class="report">
    <header>
      <div class="r-kicker">디지털 센서 기반 과학 탐구 보고서</div>
      <h1>${esc(m.topic || q.question || unitName() || '과학 탐구 보고서')}</h1>
      <table class="r-info"><tbody>
        <tr><th>학교급·학년·학기</th><td>${esc([m.level, m.grade, m.semester].filter(Boolean).join(' '))}</td><th>날짜</th><td>${esc(m.date)}</td></tr>
        <tr><th>단원</th><td colspan="3">${info ? `(${info.no}) ` : ''}${esc((m.group && m.group !== '과학' ? `[${m.group}] ` : '') + unitName())}${info ? ` <span class="muted">· ${FIELDS[info.field].name}${m.publisher ? ` · ${esc(m.publisher)} 교과서` : ''}</span>` : ''}</td></tr>
        ${lessonLabel() ? `<tr><th>차시</th><td colspan="3">${esc(lessonLabel())}</td></tr>` : ''}
        ${Object.keys(m.members || {}).length ? `<tr><th>모둠 탐구</th><td colspan="3">모둠원: ${Object.values(m.members).map(esc).join(', ')}${inGroup() ? ` <span class="muted">· 모둠 코드 ${esc(state.group.code)}</span>` : ''}</td></tr>` : ''}
        ${stds.length ? `<tr><th>성취기준</th><td colspan="3">${stds.map(s => `<div>[${s.code}] ${esc(s.text)}</div>`).join('')}</td></tr>` : ''}
      </tbody></table>
    </header>
    <section><h2>1. 탐구 문제와 예상</h2>
      ${answers.length ? `<h4>실험 전 예상</h4><ul class="r-pre">${answers.map(a => `<li>${esc(a.q)} → <b>${esc(a.a)}</b></li>`).join('')}</ul>
        ${q.preReason ? `<p>예상한 까닭: ${nl2br(q.preReason)}</p>` : ''}` : (q.observation ? `<h4>관찰과 궁금한 점</h4><p>${nl2br(q.observation)}</p>` : '')}
      <h4>탐구 질문</h4><p class="r-q">${blank(q.question)}</p>
      <h4>나의 예상(가설)</h4><p>${blank(q.hypothesis)}</p>
    </section>
    <section><h2>2. 실험 설계</h2>
      <table class="r-var"><tbody>
        <tr><th>다르게 할 것<br><small>(조작 변인)</small></th><td>${esc(d.iv)}${d.ivLevels ? ` <span class="muted">(${esc(d.ivLevels)})</span>` : ''}</td></tr>
        <tr><th>같게 할 것<br><small>(통제 변인)</small></th><td>${esc(d.controls.filter(Boolean).join(', '))}</td></tr>
        <tr><th>측정 결과<br><small>(종속 변인)</small></th><td>${esc(d.dv)}${sensorName ? ` <span class="muted">— ${esc(sensorName)}로 측정</span>` : ''}${devices.length ? ` <span class="muted">· 사용 기기: ${esc(devices.join(', '))}</span>` : ''}</td></tr>
      </tbody></table>
      <h4>준비물</h4><p>${blank(d.materials)}</p>
      <h4>실험 과정</h4>${d.procedure.filter(Boolean).length ? `<ol>${d.procedure.filter(Boolean).map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p><span class="blank">(작성하지 않음)</span></p>'}
      ${safety.length || d.safetyNote ? `<h4>안전 유의사항</h4><ul>${safety.map(s => `<li>${esc(s)}</li>`).join('')}</ul>${d.safetyNote ? `<p>${nl2br(d.safetyNote)}</p>` : ''}` : ''}
    </section>
    <section><h2>3. 실험 결과</h2>
      ${observeExp() ? `<h4>3-1. 관찰 결과 (주요 결과) — ${esc(observeExp().observe.title)}</h4>
        ${obsTableHtml(false)}
        ${obsChartImages().map(src => `<figure><img src="${src}" alt="관찰 결과 그래프"></figure>`).join('')}
        <h4>3-2. 조건 확인 데이터 (센서)</h4>` : ''}
      ${keys.length && currentKey2() ? (() => { const ds = dualSeries(); const c = document.createElement('canvas');
        drawPlot(c, ds.series, { width: 760, height: 340, background: '#ffffff', xLabel: xAxisFor(ds.series).label, xMinZero: !xAxisFor(ds.series).manual, yLabel: ds.yLabel, y2Label: ds.y2Label, yRange: axisRange(ds.yLabel), y2Range: axisRange(ds.y2Label) });
        return `<figure ${observeExp() ? 'class="small-fig"' : ''}><img src="${c.toDataURL('image/png')}" alt="두 측정값 비교 그래프"><figcaption>${ds.same ? `${esc(ds.yLabel)} 함께 보기 (두 번째 항목은 점선)` : `${esc(ds.yLabel)}(왼쪽 축, 실선)과 ${esc(ds.y2Label)}(오른쪽 축, 점선) 함께 보기`}</figcaption></figure>`; })() : ''}
      ${keys.length ? keys.map(k => { const [n, u] = k.split('|'); return `
        <figure ${observeExp() ? 'class="small-fig"' : ''}><img src="${chartImage(k)}" alt="${esc(n)} 그래프"><figcaption>${xAxisFor(seriesFor(k, false)).manual ? '' : '시간에 따른 '}${esc(n)}${u ? ` (${esc(u)})` : ''} 변화</figcaption></figure>
        ${statsTable(k, true)}`; }).join('') : '<p><span class="blank">(측정 데이터 없음)</span></p>'}
      <h4>데이터 분석</h4><p>${blank(r.analysis)}</p>
    </section>
    <section><h2>4. 결론</h2>
      <h4>예상과 비교</h4><p>${r.verdict ? `<b>${esc(r.verdict)}</b>` : '<span class="blank">(선택하지 않음)</span>'}</p>
      <h4>결론</h4><p>${blank(r.conclusion)}</p>
      <h4>오차의 원인과 개선 방법</h4><p>${blank(r.error)}</p>
      <h4>새롭게 알게 된 점 · 더 탐구하고 싶은 점</h4><p>${blank(r.reflection)}</p>
    </section>
    <section><h2>5. 피드백</h2>${r.ai && r.ai.data ? aiFeedbackHtml(r.ai, true) : '<p><span class="blank">([결론 및 피드백] 단계에서 AI 피드백을 받지 않았어요)</span></p>'}</section>
  </article>`;
}
/* ───────── 렌더 후 처리 ───────── */
function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }
function afterRender(step) {
  setSaved(true);
  if (typeof groupShowEditors === 'function') groupShowEditors();
  document.querySelectorAll('textarea.auto').forEach(autosize);
  if (step === 'connect' || step === 'measure') { updateLive(); updateMeasureButtons(); }
  if (step === 'analysis') { drawResult('#resultChart'); drawObsCharts('obsA'); }
  if (step === 'conclusion') drawObsCharts('obsC');
  if (step === 'conclusion') drawResult('#conclusionChart');
}
// 그래프 가로축: 자동 측정은 시간, 수동 기록은 그 기록의 가로축 이름
function xAxisFor(series) {
  const labels = [...new Set(series.map(s => (s.run && s.run.mode === 'manual' ? s.run.xLabel : '시간 (s)')))];
  return { label: labels.length === 1 ? labels[0] : labels.join(' / '), manual: series.some(s => s.run && s.run.mode === 'manual') };
}
function drawResult(sel) {
  const c = $(sel || '#resultChart') || $('#conclusionChart');
  if (!c) return;
  const { series, yLabel, y2Label } = dualSeries();
  const ax = xAxisFor(series);
  drawPlot(c, series, { xLabel: ax.label, xMinZero: !ax.manual, yLabel, y2Label, yRange: axisRange(yLabel), y2Range: axisRange(y2Label) });
  afterChart(c);
}
function refreshAxisUi() {
  const head = document.querySelector('.axis-pick');
  if (head) head.outerHTML = axisPicker(channelKeys(), currentKey());
  const b = $('#statsBox'); if (b) b.innerHTML = statsBoxHtml();
  drawResult();
}

/* ───────── 그래프 축 범위 (축 드래그 · 직접 입력) ─────────
   범위는 축 이름(예: "압력 (kPa)")별로 기억해서 측정·분석·결론·보고서 그래프에 똑같이 씀 */
function axisRange(label) {
  const r = label && state.result.axisRanges ? state.result.axisRanges[label] : null;
  return r && isFinite(r.min) && isFinite(r.max) && r.max > r.min ? r : null;
}
function setAxisRange(label, range) {
  if (!label) return;
  state.result.axisRanges = state.result.axisRanges || {};
  if (range) state.result.axisRanges[label] = { min: range.min, max: range.max };
  else delete state.result.axisRanges[label];
  save();
  redrawCharts();
}
function redrawCharts() {
  if ($('#liveChart')) updateLive();
  if ($('#resultChart')) drawResult('#resultChart');
  if ($('#conclusionChart')) drawResult('#conclusionChart');
}
// 그린 뒤: 축 드래그 연결, 범위 입력 칸 내용 갱신
function afterChart(c) {
  enableAxisDrag(c, (side, range, label) => setAxisRange(label, range));
  const box = document.querySelector(`.axis-set[data-for="${c.id}"]`);
  if (box && !box.contains(document.activeElement)) box.querySelector('.axis-rows').innerHTML = axisRowsHtml(c);
}
function axisSetBox(id) {
  return `<details class="axis-set" data-for="${id}"><summary>축 범위 직접 정하기</summary>
    <p class="muted small">축의 숫자 부분을 누른 채 위아래로 끌어도 범위가 바뀌어요. (축을 두 번 누르면 자동 범위)</p>
    <div class="axis-rows"></div></details>`;
}
function axisRowsHtml(c) {
  const p = c._plot;
  if (!p) return '<p class="muted small">그래프가 그려지면 설정할 수 있어요.</p>';
  const nice = v => String(Math.round(v * 1e6) / 1e6);
  const row = (side, label, ax) => `<div class="axis-row" data-side="${side}" data-label="${esc(label)}">
      <b>${side === 'y' ? (p.Y2 ? '왼쪽 축' : 'y축') : '오른쪽 축'}</b><span class="muted small">${esc(label || '측정값')}${ax.fixed ? '' : ' · 자동'}</span>
      <label>최솟값 <input type="number" step="any" data-axmin value="${nice(ax.lo)}"></label>
      <label>최댓값 <input type="number" step="any" data-axmax value="${nice(ax.hi)}"></label>
      <button class="btn small primary" data-action="axisApply">적용</button>
      <button class="btn small ghost" data-action="axisAuto">자동으로</button></div>`;
  return row('y', p.yLabel, p.Y) + (p.Y2 ? row('y2', p.y2Label, p.Y2) : '');
}

/* ───────── 다른 수업으로 바꿀 때 이전 탐구 지우기 ───────── */
// 학생이 직접 쓰거나 측정한 내용이 하나라도 있는지 (실험 템플릿으로 자동 채운 설계는 제외)
function hasInquiryContent() {
  const q = state.question, r = state.result;
  const filled = v => v && String(v).trim();
  return !!(filled(q.question) || filled(q.hypothesis) || filled(q.preReason) || filled(q.observation) || filled(q.qIv) || filled(q.qDv)
    || Object.values(q.pre || {}).some(a => a && Object.keys(a).length)
    || Object.values(q.checks || {}).some(Boolean) || Object.values(state.design.safety || {}).some(Boolean)
    || state.data.runs.length || (state.data.observe && state.data.observe.rows.some(row => row.slice(1).some(filled)))
    || filled(r.analysis) || filled(r.verdict) || filled(r.conclusion) || filled(r.error) || filled(r.reflection) || r.ai
    || (state.chat || []).length);
}
// 수업(차시)이 바뀌면 이전 탐구 기록을 지움. 내용이 있으면 먼저 물어봄. 계속 진행하면 true
function startNewInquiry() {
  if (!hasInquiryContent()) { clearInquiry(); return true; }
  const label = [unitName(), lessonLabel()].filter(Boolean).join(' · ') || '이전 탐구';
  const ok = confirm(`다른 수업을 고르면 지금까지의 탐구 기록(${label})이 지워져요.\n탐구 질문, 예상, 점검 체크, 측정 데이터, 결론, 피드백이 모두 사라집니다.\n\n남겨 두려면 [취소]를 누르고 먼저 [파일 저장]을 하세요.\n새 수업으로 바꿀까요?`);
  if (ok) { clearInquiry(); toast('이전 탐구 기록을 지우고 새 수업을 시작해요.'); }
  return ok;
}
function clearInquiry() {
  const fresh = newState();
  Object.assign(state, { expId: '', question: fresh.question, design: fresh.design, data: fresh.data, chat: [], result: fresh.result });
  state.meta.date = fresh.meta.date;
  Object.assign(ui, { runLabel: '', showRunId: null, chatDraft: '', aiError: '' });
}

/* ───────── 관찰 결과 기록 (센서가 보조로 쓰이는 실험의 주요 결과) ───────── */
const observeExp = () => { const e = currentExperiment(); return e && e.observe ? e : null; };
function obsData() {
  const e = observeExp();
  if (!e) return null;
  const o = state.data.observe;
  if (!o || o.expId !== e.id) state.data.observe = { expId: e.id, rows: e.observe.rows.map(x => [x, ...e.observe.cols.map(() => '')]) };
  return state.data.observe;
}
const obsColLabel = c => `${c.name}${c.unit ? ` (${c.unit})` : ''}`;
function obsTableHtml(editable) {
  const e = observeExp(), o = obsData();
  if (!e) return '';
  const ob = e.observe;
  return `<div class="table-scroll"><table class="data obs-table"><thead><tr><th>${esc(ob.x)}</th>${ob.cols.map(c => `<th>${esc(obsColLabel(c))}${c.sensor ? ' <small class="muted">센서</small>' : ''}</th>`).join('')}${editable && ob.addRows ? '<th></th>' : ''}</tr></thead><tbody>
    ${o.rows.map((row, ri) => `<tr>
      <td>${editable && ob.addRows ? `<input class="inline" data-obs="${ri}.0" value="${esc(row[0])}">` : esc(row[0])}</td>
      ${ob.cols.map((c, ci) => `<td>${editable
        ? `<input class="inline ${c.num ? 'num' : ''}" data-obs="${ri}.${ci + 1}" value="${esc(row[ci + 1])}" ${c.num ? 'inputmode="decimal"' : ''} placeholder="${c.num ? '숫자' : '관찰한 모습'}">`
        : (row[ci + 1] !== '' ? esc(row[ci + 1]) : '<span class="blank">-</span>')}</td>`).join('')}
      ${editable && ob.addRows ? `<td><button class="icon-btn" data-action="obsRemoveRow" data-i="${ri}" title="줄 삭제">✕</button></td>` : ''}
    </tr>`).join('')}</tbody></table></div>`;
}
// 숫자 열을 단위별로 묶어 그래프 하나씩
function obsGroups(e) {
  const groups = [];
  e.observe.cols.forEach((c, ci) => {
    if (!c.num) return;
    let g = groups.find(x => x.unit === c.unit);
    if (!g) groups.push(g = { unit: c.unit, cols: [] });
    g.cols.push(ci);
  });
  return groups;
}
const obsX = label => { // '3일째' → 3, '12시 30분' → 12.5
  const t = /(\d+)\s*시\s*(?:(\d+)\s*분)?/.exec(label);
  if (t) return Number(t[1]) + (t[2] ? Number(t[2]) / 60 : 0);
  const n = /(\d+(?:\.\d+)?)/.exec(label);
  return n ? Number(n[1]) : null;
};
function drawObsChart(canvas, e, g, opts = {}) {
  const o = obsData();
  const num = v => (v === '' || v === null || isNaN(Number(v)) ? null : Number(v));
  const yLabel = g.cols.length === 1 ? obsColLabel(e.observe.cols[g.cols[0]]) : (g.unit || '값');
  if (e.observe.x === '조건') {
    drawBars(canvas, o.rows.map(r => r[0]), g.cols.map((ci, i) => ({ name: e.observe.cols[ci].name, color: PLOT_COLORS[i], values: o.rows.map(r => num(r[ci + 1])) })), { ...opts, xLabel: e.observe.x, yLabel });
  } else {
    drawPlot(canvas, g.cols.map((ci, i) => ({ name: e.observe.cols[ci].name, color: PLOT_COLORS[i], points: o.rows.map(r => [obsX(r[0]), num(r[ci + 1])]).filter(p => p[0] !== null) })),
      { ...opts, xLabel: e.observe.x === '시각' ? '시각 (시)' : `${e.observe.x} (일째)`, yLabel, xMinZero: false, empty: '관찰 결과를 기록하면 그래프가 그려집니다' });
  }
}
function obsChartsHtml(prefix) {
  const e = observeExp();
  return e ? `<div class="obs-charts">${obsGroups(e).map((g, gi) => `<div class="chart-wrap obs"><canvas id="${prefix}${gi}"></canvas></div>`).join('')}</div>` : '';
}
function drawObsCharts(prefix) {
  const e = observeExp();
  if (!e) return;
  obsGroups(e).forEach((g, gi) => { const c = $(`#${prefix}${gi}`); if (c) drawObsChart(c, e, g); });
}
function obsChartImages() {
  const e = observeExp();
  if (!e) return [];
  return obsGroups(e).map(g => { const c = document.createElement('canvas'); drawObsChart(c, e, g, { width: 760, height: 300, background: '#ffffff' }); return c.toDataURL('image/png'); });
}
// 센서 측정 기록에서 조건 이름이 같은 측정의 평균값(뒤쪽 1/3)을 가져옴
function obsFillSensor() {
  const e = observeExp(), o = obsData();
  if (!e) return;
  const norm = s => String(s).replace(/\s|\(.*?\)/g, '');
  let filled = 0;
  e.observe.cols.forEach((c, ci) => {
    if (!c.sensor) return;
    o.rows.forEach(row => {
      const run = state.data.runs.find(r => norm(r.label) === norm(row[0]));
      if (!run || !run.rows.length) return;
      const ys = run.rows.map(r => r[1]).filter(v => v !== null && isFinite(v));
      const tail = ys.slice(Math.floor(ys.length * 2 / 3));
      if (!tail.length) return;
      row[ci + 1] = String(Math.round(tail.reduce((a, b) => a + b, 0) / tail.length * 10) / 10);
      filled++;
    });
  });
  save();
  toast(filled ? `센서 측정값 ${filled}개를 넣었어요.` : '측정 조건 이름이 표의 조건과 같은 측정 기록이 없어요. 측정할 때 조건 이름을 표와 같게 해 주세요.', filled ? '' : 'warn');
  const box = $('#obsBox'); if (box) box.innerHTML = obsTableHtml(true);
}
function obsCard(editable, heading) {
  const e = observeExp();
  if (!e) return '';
  const hasSensorCol = e.observe.cols.some(c => c.sensor);
  return `
  <section class="card obs-card">
    <div class="card-head"><h3>${heading}</h3>
      ${editable ? `<div class="row-gap">${hasSensorCol ? '<button class="btn small ghost" data-action="obsFillSensor">센서 값 넣기</button>' : ''}${e.observe.addRows ? '<button class="btn small ghost" data-action="obsAddRow">+ 줄 추가</button>' : ''}</div>` : ''}</div>
    ${editable ? `<p class="muted small">${esc(e.observe.hint)}</p>` : ''}
    <div id="obsBox">${obsTableHtml(editable)}</div>
    ${editable ? '' : obsChartsHtml(heading.includes('다시') ? 'obsC' : 'obsA')}
  </section>`;
}
const supportBanner = () => {
  const e = observeExp();
  return e ? `<div class="support-banner"><b>이 차시의 탐구 중심은 '${esc(e.observe.focus)}'이에요.</b> 주요 결과는 <b>관찰 결과 기록</b>이고, 디지털 센서는 실험 조건이 제대로 달랐는지 <b>확인하는 도구</b>로 써요.</div>` : '';
};

/* ───────── 필수 점검: 좋은 탐구 질문(1단계), 안전 점검(2단계) ───────── */
function uncheckedItems(stepKey) {
  if (stepKey === 'predict') return QUESTION_CHECKS.filter(([k]) => !state.question.checks[k]).map(([, t]) => t);
  if (stepKey === 'design') return safetyList().filter((_, i) => !state.design.safety['s' + i]);
  return [];
}
// 목표 단계로 가기 전에 지나야 하는 점검이 남아 있으면 알림을 띄우고 true
function blockedBefore(to) {
  for (const key of ['predict', 'design']) {
    if (to <= STEP[key]) continue;
    const left = uncheckedItems(key);
    if (!left.length) continue;
    if (state.step !== STEP[key]) { state.step = STEP[key]; save(); render(); }
    showNotice(key, left);
    return true;
  }
  return false;
}
function showNotice(key, items) {
  const title = key === 'predict' ? '좋은 탐구 질문인지 점검해 주세요' : '안전 점검을 모두 확인해 주세요';
  const lead = key === 'predict'
    ? '다음 단계로 가기 전에 내 탐구 질문이 아래 내용을 만족하는지 확인하고, 오른쪽 <b>좋은 탐구 질문 점검</b>에 체크하세요.'
    : '실험을 시작하기 전에 아래 안전 수칙을 하나씩 읽고, <b>안전 점검</b>에 모두 체크하세요.';
  const old = $('#noticeModal'); if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-back" id="noticeModal" role="alertdialog" aria-modal="true" aria-labelledby="noticeTitle">
      <div class="modal ${key === 'design' ? 'safety' : ''}">
        <h3 id="noticeTitle">${key === 'design' ? '⚠️ ' : '✔️ '}${title}</h3>
        <p>${lead}</p>
        <p class="muted small">아직 체크하지 않은 항목 ${items.length}개</p>
        <ul>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="row-end"><button class="btn primary" data-action="closeNotice">확인하러 가기</button></div>
      </div>
    </div>`);
  ui.flashKey = key;
  $('#noticeModal .btn').focus();
}
function flashChecklist() {
  const box = ui.flashKey === 'design' ? $('[data-bind^="design.safety.s"]') : $('[data-bind^="question.checks."]');
  const list = box && box.closest('.checklist');
  if (!list) return;
  list.scrollIntoView({ behavior: 'smooth', block: 'center' });
  list.querySelectorAll('input[type=checkbox]').forEach(cb => cb.closest('.check').classList.toggle('need', !cb.checked));
  list.classList.remove('flash'); void list.offsetWidth; list.classList.add('flash');
}

/* ───────── 탐구 도우미 챗봇 ───────── */
const CHAT_STEPS = ['measure', 'analysis'];
const CHAT_SUGGEST = {
  measure: ['센서 값이 이상하게 나와요', '측정 간격은 어떻게 정해요?', '다른 탐구도 해 보고 싶어요'],
  analysis: ['그래프에서 무엇을 봐야 해요?', '평균 변화율이 뭐예요?', '예상과 결과가 달라요', '다른 탐구도 해 보고 싶어요'],
};
const chatVisible = () => CHAT_STEPS.includes(STEPS[state.step].key);
if (ui.chatOpen === undefined) ui.chatOpen = window.innerWidth >= 1100;

function renderChat() {
  const panel = $('#chatPanel'), fab = $('#chatFab');
  const show = chatVisible();
  panel.hidden = !show || !ui.chatOpen;
  fab.hidden = !show || ui.chatOpen;
  document.body.classList.toggle('with-chat', show && ui.chatOpen);
  if (!show || !ui.chatOpen) return;
  const ready = aiReady();
  const used = state.chat.filter(c => c.role === 'user').length;
  panel.innerHTML = `
    <div class="chat-head"><b>💬 탐구 도우미</b><button class="icon-btn" data-action="chatToggle" title="닫기">✕</button></div>
    <div class="chat-body" id="chatBody">
      <div class="chat-msg bot">실험하다가 궁금한 점을 물어보세요. 답을 바로 알려 주기보다 스스로 생각할 수 있게 도와줄게요.</div>
      ${state.chat.map(c => `<div class="chat-msg ${c.role === 'user' ? 'me' : 'bot'} ${c.error ? 'err' : ''}">${chatText(c.text)}</div>`).join('')}
      ${ui.chatBusy ? `<div class="chat-msg bot" id="chatLive">${ui.chatLive ? chatText(ui.chatLive) : '<span class="typing">생각하는 중…</span>'}</div>` : ''}
    </div>
    <div class="chat-suggest">${(CHAT_SUGGEST[STEPS[state.step].key] || []).map(s => `<button class="chip-btn sm" data-action="chatSuggest" data-value="${esc(s)}" ${!ready || ui.chatBusy ? 'disabled' : ''}>${esc(s)}</button>`).join('')}</div>
    ${ready ? '' : '<p class="chat-note warn">선생님이 AI 설정을 마치면 사용할 수 있어요.</p>'}
    <div class="chat-input">
      <textarea id="chatInput" rows="2" maxlength="${CHAT_MAX_INPUT}" placeholder="궁금한 점을 써 보세요 (Enter로 보내기)" ${!ready || ui.chatBusy ? 'disabled' : ''}>${esc(ui.chatDraft || '')}</textarea>
      <button class="btn primary" data-action="chatSend" ${!ready || ui.chatBusy ? 'disabled' : ''}>보내기</button>
    </div>
    <p class="chat-note">AI는 틀릴 수 있어요. 위험한 실험은 꼭 선생님과 함께 해요. 이름 같은 개인정보는 쓰지 마세요. (${used}/${CHAT_MAX_PER_REPORT})
      ${state.chat.length ? '<button class="link-btn" data-action="chatClear">대화 지우기</button>' : ''}</p>`;
  const body = $('#chatBody'); body.scrollTop = body.scrollHeight;
}

async function chatSend(text) {
  const q = String(text || '').trim().slice(0, CHAT_MAX_INPUT);
  if (!q || ui.chatBusy) return;
  if (!aiReady()) return toast('선생님이 AI 설정을 마치면 사용할 수 있어요.', 'warn');
  if (state.chat.filter(c => c.role === 'user').length >= CHAT_MAX_PER_REPORT) return toast('이 보고서에서 물어볼 수 있는 횟수를 다 썼어요. 선생님께 여쭤보세요.', 'warn');
  if (Date.now() - (ui.chatLastAt || 0) < CHAT_COOLDOWN_MS) return toast('조금만 기다렸다가 다시 물어보세요.', 'warn');
  // 전화번호·주민등록번호처럼 보이는 개인정보는 보내지 않음
  if (/01[016789][-\s]?\d{3,4}[-\s]?\d{4}|\d{6}[-\s]?[1-4]\d{6}/.test(q)) return toast('전화번호 같은 개인정보는 쓰지 않아요.', 'warn');
  ui.chatLastAt = Date.now();
  const userMsg = { role: 'user', text: q };
  state.chat.push(userMsg);
  ui.chatDraft = ''; ui.chatBusy = true; ui.chatLive = '';
  renderChat();
  try {
    const res = await sendChatMessage(q, delta => {
      ui.chatLive += delta;
      const live = $('#chatLive');
      if (live) { live.innerHTML = chatText(ui.chatLive); const b = $('#chatBody'); b.scrollTop = b.scrollHeight; }
    });
    state.chat.push({ role: 'assistant', text: res.text || '답을 만들지 못했어요. 다시 물어봐 주세요.' });
  } catch (e) {
    userMsg.error = true; // 실패한 질문은 다음 대화 맥락에서 뺌
    state.chat.push({ role: 'assistant', text: e.message, error: true });
  }
  ui.chatBusy = false; ui.chatLive = '';
  save();
  renderChat();
  const input = $('#chatInput'); if (input) input.focus();
}

/* ───────── 측정 ───────── */
const activeRun = () => state.data.runs.find(r => r.id === ui.activeRunId);

function attachDriver(d) {
  d.on('status', (msg, i) => { const el = $('#connStatus'); if (el && i === ui.slot) el.textContent = '… ' + msg; });
  d.on('channels', () => {
    const run = activeRun();
    if (run && d.measuring) {
      d.channels.filter(c => c.enabled && !run.channels.some(rc => rc.id === c.id)).forEach(c => run.channels.push({ id: c.id, name: c.name, unit: c.unit }));
    }
    const box = $('#channelBox'); if (box) box.innerHTML = channelBox();
    document.querySelectorAll('[data-action="pickSlot"]').forEach(b => { b.outerHTML = slotTab(Number(b.dataset.i)); });
    updateLive();
  });
  d.on('sample', ({ t, values }) => {
    const run = activeRun();
    if (!run || !d.measuring) return;
    if (run.mode === 'manual') { // 수동 기록: 값만 보여 주고, [값 기록]을 누를 때 저장
      ui.preview = values; ui.latestAt = Date.now();
      queueLive();
      return;
    }
    const row = [t, ...run.channels.map(c => (values[c.id] !== undefined ? values[c.id] : null))];
    if (row.slice(1).every(v => v === null)) return;
    run.rows.push(row);
    ui.preview = values;
    queueLive();
    const dur = Number(state.design.durationSec);
    if (dur > 0 && t >= dur) stopMeasure();
  });
  d.on('preview', values => { ui.preview = values; queueLive(); });
  d.on('raw', ({ uuid, bytes }, i) => {
    const line = `${new Date().toLocaleTimeString('ko-KR', { hour12: false })}  ${shortUuid(uuid)}  ${toHex(bytes)}  |${toAscii(bytes)}|`;
    const raw = i === ui.slot ? ui.raw : ui.slots[i].raw;
    raw.push(line);
    if (raw.length > 30) raw.shift();
    const el = $('#rawLog');
    if (el && i === ui.slot && el.closest('details').open) { el.textContent = rawText(); el.scrollTop = el.scrollHeight; }
  });
  d.on('disconnected', i => {
    if (ui.activeRunId && !d.measuring) finishRun();
    const sl = d.slots[i];
    if (sl && !sl.userClosed) toast(`센서 ${i + 1} 연결이 끊어졌습니다. 전원과 거리를 확인한 뒤 다시 연결하세요.`, 'warn');
    refreshBrandPanel();
    updateMeasureButtons();
  });
}

function queueLive() {
  if (ui.liveQueued) return;
  ui.liveQueued = true;
  requestAnimationFrame(() => { ui.liveQueued = false; updateLive(); });
}

function updateLive() {
  const tiles = $('#liveTiles');
  if (!tiles) return;
  const chans = driver && driver.connected ? driver.channels.filter(c => c.enabled) : [];
  tiles.innerHTML = chans.length ? chans.map(c => `
    <div class="tile"><div class="t-name">${driver.live.length > 1 ? `<span class="slot-badge">센서 ${c.slot + 1}</span> ` : ''}${esc(c.name)}</div><div class="t-val">${fmt(ui.preview[c.id], 3)}<small>${esc(c.unit)}</small></div></div>`).join('')
    : '<div class="tile empty">센서를 연결하면 실시간 값이 표시됩니다</div>';

  const run = activeRun() || (ui.showRunId && state.data.runs.find(r => r.id === ui.showRunId));
  const canvas = $('#liveChart');
  if (canvas) {
    const sp = run ? splitAxes(run.channels) : { right: () => false, yLabel: '측정값', y2Label: '' };
    const series = run ? run.channels.map((c, i) => ({ name: `${c.name}${c.unit ? ` (${c.unit})` : ''}`, color: PLOT_COLORS[i % PLOT_COLORS.length],
      axis: sp.right(c) ? 'right' : 'left', points: run.rows.map(r => [r[0], r[i + 1] ?? null]) })) : [];
    const manualRun = run && run.mode === 'manual';
    drawPlot(canvas, series, { xLabel: run ? (run.xLabel || '시간 (s)') : '시간 (s)', yLabel: sp.yLabel, y2Label: sp.y2Label, xMinZero: !manualRun,
      yRange: run ? axisRange(sp.yLabel) : null, y2Range: run ? axisRange(sp.y2Label) : null,
      empty: run ? (manualRun ? '[값 기록]을 누르면 점이 찍혀요' : '데이터 수신 대기 중…') : undefined });
    afterChart(canvas);
  }
  const ml = $('#manualList');
  if (ml) {
    const mr = run && run.mode === 'manual' ? run : null;
    ml.innerHTML = mr && mr.rows.length ? `<table class="data"><thead><tr><th>#</th><th>${esc(mr.xLabel)} / 메모</th>${mr.channels.map(c => `<th>${esc(c.name)}${c.unit ? ` (${esc(c.unit)})` : ''}</th>`).join('')}</tr></thead><tbody>
      ${mr.rows.map((row, i) => `<tr><td>${i + 1}</td><td>${esc((mr.notes || [])[i] || String(row[0]))}</td>${row.slice(1).map(v => `<td>${fmt(v)}</td>`).join('')}</tr>`).reverse().join('')}</tbody></table>`
      : '<p class="muted small center">아직 기록한 값이 없어요.</p>';
  }
  const bar = $('#progBar');
  if (bar) {
    const dur = Number(state.design.durationSec);
    const r = activeRun();
    const t = r && r.rows.length ? r.rows[r.rows.length - 1][0] : 0;
    bar.style.width = r && dur > 0 ? Math.min(100, t / dur * 100) + '%' : '0%';
  }
  const list = $('#runList');
  if (list && activeRun() && !list.contains(document.activeElement)) list.innerHTML = runList();
}

// 한 측정에 단위가 다른 값이 함께 있으면 두 번째 단위의 값들을 오른쪽 y축으로
function splitAxes(chans) {
  const units = [...new Set(chans.map(c => c.unit))];
  const label = list => (list.length === 1 ? `${list[0].name}${list[0].unit ? ` (${list[0].unit})` : ''}`
    : `${list.map(c => c.name).join(', ')}${list[0] && list[0].unit ? ` (${list[0].unit})` : ''}`);
  if (units.length < 2) return { right: () => false, yLabel: chans.length ? label(chans) : '측정값', y2Label: '' };
  const r = units[1];
  const left = chans.filter(c => c.unit !== r), right = chans.filter(c => c.unit === r);
  return { right: c => c.unit === r, yLabel: units.length > 2 ? '측정값' : label(left), y2Label: label(right) };
}

function updateMeasureButtons() {
  const s = $('#btnStart'), p = $('#btnStop');
  if (!s) return;
  const measuring = driver && driver.measuring;
  s.disabled = !!measuring || !(driver && driver.connected);
  p.disabled = !measuring;
  document.querySelectorAll('.brand, .mode-btn').forEach(b => { b.disabled = !!measuring; });
  const run = activeRun();
  const recording = !!(measuring && run && run.mode === 'manual');
  const rec = $('#btnRecord'), undo = $('#btnUndo');
  if (rec) rec.disabled = !recording;
  if (undo) undo.disabled = !recording;
}

async function startMeasure() {
  if (!driver || !driver.connected) return toast('먼저 센서를 연결하세요.', 'warn');
  const label0 = ($('#runLabel').value || '').trim();
  if (label0) ui.runLabel = label0;
  driver.slots.forEach(d => applySimExperiment(d)); // 실험을 바꿨을 수도 있으니 측정 직전에 다시 맞춤
  const chans = driver.channels.filter(c => c.enabled);
  if (!chans.length) return toast('측정할 채널을 선택하세요.', 'warn');
  const label = ($('#runLabel').value || '').trim() || `시행 ${state.data.runs.length + 1}`;
  const manual = state.design.measureMode === 'manual';
  // 수동 기록은 화면 값을 0.2초마다 갱신하고, 기록은 버튼으로만 함
  const interval = manual ? 0.2 : Math.max(0.01, Number(state.design.intervalSec) || 1);
  const run = { id: uid(), label, brand: driver.brand, device: driver.deviceName, channels: chans.map(c => ({ id: c.id, name: c.name, unit: c.unit })), rows: [], createdAt: Date.now(),
    mode: manual ? 'manual' : 'auto', xLabel: manual ? (state.design.manualX.trim() || '기록 번호') : '시간 (s)', notes: [],
    by: inGroup() ? state.group.nick : '' };
  state.data.runs.push(run);
  // 센서 2개로 처음 측정하면 분석 그래프에 두 센서 값을 함께 보이게 맞춰 둠
  // (단위가 다르면 왼쪽·오른쪽 y축, 온도 2개처럼 단위가 같으면 한 축에 겹쳐 그림)
  const s2 = chans.find(c => c.slot === 1), s1 = chans.find(c => c.slot === 0);
  if (s1 && s2 && !state.result.channel2) { state.result.channel = `${s1.name}|${s1.unit}`; state.result.channel2 = `${s2.name}|${s2.unit}`; }
  ui.activeRunId = run.id;
  ui.showRunId = null;
  ui.latestAt = 0;
  try {
    const actualMs = await driver.start(interval * 1000);
    if (!manual && Math.abs(actualMs - interval * 1000) > 1) toast(`센서 최소 간격에 맞춰 ${actualMs / 1000}초 간격으로 측정합니다.`);
    toast(manual ? `"${label}" 수동 기록을 시작합니다. 원하는 때에 [값 기록]을 누르세요.` : `"${label}" 측정을 시작합니다.`);
    if (manual) { const x = $('#recX'); if (x) x.focus(); }
  } catch (e) {
    state.data.runs = state.data.runs.filter(r => r.id !== run.id);
    ui.activeRunId = null;
    toast(e.message || String(e), 'warn');
  }
  $('#runList').innerHTML = runList();
  updateMeasureButtons();
  const box = $('#channelBox'); if (box) box.innerHTML = channelBox();
  save();
}

// 수동 기록: 지금 센서 값을 한 점으로 저장
function recordValue() {
  const run = activeRun();
  if (!run || run.mode !== 'manual' || !driver || !driver.measuring) return toast('먼저 [기록 시작]을 누르세요.', 'warn');
  if (!ui.latestAt || Date.now() - ui.latestAt > 3000) return toast('센서 값이 아직 들어오지 않았어요. 잠시 뒤에 다시 누르세요.', 'warn');
  const input = $('#recX');
  const memo = input ? input.value.trim() : '';
  const num = memo !== '' && !isNaN(Number(memo)) ? Number(memo) : null;
  const x = num !== null ? num : run.rows.length + 1;
  const row = [x, ...run.channels.map(c => (ui.preview[c.id] !== undefined ? ui.preview[c.id] : null))];
  if (row.slice(1).every(v => v === null)) return toast('기록할 센서 값이 없어요.', 'warn');
  run.rows.push(row);
  (run.notes = run.notes || []).push(memo);
  // 숫자를 썼다면 다음 값을 같은 간격으로 미리 채워 둠 (예: 0 → 2 → 4)
  if (input) {
    if (num !== null) {
      const prev = run.rows.length > 1 ? run.rows[run.rows.length - 2][0] : null;
      const step = prev !== null && run.notes[run.notes.length - 2] !== '' ? num - prev : 1;
      input.value = String(Math.round((num + (step || 1)) * 1000) / 1000);
    } else input.value = '';
    input.select();
  }
  toast(`${run.rows.length}번째 값을 기록했어요.`);
  save();
  updateLive();
}

async function stopMeasure() {
  if (!driver || !driver.measuring) return;
  await driver.stop();
  finishRun();
}

function finishRun() {
  const run = activeRun();
  ui.activeRunId = null;
  if (run) {
    if (!run.rows.length) {
      state.data.runs = state.data.runs.filter(r => r.id !== run.id);
      if (run.mode === 'manual') toast('기록한 값이 없어 이 측정은 저장하지 않았어요.');
    } else { ui.showRunId = run.id; toast(`"${run.label}" ${run.mode === 'manual' ? '기록' : '측정'} 완료 (${run.rows.length}개)`); }
  }
  const levels = ivLevels();
  const doneLabels = state.data.runs.map(r => r.label);
  ui.runLabel = levels.find(l => !doneLabels.includes(l)) || `시행 ${state.data.runs.length + 1}`;
  const input = $('#runLabel'); if (input) input.value = ui.runLabel;
  const list = $('#runList'); if (list) list.innerHTML = runList();
  const cnt = document.querySelector('.card-head .count'); if (cnt) cnt.textContent = state.data.runs.length;
  const box = $('#channelBox'); if (box) box.innerHTML = channelBox();
  updateMeasureButtons();
  updateLive();
  save(true);
}

// 가상 센서용: 지금 측정 조건이 '다르게 할 조건' 중 몇 번째인지(k), 수동 기록의 가로축 값(x)
function simContext() {
  const run = activeRun();
  const label = String(run ? run.label : ui.runLabel || '').replace(/\s/g, '');
  let k = ivLevels().findIndex(l => l.replace(/\s/g, '') === label);
  if (k < 0) k = run ? Math.max(0, state.data.runs.indexOf(run)) : state.data.runs.length;
  const xi = $('#recX');
  const x = xi && xi.value.trim() !== '' && !isNaN(Number(xi.value)) ? Number(xi.value) : null;
  return { k, x };
}
function applySimExperiment(d) {
  if (!d || d.brand !== 'sim') return false;
  const exp = currentExperiment();
  if (exp && d.useExperiment(exp, simContext)) return true;
  if (d.exp) d.setSensor(state.design.sensor || recSensors()[0] || 'temp');
  return false;
}

async function connect() {
  if (driver.measuring) return toast('측정 중에는 센서를 새로 연결할 수 없어요. 먼저 정지하세요.', 'warn');
  const slot = ui.slot;
  const old = driver.slots[slot];
  if (old && old.connected) await old.disconnect();
  let d;
  if (ui.brand === 'vernier') d = new VernierDriver();
  else if (ui.brand === 'sim') d = new SimulationDriver(state.design.sensor || recSensors()[0] || 'temp');
  else if (ui.brand === 'pasco') d = new PascoDriver(ui.cfg);
  else if (ui.brand === 'sciencecube') d = new ScienceCubeDriver();
  else d = new GenericBleDriver(ui.brand, ui.cfg);
  if (ui.brand !== 'sim' && !('bluetooth' in navigator)) return toast('이 브라우저는 블루투스를 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.', 'warn');
  ui.raw = [];
  driver.setSlot(slot, d);
  applySimExperiment(d);
  try {
    await d.connect();
    toast(`센서 ${slot + 1}: ${d.deviceName} 연결 완료`);
  } catch (e) {
    if (e && e.name === 'NotFoundError') toast('기기 선택이 취소되었습니다.');
    else toast('연결 실패: ' + (e.message || e), 'warn');
    if (d.connected) await d.disconnect();
  }
  refreshBrandPanel();
  updateMeasureButtons();
  updateLive();
}

function refreshBrandPanel() {
  const p = $('#brandPanel');
  if (p) p.innerHTML = brandPanel();
  document.querySelectorAll('[data-action="pickSlot"]').forEach(b => { b.outerHTML = slotTab(Number(b.dataset.i)); });
  const c = $('#connBar');
  if (c) c.innerHTML = connBar();
}

/* CSV 내보내기·가져오기 */
function exportCsv() {
  const runs = state.data.runs;
  const header = [], cols = [];
  runs.forEach(r => {
    header.push(`${r.label}: ${r.mode === 'manual' ? r.xLabel : '시간(s)'}`);
    cols.push(r.rows.map(x => x[0]));
    if (r.mode === 'manual') { header.push(`${r.label}: 메모`); cols.push(r.rows.map((_, i) => (r.notes || [])[i] || '')); }
    r.channels.forEach((c, i) => { header.push(`${r.label}: ${c.name}${c.unit ? `(${c.unit})` : ''}`); cols.push(r.rows.map(x => x[i + 1])); });
  });
  const n = Math.max(0, ...cols.map(c => c.length));
  const q = s => /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s;
  const lines = [header.map(q).join(',')];
  for (let i = 0; i < n; i++) lines.push(cols.map(c => (c[i] === null || c[i] === undefined ? '' : q(String(c[i])))).join(','));
  const name = `탐구데이터_${state.meta.name || '학생'}_${state.meta.date || today()}.csv`;
  download(name, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

function importCsv(text, filename) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const delim = [',', '\t', ';'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const rows = lines.map(l => {
    const out = []; let cur = '', inQ = false;
    for (const ch of l) {
      if (ch === '"') inQ = !inQ;
      else if (ch === delim && !inQ) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
  const isNum = s => s !== '' && !isNaN(Number(s));
  const dataStart = rows.findIndex(r => isNum(r[0]) && r.filter(isNum).length >= 2);
  if (dataStart < 0) throw new Error('숫자 데이터를 찾지 못했습니다.');
  const header = dataStart > 0 ? rows[dataStart - 1] : rows[0].map((_, i) => (i === 0 ? '시간' : `값${i}`));
  const isTime = h => /time|시간|^t\s*\(|^t$/i.test(h || '');
  // 시간 열마다 새로운 시행으로 묶기 (SPARKvue·Graphical Analysis의 여러 Run 형식 대응)
  const groups = [];
  header.forEach((h, i) => {
    if (i === 0 || isTime(h)) groups.push({ timeCol: i, cols: [] });
    else groups[groups.length - 1].cols.push(i);
  });
  const parseHead = h => {
    const label = (/^(.*?):/.exec(h) || [])[1];
    const body = h.replace(/^.*?:\s*/, '');
    const m = /^(.*?)\s*[([]([^)\]]*)[)\]]\s*$/.exec(body);
    return { label, name: (m ? m[1] : body) || '값', unit: m ? m[2] : '' };
  };
  let added = 0;
  groups.forEach((g, gi) => {
    if (!g.cols.length) return;
    const chans = g.cols.map((c, i) => ({ id: i, ...parseHead(header[c]) }));
    const data = rows.slice(dataStart).filter(r => isNum(r[g.timeCol])).map(r => [Number(r[g.timeCol]), ...g.cols.map(c => (isNum(r[c]) ? Number(r[c]) : null))]);
    if (!data.length) return;
    const label = parseHead(header[g.timeCol]).label || chans[0].label || (groups.length > 1 ? `가져온 데이터 ${gi + 1}` : filename.replace(/\.[^.]+$/, ''));
    state.data.runs.push({ id: uid(), label, brand: 'csv', device: '파일: ' + filename, channels: chans.map(({ id, name, unit }) => ({ id, name, unit })), rows: data, createdAt: Date.now() });
    added++;
  });
  if (!added) throw new Error('가져올 측정값 열이 없습니다.');
  return added;
}

/* ───────── 이벤트 ───────── */
const actions = {
  goto: el => {
    const to = Number(el.dataset.step);
    if (to > state.step && blockedBefore(to)) return;
    state.step = to; save(); render();
  },
  closeNotice: () => { const n = $('#noticeModal'); if (n) n.remove(); flashChecklist(); },
  home: async () => {
    if (state.step !== 0) { state.step = 0; save(); render(); return; }
    // 첫 화면에서 제목을 누르면 선택과 기록을 모두 지우고 새로 시작
    if (hasInquiryContent() && !confirm('처음 상태로 되돌릴까요? 선택한 수업과 지금까지의 탐구 기록이 모두 지워집니다.\n(남겨 두려면 [취소]를 누르고 먼저 [파일 저장]을 하세요)')) return;
    if (inGroup() && !confirm('모둠 탐구 중이에요. 처음 상태로 되돌리면 이 기기는 모둠에서 나가요. 계속할까요?')) return;
    groupLeave(true);
    if (driver && driver.connected) await driver.disconnect();
    clearTimeout(saveTimer);
    state = newState();
    save(true);
    location.reload();
  },
  obsFillSensor: () => obsFillSensor(),
  obsAddRow: () => {
    const e = observeExp(), o = obsData();
    if (!e) return;
    const last = o.rows.length ? obsX(o.rows[o.rows.length - 1][0]) : 0;
    o.rows.push([e.observe.x === '관찰한 날' ? `${(last || 0) + 1}일째` : '', ...e.observe.cols.map(() => '')]);
    save(); $('#obsBox').innerHTML = obsTableHtml(true);
  },
  obsRemoveRow: el => {
    const o = obsData();
    if (!o || o.rows.length <= 1) return;
    o.rows.splice(Number(el.dataset.i), 1);
    save(); $('#obsBox').innerHTML = obsTableHtml(true);
  },
  chatToggle: () => { ui.chatOpen = !ui.chatOpen; renderChat(); if (ui.chatOpen) { const i = $('#chatInput'); if (i && !i.disabled) i.focus(); } },
  chatSend: () => { const i = $('#chatInput'); chatSend(i ? i.value : ''); },
  chatSuggest: el => chatSend(el.dataset.value),
  chatClear: () => { if (!confirm('탐구 도우미와 나눈 대화를 지울까요?')) return; state.chat = []; save(); renderChat(); },
  prev: () => { state.step = Math.max(0, state.step - 1); save(); render(); },
  next: () => {
    if (state.step === 0 && !unitName()) return toast('학교급·학년·학기·단원을 선택하세요.', 'warn');
    if (blockedBefore(state.step + 1)) return;
    state.step = Math.min(STEPS.length - 1, state.step + 1); save(); render();
  },
  setLevel: el => {
    if (groupLocked()) return;
    if (el.dataset.value === state.meta.level || !startNewInquiry()) return;
    Object.assign(state.meta, { level: el.dataset.value, grade: '', semester: '', unit: '', std: '', group: '', ...NO_LESSON }); save(); render();
  },
  setGrade: el => {
    if (groupLocked()) return;
    if (el.dataset.value === state.meta.grade || !startNewInquiry()) return;
    Object.assign(state.meta, { grade: el.dataset.value, semester: '', unit: '', std: '', group: '', ...NO_LESSON }); save(); render();
  },
  setSemester: el => {
    if (groupLocked()) return;
    const m = state.meta;
    if (el.dataset.value === m.semester || !startNewInquiry()) return;
    Object.assign(m, { semester: el.dataset.value, unit: '', std: '', group: '', ...NO_LESSON });
    if (m.publisher && !publishersFor(m.grade, m.semester).includes(m.publisher)) m.publisher = '';
    save(); render();
  },
  setPublisher: el => {
    if (groupLocked()) return;
    const m = state.meta;
    if (el.dataset.value === m.publisher || !startNewInquiry()) return;
    m.publisher = el.dataset.value;
    // 같은 단원을 고른 상태면 그 교과서의 단원명으로 바꾸고 차시는 다시 고르게 함
    if (m.std) {
      const tb = m.publisher && textbookUnit(m.grade, m.semester, m.publisher, m.std);
      m.unit = tb ? tb.name : (ELEM_UNITS.find(u => u.std === m.std) || {}).name || m.unit;
      Object.assign(m, { lessonNo: 0, lesson: '' });
    }
    save(); render();
  },
  setUnit: el => {
    if (groupLocked()) return;
    const m = state.meta;
    const changed = (m.std || m.unit) !== (el.dataset.std || el.dataset.value) || m.customUnit.trim();
    if (!changed) return;
    if (!startNewInquiry()) return;
    Object.assign(m, NO_LESSON);
    Object.assign(m, { unit: el.dataset.value, std: el.dataset.std || '', group: el.dataset.group, customUnit: '' });
    save(); render();
  },
  setLesson: el => {
    if (groupLocked()) return;
    const m = state.meta;
    // 같은 차시를 다시 고르면 진행 중인 탐구를 그대로 이어 감
    if (m.lesson === el.dataset.value && Number(m.lessonNo) === Number(el.dataset.no) && !(m.customLesson || '').trim()) return;
    if (!startNewInquiry()) return;
    Object.assign(m, { lessonNo: Number(el.dataset.no), lesson: el.dataset.value, customLesson: '' });
    // 다른 차시를 고르면 이전 차시의 성취기준 선택은 해제하고, 이 차시의 성취기준만 선택
    const std = el.dataset.std;
    m.standards = std && unitInfo() ? [std] : [];
    if (el.dataset.exp) applyExperiment(el.dataset.exp, true);
    else if (el.dataset.sensor && !state.design.sensor) state.design.sensor = el.dataset.sensor;
    save();
    $('#lessonBox').innerHTML = lessonPicker();
    $('#unitPanel').innerHTML = unitPanel();
    renderHeader();
  },
  toggleStd: el => {
    const set = new Set(state.meta.standards || []);
    if (el.checked) set.add(el.value); else set.delete(el.value);
    state.meta.standards = (unitInfo() ? standardsFor(unitInfo().std) : []).map(s => s.code).filter(c => set.has(c));
    el.closest('.std').classList.toggle('on', el.checked);
    save();
  },
  startWithExample: el => {
    if (el.dataset.exp) applyExperiment(el.dataset.exp, true);
    else { state.question.question = el.dataset.value; if (el.dataset.sensor) state.design.sensor = el.dataset.sensor; }
    state.step = STEP.predict; save(); render();
  },
  pickExperiment: el => { applyExperiment(el.dataset.exp); save(); render(); },
  aiToggleSettings: () => { ui.aiSettingsOpen = !ui.aiSettingsOpen; const s = $('#aiSettings'); if (s) s.hidden = !ui.aiSettingsOpen; },
  aiSaveSettings: () => {
    saveAiSettings({ proxyUrl: $('#aiProxy').value.trim() });
    ui.aiSettingsOpen = false; ui.aiError = '';
    refreshAiCard();
    toast('AI 설정을 저장했어요.');
  },
  aiRequest: async () => {
    if (!aiReady()) { ui.aiSettingsOpen = true; ui.aiError = '먼저 학교 AI 서버 주소를 입력하세요.'; return refreshAiCard(); }
    ui.aiBusy = true; ui.aiError = '';
    refreshAiCard();
    try {
      state.result.ai = await requestAiFeedback();
      save(true);
      toast('AI 피드백이 도착했어요.');
    } catch (e) {
      ui.aiError = e.message || String(e);
    }
    ui.aiBusy = false;
    refreshAiCard();
  },
  setMode: el => {
    if (driver && driver.measuring) return toast('측정 중에는 방식을 바꿀 수 없어요. 먼저 정지하세요.', 'warn');
    state.design.measureMode = el.dataset.value; save(); render();
  },
  recordValue: () => recordValue(),
  undoRecord: () => {
    const run = activeRun();
    if (!run || run.mode !== 'manual' || !run.rows.length) return;
    run.rows.pop(); (run.notes || []).pop();
    save(); updateLive();
  },
  pickPre: el => {
    const pre = state.question.pre[state.expId] = state.question.pre[state.expId] || {};
    pre[el.dataset.q] = Number(el.dataset.o);
    save();
    el.closest('.pre-q').querySelectorAll('[data-action="pickPre"]').forEach(b => b.classList.toggle('on', b === el));
  },
  buildQuestion: () => {
    const iv = (state.question.qIv || '').trim(), dv = (state.question.qDv || '').trim();
    if (!iv || !dv) return toast('다르게 할 것과 측정할 것을 모두 입력하세요.', 'warn');
    state.question.question = `${iv}에 따라 ${dv}은(는) 어떻게 달라질까?`;
    save(); render();
  },
  useExample: el => {
    if (el.dataset.exp) applyExperiment(el.dataset.exp);
    else { state.question.question = el.dataset.value; if (!state.design.sensor) state.design.sensor = el.dataset.sensor; }
    save(); render();
  },
  addItem: el => { getPath(state, el.dataset.path).push(''); save(); render(); },
  removeItem: el => {
    const arr = getPath(state, el.dataset.path);
    arr.splice(Number(el.dataset.i), 1);
    if (!arr.length) arr.push('');
    save(); render();
  },
  moveItem: el => {
    const arr = getPath(state, el.dataset.path), i = Number(el.dataset.i);
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    save(); render();
  },
  pickBrand: async el => {
    const b = el.dataset.value;
    if (ui.brand === b) return;
    const cur = sd();
    if (cur && cur.connected && cur.brand !== b) await cur.disconnect();
    ui.brand = b;
    ui.cfg = BRAND_PRESETS[b] ? getBrandConfig(b) : null;
    ui.raw = [];
    document.querySelectorAll('.brand').forEach(x => x.classList.toggle('on', x.dataset.value === b));
    refreshBrandPanel();
    updateMeasureButtons();
    updateLive();
  },
  connect: () => connect(),
  disconnect: async () => { const cur = sd(); if (cur) { cur.userClosed = true; await cur.disconnect(); } refreshBrandPanel(); updateMeasureButtons(); updateLive(); },
  axisApply: el => {
    const row = el.closest('.axis-row');
    const min = Number(row.querySelector('[data-axmin]').value), max = Number(row.querySelector('[data-axmax]').value);
    if (!isFinite(min) || !isFinite(max) || row.querySelector('[data-axmin]').value === '' || row.querySelector('[data-axmax]').value === '') return toast('최솟값과 최댓값을 숫자로 입력하세요.', 'warn');
    if (max <= min) return toast('최댓값은 최솟값보다 커야 해요.', 'warn');
    document.activeElement && document.activeElement.blur();
    setAxisRange(row.dataset.label, { min, max });
  },
  axisAuto: el => { document.activeElement && document.activeElement.blur(); setAxisRange(el.closest('.axis-row').dataset.label, null); },
  pickSlot: el => { if (driver.measuring) return toast('측정 중에는 바꿀 수 없어요.', 'warn'); switchSlot(Number(el.dataset.i)); },
  toggleChannel: el => { const cur = sd(); cur.channels[Number(el.dataset.i)].enabled = el.checked; if (cur.refreshChannels) cur.refreshChannels(); updateLive(); },
  startMeasure: () => startMeasure(),
  stopMeasure: () => stopMeasure(),
  showRun: el => { ui.showRunId = el.dataset.id; updateLive(); $('#liveChart').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  deleteRun: el => {
    const run = state.data.runs.find(r => r.id === el.dataset.id);
    if (!run || !confirm(`"${run.label}" 측정 기록을 삭제할까요?`)) return;
    state.data.runs = state.data.runs.filter(r => r.id !== run.id);
    if (ui.showRunId === run.id) ui.showRunId = null;
    save(); $('#runList').innerHTML = runList(); updateLive();
    const h = document.querySelector('.card-head .count'); if (h) h.textContent = state.data.runs.length;
  },
  exportCsv: () => exportCsv(),
  addField: () => { readDecoderForm(); ui.cfg.decoder.fields.push({ name: `값${ui.cfg.decoder.fields.length + 1}`, unit: '', offset: 0, type: 'int16', le: true, scale: 1, add: 0 }); ui.advOpen = true; refreshBrandPanel(); },
  delField: el => { readDecoderForm(); ui.cfg.decoder.fields.splice(Number(el.dataset.i), 1); ui.advOpen = true; refreshBrandPanel(); },
  saveConfig: () => {
    readDecoderForm();
    saveBrandConfig(ui.brand, ui.cfg);
    if (sd() && sd().brand === ui.brand && sd().applyDecoder) sd().applyDecoder(ui.cfg.decoder);
    ui.advOpen = true; refreshBrandPanel(); updateLive();
    toast('설정을 저장했습니다. 이름 필터·서비스 UUID 변경은 다시 연결할 때 적용됩니다.');
  },
  resetConfig: () => {
    if (!confirm('이 제조사의 데이터 해석 설정을 기본값으로 되돌릴까요?')) return;
    localStorage.removeItem('sensor-config-' + ui.brand);
    ui.cfg = getBrandConfig(ui.brand);
    if (sd() && sd().brand === ui.brand && sd().applyDecoder) { sd().config = ui.cfg; sd().applyDecoder(ui.cfg.decoder); }
    ui.advOpen = true; refreshBrandPanel();
  },
  pickChannel: el => { state.result.channel = el.value; currentKey2(); save(); refreshAxisUi(); },
  pickChannel2: el => { state.result.channel2 = el.value; save(); refreshAxisUi(); },
  toggleRun: el => {
    state.result.hidden[el.dataset.id] = !el.checked;
    save(); $('#statsBox').innerHTML = statsBoxHtml(); drawResult();
  },
  print: () => window.print(),
  saveJson: () => download(`탐구보고서_${state.meta.name || '학생'}_${state.meta.date || today()}.json`, JSON.stringify(state, null, 1), 'application/json'),
  loadJson: () => { if (inGroup()) return toast('모둠 탐구 중에는 파일을 불러올 수 없어요. 모둠에서 나간 뒤 불러오세요.', 'warn'); $('#jsonFile').click(); },
  groupMode: el => {
    if (inGroup()) return;
    state.group.mode = el.dataset.value; save();
    renderGroupBox();
  },
  groupCreate: () => {
    if (!unitName()) return toast('먼저 위에서 수업(단원·차시)을 골라 주세요.', 'warn');
    groupCreate();
  },
  groupJoin: () => groupJoin(($('#groupCode') || {}).value),
  groupLeave: () => groupLeave(false),
  reset: async () => {
    if (!confirm(inGroup() ? '새 보고서를 시작할까요? 이 기기는 모둠에서 나가고 처음부터 시작해요. (모둠의 보고서는 다른 모둠원에게 그대로 남아요)' : '새 보고서를 시작할까요? 탐구 질문, 예상, 점검 체크, 실험 설계, 측정 데이터, 결론, 피드백, 대화가 모두 지워집니다. (필요하면 먼저 [파일 저장]을 하세요)')) return;
    groupLeave(true);
    if (driver && driver.connected) await driver.disconnect();
    // 화면에 남은 입력값·임시 상태까지 모두 없애도록 완전히 새로 시작
    clearTimeout(saveTimer);
    state = newState();
    save(true);
    location.reload();
  },
};

function readDecoderForm() {
  const form = $('#decoderForm');
  if (!form || !ui.cfg) return;
  const cfg = ui.cfg, d = cfg.decoder;
  form.querySelectorAll('[data-cfg]').forEach(el => {
    const k = el.dataset.cfg;
    const v = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (k === 'namePrefixes') cfg.namePrefixes = v.split(',').map(s => s.trim()).filter(Boolean);
    else if (k === 'extraServices' || k === 'showAll') cfg[k] = v;
    else d[k] = v;
  });
  form.querySelectorAll('[data-fld]').forEach(el => {
    const [i, k] = el.dataset.fld.split('.');
    const f = d.fields[Number(i)];
    if (!f) return;
    if (el.type === 'checkbox') f[k] = el.checked;
    else if (['offset', 'scale', 'add'].includes(k)) f[k] = Number(el.value);
    else f[k] = el.value;
  });
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  if (['toggleChannel', 'toggleRun', 'toggleStd', 'importCsv', 'simSensor', 'pickChannel'].includes(a)) return; // change 이벤트에서 처리
  if (actions[a]) { e.preventDefault(); actions[a](el); }
});

document.addEventListener('change', e => {
  const el = e.target;
  const a = el.dataset.action;
  if (a === 'toggleChannel' || a === 'toggleRun' || a === 'toggleStd' || a === 'pickChannel' || a === 'pickChannel2') return actions[a](el);
  if (a === 'simSensor') {
    state.design.sensor = el.value; save();
    driver.slots.forEach(d => { if (d && d.brand === 'sim' && !d.measuring) d.setSensor(el.value); });
    updateLive();
    return;
  }
  if (a === 'importCsv' && el.files[0]) {
    const file = el.files[0];
    file.text().then(text => {
      try { const n = importCsv(text, file.name); ui.csvMsg = `${file.name}에서 ${n}개 시행을 가져왔습니다.`; save(true); }
      catch (err) { ui.csvMsg = '가져오기 실패: ' + err.message; }
      refreshBrandPanel();
      $('#runList').innerHTML = runList();
      updateLive();
    });
    return;
  }
  if (el.id === 'jsonFile' && el.files[0]) {
    el.files[0].text().then(text => {
      try {
        const s = JSON.parse(text);
        if (!s.meta) throw new Error();
        state = deepMerge(newState(), s);
        save(true); render(); toast('보고서를 불러왔습니다.');
      } catch (err) { toast('올바른 보고서 파일이 아닙니다.', 'warn'); }
      el.value = '';
    });
  }
  if (el.matches('[data-bind]')) onBind(el);
  if (el.type === 'checkbox' && el.checked) { const c = el.closest('.check'); if (c) c.classList.remove('need'); }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.matches('[data-bind]') && el.type !== 'checkbox' && el.type !== 'radio') onBind(el);
  if (el.matches('textarea.auto')) autosize(el);
  if (el.id === 'runLabel') ui.runLabel = el.value;
  if (el.id === 'groupNick') { state.group.nick = el.value.trim(); save(); }
  if (el.id === 'groupCode') el.value = el.value.toUpperCase();
  if (el.dataset.alias !== undefined) {
    const al = Array.isArray(state.design.sensorAlias) ? state.design.sensorAlias : ['', ''];
    al[Number(el.dataset.alias)] = el.value;
    state.design.sensorAlias = al;
    save();
    driver._rebuild(); // 채널 이름 바로 반영
  }
  if (el.id === 'chatInput') ui.chatDraft = el.value;
  if (el.dataset.obs) {
    const o = obsData(), [ri, ci] = el.dataset.obs.split('.').map(Number);
    if (o && o.rows[ri]) { o.rows[ri][ci] = el.value; save(); }
  }
  if (el.matches('[data-run]')) {
    const run = state.data.runs.find(r => r.id === el.dataset.run);
    if (run) { run.label = el.value; save(); }
  }
});

// 수동 기록: 메모 칸에서 Enter를 누르면 [값 기록]
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#noticeModal')) { actions.closeNotice(); return; }
  if (e.key === 'Enter' && e.target.id === 'recX' && !e.isComposing) { e.preventDefault(); recordValue(); }
  if (e.key === 'Enter' && e.target.id === 'groupCode' && !e.isComposing) { e.preventDefault(); groupJoin(e.target.value); }
  // 탐구 도우미: Enter로 보내기, Shift+Enter는 줄바꿈
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'chatInput' && !e.isComposing) { e.preventDefault(); chatSend(e.target.value); }
});

document.addEventListener('toggle', e => {
  if (e.target.matches && e.target.matches('details[data-adv]')) {
    ui.advOpen = e.target.open;
    const el = $('#rawLog'); if (el && e.target.open) el.textContent = rawText();
  }
}, true);

function groupLocked() {
  if (typeof inGroup !== 'function' || !inGroup()) return false;
  toast('모둠 탐구 중에는 수업(단원·차시)을 바꿀 수 없어요. 바꾸려면 [모둠 나가기]를 먼저 하세요.', 'warn');
  return true;
}
function onBind(el) {
  const path = el.dataset.bind;
  if ((path === 'meta.customUnit' || path === 'meta.customLesson') && groupLocked()) { el.value = getPath(state, path) || ''; return; }
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'number') v = el.value === '' ? '' : Number(el.value);
  // 단원·차시를 직접 입력해 다른 수업으로 바꾸는 경우에도 이전 탐구를 지움
  if ((path === 'meta.customUnit' || path === 'meta.customLesson') && hasInquiryContent() && !startNewInquiry()) {
    el.value = getPath(state, path) || '';
    return;
  }
  setPath(state, path, v);
  save();
  if (path === 'meta.customUnit') {
    if (v.trim()) Object.assign(state.meta, { standards: [], lessonNo: 0, lesson: '' });
    renderHeader(); renderStepper();
    if (v.trim()) document.querySelectorAll('.unit-btn.on').forEach(b => b.classList.remove('on'));
    const p = $('#unitPanel'); if (p) p.innerHTML = unitPanel();
    const lb = $('#lessonBox'); if (lb && !lb.contains(el)) lb.innerHTML = unitName() ? lessonPicker() : '<span class="muted">단원을 먼저 선택하세요</span>';
    document.querySelectorAll('.sel-row').forEach((r, i) => { if (i === 5) r.classList.toggle('disabled', !unitName()); });
  }
  if (path === 'meta.customLesson') {
    renderHeader();
    if (v.trim()) document.querySelectorAll('.lesson-btn.on').forEach(b => b.classList.remove('on'));
  }
  // 결론 및 보고서 화면: 쓰는 내용을 아래 보고서에 바로 반영
  if (path.startsWith('result.') && $('#reportBox')) {
    clearTimeout(ui.reportTimer);
    ui.reportTimer = setTimeout(() => { const b = $('#reportBox'); if (b) b.innerHTML = viewReport(); }, 500);
  }
  if (path.startsWith('design.intervalSec') || path.startsWith('design.durationSec')) {
    const n = $('#expectN'); if (n) n.textContent = expectN();
    // 측정 화면과 설계 화면의 같은 입력 동기화
    document.querySelectorAll(`[data-bind="${path}"]`).forEach(x => { if (x !== el) x.value = el.value; });
  }
  if (path === 'design.sensor') driver.slots.forEach(d => { if (d && d.brand === 'sim' && !d.measuring) d.setSensor(v); });
}

window.addEventListener('resize', () => {
  const k = STEPS[state.step].key;
  if (k === 'connect' || k === 'measure') updateLive();
  if (k === 'analysis') { drawResult('#resultChart'); drawObsCharts('obsA'); }
  if (k === 'conclusion') { drawResult('#conclusionChart'); drawObsCharts('obsC'); }
});
window.addEventListener('beforeunload', e => {
  save(true);
  if (driver && driver.measuring) { e.preventDefault(); e.returnValue = ''; }
});

attachDriver(driver);
render();
renderGroupBar();
if (inGroup()) groupConnect(true); // 새로고침해도 같은 모둠에 다시 연결
