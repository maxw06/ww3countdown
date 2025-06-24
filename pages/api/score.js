// /pages/api/score.js   (Next.js API route example)
// Or as a Vercel/Netlify serverless function

import Parser from 'rss-parser';
const parser = new Parser();

import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

// --- Multiple relevant news feeds
const FEEDS = [
  // General conflict/military tension
  'https://news.google.com/rss/search?q=war+OR+conflict+OR+nuclear+OR+military+OR+tension+OR+crisis+OR+iran+OR+china+OR+russia+OR+usa&hl=en&gl=US&ceid=US:en',
  // Russia-Ukraine
  'https://news.google.com/rss/search?q=ukraine+russia+war+OR+invasion&hl=en&gl=US&ceid=US:en',
  // Israel-Iran
  'https://news.google.com/rss/search?q=israel+iran+war+OR+conflict+OR+missile+OR+nuclear&hl=en&gl=US&ceid=US:en',
  // Taiwan/China (potential hotspot)
  'https://news.google.com/rss/search?q=taiwan+china+military+OR+conflict+OR+war&hl=en&gl=US&ceid=US:en'
];

function hashHeadlines(headlines) {
  return headlines.map(h => h.title.trim().toLowerCase()).sort().join('||');
}

// --- De-duplicate by normalized title
function dedupeHeadlines(headlines) {
  const seen = new Set();
  return headlines.filter(h => {
    const norm = h.title.trim().toLowerCase();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

// --- Simple risk scoring function (expand as needed)
function timelessWW3Score(headlines) {
  const text = headlines.join(' ').toLowerCase();
  let score = 0;

  // Hotspot logic
  const conflicts = [
    { name: 'russia-ukraine', keywords: ['ukraine', 'donbas', 'russia', 'putin'], min: 25 },
    { name: 'israel-iran', keywords: ['israel', 'iran', 'hezbollah', 'hamas', 'gaza'], min: 25 },
    { name: 'taiwan-china', keywords: ['taiwan', 'china', 'beijing', 'pla'], min: 25 }
  ];
  let minScore = 0;

  for (const c of conflicts) {
    if (c.keywords.some(k => text.includes(k))) minScore = Math.max(minScore, c.min);
  }

  // Superpowers & escalation
  const superpowers = ['us', 'united states', 'america', 'china', 'russia', 'iran', 'nato', 'uk', 'britain', 'france'];
  const actions = ['strike', 'bomb', 'attack', 'launch', 'invade', 'missile', 'retaliat', 'shell', 'drone', 'escalat'];
  let superpowerConflict = false;
  let nuclearTarget = false;

  for (const h of headlines) {
    const lower = h.toLowerCase();
    const spCount = superpowers.filter(p => lower.includes(p)).length;
    const actionHit = actions.some(a => lower.includes(a));
    if (spCount >= 2 && actionHit) superpowerConflict = true;
    if (lower.includes('nuclear facilit') || lower.includes('nuclear site') || lower.includes('nuclear program')) nuclearTarget = true;
  }

  if (superpowerConflict && nuclearTarget) score += 70;
  else if (superpowerConflict) score += 50;
  else if (nuclearTarget) score += 25;

  // Major escalation phrases
  if (/major escalation|on the brink|total war|full-scale|direct military|regional war|all-out war/.test(text)) score += 20;

  // Strikes/attacks/bombings
  score += (text.match(/strike|attack|bombing|missile|drone|shelling/g) || []).length * 5;

  // Sanctions/retaliation/warnings
  score += (text.match(/sanction|retaliat|warning|consequence|escalation|grave warning/g) || []).length * 3;

  // Peace/diplomacy
  if (/ceasefire|diplomacy|peace talks|negotiation|de-escalation|summit|armistice/.test(text)) score -= 15;

  // Clamp and minimum if hotspot detected
  score = Math.max(minScore, Math.max(0, Math.min(100, score)));
  return Number(score.toFixed(2));
}

export default async function handler(req, res) {
  const now = Date.now();

  // 1. Fetch & merge headlines from all feeds
  let headlines = [];
  try {
    const feeds = await Promise.all(FEEDS.map(url => parser.parseURL(url)));
    headlines = feeds.flatMap(f => f.items.map(item => ({
      title: item.title,
      link: item.link
    })));
    headlines = dedupeHeadlines(headlines).slice(0, 20); // Top 20, de-duped
  } catch (err) {
    // On fetch error, fallback to Redis cache if available
    const cachedScoreData = await redis.get('ww3:score');
    if (cachedScoreData) {
      res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=60');
      return res.status(200).json(JSON.parse(cachedScoreData));
    }
    res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=60');
    return res.status(500).json({
      score: -100,
      summary: 'Unable to fetch headlines.',
      headlines: [],
      lastUpdated: new Date().toISOString()
    });
  }

  // 2. Hash & Redis cache check
  const headlinesHash = hashHeadlines(headlines);
  const [cachedHash, cachedScoreData, cachedTimestamp] = await Promise.all([
    redis.get('ww3:hash'),
    redis.get('ww3:score'),
    redis.get('ww3:timestamp')
  ]);

  if (
    cachedScoreData &&
    cachedHash === headlinesHash &&
    cachedTimestamp &&
    now - Number(cachedTimestamp) < CACHE_TTL_MS
  ) {
    res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=60');
    return res.status(200).json(JSON.parse(cachedScoreData));
  }

  // 3. Calculate scores (algorithm + AI)
  const algoScore = timelessWW3Score(headlines.map(h => h.title));

  // ---- GPT-4.1 mini (or 4o-mini if you want)
  const prompt = `
You are an expert geopolitical analyst for a World War III Countdown app.
Given these global headlines:
${headlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}

Estimate a global war risk score from 0 (peace) to 100 (World War III is officially underway), following these rules:
- 0–10: Full peace, no military incidents or threats
- 11–29: Tensions/diplomatic incidents, but no direct military fighting
- 30–49: Local wars, no major superpower clash
- 50–69: Large regional war, threats, some superpower involvement, but not total war
- 70–89: Direct fighting between superpowers, multiple crises, mobilization, high risk
- 90–99: Large-scale superpower war or confirmed nuclear use, not formal world war
- 100: Multiple superpowers at war, or public declarations of World War III

Respond in strict JSON only: {"score": [number], "summary": "[1-2 sentences explanation, mention key headlines]" }
  `;

  let gptScore = null, gptSummary = '';
  try {
    const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini', // Or 'gpt-4o-mini'
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 280,
        temperature: 0.12
      })
    });
    const gptJson = await gptResp.json();
    let gptText = gptJson.choices?.[0]?.message?.content || '{}';
    gptText = gptText.trim();
    if (gptText.startsWith('```')) gptText = gptText.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(gptText);
    if (typeof parsed.score === 'number') gptScore = Number(parsed.score);
    if (typeof parsed.summary === 'string') gptSummary = parsed.summary.trim();
  } catch (err) {
    gptScore = null;
    gptSummary = 'AI summary unavailable (GPT error).';
  }

  // 4. Smart blending: never allow full “peace” when conflicts are ongoing
  let finalScore = algoScore;
  if (
    gptScore !== null &&
    Math.abs(gptScore - algoScore) <= 30 &&
    gptScore >= 0 &&
    gptScore <= 100
  ) {
    finalScore = Number(((algoScore * 0.6 + gptScore * 0.4)).toFixed(2));
  }

  // If major conflict headlines, force minimum “tension” score (e.g., 20)
  const HOTSPOTS = ['ukraine', 'gaza', 'israel', 'iran', 'taiwan', 'china', 'missile', 'strike', 'war', 'russia'];
  if (headlines.some(h =>
    HOTSPOTS.some(hs => h.title.toLowerCase().includes(hs))
  )) {
    finalScore = Math.max(finalScore, 20); // Don’t allow “peace” if any ongoing
  }

  finalScore = Math.max(0, Math.min(100, finalScore));

  // Log scores for debugging
  console.log({ algoScore, gptScore, finalScore, gptSummary, topHeadlines: headlines.slice(0, 3) });

  // 5. Save/cache
  const newScoreData = {
    score: finalScore,
    summary: gptSummary,
    headlines,
    algorithmScore: algoScore,
    gptScore,
    lastUpdated: new Date().toISOString()
  };
  await Promise.all([
    redis.set('ww3:score', JSON.stringify(newScoreData), { ex: CACHE_TTL_MS / 1000 }),
    redis.set('ww3:hash', headlinesHash, { ex: CACHE_TTL_MS / 1000 }),
    redis.set('ww3:timestamp', String(now), { ex: CACHE_TTL_MS / 1000 })
  ]);
  res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=60');
  return res.status(200).json(newScoreData);
}