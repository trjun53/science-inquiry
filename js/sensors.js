// 디지털 탐구 센서 블루투스(Web Bluetooth) 드라이버
// - Vernier Go Direct : 공식 라이브러리 godirect-js 사용 → 채널 정보 자동 인식
// - PASCO : 공식 Python 라이브러리(pasco)의 통신 방식·데이터시트를 옮겨 구현
// - 사이언스큐브 : 제조사 웹 앱(Science#)과 같은 통신 방식(SC: 이름, Transparent UART, Base64 프레임)
// - 이지메이커 : 범용 BLE 드라이버 + 기본값
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

/* ───────────────────────── Vernier Go Direct ─────────────────────────
   Vernier 공식 라이브러리 godirect-js(@vernier/godirect 1.8.3, BSD-3, js/vendor/godirect.min.js)로
   연결·센서 정보·측정을 처리하고, 이 앱의 드라이버 형식(channels / preview / sample)으로 바꿔 줌 */
const GDX_SERVICE = 'd91714ef-28b9-4f91-ba16-f0d9a604f112';
const VERNIER_KO = {
  Temperature: '온도', Pressure: '압력', Force: '힘', Voltage: '전압', Current: '전류', pH: 'pH',
  'CO2 Gas': '이산화 탄소 농도', CO2: '이산화 탄소 농도', 'O2 Gas': '산소 농도', O2: '산소 농도',
  Illumination: '조도', Light: '빛의 세기', 'Magnetic Field': '자기장', 'Sound Level': '소리 크기',
  'Heart Rate': '심박수', 'Relative Humidity': '상대 습도', Humidity: '습도', Conductivity: '전기 전도도',
  Position: '거리', Distance: '거리', Velocity: '속도', Acceleration: '가속도', 'Wind Speed': '풍속',
  'Barometric Pressure': '기압', 'Dissolved Oxygen': '용존 산소', 'Surface Temperature': '표면 온도',
};

class VernierDriver extends BaseDriver {
  constructor() {
    super();
    this.brand = 'vernier';
    this.latest = {};
    this.periodMs = 500;
  }

  async connect() {
    if (typeof godirect === 'undefined') throw new Error('Vernier 연결 라이브러리를 불러오지 못했습니다. 페이지를 새로고침하세요.');
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'GDX' }], optionalServices: [GDX_SERVICE] });
    this.deviceName = this.device.name || 'Go Direct';
    this.device.addEventListener('gattserverdisconnected', () => this._onDisconnected());
    this.emit('status', `${this.deviceName} 연결 중…`);
    this.gdx = await godirect.createDevice(this.device, { open: true, startMeasurements: false });
    this.gdx.keepValues = false; // 값은 이 앱이 따로 저장함
    this.gdx.on('device-closed', () => this._onDisconnected());
    this.connected = true;

    const def = this.gdx.defaultSensorsMask || 0;
    this.channels = this.gdx.sensors.map(s => ({
      id: s.number, name: VERNIER_KO[s.name] || s.name, unit: s.unit || '', enabled: !!(def & (1 << s.number)), sensor: s,
    }));
    if (this.channels.length && !this.channels.some(c => c.enabled)) this.channels[0].enabled = true;
    this.gdx.sensors.forEach(s => s.on('value-changed', x => this._onValue(x)));
    this.emit('channels', this.channels);
    this.emit('status', `${this.deviceName} 연결됨`);
    await this._run(500).catch(e => console.warn(e)); // 연결되면 바로 실시간 값을 보여 줌
  }

  // 측정을 멈추고, 켜진 채널과 간격을 맞춘 뒤 다시 시작
  async _run(periodMs) {
    const g = this.gdx;
    if (g.collecting) await g._stopMeasurements().catch(() => {});
    this.channels.forEach(c => c.sensor.setEnabled(!!c.enabled));
    // 함께 쓸 수 없는 채널은 라이브러리가 끔 → 화면의 체크도 맞춤
    let changed = false;
    this.channels.forEach(c => { if (c.enabled !== c.sensor.enabled) { c.enabled = c.sensor.enabled; changed = true; } });
    if (changed) this.emit('channels', this.channels);
    const on = this.channels.filter(c => c.enabled);
    if (!on.length) return;
    const minMs = Math.max(10, ...on.map(c => (c.sensor.specs.measurementInfo || {}).minPeriod || 10));
    this.periodMs = Math.max(periodMs, minMs);
    g.measurementPeriod = this.periodMs;
    this.latest = {};
    this.row = 0;
    await g._startMeasurements();
    if (!g.collecting) throw new Error('측정 시작 실패 (동시에 사용할 수 없는 채널 조합일 수 있습니다)');
  }

  // 한 번의 측정(행)마다 켜진 센서 값이 차례로 들어옴 → 같은 센서가 다시 오면 다음 행
  _onValue(s) {
    if (!this.connected || s.value === null || s.value === undefined) return;
    if (s.number in this.latest) this._flush();
    this.latest[s.number] = Math.round(s.value * 10000) / 10000; // float32 자투리 자릿수 정리
    const on = this.channels.filter(c => c.enabled);
    if (on.every(c => c.id in this.latest)) this._flush();
  }

  _flush() {
    const values = this.latest;
    this.latest = {};
    if (!Object.keys(values).length) return;
    if (!this.measuring) { this.emit('preview', values); return; }
    const t = Math.round(this.row * this.periodMs) / 1000; // 센서 내부 시계 간격으로 시간 계산
    this.row++;
    this.emit('sample', { t, values });
  }

  // 채널 체크를 바꾸면 실시간 값도 그 채널로 다시 받음
  async refreshChannels() {
    if (this.connected && !this.measuring) await this._run(500).catch(e => console.warn(e));
  }

  async start(intervalMs) {
    if (!this.channels.some(c => c.enabled)) throw new Error('측정할 채널을 하나 이상 선택하세요.');
    this.measuring = false;
    await this._run(intervalMs);
    this.row = 0;
    this.measuring = true;
    return this.periodMs;
  }

  async stop() {
    this.measuring = false;
    if (this.connected) await this._run(500).catch(() => {}); // 측정이 끝나면 다시 실시간 값만 보여 줌
  }

  async disconnect() {
    this.userClosed = true;
    this.measuring = false;
    try { if (this.gdx && this.gdx.opened) await this.gdx.close(); } catch (e) { /* ignore */ }
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
    note: '사이언스큐브 공식 웹 앱(Science#)과 같은 통신 방식으로 무선 센서 46종(온도, 전압, 전류, 압력, pH, 힘, 이산화 탄소, 산소, 빛, 습도, 소리, 심박 등)을 자동으로 알아봅니다. 압력은 kPa로 표시합니다. 아래 설정은 쓰이지 않으며, [원시 데이터]로 수신 상태만 확인할 수 있습니다.',
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
    // 응답은 센서 채널의 서비스(n+1)로 오기도 하고 기기 서비스(0)로 오기도 함.
    // 요청을 한 번에 하나씩 보내므로, 해당 채널이 없으면 기다리는 요청에 응답을 넘김
    if (bytes[0] !== 0xc0 || bytes[2] !== 0x05) return;
    const svc = parseInt(uuid.charAt(7), 16);
    const key = (svc - 1) in this.waiters ? svc - 1 : Object.keys(this.waiters)[0];
    const w = key !== undefined ? this.waiters[key] : null;
    if (!w) return;
    delete this.waiters[key];
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

/* ───────────────────────── 사이언스큐브 무선 센서 ─────────────────────────
   제조사 공식 웹 앱(Science#, on.sciencecube.com)과 같은 통신 방식
   - 기기 이름 "SC:TEMP", "SC:PRESS", "KDWEATHER", "SmartCart" … (센서를 '모바일 모드'로 켜야 보임)
   - 서비스 49535343-fe7d-…(Transparent UART), 알림 49535343-1e4d-…, 쓰기 49535343-8841-…
   - 프레임 20바이트: "{{" + Base64(본문 12바이트) + "}}", 본문 = [명령, 값 10바이트, 체크섬(앞 11바이트 합 % 256)]
   - 'N'(78)→'n'(110): 센서 ID(예: WL100T), 'M'(77)+[간격ms 상위, 하위]→'m'(109): [번호, 측정값…], 간격 0이면 정지 */
const SC_SERVICE = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const SC_NOTIFY = '49535343-1e4d-4bd9-ba61-23c647249616';
const SC_WRITE = '49535343-8841-43f4-a8d4-ecbe34729bb3';
// 센서 ID 앞 6자리 → 데이터 형식(f)과 채널 [이름, 단위, 배율]
const SC_SENSORS = {
  WL100T: { f: 'float', ch: [["온도","°C"]] }, // Temperature (SC:TEMP)
  WL101V: { f: 'float', ch: [["전압","V"]] }, // Voltage (SC:VOLT)
  WL102C: { f: 'float', ch: [["전류","A"]] }, // Current (SC:CURR)
  WL103P: { f: 'float', ch: [["압력","kPa",0.1]] }, // Pressure(A) (SC:PRESS)
  WL104P: { f: 'float', ch: [["pH","pH"]] }, // pH Sensor (SC:PH)
  WL105F: { f: 'shortdiv100', ch: [["힘","N"],["가속도 X축","m/s²"],["가속도 Y축","m/s²"],["가속도 Z축","m/s²"]] }, // Force (SC:FORC)
  WL106M: { f: 'float', ch: [["거리","m"]] }, // Motion (SC:MOT)
  WL107E: { f: 'float', ch: [["전기 전도도","mS/cm"]] }, // Conductivity (SC:EC-)
  WL108M: { f: 'shortgtomtwl108m', ch: [["자기장 X축","mT"],["자기장 Y축","mT"],["자기장 Z축","mT"]] }, // 자기장2K (SC:MAG)
  WL108F: { f: 'short', ch: [["자기장 X축","µT"],["자기장 Y축","µT"],["자기장 Z축","µT"]] }, // Magnetic Field (SC:MAG)
  WL109G: { f: 'float', ch: [["전류","µA"]] }, // Galvanometer (SC:GALV)
  WCT100: { f: 'shortforwct100', ch: [["거리","m"],["속력","m/s"],["힘","N"]] }, // SmartCart (SmartCart)
  WL111C: { f: 'ushort', ch: [["이산화 탄소 농도","ppm"]] }, // CO₂ (SC:CO2)
  WL112L: { f: 'float', ch: [["조도","lux"]] }, // Light (SC:LC-)
  WL112C: { f: 'ushort', ch: [["빨강",""],["초록",""],["파랑",""]] }, // RGB Color (SC:RGB_C)
  WL112U: { f: 'float', ch: [["자외선 지수",""]] }, // Ultraviolet (SC:RGB_U)
  WL113O: { f: 'float', ch: [["산소 농도","%"]] }, // Oxygen (SC:O2-)
  WL114E: { f: 'float', ch: [["전극 전압","mV"]] }, // Electrode Amplifier (SC:EA-)
  WL115P: { f: 'short', ch: [["초미세먼지(PM2.5)","µg/m³"],["미세먼지(PM10)","µg/m³"]] }, // Fine Dust Sensor (SC:PM-)
  WL116P: { f: 'float', ch: [["압력","kPa",0.1]] }, // Pressure(B) (SC:PRES)
  WL117H: { f: 'shortdiv100', ch: [["습도","%"],["온도","°C"]] }, // Humidity (SC:HUM)
  WL118D: { f: 'float', ch: [["용존 산소","mg/L"]] }, // Dissolved Oxygen (SC:DO-)
  WL119S: { f: 'float', ch: [["염분","ppt"]] }, // Salinity (SC:SAL)
  WL120P: { f: 'float', ch: [["시간","s"]] }, // Photogate (SC:PG-)
  WL121E: { f: 'float', ch: [["심전도","mV"]] }, // EKG (SC:EKG)
  WL122S: { f: 'float', ch: [["부피","L"],["유량","L/s"]] }, // Spirometer (SC:SPM)
  WL123T: { f: 'float', ch: [["온도","°C"]] }, // Temperature (SC:TC-)
  WL124S: { f: 'float', ch: [["소리 크기","dB"]] }, // Sound Level (SC:SOUND)
  WL125W: { f: 'shortdiv10', ch: [["온도","°C"],["습도","%"],["압력","kPa",0.1]] }, // Weather (KDWEATHER)
  WL125X: { f: 'shortdiv10', ch: [["풍향","°"],["풍속","m/s"]] }, // Wind (KDWXX)
  WL125Y: { f: 'shortweaterwl125y', ch: [["조도","lux"],["자외선 지수",""]] }, // Light (KDWYY)
  WL126R: { f: 'float', ch: [["방사선량","µSv/h"]] }, // Radiation (SC:RAD)
  WL127Q: { f: 'float', ch: [["전하량","µC"]] }, // Electric Charge (SC:ELEC)
  WL128A: { f: 'float', ch: [["빨강","AU"]] }, // Colorimeter (Red) (SC:CNT)
  WL128B: { f: 'float', ch: [["초록","AU"]] }, // Colorimeter (Green) (SC:COLOR_B)
  WL128C: { f: 'float', ch: [["파랑","AU"]] }, // Colorimeter (Blue) (SC:COLOR_C)
  WL128D: { f: 'float', ch: [["노랑","AU"]] }, // Colorimeter (Yellow) (SC:COLOR_D)
  WL128E: { f: 'float', ch: [["청록","AU"]] }, // Colorimeter (Cyan) (SC:COLOR_E)
  WL128F: { f: 'float', ch: [["자홍","AU"]] }, // Colorimeter (Magenta) (SC:COLOR_F)
  WL128T: { f: 'float', ch: [["탁도","NTU"]] }, // Turbidity (SC:TURB)
  WL129H: { f: 'float', ch: [["심박수","bpm"]] }, // Heart Rate (SC:HRS-)
  WL130D: { f: 'float', ch: [["물방울 수","방울"],["부피","mL"]] }, // Drop Counter (SC:DROP)
  WL131J: { f: 'short', ch: [["전압","V"],["전류","A"],["전력","W"],["에너지","J"]] }, // Energy (SC:ENERGY)
  WL132W: { f: 'shortdiv10', ch: [["온도 A","°C"],["온도 B","°C"],["온도 C","°C"],["온도 D","°C"]] }, // Vertical Temperature (SC:VTEMP)
  WL133M: { f: 'shortdivmultico2wl133m', ch: [["온도","°C"],["습도","%"],["이산화 탄소 농도","ppm"]] }, // Multi-CO₂ (SC:MULTI)
  WL134A: { f: 'shortforwl143a', ch: [["온도","°C"],["압력","kPa",0.1]] }, // Pressure & Temperature (SC:ATMT)
};

function scFrame(cmd, params = []) {
  const body = new Uint8Array(12);
  body[0] = cmd;
  params.slice(0, 10).forEach((p, i) => { body[i + 1] = p & 0xff; });
  let sum = 0; for (let i = 0; i < 11; i++) sum = (sum + body[i]) % 256;
  body[11] = sum;
  return new TextEncoder().encode('{{' + btoa(String.fromCharCode(...body)) + '}}');
}

// 측정 응답 값(params[1]부터) → 채널 값 배열
function scDecode(p, f) {
  const i16 = o => { const v = p[o] | (p[o + 1] << 8); return v > 32767 ? v - 65536 : v; };
  const u16 = o => p[o] | (p[o + 1] << 8);
  const s = n => Array.from({ length: n }, (_, k) => i16(1 + 2 * k));
  switch (f) {
    case 'float': return [new DataView(p.buffer, p.byteOffset + 1, 4).getFloat32(0, true)];
    case 'short': return s(4);
    case 'shortdiv10': return s(4).map(v => v / 10);
    case 'shortdiv100': return s(4).map(v => v / 100);
    case 'ushort': return Array.from({ length: 4 }, (_, k) => u16(1 + 2 * k));
    case 'shortdivmultico2wl133m': { const v = s(3); return [v[0] / 10, v[1] / 10, v[2]]; }
    case 'shortgtomtwl108m': return s(3).map(v => v * 0.1);
    case 'shortforwct100': { const v = s(3); return [v[0] * 0.001, v[1] * 0.001, v[2] * 980665e-9]; }
    case 'shortweaterwl125y': { const v = s(2); return [v[0], v[1] / 10]; }
    case 'shortforwl143a': { const v = s(2); return [v[0] / 100, v[1] / 10]; }
    default: return [];
  }
}

class ScienceCubeDriver extends BaseDriver {
  constructor() {
    super();
    this.brand = 'sciencecube';
    this.rx = new Uint8Array(0);
    this.periodMs = 500;
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'SC:' }, { namePrefix: 'Smart' }, { namePrefix: 'KD' }],
      optionalServices: [SC_SERVICE],
    });
    this.deviceName = this.device.name || '사이언스큐브';
    this.device.addEventListener('gattserverdisconnected', () => this._onDisconnected());
    this.emit('status', `${this.deviceName} 연결 중…`);
    // Windows에서는 첫 연결·알림 켜기가 가끔 실패함 → 단계별로 확인하며 전체를 몇 번 다시 시도
    let lastErr = null, step = '';
    for (let n = 0; n < 4; n++) {
      try {
        step = '블루투스 연결';
        const server = await this.device.gatt.connect();
        // 제조사 앱처럼 연결되자마자 바로 서비스를 찾음 (기다리는 사이 센서가 연결을 끊는 경우가 있음)
        step = '서비스 찾기';
        const svc = await server.getPrimaryService(SC_SERVICE);
        step = '통신 통로 찾기';
        this.readChar = await svc.getCharacteristic(SC_NOTIFY);
        this.writeChar = await svc.getCharacteristic(SC_WRITE);
        step = '데이터 받기(알림) 켜기';
        if (!this.listening) {
          this.readChar.addEventListener('characteristicvaluechanged', e => this._onNotify(e.target.value));
          this.listening = true;
        }
        await this.readChar.startNotifications();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`사이언스큐브 ${step} 실패 (${n + 1}회)`, e);
        if (/Authentication|Insufficient/i.test(e.message || '')) break;
        this.emit('status', `${step} 다시 시도 중… (${n + 2}/4)`);
        try { if (this.device.gatt.connected) this.device.gatt.disconnect(); } catch (x) { /* ignore */ }
        this.listening = false;
        await sleep(500 * (n + 1));
      }
    }
    if (lastErr) {
      try { if (this.device.gatt.connected) this.device.gatt.disconnect(); } catch (x) { /* ignore */ }
      if (/Authentication|Insufficient/i.test(lastErr.message || '')) {
        throw new Error('이 센서는 Windows에서 먼저 페어링해야 합니다. 설정 > 블루투스 및 장치 > 장치 추가 > 블루투스에서 '
          + `${this.deviceName}을(를) 선택해 페어링한 뒤, 이 화면에서 다시 [블루투스로 연결]을 누르세요.`);
      }
      if (/disconnected/i.test(lastErr.message || '')) {
        throw new Error('센서가 연결되자마자 연결을 끊었습니다. Windows와 센서의 페어링 정보가 맞지 않을 때 주로 생깁니다. '
          + 'Windows 설정 > 블루투스 및 장치에서 이 센서를 [장치 제거]하고, 센서를 껐다 켠 뒤(모바일 모드) 다시 연결해 보세요. '
          + '그래도 안 되면 그때 Windows에서 새로 페어링한 뒤 연결하세요.');
      }
      const pair = /GATT operation failed/i.test(lastErr.message || '');
      throw new Error(`${step} 단계에서 실패했습니다 (${lastErr.message}). `
        + (pair ? '센서를 껐다 켠 뒤 다시 연결해 보고, 계속 안 되면 Windows 설정 > 블루투스 및 장치 > 장치 추가에서 센서를 먼저 페어링한 뒤 연결하세요.'
                : '센서를 껐다 켜고 PC 가까이에서 다시 연결하세요. 다른 앱·태블릿에 연결되어 있으면 먼저 끊으세요.'));
    }
    this.connected = true;

    this.emit('status', '센서 종류 확인 중…');
    let uid = null;
    for (let n = 0; n < 3 && !uid; n++) uid = await this._askName();
    this.uid = (uid || '').toUpperCase();
    this.def = SC_SENSORS[this.uid.slice(0, 6)] || null;
    const ch = this.def ? this.def.ch : [['측정값', '']];
    this.channels = ch.map(([name, unit, k], i) => ({ id: i, name, unit, k: k || 1, enabled: i === 0 || ch.length <= 3 }));
    if (this.uid) this.deviceName = `${this.deviceName} (${this.uid.slice(0, 6)})`;
    this.emit('channels', this.channels);
    this.emit('status', this.def ? `${this.deviceName} 연결됨` : `${this.deviceName} 연결됨 (센서 종류를 알 수 없음)`);
    await this._measure(500); // 연결되면 바로 실시간 값을 보여 줌
  }

  _askName() {
    return new Promise(resolve => {
      this.nameWait = resolve;
      this._send(78).catch(() => {});
      setTimeout(() => { if (this.nameWait === resolve) { this.nameWait = null; resolve(null); } }, 1000);
    });
  }

  // 쓰기: 응답 있는 쓰기와 응답 없는 쓰기 중 되는 쪽을 기억해 사용. 실패해도 연결은 유지(제조사 앱과 같음)
  async _send(cmd, params) {
    if (!this.writeChar) return false;
    const data = scFrame(cmd, params);
    const pr = this.writeChar.properties || {};
    const modes = this.writeMode ? [this.writeMode] : [pr.write !== false ? 'with' : null, pr.writeWithoutResponse ? 'without' : null].filter(Boolean);
    if (!modes.length) modes.push('with');
    for (const m of modes) {
      try {
        const w = m === 'without' ? this.writeChar.writeValueWithoutResponse(data) : this.writeChar.writeValue(data);
        // 응답을 오래 기다리지 않음(0.3초). 그 사이 오류가 나면 다른 방식으로 다시 씀
        await Promise.race([w, sleep(300)]);
        this.writeMode = m;
        return true;
      } catch (e) {
        console.warn('사이언스큐브 쓰기 실패', m, e);
        if (this.writeMode) { this.writeMode = null; return this._send(cmd, params); }
      }
    }
    return false;
  }

  _measure(ms) {
    this.periodMs = ms;
    this.row = 0;
    return this._send(77, [(ms >> 8) & 0xff, ms & 0xff]);
  }

  _onNotify(dv) {
    const chunk = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength).slice();
    this.emit('raw', { uuid: SC_NOTIFY, bytes: chunk });
    let b = new Uint8Array(this.rx.length + chunk.length);
    b.set(this.rx); b.set(chunk, this.rx.length);
    // "{{" 로 시작하고 "}}" 로 끝나는 20바이트 단위로 잘라 읽음
    while (b.length >= 20) {
      const st = b.findIndex((x, i) => x === 123 && b[i + 1] === 123);
      if (st < 0) { b = b.slice(b.length - 1); break; }
      if (st > 0) { b = b.slice(st); continue; }
      if (b[18] !== 125 || b[19] !== 125) { b = b.slice(1); continue; }
      try {
        const body = Uint8Array.from(atob(String.fromCharCode(...b.slice(2, 18))), c => c.charCodeAt(0));
        let sum = 0; for (let i = 0; i < 11; i++) sum = (sum + body[i]) % 256;
        if (body.length === 12 && sum === body[11]) this._onMessage(body[0], body.slice(1, 11));
      } catch (e) { /* 깨진 프레임은 건너뜀 */ }
      b = b.slice(20);
    }
    this.rx = b.length > 400 ? new Uint8Array(0) : b;
  }

  _onMessage(cmd, p) {
    if (cmd === 110) { // 이름(센서 ID)
      const id = String.fromCharCode(...p.slice(1, 10)).replace(/\0/g, '').trim();
      if (this.nameWait) { const w = this.nameWait; this.nameWait = null; w(id); }
      return;
    }
    if (cmd !== 109) return; // 측정값만 사용
    const raw = scDecode(p, this.def ? this.def.f : 'float');
    const values = {};
    this.channels.forEach((c, i) => {
      const v = raw[i];
      if (c.enabled && v !== undefined && isFinite(v)) values[c.id] = Math.round(v * c.k * 10000) / 10000;
    });
    if (!Object.keys(values).length) return;
    if (!this.measuring) { this.emit('preview', values); return; }
    const t = Math.round(this.row * this.periodMs) / 1000; // 센서가 정한 간격으로 시간 계산
    this.row++;
    this.emit('sample', { t, values });
  }

  async start(intervalMs) {
    if (!this.channels.some(c => c.enabled)) throw new Error('측정할 채널을 하나 이상 선택하세요.');
    const ms = Math.min(65535, Math.max(20, Math.round(intervalMs)));
    this.measuring = false;
    await this._send(77, [0, 0]);
    await sleep(50);
    this.measuring = true;
    await this._measure(ms);
    return ms;
  }

  async stop() {
    this.measuring = false;
    if (this.connected) await this._measure(500).catch(() => {}); // 다시 실시간 값만 보여 줌
  }

  async disconnect() {
    this.measuring = false;
    try { if (this.connected) await this._send(77, [0, 0]); } catch (e) { /* ignore */ }
    await super.disconnect();
  }
}

/* ───────────────────────── 센서 2개 동시 사용 ─────────────────────────
   센서 1·센서 2 자리(slot)에 각각 드라이버를 꽂고, 앱에는 센서 하나처럼 보이게 묶어 줌
   - 채널 id = 자리×100 + 원래 id, 두 센서의 채널 이름이 같으면 "(센서1)"처럼 구분
   - 측정값은 같은 측정 간격 칸(시각)끼리 한 줄로 합쳐서 내보냄 */
class MultiDriver extends BaseDriver {
  constructor() {
    super();
    this.slots = [null, null];
    this.preview = {};
    this.pending = new Map(); // 간격 칸 번호 → {values, from:Set}
  }

  get connected() { return this.slots.some(d => d && d.connected); }
  set connected(v) { /* BaseDriver 호환용, 자리별 드라이버 상태를 따름 */ }
  get live() { return this.slots.map((d, i) => (d && d.connected ? i : -1)).filter(i => i >= 0); }
  get brand() { return this.live.map(i => this.slots[i].brand).join('+'); }
  get deviceName() { return this.live.map(i => this.slots[i].deviceName).join(' + '); }
  set deviceName(v) { /* 자리별 드라이버 이름을 따름 */ }

  setSlot(i, d) {
    const old = this.slots[i];
    if (old && old !== d && old.connected) old.disconnect().catch(() => {});
    this.slots[i] = d;
    if (!d) { this._rebuild(); return; }
    const mine = () => this.slots[i] === d;
    d.on('status', msg => { if (mine()) this.emit('status', msg, i); });
    d.on('raw', r => { if (mine()) this.emit('raw', r, i); });
    d.on('channels', () => { if (mine()) this._rebuild(); });
    d.on('preview', v => { if (mine()) this._onPreview(i, v); });
    d.on('sample', s => { if (mine()) this._onSample(i, s); });
    d.on('disconnected', () => {
      if (!mine()) return;
      Object.keys(this.preview).forEach(k => { if (Math.floor(k / 100) === i) delete this.preview[k]; });
      this._rebuild();
      if (this.measuring && !this.live.some(j => this.slots[j].measuring)) this.measuring = false;
      this.emit('disconnected', i);
    });
    this._rebuild();
  }

  // 두 센서의 채널을 하나의 목록으로 (켜기/끄기는 원래 채널에 그대로 반영)
  // 이름: 센서 이름(별칭)을 정했으면 그 이름, 센서가 2개면 "온도(센서1)"처럼 번호를 붙임
  _rebuild() {
    const list = [];
    const live = this.live;
    live.forEach(i => this.slots[i].channels.forEach(c => list.push({ i, c, n: this.slots[i].channels.length })));
    const named = list.map(({ i, c, n }) => {
      const alias = String((this.aliasOf && this.aliasOf(i)) || '').trim();
      if (alias) return n === 1 ? alias : `${alias} ${c.name}`;
      return live.length > 1 ? `${c.name}(센서${i + 1})` : c.name;
    });
    const count = {};
    named.forEach(x => { count[x] = (count[x] || 0) + 1; });
    this.channels = list.map(({ i, c }, k) => ({
      id: i * 100 + c.id, slot: i,
      name: count[named[k]] > 1 && !named[k].includes(`(센서${i + 1})`) ? `${named[k]}(센서${i + 1})` : named[k],
      unit: c.unit,
      get enabled() { return c.enabled; },
      set enabled(v) { c.enabled = v; },
    }));
    this.emit('channels', this.channels);
  }

  _map(i, values) {
    const out = {};
    Object.keys(values).forEach(k => { out[i * 100 + Number(k)] = values[k]; });
    return out;
  }

  _onPreview(i, values) {
    Object.assign(this.preview, this._map(i, values));
    this.emit('preview', { ...this.preview });
  }

  _onSample(i, { t, values }) {
    if (!this.measuring) return;
    const mapped = this._map(i, values);
    Object.assign(this.preview, mapped);
    const active = this.live.filter(j => this.slots[j].measuring);
    if (active.length <= 1) { this.emit('sample', { t, values: mapped }); return; }
    const bin = Math.round(t / this.binS);
    const p = this.pending.get(bin) || { values: {}, from: new Set() };
    Object.assign(p.values, mapped);
    p.from.add(i);
    this.pending.set(bin, p);
    // 두 센서 값이 모두 모인 칸, 또는 한쪽이 앞서 나가 더는 채워지지 않을 오래된 칸을 차례로 내보냄
    [...this.pending.keys()].sort((a, b) => a - b).forEach(k => {
      const q = this.pending.get(k);
      if (q.from.size >= active.length || k < bin - 1) {
        this.pending.delete(k);
        this.emit('sample', { t: Math.round(k * this.binS * 1000) / 1000, values: q.values });
      }
    });
  }

  async start(intervalMs) {
    const use = this.live.filter(i => this.slots[i].channels.some(c => c.enabled));
    if (!use.length) throw new Error('측정할 채널을 하나 이상 선택하세요.');
    this.pending.clear();
    this.binS = intervalMs / 1000;
    this.measuring = true;
    let actual = intervalMs;
    try {
      // 두 센서를 거의 동시에 시작
      const res = await Promise.all(use.map(i => this.slots[i].start(intervalMs)));
      actual = Math.max(intervalMs, ...res.map(Number).filter(isFinite));
    } catch (e) {
      await this.stop();
      throw e;
    }
    this.binS = actual / 1000;
    return actual;
  }

  async stop() {
    // 아직 한쪽 값만 모인 칸도 마저 기록한 뒤 정지
    [...this.pending.keys()].sort((a, b) => a - b).forEach(k => {
      this.emit('sample', { t: Math.round(k * this.binS * 1000) / 1000, values: this.pending.get(k).values });
    });
    this.pending.clear();
    this.measuring = false;
    await Promise.all(this.live.map(i => (this.slots[i].measuring ? this.slots[i].stop().catch(() => {}) : null)));
  }

  async disconnect() {
    this.measuring = false;
    await Promise.all(this.slots.map(d => (d && d.connected ? d.disconnect().catch(() => {}) : null)));
    this.preview = {};
    this._rebuild();
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
    const same = !this.exp && this.sensorKey === key && this.channels.length === 1;
    this.exp = null;
    this.sensorKey = SENSOR_TYPES[key] ? key : 'temp';
    const s = SENSOR_TYPES[this.sensorKey];
    this.channels = [{ id: 0, name: s.name, unit: s.unit, enabled: same ? this.channels[0].enabled : true }];
    this.emit('channels', this.channels);
  }
  // 실험 템플릿에 맞춘 예시 데이터 사용 (ctxFn: 조건 번호 k, 수동 기록 값 x를 알려 주는 함수)
  useExperiment(exp, ctxFn) {
    if (!exp || typeof EXP_SIM === 'undefined' || !EXP_SIM[exp.id]) return false;
    // 같은 실험을 다시 적용할 때(측정 시작 직전 등)는 [센서 연결]에서 고른 채널 선택을 그대로 유지
    const prev = this.exp && this.exp.id === exp.id ? this.channels : null;
    this.exp = exp;
    this.ctxFn = ctxFn;
    this.channels = simChannels(exp).map(([key, name], i) => ({ id: i, name, unit: SENSOR_TYPES[key].unit, enabled: prev && prev[i] ? prev[i].enabled : true }));
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
        if (this.channels[i] && !this.channels[i].enabled) return; // 고른 채널만 측정
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
