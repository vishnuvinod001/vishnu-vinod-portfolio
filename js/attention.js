// ==========================================================
// ATTENTION — Playground simulation #3 (added 2026-11-25)
//
// One attention head reads a short sentence:
//   1 Tokens  : words become tokens, each with a query (q), key (k)
//               and value (v) vector
//   2 Score   : the chosen token's q is dotted with every k, / √d
//   3 Softmax : scores become weights that sum to 100%
//               (causal mask: a token can't look at later tokens)
//   4 Mix     : the token's new vector = Σ weight × v
//
// The formula is the real one: softmax(Q·Kᵀ / √d) · V. The
// projection weights are hand-set (a trained model learns them),
// so each head does one readable job:
//   coreference   — pronouns look for the thing they refer to
//   previous word — every token looks one step back (positional)
//   verb → subject— verbs look for who is doing the action
// Nothing here calls a server or a model; it all runs in the page.
// ==========================================================
(function(){
  'use strict';
  const el = id => document.getElementById(id);
  if (!el('game-attention')) return;
  const G = window.SimGate('game-attention');                            // runs only while this tab is open
  const wait = ms => G.wait(ms);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

  // ---------- a tiny lexicon: word → type and meaning features ----------
  // value features (what a token "means"), shown in step 4
  const VF = ['AI system', 'person', 'thing', 'place', 'action'];
  const VC = ['var(--c1)', 'var(--c3)', 'var(--c2)', '#f2b55a', '#86efac'];
  const ENT = {                                   // nouns: [AI, person, thing, place]
    ghost: [1, 0, .35, 0], model: [1, 0, .4, 0], ollama: [1, 0, .4, 0], agent: [1, 0, .3, 0], llm: [1, 0, .4, 0], faiss: [.7, 0, .6, 0], assistant: [1, 0, .3, 0],
    vishnu: [0, 1, 0, 0], nurse: [0, 1, 0, 0], doctor: [0, 1, 0, 0], patient: [0, 1, 0, 0], recruiter: [0, 1, 0, 0], team: [0, .9, 0, 0], intern: [0, 1, 0, 0], user: [0, 1, 0, 0],
    file: [0, 0, 1, 0], ticket: [0, 0, 1, 0], resume: [0, 0, 1, 0], report: [0, 0, 1, 0], question: [0, 0, 1, 0], context: [0, 0, .9, 0], record: [0, 0, 1, 0], email: [0, 0, 1, 0], notes: [0, 0, 1, 0], answer: [0, 0, 1, 0], pdf: [0, 0, 1, 0],
    hospital: [0, 0, .2, 1], ward: [0, 0, .2, 1], kochi: [0, 0, 0, 1], aims: [0, .2, 0, .9], lab: [0, 0, .2, 1], office: [0, 0, .2, 1]
  };
  const PRON = { it: 'thing', its: 'thing', he: 'person', she: 'person', him: 'person', her: 'person', they: 'any', them: 'any' };
  const VERBS = new Set(('reads read sent send checked check built build runs run needs need finds find answers answered answer uses used use wrote write fixed fix ' +
    'parses parsed approved approve asked ask opened open searched search learns learned learn sorts sorted made make saw see moved found replied helps helped calls called').split(' '));
  const FUNC = new Set(('the a an and because after before when while so but to of in on at for with from by then that this was is are fast quickly locally again ' +
    'there here now very').split(' '));

  function tokenize(text){
    const words = String(text).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 10);
    return words.map((w, i) => {
      let type, v = [0, 0, 0, 0, 0];
      if (PRON[w]){ type = 'pron'; v = [0, 0, .15, 0, 0]; }                    // a pronoun alone means very little
      else if (ENT[w]){ type = 'ent'; v = ENT[w].concat(0); }
      else if (VERBS.has(w) || /ed$|es$/.test(w) && !FUNC.has(w) && w.length > 4 && i > 0){ type = 'verb'; v = [0, 0, 0, 0, 1]; }
      else if (FUNC.has(w)){ type = 'func'; v = [0, 0, 0, 0, 0]; }
      else { type = 'ent'; v = [0, 0, .8, 0, 0]; }                              // unknown word: treat as a thing
      return { w, i, type, v };
    });
  }

  // ---------- the three heads: hand-set query/key projections ----------
  // q and k are small vectors; score = q·k / √d. Positions use a rotary
  // trick: cos/sin of the position, so "one step back" is a dot product too.
  const D = 4, W1 = 1.6, W2 = .45;                                       // two position frequencies, like sinusoidal encodings
  const pe = (p) => [Math.cos(p * W1), Math.sin(p * W1), Math.cos(p * W2), Math.sin(p * W2)];
  const HEADS = {
    coref: {
      name: 'coreference', hint: 'pronouns look for what they refer to',
      // dims: [AI system, thing, person, is-this-me]
      q(t){
        if (t.type !== 'pron') return [0, 0, 0, 2.2];                         // non-pronouns mostly look at themselves
        const want = PRON[t.w];
        return want === 'thing' ? [4.6, 2.6, 0, .3] : want === 'person' ? [0, 0, 4.6, .3] : [3.2, 2, 3.2, .3];
      },
      k(t, s){
        const e = t.type === 'ent';
        return [e ? t.v[0] : 0, e ? t.v[2] : 0, e ? t.v[1] : 0, t.i === s.i ? 1.6 : 0];
      },
      recency: .35
    },
    prev: {
      name: 'previous word', hint: 'every token looks one step back',
      q(t){ return pe(t.i - 1).map(x => x * 3); },                          // "the position just before mine"
      k(t){ return pe(t.i); },                                                // "my position"
      recency: 0
    },
    subj: {
      name: 'verb → subject', hint: 'a verb looks for who does the action',
      // dims: [can-act (AI, person or pronoun), -, -, is-this-me]
      q(t){ return t.type === 'verb' ? [3.2, 0, 0, .2] : [0, 0, 0, 2.2]; },
      k(t, s){ return [t.type === 'ent' ? Math.max(t.v[0], t.v[1]) : t.type === 'pron' ? .9 : 0, 0, 0, t.i === s.i ? 1.6 : 0]; },
      recency: .55
    }
  };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

  function attend(toks, qi, headKey, causal){
    const H = HEADS[headKey], q = toks[qi], qv = H.q(q);
    const rows = toks.map((t, j) => {
      const masked = causal && j > qi;
      const raw = dot(qv, H.k(t, q));
      // a small recency bias (closest match wins ties), part of the score
      const bias = H.recency ? -H.recency * Math.max(0, qi - j) * .35 : 0;
      const sc = (raw + bias * Math.sqrt(D)) / Math.sqrt(D);
      return { j, t, raw: raw + bias * Math.sqrt(D), sc, masked };
    });
    const live = rows.filter(r => !r.masked), mx = Math.max.apply(null, live.map(r => r.sc));
    let sum = 0; live.forEach(r => { r.e = Math.exp(r.sc - mx); sum += r.e; });
    rows.forEach(r => { r.w = r.masked ? 0 : r.e / sum; });
    const out = [0, 0, 0, 0, 0]; rows.forEach(r => r.t.v.forEach((x, f) => { out[f] += r.w * x; }));
    return { rows, out, qv };
  }

  // ---------- DOM ----------
  const input = el('attQ'), form = el('attForm'), chipsEl = el('attChips'), stepsEl = el('attSteps'), capEl = el('attCaption');
  const tokWrap = el('attTokWrap'), tokEl = el('attToks'), arcsEl = el('attArcs'), scoreEl = el('attScores'), matEl = el('attMatrix'), mixEl = el('attMix'), sayEl = el('attSay');
  const cards = Array.from(document.querySelectorAll('#game-attention .rag-card'));
  const maskBtn = el('attMask');
  const EXAMPLES = ['GHOST reads the file because it needs context', 'The nurse sent the ticket after she checked the ward', 'Vishnu built GHOST and it runs locally', 'The doctor asked the model and it answered fast'];
  EXAMPLES.forEach(x => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rag-chip'; b.textContent = x; b.onclick = () => runSentence(x); chipsEl.appendChild(b); });

  const CAPS = [
    'Type a sentence, or pick one, and watch one attention head read it. Click any token to see what it looks at.',
    'Tokens: each word becomes a token with three small vectors: a query (what am I looking for?), a key (what do I contain?) and a value (what do I pass on?).',
    'Score: the chosen token\'s query is multiplied (dot product) with every key, then divided by √d so the numbers stay in a sensible range.',
    'Softmax: the scores turn into weights that add up to 100%. With the causal mask on, a token cannot look at words that come after it, just like when an LLM writes.',
    'Mix: the token\'s new vector is the weighted sum of the values it attended to. This is how meaning moves between words.'
  ];
  function step(n){
    Array.prototype.forEach.call(stepsEl.children, (li, i) => { li.classList.toggle('done', i + 1 < n); li.classList.toggle('active', i + 1 === n); });
    capEl.textContent = CAPS[n] || CAPS[0];
    cards.forEach(c => { const k = +c.dataset.s; c.classList.toggle('lit', n >= k); c.classList.toggle('cur', n === k); });
  }

  const S = { toks: [], qi: 0, head: 'coref', causal: true, res: null, run: 0, seen: false };
  const typeLabel = { ent: 'noun', pron: 'pronoun', verb: 'verb', func: 'word' };

  function defaultQuery(toks, head){
    if (head === 'coref'){ const p = toks.findIndex(t => t.type === 'pron'); if (p >= 0) return p; }
    if (head === 'subj'){ const v = toks.findIndex((t, i) => t.type === 'verb' && i > 0); if (v >= 0) return v; }
    return toks.length - 1;
  }

  function drawTokens(n){
    tokEl.textContent = '';
    S.toks.slice(0, n).forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'att-tok t-' + t.type + (i === S.qi ? ' q' : '');
      b.innerHTML = '<span>' + esc(t.w) + '</span><i>' + typeLabel[t.type] + '</i>';
      b.title = 'Make "' + t.w + '" the query';
      b.onclick = () => { S.qi = i; render(true); };
      tokEl.appendChild(b);
    });
    // long sentences: let tokens shrink to fit; if they still overflow, keep the query in view
    tokWrap.classList.toggle('fit', n >= 8 || innerWidth < 600);
    tokWrap.scrollLeft = 0;
    const qb = tokEl.children[S.qi];
    if (qb && tokWrap.scrollWidth > tokWrap.clientWidth + 2){
      const l = qb.offsetLeft, r = l + qb.offsetWidth;
      if (r > tokWrap.scrollLeft + tokWrap.clientWidth || l < tokWrap.scrollLeft) tokWrap.scrollLeft = Math.max(0, r - tokWrap.clientWidth + 12);
    }
  }

  function drawArcs(prog){
    arcsEl.textContent = '';
    if (!S.res) return;
    const wr = tokWrap.getBoundingClientRect(), btns = tokEl.children, qb = btns[S.qi]; if (!qb) return;
    const H = tokWrap.clientHeight, base = tokEl.getBoundingClientRect().top - wr.top;
    arcsEl.setAttribute('viewBox', `0 0 ${tokWrap.scrollWidth} ${H}`);
    arcsEl.style.width = tokWrap.scrollWidth + 'px';
    const cxOf = b => { const r = b.getBoundingClientRect(); return r.left - wr.left + tokWrap.scrollLeft + r.width / 2; };
    const qx = cxOf(qb), maxW = Math.max.apply(null, S.res.rows.map(r => r.w));
    S.res.rows.forEach(r => {
      const b = btns[r.j]; if (!b) return;
      const x = cxOf(b), w = r.w * prog;
      if (r.masked){ b.classList.add('masked'); return; } else b.classList.remove('masked');
      b.style.setProperty('--aw', (r.w / maxW).toFixed(3));
      const lift = r.j === S.qi ? 26 : Math.min(base - 14, 30 + Math.abs(x - qx) * .32);
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', r.j === S.qi ? `M${qx - 9} ${base} C ${qx - 22} ${base - lift}, ${qx + 22} ${base - lift}, ${qx + 9} ${base}` : `M${qx} ${base} Q ${(qx + x) / 2} ${base - lift * 1.6} ${x} ${base}`);
      p.setAttribute('stroke-width', (1 + w * 9).toFixed(2));
      p.setAttribute('opacity', (0.12 + .88 * Math.min(1, w / Math.max(.001, maxW))).toFixed(3));
      arcsEl.appendChild(p);
      if (r.w >= .08 && prog > .6){
        const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tx.setAttribute('x', r.j === S.qi ? qx : (qx + x) / 2); tx.setAttribute('y', base - (r.j === S.qi ? lift * .78 : lift * .8) - 4);
        tx.textContent = Math.round(r.w * 100) + '%'; arcsEl.appendChild(tx);
      }
    });
  }

  function drawScores(phase){
    // phase 2: raw scores only; phase 3+: softmax weights too
    const R = S.res; scoreEl.textContent = '';
    const q = S.toks[S.qi];
    const head = document.createElement('div'); head.className = 'att-row att-hd';
    head.innerHTML = '<span>key</span><span>q·k</span><span>÷√d</span><span>weight</span>';
    scoreEl.appendChild(head);
    R.rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'att-row' + (r.masked ? ' masked' : '') + (r.j === S.qi ? ' self' : '');
      const pct = Math.round(r.w * 100);
      row.innerHTML = '<span class="k t-' + r.t.type + '">' + esc(r.t.w) + '</span>' +
        (r.masked ? '<span>—</span><span>—</span><span class="mk">masked (later word)</span>'
                  : '<span>' + r.raw.toFixed(2) + '</span><span>' + r.sc.toFixed(2) + '</span>' +
                    '<span class="wcell"><i style="--w:' + (phase >= 3 ? r.w : 0) + '"></i><b>' + (phase >= 3 ? pct + '%' : '') + '</b></span>');
      row.onmouseenter = () => matEl.querySelectorAll('[data-j="' + r.j + '"]').forEach(c => c.classList.add('hl'));
      row.onmouseleave = () => matEl.querySelectorAll('.hl').forEach(c => c.classList.remove('hl'));
      scoreEl.appendChild(row);
    });
    el('attQname').textContent = '"' + q.w + '"';
  }

  function drawMatrix(rowsShown){
    const n = S.toks.length; matEl.textContent = '';
    matEl.style.setProperty('--n', n);
    const corner = document.createElement('span'); corner.className = 'mx-c'; matEl.appendChild(corner);
    S.toks.forEach(t => { const h = document.createElement('span'); h.className = 'mx-h'; h.textContent = t.w; matEl.appendChild(h); });
    for (let i = 0; i < n; i++){
      const rh = document.createElement('button'); rh.type = 'button'; rh.className = 'mx-r' + (i === S.qi ? ' q' : ''); rh.textContent = S.toks[i].w;
      rh.onclick = () => { S.qi = i; render(true); }; matEl.appendChild(rh);
      const res = i < rowsShown ? attend(S.toks, i, S.head, S.causal) : null;
      for (let j = 0; j < n; j++){
        const c = document.createElement('span'); c.dataset.j = j;
        const masked = S.causal && j > i;
        c.className = 'mx' + (masked ? ' m' : '') + (i === S.qi ? ' qrow' : '');
        if (res && !masked){ const w = res.rows[j].w; c.style.setProperty('--w', w.toFixed(3)); c.title = `"${S.toks[i].w}" → "${S.toks[j].w}": ${Math.round(w * 100)}%`; }
        matEl.appendChild(c);
      }
    }
  }

  function drawMix(prog){
    const R = S.res; mixEl.textContent = '';
    const tot = Math.max(1, ...R.out);
    VF.forEach((name, f) => {
      const row = document.createElement('div'); row.className = 'mix-row';
      let segs = '';
      R.rows.forEach(r => { const part = r.w * r.t.v[f] * prog; if (part > .004) segs += `<i class="t-${r.t.type}" style="flex-basis:${(part / tot * 100).toFixed(2)}%" title="${esc(r.t.w)}: ${(part).toFixed(2)}"></i>`; });
      row.innerHTML = '<span class="mix-f" style="--fc:' + VC[f] + '">' + name + '</span><span class="mix-bar">' + segs + '</span><b>' + (R.out[f] * prog).toFixed(2) + '</b>';
      mixEl.appendChild(row);
    });
  }

  function interpret(){
    const R = S.res, q = S.toks[S.qi];
    const others = R.rows.filter(r => r.j !== S.qi && !r.masked).sort((a, b) => b.w - a.w);
    const top = others[0], selfW = R.rows[S.qi].w;
    const f = R.out.indexOf(Math.max.apply(null, R.out));
    if (!top || top.w < .25){
      return `<b>"${esc(q.w)}"</b> mostly keeps its own meaning here (${Math.round(selfW * 100)}% on itself). This head has nothing special to do for this word; try ${S.head === 'coref' ? 'a pronoun like "it" or "she"' : S.head === 'subj' ? 'a verb' : 'another token'}.`;
    }
    const meaning = R.out[f] > .05 ? ` Its new vector now reads mostly as <em>${VF[f]}</em>.` : '';
    const tail = S.head === 'coref' && q.type === 'pron' ? ` So the model now knows "${esc(q.w)}" means <b>${esc(top.t.w)}</b>.`
              : S.head === 'subj' && q.type === 'verb' ? ` So "${esc(q.w)}" is linked to who does it: <b>${esc(top.t.w)}</b>.`
              : S.head === 'prev' ? ' Heads like this help the model keep track of word order.' : '';
    return `<b>"${esc(q.w)}"</b> puts <b>${Math.round(top.w * 100)}%</b> of its attention on <b>"${esc(top.t.w)}"</b>.${meaning}${tail}`;
  }

  async function anim(ms, fn){
    const id = S.run, t0 = G.now();
    return new Promise(res => {
      const f = now => { if (id !== S.run) return res(false); const k = Math.min(1, (now - t0) / ms); fn(1 - Math.pow(1 - k, 3)); k < 1 ? G.frame(f) : res(true); };
      G.frame(f);
    });
  }

  // full animated run, or a quick redraw after a click
  async function render(quick){
    const id = ++S.run;
    S.res = attend(S.toks, S.qi, S.head, S.causal);
    if (quick){
      step(4); drawTokens(S.toks.length); drawArcs(1); drawScores(4); drawMatrix(S.toks.length); drawMix(1); sayEl.innerHTML = interpret();
      return;
    }
    sayEl.textContent = ''; mixEl.textContent = ''; scoreEl.textContent = ''; arcsEl.textContent = ''; matEl.textContent = '';
    step(1);
    for (let n = 1; n <= S.toks.length; n++){ drawTokens(n); await wait(110); if (id !== S.run) return; }
    await wait(350); if (id !== S.run) return;
    step(2); drawScores(2); drawMatrix(0);
    await wait(900); if (id !== S.run) return;
    step(3); drawScores(3);
    if (!(await anim(900, k => drawArcs(k)))) return;
    for (let r = 1; r <= S.toks.length; r++){ drawMatrix(r); await wait(70); if (id !== S.run) return; }
    await wait(300); if (id !== S.run) return;
    step(4);
    if (!(await anim(800, k => drawMix(k)))) return;
    sayEl.innerHTML = interpret();
  }

  function runSentence(text){
    text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    const toks = tokenize(text);
    if (toks.length < 2){ capEl.textContent = 'Type at least two words.'; input.focus(); return; }
    input.value = text; S.toks = toks; S.qi = defaultQuery(toks, S.head); S.seen = true;
    render(false);
  }

  form.addEventListener('submit', e => { e.preventDefault(); runSentence(input.value); });
  document.querySelectorAll('#game-attention [data-head]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#game-attention [data-head]').forEach(x => x.classList.toggle('active', x === b));
    S.head = b.dataset.head; el('attHint').textContent = HEADS[S.head].hint;
    if (S.toks.length){ S.qi = defaultQuery(S.toks, S.head); render(true); }
  }));
  maskBtn.addEventListener('click', () => { S.causal = !S.causal; maskBtn.classList.toggle('active', S.causal); maskBtn.setAttribute('aria-pressed', S.causal); if (S.toks.length) render(true); });
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S.res) drawArcs(1); }, 150); });
  tokWrap.addEventListener('scroll', () => { if (S.res) drawArcs(1); }, { passive: true });

  // play an example the first time the panel is shown
  const panel = el('game-attention');
  G.onOpen(() => { if (!S.seen) G.after(120, () => { if (!S.seen) runSentence(EXAMPLES[0]); }); });
  step(0);
  window.Attention = { run: runSentence };
})();
