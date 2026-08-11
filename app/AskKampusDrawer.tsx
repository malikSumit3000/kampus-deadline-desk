"use client";

import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { citationParts, consumeSseChunk } from "@/lib/ask-kampus/client";

type ChatSource = {
  label: string;
  subject: string;
  sender: string;
  receivedAt: string;
  url: string;
  sensitive: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
};

const prompts = [
  "What deadlines are coming up?",
  "Summarize my placement emails",
  "What did Student Affairs announce?",
  "Summarize my important tasks",
];

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function AnswerText({ content, sources = [] }: { content: string; sources?: ChatSource[] }) {
  const sourceMap = new Map(sources.map((source) => [source.label, source]));
  return <p className="ask-answer-text">{citationParts(content).map((part, index) => {
    if (part.type === "text") return <span key={`${index}-${part.value}`}>{part.value}</span>;
    const source = sourceMap.get(part.value);
    return source
      ? <a key={`${index}-${part.value}`} href={source.url} target="_blank" rel="noreferrer" title={`Open ${source.subject} in Gmail`}>[{part.value}]</a>
      : <span key={`${index}-${part.value}`}>[{part.value}]</span>;
  })}</p>;
}

export default function AskKampusDrawer({ gmailConnected }: { gmailConnected: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  loadingRef.current = loading;

  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    const trigger = triggerRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], textarea:not([disabled])') ?? []);
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !loadingRef.current) {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => (gmailConnected ? inputRef.current : focusable()[0])?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [gmailConnected, open]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  async function sendQuestion(rawQuestion: string) {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion || loading || !gmailConnected) return;
    const userMessage: ChatMessage = { id: messageId(), role: "user", content: nextQuestion };
    const assistantId = messageId();
    const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: "", sources: [] };
    const history = messages.filter((message) => message.content).slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setQuestion("");
    setLoading(true);
    setStatus("Starting a private Gmail search…");

    try {
      const response = await fetch("/api/ask-kampus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: nextQuestion, history }),
      });
      if (!response.body) throw new Error("Ask Kampus did not return a response stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const parsed = consumeSseChunk(buffer, decoder.decode(value, { stream: true }));
        buffer = parsed.remainder;
        for (const event of parsed.events) {
          const data = event.data as Record<string, unknown>;
          if (event.event === "status") setStatus(String(data.message ?? "Working…"));
          if (event.event === "sources" && Array.isArray(data.items)) {
            setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, sources: data.items as ChatSource[] } : message));
          }
          if (event.event === "delta") {
            const text = String(data.text ?? "");
            setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: `${message.content}${text}` } : message));
          }
          if (event.event === "done") {
            setRemaining(typeof data.remaining === "number" ? data.remaining : null);
            setStatus("");
          }
          if (event.event === "error") {
            setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: String(data.message ?? "Ask Kampus is unavailable."), error: true } : message));
            setStatus("");
          }
        }
      }
    } catch (error) {
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: error instanceof Error ? error.message : "Ask Kampus is unavailable.", error: true } : message));
      setStatus("");
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(question);
  }

  function inputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(question);
    }
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="ask-launcher" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span aria-hidden="true">✦</span> Ask Kampus
      </button>
      {open && (
        <div className="ask-layer">
          <button className="ask-backdrop-dismiss" type="button" aria-label="Close Ask Kampus" onClick={() => !loading && setOpen(false)} />
          <aside ref={drawerRef} className="ask-drawer" role="dialog" aria-modal="true" aria-labelledby="ask-kampus-title">
            <header className="ask-header">
              <div>
                <p className="eyebrow">Private inbox assistant</p>
                <h2 id="ask-kampus-title">Ask Kampus</h2>
              </div>
              <div className="ask-header-actions">
                {messages.length > 0 && <button type="button" onClick={() => { setMessages([]); setStatus(""); }} disabled={loading}>New chat</button>}
                <button type="button" className="ask-close" onClick={() => setOpen(false)} disabled={loading} aria-label="Close Ask Kampus">×</button>
              </div>
            </header>

            <div className="ask-privacy-note"><span aria-hidden="true">↳</span> Searches only email received after Gmail connection. Chat is not saved.</div>

            <div className="ask-messages" ref={messagesRef} aria-live="polite">
              {!gmailConnected ? (
                <div className="ask-empty">
                  <span className="ask-orb" aria-hidden="true">✦</span>
                  <h3>Connect Gmail to ask your inbox</h3>
                  <p>Website sign-in alone does not give Ask Kampus access to email.</p>
                  <a className="button primary" href="/api/gmail/connect">Connect Gmail</a>
                </div>
              ) : messages.length === 0 ? (
                <div className="ask-empty">
                  <span className="ask-orb" aria-hidden="true">✦</span>
                  <h3>What do you need to find?</h3>
                  <p>Ask about any post-connection email, deadline, announcement, or task summary.</p>
                  <div className="ask-prompts">
                    {prompts.map((prompt) => <button type="button" key={prompt} onClick={() => void sendQuestion(prompt)}>{prompt}</button>)}
                  </div>
                </div>
              ) : messages.map((message) => (
                <article className={`ask-message ${message.role}${message.error ? " error" : ""}`} key={message.id}>
                  <small>{message.role === "user" ? "You" : "Ask Kampus"}</small>
                  {message.content ? <AnswerText content={message.content} sources={message.sources} /> : <span className="ask-thinking"><i /><i /><i /></span>}
                  {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                    <div className="ask-sources">
                      <strong>Sources</strong>
                      {message.sources.map((source) => (
                        <a href={source.url} target="_blank" rel="noreferrer" key={source.label}>
                          <span>{source.label}</span>
                          <span><b>{source.subject}</b><small>{source.sender} · {new Date(source.receivedAt).toLocaleString("en-IN")}</small></span>
                          {source.sensitive && <em>Body withheld</em>}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {status && <div className="ask-status" role="status"><span className="health-dot" />{status}</div>}
            </div>

            {gmailConnected && (
              <form className="ask-composer" onSubmit={submit}>
                <label htmlFor="ask-question" className="sr-only">Ask a question about Gmail</label>
                <textarea ref={inputRef} id="ask-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={inputKeyDown} maxLength={1_000} rows={2} placeholder="Ask about an email, deadline, or task…" disabled={loading} />
                <button type="submit" className="ask-send" disabled={loading || !question.trim()} aria-label="Send question">→</button>
                <small>{remaining === null ? "10 questions per day" : `${remaining} questions left today`} · Enter to send</small>
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
