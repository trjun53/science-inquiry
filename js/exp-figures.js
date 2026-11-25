// 실험 설계 및 준비(2단계) 맨 아래에 보여 주는 '실험 장면' 그림 — 실험 id별 SVG
// 센서 1은 빨간색, 센서 2는 파란색 (예상하기 단계 그래프의 빨간 선·파란 선과 같은 뜻)
// 그림 안 글자는 짧게, 자세한 설명은 caption·points(HTML 글자)로 보여 줌
const EXP_FIGURES = (() => {
  const W = 680, H = 380, T = 322; // 그림 크기, 책상 윗면 높이
  const C = {
    ink: '#334155', sub: '#64748b', glass: '#64748b', s1: '#e11d48', s2: '#2563eb',
    tap: '#e0f2fe', cold: '#bfdbfe', warm: '#fecdd3', hot: '#fda4af', steel: '#cbd5e1', handle: '#334155', cable: '#475569',
  };
  const sc = n => (n === 2 ? C.s2 : C.s1);

  const svg = (label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">`
    + `<rect width="${W}" height="${H}" rx="16" fill="#f8fafc"/>${body}</svg>`;
  const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 16}" font-weight="${o.weight || 600}" fill="${o.fill || C.ink}" text-anchor="${o.anchor || 'middle'}">${s}</text>`;
  const table = () => `<rect x="14" y="${T}" width="${W - 28}" height="9" rx="4" fill="#dbe2ea"/>`;
  // 책상 아래 이름표 줄: [[x, 글자, 센서 번호(색)], …]
  const labels = list => list.map(([x, s, n]) => text(x, T + 36, s, { size: 15, fill: n ? sc(n) : C.ink })).join('');

  // 비커(왼쪽 x, 너비, 높이, 물 높이 0~1, 물 색) — 바닥은 책상 위
  const beaker = (x, w, h, level, fill) => {
    const b = T, top = b - h, wy = b - h * level;
    return `<path d="M${x + 3} ${wy} H${x + w - 3} V${b - 9} Q${x + w - 3} ${b - 3} ${x + w - 9} ${b - 3} H${x + 9} Q${x + 3} ${b - 3} ${x + 3} ${b - 9} Z" fill="${fill}"/>`
      + `<line x1="${x + 4}" y1="${wy}" x2="${x + w - 4}" y2="${wy}" stroke="#fff" stroke-width="2" opacity=".9"/>`
      + glass(x, w, h);
  };
  const glass = (x, w, h) => {
    const b = T, top = b - h;
    return `<path d="M${x - 8} ${top - 3} Q${x} ${top - 2} ${x} ${top + 8} V${b - 10} Q${x} ${b} ${x + 10} ${b} H${x + w - 10} Q${x + w} ${b} ${x + w} ${b - 10} V${top}" fill="none" stroke="${C.glass}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`
      + [0.3, 0.5, 0.7].map(k => `<line x1="${x + w - 14}" y1="${b - h * k}" x2="${x + w - 4}" y2="${b - h * k}" stroke="${C.glass}" stroke-width="1.5" opacity=".55"/>`).join('');
  };
  // 온도 센서 막대(세로): 손잡이 위 끝 (x, y), 센서 끝 높이 tip
  const probe = (x, y, tip, o = {}) => `<g${o.ghost ? ' opacity=".45"' : ''}>`
    + `<rect x="${x - 4}" y="${y + 36}" width="8" height="${tip - y - 36}" rx="4" fill="${C.steel}" stroke="#94a3b8" stroke-width="1.2"/>`
    + `<rect x="${x - 8}" y="${y}" width="16" height="42" rx="5" fill="${C.handle}"/></g>`;
  // 온도 센서 막대(가로): 센서 끝 x, 높이 y, 손잡이 시작 x(오른쪽)
  const probeH = (tip, y, hx) => `<rect x="${tip}" y="${y - 4}" width="${hx - tip + 4}" height="8" rx="4" fill="${C.steel}" stroke="#94a3b8" stroke-width="1.2"/>`
    + `<rect x="${hx}" y="${y - 8}" width="42" height="16" rx="5" fill="${C.handle}"/>`;
  const cable = d => `<path d="${d}" fill="none" stroke="${C.cable}" stroke-width="2.5" stroke-linecap="round"/>`;
  // 무선 센서 본체(책상 위)
  const box = (x, n) => `<rect x="${x}" y="${T - 38}" width="78" height="36" rx="9" fill="#fff" stroke="${sc(n)}" stroke-width="2.5"/>`
    + `<path d="M${x + 9} ${T - 38} H${x + 14} V${T - 2} H${x + 9} Q${x} ${T - 2} ${x} ${T - 11} V${T - 29} Q${x} ${T - 38} ${x + 9} ${T - 38} Z" fill="${sc(n)}"/>`
    + text(x + 45, T - 15, `센서 ${n}`, { size: 14, weight: 700, fill: sc(n) });
  // 센서 번호 동그라미
  const badge = (x, y, n) => `<circle cx="${x}" cy="${y}" r="12" fill="${sc(n)}"/>` + text(x, y + 5, n, { size: 14, weight: 700, fill: '#fff' });
  // 태블릿(측정 앱): lines = [[센서 번호, '0~1 좌표 x,y …'], …]
  const tablet = (x, y, w, h, lines) => {
    const ix = x + 7, iy = y + 7, iw = w - 14, ih = h - 14, ox = ix + 9, oy = iy + ih - 8, gw = iw - 16, gh = ih - 16;
    const pt = s => s.split(' ').map(p => { const [a, b] = p.split(',').map(Number); return `${(ox + a * gw).toFixed(1)},${(oy - b * gh).toFixed(1)}`; }).join(' ');
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#1e293b"/>`
      + `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="5" fill="#fff"/>`
      + `<polyline points="${ox},${iy + 6} ${ox},${oy} ${ix + iw - 6},${oy}" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>`
      + lines.map(([n, s]) => `<polyline points="${pt(s)}" fill="none" stroke="${sc(n)}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`).join('')
      + text(x + w / 2, y + h + 18, '측정 앱', { size: 13, fill: C.sub });
  };
  const wifi = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>`;
  // 설명선: 가리키는 점 (px, py) → 글자 위치 (tx, ty)
  const note = (px, py, tx, ty, s, anchor = 'start') => `<line x1="${px}" y1="${py}" x2="${tx}" y2="${ty}" stroke="#94a3b8" stroke-width="1.5"/>`
    + `<circle cx="${px}" cy="${py}" r="3.5" fill="${C.sub}"/>` + text(tx + (anchor === 'start' ? 5 : anchor === 'end' ? -5 : 0), ty + 5, s, { anchor, size: 15 });
  // 스탠드: 기둥 x, 꼭대기 y, 팔 [[높이 y, 끝 x], …]
  const stand = (x, top, arms) => `<rect x="${x - 32}" y="${T - 9}" width="64" height="9" rx="3" fill="#64748b"/>`
    + `<rect x="${x - 3}" y="${top}" width="6" height="${T - 9 - top}" rx="2" fill="#94a3b8"/>`
    + arms.map(([y, to]) => `<rect x="${Math.min(x, to)}" y="${y - 3}" width="${Math.abs(to - x)}" height="6" rx="3" fill="#94a3b8"/>`
      + `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="3" fill="#64748b"/>`).join('');
  const clamp = (x, y) => `<rect x="${x - 12}" y="${y - 6}" width="24" height="12" rx="3" fill="#64748b"/>`;
  const steam = (x, y, c = '#fda4af') => [0, 15, 30].map(d => `<path d="M${x + d} ${y} q-6 -9 0 -18 t0 -18" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>`).join('');
  const arrow = (d, c, w = 3) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

  const F = {};

  /* 여러 가지 물체의 온도 측정하기 */
  F['heat-measure'] = {
    caption: '온도 센서 하나로 교실 공기, 수돗물, 따뜻한 물, 얼음물의 온도를 차례로 재요.',
    points: ['먼저 센서를 공기 중에 두고 30초 동안 재요.', '센서 끝을 물에 넣고 값이 더 변하지 않을 때까지 기다려요.', '센서 손잡이와 연결 부분은 물에 넣지 않아요.'],
    svg: svg('온도 센서로 공기, 수돗물, 따뜻한 물, 얼음물의 온도를 차례로 재는 모습', table()
      + probe(78, 150, 262, { ghost: true })
      + beaker(130, 100, 118, 0.62, C.tap)
      + beaker(262, 100, 118, 0.62, C.warm) + steam(276, 196)
      + beaker(394, 100, 118, 0.62, C.cold)
      + [[410, 238, 12], [440, 244, -8], [466, 236, 6]].map(([x, y, r]) => `<rect x="${x}" y="${y}" width="22" height="20" rx="4" fill="#fff" stroke="#93c5fd" stroke-width="2" transform="rotate(${r} ${x + 11} ${y + 10})"/>`).join('')
      + probe(338, 118, 300) + badge(338, 100, 1)
      + cable('M338 118 C338 50 520 40 560 284')
      + box(522, 1)
      + tablet(548, 30, 116, 78, [[1, '0,0.1 0.15,0.12 0.3,0.6 0.45,0.82 0.7,0.88 1,0.9']])
      + wifi(590, 282, 606, 132)
      + note(338, 168, 386, 170, '온도 센서')
      + labels([[78, '① 교실 공기'], [180, '② 수돗물'], [312, '③ 따뜻한 물'], [444, '④ 얼음물']])),
  };

  /* 온도가 다른 두 물체가 접촉할 때 */
  F['heat-contact'] = {
    caption: '차가운 물이 든 비커에 따뜻한 물이 든 지퍼 백을 넣고, 두 물의 온도를 센서 2개로 함께 재요.',
    points: ['센서 1(빨강)은 지퍼 백 속 따뜻한 물에, 센서 2(파랑)는 비커 속 차가운 물에 넣어요.', '따뜻한 물과 차가운 물의 양을 같게 하고, 젓지 않아요.', '두 센서는 스탠드에 고정해 움직이지 않게 해요.'],
    svg: svg('차가운 물이 든 비커 속에 따뜻한 물이 든 지퍼 백을 넣고 두 물의 온도를 센서 2개로 재는 모습', table()
      + stand(70, 60, [[122, 392]])
      + beaker(150, 260, 172, 0.78, C.cold)
      + `<path d="M226 172 H346 Q352 172 352 180 V294 Q352 310 336 310 H236 Q220 310 220 294 V180 Q220 172 226 172 Z" fill="#fff5f6" fill-opacity=".6" stroke="#fb7185" stroke-width="2"/>`
      + `<path d="M223 202 H349 V294 Q349 307 336 307 H236 Q223 307 223 294 Z" fill="${C.warm}"/>`
      + `<line x1="220" y1="180" x2="352" y2="180" stroke="#be123c" stroke-width="3"/>`
      + text(268, 262, '따뜻한 물', { size: 14, fill: '#9f1239' })
      + text(187, 262, '차가운', { size: 13, fill: '#1e40af' }) + text(187, 279, '물', { size: 13, fill: '#1e40af' })
      + glass(150, 260, 172)
      + probe(322, 100, 292) + probe(380, 100, 296) + clamp(322, 122) + clamp(380, 122)
      + badge(322, 84, 1) + badge(380, 84, 2)
      + cable('M322 100 C322 40 440 50 470 160 S 500 270 506 284')
      + cable('M380 100 C380 60 470 70 520 150 S 600 250 604 284')
      + box(466, 1) + box(566, 2)
      + tablet(548, 24, 116, 78, [[1, '0,0.92 0.15,0.72 0.35,0.6 0.6,0.54 1,0.51'], [2, '0,0.06 0.15,0.26 0.35,0.38 0.6,0.44 1,0.47']])
      + wifi(616, 282, 612, 126)
      + note(240, 176, 250, 150, '지퍼 백', 'end')
      + labels([[70, '스탠드'], [280, '비커(차가운 물) + 지퍼 백(따뜻한 물)']])),
  };

  /* 고체에서 열의 이동(전도) */
  const sY = 243; // 뜨거운 물 수면
  F['heat-move'] = {
    caption: '구리판의 아래쪽 끝을 뜨거운 물에 담그고, 물에 닿는 곳에서 3 cm와 9 cm 떨어진 곳의 온도를 센서 2개로 재요.',
    points: ['센서 끝을 구리판에 대고 테이프로 단단히 붙여요.', '센서 1(빨강)은 가까운 곳(3 cm), 센서 2(파랑)는 먼 곳(9 cm)에 붙여요.', '구리판은 스탠드에 고정하고, 뜨거워진 구리판은 맨손으로 만지지 않아요.'],
    svg: svg('구리판 아래쪽을 뜨거운 물에 담그고 물에서 3 cm, 9 cm 떨어진 곳에 붙인 센서 2개로 온도를 재는 모습', table()
      + stand(110, 50, [[80, 232]]) + clamp(250, 80)
      + `<path d="M193 ${sY} H307 V${T - 9} Q307 ${T - 3} 301 ${T - 3} H199 Q193 ${T - 3} 193 ${T - 9} Z" fill="${C.hot}"/>`
      + `<rect x="226" y="66" width="48" height="236" rx="3" fill="#e3a06e" stroke="#b45309" stroke-width="1.5"/>`
      + `<rect x="226" y="${sY}" width="48" height="59" fill="${C.hot}" opacity=".5"/>`
      + `<line x1="194" y1="${sY}" x2="306" y2="${sY}" stroke="#fff" stroke-width="2"/>`
      + [228, 196, 164].map(y => arrow(`M243 ${y} l7 -7 l7 7`, '#dc2626', 2.5)).join('')
      + glass(190, 120, 110) + steam(198, 228)
      + `<rect x="244" y="194" width="30" height="18" rx="2" fill="#fde68a" opacity=".85"/>`
      + `<rect x="244" y="117" width="30" height="18" rx="2" fill="#fde68a" opacity=".85"/>`
      + probeH(252, 203, 420) + probeH(252, 126, 420)
      + badge(486, 203, 1) + badge(486, 126, 2)
      // 거리 표시
      + `<line x1="276" y1="${sY}" x2="388" y2="${sY}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>`
      + `<path d="M322 ${sY} V209 M316 ${sY} H328 M316 209 H328" stroke="${C.ink}" stroke-width="1.6" fill="none"/>`
      + text(334, 232, '3 cm', { size: 14, anchor: 'start' })
      + `<path d="M380 ${sY} V132 M374 ${sY} H386 M374 132 H386" stroke="${C.ink}" stroke-width="1.6" fill="none"/>`
      + text(390, 175, '9 cm', { size: 14, anchor: 'start' })
      + cable('M462 203 C510 203 520 250 526 284') + cable('M462 126 C560 126 610 200 616 284')
      + box(488, 1) + box(578, 2)
      + tablet(548, 22, 116, 74, [[1, '0,0.06 0.15,0.1 0.3,0.45 0.5,0.75 1,0.9'], [2, '0,0.06 0.3,0.08 0.5,0.24 0.7,0.48 1,0.64']])
      + note(228, 100, 168, 104, '구리판', 'end') + note(246, 126, 168, 152, '테이프', 'end')
      + labels([[110, '스탠드'], [250, '뜨거운 물']])),
  };

  /* 액체·기체에서 열의 이동(대류) */
  const surf = T - 170 * 0.86; // 수조 물 높이
  F['heat-convect'] = {
    caption: '차가운 물이 든 수조 바닥에 물감을 탄 따뜻한 물이 든 병을 넣고, 수조 위쪽과 아래쪽 물의 온도를 재요.',
    points: ['센서 1(빨강)은 수면 가까이, 센서 2(파랑)는 바닥 가장자리에 스탠드로 고정해요.', '병은 뚜껑을 연 채 수조 바닥 가운데에 조심히 넣어요.', '물감이 움직이는 모습과 두 센서의 온도 변화를 함께 살펴봐요.'],
    svg: svg('수조 바닥의 따뜻한 물이 위로 올라가는 모습과, 수면 근처와 바닥 가장자리에 둔 센서 2개', table()
      + stand(62, 52, [[94, 404]])
      + beaker(112, 340, 170, 0.86, '#dbeafe')
      + `<path d="M272 250 C262 228 270 214 264 196 C246 190 212 192 168 ${surf + 9} C214 ${surf + 1} 260 ${surf} 300 ${surf + 1} C340 ${surf} 372 ${surf + 2} 404 ${surf + 9} C360 194 320 190 300 198 C292 214 298 230 288 250 Z" fill="#fb7185" opacity=".33"/>`
      + arrow('M280 236 V206 M272 214 L280 204 L288 214', '#e11d48')
      + arrow(`M262 ${surf + 18} H214 M222 ${surf + 11} L212 ${surf + 18} L222 ${surf + 25}`, '#e11d48')
      + arrow(`M300 ${surf + 18} H348 M340 ${surf + 11} L350 ${surf + 18} L340 ${surf + 25}`, '#e11d48')
      + arrow('M150 220 V268 M143 260 L150 270 L157 260', '#60a5fa') + arrow('M418 220 V268 M411 260 L418 270 L425 260', '#60a5fa')
      + `<path d="M266 262 H294 V250 H266 Z" fill="#f43f5e"/><path d="M258 268 Q258 262 266 262 H294 Q302 262 302 268 V312 Q302 318 296 318 H264 Q258 318 258 312 Z" fill="#f43f5e" stroke="#be123c" stroke-width="2"/>`
      + text(310, 302, '따뜻한 물(물감)', { size: 13, fill: '#9f1239', anchor: 'start' })
      + probe(400, 72, surf + 22) + probe(136, 72, 304) + clamp(400, 94) + clamp(136, 94)
      + badge(400, 56, 1) + badge(136, 56, 2)
      + cable('M400 72 C400 34 470 44 490 160 S 500 270 506 284')
      + cable('M136 72 C136 16 500 16 528 130 S 600 270 604 284')
      + box(466, 1) + box(566, 2)
      + tablet(556, 18, 108, 70, [[1, '0,0.08 0.1,0.1 0.25,0.6 0.5,0.8 1,0.86'], [2, '0,0.06 0.3,0.08 0.55,0.16 1,0.24']])
      + wifi(520, 282, 590, 112) + wifi(632, 282, 632, 112)
      + labels([[62, '스탠드'], [282, '수조(차가운 물) + 병(따뜻한 물)']])),
  };

  /* 빛에 의한 열의 이동(복사) */
  F['heat-radiate'] = {
    caption: '전등에서 같은 거리에 센서 2개를 두고, 한쪽 센서 앞만 두꺼운 종이로 가려 빛을 받는 곳과 가린 곳의 온도를 비교해요.',
    points: ['두 센서 끝을 같은 크기의 검은색 색종이로 감싸요.', '센서 1(빨강)은 전등 빛을 받고, 센서 2(파랑)는 앞을 두꺼운 종이로 가려요.', 'LED 전등은 열이 적어 변화가 작으니 백열전구나 햇빛을 써요.'],
    svg: svg('전등 빛을 받는 센서 1과 두꺼운 종이로 빛을 가린 센서 2의 온도를 비교하는 모습', table()
      // 그늘
      + `<path d="M268 206 L340 214 V${T} H268 Z" fill="#e2e8f0" opacity=".8"/>`
      // 빛
      + `<circle cx="152" cy="190" r="48" fill="#fde68a" opacity=".45"/>`
      + [[330, 130], [330, 146], [330, 162], [262, 220], [262, 238], [262, 256]].map(([x, y]) => `<line x1="170" y1="190" x2="${x}" y2="${y}" stroke="#facc15" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>`).join('')
      // 전등
      + `<rect x="62" y="${T - 9}" width="54" height="9" rx="3" fill="#64748b"/><rect x="86" y="150" width="6" height="${T - 159}" fill="#94a3b8"/>`
      + `<path d="M92 160 L118 176 L118 204 L92 196 Z" fill="#64748b"/><path d="M116 168 L146 158 L146 222 L116 212 Z" fill="#475569"/>`
      + `<circle cx="152" cy="190" r="17" fill="#fde047" stroke="#eab308" stroke-width="2"/>`
      // 가림막(두꺼운 종이)
      + `<rect x="258" y="206" width="10" height="${T - 206}" rx="2" fill="#94a3b8"/>`
      // 센서
      + probeH(330, 146, 400) + probeH(330, 236, 400)
      + `<rect x="324" y="136" width="28" height="20" rx="5" fill="#111827"/><rect x="324" y="226" width="28" height="20" rx="5" fill="#111827"/>`
      + stand(462, 110, [[146, 442], [236, 442]])
      + badge(421, 124, 1) + badge(421, 214, 2)
      // 거리
      + `<path d="M152 104 H330 M152 98 V110 M330 98 V110" stroke="${C.ink}" stroke-width="1.6" fill="none"/>` + text(241, 96, '약 20 cm', { size: 14 })
      + cable('M442 146 C510 146 530 230 539 284') + cable('M442 236 C540 236 610 250 623 284')
      + box(500, 1) + box(584, 2)
      + tablet(548, 22, 116, 74, [[1, '0,0.08 0.1,0.1 0.3,0.5 0.6,0.75 1,0.88'], [2, '0,0.08 0.5,0.1 1,0.14']])
      + note(263, 210, 225, 296, '두꺼운 종이', 'end')
      + labels([[90, '전등(백열전구)'], [338, '검은 종이로 감싼 센서 끝'], [462, '스탠드']])),
  };

  /* 단열 장치 만들고 성능 비교하기 */
  const cup = (cx, kind) => {
    const top = T - 112, tw = 46, bw = 34;
    const body = `M${cx - tw} ${top} L${cx - bw} ${T - 1} H${cx + bw} L${cx + tw} ${top} Z`;
    const fill = kind === 'foil' ? '#e5e7eb' : kind === 'bubble' ? '#f0f9ff' : '#ffffff';
    const stroke = kind === 'foil' ? '#6b7280' : kind === 'bubble' ? '#60a5fa' : '#94a3b8';
    let deco = '';
    if (kind === 'foil') deco = [0, 1, 2, 3].map(i => `<polyline points="${cx - 36 + i * 4},${top + 18 + i * 22} ${cx - 14},${top + 26 + i * 22} ${cx + 6},${top + 16 + i * 22} ${cx + 30 - i * 3},${top + 28 + i * 22}" fill="none" stroke="#9ca3af" stroke-width="1.5"/>`).join('');
    if (kind === 'bubble') for (let r = 0; r < 4; r++) for (let c = -3; c <= 3; c++) {
      const x = cx + c * 12 + (r % 2 ? 6 : 0), y = top + 16 + r * 24, half = tw - (tw - bw) * ((y - top) / 112) - 6;
      if (Math.abs(x - cx) < half) deco += `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="#93c5fd" stroke-width="1.5"/>`;
    }
    const band = kind ? `<line x1="${cx - 42}" y1="${top + 56}" x2="${cx + 42}" y2="${top + 56}" stroke="#a16207" stroke-width="3"/>` : '';
    return `<path d="${body}" fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>${deco}${band}`
      + `<ellipse cx="${cx}" cy="${top}" rx="${tw}" ry="7" fill="${C.warm}" stroke="${stroke}" stroke-width="2.5"/>` + steam(cx - 15, top - 12);
  };
  F['heat-insulate'] = {
    caption: '감싸지 않은 컵, 알루미늄 포일로 감싼 컵, 뽁뽁이로 감싼 컵에 따뜻한 물을 붓고 차례로 온도를 재요.',
    points: ['세 컵에 같은 온도, 같은 양의 따뜻한 물을 부어요.', '컵마다 센서를 넣고 5분 동안 재서 온도가 내려간 정도를 비교해요.', '컵이 넘어지지 않게 받침을 사용해요.'],
    svg: svg('감싸지 않은 컵, 알루미늄 포일 컵, 뽁뽁이 컵에 담긴 따뜻한 물의 온도를 센서로 재는 모습', table()
      + stand(58, 70, [[120, 180]]) + cup(180, '') + cup(310, 'foil') + cup(440, 'bubble')
      + probe(180, 98, 300) + clamp(180, 120) + badge(180, 82, 1)
      + cable('M180 98 C180 40 470 40 520 200 S 540 270 546 284')
      + box(508, 1)
      + tablet(548, 26, 116, 74, [[1, '0,0.92 0.15,0.74 0.35,0.58 0.6,0.46 1,0.38']])
      + wifi(580, 282, 600, 124)
      + labels([[58, '스탠드'], [180, '① 감싸지 않음'], [310, '② 알루미늄 포일'], [440, '③ 뽁뽁이']])),
  };

  return F;
})();
