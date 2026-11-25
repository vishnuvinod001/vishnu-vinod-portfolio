// ==========================================================
// SPRITE THEME — recolours the pixel art (outfit, headset, desk, screens...) to the
// page theme. Only the blue/cyan family is shifted, so skin, hair, face and the
// warm colours stay exactly as drawn, and GHOST is drawn without it.
// ==========================================================
(() => {
  'use strict';
  const BASE = { c1: [187, 0.77], c2: [236, 0.89] };     // hue, saturation of the original (Aurora) accents
  let T = null; const cache = new Map(), subs = [];
  const rgb2hsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  };
  const hsl2rgb = (h, s, l) => {
    h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };
  function shift(r, g, b) {                               // -> [r, g, b] (same array values if untouched)
    if (!T) return [r, g, b];
    const [h, s, l] = rgb2hsl(r, g, b);
    if (s < 0.15 || h < 160 || h > 290) return [r, g, b];
    const k = h < 205 ? 'c1' : 'c2';
    const nh = h + (T[k][0] - BASE[k][0]), ns = Math.max(0, Math.min(1, s * (T[k][1] / BASE[k][1])));
    return hsl2rgb(nh, ns, l);
  }
  const hex = (a) => '#' + a.map((x) => x.toString(16).padStart(2, '0')).join('');
  function tint(col) {
    if (!T || typeof col !== 'string') return col;
    let v = cache.get(col); if (v) return v;
    let m = /^#([0-9a-f]{6})$/i.exec(col), a;
    if (m) { const n = parseInt(m[1], 16); a = [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    else if ((m = /^#([0-9a-f]{3})$/i.exec(col))) { a = m[1].split('').map((x) => parseInt(x + x, 16)); }
    else { cache.set(col, col); return col; }
    v = hex(shift(a[0], a[1], a[2])); cache.set(col, v); return v;
  }
  function tintImage(img) {
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth || img.width; cv.height = img.naturalHeight || img.height;
    const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
    try {
      const id = c.getImageData(0, 0, cv.width, cv.height), d = id.data, memo = new Map();
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const key = d[i] << 16 | d[i + 1] << 8 | d[i + 2]; let o = memo.get(key);
        if (!o) { o = shift(d[i], d[i + 1], d[i + 2]); memo.set(key, o); }
        d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
      }
      c.putImageData(id, 0, 0);
    } catch (e) { return img; }
    return cv;
  }
  function read() {
    const cs = getComputedStyle(document.documentElement);
    const get = (n) => { const m = /^#?([0-9a-f]{6})$/i.exec(cs.getPropertyValue(n).trim()); if (!m) return null; const v = parseInt(m[1], 16); const [h, s] = rgb2hsl(v >> 16 & 255, v >> 8 & 255, v & 255); return [h, s]; };
    const c1 = get('--c1'), c2 = get('--c2');
    if (!c1 || !c2) return;
    T = { c1, c2 }; cache.clear(); subs.forEach((f) => f());
  }
  window.SpriteTheme = { tint, tintImage, onChange: (f) => subs.push(f) };
  read();
  new MutationObserver(read).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

// ==========================================================
// SPRITES — pixel-art chibi of Vishnu (About), GHOST floating
// over its project card, and the over-the-shoulder desk scene
// (Contact). Ported from Vishnu's original portfolio.
// ==========================================================
(() => {
  'use strict';
  const cv = document.getElementById('toon');
  const av = document.getElementById('toonWrap');
  const bubble = document.getElementById('bubble');
  const bubbleText = document.getElementById('bubble-text');
  if (!cv || !av) return;
  const A = {"W":40,"H":56,"img":{"body":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAA4CAYAAACPKLr2AAABaUlEQVR42u3WMUvDQBwF8NeSsUmXgKVIoKNDHPwGDiLoJzCLUzYtSBZxcROXLsUtU5fuDhXEQVBcs2RwkoCCdCiUVve4eDGJ1XhJzNL3m5LjLnncP3c5gIiIiIiIiIiIiJZVLc8gXVPDPOMm87da6QHTYdY2zxb2628HifvudWdhv/vLQ6mQSla4lmkn2h5vT34MmWU6CaBraigzkzWZcMLYdxMhO/0DAIBnOQCAjWEPABB0L6I+L08PAIBGs42x7/653Erej3c6+Spp5zOcCCau433yqhcZLAIJnuVEs1iWepFwA+N7yLIpv24Jvhvu+PNE+5WpoWXa8CwH+8NeorSVBhSORg62jt3oPr5wRDkHBmCmxi1qK32j1jU1vDm3sWKsAgDWrVOkZ1SWZzn/u4rvdvcKBWw02+WWuOgLhPfZa/XbTBWUqmYi/heS+dVlBhQLJAr4PCoUUPZEI3WaEQ+v8rhFRLTsPgCxZXrXoPEGWQAAAABJRU5ErkJggg==","head":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAA4CAYAAACPKLr2AAACRUlEQVR42u2YPU8bQRCG3z25MdJZQooMgkBDkaSwe8oUNNRULqCi4wcgGosG8QPSpXPhKrWbFCndQ0Fc0JgPGYOEuJPiBgmqPY3n9vbDe3YiZd/KupudeW5mZ863Ap76UIvfdPefklT4+Be+UF++nmltr36deMGKWcBUUBTEZOMCKlzglj/tAwBW1z7ngOpxFVsbqwCA65sRxukkBzy6/w0AeB50rCGFK9zzoKME4uL3JDD1YwMpXOHqcTUDUIGpQKndOJ04QYpZ4FTiJTXZ2kKKWeAoTD2uYpxOckDyGrd1hayYSkThZDAeSJUtFThdX4+rGA86GWSRIlP2OAiH0ZVSZcuzKhunaOBHpuwVZUl2Kb9WdF2VXRrDOoM8e6qsFXXw9c0od73IlvstymJkyp5KNuPFxVYXS1ti3f4qS6YYWkC+mechU4zI1L2LlGofVkzpp7OrrIy6+BW6P59y8UX3FM1WGz/PD0sB3Dn+nvlUAdK3Sg5w9zIBAPQaNQDARfd0rmVtttoAABqXAkYU7vElyRbKBYsQjfX4kkxVcqpJDoZAf+/orzVJf+8IB0OHMfMv6P8CfBje4mF4WypgxdZw6e41+/1nXb1sZfOjtw9jBrd/fFOOAVfHKvG13DePPQX4lKRCzj46B6lzHzidHx6XzsEKn+C9Ru2NTnPT0YavZBwe1/m7uOw3SrPVtvoujmyfku+XRcA5jZmyIF3gZjrdonvStuz0wVxPuLzO7mwbyPeMMCgoKCgoKCgoKCgoKChoTnoHyB1Sy/r/lQIAAAAASUVORK5CYII="},"eyes":{"idle":[[12,19,"#1d1210"],[13,19,"#1d1210"],[12,20,"#1d1210"],[13,20,"#1d1210"],[12,21,"#1d1210"],[13,21,"#1d1210"],[12,22,"#1d1210"],[13,22,"#1d1210"],[12,19,"#ffffff"],[26,19,"#1d1210"],[27,19,"#1d1210"],[26,20,"#1d1210"],[27,20,"#1d1210"],[26,21,"#1d1210"],[27,21,"#1d1210"],[26,22,"#1d1210"],[27,22,"#1d1210"],[26,19,"#ffffff"]],"blink":[[11,21,"#1d1210"],[12,21,"#1d1210"],[13,21,"#1d1210"],[14,21,"#1d1210"],[25,21,"#1d1210"],[26,21,"#1d1210"],[27,21,"#1d1210"],[28,21,"#1d1210"]],"laugh":[[11,21,"#1d1210"],[12,20,"#1d1210"],[13,20,"#1d1210"],[14,21,"#1d1210"],[25,21,"#1d1210"],[26,20,"#1d1210"],[27,20,"#1d1210"],[28,21,"#1d1210"]]},"mouth":{"smile":[[15,25,"#5b1f24"],[16,25,"#5b1f24"],[17,25,"#5b1f24"],[18,25,"#5b1f24"],[19,25,"#5b1f24"],[20,25,"#5b1f24"],[21,25,"#5b1f24"],[22,25,"#5b1f24"],[23,25,"#5b1f24"],[24,25,"#5b1f24"],[16,26,"#ffffff"],[17,26,"#ffffff"],[18,26,"#ffffff"],[19,26,"#ffffff"],[20,26,"#ffffff"],[21,26,"#ffffff"],[22,26,"#ffffff"],[23,26,"#ffffff"],[17,27,"#5b1f24"],[18,27,"#5b1f24"],[19,27,"#5b1f24"],[20,27,"#5b1f24"],[21,27,"#5b1f24"],[22,27,"#5b1f24"],[18,27,"#d8667a"],[19,27,"#d8667a"],[20,27,"#d8667a"],[21,27,"#d8667a"]],"laugh":[[14,25,"#5b1f24"],[15,25,"#5b1f24"],[16,25,"#5b1f24"],[17,25,"#5b1f24"],[18,25,"#5b1f24"],[19,25,"#5b1f24"],[20,25,"#5b1f24"],[21,25,"#5b1f24"],[22,25,"#5b1f24"],[23,25,"#5b1f24"],[24,25,"#5b1f24"],[25,25,"#5b1f24"],[15,26,"#ffffff"],[16,26,"#ffffff"],[17,26,"#ffffff"],[18,26,"#ffffff"],[19,26,"#ffffff"],[20,26,"#ffffff"],[21,26,"#ffffff"],[22,26,"#ffffff"],[23,26,"#ffffff"],[24,26,"#ffffff"],[15,27,"#5b1f24"],[16,27,"#5b1f24"],[17,27,"#5b1f24"],[18,27,"#5b1f24"],[19,27,"#5b1f24"],[20,27,"#5b1f24"],[21,27,"#5b1f24"],[22,27,"#5b1f24"],[23,27,"#5b1f24"],[24,27,"#5b1f24"],[16,28,"#5b1f24"],[17,28,"#5b1f24"],[18,28,"#5b1f24"],[19,28,"#5b1f24"],[20,28,"#5b1f24"],[21,28,"#5b1f24"],[22,28,"#5b1f24"],[23,28,"#5b1f24"],[17,27,"#d8667a"],[18,27,"#d8667a"],[19,27,"#d8667a"],[20,27,"#d8667a"],[21,27,"#d8667a"],[22,27,"#d8667a"],[18,28,"#d8667a"],[19,28,"#d8667a"],[20,28,"#d8667a"],[21,28,"#d8667a"]]}};
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clock = () => performance.now() / 1000;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hash = (n) => (Math.imul(n + 1, 2654435761) >>> 16) & 0xffff;
  const CW = 72, CH = 54, CX = 3, CY = 2, DESK = 44;
  const S = window.innerWidth >= 1100 ? 6 : window.innerWidth >= 600 ? 4 : 3;
  const ST = window.SpriteTheme;
  const ACC = { a: '#4fcdea', b: '#5ee1ff' };            // original accents; ST.tint() recolours them per theme
  (window.__netMasks = window.__netMasks || []).push(cv);
  cv.width = CW * S; cv.height = CH * S;
  cv.style.width = (CW * S) + 'px';
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const imgs = {}, tinted = {}; let loaded = 0, ready = false; const names = ['head', 'body'];
  const retint = () => names.forEach((n) => { if (imgs[n] && imgs[n].complete) tinted[n] = ST.tintImage(imgs[n]); });
  ST.onChange(() => { retint(); if (ready) render(); });
  names.forEach((n) => { const im = new Image(); im.onload = () => { if (++loaded === names.length) { retint(); ready = true; render(); } }; im.src = A.img[n]; imgs[n] = im; });

  let raw = false;                                   // true while GHOST is drawn (never recoloured)
  const R = (x, y, w, h, c) => { ctx.fillStyle = raw ? c : ST.tint(c); ctx.fillRect(Math.round(x) * S, Math.round(y) * S, w * S, h * S); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) P(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
  };

  const ARRIVE = { top: 'back home with GHOST!', about: 'GHOST found my story', projects: 'GHOST lives right here', skills: 'GHOST knows my stack', experience: 'GHOST dug this up', education: 'down to the quarks!', playground: 'play time, GHOST!', contact: "let's chat, GHOST!" };
  const CLICKS = ['GHOST caught that!', 'GHOST: found it!', 'ping! GHOST saw it', 'indexed!'];
  const HOVERS = ['hi! meet GHOST', "that's GHOST floating", 'say hi to GHOST', 'GHOST finds anything'];
  const GHOST_SAYS = ['this is GHOST, my local AI search', 'GHOST runs fully offline', 'Ollama + FAISS + SQLite', 'semantic search for your files'];

  const st = { t: 0, lx: 0.4, ly: 0, tx: 0.4, ty: 0, moveAt: -99, glanceAt: clock() + 3, blinkAt: 2.2, blinkT: -1, laugh: 0, hopT: 9, hopAmp: 0, dash: 0, gx: 52, gy: 8, gdx: 1, away: false };
  let raf = 0, last = 0, inView = true, bt = 0;

  function say(text, ms) {
    bubbleText.textContent = text; bubble.classList.add('show'); clearTimeout(bt);
    if (ms) bt = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  function step(dt) {
    st.t += dt;
    const nowS = clock();
    if (nowS - st.moveAt > 4 && nowS >= st.glanceAt) {
      st.tx = -0.3 + Math.random() * 1.2; st.ty = (Math.random() * 2 - 1) * 0.4;
      st.glanceAt = nowS + 1.6 + Math.random() * 2.6;
    }
    const k = 1 - Math.exp(-dt * 9);
    st.lx += (st.tx - st.lx) * k; st.ly += (st.ty - st.ly) * k;
    if (st.laugh > 0) st.laugh -= dt;
    st.hopT += dt;
    if (st.dash > 0) st.dash -= dt;
    if (st.blinkT >= 0) { st.blinkT += dt; if (st.blinkT > 0.16) st.blinkT = -1; }
    else if (st.t >= st.blinkAt && st.laugh <= 0) { st.blinkT = 0; st.blinkAt = st.t + 2.2 + Math.random() * 3.4; }
  }

  function layer(name, dx, dy) { ctx.drawImage(tinted[name] || imgs[name], (CX + dx) * S, (CY + dy) * S, A.W * S, A.H * S); }
  function dots(list, ox, oy) {
    for (let i = 0; i < list.length; i++) { const p = list[i]; P(CX + ox + p[0], CY + oy + p[1], p[2]); }
  }

  // ---------- the monitor: code scrolling on the left, a neural net firing on the right ----------
  const NODES = [[[55, 20], [55, 26]], [[60, 18], [60, 23], [60, 28]], [[65, 21], [65, 26]]];
  function screen(t) {
    R(40, 12, 29, 20, '#0b1226');
    R(41, 13, 27, 18, '#1d2a55');
    R(42, 14, 25, 16, '#060d22');
    const shift = Math.floor(t * 2.2);
    for (let i = 0; i < 7; i++) {
      const h = hash(i + shift), ind = h % 3, w = 3 + (h >> 3) % 6;
      R(43 + ind, 16 + i * 2, Math.min(w, 9 - ind), 1, [ACC.b, '#a58bff', '#6b7fb5', ACC.b][(h >> 5) % 4]);
    }
    const edge = '#1c3768';
    for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) line(NODES[0][a][0], NODES[0][a][1], NODES[1][b][0], NODES[1][b][1], edge);
    for (let b = 0; b < 3; b++) for (let c = 0; c < 2; c++) line(NODES[1][b][0], NODES[1][b][1], NODES[2][c][0], NODES[2][c][1], edge);
    const cyc = Math.floor(t / 1.3), ph = (t % 1.3) / 1.3 * 2;
    const p0 = NODES[0][hash(cyc) % 2], p1 = NODES[1][hash(cyc + 7) % 3], p2 = NODES[2][hash(cyc + 13) % 2];
    const seg = ph < 1 ? [p0, p1, ph] : [p1, p2, ph - 1];
    line(seg[0][0], seg[0][1], seg[1][0], seg[1][1], '#3f8fb8');
    NODES.forEach((col, ci) => col.forEach((n) => {
      const on = (ci === 0 && ph < 1.3 && n === p0) || (ci === 1 && ph > 0.8 && n === p1) || (ci === 2 && ph > 1.8 && n === p2);
      R(n[0] - 1, n[1] - 1, 2, 2, on ? '#ffffff' : ACC.b);
    }));
    const px = seg[0][0] + (seg[1][0] - seg[0][0]) * seg[2], py = seg[0][1] + (seg[1][1] - seg[0][1]) * seg[2];
    P(Math.round(px), Math.round(py), '#ffffff');
    // monitor stand
    R(52, 32, 4, DESK - 34, '#1d2a55'); R(48, DESK - 2, 12, 2, '#1d2a55'); R(48, DESK - 2, 12, 1, '#2c3b72');
  }

  const GH = [
    '...OOOOO...',
    '..OWWWWWO..',
    '.OWWWWWWWO.',
    '.OWKWWWKWO.',
    '.OWKWWWKWO.',
    '.OWWWWWWSO.',
    '.OPWWWWWPO.',
    '.OWWWWWWSO.',
    '.OWWWWWWSO.',
  ];
  const GB = [['.OWWWWWWSO.', '.OWOWWWOSO.', '..O.OOO.O..'], ['.OWWWWWWSO.', '.OWWOWOWSO.', '..OO.O.OO..']];
  const GC = { O: '#12203f', W: '#eaf8ff', S: '#b9dcf0', K: '#12203f', P: '#ff9fb8' };
  // shared with the project-card ghost and the contact scene (draw(ctx, scale, x, y, t, dashSeconds, dir))
  window.GhostSprite = {
    draw(c, S, x, y, t, dash, dir) {
      const rows = GH.concat(GB[Math.floor(t * 4) % 2]), flip = dir < 0;
      for (let j = 0; j < rows.length; j++) for (let i = 0; i < 11; i++) {
        const ch = rows[j][flip ? 10 - i : i]; if (ch === '.') continue;
        c.fillStyle = GC[ch]; c.fillRect((x + i) * S, (y + j) * S, S, S);
      }
      if (dash > 0) { const d = flip ? -1 : 1; for (let i = 1; i <= 3; i++) { c.globalAlpha = 0.25 / i; c.fillStyle = ST.tint(ACC.b); c.fillRect((x - i * 3 * d + (d > 0 ? 0 : 8)) * S, (y + 3) * S, 3 * S, 4 * S); } c.globalAlpha = 1; }
    }
  };
  function ghost(t) {
    raw = true;
    const rows = GH.concat(GB[Math.floor(t * 4) % 2]);
    const gx = Math.round(st.gx), gy = Math.round(st.gy + Math.sin(t * 3) * 1.2);
    
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 11; x++) {
      const c = rows[y][x]; if (c !== '.') P(gx + x, gy + y, GC[c]);
    }
    if (st.dash > 0) for (let i = 1; i <= 3; i++) { ctx.globalAlpha = 0.25 / i; R(gx - i * 3 * st.gdx + (st.gdx > 0 ? 0 : 6), gy + 3, 3, 4, ST.tint(ACC.b)); } ctx.globalAlpha = 1;
    raw = false;
  }

  function render() {
    if (!ready) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const t = st.t, laughing = st.laugh > 0;
    let hop = 0;
    if (st.hopT < 0.5) { const u = st.hopT / 0.5; hop = Math.round(st.hopAmp * 0.12 * 4 * u * (1 - u)); }
    const bob = Math.sin(t * 2.1) > 0.35 ? -1 : 0;
    const shake = laughing ? (Math.sin(t * 34) > 0 ? 1 : 0) : 0;
    const headX = Math.round(st.lx * 1.2);
    const headY = bob - hop + (laughing ? -1 : 0) + shake + Math.round(st.ly * 0.8);

    layer('body', 0, -hop);
    layer('head', headX, headY);
    const mood = laughing ? 'laugh' : (st.blinkT >= 0 ? 'blink' : 'idle');
    const ex = laughing ? 0 : Math.round(st.lx), ey = laughing ? 0 : Math.round(st.ly);
    dots(A.eyes[mood], headX + ex, headY + ey);
    dots(A.mouth[laughing ? 'laugh' : 'smile'], headX, headY);

    // desk
    R(1, DESK, 70, 1, ACC.a); R(1, DESK + 1, 70, 2, '#25356b'); R(2, DESK + 3, 68, 7, '#121a3d');
    R(2, DESK + 3, 68, 1, '#0b1129'); R(30, DESK + 5, 12, 3, '#0b1129'); R(33, DESK + 6, 6, 1, ACC.b);
    screen(t);
    // keyboard + typing hands
    R(13, DESK - 2, 16, 2, '#2c3b72'); R(13, DESK - 2, 16, 1, '#3d4f93');
    for (let i = 0; i < 7; i++) P(14 + i * 2, DESK - 2, (hash(i + Math.floor(t * 6)) % 3 === 0) ? ACC.b : '#5a6fb5');
    const typing = (Math.floor(t / 3) % 3) !== 2 || laughing;
    const up = laughing ? 3 : 0, lh = typing && Math.floor(t * 9) % 2 === 0 ? 1 : 0, rh = typing && Math.floor(t * 9 + 0.5) % 2 === 0 ? 1 : 0;
    [[14, lh], [24, rh]].forEach(([hx_, d]) => {
      const y = DESK - 4 - up + d;
      R(hx_ - 1, y - 1, 6, 4, '#12203f'); R(hx_, y, 4, 2, '#e6b48e'); R(hx_, y + 1, 4, 1, '#cf9672');
    });
    // mug with steam
    R(4, DESK - 5, 5, 5, '#12203f'); R(5, DESK - 4, 3, 3, ACC.b); R(9, DESK - 4, 1, 2, '#12203f');
    const sp = Math.floor(t * 2) % 2;
    P(6 + sp, DESK - 7, '#6b7fb5'); P(6 + (1 - sp), DESK - 9, '#4a5a8f');

    if (!st.away) ghost(t);
  }

  function ghostMove(dt) {
    const t = st.t;
    const tx = 36 + 26 * Math.sin(t * 0.55), ty = 9 + 3 * Math.sin(t * 0.9) + 2 * Math.sin(t * 1.7);
    const k = 1 - Math.exp(-dt * (st.dash > 0 ? 9 : 2.2));
    const nx = st.dash > 0 ? st.gx + st.gdx * 70 * dt : st.gx + (tx - st.gx) * k;
    st.gdx = nx > st.gx ? 1 : nx < st.gx ? -1 : st.gdx;
    st.gx = clamp(nx, 0, CW - 11);
    st.gy += (ty - st.gy) * k;
  }

  function frame(ms) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (ms - last) / 1000)); last = ms;
    step(dt); ghostMove(dt); render();
  }
  function run() { if (raf || reduce || document.hidden || !inView) return; last = performance.now(); raf = requestAnimationFrame(frame); }
  function halt() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  function react(kind, arg) {
    if (reduce) return;
    if (kind === 'arrive') {
      st.laugh = 1.3; st.hopT = 0; st.hopAmp = 24; st.dash = 0.8;
      say(ARRIVE[arg] || 'ha!', 2200);
    } else if (kind === 'click' && st.laugh <= 0) {
      st.hopT = 0; st.hopAmp = 14;
      if (Math.random() < 0.3) say(pick(CLICKS), 1300);
    }
  }
  window.vishnuSprite = {
    react,
    // while the chat is open the ghost leaves the hero and floats above the chat box
    setGhostAway(v) { st.away = !!v; if (!v) { st.dash = 0.9; st.gx = 52; } if (ready) render(); }
  };

  window.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    st.tx = clamp((e.clientX - (r.left + r.width * (22.5 / CW))) / 300, -1, 1);
    st.ty = clamp((e.clientY - (r.top + r.height * (20 / CH))) / 300, -1, 1);
    st.moveAt = clock();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { st.tx = 0.4; st.ty = 0; });
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * CW, sy = (e.clientY - r.top) / r.height * CH;
    const onGhost = !st.away && sx > st.gx - 3 && sx < st.gx + 14 && sy > st.gy - 3 && sy < st.gy + 15;
    if (onGhost) {                                   // click GHOST -> it flies off and the chat opens
      if (!reduce) st.dash = 1.1;
      setTimeout(() => { if (typeof openChat === 'function') openChat(true); }, reduce ? 0 : 280);
    } else if (!reduce) {
      st.laugh = 1.2; st.hopT = 0; st.hopAmp = 20; say('hehe!', 1500);
    }
  });
  cv.addEventListener('pointerenter', (e) => {
    if (reduce || e.pointerType === 'touch') return;
    if (!bubble.classList.contains('show')) say(pick(HOVERS), 1800);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else run(); });

  if (reduce) { say("hey, I'm Vishnu! this is GHOST", 0); }
  else {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { inView = en[0].isIntersecting; if (inView) run(); else halt(); }).observe(av);
    }
    run();
    setTimeout(() => { say("hey, I'm Vishnu!", 2800); }, 800);
    setTimeout(() => { st.dash = 0.9; say("and this is GHOST. click it to chat!", 3600); }, 3900);
  }
})();

(() => {
  'use strict';
  const GS = window.GhostSprite;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (n) => (Math.imul(n + 1, 2654435761) >>> 16) & 0xffff;
  const masks = (window.__netMasks = window.__netMasks || []);
  const scenes = [];

  /* ---------- 1. GHOST floating over its project card ---------- */
  const gcard = document.querySelector('.project[data-id="ghost"]');
  let gcv = gcard && gcard.querySelector('.ghost-float');
  if (gcard && !gcv){ gcv = document.createElement('canvas'); gcv.className = 'ghost-float'; gcv.setAttribute('aria-hidden', 'true'); gcard.prepend(gcv); }
  if (gcv && GS) {
    const g = { cv: gcv, ctx: gcv.getContext('2d'), S: 4, lw: 0, lh: 0, vis: false, px: 0 };
    masks.push(gcv);
    g.size = () => {
      g.lw = Math.max(40, Math.floor(gcard.clientWidth / g.S)); g.lh = Math.max(30, Math.floor(gcard.clientHeight / g.S));
      gcv.width = g.lw * g.S; gcv.height = g.lh * g.S; gcv.style.width = gcv.width + 'px'; gcv.style.height = gcv.height + 'px';
    };
    g.draw = (t) => {
      g.ctx.clearRect(0, 0, gcv.width, gcv.height);
      const u = 0.5 + 0.5 * Math.sin(t * 0.4), x0 = g.lw * 0.52;
      const x = Math.round(x0 + (g.lw - 14 - x0) * u), y = Math.round(3 + g.lh * 0.1 * (0.5 + 0.5 * Math.sin(t * 0.9 + 1)) + 1.5 * Math.sin(t * 2.1));
      const dir = Math.cos(t * 0.4) >= 0 ? 1 : -1;
      GS.draw(g.ctx, g.S, x, y, t, 0, dir);
    };
    g.size(); scenes.push(g);
    if ('ResizeObserver' in window) new ResizeObserver(() => { g.size(); g.draw(performance.now() / 1000); }).observe(gcard);
  }

  /* ---------- 2. Let's talk: over-the-shoulder desk scene ---------- */
  const dcv = document.getElementById('desk-scene');
  if (dcv && GS) {
    const CW = 128, CH = 78, O = 4;
    const d = { cv: dcv, ctx: dcv.getContext('2d'), S: 4, vis: false, lx: 0.5, ly: 0, tx: 0.5, ty: 0, gx: 70, gy: 4, gdx: 1, dash: 0 };
    masks.push(dcv);
    const c = d.ctx; let ox = 0;
    const R = (x, y, w, h, col) => { c.fillStyle = window.SpriteTheme.tint(col); c.fillRect(Math.round(x + ox) * d.S, Math.round(y) * d.S, w * d.S, h * d.S); };
    const P = (x, y, col) => R(x, y, 1, 1, col);
    const line = (x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) P(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), col); };
    const ell = (cx, cy, rx, ry, fill, fn) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (q <= 1) P(x, y, fn ? fn(x, y) || fill : fill);
      }
    };
    const OUT = '#0b1022';
    d.size = () => {
      const avail = (dcv.parentElement.clientWidth || 500);
      d.S = clamp(Math.floor(avail / CW), 2, 6);
      dcv.width = CW * d.S; dcv.height = CH * d.S; dcv.style.width = dcv.width + 'px';
    };
    const TREE = [[70, 15], [62, 22], [78, 22], [58, 29], [66, 29], [74, 29], [82, 29]];
    const PAR = [-1, 0, 0, 1, 1, 2, 2], ORDER = [0, 1, 3, 4, 2, 5, 6];
    const NET = [[[108, 31], [108, 38]], [[113, 29], [113, 34], [113, 40]], [[118, 32], [118, 37]]];

    d.draw = (t) => {
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, dcv.width, dcv.height);
      const beat = Math.floor(t * 3.5) % 2;
      ox = 0;
      // desk plane
      R(0, 50, CW, 28, '#0f1736'); R(0, 50, CW, 1, '#2c3b72'); R(0, 51, CW, 1, '#16204a');
      ox = O;
      // riser stand
      R(34, 43, 64, 1, '#4fcdea'); R(34, 44, 64, 2, '#25356b'); R(36, 46, 3, 4, '#1d2a55'); R(93, 46, 3, 4, '#1d2a55');
      // monitor -> laptop cable
      R(70, 46, 1, 6, '#4a5a8f'); R(70, 52, 31, 1, '#4a5a8f'); R(100, 47, 1, 6, '#4a5a8f');
      // ---- monitor
      R(46, 9, 40, 29, OUT); R(47, 10, 38, 27, '#25356b'); R(48, 11, 36, 23, '#060d22');
      R(47, 34, 38, 1, '#1d2a55'); R(64, 38, 4, 4, '#25356b'); R(58, 42, 16, 1, '#3d4f93'); P(66, 36, '#5ee1ff');
      const shift = Math.floor(t * 1.6);
      for (let i = 0; i < 6; i++) {
        const h = hash(i + shift), ind = (h % 3);
        R(50 + ind, 13 + i * 3, Math.min(2 + ((h >> 3) % 4), 6 - ind), 1, ['#5ee1ff', '#a58bff', '#6b7fb5', '#5ee1ff'][(h >> 5) % 4]);
      }
      const idx = Math.floor(t / 0.8) % 10, shown = Math.min(idx + 1, 7);
      const vis = new Set(ORDER.slice(0, shown)), cur = idx < 7 ? ORDER[idx] : -1;
      TREE.forEach((n, i) => { if (PAR[i] >= 0) line(TREE[PAR[i]][0], TREE[PAR[i]][1], n[0], n[1], vis.has(i) && vis.has(PAR[i]) ? '#3f8fb8' : '#2c4d8a'); });
      TREE.forEach((n, i) => {
        const col = i === cur ? '#ffffff' : vis.has(i) ? '#5ee1ff' : '#3d4f93';
        R(n[0] - 1, n[1] - 1, 3, 3, col);
        if (i === cur) { c.globalAlpha = 0.3; R(n[0] - 2, n[1] - 2, 5, 5, '#5ee1ff'); c.globalAlpha = 1; }
      });
      // ---- bluetooth speaker (left of the monitor, on the riser)
      R(35, 29, 11, 14, OUT); R(36, 30, 9, 12, '#25356b'); R(36, 30, 9, 2, '#3d4f93'); R(37, 33, 7, 7, '#0f1736');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P(38 + i * 2, 34 + j * 2, '#2c3b72');
      P(40, 41, beat ? '#5ee1ff' : '#2c6a80');
      if (!reduce) for (let k = 0; k < 2; k++) {
        const ph = (t * 0.7 + k * 0.5) % 1, nx = 39 + k * 5 + Math.round(Math.sin(t * 2 + k * 3) * 1.5), ny = 26 - Math.round(ph * 16);
        c.globalAlpha = 1 - ph; const col = k ? '#a58bff' : '#5ee1ff';
        R(nx, ny, 1, 3, col); R(nx + 1, ny + 2, 2, 1, col); R(nx - 1, ny + 2, 1, 1, col); c.globalAlpha = 1;
      }
      // ---- rubik's cube (right of the monitor, on the riser): blue, yellow, red faces
      R(87, 33, 11, 10, OUT);
      R(89, 34, 7, 1, '#ffd23f'); R(88, 35, 7, 1, '#ffd23f');
      R(88, 36, 6, 6, '#2d6bff'); R(94, 35, 3, 7, '#ff4d4d');
      [90, 92].forEach((x) => R(x, 36, 1, 6, '#10204a')); [38, 40].forEach((y) => R(88, y, 6, 1, '#10204a'));
      [95, 96].forEach((x) => R(x, 35, 1, 7, '#7a1f2a')); [37, 39].forEach((y) => R(94, y, 3, 1, '#7a1f2a'));
      R(89, 34, 1, 1, '#b8860b'); R(92, 34, 1, 1, '#b8860b');
      // ---- laptop on an angled stand, neural-network wallpaper
      R(103, 25, 21, 19, OUT); R(104, 26, 19, 17, '#25356b'); R(105, 27, 17, 15, '#050b1d');
      for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) line(NET[0][a][0], NET[0][a][1], NET[1][b][0], NET[1][b][1], '#1c3768');
      for (let b = 0; b < 3; b++) for (let e = 0; e < 2; e++) line(NET[1][b][0], NET[1][b][1], NET[2][e][0], NET[2][e][1], '#1c3768');
      const cyc = Math.floor(t / 1.1), ph = (t % 1.1) / 1.1 * 2;
      const p0 = NET[0][hash(cyc) % 2], p1 = NET[1][hash(cyc + 5) % 3], p2 = NET[2][hash(cyc + 9) % 2];
      const sg = ph < 1 ? [p0, p1, ph] : [p1, p2, ph - 1];
      line(sg[0][0], sg[0][1], sg[1][0], sg[1][1], '#3f8fb8');
      NET.forEach((col, ci) => col.forEach((n) => { const on = (ci === 0 && n === p0 && ph < 1.3) || (ci === 1 && n === p1 && ph > 0.8) || (ci === 2 && n === p2 && ph > 1.8); R(n[0] - 1, n[1] - 1, 2, 2, on ? '#ffffff' : '#5ee1ff'); }));
      R(103, 43, 21, 1, OUT);
      for (let i = 0; i < 4; i++) R(104 - i, 44 + i, 19, 1, i === 0 ? '#4a5a8f' : '#2c3b72');
      for (let i = 1; i < 3; i++) for (let k = 0; k < 7; k++) P(106 - i + k * 2, 44 + i, '#5a6fb5');
      R(101, 48, 19, 1, OUT); R(103, 49, 2, 3, '#4a5a8f'); R(116, 49, 2, 3, '#4a5a8f');

      // ---- open book on the desk, right next to me
      ox = 0;
      R(37, 51, 27, 10, OUT); R(38, 52, 25, 8, '#2a1f5e'); R(38, 59, 25, 1, '#a58bff');
      R(39, 52, 11, 6, '#eaf0ff'); R(51, 52, 11, 6, '#f6f8ff'); R(50, 52, 1, 6, '#8a97c9');
      for (let i = 0; i < 3; i++) { R(40, 53 + i * 2, 8 - (i % 2) * 2, 1, '#8a97c9'); if (i < 2) R(52, 53 + i * 2, 7 - i * 2, 1, '#8a97c9'); }
      R(53, 57, 6, 1, '#5ee1ff'); R(58, 59, 1, 3, '#ff4d4d');
      if (!reduce && Math.floor(t / 2.5) % 3 === 0) { R(60, 51, 2, 1, '#ffffff'); R(61, 52, 1, 1, '#d9e4ff'); }
      // ---- me, from behind, headphones on
      const hx = Math.round(d.lx * 1.2), hy = (reduce ? 0 : (Math.floor(t * 3.5) % 2 ? 1 : 0));
      const hcx = 19 + hx, hcy = 24 + hy;
      ell(19, 48, 17, 7, OUT); ell(19, 48, 16, 6, '#2c3b72', (x) => (x > 27 ? '#202c58' : x < 9 ? '#34458a' : null));
      R(16, 36, 7, 6, '#cf9672');
      ell(19, 41, 12, 5, OUT); ell(19, 41, 11, 4, '#3d4f93', (x, y) => (y > 42 ? '#34458a' : null));
      // ---- office chair seen from behind: backrest, armrests, seat, gas lift, wheeled base
      R(6, 49, 26, 18, OUT); R(7, 48, 24, 1, OUT); R(7, 50, 24, 16, '#1a2354'); R(8, 49, 22, 1, '#3d4f93'); R(8, 50, 22, 1, '#2c3b72');
      R(18, 52, 2, 13, '#0f1736'); R(10, 52, 1, 12, '#222d63'); R(27, 52, 1, 12, '#222d63'); R(8, 63, 22, 2, '#141c44'); P(19, 56, '#5ee1ff');
      R(1, 55, 6, 5, OUT); R(2, 56, 4, 2, '#4a5a8f'); R(1, 58, 3, 1, '#4a5a8f'); R(31, 55, 6, 5, OUT); R(32, 56, 4, 2, '#4a5a8f'); R(34, 58, 3, 1, '#4a5a8f');
      R(5, 67, 28, 4, OUT); R(6, 67, 26, 3, '#25356b'); R(6, 67, 26, 1, '#3d4f93');
      R(17, 71, 4, 3, '#4a5a8f'); R(16, 71, 1, 3, OUT); R(21, 71, 1, 3, OUT);
      line(19, 74, 8, 75, '#4a5a8f'); line(19, 74, 30, 75, '#4a5a8f'); R(6, 75, 4, 1, OUT); R(28, 75, 4, 1, OUT); R(17, 75, 4, 1, OUT);
      ell(hcx, hcy, 13.5, 13, OUT);
      ell(hcx, hcy, 12.5, 12, '#2a1b16', (x, y) => (hash(x * 31 + y * 17) % 9 === 0 ? '#4d382e' : hash(x * 7 + y * 13) % 23 === 0 ? '#3a281f' : null));
      [[0, -6], [1, -6], [-1, -5], [2, -5], [0, -4], [1, -5]].forEach(([x, y]) => P(hcx + x, hcy + y, '#4d382e'));
      for (let y = 8; y <= 27 + hy; y++) for (let x = 0; x < CW; x++) {
        const q = Math.hypot(x + 0.5 - hcx, y + 0.5 - hcy);
        if (q >= 12.4 && q <= 15.4 && y <= 26 + hy) P(x, y, q >= 13.2 && q <= 14.6 ? '#4a8fd0' : OUT);
      }
      R(hcx - 16, hcy - 3, 6, 11, OUT); R(hcx - 15, hcy - 2, 4, 9, '#5ee1ff'); R(hcx - 14, hcy, 2, 5, '#2c6a80');
      R(hcx + 11, hcy - 3, 6, 11, OUT); R(hcx + 12, hcy - 2, 4, 9, '#5ee1ff'); R(hcx + 13, hcy, 2, 5, '#2c6a80');
      // GHOST
      GS.draw(c, d.S, Math.round(d.gx), Math.round(d.gy + Math.sin(t * 3) * 1.2), t, d.dash, d.gdx);
    };

    d.step = (dt, t) => {
      const k = 1 - Math.exp(-dt * 6); d.lx += (d.tx - d.lx) * k;
      if (d.dash > 0) d.dash -= dt;
      const tx = 64 + 54 * Math.sin(t * 0.38), ty = 5 + 4 * Math.sin(t * 0.9) + 2 * Math.sin(t * 1.7);
      const kk = 1 - Math.exp(-dt * 2.2), nx = d.gx + (tx - d.gx) * kk;
      d.gdx = nx > d.gx ? 1 : nx < d.gx ? -1 : d.gdx; d.gx = clamp(nx, 0, CW - 11); d.gy += (ty - d.gy) * kk;
    };
    d.size(); scenes.push(d);
    window.SpriteTheme.onChange(() => { if (d.size) d.draw(performance.now() / 1000); });
    window.addEventListener('pointermove', (e) => {
      const r = dcv.getBoundingClientRect(); if (!r.width) return;
      d.tx = clamp((e.clientX - (r.left + r.width * 0.15)) / 400, -1, 1);
    }, { passive: true });
    dcv.addEventListener('click', () => { d.dash = 1; });
    let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { d.size(); d.draw(performance.now() / 1000); }, 150); });
  }

  /* ---------- shared loop, runs only while a scene is on screen ---------- */
  let raf = 0, last = 0, T = 0;
  const anyVisible = () => scenes.some((s) => s.vis);
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (ms - last) / 1000)); last = ms; T += dt;
    for (const s of scenes) if (s.vis) { if (s.step) s.step(dt, T); s.draw(T); }
  }
  function run() { if (raf || reduce || document.hidden || !anyVisible()) return; last = performance.now(); raf = requestAnimationFrame(frame); }
  function halt() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  scenes.forEach((s) => {
    s.vis = reduce;
    if (reduce) { s.draw(0); return; }
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => { s.vis = en[0].isIntersecting; if (s.vis) { s.draw(T); run(); } else if (!anyVisible()) halt(); }).observe(s.cv);
    else { s.vis = true; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else run(); });
  run();
})();



// ==========================================================
// CHAT GHOST — when the chat opens, GHOST leaves the hero, grows and floats
// above the chat box, as if it is the one answering.
// ==========================================================
(() => {
  'use strict';
  const GS = window.GhostSprite, chat = document.getElementById('chat');
  if (!GS || !chat) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = 7, W = 15, H = 18;
  const cv = document.createElement('canvas');
  cv.id = 'chatGhost'; cv.width = W * S; cv.height = H * S; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  let raf = 0, open = false;
  function place() {
    const cs = getComputedStyle(chat);
    const w = parseFloat(cs.width), h = parseFloat(cs.height), r = parseFloat(cs.right), b = parseFloat(cs.bottom);
    cv.style.top = Math.max(6, innerHeight - b - h - cv.height + 14) + 'px';
    cv.style.left = (innerWidth - r - w / 2 - cv.width / 2) + 'px';
  }
  function draw(t) {
    const talking = document.body.classList.contains('speaking');
    c.clearRect(0, 0, cv.width, cv.height);
    GS.draw(c, S, 2, Math.round(3 + Math.sin(t * (talking ? 5 : 2.2)) * (talking ? 1.8 : 1.3)), t, 0, 1);
  }
  function loop(ms) { raf = requestAnimationFrame(loop); draw(ms / 1000); }
  function sync() {
    const now = chat.classList.contains('open');
    if (now === open) return; open = now;
    if (window.vishnuSprite) window.vishnuSprite.setGhostAway(open);
    if (open) { place(); draw(performance.now() / 1000); cv.classList.add('show'); if (!reduce && !raf) raf = requestAnimationFrame(loop); }
    else { cv.classList.remove('show'); cancelAnimationFrame(raf); raf = 0; }
  }
  new MutationObserver(sync).observe(chat, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', () => { if (open) place(); });
})();
