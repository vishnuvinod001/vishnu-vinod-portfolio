// ==========================================================
// CARDS — live AI visuals behind the project cards, and the
// LeetCode stats card.
//   vector  : GHOST — points in an embedding space; a query lands
//             and its nearest neighbours light up (vector search)
//   segment : research — a generated "image" split into masks;
//             one region at a time is picked out (SAM + CLIP)
//   neat    : Flappy Bird — a small population learns to fly by
//             neuroevolution, generation by generation
//   parse   : Resume Bank — a PDF's lines stream into JSON fields
//   route   : ticketing — emails get routed to departments
//   approval: PTC Weaver — a dormant system wakes up; requests pass
//             review → approval → purchase (some are sent back)
//   attendance: HR — biometric punches fill an attendance grid and
//             a shift-change request slides to its new slot, approved
//   migrate : pathology — records stream from SQL Server through a
//             validate gate (bad ones get cleaned) into a Frappe table
// Canvases render at low resolution and are scaled up by CSS,
// so they look soft (no costly CSS blur) and stay cheap.
// ==========================================================
(() => {
  'use strict';
  const RES = 3;                                             // 1 canvas pixel = 3 css pixels
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hex = (h) => { h = String(h).trim().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
  let C1 = [94, 225, 255], C2 = [139, 124, 255];
  const readTheme = () => { try { C1 = hex(cssVar('--c1')); C2 = hex(cssVar('--c3')); } catch (e) {} };
  readTheme(); document.addEventListener('themechange', readTheme);
  const still = typeof reduce !== 'undefined' && reduce;

  // shared plumbing: size to the card, run only while on screen
  function mount(card, api){
    const cv = card.querySelector('.p-viz'); if (!cv) return;
    const c = cv.getContext('2d');
    let w = 1, h = 1, raf = 0, last = 0, inView = false;
    function resize(){
      const res = api.res || RES;
      w = Math.max(1, Math.round(card.clientWidth / res)); h = Math.max(1, Math.round(card.clientHeight / res));
      cv.width = w; cv.height = h; api.resize && api.resize(w, h); api.draw(c, w, h);
    }
    function frame(t){
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return;                             // ~30fps is plenty for a background
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      api.update(dt); api.draw(c, w, h);
    }
    const run = () => { if (raf || !inView || document.hidden || still) return; last = performance.now(); raf = requestAnimationFrame(frame); };
    const halt = () => { if (raf){ cancelAnimationFrame(raf); raf = 0; } };
    resize();
    if (still){ api.update(1.4); api.update(.6); api.draw(c, w, h); }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(card);
    if ('IntersectionObserver' in window) new IntersectionObserver(en => { inView = en[0].isIntersecting; if (inView){ resize(); run(); } else halt(); }).observe(card);   // re-measure on entry: fonts/layout may have shifted
    else { inView = true; run(); }
    document.addEventListener('visibilitychange', () => { document.hidden ? halt() : run(); });
  }

  // empty band between the summary paragraph and the pipeline, as fractions of the card height
  const bandOf = card => {
    // the summary <p> is stretched by flexbox, so measure where its TEXT ends, not its box
    // (rects are in screen space; dividing by the card's rect height also cancels its 3D tilt/scale)
    const cr = card.getBoundingClientRect(), H = cr.height || 1, p = card.querySelector(':scope > p'), pi = card.querySelector('.pipe');
    let a = .37, b = .6;
    if (p){ const rg = document.createRange(); rg.selectNodeContents(p); const rects = rg.getClientRects(); if (rects.length) a = (rects[rects.length - 1].bottom - cr.top) / H + .03; }
    if (pi) b = (pi.getBoundingClientRect().top - cr.top) / H - .035;
    if (b - a < .1){ const m = (a + b) / 2; a = m - .05; b = m + .05; }
    return [a, b];
  };

  const VIZ = {
    // ---------- GHOST: vector search ----------
    vector(){
      const rng = mulberry32(77), centers = [[.1, .3], [.28, .72], [.48, .28], [.66, .72], [.86, .32], [.46, .56]], pts = [];
      centers.forEach((ctr, ci) => { for (let i = 0; i < 14; i++) pts.push({ bx: ctr[0] + (rng() - .5) * .13, by: ctr[1] + (rng() - .5) * .24, r: .008 + rng() * .03, a: rng() * 6.28, om: (.15 + rng() * .35) * (rng() < .5 ? -1 : 1), tone: ci % 2 }); });
      let W = 1, H = 1, timer = .6, queries = [];
      const pos = p => [(p.bx + Math.cos(p.a) * p.r) * W, (p.by + Math.sin(p.a) * p.r * 1.2) * H];
      return {
        resize(w, h){ W = w; H = h; },
        update(dt){
          for (const p of pts) p.a += p.om * dt;
          timer -= dt;
          if (timer <= 0){
            const ctr = centers[Math.floor(Math.random() * centers.length)], q = [(ctr[0] + (Math.random() - .5) * .14) * W, (ctr[1] + (Math.random() - .5) * .24) * H];
            const nn = pts.map((p, i) => { const pp = pos(p); return {i, d: Math.hypot(pp[0] - q[0], pp[1] - q[1])}; }).sort((a, b) => a.d - b.d).slice(0, 6).map(o => o.i);
            queries.push({x: q[0], y: q[1], t: 0, nn}); timer = 2.2 + Math.random() * 1.2;
          }
          for (const q of queries) q.t += dt;
          queries = queries.filter(q => q.t < 3.2);
        },
        draw(c, w, h){
          c.clearRect(0, 0, w, h);
          for (const p of pts){ const pp = pos(p); c.fillStyle = rgba(p.tone ? C2 : C1, .55); c.beginPath(); c.arc(pp[0], pp[1], 1.4, 0, 6.2832); c.fill(); }
          for (const q of queries){
            const show = smooth(q.t, .25, .7) * (1 - smooth(q.t, 2.2, 3.2));
            if (q.t < 1.2){ c.strokeStyle = rgba(C1, .7 * (1 - q.t / 1.2)); c.lineWidth = 1; c.beginPath(); c.arc(q.x, q.y, 3 + q.t * Math.min(w, h) * .3, 0, 6.2832); c.stroke(); }
            c.strokeStyle = rgba(C1, .8 * show); c.lineWidth = 1;
            for (const i of q.nn){ const pp = pos(pts[i]); c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(pp[0], pp[1]); c.stroke(); c.fillStyle = rgba(C1, .95 * show); c.beginPath(); c.arc(pp[0], pp[1], 1.6 + 1.4 * show, 0, 6.2832); c.fill(); }
            c.fillStyle = rgba([255, 255, 255], .9 * smooth(q.t, 0, .2) * (1 - smooth(q.t, 2.2, 3.2))); c.beginPath(); c.arc(q.x, q.y, 2, 0, 6.2832); c.fill();
          }
        }
      };
    },
    // ---------- research: masks + one region selected ----------
    segment(){
      const rng = mulberry32(31), palette = [[94, 225, 255], [139, 124, 255], [58, 214, 196], [120, 150, 255], [190, 120, 255]], blobs = [];
      for (let i = 0; i < 9; i++) blobs.push({ u: ((i % 3) + .5) / 3 + (rng() - .5) * .1, v: (Math.floor(i / 3) + .5) / 3 + (rng() - .5) * .14, rx: .09 + rng() * .05, ry: .1 + rng() * .07, rot: rng() * 3, ph: rng() * 6.28, sp: .2 + rng() * .3, col: palette[i % 5], sel: 0 });
      let t = 0, pick = 0, timer = 1;
      return {
        update(dt){ t += dt; timer -= dt; if (timer <= 0){ pick = Math.floor(Math.random() * blobs.length); timer = 2.2; } blobs.forEach((b, i) => { b.sel += ((i === pick ? 1 : 0) - b.sel) * Math.min(1, dt * 3.5); }); },
        draw(c, w, h){
          c.clearRect(0, 0, w, h);
          for (const b of blobs){
            const cx = b.u * w + Math.sin(t * b.sp + b.ph) * 2, cy = b.v * h + Math.cos(t * b.sp + b.ph) * 2, rx = b.rx * w, ry = b.ry * h;
            const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); g.addColorStop(0, rgba(b.col, .42)); g.addColorStop(1, rgba(b.col, .08));
            c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, rx, ry, b.rot, 0, 6.2832); c.fill();
            c.setLineDash([2, 2]); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1; c.stroke(); c.setLineDash([]);
            if (b.sel > .02){ c.fillStyle = rgba(C1, .3 * b.sel); c.fill(); c.strokeStyle = rgba(C1, .95 * b.sel); c.lineWidth = 1.2; c.stroke(); }
          }
        }
      };
    },
    // ---------- Flappy Bird learning by neuroevolution ----------
    neat(card){
      const WH = 400, BX = 80, R = 9, GAP = 124, PW = 48, SPACING = 230, SPEED = 2.3, GRAV = .38, FLAP = -6.2, POP = 14;
      const NIN = 4, NH = 4, GL = NIN * NH + NH + NH + 1;
      let scale = 1, WW = 640, birds = [], pipes = [], gen = 1, steps = 0, acc = 0;
      const label = card.querySelector('.viz-tag');
      const rnd = () => Math.random() * 2 - 1, newGenome = () => Array.from({length: GL}, rnd), mutate = (g, amt) => g.map(w => Math.random() < .35 ? w + rnd() * amt : w);
      function think(g, inp){ let out = g[NIN * NH + NH + NH]; for (let hh = 0; hh < NH; hh++){ let sum = g[NIN * NH + hh]; for (let i = 0; i < NIN; i++) sum += g[hh * NIN + i] * inp[i]; out += g[NIN * NH + NH + hh] * Math.tanh(sum); } return out > 0; }
      function reset(gs){ birds = gs.map(g => ({g, y: WH / 2 + rnd() * 40, vy: 0, alive: true, score: 0})); pipes = []; steps = 0; }
      function evolve(){ birds.sort((a, b) => b.score - a.score); const top = birds.slice(0, 3).map(b => b.g), next = [top[0]]; while (next.length < POP) next.push(mutate(top[Math.floor(Math.random() * top.length)], next.length < 5 ? .35 : .9)); gen++; reset(next); }
      const nextPipe = () => { for (const p of pipes) if (p.x + PW > BX - R) return p; return null; };
      function step(){
        steps++; const lp = pipes[pipes.length - 1];
        if (!lp || lp.x < WW - SPACING) pipes.push({x: WW + 20, gy: 100 + Math.random() * (WH - 200)});
        for (const p of pipes) p.x -= SPEED; if (pipes[0].x < -PW - 10) pipes.shift();
        const np = nextPipe(); let alive = 0;
        for (const b of birds){
          if (!b.alive) continue;
          const inp = [b.y / WH, b.vy / 10, np ? (np.gy - b.y) / WH : 0, np ? (np.x - BX) / WW : 1];
          if (think(b.g, inp)) b.vy = FLAP; b.vy += GRAV; b.y += b.vy; b.score++;
          if (b.y < R || b.y > WH - R) b.alive = false;
          else if (np && BX + R > np.x && BX - R < np.x + PW && Math.abs(b.y - np.gy) > GAP / 2 - R) b.alive = false;
          if (b.alive) alive++;
        }
        if (!alive || steps > 2600) evolve();
      }
      reset(Array.from({length: POP}, newGenome));
      for (let i = 0; i < 20000 && gen < 14; i++) step();      // warm start: first generations happen off-screen
      return {
        resize(w, h){ scale = h / WH; WW = w / scale; },
        update(dt){ acc += dt; while (acc >= 1 / 60){ step(); acc -= 1 / 60; } },
        draw(c, w, h){
          c.clearRect(0, 0, w, h); c.save(); c.scale(scale, scale);
          c.fillStyle = rgba(C2, .55);
          for (const p of pipes){ const top = p.gy - GAP / 2, bot = p.gy + GAP / 2; c.fillRect(p.x, 0, PW, top - 14); c.fillRect(p.x - 4, top - 14, PW + 8, 14); c.fillRect(p.x, bot + 14, PW, WH - bot - 14); c.fillRect(p.x - 4, bot, PW + 8, 14); }
          c.fillStyle = rgba(C1, .65);
          for (const b of birds){ if (!b.alive) continue; c.beginPath(); c.arc(BX, b.y, R, 0, Math.PI * 2); c.fill(); }
          c.restore();
          if (label){ const tx = `live simulation · generation ${gen}`; if (label.textContent !== tx) label.textContent = tx; }
        }
      };
    },
    // ---------- Resume Bank: lines of a PDF become JSON fields ----------
    parse(){
      let t = 0; const rows = Array.from({length: 11}, (_, i) => ({w: .25 + Math.random() * .5, y: .12 + i * .072}));
      return {
        update(dt){ t += dt; },
        draw(c, w, h){
          c.clearRect(0, 0, w, h);
          const pw = w * .34, px = w * .06, py = h * .08, ph = h * .84;
          c.fillStyle = 'rgba(230,235,255,.10)'; c.fillRect(px, py, pw, ph);
          const scan = (t * .35) % 1;
          rows.forEach((r, i) => {
            const y = py + ph * r.y, hit = Math.abs(r.y - scan) < .05;
            c.fillStyle = hit ? rgba(C1, .9) : 'rgba(200,210,240,.35)'; c.fillRect(px + 4, y, (pw - 8) * r.w, 2);
          });
          c.fillStyle = rgba(C1, .35); c.fillRect(px, py + ph * scan - 1, pw, 2);
          // fields on the right fill in one by one
          const fx = w * .55, fw = w * .38, n = 4, cyc = (t * .5) % (n + 1.5);
          for (let i = 0; i < n; i++){
            const y = h * (.16 + i * .19), on = smooth(cyc, i, i + .6);
            c.strokeStyle = rgba(C2, .5); c.lineWidth = 1; c.strokeRect(fx, y, fw, h * .12);
            c.fillStyle = rgba(C1, .75 * on); c.fillRect(fx + 2, y + 2, (fw - 4) * on * (.55 + .4 * ((i * 37) % 10) / 10), h * .12 - 4);
          }
          // packets flying from page to fields
          for (let k = 0; k < 3; k++){ const u = ((t * .6) + k / 3) % 1, x = px + pw + (fx - px - pw) * u, y = h * (.3 + .4 * Math.sin(u * Math.PI + k)); c.fillStyle = rgba([255, 255, 255], .8 * Math.sin(u * Math.PI)); c.fillRect(x, y, 2, 2); }
        }
      };
    },
    // ---------- ticketing: emails routed to departments ----------
    route(){
      let t = 0; const mails = [];
      const depts = [.2, .4, .6, .8];
      return {
        update(dt){ t += dt; if (Math.random() < dt * 1.4) mails.push({u: 0, d: Math.floor(Math.random() * 4)}); mails.forEach(m => m.u += dt * .45); for (let i = mails.length - 1; i >= 0; i--) if (mails[i].u > 1) mails.splice(i, 1); },
        draw(c, w, h){
          c.clearRect(0, 0, w, h);
          const hx = w * .12, hy = h * .5, rx = w * .5, dx = w * .86;
          c.strokeStyle = rgba(C2, .35); c.lineWidth = 1;
          depts.forEach(v => { c.beginPath(); c.moveTo(rx, hy); c.quadraticCurveTo(w * .7, h * v, dx, h * v); c.stroke(); c.fillStyle = rgba(C2, .6); c.fillRect(dx, h * v - 3, 7, 6); });
          c.beginPath(); c.moveTo(hx, hy); c.lineTo(rx, hy); c.stroke();
          c.fillStyle = rgba(C1, .5 + .3 * Math.sin(t * 3)); c.beginPath(); c.arc(rx, hy, 4, 0, 6.2832); c.fill();
          for (const m of mails){
            let x, y;
            if (m.u < .5){ const k = m.u / .5; x = hx + (rx - hx) * k; y = hy; }
            else { const k = (m.u - .5) / .5, v = depts[m.d]; x = (1 - k) * (1 - k) * rx + 2 * (1 - k) * k * w * .7 + k * k * dx; y = (1 - k) * (1 - k) * hy + 2 * (1 - k) * k * h * v + k * k * h * v; }
            c.fillStyle = rgba([255, 255, 255], .85); c.fillRect(x - 3, y - 2, 6, 4);
          }
        }
      };
    },
    // The three below draw inside the empty band between a card's summary and its pipeline,
    // measured per card (each card's text is a different length).

    // ---------- PTC Weaver: a dormant system wakes up; requests move through review → approval → purchase ----------
    approval(card){
      let t = 0, wake = 0; const docs = [];
      const DEPTS = 4, GATES = [.36, .58, .8];               // review, approval, purchase (x as a share of width)
      let B = [.37, .6];
      return {
        res: 2, resize(){ B = bandOf(card); },
        update(dt){
          t += dt; wake = Math.min(1, wake + dt * .35);       // ~3 s from "dormant" to fully lit, then stays on
          if (wake > .6 && Math.random() < dt * 1.1) docs.push({u: 0, d: Math.floor(Math.random() * DEPTS), back: Math.random() < .18, stamp: 0});
          for (const d of docs){
            d.u += dt * (d.back && d.u > GATES[0] && d.u < GATES[1] ? .05 : .16);
            if (d.u > GATES[1] && d.stamp === 0) d.stamp = d.back ? -1 : 1;
          }
          for (let i = docs.length - 1; i >= 0; i--) if (docs[i].u > .98 || (docs[i].stamp === -1 && docs[i].u > GATES[1] + .06)) docs.splice(i, 1);
        },
        draw(c, w, h){
          c.clearRect(0, 0, w, h);
          const y0 = h * B[0], y1 = h * B[1], x0 = w * .1;
          // dust of the 16 dormant years settles away as the system wakes
          for (let i = 0; i < 40; i++){ const px = (i * 53 % 97) / 97 * w, py = y0 + ((i * 29 % 89) / 89) * (y1 - y0); c.fillStyle = `rgba(160,170,200,${(.35 * (1 - wake)).toFixed(3)})`; c.fillRect(px, py + wake * 6, 1, 1); }
          // department lanes on the left
          for (let k = 0; k < DEPTS; k++){ const y = y0 + (k + .5) * (y1 - y0) / DEPTS; c.fillStyle = rgba(C2, .35 + .4 * wake); c.fillRect(x0 - 4, y - 2, 4, 4); }
          // stage gates
          GATES.forEach((g, i) => {
            const x = w * g, on = smooth(wake, i * .2, i * .2 + .4);
            c.fillStyle = rgba(i === 2 ? C2 : C1, .18 + .5 * on); c.fillRect(x, y0 - 3, 1, y1 - y0 + 6);
            c.fillStyle = rgba(i === 2 ? C2 : C1, .7 * on); c.fillRect(x - 2, y0 - 5, 5, 2);
          });
          // purchase "cart" at the end
          const cx = w * .9, cy = (y0 + y1) / 2;
          c.strokeStyle = rgba(C2, .3 + .5 * wake); c.lineWidth = 1; c.strokeRect(cx - 4, cy - 3, 8, 6); c.fillStyle = rgba(C2, .6 * wake); c.fillRect(cx - 3, cy + 4, 2, 2); c.fillRect(cx + 2, cy + 4, 2, 2);
          // request documents
          for (const d of docs){
            const ly = y0 + (d.d + .5) * (y1 - y0) / DEPTS, k = clamp((d.u - .02) / (GATES[0] - .02), 0, 1);
            const x = x0 + (w * .9 - x0) * d.u, y = ly + (cy - ly) * smooth(k, 0, 1);
            c.fillStyle = d.stamp === -1 ? 'rgba(255,170,90,.9)' : 'rgba(235,242,255,.9)'; c.fillRect(x - 2, y - 3, 4, 5);
            if (d.stamp === 1){ c.strokeStyle = 'rgba(110,240,160,.95)'; c.beginPath(); c.moveTo(x + 3, y - 1); c.lineTo(x + 4, y + 1); c.lineTo(x + 7, y - 3); c.stroke(); }
            if (d.stamp === -1){ c.fillStyle = 'rgba(255,170,90,.9)'; c.fillRect(x + 3, y - 3, 1, 4); }
          }
        }
      };
    },

    // ---------- HR: biometric punches fill the attendance grid; a shift change gets approved ----------
    attendance(card){
      let t = 0, filled = 0, B = [.37, .6]; const COLS = 10, ROWS = 4, cells = Array.from({length: COLS * ROWS}, () => Math.random());
      return {
        res: 2, resize(){ B = bandOf(card); },
        update(dt){ t += dt; filled += dt * 5; if (filled > COLS * ROWS + 14) filled = 0; },
        draw(c, w, h){
          c.clearRect(0, 0, w, h);
          const y0 = h * B[0], y1 = h * B[1];
          // fingerprint: concentric arcs, a scan line sweeps it on each punch
          const fx = w * .12, fy = (y0 + y1) / 2, beat = (filled % 1);
          const fs = Math.min(1.8, (y1 - y0) / 26);
          for (let k = 1; k <= 5; k++){ const r = 2 * k * fs; c.strokeStyle = rgba(C1, .25 + .5 * (1 - Math.abs(beat - k / 5))); c.lineWidth = 1; c.beginPath(); c.arc(fx, fy, r, Math.PI * 1.05, Math.PI * 1.95 + k * .05); c.stroke(); c.beginPath(); c.arc(fx, fy + 1, r, Math.PI * .1, Math.PI * .85); c.stroke(); }
          c.fillStyle = rgba(C1, .8); c.fillRect(fx - 11 * fs, fy - 11 * fs + beat * 22 * fs, 22 * fs, 1);
          // attendance grid: one cell lights per punch (absent cells stay dim)
          const gx = w * .27, gw = w * .62, gh = (y1 - y0) * .62, cw = gw / COLS, ch = gh / ROWS;
          for (let i = 0; i < COLS * ROWS; i++){
            const col = i % COLS, row = Math.floor(i / COLS), on = i < filled, v = cells[i];
            c.fillStyle = !on ? 'rgba(130,150,255,.12)' : v > .9 ? 'rgba(255,120,140,.7)' : v > .75 ? rgba(C2, .7) : rgba(C1, .55 + .35 * v);
            c.fillRect(gx + col * cw + 1, y0 + row * ch + 1, cw - 2, ch - 2);
          }
          // a punch travels from the fingerprint to the cell being filled
          const cur = Math.floor(filled); if (cur < COLS * ROWS){ const tx = gx + (cur % COLS + .5) * cw, ty = y0 + (Math.floor(cur / COLS) + .5) * ch; c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(fx + (tx - fx) * beat - 1, fy + (ty - fy) * beat - 1, 2, 2); }
          // shift lanes: morning / evening / night; one shift slides to a new slot, then an approval tick
          const sy = y0 + gh + (y1 - y0) * .1, sh = (y1 - y0 - gh) * .7 / 3;
          const swap = smooth((t % 6), 2, 3.2) * (1 - smooth(t % 6, 5.2, 6));
          [[0, .3], [.3, .65], [.65, 1]].forEach(([a, b], k) => {
            c.fillStyle = 'rgba(130,150,255,.14)'; c.fillRect(gx, sy + k * (sh + 1), gw, sh);
            c.fillStyle = rgba(k === 2 ? C2 : C1, .55); c.fillRect(gx + gw * a, sy + k * (sh + 1), gw * (b - a) - 1, sh);
          });
          const bx = gx + gw * (.66 - .64 * swap), by = sy + 2 * (sh + 1) - 2 * (sh + 1) * swap;
          c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(bx, by, gw * .1, sh);
          if (swap > .98){ c.strokeStyle = 'rgba(110,240,160,.95)'; c.beginPath(); c.moveTo(gx + gw * .14, by + sh / 2); c.lineTo(gx + gw * .15, by + sh); c.lineTo(gx + gw * .18, by - 2); c.stroke(); }
        }
      };
    },

    // ---------- Pathology: records stream from SQL Server, get validated (bad ones cleaned), land in Frappe ----------
    migrate(card){
      let t = 0, landed = 0; const recs = [];
      const SLOTS = 12; let B = [.37, .6];
      return {
        res: 2, resize(){ B = bandOf(card); },
        update(dt){
          t += dt;
          if (Math.random() < dt * 2.2 && recs.length < 8) recs.push({u: 0, bad: Math.random() < .25, fix: 0, lane: Math.random()});
          for (const r of recs){
            const atGate = r.u > .46 && r.u < .52;
            if (r.bad && atGate && r.fix < 1){ r.fix = Math.min(1, r.fix + dt * 1.2); continue; }   // cleaned at the gate
            r.u += dt * .3;
          }
          for (let i = recs.length - 1; i >= 0; i--) if (recs[i].u >= 1){ recs.splice(i, 1); landed++; }
          if (landed > SLOTS + 3) landed = 0;
        },
        draw(c, w, h){
          c.clearRect(0, 0, w, h);
          const y0 = h * B[0], y1 = h * B[1], cy = (y0 + y1) / 2;
          // SQL Server: a database cylinder
          const dx = w * .12, dw = w * .14, dh = (y1 - y0) * .7, dy = cy - dh / 2;
          for (let k = 0; k < 3; k++){ c.strokeStyle = rgba(C2, .7); c.lineWidth = 1; c.beginPath(); c.ellipse(dx, dy + k * dh / 3, dw / 2, 3, 0, 0, Math.PI * 2); c.stroke(); }
          c.beginPath(); c.moveTo(dx - dw / 2, dy); c.lineTo(dx - dw / 2, dy + dh * .67); c.moveTo(dx + dw / 2, dy); c.lineTo(dx + dw / 2, dy + dh * .67); c.stroke();
          // validate gate in the middle
          const gx = w * .49; c.fillStyle = rgba(C1, .35 + .25 * Math.sin(t * 4)); c.fillRect(gx, y0, 1, y1 - y0);
          c.fillStyle = rgba(C1, .8); c.fillRect(gx - 3, y0 - 2, 7, 2); c.fillRect(gx - 3, y1, 7, 2);
          // Frappe target table: rows fill up as records land
          const tx = w * .7, tw = w * .22, rh = (y1 - y0) / SLOTS;
          c.strokeStyle = rgba(C1, .45); c.strokeRect(tx, y0, tw, y1 - y0);
          for (let i = 0; i < SLOTS; i++){ c.fillStyle = i < landed ? rgba(C1, .55) : 'rgba(130,150,255,.1)'; c.fillRect(tx + 2, y0 + i * rh + 1, tw - 4, Math.max(1, rh - 2)); }
          // records in flight
          for (const r of recs){
            const x = dx + dw / 2 + (tx - dx - dw / 2) * r.u, ly = y0 + 4 + r.lane * (y1 - y0 - 8);
            const row = y0 + (Math.min(landed, SLOTS - 1) + .5) * rh;                       // next empty row in the table
            const y = r.u < .5 ? ly + (cy - ly) * smooth(r.u, 0, .46) : cy + (row - cy) * smooth(r.u, .52, 1);
            const col = r.bad && r.fix < 1 ? `rgba(255,${(120 + 110 * r.fix) | 0},90,.95)` : 'rgba(235,245,255,.92)';
            c.fillStyle = col; c.fillRect(x - 3, y - 1, 7, 3);
            if (r.bad && r.fix > 0 && r.fix < 1){ c.strokeStyle = 'rgba(255,200,120,.8)'; c.strokeRect(x - 5, y - 3, 11, 7); }
          }
        }
      };
    }
  };

  document.querySelectorAll('.project.has-viz').forEach(card => {
    const make = VIZ[card.dataset.viz]; if (make) mount(card, make(card));
  });

  // ---------- LeetCode live stats (served by /api/leetcode on Vercel) ----------
  (() => {
    const body = document.getElementById('lc-body'), note = document.getElementById('lc-note');
    if (!body) return;
    const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
    const heat = (cal) => {
      const weeks = window.innerWidth < 640 ? 27 : 53, DAY = 86400000;
      const now = new Date(), today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const start = today - (new Date(today).getUTCDay() + (weeks - 1) * 7) * DAY;
      const by = {};
      Object.keys(cal).forEach((k) => { const t = Number(k) * 1000; if (!isNaN(t)) by[Math.floor(t / DAY) * DAY] = (by[Math.floor(t / DAY) * DAY] || 0) + Number(cal[k]); });
      const grid = el('div', 'lc-grid'); let sum = 0;
      for (let i = 0; i < weeks * 7; i++){
        const t = start + i * DAY, c = by[t] || 0, cell = el('i');
        if (t > today) cell.className = 'fut';
        else {
          sum += c;
          if (c) cell.className = c >= 7 ? 'l4' : c >= 4 ? 'l3' : c >= 2 ? 'l2' : 'l1';
          cell.title = c + ' submission' + (c === 1 ? '' : 's') + ' on ' + new Date(t).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
        }
        grid.append(cell);
      }
      const wrap = el('div', 'lc-heat'), head = el('div', 'lc-heat-head');
      head.append(el('b', '', String(sum)), ' submissions in the past ' + (weeks > 40 ? 'year' : '6 months'));
      wrap.append(head, grid); body.append(wrap);
    };
    const render = (d) => {
      body.textContent = '';
      const tot = el('div', 'lc-total'); tot.append(el('b', '', String(d.total)), el('span', '', 'problems solved'));
      const bars = el('div', 'lc-bars'), max = Math.max(1, d.easy, d.medium, d.hard);
      [['Easy', d.easy, '#5ee1ff'], ['Medium', d.medium, '#ffb84d'], ['Hard', d.hard, '#ff6b81']].forEach(([n, v, c]) => {
        const row = el('div', 'lc-row'), bar = el('i'), fill = el('u');
        fill.style.background = c; fill.style.width = '0%'; bar.append(fill);
        row.append(el('span', '', n), bar, el('em', '', String(v))); bars.append(row);
        requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = Math.max(4, v / max * 100) + '%'; }));
      });
      body.append(tot, bars);
      const meta = el('div', 'lc-meta');
      if (d.streak != null){ const s = el('span'); s.append('Current streak ', el('b', '', d.streak + ' days')); meta.append(s); }
      if (d.activeDays != null){ const s = el('span'); s.append('Active days this year ', el('b', '', String(d.activeDays))); meta.append(s); }
      if (meta.childNodes.length) body.append(meta);
      if (d.calendar && typeof d.calendar === 'object') heat(d.calendar);
    };
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
    fetch('/api/leetcode', {signal: ctl.signal}).then(r => (r.ok ? r.json() : Promise.reject())).then(d => {
      if (d && typeof d.total === 'number') render(d); else throw 0;
    }).catch(() => { if (note) note.textContent = 'Live stats are unavailable right now. See my profile for the latest.'; }).finally(() => clearTimeout(to));
  })();
})();
