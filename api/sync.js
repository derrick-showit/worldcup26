// api/sync.js — Vercel serverless function.
// Holds the Anthropic API key (server-side only) and runs the live-results web search.
// Returns the parsed JSON outcomes object to the browser.

const GROUPS = {
  A: ["Mexico", "South Africa", "Korea Republic", "Czechia"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Türkiye"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

function buildPrompt() {
  const groups = Object.keys(GROUPS).map((g) => `${g}: ${GROUPS[g].join(", ")}`).join("\n");
  return `Find official 2026 FIFA World Cup outcomes using web search. Today is ${new Date().toDateString()}.

Groups:
${groups}

Respond with ONLY this JSON (no markdown, no commentary). Include data ONLY where officially confirmed; otherwise omit the key or use an empty value:
{
 "groupOrder": {"A":["1st","2nd","3rd","4th"]},
 "thirds": ["the 8 third-placed teams that officially qualified to the Round of 32"],
 "reachedR16": ["the 16 teams that won their Round of 32 match"],
 "reachedQF": ["the 8 teams in the quarter-finals"],
 "reachedSF": ["the 4 teams in the semi-finals"],
 "finalists": ["the 2 teams in the final"],
 "champion": "the World Cup winner"
}
Use the exact team names from the groups list above. If the tournament has not produced a result yet, return {}.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Missing ANTHROPIC_API_KEY environment variable" });
    return;
  }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", // change to any current model string from docs.claude.com if needed
        max_tokens: 2000,
        messages: [{ role: "user", content: buildPrompt() }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    const data = await r.json();
    if (data && data.error) {
      res.status(500).json({ error: data.error.message || "Anthropic API error" });
      return;
    }
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    let json = {};
    try {
      json = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      json = {};
    }
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
