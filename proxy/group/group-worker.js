// 모둠 탐구 서버 — Cloudflare Workers + Durable Objects
// 모둠 코드 하나 = Durable Object(GroupRoom) 하나. 모둠원은 WebSocket으로 같은 방에 연결해 보고서를 함께 씀
//
// 동기화 방식
// · 공유 내용(수업·예상·설계·결론 등)은 "경로: 값" 단위로 주고받고, 서버가 받은 순서대로 적용(나중 입력이 남음)
// · 측정 기록(runs)은 시행마다 따로 저장하고, 측정 중에는 새 줄(rows)만 덧붙여 보냄
// · 서버가 모든 변경의 순서를 정하므로, 모둠원 화면은 결국 같은 내용이 됨
// · 마지막 활동 뒤 30일이 지나면 모둠 기록을 자동으로 지움
//
// 설정: proxy/group/wrangler.toml (ALLOWED_ORIGINS: 허용할 사이트 주소)

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0·O·1·I 제외
const CODE_LEN = 6;
const MAX_MEMBERS = 10;
const MAX_MSG = 512 * 1024;          // 메시지 하나의 최대 크기
const MAX_DOC = 400 * 1024;          // 공유 내용(측정 기록 제외)의 최대 크기
const MAX_RUNS = 60;
const MAX_ROWS = 20000;              // 시행 하나의 최대 데이터 수
const ROWS_CHUNK = 1000;             // 저장할 때 데이터를 나누는 단위
const KEEP_MS = 30 * 24 * 3600 * 1000;
const DEFAULT_ORIGINS = 'https://trjun53.github.io,http://localhost:8080,http://127.0.0.1:8080';

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(CODE_LEN)), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const validCode = c => new RegExp(`^[${CODE_CHARS}]{${CODE_LEN}}$`).test(c);

// 같은 주소(IP)에서 짧은 시간에 너무 많이 만들거나 잘못된 코드로 들어오는 것을 막음 (서버 인스턴스마다 따로 셈)
const hits = new Map();
function limited(key, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': originOk ? origin : 'null', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (!originOk) return json({ error: '허용되지 않은 사이트에서 온 요청입니다.' }, 403, cors);

    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // 새 모둠 만들기: POST /room  { doc, runs } → { code }
    if (request.method === 'POST' && url.pathname === '/room') {
      if (limited('create:' + ip, 30)) return json({ error: '잠시 뒤에 다시 시도해 주세요.' }, 429, cors);
      const body = await request.text();
      if (body.length > MAX_MSG * 4) return json({ error: '보고서 내용이 너무 커서 모둠을 만들 수 없어요.' }, 413, cors);
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch('https://room/init', { method: 'POST', body });
        if (res.status === 201) return json({ code }, 201, cors);
        if (res.status !== 409) return json({ error: '모둠을 만들지 못했어요.' }, 500, cors);
      }
      return json({ error: '모둠 코드를 만들지 못했어요. 다시 시도해 주세요.' }, 500, cors);
    }

    // 모둠 참여(실시간 연결): GET /room/CODE/ws
    const m = /^\/room\/([A-Z0-9]+)\/ws$/.exec(url.pathname);
    if (m && request.headers.get('Upgrade') === 'websocket') {
      const code = m[1];
      if (!validCode(code)) return json({ error: '모둠 코드가 올바르지 않아요.' }, 400, cors);
      if (limited('join:' + ip, 120)) return json({ error: '잠시 뒤에 다시 시도해 주세요.' }, 429, cors);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(request);
    }
    return json({ error: '지원하지 않는 요청입니다.' }, 404, cors);
  },
};

export class GroupRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.loaded = null; // { doc, runs: Map(id → run 정보), rows: Map(id → [줄...]) }
  }

  // ── 저장소 읽기·쓰기 ──
  async load() {
    if (this.loaded) return this.loaded;
    const meta = await this.ctx.storage.get('meta');
    if (!meta) return null;
    const doc = (await this.ctx.storage.get('doc')) || {};
    const runIds = (await this.ctx.storage.get('runIds')) || [];
    const runs = new Map(), rows = new Map();
    for (const id of runIds) {
      const info = await this.ctx.storage.get('run:' + id);
      if (!info) continue;
      const chunks = Math.ceil((info.n || 0) / ROWS_CHUNK);
      const list = [];
      for (let c = 0; c < chunks; c++) list.push(...((await this.ctx.storage.get(`rows:${id}:${c}`)) || []));
      runs.set(id, info.run);
      rows.set(id, list);
    }
    this.loaded = { meta, doc, runs, rows, runIds };
    return this.loaded;
  }
  async saveRun(id) {
    const L = this.loaded, list = L.rows.get(id) || [];
    await this.ctx.storage.put('run:' + id, { run: L.runs.get(id), n: list.length });
  }
  async saveRows(id, fromIndex) {
    const list = this.loaded.rows.get(id) || [];
    for (let c = Math.floor(fromIndex / ROWS_CHUNK); c * ROWS_CHUNK < list.length; c++) {
      await this.ctx.storage.put(`rows:${id}:${c}`, list.slice(c * ROWS_CHUNK, (c + 1) * ROWS_CHUNK));
    }
  }
  async touch() {
    await this.ctx.storage.setAlarm(Date.now() + KEEP_MS);
  }
  async alarm() {
    // 30일 동안 아무도 쓰지 않으면 모둠 기록을 지움
    this.ctx.getWebSockets().forEach(ws => { try { ws.close(4000, 'expired'); } catch (e) { /* ignore */ } });
    await this.ctx.storage.deleteAll();
    this.loaded = null;
  }

  fullRuns() {
    const L = this.loaded;
    return L.runIds.filter(id => L.runs.has(id)).map(id => ({ ...L.runs.get(id), rows: L.rows.get(id) || [] }));
  }
  members() {
    return this.ctx.getWebSockets().map(ws => ws.deserializeAttachment() || {}).filter(a => a.cid).map(a => ({ cid: a.cid, nick: a.nick, focus: a.focus || '' }));
  }
  broadcast(msg, except) {
    const text = JSON.stringify(msg);
    this.ctx.getWebSockets().forEach(ws => { if (ws !== except) { try { ws.send(text); } catch (e) { /* ignore */ } } });
  }

  async fetch(request) {
    const url = new URL(request.url);
    // 새 모둠 만들기 (Worker에서만 부름)
    if (url.pathname === '/init') {
      if (await this.ctx.storage.get('meta')) return new Response('exists', { status: 409 });
      let body = {};
      try { body = JSON.parse(await request.text()); } catch (e) { /* 빈 모둠 */ }
      const doc = body.doc && typeof body.doc === 'object' ? body.doc : {};
      if (JSON.stringify(doc).length > MAX_DOC) return new Response('too big', { status: 413 });
      const runs = Array.isArray(body.runs) ? body.runs.slice(0, MAX_RUNS) : [];
      await this.ctx.storage.put('meta', { created: Date.now(), rev: 0 });
      await this.ctx.storage.put('doc', doc);
      this.loaded = { meta: { created: Date.now(), rev: 0 }, doc, runs: new Map(), rows: new Map(), runIds: [] };
      for (const r of runs) {
        if (!r || !r.id) continue;
        const { rows, ...info } = r;
        this.loaded.runIds.push(r.id);
        this.loaded.runs.set(r.id, info);
        this.loaded.rows.set(r.id, Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : []);
        await this.saveRun(r.id);
        await this.saveRows(r.id, 0);
      }
      await this.ctx.storage.put('runIds', this.loaded.runIds);
      await this.touch();
      return new Response('created', { status: 201 });
    }

    // 실시간 연결
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const L = await this.load();
    if (!L) return new Response(JSON.stringify({ error: '없는 모둠 코드예요. 코드를 다시 확인해 주세요.' }), { status: 404 });
    if (this.ctx.getWebSockets().length >= MAX_MEMBERS) return new Response(JSON.stringify({ error: '모둠원이 너무 많아요(최대 10명).' }), { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const cid = String(url.searchParams.get('cid') || '').slice(0, 20) || crypto.randomUUID().slice(0, 8);
    const nick = String(url.searchParams.get('nick') || '모둠원').replace(/[<>]/g, '').slice(0, 12) || '모둠원';
    server.serializeAttachment({ cid, nick, focus: '' });
    server.send(JSON.stringify({ t: 'init', doc: L.doc, runs: this.fullRuns(), rev: L.meta.rev }));
    this.broadcast({ t: 'members', list: this.members() });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    const L = await this.load();
    if (!L) { ws.close(4004, 'gone'); return; }
    const me = ws.deserializeAttachment() || {};

    if (msg.t === 'focus') { // 누가 어느 칸을 쓰고 있는지
      me.focus = String(msg.p || '').slice(0, 80);
      ws.serializeAttachment(me);
      this.broadcast({ t: 'members', list: this.members() });
      return;
    }
    if (msg.t !== 'ops' || !Array.isArray(msg.ops)) return;

    const applied = [];
    let docChanged = false;
    for (const op of msg.ops.slice(0, 500)) {
      if (!op || typeof op !== 'object') continue;
      if (op.o === 'set' && typeof op.p === 'string' && op.p && !/(^|\.)(__proto__|constructor|prototype)(\.|$)/.test(op.p)) {
        setPath(L.doc, op.p, op.v);
        docChanged = true;
        applied.push(op);
      } else if (op.o === 'run+' && op.run && op.run.id && L.runIds.length < MAX_RUNS) {
        const { rows, ...info } = op.run;
        if (!L.runs.has(info.id)) L.runIds.push(info.id);
        L.runs.set(info.id, info);
        L.rows.set(info.id, Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : []);
        await this.saveRun(info.id); await this.saveRows(info.id, 0);
        await this.ctx.storage.put('runIds', L.runIds);
        applied.push(op);
      } else if (op.o === 'rows' && L.runs.has(op.id) && Array.isArray(op.rows)) {
        const list = L.rows.get(op.id) || [];
        const from = Math.max(0, Math.min(Number(op.from) || 0, list.length));
        list.splice(from, list.length - from, ...op.rows);
        if (list.length > MAX_ROWS) list.length = MAX_ROWS;
        L.rows.set(op.id, list);
        await this.saveRun(op.id); await this.saveRows(op.id, from);
        applied.push(op);
      } else if (op.o === 'run~' && L.runs.has(op.id) && op.fields && typeof op.fields === 'object') {
        const { id, rows, ...fields } = op.fields;
        L.runs.set(op.id, { ...L.runs.get(op.id), ...fields });
        await this.saveRun(op.id);
        applied.push(op);
      } else if (op.o === 'run-' && L.runs.has(op.id)) {
        const n = (L.rows.get(op.id) || []).length;
        L.runs.delete(op.id); L.rows.delete(op.id);
        L.runIds = L.runIds.filter(x => x !== op.id);
        await this.ctx.storage.delete('run:' + op.id);
        for (let c = 0; c * ROWS_CHUNK < Math.max(1, n); c++) await this.ctx.storage.delete(`rows:${op.id}:${c}`);
        await this.ctx.storage.put('runIds', L.runIds);
        applied.push(op);
      }
    }
    if (docChanged) {
      if (JSON.stringify(L.doc).length > MAX_DOC) { ws.send(JSON.stringify({ t: 'error', error: '모둠 보고서 내용이 너무 커요.' })); return; }
      await this.ctx.storage.put('doc', L.doc);
    }
    L.meta.rev = (L.meta.rev || 0) + 1;
    await this.ctx.storage.put('meta', L.meta);
    await this.touch();
    ws.send(JSON.stringify({ t: 'ack', seq: msg.seq, rev: L.meta.rev }));
    if (applied.length) this.broadcast({ t: 'ops', ops: applied, from: me.cid, nick: me.nick, rev: L.meta.rev }, ws);
  }

  async webSocketClose(ws) {
    try { ws.close(); } catch (e) { /* ignore */ }
    this.broadcast({ t: 'members', list: this.members().filter(m => m.cid !== (ws.deserializeAttachment() || {}).cid) });
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }
}

function setPath(obj, path, val) {
  const keys = path.split('.');
  const last = keys.pop();
  let o = obj;
  for (const k of keys) {
    if (o[k] === null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  if (val === undefined) delete o[last]; else o[last] = val;
}
