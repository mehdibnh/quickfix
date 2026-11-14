"use client";

import { useState, type FormEvent } from "react";

export type AppUser = {
  id: string;
  name: string;
  role: "CLIENT" | "ARTISAN" | "ADMIN";
  mustChangePassword: boolean;
};

type AuthDialogProps = {
  initialMode: "login" | "register";
  onClose: () => void;
  onSuccess: (user: AppUser) => void;
};

export function AuthDialog({ initialMode, onClose, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { name, phone, email, password } : { email, password }),
      });
      const result: { user?: AppUser; error?: string } = await response.json();
      if (!response.ok || !result.user) {
        setError(result.error ?? "Impossible de traiter la demande.");
        return;
      }
      onSuccess(result.user);
    } catch (submitError) {
      console.error("Authentification impossible :", submitError);
      setError("Le service est momentanément indisponible. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="artisan-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <p className="eyebrow">VOTRE ESPACE QUICKFIX</p>
        <h2 id="auth-title">{mode === "register" ? "Créer un compte client" : "Connexion"}</h2>
        <p className="modal-description">{mode === "register" ? "Créez un compte pour demander une intervention et suivre vos demandes." : "Connectez-vous pour retrouver vos demandes."}</p>
        <form className="dialog-form" onSubmit={submit}>
          {mode === "register" && <>
            <label>Nom complet<input autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Téléphone (facultatif)<input autoComplete="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          </>}
          <label>Adresse e-mail<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Mot de passe<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {mode === "register" && <small className="form-hint">12 caractères minimum. Les comptes artisans sont créés séparément et vérifiés avant publication.</small>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Patientez…" : mode === "register" ? "Créer mon compte" : "Se connecter"}</button>
        </form>
        <button className="auth-switch" onClick={() => { setError(""); setMode(mode === "register" ? "login" : "register"); }}>
          {mode === "register" ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S’inscrire"}
        </button>
      </section>
    </div>
  );
}
