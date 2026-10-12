// 가상 센서: 실험별로 과학적 사실에 맞는 예시 측정값을 만듦
// ctx = { t: 측정 시작 후 시간(초), k: 조건 번호(실험 설계의 '다르게 할 조건' 순서, 0부터), x: 수동 기록의 가로축 값(숫자 또는 null) }
// 값을 배열로 돌려주며, 순서는 simChannels(exp)와 같음

const approach = (t, from, to, tau) => to + (from - to) * Math.exp(-t / tau); // 서서히 목표값에 가까워짐
const pick = (arr, k) => arr[Math.min(Math.max(k, 0), arr.length - 1)];
const ROOM = 22;

const EXP_SIM = {
  // 3학년 힘과 우리 생활 — 무거울수록 끄는 힘이 큼(정지 마찰 뒤 운동 마찰)
  'force-pull': ({ t, k }) => {
    const kin = pick([1.5, 3.3, 5.1], k), peak = kin * 1.35;
    return [t < 1 ? peak * t : t < 1.6 ? peak - (peak - kin) * (t - 1) / 0.6 : kin];
  },
  'force-scale': ({ t, k }) => [approach(t, 0, pick([0.25, 0.36, 0.62], k), 0.15)],
  // 직접 들기 > 가파른 빗면 > 완만한 빗면
  'force-tool': ({ t, k }) => [approach(t, 0, pick([4.9, 1.2, 2.2], k), 0.3)],

  // 생물의 한살이 — 냉장고는 온도가 낮고, 상자 속은 어두움
  'seed-temp': ({ t, k }) => [k === 0 ? 24 : approach(t, ROOM, 4, 120)],
  'plant-light': ({ k }) => [pick([18000, 6], k)],

  // 소리의 성질 — 세게 칠수록 큰 소리, 시간이 지나면 작아짐
  'sound-loud': ({ t, k }) => [38 + pick([24, 44], k) * Math.exp(-t / 1.6)],
  'sound-medium': ({ k }) => [pick([55, 68, 63], k)],
  'sound-noise': ({ k }) => [pick([72, 66, 59, 51], k)],

  // 자석의 이용 — 양 끝(극)에서 가장 세고 가운데는 약함 / 멀어질수록 급하게 약해짐
  'mag-pole': ({ t }) => { const c = Math.cos(Math.PI * Math.min(t, 10) / 10); return [0.3 + 7.5 * Math.pow(Math.abs(c), 1.6)]; },
  'mag-distance': ({ t, x }) => { const d = x !== null ? x : t; return [30 / Math.pow(1 + d / 2.5, 3)]; },

  // 물의 상태 변화 — 얼어도 무게는 같음
  'water-weight': ({ t }) => [approach(t, 0, 0.352, 0.2)],

  // 생물과 환경 — 장소에 따라 햇빛의 세기가 다름
  'eco-light': ({ k }) => [pick([52000, 31000, 3200], k)],

  // 여러 가지 기체 — 공기를 넣으면 조금 무거워짐 / 부피가 줄면 압력이 커짐 / 물의 온도
  'gas-weight': ({ t, k }) => [approach(t, 0, pick([0.300, 0.3024, 0.3048], k), 0.2)],
  'gas-pressure': ({ t }) => { const v = Math.max(30, 60 - 10 * Math.floor(Math.max(0, t - 1) / 5)); return [101.3 * 60 / v]; },
  'gas-temp': ({ t, k }) => [approach(t, ROOM, pick([60, 2], k), 6)],

  // 빛의 성질 — 물질에 따라 통과하는 빛이 다름 / 볼록 렌즈로 모으면 밝아짐
  'light-see': ({ k }) => [pick([3, 650], k)],           // 구멍을 막으면 거의 0, 손전등을 비추면 밝음
  'light-straight': ({ k }) => [pick([520, 6], k)],      // 구멍이 일직선이면 빛이 도달, 어긋나면 거의 0
  'light-reflect': ({ k }) => [pick([430, 12], k)],      // 반사된 빛이 가는 곳만 밝음
  'light-lens': ({ k }) => [pick([480, 4200], k)],

  // 용해와 용액 — 녹아도 무게는 같음 / 따뜻한 물에 더 많이 녹음(물 온도 기록)
  'dissolve-weight': ({ t }) => [approach(t, 0, 0.83, 0.2)],
  'dissolve-temp': ({ t, k }) => [k === 0 ? approach(t, 10, ROOM, 900) : approach(t, 40, ROOM, 700)],

  // 우리 몸 — 운동 뒤 심박수가 높았다가 쉬면서 내려옴 / 날숨에 이산화 탄소가 많음
  'body-heart': ({ t, k }) => [k === 0 ? 76 + 2 * Math.sin(t / 7) : 82 + 58 * Math.exp(-t / 55)],
  'body-breath': ({ t, k }) => [k === 0 ? 620 : approach(t, 620, 26000, 8)],

  // 날씨와 우리 생활 — 낮에 기온이 오르면 습도는 낮아짐 / 차가운 컵 주변은 기온이 내려가고 습도가 오름
  'weather-day': ({ t, k }) => {
    const p = Math.min(t / 2400, 1);
    const temp = [[17, 21], [22, 24], [24, 23], [22, 20]], hum = [[68, 56], [52, 47], [46, 48], [50, 55]];
    const T = pick(temp, k), H = pick(hum, k);
    return [T[0] + (T[1] - T[0]) * p, H[0] + (H[1] - H[0]) * p];
  },
  'weather-dew': ({ t, k }) => (k === 0 ? [ROOM, 50] : [approach(t, ROOM, 14, 50), approach(t, 50, 78, 50)]),
  'weather-pressure': ({ k }) => [pick([101.6, 100.7, 101.9], k)],

  // 열과 우리 생활
  'heat-measure': ({ t, k }) => [approach(t, ROOM, pick([ROOM, 17, 45, 2], k), 3)],
  'heat-contact': ({ t }) => [approach(t, 50, 30, 70), approach(t, 10, 30, 70)], // 두 물의 온도가 같아짐
  'heat-move': ({ t }) => [approach(t, ROOM, 72, 35), ROOM + (46 - ROOM) * Math.max(0, 1 - Math.exp(-Math.max(0, t - 18) / 60))], // 먼 곳은 늦게 오름
  // 대류: 따뜻한 물이 위로 올라가 위쪽이 먼저 따뜻해짐 / 복사: 빛을 받는 곳만 따뜻해짐 (30초 뒤 시작)
  'heat-convect': ({ t }) => t < 30 ? [15, 15] : [approach(t - 30, 15, 27, 50), 15 + 3 * (1 - Math.exp(-(t - 30) / 240))],
  'heat-radiate': ({ t }) => t < 30 ? [ROOM, ROOM] : [approach(t - 30, ROOM, ROOM + 14, 90), ROOM + 1.2 * (1 - Math.exp(-(t - 30) / 200))],
  'heat-insulate': ({ t, k }) => [approach(t, 60, ROOM, pick([700, 1000, 1900], k))],

  // 산과 염기
  'acid-sort': ({ t, k }) => [approach(t, 7, pick([2.9, 2.3, 7.0, 9.8, 12.4], k), 2)],
  'acid-mix': ({ t }) => [1.6 + 10.6 / (1 + Math.exp(-(t - 180) / 7))],

  // 물체의 운동 — 일정한 속력이면 이동 거리가 시간에 비례 / 빗면에서는 점점 빨라짐
  'motion-constant': ({ t, k }) => [0.2 + pick([0.15, 0.35], k) * t],
  'motion-ramp': ({ t, k }) => [Math.min(1.2, 0.2 + 0.5 * pick([0.45, 0.95], k) * t * t)],

  // 식물의 구조와 기능 — 잎이 있으면 증산으로 습도가 오름 / 빛을 받으면 이산화 탄소가 줄어듦
  'plant-transpire': ({ t, k }) => [approach(t, 50, pick([92, 57], k), 220)],
  'plant-leaf': ({ t, k }) => [k === 0 ? 820 - 0.42 * t : 820 + 0.15 * t],

  // 계절의 변화 — 태양 고도가 높을수록 빛을 많이 받고 온도가 더 오름
  'season-angle': ({ t, k }) => [pick([2000, 1000], k), ROOM + pick([10, 5], k) * (1 - Math.exp(-t / 260))],
  'season-day': ({ t, k }) => [pick([17, 20.5, 22.8, 23.6, 23], k) + 0.0004 * t],

  // 물질의 연소 — 산소가 줄어 촛불이 꺼짐(큰 집기병이 더 오래) / 연소 후 이산화 탄소가 늘어남
  'burn-flame': ({ t, k }) => k === 0 ? [ROOM, 180] : [approach(t, ROOM, 38, 25), 180 + 520 * (1 - Math.exp(-t / 2))], // 탈 때 빛과 열
  'burn-o2': ({ t, k }) => [approach(t, 20.9, 16.4, pick([9, 22], k))],
  'burn-co2': ({ t, k }) => [k === 0 ? 650 : approach(t, 650, 24000, 15)],

  // 전기의 이용 — 전지 2개를 직렬로 연결하면 전압·전류가 커지고 전구가 밝아짐 / 전자석이 세짐
  'elec-circuit': ({ k }) => [pick([0.15, 0, 0], k)],    // 끊어진 곳 없이 연결할 때만 전류가 흐름
  'elec-series': ({ k }) => [pick([1.45, 2.86], k), pick([0.15, 0.21], k)],
  'elec-bright': ({ k }) => [pick([310, 920], k)],
  'elec-magnet': ({ t, k }) => [t >= 1 && t < 6 ? pick([2.4, 4.9], k) : 0],
};

// 실험별 측정 채널 (같은 종류 센서가 2개인 실험은 이름을 나눔)
const SIM_CHANNEL_NAMES = {
  'heat-contact': [['temp', '따뜻한 물 온도'], ['temp', '차가운 물 온도']],
  'heat-move': [['temp', '가까운 곳 온도'], ['temp', '먼 곳 온도']],
  'heat-convect': [['temp', '위쪽 물 온도'], ['temp', '아래쪽 물 온도']],
  'heat-radiate': [['temp', '빛을 받는 곳 온도'], ['temp', '빛을 가린 곳 온도']],
};
function simChannels(exp) {
  return SIM_CHANNEL_NAMES[exp.id] || exp.sensors.map(s => [s, SENSOR_TYPES[s].name]);
}
