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
 * series: [{ name, color, points: [[x, y], ...] }]
 * opts: { xLabel, yLabel, width, height, background, empty }
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
  const pad = { l: 64, r: 16, t: series.length > 1 ? 34 : 16, b: 44 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;

  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  series.forEach(s => s.points.forEach(([x, y]) => {
    if (y === null || y === undefined || !isFinite(y)) return;
    if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    if (y < ymin) ymin = y; if (y > ymax) ymax = y;
  }));

  ctx.font = font;
  if (!isFinite(xmin)) {
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(opts.empty || '측정을 시작하면 그래프가 그려집니다', w / 2, h / 2);
    return;
  }
  if (opts.xMinZero !== false) xmin = Math.min(0, xmin);
  const yr = ymax - ymin || Math.abs(ymax) * 0.1 || 1;
  const X = niceTicks(xmin, xmax === xmin ? xmin + 1 : xmax, Math.max(3, Math.floor(pw / 80)));
  const Y = niceTicks(ymin - yr * 0.05, ymax + yr * 0.05, Math.max(3, Math.floor(ph / 45)));
  const sx = x => pad.l + (x - X.lo) / (X.hi - X.lo) * pw;
  const sy = y => pad.t + ph - (y - Y.lo) / (Y.hi - Y.lo) * ph;

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

  // 축 이름
  ctx.fillStyle = textColor;
  ctx.font = 'bold ' + font;
  if (opts.xLabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(opts.xLabel, pad.l + pw / 2, h - 4); }
  if (opts.yLabel) {
    ctx.save(); ctx.translate(14, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opts.yLabel, 0, 0); ctx.restore();
  }

  // 데이터 선
  ctx.save();
  ctx.beginPath(); ctx.rect(pad.l, pad.t - 2, pw + 2, ph + 4); ctx.clip();
  series.forEach((s, i) => {
    const color = s.color || PLOT_COLORS[i % PLOT_COLORS.length];
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    s.points.forEach(([x, y]) => {
      if (y === null || y === undefined || !isFinite(y)) { pen = false; return; }
      if (!pen) { ctx.moveTo(sx(x), sy(y)); pen = true; } else ctx.lineTo(sx(x), sy(y));
    });
    ctx.stroke();
    if (s.points.length <= 40) {
      s.points.forEach(([x, y]) => {
        if (y === null || !isFinite(y)) return;
        ctx.beginPath(); ctx.arc(sx(x), sy(y), 3, 0, Math.PI * 2); ctx.fill();
      });
    }
  });
  ctx.restore();

  // 범례
  if (series.length > 1) {
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let x = pad.l;
    series.forEach((s, i) => {
      const color = s.color || PLOT_COLORS[i % PLOT_COLORS.length];
      const label = s.name || `시행 ${i + 1}`;
      const tw = ctx.measureText(label).width;
      if (x + tw + 26 > w) return;
      ctx.fillStyle = color; ctx.fillRect(x, 12, 14, 4);
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
