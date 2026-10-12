// 가벼운 캔버스 선 그래프 (외부 라이브러리 없이 오프라인 동작)
const PLOT_COLORS = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

function niceTicks(min, max, count = 6) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, ticks, step };
}

function fmtTick(v, step) {
  const d = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)));
  return v.toFixed(d);
}

/**
 * series: [{ name, color, points: [[x, y], ...], axis: 'right'(오른쪽 y축, 점선), dash: true(점선) }]
 * opts: { xLabel, yLabel, y2Label(오른쪽 y축 이름), yRange·y2Range({min, max}: 축 범위를 직접 정함), width, height, background, empty }
 * 그린 뒤 canvas._plot 에 축 위치·범위를 남겨 축 드래그(enableAxisDrag)에 씀
 */
function drawPlot(canvas, series, opts = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = opts.width || canvas.clientWidth || 600;
  const h = opts.height || canvas.clientHeight || 300;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (opts.background) { ctx.fillStyle = opts.background; ctx.fillRect(0, 0, w, h); }

  const font = '12px "Noto Sans KR", "Malgun Gothic", sans-serif';
  const textColor = '#475569', gridColor = '#e2e8f0', axisColor = '#94a3b8';
  const dual = series.some(s => s.axis === 'right');
  const pad = { l: 64, r: dual ? 64 : 16, t: series.length > 1 ? 34 : 16, b: 44 };
  const ph = h - pad.t - pad.b;

  // 왼쪽(y)·오른쪽(y2) 축의 범위를 따로 구함
  let xmin = Infinity, xmax = -Infinity;
  const rng = { left: [Infinity, -Infinity], right: [Infinity, -Infinity] };
  series.forEach(s => s.points.forEach(([x, y]) => {
    if (y === null || y === undefined || !isFinite(y)) return;
    const r = rng[s.axis === 'right' ? 'right' : 'left'];
    if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    if (y < r[0]) r[0] = y; if (y > r[1]) r[1] = y;
  }));
  if (!isFinite(rng.left[0])) rng.left = isFinite(rng.right[0]) ? rng.right.slice() : rng.left;

  ctx.font = font;
  canvas._plot = null;
  if (!isFinite(xmin)) {
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(opts.empty || '측정을 시작하면 그래프가 그려집니다', w / 2, h / 2);
    return;
  }
  if (opts.xMinZero !== false) xmin = Math.min(0, xmin);
  const nY = Math.max(3, Math.floor(ph / 45));
  // 범위를 정했으면 그 범위 그대로, 아니면 데이터에 맞춰 자동
  const yTicks = ([lo, hi], fixed) => {
    if (fixed && isFinite(fixed.min) && isFinite(fixed.max) && fixed.max > fixed.min) {
      const T = niceTicks(fixed.min, fixed.max, nY);
      const eps = T.step * 1e-6;
      return { lo: fixed.min, hi: fixed.max, step: T.step, ticks: T.ticks.filter(v => v >= fixed.min - eps && v <= fixed.max + eps), fixed: true };
    }
    const yr = hi - lo || Math.abs(hi) * 0.1 || 1;
    return niceTicks(lo - yr * 0.05, hi + yr * 0.05, nY);
  };
  const Y = yTicks(rng.left, opts.yRange);
  const Y2 = dual && isFinite(rng.right[0]) ? yTicks(rng.right, opts.y2Range) : null;
  // 눈금 숫자 길이에 맞춰 여백을 잡아 축 이름과 겹치지 않게 함
  const tickW = T => Math.max(...T.ticks.map(v => ctx.measureText(fmtTick(v, T.step)).width), 10);
  pad.l = Math.max(52, Math.ceil(tickW(Y)) + 34);
  if (Y2) pad.r = Math.max(52, Math.ceil(tickW(Y2)) + 34);
  const pw = w - pad.l - pad.r;
  const X = niceTicks(xmin, xmax === xmin ? xmin + 1 : xmax, Math.max(3, Math.floor(pw / 80)));
  const sx = x => pad.l + (x - X.lo) / (X.hi - X.lo) * pw;
  const sy = y => pad.t + ph - (y - Y.lo) / (Y.hi - Y.lo) * ph;
  const sy2 = y => pad.t + ph - (y - Y2.lo) / (Y2.hi - Y2.lo) * ph;

  // 격자와 눈금
  ctx.lineWidth = 1;
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  Y.ticks.forEach(v => {
    const y = Math.round(sy(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
    ctx.fillText(fmtTick(v, Y.step), pad.l - 8, y);
  });
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  X.ticks.forEach(v => {
    const x = Math.round(sx(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke();
    ctx.fillText(fmtTick(v, X.step), x, pad.t + ph + 6);
  });
  ctx.strokeStyle = axisColor;
  ctx.beginPath(); ctx.moveTo(pad.l + 0.5, pad.t); ctx.lineTo(pad.l + 0.5, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph + 0.5); ctx.stroke();
  // 오른쪽 y축: 눈금 글자는 오른쪽 축 계열의 색으로
  if (Y2) {
    const c2 = (series.find(s => s.axis === 'right') || {}).color || textColor;
    ctx.beginPath(); ctx.moveTo(pad.l + pw + 0.5, pad.t); ctx.lineTo(pad.l + pw + 0.5, pad.t + ph); ctx.stroke();
    ctx.fillStyle = c2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    Y2.ticks.forEach(v => {
      const y = Math.round(sy2(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l + pw, y); ctx.lineTo(pad.l + pw + 4, y); ctx.stroke();
      ctx.fillText(fmtTick(v, Y2.step), pad.l + pw + 8, y);
    });
  }

  // 축 이름
  ctx.fillStyle = textColor;
  ctx.font = 'bold ' + font;
  if (opts.xLabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(opts.xLabel, pad.l + pw / 2, h - 4); }
  if (opts.yLabel) {
    ctx.save(); ctx.translate(14, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opts.yLabel, 0, 0); ctx.restore();
  }
  if (Y2 && opts.y2Label) {
    ctx.save(); ctx.translate(w - 14, pad.t + ph / 2); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = (series.find(s => s.axis === 'right') || {}).color || textColor;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opts.y2Label, 0, 0); ctx.restore();
  }

  // 데이터 선
  ctx.save();
  ctx.beginPath(); ctx.rect(pad.l, pad.t - 2, pw + 2, ph + 4); ctx.clip();
  series.forEach((s, i) => {
    const color = s.color || PLOT_COLORS[i % PLOT_COLORS.length];
    const right = s.axis === 'right' && Y2;
    const fy = right ? sy2 : sy;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.setLineDash(right || s.dash ? [6, 4] : []);
    ctx.beginPath();
    // 값이 없는 칸(다른 센서만 들어온 시각)은 건너뛰고 이어서 그림
    const pts = s.points.filter(([, y]) => y !== null && y !== undefined && isFinite(y));
    pts.forEach(([x, y], k) => { if (!k) ctx.moveTo(sx(x), fy(y)); else ctx.lineTo(sx(x), fy(y)); });
    ctx.stroke();
    ctx.setLineDash([]);
    if (pts.length <= 40) {
      pts.forEach(([x, y]) => {
        ctx.beginPath();
        if (right) ctx.rect(sx(x) - 3, fy(y) - 3, 6, 6); else ctx.arc(sx(x), fy(y), 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
  ctx.restore();

  // 축 드래그·범위 설정에 쓸 정보
  canvas._plot = { pad, pw, ph, w, h, Y: { lo: Y.lo, hi: Y.hi, fixed: !!Y.fixed }, Y2: Y2 ? { lo: Y2.lo, hi: Y2.hi, fixed: !!Y2.fixed } : null,
    yLabel: opts.yLabel || '', y2Label: Y2 ? (opts.y2Label || '') : '' };

  // 범례
  if (series.length > 1) {
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let x = pad.l;
    series.forEach((s, i) => {
      const color = s.color || PLOT_COLORS[i % PLOT_COLORS.length];
      const label = s.name || `시행 ${i + 1}`;
      const tw = ctx.measureText(label).width;
      if (x + tw + 26 > w) return;
      ctx.fillStyle = color;
      if ((s.axis === 'right' && Y2) || s.dash) { ctx.fillRect(x, 12, 5, 4); ctx.fillRect(x + 9, 12, 5, 4); } else ctx.fillRect(x, 12, 14, 4);
      ctx.fillStyle = textColor; ctx.fillText(label, x + 18, 14);
      x += tw + 34;
    });
  }
}

/**
 * 막대그래프 (관찰 결과를 조건별로 비교할 때)
 * categories: 가로축 항목 이름들, series: [{ name, color, values: [숫자|null] }]
 */
function drawBars(canvas, categories, series, opts = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = opts.width || canvas.clientWidth || 600, h = opts.height || canvas.clientHeight || 260;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (opts.background) { ctx.fillStyle = opts.background; ctx.fillRect(0, 0, w, h); }
  const font = '12px "Noto Sans KR", "Malgun Gothic", sans-serif';
  const pad = { l: 60, r: 16, t: series.length > 1 ? 34 : 16, b: 44 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const vals = series.flatMap(s => s.values).filter(v => v !== null && isFinite(v));
  ctx.font = font;
  if (!vals.length) { ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.fillText(opts.empty || '관찰 결과를 기록하면 그래프가 그려집니다', w / 2, h / 2); return; }
  const Y = niceTicks(Math.min(0, ...vals), Math.max(...vals) * 1.1 || 1, Math.max(3, Math.floor(ph / 45)));
  const sy = y => pad.t + ph - (y - Y.lo) / (Y.hi - Y.lo) * ph;
  ctx.strokeStyle = '#e2e8f0'; ctx.fillStyle = '#475569'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  Y.ticks.forEach(v => { const y = Math.round(sy(v)) + 0.5; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); ctx.fillText(fmtTick(v, Y.step), pad.l - 8, y); });
  const groupW = pw / categories.length, barW = Math.min(46, groupW * 0.7 / series.length);
  categories.forEach((c, ci) => {
    const gx = pad.l + groupW * ci + (groupW - barW * series.length) / 2;
    series.forEach((s, si) => {
      const v = s.values[ci];
      if (v === null || !isFinite(v)) return;
      ctx.fillStyle = s.color || PLOT_COLORS[si % PLOT_COLORS.length];
      const y0 = sy(Math.max(0, Y.lo)), y1 = sy(v);
      ctx.fillRect(gx + barW * si, Math.min(y0, y1), barW - 3, Math.abs(y0 - y1));
    });
    ctx.fillStyle = '#475569'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(c.length > 10 ? c.slice(0, 10) + '…' : c, pad.l + groupW * ci + groupW / 2, pad.t + ph + 6);
  });
  ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(pad.l + 0.5, pad.t); ctx.lineTo(pad.l + 0.5, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph + 0.5); ctx.stroke();
  ctx.font = 'bold ' + font; ctx.fillStyle = '#475569';
  if (opts.xLabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(opts.xLabel, pad.l + pw / 2, h - 4); }
  if (opts.yLabel) { ctx.save(); ctx.translate(14, pad.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opts.yLabel, 0, 0); ctx.restore(); }
  if (series.length > 1) {
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let x = pad.l;
    series.forEach((s, i) => { ctx.fillStyle = s.color || PLOT_COLORS[i % PLOT_COLORS.length]; ctx.fillRect(x, 10, 12, 10); ctx.fillStyle = '#475569'; ctx.fillText(s.name, x + 16, 15); x += ctx.measureText(s.name).width + 32; });
  }
}

function runStats(points) {
  const pts = points.filter(([, y]) => y !== null && isFinite(y));
  if (!pts.length) return null;
  const ys = pts.map(p => p[1]);
  const n = pts.length;
  const mean = ys.reduce((a, b) => a + b, 0) / n;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  let num = 0, den = 0;
  pts.forEach(([x, y]) => { num += (x - mx) * (y - mean); den += (x - mx) * (x - mx); });
  return {
    n, min: Math.min(...ys), max: Math.max(...ys), mean,
    first: ys[0], last: ys[n - 1], change: ys[n - 1] - ys[0],
    slope: den ? num / den : 0, duration: pts[n - 1][0] - pts[0][0],
  };
}

/**
 * 축 드래그로 범위 바꾸기: 축 숫자 위를 누른 채 위아래로 끌면
 * - 축의 위쪽 절반을 잡으면 최댓값이, 아래쪽 절반을 잡으면 최솟값이 움직여 잡은 값이 손가락(마우스)을 따라옴
 * - 축을 두 번 누르면 자동 범위로 돌아감
 * onChange(side: 'y'|'y2', range|null, label)
 */
function enableAxisDrag(canvas, onChange) {
  if (canvas._axisDrag) return;
  canvas._axisDrag = true;
  const zone = e => {
    const p = canvas._plot;
    if (!p) return null;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (y < p.pad.t - 6 || y > p.pad.t + p.ph + 6) return null;
    if (x < p.pad.l) return { side: 'y', ax: p.Y, label: p.yLabel, y, p };
    if (p.Y2 && x > p.pad.l + p.pw) return { side: 'y2', ax: p.Y2, label: p.y2Label, y, p };
    return null;
  };
  let drag = null;
  canvas.addEventListener('pointermove', e => {
    if (drag && !(e.buttons & 1)) drag = null; // 버튼을 뗀 뒤(창 밖에서 뗀 경우 포함)에는 끌기 끝
    if (!drag) { canvas.style.cursor = zone(e) ? 'ns-resize' : ''; return; }
    const r = canvas.getBoundingClientRect();
    const { p, lo, hi, v0, top } = drag;
    const frac = (p.pad.t + p.ph - (e.clientY - r.top)) / p.ph;
    let range;
    if (top) { if (frac < 0.05) return; range = { min: lo, max: lo + (v0 - lo) / frac }; }
    else { if (frac > 0.95) return; range = { min: (v0 - frac * hi) / (1 - frac), max: hi }; }
    if (!(range.max > range.min) || !isFinite(range.min) || !isFinite(range.max)) return;
    onChange(drag.side, range, drag.label);
  });
  canvas.addEventListener('pointerdown', e => {
    const z = zone(e);
    if (!z) return;
    e.preventDefault();
    const { lo, hi } = z.ax;
    const v0 = lo + (z.p.pad.t + z.p.ph - z.y) / z.p.ph * (hi - lo);
    drag = { side: z.side, label: z.label, p: z.p, lo, hi, v0, top: v0 > (lo + hi) / 2 };
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  window.addEventListener('pointerup', end);
  canvas.addEventListener('dblclick', e => { const z = zone(e); if (z) onChange(z.side, null, z.label); });
  canvas.style.touchAction = 'pan-x pan-y';
}
