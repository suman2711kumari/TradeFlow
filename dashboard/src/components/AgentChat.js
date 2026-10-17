import React, { useEffect, useRef, useState } from "react";
import "./ResearchLab.css";
import { getJson, postJson, Spinner } from "./research/shared";

// All visible text for the two supported languages. The assistant's own answers follow the same choice (sent to the server as `language`).
const TEXT = {
  en: {
    eyebrow: "AI ASSISTANT",
    title: "Ask about your portfolio.",
    intro: "Ask in everyday words. The assistant runs the checks for you on your own simulated portfolio and explains the results simply. It cannot buy or sell anything.",
    tryThese: "Try one of these:",
    placeholder: "Ask about your risk, a stock, or a what-if…",
    send: "Send ↗",
    thinking: "Running the checks…",
    noChecks: "No checks were needed for this answer.",
    checksUsed: (n) => `${n} check${n === 1 ? "" : "s"} were run to answer this`,
    dataReturned: "See the data it used",
    failed: "failed",
    disclaimer: "Educational tool with simulated money. Not investment advice. AI can make mistakes, so compare answers with the data shown under each one.",
    notConfigured: "The assistant is not set up yet",
    notConfiguredBody: "Add GEMINI_API_KEY=your_key to backend/.env and restart the backend. Everything else in TradeFlow works without it.",
    suggestions: [
      "How risky is my portfolio?",
      "If the market falls 5%, how much could I lose?",
      "Is too much of my money in one stock or sector?",
      "What would have happened if I had followed a simple trading rule on INFY for 3 years?",
    ],
    tools: {
      get_portfolio_summary: "Looked at your holdings",
      get_portfolio_risk: "Checked your portfolio risk",
      run_stress_test: "Ran a what-if market fall",
      get_stock_analysis: "Analysed a stock",
      run_backtest: "Tested a trading rule on past prices",
      get_market_quotes: "Fetched the latest prices",
    },
    you: "You",
    bot: "TradeFlow AI",
  },
  hi: {
    eyebrow: "AI सहायक",
    title: "अपने पोर्टफोलियो के बारे में पूछिए।",
    intro: "आम भाषा में सवाल पूछिए। सहायक आपके सिम्युलेटेड पोर्टफोलियो पर जाँच चलाकर नतीजे आसान शब्दों में समझाता है। यह कुछ भी खरीद या बेच नहीं सकता।",
    tryThese: "इनमें से कोई सवाल आज़माएँ:",
    placeholder: "अपने जोखिम, किसी शेयर या 'अगर ऐसा हुआ तो' के बारे में पूछें…",
    send: "भेजें ↗",
    thinking: "जाँच चल रही है…",
    noChecks: "इस जवाब के लिए किसी जाँच की ज़रूरत नहीं पड़ी।",
    checksUsed: (n) => `इस जवाब के लिए ${n} जाँच चलाई गई`,
    dataReturned: "इस्तेमाल किया गया डेटा देखें",
    failed: "असफल",
    disclaimer: "यह नकली (सिम्युलेटेड) पैसे वाला शैक्षिक टूल है, निवेश की सलाह नहीं। AI गलती कर सकता है, इसलिए हर जवाब के नीचे दिए डेटा से मिलान कर लें।",
    notConfigured: "सहायक अभी सेट अप नहीं है",
    notConfiguredBody: "backend/.env में GEMINI_API_KEY=आपकी_की जोड़ें और बैकएंड दोबारा चालू करें। TradeFlow का बाकी सब इसके बिना भी चलता है।",
    suggestions: [
      "मेरा पोर्टफोलियो कितना जोखिम भरा है?",
      "अगर बाज़ार 5% गिरे तो मुझे कितना नुकसान हो सकता है?",
      "क्या मेरा ज़्यादा पैसा किसी एक शेयर या सेक्टर में लगा है?",
      "अगर मैंने INFY में 3 साल तक एक सरल नियम से ट्रेडिंग की होती तो क्या होता?",
    ],
    tools: {
      get_portfolio_summary: "आपके होल्डिंग्स देखे गए",
      get_portfolio_risk: "आपके पोर्टफोलियो का जोखिम जाँचा गया",
      run_stress_test: "बाज़ार गिरने का 'अगर ऐसा हुआ तो' परीक्षण चलाया गया",
      get_stock_analysis: "एक शेयर का विश्लेषण किया गया",
      run_backtest: "पुराने भावों पर एक ट्रेडिंग नियम परखा गया",
      get_market_quotes: "ताज़ा भाव लाए गए",
    },
    you: "आप",
    bot: "TradeFlow AI",
  },
};

const readSavedLanguage = () => {
  try { return localStorage.getItem("tradeflow-chat-language") === "hi" ? "hi" : "en"; } catch { return "en"; }
};

const ToolTrace = ({ calls, t }) => (
  <details className="agent-trace">
    <summary>{t.checksUsed(calls.length)}</summary>
    {calls.map((c, i) => (
      <div key={i} className={`agent-call ${c.ok ? "" : "agent-call-failed"}`}>
        <div><strong>{t.tools[c.name] || c.name}</strong><span>{c.ok ? "✓" : t.failed} · {c.durationMs} ms</span></div>
        <code>{c.name}({JSON.stringify(c.input)})</code>
        {c.ok ? <details><summary>{t.dataReturned}</summary><pre>{c.resultPreview}</pre></details> : <p className="research-inline-error">{c.error}</p>}
      </div>
    ))}
  </details>
);

const AgentChat = () => {
  const [language, setLanguage] = useState(readSavedLanguage);
  const [messages, setMessages] = useState([]);   // { role, content, toolCalls? }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const endRef = useRef(null);
  const t = TEXT[language];

  useEffect(() => { getJson("/api/agent/status").then(setStatus).catch(() => setStatus({ configured: true })); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const chooseLanguage = (value) => {
    setLanguage(value);
    try { localStorage.setItem("tradeflow-chat-language", value); } catch { /* storage may be unavailable; the choice still works for this visit */ }
  };

  const send = async (text) => {
    const question = text.trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user", content: question }];
    setMessages(next); setInput(""); setBusy(true); setError("");
    try {
      const data = await postJson("/api/agent/chat", { messages: next.map(({ role, content }) => ({ role, content })), language });
      setMessages([...next, { role: "assistant", content: data.reply, toolCalls: data.toolCalls, complete: data.complete }]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const disabled = busy || (status && !status.configured);

  return (
    <div className="research-lab agent-page">
      <section className="research-hero">
        <div>
          <div className="research-eyebrow"><span /> {t.eyebrow}</div>
          <h2>{t.title}</h2>
          <p>{t.intro}</p>
        </div>
        <div className="lang-switch" role="group" aria-label="Answer language">
          <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>English</button>
          <button type="button" className={language === "hi" ? "active" : ""} aria-pressed={language === "hi"} onClick={() => chooseLanguage("hi")}>हिन्दी</button>
        </div>
      </section>

      {status && !status.configured && (
        <div className="edge-callout edge-none"><strong>{t.notConfigured}</strong><p>{t.notConfiguredBody}</p></div>
      )}

      <section className="research-panel agent-window">
        <div className="agent-log" aria-live="polite">
          {messages.length === 0 && (
            <div className="agent-empty"><p>{t.tryThese}</p>
              {t.suggestions.map((s) => <button key={s} type="button" className="chip-btn chip-wide" onClick={() => send(s)} disabled={disabled}>{s}</button>)}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`agent-msg agent-${m.role}`}>
              <span className="agent-who">{m.role === "user" ? t.you : t.bot}</span>
              <p>{m.content}</p>
              {m.toolCalls?.length > 0 && <ToolTrace calls={m.toolCalls} t={t} />}
              {m.role === "assistant" && m.toolCalls?.length === 0 && <small className="research-fineprint">{t.noChecks}</small>}
            </div>
          ))}
          {busy && <div className="agent-msg agent-assistant"><span className="agent-who">{t.bot}</span><p><Spinner /> {t.thinking}</p></div>}
          {error && <p className="research-inline-error" role="alert">{error}</p>}
          <div ref={endRef} />
        </div>
        <form className="research-assistant-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input aria-label={t.placeholder} value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder={t.placeholder} disabled={busy} />
          <button className="research-run-btn" type="submit" disabled={disabled || !input.trim()}>{t.send}</button>
        </form>
        <p className="research-fineprint">{t.disclaimer}</p>
      </section>
    </div>
  );
};

export default AgentChat;
