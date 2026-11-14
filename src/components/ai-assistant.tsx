"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  category?: string | null;
};

export function AiAssistant({ onSelectCategory, onClose }: { onSelectCategory: (category: string) => void; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Bonjour ! Décrivez-moi le problème chez vous, et je vous aiderai à trouver le bon type d’artisan." },
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-8).map(({ role, content: text }) => ({ role, content: text })) }),
      });
      const result: { message?: string; category?: string | null; error?: string } = await response.json();
      if (!response.ok || !result.message) throw new Error(result.error ?? "Impossible d’obtenir une réponse.");
      setMessages((current) => [...current, { role: "assistant", content: result.message!, category: result.category }]);
    } catch (sendError) {
      console.error("Envoi à l’assistant IA impossible :", sendError);
      setError(sendError instanceof Error ? sendError.message : "L’assistant est momentanément indisponible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop ai-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <section className="artisan-modal ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-title">
        <button className="modal-close" disabled={loading} onClick={onClose} aria-label="Fermer">×</button>
        <p className="eyebrow">ASSISTANT QUICKFIX</p>
        <h2 id="ai-title">Décrivons votre besoin</h2>
        <p className="ai-disclaimer">L’assistant vous oriente, mais ne remplace pas l’avis d’un professionnel. Évitez de partager des informations personnelles.</p>
        <div className="ai-conversation" ref={conversationRef} aria-live="polite">
          {messages.map((message, index) => (
            <div className={`ai-message ${message.role}`} key={`${index}-${message.role}`}>
              <p>{message.content}</p>
              {message.role === "assistant" && message.category && (
                <button className="ai-category-button" onClick={() => onSelectCategory(message.category!)}>
                  Voir les artisans en {message.category}
                </button>
              )}
            </div>
          ))}
          {loading && <p className="ai-thinking" role="status">L’assistant réfléchit…</p>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form className="ai-form" onSubmit={sendMessage}>
          <label className="sr-only" htmlFor="ai-message">Décrivez votre problème</label>
          <textarea id="ai-message" rows={2} maxLength={1000} placeholder="Ex. : le robinet de la cuisine fuit…" value={input} onChange={(event) => setInput(event.target.value)} disabled={loading} />
          <button className="primary-button" type="submit" disabled={loading || !input.trim()}>{loading ? "Envoi…" : "Envoyer"}</button>
        </form>
      </section>
    </div>
  );
}
