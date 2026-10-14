// 모둠 탐구: 모둠 코드로 여러 기기가 같은 보고서를 실시간으로 함께 씀
// - 서버: proxy/group/group-worker.js (Cloudflare Durable Objects, 코드 하나 = 방 하나)
// - 같이 쓰는 것: 수업·차시, 예상, 탐구 질문, 실험 설계, 측정 기록, 관찰 기록, 결론, AI 피드백
// - 각자 쓰는 것: 보고 있는 단계, 센서 연결, 센서 이름, 탐구 도우미 대화
// - 개인정보를 받지 않음: 이름 없이 모둠 코드만으로 참여하고, 화면에는 '모둠원'으로만 표시
// - 바뀐 내용은 "경로: 값" 단위로 보냄. 같은 칸을 동시에 고치면 서버에 나중에 도착한 쪽이 남음
//   (내가 보낸 값이 아직 서버에 반영되기 전이면 그 칸에 들어온 다른 사람 값은 무시 → 모두 같은 값으로 맞춰짐)

const GROUP_SHARED = ['meta', 'expId', 'question', 'design', 'data.observe', 'result'];
const GROUP_LOCAL = new Set(['design.sensorAlias']);  // 기기마다 다른 값
const GROUP_FLUSH_MS = 700;

const group = {
  ws: null, status: 'off',      // off | connecting | online | retry
  members: [], cid: '',
  last: null,                   // 서버와 맞춘 마지막 공유 내용 (경로 → JSON 문자열)
  lastRuns: new Map(),          // 측정 기록 id → { n: 데이터 수, tail: 마지막 줄, info: 기록 정보 }
  pending: [],                  // 서버 확인을 기다리는 변경 [{ seq, paths:Set, ops }]
  seq: 0, timer: null, retryMs: 1000, deferred: false,
};

function groupUrl() {
  let u = '';
  try { u = localStorage.getItem('group-url') || ''; } catch (e) { /* ignore */ }
  return (u || (window.AI_CONFIG && window.AI_CONFIG.groupUrl) || '').replace(/\/+$/, '');
}
function groupCid() {
  if (group.cid) return group.cid;
  try { group.cid = localStorage.getItem('group-cid') || ''; } catch (e) { /* ignore */ }
  if (!group.cid) {
    group.cid = Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem('group-cid', group.cid); } catch (e) { /* ignore */ }
  }
  return group.cid;
}
const inGroup = () => !!(state.group && state.group.mode === 'group' && state.group.code);

/* ───── 공유 내용 ↔ 경로 목록 ───── */
function groupFlatten() {
  const out = {};
  const walk = (v, p) => {
    if (GROUP_LOCAL.has(p)) return;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v);
      keys.forEach(k => walk(v[k], p ? `${p}.${k}` : k));
      return;
    }
    if (v === undefined) return;
    out[p] = JSON.stringify(v);
  };
  GROUP_SHARED.forEach(p => walk(getPath(state, p), p));
  return out;
}
function groupDoc() {
  const doc = {};
  const flat = groupFlatten();
  Object.keys(flat).forEach(p => setPath(doc, p, JSON.parse(flat[p])));
  return doc;
}
const runInfo = r => { const { rows, ...info } = r; return JSON.stringify(info); };
function rememberRuns() {
  group.lastRuns = new Map(state.data.runs.map(r => [r.id, { n: r.rows.length, tail: JSON.stringify(r.rows[r.rows.length - 1] || null), info: runInfo(r) }]));
}

// 지난번 서버와 맞춘 내용과 비교해 바뀐 것만 골라냄 (지운 경로를 먼저)
function groupDiff() {
  const now = groupFlatten();
  const del = [], set = [];
  Object.keys(group.last || {}).forEach(p => { if (!(p in now)) del.push({ o: 'set', p, v: undefined }); });
  Object.keys(now).forEach(p => { if (!group.last || group.last[p] !== now[p]) set.push({ o: 'set', p, v: JSON.parse(now[p]) }); });
  const runOps = [];
  const seen = new Set();
  state.data.runs.forEach(r => {
    seen.add(r.id);
    const prev = group.lastRuns.get(r.id);
    if (!prev) { runOps.push({ o: 'run+', run: JSON.parse(JSON.stringify(r)) }); return; }
    if (prev.info !== runInfo(r)) { const { rows, ...fields } = r; runOps.push({ o: 'run~', id: r.id, fields }); }
    const n = r.rows.length;
    let from = Math.min(prev.n, n);
    // 마지막 줄이 바뀌었거나(수동 기록 되돌리기 후 다시 기록) 줄 수가 줄면 그 자리부터 다시 보냄
    if (from > 0 && JSON.stringify(r.rows[from - 1]) !== prev.tail && n >= prev.n) from -= 1;
    if (n !== prev.n || from < prev.n) runOps.push({ o: 'rows', id: r.id, from, rows: r.rows.slice(from) });
  });
  group.lastRuns.forEach((_, id) => { if (!seen.has(id)) runOps.push({ o: 'run-', id }); });
  return { ops: [...del, ...set, ...runOps], now };
}

/* ───── 보내기 ───── */
function groupSchedule() {
  if (!inGroup() || group.timer) return;
  group.timer = setTimeout(() => { group.timer = null; groupFlush(); }, 250);
}
function groupFlush() {
  if (!inGroup() || group.status !== 'online' || !group.ws || group.ws.readyState !== 1 || !group.last) return;
  const { ops, now } = groupDiff();
  if (!ops.length) return;
  const seq = ++group.seq;
  group.pending.push({ seq, paths: new Set(ops.filter(o => o.o === 'set').map(o => o.p)), ops });
  group.ws.send(JSON.stringify({ t: 'ops', seq, ops }));
  group.last = now;
  rememberRuns();
}
setInterval(() => { if (inGroup()) groupFlush(); }, GROUP_FLUSH_MS); // 측정 중 새 데이터도 1초 안에 전달

/* ───── 연결 ───── */
async function groupCreate() {
  const base = groupUrl();
  if (!base) return toast('모둠 서버 주소가 설정되지 않았어요. 선생님께 알려 주세요.', 'warn');
  group.creating = true; renderGroupBox();
  try {
    const res = await fetch(base + '/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ doc: groupDoc(), runs: state.data.runs }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.code) throw new Error(out.error || `모둠을 만들지 못했어요 (${res.status})`);
    Object.assign(state.group, { mode: 'group', code: out.code, role: 'leader' });
    save(true);
    groupConnect(true);
    toast(`모둠을 만들었어요. 친구들에게 코드 ${out.code}를 알려 주세요.`);
  } catch (e) {
    toast(e.message.includes('Failed to fetch') ? '모둠 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.' : e.message, 'warn');
  }
  group.creating = false; renderGroupBox();
}
function groupJoin(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) return toast('모둠 코드 6자리를 정확히 넣어 주세요.', 'warn');
  if (hasInquiryContent() && !confirm('모둠에 참여하면 이 기기에서 쓰던 탐구 내용 대신 모둠의 보고서를 함께 쓰게 돼요.\n(지금 내용이 필요하면 [취소]를 누르고 먼저 [파일 저장]을 하세요)\n참여할까요?')) return;
  Object.assign(state.group, { mode: 'group', code, role: 'member' });
  save(true);
  groupConnect(true);
}
function groupConnect(first) {
  const base = groupUrl();
  if (!base || !inGroup()) return;
  try { if (group.ws) { group.ws.onclose = null; group.ws.close(); } } catch (e) { /* ignore */ }
  group.status = first ? 'connecting' : 'retry';
  group.firstJoin = !!first || !group.last;
  renderGroupBar();
  const url = `${base.replace(/^http/, 'ws')}/room/${state.group.code}/ws?cid=${encodeURIComponent(groupCid())}&nick=${encodeURIComponent('모둠원')}`;
  const ws = new WebSocket(url);
  group.ws = ws;
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } groupOnMessage(m); };
  ws.onclose = ev => {
    if (group.ws !== ws) return;
    group.ws = null;
    if (!inGroup()) { group.status = 'off'; renderGroupBar(); return; }
    if (group.status === 'connecting' && !group.last) {
      // 처음 참여부터 실패: 코드가 틀렸거나 서버에 닿지 않음
      group.status = 'off';
      Object.assign(state.group, { mode: 'group', code: '' });
      save(true); renderGroupBox(); renderGroupBar();
      toast('모둠에 참여하지 못했어요. 코드를 다시 확인해 주세요.', 'warn');
      return;
    }
    group.status = 'retry';
    renderGroupBar();
    setTimeout(() => { if (inGroup() && !group.ws) groupConnect(false); }, group.retryMs);
    group.retryMs = Math.min(15000, group.retryMs * 2);
  };
  ws.onopen = () => { group.retryMs = 1000; };
}
function groupLeave(quiet) {
  if (!inGroup()) return;
  if (!quiet && !confirm('모둠에서 나갈까요? 지금까지 함께 쓴 내용은 이 기기에 그대로 남고, 다른 모둠원은 계속 쓸 수 있어요.')) return;
  Object.assign(state.group, { mode: 'solo', code: '', role: '' });
  try { if (group.ws) { group.ws.onclose = null; group.ws.close(); } } catch (e) { /* ignore */ }
  Object.assign(group, { ws: null, status: 'off', members: [], last: null, pending: [] });
  group.lastRuns = new Map();
  save(true);
  renderGroupBar(); renderGroupBox();
  if (!quiet) toast('모둠에서 나왔어요. 이제 개별 탐구로 이어서 쓸 수 있어요.');
}

/* ───── 받기 ───── */
function groupOnMessage(m) {
  if (m.t === 'init') return groupOnInit(m);
  if (m.t === 'ack') { group.pending = group.pending.filter(x => x.seq > m.seq); return; }
  if (m.t === 'members') { group.members = m.list || []; renderGroupBar(); renderGroupBox(); groupShowEditors(); return; }
  if (m.t === 'error') { toast(m.error, 'warn'); return; }
  if (m.t === 'ops') groupApplyRemote(m.ops || [], m.nick);
}

function groupOnInit(m) {
  // 다시 연결된 경우: 연결이 끊긴 동안 이 기기에서 바꾼 내용을 서버 내용 위에 다시 얹어 보냄
  const offline = !group.firstJoin && group.last ? groupDiff().ops : [];
  const unsent = group.pending.flatMap(p => p.ops);
  // 서버 내용으로 맞춤
  GROUP_SHARED.forEach(p => {
    const v = getPath(m.doc || {}, p);
    const keep = p === 'design' ? state.design.sensorAlias : null;
    if (v !== undefined) setPath(state, p, JSON.parse(JSON.stringify(v)));
    else if (p === 'data.observe') delete state.data.observe;
    else setPath(state, p, JSON.parse(JSON.stringify(getPath(newState(), p))));
    if (keep) state.design.sensorAlias = keep;
  });
  state.meta = deepMerge(newState().meta, state.meta);
  state.question = deepMerge(newState().question, state.question);
  state.design = deepMerge(newState().design, state.design);
  state.result = deepMerge(newState().result, state.result);
  state.data.runs = (m.runs || []).map(r => ({ ...r, rows: r.rows || [] }));
  group.last = groupFlatten();
  rememberRuns();
  group.pending = [];
  // 끊긴 동안의 변경을 다시 적용 (같은 칸은 내 값이 남음)
  [...unsent, ...offline].forEach(op => groupApplyOp(op, true));
  // 보고서에 들어갈 모둠원 수를 세기 위해 이 기기를 기록 (이름은 받지 않음, 경로가 기기마다 달라 동시에 들어와도 지워지지 않음)
  state.meta.members = state.meta.members || {};
  if (state.meta.members[groupCid()] !== true) state.meta.members[groupCid()] = true;
  group.status = 'online';
  group.firstJoin = false;
  save(true);
  groupRefresh(true);
  renderGroupBar(); renderGroupBox();
  groupFlush();
}

// 변경 하나를 이 기기 상태에 적용
function groupApplyOp(op, mine) {
  if (op.o === 'set') {
    setPath(state, op.p, op.v === undefined ? undefined : JSON.parse(JSON.stringify(op.v)));
    if (op.v === undefined) { const keys = op.p.split('.'); const last = keys.pop(); const o = getPath(state, keys.join('.')); if (o && typeof o === 'object') delete o[last]; }
    return;
  }
  const runs = state.data.runs;
  const i = runs.findIndex(r => r.id === (op.run ? op.run.id : op.id));
  if (op.o === 'run+') { const r = { ...op.run, rows: op.run.rows || [] }; if (i < 0) runs.push(r); else runs[i] = r; }
  else if (op.o === 'run~' && i >= 0) { const { id, rows, ...f } = op.fields || {}; Object.assign(runs[i], f); }
  else if (op.o === 'rows' && i >= 0) { const rows = runs[i].rows; const from = Math.min(op.from || 0, rows.length); rows.splice(from, rows.length - from, ...(op.rows || [])); }
  else if (op.o === 'run-' && i >= 0) runs.splice(i, 1);
  if (!mine) {
    const r = state.data.runs.find(x => x.id === (op.run ? op.run.id : op.id));
    if (r) group.lastRuns.set(r.id, { n: r.rows.length, tail: JSON.stringify(r.rows[r.rows.length - 1] || null), info: runInfo(r) });
    else group.lastRuns.delete(op.id);
  }
}

function groupApplyRemote(ops, nick) {
  const waiting = new Set(group.pending.flatMap(p => [...p.paths]));
  // 아직 서버에 보내지 않은 내 변경도 지키기 위해, 받은 값을 적용하기 전에 먼저 보냄
  groupFlush();
  const pendingNow = new Set(group.pending.flatMap(p => [...p.paths]));
  const changedPaths = [];
  let runsChanged = false, streaming = null;
  ops.forEach(op => {
    if (op.o === 'set') {
      if (waiting.has(op.p) || pendingNow.has(op.p)) return; // 내 값이 서버에 가는 중 → 내 값이 나중이므로 무시
      groupApplyOp(op, false);
      if (op.v === undefined) delete group.last[op.p]; else group.last[op.p] = JSON.stringify(op.v);
      // 하위 경로가 통째로 바뀐 경우 기준 목록도 맞춤
      Object.keys(group.last).forEach(p => { if (p.startsWith(op.p + '.')) delete group.last[p]; });
      changedPaths.push(op.p);
    } else {
      groupApplyOp(op, false);
      runsChanged = true;
      if (op.o === 'rows' || op.o === 'run+') streaming = op.id || (op.run && op.run.id);
    }
  });
  save();
  if (changedPaths.length) groupRefreshPaths(changedPaths);
  if (runsChanged) groupRefreshRuns(streaming, nick);
}

/* ───── 화면 반영 ───── */
// 글칸은 그 자리에서 값만 바꾸고(쓰는 중인 칸은 그대로), 나머지는 화면을 다시 그림
function groupRefreshPaths(paths) {
  let needRender = false;
  paths.forEach(p => {
    const els = document.querySelectorAll(`[data-bind="${CSS.escape(p)}"]`);
    if (!els.length) { needRender = true; return; }
    els.forEach(el => {
      if (el === document.activeElement) return;
      const v = getPath(state, p);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = el.value === v;
      else el.value = v ?? '';
      if (el.matches('textarea.auto') && typeof autosize === 'function') autosize(el);
    });
  });
  if (paths.some(p => p.startsWith('meta.'))) { renderHeader(); renderStepper(); }
  if (needRender) groupRefresh(false);
}
function groupRefreshRuns(streamingId, nick) {
  const step = STEPS[state.step].key;
  if (step === 'measure') {
    if (streamingId && !(driver && driver.measuring)) ui.showRunId = streamingId; // 다른 모둠원이 측정 중인 그래프를 따라 보여 줌
    const list = $('#runList'); if (list) list.innerHTML = runList();
    const cnt = document.querySelector('.card-head .count'); if (cnt) cnt.textContent = state.data.runs.length;
    updateLive();
    if (streamingId) groupNote('모둠원이 측정한 데이터가 들어오고 있어요');
  } else if (['analysis', 'conclusion', 'report'].includes(step)) groupRefresh(false);
}
// 화면 전체 다시 그리기: 글을 쓰는 중이면 그 칸에서 나올 때까지 미룸, 스크롤 위치는 유지
function groupRefresh(force) {
  const a = document.activeElement;
  if (!force && a && a.closest && a.closest('#view') && a.matches('input, textarea, select')) { group.deferred = true; return; }
  group.deferred = false;
  const y = window.scrollY;
  render();
  window.scrollTo({ top: y });
}
document.addEventListener('focusout', () => { setTimeout(() => { if (group.deferred) groupRefresh(false); }, 0); });

// 누가 어느 칸을 쓰고 있는지 알리기
document.addEventListener('focusin', e => {
  const p = e.target && e.target.dataset && e.target.dataset.bind;
  if (inGroup() && group.ws && group.ws.readyState === 1) group.ws.send(JSON.stringify({ t: 'focus', p: p || '' }));
});
function groupShowEditors() {
  document.querySelectorAll('.editing-by').forEach(x => x.remove());
  if (!inGroup()) return;
  group.members.filter(mb => mb.cid !== groupCid() && mb.focus).forEach(mb => {
    const el = document.querySelector(`[data-bind="${CSS.escape(mb.focus)}"]`);
    const label = el && (el.closest('.field') || el.parentElement);
    if (!label) return;
    const tag = document.createElement('span');
    tag.className = 'editing-by';
    tag.textContent = '✎ 모둠원 작성 중';
    label.appendChild(tag);
  });
}
let groupNoteTimer = null;
function groupNote(text) {
  const el = $('#groupNote');
  if (!el) return;
  el.textContent = text;
  clearTimeout(groupNoteTimer);
  groupNoteTimer = setTimeout(() => { el.textContent = ''; }, 4000);
}

/* ───── 모둠 표시줄 · 첫 화면 칸 ───── */
function renderGroupBar() {
  const bar = $('#groupBar');
  if (!bar) return;
  if (!inGroup()) { bar.hidden = true; bar.innerHTML = ''; return; }
  const st = { online: ['ok', '연결됨'], connecting: ['', '연결 중…'], retry: ['warn', '다시 연결하는 중… (쓰는 내용은 연결되면 함께 보내져요)'], off: ['warn', '연결 끊김'] }[group.status] || ['', ''];
  const n = group.members.length;
  const writing = group.members.filter(mb => mb.focus && mb.cid !== groupCid()).length;
  const names = n ? `모둠원 ${n}명 접속 중(나 포함)${writing ? ` · ${writing}명 작성 중` : ''}` : '';
  bar.hidden = false;
  bar.innerHTML = `<span class="g-code">👥 모둠 <b>${esc(state.group.code)}</b></span>
    <span class="g-members">${names || '연결 중…'}</span>
    <span class="g-status ${st[0]}">● ${st[1]}</span><span id="groupNote" class="g-note"></span>`;
  groupShowEditors();
}
function groupBoxHtml() {
  const g = state.group || {};
  const mode = g.mode || 'solo';
  const cards = `<div class="mode-cards">
      <button class="mode-card ${mode !== 'group' ? 'on' : ''}" data-action="groupMode" data-value="solo" ${inGroup() ? 'disabled' : ''}><b>🙋 개별 탐구</b><span>혼자 보고서를 써요</span></button>
      <button class="mode-card ${mode === 'group' ? 'on' : ''}" data-action="groupMode" data-value="group"><b>👥 모둠 탐구</b><span>모둠 코드로 친구들과 함께 써요</span></button>
    </div>`;
  if (mode !== 'group') return cards;
  if (inGroup()) {
    return `${cards}
    <div class="group-box joined">
      <div class="g-big">${esc(g.code)}</div>
      <p>${g.role === 'leader' ? '친구들에게 이 <b>모둠 코드</b>를 알려 주세요. 친구들은 첫 화면의 [모둠 탐구]에서 코드를 넣으면 함께 쓸 수 있어요.' : '모둠에 참여했어요. 모둠원과 같은 보고서를 함께 쓰고 있어요.'}</p>
      <p class="muted small">지금 접속한 모둠원: ${group.members.length ? `${group.members.length}명(나 포함)` : '연결 중…'} · 모둠 탐구 중에는 수업(단원·차시)을 바꿀 수 없어요.</p>
      <button class="btn small ghost" data-action="groupLeave">모둠 나가기</button>
    </div>`;
  }
  return `${cards}
    <div class="group-box">
      <p class="muted small" style="margin-top:0">이름은 쓰지 않아요. 모둠 코드만 있으면 함께 쓸 수 있어요.</p>
      <div class="group-actions">
        <div><p class="muted small">모둠에서 한 명만 만들어요</p>
          <button class="btn primary" data-action="groupCreate" ${group.creating ? 'disabled' : ''}>${group.creating ? '만드는 중…' : '새 모둠 만들기'}</button></div>
        <div><p class="muted small">친구가 알려 준 코드로 참여해요</p>
          <div class="join-row"><input id="groupCode" maxlength="6" placeholder="코드 6자리" autocomplete="off"><button class="btn" data-action="groupJoin">참여하기</button></div></div>
      </div>
      ${!unitName() ? '<p class="muted small">새 모둠을 만드는 친구는 위에서 수업(단원·차시)을 먼저 골라 주세요. 참여하는 친구는 수업을 고르지 않아도 돼요.</p>' : ''}
    </div>`;
}
function renderGroupBox() {
  const box = $('#groupBox');
  if (box) box.innerHTML = groupBoxHtml();
}
