// 디지털 탐구 보고서 - 메인 앱
const STORE_KEY = 'sci-inquiry-report-v1';
const STEPS = [
  { key: 'setup', title: '수업 선택' },
  { key: 'question', title: '탐구 질문' },
  { key: 'design', title: '실험 설계' },
  { key: 'sensor', title: '센서 연결·측정' },
  { key: 'result', title: '결과·결론' },
  { key: 'report', title: '보고서' },
];
const BRANDS = [
  { key: 'pasco', name: 'PASCO', sub: '파스코 무선 센서', mark: 'P', color: '#0067b1', badge: '범용 BLE · 형식 확인 필요' },
  { key: 'vernier', name: 'Vernier', sub: '버니어 Go Direct', mark: 'V', color: '#d1342f', badge: '자동 인식' },
  { key: 'sciencecube', name: '사이언스큐브', sub: 'ScienceCube', mark: 'S', color: '#0f9d58', badge: '범용 BLE' },
  { key: 'easymaker', name: '이지메이커', sub: 'EasyMaker', mark: 'E', color: '#f08c00', badge: '범용 BLE' },
  { key: 'sim', name: '가상 센서', sub: '센서 없이 연습', mark: '∿', color: '#64748b', badge: '시뮬레이션' },
  { key: 'csv', name: '파일 가져오기', sub: '센서 앱 CSV', mark: '⇪', color: '#475569', badge: 'CSV' },
];
const BRAND_TIPS = {
  vernier: ['센서의 전원 버튼을 눌러 빨간 LED가 깜빡이는지 확인하세요.', '목록에서 GDX-로 시작하는 이름(예: GDX-TMP 0F1…)을 선택합니다.', '센서 안에 여러 채널이 있으면 자동으로 표시됩니다. 측정할 채널을 체크하세요.'],
  pasco: ['센서 전원을 켜고 초록/파란 LED가 깜빡이는지 확인하세요.', '목록에서 센서 본체에 적힌 6자리 ID(예: 123-456)가 포함된 이름을 선택합니다.', '처음 사용할 때는 아래 [원시 데이터]를 보며 데이터 형식을 확인하세요.'],
  sciencecube: ['센서 전원을 켜고 블루투스 모드인지 확인하세요.', '목록에서 사이언스큐브 센서 이름을 선택합니다. (보이지 않으면 [데이터 해석 설정]에서 "모든 기기 표시"를 켜세요)', '숫자 텍스트로 전송되는 경우 바로 측정됩니다.'],
  easymaker: ['보드에 전원을 연결하고 BLE 시리얼 코드가 업로드되어 있는지 확인하세요.', '보드는 "23.5" 또는 "23.5,45.1" 형태로 한 줄씩 보내면 됩니다.', 'Nordic UART, HM-10(FFE0), ESP32 예제 UUID를 자동으로 찾습니다.'],
  sim: ['실제 센서 없이 측정 흐름을 연습하는 가상 센서입니다.', '실험 설계에서 고른 측정 센서 종류에 맞는 그럴듯한 데이터가 만들어집니다.'],
  csv: ['SPARKvue, Graphical Analysis, 사이언스큐브 앱 등에서 내보낸 CSV 파일을 불러옵니다.', '첫 열(또는 "시간/Time" 열)을 시간으로, 나머지 열을 측정값으로 인식합니다.'],
};
const SAFETY_ITEMS = ['보안경·실험복 착용', '가열 기구 사용 시 화상 주의', '전기 회로는 전원을 끈 뒤 연결', '화학 약품은 냄새를 손으로 바람을 일으켜 맡기', '센서는 물기·충격에 주의', '실험 후 정리 정돈과 손 씻기'];
const QUESTION_CHECKS = [
  ['testable', '실험으로 확인할 수 있는 질문인가요?'],
  ['variables', '바꾸는 것(조작 변인)과 측정하는 것(종속 변인)이 드러나나요?'],
  ['sensor', '디지털 센서로 측정할 수 있는 값인가요?'],
  ['safe', '안전하게, 수업 시간 안에 할 수 있나요?'],
];

const today = () => new Date().toISOString().slice(0, 10);
const newState = () => ({
  step: 0,
  meta: { level: '', grade: '', semester: '', group: '', unit: '', customUnit: '', lesson: '', topic: '', school: '', studentId: '', name: '', team: '', date: today() },
  question: { observation: '', question: '', hypothesis: '', checks: {} },
  design: { iv: '', ivLevels: '', dv: '', sensor: '', controls: [''], materials: '', procedure: [''], intervalSec: 1, durationSec: 60, safety: {}, safetyNote: '' },
  data: { runs: [] },
  result: { channel: '', hidden: {}, analysis: '', verdict: '', conclusion: '', error: '', reflection: '' },
});

let state = load();
const ui = { brand: '', runLabel: '', raw: [], preview: {}, liveQueued: false, activeRunId: null, timer: null, csvMsg: '' };
let driver = null;

/* ───────── 저장 ───────── */
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.meta) return deepMerge(newState(), s);
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
  const step = STEPS[state.step].key;
  view.innerHTML = ({ setup: viewSetup, question: viewQuestion, design: viewDesign, sensor: viewSensor, result: viewResult, report: viewReport })[step]();
  view.dataset.step = step;
  renderNav();
  afterRender(step);
  window.scrollTo({ top: 0 });
}

function renderHeader() {
  const m = state.meta;
  const ctx = unitName() ? [m.level, m.grade, m.semester, (m.group && m.group !== '과학' ? `[${m.group}] ` : '') + unitName()].filter(Boolean).join(' · ') : '수업을 선택하세요';
  $('#context').textContent = ctx;
}

function renderStepper() {
  $('#stepper').innerHTML = STEPS.map((s, i) => `
    <button class="step ${i === state.step ? 'active' : ''} ${i < state.step ? 'done' : ''}" data-action="goto" data-step="${i}" ${i > 0 && !unitName() ? 'disabled' : ''}>
      <span class="num">${i < state.step ? '✓' : i + 1}</span><span class="label">${s.title}</span>
    </button>`).join('');
}

function renderNav() {
  const s = state.step;
  $('#nav').innerHTML = `
    <button class="btn ghost" data-action="prev" ${s === 0 ? 'disabled' : ''}>← 이전</button>
    <span id="saveState" class="muted small"></span>
    ${s < STEPS.length - 1 ? `<button class="btn primary" data-action="next">${s === 0 ? '탐구 시작하기' : '다음: ' + STEPS[s + 1].title} →</button>` : '<span></span>'}`;
}

/* 0. 수업 선택 */
function viewSetup() {
  const m = state.meta;
  const levels = Object.keys(CURRICULUM);
  const grades = m.level ? Object.keys(CURRICULUM[m.level]) : [];
  const sems = m.level && m.grade && CURRICULUM[m.level][m.grade] ? Object.keys(CURRICULUM[m.level][m.grade]) : [];
  const groups = sems.includes(m.semester) ? CURRICULUM[m.level][m.grade][m.semester] : [];
  const choice = (action, items, current, cls = '') => items.map(v => `<button class="chip-btn ${cls} ${v === current ? 'on' : ''}" data-action="${action}" data-value="${esc(v)}">${esc(v)}</button>`).join('');
  const rec = unitName() ? recommendSensors(unitName()) : [];

  return `
  <section class="hero">
    <h1>디지털 센서로 하는 과학 탐구</h1>
    <p>수업 단원을 고르고, 탐구 질문 → 실험 설계 → 센서 측정 → 결론까지 한 번에 보고서로 정리해요.</p>
  </section>
  <div class="setup-grid">
    <section class="card">
      <div class="sel-row"><h3><b>1</b> 학교급</h3><div class="chips">${choice('setLevel', levels, m.level, 'lg')}</div></div>
      <div class="sel-row ${m.level ? '' : 'disabled'}"><h3><b>2</b> 학년</h3><div class="chips">${m.level ? choice('setGrade', grades, m.grade) : '<span class="muted">학교급을 먼저 선택하세요</span>'}</div></div>
      <div class="sel-row ${m.grade ? '' : 'disabled'}"><h3><b>3</b> 학기</h3><div class="chips">${m.grade ? choice('setSemester', sems, m.semester) : '<span class="muted">학년을 먼저 선택하세요</span>'}</div></div>
      <div class="sel-row ${m.semester ? '' : 'disabled'}"><h3><b>4</b> 단원</h3>
        <div class="units">
          ${m.semester ? groups.map(g => `
            ${groups.length > 1 || g.group !== '과학' ? `<div class="unit-group">${esc(g.group)}</div>` : ''}
            ${g.units.map((u, i) => `<button class="unit-btn ${m.unit === u && m.group === g.group && !m.customUnit ? 'on' : ''}" data-action="setUnit" data-group="${esc(g.group)}" data-value="${esc(u)}"><span class="unit-no">${i + 1}</span>${esc(u)}</button>`).join('')}
          `).join('') : '<span class="muted">학기를 먼저 선택하세요</span>'}
          ${m.semester ? `<label class="field custom-unit"><span>목록에 없나요? 교과서 단원명 직접 입력</span><input data-bind="meta.customUnit" data-rerender-header value="${esc(m.customUnit)}" placeholder="예: 2. 전기와 자기"></label>` : ''}
        </div>
      </div>
      <p class="note">※ 2022 개정 교육과정 기준 단원입니다. 검정 교과서마다 단원명·학기 배치가 다를 수 있어요.</p>
    </section>
    <aside class="card side">
      <h3>수업 정보</h3>
      ${unitName() ? `<div class="picked"><div class="muted small">선택한 단원</div><strong>${esc(unitName())}</strong>
        <div class="muted small" style="margin-top:8px">추천 센서</div><div class="tags">${rec.map(k => `<span class="tag">${SENSOR_TYPES[k].name}</span>`).join('')}</div></div>` : ''}
      <div class="grid2">
        ${field('차시', 'meta.lesson', { placeholder: '예: 3/8차시' })}
        ${field('날짜', 'meta.date', { type: 'date' })}
      </div>
      ${field('수업 주제', 'meta.topic', { placeholder: '예: 물의 양과 온도 변화' })}
      ${field('학교', 'meta.school', { placeholder: '○○중학교' })}
      <div class="grid2">
        ${field('학번', 'meta.studentId', { placeholder: '20301' })}
        ${field('이름', 'meta.name')}
      </div>
      ${field('모둠(모둠원)', 'meta.team', { placeholder: '1모둠: 김○○, 이○○' })}
    </aside>
  </div>`;
}

/* 1. 탐구 질문 */
function viewQuestion() {
  const rec = recommendSensors(unitName());
  const d = state.design;
  return `
  <section class="page-head"><h2>탐구 질문 세우기</h2><p>관찰한 현상에서 궁금한 점을 찾고, 실험으로 확인할 수 있는 질문과 가설을 세워요.</p></section>
  <div class="two-col">
    <div>
      <section class="card">
        <h3>① 관찰과 궁금한 점</h3>
        ${field('무엇을 관찰했나요? 무엇이 궁금한가요?', 'question.observation', { textarea: true, rows: 3, placeholder: '예: 냄비에 물을 많이 넣으면 끓는 데 더 오래 걸리는 것 같았다.' })}
      </section>
      <section class="card">
        <h3>② 탐구 질문 만들기</h3>
        <div class="builder">
          <input data-bind="design.iv" value="${esc(d.iv)}" placeholder="바꾸는 것 (예: 물의 양)">
          <span>에 따라</span>
          <input data-bind="design.dv" value="${esc(d.dv)}" placeholder="측정하는 것 (예: 물의 온도 변화)">
          <span>은(는) 어떻게 달라질까?</span>
          <button class="btn small" data-action="buildQuestion">문장 만들기</button>
        </div>
        ${field('나의 탐구 질문', 'question.question', { textarea: true, rows: 2, placeholder: '예: 물의 양에 따라 같은 시간 동안 가열한 물의 온도 변화는 어떻게 달라질까?' })}
        <div class="muted small">이 단원의 예시 질문 (누르면 입력됩니다)</div>
        <div class="examples">${rec.map(k => `<button class="example" data-action="useExample" data-value="${esc(EXAMPLE_QUESTIONS[k])}" data-sensor="${k}"><span class="tag">${SENSOR_TYPES[k].name}</span>${esc(EXAMPLE_QUESTIONS[k])}</button>`).join('')}</div>
      </section>
      <section class="card">
        <h3>③ 가설 세우기</h3>
        ${field('가설', 'question.hypothesis', { textarea: true, rows: 3, hint: '“만약 ~한다면, ~할 것이다. 왜냐하면 ~이기 때문이다.”', placeholder: '예: 물의 양이 많을수록 같은 시간 동안 온도가 적게 올라갈 것이다. 왜냐하면 데워야 할 물이 많기 때문이다.' })}
      </section>
    </div>
    <aside class="card side">
      <h3>좋은 탐구 질문 점검</h3>
      <div class="checklist">${QUESTION_CHECKS.map(([k, t]) => `<label class="check"><input type="checkbox" data-bind="question.checks.${k}" ${state.question.checks[k] ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
      <div class="tipbox"><strong>도움말</strong><p>“왜?”로 묻는 질문보다 “~에 따라 ~은 어떻게 달라질까?”처럼 <b>측정할 수 있는</b> 질문이 탐구하기 좋아요.</p></div>
    </aside>
  </div>`;
}

/* 2. 실험 설계 */
function viewDesign() {
  const d = state.design;
  const rec = recommendSensors(unitName());
  const keys = [...rec, ...Object.keys(SENSOR_TYPES).filter(k => !rec.includes(k))];
  const list = (arrPath, placeholder, numbered) => {
    const arr = getPath(state, arrPath);
    return `<div class="dyn-list">${arr.map((v, i) => `
      <div class="dyn-row">${numbered ? `<span class="idx">${i + 1}</span>` : '<span class="dot"></span>'}
        <input data-bind="${arrPath}.${i}" value="${esc(v)}" placeholder="${esc(placeholder)}">
        ${numbered ? `<button class="icon-btn" title="위로" data-action="moveItem" data-path="${arrPath}" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>` : ''}
        <button class="icon-btn" title="삭제" data-action="removeItem" data-path="${arrPath}" data-i="${i}">✕</button>
      </div>`).join('')}
      <button class="btn small ghost" data-action="addItem" data-path="${arrPath}">+ 추가</button></div>`;
  };
  return `
  <section class="page-head"><h2>실험 설계하기</h2><p>변인을 정하고, 무엇을 어떤 센서로 얼마나 측정할지 계획해요.</p>
    ${state.question.question ? `<div class="qbanner">탐구 질문: ${esc(state.question.question)}</div>` : ''}</section>
  <div class="two-col">
    <div>
      <section class="card">
        <h3>① 변인 정하기</h3>
        <div class="var-grid">
          <div class="var iv">${field('조작 변인 <em>(다르게 할 것)</em>', 'design.iv', { placeholder: '예: 물의 양' })}
            ${field('조작 변인의 값(조건)', 'design.ivLevels', { placeholder: '예: 50 mL, 100 mL, 150 mL', hint: '쉼표로 구분 → 측정 시 조건 이름으로 사용' })}</div>
          <div class="var dv">${field('종속 변인 <em>(측정할 것)</em>', 'design.dv', { placeholder: '예: 3분 동안의 온도 변화' })}
            <label class="field"><span>측정에 사용할 센서</span>
              <select data-bind="design.sensor"><option value="">선택하세요</option>
                ${keys.map(k => `<option value="${k}" ${d.sensor === k ? 'selected' : ''}>${SENSOR_TYPES[k].name} (${SENSOR_TYPES[k].unit})${rec.includes(k) ? ' · 추천' : ''}</option>`).join('')}
              </select></label></div>
          <div class="var cv"><span class="lbl">통제 변인 <em>(같게 할 것)</em></span>${list('design.controls', '예: 가열 장치의 세기', false)}</div>
        </div>
      </section>
      <section class="card">
        <h3>② 준비물</h3>
        ${field('', 'design.materials', { textarea: true, rows: 2, placeholder: '예: 비커(250 mL) 3개, 핫플레이트, 온도 센서, 눈금실린더, 스탠드' })}
      </section>
      <section class="card">
        <h3>③ 실험 과정</h3>
        ${list('design.procedure', '실험 순서를 한 단계씩 적어요', true)}
      </section>
    </div>
    <aside>
      <section class="card side">
        <h3>④ 측정 조건</h3>
        <div class="grid2">
          ${field('측정 간격 (초)', 'design.intervalSec', { type: 'number', attrs: 'min="0.01" step="0.1"' })}
          ${field('측정 시간 (초)', 'design.durationSec', { type: 'number', attrs: 'min="0" step="1"', hint: '0 = 직접 정지' })}
        </div>
        <p class="muted small">예상 데이터 수: <b id="expectN">${expectN()}</b>개 / 조건</p>
      </section>
      <section class="card side">
        <h3>⑤ 안전 점검</h3>
        <div class="checklist">${SAFETY_ITEMS.map((t, i) => `<label class="check"><input type="checkbox" data-bind="design.safety.s${i}" ${d.safety['s' + i] ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
        ${field('그 밖의 유의사항', 'design.safetyNote', { textarea: true, rows: 2 })}
      </section>
    </aside>
  </div>`;
}
const expectN = () => {
  const d = state.design;
  return d.durationSec > 0 && d.intervalSec > 0 ? Math.floor(d.durationSec / d.intervalSec) + 1 : '∞';
};

/* 3. 센서 연결·측정 */
function viewSensor() {
  const support = 'bluetooth' in navigator;
  const levels = ivLevels();
  const runs = state.data.runs;
  if (!ui.runLabel) ui.runLabel = levels[runs.length] || levels[0] || `시행 ${runs.length + 1}`;
  return `
  <section class="page-head"><h2>센서 연결과 측정</h2><p>사용할 디지털 센서를 블루투스로 연결하고, 조건별로 데이터를 측정해요.</p></section>
  ${!support && !['sim', 'csv'].includes(ui.brand) ? `<div class="alert">이 브라우저는 Web Bluetooth를 지원하지 않습니다. <b>PC·크롬북·안드로이드의 Chrome 또는 Edge</b>에서 접속하세요. (iPad/iPhone은 Bluefy 브라우저 앱 사용) — 센서 없이 연습하려면 <b>가상 센서</b>를 선택하세요.</div>` : ''}
  ${support && !window.isSecureContext ? `<div class="alert">블루투스는 <b>https://</b> 또는 <b>localhost</b> 주소에서만 동작합니다. start-server.bat로 실행하거나 https로 배포하세요.</div>` : ''}
  <div class="sensor-layout">
    <section class="card">
      <h3>① 센서 선택</h3>
      <div class="brands">${BRANDS.map(b => `
        <button class="brand ${ui.brand === b.key ? 'on' : ''}" data-action="pickBrand" data-value="${b.key}" ${driver && driver.measuring ? 'disabled' : ''}>
          <span class="mark" style="background:${b.color}">${b.mark}</span>
          <span class="bname">${b.name}</span><span class="bsub">${b.sub}</span>
          <span class="bbadge">${b.badge}</span>
        </button>`).join('')}</div>
      <div id="brandPanel">${brandPanel()}</div>
    </section>
    <section class="card">
      <h3>② 측정</h3>
      <div class="measure-bar">
        <label class="field"><span>측정 조건 이름</span>
          <input id="runLabel" list="levelList" value="${esc(ui.runLabel)}" placeholder="예: 물 100 mL">
          <datalist id="levelList">${levels.map(l => `<option value="${esc(l)}">`).join('')}</datalist></label>
        ${field('간격(초)', 'design.intervalSec', { type: 'number', attrs: 'min="0.01" step="0.1"', cls: 'narrow' })}
        ${field('시간(초)', 'design.durationSec', { type: 'number', attrs: 'min="0" step="1"', cls: 'narrow' })}
        <div class="measure-btns">
          <button class="btn primary big" id="btnStart" data-action="startMeasure">● 측정 시작</button>
          <button class="btn danger big" id="btnStop" data-action="stopMeasure">■ 정지</button>
        </div>
      </div>
      <div id="liveTiles" class="tiles"></div>
      <div class="chart-wrap"><canvas id="liveChart"></canvas></div>
      <div class="progress"><div id="progBar"></div></div>
    </section>
  </div>
  <section class="card">
    <div class="card-head"><h3>③ 측정 기록 <span class="count">${runs.length}</span></h3>
      <div><button class="btn small ghost" data-action="exportCsv" ${runs.length ? '' : 'disabled'}>CSV 내려받기</button></div></div>
    <div id="runList">${runList()}</div>
  </section>`;
}

function ivLevels() {
  return (state.design.ivLevels || '').split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
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
  const connected = driver && driver.connected && driver.brand === ui.brand;
  const simSel = ui.brand === 'sim' ? `
    <label class="field"><span>가상 센서 종류</span><select data-action="simSensor">
      ${Object.keys(SENSOR_TYPES).map(k => `<option value="${k}" ${(state.design.sensor || 'temp') === k ? 'selected' : ''}>${SENSOR_TYPES[k].name}</option>`).join('')}
    </select></label>` : '';
  const preset = BRAND_PRESETS[ui.brand];
  return `
    ${tipHtml}
    ${simSel}
    <div class="conn-row">
      ${connected
        ? `<span class="status ok" id="connStatus">● ${esc(driver.deviceName)} 연결됨</span><button class="btn small ghost" data-action="disconnect">연결 해제</button>`
        : `<span class="status" id="connStatus">○ 연결 안 됨</span><button class="btn primary" data-action="connect">${ui.brand === 'sim' ? '가상 센서 켜기' : '블루투스로 연결'}</button>`}
    </div>
    <div id="channelBox">${channelBox()}</div>
    ${preset ? `<p class="note">${esc(preset.note)}</p>${decoderPanel()}` : ''}`;
}

function channelBox() {
  if (!driver || !driver.connected || driver.brand !== ui.brand) return '';
  if (!driver.channels.length) return '<p class="muted small">채널 정보를 기다리는 중…</p>';
  return `<div class="channels"><div class="muted small">측정 채널</div>${driver.channels.map((c, i) => `
    <label class="check"><input type="checkbox" data-action="toggleChannel" data-i="${i}" ${c.enabled ? 'checked' : ''} ${driver.measuring ? 'disabled' : ''}>
    <span>${esc(c.name)} ${c.unit ? `<em>(${esc(c.unit)})</em>` : ''}</span></label>`).join('')}</div>`;
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
  const chars = driver && driver.chars && driver.brand === ui.brand ? driver.chars : [];
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
        <td>${esc(r.device || r.brand)}</td>
        <td>${r.channels.map(c => esc(c.name) + (c.unit ? ` (${esc(c.unit)})` : '')).join(', ')}</td>
        <td>${r.rows.length}${live ? ' <span class="rec">REC</span>' : ''}</td><td>${fmt(last, 1)} s</td>
        <td><button class="icon-btn" title="그래프 보기" data-action="showRun" data-id="${r.id}">📈</button><button class="icon-btn" title="삭제" data-action="deleteRun" data-id="${r.id}" ${live ? 'disabled' : ''}>✕</button></td></tr>`;
    }).join('')}</tbody></table>`;
}

/* 4. 결과·결론 */
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
function currentKey() {
  const keys = channelKeys();
  if (!keys.includes(state.result.channel)) state.result.channel = keys[0] || '';
  return state.result.channel;
}
function statsTable(key, forReport) {
  const series = seriesFor(key, false);
  if (!series.length) return '<p class="muted">측정 데이터가 없습니다.</p>';
  const unit = key.split('|')[1];
  return `<table class="data stats"><thead><tr><th>조건</th><th>데이터 수</th><th>처음값</th><th>마지막값</th><th>최솟값</th><th>최댓값</th><th>평균</th><th>변화량</th><th>평균 변화율${unit ? `<br><small>(${esc(unit)}/s)</small>` : ''}</th></tr></thead><tbody>
    ${series.map(s => { const st = runStats(s.points); return st ? `<tr><td>${forReport ? '' : `<span class="swatch" style="background:${s.color}"></span>`}${esc(s.name)}</td><td>${st.n}</td><td>${fmt(st.first)}</td><td>${fmt(st.last)}</td><td>${fmt(st.min)}</td><td>${fmt(st.max)}</td><td>${fmt(st.mean)}</td><td>${fmt(st.change)}</td><td>${fmt(st.slope, 4)}</td></tr>` : ''; }).join('')}
  </tbody></table>`;
}
function viewResult() {
  const keys = channelKeys();
  const key = currentKey();
  const r = state.result;
  return `
  <section class="page-head"><h2>결과 정리와 결론</h2><p>그래프와 표로 결과를 비교하고, 가설이 맞았는지 판단해 결론을 써요.</p>
    ${state.question.question ? `<div class="qbanner">탐구 질문: ${esc(state.question.question)}</div>` : ''}</section>
  <section class="card">
    ${keys.length ? `
    <div class="card-head"><h3>① 그래프로 비교하기</h3>
      <label class="inline-field">측정 항목 <select data-action="pickChannel">${keys.map(k => { const [n, u] = k.split('|'); return `<option value="${esc(k)}" ${k === key ? 'selected' : ''}>${esc(n)}${u ? ` (${esc(u)})` : ''}</option>`; }).join('')}</select></label></div>
    <div class="run-toggles">${state.data.runs.map((run, i) => `<label class="check pill"><input type="checkbox" data-action="toggleRun" data-id="${run.id}" ${r.hidden[run.id] ? '' : 'checked'}><span class="swatch" style="background:${PLOT_COLORS[i % PLOT_COLORS.length]}"></span>${esc(run.label)}</label>`).join('')}</div>
    <div class="chart-wrap tall"><canvas id="resultChart"></canvas></div>
    <h3>② 데이터 요약</h3>
    <div class="table-scroll" id="statsBox">${statsTable(key)}</div>`
    : `<p class="muted center pad">아직 측정 데이터가 없습니다. <button class="btn small" data-action="goto" data-step="3">센서 측정하러 가기</button></p>`}
  </section>
  <div class="two-col even">
    <section class="card">
      <h3>③ 결과 해석</h3>
      ${field('그래프와 표에서 알 수 있는 사실', 'result.analysis', { textarea: true, rows: 5, placeholder: '예: 물의 양이 50 mL일 때 3분 동안 온도가 약 38 °C 올랐고, 150 mL일 때는 약 14 °C 올랐다. 물의 양이 많을수록 온도 변화량이 작았다.' })}
      <div class="field"><span>가설은 어떻게 되었나요?</span>
        <div class="seg">${['지지됨', '일부 지지됨', '지지되지 않음'].map(v => `<label><input type="radio" name="verdict" data-bind="result.verdict" value="${v}" ${r.verdict === v ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
      ${field('결론', 'result.conclusion', { textarea: true, rows: 3, placeholder: '탐구 질문에 대한 답을 증거(데이터)와 함께 써요.' })}
    </section>
    <section class="card">
      <h3>④ 평가와 성찰</h3>
      ${field('오차의 원인과 개선 방법', 'result.error', { textarea: true, rows: 4, placeholder: '예: 센서를 비커 바닥에 닿게 둔 경우가 있었다. 센서 위치를 일정하게 고정하면 좋겠다.' })}
      ${field('새롭게 알게 된 점 · 더 탐구하고 싶은 점', 'result.reflection', { textarea: true, rows: 4 })}
    </section>
  </div>`;
}

/* 5. 보고서 */
function chartImage(key, w = 760, h = 340) {
  const c = document.createElement('canvas');
  const [n, u] = key.split('|');
  drawPlot(c, seriesFor(key, false), { width: w, height: h, background: '#ffffff', xLabel: '시간 (s)', yLabel: `${n}${u ? ` (${u})` : ''}` });
  return c.toDataURL('image/png');
}
function viewReport() {
  const m = state.meta, q = state.question, d = state.design, r = state.result;
  const keys = channelKeys();
  const safety = SAFETY_ITEMS.filter((_, i) => d.safety['s' + i]);
  const devices = [...new Set(state.data.runs.map(x => x.device || x.brand))];
  const sensorName = d.sensor && SENSOR_TYPES[d.sensor] ? `${SENSOR_TYPES[d.sensor].name} 센서` : '';
  const blank = s => (s && String(s).trim() ? nl2br(s) : '<span class="blank">(작성하지 않음)</span>');
  return `
  <div class="report-actions no-print">
    <button class="btn primary" data-action="print">인쇄 / PDF로 저장</button>
    <button class="btn ghost" data-action="saveJson">보고서 파일 저장(.json)</button>
    <button class="btn ghost" data-action="exportCsv" ${state.data.runs.length ? '' : 'disabled'}>측정 데이터 CSV</button>
  </div>
  <article id="report" class="report">
    <header>
      <div class="r-kicker">디지털 센서 활용 과학 탐구 보고서</div>
      <h1>${esc(m.topic || q.question || unitName() || '과학 탐구 보고서')}</h1>
      <table class="r-info"><tbody>
        <tr><th>학교급·학년·학기</th><td>${esc([m.level, m.grade, m.semester].filter(Boolean).join(' '))}</td><th>단원</th><td>${esc((m.group && m.group !== '과학' ? `[${m.group}] ` : '') + unitName())}</td></tr>
        <tr><th>차시</th><td>${esc(m.lesson)}</td><th>날짜</th><td>${esc(m.date)}</td></tr>
        <tr><th>학교</th><td>${esc(m.school)}</td><th>학번·이름</th><td>${esc([m.studentId, m.name].filter(Boolean).join(' '))}</td></tr>
        <tr><th>모둠</th><td colspan="3">${esc(m.team)}</td></tr>
      </tbody></table>
    </header>
    <section><h2>1. 탐구 문제</h2>
      <h4>관찰과 궁금한 점</h4><p>${blank(q.observation)}</p>
      <h4>탐구 질문</h4><p class="r-q">${blank(q.question)}</p>
      <h4>가설</h4><p>${blank(q.hypothesis)}</p>
    </section>
    <section><h2>2. 실험 설계</h2>
      <table class="r-var"><tbody>
        <tr><th>조작 변인</th><td>${esc(d.iv)}${d.ivLevels ? ` <span class="muted">(${esc(d.ivLevels)})</span>` : ''}</td></tr>
        <tr><th>종속 변인</th><td>${esc(d.dv)}${sensorName ? ` <span class="muted">— ${esc(sensorName)}로 측정</span>` : ''}</td></tr>
        <tr><th>통제 변인</th><td>${esc(d.controls.filter(Boolean).join(', '))}</td></tr>
        <tr><th>측정 조건</th><td>측정 간격 ${esc(d.intervalSec)}초, 측정 시간 ${d.durationSec > 0 ? esc(d.durationSec) + '초' : '직접 정지'}${devices.length ? ` · 사용 기기: ${esc(devices.join(', '))}` : ''}</td></tr>
      </tbody></table>
      <h4>준비물</h4><p>${blank(d.materials)}</p>
      <h4>실험 과정</h4>${d.procedure.filter(Boolean).length ? `<ol>${d.procedure.filter(Boolean).map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p><span class="blank">(작성하지 않음)</span></p>'}
      ${safety.length || d.safetyNote ? `<h4>안전 유의사항</h4><p>${esc(safety.join(' · '))}${d.safetyNote ? '<br>' + nl2br(d.safetyNote) : ''}</p>` : ''}
    </section>
    <section><h2>3. 실험 결과</h2>
      ${keys.length ? keys.map(k => { const [n, u] = k.split('|'); return `
        <figure><img src="${chartImage(k)}" alt="${esc(n)} 그래프"><figcaption>시간에 따른 ${esc(n)}${u ? ` (${esc(u)})` : ''} 변화</figcaption></figure>
        ${statsTable(k, true)}`; }).join('') : '<p><span class="blank">(측정 데이터 없음)</span></p>'}
    </section>
    <section><h2>4. 결과 해석 및 결론</h2>
      <h4>결과 해석</h4><p>${blank(r.analysis)}</p>
      <h4>가설 검증</h4><p>${r.verdict ? `<b>${esc(r.verdict)}</b>` : '<span class="blank">(선택하지 않음)</span>'}</p>
      <h4>결론</h4><p>${blank(r.conclusion)}</p>
      <h4>오차의 원인과 개선 방법</h4><p>${blank(r.error)}</p>
      <h4>새롭게 알게 된 점 · 더 탐구하고 싶은 점</h4><p>${blank(r.reflection)}</p>
    </section>
  </article>`;
}

/* ───────── 렌더 후 처리 ───────── */
function afterRender(step) {
  setSaved(true);
  if (step === 'sensor') { updateLive(); updateMeasureButtons(); }
  if (step === 'result') drawResult();
}
function drawResult() {
  const c = $('#resultChart');
  if (!c) return;
  const key = currentKey();
  const [n, u] = key.split('|');
  drawPlot(c, seriesFor(key, false), { xLabel: '시간 (s)', yLabel: `${n}${u ? ` (${u})` : ''}` });
}

/* ───────── 측정 ───────── */
const activeRun = () => state.data.runs.find(r => r.id === ui.activeRunId);

function attachDriver(d) {
  driver = d;
  d.on('status', msg => { const el = $('#connStatus'); if (el) el.textContent = '… ' + msg; });
  d.on('channels', () => {
    const run = activeRun();
    if (run && d.measuring) {
      d.channels.filter(c => c.enabled && !run.channels.some(rc => rc.id === c.id)).forEach(c => run.channels.push({ id: c.id, name: c.name, unit: c.unit }));
    }
    const box = $('#channelBox'); if (box) box.innerHTML = channelBox();
  });
  d.on('sample', ({ t, values }) => {
    const run = activeRun();
    if (!run || !d.measuring) return;
    const row = [t, ...run.channels.map(c => (values[c.id] !== undefined ? values[c.id] : null))];
    if (row.slice(1).every(v => v === null)) return;
    run.rows.push(row);
    ui.preview = values;
    queueLive();
    const dur = Number(state.design.durationSec);
    if (dur > 0 && t >= dur) stopMeasure();
  });
  d.on('preview', values => { ui.preview = values; queueLive(); });
  d.on('raw', ({ uuid, bytes }) => {
    const line = `${new Date().toLocaleTimeString('ko-KR', { hour12: false })}  ${shortUuid(uuid)}  ${toHex(bytes)}  |${toAscii(bytes)}|`;
    ui.raw.push(line);
    if (ui.raw.length > 30) ui.raw.shift();
    const el = $('#rawLog');
    if (el && el.closest('details').open) { el.textContent = rawText(); el.scrollTop = el.scrollHeight; }
  });
  d.on('disconnected', () => {
    if (ui.activeRunId) finishRun();
    if (!d.userClosed) toast('센서 연결이 끊어졌습니다. 전원과 거리를 확인한 뒤 다시 연결하세요.', 'warn');
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
    <div class="tile"><div class="t-name">${esc(c.name)}</div><div class="t-val">${fmt(ui.preview[c.id], 3)}<small>${esc(c.unit)}</small></div></div>`).join('')
    : '<div class="tile empty">센서를 연결하면 실시간 값이 표시됩니다</div>';

  const run = activeRun() || (ui.showRunId && state.data.runs.find(r => r.id === ui.showRunId));
  const canvas = $('#liveChart');
  if (canvas) {
    const series = run ? run.channels.map((c, i) => ({ name: `${c.name}${c.unit ? ` (${c.unit})` : ''}`, color: PLOT_COLORS[i % PLOT_COLORS.length], points: run.rows.map(r => [r[0], r[i + 1] ?? null]) })) : [];
    const yLabel = run && run.channels.length === 1 ? `${run.channels[0].name}${run.channels[0].unit ? ` (${run.channels[0].unit})` : ''}` : '측정값';
    drawPlot(canvas, series, { xLabel: '시간 (s)', yLabel, empty: run ? '데이터 수신 대기 중…' : undefined });
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

function updateMeasureButtons() {
  const s = $('#btnStart'), p = $('#btnStop');
  if (!s) return;
  const measuring = driver && driver.measuring;
  s.disabled = !!measuring || !(driver && driver.connected && driver.brand === ui.brand);
  p.disabled = !measuring;
  document.querySelectorAll('.brand').forEach(b => { b.disabled = !!measuring; });
}

async function startMeasure() {
  if (!driver || !driver.connected) return toast('먼저 센서를 연결하세요.', 'warn');
  const chans = driver.channels.filter(c => c.enabled);
  if (!chans.length && driver.brand === 'vernier') return toast('측정할 채널을 선택하세요.', 'warn');
  const label = ($('#runLabel').value || '').trim() || `시행 ${state.data.runs.length + 1}`;
  const interval = Math.max(0.01, Number(state.design.intervalSec) || 1);
  const run = { id: uid(), label, brand: driver.brand, device: driver.deviceName, channels: chans.map(c => ({ id: c.id, name: c.name, unit: c.unit })), rows: [], createdAt: Date.now() };
  state.data.runs.push(run);
  ui.activeRunId = run.id;
  ui.showRunId = null;
  try {
    const actualMs = await driver.start(interval * 1000);
    if (Math.abs(actualMs - interval * 1000) > 1) toast(`센서 최소 간격에 맞춰 ${actualMs / 1000}초 간격으로 측정합니다.`);
    toast(`"${label}" 측정을 시작합니다.`);
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

async function stopMeasure() {
  if (!driver || !driver.measuring) return;
  await driver.stop();
  finishRun();
}

function finishRun() {
  const run = activeRun();
  ui.activeRunId = null;
  if (run) {
    if (!run.rows.length) state.data.runs = state.data.runs.filter(r => r.id !== run.id);
    else { ui.showRunId = run.id; toast(`"${run.label}" 측정 완료 (${run.rows.length}개)`); }
  }
  const levels = ivLevels();
  const doneLabels = state.data.runs.map(r => r.label);
  ui.runLabel = levels.find(l => !doneLabels.includes(l)) || `시행 ${state.data.runs.length + 1}`;
  const input = $('#runLabel'); if (input) input.value = ui.runLabel;
  const list = $('#runList'); if (list) list.innerHTML = runList();
  const box = $('#channelBox'); if (box) box.innerHTML = channelBox();
  updateMeasureButtons();
  updateLive();
  save(true);
}

async function connect() {
  if (driver && driver.connected) await driver.disconnect();
  let d;
  if (ui.brand === 'vernier') d = new VernierDriver();
  else if (ui.brand === 'sim') d = new SimulationDriver(state.design.sensor || recommendSensors(unitName())[0]);
  else d = new GenericBleDriver(ui.brand, ui.cfg);
  if (ui.brand !== 'sim' && !('bluetooth' in navigator)) return toast('이 브라우저는 블루투스를 지원하지 않습니다. Chrome 또는 Edge를 사용하세요.', 'warn');
  ui.raw = [];
  attachDriver(d);
  try {
    await d.connect();
    toast(`${d.deviceName} 연결 완료`);
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
}

/* CSV 내보내기·가져오기 */
function exportCsv() {
  const runs = state.data.runs;
  const header = [], cols = [];
  runs.forEach(r => {
    header.push(`${r.label}: 시간(s)`);
    cols.push(r.rows.map(x => x[0]));
    r.channels.forEach((c, i) => { header.push(`${r.label}: ${c.name}${c.unit ? `(${c.unit})` : ''}`); cols.push(r.rows.map(x => x[i + 1])); });
  });
  const n = Math.max(0, ...cols.map(c => c.length));
  const q = s => /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s;
  const lines = [header.map(q).join(',')];
  for (let i = 0; i < n; i++) lines.push(cols.map(c => (c[i] === null || c[i] === undefined ? '' : c[i])).join(','));
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
  goto: el => { state.step = Number(el.dataset.step); save(); render(); },
  prev: () => { state.step = Math.max(0, state.step - 1); save(); render(); },
  next: () => {
    if (state.step === 0 && !unitName()) return toast('학교급·학년·학기·단원을 선택하세요.', 'warn');
    state.step = Math.min(STEPS.length - 1, state.step + 1); save(); render();
  },
  setLevel: el => { Object.assign(state.meta, { level: el.dataset.value, grade: '', semester: '', unit: '', group: '' }); save(); render(); },
  setGrade: el => { Object.assign(state.meta, { grade: el.dataset.value, semester: '', unit: '', group: '' }); save(); render(); },
  setSemester: el => { Object.assign(state.meta, { semester: el.dataset.value, unit: '', group: '' }); save(); render(); },
  setUnit: el => { Object.assign(state.meta, { unit: el.dataset.value, group: el.dataset.group, customUnit: '' }); save(); render(); },
  buildQuestion: () => {
    const { iv, dv } = state.design;
    if (!iv || !dv) return toast('바꾸는 것과 측정하는 것을 모두 입력하세요.', 'warn');
    state.question.question = `${iv}에 따라 ${dv}은(는) 어떻게 달라질까?`;
    save(); render();
  },
  useExample: el => {
    state.question.question = el.dataset.value;
    if (!state.design.sensor) state.design.sensor = el.dataset.sensor;
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
    if (driver && driver.connected && driver.brand !== b) await driver.disconnect();
    ui.brand = b;
    ui.cfg = BRAND_PRESETS[b] ? getBrandConfig(b) : null;
    ui.raw = [];
    document.querySelectorAll('.brand').forEach(x => x.classList.toggle('on', x.dataset.value === b));
    refreshBrandPanel();
    updateMeasureButtons();
    updateLive();
  },
  connect: () => connect(),
  disconnect: async () => { await driver.disconnect(); refreshBrandPanel(); updateMeasureButtons(); updateLive(); },
  toggleChannel: el => { driver.channels[Number(el.dataset.i)].enabled = el.checked; updateLive(); },
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
    if (driver && driver.brand === ui.brand && driver.applyDecoder) driver.applyDecoder(ui.cfg.decoder);
    ui.advOpen = true; refreshBrandPanel(); updateLive();
    toast('설정을 저장했습니다. 이름 필터·서비스 UUID 변경은 다시 연결할 때 적용됩니다.');
  },
  resetConfig: () => {
    if (!confirm('이 제조사의 데이터 해석 설정을 기본값으로 되돌릴까요?')) return;
    localStorage.removeItem('sensor-config-' + ui.brand);
    ui.cfg = getBrandConfig(ui.brand);
    if (driver && driver.brand === ui.brand && driver.applyDecoder) { driver.config = ui.cfg; driver.applyDecoder(ui.cfg.decoder); }
    ui.advOpen = true; refreshBrandPanel();
  },
  pickChannel: el => { state.result.channel = el.value; save(); $('#statsBox').innerHTML = statsTable(el.value); drawResult(); },
  toggleRun: el => {
    state.result.hidden[el.dataset.id] = !el.checked;
    save(); $('#statsBox').innerHTML = statsTable(currentKey()); drawResult();
  },
  print: () => window.print(),
  saveJson: () => download(`탐구보고서_${state.meta.name || '학생'}_${state.meta.date || today()}.json`, JSON.stringify(state, null, 1), 'application/json'),
  loadJson: () => $('#jsonFile').click(),
  reset: async () => {
    if (!confirm('새 보고서를 시작할까요? 현재 내용은 지워집니다. (필요하면 먼저 보고서 파일을 저장하세요)')) return;
    if (driver && driver.connected) await driver.disconnect();
    const keepMeta = state.meta;
    state = newState();
    Object.assign(state.meta, { level: keepMeta.level, grade: keepMeta.grade, semester: keepMeta.semester, school: keepMeta.school, studentId: keepMeta.studentId, name: keepMeta.name, team: keepMeta.team });
    ui.runLabel = ''; ui.showRunId = null;
    save(true); render();
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
  if (['toggleChannel', 'toggleRun', 'importCsv', 'simSensor', 'pickChannel'].includes(a)) return; // change 이벤트에서 처리
  if (actions[a]) { e.preventDefault(); actions[a](el); }
});

document.addEventListener('change', e => {
  const el = e.target;
  const a = el.dataset.action;
  if (a === 'toggleChannel' || a === 'toggleRun' || a === 'pickChannel') return actions[a](el);
  if (a === 'simSensor') {
    state.design.sensor = el.value; save();
    if (driver && driver.brand === 'sim') { driver.setSensor(el.value); updateLive(); }
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
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.matches('[data-bind]') && el.type !== 'checkbox' && el.type !== 'radio') onBind(el);
  if (el.id === 'runLabel') ui.runLabel = el.value;
  if (el.matches('[data-run]')) {
    const run = state.data.runs.find(r => r.id === el.dataset.run);
    if (run) { run.label = el.value; save(); }
  }
});

document.addEventListener('toggle', e => {
  if (e.target.matches && e.target.matches('details[data-adv]')) {
    ui.advOpen = e.target.open;
    const el = $('#rawLog'); if (el && e.target.open) el.textContent = rawText();
  }
}, true);

function onBind(el) {
  const path = el.dataset.bind;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'number') v = el.value === '' ? '' : Number(el.value);
  setPath(state, path, v);
  save();
  if (path === 'meta.customUnit') { renderHeader(); renderStepper(); document.querySelectorAll('.unit-btn.on').forEach(b => b.classList.toggle('on', !v.trim())); }
  if (path.startsWith('design.intervalSec') || path.startsWith('design.durationSec')) {
    const n = $('#expectN'); if (n) n.textContent = expectN();
    // 측정 화면과 설계 화면의 같은 입력 동기화
    document.querySelectorAll(`[data-bind="${path}"]`).forEach(x => { if (x !== el) x.value = el.value; });
  }
  if (path === 'design.sensor' && driver && driver.brand === 'sim' && !driver.measuring) driver.setSensor(v);
}

window.addEventListener('resize', () => {
  if (STEPS[state.step].key === 'sensor') updateLive();
  if (STEPS[state.step].key === 'result') drawResult();
});
window.addEventListener('beforeunload', e => {
  save(true);
  if (driver && driver.measuring) { e.preventDefault(); e.returnValue = ''; }
});

render();
