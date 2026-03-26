// api/generate.js
// Vercel Edge Function — proxies Anthropic API calls with streaming
// Place at: api/generate.js in your project root

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { system, user } = await req.json();

  if (!system || !user) {
    return new Response(JSON.stringify({ error: "Missing system or user prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      stream: true,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return new Response(JSON.stringify({ error: errText }), {
      status: anthropicRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(anthropicRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
