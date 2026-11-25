// CHANGE SUMMARY (2026-11-25, 9): removed the 'sim-focus' fade. The network now keeps running through
//  the Playground; network.js draws it faintly over the four RAG cards (frosted glass in vishnu.css).
// ==========================================================
// SIMS — Playground simulations (replaces the old games)
//
// CHANGE SUMMARY (2026-11-25)
//  - js/games.js removed (Neural Paint, Stack Memory, Bug Smash).
//  - NEW  1. RAG   : question -> 16-number concept embedding ->
//                    exact cosine search over 17 notes (what FAISS
//                    IndexFlatIP does) -> top-k chunks -> prompt ->
//                    simulated "LLM" answer built only from them.
//  - 2. GHOST agent -> added 2026-11-25 in js/ghost.js
//         3. Attention -> added 2026-11-25 in js/attention.js
//
// Public API:  Sims.open(name) -> bool    Sims.ask(question)
//              SimGate(panelId) -> gate used by every simulation (runs only while its tab is open)
// Nothing here calls a server or a model; it all runs in the page.
// ==========================================================
window.Sims = (function(){
  'use strict';
  const el = id => document.getElementById(id);
  const G = makeGate('game-rag');                                           // see makeGate below
  const wait = ms => G.wait(ms);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const backOut = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  // ---------- run gate: a simulation runs ONLY while its tab is open ----------
  // Open = the panel's tab is selected AND the panel is on screen AND the browser
  // tab is visible. While closed, nothing ticks: timers and animation frames are
  // queued and the simulation clock freezes, so a run pauses mid-step and resumes
  // exactly where it left off. CSS animations inside the panel pause too.
  function makeGate(panelId){
    const panel = document.getElementById(panelId);
    let onScreen = false, open = false, pausedAt = performance.now(), pausedTotal = 0;
    const queue = [], openers = [];
    function update(){
      const o = !!panel && panel.classList.contains('active') && onScreen && !document.hidden;
      if (o === open) return;
      open = o;
      if (panel) panel.classList.toggle('sim-paused', !o);
      if (o){ pausedTotal += performance.now() - pausedAt; queue.splice(0).forEach(f => f()); openers.slice().forEach(f => f()); }
      else pausedAt = performance.now();
    }
    // simulation time: does not advance while the gate is closed
    const now = () => performance.now() - pausedTotal - (open ? 0 : performance.now() - pausedAt);
    function wait(ms){
      const end = now() + ms;
      return new Promise(res => { const tick = () => { if (!open) return queue.push(tick); const left = end - now(); if (left <= 0) return res(); setTimeout(tick, Math.min(left, 120)); }; tick(); });
    }
    // like requestAnimationFrame, but held back while closed; cb receives simulation time
    function frame(cb){ const go = () => requestAnimationFrame(() => open ? cb(now()) : queue.push(go)); open ? go() : queue.push(go); }
    if (panel){
      panel.classList.add('sim-paused');                                       // closed until proven open
      new IntersectionObserver(es => { onScreen = es[0].isIntersecting; update(); }, { threshold: .05 }).observe(panel);
      new MutationObserver(update).observe(panel, { attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('visibilitychange', update);
    return { wait, frame, now, after: (ms, fn) => { wait(ms).then(fn); }, isOpen: () => open, onOpen(f){ openers.push(f); if (open) f(); } };
  }
  window.SimGate = makeGate;

  // ---------- tabs ----------
  const PANELS = ['rag', 'ghost', 'attention'];  // ghost → js/ghost.js, attention → js/attention.js
  function open(name){
    if (PANELS.indexOf(name) < 0) return false;
    document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t.dataset.game === name));
    document.querySelectorAll('.game').forEach(g => g.classList.toggle('active', g.id === 'game-' + name));
    return true;
  }
  document.querySelectorAll('.ptab').forEach(t => {
    t.addEventListener('click', () => { if (!t.disabled) open(t.dataset.game); });
  });

  // ==========================================================
  //  1. RAG
  // ==========================================================
  if (!el('ragMap')) return { open, ask(){} };

  // ---- the "embedding model": 16 concept dimensions, a small word lexicon ----
  const CONCEPTS = [
    ['LLM',    'llm ollama vllm model language local gpt generate ai inference prompt intelligence assistant ghost'],
    ['RAG',    'rag faiss vector embedding embeddings search index retrieval retrieve context chunk document documents semantic similarity knowledge ghost'],
    ['memory', 'memory remember sqlite persistent session history recall store stored forget ghost'],
    ['tools',  'mcp tool tools agent agentic browser filesystem file files protocol assistant web plan planning automation ghost'],
    ['work',   'aims hospital intern internship work job jobs experience company amrita digital transformation team role internal'],
    ['flows',  'hr attendance biometric shift procurement workflow approval purchase request employee ptc notification schedule scheduling'],
    ['mail',   'ticket tickets email outlook facility facilities department route assign track automate automation frappe'],
    ['docs',   'resume pdf parse parser json form recruitment candidate extract structured vllm'],
    ['data',   'sql database pathology migration migrate mssql excel data record records server clean validate'],
    ['vision', 'research image images gan sam clip galip segmentation vision paper publication region mask accuracy'],
    ['evolve', 'neat flappy bird evolution neuroevolution game play mutation crossover score neural network learn fitness'],
    ['study',  'education degree mca cgpa college study studied university bsc master bachelor school graduate academic amrita vishwa'],
    ['phys',   'physics atom science quark quarks field fields proton nucleus curiosity math'],
    ['stack',  'python fastapi java javascript skill skills stack tech technology django frappe sql sqlite framework code program programming backend'],
    ['reach',  'contact hire hiring open available linkedin reach email location kochi kerala based relocate remote opportunity roles github job jobs'],
    ['honors', 'ncc army award awards certificate certificates certification leetcode rajputana camp grade problem solving achievement achievements hobby practise']
  ];
  const D = CONCEPTS.length;
  const STOP = new Set(('a an the is are was were be been what which who whom how does do did of to in on for with and or he his him ' +
    'vishnu about tell me can could it its this that by at from as has have had use uses used give show please i you your my any some ' +
    'there their they them also').split(' '));

  function stem(w){
    for (let n = 0; n < 2; n++){
      if (w.length <= 4) break;
      if (w.endsWith('ing')) w = w.slice(0, -3);
      else if (w.endsWith('ed')) w = w.slice(0, -2);
      else if (w.endsWith('es')) w = w.slice(0, -2);
      else if (w.endsWith('s')) w = w.slice(0, -1);
      else break;
    }
    return w;
  }
  const LEX = new Map();
  CONCEPTS.forEach((c, d) => c[1].split(' ').forEach(w => {
    const s = stem(w), a = LEX.get(s) || [];
    if (a.indexOf(d) < 0) a.push(d);
    LEX.set(s, a);
  }));

  // text -> every word classified (stop / unknown / known) + a 16-number vector
  function analyze(text){
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(w => {
      if (w.length < 2 || STOP.has(w)) return { w, type: 'stop' };
      const dims = LEX.get(stem(w));
      return dims ? { w, type: 'known', dims } : { w, type: 'unknown' };
    });
  }
  function embed(text){
    const toks = analyze(text), raw = new Array(D).fill(0);
    toks.forEach(t => { if (t.dims) t.dims.forEach(d => { raw[d] += 1 / Math.sqrt(t.dims.length); }); });
    const norm = Math.hypot.apply(null, raw);
    return { vec: norm ? raw.map(x => x / norm) : raw, raw, norm, toks, empty: !norm };
  }
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

  // ---- the knowledge base: 17 notes about Vishnu (g = colour group) ----
  const CHUNKS = [
    { g: 0, title: 'GHOST overview',   text: "GHOST is Vishnu's personal AI operating system: a local assistant that runs on his own machine with an Ollama language model, persistent memory and tools." },
    { g: 0, title: 'GHOST retrieval',  text: 'GHOST uses RAG: documents are turned into embeddings, stored in a FAISS vector index, and the top-k chunks are searched and passed to the local LLM as context.' },
    { g: 0, title: 'GHOST memory',     text: 'GHOST keeps persistent memory in SQLite, so it remembers earlier tasks and conversations across sessions.' },
    { g: 0, title: 'GHOST tools (MCP)',text: 'Through the Model Context Protocol (MCP), GHOST has browser and filesystem tools: it can search the web, extract content and manage files.' },
    { g: 1, title: 'Role at AIMS',     text: 'He is an Application Developer Intern in the Digital Transformation team at Amrita Institute of Medical Sciences (AIMS), Kochi, building internal hospital tools.' },
    { g: 1, title: 'Resume Bank',      text: 'Resume Bank parses PDF resumes with a vLLM-served model into structured JSON and fills the recruitment form automatically.' },
    { g: 1, title: 'Ticketing',        text: 'The facilities ticketing system reads Outlook emails, creates tickets in Frappe, assigns each one to a department and tracks it.' },
    { g: 1, title: 'HR platform',      text: 'The internal HR platform, still in progress, covers employee records, biometric attendance, shift scheduling and approval notifications.' },
    { g: 1, title: 'PTC Weaver',       text: 'PTC Weaver rebuilt purchase request and approval workflows for a procurement system that had been unused for about 16 years.' },
    { g: 1, title: 'Pathology data',   text: 'Pathology records were extracted from a live SQL Server database, cleaned and validated in Excel, and migrated into Frappe.' },
    { g: 2, title: 'Research',         text: 'His research combines GALIP, SAM and CLIP in a training-free pipeline that controls regions of generated images, reaching 78% region-selection accuracy over 120 prompts.' },
    { g: 2, title: 'NEAT agent',       text: 'A NEAT neuroevolution agent learned to play Flappy Bird by evolving neural networks through mutation and crossover, with a best score of 175.' },
    { g: 2, title: 'Education',        text: 'Vishnu completed an MCA at Amrita Vishwa Vidyapeetham, Kochi, with a CGPA of 9.00, after a B.Sc in Physics at Bharata Mata College.' },
    { g: 2, title: 'Physics roots',    text: 'He studied Physics first, which is where he learned to like models of how things work, from atoms and fields down to quarks.' },
    { g: 2, title: 'Tech stack',       text: 'His main stack is Python with FastAPI, plus SQL, SQLite, Frappe, Java and JavaScript.' },
    { g: 2, title: 'Open to roles',    text: 'He is open to AI Engineer, Agentic AI Engineer and Software Engineer roles, is based in Kochi, Kerala, and can be reached by email or on LinkedIn.' },
    { g: 2, title: 'Awards',           text: 'He holds the NCC B and C certificates with A Grade, attended the Army Attachment Camp with 22 Rajputana Rifles, and practises problem solving on LeetCode.' }
  ];
  CHUNKS.forEach(c => { c.vec = embed(c.title + '. ' + c.text).vec; });
  const GROUP_NAMES = ['GHOST', 'AIMS work', 'Research, study & about'];

  // ---- 2-D map: PCA of the chunk vectors, then a little push-apart ----
  const POS = (function layout(){
    const n = CHUNKS.length, mean = new Array(D).fill(0);
    CHUNKS.forEach(c => c.vec.forEach((v, j) => { mean[j] += v / n; }));
    const X = CHUNKS.map(c => c.vec.map((v, j) => v - mean[j]));
    const pcs = [];
    for (let k = 0; k < 2; k++){
      let w = Array.from({ length: D }, (_, j) => Math.sin(j * 1.7 + k + 1));
      for (let it = 0; it < 60; it++){
        const t = X.map(r => r.reduce((s, v, j) => s + v * w[j], 0));
        const nw = new Array(D).fill(0);
        X.forEach((r, i) => r.forEach((v, j) => { nw[j] += v * t[i]; }));
        pcs.forEach(p => { const d = dot(nw, p); p.forEach((pv, j) => { nw[j] -= d * pv; }); });
        const nn = Math.hypot.apply(null, nw) || 1;
        w = nw.map(v => v / nn);
      }
      pcs.push(w);
    }
    const P = X.map(r => pcs.map(p => dot(r, p)));
    [0, 1].forEach(a => {
      const lo = Math.min.apply(null, P.map(p => p[a])), hi = Math.max.apply(null, P.map(p => p[a]));
      const order = P.map((p, i) => i).sort((x, y) => P[x][a] - P[y][a]), rank = [];
      order.forEach((i, r) => { rank[i] = r / (P.length - 1); });
      P.forEach((p, i) => { p[a] = 0.5 * (p[a] - lo) / ((hi - lo) || 1) + 0.5 * rank[i]; });   // half linear, half rank: spreads clusters out
    });
    const MIN = 0.17;
    for (let it = 0; it < 160; it++){
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++){
        let dx = (P[j][0] - P[i][0]) * 1.7, dy = P[j][1] - P[i][1];
        let d = Math.hypot(dx, dy);
        if (d >= MIN) continue;
        if (d < 1e-4){ dx = Math.cos(i * 2.4); dy = Math.sin(i * 2.4); d = 1; }
        const push = (MIN - d) / 2 / d;
        P[i][0] -= dx * push / 1.7; P[i][1] -= dy * push;
        P[j][0] += dx * push / 1.7; P[j][1] += dy * push;
      }
      P.forEach(p => { p[0] = clamp(p[0], 0.05, 0.95); p[1] = clamp(p[1], 0.07, 0.93); });
    }
    return P;
  })();

  // ---- state ----
  const THRESH = 0.2;                 // below this a chunk is "not close enough" to answer from
  let K = 3, run = 0, lastQ = '';
  const S = { q: null, hits: [], hover: -1, dropAt: 0, ringAt: 0, ringR: 0, linesAt: 0, dimAt: 0 };

  // ---- DOM ----
  const input = el('ragQ'), form = el('ragForm'), goBtn = el('ragGo');
  const stepsEl = el('ragSteps'), capEl = el('ragCaption'), tokEl = el('embTokens'), barsEl = el('ragBars');
  const linesEl = el('embLines'), lookEl = el('embLookup'), vecEl = el('embVec'), wrapEl = el('embWrap'), cmpEl = el('ragCompare');
  const hitsEl = el('ragHits'), ansEl = el('ragAnswer'), promptEl = el('ragPrompt');
  const mapEl = el('ragMap');
  const cards = document.querySelectorAll('#game-rag .rag-card');
  const QUICK = typeof reduce !== 'undefined' && reduce;
  const DEFAULT_CMP = 'Hover a note to lay its vector over your question\'s.';

  const cols = CONCEPTS.map((c, i) => {
    const col = document.createElement('div'); col.className = 'emb-col'; col.dataset.d = i;
    col.innerHTML = '<div class="emb-well"><div class="emb-stack"></div><span class="emb-mk"></span><span class="emb-val"></span></div><div class="emb-lab"></div>';
    col.querySelector('.emb-lab').textContent = c[0];
    col.title = c[0] + ' concept. Words like: ' + c[1].split(' ').slice(0, 7).join(', ') + '…';
    barsEl.appendChild(col); return col;
  });
  const EXAMPLES = ['What does GHOST do?', 'How does he use MCP?', 'Tell me about his hospital work', 'What did he study?', 'Is he open to jobs?', 'Does he know Rust?'];
  EXAMPLES.forEach(t => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rag-chip'; b.textContent = t;
    b.addEventListener('click', () => ask(t)); el('ragChips').appendChild(b);
  });
  document.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    K = +b.dataset.k;
    document.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('active', x === b));
    if (lastQ) ask(lastQ);
  }));
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });

  const CAPS = [
    'Ask a question, or pick one above, to watch the pipeline run.',
    'Question: your words go in as plain text.',
    'Embed: each word is looked up in a small vocabulary. A word adds weight to the concepts it belongs to, then the vector is scaled to length 1.',
    'Search: the question vector is compared with every note vector (cosine similarity). The closest notes win.',
    'Retrieve: the top-k notes are pulled out, best first.',
    'Generate: the notes are pasted into a prompt and the local LLM answers only from them (simulated here).'
  ];
  function step(n){
    Array.prototype.forEach.call(stepsEl.children, (li, i) => {
      li.classList.toggle('done', i + 1 < n);
      li.classList.toggle('active', i + 1 === n);
    });
    capEl.textContent = CAPS[n] || CAPS[0];
    cards.forEach(c => { const k = +c.dataset.s; c.classList.toggle('lit', n >= k); c.classList.toggle('cur', n === k); });
  }
  let E = null, curAX = 1;                   // current question embedding + the bar scale it uses
  function clearCompare(){
    cols.forEach(c => c.classList.remove('cmp', 'both'));
    cmpEl.textContent = E ? DEFAULT_CMP : '';
  }
  function reset(){
    S.q = null; S.hits = []; S.dropAt = S.ringAt = S.linesAt = S.dimAt = 0; E = null;
    tokEl.textContent = ''; linesEl.textContent = ''; lookEl.textContent = ''; vecEl.textContent = ''; vecEl.classList.remove('on');
    hitsEl.textContent = ''; ansEl.textContent = ''; promptEl.textContent = ''; cmpEl.textContent = '';
    cols.forEach(c => {
      c.className = 'emb-col';
      const st = c.querySelector('.emb-stack'); st.textContent = ''; st.style.transform = '';
      const v = c.querySelector('.emb-val'); v.textContent = ''; v.style.opacity = 0;
    });
    step(0);
  }

  // ---- canvas ----
  const cx = mapEl.getContext('2d');
  let W = 0, H = 0, visible = false, raf = 0, colT = -1e9;
  let C = { c: ['#4fd1e8', '#8b93f8', '#b48cf6'], text: '#ececf1', bg: '#050507' };
  const PAD = 30;
  const px = p => ({ x: PAD + p[0] * (W - 2 * PAD), y: PAD + p[1] * (H - 2 * PAD) });
  const col = i => C.c[CHUNKS[i].g];

  function resize(){
    const r = mapEl.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    mapEl.width = Math.max(1, Math.round(W * dpr)); mapEl.height = Math.max(1, Math.round(H * dpr));
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    kick();
  }
  function readColors(){
    const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
    C = { c: [g('--c1') || C.c[0], g('--c2') || C.c[1], g('--c3') || C.c[2]], text: g('--text') || C.text, bg: g('--bg') || C.bg };
  }
  function label(txt, x, y, color, placed){
    cx.font = '11px "JetBrains Mono", ui-monospace, monospace';
    const w = cx.measureText(txt).width + 12;
    let lx = x + 11;
    if (lx + w > W - 4) lx = x - 11 - w;
    let ly = clamp(y - 9, 3, H - 21);
    for (let k = 0; k < 12 && placed.some(r => lx < r.x + r.w && lx + w > r.x && ly < r.y + 18 && ly + 18 > r.y); k++){
      ly += 20; if (ly > H - 21) ly = clamp(y - 9 - 20 * (k + 1), 3, H - 21);
    }
    placed.push({ x: lx, y: ly, w });
    cx.globalAlpha = .88; cx.fillStyle = C.bg; cx.beginPath(); if (cx.roundRect) cx.roundRect(lx, ly, w, 18, 6); else cx.rect(lx, ly, w, 18); cx.fill();
    cx.globalAlpha = 1; cx.strokeStyle = color; cx.lineWidth = 1; cx.stroke();
    cx.fillStyle = C.text; cx.textBaseline = 'middle'; cx.fillText(txt, lx + 6, ly + 9.5);
  }
  function dot_(x, y, r, color, a){ cx.globalAlpha = a; cx.fillStyle = color; cx.beginPath(); cx.arc(x, y, r, 0, 6.2832); cx.fill(); }

  function draw(now){
    raf = 0;
    if (!visible || !W) return;
    if (now - colT > 600){ readColors(); colT = now; }
    cx.clearRect(0, 0, W, H);

    // faint dot grid
    cx.fillStyle = C.text; cx.globalAlpha = .06;
    for (let x = 14; x < W; x += 26) for (let y = 14; y < H; y += 26) cx.fillRect(x, y, 1.2, 1.2);

    const hasQ = !!S.q, q = hasQ ? px(S.q) : null;
    const dim = S.dimAt ? ease(clamp((now - S.dimAt) / 400, 0, 1)) : 0;
    const rt = S.ringAt ? (now - S.ringAt) / 900 : -1;
    const rr = rt >= 0 ? ease(clamp(rt, 0, 1)) * S.ringR : 0;

    // search ring
    if (hasQ && rt >= 0 && rt < 1.2){
      const f = clamp(rt, 0, 1);
      cx.lineWidth = 1.5;
      cx.strokeStyle = C.c[0]; cx.globalAlpha = (1 - f) * .85;
      cx.beginPath(); cx.arc(q.x, q.y, rr, 0, 6.2832); cx.stroke();
      cx.globalAlpha = (1 - f) * .35;
      cx.beginPath(); cx.arc(q.x, q.y, rr * .8, 0, 6.2832); cx.stroke();
    }
    // lines to the retrieved chunks
    if (hasQ && S.linesAt){
      const t = ease(clamp((now - S.linesAt) / 500, 0, 1));
      S.hits.forEach(h => {
        const p = px(POS[h.i]);
        cx.globalAlpha = h.ok ? .8 : .4; cx.strokeStyle = col(h.i); cx.lineWidth = 1 + 2 * h.s;
        cx.setLineDash(h.ok ? [] : [4, 4]);
        cx.beginPath(); cx.moveTo(q.x, q.y); cx.lineTo(q.x + (p.x - q.x) * t, q.y + (p.y - q.y) * t); cx.stroke();
      });
      cx.setLineDash([]);
    }
    // chunk points
    const labels = [];
    POS.forEach((p, i) => {
      const o = px(p), rank = S.hits.findIndex(h => h.i === i), isHit = rank >= 0;
      const lit = isHit && hasQ && rt >= 0 && (rt >= 1 || Math.hypot(o.x - q.x, o.y - q.y) <= rr);
      const a = S.hits.length && !isHit ? 1 - .65 * dim : 1;
      const r = 4.5 + Math.sin(now / 900 + i * 1.3) * .35;
      if (lit){ dot_(o.x, o.y, 12, col(i), .2); cx.globalAlpha = 1; cx.strokeStyle = col(i); cx.lineWidth = 1.5; cx.beginPath(); cx.arc(o.x, o.y, 8.5, 0, 6.2832); cx.stroke(); }
      dot_(o.x, o.y, lit ? 5.5 : r, col(i), a);
      if (lit) labels.push([(rank + 1) + ' · ' + CHUNKS[i].title, o.x, o.y, col(i)]);
      else if (S.hover === i) labels.push([CHUNKS[i].title, o.x, o.y, col(i)]);
    });
    if (S.hover >= 0 && S.hits.some(h => h.i === S.hover)) { /* already labelled */ }
    // query point
    if (hasQ && S.dropAt){
      const t = clamp((now - S.dropAt) / 450, 0, 1), s = Math.max(0, backOut(t));
      const pulse = (now / 40) % 40;
      cx.strokeStyle = C.c[0]; cx.lineWidth = 1.2;
      cx.globalAlpha = (1 - pulse / 40) * .5 * t; cx.beginPath(); cx.arc(q.x, q.y, 8 + pulse * .45, 0, 6.2832); cx.stroke();
      dot_(q.x, q.y, 7 * s, C.text, 1);
      cx.globalAlpha = 1; cx.strokeStyle = C.c[0]; cx.lineWidth = 2; cx.beginPath(); cx.arc(q.x, q.y, 10 * s, 0, 6.2832); cx.stroke();
      if (t >= 1) labels.push(['your question', q.x, q.y, C.c[0]]);
    }
    const placed = [];
    labels.sort((a, b) => (a[0] === 'your question' ? -1 : b[0] === 'your question' ? 1 : 0)).forEach(l => label(l[0], l[1], l[2], l[3], placed));
    cx.globalAlpha = 1;
    kick();
  }
  function kick(){ if (visible && !raf){ raf = 1; G.frame(draw); } }        // draw() gets simulation time

  mapEl.addEventListener('pointermove', e => {
    const r = mapEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = 16;
    POS.forEach((p, i) => { const o = px(p), d = Math.hypot(o.x - x, o.y - y); if (d < bd){ bd = d; best = i; } });
    if (best !== S.hover) hoverChunk(best);
    mapEl.style.cursor = best >= 0 ? 'pointer' : 'default';
  });
  mapEl.addEventListener('pointerleave', () => hoverChunk(-1));
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(mapEl); else window.addEventListener('resize', resize);

  // ---- the run: question -> embed -> search -> retrieve -> generate ----
  function queryPos(hits, text){
    let sx = 0, sy = 0, sw = 0;
    hits.forEach(h => { const w = Math.max(h.s, 0.01) * Math.max(h.s, 0.01); sx += POS[h.i][0] * w; sy += POS[h.i][1] * w; sw += w; });
    let h = 7; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 6283;
    const a = h / 1000, off = 0.05 + 0.04 * (1 - (hits[0] ? hits[0].s : 0));
    return [clamp(sx / sw + Math.cos(a) * off, 0.03, 0.97), clamp(sy / sw + Math.sin(a) * off * 1.4, 0.05, 0.95)];
  }

  // ---- step 2, animated: words -> concept dimensions -> unit vector ----
  const TINTS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'color-mix(in srgb,var(--c1) 55%,#fff)', 'color-mix(in srgb,var(--c2) 55%,#fff)', 'color-mix(in srgb,var(--c3) 55%,#fff)'];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const curve = (x1, y1, x2, y2) => { const my = (y1 + y2) / 2; return 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2; };

  async function playEmbed(id, e){
    curAX = Math.max(Math.max.apply(null, e.raw), 1);
    tokEl.textContent = ''; lookEl.textContent = '';
    const chips = e.toks.map(t => {
      const c = document.createElement('span'); c.className = 'emb-tok ' + t.type;
      const w = document.createElement('span'); w.textContent = t.w; c.appendChild(w);
      if (t.type !== 'known'){ const i = document.createElement('i'); i.textContent = t.type === 'stop' ? 'filler' : 'unknown'; c.appendChild(i); }
      c.title = t.type === 'known' ? 'maps to: ' + t.dims.map(d => CONCEPTS[d][0]).join(', ')
        : t.type === 'stop' ? 'filler word, ignored' : 'not in this tiny vocabulary, ignored';
      tokEl.appendChild(c); return c;
    });
    if (!chips.length){ lookEl.textContent = 'No words to embed.'; return; }
    await wait(QUICK ? 0 : 300); if (id !== run) return;
    const dt = QUICK ? 0 : clamp(2300 / chips.length, 240, 480);
    let ti = 0;
    for (let k = 0; k < e.toks.length; k++){
      if (id !== run) return;
      const t = e.toks[k], chip = chips[k];
      chip.classList.add('cur');
      if (t.type === 'known'){
        const tint = TINTS[ti++ % TINTS.length], each = 1 / Math.sqrt(t.dims.length);
        chip.style.setProperty('--tc', tint);
        lookEl.innerHTML = '<b>' + esc(t.w) + '</b> → ' + t.dims.map(d => '<em>' + CONCEPTS[d][0] + '</em>').join(' · ') +
          ' <span>(+' + each.toFixed(2) + ' each' + (t.dims.length > 1 ? ', that is 1/√' + t.dims.length : '') + ')</span>';
        const wr = wrapEl.getBoundingClientRect(), cr = chip.getBoundingClientRect();
        const x1 = cr.left - wr.left + cr.width / 2, y1 = cr.bottom - wr.top;
        t.dims.forEach(d => {
          const col = cols[d], wb = col.firstChild.getBoundingClientRect();
          const p = document.createElementNS(SVGNS, 'path');
          p.setAttribute('d', curve(x1, y1, wb.left - wr.left + wb.width / 2, wb.top - wr.top)); p.style.stroke = tint; linesEl.appendChild(p);
          const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
          requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = 0; }));
          G.after(dt * .85, () => { p.style.opacity = 0; G.after(500, () => p.remove()); });
          const seg = document.createElement('div'); seg.className = 'emb-seg'; seg.style.flex = '0 0 ' + (each / curAX * 100) + '%'; seg.style.setProperty('--sc', tint);
          G.after(QUICK ? 0 : 200, () => { if (id === run) col.querySelector('.emb-stack').appendChild(seg); });
          col.classList.add('hot', 'on'); col.style.setProperty('--hc', tint);
          G.after(dt * .9, () => col.classList.remove('hot'));
        });
      } else {
        lookEl.innerHTML = '<b>' + esc(t.w) + '</b> → ignored <span>(' + (t.type === 'stop' ? 'a filler word, it carries no concept' : 'not in this tiny vocabulary') + ')</span>';
      }
      await wait(t.type === 'known' ? dt : dt * .55);
      chip.classList.remove('cur'); chip.classList.add('done');
    }
    if (id !== run) return;
    if (e.empty){
      lookEl.innerHTML = 'Nothing to add up: no word matched a concept, so the vector is all zeros.';
      vecEl.textContent = 'question = [' + e.vec.map(v => v.toFixed(2)).join(', ') + ']'; vecEl.classList.add('on');
      return;
    }
    const scaled = e.norm > 1.01;
    lookEl.innerHTML = 'Add the weights up, then divide by the vector\'s length (<em>' + e.norm.toFixed(2) + '</em>) so it has length 1' + (scaled ? '.' : ' (already 1 here).');
    await wait(QUICK ? 0 : 500); if (id !== run) return;
    if (scaled) cols.forEach(c => { c.querySelector('.emb-stack').style.transform = 'scaleY(' + (1 / e.norm) + ')'; });
    cols.forEach((c, i) => {
      const v = e.vec[i], val = c.querySelector('.emb-val');
      if (v > 0){ val.textContent = v.toFixed(2); val.style.bottom = 'calc(' + (v / curAX * 100) + '% + 4px)'; val.style.opacity = 1; }
    });
    await wait(QUICK ? 0 : (scaled ? 800 : 250)); if (id !== run) return;
    vecEl.textContent = 'question = [' + e.vec.map(v => v.toFixed(2)).join(', ') + ']'; vecEl.classList.add('on');
    lookEl.innerHTML = 'That list of 16 numbers is the <em>embedding</em> of your question.';
  }

  // hover a note: lay its vector over the question's and show the cosine
  function compare(i){
    if (!E || E.empty) return;
    const c = CHUNKS[i], shared = [];
    cols.forEach((col, d) => {
      const cv = c.vec[d], qv = E.vec[d];
      col.classList.toggle('cmp', cv > 0); col.classList.toggle('both', cv > 0 && qv > 0);
      col.querySelector('.emb-mk').style.bottom = cv > 0 ? (cv / curAX * 100) + '%' : '0';
      if (cv > 0 && qv > 0) shared.push([d, qv * cv]);
    });
    shared.sort((a, b) => b[1] - a[1]);
    cmpEl.innerHTML = '<b>' + esc(c.title) + '</b>: cosine = Σ qᵢ·cᵢ = <em>' + dot(E.vec, c.vec).toFixed(2) + '</em>' +
      (shared.length ? ' · shared: ' + shared.slice(0, 5).map(x => CONCEPTS[x[0]][0]).join(', ') : ' · nothing shared');
  }
  function hoverChunk(i){ S.hover = i; if (i >= 0) compare(i); else clearCompare(); }

  function renderHits(hits, e){
    hitsEl.textContent = '';
    hits.forEach((h, r) => {
      const c = CHUNKS[h.i], d = document.createElement('div');
      d.className = 'rag-hit' + (h.ok ? '' : ' weak');
      d.style.setProperty('--hc', 'var(--c' + (c.g + 1) + ')');
      d.style.animationDelay = (r * 150) + 'ms';
      const head = document.createElement('div'); head.className = 'rag-hit-h';
      const n = document.createElement('b'); n.textContent = r + 1;
      const t = document.createElement('span'); t.textContent = c.title;
      const sc = document.createElement('em'); sc.textContent = h.s.toFixed(2);
      head.append(n, t, sc);
      const bar = document.createElement('div'); bar.className = 'rag-bar';
      const fill = document.createElement('i'); fill.style.width = Math.round(clamp(h.s, 0, 1) * 100) + '%'; bar.appendChild(fill);
      const shared = []; CONCEPTS.forEach((_, k) => { const pr = e.vec[k] * c.vec[k]; if (pr > 1e-4) shared.push([k, pr]); });
      shared.sort((a, b) => b[1] - a[1]);
      const tags = document.createElement('div'); tags.className = 'rag-shared';
      tags.textContent = shared.length ? 'shared: ' + shared.slice(0, 4).map(x => CONCEPTS[x[0]][0]).join(' · ') : 'no shared concepts';
      const p = document.createElement('p'); p.textContent = c.text;
      d.append(head, bar, tags, p);
      d.addEventListener('mouseenter', () => hoverChunk(h.i));
      d.addEventListener('mouseleave', () => hoverChunk(-1));
      hitsEl.appendChild(d);
    });
  }
  async function stream(id, text){
    ansEl.textContent = '';
    const caret = document.createElement('span'); caret.className = 'rag-caret'; ansEl.appendChild(caret);
    for (const t of text.split(' ')){
      if (id !== run) return;
      if (/^\[\d\]$/.test(t)){
        const s = document.createElement('sup'); s.className = 'rag-cite'; s.textContent = t; ansEl.insertBefore(s, caret);
        ansEl.insertBefore(document.createTextNode(' '), caret);
      } else ansEl.insertBefore(document.createTextNode(t + ' '), caret);
      await wait(22);
    }
    caret.remove();
  }

  async function ask(text){
    text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!text){ input.focus(); return; }
    const id = ++run; lastQ = text; input.value = text;
    reset();
    step(1); await wait(350); if (id !== run) return;

    // 2. embed: words -> concept dimensions -> unit vector (animated)
    const e = embed(text); E = e; step(2);
    await playEmbed(id, e); if (id !== run) return;
    await wait(QUICK ? 0 : 450); if (id !== run) return;

    if (e.empty){
      step(5); hitsEl.textContent = '';
      const m = document.createElement('p'); m.className = 'rag-none';
      m.textContent = 'None of these words are in the tiny vocabulary, so the vector is all zeros and there is nothing to search with.';
      hitsEl.appendChild(m);
      return stream(id, "I can't match that question to anything in my notes, so I won't guess. Try asking about GHOST, his work at AIMS, his research or his education.");
    }

    // 3. search: exact cosine similarity against every chunk, keep the top k
    const hits = CHUNKS.map((c, i) => ({ i, s: dot(e.vec, c.vec) })).sort((a, b) => b.s - a.s).slice(0, K);
    hits.forEach(h => { h.ok = h.s >= THRESH; });
    S.hits = hits; S.q = queryPos(hits, text);
    step(3); S.dropAt = G.now(); kick(); await wait(500); if (id !== run) return;
    const q = px(S.q);
    S.ringR = Math.max.apply(null, hits.map(h => { const p = px(POS[h.i]); return Math.hypot(p.x - q.x, p.y - q.y); })) + 26;
    S.ringAt = G.now(); await wait(950); if (id !== run) return;
    S.linesAt = S.dimAt = G.now(); await wait(550); if (id !== run) return;

    // 4. retrieve
    step(4); renderHits(hits, e); cmpEl.textContent = DEFAULT_CMP; await wait(300 + hits.length * 150); if (id !== run) return;

    // 5. generate (simulated: stitches the retrieved chunks together, so it cannot invent facts)
    step(5);
    promptEl.textContent = 'SYSTEM  Answer only from the context. If the answer is not there, say so.\n\nCONTEXT\n' +
      hits.map((h, r) => '[' + (r + 1) + '] ' + CHUNKS[h.i].title + ': ' + CHUNKS[h.i].text).join('\n') +
      '\n\nQUESTION  ' + text;
    const top = hits[0].s;
    const use = hits.map((h, r) => ({ h, r })).filter(x => x.h.s >= THRESH && x.h.s >= top * 0.6).slice(0, 3);
    if (!use.length){
      await stream(id, 'None of the retrieved chunks are close enough to your question (best score ' + top.toFixed(2) +
        '), so I will not make something up. Try asking about GHOST, his work at AIMS, his research or his education.');
    } else {
      await stream(id, use.map(x => CHUNKS[x.h.i].text + ' [' + (x.r + 1) + ']').join(' '));
    }
  }

  // ---- start: draw only while on screen; run one example the first time it is seen ----
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) resize(); }, { threshold: 0 }).observe(mapEl);
  G.onOpen(() => { if (!lastQ) ask(EXAMPLES[0]); });                     // first example plays only once the RAG tab is open
  // (the page-wide network keeps running here; network.js draws it softly over the four RAG cards)
  reset();

  return { open, ask };
})();
