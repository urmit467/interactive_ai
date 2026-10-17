import { useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "/api/chat";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  const abortRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the newest text in view while the reply streams in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Grow the textarea with its content, up to a limit.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;

    setError("");
    setInput("");

    const history = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Could not reach the server. Check that it is running.");
      }
    } finally {
      // Drop the empty placeholder if nothing came back.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last && last.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
      });
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError("");
    setInput("");
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="app">
      <header className="header">
        <span className="title">Chat</span>
        {!isEmpty && (
          <button className="text-button" onClick={newChat}>
            New chat
          </button>
        )}
      </header>

      <main className="thread" aria-live="polite">
        {isEmpty ? (
          <div className="empty">
            <h1>What can I help with?</h1>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              {m.content || <span className="caret" aria-label="Thinking" />}
            </div>
          ))
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </main>

      <footer className="composer-wrap">
        <div className="composer">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message"
            rows={1}
            aria-label="Message"
            autoFocus
          />
          {streaming ? (
            <button className="icon-button" onClick={stop} aria-label="Stop generating">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              className="icon-button"
              onClick={send}
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
