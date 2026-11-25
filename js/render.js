// ==========================================================
// RENDER — builds every section of the page from data/resume.js
// ==========================================================
(function render(R){
  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  R.shortName = R.shortName || R.name.split(' ')[0].toLowerCase();
  R.botName = R.botName || R.name.split(' ')[0] + '.AI';

  // simple text fields: <span data-field="name">
  document.querySelectorAll('[data-field]').forEach(el => {
    const v = R[el.dataset.field]; if (v !== undefined) el.textContent = v;
  });
  document.querySelectorAll('[data-href]').forEach(el => el.href = R[el.dataset.href]);
  document.querySelectorAll('.scramble').forEach(el => el.dataset.text = R.name);
  document.title = `${R.name} — ${R.title}`;

  // stats
  $('#stats').innerHTML = R.stats.map(s => s.text
    ? `<div class="stat"><b>${s.text}</b><span>${s.label}</span></div>`
    : `<div class="stat"><b data-count="${s.value}" data-suffix="${s.suffix || ''}">0</b><span>${s.label}</span></div>`).join('');

  // about
  $('#aboutText').innerHTML = R.about.map(p => `<p>${p}</p>`).join('');
  $('#facts').innerHTML = [
    ['Based in', R.location],
    ['Education', 'MCA, Amrita Vishwa Vidyapeetham (CGPA 9.00)'],
    ['Currently', 'Application Developer Intern, AIMS Kochi'],
    ['Research', 'GALIP, SAM and CLIP for controllable image generation']
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const ICONS = {
    agent:  '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="14" r="1.3"/><circle cx="15" cy="14" r="1.3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><circle cx="8.5" cy="10" r="1"/><circle cx="13" cy="12.5" r="1"/><circle cx="11" cy="8" r="1"/>',
    spark:  '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2 19 19M5 19l2.8-2.8M16.2 7.8 19 5"/>'
  };
  $('#highlights').innerHTML = R.highlights.map(h => `
    <div class="ai-cap reveal">
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[h.icon] || ICONS.spark}</svg></div>
      <h4>${h.title}</h4><p>${h.text}</p>
    </div>`).join('');

  // skills
  $('#skillsGrid').innerHTML = Object.entries(R.skills).map(([group, list], i) => `
    <div class="skill-card gcard reveal">
      <h3><i>${pad(i + 1)}</i> ${group}</h3>
      <div class="tags">${list.map(s => `<span class="tag">${s}</span>`).join('')}</div>
    </div>`).join('');
  const lcLink = $('#lcLink'); if (lcLink) lcLink.href = R.links.leetcode;

  // experience
  $('#timeline').innerHTML = R.experience.map(j => `
    <div class="job reveal">
      <div class="job-head"><h3>${j.role}</h3>${j.period ? `<span class="when">${j.period}</span>` : ''}</div>
      <div class="org">${j.company}</div>
      <ul>${j.points.map(p => `<li>${p}</li>`).join('')}</ul>
    </div>`).join('');

  // projects: each card carries an AI pipeline and a small "model card"
  const pipe = list => list.map((s, i) => `${i ? '<i class="arr" aria-hidden="true"></i>' : ''}<span>${s}</span>`).join('');
  $('#projectGrid').innerHTML = R.projects.map((p, i) => `
    <article class="project gcard reveal${p.featured ? ' featured' : ''}${p.viz && p.viz !== 'flow' ? ' has-viz' : ''}" data-cat="${p.category}" data-id="${p.id}" data-viz="${p.viz || 'flow'}" tabindex="0">
      ${p.viz && p.viz !== 'flow' ? '<canvas class="p-viz" aria-hidden="true"></canvas>' : ''}
      <div class="p-top"><span class="p-num">${pad(i + 1)}</span><span class="p-label${p.live ? ' live' : ''}">${p.live ? '● ' : ''}${p.label}</span></div>
      <h3>${p.title}</h3>
      <p>${p.summary}</p>
      ${p.pipeline ? `<div class="pipe" aria-label="Pipeline: ${p.pipeline.join(' to ')}">${pipe(p.pipeline)}<b class="pulse" aria-hidden="true"></b></div>` : ''}
      ${p.card ? `<dl class="mcard">${p.card.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
      <div class="tags">${p.stack.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      <span class="case">View case study →</span>
      ${p.viz && p.viz !== 'flow' ? `<span class="viz-tag" aria-hidden="true">${({vector: 'illustration · vector search', segment: 'illustration · region selection', neat: 'live simulation', parse: 'illustration · PDF → fields', route: 'illustration · email routing', approval: 'approval workflow', attendance: 'attendance + shifts', migrate: 'SQL Server → Frappe'})[p.viz]}</span>` : ''}
    </article>`).join('');

  // education
  $('#eduGrid').innerHTML = R.education.map(e => `
    <div class="edu gcard reveal">
      <h3>${e.degree}</h3>
      <span class="when">${e.period} · ${e.score}</span>
      <p><b>${e.school}.</b> ${e.detail}</p>
    </div>`).join('') + `
    <div class="edu gcard reveal">
      <h3>Certifications</h3>
      <ul>${R.certifications.map(c => `<li>${c.name} <span>${c.by}</span></li>`).join('')}</ul>
    </div>
    <div class="edu gcard reveal">
      <h3>Awards</h3>
      <ul>${R.awards.map(c => `<li>${c.name} <span>${c.by}</span></li>`).join('')}</ul>
    </div>`;

  // contact
  $('#contactText').textContent = `I'm open to ${R.openTo}. Email is the quickest way to reach me.`;
  $('#contactBtns').innerHTML = `
    <a href="mailto:${R.email}" class="btn btn-primary">${R.email}</a>
    <button type="button" class="btn btn-ghost" id="copyEmail">Copy email</button>`;
  $('#socials').innerHTML = `
    <a class="social" href="${R.links.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg></a>
    <a class="social" href="${R.links.github}" target="_blank" rel="noopener" aria-label="GitHub"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg></a>
    <a class="social" href="${R.links.leetcode}" target="_blank" rel="noopener" aria-label="LeetCode"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><path d="m14 4-4 16"/></svg></a>
    <a class="social" href="mailto:${R.email}" aria-label="Email"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></a>`;
  const cp = document.getElementById('copyEmail'), st = document.getElementById('copyStatus');
  cp.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(R.email); st.textContent = 'Copied to clipboard'; }
    catch (e){ st.textContent = R.email; }
    setTimeout(() => { st.textContent = ''; }, 2600);
  });
})(window.RESUME);
