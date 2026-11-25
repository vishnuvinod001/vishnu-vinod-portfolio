// CHANGE SUMMARY (2026-11-25, 5): performance. Renders at 30fps while idle (FX.idle).
// CHANGE SUMMARY (2026-11-25, 6): atom zoom smoothing. Removed the auto resolution drop
//  (it reallocated the canvas mid-zoom), idle half-rate is skipped while the atom is on
//  screen, and the zoom progress now glides toward the scroll position (eduSm).
// ==========================================================
// SCENE 3D — a cinematic flight through Vishnu's story
// (Three.js / WebGL). Scrolling moves the camera forward:
//   0  Solar system   — planets spin and revolve around a sun
//   1  Transformer    — the LLM backbone running a forward pass:
//                       tokens → embeddings + positional sine →
//                       N × [multi-head self-attention → FFN] →
//                       softmax over the next token
//   2  Code tunnel    — GHOST, vLLM, FastAPI, NEAT, SAM/CLIP code
//   3  Retrieval      — embedding space, a query finds its top-k,
//                       chunks flow into a local LLM (+ hospital ECG)
//   4  Apps           — phone screens of real projects
//   5  Atom zoom      — education (B.Sc Physics): atom → nucleus →
//                       proton → quark → hypothetical string
//   6  Finale         — a neural sphere with racing signals
// Falls back to the 2D starfield if WebGL isn't available.
// ==========================================================
(function(){
  FX.why3d = !window.THREE ? 'nowebgl' : reduce ? 'reduce' : '';
  if (FX.why3d) return;
  const canvas = document.getElementById('scene3d');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, antialias: !FX.lite, alpha: true, powerPreference: 'high-performance'});
  } catch(e){ canvas.remove(); FX.why3d = 'nowebgl'; return; }
  // No real graphics card (software rendering)? Use the lighter 2D effects instead.
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    FX.softGPU = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
    if (FX.softGPU){ FX.lite = true; document.documentElement.classList.add('lite'); }   // no GPU: keep 3D, render lighter
  } catch(e){}
  FX.three = true;
  document.documentElement.classList.add('three-on');

  const small = innerWidth < 900;
  const quality = () => (FX.softGPU ? .55 : FX.lite ? .7 : small ? 1 : Math.min(devicePixelRatio || 1, 1.5));
  renderer.setPixelRatio(quality());
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050816, .021);              // matches the page background so far objects melt away
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 420);
  const PI = Math.PI, rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const anims = [];                                         // per-frame updaters: fn(t, dt)

  // ---------- theme colours ----------
  const TC = {c1: new THREE.Color(), c2: new THREE.Color(), c3: new THREE.Color()};
  const themed = [];
  const theme = (mat, key, prop = 'color') => { themed.push({mat, key, prop}); return mat; };
  function readTheme(){
    for (const k in TC) TC[k].set(cssVar('--' + k) || '#8b93f8');
    for (const t of themed) t.mat[t.prop].copy(TC[t.key]);
  }

  // ---------- helpers ----------
  function tex(w, h, draw){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const glowTex = tex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.22, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
  function glow(color, size, opacity = 1){
    const m = new THREE.SpriteMaterial({map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false});
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
  }
  function textSprite(text, color, size, font = '600 64px JetBrains Mono, monospace'){
    const t = tex(256, 128, (g) => { g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = color; g.shadowBlur = 18; g.fillText(text, 128, 64); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
    s.scale.set(size * 2, size, 1); return s;
  }
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({color, roughness: .55, metalness: .35}, extra));

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight(0x9aa3c7, .7));
  const keyLight = new THREE.DirectionalLight(0xcfdcff, 1.1); keyLight.position.set(6, 10, 8); scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0x8b93f8, .6); rim.position.set(-8, -4, -6); scene.add(rim);

  // ======================================================
  // STARS + WARP STREAKS
  // ======================================================
  const N = (FX.lite || small) ? 1500 : 2800, Z0 = 40, Z1 = -360;
  const sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++){ sp[i*3] = rand(-150, 150); sp[i*3+1] = rand(-95, 95); sp[i*3+2] = rand(Z1, Z0); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xe3e8ff, size: .22, transparent: true, opacity: .9, depthWrite: false})));
  const SN = Math.min(800, N / 3 | 0), sl = new Float32Array(SN * 6);
  for (let i = 0; i < SN; i++){ for (let k = 0; k < 2; k++){ sl[i*6+k*3] = sp[i*3]; sl[i*6+k*3+1] = sp[i*3+1]; sl[i*6+k*3+2] = sp[i*3+2]; } }
  const streakGeo = new THREE.BufferGeometry(); streakGeo.setAttribute('position', new THREE.BufferAttribute(sl, 3));
  const streakMat = theme(new THREE.LineBasicMaterial({transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}), 'c1');
  scene.add(new THREE.LineSegments(streakGeo, streakMat));
  function updateStreaks(speed){
    const len = Math.min(Math.abs(speed) * .09, 9) * Math.sign(-speed || 1);
    streakMat.opacity = Math.min(.85, Math.abs(speed) / 40);
    if (streakMat.opacity < .02) return;
    for (let i = 0; i < SN; i++) sl[i*6+5] = sl[i*6+2] + len;
    streakGeo.attributes.position.needsUpdate = true;
  }

  // ======================================================
  // 0. SOLAR SYSTEM — spinning, revolving planets
  // ======================================================
  function noisy(g, w, h, base, spots, n = 220){
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++){ g.fillStyle = pick(spots); g.globalAlpha = rand(.08, .35); g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(4, 30), rand(2, 12), 0, 0, 2 * PI); g.fill(); }
    g.globalAlpha = 1;
  }
  const PT = {
    sun:   () => tex(256, 128, (g, w, h) => noisy(g, w, h, '#ffb347', ['#fff3b0', '#ff7a18', '#ffd166', '#ff9f43'], 420)),
    rock:  () => tex(256, 128, (g, w, h) => { noisy(g, w, h, '#8d7b6a', ['#5c4d40', '#b8a38c', '#6e6157']); for (let i = 0; i < 40; i++){ g.strokeStyle = 'rgba(40,30,24,.5)'; g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(2, 9), 0, 2 * PI); g.stroke(); } }),
    ocean: () => tex(256, 128, (g, w, h) => { noisy(g, w, h, '#1e6fa8', ['#2b8fd1', '#14507a'], 120); for (let i = 0; i < 26; i++){ g.fillStyle = pick(['#3f8f4d', '#6b8f3f', '#a08a5a']); g.globalAlpha = .9; g.beginPath(); g.ellipse(rand(0, w), rand(20, h - 20), rand(8, 30), rand(5, 14), rand(0, PI), 0, 2 * PI); g.fill(); } g.globalAlpha = .85; g.fillStyle = '#f1f6ff'; g.fillRect(0, 0, w, 9); g.fillRect(0, h - 9, w, 9); g.globalAlpha = 1; }),
    lava:  () => tex(256, 128, (g, w, h) => { noisy(g, w, h, '#3a0f08', ['#5a1a0c', '#1c0704'], 160); g.strokeStyle = '#ff8a2a'; g.lineWidth = 1.5; g.shadowColor = '#ff6a00'; g.shadowBlur = 6; for (let i = 0; i < 40; i++){ g.beginPath(); let x = rand(0, w), y = rand(0, h); g.moveTo(x, y); for (let k = 0; k < 4; k++){ x += rand(-18, 18); y += rand(-10, 10); g.lineTo(x, y); } g.stroke(); } }),
    gas:   () => tex(256, 128, (g, w, h) => { const cols = ['#e9c98b', '#c48a4f', '#f3dfb5', '#9c6a3c', '#e2b87e', '#7d532e']; for (let y = 0; y < h; y++){ g.fillStyle = cols[Math.floor((y / h * 9 + Math.sin(y * .3) * .6) % cols.length + cols.length) % cols.length]; g.fillRect(0, y, w, 1); } g.fillStyle = 'rgba(190,90,50,.8)'; g.beginPath(); g.ellipse(170, 80, 16, 8, 0, 0, 2 * PI); g.fill(); }),
    ice:   () => tex(256, 128, (g, w, h) => { noisy(g, w, h, '#bfe3f5', ['#ffffff', '#8cc6e2', '#e8f7ff'], 200); }),
    violet:() => tex(256, 128, (g, w, h) => { for (let y = 0; y < h; y++){ g.fillStyle = `hsl(${265 + Math.sin(y * .12) * 18},55%,${45 + Math.sin(y * .31) * 12}%)`; g.fillRect(0, y, w, 1); } })
  };
  const solar = new THREE.Group(); solar.rotation.x = .32; solar.rotation.z = .18;
  // keep the solar system in the top-right corner on every screen shape
  // place the sun at an exact spot on the landing screen (fx, fy from -1..1)
  const SOLAR_AT = window.SOLAR_AT || {wide: [.12, .44, .46], narrow: [.55, .64, .4]};
  function placeSolar(){
    const narrow = innerWidth < innerHeight, [fx, fy, sc] = narrow ? SOLAR_AT.narrow : SOLAR_AT.wide;
    camera.position.set(0, 1.5, 0); camera.lookAt(0, .55, -14); camera.updateMatrixWorld();
    const v = new THREE.Vector3(fx, fy, .5).unproject(camera).sub(camera.position).normalize();
    const k = -46 / v.z;                                     // point on that ray at depth z = -46
    solar.position.copy(camera.position).addScaledVector(v, k);
    solar.scale.setScalar(sc);
  }
  placeSolar(); scene.add(solar); solar.visible = false;   // hero no longer uses the solar system
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3.2, 48, 32), new THREE.MeshBasicMaterial({map: PT.sun()}));
  solar.add(sun, glow(0xffc266, 15, .95), glow(0xff7a18, 32, .35));
  solar.add(new THREE.PointLight(0xffc47a, 3.2, 70, 0));
  const PLANETS = [
    {t: 'rock',   r: .5,  d: 6,   s: 1.0},
    {t: 'ocean',  r: .8,  d: 9,   s: .7, moon: true},
    {t: 'lava',   r: .6,  d: 12,  s: .52},
    {t: 'gas',    r: 1.55,d: 16.5,s: .32, ring: true},
    {t: 'ice',    r: 1.0, d: 21,  s: .22},
    {t: 'violet', r: 1.2, d: 25.5,s: .15}
  ];
  PLANETS.forEach(p => {
    const orbit = new THREE.Group(); orbit.rotation.y = rand(0, 2 * PI); solar.add(orbit);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.r, 40, 28), std(0xffffff, {map: PT[p.t](), roughness: .85, metalness: 0}));
    mesh.position.x = p.d; mesh.rotation.z = rand(-.4, .4); orbit.add(mesh);
    if (p.ring){
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.r * 1.4, p.r * 2.3, 72), new THREE.MeshBasicMaterial({color: 0xe0c99a, side: THREE.DoubleSide, transparent: true, opacity: .55}));
      ring.rotation.x = PI / 2 - .35; mesh.add(ring);
    }
    let moonPivot = null;
    if (p.moon){
      moonPivot = new THREE.Group(); mesh.add(moonPivot);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(.2, 20, 14), std(0xcfd4dc, {roughness: .9, metalness: 0})); moon.position.x = 1.4; moonPivot.add(moon);
    }
    const pts = []; for (let i = 0; i <= 128; i++){ const a = i / 128 * 2 * PI; pts.push(new THREE.Vector3(Math.cos(a) * p.d, 0, Math.sin(a) * p.d)); }
    solar.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), theme(new THREE.LineBasicMaterial({transparent: true, opacity: .22}), 'c2')));
    anims.push((t, dt) => {
      orbit.rotation.y += p.s * dt * .00035;               // revolve around the sun
      mesh.rotation.y += dt * .0009;                       // spin on its own axis
      if (moonPivot) moonPivot.rotation.y += dt * .002;
    });
  });
  anims.push((t, dt) => { sun.rotation.y += dt * .00015; });

  // ---------- shared helpers for the AI chapters ----------
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = (x, a, b) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  // crisp label sprite sized to its text (height in world units)
  function label(text, color, h, font = '500 44px JetBrains Mono, monospace'){
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = font; const w = Math.ceil(g.measureText(text).width) + 40, H = 84;
    c.width = w; c.height = H;
    g.font = font; g.fillStyle = color; g.textBaseline = 'middle'; g.shadowColor = color; g.shadowBlur = 14; g.fillText(text, 20, H / 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false}));
    s.scale.set(h * w / H, h, 1); return s;
  }
  // a chapter fades in and out with camera depth, so the landing page stays clean
  function chapter(zNear, zFar){
    const grp = new THREE.Group(), mats = [];
    grp.fade = 0;
    grp.track = (m, base = m.opacity) => { m.transparent = true; m.userData.base = base; mats.push(m); return m; };
    anims.push(() => {
      const d = -camZ;
      const f = smooth(d, -zNear - 34, -zNear - 8) * (1 - smooth(d, -zFar + 26, -zFar + 52));
      grp.fade = f; grp.visible = f > .01;
      if (!grp.visible) return;
      for (const m of mats) if (!m.userData.live) m.opacity = m.userData.base * f;
    });
    scene.add(grp); return grp;
  }
  const lineMat = (key, opacity) => {
    const m = key.startsWith('#') ? new THREE.LineBasicMaterial({color: key, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false})
                                  : theme(new THREE.LineBasicMaterial({transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false}), key);
    return m;
  };

  // ======================================================
  // 1. TRANSFORMER — the LLM backbone, running a forward pass
  //    tokens → embeddings (+ positional sine) → N × [self-attention → feed-forward]
  //    → softmax over the next token. The camera flies through the layers.
  // ======================================================
  const TF = chapter(-64, -110);
  const TOK = ['Vishnu', 'builds', 'useful', 'AI', 'with', 'local'];
  const NT = TOK.length, TX = i => (i - (NT - 1) / 2) * 2.6, SY = -2.3;
  const Z_EMB = -68, Z_L = [-77, -87, -97], Z_OUT = -107;
  // token words + embedding columns
  const embCells = [];
  TOK.forEach((w, i) => {
    const l = label(w, '#e6ebff', .62, '600 46px Inter, sans-serif'); l.position.set(TX(i), -3.85, Z_EMB); TF.track(l.material, .95); TF.add(l);
    for (let k = 0; k < 6; k++){
      const m = TF.track(theme(new THREE.MeshBasicMaterial({transparent: true, opacity: .6}), k % 2 ? 'c1' : 'c3'), .6);
      const cube = new THREE.Mesh(new THREE.BoxGeometry(.34, .3, .34), m);
      cube.position.set(TX(i), -3.25 + k * .38, Z_EMB); TF.add(cube);
      embCells.push({cube, m, ph: Math.random() * 6, i, k});
    }
  });
  anims.push(t => { if (!TF.visible) return; for (const c of embCells){ const v = .35 + .65 * (.5 + .5 * Math.sin(t * .0016 + c.ph)); c.m.userData.live = true; c.m.opacity = .7 * v * TF.fade; c.cube.scale.x = c.cube.scale.z = .6 + v * .6; } });
  const eLab = label('token embeddings  +  positional encoding', '#9fb0ff', .5); eLab.position.set(0, -4.75, Z_EMB); TF.track(eLab.material, .9); TF.add(eLab);
  // positional-encoding sine wave across the token row
  const peN = 160, pePos = new Float32Array(peN * 3);
  for (let i = 0; i < peN; i++){ const x = -8.5 + 17 * i / (peN - 1); pePos[i*3] = x; pePos[i*3+1] = -.75 + Math.sin(x * 1.2) * .28; pePos[i*3+2] = Z_EMB; }
  const peGeo = new THREE.BufferGeometry(); peGeo.setAttribute('position', new THREE.BufferAttribute(pePos, 3));
  const peMat = TF.track(lineMat('c1', .75)); TF.add(new THREE.Line(peGeo, peMat));
  anims.push(t => { if (!TF.visible) return; for (let i = 0; i < peN; i++){ const x = pePos[i*3]; pePos[i*3+1] = -.75 + Math.sin(x * 1.2 + t * .0012) * .28 + Math.sin(x * .45 - t * .0007) * .12; } peGeo.attributes.position.needsUpdate = true; });
  // residual stream: one line per token, from embeddings to the output
  const resPts = [];
  for (let i = 0; i < NT; i++) resPts.push(TX(i), SY, Z_EMB, TX(i), SY, Z_OUT + 2.5);
  const resGeo = new THREE.BufferGeometry(); resGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(resPts), 3));
  TF.add(new THREE.LineSegments(resGeo, TF.track(lineMat('c2', .35))));
  // layers
  const layerNodes = [], arcs = [];
  const nodeGeo = new THREE.SphereGeometry(.17, 16, 12);
  Z_L.forEach((z, L) => {
    // glass frame the camera flies through
    const fr = [[-9.4, -4.9], [9.4, -4.9], [9.4, 3.9], [-9.4, 3.9]].map(([x, y]) => new THREE.Vector3(x, y, z));
    TF.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(fr), TF.track(lineMat('c2', .42))));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(18.8, 8.8), TF.track(theme(new THREE.MeshBasicMaterial({transparent: true, opacity: .035, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending}), 'c2'), .035));
    glass.position.set(0, -.5, z); TF.add(glass);
    const tl = label(`layer ${L + 1} · multi-head self-attention`, '#c9d2ff', .4); tl.position.set(-5.3, 3.35, z); TF.track(tl.material, .55); TF.add(tl);
    if (L === 0){ const fl = label('softmax(Q·Kᵀ / √d) · V', '#7ee8ff', .44); fl.position.set(4.6, 3.35, z); TF.track(fl.material, .6); TF.add(fl); }
    // token nodes on the residual stream
    const nodes = [];
    for (let i = 0; i < NT; i++){
      const m = TF.track(theme(new THREE.MeshBasicMaterial({transparent: true, opacity: .9}), L % 2 ? 'c3' : 'c1'), .9);
      const n = new THREE.Mesh(nodeGeo, m); n.position.set(TX(i), SY, z); TF.add(n);
      const g = glow(0xffffff, 1.4, 0); theme(g.material, 'c1'); g.material.userData.live = true; g.position.copy(n.position); TF.add(g);
      nodes.push({n, g, z});
    }
    layerNodes.push(nodes);
    // causal attention arcs: each token looks at itself and every earlier token
    for (let i = 0; i < NT; i++) for (let j = 0; j < i; j++){
      const a = new THREE.Vector3(TX(i), SY + .15, z), b = new THREE.Vector3(TX(j), SY + .15, z);
      const mid = a.clone().lerp(b, .5); mid.y += .7 + (i - j) * .78;
      const geo = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(28));
      const m = lineMat(L % 2 ? 'c3' : 'c1', .2); m.userData.live = true; m.transparent = true;
      TF.add(new THREE.Line(geo, m));
      arcs.push({m, i, j, L, w: 0});
    }
    // feed-forward block: expand to 4 hidden units, then project back
    const ff = [], hid = [];
    for (let i = 0; i < NT; i++){
      const z0 = z - .6, z1 = z - 3, z2 = z - 5.4;
      [[-.5, .55], [.5, .55], [-.5, -.55], [.5, -.55]].forEach(([dx, dy]) => {
        const hx = TX(i) + dx, hy = SY + 1.25 + dy;
        ff.push(TX(i), SY, z0, hx, hy, z1, hx, hy, z1, TX(i), SY, z2); hid.push(hx, hy, z1);
      });
    }
    const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ff), 3));
    TF.add(new THREE.LineSegments(ffGeo, TF.track(lineMat('c3', .22))));
    const hGeo = new THREE.BufferGeometry(); hGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hid), 3));
    const hp = new THREE.Points(hGeo, TF.track(theme(new THREE.PointsMaterial({size: .2, map: glowTex, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending}), 'c3'), .9));
    TF.add(hp);
    const fl2 = label('feed-forward', '#b9a8ff', .38); fl2.position.set(-8.2, SY + 2.5, z - 3); TF.track(fl2.material, .55); TF.add(fl2);
  });
  const xN = label('× N layers', '#e6ebff', .8, '600 54px Space Grotesk, Inter, sans-serif'); xN.position.set(6.6, 2.6, Z_L[2] - 6.5); TF.track(xN.material, .95); TF.add(xN);
  const headLab = label('head 1 / 8', '#7ee8ff', .42); headLab.position.set(-5.9, 2.75, Z_L[0]); TF.track(headLab.material, .55); TF.add(headLab);
  const headMaps = Array.from({length: 8}, (_, h) => label(`head ${h + 1} / 8`, '#7ee8ff', .42).material.map);
  // attention weights: softmax over random scores, one set per head; heads rotate
  const HEADS = 8, W = [];
  for (let h = 0; h < HEADS; h++){
    const per = {};
    for (let L = 0; L < Z_L.length; L++) for (let i = 0; i < NT; i++){
      const s = []; for (let j = 0; j < i; j++) s.push(Math.random() * 3 + (j === i - 1 ? 1.2 : 0) + (j === 0 ? .6 : 0));
      const mx = Math.max(...s, 0), ex = s.map(v => Math.exp(v - mx)), sum = ex.reduce((a, b) => a + b, 0) || 1;
      ex.forEach((v, j) => per[L + ':' + i + ':' + j] = v / sum);
    }
    W.push(per);
  }
  let curHead = -1;
  // output: softmax over candidate next tokens
  const CAND = [['LLMs', .58], ['agents', .19], ['tools', .11], ['models', .08], ['code', .04]];
  const bars = [];
  CAND.forEach(([w, p], i) => {
    const x = (i - 2) * 2.9, h = Math.max(.2, p * 7.2);
    const m = TF.track(theme(new THREE.MeshBasicMaterial({transparent: true, opacity: i ? .45 : .9}), i ? 'c2' : 'c1'), i ? .45 : .9);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, h, 1), m); b.position.set(x, -4.4 + h / 2, Z_OUT); TF.add(b);
    const l = label(`${w}  ${Math.round(p * 100)}%`, i ? '#aab4dd' : '#ffffff', .48, '600 44px Inter, sans-serif'); l.position.set(x, -4.4 + h + .55, Z_OUT); TF.track(l.material, .95); TF.add(l);
    bars.push({b, m, i});
  });
  const oLab = label('softmax → next token', '#9fb0ff', .55); oLab.position.set(0, -5.3, Z_OUT); TF.track(oLab.material, .9); TF.add(oLab);
  const nextTok = label('“…local LLMs”', '#7ee8ff', .7, 'italic 500 52px Instrument Serif, Georgia, serif'); nextTok.position.set(0, 4.1, Z_OUT - 1); TF.track(nextTok.material, .95); TF.add(nextTok);
  // forward-pass wave: pulses run down the residual stream, layers light up as it passes
  const wavePulses = [];
  for (let i = 0; i < NT; i++){ const s = glow(0xffffff, 1.5, 0); theme(s.material, 'c1'); s.material.userData.live = true; TF.add(s); wavePulses.push(s); }
  anims.push(t => {
    if (!TF.visible) return;
    const f = TF.fade, ph = (t / 4200) % 1, wz = Z_EMB + (Z_OUT - Z_EMB) * ph;
    wavePulses.forEach((s, i) => { s.position.set(TX(i), SY, wz); s.material.opacity = .95 * f * (1 - smooth(ph, .9, 1)); });
    const head = Math.floor(t / 2600) % HEADS, blend = smooth((t % 2600) / 2600, 0, .25);
    if (head !== curHead){ curHead = head; headLab.material.map = headMaps[head]; }
    const prev = W[(head + HEADS - 1) % HEADS], cur = W[head];
    for (const a of arcs){
      const key = a.L + ':' + a.i + ':' + a.j, w = prev[key] + (cur[key] - prev[key]) * blend;
      const near = Math.exp(-Math.pow((Z_L[a.L] - wz) / 3.2, 2));
      a.m.opacity = Math.min(1, (.05 + w * .75) * (1 + near * 1.6)) * f;
    }
    layerNodes.forEach(nodes => nodes.forEach(o => { const near = Math.exp(-Math.pow((o.z - wz) / 2.2, 2)); o.g.material.opacity = near * .9 * f; o.n.scale.setScalar(1 + near * .6); }));
    const flash = smooth(ph, .86, .95) * (1 - smooth(ph, .97, 1));
    bars.forEach(o => { if (!o.i){ o.m.userData.live = true; o.m.opacity = (.75 + flash * .25) * f; o.b.scale.x = o.b.scale.z = 1 + flash * .25; } });
  });

  // ======================================================
  // 2. CODE TUNNEL — floating code windows + flying symbols
  // ======================================================
  const SNIPS = [
    {t: 'ghost/agent.py', l: ['ctx = index.search(embed(q), k=6)', 'tools = await mcp.list_tools()', 'reply = ollama.chat(model, msgs,', '                    tools=tools)', 'memory.save(q, reply)  # SQLite']},
    {t: 'resume_bank.py', l: ['from vllm import LLM, SamplingParams', 'llm = LLM(model=MODEL)', 'out = llm.generate(prompt + text)', 'fields = json.loads(out[0].text)', 'fill_recruitment_form(fields)']},
    {t: 'api.py', l: ['@app.post("/ask")', 'async def ask(q: Query):', '    return await agent.run(q.text)', '', '# FastAPI in front of GHOST']},
    {t: 'ticket.py', l: ['@frappe.whitelist()', 'def from_email(mail):', '    doc = frappe.new_doc("FM Ticket")', '    doc.department = route(mail)', '    doc.insert()  # tracked']},
    {t: 'flappy_neat.py', l: ['p = neat.Population(config)', 'p.add_reporter(StdOutReporter(True))', 'winner = p.run(eval_genomes, 50)', '# mutation · crossover · speciation', 'print(winner.fitness)']},
    {t: 'segment.py', l: ['img = galip.generate(prompt)', 'masks = sam.generate(img)', 'scores = clip.score(masks, prompt)', 'region = masks[scores.argmax()]', '# training-free, no retraining']},
    {t: 'migrate.sql', l: ['SELECT code, description', 'FROM pathology_index', 'WHERE is_active = 1', 'ORDER BY code;', '-- then validate → Frappe']},
    {t: 'physics.py', l: ['# where it started: B.Sc Physics', 'E = h * nu', 'psi = np.exp(1j * (k*x - w*t))', 'p = abs(psi) ** 2', '# probability, not certainty']}
  ];
  const KWS = 'const|export|async|function|await|return|def|class|from|import|if|for|in|with|SELECT|FROM|WHERE|ORDER|BY|print';
  const KW = new RegExp('\\b(' + KWS + ')\\b');
  function codeTex(sn){
    return tex(640, 400, (g, w, h) => {
      g.fillStyle = 'rgba(12,13,24,.94)'; g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fill();
      g.strokeStyle = 'rgba(94,225,255,.45)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#141a33'; g.beginPath(); g.roundRect(0, 0, w, 56, [26, 26, 0, 0]); g.fill();
      ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(34 + i * 24, 28, 7, 0, 2 * PI); g.fill(); });
      g.fillStyle = '#8f97c0'; g.font = '500 22px JetBrains Mono, monospace'; g.fillText(sn.t, 120, 36);
      g.font = '500 23px JetBrains Mono, monospace';
      sn.l.forEach((line, i) => {
        const y = 104 + i * 54; let x = 30;
        g.fillStyle = '#4a4f70'; g.fillText(String(i + 1), x, y); x = 70;
        const parts = line.split(new RegExp('(\\b(?:' + KWS + ')\\b|"[^"]*"|\'[^\']*\'|#.*$|--.*$)'));
        for (const p of parts){
          if (!p) continue;
          g.fillStyle = /^["']/.test(p) ? '#86efac' : /^(#|--)/.test(p) ? '#5d6488' : KW.test(p) ? '#c4a7ff' : /\w+(?=\()/.test(p) ? '#7dd3fc' : '#dfe3f5';
          g.fillText(p, x, y); x += g.measureText(p).width;
        }
      });
    });
  }
  SNIPS.forEach((sn, i) => {
    const side = i % 2 ? 1 : -1;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4), new THREE.MeshBasicMaterial({map: codeTex(sn), transparent: true, side: THREE.DoubleSide}));
    m.position.set(side * rand(5, 7.5), rand(-1.6, 3.2), -122 - i * 6);
    m.rotation.y = -side * .5; m.rotation.x = rand(-.08, .08);
    scene.add(m);
    const by = m.position.y, ph = rand(0, 6);
    anims.push((t) => { m.position.y = by + Math.sin(t * .0007 + ph) * .3; m.rotation.z = Math.sin(t * .0005 + ph) * .03; });
  });
  // flying symbols: model tokens, maths and a little physics
  const SYM = ['<s>', 'QKᵀ', 'σ(x)', '∇L', 'k=6', '</s>', 'ψ', 'ħ', 'λ', '{ }', 'top-p', '∑', 'emb', '→'];
  for (let i = 0; i < ((FX.lite || small) ? 10 : 22); i++){
    const s = textSprite(pick(SYM), pick(['#7dd3fc', '#c4a7ff', '#86efac', '#5ee1ff']), rand(.6, 1.1));
    s.material.opacity = .85; scene.add(s);
    const reset = (far) => s.position.set(rand(-10, 10), rand(-4, 5), rand(-176, far ? -120 : -152));
    reset(true);
    anims.push((t, dt) => { s.position.z += dt * .006; if (s.position.z > -114) reset(false); });
  }

  // ======================================================
  // 3. RETRIEVAL (RAG) — an embedding space; a query lands, its
  //    nearest neighbours light up and flow into a local LLM
  // ======================================================
  const RG = chapter(-182, -214);
  const CL = [[-8, 2.4, -188], [-3.5, -2, -195], [3, 3.2, -192], [8.5, -1, -199], [-6.5, .5, -206], [4, -2.8, -208]];
  const CC = [[94, 225, 255], [139, 124, 255], [72, 214, 196], [180, 140, 246], [120, 160, 255], [236, 140, 200]];
  const NP = (FX.lite || small) ? 50 : 80, vpos = new Float32Array(CL.length * NP * 3), vcol = new Float32Array(CL.length * NP * 3), vecs = [];
  CL.forEach((c, ci) => { for (let k = 0; k < NP; k++){
    const r = Math.pow(Math.random(), .6) * 2.1, th = rand(0, 2 * PI), ph = Math.acos(rand(-1, 1));
    const x = c[0] + r * Math.sin(ph) * Math.cos(th) * 1.3, y = c[1] + r * Math.cos(ph) * .9, z = c[2] + r * Math.sin(ph) * Math.sin(th) * 1.3;
    const idx = vecs.length; vpos.set([x, y, z], idx * 3); vcol.set(CC[ci].map(v => v / 255), idx * 3); vecs.push(new THREE.Vector3(x, y, z));
  } });
  const vGeo = new THREE.BufferGeometry(); vGeo.setAttribute('position', new THREE.BufferAttribute(vpos, 3)); vGeo.setAttribute('color', new THREE.BufferAttribute(vcol, 3));
  RG.add(new THREE.Points(vGeo, RG.track(new THREE.PointsMaterial({size: .34, map: glowTex, vertexColors: true, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending}))));
  const eL = label('embedding space', '#9fb0ff', .5); eL.position.set(-8, 5, -190); RG.track(eL.material, .9); RG.add(eL);
  // document cards that were chunked and embedded
  const DOCS = [['notes.md', 'GHOST memory'], ['resume.pdf', 'Resume Bank'], ['ticket_412.eml', 'facilities'], ['paper.pdf', 'GALIP · SAM · CLIP']];
  DOCS.forEach(([n, sub], i) => {
    const t = tex(320, 400, (g, w, h) => {
      g.fillStyle = 'rgba(14,18,40,.92)'; g.beginPath(); g.roundRect(0, 0, w, h, 22); g.fill(); g.strokeStyle = 'rgba(139,124,255,.55)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#e6ebff'; g.font = '600 28px JetBrains Mono, monospace'; g.fillText(n, 24, 54);
      g.fillStyle = '#8f97c0'; g.font = '400 20px Inter, sans-serif'; g.fillText(sub, 24, 86);
      for (let k = 0; k < 9; k++){ g.fillStyle = k % 3 ? 'rgba(160,170,220,.28)' : 'rgba(94,225,255,.45)'; g.fillRect(24, 120 + k * 28, rand(120, 270), 10); }
    });
    const m = RG.track(new THREE.MeshBasicMaterial({map: t, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false}), .9);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.75), m);
    const c = CL[[0, 2, 3, 4][i]]; card.position.set(c[0] + (i % 2 ? -2.6 : 2.6), c[1] + 1.6, c[2] + 1); card.rotation.y = i % 2 ? .35 : -.35; RG.add(card);
    const by = card.position.y, ph = rand(0, 6); anims.push(t => { card.position.y = by + Math.sin(t * .0008 + ph) * .25; });
  });
  // vector index + memory stores
  function database(){
    const gp = new THREE.Group();
    for (let k = 0; k < 3; k++){
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .56, 40), std(0x121628, {metalness: .6, roughness: .35})); disk.position.y = k * .72; gp.add(disk);
      const rimL = new THREE.Mesh(new THREE.TorusGeometry(1.1, .035, 8, 60), theme(new THREE.MeshBasicMaterial(), 'c1')); rimL.rotation.x = PI / 2; rimL.position.y = k * .72 + .28; gp.add(rimL);
    }
    return gp;
  }
  const dbA = database(); dbA.position.set(-10, -4.6, -199); RG.add(dbA);
  const dbB = database(); dbB.position.set(10.5, -4.6, -191); RG.add(dbB);
  const dLA = label('FAISS index', '#7ee8ff', .45); dLA.position.set(-10, -1.9, -199); RG.track(dLA.material, .9); RG.add(dLA);
  const dLB = label('SQLite memory', '#7ee8ff', .45); dLB.position.set(10.5, -1.9, -191); RG.track(dLB.material, .9); RG.add(dLB);
  // the local LLM core
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), RG.track(theme(new THREE.MeshBasicMaterial({wireframe: true, transparent: true, opacity: .55}), 'c1'), .55));
  core.position.set(.5, .6, -212); RG.add(core);
  const coreGlow = glow(0xffffff, 6, .5); theme(coreGlow.material, 'c2'); RG.track(coreGlow.material, .5); coreGlow.position.copy(core.position); RG.add(coreGlow);
  const cL = label('Ollama · local LLM', '#e6ebff', .5); cL.position.set(.5, 2.7, -212); RG.track(cL.material, .95); RG.add(cL);
  anims.push((t, dt) => { core.rotation.y += dt * .0005; core.rotation.x += dt * .0002; });
  // ECG strip: these systems run in a hospital
  function ecg(x){
    const p = ((x % 6) + 6) % 6;
    if (p > 1 && p < 1.6) return Math.sin((p - 1) / .6 * PI) * .35;
    if (p > 2 && p < 2.15) return -(p - 2) / .15 * .5;
    if (p >= 2.15 && p < 2.35) return -.5 + (p - 2.15) / .2 * 3.3;
    if (p >= 2.35 && p < 2.6) return 2.8 - (p - 2.35) / .25 * 3.6;
    if (p >= 2.6 && p < 2.8) return -.8 + (p - 2.6) / .2 * .8;
    if (p > 3.4 && p < 4.4) return Math.sin((p - 3.4) / 1 * PI) * .6;
    return 0;
  }
  const eN = 360, ePos = new Float32Array(eN * 3);
  for (let i = 0; i < eN; i++){ ePos[i*3] = -17 + 34 * i / (eN - 1); ePos[i*3+1] = 6.2; ePos[i*3+2] = -203; }
  const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  RG.add(new THREE.Line(eGeo, RG.track(lineMat('#ff7a9a', .6))));
  const hosp = label('AIMS Kochi · hospital systems', '#ff9db4', .45); hosp.position.set(-11.5, 7.6, -203); RG.track(hosp.material, .8); RG.add(hosp);
  anims.push(t => { if (!RG.visible) return; const sh = t * .004; for (let i = 0; i < eN; i++) ePos[i*3+1] = 6.2 + ecg(ePos[i*3] + sh) * .55; eGeo.attributes.position.needsUpdate = true; });
  // query → top-k neighbours → packets into the LLM
  const K = 6, qLines = new Float32Array(K * 6), qGeo = new THREE.BufferGeometry(); qGeo.setAttribute('position', new THREE.BufferAttribute(qLines, 3));
  const qMat = lineMat('c1', 0); qMat.userData.live = true; RG.add(new THREE.LineSegments(qGeo, qMat));
  const qDot = glow(0xffffff, 1.8, 0); qDot.material.userData.live = true; RG.add(qDot);
  const nnGlow = Array.from({length: K}, () => { const g = glow(0xffffff, 1.3, 0); theme(g.material, 'c1'); g.material.userData.live = true; RG.add(g); return g; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48), theme(new THREE.MeshBasicMaterial({transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending}), 'c1'));
  ring.material.userData.live = true; RG.add(ring);
  const qLab = label('query → top-k = 6', '#ffffff', .42); qLab.material.userData.live = true; RG.add(qLab);
  const pk = Array.from({length: K}, () => { const g = glow(0xffffff, .9, 0); theme(g.material, 'c3'); g.material.userData.live = true; RG.add(g); return g; });
  let Q = null, qTimer = 600;
  function newQuery(){
    const c = pick(CL), q = new THREE.Vector3(c[0] + rand(-1.2, 1.2), c[1] + rand(-.8, .8), c[2] + rand(-1.2, 1.2));
    const nn = vecs.map((v, i) => [i, v.distanceToSquared(q)]).sort((a, b) => a[1] - b[1]).slice(0, K).map(a => vecs[a[0]]);
    nn.forEach((v, k) => { qLines.set([q.x, q.y, q.z, v.x, v.y, v.z], k * 6); });
    qGeo.attributes.position.needsUpdate = true;
    Q = {q, nn, t: 0};
  }
  anims.push((t, dt) => {
    if (!RG.visible) return;
    const f = RG.fade;
    qTimer -= dt; if (qTimer <= 0){ newQuery(); qTimer = 3200; }
    if (!Q) return;
    Q.t += dt; const s = Q.t / 1000;
    const show = smooth(s, .25, .6) * (1 - smooth(s, 2.3, 3));
    qDot.position.copy(Q.q); qDot.material.opacity = (smooth(s, 0, .15) * (1 - smooth(s, 2.6, 3.1))) * f;
    qMat.opacity = .8 * show * f;
    nnGlow.forEach((g, k) => { g.position.copy(Q.nn[k]); g.material.opacity = .95 * show * f; g.scale.setScalar(1 + show * .6); });
    ring.position.copy(Q.q); ring.lookAt(camera.position); const rs = .3 + s * 2.2; ring.scale.setScalar(rs); ring.material.opacity = .7 * (1 - smooth(s, 0, 1.1)) * f;
    qLab.position.set(Q.q.x, Q.q.y + 1.1, Q.q.z); qLab.material.opacity = .9 * show * f;
    const k2 = smooth(s, .9, 2.1);
    pk.forEach((g, k) => { g.position.lerpVectors(Q.nn[k], core.position, k2); g.material.opacity = (k2 > 0 && k2 < 1 ? .95 : 0) * f; });
    coreGlow.material.userData.live = true; coreGlow.material.opacity = (.45 + smooth(s, 1.9, 2.15) * (1 - smooth(s, 2.2, 2.9)) * .5) * f;
  });

  // ======================================================
  // 4. APPS — phone screens of real projects (sample UI)
  // ======================================================
  function screen(draw){ return tex(360, 720, (g, w, h) => { g.fillStyle = '#0a0e22'; g.fillRect(0, 0, w, h); draw(g, w, h); }); }
  const UI = {
    head(g, w, title, c){ g.fillStyle = c; g.fillRect(0, 0, w, 96); g.fillStyle = '#05060a'; g.font = '700 30px Inter, sans-serif'; g.fillText(title, 24, 62); },
    card(g, x, y, w, h, c = '#141a36'){ g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill(); },
    text(g, s, x, y, c = '#dfe3f5', f = '500 20px Inter, sans-serif'){ g.fillStyle = c; g.font = f; g.fillText(s, x, y); }
  };
  const SCREENS = [
    screen((g, w) => {                                   // GHOST
      UI.head(g, w, '👻 GHOST', '#5ee1ff');
      UI.card(g, 90, 124, 250, 70, '#5ee1ff'); UI.text(g, 'find my FAISS notes', 106, 166, '#05060a', '600 19px Inter');
      UI.card(g, 20, 212, 300, 44, '#1a2142'); UI.text(g, '⚙ mcp · fs.search("faiss")', 34, 241, '#9fb0ff', '500 16px JetBrains Mono');
      UI.card(g, 20, 270, 300, 150); UI.text(g, 'Found 3 files. The newest,', 36, 308); UI.text(g, 'notes/rag.md, says top-k=6', 36, 338); UI.text(g, 'works best for your docs.', 36, 368);
      UI.text(g, 'memory: saved ✓', 36, 404, '#86efac', '500 16px JetBrains Mono');
      UI.card(g, 20, 610, 320, 58, '#121733'); UI.text(g, 'Ask GHOST…', 40, 646, '#5d6488', '500 18px Inter');
      UI.text(g, 'Ollama · runs locally', 92, 590, '#5d6488', '500 16px Inter');
    }),
    screen((g, w) => {                                   // Resume Bank
      UI.head(g, w, 'Resume Bank', '#8b7cff');
      UI.card(g, 20, 120, 320, 120); UI.text(g, '📄 candidate.pdf', 36, 160, '#fff', '600 20px Inter'); UI.text(g, 'parsed with vLLM ✓', 36, 196, '#86efac', '500 17px Inter');
      [['name', 'A. Candidate'], ['email', 'a.cand@mail.com'], ['skills', 'Python, SQL'], ['exp', '3 years']].forEach(([k, v], i) => {
        const y = 266 + i * 82; UI.card(g, 20, y, 320, 66); UI.text(g, k, 36, y + 28, '#8f97c0', '500 15px JetBrains Mono'); UI.text(g, v, 36, y + 54, '#fff', '600 18px Inter');
      });
      UI.card(g, 20, 610, 320, 60, '#8b7cff'); UI.text(g, 'Fill recruitment form →', 50, 648, '#05060a', '700 19px Inter');
    }),
    screen((g, w) => {                                   // Ticketing
      UI.head(g, w, 'FM Tickets', '#48d6c4');
      [['#412', 'AC not cooling · Ward 3', 'HVAC', '#f2b55a'], ['#413', 'Leak near lift B', 'Plumbing', '#5ee1ff'], ['#414', 'Lights out · OPD', 'Electrical', '#8b7cff'], ['#415', 'Door lock jammed', 'Civil', '#c084fc']].forEach(([id, s, d, c], i) => {
        const y = 120 + i * 120; UI.card(g, 20, y, 320, 104);
        UI.text(g, id + ' · from Outlook', 36, y + 34, '#8f97c0', '500 15px JetBrains Mono'); UI.text(g, s, 36, y + 66, '#fff', '600 18px Inter');
        g.fillStyle = c; g.beginPath(); g.roundRect(36, y + 78, 120, 20, 10); g.fill(); UI.text(g, d, 44, y + 94, '#05060a', '700 13px Inter');
      });
      UI.text(g, 'sample UI', 250, 700, '#3a3f5c', '400 14px Inter');
    }),
    screen((g, w) => {                                   // HR attendance
      UI.head(g, w, 'HR · Attendance', '#ec8cc8');
      UI.text(g, 'Biometric punches · this month', 24, 136, '#8f97c0', '500 16px Inter');
      for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++){ const v = Math.random(); g.fillStyle = v > .85 ? '#3a3f5c' : v > .3 ? '#5ee1ff' : '#2b6f86'; g.beginPath(); g.roundRect(24 + c * 46, 156 + r * 46, 38, 38, 8); g.fill(); }
      UI.card(g, 20, 400, 320, 90); UI.text(g, 'Shift change request', 36, 436, '#fff', '600 19px Inter'); UI.text(g, 'Night → Morning · approved ✓', 36, 468, '#86efac', '500 16px Inter');
      UI.card(g, 20, 506, 320, 90); UI.text(g, 'Attendance report', 36, 542, '#fff', '600 19px Inter'); UI.text(g, 'Export ready', 36, 574, '#8f97c0', '500 16px Inter');
      UI.text(g, 'in progress · sample UI', 160, 700, '#3a3f5c', '400 14px Inter');
    }),
    screen((g, w, h) => {                                // Flappy NEAT
      g.fillStyle = '#0a1030'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(139,124,255,.7)'; [[40, 240], [190, 380], [330, 300]].forEach(([x, gy]) => { g.fillRect(x, 0, 54, gy - 80); g.fillRect(x, gy + 80, 54, h - gy - 80); });
      g.fillStyle = 'rgba(94,225,255,.85)'; for (let i = 0; i < 9; i++){ g.beginPath(); g.arc(120, 300 + Math.sin(i) * 50, 11, 0, 7); g.fill(); }
      UI.text(g, 'NEAT · generation 14', 24, 52, '#5ee1ff', '600 22px JetBrains Mono'); UI.text(g, 'best score 175', 24, 84, '#dfe3f5', '500 18px Inter');
    })
  ];
  function phone(map){
    const gp = new THREE.Group();
    gp.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.3, .22), std(0x0d0f1c, {metalness: .7, roughness: .3})));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.02, 4.04), new THREE.MeshBasicMaterial({map})); scr.position.z = .115; gp.add(scr);
    gp.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 4.3, .22)), theme(new THREE.LineBasicMaterial({transparent: true, opacity: .5}), 'c2')));
    return gp;
  }
  SCREENS.forEach((map, i) => {
    const p = phone(map), side = i % 2 ? 1 : -1;
    p.position.set(side * rand(4.5, 6.5), rand(-.8, 2.2), -229 - i * 7); p.rotation.y = -side * .45;
    scene.add(p);
    const by = p.position.y, ph = rand(0, 6), ry = p.rotation.y;
    anims.push((t) => { p.position.y = by + Math.sin(t * .0008 + ph) * .3; p.rotation.y = ry + Math.sin(t * .0004 + ph) * .12; });
  });
  // research dashboard: SAM masks + CLIP pick a region
  const dashTex = tex(1024, 600, (g, w, h) => {
    g.fillStyle = 'rgba(10,14,34,.95)'; g.beginPath(); g.roundRect(0, 0, w, h, 30); g.fill(); g.strokeStyle = 'rgba(94,225,255,.5)'; g.lineWidth = 3; g.stroke();
    UI.text(g, 'GALIP + SAM + CLIP · region control', 40, 64, '#fff', '700 32px Inter');
    UI.card(g, 40, 100, 600, 450, '#0f1533');
    const cols = ['94,225,255', '139,124,255', '72,214,196', '190,120,255', '120,150,255'];
    for (let i = 0; i < 9; i++){ const x = 110 + (i % 3) * 190, y = 170 + Math.floor(i / 3) * 135; g.fillStyle = `rgba(${cols[i % 5]},${i === 4 ? .65 : .28})`; g.beginPath(); g.ellipse(x, y, 80, 55, i, 0, 7); g.fill(); g.setLineDash([8, 7]); g.strokeStyle = i === 4 ? '#5ee1ff' : 'rgba(255,255,255,.35)'; g.lineWidth = i === 4 ? 5 : 2; g.stroke(); g.setLineDash([]); }
    UI.card(g, 670, 100, 314, 210, '#0f1533'); UI.text(g, '78%', 700, 200, '#5ee1ff', '700 72px Inter'); UI.text(g, 'region-selection accuracy', 700, 250, '#8f97c0', '500 20px Inter');
    UI.card(g, 670, 340, 314, 210, '#0f1533'); UI.text(g, '0.591', 700, 440, '#8b7cff', '700 64px Inter'); UI.text(g, 'mean CLIP · 120 prompts', 700, 490, '#8f97c0', '500 20px Inter');
  });
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 5), new THREE.MeshBasicMaterial({map: dashTex, transparent: true, side: THREE.DoubleSide}));
  dash.position.set(-9.5, 1.5, -252); scene.add(dash);
  anims.push((t) => { dash.rotation.y = .55 + Math.sin(t * .0003) * .12; });

  // ======================================================
  // 5. EDUCATION — zoom into an atom (B.Sc Physics)
  //    atom → nucleus → proton → quark → (hypothetical) string.
  //    The camera parks; scrolling scales the atom exponentially
  //    around a moving focus point.
  // ======================================================
  const EDU_Z = -268, ATOM_D = 14;
  const atomRoot = new THREE.Group(); scene.add(atomRoot);
  const atomIn = new THREE.Group(); atomRoot.add(atomIn);          // scaled + shifted each frame
  const AM = [];                                                    // materials whose opacity we drive
  const am = (m, base) => { m.transparent = true; m.depthWrite = false; m.userData.base = base; AM.push(m); return m; };
  // electron cloud: 1s sphere + 2p lobes, sampled as glowing points
  const ecN = (FX.lite || small) ? 900 : 1600, ecPos = new Float32Array(ecN * 3);
  for (let i = 0; i < ecN; i++){
    let v;
    const kind = i % 4;
    if (kind === 0){ const r = -Math.log(1 - Math.random() * .97) * 1.1; v = new THREE.Vector3().randomDirection().multiplyScalar(r); }
    else { const ax = ['x', 'y', 'z'][kind - 1]; const r = 1.2 + Math.abs(rand(-1, 1)) * 2.6, s = Math.random() < .5 ? -1 : 1; v = new THREE.Vector3().randomDirection().multiplyScalar(r * .55); v[ax] = s * (Math.abs(v[ax]) + r * .75); }
    ecPos.set([v.x, v.y, v.z], i * 3);
  }
  const ecGeo = new THREE.BufferGeometry(); ecGeo.setAttribute('position', new THREE.BufferAttribute(ecPos, 3));
  const cloudMat = am(theme(new THREE.PointsMaterial({size: .16, map: glowTex, opacity: .5, blending: THREE.AdditiveBlending}), 'c2'), .5);
  const cloud = new THREE.Points(ecGeo, cloudMat); atomIn.add(cloud);
  // Bohr-style orbits as the familiar emblem
  const orbits = [];
  [[PI / 2, 0], [PI / 2, PI / 3], [PI / 2, -PI / 3]].forEach(([rx, rz], i) => {
    const o = new THREE.Group(); o.rotation.set(rx + .25, 0, rz); atomIn.add(o);
    o.add(new THREE.Mesh(new THREE.TorusGeometry(4.2, .022, 8, 140), am(theme(new THREE.MeshBasicMaterial({opacity: .5}), 'c1'), .5)));
    const sp = new THREE.Group(); o.add(sp);
    const e = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), am(new THREE.MeshBasicMaterial({color: 0xffffff, opacity: 1}), 1)); e.position.x = 4.2; sp.add(e);
    const eg = glow(0xffffff, 1.3, .9); theme(eg.material, 'c1'); am(eg.material, .9); eg.position.x = 4.2; sp.add(eg);
    orbits.push({sp, v: .0011 + i * .00035});
  });
  // nucleus: 6 protons + 6 neutrons
  const NUC_R = .2, nucleons = [];
  const pMat = am(new THREE.MeshStandardMaterial({color: 0xff6b81, emissive: 0xff3355, emissiveIntensity: .45, roughness: .35, metalness: .1, opacity: 1}), 1);
  const nMat = am(new THREE.MeshStandardMaterial({color: 0x9fb4ff, emissive: 0x3a55c8, emissiveIntensity: .45, roughness: .35, metalness: .1, opacity: 1}), 1);
  const NUCP = [[0, 0, 0]];
  for (let i = 0; i < 11; i++){ const y = 1 - (i / 10) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; NUCP.push([Math.cos(th) * r * .34, y * .34, Math.sin(th) * r * .34]); }
  let front = 0; NUCP.forEach((p, i) => { if (p[2] > NUCP[front][2]) front = i; });
  const sphereG = new THREE.SphereGeometry(NUC_R, 32, 24);
  NUCP.forEach((p, i) => {
    const isP = i === front || i % 2 === 0;
    if (i === front) return;                                         // the front proton is built separately so we can enter it
    const m = new THREE.Mesh(sphereG, isP ? pMat : nMat); m.position.set(...p); atomIn.add(m); nucleons.push(m);
  });
  const nucGlow = glow(0xff9db4, 2.6, .55); am(nucGlow.material, .55); atomIn.add(nucGlow);
  // the proton we zoom into: a translucent bag holding u, u, d
  const PP = new THREE.Vector3(...NUCP[front]);
  const proton = new THREE.Group(); proton.position.copy(PP); atomIn.add(proton);
  const shellMat = am(new THREE.MeshStandardMaterial({color: 0xff6b81, emissive: 0xff3355, emissiveIntensity: .5, roughness: .4, opacity: 1, side: THREE.DoubleSide}), 1);
  proton.add(new THREE.Mesh(sphereG, shellMat));
  const QR = .026, QD = .085;
  const QUARKS = [{n: 'u', c: 0xff4d5e}, {n: 'u', c: 0x46e08a}, {n: 'd', c: 0x4d8bff}];   // colour charge: red, green, blue
  const qObjs = QUARKS.map((q, i) => {
    const a = i / 3 * 2 * PI + .4, pos = new THREE.Vector3(Math.cos(a) * QD, Math.sin(a) * QD, (i - 1) * .02);
    const m = new THREE.Mesh(new THREE.SphereGeometry(QR, 32, 24), am(new THREE.MeshStandardMaterial({color: q.c, emissive: q.c, emissiveIntensity: .8, roughness: .3, opacity: 1, side: THREE.DoubleSide}), 1));
    m.position.copy(pos); proton.add(m);
    const g = glow(q.c, QR * 7, .8); am(g.material, .8); g.position.copy(pos); proton.add(g);
    return {m, g, pos, base: pos.clone(), ph: rand(0, 6)};
  });
  // gluon flux tubes: wiggly springs between the quarks
  const gluons = [];
  [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => {
    const n = 60, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = am(new THREE.LineBasicMaterial({color: 0xffe08a, opacity: .85, blending: THREE.AdditiveBlending}), .85);
    proton.add(new THREE.Line(geo, m)); gluons.push({a, b, pos, geo, n, m});
  });
  // virtual quark–antiquark pairs popping in and out of the "sea"
  const seaN = 46, seaPos = new Float32Array(seaN * 3), sea = [];
  for (let i = 0; i < seaN; i++) sea.push({p: new THREE.Vector3().randomDirection().multiplyScalar(rand(.02, .17)), t: rand(0, 1), v: rand(.0006, .0014)});
  const seaGeo = new THREE.BufferGeometry(); seaGeo.setAttribute('position', new THREE.BufferAttribute(seaPos, 3));
  const seaMat = am(new THREE.PointsMaterial({size: .012, map: glowTex, color: 0xffd6f0, opacity: .8, blending: THREE.AdditiveBlending}), .8);
  proton.add(new THREE.Points(seaGeo, seaMat));
  // inside the quark: a hypothetical vibrating string (string theory, untested)
  const QF = qObjs[0];
  const strN = 220, strPos = new Float32Array(strN * 3), strGeo = new THREE.BufferGeometry(); strGeo.setAttribute('position', new THREE.BufferAttribute(strPos, 3));
  const strMat = am(new THREE.LineBasicMaterial({color: 0xffffff, opacity: 1, blending: THREE.AdditiveBlending}), 1);
  const strLine = new THREE.LineLoop(strGeo, strMat); QF.m.add(strLine);
  const strGlow = glow(0xbfe9ff, .007, .35); am(strGlow.material, .35); QF.m.add(strGlow);

  // stage table: zoom (scale) and focus point for each level
  const QFOCUS = () => PP.clone().add(QF.pos);
  const STAGES = [
    {p: 0,   s: 1,    f: () => new THREE.Vector3()},
    {p: .22, s: 7.5,  f: () => new THREE.Vector3()},
    {p: .45, s: 24,   f: () => PP.clone()},
    {p: .68, s: 150,  f: QFOCUS},
    {p: .92, s: 1500, f: QFOCUS}
  ];
  const HUD = [
    ['Atom',      '~10⁻¹⁰ m', 'Electrons live in a probability cloud around a tiny, dense nucleus.'],
    ['Nucleus',   '~10⁻¹⁴ m', 'Protons and neutrons, held together by the strong force.'],
    ['Proton',    '~10⁻¹⁵ m', 'Two up quarks and one down quark, bound by gluons. Virtual pairs flicker in the sea.'],
    ['Quark',     '< 10⁻¹⁸ m', 'As far as experiments can see, quarks have no inner structure. Each carries a colour charge.'],
    ['String?',   '~10⁻³⁵ m', 'Hypothetical: string theory pictures a tiny vibrating string. It has not been tested.']
  ];
  const hudList = document.getElementById('scaleList'), hudBar = document.getElementById('scaleBar'), hudNote = document.getElementById('scaleNote');
  if (hudList) hudList.innerHTML = HUD.map(([n, m]) => `<li><b>${n}</b><span>${m}</span></li>`).join('');
  const hudItems = hudList ? [...hudList.children] : [];
  let hudStage = -1;
  const atomP = new THREE.Vector3(), tmpF = new THREE.Vector3();
  let eduStart = 0, eduLen = 1, eduP = 0, eduSm = 0;
  function measureEdu(){
    const sec = document.getElementById('education'), pin = document.getElementById('eduPin'), grid = document.getElementById('eduGrid');
    if (!sec) return;
    const top = sec.getBoundingClientRect().top + scrollY, h = sec.offsetHeight;
    const pinned = pin && getComputedStyle(pin).position === 'sticky';
    eduStart = pinned ? top : grid.getBoundingClientRect().bottom + scrollY - innerHeight * .3;
    eduLen = Math.max(200, top + h - innerHeight - eduStart);
    // where the atom sits on screen: right column on wide screens, centred behind the HUD on narrow ones
    const r = rig(EDU_Z, 0, 0), fwd = r.look.clone().sub(r.pos).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const halfW = ATOM_D * Math.tan(31 * PI / 180) * camera.aspect, wide = innerWidth >= 900;
    atomP.copy(r.pos).addScaledVector(fwd, ATOM_D).addScaledVector(right, wide ? halfW * .44 : 0).add(new THREE.Vector3(0, wide ? 1.9 : -.9, 0));
  }
  function stageAt(p){
    let i = 0; while (i < STAGES.length - 2 && p > STAGES[i + 1].p) i++;
    const A = STAGES[i], B = STAGES[i + 1], k = smooth(p, A.p, B.p);
    const ls = Math.log(A.s) + (Math.log(B.s) - Math.log(A.s)) * k;
    tmpF.copy(A.f()).lerp(B.f(), k);
    let level = 0; for (let j = 1; j < STAGES.length; j++) if (ls > (Math.log(STAGES[j - 1].s) + Math.log(STAGES[j].s)) / 2) level = j;
    return {s: Math.exp(ls), level};
  }
  anims.push((t, dt) => {
    const d = -camZ, near = smooth(d, 236, 262) * (1 - smooth(d, 271, 283));
    atomRoot.visible = near > .01;
    if (!atomRoot.visible) return;
    const eduT = clamp01((scrollY - eduStart) / eduLen);
    eduSm += (eduT - eduSm) * (1 - Math.exp(-dt / 170));         // glide, so hitches and fast wheel flicks don't jerk the zoom
    if (Math.abs(eduT - eduSm) < .0004) eduSm = eduT;
    eduP = eduSm;
    const st = stageAt(eduP), s = st.s, ls = Math.log(s);
    atomIn.scale.setScalar(s);
    atomIn.position.copy(atomP).addScaledVector(tmpF, -s);
    // fade each level in and out as we pass through it
    const fCloud = 1 - smooth(ls, Math.log(1.6), Math.log(4.5));
    const fNuc = 1 - smooth(ls, Math.log(11), Math.log(20));
    const fShell = 1 - smooth(ls, Math.log(14), Math.log(34));
    const fQuark = 1 - smooth(ls, Math.log(260), Math.log(700));
    const fGluon = 1 - smooth(ls, Math.log(220), Math.log(600));
    const fStr = smooth(ls, Math.log(180), Math.log(650));
    cloudMat.opacity = cloudMat.userData.base * fCloud * near;
    orbits.forEach(o => { o.sp.rotation.z += dt * o.v; });
    orbits.forEach(o => o.sp.parent.children[0].material.opacity = .5 * fCloud * near);
    orbits.forEach(o => o.sp.children.forEach(c => c.material.opacity = c.material.userData.base * fCloud * near));
    pMat.opacity = nMat.opacity = fNuc * near; pMat.depthWrite = nMat.depthWrite = pMat.opacity > .9; nucGlow.material.opacity = .55 * fNuc * near;
    nucleons.forEach(m => m.visible = fNuc > .02);
    shellMat.opacity = (.22 + .78 * (1 - smooth(ls, Math.log(5), Math.log(14)))) * fShell * near; shellMat.depthWrite = shellMat.opacity > .9;
    qObjs.forEach(q => { q.m.material.opacity = (.4 + .6 * (1 - smooth(ls, Math.log(150), Math.log(260)))) * fQuark * near; q.m.material.depthWrite = q.m.material.opacity > .9; q.g.material.opacity = .8 * fQuark * near; });
    // quarks jiggle (asymptotic freedom: loose up close, held at a distance)
    qObjs.forEach(q => { q.pos.copy(q.base).add(new THREE.Vector3(Math.sin(t * .0021 + q.ph), Math.cos(t * .0017 + q.ph * 1.3), Math.sin(t * .0013 + q.ph * .7)).multiplyScalar(.006)); q.m.position.copy(q.pos); q.g.position.copy(q.pos); });
    for (const gl of gluons){
      const A = qObjs[gl.a].pos, B = qObjs[gl.b].pos, dir = B.clone().sub(A), len = dir.length(); dir.normalize();
      const n1 = new THREE.Vector3(-dir.y, dir.x, 0).normalize(), n2 = new THREE.Vector3().crossVectors(dir, n1);
      for (let i = 0; i < gl.n; i++){
        const u = i / (gl.n - 1), env = Math.sin(u * PI), ph = u * 34 - t * .012;
        const x = A.x + dir.x * len * u + (n1.x * Math.cos(ph) + n2.x * Math.sin(ph)) * .007 * env;
        const y = A.y + dir.y * len * u + (n1.y * Math.cos(ph) + n2.y * Math.sin(ph)) * .007 * env;
        const z = A.z + dir.z * len * u + (n1.z * Math.cos(ph) + n2.z * Math.sin(ph)) * .007 * env;
        gl.pos[i*3] = x; gl.pos[i*3+1] = y; gl.pos[i*3+2] = z;
      }
      gl.geo.attributes.position.needsUpdate = true;
    }
    gluons.forEach(g => { g.m.opacity = .85 * fGluon * smooth(ls, Math.log(6), Math.log(16)) * near; });
    // sea of virtual pairs
    for (let i = 0; i < seaN; i++){ const o = sea[i]; o.t += o.v * dt; if (o.t > 1){ o.t = 0; o.p.randomDirection().multiplyScalar(rand(.02, .17)); } const k = Math.sin(o.t * PI); seaPos.set([o.p.x * (1 + .2 * k), o.p.y * (1 + .2 * k), o.p.z * (1 + .2 * k)], i * 3); }
    seaGeo.attributes.position.needsUpdate = true;
    seaMat.opacity = .8 * smooth(ls, Math.log(9), Math.log(20)) * fGluon * near; seaMat.size = .012;
    // the string: a closed loop vibrating in a few modes
    if (fStr > .01){
      const R0 = .0026;
      for (let i = 0; i < strN; i++){ const a = i / strN * 2 * PI;
        const r = R0 * (1 + .22 * Math.sin(3 * a + t * .004) + .12 * Math.sin(5 * a - t * .006));
        strPos[i*3] = Math.cos(a) * r; strPos[i*3+1] = Math.sin(a) * r; strPos[i*3+2] = .0009 * Math.sin(2 * a + t * .003); }
      strGeo.attributes.position.needsUpdate = true;
    }
    strMat.opacity = fStr * near; strLine.visible = fStr > .01; strGlow.material.opacity = .6 * fStr * near;
    // HUD
    if (hudBar) hudBar.style.transform = `scaleX(${eduP.toFixed(4)})`;
    if (st.level !== hudStage && hudItems.length){
      hudStage = st.level;
      hudItems.forEach((li, i) => { li.classList.toggle('on', i === hudStage); li.classList.toggle('past', i < hudStage); });
      if (hudNote) hudNote.textContent = HUD[hudStage][2];
    }
  });

  // ======================================================
  // 6. FINALE — a neural sphere: signals racing between nodes
  // ======================================================
  const FN = chapter(-322, -360);
  const brain = new THREE.Group(); brain.position.set(0, 1.2, -336); FN.add(brain);
  const BN = 120, bn = [];
  for (let i = 0; i < BN; i++){ const y = 1 - (i / (BN - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; bn.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(5.2)); }
  const edges = [], seg = [];
  bn.forEach((a, i) => { bn.map((b, j) => [j, a.distanceToSquared(b)]).filter(o => o[0] !== i).sort((x, y) => x[1] - y[1]).slice(0, 3).forEach(([j]) => { if (i < j){ edges.push([i, j]); seg.push(a.x, a.y, a.z, bn[j].x, bn[j].y, bn[j].z); } }); });
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
  brain.add(new THREE.LineSegments(bGeo, FN.track(lineMat('c2', .35))));
  const bpGeo = new THREE.BufferGeometry().setFromPoints(bn);
  brain.add(new THREE.Points(bpGeo, FN.track(theme(new THREE.PointsMaterial({size: .45, map: glowTex, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending}), 'c1'), .9)));
  const bCore = glow(0xffffff, 9, .45); theme(bCore.material, 'c2'); FN.track(bCore.material, .45); brain.add(bCore);
  const sigs = Array.from({length: (FX.lite || small) ? 12 : 26}, () => { const g = glow(0xffffff, .9, 0); theme(g.material, 'c1'); g.material.userData.live = true; brain.add(g); return {g, e: pick(edges), k: Math.random(), v: rand(.0008, .0016)}; });
  anims.push((t, dt) => {
    if (!FN.visible) return;
    brain.rotation.y += dt * .00012; brain.rotation.x = Math.sin(t * .0002) * .15;
    for (const s of sigs){ s.k += s.v * dt; if (s.k >= 1){ s.k = 0; s.e = pick(edges); } s.g.position.lerpVectors(bn[s.e[0]], bn[s.e[1]], s.k); s.g.material.opacity = Math.sin(s.k * PI) * .95 * FN.fade; }
  });

  // ======================================================
  // CAMERA — scroll drives a cinematic flight
  // (it parks at the atom while the education section scrolls)
  // ======================================================
  const KEYS = [['top', 0], ['about', -60], ['skills', -116], ['experience', -176], ['projects', -222], ['@eduIn', EDU_Z], ['@eduOut', EDU_Z], ['playground', -300], ['contact', -318]];
  let marks = [];
  function measure(){
    measureEdu();
    marks = KEYS.map(([id, z]) => {
      if (id === '@eduIn') return [eduStart + innerHeight * .35, z];
      if (id === '@eduOut') return [eduStart + eduLen + innerHeight * .35, z];
      const el = document.getElementById(id); return el ? [el.getBoundingClientRect().top + scrollY, z] : null;
    }).filter(Boolean);
    for (let i = 1; i < marks.length; i++) if (marks[i][0] <= marks[i - 1][0]) marks[i][0] = marks[i - 1][0] + 1;
  }
  function targetZ(){
    const y = scrollY + innerHeight * .35;
    if (y <= marks[0][0]) return marks[0][1];
    for (let i = 0; i < marks.length - 1; i++){
      const [y0, z0] = marks[i], [y1, z1] = marks[i + 1];
      if (y < y1){ const k = (y - y0) / (y1 - y0); return z0 + (z1 - z0) * (k * k * (3 - 2 * k)); }
    }
    return marks[marks.length - 1][1];
  }
  // camera position and look target for a given depth (shared with the atom placement)
  function rig(z, mx, my){
    const x = Math.sin(z * .045) * 1.6 + mx * 1.1, y = Math.cos(z * .035) * .9 + .6 - my * .7;
    return {pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(x * .35 + mx * .6, y * .5 - .2 - my * .3, z - 14)};
  }
  let camZ = 0, lastZ = 0, speed = 0, mx = 0, my = 0, tmx = 0, tmy = 0, fov = 62;
  addEventListener('pointermove', e => { tmx = e.clientX / innerWidth * 2 - 1; tmy = e.clientY / innerHeight * 2 - 1; }, {passive: true});

  function resize(){
    renderer.setPixelRatio(quality());
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); placeSolar(); measure();
  }
  addEventListener('resize', () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 150); });
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  setTimeout(measure, 1500);
  if ('ResizeObserver' in window){ let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(measure, 160); }).observe(document.body); }
  document.addEventListener('themechange', readTheme);
  readTheme(); measure();
  window.Scene3D = { get eduP(){ return eduP; }, measure };

  let t = 0, wasLite = FX.lite, skip = 0, idleSkip = 0;
  loop(60, (now, dt0) => {
    if (FX.idle && !atomRoot.visible && (idleSkip++ % 2)) return;   // nothing moving: 30fps (never during the atom zoom)
    if (FX.lite !== wasLite){ wasLite = FX.lite; renderer.setPixelRatio(quality()); renderer.setSize(innerWidth, innerHeight, false); }
    if (FX.lite && (skip++ % 2)) return;                     // lite: 30fps
    const dt = Math.min(dt0, 50); t += dt;
    // ease the camera towards the scroll position (cinematic lag)
    camZ += (targetZ() - camZ) * (1 - Math.exp(-dt / 260));
    speed = speed * .8 + ((camZ - lastZ) / dt * 1000) * .2; lastZ = camZ;
    mx += (tmx - mx) * .04; my += (tmy - my) * .04;
    const r = rig(camZ, mx, my);
    camera.position.copy(r.pos);
    camera.lookAt(r.look);
    camera.rotation.z += Math.sin(camZ * .02) * .035;
    const f = 62 + Math.min(Math.abs(speed) * .35, 16);
    if (Math.abs(f - fov) > .05){ fov += (f - fov) * .15; camera.fov = fov; camera.updateProjectionMatrix(); }
    updateStreaks(speed);
    for (const a of anims) a(t, dt);
    renderer.render(scene, camera);
  });
})();
