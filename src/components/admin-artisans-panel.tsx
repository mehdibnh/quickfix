"use client";

import { useEffect, useState } from "react";
import { AdminArtisanManagement } from "@/components/admin-artisan-management";

type PendingArtisan = {
  id: string;
  name: string;
  email: string;
  phone: string;
  isSuspended: boolean;
  category: string;
  city: string;
  bio: string;
  indicativePriceMin: number | null;
  indicativePriceMax: number | null;
  createdAt: string;
};

export function AdminArtisansPanel() {
  const [page, setPage] = useState<"verification" | "management">("verification");
  const [artisans, setArtisans] = useState<PendingArtisan[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/artisans", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result: { artisans?: PendingArtisan[]; error?: string } = await response.json();
        if (!response.ok || !result.artisans) throw new Error(result.error ?? "Impossible de charger les profils.");
        setArtisans(result.artisans);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Chargement des profils à vérifier impossible :", loadError);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les profils.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  async function decide(profileId: string, status: "VERIFIED" | "REJECTED") {
    const reason = reasons[profileId]?.trim() ?? "";
    if (status === "REJECTED" && reason.length < 5) {
      setError("Pour refuser un profil, indiquez un motif d’au moins 5 caractères.");
      return;
    }

    setBusyId(profileId);
    setError("");
    try {
      const response = await fetch("/api/admin/artisans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, status, reason }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer la décision.");
      setArtisans((current) => current.filter((artisan) => artisan.id !== profileId));
      setReasons((current) => {
        const next = { ...current };
        delete next[profileId];
        return next;
      });
    } catch (decisionError) {
      console.error("Décision de vérification impossible :", decisionError);
      setError(decisionError instanceof Error ? decisionError.message : "Impossible d’enregistrer la décision.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="admin-panel">
      <p className="eyebrow">ESPACE SÉCURISÉ</p>
      <nav className="admin-pages" aria-label="Pages d’administration">
        <button className={page === "verification" ? "admin-page active" : "admin-page"} onClick={() => setPage("verification")}>Vérification</button>
        <button className={page === "management" ? "admin-page active" : "admin-page"} onClick={() => setPage("management")}>Gestion des artisans</button>
      </nav>
      {page === "management" ? <AdminArtisanManagement /> : <>
      <div className="admin-heading"><div><h1>Vérification des artisans</h1><p>Contrôlez les informations avant publication du profil.</p></div><span className="admin-count">{artisans.length} en attente</span></div>
      {error && <div className="form-error" role="alert">{error} <button className="text-link" onClick={() => setReloadKey((key) => key + 1)}>Réessayer</button></div>}
      {loading ? <p role="status">Chargement des dossiers…</p> : artisans.length === 0 ? <div className="empty-state"><strong>Aucun profil en attente</strong><p>Les nouveaux profils artisans apparaîtront ici.</p></div> : (
        <div className="admin-artisan-list">
          {artisans.map((artisan) => (
            <article className="admin-artisan-card" key={artisan.id}>
              <div className="admin-artisan-top"><div><p className="eyebrow">{artisan.category} · {artisan.city}</p><h2>{artisan.name}</h2></div><span className={`admin-account-state ${artisan.isSuspended ? "suspended" : ""}`}>{artisan.isSuspended ? "Compte suspendu" : "À vérifier"}</span></div>
              <dl className="admin-artisan-details">
                <div><dt>E-mail</dt><dd>{artisan.email}</dd></div>
                {artisan.phone && <div><dt>Téléphone</dt><dd>{artisan.phone}</dd></div>}
                <div><dt>Inscription</dt><dd>{new Date(artisan.createdAt).toLocaleDateString("fr-FR")}</dd></div>
                {(artisan.indicativePriceMin !== null || artisan.indicativePriceMax !== null) && <div><dt>Tarif indicatif</dt><dd>{artisan.indicativePriceMin ?? "—"} – {artisan.indicativePriceMax ?? "—"} DT</dd></div>}
              </dl>
              <p className="admin-bio">{artisan.bio || "Aucune présentation renseignée."}</p>
              {artisan.isSuspended && <p className="form-error">Ce compte est suspendu : le profil ne sera pas visible même après approbation.</p>}
              <label className="admin-reason">Motif de refus (obligatoire en cas de refus)
                <textarea maxLength={500} rows={2} value={reasons[artisan.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [artisan.id]: event.target.value }))} />
              </label>
              <div className="request-actions">
                <button className="primary-button" disabled={busyId === artisan.id || artisan.isSuspended} onClick={() => void decide(artisan.id, "VERIFIED")}>{busyId === artisan.id ? "Enregistrement…" : "Approuver et publier"}</button>
                <button className="secondary-button" disabled={busyId === artisan.id} onClick={() => void decide(artisan.id, "REJECTED")}>{busyId === artisan.id ? "Enregistrement…" : "Refuser"}</button>
              </div>
            </article>
          ))}
        </div>
      )}
      </>}
    </section>
  );
}
