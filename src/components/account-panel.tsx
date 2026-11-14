"use client";

import { useState, type FormEvent } from "react";
import type { AppUser } from "@/components/auth-dialog";

export function AccountPanel({ user, onPasswordChanged }: { user: AppUser; onPasswordChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Impossible de changer le mot de passe.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      onPasswordChanged();
      setMessage("Mot de passe modifié. Les autres sessions ont été fermées.");
    } catch (submitError) {
      console.error("Changement de mot de passe impossible :", submitError);
      setError("Le service est momentanément indisponible. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="account-panel">
      <p className="eyebrow">VOTRE ESPACE QUICKFIX</p>
      <h1>Mon profil</h1>
      <div className="account-summary"><span className="avatar avatar-small sage">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.role === "ARTISAN" ? "Compte artisan" : user.role === "ADMIN" ? "Compte administrateur" : "Compte client"}</small></span></div>
      <div className="account-security">
        <h2>Sécurité du compte</h2>
        <p>{user.mustChangePassword ? "Pour des raisons de sécurité, changez votre mot de passe temporaire avant de continuer." : "Choisissez un mot de passe unique d’au moins 12 caractères."}</p>
        <form className="dialog-form" onSubmit={changePassword}>
          <label>Mot de passe actuel<input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label>Nouveau mot de passe<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="success-message" role="status">{message}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Modification…" : "Changer le mot de passe"}</button>
        </form>
      </div>
    </section>
  );
}
