import React, { useEffect, useState } from "react";
import "./ResearchLab.css";
import { getJson, postJson, Spinner } from "./research/shared";

// The backend gives Gemini access to READ-ONLY information functions.
// The chat interface only sends questions and displays the returned answer.
const suggestions = [
  "Summarise my paper-trading portfolio.",
  "What does portfolio volatility mean?",
  "Why should I compare an ML model with a baseline?"
];

export default function AgentChat() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("en");
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getJson("/api/agent/status")
      .then(data => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(true));
  }, []);

  const send = async (text) => {
    const input = text.trim();
    if (!input || busy || !configured) return;
    const next = [...messages, { role: "user", content: input }];
    setMessages(next);
    setQuestion("");
    setBusy(true);
    setError("");
    try {
      const response = await postJson("/api/agent/chat", { messages: next, language });
      setMessages([...next, { role: "assistant", content: response.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="research-lab agent-page">
      <section className="research-hero">
        <div>
          <div className="research-eyebrow"><span /> GEMINI ASSISTANT</div>
          <h2>Ask about your paper trades</h2>
          <p>The assistant explains portfolio information using read-only backend tools. It cannot buy or sell stocks.</p>
        </div>
        <div className="lang-switch">
          <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
          <button type="button" className={language === "hi" ? "active" : ""} onClick={() => setLanguage("hi")}>हिन्दी</button>
        </div>
      </section>
      {!configured && <div className="research-error">Add GEMINI_API_KEY to backend/.env, then restart the backend.</div>}
      <section className="research-panel agent-window">
        <div className="agent-log">
          {messages.length === 0 && <div className="agent-empty">
            <p>Try a question:</p>
            {suggestions.map(s => <button className="chip-btn chip-wide" key={s} type="button" disabled={!configured || busy} onClick={() => send(s)}>{s}</button>)}
          </div>}
          {messages.map((m, i) => <div key={i} className={"agent-msg agent-" + m.role}>
            <span className="agent-who">{m.role === "user" ? "You" : "TradeFlow AI"}</span>
            <p>{m.content}</p>
          </div>)}
          {busy && <div className="agent-msg agent-assistant"><Spinner /> Reading your question...</div>}
          {error && <p className="research-inline-error" role="alert">{error}</p>}
        </div>
        <form className="research-assistant-form" onSubmit={e => { e.preventDefault(); send(question); }}>
          <input aria-label="Question for the assistant" placeholder="Ask about your portfolio..." value={question} onChange={e => setQuestion(e.target.value)} disabled={!configured || busy} />
          <button type="submit" disabled={!configured || busy || !question.trim()}>Send</button>
        </form>
      </section>
      <p className="research-fineprint">Educational use only. Gemini can make mistakes; market data may be delayed. No real orders are placed.</p>
    </div>
  );
}
