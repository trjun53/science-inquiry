// 디지털 탐구 센서 블루투스(Web Bluetooth) 드라이버
// - Vernier Go Direct : 공개 프로토콜(godirect-js)을 구현 → 채널 정보 자동 인식
// - PASCO / 사이언스큐브 / 이지메이커 : 범용 BLE 드라이버 + 브랜드별 기본값
//   (서비스 탐색 → 알림(notify) 구독 → 설정한 형식으로 데이터 해석)
// - 시뮬레이션 : 센서 없이 수업 흐름을 연습할 수 있는 가상 센서

const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(' ');
const toAscii = bytes => Array.from(bytes, b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
const parseHex = str => {
  const clean = (str || '').replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
};
const shortUuid = uuid => {
  const m = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i.exec(uuid);
  return m ? '0x' + m[1] : uuid.slice(0, 8) + '…';
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

class BaseDriver {
  constructor() {
    this.handlers = {};
    this.channels = []; // [{id, name, unit, enabled}]
    this.connected = false;
    this.measuring = false;
    this.deviceName = '';
  }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
  emit(ev, ...args) { (this.handlers[ev] || []).forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } }); }
  _onDisconnected() {
    const was = this.connected;
    this.connected = false;
    this.measuring = false;
    clearInterval(this.pollTimer);
    if (was) this.emit('disconnected');
  }
  async disconnect() {
    this.userClosed = true;
    try { if (this.measuring) await this.stop(); } catch (e) { /* ignore */ }
    try { if (this.device && this.device.gatt.connected) this.device.gatt.disconnect(); } catch (e) { /* ignore */ }
    this._onDisconnected();
  }
}

/* ───────────────────────── Vernier Go Direct ───────────────────────── */
const GDX = {
  service: 'd91714ef-28b9-4f91-ba16-f0d9a604f112',
  command: 'f4bf14a6-c7d5-4b6d-8aa8-df1a7c83adcb',
  response: 'b41e6675-a329-40e0-aa01-44d2f444babe',
  INIT: [0x1a, 0xa5, 0x4a, 0x06, 0x49, 0x07, 0x48, 0x08, 0x47, 0x09, 0x46, 0x0a, 0x45, 0x0b, 0x44, 0x0c, 0x43, 0x0d, 0x42, 0x0e, 0x41],
  GET_STATUS: [0x10],
  GET_SENSOR_IDS: [0x51],
  GET_DEFAULT_MASK: [0x56],
  STOP: [0x19, 0xff, 0x00, 0xff, 0xff, 0xff, 0xff],
  DISCONNECT: [0x54],
  MEAS: 0x20,
};

class VernierDriver extends BaseDriver {
  constructor() {
    super();
    this.brand = 'vernier';
    this.counter = 0xff;
    this.pending = new Map();
    this.rx = null;
    this.writeChain = Promise.resolve();
    this.periodUs = 100000;
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'GDX' }],
      optionalServices: [GDX.service],
    });
    this.deviceName = this.device.name || 'Go Direct';
    this.device.addEventListener('gattserverdisconnected', () => this._onDisconnected());
    this.emit('status', `${this.deviceName} 연결 중…`);
    const server = await this.device.gatt.connect();
    const svc = await server.getPrimaryService(GDX.service);
    this.cmdChar = await svc.getCharacteristic(GDX.command);
    this.respChar = await svc.getCharacteristic(GDX.response);
    this.respChar.addEventListener('characteristicvaluechanged', e => this._onNotify(e.target.value));
    await this.respChar.startNotifications();
    this.connected = true;

    this.emit('status', '센서 초기화 중…');
    await this._cmd(GDX.INIT);
    await this._cmd(GDX.GET_STATUS);
    const def = await this._cmd(GDX.GET_DEFAULT_MASK);
    const defaultMask = def.view.byteLength >= 4 ? def.view.getUint32(0, true) : 1;
    const ids = await this._cmd(GDX.GET_SENSOR_IDS);
    const available = ids.view.getUint32(0, true);

    this.channels = [];
    for (let i = 0; i < 31; i++) {
      if (!(available & (1 << i))) continue;
      const info = await this._cmd([0x50, i]);
      const ch = this._parseSensorInfo(info, i);
      if (ch) {
        ch.enabled = !!(defaultMask & (1 << i));
        this.channels.push(ch);
      }
    }
    if (this.channels.length && !this.channels.some(c => c.enabled)) this.channels[0].enabled = true;
    this.emit('channels', this.channels);
    this.emit('status', `${this.deviceName} 연결됨`);
  }

  _parseSensorInfo({ view, frame }, number) {
    if (view.byteLength < 8) return null;
    const id = view.getUint32(2, true);
    if (id === 0) return null;
    const str = (a, b) => new TextDecoder().decode(frame.slice(a, b).filter(x => x !== 0)).trim();
    const name = str(14, 74) || `센서 ${number}`;
    const unit = str(74, 106);
    let minPeriodMs = 10;
    if (view.byteLength >= 128) minPeriodMs = view.getUint32(124, true) / 1000;
    return { id: number, name, unit, minPeriodMs, enabled: false };
  }

  // 프레임: [0x58, 길이, 롤링카운터, 체크섬, ...명령]
  _cmd(sub, timeoutMs = 5000) {
    const frame = new Uint8Array(sub.length + 4);
    frame[0] = 0x58;
    frame.set(sub, 4);
    frame[1] = frame.length;
    this.counter = (this.counter - 1) & 0xff;
    frame[2] = this.counter;
    let sum = 0;
    for (let i = 0; i < frame.length; i++) if (i !== 3) sum = (sum + frame[i]) & 0xff;
    frame[3] = sum;
    const key = `${sub[0]}:${frame[2]}`;

    const p = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(key); reject(new Error('센서 응답 시간 초과')); }, timeoutMs);
      this.pending.set(key, r => { clearTimeout(timer); resolve(r); });
    });
    this.writeChain = this.writeChain.then(async () => {
      for (let i = 0; i < frame.length; i += 20) {
        await this.cmdChar.writeValue(frame.slice(i, i + 20));
      }
    }).catch(e => console.error(e));
    return p;
  }

  _onNotify(dv) {
    const chunk = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    if (this.rx && this.rx.length < this.rx[1]) {
      const merged = new Uint8Array(this.rx.length + chunk.length);
      merged.set(this.rx); merged.set(chunk, this.rx.length);
      this.rx = merged;
    } else {
      this.rx = new Uint8Array(chunk);
    }
    if (this.rx.length < 2 || this.rx.length < this.rx[1]) return; // 패킷 이어 받기
    const frame = this.rx.slice(0, this.rx[1] || this.rx.length);
    this.rx = null;

    if (frame[0] === GDX.MEAS) { this._onMeasurement(frame); return; }
    const key = `${frame[4]}:${frame[5]}`;
    const resolve = this.pending.get(key);
    if (resolve) {
      this.pending.delete(key);
      resolve({ frame, view: new DataView(frame.buffer, 6) });
    }
  }

  _onMeasurement(frame) {
    const v = new DataView(frame.buffer);
    const type = frame[4];
    const sensorsIn = mask => this.channels.filter(c => mask & (1 << c.id)).map(c => c.id);
    const periodS = this.periodUs / 1e6;
    const emitRows = (ids, count, offset, reader) => {
      for (let k = 0; k < count; k++) {
        const values = {};
        for (const id of ids) {
          if (offset + 4 > frame.length) return;
          values[id] = reader(offset); offset += 4;
        }
        const t = (this.sampleIndex[ids.join(',')] = (this.sampleIndex[ids.join(',')] || 0) + 1) - 1;
        this.emit('sample', { t: t * periodS, values });
      }
    };
    const f32 = o => v.getFloat32(o, true);
    const i32 = o => v.getInt32(o, true);
    switch (type) {
      case 0x06: emitRows(sensorsIn(v.getUint16(5, true)), frame[7], 9, f32); break;   // NORMAL_REAL32
      case 0x07: emitRows(sensorsIn(v.getUint32(5, true)), frame[9], 11, f32); break;  // WIDE_REAL32
      case 0x08: case 0x0a: emitRows([frame[6]], frame[7], 8, f32); break;             // SINGLE/APERIODIC REAL32
      case 0x09: case 0x0b: emitRows([frame[6]], frame[7], 8, i32); break;             // SINGLE/APERIODIC INT32
      default: break; // START_TIME, DROPPED, PERIOD 등은 무시
    }
  }

  async start(intervalMs) {
    const enabled = this.channels.filter(c => c.enabled);
    if (!enabled.length) throw new Error('측정할 채널을 하나 이상 선택하세요.');
    const minMs = Math.max(10, ...enabled.map(c => c.minPeriodMs || 10));
    this.periodUs = Math.round(Math.max(intervalMs, minMs) * 1000);
    const period = [0x1b, 0xff, 0x00, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 4; i++) period[3 + i] = (this.periodUs >>> (8 * i)) & 0xff;
    await this._cmd(period);

    let mask = 0;
    enabled.forEach(c => { mask |= (1 << c.id); });
    const start = [0x18, 0xff, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 4; i++) start[3 + i] = (mask >>> (8 * i)) & 0xff;
    this.sampleIndex = {};
    const r = await this._cmd(start);
    if (r.view.byteLength && r.view.getUint8(0) !== 0) throw new Error('측정 시작 실패 (동시에 사용할 수 없는 채널 조합일 수 있습니다)');
    this.measuring = true;
    return this.periodUs / 1000;
  }

  async stop() {
    this.measuring = false;
    if (this.connected) await this._cmd(GDX.STOP).catch(() => {});
  }

  async disconnect() {
    try { if (this.measuring) await this.stop(); } catch (e) { /* ignore */ }
    try { if (this.connected) await this._cmd(GDX.DISCONNECT, 800); } catch (e) { /* ignore */ }
    await super.disconnect();
  }
}

/* ───────────────────────── 범용 BLE 드라이버 ───────────────────────── */
const pascoUuid = (s, c) => `4a5c000${s}-000${c}-0000-0000-5c1e741f1c00`;

// 범용 연결 시 접근을 허용할 서비스 후보 (Web Bluetooth는 미리 선언한 서비스만 접근 가능)
const COMMON_SERVICES = [
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART (micro:bit, nRF 계열)
  '4fafc201-1fb5-459e-8fcc-c5c9c331914b', // ESP32 BLE 예제 기본 UUID
  0xffe0, 0xfff0, 0xffe5, 0xfee0,          // HM-10/HC-08/CC254x 계열 시리얼 모듈
  0x181a, 0x180f, 0x1809,                  // 환경 센싱, 배터리, 체온계
];

const BRAND_PRESETS = {
  pasco: {
    label: 'PASCO 무선 센서',
    namePrefixes: ['Temperature', 'Temp', 'Force', 'Voltage', 'Current', 'Light', 'pH', 'CO2', 'O2', 'Pressure',
      'Weather', 'Motion', 'Magnetic', 'Conductivity', 'Accel', 'Rotary', 'Load Cell', 'Drop Counter', 'Smart Cart',
      'Sound', 'Optical DO', '//control.Node', '//code.Node', 'Diffraction'],
    services: [0, 1, 2, 3, 4, 5].map(s => pascoUuid(s, 0)),
    decoder: {
      format: 'binary', listen: pascoUuid(1, 3),
      fields: [{ name: '측정값', unit: '', offset: 1, type: 'fixed16_16', le: true, scale: 1, add: 0 }],
      startChar: '', startHex: '', stopChar: '', stopHex: '',
      pollChar: pascoUuid(1, 2), pollHex: '05 04',
    },
    note: 'PASCO 센서는 기종마다 데이터 형식(데이터시트)이 다릅니다. 연결 후 [원시 데이터]를 보며 형식을 맞춰 주세요. 기본값은 1번 채널에 1회 측정 요청(05 04)을 보내고 응답의 2번째 바이트부터 16.16 고정소수점으로 읽습니다.',
  },
  sciencecube: {
    label: '사이언스큐브',
    namePrefixes: [],
    services: [],
    decoder: {
      format: 'text', listen: '',
      fields: [{ name: '측정값', unit: '' }],
      startChar: '', startHex: '', stopChar: '', stopHex: '', pollChar: '', pollHex: '',
    },
    note: '공개된 통신 규격이 없어 범용 방식으로 연결합니다. 센서가 숫자 텍스트(예: "23.5\\n")를 보내면 바로 측정됩니다. 바이너리 형식이면 [데이터 해석 설정]에서 형식을 지정하세요.',
  },
  easymaker: {
    label: '이지메이커',
    namePrefixes: [],
    services: [],
    decoder: {
      format: 'text', listen: '',
      fields: [{ name: '측정값', unit: '' }],
      startChar: '', startHex: '', stopChar: '', stopHex: '', pollChar: '', pollHex: '',
    },
    note: '공개된 통신 규격이 없어 범용 방식으로 연결합니다. 메이커 보드(아두이노·ESP32·micro:bit)의 BLE 시리얼로 "값1,값2" 형태의 텍스트를 보내면 채널별로 측정됩니다.',
  },
};

class GenericBleDriver extends BaseDriver {
  constructor(brand, config) {
    super();
    this.brand = brand;
    this.config = config; // {namePrefixes, extraServices, showAll, decoder}
    this.chars = [];
    this.textBuf = {};
    this.seenNewline = {};
    this.flushTimer = {};
  }

  _uuid(u) {
    if (typeof u === 'number') return BluetoothUUID.getService(u);
    const s = String(u).trim().toLowerCase();
    if (/^0x[0-9a-f]{4}$/.test(s)) return BluetoothUUID.getService(parseInt(s, 16));
    if (/^[0-9a-f]{4}$/.test(s)) return BluetoothUUID.getService(parseInt(s, 16));
    return s;
  }

  async connect() {
    const preset = BRAND_PRESETS[this.brand];
    const extra = (this.config.extraServices || '').split(/[\s,]+/).filter(Boolean);
    const optionalServices = [...new Set([...preset.services, ...COMMON_SERVICES, ...extra].map(u => this._uuid(u)))];
    const prefixes = (this.config.namePrefixes || []).filter(Boolean);
    const opts = prefixes.length && !this.config.showAll
      ? { filters: prefixes.map(p => ({ namePrefix: p })), optionalServices }
      : { acceptAllDevices: true, optionalServices };

    this.device = await navigator.bluetooth.requestDevice(opts);
    this.deviceName = this.device.name || '이름 없는 기기';
    this.device.addEventListener('gattserverdisconnected', () => this._onDisconnected());
    this.emit('status', `${this.deviceName} 연결 중…`);
    const server = await this.device.gatt.connect();
    this.connected = true;

    this.emit('status', '서비스 탐색 중…');
    let services = [];
    try { services = await server.getPrimaryServices(); } catch (e) { services = []; }
    this.chars = [];
    for (const svc of services) {
      let chars = [];
      try { chars = await svc.getCharacteristics(); } catch (e) { continue; }
      for (const ch of chars) {
        const p = ch.properties;
        this.chars.push({
          service: svc.uuid, uuid: ch.uuid, ch,
          notify: p.notify || p.indicate, write: p.write || p.writeWithoutResponse, read: p.read,
        });
      }
    }
    if (!this.chars.length) {
      this.emit('status', '접근 가능한 서비스가 없습니다');
      throw new Error('접근 가능한 BLE 서비스를 찾지 못했습니다. [데이터 해석 설정]의 "추가 서비스 UUID"에 기기의 서비스 UUID를 입력한 뒤 다시 연결하세요.');
    }
    for (const c of this.chars.filter(c => c.notify)) {
      try {
        c.ch.addEventListener('characteristicvaluechanged', e => this._onNotify(c.uuid, e.target.value));
        await c.ch.startNotifications();
      } catch (e) { console.warn('notify 실패', c.uuid, e); }
    }
    this.applyDecoder(this.config.decoder);
    this.emit('status', `${this.deviceName} 연결됨`);
  }

  applyDecoder(decoder) {
    this.config.decoder = decoder;
    const old = this.channels;
    this.channels = (decoder.fields || []).map((f, i) => ({
      id: i, name: f.name || `값${i + 1}`, unit: f.unit || '',
      enabled: old[i] ? old[i].enabled : true,
    }));
    this.emit('channels', this.channels);
  }

  _ensureChannels(n) {
    if (n <= this.channels.length) return;
    for (let i = this.channels.length; i < n; i++) {
      this.channels.push({ id: i, name: `값${i + 1}`, unit: '', enabled: true });
      this.config.decoder.fields.push({ name: `값${i + 1}`, unit: '' });
    }
    this.emit('channels', this.channels);
  }

  _onNotify(uuid, dv) {
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength).slice();
    this.emit('raw', { uuid, bytes });
    const d = this.config.decoder;
    if (d.listen && d.listen.toLowerCase() !== uuid.toLowerCase()) return;

    if (d.format === 'text') {
      // 줄바꿈으로 끝나는 형식과 패킷마다 값 하나를 보내는 형식을 모두 처리
      const text = new TextDecoder().decode(bytes);
      clearTimeout(this.flushTimer[uuid]);
      if (/[\r\n]/.test(text)) this.seenNewline[uuid] = true;
      const lines = ((this.textBuf[uuid] || '') + text).split(/\r?\n|\r/);
      this.textBuf[uuid] = lines.pop();
      lines.forEach(l => this._parseLine(l));
      if (!this.seenNewline[uuid] && this.textBuf[uuid]) {
        this.flushTimer[uuid] = setTimeout(() => {
          const l = this.textBuf[uuid];
          this.textBuf[uuid] = '';
          this._parseLine(l);
        }, 40);
      }
    } else {
      const v = new DataView(bytes.buffer);
      const values = {};
      d.fields.forEach((f, i) => {
        const val = readField(v, f);
        if (val !== null) values[i] = val * (Number(f.scale) || 1) + (Number(f.add) || 0);
      });
      if (Object.keys(values).length) this._emitSample(values);
    }
  }

  _parseLine(line) {
    const nums = (line.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) || []).map(Number);
    if (!nums.length) return;
    this._ensureChannels(nums.length);
    const values = {};
    nums.forEach((n, i) => {
      const f = this.config.decoder.fields[i] || {};
      values[i] = n * (Number(f.scale) || 1) + (Number(f.add) || 0);
    });
    this._emitSample(values);
  }

  _emitSample(values) {
    if (!this.measuring) { this.emit('preview', values); return; } // 측정 전 실시간 값 미리보기
    const t = (performance.now() - this.t0) / 1000;
    if (this.lastT !== null && t - this.lastT < this.intervalS * 0.85) return; // 측정 간격에 맞춰 솎아내기
    this.lastT = t;
    this.emit('sample', { t: Math.round(t * 1000) / 1000, values });
  }

  _findChar(uuid, needWrite) {
    if (uuid) return this.chars.find(c => c.uuid.toLowerCase() === uuid.toLowerCase());
    return needWrite ? this.chars.find(c => c.write) : null;
  }

  async _write(uuid, hex) {
    const bytes = parseHex(hex);
    if (!bytes.length) return;
    const c = this._findChar(uuid, true);
    if (!c) throw new Error('쓰기 가능한 특성을 찾지 못했습니다: ' + (uuid || '(자동)'));
    if (c.ch.properties.writeWithoutResponse && !c.ch.properties.write) await c.ch.writeValueWithoutResponse(bytes);
    else await c.ch.writeValue(bytes);
  }

  async start(intervalMs) {
    const d = this.config.decoder;
    this.intervalS = intervalMs / 1000;
    this.t0 = performance.now();
    this.lastT = null;
    this.textBuf = {};
    this.measuring = true;
    if (d.startHex) await this._write(d.startChar, d.startHex);
    if (d.pollHex) {
      const poll = async () => {
        if (!this.measuring || this.polling) return;
        this.polling = true;
        try { await this._write(d.pollChar, d.pollHex); } catch (e) { console.warn(e); }
        this.polling = false;
      };
      poll();
      this.pollTimer = setInterval(poll, Math.max(50, intervalMs));
    }
    return intervalMs;
  }

  async stop() {
    this.measuring = false;
    clearInterval(this.pollTimer);
    const d = this.config.decoder;
    if (d.stopHex && this.connected) await this._write(d.stopChar, d.stopHex).catch(() => {});
  }
}

function readField(v, f) {
  const o = Number(f.offset) || 0;
  const le = f.le !== false;
  const size = { uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4, float32: 4, fixed16_16: 4 }[f.type] || 1;
  if (o + size > v.byteLength) return null;
  switch (f.type) {
    case 'uint8': return v.getUint8(o);
    case 'int8': return v.getInt8(o);
    case 'uint16': return v.getUint16(o, le);
    case 'int16': return v.getInt16(o, le);
    case 'uint32': return v.getUint32(o, le);
    case 'int32': return v.getInt32(o, le);
    case 'float32': return v.getFloat32(o, le);
    case 'fixed16_16': return v.getInt32(o, le) / 65536;
    default: return null;
  }
}

/* ───────────────────────── 시뮬레이션 ───────────────────────── */
const SIM_MODELS = {
  temp: t => 20 + 45 * (1 - Math.exp(-t / 90)),
  voltage: (t, k) => 1.5 * k - 0.004 * t,
  current: (t, k) => 0.12 * k - 0.0005 * t,
  force: t => 2.0 + 1.5 * Math.sin(t / 3) * Math.exp(-t / 40),
  motion: t => 0.2 + 0.5 * 0.08 * t * t,
  accel: t => 0.8 + 0.05 * Math.sin(t),
  ph: t => 2 + 10 / (1 + Math.exp(-(t - 60) / 6)),
  co2: t => 1200 - 600 * (1 - Math.exp(-t / 120)),
  o2: t => 20.9 + 0.8 * (1 - Math.exp(-t / 150)),
  light: t => 800 / (1 + 0.02 * t * t) + 50,
  sound: t => 45 + 25 * Math.exp(-t / 5) * Math.abs(Math.sin(t)),
  pressure: t => 101.3 * 60 / Math.max(20, 60 - 0.5 * t),
  humidity: t => 45 + 25 * (1 - Math.exp(-t / 100)),
  magnetic: t => 5 / Math.pow(1 + 0.05 * t, 3),
  conductivity: t => 50 + 40 * t,
};

class SimulationDriver extends BaseDriver {
  constructor(sensorKey) {
    super();
    this.brand = 'sim';
    this.setSensor(sensorKey);
  }
  setSensor(key) {
    this.sensorKey = SENSOR_TYPES[key] ? key : 'temp';
    const s = SENSOR_TYPES[this.sensorKey];
    this.channels = [{ id: 0, name: s.name, unit: s.unit, enabled: true }];
    this.emit('channels', this.channels);
  }
  async connect() {
    await sleep(500);
    this.connected = true;
    this.deviceName = '가상 센서';
    this.emit('channels', this.channels);
    this.emit('status', '가상 센서 연결됨');
  }
  async start(intervalMs) {
    const f = SIM_MODELS[this.sensorKey];
    // 측정할 때마다 조건이 달라진 것처럼 변화율·크기에 차이를 줌
    this.runNo = (this.runNo || 0) + 1;
    const k = this.runNo;
    const rate = 1.4 / (0.6 + 0.4 * k);
    const scale = Math.abs(f(0, k)) || 1;
    let n = 0;
    this.measuring = true;
    this.timer = setInterval(() => {
      const t = n * intervalMs / 1000;
      const y = f(t * rate, k) + (Math.random() - 0.5) * 0.01 * scale;
      this.emit('sample', { t: Math.round(t * 1000) / 1000, values: { 0: Math.round(y * 1000) / 1000 } });
      n++;
    }, intervalMs);
    return intervalMs;
  }
  async stop() { this.measuring = false; clearInterval(this.timer); }
  async disconnect() { this.userClosed = true; await this.stop(); this.connected = false; this.emit('disconnected'); }
}
