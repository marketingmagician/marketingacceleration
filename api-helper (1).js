// src/api.js
// Client-side API helper
// In production (Vercel): calls /api/generate with streaming
// Streams the SSE response and parses the final JSON

export async function callAPI(system, user, onChunk) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, user }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === "content_block_delta" && evt.delta?.text) {
          full += evt.delta.text;
          if (onChunk) onChunk(full);
        }
      } catch (e) {
        // skip malformed SSE events
      }
    }
  }

  const cleaned = full.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}
