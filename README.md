# Groq Chatbot

A minimalist streaming chatbot. Express proxies requests to the Groq API so your key never reaches the browser; React renders the chat.

```
groq-chatbot/
├── server/   Express + groq-sdk (port 5000)
└── client/   React + Vite (port 5173)
```

## Setup

You need Node 18 or newer and a free Groq API key from https://console.groq.com/keys.

```bash
# 1. Server
cd server
npm install
cp .env.example .env      # then paste your GROQ_API_KEY
npm run dev

# 2. Client (new terminal)
cd client
npm install
npm run dev
```

Open http://localhost:5173.

## Configuration

| Variable | Where | Default |
| --- | --- | --- |
| `GROQ_API_KEY` | server/.env | required |
| `GROQ_MODEL` | server/.env | `llama-3.3-70b-versatile` |
| `PORT` | server/.env | `5000` |
| `CLIENT_ORIGIN` | server/.env | `http://localhost:5173` |
| `VITE_API_URL` | client/.env | `/api/chat` (set to the full server URL when deployed separately) |

Model names change over time. If you get a "model not found" error, pick a current one from https://console.groq.com/docs/models and set `GROQ_MODEL`.

## How it works

- `POST /api/chat` takes `{ messages: [{ role, content }] }`, validates it, keeps the last 20 messages, and streams the reply back as plain text.
- The client reads the stream and appends each chunk, so text appears as it is generated.
- Stop cancels the request, and the server aborts the Groq stream too.

## Ideas to extend

- Markdown and code highlighting: add `react-markdown`.
- Persist chats: save `messages` to `localStorage` or a database.
- Protect a public deployment: add `express-rate-limit` to `/api/chat`.
