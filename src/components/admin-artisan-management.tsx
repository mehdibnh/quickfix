"use client";

import { useEffect, useState, type FormEvent } from "react";

type ManagedArtisan = {
  id: string;
  name: string;
  email: string;
  phone: string;
  isSuspended: boolean;
  isAvailable: boolean;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  category: string;
  city: string;
  bio: string;
  indicativePriceMin: number | null;
  indicativePriceMax: number | null;
  createdAt: string;
};

type ArtisanForm = {
  name: string;
  email: string;
  phone: string;
  category: string;
  city: string;
  bio: string;
  indicativePriceMin: string;
  indicativePriceMax: string;
  isAvailable: boolean;
  isSuspended: boolean;
};

const emptyForm: ArtisanForm = {
  name: "",
  email: "",
  phone: "",
  category: "",
  city: "",
  bio: "",
  indicativePriceMin: "",
  indicativePriceMax: "",
  isAvailable: true,
  isSuspended: false,
};

const statusLabels: Record<ManagedArtisan["verificationStatus"], string> = { PENDING: "En attente", VERIFIED: "Vérifié", REJECTED: "Refusé" };

export function AdminArtisanManagement() {
  const [artisans, setArtisans] = useState<ManagedArtisan[]>([]);
  const [form, setForm] = useState<ArtisanForm>(emptyForm);
  const [editing, setEditing] = useState<ManagedArtisan | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [temporaryPassword, setTemporaryPassword] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/artisans?view=all", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result: { artisans?: ManagedArtisan[]; error?: string } = await response.json();
        if (!response.ok || !result.artisans) throw new Error(result.error ?? "Impossible de charger les artisans.");
        setArtisans(result.artisans);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Chargement des artisans impossible :", loadError);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les artisans.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  function openCreateForm() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setTemporaryPassword("");
    setError("");
    setNotice("");
  }

  function openEditForm(artisan: ManagedArtisan) {
    setEditing(artisan);
    setFormOpen(true);
    setForm({
      name: artisan.name,
      email: artisan.email,
      phone: artisan.phone,
      category: artisan.category,
      city: artisan.city,
      bio: artisan.bio,
      indicativePriceMin: artisan.indicativePriceMin?.toString() ?? "",
      indicativePriceMax: artisan.indicativePriceMax?.toString() ?? "",
      isAvailable: artisan.isAvailable,
      isSuspended: artisan.isSuspended,
    });
    setTemporaryPassword("");
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setTemporaryPassword("");
    try {
      const response = await fetch("/api/admin/artisans", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { action: "edit", profileId: editing.id } : {}),
          ...form,
          indicativePriceMin: form.indicativePriceMin,
          indicativePriceMax: form.indicativePriceMax,
        }),
      });
      const result: { error?: string; temporaryPassword?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer l’artisan.");

      if (!editing && result.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword);
        setNotice("Compte créé. Copiez le mot de passe temporaire et communiquez-le à l’artisan de manière sécurisée. Il devra le changer à sa première connexion.");
      } else {
        setNotice(editing?.isSuspended && !form.isSuspended ? "Compte réactivé." : "Modifications enregistrées.");
      }

      setEditing(null);
      setFormOpen(false);
      setForm(emptyForm);
      setReloadKey((key) => key + 1);
    } catch (submitError) {
      console.error("Enregistrement de l’artisan impossible :", submitError);
      setError(submitError instanceof Error ? submitError.message : "Impossible d’enregistrer l’artisan.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(artisan: ManagedArtisan) {
    if (!window.confirm(`Désactiver le compte de ${artisan.name} ? Son historique sera conservé et son profil masqué.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/artisans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: artisan.id }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible de désactiver le compte.");
      setNotice(`Le compte de ${artisan.name} est désactivé. Son historique est conservé.`);
      setReloadKey((key) => key + 1);
    } catch (deactivateError) {
      console.error("Désactivation de l’artisan impossible :", deactivateError);
      setError(deactivateError instanceof Error ? deactivateError.message : "Impossible de désactiver le compte.");
    } finally {
      setBusy(false);
    }
  }

  async function copyTemporaryPassword() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setNotice("Mot de passe copié. Communiquez-le à l’artisan par un canal sécurisé.");
    } catch (copyError) {
      console.error("Copie du mot de passe temporaire impossible :", copyError);
      setError("Copie impossible. Sélectionnez le mot de passe et copiez-le manuellement.");
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-heading">
        <div><h1>Gestion des artisans</h1><p>Ajoutez, modifiez, désactivez ou réactivez un compte artisan.</p></div>
        <button className="primary-button" onClick={openCreateForm}>Ajouter un artisan</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {temporaryPassword && <div className="temporary-password"><label htmlFor="temporary-password">Mot de passe temporaire — affiché uniquement maintenant</label><div><input id="temporary-password" readOnly value={temporaryPassword} /><button className="secondary-button" onClick={() => void copyTemporaryPassword()}>Copier</button></div></div>}

      {editing !== null && <p className="admin-editing" role="status">Modification de {editing.name}</p>}
      {loading ? <p role="status">Chargement des artisans…</p> : artisans.length === 0 ? <div className="empty-state"><strong>Aucun artisan enregistré</strong><p>Ajoutez le premier compte artisan depuis cette page.</p></div> : (
        <div className="admin-artisan-list">
          {artisans.map((artisan) => (
            <article className="admin-artisan-card" key={artisan.id}>
              <div className="admin-artisan-top"><div><p className="eyebrow">{artisan.category} · {artisan.city}</p><h2>{artisan.name}</h2></div><span className={`admin-account-state ${artisan.isSuspended ? "suspended" : ""}`}>{artisan.isSuspended ? "Désactivé" : statusLabels[artisan.verificationStatus]}</span></div>
              <dl className="admin-artisan-details"><div><dt>E-mail</dt><dd>{artisan.email}</dd></div>{artisan.phone && <div><dt>Téléphone</dt><dd>{artisan.phone}</dd></div>}<div><dt>Disponibilité</dt><dd>{artisan.isAvailable ? "Disponible" : "Indisponible"}</dd></div></dl>
              <p className="admin-bio">{artisan.bio || "Aucune présentation renseignée."}</p>
              <div className="request-actions"><button className="secondary-button" disabled={busy} onClick={() => openEditForm(artisan)}>Modifier</button>{!artisan.isSuspended && <button className="secondary-button" disabled={busy} onClick={() => void deactivate(artisan)}>Désactiver</button>}</div>
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setEditing(null); setFormOpen(false); setForm(emptyForm); } }}>
          <section className="artisan-modal admin-form-modal" role="dialog" aria-modal="true" aria-labelledby="admin-form-title">
            <button className="modal-close" disabled={busy} onClick={() => { setEditing(null); setFormOpen(false); setForm(emptyForm); }} aria-label="Fermer">×</button>
            <p className="eyebrow">GESTION ADMINISTRATEUR</p>
            <h2 id="admin-form-title">{editing ? "Modifier l’artisan" : "Ajouter un artisan"}</h2>
            <form className="dialog-form admin-artisan-form" onSubmit={submit}>
              <label>Nom complet<input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>E-mail<input type="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>Téléphone<input maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label>Métier / filière<input required minLength={2} maxLength={80} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
              <label>Ville<input required minLength={2} maxLength={80} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
              <label>Présentation<textarea rows={3} maxLength={1200} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
              <div className="admin-price-fields"><label>Tarif minimum (DT)<input type="number" min="0" step="0.01" value={form.indicativePriceMin} onChange={(event) => setForm({ ...form, indicativePriceMin: event.target.value })} /></label><label>Tarif maximum (DT)<input type="number" min="0" step="0.01" value={form.indicativePriceMax} onChange={(event) => setForm({ ...form, indicativePriceMax: event.target.value })} /></label></div>
              {editing && <><label className="admin-checkbox"><input type="checkbox" checked={form.isAvailable} onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })} /> Disponible pour les demandes</label><label className="admin-checkbox"><input type="checkbox" checked={!form.isSuspended} onChange={(event) => setForm({ ...form, isSuspended: !event.target.checked })} /> Compte actif</label></>}
              {!editing && <p className="form-hint">Un mot de passe temporaire sera généré et affiché une seule fois après création. Le profil restera en attente de vérification.</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button" type="submit" disabled={busy}>{busy ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Créer le compte artisan"}</button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
