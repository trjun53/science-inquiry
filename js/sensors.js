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
    services: [0, 1, 2, 3, 4, 5, 6, 7].map(s => pascoUuid(s, 0)),
    decoder: {
      format: 'binary', listen: pascoUuid(1, 3),
      fields: [{ name: '측정값', unit: '', offset: 1, type: 'fixed16_16', le: true, scale: 1, add: 0 }],
      startChar: '', startHex: '', stopChar: '', stopHex: '',
      pollChar: pascoUuid(1, 2), pollHex: '05 04',
    },
    note: 'PASCO 공식 통신 방식으로 기기 이름에서 센서 종류(온도, 압력, 전압, 전류, pH, 이산화 탄소, 산소, 빛, 힘, 자기장 등)를 알아내고, 기종별 보정식으로 값을 계산합니다. 압력은 kPa로 표시합니다. 아래 설정은 종류를 알 수 없는 기기에만 쓰입니다.',
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
    let opts = prefixes.length && !this.config.showAll
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

/* ───────────────────────── PASCO 무선 센서 ─────────────────────────
   PASCO 공식 Python 라이브러리(pasco)의 통신 방식을 그대로 따름
   - 기기 이름 "Pressure 788-004>38" → '>' 다음 글자로 기종(인터페이스 ID) 확인
   - 센서 채널 n마다 서비스 n+1의 특성 2에 [0x05, 데이터 크기]를 써서 1회 측정을 요청
   - 응답 [C0 00 05 원시값…]을 데이터시트(pasco-sheets.js)의 보정식으로 실제 값으로 바꿈 */
const PASCO_KO = {
  Temperature: '온도', Pressure: '압력', Voltage: '전압', Current: '전류', pH: 'pH', Conductivity: '전기 전도도',
  CO2Concentration: '이산화 탄소 농도', OxygenGasConcentration: '산소 농도', Illuminance: '조도', White: '빛의 세기',
  Force: '힘', AccelerationResultant: '가속도', Accelerationx: '가속도 x', Accelerationy: '가속도 y', Accelerationz: '가속도 z',
  Position: '거리', MagFieldResultant: '자기장 세기', MagFieldX: '자기장 x', MagFieldY: '자기장 y', MagFieldZ: '자기장 z',
  RelativeHumidity: '상대 습도', AbsoluteHumidity: '절대 습도', BarometricPressure: '기압', WindSpeed: '풍속', DewPoint: '이슬점',
  SoundLevelA: '소리 크기(A)', SoundLevelC: '소리 크기(C)', TotalDissolvedSolids: '총 용존 고형물', DissolvedOxygen: '용존 산소',
  HeartRate: '심박수', Drops: '물방울 수', VWCLoam: '토양 수분', UVIndex: '자외선 지수', SolarIrradiance: '일사량',
};
const PASCO_UNITS = {
  DegC: '°C', psi: 'kPa', ms2: 'm/s²', percent: '%', pph: '%', utesla: 'µT', uSpcm: 'µS/cm', gpm3: 'g/m³', ugpm3: 'µg/m³',
  mps: 'm/s', wpm2: 'W/m²', umolpm2ps: 'µmol/m²/s', BeatsPerMin: 'bpm', mgpL: 'mg/L', Unitless: '', degps: '°/s', deg: '°',
  dBA: 'dB', dBC: 'dB', Lps: 'L/s', drops: '방울',
};
const PSI_TO_KPA = 6.894757;

// 데이터시트의 식(예: "(([8]/65536)*165)-40", "table([0],7122,45,…)")에 쓰는 함수
const PASCO_FN = {
  sqrt: Math.sqrt, atan2: Math.atan2, log: Math.log10, max: Math.max,
  limit: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
  usound: (us, c) => (us / 1e6) * c / 2,
  dewpoint: (t, rh) => { const e = rh * 6.11 * Math.pow(10, 7.5 * t / (237.7 + t)) / 100; return (-443.22 + 237.7 * Math.log(e)) / (-Math.log(e) + 19.08); },
  heatindex: (t, rh) => t + 0.55555 * (rh * 6.11 * Math.pow(10, 7.5 * t / (237.7 + t)) / 100 - 10),
  windchill: (t, w) => {
    const f = 9 * t / 5 + 32, mph = w * 2.237;
    const c = mph < 3 || f > 50 ? f : 35.74 + 0.6215 * f - 35.75 * Math.pow(mph, 0.16) + 0.4275 * f * Math.pow(mph, 0.16);
    return 5 * (c - 32) / 9;
  },
  table: (x, ...pts) => {
    const p = []; for (let i = 0; i + 1 < pts.length; i += 2) p.push([pts[i], pts[i + 1]]);
    let i = 0; while (i < p.length - 2 && x > p[i + 1][0]) i++;
    const [x0, y0] = p[i], [x1, y1] = p[i + 1];
    return (y1 - y0) / (x1 - x0) * (x - x0) + y0;
  },
};
const PASCO_FN_NAMES = Object.keys(PASCO_FN);
const pascoEqCache = {};
function pascoEval(eq, get) {
  let fail = false;
  const expr = eq.replace(/\[(\d+)\]/g, (_, id) => {
    const v = get(Number(id));
    if (v === null || v === undefined || !isFinite(v)) fail = true;
    return `(${v})`;
  }).replace(/\^/g, '**');
  if (fail) return null;
  // 데이터시트에 있는 숫자·연산자·허용 함수만 계산 (그 밖의 식은 지원하지 않음)
  const words = expr.match(/[a-zA-Z_]\w*/g) || [];
  if (words.some(w => !PASCO_FN_NAMES.includes(w) && !/^e\d*$/i.test(w))) return null;
  if (/[^\w\s.+\-*/(),]/.test(expr)) return null;
  try {
    const fn = pascoEqCache[expr] || (pascoEqCache[expr] = new Function(...PASCO_FN_NAMES, `return (${expr});`));
    const v = fn(...PASCO_FN_NAMES.map(k => PASCO_FN[k]));
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch (e) { return null; }
}

// 센서 하나의 응답 바이트 → {측정ID: 값}
function pascoDecode(sensor, bytes) {
  const vals = {};
  let pos = 0;
  for (const m of sensor.m) {
    if (m.t !== 'RawDigital' && m.t !== 'Direct') continue;
    const sz = m.sz || 0;
    if (pos + sz > bytes.length) { vals[m.id] = null; pos += sz; continue; }
    let v = 0;
    for (let d = 0; d < sz; d++) v += bytes[pos + d] * Math.pow(2, 8 * d);
    pos += sz;
    if (sz === 4 || m.tc === 1) { if (v >= Math.pow(2, 8 * sz - 1)) v -= Math.pow(2, 8 * sz); }
    if (m.t === 'Direct' && sz === 4) v = v / 65536;
    vals[m.id] = v;
  }
  const byId = {};
  sensor.m.forEach(m => { byId[m.id] = m; });
  const busy = new Set();
  const get = id => {
    if (id in vals) return vals[id];
    const m = byId[id];
    if (!m || busy.has(id)) return null;
    busy.add(id);
    let r = null;
    const p = (m.p || '').split(',').map(Number);
    const ins = String(m.in ?? '').split(',').filter(s => s !== '').map(Number);
    if (m.t === 'Constant') r = Number(m.val);
    else if (m.eq) r = pascoEval(m.eq, get);
    else if (ins.length) {
      const x = get(ins[0]);
      if (x !== null && x !== undefined) {
        if (m.t === 'FactoryCal' || m.t === 'UserCal') {
          const [x1, y1, x2, y2] = p;
          const b = (x1 * y2 - x2 * y1) / (x1 - x2);
          const k = x2 !== 0 ? (y2 - b) / x2 : (y1 - b) / x1;
          r = k * x + b;
        } else if (m.t === 'LinearConv') r = p[0] * x + p[1];
        else if (m.t === 'Select') r = x;
        else if (m.t === 'ThreeInputVector') {
          const ys = ins.map(get);
          r = ys.every(y => y !== null) ? Math.hypot(...ys) : null;
        }
      }
    }
    if (r !== null && m.lim) { const [lo, hi] = m.lim.split(',').map(Number); r = Math.min(Math.max(r, lo), hi); }
    busy.delete(id);
    vals[id] = r;
    return r;
  };
  sensor.m.forEach(m => get(m.id));
  return vals;
}

function pascoDecode64(ch) {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'K' && ch <= 'Z') return ch.charCodeAt(0) - 65;
  if (ch >= 'A' && ch <= 'J') return ch.charCodeAt(0) - 65 + 26;
  if (ch >= 'a' && ch <= 'z') return ch.charCodeAt(0) - 97 + 36;
  if (ch === '*') return 62;
  if (ch === '#') return 63;
  return -1;
}

class PascoDriver extends GenericBleDriver {
  constructor(config) {
    super('pasco', config);
    this.sheet = null;   // 기종을 알아내면 데이터시트 사용, 모르면 범용 방식(데이터 해석 설정)으로 동작
    this.waiters = {};
  }

  // "Pressure 788-004>38" → 인터페이스 1027 (WirelessPressure)
  static interfaceOf(name) {
    const m = /(\d{3}-\d{3})>(.)/.exec(name || '');
    if (!m || typeof PASCO_SHEETS === 'undefined') return null;
    const id = pascoDecode64(m[2]) + 1024;
    return PASCO_SHEETS.ifaces[id] ? { id, serial: m[1], ...PASCO_SHEETS.ifaces[id] } : null;
  }

  async connect() {
    await super.connect();
    const iface = PascoDriver.interfaceOf(this.deviceName);
    if (!iface) {
      this.emit('status', `${this.deviceName} 연결됨 (기종을 알 수 없어 범용 방식 사용)`);
      return;
    }
    this.deviceName = `${iface.name} ${iface.serial}`;
    this.sheet = iface;
    this.sensors = iface.ch.map(([ch, sid]) => {
      const s = PASCO_SHEETS.sensors[sid];
      return { ch, sid, s, size: s.m.reduce((a, m) => a + ((m.t === 'RawDigital' || m.t === 'Direct') ? (m.sz || 0) : 0), 0), fails: 0 };
    }).filter(x => x.s && x.size > 0);
    // 화면에 보이는 측정 항목만 채널로 만들고, 기본 측정 항목만 처음에 켜 둠
    this.channels = [];
    this.sensors.forEach(x => {
      const vis = x.s.m.filter(m => m.v === 1 && m.int !== 1);
      const def = vis.find(m => m.def === 1) || vis[0];
      vis.forEach(m => {
        const psi = m.u === 'psi';
        this.channels.push({
          id: this.channels.length, name: PASCO_KO[m.n] || m.n, unit: PASCO_UNITS[m.u] ?? (m.u || ''),
          enabled: m === def && x === this.sensors[0],
          ch: x.ch, mid: m.id, factor: psi ? PSI_TO_KPA : 1, pr: psi ? 1 : (m.pr ?? 3),
        });
      });
    });
    if (!this.channels.some(c => c.enabled) && this.channels[0]) this.channels[0].enabled = true;
    this.emit('channels', this.channels);
    this.emit('status', `${this.deviceName} 연결됨`);
    this._loop(); // 연결되면 바로 실시간 값을 보여 줌
  }

  applyDecoder(decoder) {
    if (this.sheet) { this.config.decoder = decoder; this.emit('channels', this.channels); return; }
    super.applyDecoder(decoder);
  }

  _onNotify(uuid, dv) {
    if (!this.sheet) return super._onNotify(uuid, dv);
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength).slice();
    this.emit('raw', { uuid, bytes });
    // 응답: [C0, 결과(00=정상), 05(1회 측정), 원시값…]
    const svc = parseInt(uuid.charAt(7), 16);
    const w = this.waiters[svc - 1];
    if (!w || bytes[0] !== 0xc0 || bytes[2] !== 0x05) return;
    delete this.waiters[svc - 1];
    clearTimeout(w.timer);
    if (bytes[1] === 0x00) w.resolve(bytes.slice(3)); else w.reject(new Error('센서가 측정 요청을 거절했습니다'));
  }

  _request(x) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => { delete this.waiters[x.ch]; reject(new Error('응답 없음')); }, 1500);
      this.waiters[x.ch] = { resolve, reject, timer };
      try {
        const c = this._findChar(pascoUuid(x.ch + 1, 2));
        if (!c) throw new Error('측정 요청 특성을 찾지 못했습니다');
        const cmd = new Uint8Array([0x05, x.size]);
        if (c.ch.properties.writeWithoutResponse && !c.ch.properties.write) await c.ch.writeValueWithoutResponse(cmd);
        else await c.ch.writeValue(cmd);
      } catch (e) { clearTimeout(timer); delete this.waiters[x.ch]; reject(e); }
    });
  }

  async _readAll() {
    const values = {};
    const need = new Set(this.channels.filter(c => c.enabled).map(c => c.ch));
    for (const x of this.sensors) {
      if (!need.has(x.ch) || !this.connected) continue;
      try {
        const vals = pascoDecode(x.s, await this._request(x));
        x.fails = 0;
        this.channels.filter(c => c.ch === x.ch).forEach(c => {
          const v = vals[c.mid];
          if (v !== null && v !== undefined && isFinite(v)) {
            const p = Math.pow(10, Math.min(6, Math.max(0, c.pr + 1)));
            values[c.id] = Math.round(v * c.factor * p) / p;
          }
        });
      } catch (e) {
        if (++x.fails === 3) this.emit('status', `${this.deviceName}: ${e.message} — 센서 전원과 거리를 확인하세요`);
      }
    }
    return values;
  }

  // 측정 중에는 측정 간격마다, 아니면 0.5초마다 값을 읽음
  async _loop() {
    if (this.looping) return;
    this.looping = true;
    while (this.connected && this.sheet) {
      const began = performance.now();
      const meas = this.measuring;
      const t = meas ? (began - this.t0) / 1000 : 0;
      const values = await this._readAll();
      if (Object.keys(values).length) {
        if (meas && this.measuring) this.emit('sample', { t: Math.round(t * 1000) / 1000, values });
        else if (!this.measuring) this.emit('preview', values);
      }
      const wait = (this.measuring ? this.intervalMs : 500) - (performance.now() - began);
      await new Promise(r => { this._wake = r; setTimeout(r, Math.max(20, wait)); });
    }
    this.looping = false;
  }

  async start(intervalMs) {
    if (!this.sheet) return super.start(intervalMs);
    // 블루투스 1회 측정 방식이라 너무 짧은 간격은 0.1초로 맞춤
    this.intervalMs = Math.max(100, intervalMs);
    this.t0 = performance.now();
    this.measuring = true;
    if (this._wake) this._wake(); // 미리보기 대기 중이면 바로 측정 시작
    this._loop();
    return this.intervalMs;
  }

  async stop() {
    if (!this.sheet) return super.stop();
    this.measuring = false;
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
  motion: t => 0.2 + 0.25 * t,
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
  heartrate: (t, k) => (k % 2 === 1 ? 76 + 2 * Math.sin(t / 3) : 78 + 50 * Math.exp(-t / 45)),
};

class SimulationDriver extends BaseDriver {
  constructor(sensorKey) {
    super();
    this.brand = 'sim';
    this.setSensor(sensorKey);
  }
  setSensor(key) {
    this.exp = null;
    this.sensorKey = SENSOR_TYPES[key] ? key : 'temp';
    const s = SENSOR_TYPES[this.sensorKey];
    this.channels = [{ id: 0, name: s.name, unit: s.unit, enabled: true }];
    this.emit('channels', this.channels);
  }
  // 실험 템플릿에 맞춘 예시 데이터 사용 (ctxFn: 조건 번호 k, 수동 기록 값 x를 알려 주는 함수)
  useExperiment(exp, ctxFn) {
    if (!exp || typeof EXP_SIM === 'undefined' || !EXP_SIM[exp.id]) return false;
    this.exp = exp;
    this.ctxFn = ctxFn;
    this.channels = simChannels(exp).map(([key, name], i) => ({ id: i, name, unit: SENSOR_TYPES[key].unit, enabled: true }));
    this.emit('channels', this.channels);
    return true;
  }
  async connect() {
    await sleep(500);
    this.connected = true;
    this.deviceName = '가상 센서';
    this.emit('channels', this.channels);
    this.emit('status', '가상 센서 연결됨');
  }
  async start(intervalMs) {
    if (this.exp) return this._startExperiment(intervalMs);
    const f = SIM_MODELS[this.sensorKey];
    // 측정할 때마다 조건이 달라진 것처럼 변화율·크기에 차이를 줌
    this.runNo = (this.runNo || 0) + 1;
    const k = this.runNo;
    const rate = (0.6 + 0.4 * k) / 1.4; // 뒤 조건일수록 변화가 크게(예: 느린→빠른 자동차, 전지 1개→2개)
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
  _startExperiment(intervalMs) {
    const model = EXP_SIM[this.exp.id];
    const ctx0 = this.ctxFn ? this.ctxFn() : {};
    const k = ctx0.k || 0;
    let n = 0;
    this.measuring = true;
    this.timer = setInterval(() => {
      const t = n * intervalMs / 1000;
      const live = this.ctxFn ? this.ctxFn() : {};
      const ys = model({ t, k, x: live.x !== undefined ? live.x : null });
      const values = {};
      ys.forEach((y, i) => {
        // 실제 센서처럼 아주 작은 흔들림을 더함
        const noise = (Math.random() - 0.5) * (Math.abs(y) * 0.003 + 0.002);
        values[i] = Math.round((y + noise) * 10000) / 10000;
      });
      this.emit('sample', { t: Math.round(t * 1000) / 1000, values });
      n++;
    }, intervalMs);
    return intervalMs;
  }
  async stop() { this.measuring = false; clearInterval(this.timer); }
  async disconnect() { this.userClosed = true; await this.stop(); this.connected = false; this.emit('disconnected'); }
}
