import "dotenv/config";
import express from "express";
import cors from "cors";
import Groq from "groq-sdk";

const PORT = process.env.PORT || 5000;
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const MAX_MESSAGES = 20; // how much history we forward to the model
const MAX_CONTENT_LENGTH = 4000; // characters per message



const groq = new Groq({ apiKey: process.env.GROQ_APIKEY });

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a helpful assistant. Answer clearly and concisely. " +
    "Use plain text; put code in fenced blocks. Ask a short question if a request is ambiguous.",
};

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: MODEL });
});

function sanitizeMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;

  const clean = [];
  for (const m of input.slice(-MAX_MESSAGES)) {
    if (
      !m ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string"
    ) {
      return null;
    }
    const content = m.content.trim().slice(0, MAX_CONTENT_LENGTH);
    if (content) clean.push({ role: m.role, content });
  }

  if (clean.length === 0 || clean[clean.length - 1].role !== "user") return null;
  return clean;
}

app.post("/api/chat", async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "Send a non-empty list of messages ending with a user message." });
  }

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [SYSTEM_PROMPT, ...messages],
      temperature: 0.6,
      max_tokens: 1024,
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Stop generating if the browser disconnects or the user presses Stop.
    res.on("close", () => {
      if (!res.writableEnded) stream.controller?.abort();
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) res.write(text);
    }
    res.end();
  } catch (err) {
    if (res.headersSent) return res.end();

    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    const message =
      status === 401
        ? "The Groq API key was rejected. Check GROQ_API_KEY in server/.env."
        : status === 429
        ? "Rate limit reached. Wait a moment and try again."
        : "The model could not respond. Try again.";
    console.error("Groq error:", err?.message || err);
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (model: ${MODEL})`);
});
