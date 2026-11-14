"use client";

import { useState, type FormEvent } from "react";

type RequestDialogProps = {
  artisan: { id: string; name: string; category: string };
  onClose: () => void;
  onCreated: () => void;
};

function defaultSchedule() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(9, 0, 0, 0);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function RequestDialog({ artisan, onClose, onCreated }: RequestDialogProps) {
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artisanId: artisan.id, description, address, scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Impossible d’envoyer la demande.");
        return;
      }
      onCreated();
    } catch (submitError) {
      console.error("Envoi de la demande impossible :", submitError);
      setError("Le service est momentanément indisponible. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop request-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="artisan-modal request-modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
        <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <p className="eyebrow">NOUVELLE DEMANDE · {artisan.category}</p>
        <h2 id="request-title">Contacter {artisan.name}</h2>
        <p className="modal-description">L’adresse et les détails seront partagés uniquement avec cet artisan dans le cadre de la demande.</p>
        <form className="dialog-form" onSubmit={submit}>
          <label>Description du besoin<textarea required minLength={10} maxLength={2000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Adresse d’intervention<input required maxLength={300} autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <label>Date et heure souhaitées<input required type="datetime-local" min={defaultSchedule()} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Envoi…" : "Envoyer la demande"}</button>
        </form>
      </section>
    </div>
  );
}
