// Vercel serverless function: GET /api/leetcode
// Returns { total, easy, medium, hard, streak, activeDays, calendar } for the
// LeetCode card. If your current deployment already has a working
// /api/leetcode, keep yours and delete this file.
const USER = 'vishnuvinod03';
const QUERY = `query stats($u: String!) {
  matchedUser(username: $u) {
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    userCalendar { streak totalActiveDays submissionCalendar }
  }
}`;

module.exports = async (req, res) => {
  try {
    const r = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', referer: `https://leetcode.com/u/${USER}/` },
      body: JSON.stringify({ query: QUERY, variables: { u: USER } })
    });
    if (!r.ok) throw new Error('leetcode ' + r.status);
    const j = await r.json();
    const u = j && j.data && j.data.matchedUser;
    if (!u) throw new Error('no user');
    const by = {};
    (u.submitStatsGlobal.acSubmissionNum || []).forEach(x => { by[x.difficulty] = x.count; });
    const cal = u.userCalendar || {};
    let calendar = null;
    try { calendar = JSON.parse(cal.submissionCalendar || '{}'); } catch (e) {}
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      total: by.All || 0, easy: by.Easy || 0, medium: by.Medium || 0, hard: by.Hard || 0,
      streak: cal.streak ?? null, activeDays: cal.totalActiveDays ?? null, calendar
    });
  } catch (e) {
    res.status(502).json({ error: 'unavailable' });
  }
};
