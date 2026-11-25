// ==========================================================
// MOTION — the 3D solar journey
//  1. Warp starfield (flies faster while you scroll)
//  2. Parallax planets drifting past at different depths
//  3. Hero zoom-through
//  4. Scroll-linked 3D entrances (depth, left/right, wave)
//  5. Wave lines between sections
//  6. Projects: pinned 3D gallery that travels right → left
// Uses cached page positions (no layout reads per frame) and
// transforms only, so it stays smooth.
//
// CHANGE SUMMARY (2026-11-25): Education cards ('From physics to AI')
//  now animate in from the SECTION's position (anchor), staggered, so they
//  arrive as the section is reached instead of late, one by one.
// CHANGE SUMMARY (2026-11-25, 4): About cards (Agentic AI / Retrieval / Research)
//  use a new 'rise' entrance: same trigger for the whole row, left-to-right
//  cascade, flat rise + fade (no 3D depth), transform cleared when done.
// CHANGE SUMMARY (2026-11-25, 2): Skills cards ('What I work with'): the 'wave'
//  entrance now rises up in a left-to-right cascade, no more flying across
//  neighbours, no constant bobbing, and the transform is cleared once in place.
// ==========================================================
(function(){
  const html = document.documentElement;
  const still = reduce;                                   // respects "reduce motion"
  const desktop = () => innerWidth >= 1024 && finePointer;
  FX.noNeural = true;                                      // starfield replaces the neural net
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  let vh = innerHeight, vw = innerWidth, sy = scrollY, lastSy = scrollY, velocity = 0, time = 0;

  // ---------- 1. WARP STARFIELD ----------
  const sc = $('#stars'), sx = sc.getContext('2d');
  let stars = [], SW = 0, SH = 0, starColor = '#fff';
  function sizeStars(){
    SW = sc.width = innerWidth; SH = sc.height = innerHeight;
    const n = Math.min(260, Math.floor(SW * SH / 7000));
    stars = Array.from({length: n}, () => newStar(true));
    starColor = cssVar('--c1');
  }
  function newStar(anyZ){ return {x: (Math.random() - .5) * 2, y: (Math.random() - .5) * 2, z: anyZ ? Math.random() * .95 + .05 : 1, pz: 0}; }
  document.addEventListener('themechange', () => starColor = cssVar('--c1'));
  function drawStars(dt){
    sx.clearRect(0, 0, SW, SH);
    const cx = SW / 2, cy = SH * .42, f = Math.max(SW, SH) * .55;
    const speed = (still ? 0 : .00005 + Math.min(Math.abs(velocity), 60) * .000016) * dt;
    const streak = Math.min(Math.abs(velocity) / 25, 1);           // stretch into lines while scrolling fast
    for (const s of stars){
      s.pz = s.z; s.z -= speed;
      if (s.z <= .04){ Object.assign(s, newStar(false)); s.pz = s.z; continue; }
      const px = cx + s.x / s.z * f * .5, py = cy + s.y / s.z * f * .5;
      if (px < -50 || px > SW + 50 || py < -50 || py > SH + 50){ Object.assign(s, newStar(false)); continue; }
      const size = Math.max(.4, (1 - s.z) * 2.2), a = Math.min(1, (1 - s.z) * 1.3);
      if (streak > .08){
        const ox = cx + s.x / s.pz * f * .5, oy = cy + s.y / s.pz * f * .5;
        sx.strokeStyle = starColor; sx.globalAlpha = a * .8; sx.lineWidth = size;
        sx.beginPath(); sx.moveTo(ox + (px - ox) * (1 - streak * 6), oy + (py - oy) * (1 - streak * 6)); sx.lineTo(px, py); sx.stroke();
      }
      sx.globalAlpha = a; sx.fillStyle = s.z < .35 ? starColor : '#dfe3ff';
      sx.fillRect(px - size / 2, py - size / 2, size, size);
    }
    sx.globalAlpha = 1;
  }
  sizeStars();

  // ---------- 2. PARALLAX PLANETS ----------
  const space = $('#space');
  const BIG = [
    {cls: 'gp-gas',    size: 220, x: .86, depth: .35, start: .9},
    {cls: 'gp-ringed', size: 150, x: .08, depth: .55, start: 1.6},
    {cls: 'gp-ice',    size: 70,  x: .62, depth: .8,  start: 2.3},
    {cls: 'gp-lava',   size: 110, x: .92, depth: .5,  start: 3.2},
    {cls: 'gp-ocean',  size: 180, x: .04, depth: .3,  start: 4.1},
    {cls: 'gp-moon',   size: 54,  x: .3,  depth: .95, start: 5.0}
  ];
  space.innerHTML = BIG.map(p => `<div class="gp ${p.cls}" style="width:${p.size}px;height:${p.size}px"><i></i></div>`).join('');
  const gps = [...space.children];

  // ---------- 5. WAVE LINES between sections ----------
  function wavePath(amp, len, n){
    let d = `M0 ${60}`;
    for (let i = 0; i < n; i++){ const x = i * len; d += ` C${x + len * .25} ${60 - amp},${x + len * .25} ${60 - amp},${x + len * .5} 60 S${x + len * .75} ${60 + amp},${x + len} 60`; }
    return d;
  }
  $$('main section, body > section').forEach((sec, i) => {
    if (sec.id === 'top') return;
    const w = document.createElement('div'); w.className = 'wave-sep'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = `
      <svg class="w1" viewBox="0 0 2880 120" preserveAspectRatio="none"><path d="${wavePath(22, 480, 6)}"/></svg>
      <svg class="w2" viewBox="0 0 2880 120" preserveAspectRatio="none"><path d="${wavePath(14, 360, 8)}"/></svg>`;
    sec.prepend(w);
  });

  // ---------- 4. SCROLL-LINKED 3D ENTRANCES ----------
  // kind: depth | left | right | up | wave
  const items = [];
  function add(el, kind, i = 0, anchor = null){
    if (!el) return;
    el.classList.remove('reveal'); el.classList.add('m3d');
    items.push({el, kind, i, anchor, top: 0, h: 0, last: -1});
  }
  function collect(){
    $$('section h2').forEach(el => add(el, 'depth'));
    $$('section .eyebrow, section .sub').forEach(el => add(el, 'left'));
    add($('#aboutText'), 'left'); add($('#term'), 'right');
    $$('.ai-cap').forEach((el, i) => add(el, 'rise', i, $('#highlights')));   // one shared trigger for the row
    $$('.skill-card').forEach((el, i) => add(el, 'wave', i));
    $$('.job').forEach((el, i) => add(el, i % 2 ? 'right' : 'left'));
    $$('.play-tabs, .filters').forEach(el => add(el, 'up'));
    add($('.play-stage'), 'depth');
    $$('.edu').forEach((el, i) => add(el, i % 2 ? 'right' : 'left', i, $('#education')));   // anchored to the section
    add($('.contact'), 'depth');
    if (!desktop()) $$('.project').forEach((el, i) => add(el, i % 2 ? 'right' : 'left'));
  }
  // page position without transforms (offsetTop chain)
  function pageTop(el){ let t = 0; for (let e = el; e; e = e.offsetParent) t += e.offsetTop; return t; }

  // ---------- 6. HORIZONTAL 3D PROJECT GALLERY ----------
  const projSec = $('#projects'), pin = $('#projPin'), track = $('#projectGrid'), hBar = $('#hBar');
  let hOn = false, hStart = 0, hLen = 0, hDist = 0, cards = [], trackLeft = 0;
  function setupGallery(){
    hOn = desktop() && !still;
    html.classList.toggle('hmode', hOn);
    projSec.style.height = '';
    track.style.transform = '';
    if (!hOn) return;
    cards = [...track.querySelectorAll('.project:not(.hide)')];
    cards.forEach(c => delete c._x);
    trackLeft = track.getBoundingClientRect().left + (parseFloat(getComputedStyle(track).transform.split(',')[4]) || 0) * -1;
    hDist = Math.max(0, track.scrollWidth - innerWidth + 80);
    projSec.style.height = (innerHeight + hDist * 1.1) + 'px';
    hStart = pageTop(projSec); hLen = projSec.offsetHeight - innerHeight;
  }
  $$('.filter').forEach(b => b.addEventListener('click', () => setTimeout(() => { setupGallery(); measure(); }, 30)));

  // ---------- measuring (on load / resize only) ----------
  let heroH = 0;
  function measure(){
    vh = innerHeight; vw = innerWidth;
    for (const it of items){ const a = it.anchor || it.el; it.top = pageTop(a); it.h = a.offsetHeight; it.last = -1; }
    heroH = $('#top').offsetHeight;
    if (hOn){ hStart = pageTop(projSec); hLen = projSec.offsetHeight - innerHeight; }
  }
  function relayout(){ sizeStars(); setupGallery(); measure(); }
  addEventListener('resize', () => { clearTimeout(relayout._t); relayout._t = setTimeout(relayout, 150); });
  addEventListener('load', relayout);
  if (document.fonts) document.fonts.ready.then(relayout);

  // ---------- the frame loop ----------
  const heroText = $('.hero-grid > div:first-child'), avatar = $('#avatar'), stats = $('#stats');
  let tick = 0, acc = 0, starAcc = 0;
  function frame(now, dt){
    sy = scrollY; const moved = sy !== lastSy;
    velocity = velocity * .85 + (sy - lastSy) * .15; lastSy = sy; time += dt;
    // while nothing moves, update at ~20fps (gentle drift); full speed while scrolling
    const busy = moved || Math.abs(velocity) > .05;
    acc += dt; tick++;
    if (!busy && tick % 3) return;
    const step = acc; acc = 0;

    // starfield: full rate while scrolling, half rate when calm
    starAcc += step;
    if (!FX.three && starAcc >= 33 && (!FX.lite || Math.abs(velocity) > .5)){ drawStars(starAcc); starAcc = 0; }   // stars ≤ 30fps

    // planets drift up at their own depth and slowly sway
    if (!FX.three) gps.forEach((g, i) => {
      const p = BIG[i], travel = vh + p.size * 2;
      let y = ((p.start * vh - sy * p.depth) % travel + travel) % travel - p.size;
      const x = p.x * vw - p.size / 2 + Math.sin(time / 4000 + i) * 18;
      g.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(sy * .02 * p.depth).toFixed(1)}deg)`;
    });

    if (still) return;

    // hero: fly through the solar system
    const hp = clamp(sy / (heroH * .85));
    if (hp < 1.01 && vw >= 1024){
      heroText.style.transform = `translate3d(${(-hp * 120).toFixed(1)}px,${(-hp * 40).toFixed(1)}px,0)`;
      heroText.style.opacity = (1 - hp * 1.25).toFixed(3);
      avatar.style.transform = `translate3d(0,${(hp * 50).toFixed(1)}px,0)`;
      avatar.style.opacity = (1 - hp * 1.1).toFixed(3);
      stats.style.transform = `translate3d(0,${(hp * 60).toFixed(1)}px,0) scale(${(1 - hp * .08).toFixed(3)})`;
      stats.style.opacity = (1 - hp * 1.4).toFixed(3);
    }

    // 3D entrances
    for (const it of items){
      const top = it.top - sy;
      if (top > vh + 200 || top + it.h < -400){ continue; }
      const stagger = it.kind === 'wave' || it.kind === 'up' ? (it.i % 3) * .12 : 0;
      let p = it.kind === 'rise' ? clamp((vh * 1.0 - top) / (vh * .4) - it.i * .12)       // all three cards share the row's position
                : it.anchor ? clamp((vh * 1.02 - top) / (vh * .85) - it.i * .08)     // starts when the section enters the screen
                        : clamp((vh * .98 - top) / (vh * .55) - stagger);
      p = ease(p);
      const q = 1 - p;
      let t;
      switch (it.kind){
        case 'depth': t = `perspective(900px) translate3d(0,${q * 60}px,${-q * 380}px) rotateX(${q * 28}deg)`; break;
        case 'left':  t = `perspective(900px) translate3d(${-q * 160}px,0,${-q * 120}px) rotateY(${q * 18}deg)`; break;
        case 'right': t = `perspective(900px) translate3d(${q * 160}px,0,${-q * 120}px) rotateY(${-q * 18}deg)`; break;
        case 'up':    t = `perspective(900px) translate3d(0,${q * 90}px,${-q * 160}px) rotateX(${q * 20}deg)`; break;
        case 'rise':   // about cards: plain rise + fade, no depth or tilt, so neighbours never overlap
          t = p >= 1 ? '' : `translate3d(0,${q * 46}px,0)`;
          break;
        case 'wave':   // skill cards: rise up in a left-to-right cascade, then sit perfectly still (no bobbing)
          t = p >= 1 ? '' : `perspective(900px) translate3d(0,${q * 80}px,${-q * 180}px) rotateX(${q * 16}deg)`;
          break;
      }
      const key = t;
      if (key !== it.last){ it.el.style.transform = t; it.el.style.opacity = Math.min(1, p * 1.4).toFixed(3); it.last = key; }
    }

    // projects gallery: vertical scroll → right-to-left 3D travel
    if (hOn){
      const p = clamp((sy - hStart) / hLen);
      track.style.transform = `translate3d(${(-p * hDist).toFixed(1)}px,0,0)`;
      hBar.style.transform = `scaleX(${p.toFixed(4)})`;
      const mid = vw / 2;
      for (const c of cards){
        const r = c._x !== undefined ? c._x : (c._x = c.offsetLeft + c.offsetWidth / 2);
        const dx = r - p * hDist + trackLeft - mid;          // distance from screen centre
        const n = clamp(dx / vw, -1, 1);
        c.style.transform = `perspective(1200px) translate3d(0,${Math.abs(n) * 40}px,${-Math.abs(n) * 260}px) rotateY(${-n * 32}deg)`;
        c.style.opacity = (1 - Math.abs(n) * .55).toFixed(3);
      }
    }
  }

  collect();
  setupGallery();
  measure();
  loop(60, (now, dt) => frame(now, Math.min(dt, 50)));
})();

