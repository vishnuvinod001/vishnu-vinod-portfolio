// CHANGE SUMMARY (2026-11-25, 5): performance. Added FX.idle (no input for 1.5 s) so the
//  3D scene and network canvas render at half rate while nothing is moving.
// ==========================================================
// APP — effects, theme, voice, terminal, AI chat
//
// CHANGE SUMMARY (2026-11-25): Playground games removed.
//  - cursor ring: dropped the .mem-card / .hole / #paintCanvas hooks
//  - chat answer + terminal `play` command now point to the new simulations (js/sims.js)
// ==========================================================
const R = window.RESUME;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
// ---- visual mode: auto, or forced with the "Enable 3D" button / ?fx=full / #fx-full ----
const userReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const savedFx = (() => { try { return localStorage.getItem('fx'); } catch(e){ return null; } })();
const forceFull = !/[?&]fx=lite/.test(location.search);        // 3D & motion always on
const reduce = userReduce && !forceFull;
if (forceFull) document.documentElement.classList.add('force-motion');
const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
};
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// ---------- PERFORMANCE HELPERS ----------
// FX.lite turns off the heaviest effects on slow devices (decided automatically below).
const FX = { lite: false, heroVisible: true };
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const fxParam = new URLSearchParams(location.search).get('fx');   // ?fx=full or ?fx=lite to force a mode
FX.forceFull = forceFull;
FX.forced = forceFull || fxParam === 'lite';
if (fxParam === 'lite' || (!FX.forced && (lowEnd || reduce))) { FX.lite = true; document.documentElement.classList.add('lite'); }
// IDLE DETECTOR: FX.idle is true after 1.5 s with no scroll, pointer, touch or key input.
// The heavy loops (3D scene, neural-network canvas) drop to half rate while idle.
FX.idle = false;
(function(){
  let t = 0;
  const wake = () => { FX.idle = false; clearTimeout(t); t = setTimeout(() => { FX.idle = true; }, 1500); };
  ['scroll', 'wheel', 'pointermove', 'pointerdown', 'touchstart', 'touchmove', 'keydown'].forEach(ev => addEventListener(ev, wake, {passive: true}));
  wake();
})();
// run a draw function at most `fps` times per second, and never while the tab is hidden
function loop(fps, fn){
  let last = 0; const gap = 1000 / fps;
  (function f(now){ requestAnimationFrame(f); if (document.hidden || now - last < gap) return; const dt = last ? now - last : gap; last = now; fn(now, dt); })(0);
}

// ---------- THEME ----------
const THEMES = ['mono', 'aurora', 'sunset', 'emerald'];
function setTheme(name, silent){
  if (!THEMES.includes(name)) return false;
  document.documentElement.dataset.theme = name;
  $$('#themes button').forEach(b => b.classList.toggle('active', b.dataset.theme === name));
  store.set('vv-theme', name);
  if (!silent) toast(`Theme: ${name}`);
  document.dispatchEvent(new Event('themechange'));
  return true;
}
setTheme(store.get('vv-theme') || 'aurora', true);
$$('#themes button').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));

// ---------- BOOT ----------
(function boot(){
  const box = $('#boot'); if (box) box.remove(); return;
  let seen = null; try { seen = sessionStorage.getItem('booted'); } catch(e){}
  if (seen || reduce){ box.remove(); return; }
  const lines = ['> initializing neural core...', '> loading models: ollama, faiss', '> calibrating voice module', `> mounting projects [${R.projects.length}]`, 'ok - system ready'];
  lines.forEach((l, i) => setTimeout(() => {
    const d = document.createElement('div'); d.textContent = l; if (l.startsWith('ok')) d.className = 'ok';
    $('#bootLines').appendChild(d); $('#bootFill').style.width = ((i + 1) / lines.length * 100) + '%';
  }, i * 240));
  setTimeout(() => { box.classList.add('done'); setTimeout(() => box.remove(), 700); try { sessionStorage.setItem('booted', 1); } catch(e){} }, lines.length * 240 + 350);
})();

// ---------- NAV / MENU / PROGRESS ----------
$('#yr').textContent = new Date().getFullYear();
const nav = $('#nav'), bar = $('#progress');
addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', scrollY > 20);
  const h = document.documentElement.scrollHeight - innerHeight;
  bar.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%';
}, {passive: true});
const links = $('#links');
$('#menuBtn').addEventListener('click', () => links.classList.toggle('open'));
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));

// ---------- REVEAL + COUNTERS ----------
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
}), {threshold: .12});
$$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target, end = +el.dataset.count, suf = el.dataset.suffix || ''; let t0 = null;
  const step = t => { t0 = t0 || t; const p = Math.min((t - t0) / 1200, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suf; if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step); cio.unobserve(el);
}), {threshold: .5});
$$('[data-count]').forEach(el => cio.observe(el));

// ---------- TYPING ----------
(function(){
  const el = $('#typed'), roles = R.typing; let ri = 0, ci = 0, del = false;
  (function type(){
    const w = roles[ri]; el.textContent = w.slice(0, ci);
    if (!del && ci < w.length) ci++;
    else if (del && ci > 0) ci--;
    else if (!del){ del = true; return setTimeout(type, 1600); }
    else { del = false; ri = (ri + 1) % roles.length; }
    setTimeout(type, del ? 28 : 55);
  })();
})();

// hero on screen? (pauses hero-only animations when scrolled away)
new IntersectionObserver(es => {
  FX.heroVisible = es[0].isIntersecting;
  document.documentElement.classList.toggle('hero-off', !FX.heroVisible);
}).observe($('#top'));

// ---------- NEURAL BACKGROUND (theme-aware) ----------
(function(){
  const cv = $('#neural'), cx = cv.getContext('2d'), dpr = 1;
  let W, H, pts = [], mouse = {x:-999, y:-999}, c1, c2;
  const colors = () => { c1 = cssVar('--c1'); c2 = cssVar('--c2'); };
  colors(); document.addEventListener('themechange', colors);
  function size(){
    W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    const n = Math.min(42, Math.floor(innerWidth * innerHeight / 32000));
    pts = Array.from({length: n}, () => ({x: Math.random()*W, y: Math.random()*H, vx: (Math.random()-.5)*.35*dpr, vy: (Math.random()-.5)*.35*dpr}));
  }
  addEventListener('resize', size); size();
  addEventListener('mousemove', e => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
  loop(24, () => {
    if (FX.lite || FX.noNeural || !FX.heroVisible) return;
    cx.clearRect(0, 0, W, H);
    const link = 140 * dpr;
    for (const p of pts){
      if (!reduce){ p.x += p.vx; p.y += p.vy; }
      if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
    }
    cx.lineWidth = .8 * dpr;
    for (let i = 0; i < pts.length; i++){
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++){
        const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link){ cx.globalAlpha = (1 - d / link) * .35; cx.strokeStyle = c2; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
      }
      const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y), near = dm < link * 1.4;
      if (near){ cx.globalAlpha = (1 - dm / (link * 1.4)) * .6; cx.strokeStyle = c1; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(mouse.x, mouse.y); cx.stroke(); }
      cx.globalAlpha = near ? 1 : .6; cx.fillStyle = near ? c1 : '#c8cdff';
      cx.beginPath(); cx.arc(a.x, a.y, 1.6 * dpr, 0, 7); cx.fill();
    }
    cx.globalAlpha = 1;
  });
})();

// ---------- CURSOR + MAGNETIC ----------
if (finePointer && !reduce){
  document.body.classList.add('has-cursor');
  const dot = $('#cDot'), ring = $('#cRing'); let rx = 0, ry = 0, mx = 0, my = 0;
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx - 3}px,${my - 3}px)`; });
  (function follow(){ rx += (mx - rx) * .18; ry += (my - ry) * .18;
    const s = ring.offsetWidth / 2; ring.style.transform = `translate(${rx - s}px,${ry - s}px)`; requestAnimationFrame(follow); })();
  document.addEventListener('mouseover', e => {
    ring.classList.toggle('hover', !!e.target.closest('a,button,.project,input'));
  });
  $$('.btn, .social, .chat-fab').forEach(b => {
    b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width/2) * .25}px,${(e.clientY - r.top - r.height/2) * .35}px)`; });
    b.addEventListener('mouseleave', () => b.style.transform = '');
  });
}

// ---------- NAME SCRAMBLE ----------
$$('.scramble').forEach(el => {
  const text = el.dataset.text, chars = '!<>-_\\/[]{}=+*^?#01'; let busy = false;
  const run = () => { if (busy || reduce) return; busy = true; let f = 0;
    const iv = setInterval(() => {
      el.innerHTML = text.split('').map((c, i) => c === ' ' ? ' ' : i < f / 2 ? c : `<span class="sc">${chars[Math.floor(Math.random() * chars.length)]}</span>`).join('');
      if (++f > text.length * 2){ clearInterval(iv); el.textContent = text; busy = false; }
    }, 35); };
  el.addEventListener('mouseenter', run); setTimeout(run, 2200);
});

// ---------- PROJECTS: filter, glow, tilt, modal ----------
const PROJECTS = Object.fromEntries(R.projects.map(p => [p.id, p]));
$$('.filter').forEach(btn => btn.addEventListener('click', () => {
  $$('.filter').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  $$('.project').forEach(p => p.classList.toggle('hide', btn.dataset.f !== 'all' && p.dataset.cat !== btn.dataset.f));
}));
$$('.project').forEach(c => {
  c.addEventListener('click', () => openProject(c.dataset.id));
  c.addEventListener('keydown', e => { if (e.key === 'Enter') openProject(c.dataset.id); });
  c.addEventListener('mousemove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    if (finePointer && !reduce && !document.documentElement.classList.contains('hmode')){ const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = `rotateX(${-y * 6}deg) rotateY(${x * 6}deg) translateY(-4px)`; }
  });
  c.addEventListener('mouseleave', () => c.style.transform = '');
});
const modal = $('#modal'); let currentProject = null;
function openProject(id){
  const p = PROJECTS[id]; if (!p) return; currentProject = p;
  $('#mLabel').textContent = p.label; $('#mTitle').textContent = p.title;
  $('#mProblem').textContent = p.problem; $('#mImpact').textContent = p.impact;
  $('#mBuilt').innerHTML = p.built.map(b => `<li>${esc(b)}</li>`).join('');
  $('#mStack').innerHTML = p.stack.map(t => `<span class="tag">${esc(t)}</span>`).join('');
  $('#mPipe').innerHTML = (p.pipeline || []).map((x, i) => `${i ? '<i class="arr"></i>' : ''}<span>${esc(x)}</span>`).join('') + (p.pipeline ? '<b class="pulse"></b>' : '');
  $('#mCard').innerHTML = (p.card || []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; $('#modalX').focus();
}
function closeModal(){ modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; stopSpeaking(); }
$('#modalX').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
$('#mSpeak').addEventListener('click', () => {
  const p = currentProject; if (!p) return;
  speak(`${p.title}. The problem: ${p.problem} What I built: ${p.built.join('. ')}. The impact: ${p.impact}`, true);
});
addEventListener('keydown', e => { if (e.key === 'Escape'){ closeModal(); closeChat(); } });

// ==========================================================
// VOICE — Web Speech API (built into the browser, no API key)
// ==========================================================
let voiceOn = store.get('voice') !== 'off';
let robotVoice = null, voiceRate = +(store.get('voiceRate') || 1);
const canSpeak = 'speechSynthesis' in window;

// Clear, natural-sounding voices first (Edge "Natural" voices are the best),
// then good Chrome / Mac / Windows voices, then any English voice.
const VOICE_PREFS = [
  /Microsoft (Neerja|Prabhat).*Natural/i,                 // Indian English, very clear (Edge)
  /Microsoft (Aria|Jenny|Guy|Andrew|Emma|Brian|Ryan|Sonia).*Natural/i,
  /Google UK English Female/i, /Google US English/i, /Google UK English Male/i,
  /^(Samantha|Daniel|Karen|Moira|Rishi)/i,                 // macOS / iOS
  /Microsoft (Zira|David|Heera|Ravi)/i,                    // Windows built-in
  /en-IN/i, /en-GB/i, /en-US/i, /^en/i
];
function englishVoices(){ return canSpeak ? speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)) : []; }
function pickVoice(){
  const vs = englishVoices(); if (!vs.length) return;
  const saved = store.get('voiceName');
  robotVoice = vs.find(v => v.name === saved) || null;
  for (const re of VOICE_PREFS){ if (robotVoice) break; robotVoice = vs.find(v => re.test(v.name) || re.test(v.lang)) || null; }
  fillVoiceList();
}
function fillVoiceList(){
  const sel = $('#voiceSel'); if (!sel) return;
  const vs = englishVoices();
  sel.innerHTML = vs.map(v => `<option value="${esc(v.name)}"${robotVoice && v.name === robotVoice.name ? ' selected' : ''}>${esc(v.name.replace(/Microsoft |Google | Online \(Natural\)/g, m => m.includes('Natural') ? ' ✦' : ''))} (${v.lang})</option>`).join('');
}
if (canSpeak){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

// make technical words sound right
const SAY = [
  [/Next\.js/g, 'Next J S'], [/Node\.js/g, 'Node J S'], [/React\.js/g, 'React'], [/Vue\.js/g, 'View J S'],
  [/PostgreSQL/g, 'Postgres Q L'], [/MySQL/g, 'My S Q L'], [/MariaDB/g, 'Maria D B'], [/MongoDB/g, 'Mongo D B'],
  [/\bSQL\b/g, 'S Q L'], [/\bvLLM\b/g, 'V L L M'], [/\bLLMs?\b/g, m => m === 'LLMs' ? 'L L Ms' : 'L L M'],
  [/\bAI\b/g, 'A I'], [/\bML\b/g, 'M L'], [/\bMSL\b/g, 'M S L'], [/\bIEEE\b/g, 'I triple E'], [/\bKTU\b/g, 'K T U'],
  [/\bYIP\b/g, 'Y I P'], [/\bMIS\b/g, 'M I S'], [/\bHR\b/g, 'H R'], [/\bAPIs?\b/g, m => m === 'APIs' ? 'A P Is' : 'A P I'],
  [/\bREST\b/g, 'rest'], [/\bUI\b/g, 'U I'], [/\bPNG\b/g, 'P N G'], [/\bFISAT\b/g, 'Fisat'], [/\bCGPA\b/g, 'C G P A'],
  [/B\.Tech/g, 'B Tech'], [/\bFAISS\b/g, 'face'], [/\bMCP\b/g, 'M C P'], [/\bRAG\b/g, 'rag'], [/\bMCA\b/g, 'M C A'], [/\bAIMS\b/g, 'aims'], [/FastAPI/g, 'Fast A P I'], [/\bSAM\b/g, 'sam'], [/\bCLIP\b/g, 'clip'], [/\bGALIP\b/g, 'gallip'], [/\bNEAT\b/g, 'neat'], [/\bMSSQL\b/g, 'M S S Q L'], [/\bGHOST\b/g, 'ghost'], [/\bB\.Sc\b/g, 'B S C'], [/\bNCC\b/g, 'N C C'], [/(\d+)\+/g, '$1 plus'], [/(\d+)%/g, '$1 percent'], [/&/g, ' and '], [/\s—\s/g, ', ']
];
function cleanForSpeech(html){
  let t = String(html).replace(/<br\s*\/?>/g, '. ').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ')
    .replace(/\p{Extended_Pictographic}|[•✦→·]/gu, ' ');
  for (const [re, rep] of SAY) t = t.replace(re, rep);
  return t.replace(/\s+([.,])/g, '$1').replace(/\s+/g, ' ').trim();
}
// split into sentences: long single utterances get cut off in Chrome
function chunks(text){
  const parts = text.match(/[^.!?]+[.!?]*/g) || [text], out = [];
  for (const p of parts){ const s = p.trim(); if (!s) continue;
    if (out.length && (out[out.length - 1] + ' ' + s).length < 160) out[out.length - 1] += ' ' + s; else out.push(s); }
  return out;
}
function speak(html, force){
  if (!canSpeak || (!voiceOn && !force)) return;
  speechSynthesis.cancel();
  const list = chunks(cleanForSpeech(html));
  list.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    if (robotVoice){ u.voice = robotVoice; u.lang = robotVoice.lang; }
    u.rate = voiceRate; u.pitch = 1; u.volume = 1;            // natural pitch = clearest
    if (i === 0) u.onstart = () => document.body.classList.add('speaking');
    if (i === list.length - 1) u.onend = () => document.body.classList.remove('speaking');
    u.onerror = () => document.body.classList.remove('speaking');
    speechSynthesis.speak(u);
  });
}
function stopSpeaking(){ if (canSpeak) speechSynthesis.cancel(); document.body.classList.remove('speaking'); }

// voice settings panel
$('#voiceSet').addEventListener('click', () => $('#voicePanel').classList.toggle('open'));
$('#voiceSel').addEventListener('change', e => {
  robotVoice = englishVoices().find(v => v.name === e.target.value) || robotVoice;
  store.set('voiceName', e.target.value); speak("Hi! This is how I sound now.", true);
});
$('#voiceRate').value = voiceRate;
$('#voiceRate').addEventListener('change', e => { voiceRate = +e.target.value; store.set('voiceRate', voiceRate); speak('Speed updated.', true); });
$('#voiceTest').addEventListener('click', () => speak(`Hi, I'm ${R.botName}. ${R.name} builds L L M applications and agentic systems with Python, FastAPI and local models.`, true));
if (!canSpeak) $('#voiceSet').style.display = 'none';

function updateMute(){ $('#muteBtn').textContent = voiceOn ? '🔊' : '🔇'; }
updateMute();
$('#muteBtn').addEventListener('click', () => {
  voiceOn = !voiceOn; store.set('voice', voiceOn ? 'on' : 'off'); updateMute();
  if (!voiceOn) stopSpeaking(); toast(voiceOn ? 'Voice on' : 'Voice muted');
});

// voice input (speech → text)
// Works in Chrome / Edge / Safari. Needs https:// or localhost.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const mic = $('#micBtn');
const secure = window.isSecureContext && location.protocol !== 'file:';
function micHelp(msg){ toast(msg); addMsg(`🎤 ${msg}`, 'bot'); }
if (!SR){
  mic.classList.add('blocked');
  mic.addEventListener('click', () => micHelp('Voice input isn\'t supported in this browser. Please use Chrome, Edge or Safari, or just type your question.'));
} else if (!secure){
  mic.classList.add('blocked');
  mic.addEventListener('click', () => micHelp('The microphone only works when the site is opened over https:// (e.g. GitHub Pages) or with VS Code Live Server. It\'s blocked for files opened by double-click (file://).'));
} else {
  const rec = new SR();
  rec.lang = 'en-IN'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let listening = false, finalText = '', gotResult = false;
  rec.onstart = () => {
    listening = true; finalText = ''; gotResult = false;
    mic.classList.add('listening'); document.body.classList.add('listening');
    $('#chatStatus').textContent = 'Listening… speak now'; cIn.value = ''; cIn.placeholder = 'Listening…';
  };
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++){
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    cIn.value = finalText || interim; cIn.classList.toggle('interim', !finalText);
    gotResult = true;
  };
  rec.onend = () => {
    listening = false; mic.classList.remove('listening'); document.body.classList.remove('listening');
    $('#chatStatus').textContent = 'Ask me anything · I can talk too'; cIn.placeholder = 'Type, or tap 🎤 to speak'; cIn.classList.remove('interim');
    const q = (finalText || cIn.value).trim();
    if (q){ cIn.value = ''; ask(q); }
    else if (!gotResult) toast('Didn\'t catch that. Tap 🎤 and try again.');
  };
  rec.onerror = e => {
    const why = {
      'not-allowed': 'Microphone permission was blocked. Click the 🔒 icon in the address bar → allow Microphone, then try again.',
      'service-not-allowed': 'Microphone permission was blocked. Click the 🔒 icon in the address bar → allow Microphone.',
      'audio-capture': 'No microphone was found. Check that one is connected.',
      'network': 'Voice recognition needs an internet connection (and isn\'t available in some browsers like Brave). Try Chrome or Edge.',
      'no-speech': 'I didn\'t hear anything. Tap 🎤 and speak a bit louder.',
      'language-not-supported': 'This browser doesn\'t support English (India) recognition.'
    }[e.error];
    if (why && e.error !== 'aborted') micHelp(why);
  };
  mic.addEventListener('click', () => {
    stopSpeaking();
    if (listening){ rec.stop(); return; }
    try { rec.start(); } catch(err){ rec.abort(); setTimeout(() => { try { rec.start(); } catch(e){} }, 250); }
  });
}

// ==========================================================
// AI CHAT — scripted assistant built from resume data
// ==========================================================
const KB = (function build(){
  const kb = [];
  // custom FAQ first (most specific)
  R.faq.forEach(f => kb.push(f));
  // one entry per project
  const stop = new Set(['system','based','hospital','management','models','with','post-generation','personal','internal','&','—','-','to','and','text','automation']);
  R.projects.forEach(p => {
    const words = p.title.toLowerCase().replace(/[—()]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stop.has(w));
    if (p.id === 'ghost') words.push('current', 'working on', 'side project');
    if (p.id === 'resumebank') words.push('resume parser', 'parsing', 'recruitment');
    if (p.id === 'ticketing') words.push('ticket', 'outlook', 'email');
    if (p.id === 'flappy') words.push('flappy', 'neat', 'neuroevolution', 'game');
    if (p.id === 'hr') words.push('attendance', 'biometric', 'shift');
    if (p.id === 'ptc') words.push('procurement', 'purchase');
    kb.push({k: [p.id, ...words], a: `<b>${esc(p.title)}</b>: ${esc(p.summary)}`, p: p.id});
  });
  kb.push(
    {k:['hi','hello','hey','hai','good morning','good evening'], a:`Hi! 👋 I'm ${R.botName}. Ask me about ${R.name}'s skills, projects, AI work, experience or how to contact him.`},
    {k:['who','about','introduce','yourself','tell me about'], a:`${R.name} is an <b>${R.title}</b> building LLM applications and agentic systems. He works on hospital automation at <b>AIMS Kochi</b>, builds <b>GHOST</b> (a local AI with memory and MCP tools) on his own time, holds an <b>MCA (CGPA 9.00)</b> and studied <b>Physics</b> before that.`},
    {k:['skill','stack','tech','language','know','technolog','tools'], a:'Here is his toolkit:<br>' + Object.entries(R.skills).map(([g, l]) => `<b>${g}:</b> ${l.join(', ')}`).join('<br>')},
    {k:['project','built','portfolio','work on'], a:`Highlights: ${R.projects.map(p => `<b>${esc(p.title.split(' — ')[0])}</b>`).join(', ')}. Click any project card for its case study.`},
    {k:['experience','job','company','amrita','aims','intern','work history','years'], a: R.experience.map(j => `<b>${j.role}</b>, ${j.company}${j.period ? ` (${j.period})` : ''}`).join('<br>')},
    {k:['education','degree','college','study','mca','cgpa','certif','master'], a: R.education.map(e => `<b>${e.degree}</b>, ${e.school}, ${e.period}, ${e.score}`).join('<br>') + `<br>Certifications: ${R.certifications.map(c => c.name).join(', ')}.`},
    {k:['contact','email','reach','phone','linkedin','connect','call'], a:`📧 <a href="mailto:${R.email}">${R.email}</a><br>💼 <a href="${R.links.linkedin}" target="_blank" rel="noopener">LinkedIn</a> · <a href="${R.links.github}" target="_blank" rel="noopener">GitHub</a>`},
    {k:['hire','available','open to','opportunit','role','looking','join','notice'], a:`He's open to ${R.openTo}. The best way to reach him is <a href="mailto:${R.email}?subject=Opportunity">${R.email}</a>.`},
    {k:['location','where','based','kerala','kochi','relocat','remote'], a:`He's based in <b>${R.location}</b>. For questions about remote work or relocating, email <a href="mailto:${R.email}">${R.email}</a>.`},
    {k:['game','play','fun','playground','simulation','demo'], a:`There's a Playground section with small simulations of how I build things. The RAG one is live: ask it a question and watch it retrieve. <a href="#playground">Try it →</a>`},
    {k:['thank','thanks','great','cool','nice','awesome'], a:`You're welcome! 😊 If you'd like to talk to ${R.name.split(' ')[0]} himself: <a href="mailto:${R.email}">${R.email}</a>.`}
  );
  return kb;
})();
function reply(q){
  const t = q.toLowerCase(); let best = null, score = 0;
  const hit = k => k.length <= 3 ? new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t) : t.includes(k);
  for (const item of KB){ const s = item.k.filter(hit).length; if (s > score){ score = s; best = item; } }
  return best || {a:`I'm not sure about that one. Try asking about his <b>skills</b>, <b>projects</b>, <b>AI work</b>, <b>experience</b> or <b>contact</b>, or email <a href="mailto:${R.email}">${R.email}</a>.`};
}
const chat = $('#chat'), fab = $('#chatFab'), body = $('#chatBody'), cIn = $('#chatIn');
function addMsg(html, who){ const d = document.createElement('div'); d.className = 'msg ' + who; d.innerHTML = html; body.appendChild(d); body.scrollTop = body.scrollHeight; return d; }
function ask(q){
  if (!q || !q.trim()) return;
  if (!chat.classList.contains('open')) openChat(false);
  addMsg(esc(q), 'user');
  const typing = addMsg('<span class="typing-dots"><i></i><i></i><i></i></span>', 'bot');
  const r = reply(q);
  setTimeout(() => {
    typing.innerHTML = r.a;
    if (r.p){ const b = document.createElement('button'); b.className = 'link-btn'; b.textContent = 'Open case study →';
      b.onclick = () => { closeChat(); openProject(r.p); }; typing.appendChild(b); }
    typing.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', closeChat));
    body.scrollTop = body.scrollHeight;
    speak(r.a);
  }, 500 + Math.random() * 400);
}
const SUGGEST = ['Tell me about him', 'What is GHOST?', 'What AI work has he done?', 'Research', 'Physics background', 'Is he open to roles?', 'Contact'];
$('#chips').innerHTML = SUGGEST.map(s => `<button type="button">${s}</button>`).join('');
$('#chips').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') ask(e.target.textContent); });
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); ask(cIn.value); cIn.value = ''; });
let greeted = false;
function openChat(greetAloud){
  chat.classList.add('open'); chat.setAttribute('aria-hidden', 'false'); fab.classList.add('hidden');
  if (!greeted){
    greeted = true;
    const hi = `Hi! 👋 I'm <b>${R.botName}</b>, ${R.name}'s assistant (a scripted demo named after his real local AI). Ask me about his skills, projects, AI work or experience. You can type, or tap the mic and speak.`;
    addMsg(hi, 'bot'); if (greetAloud) speak(hi);
  }
  if (finePointer) setTimeout(() => cIn.focus(), 300);
}
function closeChat(){ chat.classList.remove('open'); chat.setAttribute('aria-hidden', 'true'); fab.classList.remove('hidden'); stopSpeaking(); }
fab.addEventListener('click', () => openChat(true));
$('#chatX').addEventListener('click', closeChat);
$$('[data-open-chat]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openChat(a.hasAttribute('data-greet')); }));

// ==========================================================
// TERMINAL
// ==========================================================
const tOut = $('#termOut'), tIn = $('#termIn');
const CMDS = {
  help: () => `Commands:
  <span class="p">whoami</span>         who is ${R.shortName}
  <span class="p">skills</span>         tech stack
  <span class="p">experience</span>     work history
  <span class="p">projects</span>       list projects
  <span class="p">open</span> &lt;n&gt;       open a case study
  <span class="p">contact</span>        get in touch
  <span class="p">ghost</span>          what is GHOST?
  <span class="p">chat</span>           talk to ${R.botName}
  <span class="p">say</span> &lt;text&gt;     make the robot speak
  <span class="p">theme</span> &lt;name&gt;   aurora · sunset · emerald · mono
  <span class="p">play</span> &lt;sim&gt;     rag
  <span class="p">clear</span>          clear the screen`,
  whoami: () => `<span class="k">class</span> <span class="p">Developer</span>:
  name     = <span class="s">"${R.name}"</span>
  role     = <span class="s">"${R.title}"</span>
  company  = <span class="s">"${R.company}"</span>
  focus    = <span class="s">"LLM apps · RAG · agents"</span>
  degree   = <span class="s">"MCA, CGPA 9.00"</span>  <span class="c"># B.Sc Physics before that</span>
  location = <span class="s">"${R.location}"</span>`,
  skills: () => Object.entries(R.skills).map(([g, l]) => `<span class="k">${g.toLowerCase().padEnd(22)}</span>${l.join(' · ')}`).join('\n'),
  experience: () => R.experience.map(j => `<span class="s">[${j.period || 'intern'}]</span> ${j.role}\n  ${j.company}`).join('\n'),
  projects: () => R.projects.map((p, i) => `  <span class="p">${String(i + 1).padStart(2)}</span>  ${esc(p.title)}`).join('\n') + `\n<span class="c">type 'open 1' to view a case study</span>`,
  contact: () => `email     <a href="mailto:${R.email}">${R.email}</a>\nlinkedin  <a href="${R.links.linkedin}" target="_blank" rel="noopener">${R.links.linkedin.replace('https://', '')}</a>\ngithub    <a href="${R.links.github}" target="_blank" rel="noopener">${R.links.github.replace('https://', '')}</a>`,
  ghost: () => `<span class="k">GHOST</span> = Ollama + FAISS + SQLite + MCP
  <span class="c"># a local AI with persistent memory that uses tools</span>
  type <span class="p">open 1</span> for the case study`,
  chat: () => { openChat(true); return `launching ${R.botName} ...`; },
  sudo: () => `<span class="err">permission denied: GHOST only takes orders from Vishnu 👻</span>`,
  hire: () => `<span class="s">excellent choice.</span> → <a href="mailto:${R.email}?subject=Opportunity">${R.email}</a>`,
  ls: () => 'about/  skills/  experience/  projects/  education/  playground/  contact/  ghost/',
  date: () => new Date().toString()
};
const hist = []; let hi = 0;
function termPrint(html){ tOut.insertAdjacentHTML('beforeend', html + '\n'); tOut.scrollTop = tOut.scrollHeight; }
function runCmd(raw){
  const cmd = raw.trim(); if (!cmd) return;
  hist.push(cmd); hi = hist.length;
  termPrint(`<span class="p">$</span> <span class="cmd">${esc(cmd)}</span>`);
  const [name, ...rest] = cmd.split(/\s+/), arg = rest.join(' '), n = name.toLowerCase();
  if (n === 'clear'){ tOut.innerHTML = ''; return; }
  if (n === 'open'){
    const p = R.projects[parseInt(arg) - 1];
    return p ? (openProject(p.id), termPrint(`opening ${esc(p.title)} ...`)) : termPrint(`<span class="err">usage: open &lt;1-${R.projects.length}&gt;</span>`);
  }
  if (n === 'say'){
    if (!arg) return termPrint('<span class="err">usage: say hello recruiter</span>');
    speak(arg, true); return termPrint(`🔊 "${esc(arg)}"`);
  }
  if (n === 'theme'){ return termPrint(setTheme(arg.toLowerCase()) ? `theme set to <span class="p">${esc(arg)}</span>` : `<span class="err">themes: ${THEMES.join(' · ')}</span>`); }
  if (n === 'play'){
    if (window.Sims && Sims.open(arg.toLowerCase())){ Smooth.to($('#playground')); return termPrint(`launching ${esc(arg)} ...`); }
    return termPrint('<span class="err">sims: rag</span>');
  }
  termPrint(CMDS[n] ? CMDS[n]() : `<span class="err">command not found: ${esc(n)}</span> · type <span class="p">help</span>`);
}
$('#termForm').addEventListener('submit', e => { e.preventDefault(); runCmd(tIn.value); tIn.value = ''; });
tIn.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp' && hi > 0){ tIn.value = hist[--hi]; e.preventDefault(); }
  if (e.key === 'ArrowDown'){ hi = Math.min(hist.length, hi + 1); tIn.value = hist[hi] || ''; e.preventDefault(); }
  if (e.key === 'Tab' && tIn.value){
    const m = Object.keys(CMDS).concat('clear', 'open', 'say', 'theme', 'play').find(c => c.startsWith(tIn.value.toLowerCase()));
    if (m){ tIn.value = m + ' '; e.preventDefault(); }
  }
});
$('#term').addEventListener('click', () => tIn.focus({preventScroll: true}));
termPrint(`Welcome to <span class="p">${R.shortName}@portfolio</span>. Type <span class="p">help</span> to explore.\n`);
runCmd('whoami');

// ==========================================================
// SMOOTH SCROLL — inertia scrolling for mouse wheels
// (touch devices keep their native smooth scrolling)
// ==========================================================
const Smooth = (function(){
  const enabled = finePointer && !reduce;
  let target = scrollY, current = scrollY, running = false, lastT = 0;
  const max = () => document.documentElement.scrollHeight - innerHeight;
  const clamp = v => Math.max(0, Math.min(max(), v));
  // time-based easing: same smooth feel on fast and slow computers
  function loop(now){
    const dt = Math.min(now - lastT, 64); lastT = now;
    current += (target - current) * (1 - Math.exp(-dt / 85));
    if (Math.abs(target - current) < .5){ current = target; running = false; }
    scrollTo(0, current);
    if (running) requestAnimationFrame(loop);
  }
  function go(y){
    if (!enabled){ scrollTo({top: y, behavior: reduce ? 'auto' : 'smooth'}); return; }
    target = clamp(y); if (!running){ current = scrollY; running = true; lastT = performance.now(); requestAnimationFrame(loop); }
  }
  // can an element under the mouse scroll by itself? (terminal, chat, modal…)
  function innerScrollable(el, dy){
    for (; el && el !== document.body; el = el.parentElement){
      const st = getComputedStyle(el), oy = st.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1){
        if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
      }
    }
    return false;
  }
  if (enabled){
    document.documentElement.classList.add('js-smooth');
    addEventListener('wheel', e => {
      if (FX.lite || e.ctrlKey || document.body.style.overflow === 'hidden') return;
      let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (innerScrollable(e.target, dy)) return;
      e.preventDefault();
      if (!running) target = scrollY;
      go(target + dy);
    }, {passive: false});
    // keep in sync when the user drags the scrollbar or uses the keyboard
    addEventListener('scroll', () => { if (!running){ target = current = scrollY; } }, {passive: true});
  }
  // smooth anchor links
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a || a.hasAttribute('data-go')) return;
    const id = a.getAttribute('href'); if (id === '#') return;
    const el = document.querySelector(id); if (!el) return;
    e.preventDefault();
    go(id === '#top' ? 0 : el.getBoundingClientRect().top + scrollY - 70);
    history.replaceState(null, '', id);
  });
  return { to: el => go(el.getBoundingClientRect().top + scrollY - 70) };
})();

// ==========================================================
// SIDE DOTS + ACTIVE NAV LINK
// ==========================================================
(function(){
  const SECTIONS = [['top','Home'],['about','About'],['skills','Skills'],['experience','Experience'],['projects','Projects'],['education','Education'],['playground','Playground'],['contact','Contact']];
  const dots = $('#dotsNav');
  dots.innerHTML = SECTIONS.map(([id, label]) => `<a href="#${id}" data-go="${id}" data-sec="${id}" aria-label="${label}"><span>${label}</span></a>`).join('');
  const so = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id;
    $$('.dots-nav a').forEach(a => a.classList.toggle('active', a.dataset.sec === id));
    $$('.links a[href^="#"]').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  }), {rootMargin: '-45% 0px -50% 0px'});
  SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) so.observe(el); });
})();

// ==========================================================
// NORTHERN LIGHTS (aurora borealis)
// Flowing light curtains behind the page. Each section has its
// own colours / height / motion; they blend as you scroll.
// ==========================================================
(function borealis(){
  const cv = $('#borealis'); if (!cv) return;
  // draw on a small off-screen canvas, then copy it once with a soft blur
  const vx = cv.getContext('2d'), off = document.createElement('canvas'), cx = off.getContext('2d');
  const SCALE = .22;                         // render small + scale up = soft and fast
  let w, h, t = 0, last = performance.now();
  const hex = c => { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  // per-section looks: colour sources, sky height, wave size, brightness, speed
  const LOOK = {
    top:        {cols: ['c1', 'green', 'c3'], y: .06, amp: 1.0,  glow: 1.0,  speed: 1.0},
    about:      {cols: ['green', 'c1'],       y: .12, amp: .7,   glow: .75,  speed: .8},
    skills:     {cols: ['c2', 'c1'],          y: .04, amp: 1.2,  glow: .85,  speed: 1.1},
    experience: {cols: ['c3', 'pink'],        y: .10, amp: .9,   glow: .7,   speed: .7},
    projects:   {cols: ['c1', 'c2'],          y: .05, amp: 1.1,  glow: .8,   speed: 1.0},
    playground: {cols: ['pink', 'c3', 'c1'],  y: .08, amp: 1.3,  glow: 1.0,  speed: 1.3},
    education:  {cols: ['green', 'c2'],       y: .12, amp: .8,   glow: .7,   speed: .7},
    contact:    {cols: ['c2', 'c3', 'c1'],    y: .06, amp: 1.0,  glow: .95,  speed: .9}
  };
  const IDS = Object.keys(LOOK);
  let palette = {};
  function readPalette(){
    const mono = document.documentElement.dataset.theme === 'mono';
    palette = { c1: hex(cssVar('--c1')), c2: hex(cssVar('--c2')), c3: hex(cssVar('--c3')),
                green: mono ? [200, 200, 210] : [62, 230, 168], pink: mono ? [150, 150, 160] : [236, 120, 190] };
  }
  readPalette(); document.addEventListener('themechange', readPalette);
  // live (blended) state
  const cur = {cols: [[0,0,0],[0,0,0],[0,0,0]], y: .06, amp: 1, glow: 0, speed: 1};
  let target = LOOK.top;
  function size(){ w = off.width = cv.width = Math.ceil(innerWidth * SCALE); h = off.height = cv.height = Math.ceil(innerHeight * SCALE); }
  addEventListener('resize', size); size();
  let frame = 0;
  function pickSection(){
    let id = 'top';
    for (const s of IDS){ const el = document.getElementById(s); if (el && el.getBoundingClientRect().top < innerHeight * .5) id = s; }
    target = LOOK[id];
  }
  loop(24, (now, dt0) => {
    if (FX.lite) return;
    const dt = Math.min(dt0, 50);
    if (!reduce) t += dt * cur.speed;
    if (frame++ % 10 === 0) pickSection();
    // ease towards the current section's look
    const k = .025;
    for (let i = 0; i < 3; i++){
      const src = palette[target.cols[i % target.cols.length]];
      for (let c = 0; c < 3; c++) cur.cols[i][c] += (src[c] - cur.cols[i][c]) * k;
    }
    for (const p of ['y', 'amp', 'glow', 'speed']) cur[p] += (target[p] - cur[p]) * k;

    cx.clearRect(0, 0, w, h);
    cx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++){
      const [r, g, b] = cur.cols[i].map(Math.round);
      const base = h * (cur.y + i * .06), A = h * .06 * cur.amp;
      const grad = cx.createLinearGradient(0, base - A * 2, 0, base + h * .45);
      grad.addColorStop(0,   `rgba(${r},${g},${b},0)`);
      grad.addColorStop(.18, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(.55, `rgba(${r},${g},${b},.35)`);
      grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      cx.fillStyle = grad;
      const ph = i * 1.7, dir = i % 2 ? -1 : 1;
      for (let x = 0; x < w; x++){
        const top = base
          + Math.sin(x * .018 + t * .00035 * dir + ph) * A
          + Math.sin(x * .047 - t * .0006 + ph * 2) * A * .45;
        const len = h * (.22 + .12 * Math.sin(x * .023 + t * .0004 + ph));
        const ray = .5 + .5 * Math.sin(x * .21 + t * .0016 * dir + ph) * Math.sin(x * .05 - t * .0005);
        cx.globalAlpha = (.18 + .5 * ray) * .55 * cur.glow;
        cx.fillRect(x, top, 1.1, len);
      }
    }
    cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    vx.clearRect(0, 0, w, h); vx.drawImage(off, 0, 0);
  });
})();

// ==========================================================
// CURSOR LIGHT — a soft light follows the pointer, and card
// edges light up where the pointer is closest
// ==========================================================
(function(){
  if (!finePointer || reduce) return;
  const spot = $('#spotlight'); let x = innerWidth / 2, y = innerHeight / 3, tx = x, ty = y, queued = false;
  const lit = () => $$('.gcard, .ai-cap, .stats, .terminal, .play-stage, .contact');
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY; spot.classList.add('on');
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false;
      lit().forEach(el => {
        const r = el.getBoundingClientRect();
        // only cards near the pointer need their light updated
        const near = tx > r.left - 280 && tx < r.right + 280 && ty > r.top - 280 && ty < r.bottom + 280;
        if (!near){ if (el._lit){ el._lit = false; el.style.setProperty('--lx', '-999px'); } return; }
        el._lit = true;
        el.style.setProperty('--lx', (tx - r.left) + 'px'); el.style.setProperty('--ly', (ty - r.top) + 'px');
      });
    });
  }, {passive: true});
  document.addEventListener('pointerleave', () => spot.classList.remove('on'));
  (function follow(){
    requestAnimationFrame(follow);
    if (Math.abs(tx - x) + Math.abs(ty - y) < .5) return;
    x += (tx - x) * .16; y += (ty - y) * .16;
    spot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  })();
})();

// ==========================================================
// AUTO QUALITY — measure real frame rate for 2.5s after load;
// on slow devices switch to lite mode (keeps the design, drops
// the heaviest animated layers)
// ==========================================================
(function(){
  if (FX.lite || FX.forced) return;
  const times = []; let prev = 0;
  setTimeout(() => {
    (function m(now){
      if (prev) times.push(now - prev); prev = now;
      if (times.length < 120) return requestAnimationFrame(m);
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      if (median > 19){ FX.lite = true; document.documentElement.classList.add('lite'); }
    })(performance.now());
  }, 1200);
})();
