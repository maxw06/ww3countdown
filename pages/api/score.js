import Parser from 'rss-parser';
const parser = new Parser();

import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function hashHeadlines(headlines) {
  // Sort the titles alphabetically before joining, so order changes don't matter
  return headlines.map(h => h.title).sort().join("||");
}

function timelessWW3Score(headlines) {
  const text = headlines.join(" ").toLowerCase();
  let score = 0;

  // Superpower and escalation logic
  const superpowers = ["us", "united states", "america", "china", "russia", "iran", "nato", "uk", "britain", "france"];
  const actions = ["strike", "bomb", "attack", "launch", "invade", "obliterat", "missile", "retaliat"];
  let superpowerConflict = false;
  let nuclearTarget = false;

  for (const headline of headlines) {
    const lower = headline.toLowerCase();
    let spCount = superpowers.filter(p => lower.includes(p)).length;
    let actionHit = actions.some(a => lower.includes(a));
    if (spCount >= 2 && actionHit) superpowerConflict = true;
    if (lower.includes("nuclear facilit") || lower.includes("nuclear site")) nuclearTarget = true;
  }

  if (superpowerConflict && nuclearTarget) score += 70;
  else if (superpowerConflict) score += 50;
  else if (nuclearTarget) score += 25;

  // Major escalation phrases
  if (/major escalation|on the brink|total war|full-scale|direct military|regional war|all-out war/.test(text)) score += 20;

  // Every "strike", "attack", "bombing" (outside of above logic) = +5 each
  score += (text.match(/strike|attack|bombing|missile/g) || []).length * 5;

  // Sanctions, warnings, retaliation, ‘everlasting consequences’ = +3 each
  score += (text.match(/sanction|retaliat|warning|consequence|escalation|grave warning/g) || []).length * 3;

  // Peace/diplomacy words (ceasefire, talks, negotiation) = -15
  if (/ceasefire|diplomacy|peace talks|negotiation|de-escalation|summit|armistice/.test(text)) score -= 15;

  // Clamp and round
  score = Math.max(0, Math.min(100, score));
  return Number(score.toFixed(2));  // TWO decimals
}

export default async function handler(req, res) {
  const now = Date.now();

  // 1. Fetch latest headlines (always, so we can compare hashes)
  let headlines = [];
  try {
    const feed = await parser.parseURL(
      'https://news.google.com/rss/search?q=war+OR+conflict+OR+nuclear+OR+military+OR+tension+OR+crisis+OR+iran+OR+china+OR+russia+OR+usa&hl=en&gl=US&ceid=US:en'
    );
    headlines = feed.items.slice(0, 12).map(item => ({
      title: item.title,
      link: item.link
    }));
  } catch (err) {
    // If RSS fetch fails, use Redis cache if available
    const cachedScoreData = await redis.get("ww3:score");
    if (cachedScoreData) {
      res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=60'); // <--- ADD HERE
      return res.status(200).json(JSON.parse(cachedScoreData));
    }
    res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=60'); // <--- ADD HERE
    return res.status(500).json({
      score: -100,
      summary: "Unable to fetch headlines.",
      headlines: [],
      lastUpdated: new Date().toISOString(),
    });
  }

  // 2. Hash the headlines to detect changes
  const headlinesHash = hashHeadlines(headlines);
  const [cachedHash, cachedScoreData, cachedTimestamp] = await Promise.all([
    redis.get("ww3:hash"),
    redis.get("ww3:score"),
    redis.get("ww3:timestamp"),
  ]);

  if (
    cachedScoreData &&
    cachedHash === headlinesHash &&
    cachedTimestamp &&
    now - Number(cachedTimestamp) < CACHE_TTL_MS
  ) {
    res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=60'); // <--- ADD HERE
    return res.status(200).json(JSON.parse(cachedScoreData));
  }


  // 4. Calculate scores (algorithm + AI)
  const algoScore = timelessWW3Score(headlines.map(h => h.title));

  // --- AI Adjustment (GPT Weighted)
  const prompt = `
You are an expert geopolitical analyst for a World War III Countdown app.
Given these headlines:
${headlines.map((h, i) => `${i + 1}. ${h.title}`).join("\n")}

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

  let gptScore = null;
  let gptSummary = "";
  try {
    const gptResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 280,
        temperature: 0.12,
      }),
    });

    const gptJson = await gptResp.json();
    let gptText = gptJson.choices?.[0]?.message?.content || "{}";
    gptText = gptText.trim();
    if (gptText.startsWith("```")) {
      gptText = gptText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    }
    const parsed = JSON.parse(gptText);
    if (typeof parsed.score === "number") gptScore = Number(parsed.score);
    if (typeof parsed.summary === "string") gptSummary = parsed.summary.trim();
  } catch (err) {
    gptScore = null;
    gptSummary = "AI summary unavailable (GPT error).";
  }

  // --- Hybrid Score
  let finalScore = algoScore;
  // If AI's score is plausible (within 30 of algo) and not crazy, blend 60/40 (algo/ai)
  if (
    gptScore !== null &&
    Math.abs(gptScore - algoScore) <= 30 &&
    gptScore >= 0 &&
    gptScore <= 100
  ) {
    finalScore = Number(
      ((algoScore * 0.6 + gptScore * 0.4)).toFixed(2)  // TWO decimals
    );
  }

  // Clamp again
  finalScore = Math.max(0, Math.min(100, finalScore));

// 5. Cache everything, with the new hash
  const newScoreData = {
    score: finalScore,
    summary: gptSummary,
    headlines,
    algorithmScore: algoScore,
    gptScore,
    lastUpdated: new Date().toISOString(),
  };
  await Promise.all([
    redis.set("ww3:score", JSON.stringify(newScoreData), { ex: CACHE_TTL_MS / 1000 }),
    redis.set("ww3:hash", headlinesHash, { ex: CACHE_TTL_MS / 1000 }),
    redis.set("ww3:timestamp", String(now), { ex: CACHE_TTL_MS / 1000 }),
  ]);
  res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=60'); // <--- ADD HERE
  return res.status(200).json(newScoreData);
}