import Parser from 'rss-parser';
const parser = new Parser();

import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

const FEEDS = [
  // General global tensions
  'https://news.google.com/rss/search?q=war+OR+conflict+OR+nuclear+OR+military+OR+tension+OR+crisis+OR+iran+OR+china+OR+russia+OR+usa&hl=en&gl=US&ceid=US:en',
  // Russia-Ukraine
  'https://news.google.com/rss/search?q=ukraine+russia+war+OR+invasion&hl=en&gl=US&ceid=US:en',
  // Israel-Iran
  'https://news.google.com/rss/search?q=israel+iran+war+OR+conflict+OR+missile+OR+nuclear&hl=en&gl=US&ceid=US:en',
  // Taiwan/China
  'https://news.google.com/rss/search?q=taiwan+china+military+OR+conflict+OR+war&hl=en&gl=US&ceid=US:en'
];

function hashHeadlines(headlines) {
  return headlines.map(h => h.title.trim().toLowerCase()).sort().join('||');
}

function dedupeHeadlines(headlines) {
  const seen = new Set();
  return headlines.filter(h => {
    const norm = h.title.trim().toLowerCase();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

// --- Main risk calculation (anchors, not hype)
function realisticWW3Score(headlines) {
  const text = headlines.join(' ').toLowerCase();
  let score = 0;

  // 1. Peace/ceasefire detection: heavy reduction
  if (/ceasefire|diplomacy|peace talks|negotiation|summit|armistice|paused|de-escalation/.test(text)) score -= 30;

  // 2. Major regional conflict detection
  const conflicts = [
    { name: 'russia-ukraine', keywords: ['ukraine', 'donbas', 'russia', 'putin'], min: 25 },
    { name: 'israel-iran', keywords: ['israel', 'iran', 'hezbollah', 'hamas', 'gaza'], min: 25 },
    { name: 'taiwan-china', keywords: ['taiwan', 'china', 'beijing', 'pla'], min: 25 }
  ];
  let minScore = 0;
  for (const c of conflicts) {
    if (c.keywords.some(k => text.includes(k))) minScore = Math.max(minScore, c.min);
  }
  // If more than one major conflict, raise floor
  let activeHotspots = conflicts.reduce((acc, c) =>
    c.keywords.some(k => text.includes(k)) ? acc + 1 : acc, 0
  );
  if (activeHotspots > 1) minScore = Math.max(minScore, 40);

  // 3. Superpower conflict & nuclear language
  const superpowers = ['us', 'united states', 'america', 'china', 'russia', 'iran', 'nato', 'uk', 'britain', 'france'];
  const actions = ['strike', 'bomb', 'attack', 'launch', 'invade', 'missile', 'retaliat', 'shell', 'drone', 'escalat'];
  let superpowerConflict = 0;
  let nuclearThreat = 0;
  for (const h of headlines) {
    const lower = h.toLowerCase();
    const spCount = superpowers.filter(p => lower.includes(p)).length;
    const actionHit = actions.some(a => lower.includes(a));
    if (spCount >= 2 && actionHit) superpowerConflict++;
    if (lower.includes('nuclear threat') || lower.includes('nuclear site') || lower.includes('nuclear attack')) nuclearThreat++;
  }
  if (superpowerConflict >= 2 && nuclearThreat > 0) score += 70;
  else if (superpowerConflict >= 2) score += 45;
  else if (superpowerConflict === 1) score += 25;
  else if (nuclearThreat > 0) score += 20;

  // 4. Escalation/war language bump
  if (/major escalation|total war|on the brink|direct military/.test(text)) score += 10;

  // 5. Minor strikes, sanctions, missile, shelling
  score += (text.match(/strike|attack|bombing|missile|drone|shelling/g) || []).length * 3;
  score += (text.match(/sanction|retaliat|warning|consequence|escalation|grave warning/g) || []).length * 2;

  // 6. Clamp: never > 60 unless both double superpower/nuclear *and* AI agree
  score = Math.max(minScore, Math.max(0, Math.min(score, 60)));
  return Number(score.toFixed(2));
}

export default async function handler(req, res) {
  const now = Date.now();

  // 1. Fetch & dedupe headlines
  let headlines = [];
  try {
    const feeds = await Promise.all(FEEDS.map(url => parser.parseURL(url)));
    headlines = feeds.flatMap(f => f.items.map(item => ({
      title: item.title,
      link: item.link
    })));
    headlines = dedupeHeadlines(headlines).slice(0, 20);
  } catch (err) {
    // Fallback to cache
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

  // 2. Cache check
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

  // 3. Calculate algorithm score
  const algoScore = realisticWW3Score(headlines.map(h => h.title));

  // 4. Run GPT-4 for independent AI risk score
  const prompt = `
You are an expert geopolitical analyst for a World War III Countdown app.

Given these news headlines:
${headlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}

Estimate a global war risk score from 0 (peace) to 100 (World War III is officially underway), following these rules:
- 0–10: Full peace, no military incidents or threats
- 11–29: Tensions/diplomatic incidents, but no direct military fighting
- 30–49: Local wars, no major superpower clash
- 50–69: Large regional war, threats, some superpower involvement, but not total war
- 70–89: Direct fighting between superpowers, multiple crises, mobilization, high risk
- 90–99: Large-scale superpower war or confirmed nuclear use, not formal world war
- 100: Only give this score if there are *official declarations of World War III* or confirmed, ongoing global wars between multiple superpowers. Escalating rhetoric, threats, or regional wars—even involving superpowers—should not be scored 100.

Respond in strict JSON only: {"score": [number], "summary": "[1-2 sentences, mention key headlines and your reasoning]"}
`.trim();

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
        temperature: 0.15
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

  // 5. Blend/override logic for accuracy and realism
  let finalScore = algoScore;
  let summaryWithWarning = gptSummary;
  if (gptScore !== null && gptScore >= 0 && gptScore <= 100) {
    if (Math.abs(gptScore - algoScore) <= 20) {
      finalScore = Number(((algoScore * 0.5 + gptScore * 0.5)).toFixed(2));
    } else {
      // If the difference is large, use the higher (unless one is extreme)
      if (gptScore > algoScore && gptScore < 85) {
        finalScore = gptScore;
        summaryWithWarning = `AI risk model gave a higher estimate (${gptScore}). Showing more cautious result. ${gptSummary}`;
      } else if (algoScore > gptScore && algoScore < 85) {
        finalScore = algoScore;
        summaryWithWarning = `Algorithm risk model gave a higher estimate (${algoScore}). Showing more cautious result. ${gptSummary}`;
      } else {
        // If either score is >85, cap at 70 unless both are extreme
        finalScore = Math.min(algoScore, gptScore, 70);
        summaryWithWarning = `Large model disagreement (${algoScore} vs ${gptScore}), using conservative cap. ${gptSummary}`;
      }
    }
  }

  // Never show >90 unless BOTH models say so, and news supports it
  if (finalScore > 90 && !(algoScore >= 90 && gptScore >= 90)) finalScore = 89;

  // If two or more hotspots, min 40; if one, min 25
  const HOTSPOTS = ['ukraine', 'gaza', 'israel', 'iran', 'taiwan', 'china', 'missile', 'strike', 'war', 'russia'];
  const hotspotCount = headlines.reduce((acc, h) =>
    acc + (HOTSPOTS.some(hs => h.title.toLowerCase().includes(hs)) ? 1 : 0), 0
  );
  if (hotspotCount >= 2) finalScore = Math.max(finalScore, 40);
  else if (hotspotCount === 1) finalScore = Math.max(finalScore, 25);

  // Final clamp
  finalScore = Math.max(0, Math.min(100, finalScore));

  // Debug logging for transparency
  console.log({ algoScore, gptScore, finalScore, gptSummary, topHeadlines: headlines.slice(0, 3) });

  // 6. Save/cache
  const newScoreData = {
    score: finalScore,
    summary: summaryWithWarning,
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