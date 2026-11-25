// CHANGE SUMMARY (2026-11-25, 5): performance. Draws at half rate while the page is idle (FX.idle).
// ==========================================================
// NETWORK — the layered neural network behind the whole page.
// The nav links are its input neurons: clicking one fires a
// signal that travels down through the layers while the page
// scrolls to that section. Click anywhere to send a signal,
// hover to light nodes, and the current section's layer glows.
// (Ported from Vishnu's original portfolio.)
// ==========================================================
(() => {
  'use strict';
  /* ================= Tunables ================= */
  const CFG = {
    layerGap: 240,          // px between layers (desktop)
    layerGapMobile: 200,
    colTarget: 280,         // desired px per column
    colsMin: 4,
    colsMax: 7,
    jitterX: 0.2,          // fraction of column step
    jitterY: 12,            // px
    nodeR: 3,
    edgeAlpha: 0.075,
    ambient: { min: 4, max: 7, count: 2, speed: 230, hops: 6, tail: 130, power: 0.75 },
    click:   { speed: 1500, tail: 260, forkChance: 0.14, maxForks: 4 },  // forkChance 0 = single straight signal
    nav:     { base: 0.85, perPx: 1 / 3500, extraMax: 0.65, tail: 210 }, // seconds
    pulse:   { min: 5, max: 10 },                                        // idle pulse period, seconds
    hoverRadius: 130
  };

  /* ================= Setup ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const canvas = $('#net');
  const ctx = canvas.getContext('2d');
  const reduce = (typeof window.reduce !== 'undefined') ? window.reduce : (typeof FX !== 'undefined' ? false : matchMedia('(prefers-reduced-motion: reduce)').matches);
  const css = getComputedStyle(document.documentElement);
  const hex = (h) => { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const CYAN = hex(css.getPropertyValue('--cyan') || '#5ee1ff');
  const VIOLET = hex(css.getPropertyValue('--violet') || '#8b7cff');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rand = (a, b) => a + Math.random() * (b - a);
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';

  function makeGlow(c) {
    const g = document.createElement('canvas');
    g.width = g.height = 64;
    const x = g.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(c, 1));
    gr.addColorStop(0.35, rgba(c, 0.35));
    gr.addColorStop(1, rgba(c, 0));
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    return g;
  }
  const GLOW = [makeGlow(CYAN), makeGlow(VIOLET)];

  /* ================= State ================= */
  let W = 0, H = 0, DPR = 1, pageH = 0, gap = 170, navH = 64;
  let layers = [], nodes = [];
  let navPts = {};
  let secTops = [];
  let signals = [];
  let ripples = [];
  let navAnim = null;
  let scrollY = 0;
  let introT = 0;
  let spawnIn = 0.9;
  let activeId = '';
  let activeRange = null;
  let spotEl = null, spotTimer = 0, quietUntil = 0;
  let hintHidden = false;
  const mouse = { x: -999, y: -999 };

  /* ================= Network ================= */
  function build() {
    const rng = mulberry32(20261014);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    measure();
    pageH = Math.max(document.documentElement.scrollHeight, H);
    gap = W < 700 ? CFG.layerGapMobile : CFG.layerGap;
    const cols = W < 560 ? 3 : clamp(Math.round(W / CFG.colTarget), CFG.colsMin, CFG.colsMax);
    const margin = Math.max(18, W * 0.03);
    const step = (W - 2 * margin) / (cols - 1);
    const count = Math.max(3, Math.floor((pageH - gap) / gap) + 1);

    layers = [];
    nodes = [];
    for (let k = 0; k < count; k++) {
      const row = [];
      const y0 = gap * 0.6 + k * gap;
      for (let c = 0; c < cols; c++) {
        const n = {
          id: nodes.length, layer: k, col: c,
          x: margin + c * step + (rng() - 0.5) * 2 * step * CFG.jitterX,
          y: y0 + (rng() - 0.5) * 2 * CFG.jitterY,
          phase: rng() * Math.PI * 2,
          period: CFG.pulse.min + rng() * (CFG.pulse.max - CFG.pulse.min),
          tone: rng() < 0.35 ? 1 : 0,
          energy: 0, hover: 0, appear: 0, lit: 0,
          out: [], inn: []
        };
        row.push(n);
        nodes.push(n);
      }
      layers.push(row);
    }
    const link = (a, b) => {
      if (a.out.some((e) => e.to === b)) return;
      const e = { from: a, to: b, glow: 0 };
      a.out.push(e);
      b.inn.push(e);
    };
    for (let k = 0; k < count - 1; k++) {
      const next = layers[k + 1];
      for (const n of layers[k]) {
        const sorted = next.slice().sort((p, q) => Math.abs(p.x - n.x) - Math.abs(q.x - n.x));
        link(n, sorted[0]);
        link(n, sorted[1]);
        if (rng() < 0.2) link(n, sorted[2]);
      }
      for (const m of next) {
        if (!m.inn.length) {
          let best = layers[k][0];
          for (const n of layers[k]) if (Math.abs(n.x - m.x) < Math.abs(best.x - m.x)) best = n;
          link(best, m);
        }
      }
    }
    signals = [];
    navAnim = null;
    if (reduce) { introT = 99; drawFrame(0); }
  }

  function measure() {
    navPts = {};
    navH = $('#nav').getBoundingClientRect().height;
    $$('#nav [data-go]').forEach((a) => {
      const d = $('.nd', a) || $('.mono', a) || a;
      const r = d.getBoundingClientRect();
      if (r.width < 1) return;                               // hidden (mobile menu closed)
      navPts[a.dataset.go] = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    secTops = $$('#top, main > section').map((el) => ({ id: el.id, el, top: el.getBoundingClientRect().top + window.scrollY }));
  }

  const layerAtY = (y) => clamp(Math.round((y - gap * 0.6) / gap), 0, layers.length - 1);
  const firstLayerBelow = (y) => clamp(Math.ceil((y - gap * 0.6) / gap), 0, layers.length - 1);
  const lastLayerAbove = (y) => clamp(Math.floor((y - gap * 0.6) / gap), 0, layers.length - 1);

  function nearest(row, x, take) {
    const s = row.slice().sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
    return s[Math.floor(Math.random() * Math.min(take, s.length))];
  }
  function routeDown(start, targetLayer, targetX, jitter) {
    const path = [start];
    let cur = start;
    while (cur.layer < targetLayer && cur.out.length) {
      let best = null, bs = Infinity;
      for (const e of cur.out) {
        const s = Math.abs(e.to.x - targetX) + Math.random() * jitter;
        if (s < bs) { bs = s; best = e.to; }
      }
      path.push(best);
      cur = best;
    }
    return path;
  }
  function routeUp(start, targetLayer, targetX, jitter) {
    const path = [start];
    let cur = start;
    while (cur.layer > targetLayer && cur.inn.length) {
      let best = null, bs = Infinity;
      for (const e of cur.inn) {
        const s = Math.abs(e.from.x - targetX) + Math.random() * jitter;
        if (s < bs) { bs = s; best = e.from; }
      }
      path.push(best);
      cur = best;
    }
    return path;
  }
  const edgeBetween = (a, b) => a.out.find((e) => e.to === b) || b.out.find((e) => e.to === a) || null;

  /* ================= Signals ================= */
  function makeSignal(pts, o) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return Object.assign({ pts, cum, len: cum[cum.length - 1], d: 0, hit: -1, forks: [], driven: false, kind: 'ambient', power: 1, speed: 200, tail: 150 }, o);
  }
  function pointAt(s, dist) {
    if (dist <= 0) return s.pts[0];
    if (dist >= s.len) return s.pts[s.pts.length - 1];
    let lo = 0, hi = s.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s.cum[m] <= dist) lo = m; else hi = m; }
    const seg = s.cum[hi] - s.cum[lo] || 1;
    const f = (dist - s.cum[lo]) / seg;
    const a = s.pts[lo], b = s.pts[hi];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  const toPts = (path) => path.map((n) => ({ x: n.x, y: n.y, node: n }));

  function spawnAmbient() {
    if (!layers.length) return;
    const kmin = firstLayerBelow(scrollY + navH + 40);
    const kmax = Math.max(kmin, layerAtY(scrollY + H * 0.55));
    const k = kmin + Math.floor(Math.random() * (kmax - kmin + 1));
    const start = layers[k][Math.floor(Math.random() * layers[k].length)];
    const path = routeDown(start, Math.min(layers.length - 1, k + CFG.ambient.hops), Math.random() * W, 320);
    if (path.length < 3) return;
    signals.push(makeSignal(toPts(path), { kind: 'ambient', power: CFG.ambient.power, speed: CFG.ambient.speed, tail: CFG.ambient.tail }));
  }

  function fireClick(clientX, clientY) {
    if (!layers.length) return;
    ripples.push({ x: clientX, y: clientY, t0: performance.now() });
    const k = firstLayerBelow(scrollY + navH + 24);
    const start = nearest(layers[k], clientX, 2);
    const end = layers.length - 1;
    const path = routeDown(start, end, clientX, 420);
    const s = makeSignal(toPts(path), { kind: 'click', power: 1, speed: CFG.click.speed, tail: CFG.click.tail });
    let forks = 0;
    for (let i = 1; i < path.length - 3 && forks < CFG.click.maxForks; i++) {
      if (Math.random() < CFG.click.forkChance) {
        const sub = routeDown(path[i], Math.min(end, path[i].layer + 3 + Math.floor(Math.random() * 6)), Math.random() * W, 300);
        if (sub.length > 2) { s.forks.push({ at: i, pts: toPts(sub), fired: false }); forks++; }
      }
    }
    signals.push(s);
  }

  /* ================= Navigation ================= */
  function clearSpot() {
    clearTimeout(spotTimer);
    if (spotEl) spotEl.classList.remove('spot');
    document.body.classList.remove('spotting');
    spotEl = null;
  }
  function go(id, from) {
    cancelNav();
    clearSpot();
    const el = id === 'top' ? document.getElementById('top') : document.getElementById(id);
    if (!el) return;
    const maxS = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const top = id === 'top' ? 0 : el.getBoundingClientRect().top + window.scrollY - navH;
    const sT = clamp(Math.round(top), 0, maxS);

    if (reduce || !layers.length) {
      window.scrollTo(0, sT);
      arrive(id, null);
      return;
    }
    let p0 = navPts[id] || { x: W / 2, y: 32 };
    if (from && !from.closest('#nav')) { const d = $('.nd', from) || from, r = d.getBoundingClientRect(); if (r.width) p0 = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    const s0 = window.scrollY;
    const y0 = s0 + p0.y;
    const goingDown = sT >= s0;
    const containerLeft = Math.max(40, (W - 1120) / 2 + 60);
    let path;
    if (goingDown) {
      const L0 = firstLayerBelow(s0 + navH + 8);
      const first = nearest(layers[L0], p0.x, 2);
      const tl = Math.max(layerAtY(sT + H * 0.4), Math.min(L0 + 1, layers.length - 1));
      path = routeDown(first, tl, containerLeft, 50);
    } else {
      const L0 = lastLayerAbove(y0 - 20);
      const first = nearest(layers[L0], p0.x, 2);
      const tl = Math.min(layerAtY(sT + H * 0.4), Math.max(L0 - 1, 0));
      path = routeUp(first, tl, containerLeft, 50);
    }
    const pts = [{ x: p0.x, y: y0, node: null }].concat(toPts(path));
    const sig = makeSignal(pts, { kind: 'nav', power: 1, speed: 700, tail: CFG.nav.tail, driven: true });
    signals.push(sig);
    const dur = (CFG.nav.base + Math.min(Math.abs(sT - s0) * CFG.nav.perPx, CFG.nav.extraMax)) * 1000;
    navAnim = { s0, sT, t0: performance.now(), dur, sig, id, landing: path[path.length - 1] };
  }
  function cancelNav() {
    if (navAnim) { navAnim.sig.driven = false; navAnim = null; }
  }
  function arrive(id, landing) {
    if (landing) landing.energy = 1;
    quietUntil = performance.now() + 700;
    if (window.vishnuSprite) window.vishnuSprite.react('arrive', id);
    const sec = document.getElementById(id);
    if (sec) {
      clearSpot();
      spotEl = sec;
      sec.classList.add('arrived', 'spot');
      document.body.classList.add('spotting');
      spotTimer = setTimeout(clearSpot, 2800);
      setTimeout(() => sec.classList.remove('arrived'), 900);
      try { sec.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    try { history.replaceState(null, '', id === 'top' ? window.location.pathname + window.location.search : '#' + id); } catch (e) { /* ignore */ }
  }

  /* ================= Update ================= */
  function update(dt, now) {
    introT += dt;
    const decayN = Math.exp(-dt / 0.9), decayE = Math.exp(-dt / 0.8);
    const litStep = Math.min(1, dt * 2.5);
    for (const n of nodes) {
      n.energy = n.energy < 0.003 ? 0 : n.energy * decayN;
      for (const e of n.out) e.glow = e.glow < 0.003 ? 0 : e.glow * decayE;
      if (activeRange) {
        const target = n.y >= activeRange.top && n.y < activeRange.bottom ? 1 : 0;
        n.lit += (target - n.lit) * litStep;
      }
    }

    spawnIn -= dt;
    if (spawnIn <= 0) {
      if (signals.filter((s) => s.kind === 'ambient').length < CFG.ambient.count) spawnAmbient();
      spawnIn = rand(CFG.ambient.min, CFG.ambient.max);
    }

    if (navAnim) {
      const a = navAnim;
      const p = Math.min(1, (now - a.t0) / a.dur);
      const e = easeInOutCubic(p);
      window.scrollTo(0, a.s0 + (a.sT - a.s0) * e);
      a.sig.d = e * a.sig.len;
      if (p >= 1) {
        a.sig.driven = false;
        arrive(a.id, a.landing);
        navAnim = null;
      }
    }
    scrollY = window.scrollY;

    const n0 = signals.length;
    for (let i = 0; i < n0; i++) {
      const s = signals[i];
      if (!s.driven) s.d += s.speed * dt;
      while (s.hit + 1 < s.pts.length && s.cum[s.hit + 1] <= s.d) {
        s.hit++;
        const node = s.pts[s.hit].node;
        if (node) {
          node.energy = Math.max(node.energy, s.power);
          const prev = s.hit > 0 ? s.pts[s.hit - 1].node : null;
          if (prev) { const e = edgeBetween(prev, node); if (e) e.glow = Math.max(e.glow, s.power); }
        }
        for (const f of s.forks) {
          if (!f.fired && f.at === s.hit) {
            f.fired = true;
            signals.push(makeSignal(f.pts, { kind: 'fork', power: s.power * 0.75, speed: s.speed, tail: s.tail * 0.8 }));
          }
        }
      }
    }
    signals = signals.filter((s) => !(s.d > s.len + s.tail + 40 && !s.driven));

    // hover glow
    const my = mouse.y + scrollY;
    for (const n of nodes) {
      if (n.y < scrollY - 60 || n.y > scrollY + H + 60) continue;
      const t = Math.max(0, 1 - Math.hypot(n.x - mouse.x, n.y - my) / CFG.hoverRadius);
      n.hover += (t - n.hover) * Math.min(1, dt * 8);
    }
  }

  // A short light-up at the top of a section when you scroll into it
  function pingSection(s) {
    if (!layers.length) return;
    const k = firstLayerBelow(s.top - 4);
    for (let j = 0; j < 2 && k + j < layers.length; j++) {
      for (const n of layers[k + j]) n.energy = Math.max(n.energy, 0.7 - j * 0.25);
    }
  }

  function updateActive() {
    if (!secTops.length) return;
    let idx = 0;
    const y = scrollY + H * 0.4;
    secTops.forEach((s, i) => { if (s.top <= y) idx = i; });
    if (scrollY + H >= pageH - 4) idx = secTops.length - 1;
    const sec = secTops[idx];
    activeRange = { top: sec.top, bottom: idx + 1 < secTops.length ? secTops[idx + 1].top : pageH };
    if (sec.id !== activeId) {
      const firstTime = activeId === '';
      activeId = sec.id;
      $$('#links a[data-go]').forEach((a) => a.classList.toggle('on', a.dataset.go === sec.id));
      if (!firstTime && !reduce && !navAnim && performance.now() > quietUntil) pingSection(sec);
    }
    if (reduce) for (const n of nodes) n.lit = n.y >= activeRange.top && n.y < activeRange.bottom ? 1 : 0;
  }

  /* ================= Draw ================= */
  // Soft masks: elements the network should look like it runs BEHIND (the RAG cards).
  // The canvas sits above the page, so over these boxes we erase most of it: the
  // network still shows through faintly, like glass, and the text stays clean.
  const SOFT = '#game-rag .rag-card, #game-attention .rag-card, #game-ghost .rag-card', SOFT_ALPHA = 0.82;
  function applyMasks() {
    const list = window.__netMasks, soft = document.querySelectorAll(SOFT);
    if ((!list || !list.length) && !soft.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.imageSmoothingEnabled = false;
    if (list) for (const m of list) { const r = m.getBoundingClientRect(); if (r.width < 1 || r.bottom < 0 || r.top > H) continue; ctx.drawImage(m, r.left, r.top, r.width, r.height); }
    ctx.fillStyle = 'rgba(0,0,0,' + SOFT_ALPHA + ')';
    for (const el of soft) {
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.bottom < 0 || r.top > H) continue;
      const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(r.left, r.top, r.width, r.height, rad) : ctx.rect(r.left, r.top, r.width, r.height); ctx.fill();
    }
    ctx.restore();
  }
  function drawFrame(t) { drawFrameRaw(t); applyMasks(); }
  function drawFrameRaw(t) {
    ctx.clearRect(0, 0, W, H);
    if (!layers.length) return;
    scrollY = window.scrollY;
    const kmin = clamp(Math.floor((scrollY - gap * 0.6) / gap) - 1, 0, layers.length - 1);
    const kmax = clamp(Math.ceil((scrollY + H - gap * 0.6) / gap) + 1, 0, layers.length - 1);

    for (let k = kmin; k <= kmax; k++) for (const n of layers[k]) n.appear = reduce ? 1 : clamp((introT - n.layer * 0.07) / 0.5, 0, 1);

    ctx.lineCap = 'round';
    ctx.lineWidth = 1;

    // idle edges (batched), then glowing edges
    ctx.strokeStyle = 'rgba(130,150,255,' + CFG.edgeAlpha + ')';
    ctx.beginPath();
    const lit = [];
    for (let k = kmin; k <= kmax; k++) {
      for (const n of layers[k]) {
        for (const e of n.out) {
          if (e.glow > 0.01 || e.to.appear < 1 || n.appear < 1 || (n.lit > 0.05 && e.to.lit > 0.05)) { lit.push(e); continue; }
          ctx.moveTo(n.x, n.y - scrollY);
          ctx.lineTo(e.to.x, e.to.y - scrollY);
        }
      }
    }
    ctx.stroke();
    for (const e of lit) {
      const ap = Math.min(e.from.appear, e.to.appear);
      const a = CFG.edgeAlpha * ap + e.glow * 0.5 + Math.min(e.from.lit, e.to.lit) * 0.07;
      if (a < 0.004) continue;
      ctx.strokeStyle = rgba(e.from.tone ? VIOLET : CYAN, Math.min(0.9, a));
      ctx.lineWidth = 1 + e.glow * 0.8;
      ctx.beginPath();
      ctx.moveTo(e.from.x, e.from.y - scrollY);
      ctx.lineTo(e.to.x, e.to.y - scrollY);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    drawInputEdges();

    // nodes
    for (let k = kmin; k <= kmax; k++) {
      for (const n of layers[k]) {
        if (n.appear <= 0) continue;
        const sy = n.y - scrollY;
        const pulse = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / n.period + n.phase);
        const boost = Math.min(1, n.energy + n.hover * 0.6 + n.lit * 0.28);
        const col = n.tone ? VIOLET : CYAN;
        if (boost > 0.04) {
          const gr = 10 + boost * 24;
          ctx.globalAlpha = Math.min(1, boost) * n.appear;
          ctx.drawImage(GLOW[n.tone], n.x - gr, sy - gr, gr * 2, gr * 2);
          ctx.globalAlpha = 1;
        }
        const r = (CFG.nodeR + n.energy * 3 + n.hover * 1.4) * (0.6 + 0.4 * n.appear);
        ctx.fillStyle = rgba(col, Math.min(1, (0.3 + 0.18 * pulse + n.energy + n.hover * 0.5 + n.lit * 0.22) * n.appear));
        ctx.beginPath();
        ctx.arc(n.x, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // signals
    ctx.globalCompositeOperation = 'lighter';
    for (const s of signals) drawSignal(s);
    ctx.globalCompositeOperation = 'source-over';

    // ripples
    const nowMs = performance.now();
    ripples = ripples.filter((r) => nowMs - r.t0 < 700);
    for (const r of ripples) {
      const p = (nowMs - r.t0) / 700;
      ctx.strokeStyle = rgba(CYAN, 0.5 * (1 - p));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + p * 52, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawInputEdges() {
    const baseY = scrollY + navH + 8;
    const L = firstLayerBelow(baseY);
    for (const id in navPts) {
      if (id === 'top') continue;
      const p = navPts[id];
      for (let off = 0; off < 2; off++) {
        const k = L + off;
        if (k >= layers.length) break;
        const row = layers[k];
        const dy = row[0].y - scrollY - p.y;
        const w = smooth(dy, 24, 90) * (1 - smooth(dy, gap * 0.9, gap * 1.6));
        if (w <= 0.01) continue;
        let a = null, b = null;
        for (const n of row) {
          if (!a || Math.abs(n.x - p.x) < Math.abs(a.x - p.x)) { b = a; a = n; }
          else if (!b || Math.abs(n.x - p.x) < Math.abs(b.x - p.x)) b = n;
        }
        ctx.strokeStyle = rgba(CYAN, 0.2 * w);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const n of [a, b]) { if (!n) continue; ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y - scrollY); }
        ctx.stroke();
      }
    }
  }

  function drawSignal(s) {
    const headD = Math.min(s.d, s.len);
    const out = s.d > s.len ? clamp(1 - (s.d - s.len) / (s.tail * 0.6), 0, 1) : 1;
    const N = 16;
    const step = s.tail / N;
    let prev = pointAt(s, headD);
    for (let k = 1; k <= N; k++) {
      const dist = s.d - k * step;
      if (dist < 0) break;
      const cur = pointAt(s, Math.min(dist, s.len));
      const f = k / N;
      const a = Math.pow(1 - f, 1.5) * 0.85 * s.power;
      ctx.strokeStyle = rgba([lerp(CYAN[0], VIOLET[0], f), lerp(CYAN[1], VIOLET[1], f), lerp(CYAN[2], VIOLET[2], f)], a);
      ctx.lineWidth = 0.6 + 2.4 * (1 - f);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y - scrollY);
      ctx.lineTo(cur.x, cur.y - scrollY);
      ctx.stroke();
      prev = cur;
    }
    if (out > 0) {
      const h = pointAt(s, headD);
      const hy = h.y - scrollY;
      const gr = 15 * (0.7 + 0.3 * s.power);
      ctx.globalAlpha = out * s.power;
      ctx.drawImage(GLOW[0], h.x - gr, hy - gr, gr * 2, gr * 2);
      ctx.fillStyle = 'rgba(235,250,255,0.95)';
      ctx.beginPath();
      ctx.arc(h.x, hy, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /* ================= Loop ================= */
  let last = 0, raf = 0;
  let idleTick = 0;
  function frame(nowMs) {
    if (typeof FX !== 'undefined' && FX.idle && (idleTick++ & 1)) { raf = requestAnimationFrame(frame); return; }   // idle: half rate
    const t = nowMs / 1000;
    const dt = Math.min(0.05, Math.max(0, t - last));
    last = t;
    update(dt, nowMs);
    drawFrame(t);
    updateActive();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (reduce || raf) return;
    last = performance.now() / 1000;
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  /* ================= Events ================= */
  let rebuildTimer = 0;
  // Full rebuild only when the width or page height really changed; a phone address bar resizing only needs a canvas resize.
  const refresh = () => {
    const needFull = window.innerWidth !== W || Math.abs(document.documentElement.scrollHeight - pageH) > 6;
    if (needFull) { build(); return; }
    H = window.innerHeight;
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    measure();
  };
  const scheduleBuild = () => { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(refresh, 140); };
  window.addEventListener('resize', scheduleBuild);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleBuild).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleBuild);

  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerleave', () => { mouse.x = -999; mouse.y = -999; });
  ['wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, cancelNav, { passive: true }));
  window.addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) cancelNav(); });
  if (reduce) window.addEventListener('scroll', () => requestAnimationFrame(() => { drawFrame(0); updateActive(); }), { passive: true });

  $$('[data-go]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
      e.preventDefault();
      $('#links') && $('#links').classList.remove('open');
      go(a.dataset.go, a);
    });
  });

  window.addEventListener('click', (e) => {
    if (reduce) return;
    if (e.target.closest && e.target.closest('a, button, input, textarea, select, label, #nav, .chat, .chat-fab, .modal, .terminal, .play-stage, .project, #toon, #desk-scene, .avatar-wrap, .dots-nav')) return;
    const sel = window.getSelection && window.getSelection().toString();
    if (sel) return;
    fireClick(e.clientX, e.clientY);
    if (window.vishnuSprite) window.vishnuSprite.react('click');
    if (!hintHidden) { hintHidden = true; const h = $('#hint'); if (h) h.classList.add('gone'); }
  });


  // random breathing rhythm for the nav neurons
  $$('#nav .nd').forEach((d) => { d.style.setProperty('--d', rand(5, 9).toFixed(2) + 's'); d.style.setProperty('--dl', (-rand(0, 8)).toFixed(2) + 's'); });

  /* ================= Go ================= */
  build();
  updateActive();
  start();
  window.NetNav = { go };
})();
